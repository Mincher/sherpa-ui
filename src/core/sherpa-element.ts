/**
 * sherpa-element.ts — the one base class, rebuilt from first principles.
 *
 * TRAP T-base-class-does-four-things — the four things it does, and the
 * subclass contract (`css`/`html`/`props`/`observed` + the five hooks).
 */

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
 * null when there are no id'd templates (a single flat template).
 *
 * TRAP T-cloning-prototypes-have-no-id — a `<template class>` item prototype is
 * ignored here, which is why it must not carry an `id`.
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
 * TRAP T-coerce-and-clamp-are-shared — exported so the data layer parses by the
 * same rule; ABSENT is null/undefined/empty/whitespace/unparseable, a real 0
 * survives, and the clamp runs only on a value that parsed.
 */
export function coerceNum(raw: string | null | undefined, fallback: number, opts?: NumOptions): number {
  // Trim first: ' ' is not absent to Number() — it coerces to 0.
  const text = raw?.trim();
  if (!text) return fallback;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return fallback;
  return clampNum(opts?.int === true ? Math.trunc(parsed) : parsed, opts);
}

/**
 * Rebuild `el` as before + `<mark class="match">` + after, around one hit.
 *
 * TRAP T-mark-match-is-one-shape — ONE shape for a search highlight: text
 * nodes not innerHTML, the HAYSTACK's casing, and the `<mark>` returned for
 * nav-item's `Range`.
 */
export function markMatch(el: Element, text: string, at: number, length: number): HTMLElement {
  const mark = document.createElement('mark');
  mark.className = 'match';
  mark.textContent = text.slice(at, at + length);
  el.replaceChildren(
    document.createTextNode(text.slice(0, at)),
    mark,
    document.createTextNode(text.slice(at + length)),
  );
  return mark;
}

/**
 * Apply the min/max bounds from `opts`, if any.
 *
 * TRAP T-coerce-and-clamp-are-shared — exported for the same reason
 * `coerceNum` is.
 */
export function clampNum(value: number, opts?: NumOptions): number {
  let out = value;
  if (opts?.min !== undefined) out = Math.max(opts.min, out);
  if (opts?.max !== undefined) out = Math.min(opts.max, out);
  return out;
}

/* ── Declarative attributes: `static props` ──────────────────────────────── */

/**
 * How a declared attribute is REALISED — the same three-way split the generated
 * `<name>.component.yaml` already uses, so the code and the contract agree.
 *
 * TRAP T-declared-only-means-css-owns-it — only `content` does any work.
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
   * Without it a `content` prop is observed but not auto-written.
   */
  to?: string;
  /** Write EVERY match rather than the first. A few templates repeat a node per layout. */
  all?: boolean;
  /**
   * Skip the write when this selector matches INSIDE the target. Guards content the
   * component put there for its own reasons — TRAP T-slot-guards-only-when-filled.
   */
  skipWhen?: string;
  /** Read this attribute when the first is absent (e.g. data-label → data-heading). */
  fallbackAttr?: string;
  /**
   * How the value is RENDERED. Default is plain text.
   *
   * TRAP T-icon-value-takes-two-forms — `'icon'` takes an FA class list OR one
   * raw glyph; without it an FA list prints as literal text.
   */
  as?: 'text' | 'icon';
  /** Allowed values for an `enum`. Documentation + spec parity; not enforced at runtime. */
  values?: readonly string[];
  /** Used when the attribute is absent. Numbers go through coerceNum. */
  default?: string | number | boolean;
}

/** A component's whole declared attribute surface. */
export type PropMap = Readonly<Record<string, PropDef>>;

/* ── Declarative items: the item-template attributes ─────────────────────── */
/*
 * NOT "rows". Twelve components stamp from a prototype — a barchart's bars, a
 * tab strip's tabs, a breadcrumb trail's crumbs, a legend's swatches — and only
 * one of them has rows. A base-class name that implies a presentation is a name
 * eleven components have to read past.
 * TRAP T-the-base-class-names-nothing-visual.
 */

