/**
 * flows.ts — a UX flow: one act's input asked step by step, then a confirm (Will, plan 964 N4 D3 A). A flow is JSON
 * (schemas/flow.v1.json), keyed by its act and said in its act's words. Two lenses draw it: a page's dialog shows every
 * step that holds (`stepsOf`), the chat one at a time (`nextStep`, `answerStep`); both run the act through its one door.
 * A flow asks only the act's input: the keys it runs on are the caller's, as for a press. DOM-free.
 *
 * Map:
 * - FlowStep — One step: a field of the act's input, and when it is asked.
 * - Flow — A flow, as JSON: its act, its steps in order, and whether it asks before it runs.
 * - Ask — One step as a lens draws it: its field's words, its kind, its choices and its rules.
 * - FlowAnswers — The answers so far, by field; null is a step skipped.
 * - FlowContext — What a flow reads: the stores (a reference's choices), and the keys its act runs on.
 * - NextStep — What comes next: a step, the confirm, the run, or why not.
 * - flowFaults — What is wrong with a flow, in words: checked against its act where that is registered.
 * - registerFlow — An app adds the flow of an act; one that is not one, or a second for its act, is refused in words.
 * - flowOf — The flow of an act: its own, else one made from its input, a step per field.
 * - flowsOf — The flows of the acts that apply on a page.
 * - stepsOf — Every step whose `when` holds now, as Asks: the dialog's form.
 * - nextStep — The first step still unanswered, else the confirm or the run: the chat's next message.
 * - StepRefusal — Why an answer is refused: the whole sentence, and its field's own words.
 * - answerStep — One answer, checked as the act checks it: the answers with it, or why not.
 */
import { actsOf, inputFaults, refChoices, type Act, type Choice } from './acts.js';
import { entityTypes } from './entity-types.js';
import { conditionClause } from './filter-state.js';
import { report } from './report.js';
import { filterTest, type Row, type Store } from './store.js';
import { storeOfType, titleOf, type StoredField } from './type-definition.js';
import { parseWhere, type Where } from './where.js';

/** One step: a field of the act's input, asked only when `when` holds over the answers of the steps before it. */
export interface FlowStep {
  field: string;
  when?: Where;
}

/** A flow, as JSON: its act, its steps in order, and whether it asks before it runs (none: when its act changes data). */
export interface Flow {
  $schema?: string;
  v: 1;
  act: string;
  steps: readonly FlowStep[];
  confirm?: boolean;
}

/** One step as a lens draws it: its field's words, its kind, its choices (a set of values, or a reference's rows) and its
 *  rules. A reference past 200 rows is `text`: its key. */
export interface Ask {
  field: string;
  label: string;
  description?: string;
  kind: 'text' | 'number' | 'date' | 'boolean' | 'one' | 'many';
  choices?: readonly Choice[];
  required: boolean;
  pattern?: string;
  format?: 'email' | 'url';
  min?: number;
  max?: number;
}

/** The answers so far, by field; null is a step skipped. */
export type FlowAnswers = Readonly<Record<string, unknown>>;

/** What a flow reads: the stores (a reference's choices, the keys' names), and the keys its act runs on. */
export interface FlowContext {
  stores: Readonly<Record<string, Store>>;
  keys?: readonly unknown[];
}

/** What comes next: a step to ask, the confirm (its words and the act's input), the run where it asks nothing first, or
 *  why not. */
export type NextStep = { step: Ask } | { confirm: string; input: Row } | { run: Row } | { refused: string };

const flows = new Map<string, Flow>();
const TOP = ['$schema', 'v', 'act', 'steps', 'confirm'];
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const actOf = (id: string): Act | undefined => actsOf().find((a) => a.id === id);
const empty = (v: unknown): boolean => v === undefined || v === null || v === '';
/** Words as a list reads them: "A", "A and B", "A, B and C". */
const listed = (words: readonly string[]): string => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);

/** Each `when` as its test, made once. */
const tests = new WeakMap<Where, (row: Row) => boolean>();
const holds = (when: Where, answers: Row): boolean => {
  let test = tests.get(when);
  if (!test) tests.set(when, test = filterTest(conditionClause(parseWhere(when))));
  return test(answers);
};

/** What is wrong with a flow, in words. Against its act, where that is registered: each step one of its input fields,
 *  each field it needs asked. */
