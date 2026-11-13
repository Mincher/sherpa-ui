/**
 * type-definition.ts — a TYPE, said once in JSON (type.v1): a kind of thing, its key, its time and its fields. The
 * store's rules, what a page knows of each field and a grid's columns are made from its fields, so a page's own
 * fields say only what its controls do. The data layer has no schema validator, so `typeFaults` is hand-written; the
 * tests hold it and type.v1.json together. DOM-free. Will, plan 960 U2 · TRAP T-a-field-is-declared-once
 *
 * Map:
 * - StoredField — A field a row holds, or reads from its graph: what its data is, never how a control asks for it.
 * - TypeField — One field of a type: stored, or a status worked out from the row's other fields.
 * - TypeDefinition — A type, as type.v1 says it.
 * - typeFaults — What is wrong with a type, in words; none when it is sound.
 * - typeSchema — The store's schema made from a type: each stored field's rules, and what each field is.
 * - typeStatusFields — A type's status fields, as statusFields() takes them.
 * - typeStoreOptions — What a store made from a type is given: its key, its time and its schema.
 * - TypeColumn — One grid column made from a field.
 * - typeColumns — A grid's columns made from a type: one per field but its key, in its order.
 * - readFrom — A value read from an entity's graph, by a field's `from`.
 */
import type { StoreOptions } from './base-store.js';
import type { StatusField } from './status-field.js';
import { email, max, min, number, oneOf, pattern, required, rules, url, type FieldDomain, type Rule } from './validate.js';
import { parseWhere, type Where } from './where.js';

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
}

/** One field of a type: stored, or a status worked out from the row's other fields. */
export type TypeField = StoredField | StatusField;

/** A type, as type.v1 says it. */
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
  fields: Readonly<Record<string, TypeField>>;
  /** Its seed rows: a JSON file or a URL. */
  data?: string;
}

const ID = /^[a-z][a-z0-9-]*$/;
const TOP = ['$schema', 'v', 'id', 'label', 'description', 'tags', 'icon', 'category', 'key', 'time', 'fields', 'data', 'graph'];
const STORED = ['type', 'label', 'description', 'required', 'values', 'labels', 'statuses', 'min', 'max', 'format', 'pattern', 'time', 'from'];
const STATUS = ['type', 'label', 'description', 'values'];
const KINDS = ['text', 'number', 'date', 'boolean'];
const PATH = /^[^/]+(\/[^/]+)*$/;

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isStatus = (f: TypeField): f is StatusField => f.type === 'status';
const extra = (o: Loose, keep: readonly string[], what: string): string[] =>
  Object.keys(o).filter((k) => !keep.includes(k)).map((k) => `it has "${k}", which ${what} does not keep`);

/** A value's kind, as a field's `type` names it. */
const kindOf = (v: unknown): string => (typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'text');

function statusFaults(f: Loose): string[] {
  const out = extra(f, STATUS, 'a status field');
  if ('label' in f && !isText(f['label'])) out.push('its label is not text');
  if (!Array.isArray(f['values']) || !f['values'].length) return [...out, 'a status field lists its values'];
  f['values'].forEach((v: unknown, i) => {
    if (!isObject(v) || !isText(v['value'])) return void out.push(`its value ${i + 1} has no name`);
    out.push(...extra(v, ['value', 'status', 'when'], `the value "${v['value']}"`));
    if ('status' in v && !isText(v['status'])) out.push(`the value "${v['value']}": its look is not text`);
    const when = v['when'];
    if (when !== undefined && (!Array.isArray(when) || when.some((w) => !isObject(w) || !parseWhere(w as Where)))) {
      out.push(`the value "${v['value']}": its when is not a list of conditions, as { "score": { "lt": 60 } }`);
    }
  });
  return out;
}

