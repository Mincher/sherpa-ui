/**
 * describe.js — data, said in sherpa-ui's terms: rows or a JSON Schema → the
 * store's rules, a page's `fields` and the need a pattern is picked by; and
 * rules by name made into sherpa-ui/data's own. Rules cannot cross a tool's
 * boundary as functions, so they cross by name: `{ "seats": ["number", { "min": 0 }] }`.
 *
 * Map:
 * - RULES — the rules that cross by name: sherpa-ui/data's own, less `custom`
 * - RULE_FORM — what a rule by name is, said once for an agent
 * - ruleMap — rules by name made into sherpa-ui/data's own rule functions, and each that could not be made
 * - ruleCode — rules by name as the code a store is given
 * - labelOf — a field's name as a reader reads it: `openTickets` → "Open tickets"
 * - fromRows — rows → each field's rules, its page field and the evidence for both
 * - fromSchema — a JSON Schema or an OpenAPI document → the same, and what it says that nothing carries
 * - fromFields — a page's own fields → the same: what it declares, and no rule
 * - statusProblems — the status fields an agent gives, against what statusFields() takes: each problem, none when sound
 * - withStatus — the fields, and each status field the data does not show, as a list a page filters by
 * - statusRows — rows as a store that works out status fields gives them: each with its status values
 * - fieldKinds — the fields of each kind a pattern's `each` stands for, each with its label
 * - needOf — the need a pattern is picked by: what the data says, and the task and writes as the agent says them
 */
import { schemaCheck } from './check.js';

/** The rules that cross by name, and what each takes: sherpa-ui/data's own, less `custom`, which is code. */
export const RULES = {
  required: 'an optional message', number: 'an optional message', email: 'an optional message', url: 'an optional message',
  min: 'a number: a number\'s least, or a text\'s fewest characters', max: 'a number: a number\'s most, or a text\'s most characters',
  pattern: 'a regular expression, as text', oneOf: 'a list of the values allowed',
};

/** What a rule by name is, said once for an agent. */
export const RULE_FORM = `A rule is a name, "required", or { name: argument }, {"min": 0}: ${Object.entries(RULES).map(([n, a]) => `${n} takes ${a}`).join('; ')}.`;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** One rule by name: its name and argument, or null when it is not one. */
const named = (entry) => {
  if (typeof entry === 'string') return [entry, undefined];
  return isObject(entry) && Object.keys(entry).length === 1 ? Object.entries(entry)[0] : null;
};
const ARG_OK = {
  min: (a) => typeof a === 'number', max: (a) => typeof a === 'number',
  pattern: (a) => typeof a === 'string', oneOf: (a) => Array.isArray(a),
};

/** Rules by name made into sherpa-ui/data's own rule functions — a field's list, as `rules()` takes it — and each that could not be made. */
export function ruleMap(dl, given) {
  const map = {};
  const problems = [];
  if (!isObject(given)) return { map, problems: ['the rules are not an object of field → its rules'] };
  for (const [field, list] of Object.entries(given)) {
    map[field] = [];
    for (const entry of [list].flat()) {
      const [name, arg] = named(entry) ?? [];
      if (!(name in RULES)) {
        problems.push(`${field}: ${JSON.stringify(entry)} is no rule${name === 'custom' ? ': custom() is code, which cannot cross a tool\'s boundary' : ''}`);
        continue;
      }
      const ok = ARG_OK[name] ?? ((a) => a === undefined || typeof a === 'string');
      if (!ok(arg)) {
        problems.push(`${field}: ${name} takes ${RULES[name]}, not ${JSON.stringify(arg)}`);
        continue;
      }
      try {
        map[field].push(name === 'pattern' ? dl.pattern(new RegExp(arg)) : dl[name](arg));
      } catch (error) {
        problems.push(`${field}: ${name}: ${error.message}`);
      }
    }
  }
  return { map, problems };
}

/** Rules by name as the code a store is given: its import, and `rules({ … })`. */
export function ruleCode(given) {
  const used = new Set(['rules']);
  const call = (entry) => {
    const [name, arg] = named(entry);
    used.add(name);
    if (name === 'pattern') return `pattern(/${String(arg).replace(/\//g, '\\/')}/)`;
    return `${name}(${arg === undefined ? '' : JSON.stringify(arg)})`;
  };
  const key = (f) => (/^[A-Za-z_$][\w$]*$/.test(f) ? f : JSON.stringify(f));
  const body = Object.entries(given).map(([field, list]) => `  ${key(field)}: [${[list].flat().map(call).join(', ')}],`);
  return `import { ${[...used].join(', ')} } from 'sherpa-ui/data';\n\nconst schema = rules({\n${body.join('\n')}\n});`;
}

