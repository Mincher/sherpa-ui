/**
 * SherpaElement — shared base class for all Sherpa web components.
 *
 * Eliminates per-component boilerplate for:
 *   • Template fetching with class-level caching
 *   • Shadow DOM setup and rendering (all CSS via `<link>`, HTML via fetch)
 *   • Multi-template support (`<template id="...">` blocks in HTML files)
 *   • Slot presence detection (toggles `.has-content` on slot wrappers)
 *   • Query helpers `$(sel)` and `$$(sel)` on the shadow root
 *   • Centralised status styling via `data-status` attribute
 *
 * Subclass lifecycle hooks (all optional):
 *   • `onRender()`  — called after shadow DOM is populated, before slot wiring
 *   • `onConnect()` — called after first render completes (once)
 *   • `onDisconnect()` — called on disconnectedCallback
 *   • `onAttributeChanged(name, oldValue, newValue)` — called on attribute changes
 *   • `onStatusChanged(newValue, oldValue)` — called when status changes
 *
 * Subclass configuration (static getters):
 *   • `static cssUrl`  — URL string for the component CSS file
 *   • `static htmlUrl` — URL string for the component HTML template
 *   • `static statusIcons` — map of status → Font Awesome class (override to customise)
 *
 * Status styling:
 *   Global `[data-status]` selectors in sherpa-status-tokens.css set status
 *   colour tokens (`--_status-surface`, `--_status-border`, `--_status-text`,
 *   `--_status-icon`, etc.) on the host element. These custom properties
 *   inherit through the shadow DOM boundary so component CSS consumes them
 *   directly — no per-component status blocks needed.
 *
 *   Components use the standardised private tokens in their own CSS:
 *     background-color: var(--_status-surface);
 *     border-color: var(--_status-border);
 *     color: var(--_status-text);
 *     (icons) color: var(--_status-icon);
 *
 * Multi-template support:
 *   When the HTML file contains one or more `<template id="...">` blocks,
 *   SherpaElement parses them into a map and clones the one whose id matches
 *   the instance's `templateId` getter. The first `<template>` serves as
 *   the default when no id matches.
 *
 *   Subclasses override `get templateId()` to select a template at render
 *   time based on attributes or config:
 *
 *     get templateId() { return this.hasAttribute('icon-only') ? 'icon' : 'default'; }
 *
 *   If the HTML file contains NO `<template>` blocks (legacy format), the
 *   raw HTML is injected as-is (fully backwards compatible).
 *
 * Dynamic content loading:
 *   `renderFromUrl(url)` fetches HTML from an arbitrary URL and injects it
 *   into the shadow DOM, preserving the bootstrap `<link>` and `<style>`
 *   elements. Designed for components whose content is determined at runtime
 *   (e.g. navigation templates, container content definitions).
 *   Calls `onRender()` + slot wiring after injection.
 *
 * Slot presence:
 *   Slot wrappers (parent elements of `<slot>`) automatically receive
 *   `.has-content` class when the slot has assigned or fallback content.
 *   The host element gets `data-has-{slotName}` attributes for named slots
 *   and `data-has-label` for the default slot. Subclasses can override
 *   `onSlotChange(slotEl)` for custom slot handling.
 */

// Class-level caches: each subclass stores its own fetched HTML + parsed templates.
const _htmlCache = new Map(); // raw HTML string
const _templateMapCache = new Map(); // Map<id, HTMLString> (parsed from <template> blocks)

/** Font Awesome CDN — loaded once by the browser, shared across all shadow roots. */
const FA_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";

/** Shared utility stylesheets — injected as <link> into every shadow root. */
const TEXT_URL = new URL(
  "../../../css/styles/sherpa-text-classes.css",
  import.meta.url,
).href;
const ICON_URL = new URL(
  "../../../css/styles/sherpa-icon-classes.css",
  import.meta.url,
).href;
const MOTION_URL = new URL(
  "../../../css/styles/sherpa-motion-classes.css",
  import.meta.url,
).href;

/**
 * Parse an HTML string for `<template id="...">` blocks.
 * Returns a Map<id, innerHTML> if any are found, or null if the file uses
 * the legacy flat-HTML format.
 */
export function parseTemplates(html) {
  if (!html || !html.includes("<template")) return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const templates = doc.querySelectorAll("template[id]");
  if (templates.length === 0) return null;

  const map = new Map();
  for (const t of templates) {
    // Use a temporary div to serialize the fragment's inner HTML
    const wrapper = document.createElement("div");
    wrapper.appendChild(t.content.cloneNode(true));
    map.set(t.id, wrapper.innerHTML);
  }
  return map;
}

export class SherpaElement extends HTMLElement {
  /* ── Static resource URLs (override in subclass) ──────────────── */

  static get cssUrl() {
    return null;
  }
  static get htmlUrl() {
    return null;
  }

  /* ── Observed attributes ──────────────────────────────────────── */

  /**
   * Base observed attributes. Subclasses should spread these:
   *   static get observedAttributes() { return [...super.observedAttributes, 'data-my-attr']; }
   */
  static get observedAttributes() {
    return ["data-status"];
  }

