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
 *   static props    = { 'data-heading': { type: 'string', kind: 'content', to: '.title' } };
 *   static observed = ['disabled'];                    // native attrs + own-handling ones
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

/** How `num()` narrows a parsed value. */
export interface NumOptions {
  /** Clamp the result to at least this. */
  min?: number;
  /** Clamp the result to at most this. */
  max?: number;
  /** Truncate toward zero, so `"3.7"` reads as 3. */
  int?: boolean;
}

/**
 * Coerce a raw attribute string to a number, or return `fallback`.
 *
 * Exported so the data layer can parse a record field by exactly the same rule a
 * component parses an attribute — the `format-tick.ts` precedent: one shared
 * function so two callers cannot read the same value two different ways.
 *
 * ABSENT means: null, undefined, empty, whitespace-only, or unparseable. A real
 * 0 is a value, not an absence. The clamp runs only on a value that parsed — a
 * fallback is returned as given, so a caller's chosen default is never silently
 * moved by its own bounds.
 */
export function coerceNum(raw: string | null | undefined, fallback: number, opts?: NumOptions): number {
  // Trim first: ' ' is not absent to Number() — it coerces to 0.
  const text = raw?.trim();
  if (!text) return fallback;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return fallback;
  return clampNum(opts?.int === true ? Math.trunc(parsed) : parsed, opts);
}

/** Apply the min/max bounds from `opts`, if any. */
function clampNum(value: number, opts?: NumOptions): number {
  let out = value;
  if (opts?.min !== undefined) out = Math.max(opts.min, out);
  if (opts?.max !== undefined) out = Math.min(opts.max, out);
  return out;
}

/* ── Declarative attributes: `static props` ──────────────────────────────── */

/**
 * How a declared attribute is REALISED — the same three-way split the generated
 * `<name>.component.yaml` already uses, so the code and the contract agree:
 *
 *   content    — JS writes it into the shadow DOM (the base class does it here)
 *   style      — CSS selects on it; JS never reads it. DECLARED ONLY.
 *   visibility — presence toggles a CSS rule. Declared only, like style.
 *
 * Only `content` generates any work. `style` and `visibility` exist so the
 * attribute is TYPED and observable — a JS→CSS write path (`this.set()`), and a
 * place to hang non-CSS use later — without tempting anyone to add a JS branch
 * for something CSS already handles correctly.
 */
export type PropKind = 'content' | 'style' | 'visibility';

/** The declared type of an attribute's value. Mirrors schemas/component.v1.json. */
export type PropType = 'string' | 'number' | 'boolean' | 'enum';

/** One declared attribute. */
export interface PropDef {
  type: PropType;
  kind: PropKind;
  /**
   * Shadow-DOM selector this attribute's text is written into. `content` only.
   * Without it a `content` prop is observed but not auto-written — for a component
   * that needs its own handling in `onChange`.
   */
  to?: string;
  /** Write EVERY match rather than the first. A few templates repeat a node per layout. */
  all?: boolean;
  /**
   * Skip the write when this selector matches INSIDE the target. Guards content the
   * component put there for its own reasons — a projected `[slot]`, or a `<mark>`
   * left by a search highlight that a textContent write would erase.
   */
  skipWhen?: string;
  /** Read this attribute when the first is absent (e.g. data-label → data-heading). */
  fallbackAttr?: string;
  /**
   * How the value is RENDERED. Default is plain text.
   *
   * `'icon'` accepts both forms a Sherpa icon attribute has always allowed: a Font
   * Awesome class list ("fa-solid fa-tag") or a single raw glyph character ("+").
   * Without it, an FA class list is printed as literal text — which is exactly
   * what chip, tag, list-item and container-header used to do.
   */
  as?: 'text' | 'icon';
  /** Allowed values for an `enum`. Documentation + spec parity; not enforced at runtime. */
  values?: readonly string[];
  /** Used when the attribute is absent. Numbers go through coerceNum. */
  default?: string | number | boolean;
}

