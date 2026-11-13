/**
 * describe.js — data, said in sherpa-ui's terms: rows, a JSON Schema or a page's
 * own fields → a TYPE (type.v1), which the data layer makes the store's rules, a
 * page's fields and a grid's columns from (plan 960 U2); and the need a pattern
 * is picked by.
 *
 * Map:
 * - labelOf — a field's name as a reader reads it: `openTickets` → "Open tickets"
 * - fromRows — rows → each field as its type says it, and the evidence
 * - fromSchema — a JSON Schema or an OpenAPI document → the same, and what it says that nothing carries
 * - CONTROLS — the keys of a page's field that say what its control does: a page keeps them, a type never
 * - splitFields — a page's own fields → each field as its type says it, and the controls its page keeps
 * - typeOf — fields as fromRows says them, and the status fields → a type (type.v1)
 * - fromType — a type, and a page's own fields over it → each field as fromRows says one
 * - typeProblems — what is wrong with a type an agent gives: its schema's words, then the data layer's
 * - typedStore — rows as a store made from their type: its key, time, rules, words and status fields
 * - statusProblems — the status fields an agent gives, against what statusFields() takes: each problem, none when sound
 * - fieldKinds — the fields of each kind a pattern's `each` stands for, each with its label
 * - needOf — the need a pattern is picked by: what the data says, and the task and writes as the agent says them
 */
