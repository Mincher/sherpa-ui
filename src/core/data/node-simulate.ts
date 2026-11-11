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
 * - trueOf — How many rows reach a node's True after a simulation: none where it has no True or has not run.
 * - simulation — Begin a simulation; nothing runs until it is stepped.
 */
import { filterTest, OP_LABELS, OP_TAKES, type Filter, type FilterOp, type Row } from './store.js';
import { truthOf } from './node-input.js';
import { leafOf } from './node-flow.js';
import { portalFlow } from './node-portals.js';
import { FALSE_SOCKET, socketOf, steers, truthy, type DrawnGraph, type GraphNode } from './node-kinds.js';

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
}

/** One node: each input socket's slot, and each output socket's; an Output's, what it would do; down a Branch not taken, so. */
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

/** What an output socket sends: rows, a field (its name, and the rows into it), or nothing and why. */
export type Sent = { kind: 'rows' | 'field' | 'value'; rows?: readonly Row[]; value?: unknown; note?: string };

/** A test's verdict: the rows it keeps and those it does not; a joiner's, too, whether it passed, how many inputs pass and
 *  fail, and its Count. */
interface Verdict {
  kept: Row[];
  lost: Row[];
  passed?: boolean;
  pass?: number;
  fail?: number;
  count?: number;
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
  const [heard, said] = [count(node.incoming), count(node.outgoing)];
  const rows = heard !== undefined && said !== undefined ? `${n(heard)} → ${n(said)}`
    : heard !== undefined || said !== undefined ? `${n((heard ?? said)!)} ${(heard ?? said) === 1 ? 'row' : 'rows'}`
      : valueWords(node.outgoing) ?? [...node.incoming, ...node.outgoing].find((s) => s.note)?.note ?? '';
  const time = ms < 1 ? '<1 ms' : `${Math.round(ms).toLocaleString('en')} ms`;
  if (node.notTaken) return `Not taken · ${time}`;
  // An Output says what it would do, and its rows: it does nothing (plan 891).
  const words = node.would ? [node.would, heard !== undefined ? rows : ''] : [rows];
  return [...words, time].filter(Boolean).join(' · ');
}

/** How many rows a fork's Results send after a simulation — what passed: none where it forks not, has not run, or no rows
 *  came in. Its True steers, and carries none (TODO 939). */