  /* ── Status icon map (override in subclass to customise) ──────── */

  /**
   * Default status → Font Awesome icon class map.
   * Returns null for statuses that have no icon.
   * Subclasses override to use different icons (e.g. toast uses fa-circle-xmark).
   */
  static get statusIcons() {
    return {
      success: "fa-solid fa-circle-check",
      error: "fa-solid fa-circle-exclamation", // legacy alias → critical
      critical: "fa-solid fa-circle-exclamation",
      warning: "fa-solid fa-triangle-exclamation",
      info: "fa-solid fa-circle-info",
      neutral: "fa-regular fa-circle",
      urgent: "fa-solid fa-bolt",
      default: null,
      none: null,
    };
  }

  /* ── Template selection (override in subclass) ────────────────── */

  /**
   * Which `<template id>` to use from the HTML file.
   * Evaluated once at first render. Return null/undefined to use the
   * first template (default). Only relevant when the HTML file uses
   * multi-template format.
   */
  get templateId() {
    return null;
  }

  /* ── Instance ─────────────────────────────────────────────────── */

  #shadow = null;
  #rendered = false;
  #renderPromise = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  /* ── Status accessors ─────────────────────────────────────────── */

  /** Current status value, or null if unset. */
  get status() {
    return this.dataset.status || null;
  }
  set status(v) {
    v ? (this.dataset.status = v) : delete this.dataset.status;
  }

  /** Font Awesome class for the current status icon, or null. */
  get statusIcon() {
    return this.constructor.statusIcons?.[this.status] || null;
  }

  /* ── Shadow root query helpers ────────────────────────────────── */

  $(sel) {
    return this.#shadow.querySelector(sel);
  }
  $$(sel) {
    return this.#shadow.querySelectorAll(sel);
  }

  get shadow() {
    return this.#shadow;
  }

  /* ── Lifecycle ────────────────────────────────────────────────── */

  async connectedCallback() {
    if (!this.#rendered) {
      this.#renderPromise = this.#bootstrap();
      await this.#renderPromise;
    }
  }

