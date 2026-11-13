/**
 * node-simulate.ts — SIMULATE a graph: the cached rows go in at each Source and come out of every node, as a ROW LIST
 * on each socket: what the node would hear and what it would say. It reads rows and writes nothing: no store is asked,
 * no clock is read but the one given. A Condition's rows are the rows into its Field that its test keeps, run by the
 * same `filterTest` a page runs; a Source with no cached rows is "not fetched yet". The kinds beyond Source, Field,
 * Condition, Time and Tag (tests, And, Or), Value, Math, Text, Sort, Group, a Custom Node (its body run, given by the host) and Output are simulated. Pure: no DOM. Will, TODO 836 · docs/history/plan-836-data-through-nodes.md
 * · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 *
 * Map:
 * - SimulateFacts — What a simulation reads beyond its graph and rows: the clock a relative date means.
 * - Slot — What one socket hears or says: its rows, a field's name or a value, and where it comes from.
 * - SimulatedNode — One node: each input socket's slot, and each output socket's; an Output's, what it would do; Not taken.
 * - Simulated — Every node's slots, and each fault in words.
 * - Sent — What an output socket sends: rows, a field, a value, or nothing and why.
 * - simulateGraph — The graph run on the cached rows: what each node hears and says, a row list on each socket.
 * - SimulationRun — A simulation in steps: the nodes it runs, one step each, and what has run.
 * - SteppingOptions — How a stepped simulation lets its host in: before each node, and a pause when one is due.
 * - SimulationControl — A simulation's play, pause and stop, held by its host.
 * - .paused — Is it held between nodes?
 * - .stopped — Has it ended?
 * - .pause — Hold before the next node; the one in hand finishes.
 * - .play — Go on from the node it waits at.
 * - .stop — End the run, keeping the nodes done.
 * - .turn — Before a node: waits while paused, and says whether to go on.
 * - stepSimulation — Step a simulation node by node, giving the host a turn when one is due.
 * - lightOf — A node's light after a simulation: the rows it heard and said, "412 → 87"; an Output's, what it would do.
 * - simulation — Begin a simulation; nothing runs until it is stepped.
 */
import { filterTest, OP_LABELS, OP_TAKES, type Filter, type FilterOp, type Row } from './store.js';
import { needOf, pickSent, readInput, truthOf, type Given } from './node-input.js';
import { leafOf } from './node-flow.js';
import { portalFlow } from './node-portals.js';
import { isOutput } from './node-routes.js';
import { socketOf, truthy, type DrawnGraph, type GraphNode } from './node-kinds.js';
import { START } from './node-start.js';
import { entityTypes } from './entity-types.js';

/** What a simulation reads beyond its graph and rows: the clock a relative date means (left out, the machine's), and
 *  where a fetch stopped at its cap, by store, in words: a Source says it beside its rows. */
export interface SimulateFacts {
  now?: Date;
  partial?: Readonly<Record<string, string>>;
  /** A Custom Node's body, drawn: its Group Input is `#in` and its Group Output `#out`. None for a node that has none. */
  inner?(node: GraphNode): DrawnGraph | undefined;
}

/** What one socket hears or says: its rows (a row list), a field's name, or a value; and where it comes from, as
 *  the socket addresses of the connections that bring it. `note` says why it holds no rows: not fetched, not simulated. */
export interface Slot {
  socket: string;
  label: string;
  kind: 'rows' | 'field' | 'value';
  rows?: readonly Row[];
  value?: unknown;
  from: readonly string[];
  note?: string;
  /** Down a way a Check did not take (plan 944). */
  notTaken?: true;
}

/** One node: each input socket's slot, and each output socket's; an Output's, what it would do; down a way not taken, so. */
export interface SimulatedNode {
  incoming: readonly Slot[];
  outgoing: readonly Slot[];
  would?: string;
  notTaken?: true;
}

/** Every node's slots, by id, and each fault in words. */
export interface Simulated {
  nodes: Record<string, SimulatedNode>;
  faults: string[];
}

/** What an output socket sends: rows, a field (its name, and the rows into it), or nothing and why; down a way a Check did
 *  not take, `notTaken` (plan 944). */
export type Sent = { kind: 'rows' | 'field' | 'value'; rows?: readonly Row[]; value?: unknown; note?: string; notTaken?: true };

