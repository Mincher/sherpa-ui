/**
 * page-definition.ts — a page's data, set up from ONE JSON document: its
 * store, its fields, its scopes and its saved filters; and the one check of its
 * names. Its shapes are schemas/defs.v1.json's. docs/PAGE-DEFINITION.md
 * TRAP T-a-page-is-its-definition
 *
 * Map:
 * - ScopeDefinition — One scope: its name, and the fields it offers and holds at the start.
 * - SourceDefinition — A page's source: which store, how it pages and searches, its fields and scopes.
 * - PageDefinition — One page, as JSON — its source, its saved filters, and its components' configuration.
 * - checkPage — Check every name a page definition uses, as it opens; each broken one reports.
 * - openSource — Build a page's source from its definition, over the app's store. It checks nothing.
 * - presetReadings — A preset's conditions as readings, each field's its tree, typed once by its field.
 * - savedFiltersOf — A page's own saved filters: each that is a name and a query.
 * - SAVED_PRESET — The id a saved filter goes by as a preset on a bar: this, then its own.
 * - pageWithQuery — The page definition with a Query written in: what an editor's Save hands its app.
 * - checkTiers — A page's child fields, each reported where it cannot be one.
 */
import { DataSource, type FieldDeclaration, type FilterSet } from './data-source.js';
import { answerTree, type FieldReading, type FieldType } from './filter-state.js';
import { report, type Report } from './report.js';
import type { SortSpec, Store } from './store.js';
import type { QueryContext } from './query-context.js';
import { VIEW, isSavedFilter, type AxesDefinition, type PresentationDefinition, type Query, type SavedFilter } from './query.js';
import { whereOf, type Where } from './where.js';

/** One scope: its name, and the fields it offers and holds at the start. */
export interface ScopeDefinition {
  label?: string;
  /** How its rows start arranged: the order, a field and its direction each; the field they are grouped by; the free text
   *  they are searched for. A reader changes each; the graph's Save writes them (plan 960 U4.3). */
  sort?: readonly SortSpec[];
  group?: string;
  search?: string;
  /** Every field it may add — `'all'`, every field the page declares. */
  offers?: readonly string[] | 'all';
  holds?: readonly string[];
  /** Fields it holds that a reader cannot REMOVE: they lead it, and its bar divides
   *  them from what follows. Will, TODO 703 · TRAP T-a-fixed-field-stays-held */
  fixed?: readonly string[];
  /** Fields it holds that a reader cannot switch OFF. Will, TODO 703 */
  alwaysOn?: readonly string[];
  /** Fields drawn as one group; a `serial` set chains them. TRAP T-a-filter-set-groups-or-chains */
  sets?: readonly FilterSet[];
  /** Group and Sort arrange its rows: its Organise chips. Left out, a scope
   *  a page of rows is drawn in does, and the View does not. Will, TODO 99, 341 */
  arranges?: boolean;
  /** Its answers at the start, in the plain form a View writes:
   *  `{ "created": { "last": 12, "unit": "month" } }`. Reset puts them back. Will, TODO 464 */
  where?: Readonly<Where>;
  /** Its PRESETS: the app's own named conditions, each a boolean chip leading
   *  the scope — `{ "id": "high-risk", "label": "High risk", "where": { … } }`,
   *  `where` in the plain form. Will, TODO 493 · TRAP T-a-preset-is-its-own-part */
  presets?: readonly { id: string; label: string; where: Readonly<Where> }[];
  /** What its slot shows until the reader changes it — its `primary`, `secondary`
   *  and `group` — and a default per view, `grid` and `chart`, over it. Will, TODO 548 */
  presentation?: PresentationDefinition;
  /** What each axis's chip offers here, over the page's. Will, TODO 660 */
  axes?: AxesDefinition;
}

/** A page's source: which store, how it pages and searches, its fields and
 *  scopes. No field lists its values: the data says them.
 *  TRAP T-the-data-says-what-a-field-may-hold */
