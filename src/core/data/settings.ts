/**
 * settings.ts — the app's SETTINGS: each declared once, with its type, default,
 * scope and the session pointer it is kept at; and the live values, a page's own
 * over the app's. DOM-free: delivery is the provider's. TRAP T-a-setting-is-declared-once
 *
 * Map:
 * - SettingScope — Who may set its own: the app alone; a page, while it is open; or a component, by its attribute.
 * - SettingValue — What a setting holds.
 * - SettingLook — A LOOK: what the document's root carries for it.
 * - SettingDef — One setting, declared once.
 * - SettingsSchema — Every setting an app has, by key.
 * - SETTINGS — Sherpa's own settings.
 * - SettingKey — The key of one of Sherpa's own settings.
 * - SettingsStore — Where the app keeps its settings: a pointer store, as its session is.
 * - fitsSetting — Can this setting take this value?
 * - Settings — The live values over one schema: a page's own, else the app's kept one, else the default.
 * - .schema — the settings it holds, by key
 * - .get — A setting's value now.
 * - .set — Set a setting: the page's own while it lays one, else the app's, kept.
 * - .lay — A page's OWN settings, by key, over the app's until laid off; never kept.
 * - .keyAt — The setting kept at this pointer, if one is.
 */
import { getPointer, pointersOverlap, setPointer } from './pointer.js';
import { report } from './report.js';

/** Who may set its own: the app alone; a page, while it is open; or a component, by its attribute. */
export type SettingScope = 'app' | 'page' | 'component';

/** What a setting holds. Null is none: each component keeps its own. */
export type SettingValue = boolean | number | string | null;

/** A LOOK: what the document's root carries for it — inherited custom properties
 *  by value, or the attribute the token layer reads (a mode, a density). */
export interface SettingLook {
  /** Each value's custom properties, by the value as a string. */
  readonly props?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** …or this attribute, holding the value; none at `none`, false or null. */
  readonly attr?: string;
  readonly none?: SettingValue;
  /** On only while that setting is on too. */
  readonly needs?: string;
}

/** One setting, declared once. */
export interface SettingDef {
  readonly type: 'boolean' | 'number' | 'string';
  readonly default: SettingValue;
  /** The values it may take, where it is one of a few. */
  readonly values?: readonly SettingValue[];
  readonly scope: SettingScope;
  /** The session pointer the app keeps it at. */
  readonly at: string;
  /** DATA: the DataSource's own property of this name. */
  readonly source?: true;
  readonly look?: SettingLook;
}

/** Every setting an app has, by key. */
export type SettingsSchema = Readonly<Record<string, SettingDef>>;

const on = (at: string, scope: SettingScope = 'page'): SettingDef => ({ type: 'boolean', default: true, scope, at });
const off = (at: string, scope: SettingScope = 'page'): SettingDef => ({ type: 'boolean', default: false, scope, at });

/** Sherpa's own settings. A component reads one through `static settings`; the
 *  provider puts a `source` one on each source and a `look` one on the root. */
