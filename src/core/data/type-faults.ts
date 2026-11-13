/**
 * type-faults.ts — what is wrong with a type (type.v1), in words. Light, apart from the type's makers, so the type
 * registry (entity-types.ts) checks a type without carrying them. The data layer has no schema validator, so it is
 * hand-written; the tests hold it and type.v1.json together. DOM-free. Will, plan 960 U2
 *
 * Map:
 * - typeFaults — What is wrong with a type, in words; none when it is sound.
 */
import { parseWhere, type Where } from './where.js';

const ID = /^[a-z][a-z0-9-]*$/;
const TOP = ['$schema', 'v', 'id', 'label', 'description', 'tags', 'icon', 'category', 'key', 'time', 'fields', 'data', 'graph'];
const STORED = ['type', 'label', 'description', 'required', 'values', 'labels', 'statuses', 'min', 'max', 'format', 'pattern', 'time', 'from'];
const STATUS = ['type', 'label', 'description', 'values'];
const KINDS = ['text', 'number', 'date', 'boolean'];
const PATH = /^[^/]+(\/[^/]+)*$/;
const GRAPH = ['families', 'inputs', 'outputs', 'runs', 'reusable'];
const SOCKET = ['name', 'label', 'type', 'many', 'multiple', 'control', 'default'];
const SOCKET_TYPES = ['value', 'object', 'boolean'];

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
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

/** What is wrong with a graph part's sockets, in words. */
function socketFaults(list: unknown, side: 'inputs' | 'outputs'): string[] {
  if (!Array.isArray(list)) return [`its ${side} are not a list`];
  const names = list.map((s) => (isObject(s) ? s['name'] : undefined));
  return list.flatMap((s, i) => {
    if (!isObject(s) || !isText(s['name']) || !ID.test(s['name'])) return [`its ${side} ${i + 1} has no name (lowercase letters, digits, hyphens)`];
    const at = `its ${side.slice(0, -1)} "${s['name']}"`;
    return [
      ...extra(s, side === 'inputs' ? SOCKET : ['name', 'label', 'type'], at),
      ...(SOCKET_TYPES.includes(s['type'] as string) ? [] : [`${at}: its type is one of ${SOCKET_TYPES.join(', ')}`]),
      ...(names.indexOf(s['name']) !== i ? [`${at} is named twice`] : []),
    ];
  });
}

/** What is wrong with a graph thing's graph part, in words. */
function graphFaults(graph: unknown): string[] {
  if (!isObject(graph)) return ['its graph is an object: { families, inputs, outputs, runs, reusable }'];
  return [
    ...extra(graph, GRAPH, 'a graph part'),
    ...('families' in graph && (!Array.isArray(graph['families']) || graph['families'].some((f) => !isText(f))) ? ['its families are a list of names'] : []),
    ...(['inputs', 'outputs'] as const).flatMap((side) => (side in graph ? socketFaults(graph[side], side) : [])),
    ...(['runs', 'reusable'] as const).filter((k) => k in graph && typeof graph[k] !== 'boolean').map((k) => `its ${k} is not true or false`),
  ].map((f) => `graph: ${f}`);
}

/** What is wrong with a type, in words; none when it is sound. A graph thing's key is its entity's id, so need not be a field. */
export function typeFaults(given: unknown): string[] {
  if (!isObject(given)) return ['a type is an object'];
  const out = extra(given, TOP, 'a type');
  if (given['v'] !== 1) out.push('its v is not 1');
  if (!isText(given['id']) || !ID.test(given['id'])) out.push('its id is not a name (lowercase letters, digits, hyphens)');
  if (!isText(given['label'])) out.push('it has no label');
  for (const k of ['description', 'icon', 'category', 'data']) if (k in given && !isText(given[k])) out.push(`its ${k} is not text`);
  if ('tags' in given && (!Array.isArray(given['tags']) || given['tags'].some((t) => !isText(t)))) out.push('its tags are not a list of words');
  if ('graph' in given) out.push(...graphFaults(given['graph']));
  const fields = given['fields'];
  if (fields === undefined && 'graph' in given) return out;
  if (!isObject(fields) || !Object.keys(fields).length) return [...out, 'it has no fields, and no graph'];
  const key = given['key'] ?? 'id';
  const keyField = typeof key === 'string' ? fields[key] : undefined;
  if (!isObject(keyField) && !('graph' in given && key === 'id')) out.push(`its key, ${JSON.stringify(key)}, is no field`);
  else if (isObject(keyField) && (keyField['type'] === 'status' || 'from' in keyField)) out.push(`its key, "${key}", is a field each row holds: no status, nothing read from its graph`);
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
