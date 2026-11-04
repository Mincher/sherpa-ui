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
 * - STACK_PROPS — A chart's Secondary, for one that splits by two axes: a bar chart and a radial.
 * - FRAME_PROPS — A chart in the shared frame: bar, line, gauge and radial.
 * - SHARED_PROPS — Shared style attributes whose shape is identical wherever they appear.
 * - coerceNum — Coerce a raw attribute string to a number, or return `fallback`.
 * - clampNum — Apply the min/max bounds from `opts`, if any.
 * - define — Register a tag once: nothing on a server, a report when another class holds it.
 * - defined — Every class `define()` registered, by tag: what a registry over a static reads.
 * - SherpaElement — the base every component extends: template, props, slots, emit
 */

import { hasIcon, iconsLoading, renderIcon, upgradeIcons } from './render-icon.js';
import { ContextRequestEvent, DATA_CONTEXT, SETTINGS_CONTEXT, type DataAsk } from './context.js';
import type { Presents } from './show-as.js';
import type { Settings } from '../data/settings.js';
import { liftTipsIn } from './top-layer-tips.js';
import {
  adoptPageSheet, cachedTemplates, checkOwnTemplate, familyBody, filesFor, loadFamily, loadSheets, loadTemplates, onReload,
  reloadFiles, stampable, templateBody,
} from './templater.js';
import { report } from '../data/report.js';
import { FormValue } from './form-value.js';
import { applyDirectives, fillItem, readDirectives, type Directive } from './directives.js';

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
 * How a declared attribute is REALISED. Matches the generated `.component.json`.
 * `content`: its template's directive, or the component's JS, writes it into the
 * shadow DOM. `behaviour`: only the component's own JS reads it. `template`: it
 * picks the template, so it is also in `variantAttrs`.
 * TRAP T-declared-only-means-css-owns-it
 */
export type PropKind = 'content' | 'style' | 'visibility' | 'behaviour' | 'template';

/** The declared type of an attribute's value. Mirrors schemas/component.v1.json. */
export type PropType = 'string' | 'number' | 'boolean' | 'enum';

/** One declared attribute. */
export interface PropDef {
  type: PropType;
  kind: PropKind;
  /** A boolean's JS property, by this name: it reads and toggles the attribute.
   *  TRAP T-a-flag-brings-the-base-methods */
  accessor?: string;
  /** Allowed values for an `enum`. Spec parity only; not enforced at runtime. */
  values?: readonly string[];
}

/** A component's whole declared attribute surface. */
export type PropMap = Readonly<Record<string, PropDef>>;

/* ── The SHARED vocabulary ────────────────────────────────────────────────
 * Attributes more than one component declares, stated once.
 * TRAP T-the-shared-vocabulary-is-declared-once
 */

/** Words a component's markup lacks, said once each. */
const MISSING_WORDS = new Set<string>();

/** Each optional part, by the prototype that stamped it: a re-stamped tree's prototype starts again. */
const STAMPED = new WeakMap<HTMLTemplateElement, Element>();

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
  /** `input`: its source applies LIVE, so a value reports while it moves. TODO 107 */
  'data-apply-on': { type: 'enum', kind: 'behaviour', values: ['change', 'input'] },
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
  /** A date `data-over-field`, cut to this step; `auto` takes the one its View scope's date range fits. TODO 540 */
  'data-bucket': { type: 'enum', kind: 'style', values: ['auto', 'hour2', 'day', 'week', 'month', 'quarter', 'year'] },
  /** A number segment field cut at these edges, "0,20,40" — a histogram. */
  'data-bands': { type: 'string', kind: 'style' },
  /** Its OWN default filter — a condition by field, as JSON — narrowing it alone. */
  'data-where': { type: 'string', kind: 'style' },
} as const satisfies PropMap;

/** A chart's Secondary, for one that splits by two axes: a bar chart and a radial. */
export const STACK_PROPS = {
  /** Each segment's rows again, by this field: the Secondary. */
  'data-stack-field': { type: 'string', kind: 'style' },
  /** The axis shown as COUNTS: each value of the other is the number of its distinct
   *  values there. Absent, both show as names. Will, TODO 653 */
  'data-count-axis': { type: 'enum', kind: 'style', values: ['primary', 'secondary'] },
} as const satisfies PropMap;

/** What a component that asks re-asks by when it changes. */
const ASKED = new Set<string>([...Object.keys(SUMMARY_PROPS), ...Object.keys(STACK_PROPS), 'data-source', 'data-scope']);