export function flowFaults(flow: unknown, act: Act | undefined = isObject(flow) && isText(flow['act']) ? actOf(flow['act']) : undefined): string[] {
  if (!isObject(flow) || flow['v'] !== 1) return ['it is not a flow: a v1 with its act and its steps'];
  const out = Object.keys(flow).filter((k) => !TOP.includes(k)).map((k) => `it has "${k}", which a flow does not`);
  if (!isText(flow['act'])) out.push('it names no act');
  if (flow['confirm'] !== undefined && typeof flow['confirm'] !== 'boolean') out.push('its confirm is not true or false');
  const steps = flow['steps'];
  if (!Array.isArray(steps) || !steps.length) return [...out, 'it has no steps'];
  const before = new Set<string>();
  for (const step of steps as unknown[]) {
    if (!isObject(step) || !isText(step['field'])) {
      out.push('a step names no field');
      continue;
    }
    const field = step['field'];
    const at = `its step "${field}"`;
    if (Object.keys(step).some((k) => k !== 'field' && k !== 'when')) out.push(`${at} says more than its field and when`);
    if (before.has(field)) out.push(`${at} is asked twice`);
    if (act && !act.input?.[field]) out.push(`${at} is no input of ${act.id}`);
    const when = step['when'];
    if (when !== undefined) {
      if (!isObject(when) || !Object.values(when).every(isObject) || !parseWhere(when as Where)) out.push(`${at}: its when is not a where`);
      else for (const name of Object.keys(when)) if (!before.has(name)) out.push(`${at}: its when reads "${name}", which no step before it asks`);
    }
    before.add(field);
  }
  for (const [name, field] of Object.entries(act?.input ?? {})) {
    if (field.required && !before.has(name)) out.push(`it does not ask "${name}", which ${act!.id} needs`);
  }
  return out;
}

/** An app adds the flow of an act. One that is not one, or a second for its act, is refused and reported in words. It
 *  answers how to take it back, or none. */
export function registerFlow(flow: Flow): (() => void) | undefined {
  const faults = flowFaults(flow);
  if (!faults.length && flows.has(flow.act)) faults.push(`${flow.act} has a flow already`);
  if (faults.length) {
    report({ code: 'flow', message: `registerFlow: the flow of ${JSON.stringify(isObject(flow) ? flow.act ?? null : null)} is refused: ${faults.join('; ')}.`, at: {} });
    return undefined;
  }
  flows.set(flow.act, flow);
  return () => { if (flows.get(flow.act) === flow) flows.delete(flow.act); };
}

/** The flow of an act: its own, else one made from its input — a step per field, in order, and a confirm where it
 *  changes data. None for an act that is not there. */
export function flowOf(act: string): Flow | undefined {
  const own = flows.get(act);
  if (own) return own;
  const made = actOf(act);
  return made && { v: 1, act, steps: Object.keys(made.input ?? {}).map((field) => ({ field })), confirm: made.changes };
}

/** The flows of the acts that apply on a page (`actsOf`): each its own. */
export function flowsOf(at: Parameters<typeof actsOf>[0] = {}): Flow[] {
  return actsOf(at).flatMap((a) => flows.get(a.id) ?? []);
}

/** The steps that hold, in order: each `when` read over the answers of the steps before it that hold. */
function holding(flow: Flow, answers: FlowAnswers): FlowStep[] {
  const seen: Row = {};
  return flow.steps.filter((step) => {
    if (step.when && !holds(step.when, seen)) return false;
    if (step.field in answers) seen[step.field] = answers[step.field];
    return true;
  });
}

/** One field as an Ask: its words, its kind, its choices and its rules. */
async function askOf(field: string, def: StoredField, ctx: FlowContext): Promise<Ask> {
  const base = {
    field, label: def.label ?? field, required: !!def.required, ...(def.description ? { description: def.description } : {}),
    ...(def.pattern ? { pattern: def.pattern } : {}), ...(def.format ? { format: def.format } : {}),
    ...(def.min !== undefined ? { min: def.min } : {}), ...(def.max !== undefined ? { max: def.max } : {}),
  };
  const many = def.many ? 'many' : 'one';
  if (def.ref) {
    const choices = await refChoices(def.ref, ctx);
    return choices ? { ...base, kind: many, choices } : { ...base, kind: 'text' };
  }
  if (def.values) return { ...base, kind: many, choices: def.values.map((value) => ({ value, label: def.labels?.[String(value)] ?? String(value) })) };
  return { ...base, kind: def.type ?? 'text' };
}

/** The flow's act, and each step's field as it says it; or why not. */
function partsOf(flow: Flow): { act: Act; input: Readonly<Record<string, StoredField>> } | { refused: string } {
  const act = actOf(flow.act);
  if (!act) return { refused: `There is no act "${flow.act}".` };
  const gone = flow.steps.find((s) => !act.input?.[s.field]);
  return gone ? { refused: `${act.label} takes no "${gone.field}".` } : { act, input: act.input ?? {} };
}

