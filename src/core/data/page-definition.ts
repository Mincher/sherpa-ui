/**
 * page-definition.ts — a page's data, set up from ONE JSON document: its
 * store, its fields, its scopes and its saved filters. docs/PAGE-DEFINITION.md
 * TRAP T-a-page-is-its-definition
 *
 * Map:
 * - ScopeDefinition — One scope: its name, and the fields it offers and holds at the start.
 * - SourceDefinition — A page's source: which store, how it pages and searches, its fields and scopes.
 * - PageDefinition — One page, as JSON — its source, its saved filters, and its components' configuration.
 * - openSource — Build a page's source from its definition, over the app's store.
 * - savedFiltersOf — A page's own saved filters, each checked; one that is not a name and a query is reported.
 * - checkTiers — A page's child fields, each reported where it cannot be one.
 */
import { DataSource, type FieldDeclaration, type FilterSet } from './data-source.js';
import { report } from './report.js';
import type { Store } from './store.js';
import type { QueryContext } from './query-context.js';
import { isSavedFilter, type SavedFilter } from './query.js';

/** One scope: its name, and the fields it offers and holds at the start. */
export interface ScopeDefinition {
  label?: string;
  /** Every field it may add — `'all'`, every field the page declares. */
  offers?: readonly string[] | 'all';
  holds?: readonly string[];
  /** Fields drawn as one group; a `serial` set chains them. TRAP T-a-filter-set-groups-or-chains */
  sets?: readonly FilterSet[];
  /** Group and Sort arrange its rows: its Organise chips. Left out, a scope
   *  over a grid or a list does, and the View does not. Will, TODO 99 */
  arranges?: boolean;
}

/** A page's source: which store, how it pages and searches, its fields and
 *  scopes. No field lists its values: the data says them.
 *  TRAP T-the-data-says-what-a-field-may-hold */
export interface SourceDefinition {
  /** The name the app registered its store under. */
  store: string;
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

/** Build a page's source from its definition, over the app's store — into the
 *  Context's Query when given one. */
export async function openSource(def: SourceDefinition, store: Store, options: { query?: QueryContext } = {}): Promise<DataSource> {
  const source = new DataSource({
    store,
    // The Context's Query, when the page shares one. 366 step 24
    ...(options.query ? { query: options.query } : {}),
    ...(def.pageSize ? { pageSize: def.pageSize } : {}),
    ...(def.applyOn ? { applyOn: def.applyOn } : {}),
    ...(def.debounce != null ? { debounce: def.debounce } : {}),
    ...(def.holdRows != null ? { holdRows: def.holdRows } : {}),
    ...(def.search ? { searchFields: [...def.search] } : {}),
  });
  const fields = Object.keys(def.fields ?? {});
  const children = checkTiers(def);
  for (const [field, facts] of Object.entries(def.fields ?? {})) source.declareField(field, facts);
  await source.declareFromRows(fields);
  // A tiered field's children, once its parents are known. TODO 369
  for (const [field, facts] of Object.entries(def.fields ?? {})) {
    if (facts.child && children.has(facts.child)) await source.declareChildren(field);
  }
  for (const [scope, facts] of Object.entries(def.scopes ?? {})) {
    if (facts.label || facts.arranges != null) {
      source.query.declareScope(scope, {
        ...(facts.label ? { label: facts.label } : {}), ...(facts.arranges != null ? { arranges: facts.arranges } : {}),
      });
    }
    // A child is never offered on its own: its picks are its parent's. TODO 369
    if (facts.offers) source.query.offer(scope, facts.offers === 'all' ? fields.filter((f) => !children.has(f)) : facts.offers);
    if (facts.holds) source.query.hold(scope, facts.holds);
    for (const set of facts.sets ?? []) {
      for (const field of set.fields) {
        if (facts.holds?.includes(field)) continue;
        report({
          code: 'set-field-not-held',
          message: `openSource: the set "${set.id}" names "${field}", which scope "${scope}" does not hold.`,
          at: { scope, set: set.id, field },
        });
      }
    }
    if (facts.sets?.length) source.query.declareSets(scope, facts.sets);
  }
  return source;
}

/** A page's own saved filters, each checked: one that is not a name and a
 *  query definition is reported and left out. Will, 366 */
export function savedFiltersOf(page: PageDefinition): Record<string, SavedFilter> {
  return Object.fromEntries(Object.entries(page.savedFilters ?? {}).filter(([id, set]) => {
    if (isSavedFilter(set)) return true;
    report({
      code: 'saved-filter-invalid',
      message: `page "${page.id}": the saved filter "${id}" is not { label, query: { v: 1, scopes } }, so it is left out.`,
      at: { page: page.id, savedFilter: id },
    });
    return false;
  }));
}

/**
 * A page's child fields — each named by a parent's `child` — reported where one
 * cannot be: not declared, under a number or a date, or held, offered or set by
 * a scope, since a child's picks live in its parent's reading. TODO 369
 */
export function checkTiers(def: SourceDefinition): Set<string> {
  const fields = def.fields ?? {};
  const children = new Set<string>();
  for (const [field, facts] of Object.entries(fields)) {
    const child = facts.child;
    if (!child) continue;
    if (!(child in fields)) {
      report({
        code: 'child-not-declared',
        message: `openSource: "${field}" names the child "${child}", which source.fields does not declare.`,
        at: { field, child },
      });
    } else if (facts.type === 'number' || facts.type === 'date') {
      report({
        code: 'child-under-a-typed-field',
        message: `openSource: "${field}" is a ${facts.type}, so it holds no child values; "${child}" is not its child.`,
        at: { field, child },
      });
    } else children.add(child);
  }
  for (const [scope, facts] of Object.entries(def.scopes ?? {})) {
    const named = [...(facts.holds ?? []), ...(Array.isArray(facts.offers) ? facts.offers : []),
      ...(facts.sets ?? []).flatMap((set) => set.fields)];
    for (const field of new Set(named)) {
      if (!children.has(field)) continue;
      report({
        code: 'child-field-named',
        message: `openSource: scope "${scope}" names "${field}", a child field: its picks are in its parent's filter.`,
        at: { scope, field },
      });
    }
  }
  return children;
}
