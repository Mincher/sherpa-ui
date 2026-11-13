/**
 * acts.ts — every act an app can do, said ONCE: its id, its words, what it acts on, what it asks, whether it changes
 * data, where a press offers it, and the one function that does it. A press, the AI chat, WebMCP and the MCP all go
 * through one door, `runAct`, which checks a call in words and never throws; and every type gives its own acts (find,
 * read, add, change, remove) through the store door. DOM-free. Will, plan 964 D1 A · docs/history/plan-964-n1-acts.md
 *
 * Map:
 * - ActCall — What a call gives an act: the keys of the rows it acts on, and its input.
 * - ActContext — What an act runs over: the stores by name, the shelf, a signal.
 * - ActAnswer — What an act answers, in words: done (with a result and an undo), or refused.
 * - Act — One act: its id, words, target, input, whether it changes data, where a press offers it, and its run.
 * - registerAct — An app adds an act; one that is not one, or whose id is taken, is refused in words. How to take it back.
 * - actsOf — The acts that apply on a page (a Context, a View, its type); asked with nothing, every act.
 * - inputFaults — Why a call's input is refused, in words: each field by its rules, each reference a row.
 * - runAct — The ONE door: the act found, its call checked by its type's rules, run; done or refused, in words.
 * - Choice — One value a field offers, by its words.
 * - refChoices — A reference's choices: its type's rows by key and title, through the store door; none past 200.
 * - actSchema — An act's call as a JSON Schema, a reference's choices read from its type's store: a tool is made from it.
 * - typeActs — A type's own acts: a row type's through its store; a graph type's through the shelf (graphActs).
 */
import type { EntityShelf } from './entity-shelf.js';
import { entityTypes } from './entity-types.js';
import { graphActs } from './entity-acts.js';
import { report } from './report.js';
import type { Filter, Row, Store } from './store.js';
import { storeOfType, titleOf, typeSchema, type StoredField, type TypeDefinition } from './type-definition.js';
import { fieldsFaults } from './type-faults.js';
import { validateField } from './validate.js';

/** What a call gives an act: the keys of the rows it acts on (its type's), and its input, by field. */
export interface ActCall {
  keys?: readonly unknown[];
  input?: Readonly<Row>;
}

/** What an act runs over: the stores by name (a page's `ctx.stores`), the shelf, a signal. */
export interface ActContext {
  stores: Readonly<Record<string, Store>>;
  entities?: EntityShelf;
  signal?: AbortSignal;
}

/** What an act answers, in words: done — with its result, and an undo where it changed data — or refused. */
export type ActAnswer = { done: string; result?: unknown; undo?: () => Promise<void> } | { refused: string };

/** One act: its id, its words, the type whose rows it acts on, what it asks, whether it changes data (a caller asks
 *  first), where a press offers it (none: wherever its type is), and the one function that does it. */
export interface Act {
  /** `<type>.<verb>`, or `<context>.<verb>` for one on no type: lowercase words and hyphens. */
  id: string;
  /** Its words, as a button and a tip say them: "Run now" (PRINCIPLES 24). */
  label: string;
  /** One line, for the chat and the MCP: what it does. */
  description?: string;
  /** The type whose rows it acts on, by key: `call.keys`. */
  type?: string;
  /** It takes several rows at once. */
  many?: boolean;
  /** What it asks, as a type's fields say data: its words, rules and choices said once. */
  input?: Readonly<Record<string, StoredField>>;
  /** It changes data: a caller asks the reader first, and it answers an undo. */
  changes: boolean;
  /** Where a press offers it, by Context and View id. None: wherever its type's rows are. The chat runs any act. */
  where?: { contexts?: readonly string[]; views?: readonly string[] };
  run(call: ActCall, ctx: ActContext): Promise<ActAnswer>;
}

const ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)?$/;
const NAME = /^[a-z][a-z0-9-]*$/;
const acts = new Map<string, Act>();

/** Every graph type's own acts, the library's and the app's, made as they are asked: a type registered later has them
 *  too, and none is registered twice. A row type's are the app's to register (`typeActs`). Plans 964 N3c, 972 */
const entityActs = (): Act[] => Object.values(entityTypes()).filter((t) => t.graph).flatMap((t) => graphActs({ ...t, label: t.label ?? t.id }));
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
/** A type's name as a reader reads it. */
const labelOf = (type: string): string => entityTypes()[type]?.label ?? type;

