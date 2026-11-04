/**
 * node-graph.ts — a graph of nodes drawn on a sherpa-layout-canvas, and the two editors kept
 * drawn there: a page's Query, which each edit ASKS, and a workflow, whose draft each edit
 * writes. Places last the tab; Save hands the app a checked definition. Each node lights as
 * its step runs, from the one trace stream. Will, TODOs 555, 551, 671.
 * TRAP T-the-node-editor-asks-the-query · TRAP T-a-step-names-its-node
 *
 * Map:
 * - DrawOptions — What a drawing tells its host: each edit, each node a reader picks or moves, and each new route.
 * - drawGraph — Draw a graph on a canvas: each node by id, at its place when that moved; then its routes.
 * - markNode — Mark one node as the one picked, or none.
 * - WatchOptions — What a graph's watch is told: which traces are its, and which node each span lights.
 * - watchSteps — Light a canvas's nodes from the one trace stream as their steps run; its stop lets it go.
 * - InspectOptions — What an inspector shows beside a node's rows, and whom it tells of an edit.
 * - inspectNode — Fill an overlay panel with one node: its rows again, their routes, and a visual.
 * - Inspector — The overlay panel a picked node opens in.
 * - GraphEditor — What an editor's binding gives back: Save, and the undo.
 * - QueryEditorOptions — What drawing a page's Query needs beyond its source: its definition, an inspector, a session.
 * - bindQueryEditor — Keep a page's Query drawn on a canvas as it changes, and ask it for each edit.
 * - WorkflowEditorOptions — What editing a workflow needs beyond it: its facts, an inspector, a session, the kinds.
 * - bindWorkflow — Keep a workflow's draft drawn on a canvas, and write each edit to it.
 */
import '../../components/sherpa-input-text/sherpa-input-text.js';
import '../../components/sherpa-key-value-list/sherpa-key-value-list.js';
import '../../components/sherpa-node/sherpa-node.js';
import '../../components/sherpa-node-row/sherpa-node-row.js';
import '../../components/sherpa-select-group/sherpa-select-group.js';
import '../../components/sherpa-stack/sherpa-stack.js';
import '../../components/sherpa-switch/sherpa-switch.js';
import type { SherpaLayoutCanvas } from '../../components/sherpa-layout-canvas/sherpa-layout-canvas.js';
import type { SocketSide } from '../../components/sherpa-node/node-sockets.js';
import type { SessionStore } from '../browser/session.js';
import type { DataSource } from '../data/data-source.js';
import { checkPage, pageWithQuery, type PageDefinition } from '../data/page-definition.js';
import { graphRequest, queryGraph, queryStepNode, routeRequest, traceQuerySteps, type QueryGraphFacts } from '../data/query-graph.js';
import { onTrace, type Span, type StepState, type TraceHost } from '../data/trace.js';
import { VIEW } from '../data/query.js';
import { OP_LABELS, valueKey, type FilterOp } from '../data/store.js';
import { report } from '../data/report.js';
import { typedValue, type FieldType } from '../data/filter-state.js';
import {
  FALSE_SOCKET, NODE_KINDS, placed, socketOf, socketType,
  type DrawnGraph, type GraphEdit, type GraphNode, type GraphRow, type NodeKind, type NodePlaces, type NodeRoute,
} from '../data/node-kinds.js';
import {
  checkWorkflow, editWorkflow, readWorkflow, workflowFaults, workflowGraph,
  type WorkflowDefinition, type WorkflowDefinitionV1, type WorkflowFacts, type WorkflowNode,
} from '../data/workflow.js';

const SVG = 'http://www.w3.org/2000/svg';

/** Anything with a socket to join: a node's header, or one of its rows. */
type HasSockets = HTMLElement & { socketRect(side: SocketSide): DOMRect | null };

/** What a drawing tells its host: each edit, each node a reader picks or moves, and each
 *  route a reader draws — the drawing writes nothing. */
export interface DrawOptions {
  onEdit?: (edit: GraphEdit) => void;
  onSelect?: (node: GraphNode) => void;
  /** A node the reader moved, and where to. */
  onMove?: (node: GraphNode, x: number, y: number) => void;
  /** A line dragged from an output socket and let go on an input socket. */
  onConnect?: (route: NodeRoute) => void;
}

/** A field a row draws: a text field or a select, a set of ticks, or a switch. */
type Field = HTMLElement & { value: unknown; checked?: boolean; populate?(items: unknown): void };

/** What a canvas has drawn: each node and row by its address, the lines, and the routes they draw. */
interface Drawn {
  graph: DrawnGraph;
  options: DrawOptions;
  nodes: Map<string, HTMLElement>;
  rows: Map<string, HTMLElement>;
  /** Each row element's address, for an edit to name. */
  addresses: WeakMap<HTMLElement, [string, string]>;
  shapes: Map<string, string>;
  /** The place each node was last given by its graph: a new one moves it, the same one leaves the reader's. */
  placedAt: Map<string, string>;
  lines: SVGSVGElement;
  routes: readonly NodeRoute[];
  /** The line a reader is drawing, kept over each redraw of the routes. */
  draft: SVGPathElement | null;
  sizes: ResizeObserver;
  fitted: boolean;
}