/** A chart in the shared frame: bar, line, gauge and radial. */
export const FRAME_PROPS = {
  /** Its legend is drawn elsewhere — its card's filter toolbar: no room kept for it. Will, TODO 670 */
  'data-no-legend': { type: 'boolean', kind: 'visibility' },
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
  /**
   * The box a popover must stay inside, passed DOWN from the host. Absent, it
   * falls back to the viewport — wrong inside a scroller.
   */
  'data-bounds': { type: 'string', kind: 'style' },
  /** An inner shadow on each edge its scroll box is scrolled past. Off by default. TODO 401 */
  'data-scroll-shadow': { type: 'boolean', kind: 'style' },
  /** A node's sockets, on its header or a row: a value is a circle, an object a diamond, a boolean a triangle, any (an input only) a square. TODO 713 */
  'data-input-socket': { type: 'enum', kind: 'style', values: ['value', 'object', 'boolean', 'any'] },
  'data-output-socket': { type: 'enum', kind: 'style', values: ['value', 'object', 'boolean'] },
  /** A route joins the socket: it is drawn filled, else hollow. The host writes them. */
  'data-input-routed': { type: 'boolean', kind: 'style' },
  'data-output-routed': { type: 'boolean', kind: 'style' },
} as const satisfies PropMap;

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
 * Apply the min/max bounds from `opts`, if any.
 * TRAP T-coerce-and-clamp-are-shared
 */
export function clampNum(value: number, opts?: NumOptions): number {
  let out = value;
  if (opts?.min !== undefined) out = Math.max(opts.min, out);
  if (opts?.max !== undefined) out = Math.min(opts.max, out);
  return out;
}

/** A server has no DOM: the class still loads there, and defines nothing.
 *  TRAP T-a-component-imports-anywhere */
const Base = (globalThis.HTMLElement ?? Object) as typeof HTMLElement;

/** Each class `define()` registered, by tag — on a server too. */
const DEFINED = new Map<string, CustomElementConstructor>();

/**
 * Register a tag ONCE. Nothing on a server; nothing when this class holds it
 * already; and another class under the same tag — two copies of the library on
 * one page — is said, not thrown. TRAP T-a-component-imports-anywhere
 */
export function define(tag: string, cls: CustomElementConstructor): void {
  // A declared boolean's property: the attribute, read and toggled. Its own, if the class wrote one.
  for (const [attr, def] of Object.entries((cls as unknown as typeof SherpaElement).props ?? {})) {
    const name = def.accessor;
    if (!name || Object.getOwnPropertyDescriptor(cls.prototype, name)) continue;
    Object.defineProperty(cls.prototype, name, {
      get(this: HTMLElement): boolean { return this.hasAttribute(attr); },
      set(this: HTMLElement, on: boolean) { this.toggleAttribute(attr, !!on); },
      configurable: true,
    });
  }
  // A form control's own doors, as a native control has them: on its class alone. TRAP T-a-flag-brings-the-base-methods
  if ((cls as { formAssociated?: boolean }).formAssociated) {
    for (const name of ['checkValidity', 'reportValidity'] as const) {
      if (Object.getOwnPropertyDescriptor(cls.prototype, name)) continue;
      Object.defineProperty(cls.prototype, name, {
        value(this: { syncFormValue(): void; formLink: FormValue }): boolean {
          this.syncFormValue();
          return this.formLink[name]();
        },
        configurable: true,
        writable: true,
      });
    }
  }
  const registry = globalThis.customElements as CustomElementRegistry | undefined;
  const held = registry?.get(tag);
  if (!held) {
    registry?.define(tag, cls);
    DEFINED.set(tag, cls);
  } else if (held !== cls) {
    report({ code: 'tag-taken', message: `<${tag}> is defined by another class already — two copies of sherpa-ui on one page? This one is not used.`, at: { tag } });
  }
}

/** Every class `define()` registered, by tag: what a registry over a static reads. */
export function defined(): ReadonlyMap<string, CustomElementConstructor> {
  return DEFINED;
}

export abstract class SherpaElement extends Base {

  /** URL of this component's CSS, scoped-token block inlined at its top — or a
   *  LIST: a family's shared sheet first, its own last, so its own wins. */
  static css?: URL | readonly URL[];

  /** URL of this component's HTML template — or a LIST: a family's markup
   *  first, its own last; each family file's body is stamped after its own.
   *  TRAP T-a-family-shares-markup */
  static html?: URL | readonly URL[];

