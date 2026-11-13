/**
 * type-definition.ts — a TYPE, said once in JSON (type.v1): a kind of thing, its key, its time, its fields and, for a
 * graph thing, its graph part. The store's rules, what a page knows of each field and a grid's columns are made from
 * its fields, so a page's own fields say only what its controls do. Its check is `typeFaults` (type-faults.ts), light, so the type registry carries
 * it. DOM-free. Will, plan 960 U2 · TRAP T-a-field-is-declared-once
 *
 * Map:
 * - StoredField — A field a row holds, or reads from its graph: what its data is, never how a control asks for it.
 * - TypeField — One field of a type: stored, or a status worked out from the row's other fields.
 * - TypeGraph — A graph thing's graph part: its sockets, the families its graph may place, whether it runs.
 * - TypeDefinition — A type, as type.v1 says it.
 * - typeSchema — The store's schema made from a type: each stored field's rules, and what each field is.
 * - typeStatusFields — A type's status fields, as statusFields() takes them.
 * - typeFields — Each field as a type and a page say it together, for a reader with no source open.
 * - pageFields — A page's fields as its type (`source.type`, from the type registry) and the page say them together.
 * - typeStoreOptions — What a store made from a type is given: its key, its time and its schema.
 * - TypeColumn — One grid column made from a field.
 * - typeColumns — A grid's columns made from a type: one per field but its key, in its order; each headed by its label.
 * - readFrom — A value read from an entity's graph, by a field's `from`.
 * - titleOf — The field that names a row as a reader reads it: its type's `title`, else label, else name, else its key.
 */
import type { StoreOptions } from './base-store.js';
import type { FieldDeclaration } from './data-source-types.js';
import { entityTypes } from './entity-types.js';
import type { NodeOutput, NodeSocket } from './node-library.js';
import type { StatusField } from './status-field.js';
import { email, max, min, number, oneOf, pattern, required, rules, url, type FieldDomain, type Rule } from './validate.js';

/** A field a row holds, or reads from its graph: what its data is, never how a control asks for it. */
export interface StoredField {
  /** None: text. */
  type?: 'text' | 'number' | 'date' | 'boolean';
  label?: string;
  description?: string;
  required?: boolean;
  /** The values it may hold, in order. None: any. */
  values?: readonly (string | number | boolean)[];
  /** A value's name as a reader reads it, where it is not the value. */
  labels?: Readonly<Record<string, string>>;
  /** Each value's look, a Style mode. */
  statuses?: Readonly<Record<string, string>>;
  /** A number's ends, or a text's fewest and most characters. */
  min?: number;
  max?: number;
  format?: 'email' | 'url';
  pattern?: string;
  /** A date that holds a time of day. */
  time?: boolean;
  /** Read from its entity's graph, never kept beside it: `<node id>/<path in its values>`. */
  from?: string;
  /** A row of another type, by its id: the value is that row's key, its choices that type's rows (plan 964). */
  ref?: string;
  /** With `ref`: a list of that type's keys. */
  many?: boolean;
}

/** One field of a type: stored, or a status worked out from the row's other fields. */
export type TypeField = StoredField | StatusField;

/** A graph thing's graph part: its sockets, the families its graph may place, whether it runs. Plan 942 D2 A */
export interface TypeGraph {
  /** The families (a kind's category) its graph may place; none, any. A use of an entity is always allowed. */
  families?: readonly string[];
  /** The sockets every entity of it has: `#in` and `#out`. A `node` has none here: its settings say them. */
  inputs?: readonly NodeSocket[];
  outputs?: readonly NodeOutput[];
  /** It needs the runner to be of use; none, false: only defined. */
  runs?: boolean;
  /** Its entities are Custom Nodes a graph may place; none, true. False (a Coworker): the Nodes panel leaves them out. */
  reusable?: boolean;
  /** Its entity may keep a `query` body (a Filter's Where) in place of its graph, drawn by its lens; none, false. Plan 960 U4.4b */
  query?: boolean;
}

/** A type, as type.v1 says it: its fields, its graph part, or both. */
export interface TypeDefinition {
  $schema?: string;
  v: 1;
  id: string;
  label: string;
  description?: string;
  tags?: readonly string[];
  icon?: string;
  category?: string;
  /** None: `id`. */
  key?: string;
  time?: string;
  /** The field that names a row as a reader reads it (`titleOf`). */
  title?: string;
  /** None for a graph thing whose rows are its entities' id, label, description and tags alone. */
  fields?: Readonly<Record<string, TypeField>>;
  /** Its seed rows: a JSON file or a URL. */
  data?: string;
  graph?: TypeGraph;
}

const isStatus = (f: TypeField): f is StatusField => f.type === 'status';
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A stored field's rules, in the order they run: a key is required. A field read from its graph is never written, so has none. */
function rulesFor(field: StoredField, isKey: boolean): Rule[] {
  const list: Rule[] = [];
  if (field.required || isKey) list.push(required());
  if (field.type === 'number') list.push(number());
  if (field.format === 'email') list.push(email());
  if (field.format === 'url') list.push(url());
  if (field.pattern) list.push(pattern(new RegExp(field.pattern)));
  if (field.min !== undefined) list.push(min(field.min));
  if (field.max !== undefined) list.push(max(field.max));
  if (field.values) list.push(oneOf(field.values));
  else if (field.type === 'boolean') list.push(oneOf([true, false]));
  return list;
}

