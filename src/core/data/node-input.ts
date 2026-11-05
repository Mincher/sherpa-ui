/**
 * node-input.ts — what a node READS from what reaches an input: what it needs, else `null`, and why in words.
 * Before a run, what reaches is what the graph says: its source's type, finer where its kind says (rows, a list,
 * a number), and the value its source holds. Any route joins any input; a socket's type is what it needs where
 * nothing says more (TODO 770). A warning, never a fault: Save does not wait. DOM-free.
 * Will, TODOs 764, 770 · TRAP T-a-node-reads-null-from-what-it-cannot-use
 *
 * Map:
 * - Given — What reaches an input, as finely as its source says: a value, a number, a boolean, an object, a list or rows.
 * - Need — What an input can use: its socket's type, a number, a date, rows, a list, one of its choices, an operator.
 * - INPUT_WORDS — Each need and each given in words: the one place a warning's words come from.
 * - Reached — One thing that reaches an input: its kind, and the value its source holds.
 * - InputNeeds — An input as a warning names it: its label, what it needs, and its choices.
 * - needOf — What an input needs, by its kind's own description: its `needs`, its control, its field, else its type.
 * - givenAt — What one output socket sends; none, where its source holds no value to send, or it is no output.
 * - truthOf — A value as the boolean it says: true or false, the words, a number; none, it says no boolean.
 * - Coercion — One cell of the coercions: what an input needs, what it is given, what it reads, in words.
 * - COERCIONS — Every coercion an input reads, in one place: a boolean as 1 or 0, a word, JSON; a number or word as a boolean.
 * - coerce — What an input that needs one thing reads of another, by COERCIONS; none, it reads no such thing.
 * - readInput — What an input reads of what reaches it: the value, coerced, or null and why, in words.
 */
import { typedValue } from './filter-state.js';
import { isDateTime } from './format-date.js';
import { OP_LABELS } from './store.js';
import { FALSE_SOCKET, SOCKET_WORDS, fixedChoices, kindOfNode, rowOf, socketType, type NodeKind, type RowChoice, type RowKind } from './node-kinds.js';

/** What reaches an input, as finely as its source says: its socket's type, or rows, a list or a number. */
export type Given = 'value' | 'number' | 'boolean' | 'object' | 'list' | 'rows';

/** What an input can use: its socket's type, or finer. `choice`: one of its fixed list; `numbers`: a list of numbers. */
export type Need = 'value' | 'boolean' | 'object' | 'number' | 'date' | 'rows' | 'list' | 'numbers' | 'choice' | 'operator';

/** Each need and each given in words: the one place a warning's words come from. */
export const INPUT_WORDS: Readonly<Record<Exclude<Need, 'choice'> | Given, string>> = {
  value: SOCKET_WORDS.value, object: SOCKET_WORDS.object, boolean: SOCKET_WORDS.boolean,
  number: 'a number', date: 'a date', rows: 'rows', list: 'a list', numbers: 'a list of numbers', operator: 'an operator',
};

/** One thing that reaches an input: its kind, and the value its source holds, where it holds one. */
export interface Reached {
  kind: Given;
  value?: unknown;
}

/** An input as a warning names it: its label (a row's, or the node's heading for its header), its need and its choices. */
export interface InputNeeds {
  label: string;
  needs?: Need;
  choices?: readonly RowChoice[];
}

/** What an input needs, by its kind's own description — a row's, or a header's: its `needs`; a number or a date by
 *  its control; one of a fixed list, or an operator; a list where it picks several; a comparison's Value by its field's
 *  `type`; else its socket's type (TODO 770). None: an `any` that says nothing takes anything. */
export function needOf(input: Pick<RowKind, 'needs' | 'control' | 'multiple' | 'input'>, type?: string): Need | undefined {
  if (input.needs) return input.needs;
  if (input.control === 'number') return 'number';
  if (input.control === 'datetime') return 'date';
  if (input.control === 'op') return 'operator';
  if (fixedChoices(input.control)) return 'choice';
  if (input.multiple && input.input === 'object') return type === 'number' ? 'numbers' : 'list';
  if (input.control === 'values' && (type === 'number' || type === 'date')) return type;
  return input.input === 'any' ? undefined : input.input;
}

/** What one output socket sends: its type, finer where its row says, and the value a row with a control holds.
 *  None: no such output, or a row that holds no value, which sends nothing (D2). */
export function givenAt(node: { kind: string; values?: Readonly<Record<string, unknown>> } | undefined, row: string | undefined, kinds: Readonly<Record<string, NodeKind>>): Reached | undefined {
  const kind = kindOfNode(kinds, node);
  if (!kind) return undefined;
  if (row === undefined || row === FALSE_SOCKET) {
    const type = socketType(kind, row, 'output');
    return type && type !== 'any' ? { kind: type } : undefined;
  }
  const out = rowOf(kind.rows, row);
  if (!out?.output || out.output === 'any') return undefined;
  const value = node!.values?.[row];
  if (out.control && (value === undefined || value === '')) return undefined;
  return { kind: out.gives ?? out.output, ...(out.control ? { value } : {}) };
}

const isNumber = (value: unknown): boolean => typeof typedValue('number', value) === 'number';