  /** A sheet for what it puts in the PAGE's light DOM: adopted into the document,
   *  and awaited with its own sheets before its first stamp.
   *  TRAP T-a-page-sheet-is-for-what-a-component-puts-in-the-page */
  static pageCss?: URL;

  /** What this component's own JS reacts to, beyond what the base class observes. TRAP T-observe-what-does-work */
  static observed: string[] = [];

  /**
   * What every shadow root adopts, in cascade order — HERE, so a component
   * imported on its own draws right too. One entry per file: `@import` is
   * dropped from an adopted sheet without an error. Typography and the style
   * modes are GENERATED. TRAP T-import-dies-in-an-adopted-sheet
   * TRAP T-a-document-class-cannot-reach-a-shadow-root · TRAP T-tokens-css-never-reaches-shadow
   */
  static sharedStyles: URL[] = [
    new URL('../sherpa-base.css', import.meta.url),
    new URL('../sherpa-typography.css', import.meta.url),
    new URL('../sherpa-grouping.css', import.meta.url),
    new URL('../sherpa-icon.css', import.meta.url),
    new URL('../sherpa-button-look.css', import.meta.url),
    new URL('../sherpa-group-positions.css', import.meta.url),
    new URL('../sherpa-style-modes.css', import.meta.url),
    new URL('../sherpa-anchor.css', import.meta.url),
    new URL('../sherpa-motion.css', import.meta.url),
  ];

  /** Every element on the page now, so a reload can draw them again. */
  static #live = new Set<SherpaElement>();

  /* A RELOAD redraws each element drawn from what changed: its markup again,
     or a sheet it did not have. A sheet it has changed in place already. */
  static {
    onReload((changed) => {
      for (const el of SherpaElement.#live) {
        const files = el.#files();
        if ((files.html && changed.has(files.html)) || [...files.family, ...files.css].some((c) => changed.has(c))) void el.#redraw();
      }
    });
  }

  /**
   * Fetch a component's markup and sheets again — or every one's on the page,
   * the shared sheets too — and draw each element again. What a development
   * server calls when a file changes. Will, TODO 68. TRAP T-a-templater-owns-the-files
   */
  static async reload(tag?: string): Promise<void> {
    const html = new Set<string>();
    const css = new Set<string>(tag ? [] : SherpaElement.sharedStyles.map((u) => u.href));
    for (const el of SherpaElement.#live) {
      if (tag && el.localName !== tag) continue;
      const files = el.#files();
      if (files.html) html.add(files.html);
      for (const f of files.family) html.add(f);
      for (const c of files.css) css.add(c);
      const page = (el.constructor as typeof SherpaElement).pageCss;
      if (page) css.add(page.href);
    }
    await reloadFiles({ html: [...html], css: [...css] });
  }

  /**
   * Declared attributes — the public surface as data. The base class observes
   * what it does work for; a component lists the rest it reacts to in `observed`.
   * TRAP T-observe-what-does-work
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

  /** The COMMANDS this element answers — `--name` → the method it calls — as a
   *  button's `commandfor` / `command` name them: markup opens it, no script.
   *  TRAP T-a-button-commands-by-markup */
  static commands: Readonly<Record<string, string>> = {};

  /** The platform's flag, as it is: a click or `focus()` on the host goes to the
   *  first focusable part inside. A control whose one control is inside sets it
   *  and writes no `focus()`. TRAP T-focus-is-delegated-by-the-platform */
  static delegatesFocus = false;

  /** Its DEFAULT role and ARIA, through `ElementInternals`: an author's own
   *  attribute wins, so a host never overrides one. TRAP T-aria-defaults-live-in-internals */
  static aria: Partial<ARIAMixin> = {};

  /**
   * What this component ASKS its provider for — the shape of its data. Asked
   * on connect and answered by the nearest `sherpa-provider`; with none above
   * it, it waits to be populated by hand. TRAP T-a-component-asks-its-provider
   */
  static asks?: DataAsk;

  /** The kind of Show as it draws a slot's data as — or kinds, one per `is`.
   *  `define()` registers it; `show-as.ts` reads it. Will, TODO 548 */
  static presents?: Presents | readonly Presents[];

  /**
   * The app's SETTINGS it reads, each onto one of its own attributes — by key,
   * or `!key` for an attribute that is on while the setting is off. Asked on
   * connect and told again on every change; a setting with no value (`null`)
   * leaves its attribute as it is. TRAP T-a-setting-is-declared-once
   */
  static settings?: Readonly<Record<string, string>>;

