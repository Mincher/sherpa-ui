/**
 * node-simulate.ts — SIMULATE a graph: the cached rows go in at each Source and come out of every node, as a ROW LIST
 * on each socket: what the node would hear and what it would say. It reads rows and writes nothing: no store is asked,
 * no clock is read but the one given. A Condition's rows are the rows into its Field that its test keeps, run by the
 * same `filterTest` a page runs; a Source with no cached rows is "not fetched yet". The kinds beyond Source, Field,
 * Condition (test, And, Or) and Output wait for P6. Pure: no DOM. Will, TODO 836 · docs/history/plan-836-data-through-nodes.md
 * · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 *
 * Map:
 * - SimulateFacts — What a simulation reads beyond its graph and rows: the clock a relative date means.
 * - Slot — What one socket hears or says: its rows, a field's name or a value, and where it comes from.
 * - SimulatedNode — One node: each input socket's slot, and each output socket's.
 * - Simulated — Every node's slots, and each fault in words.
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
 * - lightOf — A node's light after a simulation: the rows it heard and said, "412 → 87", and the time it took.
 * - trueOf — How many rows reach a node's True after a simulation: none where it has no True or has not run.
 * - simulation — Begin a simulation; nothing runs until it is stepped.
 */
import { filterTest, type Filter, type Row } from './store.js';
import { leafOf } from './node-flow.js';
import { portalFlow } from './node-portals.js';
import { FALSE_SOCKET, socketOf, type DrawnGraph, type GraphNode } from './node-kinds.js';

/** What a simulation reads beyond its graph and rows: the clock a relative date means (left out, the machine's), and
 *  where a fetch stopped at its cap, by store, in words: a Source says it beside its rows. */
export interface SimulateFacts {
  now?: Date;
  partial?: Readonly<Record<string, string>>;
}

/** What one socket hears or says: its rows (a row list), a field's name, or a value; and where it comes from, as
 *  the socket addresses of the routes that bring it. `note` says why it holds no rows: not fetched, not simulated. */
export interface Slot {
  socket: string;
  label: string;
  kind: 'rows' | 'field' | 'value';
  rows?: readonly Row[];
  value?: unknown;
  from: readonly string[];
  note?: string;
}

/** One node: each input socket's slot, and each output socket's. */
export interface SimulatedNode {
  incoming: readonly Slot[];
  outgoing: readonly Slot[];
}

/** Every node's slots, by id, and each fault in words. */
export interface Simulated {
  nodes: Record<string, SimulatedNode>;
  faults: string[];
}

/** What an output socket sends: rows, a field (its name, and the rows into it), or nothing and why. */
type Sent = { kind: 'rows' | 'field' | 'value'; rows?: readonly Row[]; value?: unknown; note?: string };

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
 * Output hears what is routed to it. Another kind says "not simulated yet". A route through a portal is read as the
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

/** A node's LIGHT after a simulation: the rows it heard and the rows it said, "412 → 87", and the time it took; a Source or an
 *  Output has the one count; one that holds no rows says why. */
export function lightOf(node: SimulatedNode, ms: number): string {
  const count = (slots: readonly Slot[]): number | undefined => slots.find((s) => s.rows)?.rows?.length;
  const n = (v: number): string => v.toLocaleString('en');
  const [heard, said] = [count(node.incoming), count(node.outgoing)];
  const rows = heard !== undefined && said !== undefined ? `${n(heard)} → ${n(said)}`
    : heard !== undefined || said !== undefined ? `${n((heard ?? said)!)} ${(heard ?? said) === 1 ? 'row' : 'rows'}`
      : [...node.incoming, ...node.outgoing].find((s) => s.note)?.note ?? '';
  const time = ms < 1 ? '<1 ms' : `${Math.round(ms).toLocaleString('en')} ms`;
  return [rows, time].filter(Boolean).join(' · ');
}

/** How many rows reach a node's True after a simulation: none where it has no True or has not run. */
export function trueOf(node: SimulatedNode): number | undefined {
  return node.outgoing.find((s) => s.label === 'True')?.rows?.length;
}