export function trueOf(node: SimulatedNode): number | undefined {
  if (!node.outgoing.some((s) => s.label === 'True')) return undefined;
  // Only where rows came in: a test of one value, or an Or of counts, has no rows to pass (Will, 2026-11-11).
  if (!node.incoming.some((s) => s.rows)) return undefined;
  return node.outgoing.find((s) => s.label === 'Results')?.rows?.length;
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

  /** Does a connection come from a STEER, a fork's True or False (TODO 939)? */
  const steer = (from: string): boolean => {
    const { node: id, row } = socketOf(from);
    return steers(held.get(id), row);
  };
  /** Does a node join tests (And, Or, Not): a steer into it is one of its inputs, not its gate. */
  const joins = (node: GraphNode | undefined): boolean =>
    node?.kind === 'condition' && ['and', 'or', 'not'].includes(String(node.rows.find((r) => r.name === 'type')?.value ?? ''));
  /** What flows into a socket, as each connection brings it. Into a header, a steer is no data: it gates the node; a joiner
   *  takes it as an input. What a Condition's type ignores there, it does not hear (TODO 940). */
  const into = (address: string): { from: string; sent: Sent }[] => {
    const { node: id, row } = socketOf(address);
    const gated = row === undefined && !joins(held.get(id));
    const ignored = row === undefined ? held.get(id)?.ignored?.from : undefined;
    return connections.filter((r) => r.to === address && !(gated && steer(r.from)) && !ignored?.includes(r.from)).map((r) => ({ from: r.from, sent: sends(r.from) }));
  };
  /** Whether a node runs: every steer into its header was taken, its True or its False (TODO 939). */
  const taken = (node: GraphNode): boolean =>
    joins(node) || connections.filter((r) => r.to === node.id && steer(r.from)).every((r) => sends(r.from).value !== false);
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
    const keep = filterTest([read.leaf.field, read.leaf.op, read.leaf.value] as Filter, now);
    const kept: Row[] = [];
    const lost: Row[] = [];
    for (const row of base) (keep(row) ? kept : lost).push(row);
    return { kept, lost };
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
    if (!sent) return undefined;
    if (type === 'not') return { kept: [], lost: [], passed: !(truthOf(sent.value) ?? truthy(sent.value)) };
    if (type === 'empty') return { kept: [], lost: [], passed: !truthy(sent.value) };
    if (!(type in OP_LABELS)) return undefined;
    const range = OP_TAKES[type as FilterOp] === 'range';
    const against = range ? [heard(node, 'start'), heard(node, 'end')] : [heard(node, 'b')];
    const empty = against.find((a) => a.note);
    if (empty) return { note: empty.note! };
    const b = range ? against.map((a) => a.value) : against[0]!.value;
    return { kept: [], lost: [], passed: filterTest(['value', type, b] as Filter, now)({ value: sent.value }) };
  };

  /** A Condition's verdict, by its kind: a test keeps rows; And and Or join their inputs, each true where it is above zero,
   *  true, or not empty. `passed` steers its True; Pass and Fail count its inputs; Count is its rows and the sum of its true
   *  counts (TODO 939). */
  const verdict = (node: GraphNode): Verdict | string | { note: string } => {
    const type = node.rows.find((r) => r.name === 'type')?.value;
    if (node.kind === 'condition' && (type === 'and' || type === 'or')) {
      const came = into(node.id);
      if (!came.length) return `"${node.heading}" joins nothing: connect its inputs in`;
      const each = came.map(({ sent: s }) => {
        if (s.rows) return { ok: s.rows.length > 0, rows: s.rows };
        const v = s.value;
        if (typeof v === 'boolean') return { ok: v };
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
        if (n !== undefined) return { ok: n > 0, n };
        return { ok: v != null && v !== '' && !(Array.isArray(v) && !v.length) };
      });
      const pass = each.filter((e) => e.ok).length;
      const passed = type === 'or' ? pass > 0 : pass === each.length;
      const parts = each.flatMap((e) => (e.rows ? [e.rows] : []));
      const kept = type === 'or' ? union(each.flatMap((e) => (e.ok && e.rows ? [e.rows] : []))) : passed ? common(parts) : [];
      const keeps = new Set(kept);
      const sum = each.reduce((total, e) => total + (e.ok && e.n !== undefined ? e.n : 0), 0);
      return { kept, lost: union(parts).filter((row) => !keeps.has(row)), passed, pass, fail: each.length - pass, count: (parts.length ? kept.length : 0) + sum };
    }
    return test(node);
  };

  /** What an input row hears: a connected value, else the row's own, as its control reads it. */
  const heard = (node: GraphNode, name: string): Sent => {
    const came = into(`${node.id}/${name}`).map((p) => p.sent);
    const first = came[0];
    if (first) return first.kind === 'value' ? first : { kind: 'value', note: first.note ?? 'Nothing it can use arrives' };
    const own = node.rows.find((r) => r.name === name);
    return own?.value === undefined || own.value === '' ? { kind: 'value', note: `${own?.label ?? name} is empty` } : { kind: 'value', value: own.value };
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

  /** The rows a Sort or Group hears, and the field it reads: from the Field connected to its header. */
  const fielded = (node: GraphNode): { field: string; rows: readonly Row[] } | { note: string } => {
    const fed = into(node.id).find((p) => p.sent.kind === 'field')?.sent;
    if (!fed) return { note: 'No Field is connected in' };
    if (!fed.rows) return { note: fed.note ?? 'No rows reach it' };
    return { field: String(fed.value ?? ''), rows: fed.rows };
  };

  /** Sort puts the rows in their field's order; Group gathers each value's rows, the groups in the order they first appear. */
  const arranged = (node: GraphNode, row: string | undefined): Sent => {
    const read = fielded(node);
    if ('note' in read) return { kind: row === 'count' ? 'value' : 'rows', note: read.note };
    const { field, rows } = read;
    if (node.kind === 'sort') {
      const dir = heard(node, 'direction').value === 'desc' ? -1 : 1;
      const order = [...rows].sort((x, y) => {
        const a = x[field], b = y[field];
        return a == null ? (b == null ? 0 : 1) : b == null ? -1 : (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'en', { numeric: true })) * dir;
      });
      return { kind: 'rows', rows: order };
    }
    const groups = Map.groupBy(rows, (r) => String(r[field] ?? ''));
    return row === 'count' ? { kind: 'value', value: groups.size } : { kind: 'rows', rows: [...groups.values()].flat() };
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

  /** What one output socket of a node sends. A Count property row sends how many rows the node sends on: a number. TODO 835 */
  function make(node: GraphNode, row: string | undefined): Sent {
    // Down a Branch not taken, it does not run: a steer it sends is false, so what it steers does not run either (TODO 939).
    if (!taken(node)) return steers(node, row) ? { kind: 'value', value: false, note: 'Not taken' } : { kind: 'value', note: 'Not taken' };
    if (joins(node) && (row === 'count' || row === 'pass' || row === 'fail')) {
      const read = verdict(node);
      if (typeof read === 'string' || 'note' in read) return { kind: 'value', note: typeof read === 'string' ? read : read.note };
      return { kind: 'value', value: read[row] };
    }
    if (node.kind === 'group' && row === 'count') return arranged(node, row);
    if (row !== undefined && node.rows.find((r) => r.name === row)?.property && row === 'count') {
      const on = node.kind === 'field' ? { rows: rowsInto(node.id) } : sends(`${node.id}/${node.rows.find((r) => r.gives === 'rows')?.name ?? 'rows'}`);
      return on.rows ? { kind: 'value', value: on.rows.length } : { kind: 'value', note: 'No rows to count' };
    }
    if (node.kind === 'source') {
      const store = node.rows.find((r) => r.control === 'store')?.value;
      const rows = typeof store === 'string' ? rowsByStore[store] : undefined;
      if (!rows) {
        fault(`"${node.heading}" is not fetched yet`);
        return { kind: 'rows', note: 'Not fetched yet' };
      }
      const cut = typeof store === 'string' ? facts.partial?.[store] : undefined;
      return { kind: 'rows', rows, ...(cut ? { note: cut } : {}) };
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
      // A fork's True and False STEER: true or false, and no rows; its Results carry the rows that pass (TODO 939).
      if (steers(node, row)) {
        const passed = read.passed ?? read.kept.length > 0;
        return { kind: 'value', value: row === FALSE_SOCKET ? !passed : passed };
      }
      return { kind: 'rows', rows: read.kept };
    }
    if (node.kind === 'value') return valued(node);
    if (node.kind === 'math') return math(node);
    if (node.kind === 'text') return text(node);
    if (node.kind === 'sort' || node.kind === 'group') return arranged(node, row);
    // A Provider or a Model sends its pick (plan 926).
    if (node.kind === 'provider' || node.kind === 'model') return { kind: 'value', value: node.rows.find((r) => r.name === row)?.value };
    // An Output, or an AI node, acts outside the graph, so it fires nothing: each output sends a stand-in, by what it gives,
    // so what it feeds runs too (plans 891, 926). A True/false AI node goes on True.
    if (node.kind === 'output' || node.would) {
      if (node.branches) return { kind: 'value', value: row !== FALSE_SOCKET };
      const out = node.rows.find((r) => r.name === row);
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
      return { socket: address, label, kind: s.kind, ...(s.rows ? { rows: s.rows } : {}), ...(s.value !== undefined ? { value: s.value } : {}), from: [], ...(s.note ? { note: s.note } : {}) };
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
  const step = (id: string): void => {
    const node = held.get(id);
    if (!node || id in nodes) return;
    const incoming: Slot[] = [
      ...(node.input ? [slot(node.id, 'In', 'in')] : []),
      ...node.rows.filter((r) => r.input).map((r) => slot(`${node.id}/${r.name}`, r.label, 'in')),
    ];
    const outgoing: Slot[] = [
      ...(node.output || node.branches ? [slot(node.id, node.branches ? 'True' : 'Out', 'out')] : []),
      ...node.rows.filter((r) => r.output).map((r) => slot(`${node.id}/${r.name}`, r.label, 'out')),
      ...(node.branches ? [slot(`${node.id}/${FALSE_SOCKET}`, 'False', 'out')] : []),
    ];
    // Down a Branch not taken it does nothing, so it would do nothing (TODO 939).
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
  return { ids: order, step, result: () => ({ nodes, faults }), hears: (address) => slot(address, address, 'in') };
}