  /** What the base class does work for — a prop its markup or JS writes, a
   *  template's pick, a boolean (`"false"` is off), what it asks by — and `observed`.
   *  TRAP T-observe-what-does-work */
  static get observedAttributes(): string[] {
    const works = Object.entries(this.props).filter(([name, def]) =>
      def.kind === 'content' || def.kind === 'template' || def.type === 'boolean' || ASKED.has(name));
    return [
      ...new Set([
        ...works.map(([name]) => name),
        ...this.variantAttrs,
        ...this.observed,
        ...(this.labelTarget ? ['aria-label', 'aria-pressed'] : []),
      ]),
    ];
  }

  /** Open shadow root — queried via $ / $$, never touched directly. */
  protected readonly root: ShadowRoot;

  /** Resolves once the first render (template + styles + onRender) has completed. */
  readonly rendered: Promise<void>;

  #resolveRendered!: () => void;

  /** Has the first stamp run. `onRender` runs again on a re-stamp or a reload. */
  #hasRendered = false;

  /** Has the first render run? `rendered` is the promise; this is the answer now. */
  get hasRendered(): boolean {
    return this.#hasRendered;
  }

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
    const own = this.constructor as typeof SherpaElement;
    this.root = this.attachShadow({ mode: 'open', delegatesFocus: own.delegatesFocus });
    if (Object.keys(own.aria).length) Object.assign(this.internals, own.aria);
    this.rendered = new Promise((res) => (this.#resolveRendered = res));
    // On the host, so it never needs removing. TRAP T-abort-controller-per-connect
    if (Object.keys(own.commands).length) this.addEventListener('command', this.#onCommand as EventListener);
  }

  /** A command a button sent: call the method it names. */
  #onCommand = (event: CommandEvent): void => {
    const method = (this.constructor as typeof SherpaElement).commands[event.command];
    const call = method ? (this as unknown as Record<string, unknown>)[method] : undefined;
    if (typeof call === 'function') call.call(this);
  };

  /* ── Native lifecycle — the platform calls these ─────────────────────── */

  connectedCallback(): void {
    SherpaElement.#live.add(this);
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
      this.#askSettings();
      this.#watchChildren();
    }
  }