export const SETTINGS = {
  filterMode: { type: 'string', default: 'toolbars', values: ['toolbars', 'panel'], scope: 'page', at: '/filters/mode' },
  limitOptions: { ...off('/filters/limit'), source: true },
  hideUnmatched: off('/filters/hideUnmatched'),
  results: on('/filters/results'),
  countApplied: off('/filters/countApplied'),
  saveAnyScope: off('/filters/saveAnyScope'),
  // None: each bar keeps its own `data-switchable`.
  switchable: { type: 'boolean', default: null, scope: 'component', at: '/filters/switchable' },
  sectionLabels: on('/filters/sectionLabels'),
  hideOrganiseLabels: off('/filters/hideOrganiseLabels'),
  sections: on('/filters/sections'),
  highlightOnHover: off('/filters/highlightHover'),
  highlightAcross: off('/filters/highlightAcross'),
  legendChips: off('/filters/legendChips'),
  singleApply: on('/filters/singleApply'),
  reorderFilters: off('/filters/reorder'),
  moveFilters: off('/filters/moveFilters'),
  allowSolo: off('/filters/solo'),
  soloAcrossScopes: off('/filters/soloAcross'),
  soloInHeader: off('/filters/soloHeader'),
  labelColumn: on('/filters/labelColumn'),
  countEveryValue: { ...off('/filters/countEvery'), source: true },
  multiFieldColumns: on('/filters/multiField'),
  headingGroup: on('/grid/headingGroup'),
  headingHover: on('/grid/headingHover'),
  showAs: { ...on('/cards/showAs'), source: true },
  axisChips: { ...on('/filters/axisChips'), source: true },
  appContext: off('/filters/appContext', 'app'),
  applyEvery: off('/filters/applyEvery'),
  navHierarchy: off('/nav/hierarchy', 'app'),
  navViews: on('/nav/views', 'app'),
  navHover: on('/nav/hover', 'app'),
  // Every nav size and space doubles; its text steps up one. The shell reads the scale too.
  navLarge: { ...on('/nav/large', 'app'), look: { props: { true: { '--sherpa-nav-scale': '1.5' } } } },
  // A node's resize handle and Alt+Arrow. Will, TODO 748
  resizeNodes: off('/nodes/resize', 'app'),
  // A drag on the gap between two stages moves the edge between them. Will, TODO 900
  resizeStages: on('/nodes/resizeStages', 'app'),
  // With it, a stage made narrower than its nodes need pushes them in. Will, plan 901 D2 B
  resizeStagesMoveNodes: on('/nodes/resizeStagesMoveNodes', 'app'),
  // ⌘ or Ctrl held on a node's drag pulls the nodes it joins along behind it. Will, plan 918
  chainDrag: on('/nodes/chainDrag', 'app'),
  // Every Sherpa motion token is instant: transitions and travels land at once. Will, TODO 896
  reduceMotion: { ...off('/a11y/reduceMotion', 'app'), look: { props: { true: { '--sherpa-motion-scale': '0' } } } },
  // A toggle shows its state by a shape too. Will, TODO 497
  toggleShapes: { ...off('/a11y/toggleShapes', 'app'), look: { props: { true: { '--sherpa-toggle-shape': 'inline-flex' } } } },
  // An on chip's value half wears its look's border only. Will, TODO 669
  filterValueBorder: {
    ...off('/a11y/filterValueBorder', 'app'),
    look: { props: { true: {
      '--sherpa-filter-value-surface': 'var(--sherpa-style-default-surface-base, #ffffff)',
      '--sherpa-filter-value-content': 'var(--sherpa-style-default-content-base, #0c0b11)',
    } } },
  },
  // A menu an action opened says what it does. Will, TODO 691
  actionDescriptions: { ...on('/a11y/actionDescriptions', 'app'), look: { props: { false: { '--sherpa-action-description': 'none' } } } },
  // Read by script, so an attribute.
  descriptionTips: { ...off('/a11y/descriptionTips', 'app'), look: { attr: 'data-description-tips', needs: 'actionDescriptions' } },
} as const satisfies SettingsSchema;

/** The key of one of Sherpa's own settings. */
export type SettingKey = keyof typeof SETTINGS;

/** Where the app keeps its settings: a pointer store, as its session is. */
export interface SettingsStore {
  get(pointer: string): unknown;
  set(pointer: string, value: unknown): void;
  subscribe(pointer: string, run: (value: unknown) => void): () => void;
}

/** Can this setting take this value? Null only where its default is none. */
export function fitsSetting(def: SettingDef, value: unknown): value is SettingValue {
  if (value === null) return def.default === null;
  if (typeof value !== def.type || (typeof value === 'number' && !Number.isFinite(value))) return false;
  return !def.values || def.values.includes(value as SettingValue);
}