/** What is wrong with an act, in words. */
function actFaults(act: Act): string[] {
  const out: string[] = [];
  if (!isText(act?.id) || !ID.test(act.id)) out.push('its id is `<type>.<verb>`: lowercase words and hyphens');
  if (!isText(act?.label)) out.push('it has no words (label)');
  if (typeof act?.changes !== 'boolean') out.push('it does not say whether it changes data (changes)');
  if (typeof act?.run !== 'function') out.push('it has no run');
  if (act?.type !== undefined && !NAME.test(String(act.type))) out.push('its type is no type\'s id');
  if (act?.input !== undefined) out.push(...fieldsFaults(act.input).map((f) => `its input ${f}`));
  return out;
}

/** An app adds an act. One that is not one, or whose id is taken, is refused and reported in words. It answers how to
 *  take it back, or none. */
export function registerAct(act: Act): (() => void) | undefined {
  const faults = actFaults(act);
  if (!faults.length && acts.has(act.id)) faults.push(`its id, "${act.id}", is another act's`);
  if (faults.length) {
    report({ code: 'act', message: `registerAct: the act ${JSON.stringify(act?.id ?? null)} is refused: ${faults.join('; ')}.`, at: {} });
    return undefined;
  }
  acts.set(act.id, act);
  return () => { if (acts.get(act.id) === act) acts.delete(act.id); };
}

/**
 * The acts that apply on a page: one with a `where` where its Contexts (and Views) name it; one with none wherever its
 * type's rows are — the page's `type` — or, with no type, everywhere. Asked with only a type, that type's. Asked with
 * nothing, every act: the chat may run any act from any page, the reader allowing a change (plan 964 N5).
 */
export function actsOf(at: { context?: string; view?: string; type?: string } = {}): Act[] {
  const all = [...acts.values(), ...entityActs().filter((a) => !acts.has(a.id))];
  if (at.context === undefined && at.view === undefined) return at.type === undefined ? all : all.filter((a) => a.type === at.type);
  return all.filter((a) => (a.where
    ? (!a.where.contexts || a.where.contexts.includes(at.context ?? '')) && (!a.where.views || a.where.views.includes(at.view ?? ''))
    : !a.type || a.type === at.type));
}

/** Why a call's input is refused, in words; none when it is sound: each field by its rules, each reference a row. */
export async function inputFaults(input: Readonly<Record<string, StoredField>>, given: Readonly<Row>, ctx: Pick<ActContext, 'stores'>): Promise<string[]> {
  const out = Object.keys(given).filter((name) => !(name in input)).map((name) => `it takes no "${name}"`);
  const rules = typeSchema({ key: '#', fields: input }).rules;
  for (const [name, field] of Object.entries(input)) {
    const value = given[name];
    const words = field.label ?? name;
    if (field.ref) {
      if (value === undefined || value === null || value === '') {
        if (field.required) out.push(`it needs ${words}`);
        continue;
      }
      const store = storeOfType(ctx.stores, field.ref);
      if (!store) {
        out.push(`there is no store of ${labelOf(field.ref)}`);
        continue;
      }
      const keys = field.many ? (Array.isArray(value) ? value : [value]) : [value];
      for (const key of keys) if (!(await store.byKey(key))) out.push(`"${String(key)}" is no ${labelOf(field.ref)}`);
      continue;
    }
    const wrong = rules[name] ? await validateField(rules[name]!, value) : undefined;
    if (wrong) out.push(`${words}: ${wrong}`);
  }
  return out;
}

/**
 * The ONE door: the act found by its id, its call checked — its keys are rows of its type, as many as it takes; its
 * input by its type's rules, each reference a row of its type — and run. It answers done or refused, in words, and
 * never throws. It never asks the reader: a caller does, when the act `changes`.
 */
export async function runAct(id: string, call: ActCall = {}, ctx: ActContext): Promise<ActAnswer> {
  const act = acts.get(id) ?? entityActs().find((a) => a.id === id);
  if (!act) return { refused: `There is no act "${id}".` };
  const keys = call.keys ?? [];
  if (act.type) {
    const store = storeOfType(ctx.stores, act.type);
    // An entity type with no store of its own is read on the shelf (plan 972: every entity type's Publish and Roll back).
    const shelf = !store && entityTypes()[act.type] ? ctx.entities : undefined;
    if (!store && !shelf) return { refused: `There is no store of ${labelOf(act.type)}.` };
    if (!act.many && keys.length > 1) return { refused: `${act.label} takes one ${labelOf(act.type)}, not ${keys.length}.` };
    for (const key of keys) {
      const there = store ? !!(await store.byKey(key)) : shelf!.get(String(key))?.type === act.type;
      if (!there) return { refused: `There is no ${labelOf(act.type)} "${String(key)}".` };
    }
  }
  const wrong = await inputFaults(act.input ?? {}, call.input ?? {}, ctx);
  if (wrong.length) return { refused: `${act.label}: ${wrong.join('; ')}.` };
  try {
    return await act.run(call, ctx);
  } catch (error) {
    return { refused: error instanceof Error ? error.message : String(error) };
  }
}

