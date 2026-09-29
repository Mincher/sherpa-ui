/**
 * page-definition.ts — a page's data, set up from ONE JSON document: its
 * store, its fields, its scopes and its saved filters. docs/PAGE-DEFINITION.md
 * TRAP T-a-page-is-its-definition
 *
 * Map:
 * - ScopeDefinition — One scope: its name, the fields it offers and holds at the start, and the saved filters it shows.
 * - SourceDefinition — A page's source: which store, how it pages and searches, its fields, scopes and saved filters.
 * - PageDefinition — One page, as JSON — its template, its source, its Views.
 * - openSource — Build a page's source from its definition, over the app's store.
 */
import { DataSource, type FieldDeclaration } from './data-source.js';
import type { FieldReading } from './filter-state.js';
import type { Store } from './store.js';

/** One scope: its name, the fields it offers and holds at the start, and the
 *  saved filters it shows. */
export interface ScopeDefinition {
  label?: string;
  /** Every field it may add — `'all'`, every field the page declares. */
  offers?: readonly string[] | 'all';
  holds?: readonly string[];
  /** The saved filters its bar shows, each off. */
  presets?: readonly string[];
}

/** A page's source: which store, how it pages and searches, its fields, scopes
 *  and saved filters. No field lists its values: the data says them.
 *  TRAP T-the-data-says-what-a-field-may-hold */
export interface SourceDefinition {
  /** The name the app registered its store under. */
  store: string;
  pageSize?: number;
  search?: readonly string[];
  fields?: Readonly<Record<string, FieldDeclaration>>;
  scopes?: Readonly<Record<string, ScopeDefinition>>;
  presets?: Readonly<Record<string, {
    label?: string; editable?: boolean; readings: Readonly<Record<string, FieldReading>>;
  }>>;
}

/** One page, as JSON — its template, its source, its Views. */
export interface PageDefinition {
  v: 1;
  id: string;
  template?: string;
  source?: SourceDefinition;
  /** The name of its View library. */
  views?: string;
}

/** Build a page's source from its definition, over the app's store. */
export async function openSource(def: SourceDefinition, store: Store): Promise<DataSource> {
  const source = new DataSource({
    store,
    ...(def.pageSize ? { pageSize: def.pageSize } : {}),
    ...(def.search ? { searchFields: [...def.search] } : {}),
  });
  const fields = Object.keys(def.fields ?? {});
  for (const [field, facts] of Object.entries(def.fields ?? {})) source.declareField(field, facts);
  await source.declareFromRows(fields);
  for (const [id, preset] of Object.entries(def.presets ?? {})) {
    source.declarePreset(id, preset.readings, {
      ...(preset.label ? { label: preset.label } : {}), editable: !!preset.editable,
    });
  }
  for (const [scope, facts] of Object.entries(def.scopes ?? {})) {
    if (facts.label) source.declareScope(scope, { label: facts.label });
    if (facts.offers) source.offer(scope, facts.offers === 'all' ? fields : facts.offers);
    if (facts.holds) source.hold(scope, facts.holds);
    if (facts.presets?.length) source.answer(scope, {}, Object.fromEntries(facts.presets.map((id) => [id, false])));
  }
  return source;
}