/** Kept in memory, where the app gives no store. */
class MemoryStore implements SettingsStore {
  /** What it holds. */
  #data: Record<string, unknown> = {};
  /** Who hears a pointer. */
  #subs = new Set<{ pointer: string; run: (value: unknown) => void }>();
  get(pointer: string): unknown {
    return getPointer(this.#data, pointer);
  }
  set(pointer: string, value: unknown): void {
    setPointer(this.#data, pointer, value);
    for (const sub of this.#subs) if (pointersOverlap(sub.pointer, pointer)) sub.run(this.get(sub.pointer));
  }
  subscribe(pointer: string, run: (value: unknown) => void): () => void {
    const sub = { pointer, run };
    this.#subs.add(sub);
    return () => this.#subs.delete(sub);
  }
}

/**
 * The live values over one schema: a page's own, else the app's kept one, else
 * the default. `change` says each value that moved, with `{ key, value }`.
 * TRAP T-a-setting-is-declared-once
 */
export class Settings extends EventTarget {
  readonly schema: SettingsSchema;
  /** Where the app's own are kept. */
  readonly #store: SettingsStore;
  /** A page's own, while it lays them. */
  #page: Map<string, SettingValue> | null = null;
  /** Each value as last said. */
  readonly #last = new Map<string, SettingValue>();

  constructor(schema: SettingsSchema = SETTINGS, store: SettingsStore = new MemoryStore()) {
    super();
    this.schema = schema;
    this.#store = store;
    for (const [key, def] of Object.entries(schema)) {
      this.#last.set(key, this.#read(key));
      store.subscribe(def.at, () => this.#moved([key]));
    }
  }

  /** A setting's value now. */
  get(key: string): SettingValue {
    return this.#read(key);
  }

  /** Set a setting: the page's own while it lays one, else the app's, kept. A
   *  value it cannot take is said and left. */
  set(key: string, value: SettingValue): void {
    const def = this.#def(key);
    if (!def) return;
    if (!fitsSetting(def, value)) {
      report({ code: 'setting-refused', message: `Settings: ${key} cannot be ${JSON.stringify(value)}.`, at: { key, value: String(value) } });
      return;
    }
    if (this.#page?.has(key)) this.#page.set(key, value);
    else this.#store.set(def.at, value);
    this.#moved([key]);
  }

  /** A page's OWN settings, by key, over the app's until laid off (`null`): a
   *  write to one stays the page's, and nothing is kept. An app setting is not
   *  a page's to lay. For a demo or an onboarding page. Will, TODO 591 */
  lay(values: Readonly<Record<string, SettingValue>> | null): void {
    const was = [...this.#page?.keys() ?? []];
    const page = new Map<string, SettingValue>();
    for (const [key, value] of Object.entries(values ?? {})) {
      const def = this.#def(key);
      if (!def) continue;
      if (def.scope === 'app') {
        report({ code: 'setting-not-page', message: `Settings: ${key} is the app's, so a page cannot lay its own.`, at: { key } });
      } else if (fitsSetting(def, value)) page.set(key, value);
    }
    this.#page = values ? page : null;
    this.#moved([...was, ...page.keys()]);
  }

  /** The setting kept at this pointer, if one is. */
  keyAt(pointer: string): string | undefined {
    return Object.keys(this.schema).find((key) => this.schema[key]!.at === pointer);
  }

  /** The page's, else a kept value it can take, else the default. */
  #read(key: string): SettingValue {
    const def = this.schema[key];
    if (!def) return null;
    if (this.#page?.has(key)) return this.#page.get(key)!;
    const kept = this.#store.get(def.at);
    return kept !== undefined && fitsSetting(def, kept) ? kept : def.default;
  }

  /** A key the schema has, or said. */
  #def(key: string): SettingDef | undefined {
    const def = this.schema[key];
    if (!def) report({ code: 'setting-unknown', message: `Settings: there is no setting "${key}".`, at: { key } });
    return def;
  }

  /** Say each of these that moved. */
  #moved(keys: readonly string[]): void {
    for (const key of new Set(keys)) {
      const now = this.#read(key);
      if (Object.is(now, this.#last.get(key))) continue;
      this.#last.set(key, now);
      this.dispatchEvent(new CustomEvent('change', { detail: { key, value: now } }));
    }
  }
}
