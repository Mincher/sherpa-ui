/**
 * page-definition.ts — a page's data, set up from ONE JSON document: its
 * store, its fields, its scopes and its saved filters. docs/PAGE-DEFINITION.md
 * TRAP T-a-page-is-its-definition
 *
 * Map:
 * - ScopeDefinition — One scope: its name, the fields it offers and holds at the start, and the saved filters it shows.
 * - SourceDefinition — A page's source: which store, how it pages and searches, its fields, scopes and saved filters.
 * - PageDefinition — One page, as JSON — its source, and its components' configuration.
 * - openSource — Build a page's source from its definition, over the app's store.
 */
import { DataSource, type FieldDeclaration, type FilterSet } from './data-source.js';
import { report } from './report.js';
import type { Store } from './store.js';
import type { Where } from './where.js';

/** One scope: its name, the fields it offers and holds at the start, and the
 *  saved filters it shows. */
export interface ScopeDefinition {
  label?: string;
  /** Every field it may add — `'all'`, every field the page declares. */
  offers?: readonly string[] | 'all';
  holds?: readonly string[];
  /** The saved filters its bar shows, each off. */
  presets?: readonly string[];
  /** Fields drawn as one group; a `serial` set chains them. TRAP T-a-filter-set-groups-or-chains */
  sets?: readonly FilterSet[];
  /** Group and Sort arrange its rows: its Organise chips. Left out, a scope
   *  over a grid or a list does, and the View does not. Will, TODO 99 */
  arranges?: boolean;
}

/** A page's source: which store, how it pages and searches, its fields, scopes
 *  and saved filters. No field lists its values: the data says them.
 *  TRAP T-the-data-says-what-a-field-may-hold */
export interface SourceDefinition {
  /** The name the app registered its store under. */
  store: string;
  pageSize?: number;
  /** `input`: its filters apply live, debounced. Will, TODO 107 */
  applyOn?: 'change' | 'input';
  debounce?: number;
  search?: readonly string[];
  fields?: Readonly<Record<string, FieldDeclaration>>;
  scopes?: Readonly<Record<string, ScopeDefinition>>;
  /** Saved filters, each a whole clause flipped on or off — `where` in the
   *  plain form. TRAP T-a-toggle-is-a-clause-not-a-value · TRAP T-one-way-to-write-a-condition */
  presets?: Readonly<Record<string, { label?: string; where: Where }>>;
}

/** One page, as JSON — its source, and its components' configuration. Its
 *  markup is its Context's, in the app definition. */
export interface PageDefinition {
  v: 1;
  id: string;
  source?: SourceDefinition;
  /** Each component's CONFIGURATION, by id — set before it is answered.
   *  TRAP T-configuration-is-not-data */
  ui?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/** Build a page's source from its definition, over the app's store. */
export async function openSource(def: SourceDefinition, store: Store): Promise<DataSource> {
  const source = new DataSource({
    store,
    ...(def.pageSize ? { pageSize: def.pageSize } : {}),
    ...(def.applyOn ? { applyOn: def.applyOn } : {}),
    ...(def.debounce != null ? { debounce: def.debounce } : {}),
    ...(def.search ? { searchFields: [...def.search] } : {}),
  });
  const fields = Object.keys(def.fields ?? {});
  for (const [field, facts] of Object.entries(def.fields ?? {})) source.declareField(field, facts);
  await source.declareFromRows(fields);
  for (const [id, preset] of Object.entries(def.presets ?? {})) {
    if (!preset.where) {
      report({
        code: 'preset-without-where',
        message: `openSource: the saved filter "${id}" has no where, so it is left out. Write where: { field: { gt: 0 } }.`,
        at: { preset: id },
      });
      continue;
    }
    source.declarePreset(id, source.readingsOf(preset.where), preset.label ? { label: preset.label } : {});
  }
  for (const [scope, facts] of Object.entries(def.scopes ?? {})) {
    if (facts.label || facts.arranges != null) {
      source.declareScope(scope, {
        ...(facts.label ? { label: facts.label } : {}), ...(facts.arranges != null ? { arranges: facts.arranges } : {}),
      });
    }
    if (facts.offers) source.offer(scope, facts.offers === 'all' ? fields : facts.offers);
    if (facts.holds) source.hold(scope, facts.holds);
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
    if (facts.sets?.length) source.declareSets(scope, facts.sets);
    if (facts.presets?.length) source.answer(scope, {}, Object.fromEntries(facts.presets.map((id) => [id, false])));
  }
  return source;
}