/** A test's verdict: the rows it keeps and those it does not; whether it passed; a joiner's, how many inputs pass and fail. */
interface Verdict {
  kept: Row[];
  lost: Row[];
  passed?: boolean;
  pass?: number;
  fail?: number;
}

/** What a Check and a joiner read as true (939): rows where any came, a boolean as itself, a number above zero, else not
 *  empty. */
function holds(s: Sent): boolean {
  if (s.rows) return s.rows.length > 0;
  const v = s.value;
  if (typeof v === 'boolean') return v;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
  if (n !== undefined) return n > 0;
  return v != null && v !== '' && !(Array.isArray(v) && !v.length);
}

/** The kinds whose True is a test of a field. */
const TESTS = new Set(['condition', 'time', 'tag']);

/** A node's rows kept in the order of the first list, each once. */
function union(lists: readonly (readonly Row[])[]): Row[] {
  const seen = new Set<Row>();
  const out: Row[] = [];
  for (const list of lists) for (const row of list) if (!seen.has(row)) { seen.add(row); out.push(row); }
  return out;
}

/** The rows every list holds, in the first list's order. */
function common(lists: readonly (readonly Row[])[]): Row[] {
  const [first = [], ...rest] = lists;
  const others = rest.map((l) => new Set(l));
  return first.filter((row) => others.every((o) => o.has(row)));
}

/**
 * The graph run on the cached rows. Each Source sends its store's rows (`rowsByStore`, by store id; a store not in it is
 * "not fetched yet"). A Field sends its name and the rows into it. A test (Condition, Time, Tag) keeps the rows into its
 * Field that its test holds, and its False the rest; And and Or keep what every part kept, or what any part kept. An
 * Output hears what is connected to it. Another kind says "not simulated yet". A connection through a portal is read as the
 * data flows (`portalFlow`). The same in gives the same out.
 */
export function simulateGraph(graph: DrawnGraph, rowsByStore: Readonly<Record<string, readonly Row[] | undefined>>, facts: SimulateFacts = {}): Simulated {
  const run = simulation(graph, rowsByStore, facts);
  for (const id of run.ids) run.step(id);
  return run.result();
}

/** A simulation in steps: the ids of the nodes it runs, in the graph's order; `step` runs one (and, lazily, what it hears),
 *  `result` is what has run. A host that wants to show the node it is on, and let the page draw between nodes, steps it;
 *  `simulateGraph` steps it whole. The same in gives the same out. TODO 845 */
export interface SimulationRun {
  ids: readonly string[];
  step(id: string): void;
  result(): Simulated;
  /** What an input socket hears now, as the connections bring it (a Custom Node reads its body's Group Output so). */
  hears(address: string): Slot;
}

/** How a stepped simulation lets its host in: it is told each node before it runs; and once a node has run longer than `every`
 *  ms since the host last had a turn, it waits for `pause` (a frame, a timer), so the page can draw the node it is on. */
export interface SteppingOptions {
  onStep?(id: string): void;
  /** A node has run, and took this long (ms). */
  onDone?(id: string, ms: number): void;
  pause?(): Promise<void>;
  /** Play, pause and stop: asked before each node. */
  control?: SimulationControl;
  /** The run is paused or goes on: the node it waits at. */
  onPause?(paused: boolean, at: string | undefined): void;
  now?(): number;
  every?: number;
}

/** A simulation's play, pause and stop, held by its host. Pause lets the node in hand finish and goes no further;
 *  play goes on from the next node; stop ends the run, keeping the nodes done. */
export class SimulationControl {
  /** Held between nodes until `play`. */
  #paused = false;
  /** Ended: no node after this one runs. */
  #stopped = false;
  /** Lets a waiting `turn` go on. */
  #resume: (() => void) | undefined;

  get paused(): boolean {
    return this.#paused;
  }

  get stopped(): boolean {
    return this.#stopped;
  }