/** One value a field offers, by its words: a value's label, or a referenced row's title. */
export interface Choice {
  value: string | number | boolean;
  label: string;
}

/** A reference's choices: its type's rows, each by its key and its title, read through the store door. None where its
 *  type has no store, or past 200 rows: a caller then takes its key in words. */
export async function refChoices(ref: string, ctx?: Pick<ActContext, 'stores'>): Promise<Choice[] | undefined> {
  const store = ctx ? storeOfType(ctx.stores, ref) : undefined;
  if (!store) return undefined;
  const type = entityTypes()[ref];
  const title = type ? titleOf(type) : store.key;
  const { rows } = await store.load({ take: 201 });
  return rows.length <= 200 ? rows.map((r) => ({ value: r[store.key] as Choice['value'], label: String(r[title] ?? r[store.key]) })) : undefined;
}

/** A field as JSON Schema, a reference's choices read from its type's store (at most 200: past that, its key in words). */
async function fieldSchema(field: StoredField, name: string, ctx?: ActContext): Promise<Record<string, unknown>> {
  const description = field.description ?? field.label ?? name;
  if (field.ref) {
    const choices = await refChoices(field.ref, ctx);
    const one = choices
      ? { oneOf: choices.map((c) => ({ const: c.value, title: c.label })) }
      : { type: ['string', 'number'], description: `The key of a ${labelOf(field.ref)}.` };
    return field.many ? { type: 'array', items: one, uniqueItems: true, description } : { ...one, description };
  }
  const kind = field.type ?? 'text';
  if (field.many && field.values) return { type: 'array', items: { enum: [...field.values] }, uniqueItems: true, description };
  if (kind === 'number') return { type: 'number', description, ...(field.min !== undefined ? { minimum: field.min } : {}), ...(field.max !== undefined ? { maximum: field.max } : {}) };
  if (kind === 'boolean') return { type: 'boolean', description };
  if (kind === 'object') return { type: 'object', description };
  if (kind === 'date') return { type: 'string', format: field.time ? 'date-time' : 'date', description };
  return {
    type: 'string', description,
    ...(field.values ? { enum: [...field.values] } : {}),
    ...(field.min !== undefined ? { minLength: field.min } : {}), ...(field.max !== undefined ? { maxLength: field.max } : {}),
    ...(field.pattern ? { pattern: field.pattern } : {}),
    ...(field.format ? { format: field.format === 'url' ? 'uri' : 'email' } : {}),
  };
}

/** An act's call as a JSON Schema — its keys, and its input by its fields, a reference's choices read from its type's
 *  store — so a tool is made from it, never written (plan 964 N3). */
export async function actSchema(act: Act, ctx?: ActContext): Promise<Record<string, unknown>> {
  const input = Object.entries(act.input ?? {});
  const properties: Record<string, unknown> = {};
  if (act.type) {
    properties['keys'] = {
      type: 'array', items: { type: ['string', 'number'] }, minItems: 1, ...(act.many ? {} : { maxItems: 1 }),
      description: `The ${labelOf(act.type)} it acts on, by key${act.many ? ', one or more' : ''}.`,
    };
  }
  if (input.length) {
    properties['input'] = {
      type: 'object', additionalProperties: false,
      properties: Object.fromEntries(await Promise.all(input.map(async ([name, field]) => [name, await fieldSchema(field, name, ctx)]))),
      required: input.filter(([, f]) => f.required).map(([name]) => name),
    };
  }
  return {
    type: 'object', additionalProperties: false, description: act.description ?? act.label, properties,
    required: [...(act.type ? ['keys'] : []), ...(input.some(([, f]) => f.required) ? ['input'] : [])],
  };
}

/** A type's fields a reader may give: stored, not read from its graph; the key only where asked. */
function givenFields(type: TypeDefinition, withKey: boolean, required: boolean): Record<string, StoredField> {
  const key = type.key ?? 'id';
  return Object.fromEntries(Object.entries(type.fields ?? {}).flatMap(([name, field]) => {
    if (field.type === 'status' || (field as StoredField).from || (!withKey && name === key)) return [];
    const { required: was, ...rest } = field as StoredField;
    return [[name, required && (was || name === key) ? { ...rest, required: true } : rest]];
  }));
}