function storedFaults(f: Loose): string[] {
  const out = extra(f, STORED, 'a field');
  const kind = f['type'] ?? 'text';
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return [...out, `its type, ${JSON.stringify(kind)}, is none of ${KINDS.join(', ')}, status`];
  for (const k of ['label', 'description', 'pattern']) if (k in f && !isText(f[k])) out.push(`its ${k} is not text`);
  for (const k of ['required', 'time']) if (k in f && typeof f[k] !== 'boolean') out.push(`its ${k} is not true or false`);
  if (f['time'] && kind !== 'date') out.push('only a date holds a time of day');
  for (const k of ['min', 'max']) {
    if (!(k in f)) continue;
    if (typeof f[k] !== 'number') out.push(`its ${k} is not a number`);
    else if (kind !== 'number' && kind !== 'text') out.push(`a ${kind} has no ${k}`);
  }
  if (typeof f['min'] === 'number' && typeof f['max'] === 'number' && f['min'] > f['max']) out.push('its min is more than its max');
  if ('format' in f && f['format'] !== 'email' && f['format'] !== 'url') out.push('its format is email or url');
  if (('format' in f || 'pattern' in f) && kind !== 'text') out.push(`a ${kind} has no format or pattern`);
  if (isText(f['pattern'])) {
    try {
      new RegExp(f['pattern']);
    } catch {
      out.push('its pattern is no regular expression');
    }
  }
  const values = f['values'];
  if (values !== undefined) {
    if (!Array.isArray(values) || !values.length) out.push('its values are a list of one or more');
    else {
      const want = kind === 'date' ? 'text' : kind;
      const wrong = values.filter((v) => v === null || typeof v === 'object' || kindOf(v) !== want);
      if (wrong.length) out.push(`its values ${wrong.map((v) => JSON.stringify(v)).join(', ')} are not ${want}`);
    }
  }
  const named = Array.isArray(values) ? new Set(values.map(String)) : null;
  for (const k of ['labels', 'statuses']) {
    if (!(k in f)) continue;
    const map = f[k];
    if (!isObject(map) || Object.values(map).some((v) => !isText(v))) out.push(`its ${k} are not value → text`);
    else if (named) for (const v of Object.keys(map)) if (!named.has(v)) out.push(`its ${k} name "${v}", which is none of its values`);
  }
  if ('from' in f && (typeof f['from'] !== 'string' || !PATH.test(f['from']))) out.push('its from is a node\'s id, then a path in its values: when/every');
  return out;
}

/** What is wrong with a type, in words; none when it is sound. Its `graph`, if any, is checked by its own door. */
export function typeFaults(given: unknown): string[] {
  if (!isObject(given)) return ['a type is an object'];
  const out = extra(given, TOP, 'a type');
  if (given['v'] !== 1) out.push('its v is not 1');
  if (!isText(given['id']) || !ID.test(given['id'])) out.push('its id is not a name (lowercase letters, digits, hyphens)');
  if (!isText(given['label'])) out.push('it has no label');
  for (const k of ['description', 'icon', 'category', 'data']) if (k in given && !isText(given[k])) out.push(`its ${k} is not text`);
  if ('tags' in given && (!Array.isArray(given['tags']) || given['tags'].some((t) => !isText(t)))) out.push('its tags are not a list of words');
  const fields = given['fields'];
  if (!isObject(fields) || !Object.keys(fields).length) return [...out, 'it has no fields'];
  const key = given['key'] ?? 'id';
  const keyField = typeof key === 'string' ? fields[key] : undefined;
  if (!isObject(keyField)) out.push(`its key, ${JSON.stringify(key)}, is no field`);
  else if (keyField['type'] === 'status' || 'from' in keyField) out.push(`its key, "${key}", is a field each row holds: no status, nothing read from its graph`);
  if ('time' in given) {
    const time = typeof given['time'] === 'string' ? fields[given['time']] : undefined;
    if (!isObject(time)) out.push(`its time, ${JSON.stringify(given['time'])}, is no field`);
    else if (time['type'] !== 'date') out.push(`its time, "${given['time']}", is not a date field`);
  }
  for (const [name, f] of Object.entries(fields)) {
    const faults = !isObject(f) ? ['it is not an object'] : f['type'] === 'status' ? statusFaults(f) : storedFaults(f);
    out.push(...faults.map((w) => `${name}: ${w}`));
  }
  return out;
}

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
export function typeSchema(type: TypeDefinition): ReturnType<typeof rules> {
  const key = type.key ?? 'id';
  const map: Record<string, Rule[]> = {};
  const stored = Object.entries(type.fields).filter((e): e is [string, StoredField] => !isStatus(e[1]));
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
  return Object.fromEntries(Object.entries(type.fields).filter((e): e is [string, StatusField] => isStatus(e[1])));
}

/** What a store made from a type is given: its key, its time and its schema. */
export function typeStoreOptions(type: TypeDefinition): StoreOptions & { key: string; schema: ReturnType<typeof rules> } {
  return { key: type.key ?? 'id', ...(type.time ? { time: type.time } : {}), schema: typeSchema(type) };
}

/** One grid column made from a field. */
export interface TypeColumn {
  field: string;
  header: string;
  sortable: true;
  type?: 'number' | 'date';
}

/** A grid's columns made from a type: one per field but its key, in its order. */
export function typeColumns(type: TypeDefinition): TypeColumn[] {
  const key = type.key ?? 'id';
  return Object.entries(type.fields).filter(([name]) => name !== key).map(([field, f]) => ({
    field, header: f.label ?? field, sortable: true,
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