  pause(): void {
    if (!this.#stopped) this.#paused = true;
  }

  play(): void {
    this.#paused = false;
    this.#resume?.();
  }

  stop(): void {
    this.#stopped = true;
    this.play();
  }

  /** Before a node: waits while paused, and says whether to go on. */
  async turn(): Promise<boolean> {
    while (this.#paused && !this.#stopped) await new Promise<void>((done) => { this.#resume = done; });
    this.#resume = undefined;
    return !this.#stopped;
  }
}

/** Step a simulation node by node, in order, giving the host a turn when one is due. The same result as stepping it whole. */
export async function stepSimulation(run: SimulationRun, options: SteppingOptions = {}): Promise<Simulated> {
  const now = options.now ?? ((): number => performance.now());
  const every = options.every ?? 16;
  let last = now();
  for (const id of run.ids) {
    if (options.control) {
      const held = options.control.paused;
      if (held) options.onPause?.(true, id);
      if (!(await options.control.turn())) break;
      if (held) options.onPause?.(false, id);
    }
    options.onStep?.(id);
    const began = now();
    run.step(id);
    options.onDone?.(id, now() - began);
    if (options.pause && now() - last > every) {
      await options.pause();
      last = now();
    }
  }
  return run.result();
}

/** A run's value as a coercion names what is given: a boolean, a number, a list, an object, or a value. */
function givenOf(value: unknown): Given {
  return typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : Array.isArray(value) ? 'list' : value && typeof value === 'object' ? 'object' : 'value';
}

/** What a node that sends a value says on its light, as = 42. */
function valueWords(slots: readonly Slot[]): string | undefined {
  const said = slots.find((s) => s.kind === 'value' && s.value !== undefined);
  if (!said) return undefined;
  const words = typeof said.value === 'string' ? said.value : JSON.stringify(said.value);
  return `= ${words.length > 24 ? `${words.slice(0, 23)}…` : words}`;
}

/** A node's LIGHT after a simulation: the rows it heard and the rows it said, "412 → 87", and the time it took; a Source or an
 *  Output has the one count; one that holds no rows says why. */
export function lightOf(node: SimulatedNode, ms: number): string {
  const count = (slots: readonly Slot[]): number | undefined => slots.find((s) => s.rows)?.rows?.length;
  const n = (v: number): string => v.toLocaleString('en');
  // Fed, but by no rows: a test of one value. It says its value, not "0 rows".
  const heard = count(node.incoming);
  const said = heard === undefined && node.incoming.some((s) => s.from.length) ? undefined : count(node.outgoing);
  const rows = heard !== undefined && said !== undefined ? `${n(heard)} → ${n(said)}`
    : heard !== undefined || said !== undefined ? `${n((heard ?? said)!)} ${(heard ?? said) === 1 ? 'row' : 'rows'}`
      : valueWords(node.outgoing) ?? [...node.incoming, ...node.outgoing].find((s) => s.note)?.note ?? '';
  const time = ms < 1 ? '<1 ms' : `${Math.round(ms).toLocaleString('en')} ms`;
  if (node.notTaken) return `Not taken · ${time}`;
  // An Output says what it would do, and its rows: it does nothing (plan 891).
  const words = node.would ? [node.would, heard !== undefined ? rows : ''] : [rows];
  return [...words, time].filter(Boolean).join(' · ');
}


/** Begin a simulation: nothing runs until it is stepped. */
export function simulation(graph: DrawnGraph, rowsByStore: Readonly<Record<string, readonly Row[] | undefined>>, facts: SimulateFacts = {}, seeds: ReadonlyMap<string, Sent> = new Map(), depth = 0): SimulationRun {
  const now = facts.now ?? new Date();
  const connections = portalFlow(graph.nodes, graph.connections).connections;
  const held = new Map(graph.nodes.map((n) => [n.id, n]));
  const faults: string[] = [];
  const said = new Set<string>();
  const fault = (words: string): void => { if (!said.has(words)) { said.add(words); faults.push(words); } };
  const sent = new Map<string, Sent>();
  const busy = new Set<string>();

  /** Does a node join its inputs — And, Or — and say how many pass and fail? */
  const joins = (node: GraphNode | undefined): boolean =>
    node?.kind === 'condition' && ['and', 'or'].includes(String(node.rows.find((r) => r.name === 'type')?.value ?? ''));
  /** What flows into a socket, as each connection brings it. What a Condition's type ignores there, it does not hear (940). */
  const into = (address: string): { from: string; sent: Sent }[] => {
    const { node: id, row } = socketOf(address);
    const ignored = row === undefined ? held.get(id)?.ignored?.from : undefined;
    return connections.filter((r) => r.to === address && !ignored?.includes(r.from)).map((r) => ({ from: r.from, sent: sends(r.from) }));
  };
  /** Whether a node runs: not where all that reaches its header — or, with none there, its rows — comes down a way a Check
   *  did not take, or from a node that did not run (plan 944). */
  const taken = (node: GraphNode): boolean => {
    const head = connections.filter((r) => r.to === node.id);
    const came = head.length ? head : connections.filter((r) => socketOf(r.to).node === node.id);
    return !came.length || came.some((r) => !sends(r.from).notTaken);
  };
  /** A Check's Yes or No (plan 944, D1 A): its test holds where what comes in is true; the way taken sends what reaches its
   *  Data, else the test itself; the other is not taken, so nothing after it runs. */
  const checked = (node: GraphNode, row: string | undefined): Sent => {
    const test = into(node.id).map((p) => p.sent);
    if (!test.length) return { kind: 'value', note: `"${node.heading}" tests nothing: connect a test in` };
    const quiet = test.find((t) => t.note && t.value === undefined && !t.rows);
    if (quiet && test.length === 1) return { kind: 'value', note: quiet.note! };
    const yes = test.some(holds);
    if ((row === 'yes') !== yes) return { kind: 'value', note: 'Not taken', notTaken: true };
    return into(`${node.id}/data`)[0]?.sent ?? test[0]!;
  };
  /** The rows that reach a socket, each once; none at all when none of its connections brings rows (not fetched, not simulated). */
  const rowsInto = (address: string): Row[] | undefined => {
    const lists = into(address).flatMap((p) => (p.sent.rows ? [p.sent.rows] : []));
    return lists.length ? union(lists) : undefined;
  };

  /** What a test says: the rows of its Field that its leaf keeps, and those it does not; of one value, whether it passes; a
   *  fault in words; or, where no rows reach it, why: that was said upstream. */
  const test = (node: GraphNode): Verdict | string | { note: string } => {
    const read = leafOf(graph, node);
    if ('fault' in read) return valueTest(node) ?? read.fault;
    const fed = into(node.id).find((p) => p.sent.kind === 'field')?.sent;
    const base = fed?.rows;
    if (!base) return { note: fed?.note ?? 'No rows reach it' };
    const keep = filterTest([read.leaf.field, read.leaf.op, ranValue(node, read.leaf.value)] as Filter, now);
    const kept: Row[] = [];
    const lost: Row[] = [];
    for (const row of base) (keep(row) ? kept : lost).push(row);
    return { kept, lost };
  };

  /** What a Condition tests against in a RUN: where a connection reaches Value B, the Values, or Start and End, the value it
   *  brings (a Math result, a Count), read by `heard`; else the leaf's own, as the graph holds it. */
  const ranValue = (node: GraphNode, held: unknown): unknown => {
    const joined = (name: string): boolean => node.kind === 'condition' && into(`${node.id}/${name}`).length > 0;
    const range = ['start', 'end'];
    if (range.some(joined)) {
      const at = (name: string): unknown => (joined(name) ? heard(node, name).value : node.rows.find((r) => r.name === name)?.value);
      return range.map(at).filter((v) => v != null && v !== '');
    }
    return joined('b') ? heard(node, 'b').value : held;
  };

  /** A test of ONE value, with no Field: a Count into Greater than (Will, 2026-11-11) tests it against Value B, the Values,
   *  or Start and End; Not and Is empty read its truth, and Is empty rows by whether any came. It passes or fails, and keeps
   *  no rows. None where nothing it can test comes in. */
  const valueTest = (node: GraphNode): Verdict | { note: string } | undefined => {
    const came = into(node.id).map((p) => p.sent);
    if (came.some((s) => s.kind === 'field')) return undefined;
    const type = String(node.rows.find((r) => r.name === 'type')?.value ?? '');
    const rows = came.find((s) => s.rows)?.rows;
    if (type === 'empty' && rows) return { kept: [], lost: [], passed: !rows.length };
    const sent = came.find((s) => s.kind === 'value' && s.value !== undefined);
    // A value that did not come — a Math that could not add — says why, where its rows would.
    const quiet = came.find((s) => s.kind === 'value' && s.note);
    if (!sent) return quiet ? { note: quiet.note! } : undefined;
    const said = (passed: boolean): Verdict => ({ kept: [], lost: [], passed });
    if (type === 'not') return said(!(truthOf(sent.value) ?? truthy(sent.value)));
    if (type === 'empty') return said(!truthy(sent.value));
    if (!(type in OP_LABELS)) return undefined;
    const range = OP_TAKES[type as FilterOp] === 'range';
    const against = range ? [heard(node, 'start'), heard(node, 'end')] : [heard(node, 'b')];
    const empty = against.find((a) => a.note);
    if (empty) return { note: empty.note! };
    const b = range ? against.map((a) => a.value) : against[0]!.value;
    return said(filterTest(['value', type, b] as Filter, now)({ value: sent.value }));
  };

  /** A Condition's verdict, by its kind: a test keeps rows; And and Or join their inputs, each true where it is above zero,
   *  true, or not empty. `passed` is its True, 1 or 0; Pass and Fail count its inputs. */
  const verdict = (node: GraphNode): Verdict | string | { note: string } => {
    const type = node.rows.find((r) => r.name === 'type')?.value;
    if (node.kind === 'condition' && (type === 'and' || type === 'or')) {
      const came = into(node.id);
      if (!came.length) return `"${node.heading}" joins nothing: connect its inputs in`;
      const each = came.map(({ sent: s }) => ({ ok: holds(s), ...(s.rows ? { rows: s.rows } : {}) }));
      const pass = each.filter((e) => e.ok).length;
      const passed = type === 'or' ? pass > 0 : pass === each.length;
      const parts = each.flatMap((e) => (e.rows ? [e.rows] : []));
      const kept = type === 'or' ? union(each.flatMap((e) => (e.ok && e.rows ? [e.rows] : []))) : passed ? common(parts) : [];
      const keeps = new Set(kept);
      return { kept, lost: union(parts).filter((row) => !keeps.has(row)), passed, pass, fail: each.length - pass };
    }
    return test(node);
  };

  /** What an input row hears: a connected value, read as the row's need reads it by the ONE table the drawn graph reads
   *  (`readInput`, COERCIONS) — a True into a number is 1, a number into a boolean its truth; what it cannot use is nothing,
   *  and why. Else the row's own value. TRAP T-a-node-reads-null-from-what-it-cannot-use */
  const heard = (node: GraphNode, name: string): Sent => {
    const first = into(`${node.id}/${name}`)[0]?.sent;
    const own = node.rows.find((r) => r.name === name);
    if (!first) return own?.value === undefined || own.value === '' ? { kind: 'value', note: `${own?.label ?? name} is empty` } : { kind: 'value', value: own.value };
    if (first.kind !== 'value') return { kind: 'value', note: first.note ?? 'Nothing it can use arrives' };
    const needs = own && needOf(own);
    if (first.note || first.value === undefined || !needs) return first;
    const read = readInput({ label: own.label, needs }, { kind: givenOf(first.value), value: first.value });
    return read.warning ? { kind: 'value', note: read.warning } : { ...first, value: read.value };
  };
  const number = (sent: Sent): number | string => {
    if (sent.note) return sent.note;
    const n = typeof sent.value === 'number' ? sent.value : Number(sent.value);
    return Number.isFinite(n) ? n : `"${String(sent.value)}" is not a number`;
  };
  const listOf = (sent: Sent): unknown[] | string => (sent.note ? sent.note : Array.isArray(sent.value) ? sent.value : typeof sent.value === 'string' ? sent.value.split(',').map((v) => v.trim()) : 'It needs a list');

  /** A Math node's result: a number, or why there is none, in words. */
  const math = (node: GraphNode): Sent => {
    const type = String(node.rows.find((r) => r.name === 'type')?.value ?? 'add');
    const fail = (note: string): Sent => ({ kind: 'value', note });
    // Count: how many rows come in (plan 944).
    if (type === 'count') {
      const rows = rowsInto(`${node.id}/rows`);
      return rows ? { kind: 'value', value: rows.length } : fail(into(`${node.id}/rows`).find((p) => p.sent.note)?.sent.note ?? 'No rows reach it');
    }
    if (type === 'floor' || type === 'ceiling' || type === 'average') {
      const list = listOf(heard(node, 'values'));
      if (typeof list === 'string') return fail(list);
      const nums = list.map(Number);
      if (!nums.length || nums.some((n) => !Number.isFinite(n))) return fail('The list holds no numbers, or one that is not');
      return { kind: 'value', value: type === 'floor' ? Math.min(...nums) : type === 'ceiling' ? Math.max(...nums) : nums.reduce((a, b) => a + b, 0) / nums.length };
    }
    const a = number(heard(node, 'a'));
    if (typeof a === 'string') return fail(a);
    if (type === 'round') {
      const places = number(heard(node, 'places'));
      if (typeof places === 'string') return fail(places);
      const f = 10 ** places;
      return { kind: 'value', value: Math.round(a * f) / f };
    }
    const b = number(heard(node, 'b'));
    if (typeof b === 'string') return fail(b);
    if (type === 'divide' || type === 'ratio') return b === 0 ? fail('It divides by zero') : { kind: 'value', value: a / b };
    return { kind: 'value', value: type === 'subtract' ? a - b : type === 'multiply' ? a * b : a + b };
  };

  /** A Text node's result. */
  const text = (node: GraphNode): Sent => {
    const type = String(node.rows.find((r) => r.name === 'type')?.value ?? 'append');
    const word = (name: string): string | Sent => { const h = heard(node, name); return h.note ? h : String(h.value ?? ''); };
    if (type === 'join') {
      const list = listOf(heard(node, 'values'));
      const sep = word('separator');
      if (typeof list === 'string') return { kind: 'value', note: list };
      return typeof sep === 'string' ? { kind: 'value', value: list.join(sep) } : sep;
    }
    const a = word(type === 'split' ? 'a' : 'a');
    if (typeof a !== 'string') return a;
    if (type === 'split') {
      const sep = word('separator');
      return typeof sep === 'string' ? { kind: 'value', value: sep === '' ? [a] : a.split(sep) } : sep;
    }
    const b = word('b');
    if (typeof b !== 'string') return b;
    return { kind: 'value', value: type === 'prepend' ? b + a : a + b };
  };

  /** A Value node's value, read as its type says. */
  const valued = (node: GraphNode): Sent => {
    const type = String(node.rows.find((r) => r.name === 'type')?.value ?? 'text');
    const own = node.rows.find((r) => r.name === 'value')?.value;
    if (own === undefined || own === '') return { kind: 'value', note: 'It holds no value' };
    if (type === 'integer' || type === 'decimal') { const n = Number(own); return Number.isFinite(n) ? { kind: 'value', value: type === 'integer' ? Math.trunc(n) : n } : { kind: 'value', note: `"${String(own)}" is not a number` }; }
    if (type === 'boolean') return { kind: 'value', value: own === true || own === 'true' || own === 1 || own === '1' };
    return { kind: 'value', value: own };
  };

  /** An Organise node's rows (plan 960 U4.2): those that contain its Search, in its Sort's order, then gathered by its Group,
   *  each value's rows in the order they stand, the groups in the order they first appear. Its axes pass them on as they are. */
  const organised = (node: GraphNode): Sent => {
    const came = into(node.id).map((p) => p.sent).find((s) => s.rows) ?? into(node.id)[0]?.sent;
    if (!came?.rows) return { kind: 'rows', note: came?.note ?? 'No rows reach it' };
    const own = (name: string): string => String(heard(node, name).value ?? '').trim();
    const search = own('search').toLowerCase();
    let rows = search ? came.rows.filter((r) => Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(search))) : [...came.rows];
    const sort = own('sort');
    if (sort) {
      const dir = own('direction') === 'desc' ? -1 : 1;
      rows = rows.sort((x, y) => {
        const a = x[sort], b = y[sort];
        return a == null ? (b == null ? 0 : 1) : b == null ? -1 : (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'en', { numeric: true })) * dir;
      });
    }
    const group = own('group');
    return { kind: 'rows', rows: group ? [...Map.groupBy(rows, (r) => String(r[group] ?? '')).values()].flat() : rows };
  };