export interface SourceDefinition {
  /** The name the app registered its store under. */
  store: string;
  /** Its type, by id: its fields' words are the type's, so `fields` says only what each control does. Plan 960 U2 */
  type?: string;
  pageSize?: number;
  /** `input`: its filters apply live, debounced. Will, TODO 107 */
  applyOn?: 'change' | 'input';
  debounce?: number;
  /** A remote store's whole set is held up to this many rows; 0 holds none.
   *  TRAP T-a-remote-source-holds-its-whole-set */
  holdRows?: number;
  search?: readonly string[];
  fields?: Readonly<Record<string, FieldDeclaration>>;
  scopes?: Readonly<Record<string, ScopeDefinition>>;
  /** What each axis's chip offers — `{ "chart": { "secondary": { "unavailable": ["name"] } } }` —
   *  in every scope, a scope's own over it. Will, TODO 660 */
  axes?: AxesDefinition;
}

/** One page, as JSON — its source, its saved filters, and its components'
 *  configuration. Its markup is its Context's, in the app definition. */
export interface PageDefinition {
  v: 1;
  id: string;
  source?: SourceDefinition;
  /** The page's OWN saved filters, by id: query definitions, listed beside a
   *  reader's and applied as theirs are. Will, 366. TRAP T-saved-filters-are-every-scope */
  savedFilters?: Readonly<Record<string, SavedFilter>>;
  /** Each component's CONFIGURATION, by id — set before it is answered.
   *  TRAP T-configuration-is-not-data */
  ui?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/**
 * Check every name a page definition uses: its shape, its child fields, each
 * set's, fixed and always-on fields, its presets' ids and each saved filter's
 * scopes. Each broken one reports; true when none is. DOM-free and one pass, so a
 * page opening calls it first, and a server or a tool the same.
 * TRAP T-a-page-is-checked-as-it-opens
 */
export function checkPage(page: PageDefinition): boolean {
  if (page?.v !== 1 || typeof page.id !== 'string') {
    report({ code: 'page-definition', message: 'checkPage: it is not a v1 page definition.' });
    return false;
  }
  const problems: Report[] = [];
  const at = (code: string, message: string, where: Report['at']): void => {
    problems.push({ code, message: `checkPage: page "${page.id}": ${message}`, at: { page: page.id, ...where } });
  };
  const source = page.source;
  if (source && typeof source.store !== 'string') at('page-definition', 'its source names no store.', {});
  if (source?.type !== undefined && !/^[a-z][a-z0-9-]*$/.test(String(source.type))) at('page-definition', 'its source.type is no type\'s id (lowercase letters, digits, hyphens).', {});
  if (source) problems.push(...tiers(source).problems);
  for (const [scope, facts] of Object.entries(source?.scopes ?? {})) {
    for (const [list, code] of [['fixed', 'fixed-field-not-held'], ['alwaysOn', 'always-on-field-not-held']] as const) {
      for (const field of facts[list] ?? []) {
        if (!facts.holds?.includes(field)) at(code, `scope "${scope}"'s ${list} names "${field}", which it does not hold.`, { scope, field });
      }
    }
    for (const set of facts.sets ?? []) {
      for (const field of set.fields) {
        if (!facts.holds?.includes(field)) at('set-field-not-held', `the set "${set.id}" names "${field}", which scope "${scope}" does not hold.`, { scope, set: set.id, field });
      }
    }
    const ids = new Set<string>();
    for (const { id } of facts.presets ?? []) {
      if (ids.has(id)) at('preset-twice', `scope "${scope}" has two presets "${id}"; the second wins.`, { scope, preset: id });
      ids.add(id);
    }
  }
  // The View is every page's, declared or not.
  const scopes = new Set([VIEW, ...Object.keys(source?.scopes ?? {})]);
  for (const [id, set] of Object.entries(page.savedFilters ?? {})) {
    if (!isSavedFilter(set)) {
      at('saved-filter-invalid', `the saved filter "${id}" is not { label, query: { v: 1, scopes } }, so it is left out.`, { savedFilter: id });
      continue;
    }
    for (const scope of Object.keys(set.query.scopes)) {
      if (!scopes.has(scope)) at('saved-filter-unknown-scope', `the saved filter "${id}" fills scope "${scope}", which source.scopes does not have.`, { savedFilter: id, scope });
    }
  }
  for (const problem of problems) report(problem);
  return !problems.length;
}

/** Build a page's source from its definition, over the app's store — into the
 *  Context's Query when given one. It checks nothing: `checkPage` does. */
export async function openSource(def: SourceDefinition, store: Store, options: { query?: QueryContext } = {}): Promise<DataSource> {
  // ONE definition per Context: a second would declare its scopes again. 366 step 25
  if (options.query?.members) {
    report({ code: 'context-has-a-definition', message: 'openSource: this Query already has a source opened from a definition; a second declares its scopes again.' });
  }
  const source = new DataSource({
    store,
    // The Context's Query, when the page shares one. 366 step 24
    ...(options.query ? { query: options.query } : {}),
    ...(def.pageSize ? { pageSize: def.pageSize } : {}),
    ...(def.applyOn ? { applyOn: def.applyOn } : {}),
    ...(def.debounce != null ? { debounce: def.debounce } : {}),
    ...(def.holdRows != null ? { holdRows: def.holdRows } : {}),
    ...(def.search ? { searchFields: [...def.search] } : {}),
    // A held store sends the page's fields alone. TRAP T-a-held-set-reads-the-pages-fields
    pageFields: true,
  });
  const fields = Object.keys(def.fields ?? {});
  const { children } = tiers(def);
  for (const [field, facts] of Object.entries(def.fields ?? {})) source.declareField(field, facts);
  if (def.axes) source.query.declareAxes(def.axes);
  for (const [scope, facts] of Object.entries(def.scopes ?? {})) {
    if (facts.label || facts.arranges != null) {
      source.query.declareScope(scope, {
        ...(facts.label ? { label: facts.label } : {}), ...(facts.arranges != null ? { arranges: facts.arranges } : {}),
      });
    }
    // A child is never offered on its own: its picks are its parent's. TODO 369
    if (facts.offers) source.query.offer(scope, facts.offers === 'all' ? fields.filter((f) => !children.has(f)) : facts.offers);
    // Before it holds them. Will, TODO 703
    if (facts.fixed || facts.alwaysOn) source.query.declareFixed(scope, facts);
    if (facts.holds) {
      source.query.ask({ scope, hold: facts.holds });
      source.declareOwn(scope, facts.holds);
    }
    if (facts.where) source.query.declareStart(scope, source.readingsOf(facts.where));
    // How its rows start arranged, as a reader's Sort, Group and Search would ask it (plan 960 U4.3).
    const first = facts.sort?.[0];
    if (first) source.query.ask({ scope, sort: first.field, direction: first.direction ?? 'asc' });
    if (facts.group) source.query.ask({ scope, group: facts.group });
    if (facts.search) source.query.ask({ scope, search: facts.search });
    if (facts.presentation) source.query.declarePresentation(scope, facts.presentation);
    if (facts.axes) source.query.declareAxes(facts.axes, scope);
    if (facts.presets?.length) {
      source.declarePresets(scope, facts.presets.map((p) => ({ id: p.id, label: p.label, readings: presetReadings(source, p.where) })));
    }
    if (facts.sets?.length) source.query.declareSets(scope, facts.sets);
  }
  /* The values LAST, so a store it does not hold is asked only for what the
     page holds. 345 phase 5 · TRAP T-a-field-reads-its-values-when-needed */
  await source.declareFromRows(fields, { lazy: true });
  // A tiered field's children, once its parents are known. TODO 369
  for (const [field, facts] of Object.entries(def.fields ?? {})) {
    if (facts.child && children.has(facts.child)) await source.declareChildren(field);
  }
  // A fetching list opens on its first value, before the first load. TODO 403
  await source.openOnFirst();
  return source;
}

/** A preset's conditions as readings, each field's its tree, typed once by its
 *  field: a number's `lt 60` holds 60, never the text a control types.
 *  TRAP T-a-value-is-typed-once */
export function presetReadings(source: DataSource, where: Readonly<Where>): Record<string, FieldReading> {
  return Object.fromEntries(Object.entries(source.readingsOf(where)).map(([field, reading]) => {
    const type = source.fieldFacts(field).type;
    const tree = answerTree(reading, type ? { type } : {});
    return [field, tree ? { tree } : reading];
  }));
}

/** A page's own saved filters: each that is a name and a query definition.
 *  `checkPage` reports one that is not. Will, 366 */
export function savedFiltersOf(page: PageDefinition): Record<string, SavedFilter> {
  return Object.fromEntries(Object.entries(page.savedFilters ?? {}).filter(([, set]) => isSavedFilter(set)));
}

/** The id a saved filter goes by as a preset on a bar: this, then its own. TODO 605 */
export const SAVED_PRESET = 'saved:';

/**
 * The page definition with a Query written in — what an editor's Save hands its app:
 * each scope's holds, its answers at the start (the reader's own; a preset's rows are the
 * preset's), its slot's presentation over the definition's, and the page size. The rest
 * is the definition's. A sort, a group and a search have no place in a page: a View keeps
 * them. `checkPage` checks what it makes. Plan 695 N1 · TRAP T-one-node-registry
 */
export function pageWithQuery(
  page: PageDefinition, query: Query, facts: { pageSize?: number | null; type?: (field: string) => FieldType | undefined } = {},
): PageDefinition {
  const copy = structuredClone(page);
  const source = copy.source;
  if (!source) return copy;
  const type = (field: string): FieldType | undefined => facts.type?.(field) ?? source.fields?.[field]?.type;
  const scopes: Record<string, ScopeDefinition> = {};
  for (const id of new Set([...Object.keys(source.scopes ?? {}), ...Object.keys(query.scopes)])) {
    const { holds: _held, where: _said, presentation, sort: _sorted, group: _grouped, search: _searched, ...kept } = source.scopes?.[id] ?? {};
    const now = query.scopes[id];
    const own = Object.fromEntries(Object.entries(now?.readings ?? {}).map(([field, { byPreset: _preset, ...reading }]) => [field, reading]));
    const where = whereOf(own, (field) => {
      const t = type(field);
      return t ? { type: t } : {};
    });
    const shown = now?.presentation ? { ...presentation, ...structuredClone(now.presentation) } : presentation;
    const scope: ScopeDefinition = {
      ...kept,
      ...(now?.holds.length ? { holds: [...now.holds] } : {}),
      ...(Object.keys(where).length ? { where } : {}),
      ...(shown ? { presentation: shown } : {}),
      // Its arrangement as the Query holds it now (plan 960 U4.3): a sort, a group and a search are a page's to save too.
      ...(now?.sort?.length ? { sort: structuredClone(now.sort) } : {}),
      ...(now?.group ? { group: now.group } : {}),
      ...(now?.search ? { search: now.search } : {}),
    };
    if (Object.keys(scope).length) scopes[id] = scope;
  }
  const { scopes: _scopes, pageSize, ...rest } = source;
  const size = facts.pageSize ?? pageSize;
  copy.source = { ...rest, ...(size ? { pageSize: size } : {}), ...(Object.keys(scopes).length ? { scopes } : {}) };
  return copy;
}

/** A page's child fields, and each place one cannot be — not declared, under a
 *  number or a date, or held, offered or set by a scope, since a child's picks
 *  live in its parent's reading. TODO 369 */
function tiers(def: SourceDefinition): { children: Set<string>; problems: Report[] } {
  const fields = def.fields ?? {};
  const children = new Set<string>();
  const problems: Report[] = [];
  for (const [field, facts] of Object.entries(fields)) {
    const child = facts.child;
    if (!child) continue;
    if (!(child in fields)) {
      problems.push({
        code: 'child-not-declared',
        message: `checkPage: "${field}" names the child "${child}", which source.fields does not declare.`,
        at: { field, child },
      });
    } else if (facts.type === 'number' || facts.type === 'date') {
      problems.push({
        code: 'child-under-a-typed-field',
        message: `checkPage: "${field}" is a ${facts.type}, so it holds no child values; "${child}" is not its child.`,
        at: { field, child },
      });
    } else children.add(child);
  }
  for (const [scope, facts] of Object.entries(def.scopes ?? {})) {
    const named = [...(facts.holds ?? []), ...(Array.isArray(facts.offers) ? facts.offers : []),
      ...(facts.sets ?? []).flatMap((set) => set.fields)];
    for (const field of new Set(named)) {
      if (!children.has(field)) continue;
      problems.push({
        code: 'child-field-named',
        message: `checkPage: scope "${scope}" names "${field}", a child field: its picks are in its parent's filter.`,
        at: { scope, field },
      });
    }
  }
  return { children, problems };
}

/** A page's child fields, each reported where it cannot be one. */
export function checkTiers(def: SourceDefinition): Set<string> {
  const { children, problems } = tiers(def);
  for (const problem of problems) report(problem);
  return children;
}