/** What a page knows of a stored field beside what its rules say: its kind, its name and its values' names and looks. */
function wordsOf(field: StoredField): FieldDomain {
  const { type, label, description, labels, statuses, time } = field;
  return {
    ...(type === 'number' || type === 'date' ? { type } : {}),
    ...(label ? { label } : {}), ...(description ? { description } : {}),
    ...(labels ? { labels: { ...labels } } : {}), ...(statuses ? { statuses: { ...statuses } } : {}),
    ...(time ? { time } : {}),
  };
}

/**
 * The store's schema made from a type: each stored field's rules, and its `domains` — what each field is — which a
 * DataSource declares before a page's own fields. A status field is the statusFields() wrapper's (`typeStatusFields`).
 */
export function typeSchema(type: Pick<TypeDefinition, 'key' | 'fields'>): ReturnType<typeof rules> {
  const key = type.key ?? 'id';
  const map: Record<string, Rule[]> = {};
  const stored = Object.entries(type.fields ?? {}).filter((e): e is [string, StoredField] => !isStatus(e[1]));
  for (const [name, field] of stored) {
    const list = field.from ? [] : rulesFor(field, name === key);
    if (list.length) map[name] = list;
  }
  const schema = rules(map);
  const domains: Record<string, FieldDomain> = {};
  for (const [name, field] of stored) {
    const domain = { ...schema.domains[name], ...wordsOf(field), ...(field.from && field.values ? { values: [...field.values] } : {}) };
    if (Object.keys(domain).length) domains[name] = domain;
  }
  return { ...schema, domains };
}

/** A type's status fields, as statusFields() takes them. */
export function typeStatusFields(type: TypeDefinition): Record<string, StatusField> {
  return Object.fromEntries(Object.entries(type.fields ?? {}).filter((e): e is [string, StatusField] => isStatus(e[1])));
}

/**
 * Each field as a type and a page say it together — the type's words and domain, the page's own over them, as a
 * source declares them — for a reader with no source open (a graph's Field row, a prompt's reference). The type's
 * order, then the page's own.
 */
export function typeFields(
  type: Pick<TypeDefinition, 'key' | 'fields'>, own: Readonly<Record<string, FieldDeclaration>> = {},
): Record<string, FieldDeclaration & { values?: unknown[] }> {
  const domains = typeSchema(type).domains;
  const out: Record<string, FieldDeclaration & { values?: unknown[] }> = {};
  for (const [name, field] of Object.entries(type.fields ?? {})) {
    const words: FieldDomain = !isStatus(field) ? domains[name] ?? {} : {
      ...(field.label ? { label: field.label } : {}), ...(field.description ? { description: field.description } : {}),
      values: field.values.map((v) => v.value),
      statuses: Object.fromEntries(field.values.flatMap((v) => (v.status ? [[v.value, v.status]] : []))),
    };
    out[name] = { ...words, ...own[name] };
  }
  for (const [name, facts] of Object.entries(own)) out[name] ??= { ...facts };
  return out;
}

/**
 * A page's fields as its type and the page say them together (typeFields): its type is the one its `source.type` names,
 * from the type registry (app.json `types`, or registerEntityType). A page that names none, or one the app has not, is
 * its own fields alone. For a reader of a page's JSON with no source open: a source's own `filterDef` says the same.
 */
export function pageFields(
  source: { readonly type?: string | undefined; readonly fields?: Readonly<Record<string, FieldDeclaration>> | undefined } | undefined,
  types: Readonly<Record<string, Pick<TypeDefinition, 'key' | 'fields'>>> = entityTypes(),
): Record<string, FieldDeclaration & { values?: unknown[] }> {
  const type = source?.type ? types[source.type] : undefined;
  return type ? typeFields(type, source?.fields) : { ...source?.fields };
}

/** What a store made from a type is given: its key, its time and its schema. */
export function typeStoreOptions(type: TypeDefinition): StoreOptions & { key: string; schema: ReturnType<typeof rules> } {
  return { key: type.key ?? 'id', ...(type.time ? { time: type.time } : {}), schema: typeSchema(type) };
}

/** One grid column made from a field: no `header`, as the grid heads it with its source's label. */
export interface TypeColumn {
  field: string;
  sortable: true;
  type?: 'number' | 'date';
}

/** A grid's columns made from a type: one per field but its key, in its order; each headed by its label, which the
 *  grid reads from its source, so no column says it again. */
export function typeColumns(type: TypeDefinition): TypeColumn[] {
  const key = type.key ?? 'id';
  return Object.entries(type.fields ?? {}).filter(([name]) => name !== key).map(([field, f]) => ({
    field, sortable: true,
    ...(f.type === 'number' || f.type === 'date' ? { type: f.type } : {}),
  }));
}

/** A value read from an entity's graph, by a field's `from`: the node of that id, then the path in its values. */
export function readFrom(
  graph: { readonly nodes?: readonly { readonly id: string; readonly values?: Readonly<Record<string, unknown>> }[] } | undefined,
  from: string,
): unknown {
  const [id, ...path] = from.split('/');
  const node = graph?.nodes?.find((n) => n.id === id);
  return path.reduce<unknown>((at, part) => (isObject(at) ? at[part] : undefined), node?.values);
}

/** The field that names a row as a reader reads it (a reference shows it): its type's `title`, else `label` (a graph
 *  thing's name), else `name`, else its key. */
export function titleOf(type: Pick<TypeDefinition, 'title' | 'fields' | 'graph' | 'key'>): string {
  const fields = type.fields ?? {};
  return type.title ?? (type.graph || 'label' in fields ? 'label' : 'name' in fields ? 'name' : type.key ?? 'id');
}