  /** A Custom Node, run: its body is a graph of its own, its Group Input fed what the use hears, and what its Group Output
   *  hears is what the use sends. */
  const custom = (node: GraphNode, row: string | undefined): Sent | undefined => {
    const body = depth < 8 ? facts.inner?.(node) : undefined;
    if (!body) return undefined;
    const given = new Map<string, Sent>();
    for (const r of node.rows) if (r.input) { const came = into(`${node.id}/${r.name}`); given.set(`#in/${r.name}`, came[0] ? came[0].sent : heard(node, r.name)); }
    const inside = simulation(body, rowsByStore, facts, given, depth + 1);
    const out = row === undefined ? undefined : inside.hears(`#out/${row}`);
    if (!out) return undefined;
    return out.rows ? { kind: 'rows', rows: out.rows } : out.value !== undefined ? { kind: out.kind === 'field' ? 'field' : 'value', value: out.value } : { kind: 'value', note: out.note ?? 'Nothing reaches the Group Output' };
  };

  function sends(address: string): Sent {
    const seed = seeds.get(address);
    if (seed) return seed;
    const known = sent.get(address);
    if (known) return known;
    const { node: id, row } = socketOf(address);
    const node = held.get(id);
    if (!node) return { kind: 'value', note: `a connection comes from "${id}", which the graph does not hold` };
    if (busy.has(address)) return { kind: 'value', note: `"${node.heading}" reads itself, in a loop` };
    busy.add(address);
    const made = make(node, row);
    busy.delete(address);
    sent.set(address, made);
    return made;
  }