/**
 * `renderItems()` fills a cloned prototype from the item's own fields, driven by
 * attributes in the template rather than a `fill` callback. An ITEM is whatever
 * the component repeats: a bar, a tab, a crumb, a legend swatch, a grid row.
 *
 * TRAP T-item-template-cannot-compute — the five attributes, the `??` field
 * fallback, and why there is no maths or formatting in a template.
 */
export type ItemTemplate = 'declarative';

/** Prefix→meaning for the row-template attributes, in the order they are applied. */
const ITEM_TEXT = 'data-text';
const ITEM_ICON = 'data-icon';
const ITEM_INDEX = 'data-index';
const ITEM_ATTR = 'data-attr-';
const ITEM_WHEN = 'data-when-';

/** Resolve `"header??field"` against an item: the first field that is not null. */
function fieldValue(item: unknown, expr: string): unknown {
  if (item == null || typeof item !== 'object') return undefined;
  const record = item as Record<string, unknown>;
  for (const name of expr.split('??')) {
    const value = record[name.trim()];
    if (value != null) return value;
  }
  return undefined;
}

/** Base class for every `sherpa-*` component. */
export abstract class SherpaElement extends HTMLElement {
  /**
   * URL of this component's CSS. Subclasses override. The projected component-scoped
   * token block is inlined at the TOP of that file (written by
   * scripts/project-tokens.mjs) — there is no separate <comp>.tokens.css.
   */
  static css?: URL;
  /** URL of this component's HTML template. Subclasses override. */
  static html?: URL;
  /** Attribute names to observe. Subclasses override (merge with super if extending). */
  static observed: string[] = [];
  /**
   * Component tier (naming standard, ratified 2026-09-02): `standalone` = a shipped
   * product component; `sub-component` = a design-only building block used only
   * inside a parent — excluded from the public catalog / sandbox picker, still
   * registered so it renders inside its parent, and carrying `@tier sub-component`.
   */
  static tier: 'standalone' | 'sub-component' = 'standalone';
  /** Shared stylesheet URLs adopted into every shadow root (set once at app init). */
  static sharedStyles: URL[] = [];

  /**
   * Declared attributes — the component's public surface, as data rather than code.
   *
   * Every key is observed automatically; a `content` entry with a `to` selector
   * is written into the shadow DOM here.
   * TRAP T-declared-only-means-css-owns-it — `style`/`visibility` do no work.
   */
  static props: PropMap = {};

  /**
   * The attributes `templateId` reads — so changing one RE-STAMPS the tree.
   *
   * TRAP T-variant-attrs-or-one-way-door — a multi-template component MUST list
   * them; left empty the variant is whatever the element was born with.
   */
  static variantAttrs: readonly string[] = [];

