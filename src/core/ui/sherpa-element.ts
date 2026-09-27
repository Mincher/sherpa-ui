/**
 * sherpa-element.ts — the one base class every `sherpa-*` component extends.
 * TRAP T-base-class-does-four-things
 *
 * Map:
 * - NumOptions — How `num()` narrows a parsed value.
 * - PropKind — How a declared attribute is REALISED.
 * - PropType — The declared type of an attribute's value.
 * - PropDef — One declared attribute.
 * - PropMap — A component's whole declared attribute surface.
 * - DATA_PROPS — What `DataSource.#push` writes onto every component it binds, plus the guard.
 * - SUMMARY_PROPS — What a chart or tile DECLARES it needs — its provider hands back that shape.
 * - SHARED_PROPS — Shared style attributes whose shape is identical wherever they appear.
 * - coerceNum — Coerce a raw attribute string to a number, or return `fallback`.
 * - markNeedle — Mark the first hit of `needle` in `el`, or write plain text when there is nothing to point at.
 * - markMatch — Rebuild `el` as before + `<mark class="match">` + after, around one hit.
 * - clampNum — Apply the min/max bounds from `opts`, if any.
 * - SherpaElement — the base every component extends: template, props, slots, emit
 */

import { hasIcon, renderIcon, upgradeIcons } from './render-icon.js';
import { ContextRequestEvent, DATA_CONTEXT, type DataAsk } from './context.js';

/** id → innerHTML. `null` when the file is a single flat template. */
type TemplateMap = Map<string, string> | null;

/** How `num()` narrows a parsed value. */
export interface NumOptions {
  min?: number;
  max?: number;
  /** Truncate toward zero, so `"3.7"` reads as 3. */
  int?: boolean;
}

/* "items", not "rows" — only one of the twelve stamping components has rows.
 * TRAP T-the-base-class-names-nothing-visual */

/** Base class for every `sherpa-*` component. */

/**
 * How a declared attribute is REALISED. Matches the generated `.component.yaml`.
 * TRAP T-declared-only-means-css-owns-it — only `content` does any work.
 */
export type PropKind = 'content' | 'style' | 'visibility';

/** The declared type of an attribute's value. Mirrors schemas/component.v1.json. */
export type PropType = 'string' | 'number' | 'boolean' | 'enum';

/** One declared attribute. */
export interface PropDef {
  type: PropType;
  kind: PropKind;
  /** Selector the text is written into. `content` only; without it, no auto-write. */
  to?: string;
  /** Write EVERY match rather than the first. */
  all?: boolean;
  /**
   * Skip the write when this selector matches inside the target.
   * TRAP T-slot-guards-only-when-filled
   */
  skipWhen?: string;
  /** Read this attribute when the first is absent (e.g. data-label → data-heading). */
  fallbackAttr?: string;
  /**
   * How the value is RENDERED. Default is plain text.
   * TRAP T-icon-value-takes-two-forms — `'icon'` or an icon name prints literally.
   */
  as?: 'text' | 'icon';
  /** Allowed values for an `enum`. Spec parity only; not enforced at runtime. */
  values?: readonly string[];
  /** Used when the attribute is absent. Numbers go through coerceNum. */
  default?: string | number | boolean;
}

/** A component's whole declared attribute surface. */
export type PropMap = Readonly<Record<string, PropDef>>;

/* Class-level caches, keyed by resolved URL, shared across instances. */
const htmlCache = new Map<string, Promise<string>>();
const templateCache = new Map<string, TemplateMap>();
const sheetCache = new Map<string, Promise<CSSStyleSheet>>();

/* ── The SHARED vocabulary ────────────────────────────────────────────────
 * Attributes more than one component declares, stated once.
 * TRAP T-the-shared-vocabulary-is-declared-once
 */

/**
 * Which operators leave something to POINT AT in a cell — only the substring
 * family. `eq` would circle the whole value; `ne` matched by NOT being there.
 * TRAP T-a-needle-comes-from-either-direction
 */
const MARKABLE_OPS: ReadonlySet<string> =
  new Set(['contains', 'startswith', 'endswith']);

/* The item-template attributes, in the order they are applied. */
const ITEM_TEXT = 'data-text';
const ITEM_ICON = 'data-icon';
const ITEM_INDEX = 'data-index';
const ITEM_ATTR = 'data-attr-';
const ITEM_WHEN = 'data-when-';