import { schemaCheck } from './check.js';

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const absent = (v) => v === undefined || v === null || v === '';
/** An ISO day, with a time of day or not: what a date field holds. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}(?<time>[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
/** A field's name as a reader reads it: `openTickets` → "Open tickets". */
export const labelOf = (field) => {
  const words = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Rows → each field as its type says it (type.v1's field), and the evidence.
 * Nothing is drawn from a field's NAME, and nothing a sample cannot show is
 * proposed: no `required` but the key's, no `min`, `max` or `values`.
 */
export function fromRows(dl, rows, key = 'id') {
  const passes = (rule, values) => values.every((v) => rule(v) === undefined);
  const names = [...new Set(rows.flatMap((r) => (isObject(r) ? Object.keys(r) : [])))];
  return names.map((name) => {
    const values = rows.map((r) => r?.[name]);
    const present = values.filter((v) => !absent(v));
    const field = { label: labelOf(name) };
    const out = { name, field, why: [], left: null };
    if (name === key) {
      out.why.push('the key: how byKey, update and remove find a row, so required');
      if (present.length < rows.length) out.why.push(`${rows.length - present.length} row(s) have none`);
      out.left = 'the key';
    }
    if (!present.length) {
      out.left ??= 'every value is empty';
      return out;
    }
    const kinds = [...new Set(present.map((v) => (Array.isArray(v) ? 'array' : typeof v)))];
    if (kinds.length > 1) out.why.push(`its values are of ${kinds.length} kinds: ${kinds.join(', ')}`);
    if (kinds.includes('array') || kinds.includes('object')) {
      out.left = kinds.includes('array') ? 'a list: a filter compares one value, never one of a list\'s' : `an object: a page reaches a part of it by a dotted path, ${name}.part`;
      out.nested = true;
      out.field = null;
      return out;
    }
    if (kinds.length === 1 && kinds[0] === 'number' && passes(dl.number(), present)) {
      field.type = 'number';
      const [low, high] = present.reduce(([lo, hi], v) => [Math.min(lo, v), Math.max(hi, v)], [Infinity, -Infinity]);
      out.why.push(`every value is a number, from ${low} to ${high}: no min or max, as a sample cannot bound its store`);
    } else if (kinds.length === 1 && kinds[0] === 'boolean') {
      field.type = 'boolean';
      out.why.push('every value is true or false');
    } else if (kinds.length === 1 && kinds[0] === 'string' && present.every((v) => ISO_DAY.test(v))) {
      const timed = present.some((v) => ISO_DAY.exec(v).groups.time);
      field.type = 'date';
      if (timed) field.time = true;
      out.why.push(`every value is an ISO day${timed ? ', some with a time of day' : ''}`);
    } else {
      if (kinds.length === 1 && kinds[0] === 'string') {
        if (passes(dl.email(), present)) {
          field.format = 'email';
          out.why.push('every value passes email()');
        } else if (present.every((v) => /^https?:\/\//i.test(v)) && passes(dl.url(), present)) {
          field.format = 'url';
          out.why.push('every value is an http(s) URL that url() accepts');
        }
      }
      const distinct = new Set(present.map((v) => dl.valueKey(v))).size;
      if (distinct === present.length && present.length > 1 && kinds[0] === 'string') {
        out.left ??= 'every value differs: a field to search (source.search), not a list to filter by';
        out.search = name !== key;
      } else out.why.push(`${distinct} distinct value(s) in ${present.length}: a list to filter by, its values not closed, as a sample cannot close a set`);
    }
    return out;
  });
}

/** An internal `$ref`'s target, or null. */
function resolveRef(doc, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  let node = doc;
  for (const raw of ref.slice(2).split('/')) node = isObject(node) ? node[raw.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined;
  return node ?? null;
}

/** The ROW's schema: a bare object, an array's `items`, or an OpenAPI path's 200 answer; and where it was found. */
function rowSchema(doc, pathHint) {
  const follow = (s, via) => (s?.$ref ? { schema: resolveRef(doc, s.$ref), via: `${via} → ${s.$ref}` } : { schema: s, via });
  const items = ({ schema, via }) => (schema?.type === 'array' && schema.items ? follow(schema.items, `${via} → items`) : { schema, via });
  if (isObject(doc?.paths)) {
    const paths = Object.keys(doc.paths);
    const chosen = pathHint && paths.includes(pathHint) ? pathHint : paths[0];
    const content = doc.paths[chosen]?.get?.responses?.['200']?.content;
    const media = content && (content['application/json'] ?? Object.values(content)[0]);
    if (!media?.schema) return { schema: null, via: `GET ${chosen ?? '(no path)'} has no 200 JSON answer`, paths };
    return { ...items(follow(media.schema, `GET ${chosen} → 200`)), paths };
  }
  return { ...items(follow(doc, 'the document')), paths: [] };
}

/**
 * A JSON Schema or an OpenAPI document → each field as its type says it, the
 * evidence, and what the schema says that no type field carries. What a spec
 * PROMISES may be said, as a sample's evidence may not.
 */
export function fromSchema(doc, { path: pathHint, key = 'id' } = {}) {
  const { schema: row, via, paths } = rowSchema(doc, pathHint);
  if (!isObject(row?.properties)) {
    const more = paths.length ? ` Its paths: ${paths.join(', ')}; name one with \`path\`.` : '';
    throw new Error(`No row schema with properties was found (${via}).${more}`);
  }
  const required = new Set(Array.isArray(row.required) ? row.required : []);
  const uncarried = [];
  const fields = Object.entries(row.properties).map(([name, given]) => {
    const out = { name, field: null, why: [], left: null };
    const s = given?.$ref ? resolveRef(doc, given.$ref) : given;
    if (!isObject(s)) {
      uncarried.push(`${name}: ${given?.$ref ? `${given.$ref} is not in this document` : 'not a schema'}`);
      return out;
    }
    const field = { label: typeof s.title === 'string' ? s.title : labelOf(name) };
    if (typeof s.description === 'string') field.description = s.description;
    out.field = field;
    if (required.has(name) && name !== key) {
      field.required = true;
      out.why.push('the schema requires it');
    }
    for (const kw of ['allOf', 'anyOf', 'oneOf', 'not']) if (s[kw]) uncarried.push(`${name}: ${kw} is said by no type field`);
    const types = [s.type].flat().filter(Boolean);
    if (types.includes('null')) out.why.push('it may be null: every rule but required passes an empty value');
    const type = types.find((t) => t !== 'null');
    if (type === 'number' || type === 'integer') {
      field.type = 'number';
      if (typeof s.minimum === 'number') field.min = s.minimum;
      if (typeof s.maximum === 'number') field.max = s.maximum;
      out.why.push(`type: ${type}${typeof s.minimum === 'number' ? `, minimum ${s.minimum}` : ''}${typeof s.maximum === 'number' ? `, maximum ${s.maximum}` : ''}`);
      for (const kw of ['exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']) if (s[kw] !== undefined) uncarried.push(`${name}: ${kw} is said by no type field (min and max hold their ends)`);
    } else if (type === 'boolean') {
      field.type = 'boolean';
      out.why.push('type: boolean');
    } else if (type === 'object' || type === 'array') {
      out.left = type === 'array' ? 'a list: a filter compares one value, never one of a list\'s' : `an object: a page reaches a part of it by a dotted path, ${name}.part`;
      out.nested = true;
      out.field = null;
      uncarried.push(`${name}: ${type === 'array' ? 'a type field holds one value, not a list' : 'its own properties are no fields here'}`);
    } else {
      const format = s.format;
      if (format === 'date' || format === 'date-time') {
        field.type = 'date';
        if (format === 'date-time') field.time = true;
        out.why.push(`format: ${format}`);
      } else if (format === 'email' || format === 'uri' || format === 'url') {
        field.format = format === 'email' ? 'email' : 'url';
        out.why.push(`format: ${format}`);
      } else if (format) uncarried.push(`${name}: format ${format} is said by no type field`);
      if (field.type !== 'date') {
        if (typeof s.pattern === 'string') field.pattern = s.pattern;
        if (typeof s.minLength === 'number') field.min = s.minLength;
        if (typeof s.maxLength === 'number') field.max = s.maxLength;
        if (s.minLength !== undefined || s.maxLength !== undefined) out.why.push('minLength and maxLength are min and max: on text they count its characters');
      }
    }
    if (Array.isArray(s.enum) && s.enum.length && out.field) {
      field.values = s.enum;
      out.why.push(`enum of ${s.enum.length}: the schema closes the set`);
    }
    if (s.default !== undefined) uncarried.push(`${name}: default is said by no type field: a store does not fill one in`);
    if (name === key) {
      out.left = 'the key';
      out.why.push(required.has(name) ? 'the key, so required' : 'the key, which the schema does not require: a type\'s key is');
    }
    return out;
  });
  if (!(key in row.properties)) uncarried.push(`the key, "${key}", is no property: name the row's key with \`key\``);
  return { fields, via, uncarried };
}

/** The keys of a page's field that say what its control does: a page keeps them, a type never. */
export const CONTROLS = ['select', 'advanced', 'op', 'range', 'step', 'icon', 'section', 'carryOver', 'child', 'fetch', 'start'];

/** A page's own fields (its definition's `source.fields`) → each field as its type says it, and the controls its page keeps. */
export function splitFields(declared) {
  const page = {};
  const fields = Object.entries(declared).map(([name, decl]) => {
    const field = { label: decl.label ?? labelOf(name) };
    for (const k of ['description', 'labels', 'statuses', 'time', 'min', 'max']) if (decl[k] !== undefined) field[k] = decl[k];
    if (decl.type === 'number' || decl.type === 'date') field.type = decl.type;
    const own = Object.fromEntries(CONTROLS.filter((k) => decl[k] !== undefined).map((k) => [k, decl[k]]));
    if (Object.keys(own).length) page[name] = own;
    return { name, field, ...(own.child ? { page: own } : {}), why: ['the page declares it'], left: null };
  });
  return { fields, page };
}

/** Fields as fromRows says them, and the status fields → a type (type.v1): its id, name and key, each field in order. */
export function typeOf(fields, { id = 'record', label, key = 'id', status } = {}) {
  const out = Object.fromEntries(fields.filter((f) => f.field).map((f) => [f.name, f.field]));
  for (const [name, def] of Object.entries(status ?? {})) out[name] = def;
  return { $schema: 'https://sherpa-ui.dev/schemas/type.v1.json', v: 1, id, label: label ?? labelOf(id), ...(key !== 'id' ? { key } : {}), fields: out };
}

/** A type, and a page's own fields over it → each field as fromRows says one: for a pattern's kinds and need. */
export function fromType(type, own = {}) {
  const key = type.key ?? 'id';
  return Object.entries(type.fields).map(([name, field]) => ({
    name, field, ...(own[name] ? { page: own[name] } : {}), why: ['the type says it'], left: name === key ? 'the key' : null,
  }));
}

/** What is wrong with a type an agent gives: its schema's words, then the data layer's (typeFaults); none when sound. */
export function typeProblems(dl, type) {
  const shape = schemaCheck('type.v1.json')(type);
  return shape.length ? shape.map((e) => `type${e}`) : dl.typeFaults(type);
}

/** Rows as a store made from their type — its key, time, rules, words and status fields, as an app makes it; no type, the rows alone. */
export function typedStore(dl, rows, { key, type } = {}) {
  if (!type) return new dl.ArrayStore(rows, key ? { key } : {});
  const store = new dl.ArrayStore(rows, dl.typeStoreOptions(type));
  const status = dl.typeStatusFields(type);
  return Object.keys(status).length ? dl.statusFields(store, status) : store;
}

/** The status fields an agent gives, against what statusFields() takes (defs.v1.json statusField): each problem, none when sound. */
export function statusProblems(status) {
  if (!isObject(status)) return ['`status` is an object of field → its status field'];
  return Object.entries(status).flatMap(([f, d]) => schemaCheck('defs.v1.json#/$defs/statusField')(d).map((e) => `status.${f}${e}`));
}

/**
 * The fields of each kind a pattern's `each` stands for (pattern.v1.json), each
 * `{ name, label }`: `field` is every field a reader may write — not the key, a
 * list or an object, which no one input holds, nor a status, which its store
 * works out; `statusField` each status field; `childField` each field another
 * names as its `child`.
 */
export function fieldKinds(fields, { key = 'id' } = {}) {
  const one = (f) => ({ name: f.name, label: f.field?.label ?? labelOf(f.name) });
  // Never the key: a sum of ids is no metric.
  const typed = (t) => fields.filter((f) => f.name !== key && f.left !== 'the key' && f.field?.type === t).map(one);
  const children = new Set(fields.map((f) => f.page?.child).filter(Boolean));
  return {
    field: fields.filter((f) => f.name !== key && f.field && f.field.type !== 'status' && !f.field.from).map(one),
    dateField: typed('date'),
    numberField: typed('number'),
    statusField: typed('status'),
    childField: fields.filter((f) => children.has(f.name)).map(one),
  };
}

/**
 * The need a pattern is picked by (pattern.v1.json `need`): what the data says,
 * and the task and writes as the agent says them. A status field is its type's,
 * so it is counted only when the type is known (`status`); a child is its page's,
 * so only when the page's fields are (`declared`). A sample shows neither: left
 * out, each is unknown, not none.
 */
export function needOf(fields, { rows, task, writes, status = false, declared = false } = {}) {
  const typed = (t) => fields.filter((f) => f.left !== 'the key' && f.field?.type === t).length;
  return {
    ...(task ? { task } : {}),
    ...(rows != null ? { rows } : {}),
    fields: fields.length,
    dateFields: typed('date'),
    numberFields: typed('number'),
    ...(status ? { statusFields: typed('status') } : {}),
    ...(declared ? { childFields: fieldKinds(fields).childField.length } : {}),
    ...(writes != null ? { writes } : {}),
  };
}