/** Begin a simulation: nothing runs until it is stepped. */
export function simulation(graph: DrawnGraph, rowsByStore: Readonly<Record<string, readonly Row[] | undefined>>, facts: SimulateFacts = {}): SimulationRun {
  const now = facts.now ?? new Date();
  const routes = portalFlow(graph.nodes, graph.routes).routes;
  const held = new Map(graph.nodes.map((n) => [n.id, n]));
  const faults: string[] = [];
  const said = new Set<string>();
  const fault = (words: string): void => { if (!said.has(words)) { said.add(words); faults.push(words); } };
  const sent = new Map<string, Sent>();
  const busy = new Set<string>();

  /** What flows into a node's header, as each route brings it. */
  const into = (address: string): { from: string; sent: Sent }[] => routes.filter((r) => r.to === address).map((r) => ({ from: r.from, sent: sends(r.from) }));
  /** The rows that reach a socket, each once; none at all when none of its routes brings rows (not fetched, not simulated). */
  const rowsInto = (address: string): Row[] | undefined => {
    const lists = into(address).flatMap((p) => (p.sent.rows ? [p.sent.rows] : []));
    return lists.length ? union(lists) : undefined;
  };

  /** What a test says: the rows of its Field that its leaf keeps, and those it does not; a fault in words; or, where no rows
   *  reach it, why: that was said upstream. */
  const test = (node: GraphNode): { kept: Row[]; lost: Row[] } | string | { note: string } => {
    const read = leafOf(graph, node);
    if ('fault' in read) return read.fault;
    const fed = into(node.id).find((p) => p.sent.kind === 'field')?.sent;
    const base = fed?.rows;
    if (!base) return { note: fed?.note ?? 'No rows reach it' };
    const keep = filterTest([read.leaf.field, read.leaf.op, read.leaf.value] as Filter, now);
    const kept: Row[] = [];
    const lost: Row[] = [];
    for (const row of base) (keep(row) ? kept : lost).push(row);
    return { kept, lost };
  };

  /** A Condition's rows, by its kind: a test keeps, And and Or join what the parts kept. */
  const verdict = (node: GraphNode): { kept: Row[]; lost: Row[] } | string | { note: string } => {
    const type = node.rows.find((r) => r.name === 'type')?.value;
    if (node.kind === 'condition' && (type === 'and' || type === 'or')) {
      const came = into(node.id);
      if (!came.length) return `"${node.heading}" joins no tests: route their True in`;
      const lacking = came.find((p) => !p.sent.rows);
      if (lacking) return { note: lacking.sent.note ?? 'No rows reach it' };
      const parts = came.flatMap((p) => (p.sent.rows ? [p.sent.rows] : []));
      const kept = type === 'and' ? common(parts) : union(parts);
      const all = union(parts);
      const keeps = new Set(kept);
      return { kept, lost: all.filter((row) => !keeps.has(row)) };
    }
    return test(node);
  };

  function sends(address: string): Sent {
    const known = sent.get(address);
    if (known) return known;
    const { node: id, row } = socketOf(address);
    const node = held.get(id);
    if (!node) return { kind: 'value', note: `a route comes from "${id}", which the graph does not hold` };
    if (busy.has(address)) return { kind: 'value', note: `"${node.heading}" reads itself, in a loop` };
    busy.add(address);
    const made = make(node, row);
    busy.delete(address);
    sent.set(address, made);
    return made;
  }

  /** What one output socket of a node sends. A Count property row sends how many rows the node sends on: a number. TODO 835 */
  function make(node: GraphNode, row: string | undefined): Sent {
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
      return { kind: 'rows', rows: row === FALSE_SOCKET ? read.lost : read.kept };
    }
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
    return {
      socket: address, label, kind: field ? 'field' : lists.length ? 'rows' : 'value',
      ...(lists.length ? { rows: union(lists) } : {}), ...(field?.sent.value !== undefined ? { value: field.sent.value } : {}),
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
    nodes[node.id] = { incoming, outgoing };
  };
  // In the order the data flows, so each node's step is mostly its own work and its time is its own; a loop keeps the graph's order.
  const order: string[] = [];
  const left = new Map(held0.map((n) => [n.id, new Set(routes.map((r) => [socketOf(r.from).node, socketOf(r.to).node] as const).filter(([from, to]) => to === n.id && from !== n.id && held.has(from)).map(([from]) => from))]));
  while (left.size) {
    const next = [...left].find(([, waits]) => ![...waits].some((w) => left.has(w))) ?? [...left][0]!;
    order.push(next[0]);
    left.delete(next[0]);
  }
  return { ids: order, step, result: () => ({ nodes, faults }) };
}