/**
 * What `DataSource.#push` writes onto every component it binds, plus the guard.
 * Declaring one says this component READS it; writing one without a
 * `data-locked` guard is the ownership bug.
 * TRAP T-bind-locks-what-it-owns
 */
export const DATA_PROPS = {
  /** The field sorted on. Empty string SUSPENDS; absent means no sort. */
  'data-sort-field': { type: 'string', kind: 'style' },
  /** asc | desc | '' suspended. TRAP T-a-suspended-sort-is-one-owners-job */
  'data-sort-direction': { type: 'enum', kind: 'style', values: ['asc', 'desc', ''] },
  'data-group-field': { type: 'string', kind: 'style' },
  /** Space-separated field names — which columns a filter touches. */
  'data-filter-fields': { type: 'string', kind: 'style' },
  'data-page': { type: 'number', kind: 'style' },
  'data-total-pages': { type: 'number', kind: 'style' },
  'data-page-size': { type: 'number', kind: 'style' },
  /** The host owns this component's state; report, never write. */
  'data-locked': { type: 'boolean', kind: 'style' },
} as const satisfies PropMap;

/**
 * What a chart or tile DECLARES it needs — its provider reads these and hands
 * back that shape. A child with none uses its host's: a legend its chart's.
 * TRAP T-a-component-declares-its-summary
 */
export const SUMMARY_PROPS = {
  'data-aggregate': { type: 'enum', kind: 'style', values: ['count', 'sum', 'mean', 'min', 'max', 'distinct'] },
  /** The number a sum, mean, min, max or distinct reads. */
  'data-field': { type: 'string', kind: 'style' },
  'data-segment-field': { type: 'string', kind: 'style' },
  /** A series runs over this field. */
  'data-over-field': { type: 'string', kind: 'style' },
  /** A date `data-over-field`, cut to this step. */
  'data-bucket': { type: 'enum', kind: 'style', values: ['day', 'month', 'year'] },
  /** A number segment field cut at these edges, "0,20,40" — a histogram. */
  'data-bands': { type: 'string', kind: 'style' },
  /** Its OWN default filter — readings by field, as JSON — narrowing it alone. */
  'data-readings': { type: 'string', kind: 'style' },
} as const satisfies PropMap;

/**
 * Shared style attributes whose shape is identical wherever they appear.
 * TRAP T-a-host-attribute-is-declared-once
 */
export const SHARED_PROPS = {
  /**
   * `md` is the DEFAULT, drawn by the bare `:host`; sm and lg are overrides.
   * `sherpa-button` ships five (2xs xs sm lg xl) and declares its OWN — do not
   * adopt this one there. TRAP T-a-shared-enum-is-not-every-enum
   */
  'data-size': { type: 'enum', kind: 'style', values: ['sm', 'md', 'lg'] },
  'data-orientation': { type: 'enum', kind: 'style', values: ['horizontal', 'vertical'] },
  /** Where a chart puts its legend. */
  'data-legend': { type: 'enum', kind: 'style', values: ['horizontal', 'vertical'] },
  /**
   * The box a popover must stay inside, passed DOWN from the host. Absent, it
   * falls back to the viewport — wrong inside a scroller.
   */
  'data-bounds': { type: 'string', kind: 'style' },
  /**
   * This item's POSITION in a group, so the row reads as one object. Stated
   * here; `<sherpa-group>` derives it instead, which survives a re-order.
   * CSS-only — the rules live in the grouping sheet.
   * TRAP T-grouping-is-an-attribute-and-a-class
   */
  'data-group': {
    type: 'enum', kind: 'style',
    values: [
      'solo', 'start', 'mid', 'end',
      'vertical-solo', 'vertical-start', 'vertical-mid', 'vertical-end',
      'grid-top-solo', 'grid-top-start', 'grid-top-mid', 'grid-top-end',
      'grid-mid-solo', 'grid-mid-start', 'grid-mid-mid', 'grid-mid-end',
      'grid-bottom-solo', 'grid-bottom-start', 'grid-bottom-mid', 'grid-bottom-end',
    ],
  },
} as const satisfies PropMap;