/** A value as the boolean it says: `true` or `false`; the words true and false, in any case; a number, or one written
 *  as text, 0 False and any other True (D2). Will, TODOs 780, 781: "0/1 or True or False is data". None: other text,
 *  a list, an object. `truthy` is the road a value takes (D2), not this. */
export function truthOf(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  const said = typeof value === 'string' ? value.trim().toLowerCase() : undefined;
  if (said === 'true' || said === 'false') return said === 'true';
  const n = typedValue('number', value);
  return typeof n === 'number' && Number.isFinite(n) ? n !== 0 : undefined;
}

/** One cell of the coercions: what an input needs (`json`: what a value is written as in JSON), what it is given, what
 *  it reads — none, it reads no such thing — and the rule in words. */
export interface Coercion {
  needs: Need | 'json';
  given: Given;
  said: string;
  reads(value: unknown): unknown;
}

const bool = (value: unknown): boolean | undefined => truthOf(value);

/** Every coercion an input reads, in one place, never a node's own (Will, TODO 781: "Where booleans need to be a number
 *  then nodes should convert True/False to 1/0. Where they need to be a String (or part of a larger JSON object) then the
 *  inverse should be handled."). A value coerced is used, and no warning. */
export const COERCIONS: readonly Coercion[] = [
  { needs: 'number', given: 'boolean', said: 'True reads as 1, False as 0', reads: (v) => (bool(v) === undefined ? undefined : bool(v) ? 1 : 0) },
  { needs: 'value', given: 'boolean', said: 'True reads as the word true, False as false: never 1 or 0', reads: (v) => (bool(v) === undefined ? undefined : String(bool(v))) },
  { needs: 'json', given: 'boolean', said: 'In JSON, True is true and False false: never 1 or 0', reads: bool },
  { needs: 'boolean', given: 'number', said: '0 reads as False, any other number True (D2)', reads: bool },
  { needs: 'boolean', given: 'value', said: 'The words true and false read as their boolean, and a number written as text as that number; other text says no boolean', reads: bool },
];

/** What is given, as a cell of COERCIONS names it: a boolean (its kind, or a value held as one), a number, a value. */
function givenOf({ kind, value }: Reached): Given {
  if (kind === 'boolean' || typeof value === 'boolean') return 'boolean';
  if (kind === 'number' || (value !== undefined && typeof typedValue('number', value) === 'number')) return 'number';
  return kind;
}

/** What an input that needs one thing reads of another, by COERCIONS: the value — none yet, where only a run gives it
 *  — or no answer, where no cell reads it. */
export function coerce(needs: Need | 'json', reached: Reached): { value: unknown } | undefined {
  const given = givenOf(reached);
  const cell = COERCIONS.find((c) => c.needs === needs && c.given === given);
  if (!cell) return undefined;
  if (reached.value === undefined) return { value: undefined };
  const value = cell.reads(reached.value);
  return value === undefined ? undefined : { value };
}

/** Whether a need takes what reaches it: by its kind, and by the value where one is held. */
function fits(need: Need, { kind, value }: Reached, choices: readonly RowChoice[] = []): boolean {
  const held = value !== undefined;
  switch (need) {
    case 'value': return kind === 'value' || kind === 'number';
    case 'boolean': return kind === 'boolean' && (!held || truthOf(value) !== undefined);
    case 'object': return kind === 'object' || kind === 'list' || kind === 'rows';
    case 'rows': return kind === 'object' || kind === 'rows';
    case 'list': return kind === 'object' || kind === 'list';
    case 'numbers': return (kind === 'object' || kind === 'list') && (!held || [value].flat().every(isNumber));
    case 'number': return (kind === 'value' || kind === 'number') && (!held || isNumber(value));
    case 'date': return kind === 'value' && (!held || isDateTime(String(value)));
    case 'operator': return kind === 'value' && (!held || String(value) in OP_LABELS);
    case 'choice': return kind === 'value' && (!held || choices.some((c) => c.value === String(value)));
  }
}

const or = (words: readonly string[]): string => new Intl.ListFormat('en', { type: 'disjunction' }).format(words);
const and = (words: readonly string[]): string => new Intl.ListFormat('en', { type: 'conjunction' }).format(words);

/** What reached, in words: the value its source holds, quoted, or its kind's words. */
function givenWords(need: Need, { kind, value }: Reached): string {
  if (value === undefined) return INPUT_WORDS[kind];
  if (!Array.isArray(value)) return `"${String(value)}"`;
  return need === 'numbers' ? `a list with ${and(value.filter((v) => !isNumber(v)).map((v) => `"${String(v)}"`))}` : INPUT_WORDS.list;
}

/** What an input reads of what reaches it: the value where it can use it; else the value COERCIONS reads of it, with no
 *  warning (TODO 781); else `null`, and why, in words — "Value A takes a number; it was given "abc"". An input that needs
 *  nothing takes all. TRAP T-a-node-reads-null-from-what-it-cannot-use */
export function readInput(input: InputNeeds, reached: Reached): { value: unknown; warning?: string } {
  const { label, needs, choices } = input;
  if (!needs || fits(needs, reached, choices)) return { value: reached.value };
  const coerced = coerce(needs, reached);
  if (coerced) return coerced;
  const wants = needs === 'choice' ? or((choices ?? []).map((c) => c.label)) : INPUT_WORDS[needs];
  return { value: null, warning: `${label} takes ${wants}; it was given ${givenWords(needs, reached)}` };
}