  /** What one output socket of a node sends. */
  function make(node: GraphNode, row: string | undefined): Sent {
    // Down a way a Check did not take, it does not run, and nor does what it feeds (plan 944).
    if (!taken(node)) return { kind: 'value', note: 'Not taken', notTaken: true };
    if (node.kind === 'check') return checked(node, row);
    if (joins(node) && (row === 'pass' || row === 'fail')) {
      const read = verdict(node);
      if (typeof read === 'string' || 'note' in read) return { kind: 'value', note: typeof read === 'string' ? read : read.note };
      return { kind: 'value', value: read[row] };
    }
    // A test's True: 1 where it holds, 0 where not (plan 944).
    if (TESTS.has(node.kind) && row === 'true') {
      const read = verdict(node);
      if (typeof read === 'string') {
        fault(read);
        return { kind: 'value', note: read };
      }
      if ('note' in read) return { kind: 'value', note: read.note };
      return { kind: 'value', value: (read.passed ?? read.kept.length > 0) ? 1 : 0 };
    }
    // A Field's Values sends its one value, or its list. TRAP T-a-multi-select-is-one-row
    const picks = row === undefined ? undefined : node.rows.find((r) => r.name === row && r.valuesOf);
    if (picks) return { kind: 'value', value: pickSent(picks.value) };
    if (node.kind === 'source') {
      const store = node.rows.find((r) => r.control === 'store')?.value;
      const rows = typeof store === 'string' ? rowsByStore[store] : undefined;
      if (!rows) {
        fault(`"${node.heading}" is not fetched yet`);
        return { kind: 'rows', note: 'Not fetched yet' };
      }
      const cut = typeof store === 'string' ? facts.partial?.[store] : undefined;
      // Its Rows picked, only those: by its type's key (plan 960 U4.9b). None picked, every row.
      const picked = node.rows.find((r) => r.control === 'rows')?.value;
      const keys = Array.isArray(picked) && picked.length ? new Set(picked.map(String)) : undefined;
      const key = typeof store === 'string' ? entityTypes()[store]?.key ?? 'id' : 'id';
      return { kind: 'rows', rows: keys ? rows.filter((row) => keys.has(String(row[key]))) : rows, ...(cut ? { note: cut } : {}) };
    }
    if (node.kind === 'field') {
      const name = node.rows.find((r) => r.gives === 'field')?.value;
      const rows = rowsInto(node.id);
      const note = into(node.id).find((p) => p.sent.note)?.sent.note;
      return { kind: 'field', value: name, ...(rows ? { rows } : note ? { note } : {}) };
    }
    if (TESTS.has(node.kind)) {
      const read = verdict(node);
      if (typeof read === 'string') {
        fault(read);
        return { kind: 'rows', note: read };
      }
      if ('note' in read) return { kind: 'rows', note: read.note };
      return { kind: 'rows', rows: read.kept };
    }
    if (node.kind === 'value') return valued(node);
    if (node.kind === 'math') return math(node);
    if (node.kind === 'text') return text(node);
    if (node.kind === 'organise') return organised(node);
    // A Model sends its pick (plans 926, 951).
    if (node.kind === 'model') return { kind: 'value', value: node.rows.find((r) => r.name === row)?.value };
    // An Output, an AI node or a Trigger acts outside the graph, so it fires nothing: each output sends a stand-in, by what it gives,
    // so what it feeds runs too (plans 891, 926). A True/false AI node's True is 1.
    if (isOutput(node) || node.would) {
      // A True, and a Trigger's header, which sends True when it fires (plan 949).
      if (row === 'true' || row === undefined) return { kind: 'value', value: 1 };
      const out = node.rows.find((r) => r.name === row);
      // A row the reader set sends what it holds: a Trigger's Endpoint, its own (plan 941).
      if (out?.control && out.value != null && out.value !== '') return { kind: 'value', value: out.value };
      if (out?.gives === 'rows') return { kind: 'rows', rows: [] };
      if (out?.gives === 'number') return { kind: 'value', value: 0 };
      if (out?.gives === 'list') return { kind: 'value', value: [] };
      return { kind: 'value', value: out?.gives === 'boolean' ? true : `${out?.label ?? row}, simulated` };
    }
    const ran = custom(node, row);
    if (ran) return ran;
    fault(`"${node.heading}" is not simulated yet`);
    return { kind: 'value', note: 'Not simulated yet' };
  }