/** Fetch a stylesheet URL once; every element adopting it shares one sheet object. */
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
    pending = fetch(url).then((r) => {
      // A 404 RESOLVES, so without this the body is the server's error page.
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
      return r.text();
    });
    htmlCache.set(url, pending);
  }
  return pending;
}

/**
 * Parse `<template id="...">` → innerHTML. Null when there are no id'd templates.
 * TRAP T-cloning-prototypes-have-no-id — an item prototype must carry no `id`.
 */
function parseTemplates(html: string): TemplateMap {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const templates = doc.querySelectorAll('template[id]');
  if (templates.length === 0) return null;
  const map = new Map<string, string>();
  for (const t of templates) map.set(t.id, (t as HTMLTemplateElement).innerHTML);
  return map;
}

/**
 * Coerce a raw attribute string to a number, or return `fallback`.
 * TRAP T-coerce-and-clamp-are-shared
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
 * Mark the first hit of `needle` in `el`, or write plain text when there is
 * nothing to point at. ONE decision, so every caller highlights alike.
 *
 * The CELL's casing wins: "ana" against "Ana" leaves "Ana".
 * TRAP T-mark-match-is-one-shape
 */
export function markNeedle(el: Element, text: string, needle: string, op: string): void {
  if (!needle || !MARKABLE_OPS.has(op)) {
    el.textContent = text;
    return;
  }
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) {
    el.textContent = text;
    return;
  }
  markMatch(el, text, at, needle.length);
}

/**
 * Rebuild `el` as before + `<mark class="match">` + after, around one hit.
 * TRAP T-mark-match-is-one-shape
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
 * TRAP T-coerce-and-clamp-are-shared
 */
export function clampNum(value: number, opts?: NumOptions): number {
  let out = value;
  if (opts?.min !== undefined) out = Math.max(opts.min, out);
  if (opts?.max !== undefined) out = Math.min(opts.max, out);
  return out;
}

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

/** The classes whose `config` names are already properties. */
const CONFIGURED = new WeakSet<typeof SherpaElement>();

export abstract class SherpaElement extends HTMLElement {

  /** URL of this component's CSS, scoped-token block inlined at its top. */
  static css?: URL;

  /** URL of this component's HTML template. Subclasses override. */
  static html?: URL;

  /** Attribute names to observe. Subclasses override (merge with super if extending). */
  static observed: string[] = [];

  /** Shared stylesheet URLs adopted into every shadow root (set once at app init). */
  static sharedStyles: URL[] = [];

  /**
   * Declared attributes — the public surface as data. Every key is observed.
   * TRAP T-declared-only-means-css-owns-it — `style`/`visibility` do no work.
   */
  static props: PropMap = {};

  /**
   * The attributes `templateId` reads — changing one RE-STAMPS the tree.
   * TRAP T-variant-attrs-or-one-way-door — a multi-template component MUST list them.
   */
  static variantAttrs: readonly string[] = [];

  /**
   * The inner control the host's `aria-label` NAMES. A host has no role, so a
   * label on it names nothing; declaring this copies it inward.
   * TRAP T-a-host-label-must-reach-its-control
   */
  static labelTarget?: string;

  /**
   * What this component ASKS its provider for — the shape of its data. Asked
   * on connect and answered by the nearest `sherpa-provider`; with none above
   * it, it waits to be populated by hand. TRAP T-a-component-asks-its-provider
   */
  static asks?: DataAsk;

  /**
   * CONFIGURATION a page sets once, as properties — a grid's columns, its key
   * — each by name, with its default. Every setting made in one moment redraws
   * ONCE, and data without them (a provider's rows) keeps them.
   * TRAP T-configuration-is-not-data
   */
  static config?: Readonly<Record<string, unknown>>;

  /** Put each `config` name on the class as a property, once per class. */
  static #defineConfig(Ctor: typeof SherpaElement): void {
    if (!Ctor.config || CONFIGURED.has(Ctor)) return;
    CONFIGURED.add(Ctor);
    for (const name of Object.keys(Ctor.config)) {
      Object.defineProperty(Ctor.prototype, name, {
        configurable: true,
        get(this: SherpaElement): unknown { return this.#settings[name]; },
        set(this: SherpaElement, value: unknown) {
          this.#settings[name] = value;
          this.#reconfigure();
        },
      });
    }
  }

