/**
 * sherpa-element.ts — the one base class, rebuilt from first principles.
 *
 * It does four things and nothing more:
 *   1. Fetch the component's HTML template (cached once per class) and its CSS.
 *   2. Adopt stylesheets into the shadow root (shared, deduped).
 *   3. Run a guarded lifecycle: onRender → onConnect, plus onChange / onDisconnect.
 *   4. Expose populate() → renderData() as the single data path.
 *
 * Everything a component can be seen doing lives in its CSS, selected off `data-*`
 * attributes. JS is the last resort — this class exists so a component author never
 * has to write plumbing, only behaviour.
 *
 * Contract for subclasses:
 *   static css      = new URL('./sherpa-foo.css',  import.meta.url);
 *   static html     = new URL('./sherpa-foo.html', import.meta.url);
 *   static observed = ['data-variant', 'data-size'];   // reflected to attributeChangedCallback
 *   onRender()        // shadow ready — cache refs, wire host listeners (fires exactly once)
 *   onChange(name, old, val)  // an observed attribute changed (after first render)
 *   onConnect()       // once, after the first render completes
 *   onDisconnect()    // teardown — timers, observers
 *   renderData(data)  // populate() payload
 */

/** Shared stylesheets adopted into every component's shadow root, in order. */
export interface SharedStyleSources {
  /** URLs whose CSS is adopted into every shadow root (base reset, tokens, functions). */
  shared: URL[];
}

/** A parsed template map: id → innerHTML. `null` when the file is a single flat template. */
type TemplateMap = Map<string, string> | null;

/* ── Class-level caches (keyed by resolved URL string, shared across instances) ── */
const htmlCache = new Map<string, Promise<string>>();
const templateCache = new Map<string, TemplateMap>();
const sheetCache = new Map<string, Promise<CSSStyleSheet>>();

/**
 * Fetch a stylesheet URL once and return a constructable CSSStyleSheet. Shared
 * across every element that adopts the same URL — one network hit, one sheet object.
 */
function loadSheet(url: string): Promise<CSSStyleSheet> {
  let pending = sheetCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((r) => r.text())
      .then((css) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        return sheet;
      });
    sheetCache.set(url, pending);
  }
  return pending;
}

/** Fetch an HTML file once per URL (cached promise). */
function loadHtml(url: string): Promise<string> {
  let pending = htmlCache.get(url);
  if (!pending) {
    pending = fetch(url).then((r) => r.text());
    htmlCache.set(url, pending);
  }
  return pending;
}

/**
 * Parse an HTML string into a map of `<template id="...">` → innerHTML. Returns
 * null when there are no id'd templates (a single flat template), so the caller
 * can fall back to the raw markup. Cloning prototypes (`<template class="...">`,
 * no id) are deliberately ignored here — they belong to the component's own body.
 */
export function parseTemplates(html: string): TemplateMap {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const templates = doc.querySelectorAll('template[id]');
  if (templates.length === 0) return null;
  const map = new Map<string, string>();
  for (const t of templates) map.set(t.id, (t as HTMLTemplateElement).innerHTML);
  return map;
}

/** Base class for every `sherpa-*` component. */
export abstract class SherpaElement extends HTMLElement {
  /**
   * URL of this component's CSS. Subclasses override. The projected component-scoped
   * token block is inlined at the TOP of this file (a marked, auto-regenerated region
   * written by scripts/project-tokens.mjs) — there is no separate <comp>.tokens.css.
   */
  static css?: URL;
  /** URL of this component's HTML template. Subclasses override. */
  static html?: URL;
  /** Attribute names to observe. Subclasses override (merge with super if extending). */
  static observed: string[] = [];
  /**
   * Component tier (naming standard, ratified 2026-09-02): `standalone` = a shipped
   * product component; `sub-component` = a design-only building block used only inside
   * a parent (excluded from the public catalog / sandbox picker, still registered so it
   * renders inside its parent). Sub-components also carry `@tier sub-component` in JSDoc.
   */
  static tier: 'standalone' | 'sub-component' = 'standalone';
  /** Shared stylesheet URLs adopted into every shadow root (set once at app init). */
  static sharedStyles: URL[] = [];

  static get observedAttributes(): string[] {
    return this.observed;
  }

  /** Open shadow root — queried via $ / $$, never touched directly by subclasses. */
  protected readonly root: ShadowRoot;

  /** Resolves once the first render (template + styles + onRender) has completed. */
  readonly rendered: Promise<void>;
  #resolveRendered!: () => void;