  const slot = (address: string, label: string, side: 'in' | 'out'): Slot => {
    if (side === 'out') {
      const s = sends(address);
      return { socket: address, label, kind: s.kind, ...(s.rows ? { rows: s.rows } : {}), ...(s.value !== undefined ? { value: s.value } : {}), from: [], ...(s.note ? { note: s.note } : {}), ...(s.notTaken ? { notTaken: true as const } : {}) };
    }
    const came = into(address);
    const lists = came.flatMap((p) => (p.sent.rows ? [p.sent.rows] : []));
    const note = came.find((p) => p.sent.note)?.sent.note;
    const field = came.find((p) => p.sent.kind === 'field');
    const valued = field ?? came.find((p) => p.sent.kind === 'value' && p.sent.value !== undefined);
    return {
      socket: address, label, kind: field ? 'field' : lists.length ? 'rows' : 'value',
      ...(lists.length ? { rows: union(lists) } : {}), ...(valued?.sent.value !== undefined ? { value: valued.sent.value } : {}),
      from: came.map((p) => p.from), ...(note && !lists.length ? { note } : {}),
    };
  };

  const nodes: Record<string, SimulatedNode> = {};
  const held0 = graph.nodes.filter((n) => !n.id.startsWith('#'));
  // The Start runs no step: it says what would start it (plan 949).
  const startWords = (): string => {
    const triggers = connections.filter((r) => r.to === START).flatMap((r) => held.get(socketOf(r.from).node) ?? []);
    return triggers.length === 1 ? triggers[0]!.would ?? 'Would start when its Trigger fires' : `Would start when one of its ${triggers.length} Triggers fires`;
  };
  const step = (id: string): void => {
    const node = held.get(id);
    if (!node || id in nodes) return;
    const incoming: Slot[] = [
      ...(node.input ? [slot(node.id, 'In', 'in')] : []),
      ...node.rows.filter((r) => r.input).map((r) => slot(`${node.id}/${r.name}`, r.label, 'in')),
    ];
    const outgoing: Slot[] = [
      ...(node.output ? [slot(node.id, 'Out', 'out')] : []),
      ...node.rows.filter((r) => r.output).map((r) => slot(`${node.id}/${r.name}`, r.label, 'out')),
    ];
    // Down a way a Check did not take it does nothing, so it would do nothing (plan 944).
    const ran = taken(node);
    nodes[node.id] = { incoming, outgoing, ...(node.would && ran ? { would: node.would } : {}), ...(ran ? {} : { notTaken: true as const }) };
  };
  // In the order the data flows, so each node's step is mostly its own work and its time is its own; a loop keeps the graph's order.
  const order: string[] = [];
  const left = new Map(held0.map((n) => [n.id, new Set(connections.map((r) => [socketOf(r.from).node, socketOf(r.to).node] as const).filter(([from, to]) => to === n.id && from !== n.id && held.has(from)).map(([from]) => from))]));
  while (left.size) {
    const next = [...left].find(([, waits]) => ![...waits].some((w) => left.has(w))) ?? [...left][0]!;
    order.push(next[0]);
    left.delete(next[0]);
  }
  const started = (): Record<string, SimulatedNode> => (connections.some((r) => r.to === START) ? { ...nodes, [START]: { incoming: [slot(START, 'In', 'in')], outgoing: [], would: startWords() } } : nodes);
  return { ids: order, step, result: () => ({ nodes: started(), faults }), hears: (address) => slot(address, address, 'in') };
}