  disconnectedCallback() {
    this.onDisconnect();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === "data-status") {
      this.onStatusChanged(newValue, oldValue);
    }
    this.onAttributeChanged(name, oldValue, newValue);
  }

  /* ── Hooks (override in subclass) ─────────────────────────────── */

  /** Called after shadow DOM is populated, before slot wiring. */
  onRender() {}

  /** Called once after first complete render + slot wiring. */
  onConnect() {}

  /** Called on disconnectedCallback. */
  onDisconnect() {}

  /** Called on attributeChangedCallback (only when value actually changed). */
  onAttributeChanged(_name, _oldValue, _newValue) {}

  /** Called when status attribute changes. Override for status-specific logic. */
  onStatusChanged(_newValue, _oldValue) {}

  /**
   * Called when a slot's distributed content changes.
   * Default implementation toggles `.has-content` on the slot's parent wrapper
   * and sets `data-has-{name}` on the host. Override for custom behaviour.
   */
  onSlotChange(slotEl) {
    const hasContent = this.#slotHasContent(slotEl);
    const wrapper = slotEl.parentElement;
    if (wrapper && wrapper !== this.#shadow) {
      wrapper.toggleAttribute("data-has-content", hasContent);
    }

    // Set host data attribute for external styling
    const name = slotEl.name || "label";
    this.toggleAttribute(`data-has-${name}`, hasContent);
  }

  /* ── Resource loading ─────────────────────────────────────────── */

  async #bootstrap() {
    const Ctor = this.constructor;

    // Fetch HTML template (once per class)
    let rawHtml = _htmlCache.get(Ctor);
    if (rawHtml === undefined && Ctor.htmlUrl) {
      try {
        rawHtml = await fetch(Ctor.htmlUrl).then((r) => r.text());
      } catch {
        rawHtml = "";
      }
      _htmlCache.set(Ctor, rawHtml);
    }

    // Parse multi-template blocks (once per class)
    let tplMap = _templateMapCache.get(Ctor);
    if (tplMap === undefined) {
      tplMap = parseTemplates(rawHtml);
      _templateMapCache.set(Ctor, tplMap);
    }

    // Resolve which HTML to inject
    let html;
    const id = this.templateId;
    html =
      (tplMap && id && tplMap.get(id)) ||
      (tplMap && tplMap.values().next().value) ||
      rawHtml ||
      "";

    // Populate shadow DOM — all CSS via <link> (browser-native, cached).
    const links = [
      `<link rel="stylesheet" href="${FA_URL}">`,
      `<link rel="stylesheet" href="${TEXT_URL}">`,
      `<link rel="stylesheet" href="${ICON_URL}">`,
      `<link rel="stylesheet" href="${MOTION_URL}">`,
      Ctor.cssUrl ? `<link rel="stylesheet" href="${Ctor.cssUrl}">` : "",
    ].join("");
    this.#shadow.innerHTML = `${links}${html}`;

    // Let subclass do post-render work (e.g. query inner elements, create auto-icons)
    await this.onRender();

    // Wire slot listeners — runs AFTER onRender so any auto-generated
    // light DOM content (e.g. button auto-icons) is already in place.
    this.#wireSlots();

    this.#rendered = true;
    this.onConnect();
  }

  /* ── Re-render with a different template ────────────────────── */

  /**
   * Re-render the shadow DOM with a different template from the same
   * HTML file.  Uses the class-level cached CSS and parsed template map
   * populated by the initial `#bootstrap()`, so this is a no-fetch
   * synchronous (or near-synchronous) operation.
   *
   * Designed for multi-template components that need to swap layout at
   * runtime (e.g. menu-item switching between default and toggle).
   * Calls `onRender()` and re-wires slot listeners.
   *
   * @param {string} [id] — template id to render; falls back to the
   *   first template if omitted or not found.
   */
  async renderTemplate(id) {
    const Ctor = this.constructor;
    const tplMap = _templateMapCache.get(Ctor);

    const html =
      (tplMap && id && tplMap.get(id)) ||
      (tplMap && tplMap.values().next().value) ||
      _htmlCache.get(Ctor) ||
      "";

    const links = [
      `<link rel="stylesheet" href="${FA_URL}">`,
      `<link rel="stylesheet" href="${TEXT_URL}">`,
      `<link rel="stylesheet" href="${ICON_URL}">`,
      `<link rel="stylesheet" href="${MOTION_URL}">`,
      Ctor.cssUrl ? `<link rel="stylesheet" href="${Ctor.cssUrl}">` : "",
    ].join("");
    this.#shadow.innerHTML = `${links}${html}`;

    await this.onRender();
    this.#wireSlots();
  }

  /* ── Template access ─────────────────────────────────────────── */

  /**
   * Return the raw HTML string for a named template from this
   * component's HTML file.  Returns empty string if not found.
   * Only works after the initial bootstrap has parsed the templates.
   * @param {string} id — template id
   * @returns {string}
   */
  getTemplateHtml(id) {
    const tplMap = _templateMapCache.get(this.constructor);
    return (tplMap && id && tplMap.get(id)) || "";
  }

  /* ── Dynamic content loading ──────────────────────────────────── */

  /**
   * Re-render the shadow DOM with HTML fetched from the given URL.
   * Preserves `<link>` and `<style>` elements from the initial bootstrap,
   * replacing only the HTML content portion.  Calls `onRender()` and
   * re-wires slot listeners afterward.
   *
   * Designed for components that load content dynamically at runtime
   * rather than from a static class-level template — e.g. sherpa-nav
   * (data-src).
   *
   * Unlike `renderTemplate(id)`, this fetches from an arbitrary URL
   * and does NOT use the class-level template cache.
   *
   * @param {string} url — URL to fetch HTML from
   * @returns {Promise<boolean>} — true if successful, false on error
   */
  async renderFromUrl(url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return false;
      const html = await resp.text();

      // Remove previous template content (preserve <link> and <style> from bootstrap)
      for (const child of [...this.#shadow.childNodes]) {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          (child.tagName === "LINK" || child.tagName === "STYLE")
        )
          continue;
        child.remove();
      }

      // Append new template content
      const temp = document.createElement("div");
      temp.innerHTML = html;
      this.#shadow.append(...temp.childNodes);

      await this.onRender();
      this.#wireSlots();
      return true;
    } catch (e) {
      console.error(`SherpaElement.renderFromUrl: failed to load ${url}`, e);
      return false;
    }
  }

  /* ── Slot presence detection ──────────────────────────────────── */

  #wireSlots() {
    for (const slot of this.#shadow.querySelectorAll("slot")) {
      slot.addEventListener("slotchange", () => this.onSlotChange(slot));
      // Run initial check
      this.onSlotChange(slot);
    }
  }

  /**
   * Checks whether a slot has meaningful content.
   *
   * "Content" means light-DOM nodes explicitly assigned by the consumer.
   * Fallback text (e.g. `<slot>Button</slot>`) is also counted so that
   * wrapper elements can show/hide via `data-has-*` even when the
   * consumer hasn't slotted anything.
   *
   * Structural element fallback (e.g. `<slot name="heading"><span
   * class="header-title"></span></slot>`) is intentionally excluded —
   * those elements are part of the component template, not consumer
   * content, and counting them would incorrectly trigger CSS rules
   * like `:host([data-has-heading]) .header-title { display: none }`.
   */
  #slotHasContent(slotEl) {
    // Check actual assigned nodes (light DOM content)
    const assigned = slotEl.assignedNodes();
    if (assigned.length > 0) {
      return assigned.some(
        (n) =>
          n.nodeType === Node.ELEMENT_NODE ||
          (n.nodeType === Node.TEXT_NODE && n.textContent.trim()),
      );
    }
    // No light DOM assigned — check for text-only fallback content.
    // Only text nodes count; element fallback is structural template
    // content and should not be treated as consumer-provided.
    const flattened = slotEl.assignedNodes({ flatten: true });
    return flattened.some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
    );
  }

  /* ── Utility: wait for render ─────────────────────────────────── */

  /** Returns a promise that resolves when the component's first render is complete. */
  get rendered() {
    return this.#renderPromise || Promise.resolve();
  }
}