const drawnOn = new WeakMap<HTMLElement, Drawn>();

/** How a row's value reads: an operator by its words, a direction in full. */
function shown(row: GraphRow): string {
  const value = row.value;
  if (value === undefined || value === null) return '';
  if (row.control === 'op') return OP_LABELS[value as FilterOp] ?? String(value);
  if (row.control === 'direction') return value === 'desc' ? 'Descending' : value === 'asc' ? 'Ascending' : String(value);
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/** Set an attribute, or take it away when there is nothing to say. */
function put(el: Element, name: string, value: string | undefined): void {
  if (value === undefined || value === '') el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** A row's field: a switch, a set of ticks, a select of its choices, or a text or number field.
 *  LOCKED — read only — where a route drives it, or nothing outside takes its change. */
function fieldFor(row: GraphRow, locked: boolean): Field {
  if (row.control === 'switch' || row.control === 'values') {
    const field = document.createElement(row.control === 'switch' ? 'sherpa-switch' : 'sherpa-select-group') as Field;
    if (row.control === 'values') field.setAttribute('multiple', '');
    if (locked) field.setAttribute('disabled', '');
    if (row.control === 'values') field.populate?.(row.choices ?? []);
    return field;
  }
  const field = document.createElement('sherpa-input-text') as Field;
  field.setAttribute('name', row.name);
  if (row.choices) field.setAttribute('data-type', 'select');
  else if (row.control === 'number') field.setAttribute('data-type', 'number');
  if (locked) field.setAttribute(row.choices ? 'disabled' : 'readonly', '');
  if (row.choices) field.populate?.(row.choices);
  return field;
}

/** Give a field its row's value, and its words. */
function fill(field: Field, row: GraphRow, note?: string): void {
  field.setAttribute('data-label', row.label);
  put(field, 'data-description', note ?? row.hint);
  if (row.control === 'switch') field.checked = !!row.value;
  else if (row.control === 'values') field.value = Array.isArray(row.value) ? row.value.map(String) : [];
  // A select holds its value's KEY, and shows its label itself.
  else field.value = row.choices ? String(row.value ?? '') : shown(row);
}

/** What a field says now, as its row's value. */
function read(field: Field, row: GraphRow): unknown {
  return row.control === 'switch' ? !!field.checked : field.value;
}

/** The input addresses a route drives: their fields mirror what comes in, read only. */
function driven(graph: DrawnGraph): Set<string> {
  return new Set(graph.routes.map((r) => r.to));
}

/** One node's rows, made again when their shape changed and given their values. */
function drawRows(drawn: Drawn, el: HTMLElement, node: GraphNode): void {
  const routed = driven(drawn.graph);
  const sent = new Set(drawn.graph.routes.map((r) => r.from));
  const locked = (row: GraphRow): boolean => !row.editable || routed.has(`${node.id}/${row.name}`);
  const shape = JSON.stringify(node.rows.map((r) => [r.name, r.control, r.input, r.output, locked(r), r.choices]));
  if (drawn.shapes.get(node.id) !== shape) {
    drawn.shapes.set(node.id, shape);
    for (const key of [...drawn.rows.keys()]) if (key.startsWith(`${node.id}/`)) drawn.rows.delete(key);
    el.replaceChildren(...node.rows.map((row) => {
      const line = document.createElement('sherpa-node-row');
      drawn.rows.set(`${node.id}/${row.name}`, line);
      drawn.addresses.set(line, [node.id, row.name]);
      if (row.control) line.append(fieldFor(row, locked(row)));
      return line;
    }));
  }
  for (const row of node.rows) {
    const line = drawn.rows.get(`${node.id}/${row.name}`)!;
    put(line, 'data-input-socket', row.input);
    put(line, 'data-output-socket', row.output);
    line.toggleAttribute('data-input-routed', routed.has(`${node.id}/${row.name}`));
    line.toggleAttribute('data-output-routed', sent.has(`${node.id}/${row.name}`));
    const field = line.firstElementChild as Field | null;
    if (field) fill(field, row);
    else line.setAttribute('data-label', row.control === undefined && row.value !== undefined ? `${row.label}: ${shown(row)}` : row.label);
  }
}

/** A socket's middle, on the canvas's plane. */
function onPlane(canvas: SherpaLayoutCanvas, rect: DOMRect): [number, number] {
  const box = canvas.getBoundingClientRect();
  const { x, y, zoom } = canvas.view;
  return [(rect.left + rect.width / 2 - box.left - x) / zoom, (rect.top + rect.height / 2 - box.top - y) / zoom];
}

/** A route's curve on the plane: out of one socket, into the next. */
function curve([x1, y1]: [number, number], [x2, y2]: [number, number]): string {
  const bend = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

/** The type a route carries, from its output socket: a row's, the header's (True, on a fork) or False. */
function outputType(graph: DrawnGraph, from: string): string {
  const { node: id, row } = socketOf(from);
  const node = graph.nodes.find((n) => n.id === id);
  if (row === FALSE_SOCKET) return 'false';
  if (row !== undefined) return node?.rows.find((r) => r.name === row)?.output ?? '';
  return node?.branches ? 'boolean' : node?.output ?? '';
}

/** A curve for each route, from its output socket to its input socket. */
function drawRoutes(canvas: SherpaLayoutCanvas, drawn: Drawn): void {
  const end = (address: string, side: SocketSide): DOMRect | null => {
    const { node, row } = socketOf(address);
    // A False leaves the footer, which sherpa-node draws (plan 713 M2): until it does, no line.
    if (row === FALSE_SOCKET) return null;
    const el = (row === undefined ? drawn.nodes.get(node) : drawn.rows.get(address)) as HasSockets | undefined;
    return el?.socketRect?.(side) ?? null;
  };
  const paths = drawn.routes.flatMap(({ from, to }) => {
    const a = end(from, 'output');
    const b = end(to, 'input');
    if (!a || !b) return [];
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', curve(onPlane(canvas, a), onPlane(canvas, b)));
    path.dataset['type'] = outputType(drawn.graph, from);
    path.dataset['from'] = from;
    path.dataset['to'] = to;
    return [path];
  });
  drawn.lines.replaceChildren(...paths, ...(drawn.draft ? [drawn.draft] : []));
}

/** Where a drawn node or row is: `node`, or `node/row`. */
function addressOf(drawn: Drawn, el: HTMLElement): string | null {
  const row = drawn.addresses.get(el);
  if (row) return `${row[0]}/${row[1]}`;
  return [...drawn.nodes].find(([, node]) => node === el)?.[0] ?? null;
}

/** The input socket nearest a point on the screen, within reach, or none. */
function inputAt(drawn: Drawn, x: number, y: number): string | null {
  const REACH = 16;
  let best: [string, number] | null = null;
  for (const [address, el] of [...drawn.nodes, ...drawn.rows]) {
    const rect = (el as HasSockets).socketRect?.('input');
    if (!rect) continue;
    const far = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
    if (far <= REACH && (!best || far < best[1])) best = [address, far];
  }
  return best?.[0] ?? null;
}

/** A press on an OUTPUT socket draws a new route: the line follows the pointer, and let
 *  go on an input socket, the host is asked to join them. It never moves the node or the view. */
function connectFrom(canvas: SherpaLayoutCanvas, drawn: Drawn, event: PointerEvent): void {
  const path = event.composedPath();
  if (event.button !== 0 || !(path[0] instanceof Element) || !path[0].classList.contains('socket-out')) return;
  const owner = path.find((n): n is HTMLElement => n instanceof HTMLElement && addressOf(drawn, n) !== null);
  const from = owner ? addressOf(drawn, owner) : null;
  const start = (owner as HasSockets | undefined)?.socketRect?.('output');
  if (!from || !start) return;
  event.preventDefault();
  event.stopPropagation();
  const draft = document.createElementNS(SVG, 'path');
  draft.setAttribute('class', 'graph-draft');
  draft.setAttribute('stroke-dasharray', '6 4');
  drawn.draft = draft;
  drawn.lines.append(draft);
  const begin = onPlane(canvas, start);
  const follow = (e: PointerEvent): void => {
    const box = canvas.getBoundingClientRect();
    const { x, y, zoom } = canvas.view;
    draft.setAttribute('d', curve(begin, [(e.clientX - box.left - x) / zoom, (e.clientY - box.top - y) / zoom]));
  };
  const stop = (e: PointerEvent): void => {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    draft.remove();
    drawn.draft = null;
    const to = e.type === 'pointerup' ? inputAt(drawn, e.clientX, e.clientY) : null;
    // Let go on the bare canvas, or on its own node: nothing is joined.
    if (to && socketOf(to).node !== socketOf(from).node) drawn.options.onConnect?.({ from, to });
  };
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

/** The drawn node an event came from. */
function nodeOf(drawn: Drawn, target: EventTarget | null): GraphNode | undefined {
  const id = [...drawn.nodes].find(([, el]) => el === target)?.[0];
  return drawn.graph.nodes.find((n) => n.id === id);
}

/** What a canvas has drawn, made the first time. */
function drawnFor(canvas: SherpaLayoutCanvas): Drawn {
  let drawn = drawnOn.get(canvas);
  if (drawn) return drawn;
  // The lines, under the nodes: one SVG at the plane's origin that draws past its box.
  const lines = document.createElementNS(SVG, 'svg');
  lines.setAttribute('class', 'graph-routes');
  lines.setAttribute('width', '1');
  lines.setAttribute('height', '1');
  lines.setAttribute('aria-hidden', 'true');
  lines.setAttribute('style', '--x: 0px; --y: 0px; overflow: visible; pointer-events: none; fill: none;'
    + ' stroke: var(--sherpa-style-border-base, #b3b3c3); stroke-width: 2px');
  canvas.prepend(lines);
  const made: Drawn = {
    graph: { nodes: [], routes: [] }, options: {},
    nodes: new Map(), rows: new Map(), addresses: new WeakMap(), shapes: new Map(), placedAt: new Map(),
    lines, routes: [], draft: null, fitted: false,
    // A node's height lands when its parts render: the lines follow, and the first fits the view.
    sizes: new ResizeObserver(() => {
      drawRoutes(canvas, made);
      if (!made.fitted && made.nodes.size) { made.fitted = true; canvas.fit(); }
    }),
  };
  canvas.addEventListener('node-move', (event) => {
    drawRoutes(canvas, made);
    const node = nodeOf(made, event.target);
    const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
    if (node) made.options.onMove?.(node, x, y);
  });
  // Before the node and the view hear it: a drag from an output socket is a new route.
  canvas.addEventListener('pointerdown', (event) => connectFrom(canvas, made, event), { capture: true });
  // A field's change, as an EDIT for the host: the drawing writes nothing itself.
  canvas.addEventListener('change', (event) => {
    const line = event.composedPath().find((n): n is HTMLElement => n instanceof HTMLElement && made.addresses.has(n));
    const [id, name] = line ? made.addresses.get(line)! : [];
    const node = made.graph.nodes.find((n) => n.id === id);
    const row = node?.rows.find((r) => r.name === name);
    if (!node || !row?.editable) return;
    made.options.onEdit?.({ node, row, value: read(line!.firstElementChild as Field, row) });
  });
  // A node ASKS to be picked: the drawing marks it, one of many, and tells its host.
  canvas.addEventListener('node-select', (event) => {
    const node = nodeOf(made, event.target);
    if (!node) return;
    markNode(canvas, node.id);
    made.options.onSelect?.(node);
  });
  drawnOn.set(canvas, made);
  drawn = made;
  return drawn;
}

/** Draw a graph on a canvas: each node by id, at its place when the graph's place for it
 *  moved — else where the reader left it; then its routes. */
export function drawGraph(canvas: SherpaLayoutCanvas, graph: DrawnGraph, options: DrawOptions = {}): void {
  const drawn = drawnFor(canvas);
  drawn.graph = graph;
  drawn.options = options;
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const [id, el] of drawn.nodes) {
    if (ids.has(id)) continue;
    drawn.sizes.unobserve(el);
    el.remove();
    drawn.nodes.delete(id);
    drawn.shapes.delete(id);
    drawn.placedAt.delete(id);
  }
  for (const node of graph.nodes) {
    let el = drawn.nodes.get(node.id);
    if (!el) {
      el = document.createElement('sherpa-node');
      drawn.nodes.set(node.id, el);
      canvas.append(el);
      drawn.sizes.observe(el);
    }
    const at = `${node.x},${node.y}`;
    if (drawn.placedAt.get(node.id) !== at) {
      drawn.placedAt.set(node.id, at);
      el.setAttribute('data-x', String(node.x));
      el.setAttribute('data-y', String(node.y));
    }
    el.setAttribute('data-heading', node.heading);
    put(el, 'data-icon', node.icon);
    put(el, 'data-description', node.description);
    // Its data in, of any type; out, its True where it forks.
    put(el, 'data-input-socket', socketType(node, undefined, 'input'));
    put(el, 'data-output-socket', socketType(node, undefined, 'output'));
    el.toggleAttribute('data-branches', !!node.branches);
    el.toggleAttribute('data-input-routed', graph.routes.some((r) => r.to === node.id));
    el.toggleAttribute('data-output-routed', graph.routes.some((r) => r.from === node.id));
    el.toggleAttribute('data-false-routed', graph.routes.some((r) => r.from === `${node.id}/${FALSE_SOCKET}`));
    drawRows(drawn, el, node);
  }
  drawn.routes = graph.routes;
  requestAnimationFrame(() => drawRoutes(canvas, drawn));
}

/** Mark one node as the one picked, or none. */
export function markNode(canvas: SherpaLayoutCanvas, id: string | null): void {
  for (const [key, el] of drawnOn.get(canvas)?.nodes ?? []) el.toggleAttribute('data-current', key === id);
}

/** One span that lit a node: where it ran, how it stands, its time and its rows. */
interface Lit {
  host: TraceHost;
  state: StepState;
  ms?: number;
  rows?: number;
}

/** What a graph's watch is told: which traces are its, and which node each span lights. */
export interface WatchOptions {
  /** Is this span's trace the graph's? Every span of a trace it claims may light a node. */
  claims(span: Span): boolean;
  /** The node a span lights: the one it names, unless told. */
  nodeOf?(span: Span): string | undefined;
  /** Does this span begin a new run, whose lights replace the last run's? Unless told,
   *  the first span of a trace it claims. */
  begins?(span: Span): boolean;
  /** A span that lit a node, after it is drawn. */
  onLit?(span: Span, node: string): void;
}

const MS = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'millisecond', unitDisplay: 'short', maximumFractionDigits: 1 });
const COUNT = new Intl.NumberFormat();

/** How a span stands: begun, or how it ended — a failure said, or its own word. */
function stateOf(span: Span): StepState {
  if (span.ms === undefined) return 'start';
  const said = span.detail?.['state'];
  if (said === 'failed' || said === 'skipped') return said;
  return span.detail && 'failed' in span.detail ? 'failed' : 'done';
}

/** A node's step, from every span that lit it this run: running while one is open, else
 *  failed, skipped or done; the longest time, the latest rows, and where it ran. */
function light(el: HTMLElement, spans: ReadonlyMap<string, Lit>): void {
  const all = [...spans.values()];
  const state = all.some((s) => s.state === 'start') ? 'running'
    : all.some((s) => s.state === 'failed') ? 'failed'
    : all.every((s) => s.state === 'skipped') ? 'skipped' : 'done';
  const ms = Math.max(0, ...all.flatMap((s) => (s.ms === undefined ? [] : [s.ms])));
  const rows = all.findLast((s) => s.rows !== undefined)?.rows;
  const away = [...new Set(all.map((s) => s.host).filter((h) => h !== 'page'))];
  const words = [
    ...(state === 'done' ? [] : [state[0]!.toUpperCase() + state.slice(1)]),
    ...(ms > 0 && state !== 'running' ? [MS.format(ms)] : []),
    ...(rows === undefined ? [] : [`${COUNT.format(rows)} ${rows === 1 ? 'row' : 'rows'}`]),
    ...away,
  ];
  el.setAttribute('data-step', state);
  put(el, 'data-caption', words.join(' · '));
}

/**
 * Light a canvas's nodes from the one trace stream as their steps run: each node's
 * `data-step` (CSS draws it) and `data-caption` — its time, its rows and where it
 * ran. A run's lights stay until the next run begins. It listens only while bound:
 * its stop lets the stream go. TRAP T-a-step-names-its-node
 */
export function watchSteps(canvas: SherpaLayoutCanvas, { claims, nodeOf = (span) => {
  const named = span.detail?.['node'];
  return typeof named === 'string' ? named : undefined;
}, begins, onLit }: WatchOptions): () => void {
  let traces = new Set<string>();
  const lit = new Map<string, Map<string, Lit>>();
  const clear = (): void => {
    for (const id of lit.keys()) {
      const el = drawnOn.get(canvas)?.nodes.get(id);
      el?.removeAttribute('data-step');
      el?.removeAttribute('data-caption');
    }
    lit.clear();
  };
  // A run's traces, and those of runs gone by: a late span of one lights nothing.
  const retired = new Set<string>();
  return onTrace((span) => {
    if (retired.has(span.trace)) return;
    const claimed = traces.has(span.trace);
    if (!claimed && !claims(span)) return;
    if (begins ? begins(span) : !claimed) {
      clear();
      for (const t of traces) retired.add(t);
      for (const t of retired) if (retired.size > 256) retired.delete(t);
      traces = new Set();
    }
    traces.add(span.trace);
    const node = nodeOf(span);
    const el = node ? drawnOn.get(canvas)?.nodes.get(node) : undefined;
    if (!node || !el) return;
    let spans = lit.get(node);
    if (!spans) lit.set(node, (spans = new Map()));
    const total = span.detail?.['total'] ?? span.detail?.['rows'];
    spans.set(span.id, { host: span.host, state: stateOf(span), ...(span.ms !== undefined ? { ms: span.ms } : {}), ...(typeof total === 'number' ? { rows: total } : {}) });
    light(el, spans);
    onLit?.(span, node);
  });
}

/** What an inspector shows beside a node's rows, and whom it tells of an edit. */
export interface InspectOptions {
  onEdit?: (edit: GraphEdit) => void;
  /** A live visual of what the node stands for — a component's — shown above its rows. */
  visual?: HTMLElement | null;
}

/** What an inspector holds: its node, the fields by their element, and whom it tells. */
interface Inspecting {
  node: GraphNode;
  fields: WeakMap<Element, GraphRow>;
  options: InspectOptions;
}

const inspecting = new WeakMap<HTMLElement, Inspecting>();

/** Fill an overlay panel with one node: its rows again — the same values, the same
 *  edits — with where each comes from and goes to, and a visual above them. */
export function inspectNode(panel: HTMLElement, node: GraphNode, graph: DrawnGraph, options: InspectOptions = {}): void {
  if (!inspecting.has(panel)) {
    panel.addEventListener('change', (event) => {
      const now = inspecting.get(panel);
      const field = event.composedPath().find((n): n is Element => n instanceof Element && !!now?.fields.has(n));
      const row = field ? now!.fields.get(field) : undefined;
      if (now && row?.editable) now.options.onEdit?.({ node: now.node, row, value: read(field as Field, row) });
    });
  }
  const name = (address: string): string => {
    const { node: id, row } = socketOf(address);
    const from = graph.nodes.find((n) => n.id === id);
    const part = row === FALSE_SOCKET ? 'False' : row ? from?.rows.find((r) => r.name === row)?.label : from?.branches && address === from.id ? 'True' : undefined;
    return [from?.heading ?? id, part].filter(Boolean).join(' › ');
  };
  const routed = driven(graph);
  const fields = new WeakMap<Element, GraphRow>();
  const items = node.rows.map((row) => {
    const at = `${node.id}/${row.name}`;
    const ins = graph.routes.filter((r) => r.to === at).map((r) => `From ${name(r.from)}`);
    const outs = graph.routes.filter((r) => r.from === at).map((r) => `To ${name(r.to)}`);
    const field = fieldFor(row.control ? row : { ...row, control: 'text' }, !row.editable || routed.has(at) || !row.control);
    fill(field, row, [...ins, ...outs, row.hint].filter(Boolean).join(' · ') || undefined);
    fields.set(field, row);
    return field;
  });
  // The whole node's routes: in, and out — its True and False where it forks.
  const header = document.createElement('sherpa-key-value-list');
  header.setAttribute('data-orientation', 'vertical');
  const whole = [
    ...graph.routes.filter((r) => r.to === node.id).map((r) => ({ key: 'In', value: name(r.from) })),
    ...graph.routes.filter((r) => r.from === node.id).map((r) => ({ key: node.branches ? 'True' : 'Out', value: name(r.to) })),
    ...graph.routes.filter((r) => r.from === `${node.id}/${FALSE_SOCKET}`).map((r) => ({ key: 'False', value: name(r.to) })),
  ];
  const stack = document.createElement('sherpa-stack');
  stack.setAttribute('data-gap', 'lg');
  stack.append(...(options.visual ? [options.visual] : []), ...(whole.length ? [header] : []), ...items);
  panel.replaceChildren(stack);
  if (whole.length) (header as HTMLElement & { populate(items: unknown): void }).populate(whole);
  panel.setAttribute('data-heading', node.heading);
  put(panel, 'data-icon', node.icon);
  inspecting.set(panel, { node, fields, options });
}

/** The overlay panel a picked node opens in. */
export type Inspector = HTMLElement & { show(): void; hide(): void; open: boolean };

/** What an editor's binding gives back: Save, and the undo. */
export interface GraphEditor {
  /** Check what the edits make and hand it to the app, as `definition-save` on the
   *  canvas — Sherpa never decides where an app keeps it. False, and reported, when it fails its check. */
  save(): boolean;
  /** Stop drawing and asking, and shut the inspector. */
  stop(): void;
}

/** Tell the app a definition to keep. */
function handOver(canvas: HTMLElement, definition: PageDefinition | WorkflowDefinition): void {
  canvas.dispatchEvent(new CustomEvent('definition-save', { detail: { definition }, bubbles: true, composed: true }));
}

/** The node a canvas's inspector shows: picked, followed on each draw, and let go. */
interface Picked {
  select(node: GraphNode, graph: DrawnGraph): void;
  follow(graph: DrawnGraph): void;
  stop(): void;
}

/** A canvas's picked node in its inspector: opened on a pick, followed on each draw, let go as it shuts. */
function pickedIn(
  canvas: SherpaLayoutCanvas, inspector: Inspector | undefined, show: (node: GraphNode, graph: DrawnGraph) => void, onClose?: () => void,
): Picked {
  let picked: string | null = null;
  const close = (event: Event): void => {
    if (event.target !== inspector) return;
    picked = null;
    markNode(canvas, null);
    onClose?.();
  };
  inspector?.addEventListener('panel-close', close);
  return {
    select(node, graph): void {
      picked = node.id;
      if (inspector) show(node, graph);
      inspector?.show();
    },
    follow(graph): void {
      const node = graph.nodes.find((n) => n.id === picked);
      if (inspector?.open && node) show(node, graph);
    },
    stop(): void {
      inspector?.removeEventListener('panel-close', close);
      inspector?.hide();
    },
  };
}

/** Each node's place, as a session keeps it. */
function isPlaces(v: unknown): v is NodePlaces {
  return !!v && typeof v === 'object' && !Array.isArray(v)
    && Object.values(v).every((p: { x?: unknown; y?: unknown } | null) => typeof p?.x === 'number' && typeof p?.y === 'number');
}

/** What drawing a page's Query needs beyond its source: the definition, the page's
 *  components, an inspector, and a session to keep each node's place. */
export interface QueryEditorOptions extends QueryGraphFacts {
  definition: PageDefinition;
  /** The overlay panel a picked node opens in: its rows again, and a component's live visual. */
  inspector?: Inspector;
  /** Where a moved node's place is kept for the tab (TODO 551): it survives a reload, and the session's end forgets it. */
  session?: SessionStore;
}

/** Keep a page's Query drawn on a canvas as it changes, and ask it for each edit.
 *  It draws what the controls show — the draft — and ASKS through the one door a chip
 *  asks through: whether a change applies at once or waits for Apply is the Query's,
 *  and so is a slot's Sort and Group. TRAP T-one-command-one-door */
export function bindQueryEditor(
  canvas: SherpaLayoutCanvas,
  source: Pick<DataSource, 'query'> & Partial<Pick<DataSource, 'valuesFor' | 'store' | 'state' | 'results' | 'addEventListener' | 'removeEventListener'>>,
  { definition, inspector, session, ...facts }: QueryEditorOptions,
): GraphEditor {
  const query = source.query;
  const typeOf = (field: string): string | undefined => facts.type?.(field) ?? definition.source?.fields?.[field]?.type;
  const values = facts.values ?? ((field: string) => source.valuesFor?.(field)?.map((v) => valueKey(v)));
  // A moved node's place: the reader's for the tab. TODO 551
  const pointer = `/nodes/${definition.id}`;
  session?.persist(pointer, { shared: false, guard: isPlaces });
  let places: NodePlaces = (session?.get(pointer) as NodePlaces | undefined) ?? {};
  const onMove = (node: GraphNode, x: number, y: number): void => {
    places = { ...places, [node.id]: { x, y } };
    session?.set(pointer, places);
  };
  const onEdit = (edit: GraphEdit): void => {
    const request = graphRequest(edit, { type: typeOf });
    if (!request) return;
    query.ask(request);
    // The page size is the source's, not the Query's: no query-change tells it.
    if (edit.node.kind === 'source') draw();
  };
  const onConnect = (route: NodeRoute): void => {
    const answer = routeRequest(graph, route, { type: typeOf, values });
    if (answer && 'refused' in answer) report({ code: 'query-route', message: answer.refused });
    else if (answer) query.ask(answer.request);
  };
  // The node in the inspector, and its live visual: kept while the same component is shown.
  let visual: { id: string; el: HTMLElement } | null = null;
  const visualOf = (node: GraphNode): HTMLElement | null => {
    const id = node.ref?.['component'];
    const page = id ? document.getElementById(id) : null;
    if (!id || !page) return null;
    if (visual?.id === id) return visual.el;
    // A COPY of the page's own component: it asks the provider as the page's does,
    // so it draws what the Query says. Its ids would clash, so it has none.
    const el = page.cloneNode(true) as HTMLElement;
    for (const one of [el, ...el.querySelectorAll('[id]')]) one.removeAttribute('id');
    const scope = node.ref?.['scope'];
    if (scope && scope !== VIEW) el.setAttribute('data-scope', scope);
    el.style.blockSize = '18rem';
    visual = { id, el };
    return el;
  };
  const picks = pickedIn(canvas, inspector, (node, now) => inspectNode(inspector!, node, now, { onEdit, visual: visualOf(node) }), () => { visual = null; });
  let graph: DrawnGraph = { nodes: [], routes: [] };
  const draw = (): void => {
    graph = placed(queryGraph(query.draft, definition, {
      ...facts, values, presets: (scope) => query.presets(scope), domains: source.store?.domains ?? {}, pageSize: source.state?.pageSize ?? null,
    }), places);
    drawGraph(canvas, graph, { onEdit, onMove, onConnect, onSelect: (node) => picks.select(node, graph) });
    picks.follow(graph);
  };
  draw();
  query.addEventListener('query-change', draw);
  const unwatch = watchQuery(canvas, source, definition);
  return {
    save(): boolean {
      const page = pageWithQuery(definition, query.draft, { pageSize: source.state?.pageSize ?? null, type: (f) => typeOf(f) as FieldType | undefined });
      if (!checkPage(page)) return false;
      handOver(canvas, page);
      return true;
    },
    stop(): void {
      query.removeEventListener('query-change', draw);
      unwatch();
      picks.stop();
    },
  };
}

/**
 * Light a page's Query graph as its source loads: the Source by the load, the Store
 * by its reads — the page's and its worker's, by the store's name or the load's
 * trace — then what the walk counted. A load is the source's when it begins as the
 * source says `loading`. TRAP T-a-step-names-its-node
 */
function watchQuery(
  canvas: SherpaLayoutCanvas,
  source: Pick<DataSource, 'query'> & Partial<Pick<DataSource, 'results' | 'addEventListener' | 'removeEventListener'>>,
  definition: PageDefinition,
): () => void {
  const store = definition.source?.store;
  let next = false;
  let run: string | null = null;
  const loading = (event: Event): void => {
    if (!(event as CustomEvent<{ loading?: boolean }>).detail?.loading) return;
    next = true;
    queueMicrotask(() => { next = false; });
  };
  // What the walk counted, said under the load once it ends: rows from the walk itself.
  const walked = async (load: Span): Promise<void> => {
    const results = source.results;
    if (!results) return;
    const applied = source.query.applied;
    const counted = await Promise.all(Object.keys(applied.scopes).map(async (scope) => [scope, await results.call(source, scope)] as const));
    const total = load.detail?.['total'];
    traceQuerySteps(applied, { walk: { results: Object.fromEntries(counted) }, ...(typeof total === 'number' ? { total } : {}) }, load);
  };
  source.addEventListener?.('loading', loading);
  const stop = watchSteps(canvas, {
    claims: (span) => {
      if (span.step === 'load' && span.ms === undefined && next) {
        next = false;
        run = span.id;
        return true;
      }
      return (!!store && span.store === store) || span.detail?.['graph'] === definition.id;
    },
    begins: (span) => span.id === run && span.ms === undefined,
    nodeOf: queryStepNode,
    onLit: (span) => { if (span.id === run && span.ms !== undefined) void walked(span); },
  });
  return () => {
    stop();
    source.removeEventListener?.('loading', loading);
  };
}

/** What editing a workflow needs beyond it: its facts, an inspector, a session, the kinds. */
export interface WorkflowEditorOptions extends WorkflowFacts {
  inspector?: Inspector;
  /** Where the DRAFT is kept for the tab (TODO 551): every edit, a move too, survives a
   *  reload, and the session's end forgets it — unless Save handed it over. */
  session?: SessionStore;
  kinds?: Readonly<Record<string, NodeKind>>;
}

/** A node's own name, line and place, as its inspector's first rows edit them. */
const OWN: Readonly<Record<string, keyof Pick<WorkflowNode, 'heading' | 'description' | 'x' | 'y'>>> = {
  '#heading': 'heading', '#description': 'description', '#x': 'x', '#y': 'y',
};

/** Keep a workflow's draft drawn on a canvas, and write each edit to it as a pure edit:
 *  a value, a move, a route, a node's own name. A route that would break the workflow is
 *  refused, and says why. A v1 — given, or a tab's draft — is read once as v2, and Save
 *  hands over the v2. N4 runs the draft. TRAP T-a-workflow-is-its-definition */
export function bindWorkflow(
  canvas: SherpaLayoutCanvas, workflow: WorkflowDefinition | WorkflowDefinitionV1,
  { inspector, session, kinds = NODE_KINDS, ...facts }: WorkflowEditorOptions = {},
): GraphEditor {
  const pointer = `/workflows/${workflow.id}`;
  const isDraft = (v: unknown): v is WorkflowDefinition | WorkflowDefinitionV1 => {
    const d = v as { v?: unknown; id?: unknown; nodes?: unknown } | null;
    return !!d && typeof d === 'object' && (d.v === 2 || d.v === 1) && d.id === workflow.id && Array.isArray(d.nodes);
  };
  session?.persist(pointer, { shared: false, guard: isDraft });
  // This tab's draft wins: a reload loses nothing. What a v1's read cannot map is said once.
  const kept = session?.get(pointer) as WorkflowDefinition | WorkflowDefinitionV1 | undefined;
  const read = readWorkflow(kept ?? structuredClone(workflow), kinds);
  for (const fault of read.faults) report({ code: 'workflow-definition', message: `bindWorkflow: ${fault}.`, at: { workflow: workflow.id } });
  let draft: WorkflowDefinition = read.workflow ?? { v: 2, id: workflow.id, nodes: [] };
  let graph: DrawnGraph = { nodes: [], routes: [] };
  const write = (next: WorkflowDefinition): void => {
    draft = next;
    session?.set(pointer, next);
    draw();
  };
  const onEdit = ({ node, row, value }: GraphEdit): void => {
    const own = OWN[row.name];
    if (!own) return write(editWorkflow(draft, { node: node.id, row: row.name, value }, kinds));
    const said = own === 'x' || own === 'y' ? typedValue('number', String(value ?? '')) : String(value ?? '');
    if ((own === 'x' || own === 'y') && typeof said !== 'number') return;
    write(editWorkflow(draft, { node: node.id, set: { [own]: said } }, kinds));
  };
  const onMove = (node: GraphNode, x: number, y: number): void => write(editWorkflow(draft, { node: node.id, set: { x, y } }, kinds));
  const onConnect = (route: NodeRoute): void => {
    const next = editWorkflow(draft, { route }, kinds);
    const was = new Set(workflowFaults(draft, kinds));
    const added = workflowFaults(next, kinds).filter((f) => !was.has(f));
    if (added.length) report({ code: 'workflow-route', message: `bindWorkflow: ${added.join('; ')}.`, at: { workflow: draft.id } });
    else write(next);
  };
  // The inspector leads with the node's own name, line and place.
  const withOwn = (node: GraphNode): GraphNode => {
    const at = draft.nodes.find((n) => n.id === node.id);
    const own: GraphRow[] = [
      { name: '#heading', label: 'Name', control: 'text', value: node.heading, editable: true },
      { name: '#description', label: 'Description', control: 'text', value: node.description ?? '', editable: true },
      { name: '#x', label: 'X', control: 'number', value: at?.x, editable: true },
      { name: '#y', label: 'Y', control: 'number', value: at?.y, editable: true },
    ];
    return { ...node, rows: [...own, ...node.rows] };
  };
  const picks = pickedIn(canvas, inspector, (node, now) => inspectNode(inspector!, withOwn(node), now, { onEdit }));
  const draw = (): void => {
    graph = workflowGraph(draft, facts, kinds);
    drawGraph(canvas, graph, { onEdit, onMove, onConnect, onSelect: (node) => picks.select(node, graph) });
    picks.follow(graph);
  };
  draw();
  // A run lights its nodes: each step names its node, and the run its workflow. N4 reports.
  const unwatch = watchSteps(canvas, { claims: (span) => span.detail?.['graph'] === workflow.id });
  return {
    save(): boolean {
      if (!checkWorkflow(draft, kinds)) return false;
      handOver(canvas, draft);
      // The definition holds it now: the draft goes.
      session?.set(pointer, undefined);
      return true;
    },
    stop(): void {
      unwatch();
      picks.stop();
    },
  };
}