  #hasRendered = false;
  #connected = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.rendered = new Promise((res) => (this.#resolveRendered = res));
  }

  /* ── Native lifecycle ─────────────────────────────────────────────── */

  connectedCallback(): void {
    if (!this.#hasRendered) {
      void this.#bootstrap();
    } else if (!this.#connected) {
      this.#connected = true;
      this.onConnect();
    }
  }

  disconnectedCallback(): void {
    this.#connected = false;
    this.onDisconnect();
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    // Ignore no-op writes and anything before the first render — onRender reads
    // the initial attribute state itself.
    if (oldVal === newVal || !this.#hasRendered) return;
    this.onChange(name, oldVal, newVal);
  }

  /* ── Bootstrap: fetch template + styles, stamp shadow, run lifecycle ── */

  async #bootstrap(): Promise<void> {
    const Ctor = this.constructor as typeof SherpaElement;

    // Adopt styles and fetch HTML in parallel; await styles before writing DOM
    // (prevents a flash of unstyled content).
    const styling = this.#adoptStyles(Ctor);
    const markup = Ctor.html ? loadHtml(Ctor.html.href) : Promise.resolve('');
    const [, html] = await Promise.all([styling, markup]);

    this.root.innerHTML = this.#resolveTemplate(Ctor, html);

    this.#hasRendered = true;
    this.onRender();
    this.#wireSlots();
    this.#resolveRendered();

    if (!this.#connected && this.isConnected) {
      this.#connected = true;
      this.onConnect();
    }
  }

  /** Build the adopted-stylesheet list: shared sheets first, then this component's CSS. */
  async #adoptStyles(Ctor: typeof SherpaElement): Promise<void> {
    const urls = [...Ctor.sharedStyles.map((u) => u.href)];
    if (Ctor.css) urls.push(Ctor.css.href); // includes the inlined scoped-token region
    const sheets = await Promise.all(urls.map(loadSheet));
    this.root.adoptedStyleSheets = sheets;
  }

  /** Pick the template body: the id from `templateId`, else the first, else raw html. */
  #resolveTemplate(Ctor: typeof SherpaElement, html: string): string {
    const key = Ctor.html?.href;
    if (!key) return '';
    let map = templateCache.get(key);
    if (map === undefined) {
      map = parseTemplates(html);
      templateCache.set(key, map);
    }
    if (!map) return html; // single flat template
    const wanted = this.templateId;
    if (wanted && map.has(wanted)) return map.get(wanted)!;
    return map.values().next().value ?? html;
  }

  /**
   * Which template id to stamp. Default is the first template; subclasses with
   * multiple `<template id>` blocks override (e.g. `return this.dataset.mode`).
   */
  protected get templateId(): string | null {
    return null;
  }

  /* ── Slot-presence → data-has-{slot} on the host ─────────────────── */

  #wireSlots(): void {
    for (const slot of this.root.querySelectorAll('slot')) {
      const update = (): void => this.#reflectSlot(slot);
      slot.addEventListener('slotchange', update);
      update();
    }
  }

  #reflectSlot(slot: HTMLSlotElement): void {
    // assignedNodes() WITHOUT flatten returns only nodes the light DOM actually
    // assigned — NOT the slot's fallback content. (flatten:true would count a
    // slot's own default children as "present", collapsing them by their own
    // data-has-* rule.)
    const has = slot.assignedNodes().some((n) => {
      if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').trim().length > 0;
      return (n as Element).tagName !== 'TEMPLATE';
    });
    const attr = slot.name ? `data-has-${slot.name}` : 'data-has-content';
    this.toggleAttribute(attr, has);
  }

  /* ── Data path: populate() → renderData() ────────────────────────── */

  /**
   * The single entry point for data. Waits for the first render, then hands the
   * payload to renderData(). Idempotent to call before render — it defers.
   */
  populate(data: unknown): void {
    void this.rendered.then(() => this.renderData(data));
  }

  /** Override to render a data payload. Default is a no-op (attribute-only components). */
  protected renderData(_data: unknown): void {
    /* no-op by default */
  }

  /* ── Shadow queries + events ─────────────────────────────────────── */

  /** querySelector within the shadow root. */
  protected $<T extends Element = HTMLElement>(sel: string): T | null {
    return this.root.querySelector<T>(sel);
  }

  /** querySelectorAll within the shadow root, as an array. */
  protected $$<T extends Element = HTMLElement>(sel: string): T[] {
    return Array.from(this.root.querySelectorAll<T>(sel));
  }

  /** Dispatch a bubbling, composed CustomEvent (crosses the shadow boundary). */
  protected emit<T = unknown>(name: string, detail?: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  /* ── Lifecycle hooks (override as needed) ────────────────────────── */

  /** Shadow DOM is ready. Cache refs, set defaults, wire host listeners. Fires once. */
  protected onRender(): void {}
  /** Fires once after the first render, when the element is connected. */
  protected onConnect(): void {}
  /** Element removed from the DOM. Tear down timers / observers. */
  protected onDisconnect(): void {}
  /** An observed attribute changed (after the first render). */
  protected onChange(_name: string, _oldVal: string | null, _newVal: string | null): void {}
}