  /** Declared props + `variantAttrs` + `observed`, deduped. */
  static get observedAttributes(): string[] {
    const defs = Object.values(this.props);
    return [
      ...new Set([
        ...Object.keys(this.props),
        // A fallback source is observed too, or the change would not re-sync.
        ...defs.map((d) => d.fallbackAttr).filter((a): a is string => a !== undefined),
        ...this.variantAttrs,
        ...this.observed,
        ...(this.labelTarget ? ['aria-label'] : []),
      ]),
    ];
  }

  /** Open shadow root — queried via $ / $$, never touched directly. */
  protected readonly root: ShadowRoot;

  /** Resolves once the first render (template + styles + onRender) has completed. */
  readonly rendered: Promise<void>;

  #resolveRendered!: () => void;

  /** Has `onRender` run — it fires exactly once. */
  #hasRendered = false;

  /** Is the element in a document right now. */
  #connected = false;

  /**
   * The template id currently STAMPED, so a change can tell it wants another tree.
   * TRAP T-template-id-read-once-was-permanent
   */
  #stampedTemplate: string | null = null;

  /**
   * Aborted on disconnect, REPLACED on every connect.
   * TRAP T-abort-controller-per-connect — never cache the signal in a field.
   */
  #ac = new AbortController();

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.rendered = new Promise((res) => (this.#resolveRendered = res));
    const Ctor = new.target as typeof SherpaElement;
    SherpaElement.#defineConfig(Ctor);
    this.#settings = { ...Ctor.config };
  }

  /** What the page configured, by `config` name. */
  #settings: Record<string, unknown> = {};
  /** The last DATA populated — what a new setting redraws beside. */
  #data: Record<string, unknown> = {};
  /** A redraw for new settings is queued. */
  #reconfiguring = false;

  /** Redraw ONCE for every setting made in one moment — three setters in a
   *  row would each draw the config the one before had not drawn yet. */
  #reconfigure(): void {
    if (this.#reconfiguring) return;
    this.#reconfiguring = true;
    queueMicrotask(() => {
      this.#reconfiguring = false;
      void this.populate(this.#data);
    });
  }

  /** Data over the configuration: a `config` name it carries is SET, and the
   *  rest arrives beside what the page configured. */
  #withSettings(data: unknown): unknown {
    const config = (this.constructor as typeof SherpaElement).config;
    if (!config || !data || typeof data !== 'object' || Array.isArray(data)) return data;
    const rest: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(data)) {
      if (name in config) this.#settings[name] = value;
      else rest[name] = value;
    }
    this.#data = rest;
    return { ...this.#settings, ...rest };
  }

  /* ── Native lifecycle — the platform calls these ─────────────────────── */

  connectedCallback(): void {
    // BEFORE anything reads state.
    // TRAP T-a-property-set-before-upgrade-shadows-its-accessor
    this.#upgradeProperties();
    // A re-connect needs a live signal; the last one was aborted on the way out.
    if (this.#ac.signal.aborted) this.#ac = new AbortController();
    if (!this.#hasRendered) {
      void this.#bootstrap();
    } else if (!this.#connected) {
      this.#connected = true;
      this.onConnect();
      this.#ask();
    }
  }

  disconnectedCallback(): void {
    this.#connected = false;
    // BEFORE onDisconnect, so a component's teardown finds the listeners gone.
    this.#ac.abort();
    // Out of the tree, out of its provider's reach: stop being told.
    this.#leave?.();
    this.#leave = undefined;
    this.onDisconnect();
  }

  /** How to stop hearing from the provider that answered, once one has. */
  #leave: (() => void) | undefined;

  /** A new declaration is a new question: leave, and ask again. */
  #reask(): void {
    const leave = this.#leave;
    this.#leave = undefined;
    leave?.();
    if (this.isConnected) this.#ask();
  }

  /** ASK the nearest provider for this component's data, if it declares a need.
   *  Its answer arrives through `populate()`, now and on every change. */
  #ask(): void {
    const asks = (this.constructor as typeof SherpaElement).asks;
    if (!asks || this.#leave) return;
    this.dispatchEvent(new ContextRequestEvent(DATA_CONTEXT, this, (data, unsubscribe) => {
      if (unsubscribe) this.#leave = unsubscribe;
      if (data !== undefined) void this.populate(data);
    }, true));
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    // Before the first render onRender reads the attribute state itself.
    if (oldVal === newVal || !this.#hasRendered) return;
    // A declared prop re-syncs itself; onChange still fires afterwards.
    const Ctor = this.constructor as typeof SherpaElement;
    for (const [prop, def] of Object.entries(Ctor.props)) {
      // The prop itself, and any prop that FALLS BACK to it.
      if (prop === name || def.fallbackAttr === name) this.#syncProp(prop, def);
    }
    if (name === 'aria-label') this.#syncLabel();
    if (Ctor.asks && (name in SUMMARY_PROPS || name === 'data-source' || name === 'data-scope')) this.#reask();
    this.onChange(name, oldVal, newVal);
    // TRAP T-restamp-runs-after-on-change
    this.#restampIfVariantChanged();
  }

  /* ── Shadow queries ──────────────────────────────────────────────────── */

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
   * TRAP T-clone-returns-null-never-asserts — `null` when missing or empty.
   */
  protected clone<T extends Element = HTMLElement>(sel: string): T | null {
    const tpl = this.$<HTMLTemplateElement>(sel);
    // `content` is absent on a non-<template>, so a wrong selector fails here.
    const first = tpl?.content?.firstElementChild;
    if (!first) return null;
    /* IMPORTED into the page's document, not cloned in the template's inert
       one: every component in the copy upgrades NOW, so a host may call its
       methods before it is appended. TRAP T-custom-element-upgrade */
    const node = document.importNode(first, true) as unknown as T;
    this.upgradeClonedIcons(node);
    return node;
  }

  /**
   * Draw any `data-icon` in a freshly cloned subtree.
   *
   * `upgradeIcons` runs ONCE on the stamped root, so an icon that lives inside a
   * cloning prototype is still a bare `<i>` when the clone is appended — 39 of
   * them in sherpa-data-grid, every one blank.
   * Idempotent: a node that already holds its SVG is skipped.
   * TRAP T-a-cloned-prototype-needs-its-icons-upgraded
   */
  protected upgradeClonedIcons(node: ParentNode): void {
    upgradeIcons(node);
  }

  /* ── Attributes in, attributes out ───────────────────────────────────── */

  /**
   * Write an attribute from JS, so CSS can react to a data change.
   * TRAP T-set-removes-on-falsy — `null`/`undefined`/`false` REMOVE it.
   */
  protected set(attr: string, value: string | number | boolean | null | undefined): void {
    if (value == null || value === false) this.removeAttribute(attr);
    else this.setAttribute(attr, value === true ? '' : String(value));
  }

  /**
   * Read a NUMBER from an attribute, with a fallback and an optional clamp.
   * TRAP T-number-coercion — the ONE numeric parse; a real 0 survives.
   */
  protected num(attr: string, fallback: number, opts?: NumOptions): number {
    return coerceNum(this.getAttribute(attr), fallback, opts);
  }

  /**
   * A signal that aborts when this element leaves the DOM. Read it where you use it.
   * TRAP T-abort-controller-per-connect
   */
  protected get signal(): AbortSignal {
    return this.#ac.signal;
  }

  /* ── Events ──────────────────────────────────────────────────────────── */

  /** Dispatch a bubbling, composed CustomEvent. */
  protected emit<T = unknown>(name: string, detail?: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  /**
   * Listen on a target this element does not own, for as long as it is in the
   * DOM — `signal` aborts on disconnect, so nothing needs removing. Pass
   * `while` for a shorter lifetime: a popover's listeners live while it is
   * OPEN, not while the element exists.
   */
  protected on<K extends keyof WindowEventMap>(
    target: EventTarget,
    type: K | string,
    handler: EventListenerOrEventListenerObject,
    options: AddEventListenerOptions & { while?: AbortSignal } = {},
  ): void {
    const { while: shorter, ...rest } = options;
    const signal = shorter
      ? AbortSignal.any([this.signal, shorter])
      : this.signal;
    target.addEventListener(type as string, handler, { ...rest, signal });
  }

  /**
   * The same, THROTTLED to one call per frame — a listener that reads layout
   * otherwise runs per EVENT.
   * TRAP T-a-layout-read-belongs-in-a-frame
   */
  protected onFrame(
    target: EventTarget,
    type: string,
    handler: () => void,
    options: AddEventListenerOptions & { while?: AbortSignal } = {},
  ): void {
    let pending = 0;
    this.on(target, type, () => {
      if (pending) return;
      pending = requestAnimationFrame(() => { pending = 0; handler(); });
    }, options);
  }

  /**
   * The first element on a composed event's path that matches.
   * TRAP T-composed-path-not-target — `target` RETARGETS at a shadow boundary.
   * This is also why a host cannot just call `closest()` from the target:
   * TRAP T-closest-stops-at-the-shadow-boundary
   */
  protected pathFind<T extends Element = HTMLElement>(event: Event, selector: string): T | null {
    for (const node of event.composedPath()) {
      if (node instanceof Element && node.matches(selector)) return node as T;
    }
    return null;
  }

  /* ── Data in: populate() → renderData() ──────────────────────────────── */

  /**
   * The single entry point for data. Defers to after the first render.
   * TRAP T-populate-settles-after-render-data — await THIS, not `rendered`.
   */
  populate(data: unknown): Promise<void> {
    return this.rendered.then(() => this.renderData(this.#withSettings(data)));
  }

  /** Did the event pass through an element matching `selector`? */
  /**
   * Render an icon value — an icon NAME becomes a Figma SVG, any other value
   * is a raw character and stays text.
   * TRAP T-icon-value-takes-two-forms
   * TRAP T-write-icon-is-protected-not-private
   */
  protected writeIcon(el: Element, value: string): void {
    el.replaceChildren();
    if (hasIcon(value)) {
      el.classList.add('sherpa-icon-box');
      renderIcon(el, value);
    } else {
      el.textContent = value === 'NaN' ? '' : value;
    }
  }

  /**
   * Copy native attributes from this host onto the control it wraps.
   * `value` is SKIPPED — setting it after the reader has typed puts the old
   * text back, so each caller assigns `control.value` itself.
   * TRAP T-mirroring-skips-value
   */
  protected mirrorAttrs(control: Element, attrs: readonly string[]): void {
    for (const attr of attrs) {
      if (attr === 'value') continue;
      if (this.hasAttribute(attr)) control.setAttribute(attr, this.getAttribute(attr) ?? '');
      else control.removeAttribute(attr);
    }
  }

  /**
   * Stamp a list: clear the container, clone the prototype per item, fill, append.
   * `clear: 'own-children'` is for items that sit beside a `<slot>`.
   * TRAP T-render-list-keeps-fill-in-the-caller
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
   * Stamp a list DECLARATIVELY — the prototype's attributes say what fills what,
   * so there is no `fill` callback. An ITEM is whatever the component repeats:
   * a bar, a tab, a crumb, a swatch, a row.
   * TRAP T-item-template-cannot-compute
   * TRAP T-custom-element-upgrade — writes are ATTRIBUTES, never properties.
   * TRAP T-row-fragment-cloned-whole — `after` is the escape hatch.
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

    // The whole FRAGMENT: a <dt>+<dd> pair is two roots, and the first alone
    // drops half of every item.
    items.forEach((item, index) => {
      const frag = tpl.content.cloneNode(true) as DocumentFragment;
      for (const root of [...frag.children]) {
        this.#fillItem(root as HTMLElement, item, index);
      }
      // `after` gets the first root — every case that needs it is single-root.
      const first = frag.firstElementChild as HTMLElement | null;
      if (first) opts?.after?.(first, item, index);
      container.appendChild(frag);
    });
  }

  /**
   * `renderItems` for one item, when a component has no single container.
   * TRAP T-clone-item-is-for-two-destinations
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

  /* ── Private — boot and stamp ────────────────────────────────────────── */

  /** Adopt the styles, stamp the template, then run the first render. */
  async #bootstrap(): Promise<void> {
    const Ctor = this.constructor as typeof SherpaElement;

    // Styles awaited before any DOM write — no flash of unstyled content.
    const styling = this.#adoptStyles(Ctor);
    const markup = Ctor.html ? loadHtml(Ctor.html.href) : Promise.resolve('');

    /* THE MARKUP LEG MUST NOT LEAVE `rendered` PENDING. A dropped connection
       rejects the fetch, and an unguarded await here skipped
       #resolveRendered() — so all 557 `await el.rendered` sites hung with no
       error and no timeout. Stamp empty and carry on: the element is visibly
       blank, which is a fault a person can see.
       TRAP T-rendered-settles-even-when-the-markup-does-not */
    let html = '';
    try {
      [, html] = await Promise.all([styling, markup]);
    } catch (error) {
      console.error(`[${this.localName}] template failed to load`, error);
    }

    const [body, id] = this.#resolveTemplate(Ctor, html);
    this.#stamp(body, id);
    this.#resolveRendered();

    if (!this.#connected && this.isConnected) {
      this.#connected = true;
      this.onConnect();
      this.#ask();
    }
  }

  /** Adopted sheets: shared first, then this component's CSS. */
  async #adoptStyles(Ctor: typeof SherpaElement): Promise<void> {
    // TRAP T-shared-sheets-settle-independently
    await Promise.resolve();
    const urls = [...Ctor.sharedStyles.map((u) => u.href)];
    if (Ctor.css) urls.push(Ctor.css.href);
    // TRAP T-shared-sheets-settle-independently — settle each, keep what loaded.
    const results = await Promise.allSettled(urls.map(loadSheet));
    const sheets = results
      .filter((r): r is PromiseFulfilledResult<CSSStyleSheet> => r.status === 'fulfilled')
      .map((r) => r.value);
    this.root.adoptedStyleSheets = sheets;
  }

  /**
   * Pick the template body: the id from `templateId`, else the first, else raw html.
   * Returns the id alongside the body. TRAP T-template-id-read-once-was-permanent
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
    // The FIRST template's REAL id — TRAP T-template-id-read-once-was-permanent
    const [id, body] = map.entries().next().value ?? [null, html];
    return [body, id];
  }

  /**
   * Write a template body into the shadow root and run that tree's setup. Shared
   * by the first render and by a variant re-stamp.
   * TRAP T-restamp-does-not-abort
   */
  #stamp(body: string, id: string | null): void {
    this.root.innerHTML = body;
    this.#stampedTemplate = id;
    this.#hasRendered = true;
    // Props and icons BEFORE onRender, so a component's setup reads a
    // populated tree. A template `data-icon` draws nothing until upgraded.
    this.#syncAllProps();
    this.#syncLabel();
    upgradeIcons(this.root);
    this.onRender();
    this.#wireSlots();
  }

  /** Did `#syncLabel` write the inner label — so only it ever removes one. */
  #labelled = false;

  /** Copy the host's `aria-label` onto `labelTarget`. */
  #syncLabel(): void {
    const target = (this.constructor as typeof SherpaElement).labelTarget;
    if (!target) return;
    const label = this.getAttribute('aria-label');
    if (!label && !this.#labelled) return;
    for (const el of this.$$(target)) {
      if (label) el.setAttribute('aria-label', label);
      else el.removeAttribute('aria-label');
    }
    this.#labelled = !!label;
  }

  /**
   * Re-stamp when the wanted template is no longer the stamped one.
   * TRAP T-restamp-runs-after-on-change
   */
  #restampIfVariantChanged(): void {
    const Ctor = this.constructor as typeof SherpaElement;
    const wanted = this.templateId;
    // A component with one template never opts in; only a CHANGE re-stamps.
    if (wanted === null || wanted === this.#stampedTemplate) return;

    // Cached per URL at first render — a re-stamp costs no fetch.
    const map = templateCache.get(Ctor.html?.href ?? '');
    if (!map?.has(wanted)) return;

    this.#stamp(map.get(wanted)!, wanted);
  }

  /**
   * Re-route any property set BEFORE upgrade through its accessor.
   * TRAP T-a-property-set-before-upgrade-shadows-its-accessor
   */
  #upgradeProperties(): void {
    const self = this as unknown as Record<string, unknown>;
    // OWN keys only: the prototype accessors are what we are restoring access to.
    for (const key of Object.keys(self)) {
      // Skips `root` / `rendered` — constructor fields, not accessors.
      if (!this.#isAccessor(key)) continue;
      const value = self[key];
      // `Reflect.deleteProperty`: the lint rule against `delete` is right everywhere else.
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

  /* ── Private — slots ─────────────────────────────────────────────────── */

  /** Listen to every slot, so `data-has-*` follows what is slotted. */
  #wireSlots(): void {
    for (const slot of this.root.querySelectorAll('slot')) {
      const update = (): void => this.#reflectSlot(slot);
      /* CARRY THE SIGNAL. A variant re-stamp replaces every slot node, so each
         stamp wired a FRESH closure to a FRESH element — nothing for
         addEventListener's repeat-discard to dedupe, unlike the host listeners
         T-restamp-does-not-abort reasons about. */
      slot.addEventListener('slotchange', update, { signal: this.signal });
      update();
    }
  }

  /** Set `data-has-<slot>` when a slot holds real content. */
  #reflectSlot(slot: HTMLSlotElement): void {
    // TRAP T-slot-guards-only-when-filled — no flatten, so a slot's own
    // fallback never counts as "present".
    const has = slot.assignedNodes().some((n) => {
      if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').trim().length > 0;
      return (n as Element).tagName !== 'TEMPLATE';
    });
    /* `-slot`, not `data-has-content`: the attribute says THE DEFAULT SLOT IS
       FILLED, which is not the same as the element having content. On a layout
       element it is inert either way. */
    const attr = slot.name ? `data-has-${slot.name}` : 'data-has-content-slot';
    this.toggleAttribute(attr, has);
  }

  /* ── Private — declared-prop sync ────────────────────────────────────── */

  /**
   * Write one declared `content` prop into the shadow DOM.
   * TRAP T-empty-write-lets-css-collapse — CSS owns the collapsing.
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

  /** Write every declared `content` prop. Runs once after the first render. */
  #syncAllProps(): void {
    const Ctor = this.constructor as typeof SherpaElement;
    for (const [name, def] of Object.entries(Ctor.props)) this.#syncProp(name, def);
  }

  /**
   * Is this target guarded against a write?
   * TRAP T-slot-guards-only-when-filled — a `<slot>` guards only once FILLED.
   */
  #guarded(el: Element, def: PropDef): boolean {
    if (!def.skipWhen) return false;
    const found = el.querySelector(def.skipWhen);
    if (!found) return false;
    if (found instanceof HTMLSlotElement) return found.assignedNodes().length > 0;
    return true;
  }