const absent = (v) => v === undefined || v === null || v === '';
/** An ISO day, with a time of day or not: what a date field holds. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}(?<time>[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
/** A field's name as a reader reads it: `openTickets` → "Open tickets". */
export const labelOf = (field) => {
  const words = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Rows → each field's rules, its page field, and the evidence for both.
 * Nothing is drawn from a field's NAME, and nothing a sample cannot show is
 * proposed: no `required` but the key's, no `min`, `max` or `oneOf`.
 */
export function fromRows(dl, rows, key = 'id') {
  const names = [...new Set(rows.flatMap((r) => (isObject(r) ? Object.keys(r) : [])))];
  const passes = (rule, values) => values.every((v) => rule(v) === undefined);
  return names.map((name) => {
    const values = rows.map((r) => r?.[name]);
    const present = values.filter((v) => !absent(v));
    const out = { name, rules: [], field: null, why: [], left: null };
    if (name === key) {
      out.rules.push('required');
      out.why.push('how byKey, update and remove find a row');
      if (present.length < rows.length) out.why.push(`${rows.length - present.length} row(s) have none`);
      out.left = 'the key';
    }
    if (!present.length) {
      out.left ??= 'every value is empty';
      return out;
    }
    const kinds = [...new Set(present.map((v) => (Array.isArray(v) ? 'array' : typeof v)))];
    if (kinds.length > 1) out.why.push(`its values are of ${kinds.length} kinds: ${kinds.join(', ')}`);
    if (kinds.includes('array')) {
      out.left ??= 'a list: a filter compares one value, never one of a list\'s';
      out.nested = true;
      return out;
    }
    if (kinds.includes('object')) {
      out.left ??= `an object: a page reaches a part of it by a dotted path, ${name}.part`;
      out.nested = true;
      return out;
    }
    const label = labelOf(name);
    if (kinds.length === 1 && kinds[0] === 'number' && passes(dl.number(), present)) {
      out.rules.push('number');
      const [low, high] = present.reduce(([lo, hi], v) => [Math.min(lo, v), Math.max(hi, v)], [Infinity, -Infinity]);
      out.why.push(`every value is a number, from ${low} to ${high}: no min or max, as a sample cannot bound its store`);
      out.field = { label, type: 'number' };
    } else if (kinds.length === 1 && kinds[0] === 'string' && present.every((v) => ISO_DAY.test(v))) {
      const timed = present.some((v) => ISO_DAY.exec(v).groups.time);
      out.why.push(`every value is an ISO day${timed ? ', some with a time of day' : ''}`);
      out.field = { label, type: 'date', ...(timed ? { time: true } : {}) };
    } else {
      if (kinds.length === 1 && kinds[0] === 'string') {
        if (passes(dl.email(), present)) {
          out.rules.push('email');
          out.why.push(`every value passes email()`);
        } else if (present.every((v) => /^https?:\/\//i.test(v)) && passes(dl.url(), present)) {
          out.rules.push('url');
          out.why.push(`every value is an http(s) URL that url() accepts`);
        }
      }
      const distinct = new Set(present.map((v) => dl.valueKey(v))).size;
      if (distinct === present.length && present.length > 1 && kinds[0] === 'string') {
        out.left ??= `every value differs: a field to search (source.search), not a list to filter by`;
        out.search = name !== key;
      } else {
        out.why.push(`${distinct} distinct value(s) in ${present.length}: a list to filter by`);
        out.field = { label, select: 'multiple' };
      }
    }
    if (out.left) out.field = null;
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
 * A JSON Schema or an OpenAPI document → each field's rules, its page field and
 * the evidence, and what the schema says that no rule or field carries. What a
 * spec PROMISES may be a rule, as a sample's evidence may not.
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
    const out = { name, rules: [], field: null, why: [], left: null };
    const s = given?.$ref ? resolveRef(doc, given.$ref) : given;
    if (!isObject(s)) {
      uncarried.push(`${name}: ${given?.$ref ? `${given.$ref} is not in this document` : 'not a schema'}`);
      return out;
    }
    if (required.has(name)) {
      out.rules.push('required');
      out.why.push('the schema requires it');
    }
    for (const kw of ['allOf', 'anyOf', 'oneOf', 'not']) if (s[kw]) uncarried.push(`${name}: ${kw} has no rule`);
    const types = [s.type].flat().filter(Boolean);
    if (types.includes('null')) out.why.push('it may be null: every rule but required passes an empty value');
    const type = types.find((t) => t !== 'null');
    const label = typeof s.title === 'string' ? s.title : labelOf(name);
    const described = typeof s.description === 'string' ? { description: s.description } : {};
    if (type === 'number' || type === 'integer') {
      out.rules.push('number');
      out.field = { label, type: 'number', ...described };
      if (typeof s.minimum === 'number') out.rules.push({ min: s.minimum });
      if (typeof s.maximum === 'number') out.rules.push({ max: s.maximum });
      out.why.push(`type: ${type}${typeof s.minimum === 'number' ? `, minimum ${s.minimum}` : ''}${typeof s.maximum === 'number' ? `, maximum ${s.maximum}` : ''}`);
      for (const kw of ['exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']) if (s[kw] !== undefined) uncarried.push(`${name}: ${kw} has no rule (min and max hold their ends)`);
    } else if (type === 'object' || type === 'array') {
      out.left = type === 'array' ? 'a list: a filter compares one value, never one of a list\'s' : `an object: a page reaches a part of it by a dotted path, ${name}.part`;
      out.nested = true;
      uncarried.push(`${name}: ${type === 'array' ? 'a rule checks one value, not each item' : 'its own properties have no rules here'}`);
    } else {
      const format = s.format;
      if (format === 'date' || format === 'date-time') {
        out.field = { label, type: 'date', ...(format === 'date-time' ? { time: true } : {}), ...described };
        out.why.push(`format: ${format}`);
      } else {
        if (format === 'email') out.rules.push('email');
        else if (format === 'uri' || format === 'url') out.rules.push('url');
        else if (format) uncarried.push(`${name}: format ${format} has no rule`);
        if (format === 'email' || format === 'uri' || format === 'url') out.why.push(`format: ${format}`);
        out.field = { label, ...(Array.isArray(s.enum) ? { select: 'multiple' } : {}), ...described };
      }
      if (typeof s.pattern === 'string') out.rules.push({ pattern: s.pattern });
      if (typeof s.minLength === 'number') out.rules.push({ min: s.minLength });
      if (typeof s.maxLength === 'number') out.rules.push({ max: s.maxLength });
      if (s.minLength !== undefined || s.maxLength !== undefined) out.why.push('minLength and maxLength are min and max: on text they count its characters');
    }
    if (Array.isArray(s.enum) && s.enum.length) {
      out.rules.push({ oneOf: s.enum });
      out.why.push(`enum of ${s.enum.length}: the schema closes the set`);
    }
    if (s.default !== undefined) uncarried.push(`${name}: default has no rule: a store does not fill one in`);
    if (name === key) {
      out.left = 'the key';
      out.field = null;
      if (!required.has(name)) out.why.push('the key, which the schema does not require');
    }
    return out;
  });
  if (!(key in row.properties)) uncarried.push(`the key, "${key}", is no property: name the row's key with \`key\``);
  return { fields, via, uncarried };
}

/** A page's own fields (its definition's `source.fields`) → each field as fromRows says one: what the page declares, and no rule. */
export function fromFields(declared) {
  return Object.entries(declared).map(([name, field]) => ({ name, rules: [], field, why: ['the page declares it'], left: null }));
}

/** The status fields an agent gives, against what statusFields() takes (defs.v1.json statusField): each problem, none when sound. */
export function statusProblems(status) {
  if (!isObject(status)) return ['`status` is an object of field → its status field'];
  return Object.entries(status).flatMap(([f, d]) => schemaCheck('defs.v1.json#/$defs/statusField')(d).map((e) => `status.${f}${e}`));
}

/** The fields, and each status field the data does not show (a schema's, a page's), as a list a page filters by: its store works its values out. */
export function withStatus(fields, status) {
  for (const [name, def] of Object.entries(status ?? {})) {
    if (!fields.some((f) => f.name === name)) fields.push({ name, rules: [], field: { label: def.label ?? labelOf(name), select: 'multiple' }, why: ['a status field: its store works it out'], left: null });
  }
  return fields;
}

/** Rows as a store that works out these status fields gives them (statusFields, as the app wraps its store): each row with its status values. It throws, in the data layer's words, on a condition it cannot work out. */
export async function statusRows(dl, rows, status, key = 'id') {
  return (await dl.statusFields(new dl.ArrayStore(rows.map((r) => ({ ...r })), { key }), status).load({})).rows;
}

/**
 * The fields of each kind a pattern's `each` stands for (pattern.v1.json), each
 * `{ name, label }`: `field` is every field a reader may write — not the key, a
 * list or an object, which no one input holds, nor a status, which its store
 * works out; `statusField` each one `status` names; `childField` each field
 * another names as its `child`.
 */
export function fieldKinds(fields, { key = 'id', status = [] } = {}) {
  const one = (f) => ({ name: f.name, label: f.field?.label ?? labelOf(f.name) });
  const typed = (t) => fields.filter((f) => f.field?.type === t).map(one);
  const children = new Set(fields.map((f) => f.field?.child).filter(Boolean));
  return {
    field: fields.filter((f) => f.name !== key && !f.nested && !status.includes(f.name)).map(one),
    dateField: typed('date'),
    numberField: typed('number'),
    statusField: fields.filter((f) => status.includes(f.name)).map(one),
    childField: fields.filter((f) => children.has(f.name)).map(one),
  };
}

/**
 * The need a pattern is picked by (pattern.v1.json `need`): what the data says,
 * and the task and writes as the agent says them. A status field is its
 * store's, so it is counted only when `status` names them; a child is its
 * page's, so only when the fields are the page's own (`declared`). A sample
 * shows neither: left out, each is unknown, not none.
 */
export function needOf(fields, { rows, task, writes, status, declared = false } = {}) {
  const typed = (t) => fields.filter((f) => f.field?.type === t).length;
  return {
    ...(task ? { task } : {}),
    ...(rows != null ? { rows } : {}),
    fields: fields.length,
    dateFields: typed('date'),
    numberFields: typed('number'),
    ...(status ? { statusFields: status.length } : {}),
    ...(declared ? { childFields: fieldKinds(fields).childField.length } : {}),
    ...(writes != null ? { writes } : {}),
  };
}