/** A component's whole declared attribute surface. */
export type PropMap = Readonly<Record<string, PropDef>>;

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

  /**
   * Declared attributes — the component's public surface, as data rather than code.
   *
   * Every key is observed automatically, and every `content` entry with a `to`
   * selector is written into the shadow DOM by the base class. That replaces the
   * hand-written `#syncX()` method and the `onChange` if-chain that used to pair
   * with each one.
   *
   * `style` / `visibility` entries generate NO work — they are declared so the
   * attribute is typed and observable. CSS keeps owning them.
   */
  static props: PropMap = {};

  /**
   * Observed = the declared props PLUS anything in `observed`.
   *
   * `observed` stays for native attributes (`disabled`, `value`, `min`) and for
   * attributes a component reacts to in its own `onChange` without a text write.
   * Deduped, so declaring an attribute in both is harmless.
   */
  static get observedAttributes(): string[] {
    const defs = Object.values(this.props);
    return [
      ...new Set([
        ...Object.keys(this.props),
        // A fallback source has to be observed too, or changing data-heading would
        // not re-sync a data-label that falls back to it.
        ...defs.map((d) => d.fallbackAttr).filter((a): a is string => a !== undefined),
        ...this.observed,
      ]),
    ];
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
    // A declared prop re-syncs itself. onChange still fires, so a component can do
    // extra work for the same attribute (sync an aria-* value, re-measure) without
    // also having to write the text.
    const Ctor = this.constructor as typeof SherpaElement;
    for (const [prop, def] of Object.entries(Ctor.props)) {
      // The prop itself, and any prop that FALLS BACK to it — data-label falling
      // back to data-heading has to re-sync when data-heading is what changed.
      if (prop === name || def.fallbackAttr === name) this.#syncProp(prop, def);
    }
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
    // Declared props are written BEFORE onRender, so a component's own setup can
    // read a populated shadow tree rather than racing the base class for it.
    this.#syncAllProps();
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
    // Yield a microtask so top-level module init (e.g. index.ts setting
    // SherpaElement.sharedStyles) has run before we read it — an element present
    // in the initial HTML can upgrade before that assignment executes.
    await Promise.resolve();
    const urls = [...Ctor.sharedStyles.map((u) => u.href)];
    if (Ctor.css) urls.push(Ctor.css.href); // includes the inlined scoped-token region
    // Load per-sheet with isolation: a failed/slow shared sheet (e.g. a cross-origin
    // CDN like Font Awesome) must NOT drop the others. Settle each, keep what loaded.
    const results = await Promise.allSettled(urls.map(loadSheet));
    const sheets = results
      .filter((r): r is PromiseFulfilledResult<CSSStyleSheet> => r.status === 'fulfilled')
      .map((r) => r.value);
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

  /* ── Attribute coercion ──────────────────────────────────────────── */

  /**
   * Read a NUMBER from an attribute, with a fallback and an optional clamp.
   *
   * The one place the library parses a numeric attribute, because doing it by
   * hand went wrong four different ways:
   *
   *   Number('')        === 0     — NOT NaN. An EMPTY attribute (which template
   *                                 engines emit freely) read as a real 0, so
   *                                 `data-min=""` pinned a chart's y-floor to 0
   *                                 and `data-ticks=""` silently meant "no axis".
   *   Number('' ?? 100) === 0     — `??` only catches undefined, never ''. A
   *                                 gauge's `data-max=""` read 0, not 100.
   *   parseInt('0') || 1 === 1    — `||` folds "0", "" and garbage together, so a
   *                                 legitimate 0 was indistinguishable from absent.
   *   Number(null)      === 0     — an absent attribute read as index 0, which
   *                                 would act on the FIRST row rather than none.
   *
   * So: anything that is not a finite number — absent, empty, whitespace, or
   * unparseable — is treated as ABSENT and returns `fallback`. A real 0 survives.
   *
   * Accepts the attribute name in either form (`data-max` or `max`); native
   * attributes work unprefixed, matching the naming contract.
   */
  protected num(attr: string, fallback: number, opts?: NumOptions): number {
    return coerceNum(this.getAttribute(attr), fallback, opts);
  }

  /**
   * Write an attribute from JS, so CSS can react to a data change.
   *
   * The declared counterpart of `this.dataset['len'] = String(count)` — which
   * sherpa-sparkline already does by hand to tell its CSS how many points it drew.
   * `null`, `undefined` and `false` REMOVE the attribute (so `:host([data-x])`
   * stops matching); `true` sets it empty (a bare boolean attribute).
   */
  protected set(attr: string, value: string | number | boolean | null | undefined): void {
    if (value == null || value === false) this.removeAttribute(attr);
    else this.setAttribute(attr, value === true ? '' : String(value));
  }

  /* ── Declared-prop sync ──────────────────────────────────────────── */

  /**
   * Write one declared `content` prop into the shadow DOM.
   *
   * Absent, empty and a missing target are all the same: write `''`, which lets the
   * component's own `:empty` / `data-has-*` CSS collapse the node. The base class
   * never hides anything itself — CSS owns visibility.
   */
  #syncProp(name: string, def: PropDef): void {
    if (def.kind !== 'content' || !def.to) return;

    const raw = this.getAttribute(name) ?? (def.fallbackAttr ? this.getAttribute(def.fallbackAttr) : null);
    const fallback = def.default === undefined ? '' : String(def.default);
    const text =
      def.type === 'number'
        ? String(coerceNum(raw, typeof def.default === 'number' ? def.default : NaN))
        : (raw ?? fallback);

    for (const el of def.all ? this.$$(def.to) : [this.$(def.to)]) {
      // `skipWhen` protects content the component owns: a projected [slot], or a
      // <mark> a search highlight left behind. A textContent write would erase it.
      if (!el || this.#guarded(el, def)) continue;
      if (def.as === 'icon') this.#writeIcon(el, text);
      else el.textContent = text === 'NaN' ? '' : text;
    }
  }

  /**
   * Render an icon value — a Font Awesome class list OR a single raw glyph.
   *
   * ONE policy, because there were three. Font Awesome draws its glyph from a
   * `::before` on a class, so an FA value has to become CLASSES; a raw character
   * has to become TEXT. Getting that backwards is silent: the class list prints
   * as literal text ("fa-solid fa-tag"), which is what chip, tag, list-item and
   * container-header all did, or the glyph vanishes.
   *
   * Classes go on the target ITSELF rather than a child `<i>`. Four components
   * used to build that child with `createElement`, which CLAUDE.md forbids, and
   * the child is not needed: any element can carry the FA classes.
   *
   * The target's own structural classes are preserved — only previously-applied
   * `fa-*` classes are removed, so a re-render never accumulates two icons.
   */
  #writeIcon(el: Element, value: string): void {
    for (const cls of [...el.classList]) if (cls.startsWith('fa-')) el.classList.remove(cls);
    if (value && /\bfa-/.test(value)) {
      el.classList.add(...value.split(/\s+/).filter(Boolean));
      el.textContent = '';
    } else {
      el.textContent = value === 'NaN' ? '' : value;
    }
  }

  /**
   * Is this target guarded against a write?
   *
   * `skipWhen` names a selector INSIDE the target. Two cases, and the difference
   * matters: a plain element (a `<mark>` a search highlight left, a projected
   * `[slot]` attribute) guards by merely existing, but a `<slot>` guards only when
   * a consumer has actually FILLED it. A `<slot>` in the template is the normal
   * state — treating its presence as a guard would stop the attribute working at
   * all, which is why `assignedNodes()` is checked rather than the tag alone.
   */
  #guarded(el: Element, def: PropDef): boolean {
    if (!def.skipWhen) return false;
    const found = el.querySelector(def.skipWhen);
    if (!found) return false;
    if (found instanceof HTMLSlotElement) return found.assignedNodes().length > 0;
    return true;
  }

  /** Write every declared `content` prop. Runs once after the first render. */
  #syncAllProps(): void {
    const Ctor = this.constructor as typeof SherpaElement;
    for (const [name, def] of Object.entries(Ctor.props)) this.#syncProp(name, def);
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

  /**
   * Clone a `<template class="…">` prototype's first element.
   *
   * The one way to stamp a repeating row. Three null policies were in use — an
   * early return, a `!` on the LOOKUP (which throws the moment a template is
   * renamed), and an unguarded optional chain — and every one of them then
   * asserted `content.firstElementChild!` regardless. That assertion is the real
   * hazard: a template whose first node is a comment or whitespace-only text
   * yields `null!`, and the crash lands at the next property access, far from the
   * cause.
   *
   * Returns `null` when the template is missing or empty. A caller that cannot
   * proceed without it should return early; there is nothing to assert.
   */
  protected clone<T extends Element = HTMLElement>(sel: string): T | null {
    const tpl = this.$<HTMLTemplateElement>(sel);
    // `content` is missing on a non-<template> element — a selector that matched
    // the wrong node fails here rather than throwing somewhere downstream.
    const first = tpl?.content?.firstElementChild;
    return first ? (first.cloneNode(true) as T) : null;
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