  /**
   * The DEFAULT data path: write a payload's keys onto the attributes this
   * component DECLARES. A key is written only when it names a declared prop,
   * so a payload meant for a grid cannot spray attributes onto a button.
   * TRAP T-any-component-can-be-bound
   */
  #renderDeclared(data: unknown): void {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) return;
    const Ctor = this.constructor as typeof SherpaElement;

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      /* `label` → `data-label`, `iconStart` → `data-icon-start`. A key already
         spelled `data-*` is taken as written. */
      const attr = key.startsWith('data-')
        ? key
        : `data-${key.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`)}`;
      if (!(attr in Ctor.props)) continue;
      this.set(attr, value as string | number | boolean | null | undefined);
    }
  }

  /* ── Private — item stamping ─────────────────────────────────────────── */

  /** Apply every item-template attribute on a cloned item and its descendants. */
  #fillItem(node: HTMLElement, item: unknown, index: number): void {
    // The root can carry the attributes too, so it is part of its own sweep.
    for (const el of [node, ...node.querySelectorAll<HTMLElement>('*')]) {
      // Snapshot — the loop removes each directive and a live map would skip
      // entries. TRAP T-row-fragment-cloned-whole
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
          // Truthy field → the BARE attribute.
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

  /* ── Hooks — subclasses override these ───────────────────────────────── */

  /** Which template id to stamp. Null means the first; multi-template subclasses override. */
  protected get templateId(): string | null {
    return null;
  }

  /**
   * Override to render a data payload. May return a promise, which `populate()` chains.
   * TRAP T-populate-settles-after-render-data
   */
  protected renderData(data: unknown): Promise<void> | void {
    this.#renderDeclared(data);
  }

  /** Shadow DOM is ready. Cache refs, set defaults, wire host listeners. */
  protected onRender(): void {}

  /** Fires once after the first render, when the element is connected. */
  protected onConnect(): void {}

  /** Element removed from the DOM. Tear down timers / observers. */
  protected onDisconnect(): void {}

  /** An observed attribute changed (after the first render). */
  protected onChange(_name: string, _oldVal: string | null, _newVal: string | null): void {}

}