/**
 * A type's own acts. A row type's go through its store (`storeOfType`, whatever the app names it), each refused in the
 * store's words: find (rows whose fields equal those given, a search), read (one row), add (a row; its undo removes it),
 * change (rows' fields; its undo puts each back) and remove (rows; its undo puts each back). A graph type's go through the
 * shelf (`graphActs`).
 */
export function typeActs(type: TypeDefinition): Act[] {
  // A graph type's entities are definitions, not rows: its acts go through the shelf (plan 964 N3c).
  if (type.graph) return graphActs(type);
  const id = type.id;
  const key = type.key ?? 'id';
  const title = titleOf(type);
  const named = (row: Row | undefined): string => `${type.label} "${String(row?.[title] ?? row?.[key] ?? '')}"`;
  const storeOf = (ctx: ActContext): Store => storeOfType(ctx.stores, id)!;
  const keysOf = (call: ActCall): unknown[] => [...(call.keys ?? [])];
  const many = (n: number): string => (n === 1 ? `1 ${type.label}` : `${n} of ${type.label}`);
  return [
    {
      id: `${id}.find`, label: 'Find', type: id, changes: false,
      description: `The ${type.label} rows whose fields equal the values given, and a search over them.`,
      input: { search: { label: 'Search' }, take: { type: 'number', label: 'How many', min: 1, max: 100 }, ...givenFields(type, true, false) },
      async run(call, ctx) {
        const { search, take, ...equal } = call.input ?? {};
        const clauses = Object.entries(equal).filter(([, v]) => v !== undefined).map(([field, v]): Filter => [field, Array.isArray(v) ? 'in' : 'eq', v]);
        const filter: Filter | undefined = clauses.length === 1 ? clauses[0] : clauses.length ? ['and', ...clauses] : undefined;
        const page = await storeOf(ctx).load({ ...(filter ? { filter } : {}), ...(search ? { search: String(search) } : {}), take: Number(take ?? 25) });
        return { done: `${page.total} found.`, result: { rows: page.rows, total: page.total } };
      },
    },
    {
      id: `${id}.read`, label: 'Read', type: id, changes: false, description: `One ${type.label}, by its key.`,
      async run(call, ctx) {
        const row = await storeOf(ctx).byKey(keysOf(call)[0]);
        return { done: `Read ${named(row)}.`, result: row };
      },
    },
    {
      id: `${id}.add`, label: 'Add', type: id, changes: true, description: `A new ${type.label}, from its fields.`,
      input: givenFields(type, true, true),
      async run(call, ctx) {
        const store = storeOf(ctx);
        const row = await store.insert({ ...call.input });
        return { done: `Added ${named(row)}.`, result: row, undo: async () => { await store.remove(row[key]); } };
      },
    },
    {
      id: `${id}.change`, label: 'Change', type: id, many: true, changes: true,
      description: `Change fields of one or more ${type.label} rows.`, input: givenFields(type, false, false),
      async run(call, ctx) {
        const values = Object.fromEntries(Object.entries(call.input ?? {}).filter(([, v]) => v !== undefined));
        if (!Object.keys(values).length) return { refused: 'Change: say what to change.' };
        const store = storeOf(ctx);
        const before: Row[] = [];
        for (const k of keysOf(call)) {
          const row = (await store.byKey(k))!;
          await store.update(k, values);
          before.push(Object.fromEntries(Object.keys(values).map((f) => [f, row[f]])));
        }
        const keys = keysOf(call);
        return {
          done: `Changed ${keys.length === 1 ? named(await store.byKey(keys[0])) : many(keys.length)}.`,
          undo: async () => { for (const [i, k] of keys.entries()) await store.update(k, before[i]!); },
        };
      },
    },
    {
      id: `${id}.remove`, label: 'Remove', type: id, many: true, changes: true, description: `Remove one or more ${type.label} rows.`,
      async run(call, ctx) {
        const store = storeOf(ctx);
        const gone: Row[] = [];
        for (const k of keysOf(call)) {
          gone.push((await store.byKey(k))!);
          await store.remove(k);
        }
        return {
          done: `Removed ${gone.length === 1 ? named(gone[0]) : many(gone.length)}.`,
          undo: async () => { for (const row of gone) await store.insert(row); },
        };
      },
    },
  ];
}