/** Every step whose `when` holds now, as Asks: the dialog's form, a step hidden when its `when` stops holding. None for
 *  a flow whose act is not there. */
export async function stepsOf(flow: Flow, answers: FlowAnswers, ctx: FlowContext): Promise<Ask[]> {
  const parts = partsOf(flow);
  if ('refused' in parts) return [];
  return Promise.all(holding(flow, answers).map((s) => askOf(s.field, parts.input[s.field]!, ctx)));
}

/** The answers of the steps that hold, a skipped one left out: the act's input. */
function inputOf(steps: readonly FlowStep[], answers: FlowAnswers): Row {
  return Object.fromEntries(steps.filter((s) => !empty(answers[s.field])).map((s) => [s.field, answers[s.field]]));
}

/** An answer as a reader reads it: a choice by its label, a list as a list, yes or no. */
function said(value: unknown, ask: Ask): string {
  if (Array.isArray(value)) return listed(value.map((v) => said(v, ask)));
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return ask.choices?.find((c) => c.value === value)?.label ?? String(value);
}

/** The keys an act runs on, named by their rows' titles: `User "Ana" and "Bo"`. */
async function targetsOf(act: Act, ctx: FlowContext): Promise<string | undefined> {
  const keys = ctx.keys ?? [];
  if (!act.type || !keys.length) return undefined;
  const store = storeOfType(ctx.stores, act.type);
  const type = entityTypes()[act.type];
  const title = type ? titleOf(type) : store?.key ?? 'id';
  const names = await Promise.all(keys.map(async (key) => String((store ? await store.byKey(key) : undefined)?.[title] ?? key)));
  return `${type?.label ?? act.type} ${listed(names.map((n) => `"${n}"`))}`;
}

/** The first step still unanswered, else — every step answered — the confirm, its words naming each answer, or the
 *  run where the flow asks nothing first. Why not, in words, for a flow whose act is not there. */
export async function nextStep(flow: Flow, answers: FlowAnswers, ctx: FlowContext): Promise<NextStep> {
  const parts = partsOf(flow);
  if ('refused' in parts) return parts;
  const steps = holding(flow, answers);
  const open = steps.find((s) => !(s.field in answers));
  if (open) return { step: await askOf(open.field, parts.input[open.field]!, ctx) };
  const input = inputOf(steps, answers);
  if (!(flow.confirm ?? parts.act.changes)) return { run: input };
  const words = await Promise.all(steps.filter((s) => s.field in input).map(async (s) => {
    const ask = await askOf(s.field, parts.input[s.field]!, ctx);
    return `${ask.label} ${said(input[s.field], ask)}`;
  }));
  const targets = await targetsOf(parts.act, ctx);
  return { confirm: `${parts.act.label}: ${[...(targets ? [targets] : []), ...words].join(', ')}.`, input };
}

/** Why an answer is refused: the whole sentence, for the chat; and its field's own words, for the field it is under. */
export interface StepRefusal {
  refused: string;
  field: string;
  error: string;
}

/** One answer, checked as the act checks it — its rules, a reference a row of its type — and only for a step asked now.
 *  Null, or nothing, skips a step that is not required. The answers with it, or why not, in words. */
export async function answerStep(flow: Flow, answers: FlowAnswers, field: string, value: unknown, ctx: FlowContext): Promise<{ answers: FlowAnswers } | StepRefusal | { refused: string }> {
  const parts = partsOf(flow);
  if ('refused' in parts) return parts;
  const def = parts.input[field];
  if (!def || !holding(flow, answers).some((s) => s.field === field)) return { refused: `${parts.act.label} does not ask "${field}" now.` };
  const label = def.label ?? field;
  // The field's own words: its label is the field's, so a fault said with it drops it.
  const refuse = (faults: readonly string[]): StepRefusal => {
    const own = faults.map((f) => (f.startsWith(`${label}: `) ? f.slice(label.length + 2) : f)).join('; ');
    return { refused: `${parts.act.label}: ${faults.join('; ')}.`, field, error: own.charAt(0).toUpperCase() + own.slice(1) };
  };
  if (empty(value)) return def.required ? refuse([`it needs ${label}`]) : { answers: { ...answers, [field]: null } };
  const wrong = await inputFaults({ [field]: def }, { [field]: value }, ctx);
  return wrong.length ? refuse(wrong) : { answers: { ...answers, [field]: value } };
}