  /**
   * Observed = the declared props PLUS `variantAttrs` PLUS anything in `observed`.
   *
   * `observed` stays for native attributes and for attributes a component reacts
   * to in its own `onChange`. Deduped, so declaring in both is harmless.
   */
  static get observedAttributes(): string[] {
    const defs = Object.values(this.props);
    return [
      ...new Set([
        ...Object.keys(this.props),
        // A fallback source is observed too, or a data-heading change would not
        // re-sync a data-label that falls back to it.
        ...defs.map((d) => d.fallbackAttr).filter((a): a is string => a !== undefined),
        ...this.variantAttrs,
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

  /**
   * The template id currently STAMPED, so a later attribute change can tell
   * whether the component now wants a different tree.
   *
   * TRAP T-template-id-read-once-was-permanent — read once, a component kept
   * its FIRST tree for life.
   */
  #stampedTemplate: string | null = null;

  /**
   * Aborted on disconnect, and REPLACED on every connect.
   *
   * TRAP T-abort-controller-per-connect — FRESH PER CONNECT, and never cached
   * in a field.
   */
  #ac = new AbortController();

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.rendered = new Promise((res) => (this.#resolveRendered = res));
  }

  /* ── Native lifecycle ─────────────────────────────────────────────── */

  connectedCallback(): void {
    // BEFORE anything reads state — a shadowed property is state that never
    // arrived. TRAP T-a-property-set-before-upgrade-shadows-its-accessor.
    this.#upgradeProperties();
    // A RE-CONNECT needs a live signal: the last one was aborted on the way
    // out, and anything wired to it would be wired to nothing.
    if (this.#ac.signal.aborted) this.#ac = new AbortController();
    if (!this.#hasRendered) {
      void this.#bootstrap();
    } else if (!this.#connected) {
      this.#connected = true;
      this.onConnect();
    }
  }

  /**
   * Hand back any property a caller set BEFORE the element was upgraded.
   *
   * A value assigned to a not-yet-upgraded element lands as a plain own
   * property, and an own property beats the prototype accessor for the rest of
   * that element's life — so the setter never runs again, and the getter is
   * never asked. Deleting it and re-assigning routes the same value through
   * the accessor, which is where the real work is.
   *
   * TRAP T-a-property-set-before-upgrade-shadows-its-accessor.
   */
  #upgradeProperties(): void {
    const self = this as unknown as Record<string, unknown>;
    // The element's OWN keys only — the prototype's accessors are what we are
    // restoring access to, so walking further would find them and do nothing.
    for (const key of Object.keys(self)) {
      // `root` and `rendered` are this class's own fields, assigned in the
      // constructor. They are not accessors and must not be touched.
      if (!this.#isAccessor(key)) continue;
      const value = self[key];
      // `Reflect.deleteProperty`, not `delete` — deleting a computed key is
      // exactly what this pattern is, and the lint rule that forbids it is
      // right about every other case.
      Reflect.deleteProperty(self, key);
      self[key] = value;
    }
  }

  /** Does some prototype in the chain define `key` as an accessor? */
  #isAccessor(key: string): boolean {
    let proto: object | null = Object.getPrototypeOf(this) as object | null;
    while (proto && proto !== HTMLElement.prototype) {
      const d = Object.getOwnPropertyDescriptor(proto, key);
      if (d) return typeof d.get === 'function' || typeof d.set === 'function';
      proto = Object.getPrototypeOf(proto) as object | null;
    }
    return false;
  }

  disconnectedCallback(): void {
    this.#connected = false;
    // BEFORE onDisconnect, so a component's own teardown still runs after the
    // automatic one and can rely on the listeners already being gone.
    this.#ac.abort();
    this.onDisconnect();
  }

  /**
   * A signal that aborts when this element leaves the DOM — see `#ac`.
   *
   * READ IT WHERE YOU USE IT — TRAP T-abort-controller-per-connect.
   */
  protected get signal(): AbortSignal {
    return this.#ac.signal;
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    // No-op writes and anything before the first render: onRender reads the
    // initial attribute state itself.
    if (oldVal === newVal || !this.#hasRendered) return;
    // A declared prop re-syncs itself; onChange still fires afterwards.
    const Ctor = this.constructor as typeof SherpaElement;
    for (const [prop, def] of Object.entries(Ctor.props)) {
      // The prop itself, and any prop that FALLS BACK to it.
      if (prop === name || def.fallbackAttr === name) this.#syncProp(prop, def);
    }
    this.onChange(name, oldVal, newVal);
    // TRAP T-restamp-runs-after-on-change
    this.#restampIfVariantChanged();
  }

  /**
   * Re-stamp when the wanted template is no longer the stamped one.
   *
   * TRAP T-restamp-runs-after-on-change — cheap on the common path, and the
   * template map is already parsed and cached.
   */
  #restampIfVariantChanged(): void {
    const Ctor = this.constructor as typeof SherpaElement;
    const wanted = this.templateId;
    // A component with one template never opts in; only a CHANGE re-stamps.
    if (wanted === null || wanted === this.#stampedTemplate) return;

    // Parsed at first render and cached per URL — a re-stamp costs no fetch.
    const map = templateCache.get(Ctor.html?.href ?? '');
    if (!map?.has(wanted)) return;

    this.#stamp(map.get(wanted)!, wanted);
  }

  /**
   * Write a template body into the shadow root and run the setup that belongs to
   * THAT tree — shared by the first render and by a variant re-stamp.
   *
   * TRAP T-restamp-does-not-abort — this does NOT abort `#ac`, and why
   * `onRender` is re-run.
   */
  #stamp(body: string, id: string | null): void {
    this.root.innerHTML = body;
    this.#stampedTemplate = id;
    this.#hasRendered = true;
    // Declared props are written BEFORE onRender, so a component's own setup
    // reads a populated shadow tree.
    this.#syncAllProps();
    this.onRender();
    this.#wireSlots();
  }

  /* ── Bootstrap: fetch template + styles, stamp shadow, run lifecycle ── */

  async #bootstrap(): Promise<void> {
    const Ctor = this.constructor as typeof SherpaElement;

    // Styles awaited before any DOM write — no flash of unstyled content.
    const styling = this.#adoptStyles(Ctor);
    const markup = Ctor.html ? loadHtml(Ctor.html.href) : Promise.resolve('');
    const [, html] = await Promise.all([styling, markup]);

    const [body, id] = this.#resolveTemplate(Ctor, html);
    this.#stamp(body, id);
    this.#resolveRendered();

    if (!this.#connected && this.isConnected) {
      this.#connected = true;
      this.onConnect();
    }
  }

  /** Build the adopted-stylesheet list: shared sheets first, then this component's CSS. */
  async #adoptStyles(Ctor: typeof SherpaElement): Promise<void> {
    // TRAP T-shared-sheets-settle-independently
    await Promise.resolve();
    const urls = [...Ctor.sharedStyles.map((u) => u.href)];
    if (Ctor.css) urls.push(Ctor.css.href); // includes the inlined scoped-token region
    // TRAP T-shared-sheets-settle-independently — settle each, keep what loaded.
    const results = await Promise.allSettled(urls.map(loadSheet));
    const sheets = results
      .filter((r): r is PromiseFulfilledResult<CSSStyleSheet> => r.status === 'fulfilled')
      .map((r) => r.value);
    this.root.adoptedStyleSheets = sheets;
  }

  /**
   * Pick the template body: the id from `templateId`, else the first, else raw html.
   *
   * It returns the id ALONGSIDE the body — TRAP
   * T-template-id-read-once-was-permanent.
   */
  #resolveTemplate(Ctor: typeof SherpaElement, html: string): [string, string | null] {
    const key = Ctor.html?.href;
    if (!key) return ['', null];
    let map = templateCache.get(key);
    if (map === undefined) {
      map = parseTemplates(html);
      templateCache.set(key, map);
    }
    if (!map) return [html, null]; // single flat template
    const wanted = this.templateId;
    if (wanted && map.has(wanted)) return [map.get(wanted)!, wanted];
    // The FIRST template's REAL id — TRAP T-template-id-read-once-was-permanent.
    const [id, body] = map.entries().next().value ?? [null, html];
    return [body, id];
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
    // TRAP T-slot-guards-only-when-filled — assignedNodes() WITHOUT flatten, so
    // a slot's own fallback content is never counted as "present".
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
   *
   * TRAP T-populate-settles-after-render-data — await THIS, not `rendered`, to
   * read back what you just populated.
   */
  populate(data: unknown): Promise<void> {
    return this.rendered.then(() => this.renderData(data));
  }

  /**
   * Override to render a data payload. Default is a no-op (attribute-only).
   *
   * MAY RETURN A PROMISE, which `populate()` chains onto — TRAP
   * T-populate-settles-after-render-data.
   */
  protected renderData(_data: unknown): Promise<void> | void {
    /* no-op by default */
  }

  /* ── Attribute coercion ──────────────────────────────────────────── */

  /**
   * Read a NUMBER from an attribute, with a fallback and an optional clamp.
   *
   * TRAP T-number-coercion — the ONE numeric parse; by hand it went wrong four
   * ways. Anything not a finite number is ABSENT; a real 0 survives. Takes
   * either form (`data-max` or `max`).
   */
  protected num(attr: string, fallback: number, opts?: NumOptions): number {
    return coerceNum(this.getAttribute(attr), fallback, opts);
  }

  /**
   * Write an attribute from JS, so CSS can react to a data change.
   *
   * TRAP T-set-removes-on-falsy — `null`/`undefined`/`false` REMOVE it; `true`
   * sets it empty.
   */
  protected set(attr: string, value: string | number | boolean | null | undefined): void {
    if (value == null || value === false) this.removeAttribute(attr);
    else this.setAttribute(attr, value === true ? '' : String(value));
  }

  /* ── Declared-prop sync ──────────────────────────────────────────── */

  /**
   * Write one declared `content` prop into the shadow DOM.
   *
   * TRAP T-empty-write-lets-css-collapse — absent, empty and a missing target
   * all write `''`; CSS owns the collapsing.
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
      // TRAP T-slot-guards-only-when-filled
      if (!el || this.#guarded(el, def)) continue;
      if (def.as === 'icon') this.writeIcon(el, text);
      else el.textContent = text === 'NaN' ? '' : text;
    }
  }

  /**
   * The first element on a composed event's path that matches — the reliable
   * way to ask "what was actually clicked".
   *
   * TRAP T-composed-path-not-target — `target` RETARGETS at a shadow boundary;
   * written out 26 times across 9 components before this existed.
   */
  protected pathFind<T extends Element = HTMLElement>(event: Event, selector: string): T | null {
    for (const node of event.composedPath()) {
      if (node instanceof Element && node.matches(selector)) return node as T;
    }
    return null;
  }

  /** Did the event pass through an element matching `selector`? */
  protected pathHas(event: Event, selector: string): boolean {
    return this.pathFind(event, selector) !== null;
  }

  /**
   * Render an icon value — a Font Awesome class list OR a single raw glyph.
   *
   * ONE policy, because there were three — TRAP T-icon-value-takes-two-forms.
   * TRAP T-write-icon-is-protected-not-private — why it is protected, and why
   * nothing may build an `<i>`.
   */
  protected writeIcon(el: Element, value: string): void {
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
   * TRAP T-slot-guards-only-when-filled — a plain element guards by existing, a
   * `<slot>` only once a consumer has FILLED it.
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
   * TRAP T-clone-returns-null-never-asserts — returns `null` when the template
   * is missing or empty; the `firstElementChild!` assertion three call sites
   * shared is the hazard.
   */
  protected clone<T extends Element = HTMLElement>(sel: string): T | null {
    const tpl = this.$<HTMLTemplateElement>(sel);
    // `content` is missing on a non-<template> element — a selector that matched
    // the wrong node fails here rather than throwing somewhere downstream.
    const first = tpl?.content?.firstElementChild;
    return first ? (first.cloneNode(true) as T) : null;
  }

  /**
   * Stamp a list: clear the container, clone the prototype per item, fill, append.
   *
   * TRAP T-render-list-keeps-fill-in-the-caller — only the plumbing is shared;
   * `clear: 'own-children'` exists for items that sit beside a `<slot>`, and the
   * index is the LOOP position.
   */
  protected renderList<T>(
    containerSel: string,
    tplSel: string,
    items: readonly T[],
    fill: (node: HTMLElement, item: T, index: number) => void,
    opts?: { clear?: 'replace' | 'own-children'; ownSel?: string },
  ): void {
    const container = this.$(containerSel);
    const tpl = this.$<HTMLTemplateElement>(tplSel);
    const proto = tpl?.content?.firstElementChild;
    if (!container || !proto) return;

    if (opts?.clear === 'own-children') {
      for (const node of this.$$(opts.ownSel ?? `${containerSel} > *`)) node.remove();
    } else {
      container.replaceChildren();
    }

    items.forEach((item, i) => {
      const node = proto.cloneNode(true) as HTMLElement;
      fill(node, item, i);
      container.appendChild(node);
    });
  }

  /**
   * Stamp a list DECLARATIVELY: the prototype's own attributes say what each
   * field fills, so there is no `fill` callback.
   *
   * See `ItemTemplate` for the vocabulary; `clear: 'own-children'` behaves as in
   * `renderList`.
   * TRAP T-custom-element-upgrade — writes are ATTRIBUTES, never properties.
   * TRAP T-row-fragment-cloned-whole — the whole fragment is cloned; `after` is
   * the escape hatch.
   */
  protected renderItems<T>(
    containerSel: string,
    tplSel: string,
    items: readonly T[],
    opts?: {
      clear?: 'replace' | 'own-children';
      ownSel?: string;
      after?: (node: HTMLElement, item: T, index: number) => void;
    },
  ): void {
    const container = this.$(containerSel);
    const tpl = this.$<HTMLTemplateElement>(tplSel);
    if (!container || !tpl?.content.firstElementChild) return;

    if (opts?.clear === 'own-children') {
      for (const node of this.$$(opts.ownSel ?? `${containerSel} > *`)) node.remove();
    } else {
      container.replaceChildren();
    }

    // The whole FRAGMENT is cloned, not its firstElementChild: a semantic pair
    // like <dt>+<dd> is two sibling roots, and stamping only the first would
    // silently drop the value half of every item.
    items.forEach((item, index) => {
      const frag = tpl.content.cloneNode(true) as DocumentFragment;
      for (const root of [...frag.children]) {
        this.#fillItem(root as HTMLElement, item, index);
      }
      // `after` gets the first root — the item element for a single-root
      // prototype, which is every case that needs it.
      const first = frag.firstElementChild as HTMLElement | null;
      if (first) opts?.after?.(first, item, index);
      container.appendChild(frag);
    });
  }

  /**
   * Clone ONE item from a prototype and fill it declaratively — `renderItems`
   * for a component that cannot use a single container.
   *
   * TRAP T-clone-item-is-for-two-destinations — the one case, and the boundary.
   */
  protected cloneItem<T extends Element = HTMLElement>(
    tplSel: string,
    item: unknown,
    index = 0,
  ): T | null {
    const node = this.clone<T>(tplSel);
    if (node) this.#fillItem(node as unknown as HTMLElement, item, index);
    return node;
  }

  /** Apply every row-template attribute on a cloned row and its descendants. */
  #fillItem(node: HTMLElement, item: unknown, index: number): void {
    // The row root can carry the attributes too, so it is part of its own sweep.
    for (const el of [node, ...node.querySelectorAll<HTMLElement>('*')]) {
      // Snapshot — the loop removes each directive, and a live NamedNodeMap
      // would skip entries. TRAP T-row-fragment-cloned-whole.
      for (const { name, value } of [...el.attributes]) {
        if (name === ITEM_TEXT) {
          el.textContent = this.#itemText(item, value);
          el.removeAttribute(name);
        } else if (name === ITEM_ICON) {
          this.writeIcon(el, this.#itemText(item, value));
          el.removeAttribute(name);
        } else if (name === ITEM_INDEX) {
          el.removeAttribute(name);
          el.setAttribute(value, String(index));
        } else if (name.startsWith(ITEM_ATTR)) {
          const target = name.slice(ITEM_ATTR.length);
          const resolved = fieldValue(item, value);
          el.removeAttribute(name);
          // An absent field leaves the attribute OFF, never "undefined".
          if (resolved != null) el.setAttribute(target, String(resolved));
        } else if (name.startsWith(ITEM_WHEN)) {
          const target = name.slice(ITEM_WHEN.length);
          el.removeAttribute(name);
          // Truthy field → the BARE attribute (five hand-written sites, declared).
          if (fieldValue(item, value)) el.setAttribute(`data-${target}`, '');
        }
      }
    }
  }

  /** A field's value as item text: absent and null both render as empty. */
  #itemText(item: unknown, expr: string): string {
    const value = fieldValue(item, expr);
    return value == null ? '' : String(value);
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