  disconnectedCallback(): void {
    SherpaElement.#live.delete(this);
    this.#connected = false;
    // BEFORE onDisconnect, so a component's teardown finds the listeners gone.
    this.#ac.abort();
    // Out of the tree, out of its provider's reach: stop being told.
    this.#leave?.();
    this.#leave = undefined;
    this.#unsettle?.();
    this.#unsettle = undefined;
    this.#childWatch?.disconnect();
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

  /** How to stop being told the app's settings, once a provider has. */
  #unsettle: (() => void) | undefined;

  /** ASK the nearest provider for the app's settings, if it reads any. */
  #askSettings(): void {
    if (!(this.constructor as typeof SherpaElement).settings || this.#unsettle) return;
    this.dispatchEvent(new ContextRequestEvent(SETTINGS_CONTEXT, this, (settings, unsubscribe) => {
      if (unsubscribe) this.#unsettle = unsubscribe;
      this.#takeSettings(settings);
    }, true));
  }

  /** Each setting it reads, onto its attribute: an `on | off` prop says so, a
   *  boolean one is there or not, else the value. */
  #takeSettings(settings: Settings): void {
    const Ctor = this.constructor as typeof SherpaElement;
    for (const [attr, named] of Object.entries(Ctor.settings ?? {})) {
      const not = named.startsWith('!');
      const value = settings.get(not ? named.slice(1) : named);
      if (value === null) continue;
      const on = not ? !value : value;
      if (typeof on !== 'boolean') this.setAttribute(attr, String(on));
      else if (Ctor.props[attr]?.type === 'enum') this.setAttribute(attr, on ? 'on' : 'off');
      else this.toggleAttribute(attr, on);
    }
    this.onSettings(settings);
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    const Ctor = this.constructor as typeof SherpaElement;
    /* "false" is OFF: every framework writes `data-x={false}` as that string,
       and a boolean is read by presence. TRAP T-false-is-off */
    if (newVal === 'false' && Ctor.props[name]?.type === 'boolean') {
      this.removeAttribute(name);
      return;
    }
    // Before the first render onRender reads the attribute state itself.
    if (oldVal === newVal || !this.#hasRendered) return;
    // Its markup's directives first; onChange still fires afterwards.
    applyDirectives(this.#directives, (attr) => this.getAttribute(attr), this.#glyph, name);
    if (name === 'aria-label' || name === 'aria-pressed') this.#syncLabel();
    if (Ctor.asks && ASKED.has(name)) this.#reask();
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
   * Clone a `<template class="…">` prototype's first element — or the `inner`
   * one an `<svg>` wrapper holds. A loop passes the template, looked up once.
   * TRAP T-clone-returns-null-never-asserts — `null` when missing or empty.
   */
  protected clone<T extends Element = HTMLElement>(
    from: string | HTMLTemplateElement | null | undefined,
    inner?: string,
  ): T | null {
    const tpl = typeof from === 'string' ? this.$<HTMLTemplateElement>(from) : from;
    // `content` is absent on a non-<template>, so a wrong selector fails here.
    const first = inner ? tpl?.content?.querySelector(inner) : tpl?.content?.firstElementChild;
    if (!first) return null;
    /* IMPORTED into the page's document, not cloned in the template's inert
       one: every component in the copy upgrades NOW, so a host may call its
       methods before it is appended. TRAP T-custom-element-upgrade */
    const node = document.importNode(first, true) as unknown as T;
    // The stamp drew its root's icons, not a prototype's. TRAP T-a-cloned-prototype-needs-its-icons-upgraded
    upgradeIcons(node as unknown as ParentNode);
    return node;
  }

  /**
   * An OPTIONAL part: its `<template class="…">` prototype's element, stamped
   * in the prototype's place the first time `make` is true, then kept; null
   * until then. TRAP T-an-optional-part-is-stamped-when-it-shows
   */
  protected stampOnce<T extends Element = HTMLElement>(from: string, make: boolean): T | null {
    const tpl = this.$<HTMLTemplateElement>(from);
    if (!tpl) return null;
    const had = STAMPED.get(tpl) as T | undefined;
    if (had || !make) return had ?? null;
    const node = this.clone<T>(tpl);
    if (node) {
      tpl.before(node);
      STAMPED.set(tpl, node);
    }
    return node;
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

  /** This element's `ElementInternals`, attached ONCE on first use: a form
   *  control and a custom state share it. TRAP T-private-state-is-a-custom-state */
  protected get internals(): ElementInternals {
    return (this.#internals ??= this.attachInternals());
  }
  /** Attached on the first ask, never twice. */
  #internals: ElementInternals | undefined;

  /** A form control's link to its form: what it submits, and whether that is
   *  acceptable. The component declares `static formAssociated = true`.
   *  TRAP T-shadow-input-needs-element-internals */
  protected get formLink(): FormValue {
    return (this.#formLink ??= new FormValue(this, this.internals));
  }
  /** Made on the first ask. */
  #formLink: FormValue | undefined;

  /** A form control brings what it submits up to date; `checkValidity()` and
   *  `reportValidity()` call it first. Nothing, by default. TRAP T-a-flag-brings-the-base-methods */
  protected syncFormValue(): void {}

  /** Is it acceptable, as its form sees it — and, reporting, show the browser's
   *  message. A form-associated element's alone: `define()` gives them. */
  declare checkValidity?: () => boolean;
  declare reportValidity?: () => boolean;

  /** Set or clear a CUSTOM STATE, read as `:host(:state(name))` — private state
   *  is never a public `data-*`. As `toggleAttribute`. TRAP T-private-state-is-a-custom-state */
  protected toggleState(name: string, on?: boolean): boolean {
    const { states } = this.internals;
    const want = on ?? !states.has(name);
    if (want) states.add(name);
    else states.delete(name);
    return want;
  }

  /** Is this custom state set? */
  protected hasState(name: string): boolean {
    return this.#internals?.states.has(name) ?? false;
  }

  /* ── Events ──────────────────────────────────────────────────────────── */

  /** Dispatch a bubbling, composed CustomEvent — its detail `{}` when none is given, never null.
   *  `cancelable`: a host may take the ask over; false then, as `dispatchEvent` says. */
  protected emit<T = unknown>(name: string, detail?: T, options: { cancelable?: boolean } = {}): boolean {
    const event = new CustomEvent(name, { detail: detail ?? {}, bubbles: true, composed: true, cancelable: options.cancelable === true });
    /* A PART's event is its composite's to hear, and stops at the composite's
       host — the last listener there — so a page hears a component's own
       events only. TRAP T-an-inner-event-stops-at-its-host */
    const root = this.getRootNode();
    const host = root instanceof ShadowRoot && root.host instanceof SherpaElement ? root.host : null;
    const stop = (e: Event): void => { if (e === event) e.stopPropagation(); };
    host?.addEventListener(name, stop);
    const kept = this.dispatchEvent(event);
    host?.removeEventListener(name, stop);
    return kept;
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
    this.#given = data;
    return this.rendered.then(() => this.renderData(data));
  }

  /**
   * `populate()` as a PROPERTY — the door a framework binds: React 19, Vue and
   * Svelte set a property, and cannot call a method. Reads what was last given.
   * TODO 211 · TRAP T-false-is-off
   */
  get data(): unknown {
    return this.#given;
  }
  set data(value: unknown) {
    void this.populate(value);
  }
  /** What `populate()` or `data` was last given. */
  #given: unknown = undefined;

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
      // An icon still loading for it must not draw over this text.
      renderIcon(el, '');
      el.textContent = value === 'NaN' ? '' : value;
    }
  }

  /**
   * Copy attributes from this host onto the control or composed part it wraps,
   * each as `name`, or `[from, to]` when the part calls it something else.
   * `value` is SKIPPED — setting it after the reader has typed puts the old
   * text back, so each caller assigns `control.value` itself.
   * TRAP T-mirroring-skips-value
   */
  protected mirrorAttrs(control: Element, attrs: readonly (string | readonly [from: string, to: string])[]): void {
    for (const entry of attrs) {
      const [from, to] = typeof entry === 'string' ? [entry, entry] : entry;
      if (from === 'value') continue;
      if (this.hasAttribute(from)) control.setAttribute(to, this.getAttribute(from) ?? '');
      else control.removeAttribute(to);
    }
  }

  /**
   * Stamp a list DECLARATIVELY — the prototype's attributes say what fills what,
   * so there is no `fill` callback. An ITEM is whatever the component repeats:
   * a bar, a tab, a crumb, a swatch, a row.
   * TRAP T-item-template-cannot-compute
   * TRAP T-custom-element-upgrade — writes are ATTRIBUTES, never properties.
   * TRAP T-row-fragment-cloned-whole — `after` is the escape hatch, and
   * TRAP T-render-list-keeps-fill-in-the-caller — it is where a caller fills what a template cannot.
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
    // drops half of every item. IMPORTED, as `clone()` does, so a component in
    // it upgrades now; its icons come from `data-icon` FIELDS. TRAP T-custom-element-upgrade
    items.forEach((item, index) => {
      const frag = document.importNode(tpl.content, true);
      for (const root of [...frag.children]) fillItem(root, item, index, this.#glyph);
      // `after` gets the first root; a second is its nextElementSibling.
      const first = frag.firstElementChild as HTMLElement | null;
      if (first) opts?.after?.(first, item, index);
      container.appendChild(frag);
    });
  }

  /**
   * A word from its markup — a `[data-word]` in a `<template>` of the stamped
   * tree — for text it hands on as data, or writes as an attribute.
   * TRAP T-a-word-is-in-the-markup
   */
  protected word(key: string): string {
    for (const tpl of this.$$<HTMLTemplateElement>('template')) {
      const hit = tpl.content.querySelector(`[data-word="${key}"]`);
      if (hit) return hit.textContent?.trim() ?? '';
    }
    const said = `${this.localName}:${key}`;
    if (!MISSING_WORDS.has(said)) {
      MISSING_WORDS.add(said);
      report({ code: 'word-missing', message: `<${this.localName}>'s markup has no word "${key}".`, at: { tag: this.localName, key } });
    }
    return '';
  }

  /**
   * `renderItems` for one item, when a component has no single container.
   * TRAP T-clone-item-is-for-two-destinations
   */
  protected cloneItem<T extends Element = HTMLElement>(
    from: string | HTMLTemplateElement | null | undefined,
    item: unknown,
    index = 0,
  ): T | null {
    const node = this.clone<T>(from);
    if (node) fillItem(node, item, index, this.#glyph);
    return node;
  }

  /* ── Private — boot and stamp ────────────────────────────────────────── */

  /** Adopt the styles, stamp the template, then run the first render. */
  async #bootstrap(): Promise<void> {
    // Styles awaited before any DOM write — no flash of unstyled content.
    const files = this.#files();
    const styling = this.#adoptStyles(files.css);
    const markup = files.html ? loadTemplates(files.html).then((t) => t.html) : Promise.resolve('');
    // A consumer's own markup must keep what this component reaches for.
    if (files.html && files.ownHtml) void checkOwnTemplate(this.localName, files.html, files.ownHtml);

    /* THE MARKUP LEG MUST NOT LEAVE `rendered` PENDING. A dropped connection
       rejects the fetch, and an unguarded await here skipped
       #resolveRendered() — so all 557 `await el.rendered` sites hung with no
       error and no timeout. Stamp empty and carry on: the element is visibly
       blank, which is a fault a person can see.
       TRAP T-rendered-settles-even-when-the-markup-does-not */
    let html = '';
    try {
      const page = (this.constructor as typeof SherpaElement).pageCss;
      [, html] = await Promise.all([styling, markup, loadFamily(files.family), page ? adoptPageSheet(page.href) : undefined]);
    } catch (error) {
      report({ code: 'template-failed', message: `<${this.localName}>'s template did not load: ${String(error)}`, at: { tag: this.localName } });
    }

    this.#stampedFrom = files.html;
    const [body, id] = files.html
      ? templateBody(cachedTemplates(files.html)?.map ?? null, html, this.templateId) : ['', null];
    this.#stamp(body, id);
    // DRAWN means its icons too: the first draw's are loading now. TRAP T-an-icon-loads-when-first-drawn
    await iconsLoading();
    this.#resolveRendered();

    if (!this.#connected && this.isConnected) {
      this.#connected = true;
      this.onConnect();
      this.#ask();
      this.#askSettings();
    }
    this.#watchChildren();
  }

  /** While no `populate()` gave it data, its children are its data — read
   *  now, and again as they change. TRAP T-a-list-takes-its-children-as-data */
  #watchChildren(): void {
    if (this.childData === SherpaElement.prototype.childData || !this.isConnected) return;
    const read = (): void => {
      if (this.#given !== undefined) return;
      const data = this.childData();
      // Drawing may touch the children — a tab's panel — so only a CHANGE draws.
      const said = JSON.stringify(data);
      if (data === undefined || said === this.#childSaid) return;
      this.#childSaid = said;
      void this.renderData(data);
    };
    // Its own attributes are not its children.
    this.#childWatch ??= new MutationObserver((records) => {
      if (records.some((r) => r.target !== this || r.type !== 'attributes')) read();
    });
    this.#childWatch.observe(this, { childList: true, subtree: true, characterData: true, attributes: true });
    read();
  }

  /** Watches the children while they are its data. */
  #childWatch: MutationObserver | null = null;
  /** What its children last said. */
  #childSaid: string | undefined;

  /** The markup and sheets this element is drawn from now — its own, then a
   *  consumer's. TRAP T-a-templater-owns-the-files */
  #files(): { html?: string; family: string[]; css: string[]; ownHtml?: string } {
    const Ctor = this.constructor as typeof SherpaElement;
    return filesFor(this.localName, Ctor.html, Ctor.css);
  }

  /** The markup it was stamped from. */
  #stampedFrom: string | undefined;

  /** Adopted sheets: shared first, then this component's CSS, then a consumer's —
   *  kept once every one loaded, so the next element asks nothing; one that
   *  failed is asked again. TRAP T-shared-sheets-settle-independently */
  async #adoptStyles(css: readonly string[]): Promise<void> {
    await Promise.resolve();
    const Ctor = this.constructor as typeof SherpaElement;
    const urls = [...Ctor.sharedStyles.map((u) => u.href), ...css];
    const key = urls.join(' ');
    const kept = SherpaElement.#sheets.get(key);
    if (kept) {
      this.root.adoptedStyleSheets = kept;
      return;
    }
    const sheets = await loadSheets(urls);
    if (sheets.length === urls.length) SherpaElement.#sheets.set(key, sheets);
    this.root.adoptedStyleSheets = sheets;
  }

  /** Each list of sheets, loaded, by its URLs. */
  static #sheets = new Map<string, CSSStyleSheet[]>();

  /** A RELOAD: the sheets again, and the tree stamped again from its markup —
   *  as a variant re-stamp is. TRAP T-restamp-does-not-abort */
  async #redraw(): Promise<void> {
    if (!this.#hasRendered) return;
    const files = this.#files();
    await this.#adoptStyles(files.css);
    const cached = files.html ? cachedTemplates(files.html) : undefined;
    if (!cached) return;
    this.#stampedFrom = files.html;
    const [body, id] = templateBody(cached.map, cached.html, this.templateId);
    this.#stamp(body, id);
  }

  /**
   * Write a template body into the shadow root and run that tree's setup. Shared
   * by the first render and by a variant re-stamp.
   * TRAP T-restamp-does-not-abort
   */
  #stamp(body: string, id: string | null): void {
    // A family's markup after its own, parsed once and cloned. TRAP T-a-family-shares-markup
    const { fragment, directives, icons, anchors } = stampable(body + familyBody(this.#files().family));
    this.root.replaceChildren(fragment);
    // A root with an anchor hears its tips. TRAP T-a-tip-lives-in-the-top-layer
    if (anchors) liftTipsIn(this.root);
    this.#stampedTemplate = id;
    this.#hasRendered = true;
    // Directives and icons BEFORE onRender, so a component's setup reads a
    // populated tree. A template `data-icon` draws nothing until upgraded.
    this.#directives = directives ? readDirectives(this.root) : [];
    applyDirectives(this.#directives, (attr) => this.getAttribute(attr), this.#glyph);
    this.#syncLabel();
    if (icons) upgradeIcons(this.root);
    this.onRender();
    this.#wireSlots();
  }

  /** Did `#syncLabel` write the inner label — so only it ever removes one. */
  #labelled = false;

  /** Copy the host's `aria-label`, and `aria-pressed`, onto `labelTarget` —
   *  a toggle's state must reach the control that is read. */
  #syncLabel(): void {
    const target = (this.constructor as typeof SherpaElement).labelTarget;
    if (!target) return;
    const pressed = this.getAttribute('aria-pressed');
    for (const el of this.$$(target)) {
      if (pressed != null) el.setAttribute('aria-pressed', pressed);
      else el.removeAttribute('aria-pressed');
    }
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
    const wanted = this.templateId;
    // A component with one template never opts in; only a CHANGE re-stamps.
    if (wanted === null || wanted === this.#stampedTemplate) return;

    // Cached per URL at first render — a re-stamp costs no fetch.
    const map = cachedTemplates(this.#stampedFrom ?? '')?.map;
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

  /** Listen to every slot, so `has-*` states follow what is slotted. */
  #wireSlots(): void {
    for (const slot of this.root.querySelectorAll('slot')) {
      const update = (): void => this.#reflectSlot(slot);
      /* NO SIGNAL: the slot lives as long as this stamp, and a re-stamp drops
         it with its listener. The disconnect signal froze `has-*` on a
         moved element. TRAP T-abort-controller-per-connect */
      slot.addEventListener('slotchange', update);
      update();
    }
  }

  /** Set the `has-<slot>` state when a slot holds real content. TRAP T-private-state-is-a-custom-state */
  #reflectSlot(slot: HTMLSlotElement): void {
    // TRAP T-slot-guards-only-when-filled — no flatten, so a slot's own
    // fallback never counts as "present".
    const has = slot.assignedNodes().some((n) => {
      if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').trim().length > 0;
      // A FORWARDED slot is only as full as what it carries.
      if (n instanceof HTMLSlotElement) return n.assignedNodes({ flatten: true }).length > 0;
      return (n as Element).tagName !== 'TEMPLATE';
    });
    /* `-slot`, not `has-content`: the state says THE DEFAULT SLOT IS
       FILLED, which is not the same as the element having content. On a layout
       element it is inert either way. */
    this.toggleState(slot.name ? `has-${slot.name}` : 'has-content-slot', has);
  }

  /* ── Private — directives ───────────────────────────────────────────── */

  /** This stamp's directives. TRAP T-a-template-binds-by-markup */
  #directives: Directive[] = [];

  /** How a directive draws a glyph: as `writeIcon` does. */
  #glyph = (el: Element, value: string): void => this.writeIcon(el, value);

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

  /**
   * Its data read from its own CHILDREN — the markup path, for a page that
   * writes only HTML. Undefined: it has none. Used while no `populate()` gave
   * data. TRAP T-a-list-takes-its-children-as-data
   */
  protected childData(): unknown {
    return undefined;
  }

  /** Shadow DOM is ready. Cache refs, wire host listeners. Runs again on a re-stamp. */
  protected onRender(): void {}

  /** Fires each time the element is connected, after the first render; pair it with onDisconnect. */
  protected onConnect(): void {}

  /** Element removed from the DOM. Tear down timers / observers. */
  protected onDisconnect(): void {}

  /** An observed attribute changed (after the first render). */
  protected onChange(_name: string, _oldVal: string | null, _newVal: string | null): void {}

  /** The app's settings, told: after its `static settings` are on its attributes. */
  protected onSettings(_settings: Settings): void {}

}

