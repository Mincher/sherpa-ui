/**
 * SherpaElement — shared base class for all Sherpa web components.
 *
 * Handles:
 *   • Template fetching with class-level caching
 *   • Shadow DOM setup (CSS via adoptedStyleSheets, HTML via fetch)
 *   • @import resolution for constructable stylesheets
 *   • Multi-template support (`<template id="...">` blocks)
 *   • Slot presence detection (`data-has-*` on host)
 *   • Query helpers `$(sel)` and `$$(sel)` on the shadow root
 *
 * Subclass lifecycle hooks (all optional):
 *   • `onRender()`  — called after shadow DOM is populated
 *   • `onConnect()` — called once after first render completes
 *   • `onDisconnect()` — called on disconnectedCallback
 *   • `onAttributeChanged(name, oldValue, newValue)`
 *   • `onJsonData(data)` — called after data-src-json is fetched and parsed
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

import { getSheet } from "../stylesheet-cache.js";
import { getCategory, getTier } from "../component-categories.js";

// ── Class-level caches ─────────────────────────────────────────────
const _htmlCache = new Map();
const _templateMapCache = new Map();
const _classSheets = new Map();
const _warnedRejections = new Set();

// ── Shared stylesheet URLs ─────────────────────────────────────────
const BASE_URL = new URL("./sherpa-base.css", import.meta.url).href;
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

export { BASE_URL, FA_URL, TEXT_URL, ICON_URL, MOTION_URL };

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

  /** Shared stylesheets adopted by every shadow root. Override to customise. */
  static get sharedStyles() {
    return [BASE_URL, FA_URL, TEXT_URL, ICON_URL, MOTION_URL];
  }

  /**
   * When `true`, slot allowlists declared via `<slot data-accepts="...">`
   * are enforced at runtime. Disallowed children are flagged with
   * `data-slot-rejected="true"` (hidden by global CSS) and a warning is
   * logged once per (host-tag, slot-name, child-tag) triple.
   *
   * Default `false` for back-compat — Phase 3 of the slot taxonomy roll-out
   * flips this on after a soak period observing console warnings.
   */
  static strictSlots = false;

  /* ── Observed attributes ──────────────────────────────────────── */

  static get observedAttributes() {
    return ["data-src-html", "data-src-json"];
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
    if (this.#rendered) {
      if (name === "data-src-html" && newValue) this.renderFromUrl(newValue);
      if (name === "data-src-json" && newValue) this.#fetchJson(newValue);
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

  /**
   * Called after `data-src-json` is fetched and parsed.
   * Override in subclasses to process the loaded data.
   * @param {*} _data — parsed JSON value
   */
  onJsonData(_data) {}

  /**
   * Called when a `data-src-json` fetch fails (network error, non-OK
   * response, or malformed JSON). Override to handle the error state.
   * @param {string} _url — the URL that failed
   * @param {Error}  _error
   */
  onJsonError(_url, _error) {}

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

  /* ── Constructable stylesheet adoption ─────────────────────────── */

  async #adoptStyles() {
    const Ctor = this.constructor;
    if (!_classSheets.has(Ctor)) {
      const urls = [...Ctor.sharedStyles];
      if (Ctor.cssUrl) urls.push(Ctor.cssUrl);
      _classSheets.set(
        Ctor,
        urls.length
          ? Promise.all(urls.map((u) => getSheet(u).catch(() => null))).then(
              (r) => r.filter(Boolean),
            )
          : Promise.resolve([]),
      );
    }
    this.#shadow.adoptedStyleSheets = await _classSheets.get(Ctor);
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

    // Start stylesheet adoption (parallel with HTML fetch)
    const stylesReady = this.#adoptStyles();

    // Fetch HTML template (once per class)
    let rawHtml = _htmlCache.get(Ctor);
    if (rawHtml === undefined && Ctor.htmlUrl) {
      try {
        rawHtml = await fetch(Ctor.htmlUrl).then((r) => {
          if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
          return r.text();
        });
      } catch {
        rawHtml = "";
      }
      _htmlCache.set(Ctor, rawHtml);
    }

    // Wait for stylesheets before populating DOM (prevents FOUC)
    await stylesReady;

    // Parse multi-template blocks (once per class)
    let tplMap = _templateMapCache.get(Ctor);
    if (tplMap === undefined) {
      tplMap = parseTemplates(rawHtml);
      _templateMapCache.set(Ctor, tplMap);
    }

    const html = this.#resolveHtml(tplMap, rawHtml, this.templateId);
    this.#shadow.innerHTML = html;

    await this.onRender();
    this.#wireSlots();
    this.#rendered = true;
    this.onConnect();

    // Trigger initial data-src-json load if the attribute was set at
    // authoring time (attributeChangedCallback fires before #rendered
    // is set, so the guard above would have skipped it).
    if (this.dataset.srcJson) await this.#fetchJson(this.dataset.srcJson);
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

    this.#shadow.innerHTML = html;

    await this.onRender();
    this.#wireSlots();
  }

  /* ── JSON data loading ───────────────────────────────────────── */

  /**
   * Fetch a JSON file and call `onJsonData(data)` with the parsed result.
   * Used internally by `data-src-json` attribute handling.
   * @param {string} url
   */
  async #fetchJson(url) {
    if (!url) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        const err = new Error(`${resp.status} ${resp.statusText}`);
        this.onJsonError(url, err);
        return;
      }
      const data = await resp.json();
      this.onJsonData(data);
    } catch (e) {
      console.error(`SherpaElement.#fetchJson: failed to load ${url}`, e);
      this.onJsonError(url, e instanceof Error ? e : new Error(String(e)));
    }
  }

  /* ── Dynamic content loading ──────────────────────────────────── */

  /**
   * Build fetch candidates for template/data URLs so components keep working
   * when served from either web root or a nested base path.
   * @param {string} url
   * @returns {string[]}
   */
  #buildFetchCandidates(url) {
    const candidates = [url];

    // Absolute root paths can fail when the app is mounted under a sub-path
    // (e.g. /sherpa-ui). Add a relative fallback for those deployments.
    if (url.startsWith("/")) {
      candidates.push(`.${url}`);
      candidates.push(url.replace(/^\/+/, ""));
    }

    // Relative paths can fail when a server expects root-based URLs.
    const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url);
    if (!hasScheme && !url.startsWith("/")) {
      candidates.push(`/${url.replace(/^\.\//, "")}`);
    }

    return [...new Set(candidates)].filter(Boolean);
  }

  /**
   * Re-render shadow DOM with HTML fetched from the given URL.
   * adoptedStyleSheets persist on the shadow root across renders.
   * @param {string} url — URL to fetch HTML from
   * @returns {Promise<boolean>} — true if successful
   */
  async renderFromUrl(url) {
    const candidates = this.#buildFetchCandidates(url);
    let lastError = null;

    for (const candidate of candidates) {
      try {
        const resp = await fetch(candidate);
        if (!resp.ok) {
          lastError = new Error(`${resp.status} ${resp.statusText} (${candidate})`);
          continue;
        }
        const html = await resp.text();

        this.#shadow.innerHTML = html;

        // Wait for any custom elements in the loaded HTML to be defined
        // before calling onRender(), so subclass hooks can safely access
        // custom-element APIs (properties, methods) on queried children.
        const undef = this.#shadow.querySelectorAll(":not(:defined)");
        if (undef.length) {
          const tags = [...new Set([...undef].map((el) => el.localName))];
          await Promise.all(tags.map((t) => customElements.whenDefined(t)));
        }

        await this.onRender();
        this.#wireSlots();
        return true;
      } catch (e) {
        lastError = e;
      }
    }

    console.error(
      `SherpaElement.renderFromUrl: failed to load ${url}`,
      lastError,
      { candidates },
    );
    return false;
  }

  /* ── Slot presence detection ──────────────────────────────────── */

  #wireSlots() {
    for (const slot of this.#shadow.querySelectorAll("slot")) {
      slot.addEventListener("slotchange", () => {
        this.#validateSlot(slot);
        this.onSlotChange(slot);
      });
      this.#validateSlot(slot);
      this.onSlotChange(slot);
    }
  }

  /**
   * Validate slotted children against (a) the composition tier rule and
   * (b) the slot's `data-accepts` allowlist. The tier rule applies even
   * to slots without `data-accepts`: a child whose tier is *lower*
   * (more page-level) than its host's tier is rejected. See
   * docs/COMPONENT-CATEGORIES.md §4.
   *
   * Always logs (so warnings surface during the warn-only phase), but
   * only flags `data-slot-rejected` when `SherpaElement.strictSlots` is
   * true. The flag pairs with a global CSS rule that hides rejected
   * children.
   */
  #validateSlot(slotEl) {
    const acceptsAttr = slotEl.getAttribute("data-accepts");
    const hostTag = this.localName;
    const hostTier = getTier(hostTag);
    const slotName = slotEl.name || "(default)";

    // Unconstrained slot with no tier info: nothing to validate.
    if (!acceptsAttr && hostTier == null) {
      for (const node of slotEl.assignedElements()) {
        node.removeAttribute("data-slot-rejected");
      }
      return;
    }

    const accepts = acceptsAttr
      ? acceptsAttr.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    const allowHtml = accepts ? accepts.includes("html") : true;

    for (const node of slotEl.assignedElements()) {
      const tag = node.localName;
      const isSherpa = tag.startsWith("sherpa-");
      const category = isSherpa ? getCategory(tag) : null;
      const childTier = isSherpa ? getTier(tag) : null;

      // 1. Tier rule — applies whether or not data-accepts is set.
      let rejected = false;
      let reason = "";
      if (
        isSherpa &&
        hostTier != null &&
        childTier != null &&
        childTier < hostTier
      ) {
        rejected = true;
        reason =
          `tier ${childTier} (${category}) cannot be slotted into ` +
          `tier ${hostTier} host`;
      }

      // 2. Allowlist rule — only when data-accepts present.
      if (!rejected && accepts) {
        const allowed =
          (isSherpa && category && accepts.includes(category)) ||
          (!isSherpa && allowHtml);
        if (!allowed) {
          rejected = true;
          reason =
            `not in data-accepts. Allowed: ${accepts.join(", ")}. ` +
            (isSherpa
              ? `Got category: ${category || "unknown"}.`
              : `Non-sherpa elements need data-accepts="...,html".`);
        }
      }

      if (!rejected) {
        node.removeAttribute("data-slot-rejected");
        continue;
      }

      const warnKey = `${hostTag}|${slotName}|${tag}`;
      if (!_warnedRejections.has(warnKey)) {
        _warnedRejections.add(warnKey);
        console.warn(
          `[sherpa] <${tag}> not allowed in <${hostTag}> slot="${slotName}": ${reason}`
        );
      }
      if (SherpaElement.strictSlots) {
        node.setAttribute("data-slot-rejected", "true");
      } else {
        node.removeAttribute("data-slot-rejected");
      }
    }
  }

  /**
   * Checks whether a slot has meaningful content.
   * Light-DOM assigned nodes count (except <template> elements, which
   * are metadata fragments such as menu templates injected by mixins).
   * Text-only fallback counts. Element fallback (structural) does NOT count.
   */
  #slotHasContent(slotEl) {
    const assigned = slotEl.assignedNodes();
    if (assigned.length > 0) {
      return assigned.some(
        (n) =>
          (n.nodeType === Node.ELEMENT_NODE && n.localName !== "template") ||
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
