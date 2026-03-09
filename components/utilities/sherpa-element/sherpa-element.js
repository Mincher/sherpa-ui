/**
 * SherpaElement — shared base class for all Sherpa web components.
 *
 * Handles:
 *   • Template fetching with class-level caching
 *   • Shadow DOM setup (CSS via `<link>`, HTML via fetch)
 *   • Multi-template support (`<template id="...">` blocks)
 *   • Slot presence detection (`data-has-*` on host)
 *   • Query helpers `$(sel)` and `$$(sel)` on the shadow root
 *
 * Subclass lifecycle hooks (all optional):
 *   • `onRender()`  — called after shadow DOM is populated
 *   • `onConnect()` — called once after first render completes
 *   • `onDisconnect()` — called on disconnectedCallback
 *   • `onAttributeChanged(name, oldValue, newValue)`
 *
 * Subclass configuration (static getters):
 *   • `static cssUrl`  — URL string for the component CSS file
 *   • `static htmlUrl` — URL string for the component HTML template
 *   • `static sharedStyles` — array of shared stylesheet URLs
 *
 * Multi-template support:
 *   When the HTML file contains `<template id="...">` blocks,
 *   SherpaElement parses them and clones the one matching the
 *   instance's `templateId` getter. The first template is the default.
 *
 *   Subclasses override `get templateId()` to select a template:
 *     get templateId() { return this.dataset.type === 'radio' ? 'radio' : 'default'; }
 *
 * Slot presence:
 *   Slot wrappers receive `data-has-content` when the slot has content.
 *   The host gets `data-has-{slotName}` attributes for named slots
 *   and `data-has-label` for the default slot.
 *
 *   Text-only fallback counts as content; element fallback does not.
 *   This distinction prevents structural template elements from
 *   triggering CSS rules meant for consumer-provided content.
 */

// ── Class-level caches ─────────────────────────────────────────────
const _htmlCache = new Map();
const _templateMapCache = new Map();

// ── Shared stylesheet URLs ─────────────────────────────────────────
const FA_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";
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
 * Returns a Map<id, innerHTML> if found, or null for flat HTML.
 */
export function parseTemplates(html) {
  if (!html || !html.includes("<template")) return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const templates = doc.querySelectorAll("template[id]");
  if (templates.length === 0) return null;

  const map = new Map();
  for (const t of templates) {
    const wrapper = document.createElement("div");
    wrapper.appendChild(t.content.cloneNode(true));
    map.set(t.id, wrapper.innerHTML);
  }
  return map;
}

export class SherpaElement extends HTMLElement {
  /* ── Static config (override in subclass) ─────────────────────── */

  static get cssUrl() {
    return null;
  }
  static get htmlUrl() {
    return null;
  }

  /** Shared stylesheets injected into every shadow root. Override to customise. */
  static get sharedStyles() {
    return [FA_URL, TEXT_URL, ICON_URL, MOTION_URL];
  }

  /* ── Observed attributes ──────────────────────────────────────── */

  static get observedAttributes() {
    return [];
  }

  /* ── Template selection (override in subclass) ────────────────── */

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

  /**
   * Called when a slot's distributed content changes.
   * Default: toggles `data-has-content` on the slot wrapper
   * and sets `data-has-{name}` on the host.
   */
  onSlotChange(slotEl) {
    const hasContent = this.#slotHasContent(slotEl);
    const wrapper = slotEl.parentElement;
    if (wrapper && wrapper !== this.#shadow) {
      wrapper.toggleAttribute("data-has-content", hasContent);
    }
    const name = slotEl.name || "label";
    this.toggleAttribute(`data-has-${name}`, hasContent);
  }

  /* ── Style link construction (DRY helper) ─────────────────────── */

  #buildStyleLinks() {
    const Ctor = this.constructor;
    const urls = [...Ctor.sharedStyles];
    if (Ctor.cssUrl) urls.push(Ctor.cssUrl);
    return urls.map((u) => `<link rel="stylesheet" href="${u}">`).join("");
  }

  /* ── Template resolution ──────────────────────────────────────── */

  #resolveHtml(tplMap, rawHtml, id) {
    return (
      (tplMap && id && tplMap.get(id)) ||
      (tplMap && tplMap.values().next().value) ||
      rawHtml ||
      ""
    );
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

    const html = this.#resolveHtml(tplMap, rawHtml, this.templateId);
    this.#shadow.innerHTML = `${this.#buildStyleLinks()}${html}`;

    await this.onRender();
    this.#wireSlots();
    this.#rendered = true;
    this.onConnect();
  }

  /* ── Re-render with a different template ────────────────────── */

  /**
   * Re-render the shadow DOM with a different template from the same
   * HTML file. No-fetch operation — uses class-level cache.
   * Calls `onRender()` and re-wires slot listeners.
   * @param {string} [id] — template id; falls back to first template.
   */
  async renderTemplate(id) {
    const Ctor = this.constructor;
    const tplMap = _templateMapCache.get(Ctor);
    const html = this.#resolveHtml(tplMap, _htmlCache.get(Ctor), id);

    this.#shadow.innerHTML = `${this.#buildStyleLinks()}${html}`;

    await this.onRender();
    this.#wireSlots();
  }

  /* ── Dynamic content loading ──────────────────────────────────── */

  /**
   * Re-render shadow DOM with HTML fetched from the given URL.
   * Preserves `<link>` and `<style>` elements from bootstrap.
   * @param {string} url — URL to fetch HTML from
   * @returns {Promise<boolean>} — true if successful
   */
  async renderFromUrl(url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return false;
      const html = await resp.text();

      for (const child of [...this.#shadow.childNodes]) {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          (child.tagName === "LINK" || child.tagName === "STYLE")
        )
          continue;
        child.remove();
      }

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
      this.onSlotChange(slot);
    }
  }

  /**
   * Checks whether a slot has meaningful content.
   * Light-DOM assigned nodes count. Text-only fallback counts.
   * Element fallback (structural) does NOT count.
   */
  #slotHasContent(slotEl) {
    const assigned = slotEl.assignedNodes();
    if (assigned.length > 0) {
      return assigned.some(
        (n) =>
          n.nodeType === Node.ELEMENT_NODE ||
          (n.nodeType === Node.TEXT_NODE && n.textContent.trim()),
      );
    }
    const flattened = slotEl.assignedNodes({ flatten: true });
    return flattened.some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
    );
  }

  /* ── Utility: wait for render ─────────────────────────────────── */

  get rendered() {
    return this.#renderPromise || Promise.resolve();
  }
}
