/**
 * node-graph.ts — a graph of nodes drawn on a sherpa-layout-canvas, and the two editors kept
 * drawn there: a page's Query, which each edit ASKS, and a workflow, whose draft each edit
 * writes. Places last the tab; Save hands the app a checked definition. Each node lights as
 * its step runs, from the one trace stream. A workflow's Custom Node opens, is edited as its
 * definition, updates its uses, and is made from picked nodes. A zip tie funnels routes through one place (plan 562). Will, TODOs 555, 551, 671, 719, 562, 735.
 * TRAP T-the-node-editor-asks-the-query · TRAP T-a-step-names-its-node
 *
 * Map:
 * - DrawOptions — What a drawing tells its host: each edit, each node a reader picks or moves, and each new route.
 * - tieSpot — Where routes would be tied with no pointer: the middle of the way each takes, on the plane.
 * - drawGraph — Draw a graph on a canvas: each node by id, at its place when that moved; then its routes.
 * - markNode — Mark one node as the one picked, or none.
 * - markNodes — Mark several nodes as the ones picked.
 * - markRoutes — Mark routes as the ones picked.
 * - pickedRoutes — The routes picked: by a click, a box, or the keys.
 * - WatchOptions — What a graph's watch is told: which traces are its, and which node each span lights.
 * - watchSteps — Light a canvas's nodes from the one trace stream as their steps run; its stop lets it go.
 * - InspectOptions — What an inspector shows beside a node's rows, and whom it tells of an edit.
 * - inspectNode — Fill an overlay panel with one node: its rows again, their routes, and a visual.
 * - Inspector — The overlay panel a picked node opens in.
 * - GraphEditor — What an editor's binding gives back: Save, and the undo.
 * - Undoable — An editor whose edits are steps.
 * - WorkflowEditor — A workflow's editor: Save and stop, and the Custom Nodes it opens, discards and holds.
 * - QueryEditorOptions — What drawing a page's Query needs beyond its source: its definition, an inspector, a session.
 * - bindQueryEditor — Keep a page's Query drawn on a canvas as it changes, and ask it for each edit.
 * - WorkflowEditorOptions — What editing a workflow needs beyond it: its facts, an inspector, a node panel, a session, the kinds.
 * - bindWorkflow — Keep a workflow's draft drawn on a canvas, and write each edit to it.
 */
import '../../components/sherpa-button/sherpa-button.js';
import '../../components/sherpa-input-text/sherpa-input-text.js';
import '../../components/sherpa-key-value-list/sherpa-key-value-list.js';
import '../../components/sherpa-node/sherpa-node.js';
import '../../components/sherpa-node-row/sherpa-node-row.js';
import '../../components/sherpa-menu/sherpa-menu.js';
import '../../components/sherpa-quick-filter/sherpa-quick-filter.js';
import '../../components/sherpa-group/sherpa-group.js';
import '../../components/sherpa-stack/sherpa-stack.js';
import '../../components/sherpa-switch/sherpa-switch.js';
import type { AddContext, SherpaNodePanel } from '../../components/sherpa-node-panel/sherpa-node-panel.js';
import type { SherpaLayoutCanvas } from '../../components/sherpa-layout-canvas/sherpa-layout-canvas.js';
import { primaryKey } from './modifier-key.js';
import { boxCover, boxPick, type BoxMode, type PickBox } from './box-pick.js';
import type { SocketSide } from '../../components/sherpa-node/node-sockets.js';
import type { SessionStore } from '../browser/session.js';
import type { DataSource } from '../data/data-source.js';
import { Journal } from '../data/journal.js';
import type { Query } from '../data/query.js';
import { checkPage, pageWithQuery, type PageDefinition } from '../data/page-definition.js';
import { graphRequest, placeRequest, queryGraph, queryStepNode, routeRequest, statusTallies, traceQuerySteps, type QueryGraphFacts } from '../data/query-graph.js';
import { onTrace, type Span, type StepState, type TraceHost } from '../data/trace.js';
import { VIEW } from '../data/query.js';
import { OP_LABELS, valueKey, type FilterOp } from '../data/store.js';
import { report } from '../data/report.js';
import {
  checkNodeLibrary, copyToMine, definitionDiff, editDefinition, innerOf, kindsOf, staleUses, updateAll, updateInstance, useOf, workflowFaultsDeep,
  type Inner, type NodeDefinition, type NodeLibrary,
} from '../data/node-library.js';
import { groupNodes, ungroupUse } from '../data/node-group.js';
import { instancePane, groupPane, updatePane } from './node-group-panel.js';
import { typedValue, type FieldType } from '../data/filter-state.js';
import {
  FALSE_SOCKET, NODE_KINDS, fitOf, paletteOf, placed, rowChoices, socketOf, socketType,
  type DrawnGraph, type GraphEdit, type GraphNode, type GraphRow, type NodeKind, type NodePlaces, type NodeSize, type NodeRoute, type NodeTie, type SocketType,
} from '../data/node-kinds.js';
import {
  TIE_GAP, addCustomValue, checkWorkflow, editWorkflow, readWorkflow, tieLimit, workflowGraph,
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
  /** A node the reader resized, and its new size in times its natural one (TODO 740). */
  onResize?: (node: GraphNode, size: NodeSize) => void;
  /** A line dragged from an output socket and let go on an input socket. */
  onConnect?: (route: NodeRoute) => void;
  /** A route's input end dragged off its socket and let go on another input socket (TODO 557). */
  onReroute?: (was: NodeRoute, now: NodeRoute) => void;
  /** A route let go over the bare canvas, or a clicked one deleted (TODO 558). */
  onBreak?: (route: NodeRoute) => void;
  /** The zip tie tool is on. */
  tying?: boolean;
  /** A line dragged across routes: they are tied, at a place on the plane. */
  onTie?: (routes: NodeRoute[], at: { x: number; y: number }) => void;
  /** A tie dragged or moved by a key, to a place. */
  onTieMove?: (id: string, x: number, y: number) => void;
  /** A picked tie deleted. */
  onUntie?: (id: string) => void;
  /** A click on blank canvas: no node is picked, the panel shuts (TODO 559). */
  onDeselect?: () => void;
  /** A box dragged on the blank canvas picked these nodes (TODO 735); the routes it crossed are picked and drawn. */
  onBox?: (nodes: string[]) => void;
  /** The picked routes changed: a click, a box, or a key. */
  onPicked?: (routes: NodeRoute[]) => void;
  /** Picked routes cut with Delete or Backspace, as one edit; unset, each goes to `onBreak`. */
  onBreakAll?: (routes: NodeRoute[]) => void;
  /** A line dragged out of an unrouted picklist's input socket and let go on the bare canvas, at a place on the plane. */
  onCustom?: (to: string, at: { x: number; y: number }) => void;
  /** A line let go on the bare canvas from a socket of any type: "Add a node" opens there (D16). Where unset, the line goes nowhere. */
  onAdd?: (context: AddContext) => void;
  /** A line over a node, by its id, while no run lights it: "Update available" on an out-of-date instance. */
  notes?: ReadonlyMap<string, string>;
  /** A node whose place the host owns: a drag reports and moves nothing (the Group Input, a preset's inside). */
  locked?: (node: GraphNode) => boolean;
}

/** A field a row draws: a text field or a select, a menu of ticks (a quick-filter chip), or a switch. */
type Field = HTMLElement & { value: unknown; values?: string[]; menu?: HTMLElement & { populate(items: unknown): void }; checked?: boolean; populate?(items: unknown): void };

/** The events a field says its change by: its own `change`, or a chip's pick. */
const CHANGES = ['change', 'quick-filter-change'] as const;

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
  /** The zip ties, and the one a click picked: Delete removes it, the arrow keys move it. */
  ties: readonly NodeTie[];
  selectedTie: string | null;
  /** Each drawn route's points on the plane, for a tie's line to cross. */
  lanes: { route: NodeRoute; dots: [number, number][] }[];
  /** The tie tool is on: a drag on the blank canvas ties what it crosses. */
  tying: boolean;
  /** The line a reader is drawing, kept over each redraw of the routes. */
  draft: SVGPathElement | null;
  /** The route whose end the reader holds: not drawn while it is. */
  lifted: NodeRoute | null;
  /** The routes picked, by a click or a box: Delete or Backspace breaks them, T ties them. */
  picked: NodeRoute[];
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

/** A row's field: a switch, a menu of ticks, a select of its choices, or a text or number field.
 *  LOCKED — read only — where a route drives it, or nothing outside takes its change. */
function fieldFor(row: GraphRow, locked: boolean): Field {
  if (row.multiple) {
    // The panel's own multi-value field: a chip that opens a menu of ticks.
    const chip = document.createElement('sherpa-quick-filter') as Field;
    chip.setAttribute('data-persistent', '');
    chip.setAttribute('data-menu', '');
    const menu = document.createElement('sherpa-menu');
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-select', 'multiple');
    menu.setAttribute('data-no-select-all', '');
    chip.append(menu);
    if (locked) chip.setAttribute('disabled', '');
    return chip;
  }
  if (row.control === 'switch') {
    const field = document.createElement('sherpa-switch') as Field;
    if (locked) field.setAttribute('disabled', '');
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
  else if (row.multiple) {
    const picks = Array.isArray(row.value) ? row.value.map(String) : [];
    const menu = field.menu ?? field.querySelector<NonNullable<Field['menu']>>('sherpa-menu');
    menu?.populate((row.choices ?? []).map((c) => ({ value: c.value, label: c.label, selected: picks.includes(c.value) })));
    field.values = picks;
  }
  // A select holds its value's KEY, and shows its label itself.
  else field.value = row.choices ? String(row.value ?? '') : shown(row);
}

/** What a field says now, as its row's value. */
function read(field: Field, row: GraphRow): unknown {
  return row.control === 'switch' ? !!field.checked : row.multiple ? [...(field.values ?? [])] : field.value;
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
    line.toggleAttribute('data-input-many', !!row.many);
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

/** One cubic piece, out of one point and into the next, flat at both. */
function piece([x1, y1]: [number, number], [x2, y2]: [number, number]): string {
  const bend = Math.max(40, Math.abs(x2 - x1) / 2);
  return `C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

/** A route's curve on the plane: out of one socket, into the next. */
function curve(from: [number, number], to: [number, number]): string {
  return `M ${from[0]} ${from[1]} ${piece(from, to)}`;
}

/** Points along the same piece, for the line a click can land on: a wide, unseen stroke. */
function along([x1, y1]: [number, number], [x2, y2]: [number, number]): [number, number][] {
  const bend = Math.max(40, Math.abs(x2 - x1) / 2);
  const [c1, c2] = [x1 + bend, x2 - bend];
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    const u = 1 - t;
    const at = (a: number, b: number, c: number, d: number): number => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    return [at(x1, c1, c2, x2), at(y1, y1, y2, y2)];
  });
}

/** A tie's place as drawn: its x kept within the limit of its routes' nodes. Drawing never writes. */
function tieX(drawn: Drawn, tie: NodeTie): number {
  const limit = tieLimit(drawn.graph, tie);
  return limit ? Math.min(limit.max, Math.max(limit.min, tie.x)) : tie.x;
}

/** The place a tie funnels its nth route through. */
function slotOf(drawn: Drawn, tie: NodeTie, n: number): [number, number] {
  return [tieX(drawn, tie), tie.y + (n - (tie.routes.length - 1) / 2) * TIE_GAP];
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
  const same = (a: NodeRoute | null, b: NodeRoute): boolean => !!a && a.from === b.from && a.to === b.to;
  const lanes: Drawn['lanes'] = [];
  const paths = drawn.routes.flatMap((route) => {
    const a = socketAt(drawn, route.from, 'output');
    const b = socketAt(drawn, route.to, 'input');
    if (!a || !b || same(drawn.lifted, route)) return [];
    const [from, to] = [onPlane(canvas, a), onPlane(canvas, b)];
    // The ties it passes, left to right: a flat piece into each slot, and out of it.
    const stops = drawn.ties.flatMap((tie) => {
      const n = tie.routes.findIndex((r) => same(r, route));
      return n < 0 ? [] : [slotOf(drawn, tie, n)];
    }).sort((p, q) => p[0] - q[0]);
    const points = [from, ...stops, to];
    const pieces = points.slice(1).map((p, i) => ({ a: points[i]!, b: p }));
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', `M ${from[0]} ${from[1]} ${pieces.map((q) => piece(q.a, q.b)).join(' ')}`);
    path.dataset['type'] = outputType(drawn.graph, route.from);
    path.dataset['from'] = route.from;
    path.dataset['to'] = route.to;
    if (drawn.picked.some((r) => same(r, route))) path.setAttribute('data-selected', '');
    // The line a click lands on: wide, unseen, and the only part of the lines that takes the pointer.
    const hit = document.createElementNS(SVG, 'polyline');
    const dots = pieces.flatMap((q) => along(q.a, q.b));
    lanes.push({ route, dots });
    hit.setAttribute('points', dots.map(([x, y]) => `${x},${y}`).join(' '));
    hit.setAttribute('class', 'graph-hit');
    hit.setAttribute('style', 'stroke: transparent; stroke-width: 14px; pointer-events: stroke; cursor: pointer');
    hit.dataset['from'] = route.from;
    hit.dataset['to'] = route.to;
    return [path, hit];
  });
  drawn.lanes = lanes;
  const bars = drawn.ties.map((tie) => {
    const [x, y] = slotOf(drawn, tie, 0);
    const high = (tie.routes.length - 1) * TIE_GAP + 16;
    const bar = document.createElementNS(SVG, 'rect');
    for (const [k, v] of Object.entries({ x: x - 2, y: y - 8, width: 4, height: high, rx: 2, class: 'graph-tie' })) bar.setAttribute(k, String(v));
    bar.setAttribute('style', 'fill: var(--sherpa-style-border-base, #b3b3c3); stroke: none; pointer-events: all; cursor: grab');
    bar.dataset['tie'] = tie.id;
    if (drawn.selectedTie === tie.id) bar.setAttribute('data-selected', '');
    return bar;
  });
  drawn.lines.replaceChildren(...paths, ...bars, ...(drawn.draft ? [drawn.draft] : []));
}

/** A socket's box on the screen: a node's or a row's, on one side; a False is its footer's. */
function socketAt(drawn: Drawn, address: string, side: SocketSide): DOMRect | null {
  const { node, row } = socketOf(address);
  if (row === FALSE_SOCKET) return (drawn.nodes.get(node) as HasSockets | undefined)?.socketRect?.('false') ?? null;
  const el = (row === undefined ? drawn.nodes.get(node) : drawn.rows.get(address)) as HasSockets | undefined;
  return el?.socketRect?.(side) ?? null;
}

/** Where a drawn node or row is: `node`, or `node/row`. */
function addressOf(drawn: Drawn, el: HTMLElement): string | null {
  const row = drawn.addresses.get(el);
  if (row) return `${row[0]}/${row[1]}`;
  return [...drawn.nodes].find(([, node]) => node === el)?.[0] ?? null;
}

/** The socket of one side nearest a point on the screen, within reach, or none. */
function socketNear(drawn: Drawn, side: 'input' | 'output', x: number, y: number): string | null {
  const REACH = 16;
  let best: [string, number] | null = null;
  for (const [address, el] of [...drawn.nodes, ...drawn.rows]) {
    const rect = (el as HasSockets).socketRect?.(side);
    if (!rect) continue;
    const far = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
    if (far <= REACH && (!best || far < best[1])) best = [address, far];
  }
  return best?.[0] ?? null;
}

/** Whether an input is a picklist a Value node may be routed into (D7): a row, one value in. */
function takesCustom(drawn: Drawn, address: string): boolean {
  const { node, row: name } = socketOf(address);
  const row = name === undefined ? undefined : drawn.graph.nodes.find((n) => n.id === node)?.rows.find((r) => r.name === name);
  return !!row && row.input === 'value' && !row.many && rowChoices(row) !== undefined;
}

/**
 * A press on a socket draws a line. From an OUTPUT, a new route: let go on an input socket and
 * the host is asked to join them. On a ROUTED input, its end comes up (TODO 557): let go on
 * another input socket, the route moves there; on the bare canvas it breaks (558); where it
 * began, nothing. On an UNROUTED picklist's input, the line runs the other way: let go on an
 * output, they join; on the bare canvas, a Value node is made there. It never moves the
 * node or the view.
 */
function connectFrom(canvas: SherpaLayoutCanvas, drawn: Drawn, event: PointerEvent): void {
  const path = event.composedPath();
  const hit = path[0];
  if (event.button !== 0 || !(hit instanceof Element)) return;
  const out = hit.classList.contains('socket-out');
  if (!out && !hit.classList.contains('socket-in')) return;
  const owner = path.find((n): n is HTMLElement => n instanceof HTMLElement && addressOf(drawn, n) !== null);
  const own = owner ? addressOf(drawn, owner) : null;
  if (!owner || !own) return;
  const fork = hit.classList.contains('socket-false');
  // What the line is joined to at its start: the output it leaves, or the input it runs back to.
  const lifting = out ? undefined : drawn.routes.findLast((r) => r.to === own);
  if (!out && !lifting && !takesCustom(drawn, own) && !(drawn.options.onAdd && typeAt(drawn, own, 'input'))) return;
  const from = out ? (fork ? `${own}/${FALSE_SOCKET}` : own) : lifting?.from;
  const start = out ? (owner as HasSockets).socketRect?.(fork ? 'false' : 'output') : lifting ? socketAt(drawn, lifting.from, 'output') : (owner as HasSockets).socketRect?.('input');
  if (!start) return;
  event.preventDefault();
  event.stopPropagation();
  const draft = document.createElementNS(SVG, 'path');
  draft.setAttribute('class', 'graph-draft');
  draft.setAttribute('stroke-dasharray', '6 4');
  drawn.draft = draft;
  drawn.lifted = lifting ?? null;
  drawn.lines.append(draft);
  if (lifting) drawRoutes(canvas, drawn);
  const begin = onPlane(canvas, start);
  const plane = (e: PointerEvent): [number, number] => {
    const box = canvas.getBoundingClientRect();
    const { x, y, zoom } = canvas.view;
    return [(e.clientX - box.left - x) / zoom, (e.clientY - box.top - y) / zoom];
  };
  const follow = (e: PointerEvent): void => {
    draft.setAttribute('d', out || lifting ? curve(begin, plane(e)) : curve(plane(e), begin));
  };
  // "Add a node" for a line let go on the bare canvas: the socket's type, and where.
  const addFrom = (socket: string, side: 'out' | 'in', e: PointerEvent): void => {
    const type = typeAt(drawn, socket, side === 'out' ? 'output' : 'input');
    const [x, y] = plane(e);
    if (type) drawn.options.onAdd?.({ socket, type, side, client: { x: e.clientX, y: e.clientY }, at: { x: Math.round(x), y: Math.round(y) } });
  };
  const stop = (e: PointerEvent): void => {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    draft.remove();
    drawn.draft = null;
    drawn.lifted = null;
    drawRoutes(canvas, drawn);
    if (e.type !== 'pointerup') return;
    const onNode = e.composedPath().some((n) => n instanceof HTMLElement && addressOf(drawn, n) !== null);
    const bare = !onNode && !socketNear(drawn, 'input', e.clientX, e.clientY) && !socketNear(drawn, 'output', e.clientX, e.clientY);
    if (out) {
      const to = socketNear(drawn, 'input', e.clientX, e.clientY);
      // Let go on the bare canvas, or on its own node: nothing is joined.
      if (to && from && socketOf(to).node !== socketOf(from).node) drawn.options.onConnect?.({ from, to });
      else if (bare && from) addFrom(from, 'out', e);
    } else if (lifting) {
      const to = socketNear(drawn, 'input', e.clientX, e.clientY);
      if (to && to !== lifting.to && socketOf(to).node !== socketOf(lifting.from).node) drawn.options.onReroute?.(lifting, { from: lifting.from, to });
      else if (bare) drawn.options.onBreak?.(lifting);
    } else {
      const source = socketNear(drawn, 'output', e.clientX, e.clientY);
      if (source && socketOf(source).node !== socketOf(own).node) drawn.options.onConnect?.({ from: source, to: own });
      else if (bare) {
        const [x, y] = plane(e);
        if (takesCustom(drawn, own)) drawn.options.onCustom?.(own, { x, y });
        else addFrom(own, 'in', e);
      }
    }
  };
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

/** A point on the canvas's plane, from one on the screen. */
function planeOf(canvas: SherpaLayoutCanvas, e: { clientX: number; clientY: number }): [number, number] {
  const box = canvas.getBoundingClientRect();
  const { x, y, zoom } = canvas.view;
  return [(e.clientX - box.left - x) / zoom, (e.clientY - box.top - y) / zoom];
}

/** Where two segments cross; none, they do not. */
function crossing([ax, ay]: [number, number], [bx, by]: [number, number], [cx, cy]: [number, number], [dx, dy]: [number, number]): [number, number] | undefined {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (!d) return undefined;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [ax + t * (bx - ax), ay + t * (by - ay)] : undefined;
}

/** A tie dragged: it follows the pointer, and its host moves it within its limit. */
function dragTie(canvas: SherpaLayoutCanvas, drawn: Drawn, id: string, down: PointerEvent): void {
  const tie = drawn.ties.find((t) => t.id === id);
  if (!tie) return;
  down.preventDefault();
  down.stopPropagation();
  drawn.selectedTie = id;
  drawn.picked = [];
  drawRoutes(canvas, drawn);
  canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
  const [px, py] = planeOf(canvas, down);
  const [x0, y0] = [tieX(drawn, tie), tie.y];
  const follow = (e: PointerEvent): void => {
    const [x, y] = planeOf(canvas, e);
    drawn.options.onTieMove?.(id, Math.round(x0 + x - px), Math.round(y0 + y - py));
  };
  const stop = (): void => {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
  };
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

/** With the tie tool on, a line dragged on the blank canvas: each route it crosses is tied, top to bottom. */
function lineTie(canvas: SherpaLayoutCanvas, drawn: Drawn, down: PointerEvent): void {
  down.preventDefault();
  down.stopPropagation();
  const begin = planeOf(canvas, down);
  const draft = document.createElementNS(SVG, 'path');
  draft.setAttribute('class', 'graph-draft');
  draft.setAttribute('stroke-dasharray', '6 4');
  drawn.draft = draft;
  drawn.lines.append(draft);
  const follow = (e: PointerEvent): void => {
    const [x, y] = planeOf(canvas, e);
    draft.setAttribute('d', `M ${begin[0]} ${begin[1]} L ${x} ${y}`);
  };
  const stop = (e: PointerEvent): void => {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    draft.remove();
    drawn.draft = null;
    if (e.type !== 'pointerup') return;
    const end = planeOf(canvas, e);
    const hits = drawn.lanes.flatMap(({ route, dots }) => {
      for (let i = 1; i < dots.length; i++) {
        const at = crossing(begin, end, dots[i - 1]!, dots[i]!);
        if (at) return [{ route, at }];
      }
      return [];
    }).sort((a, b) => a.at[1] - b.at[1]);
    if (!hits.length) return;
    const mean = (n: 0 | 1): number => Math.round(hits.reduce((sum, h) => sum + h.at[n], 0) / hits.length);
    drawn.options.onTie?.(hits.map((h) => h.route), { x: mean(0), y: mean(1) });
  };
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

/** Where routes would be tied with no pointer: the middle of the way each takes, on the plane. */
export function tieSpot(canvas: SherpaLayoutCanvas, routes: readonly NodeRoute[]): { x: number; y: number } {
  const lanes = (drawnOn.get(canvas)?.lanes ?? []).filter((l) => routes.some((r) => r.from === l.route.from && r.to === l.route.to));
  const ends = lanes.map((l) => [l.dots[0]!, l.dots.at(-1)!] as const);
  const mean = (n: 0 | 1): number => (ends.length ? Math.round(ends.reduce((sum, [a, b]) => sum + (a[n] + b[n]) / 2, 0) / ends.length) : 0);
  return { x: mean(0), y: mean(1) };
}

/** Clear what is picked: every node, and every route. */
function deselect(canvas: SherpaLayoutCanvas, drawn: Drawn): void {
  markNode(canvas, null);
  if (drawn.picked.length || drawn.selectedTie) {
    drawn.picked = [];
    drawn.selectedTie = null;
    drawRoutes(canvas, drawn);
    drawn.options.onPicked?.([]);
  }
  drawn.options.onDeselect?.();
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
    lines, routes: [], ties: [], selectedTie: null, lanes: [], tying: false, draft: null, lifted: null, picked: [], fitted: false,
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
  canvas.addEventListener('node-resize', (event) => {
    drawRoutes(canvas, made);
    const node = nodeOf(made, event.target);
    if (node) made.options.onResize?.(node, (event as CustomEvent<NodeSize>).detail);
  });
  // Before the node and the view hear it: a drag from an output socket is a new route.
  canvas.addEventListener('pointerdown', (event) => connectFrom(canvas, made, event), { capture: true });
  // A tie is dragged; with the tool on, a line on the blank canvas ties the routes it crosses. TODO 562
  canvas.addEventListener('pointerdown', (down) => {
    const first = down.composedPath()[0];
    if (down.button !== 0 || !(first instanceof Element)) return;
    const id = first instanceof SVGElement && first.classList.contains('graph-tie') ? first.dataset['tie'] : undefined;
    if (id) dragTie(canvas, made, id, down);
    else if (made.tying && (first.classList.contains('viewport') || first.classList.contains('plane'))) lineTie(canvas, made, down);
  }, { capture: true });
  // A click — a press and a release, the pointer still — on the blank canvas deselects. TODO 559
  canvas.addEventListener('pointerdown', (down) => {
    const first = down.composedPath()[0];
    if (down.button !== 0 || !(first instanceof Element) || !(first.classList.contains('viewport') || first.classList.contains('plane'))) return;
    const up = (event: PointerEvent): void => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (event.type === 'pointerup' && Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) <= 4) deselect(canvas, made);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, { capture: true });
  // A click on a route picks it; Delete or Backspace breaks it. TODO 558
  lines.addEventListener('click', (event) => {
    const hit = event.target instanceof SVGElement && event.target.classList.contains('graph-hit') ? event.target : null;
    if (!hit) return;
    const route = { from: hit.dataset['from']!, to: hit.dataset['to']! };
    const held = made.picked.some((r) => r.from === route.from && r.to === route.to);
    // Shift adds a route to the pick, or takes it off.
    made.picked = event.shiftKey ? (held ? made.picked.filter((r) => r.from !== route.from || r.to !== route.to) : [...made.picked, route]) : [route];
    made.selectedTie = null;
    drawRoutes(canvas, made);
    made.options.onPicked?.(made.picked);
    // The canvas's own keys hear the break.
    canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
  });
  // A picked tie: Delete removes it; the arrow keys move it, 8px, or 32 with Shift.
  canvas.addEventListener('keydown', (event) => {
    const tie = made.ties.find((t) => t.id === made.selectedTie);
    if (event.target !== canvas || !tie) return;
    const step = event.shiftKey ? 32 : 8;
    const by: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (event.key === 'Delete' || event.key === 'Backspace') made.options.onUntie?.(tie.id);
    else if (by[event.key]) made.options.onTieMove?.(tie.id, Math.round(tieX(made, tie) + by[event.key]![0]), tie.y + by[event.key]![1]);
    else return;
    event.preventDefault();
    event.stopPropagation();
  });
  canvas.addEventListener('keydown', (event) => {
    if (event.target !== canvas || !made.picked.length) return;
    if (event.key === 'Escape') {
      deselect(canvas, made);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      const routes = made.picked;
      made.picked = [];
      if (routes.length > 1 && made.options.onBreakAll) made.options.onBreakAll(routes);
      else for (const route of routes) made.options.onBreak?.(route);
      drawRoutes(canvas, made);
      made.options.onPicked?.([]);
    } else return;
    event.preventDefault();
  });
  // With no pointer: C picks the routes of the picked nodes — or of the node the keys are on; Shift+C adds
  // them to the pick, Alt+C takes them off it (TODO 735, 739).
  canvas.addEventListener('keydown', (event) => {
    const first = event.composedPath()[0];
    if (event.code !== 'KeyC' || event.ctrlKey || event.metaKey || (event.altKey && event.shiftKey)) return;
    if (first instanceof Element && first.matches('input, select, textarea, [contenteditable]')) return;
    const own = event.composedPath().find((n): n is HTMLElement => n instanceof HTMLElement && n.localName === 'sherpa-node');
    const held = [...made.nodes].filter(([, el]) => el.hasAttribute('data-current') || el === own).map(([id]) => id);
    const routes = made.routes.filter((r) => held.includes(socketOf(r.from).node) || held.includes(socketOf(r.to).node));
    if (!routes.length) return;
    const has = (r: NodeRoute): boolean => routes.some((x) => x.from === r.from && x.to === r.to);
    const mine = routes.map(({ from, to }) => ({ from, to }));
    made.picked = event.altKey ? made.picked.filter((r) => !has(r)) : event.shiftKey ? [...made.picked.filter((r) => !has(r)), ...mine] : mine;
    made.selectedTie = null;
    drawRoutes(canvas, made);
    made.options.onPicked?.(made.picked);
    event.preventDefault();
    event.stopPropagation();
  });
  // A box dragged on the blank canvas: plain, the nodes it encloses or else the routes it crosses; Shift adds
  // both kinds; Ctrl takes both kinds off the pick. TODO 735, 739
  canvas.setAttribute('data-select-box', '');
  canvas.addEventListener('canvas-box', (event) => {
    const { mode, ...box } = (event as CustomEvent<PickBox & { mode: BoxMode }>).detail;
    const boxes = [...made.nodes].map(([id, el]) => [id, { left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight }] as const);
    const same = (a: NodeRoute, b: NodeRoute): boolean => a.from === b.from && a.to === b.to;
    let ids: Set<string>;
    let hit: { nodes: string[]; routes: NodeRoute[] };
    if (mode === 'replace') {
      hit = boxPick(box, boxes, made.lanes);
      ids = new Set(hit.nodes);
    } else {
      const cover = boxCover(box, boxes, made.lanes);
      const held = new Set([...made.nodes].filter(([, el]) => el.hasAttribute('data-current')).map(([id]) => id));
      if (mode === 'add') {
        ids = new Set([...held, ...cover.nodes]);
        hit = { nodes: [...ids], routes: [...made.picked, ...cover.routes.filter((r) => !made.picked.some((p) => same(p, r)))] };
      } else {
        ids = new Set([...held].filter((id) => !cover.nodes.includes(id)));
        hit = { nodes: [...ids], routes: made.picked.filter((p) => !cover.routes.some((r) => same(p, r))) };
      }
    }
    made.picked = hit.routes.map(({ from, to }) => ({ from, to }));
    made.selectedTie = null;
    markNodes(canvas, ids);
    drawRoutes(canvas, made);
    if (ids.size || made.picked.length) made.options.onBox?.([...ids]);
    else deselect(canvas, made);
    made.options.onPicked?.(made.picked);
    // The canvas's own keys hear T and Delete.
    canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
  });
  // A field's change, as an EDIT for the host: the drawing writes nothing itself.
  for (const type of CHANGES) canvas.addEventListener(type, (event) => {
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
    el.toggleAttribute('data-locked', !!options.locked?.(node));
    // A run's caption wins; else the host's note.
    if (!el.hasAttribute('data-step')) put(el, 'data-caption', options.notes?.get(node.id));
    // Its data in, of any type; out, its True where it forks.
    put(el, 'data-input-socket', socketType(node, undefined, 'input'));
    put(el, 'data-output-socket', socketType(node, undefined, 'output'));
    el.toggleAttribute('data-input-many', !!node.many);
    put(el, 'data-category', node.category?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    put(el, 'data-scale-w', node.size ? String(node.size.w) : undefined);
    put(el, 'data-scale-h', node.size ? String(node.size.h) : undefined);
    el.toggleAttribute('data-branches', !!node.branches);
    el.toggleAttribute('data-input-routed', graph.routes.some((r) => r.to === node.id));
    el.toggleAttribute('data-output-routed', graph.routes.some((r) => r.from === node.id));
    el.toggleAttribute('data-false-routed', graph.routes.some((r) => r.from === `${node.id}/${FALSE_SOCKET}`));
    drawRows(drawn, el, node);
  }
  drawn.routes = graph.routes;
  drawn.ties = graph.ties ?? [];
  drawn.tying = !!options.tying;
  if (drawn.selectedTie && !drawn.ties.some((t) => t.id === drawn.selectedTie)) drawn.selectedTie = null;
  const left = drawn.picked.filter((p) => graph.routes.some((r) => r.from === p.from && r.to === p.to));
  if (left.length !== drawn.picked.length) {
    drawn.picked = left;
    options.onPicked?.(left);
  }
  requestAnimationFrame(() => drawRoutes(canvas, drawn));
}

/** Mark one node as the one picked, or none. */
export function markNode(canvas: SherpaLayoutCanvas, id: string | null): void {
  for (const [key, el] of drawnOn.get(canvas)?.nodes ?? []) el.toggleAttribute('data-current', key === id);
}

/** Mark several nodes as the ones picked. */
export function markNodes(canvas: SherpaLayoutCanvas, ids: ReadonlySet<string>): void {
  for (const [key, el] of drawnOn.get(canvas)?.nodes ?? []) el.toggleAttribute('data-current', ids.has(key));
}

/** Mark routes as the ones picked. */
export function markRoutes(canvas: SherpaLayoutCanvas, routes: readonly NodeRoute[]): void {
  const drawn = drawnOn.get(canvas);
  if (!drawn) return;
  drawn.picked = routes.map(({ from, to }) => ({ from, to }));
  drawRoutes(canvas, drawn);
  drawn.options.onPicked?.(drawn.picked);
}

/** The routes picked: by a click, a box, or the keys. */
export function pickedRoutes(canvas: SherpaLayoutCanvas): NodeRoute[] {
  return [...(drawnOn.get(canvas)?.picked ?? [])];
}

/** Put the keyboard on one drawn node's header, once it is drawn. */
function focusNode(canvas: SherpaLayoutCanvas, id: string): void {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = drawnOn.get(canvas)?.nodes.get(id);
    (el?.shadowRoot?.querySelector('.header') as HTMLElement | null | undefined)?.focus();
  }));
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
  /** A reader asks a Value node for an unrouted picklist row: the button that is the drag, with no pointer. */
  onCustom?: (row: GraphRow) => void;
  /** A reader cuts one route, by the button that is the drag's break. */
  onCut?: (route: NodeRoute) => void;
  /** A reader removes this node. */
  onRemove?: () => void;
  /** What a Custom Node adds above the rows: its update, its Open and Ungroup. */
  extra?: readonly HTMLElement[];
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
    for (const type of CHANGES) panel.addEventListener(type, (event) => {
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
  const button = (label: string, act: () => void): HTMLElement => {
    const el = document.createElement('sherpa-button');
    el.setAttribute('data-label', label);
    el.setAttribute('data-size', 'sm');
    el.addEventListener('button-click', act);
    return el;
  };
  const items = node.rows.flatMap((row) => {
    const at = `${node.id}/${row.name}`;
    const ins = graph.routes.filter((r) => r.to === at);
    const outs = graph.routes.filter((r) => r.from === at).map((r) => `To ${name(r.to)}`);
    const field = fieldFor(row.control ? row : { ...row, control: 'text' }, !row.editable || routed.has(at) || !row.control);
    // A custom row says where it comes from once, in its own words.
    fill(field, row, [...(row.custom ? [] : ins.map((r) => `From ${name(r.from)}`)), ...outs, row.hint].filter(Boolean).join(' · ') || undefined);
    fields.set(field, row);
    const cuts = options.onCut ? ins.map((r) => button(`Cut route from ${name(r.from)}`, () => options.onCut!(r))) : [];
    const custom = options.onCustom && row.editable && !ins.length && row.input === 'value' && !row.many && rowChoices(row) !== undefined
      ? [button('Custom value', () => options.onCustom!(row))] : [];
    return [field, ...cuts, ...custom];
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
  const remove = options.onRemove ? [button('Remove node', options.onRemove)] : [];
  stack.append(...(options.extra ?? []), ...(options.visual ? [options.visual] : []), ...(whole.length ? [header] : []), ...items, ...remove);
  panel.replaceChildren(stack);
  if (whole.length) (header as HTMLElement & { populate(items: unknown): void }).populate(whole);
  panel.setAttribute('data-heading', node.heading);
  put(panel, 'data-icon', node.icon);
  inspecting.set(panel, { node, fields, options });
}

/** The type a drawn socket carries, on one side; none, it has no such socket. */
function typeAt(drawn: Drawn, address: string, side: 'input' | 'output'): SocketType | undefined {
  const { node, row } = socketOf(address);
  const at = drawn.graph.nodes.find((n) => n.id === node);
  return at ? socketType(at, row, side) : undefined;
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

/** An editor whose edits are steps. */
export interface Undoable {
  /** Step the last edit back; false when there is none. */
  undo(): boolean;
  /** Put back the edit the last undo took away; false when there is none. */
  redo(): boolean;
  /** Is there an edit to undo, or to redo? */
  can(): { undo: boolean; redo: boolean };
}

/** A workflow's editor: Save and stop, and the Custom Nodes it opens, discards and holds. */
export interface WorkflowEditor extends GraphEditor, Undoable {
  /** Put the workflow and every definition back as they were last handed over. */
  discard(): void;
  /** Open a Custom Node's inside by its use's id, as ⛶ or Enter does. */
  open(use: string): void;
  /** Go back to a depth (0 is the workflow), as a breadcrumb or Escape does: one up when none is given. */
  back(depth?: number): void;
  /** The app's library changed (a save in this tab or another): the draft's own edits stay over it. */
  refresh(library: NodeLibrary): void;
  /** The library as the draft holds it: its edited definitions too. */
  library(): NodeLibrary;
  /** The Custom Nodes opened now, outermost first: their use ids. */
  path(): readonly string[];
  /** The workflow as the draft holds it now, unsaved. */
  workflow(): WorkflowDefinition;
}

/** Tell the app a definition to keep. */
function handOver(canvas: HTMLElement, definition: PageDefinition | WorkflowDefinition): void {
  canvas.dispatchEvent(new CustomEvent('definition-save', { detail: { definition }, bubbles: true, composed: true }));
}

/** The node a canvas's inspector shows: picked, followed on each draw, and let go. */
interface Picked {
  select(node: GraphNode, graph: DrawnGraph): void;
  follow(graph: DrawnGraph): void;
  /** A click on blank canvas: none picked, and the panel shut. */
  deselect(): void;
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
    deselect(): void {
      picked = null;
      if (inspector?.open) inspector.hide();
      onClose?.();
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
    && Object.values(v).every((p: { x?: unknown; y?: unknown; size?: { w?: unknown; h?: unknown } } | null) => typeof p?.x === 'number' && typeof p?.y === 'number'
      && (p.size === undefined || (typeof p.size.w === 'number' && typeof p.size.h === 'number')));
}

/** What drawing a page's Query needs beyond its source: the definition, the page's
 *  components, an inspector, and a session to keep each node's place. */
export interface QueryEditorOptions extends QueryGraphFacts {
  definition: PageDefinition;
  /** The overlay panel a picked node opens in: its rows again, and a component's live visual. */
  inspector?: Inspector;
  /** Where a moved node's place is kept for the tab (TODO 551): it survives a reload, and the session's end forgets it. */
  session?: SessionStore;
  /** A `sherpa-node-toolbar`: its Undo and Redo step the Query's draft, and it says when they can be pressed. */
  toolbar?: HTMLElement;
  /** The node panel floating on the canvas: it lists the kinds a Query takes placed, and each one asked for is a request. */
  panel?: SherpaNodePanel;
}

/** Keep a page's Query drawn on a canvas as it changes, and ask it for each edit.
 *  It draws what the controls show — the draft — and ASKS through the one door a chip
 *  asks through: whether a change applies at once or waits for Apply is the Query's,
 *  and so is a slot's Sort and Group. TRAP T-one-command-one-door */
export function bindQueryEditor(
  canvas: SherpaLayoutCanvas,
  source: Pick<DataSource, 'query'> & Partial<Pick<DataSource, 'valuesFor' | 'store' | 'state' | 'results' | 'addEventListener' | 'removeEventListener'>>,
  { definition, inspector, session, toolbar, panel, ...facts }: QueryEditorOptions,
): GraphEditor & Undoable {
  const query = source.query;
  const typeOf = (field: string): string | undefined => facts.type?.(field) ?? definition.source?.fields?.[field]?.type;
  const values = facts.values ?? ((field: string) => source.valuesFor?.(field)?.map((v) => valueKey(v)));
  // A moved node's place: the reader's for the tab. TODO 551
  const pointer = `/nodes/${definition.id}`;
  session?.persist(pointer, { shared: false, guard: isPlaces });
  let places: NodePlaces = (session?.get(pointer) as NodePlaces | undefined) ?? {};
  const onMove = (node: GraphNode, x: number, y: number): void => {
    places = { ...places, [node.id]: { ...places[node.id], x, y } };
    session?.set(pointer, places);
  };
  // A resized node's size: the reader's for the tab, kept beside its place. TODO 740
  const onResize = (node: GraphNode, size: NodeSize): void => {
    places = { ...places, [node.id]: { x: node.x, y: node.y, ...places[node.id], size } };
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
  // A node the reader asked for, from the panel or "Add a node": a request through the one door, or a fault in words.
  // The graph is derived, so a placed node appears where the Query draws it. TRAP T-one-command-one-door
  const place = (kind: string, context?: AddContext): void => {
    const from = context && graph.nodes.find((n) => n.id === socketOf(context.socket).node);
    const answer = placeRequest(kind, from?.ref?.['scope'] ?? VIEW, {
      holds: (scope) => query.scope(scope), fields: (scope) => query.fields(scope),
      presets: (scope) => query.presets(scope), on: (scope, id) => query.presetOn(scope, id),
    });
    if ('refused' in answer) report({ code: 'query-place', message: answer.refused });
    else query.ask(answer.request);
  };
  const onAdded = (event: Event): void => {
    const { kind, context } = (event as CustomEvent<{ kind: string; context?: AddContext }>).detail;
    place(kind, context);
  };
  panel?.addEventListener('node-add', onAdded);
  void panel?.populate(paletteOf(NODE_KINDS, 'query'));
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
  /** A cut is reported, never applied: once, however many routes are picked. */
  const cutRefused = (): void => report({ code: 'query-route', message: 'The Query\'s routes are its readings: turn a condition off, or clear it, to take it from its scope.' });
  const draw = (): void => {
    graph = placed(queryGraph(query.draft, definition, {
      ...facts, values, presets: (scope) => query.presets(scope), domains: source.store?.domains ?? {}, pageSize: source.state?.pageSize ?? null,
    }), places);
    drawGraph(canvas, graph, {
      onEdit, onMove, onResize, onConnect, onSelect: (node) => picks.select(node, graph), onDeselect: picks.deselect,
      // Its routes are readings, which another field or scope takes: a moved end is a new route.
      onReroute: (_was, now) => onConnect(now),
      ...(panel ? { onAdd: (context: AddContext) => panel.askAdd(context) } : {}),
      onBreak: cutRefused, onBreakAll: cutRefused,
      // A box picks and shows: one node opens its panel, as a click does; several, or none, shut it. TODO 735
      onBox: (ids) => {
        const node = ids.length === 1 ? graph.nodes.find((n) => n.id === ids[0]) : undefined;
        if (node) picks.select(node, graph);
        else picks.deselect();
      },
      onPicked: (routes) => toolbar?.setAttribute('data-picked-routes', String(routes.length)),
    });
    picks.follow(graph);
  };
  draw();
  // — Undo and Redo: the Query's draft, as copies, before and after each change anyone made (a chip's too).
  //   A step is put back through the Query's own whole restore, so every reader redraws as for any edit.
  //   Where a scope waits for Apply a step moves the DRAFT only (`restoreDraft`): an Apply is no step. TRAP T-an-edit-is-a-step
  const journal = new Journal<Query>(HISTORY);
  let last = query.draft;
  let restoring = false;
  const tell = (): void => {
    toolbar?.toggleAttribute('data-can-undo', journal.canBack);
    toolbar?.toggleAttribute('data-can-redo', journal.canForward);
    canvas.dispatchEvent(new CustomEvent('history-change', { detail: { undo: journal.canBack, redo: journal.canForward }, bubbles: true, composed: true }));
  };
  const onChange = (): void => {
    draw();
    if (restoring) return;
    const now = query.draft;
    if (JSON.stringify(now) !== JSON.stringify(last)) journal.push({ before: last, after: now });
    last = now;
    tell();
  };
  const step = (to: Query | undefined): boolean => {
    if (!to) return false;
    restoring = true;
    void query.restoreDraft(to, { by: 'undo' }).finally(() => {
      restoring = false;
      last = query.draft;
      tell();
    });
    return true;
  };
  const undo = (): boolean => !restoring && journal.canBack && step(journal.back()?.before);
  const redo = (): boolean => !restoring && journal.canForward && step(journal.forward()?.after);
  const onTool = (event: Event): void => {
    const action = (event as CustomEvent<{ action?: string }>).detail?.action;
    if (action === 'undo') undo();
    else if (action === 'redo') redo();
  };
  const onKey = (event: KeyboardEvent): void => {
    const first = event.composedPath()[0];
    if (first instanceof Element && first.matches('input, select, textarea, [contenteditable]')) return;
    const key = event.key.toLowerCase();
    if (!primaryKey(event) || event.altKey || (key !== 'z' && key !== 'y')) return;
    if (key === 'y' || event.shiftKey) redo();
    else undo();
    event.preventDefault();
    event.stopPropagation();
  };
  query.addEventListener('query-change', onChange);
  toolbar?.addEventListener('toolbar-select', onTool);
  canvas.addEventListener('keydown', onKey, { capture: true });
  tell();
  const unwatch = watchQuery(canvas, source, definition);
  return {
    undo,
    redo,
    can: () => ({ undo: journal.canBack, redo: journal.canForward }),
    save(): boolean {
      const page = pageWithQuery(definition, query.draft, { pageSize: source.state?.pageSize ?? null, type: (f) => typeOf(f) as FieldType | undefined });
      if (!checkPage(page)) return false;
      handOver(canvas, page);
      return true;
    },
    stop(): void {
      query.removeEventListener('query-change', onChange);
      toolbar?.removeEventListener('toolbar-select', onTool);
      panel?.removeEventListener('node-add', onAdded);
      canvas.removeEventListener('keydown', onKey, { capture: true });
      toolbar?.removeAttribute('data-can-undo');
      toolbar?.removeAttribute('data-can-redo');
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
  source: Pick<DataSource, 'query'> & Partial<Pick<DataSource, 'results' | 'store' | 'addEventListener' | 'removeEventListener'>>,
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
    // A status field's Conditions: the rows each took, counted over the whole store.
    const statuses = source.store ? await statusTallies(source.store, source.store.domains ?? {}) : {};
    traceQuerySteps(applied, { walk: { results: Object.fromEntries(counted) }, ...(typeof total === 'number' ? { total } : {}), statuses }, load);
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
  /** The node panel floating on the canvas: it lists the kinds, and each node it asks for is placed. */
  panel?: SherpaNodePanel;
  /** Where the DRAFT is kept for the tab (TODO 551): every edit, a move too, survives a
   *  reload, and the session's end forgets it — unless Save handed it over. */
  session?: SessionStore;
  kinds?: Readonly<Record<string, NodeKind>>;
  /** The app's Custom Nodes (D13). The editor keeps its edits to them as a draft beside the workflow's. */
  library?: NodeLibrary;
  /** Save hands each edited or new definition to the app, to keep: its id and the definition. */
  onSaveNode?: (id: string, definition: NodeDefinition) => void;
  /** The page's `sherpa-app-header`: its trail shows the Custom Nodes opened, and is empty at the workflow. */
  header?: HTMLElement & { populate(data: { breadcrumb: { label: string }[] }): unknown };
  /** A `sherpa-dialog` (status critical) that confirms the two bulk updates. Without it they are not offered. */
  confirm?: HTMLElement & { confirm(ask: { heading?: string; words?: string; action?: string; critical?: boolean }): Promise<boolean> };
  /** "Update all instances" was confirmed: the app's other workflows are its own to update. */
  onUpdateAll?: (kind: string) => void;
  /** A `sherpa-node-toolbar`: its Undo and Redo are this editor's, and it says when they can be pressed. */
  toolbar?: HTMLElement;
}

/** A node's own name, line and place, as its inspector's first rows edit them. */
const OWN: Readonly<Record<string, keyof Pick<WorkflowNode, 'heading' | 'description' | 'x' | 'y'>>> = {
  '#heading': 'heading', '#description': 'description', '#x': 'x', '#y': 'y',
};

/** The most steps Undo goes back. */
const HISTORY = 100;

/** The draft and the edited definitions at one moment: what a step puts back. */
interface Snap {
  draft: WorkflowDefinition;
  edits: Record<string, NodeDefinition>;
}

/** One Custom Node opened: its definition's id, the use that opened it, and its name. */
interface Opened {
  kind: string;
  use: string;
  label: string;
}

/** Whether a value is a library's edits: definitions by id. */
const isEdits = (v: unknown): v is Record<string, NodeDefinition> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Keep a workflow's draft drawn on a canvas, and write each edit to it as a pure edit:
 *  a value, a move, a route, a node's own name. A route that would break the workflow is
 *  refused, and says why. A v1 — given, or a tab's draft — is read once as v2, and Save
 *  hands over the v2. N4 runs the draft. A Custom Node OPENS: the canvas shows its inside
 *  under a trail, and an edit there is an edit to the DEFINITION, drafted beside the workflow
 *  and handed over by the same Save (`onSaveNode`); a use whose definition moved on says so, and
 *  an update keeps the draft's changes until Save or `discard`. TRAP T-a-workflow-is-its-definition
 *  · TRAP T-a-custom-node-is-an-instance */
export function bindWorkflow(
  canvas: SherpaLayoutCanvas, workflow: WorkflowDefinition | WorkflowDefinitionV1,
  { inspector, panel, session, kinds = NODE_KINDS, library, onSaveNode, header, confirm, onUpdateAll, toolbar, ...facts }: WorkflowEditorOptions = {},
): WorkflowEditor {
  const pointer = `/workflows/${workflow.id}`;
  const isDraft = (v: unknown): v is WorkflowDefinition | WorkflowDefinitionV1 => {
    const d = v as { v?: unknown; id?: unknown; nodes?: unknown } | null;
    return !!d && typeof d === 'object' && (d.v === 2 || d.v === 1) && d.id === workflow.id && Array.isArray(d.nodes);
  };
  session?.persist(pointer, { shared: false, guard: isDraft });
  // The definitions this tab edited: kept beside the draft, over the app's library.
  const editsAt = `/node-edits/${workflow.id}`;
  session?.persist(editsAt, { shared: false, guard: isEdits });
  const edited = session?.get(editsAt) as Record<string, NodeDefinition> | undefined ?? {};
  let given = library ?? { v: 1, nodes: {} };
  let lib: NodeLibrary = { ...given, nodes: { ...given.nodes, ...edited } };
  let handed: NodeLibrary = given;
  const dirty = new Set(Object.keys(edited));
  const topKinds = (): Readonly<Record<string, NodeKind>> => ({ ...kinds, ...kindsOf(lib) });
  // This tab's draft wins: a reload loses nothing. What a v1's read cannot map is said once.
  const kept = session?.get(pointer) as WorkflowDefinition | WorkflowDefinitionV1 | undefined;
  const read = readWorkflow(kept ?? structuredClone(workflow), topKinds());
  for (const fault of read.faults) report({ code: 'workflow-definition', message: `bindWorkflow: ${fault}.`, at: { workflow: workflow.id } });
  let draft: WorkflowDefinition = read.workflow ?? { v: 2, id: workflow.id, nodes: [] };
  let original: WorkflowDefinition = readWorkflow(structuredClone(workflow), topKinds()).workflow ?? draft;
  let graph: DrawnGraph = { nodes: [], routes: [] };
  // The Custom Nodes opened, outermost first. What is shown is the innermost one's body.
  let path: Opened[] = [];
  const innerNow = (): Inner | undefined => {
    let at: WorkflowDefinition = draft;
    let inner: Inner | undefined;
    for (const step of path) {
      const use = at.nodes.find((n) => n.id === step.use);
      inner = use && innerOf(use, lib, topKinds());
      if (!inner) return undefined;
      at = inner.workflow;
    }
    return inner;
  };
  const shown = (): WorkflowDefinition => (path.length ? innerNow()?.workflow ?? draft : draft);
  const K = (): Readonly<Record<string, NodeKind>> => (path.length ? innerNow()?.kinds ?? topKinds() : topKinds());
  /** A preset's inside is read only (D15), at any depth. */
  const readOnly = (): boolean => path.some((s) => lib.nodes[s.kind]?.preset);
  const refreshPanel = (): void => { void panel?.populate(paletteOf(topKinds())); };
  // — Undo and Redo: each edit is a pure function on the draft, so a step is a snapshot of
  //   the draft and the edited definitions, before and after. They share structure: a step is cheap.
  //   TRAP T-an-edit-is-a-step
  const journal = new Journal<Snap>(HISTORY);
  const snap = (): Snap => ({ draft, edits: Object.fromEntries([...dirty].flatMap((id) => (lib.nodes[id] ? [[id, lib.nodes[id]]] : []))) });
  const sameSnap = (a: Snap, b: Snap): boolean => {
    const ka = Object.keys(a.edits);
    return a.draft === b.draft && ka.length === Object.keys(b.edits).length && ka.every((k) => a.edits[k] === b.edits[k]);
  };
  const tell = (): void => {
    toolbar?.toggleAttribute('data-can-undo', journal.canBack);
    toolbar?.toggleAttribute('data-can-redo', journal.canForward);
    canvas.dispatchEvent(new CustomEvent('history-change', { detail: { undo: journal.canBack, redo: journal.canForward }, bubbles: true, composed: true }));
  };
  let depth = 0;
  let begun: Snap | undefined;
  let lastTag = '';
  let lastAt = 0;
  /** One edit, however many writes it makes: ONE step. The same `tag` within a second (a drag, a typed word) is one too. */
  const edit = (fn: () => void, tag = ''): void => {
    if (depth++ === 0) begun = snap();
    try {
      fn();
    } finally {
      if (--depth === 0) {
        const after = snap();
        if (!sameSnap(begun!, after)) {
          const now = performance.now();
          const merge = tag && tag === lastTag && now - lastAt < 1000;
          journal.push({ before: begun!, after }, merge ? (last, next) => ({ before: last.before, after: next.after }) : undefined);
          lastTag = tag;
          lastAt = now;
          tell();
        }
      }
    }
  };
  /** Put the draft and the edited definitions back as a step left them. */
  const restore = (to: Snap): void => {
    draft = to.draft;
    lib = { ...handed, nodes: { ...handed.nodes, ...to.edits } };
    dirty.clear();
    for (const id of Object.keys(to.edits)) dirty.add(id);
    session?.set(pointer, draft);
    session?.set(editsAt, to.edits);
    lastTag = '';
    refreshPanel();
    draw();
    tell();
  };
  /** The library after a change to these definitions: drafted, and kept for the tab. */
  const setLib = (next: NodeLibrary, ids: readonly string[]): void => {
    edit(() => {
      lib = next;
      for (const id of ids) dirty.add(id);
      session?.set(editsAt, Object.fromEntries([...dirty].flatMap((id) => (lib.nodes[id] ? [[id, lib.nodes[id]]] : []))));
      refreshPanel();
    });
  };
  const write = (next: WorkflowDefinition, tag?: string): void => edit(() => {
    if (!path.length) {
      draft = next;
      session?.set(pointer, next);
    } else if (readOnly()) {
      report({ code: 'node-readonly', message: 'bindWorkflow: this Custom Node is a preset, read only. Copy to my nodes, and change the copy.', at: { workflow: workflow.id } });
    } else {
      const id = path.at(-1)!.kind;
      setLib(editDefinition(lib, id, { nodes: next.nodes.filter((n) => !n.id.startsWith('#')), routes: next.routes ?? [], ties: next.ties ?? [] }), [id]);
    }
    draw();
  }, tag);
  const onEdit = ({ node, row, value }: GraphEdit): void => {
    const own = OWN[row.name];
    if (!own) return write(editWorkflow(shown(), { node: node.id, row: row.name, value }, K(), facts), `row:${node.id}/${row.name}`);
    const said = own === 'x' || own === 'y' ? typedValue('number', String(value ?? '')) : String(value ?? '');
    if ((own === 'x' || own === 'y') && typeof said !== 'number') return;
    write(editWorkflow(shown(), { node: node.id, set: { [own]: said } }, K()), `own:${node.id}/${own}`);
  };
  const onMove = (node: GraphNode, x: number, y: number): void => {
    if (node.id.startsWith('#')) return;
    write(editWorkflow(shown(), { node: node.id, set: { x, y } }, K()), `move:${node.id}`);
  };
  const onResize = (node: GraphNode, size: NodeSize): void => {
    if (node.id.startsWith('#')) return;
    write(editWorkflow(shown(), { resize: { node: node.id, ...size } }, K()), `size:${node.id}`);
  };
  // A route that would break the workflow is refused, and says why; else the draft takes it.
  const take = (next: WorkflowDefinition): void => {
    const was = new Set(workflowFaultsDeep(shown(), lib, K(), facts));
    const added = workflowFaultsDeep(next, lib, K(), facts).filter((f) => !was.has(f));
    if (added.length) report({ code: 'workflow-route', message: `bindWorkflow: ${added.join('; ')}.`, at: { workflow: shown().id } });
    else write(next);
  };
  const onConnect = (route: NodeRoute): void => take(editWorkflow(shown(), { route }, K()));
  // A moved end is one edit: the route cut, then made, checked as one.
  const onReroute = (was: NodeRoute, now: NodeRoute): void => take(editWorkflow(editWorkflow(shown(), { cut: was }, K()), { route: now }, K()));
  const onBreak = (route: NodeRoute): void => write(editWorkflow(shown(), { cut: route }, K()));
  // Picked routes cut together are ONE step.
  const onBreakAll = (routes: NodeRoute[]): void => edit(() => { for (const route of routes) onBreak(route); });
  // — Zip ties (562): a tie is a part of the draft, so each is one edit, and one step.
  let tying = false;
  const setTying = (on: boolean): void => {
    tying = on;
    toolbar?.toggleAttribute('data-tie', on);
    draw();
  };
  const onTie = (routes: NodeRoute[], at: { x: number; y: number }): void => take(editWorkflow(shown(), { tie: { routes, ...at } }, K()));
  const onTieMove = (id: string, x: number, y: number): void => write(editWorkflow(shown(), { moveTie: { id, x, y } }, K()), `tie:${id}`);
  const onUntie = (id: string): void => write(editWorkflow(shown(), { untie: id }, K()));
  /** With no pointer: tie the routes between picked nodes, or into one. */
  const tieNodes = (ids: readonly string[]): void => {
    tieRoutes((shown().routes ?? []).filter((r) => (ids.length > 1 ? ids.includes(socketOf(r.from).node) && ids.includes(socketOf(r.to).node) : socketOf(r.to).node === ids[0])));
  };
  /** One tie across these routes; where they are all tied together already, untie them. */
  const tieRoutes = (routes: readonly NodeRoute[]): void => {
    if (readOnly() || !routes.length) return;
    const same = (a: NodeRoute, b: NodeRoute): boolean => a.from === b.from && a.to === b.to;
    const held = (shown().ties ?? []).find((t) => t.routes.length === routes.length && routes.every((r) => t.routes.some((q) => same(q, r))));
    if (held) onUntie(held.id);
    else onTie([...routes], tieSpot(canvas, routes));
  };
  // A Value node for a picklist row: the row keeps its own pick, and mirrors the node.
  const customAt = (to: string, at: { x: number; y: number }): void => take(addCustomValue(shown(), to, at, K()));
  const onCustom = (to: string, at: { x: number; y: number }): void => customAt(to, { x: Math.round(at.x), y: Math.round(at.y) });
  // A node the reader asked for, from the panel or "Add a node": through the one door, `{ add }`; picked, so its inspector opens.
  const place = (kind: string, at: { x: number; y: number }, context?: AddContext): void => {
    if (!K()[kind] || readOnly()) return;
    const free = (n: number): string => (shown().nodes.some((x) => x.id === `${kind}-${n}`) ? free(n + 1) : `${kind}-${n}`);
    const id = free(1);
    edit(() => {
      const fit = context && fitOf(K()[kind]!, context.type, context.side);
      // A node let go by its output sits left of the point, so its output meets the line.
      const x = Math.round(at.x - (context?.side === 'in' ? 280 : 0));
      const added = { id, kind, x, y: Math.round(at.y) };
      // A use of a Custom Node records the definition it is placed from (D11).
      write(editWorkflow(shown(), { add: K()[kind]!.model === 'graph' && lib.nodes[kind] ? useOf(lib, kind, added) : added }, K()));
      if (context && fit) {
        const own = fit.row ? `${id}/${fit.row}` : id;
        take(editWorkflow(shown(), { route: context.side === 'out' ? { from: context.socket, to: own } : { from: own, to: context.socket } }, K()));
      }
    });
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return;
    markNode(canvas, id);
    picks.select(node, graph);
  };
  const planeAt = (clientX: number, clientY: number): { x: number; y: number } => {
    const box = canvas.getBoundingClientRect();
    const { x, y, zoom } = canvas.view;
    return { x: (clientX - box.left - x) / zoom, y: (clientY - box.top - y) / zoom };
  };
  const onAdded = (event: Event): void => {
    const { kind, point, context } = (event as CustomEvent<{ kind: string; point?: { x: number; y: number }; context?: AddContext }>).detail;
    if (context) return place(kind, context.at, context);
    const box = canvas.getBoundingClientRect();
    if (!point) return place(kind, planeAt(box.left + box.width / 2 - 120, box.top + box.height / 2 - 40));
    // Let go off the canvas: nothing is placed.
    if (point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom) return;
    place(kind, planeAt(point.x, point.y));
  };
  panel?.addEventListener('node-add', onAdded);
  refreshPanel();
  const onRemove = (id: string): void => {
    picks.deselect();
    write(editWorkflow(shown(), { remove: id }, K()));
  };

  // — Custom Nodes: open, the trail, update, save as, ungroup —
  const multi = new Set<string>();
  const use = (id: string): WorkflowNode | undefined => {
    const at = shown().nodes.find((n) => n.id === id);
    return at && K()[at.kind]?.model === 'graph' && lib.nodes[at.kind] ? at : undefined;
  };
  const trail = (): void => {
    void header?.populate({ breadcrumb: path.length ? [{ label: draft.label ?? 'Workflow' }, ...path.map((s) => ({ label: s.label }))] : [] });
  };
  /** The canvas shows another graph: nothing is picked, and the view fits it. */
  const enter = (focus: string | null): void => {
    multi.clear();
    markNode(canvas, null);
    picks.deselect();
    draw();
    requestAnimationFrame(() => requestAnimationFrame(() => canvas.fit()));
    if (focus) focusNode(canvas, focus);
    else canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
  };
  const open = (id: string): void => {
    const at = use(id);
    if (!at) return;
    path = [...path, { kind: at.kind, use: id, label: at.heading ?? lib.nodes[at.kind]!.label }];
    enter(null);
    // A preset says it is read only, and where its copy is: the panel opens beside it.
    if (readOnly() && inspector) showScope();
  };
  const back = (depth = path.length - 1): void => {
    if (depth < 0 || depth >= path.length) return;
    const from = path[depth]!.use;
    path = path.slice(0, depth);
    enter(from);
  };
  header?.addEventListener('breadcrumb-select', (event) => back((event as CustomEvent<{ index: number }>).detail.index));
  /** "Copy to my nodes": an editable copy of the preset opened, which takes the use that opened it. */
  const copy = (): void => edit(() => {
    const step = path.at(-1);
    if (!step) return;
    const made = copyToMine(lib, step.kind);
    if (!made.id) return;
    setLib(made.library, [made.id]);
    const parent = path.slice(0, -1);
    path = parent;
    const at = shown().nodes.find((n) => n.id === step.use);
    if (at && !readOnly()) {
      const { version: _v, was: _w, ...own } = at;
      write({ ...shown(), nodes: shown().nodes.map((n) => (n.id === at.id ? { ...own, ...useOf(lib, made.id!, { id: at.id, x: at.x, y: at.y }) } : n)) });
    }
    path = [...parent, { kind: made.id, use: step.use, label: lib.nodes[made.id]!.label }];
    enter(null);
    inspector?.hide();
  });
  const scopeNote = (): HTMLElement[] => {
    if (!path.length || !readOnly()) return [];
    const note = document.createElement('sherpa-stack');
    note.setAttribute('data-gap', 'md');
    const words = document.createElement('p');
    words.style.margin = '0';
    words.textContent = 'This Custom Node is a preset: its inside is read only. Copy it to your nodes to change it.';
    const button = document.createElement('sherpa-button');
    button.setAttribute('data-label', 'Copy to my nodes');
    button.setAttribute('data-size', 'sm');
    button.setAttribute('data-look', 'saturated');
    button.addEventListener('button-click', copy);
    note.append(words, button);
    return [note];
  };
  const showScope = (): void => {
    if (!inspector) return;
    const stack = document.createElement('sherpa-stack');
    stack.append(...scopeNote());
    inspector.replaceChildren(stack);
    inspector.setAttribute('data-heading', path.at(-1)?.label ?? '');
    inspector.setAttribute('data-icon', 'folder');
    inspector.show();
  };
  const ask = async (heading: string, words: string): Promise<boolean> => !!confirm && await confirm.confirm({ heading, words, action: 'Update', critical: true });
  const updateOne = (id: string): void => write(updateInstance(shown(), id, lib, K()));
  const updateGraph = async (kind: string): Promise<void> => {
    const name = lib.nodes[kind]?.label ?? kind;
    if (await ask('Update all instances on graph?', `Every “${name}” on this graph takes its current definition. Their own values stay; a route to a socket it lost stays, and is reported.`)) write(updateAll(shown(), kind, lib, K()));
  };
  const updateEverywhere = async (kind: string): Promise<void> => {
    const name = lib.nodes[kind]?.label ?? kind;
    if (!await ask('Update all instances?', `Every “${name}” takes its current definition: on this graph, inside every other Custom Node, and on every workflow of the app. Their own values stay.`)) return;
    let next = lib;
    const ids: string[] = [];
    for (const [id, definition] of Object.entries(lib.nodes)) {
      if (definition.preset || !definition.nodes.some((n) => n.kind === kind)) continue;
      const body = updateAll({ v: 2, id, nodes: definition.nodes, routes: definition.routes ?? [] }, kind, lib, topKinds());
      next = editDefinition(next, id, { nodes: body.nodes, routes: body.routes ?? [] });
      ids.push(id);
    }
    edit(() => {
      if (ids.length) setLib(next, ids);
      draft = updateAll(draft, kind, lib, topKinds());
      session?.set(pointer, draft);
    });
    onUpdateAll?.(kind);
    draw();
  };
  /** What a Custom Node's inspector adds above its rows. */
  const extraFor = (node: GraphNode): HTMLElement[] => {
    const at = use(node.id);
    const diff = at && definitionDiff(at, lib);
    return [
      ...scopeNote(),
      ...(at && diff?.stale && !readOnly() ? [updatePane(diff, {
        onUpdate: () => updateOne(at.id),
        ...(confirm ? { onGraph: () => void updateGraph(at.kind), onAll: () => void updateEverywhere(at.kind) } : {}),
      })] : []),
      ...(at ? [instancePane({ onOpen: () => open(at.id), onUngroup: () => ungroup(at.id) })] : []),
    ];
  };
  const ungroup = (id: string): void => {
    if (readOnly()) return;
    const done = ungroupUse(shown(), id, lib, K());
    if ('fault' in done) return report({ code: 'node-group', message: `bindWorkflow: ${done.fault}.`, at: { workflow: shown().id } });
    picks.deselect();
    write(done.workflow);
  };
  /** "Save as Custom Node": the picked nodes, one definition and one use; a fault in words, or none. */
  const group = (label: string, category: string): string | undefined => {
    if (readOnly()) return 'this Custom Node is a preset, read only';
    const made = groupNodes(shown(), [...multi], lib, { label, category }, K(), facts);
    if ('fault' in made) {
      report({ code: 'node-group', message: `bindWorkflow: ${made.fault}.`, at: { workflow: shown().id } });
      return made.fault;
    }
    edit(() => {
      setLib(made.library, [made.id]);
      write(made.workflow);
    });
    multi.clear();
    const node = graph.nodes.find((n) => n.id === made.use);
    if (node) {
      markNode(canvas, node.id);
      picks.select(node, graph);
    }
    return undefined;
  };
  const showMulti = (): void => {
    if (!inspector) return;
    markNodes(canvas, multi);
    inspector.replaceChildren(groupPane(multi.size, { onSave: group }));
    inspector.setAttribute('data-heading', `${multi.size} nodes picked`);
    inspector.setAttribute('data-icon', 'folder');
    inspector.show();
  };
  let current: string | null = null;
  /** Add a node to the picked, or take it off (Shift-click, Space); with one left, it is simply picked. */
  const toggle = (id: string): void => {
    // The panel shut: what it held is no longer picked.
    if (inspector && !inspector.open) {
      multi.clear();
      current = null;
    }
    if (!multi.size && current && current !== id) multi.add(current);
    if (multi.has(id)) multi.delete(id);
    else multi.add(id);
    const [only] = [...multi];
    const node = multi.size === 1 ? graph.nodes.find((n) => n.id === only) : undefined;
    if (node) {
      multi.clear();
      markNode(canvas, node.id);
      current = node.id;
      picks.select(node, graph);
    } else if (multi.size) showMulti();
    else picks.deselect();
  };
  /** A box picked these nodes: one opens its panel, several are a group, none shuts it. */
  const pickBox = (ids: string[]): void => {
    multi.clear();
    for (const id of ids) multi.add(id);
    const [only] = ids;
    const node = ids.length === 1 ? graph.nodes.find((n) => n.id === only) : undefined;
    if (node) {
      multi.clear();
      current = node.id;
      picks.select(node, graph);
    } else if (multi.size) showMulti();
    else picks.deselect();
  };
  const tellPicked = (routes: NodeRoute[]): void => {
    toolbar?.setAttribute('data-picked-routes', String(routes.length));
  };
  const idOf = (event: Event): { id: string; header: boolean; field: boolean } | undefined => {
    const hits = event.composedPath();
    const el = hits.find((n): n is HTMLElement => n instanceof HTMLElement && n.localName === 'sherpa-node');
    const id = el ? drawnOn.get(canvas)?.nodes && [...drawnOn.get(canvas)!.nodes].find(([, e]) => e === el)?.[0] : undefined;
    const first = hits[0];
    return id ? {
      id, header: hits.some((n) => n instanceof Element && n.classList.contains('header')),
      field: first instanceof Element && first.matches('input, select, textarea, [contenteditable], button, a'),
    } : undefined;
  };
  const onKey = (event: KeyboardEvent): void => {
    const hit = idOf(event);
    const first = event.composedPath()[0];
    if (first instanceof Element && first.matches('input, select, textarea, [contenteditable]')) return;
    const mod = primaryKey(event) && !event.altKey;
    if (mod && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
      if (event.key.toLowerCase() === 'y' || event.shiftKey) redo();
      else undo();
    } else if (event.key === 'Escape') {
      const routes = pickedRoutes(canvas).length > 0;
      if (routes) markRoutes(canvas, []);
      if (tying) setTying(false);
      else if (multi.size) {
        multi.clear();
        markNode(canvas, null);
        picks.deselect();
      } else if (path.length && !routes) back();
      else if (!routes) return;
    } else if (event.key.toLowerCase() === 't' && !mod && !event.shiftKey && (pickedRoutes(canvas).length || multi.size > 1 || (hit && !hit.field))) {
      // Picked routes first; else the routes of the picked nodes.
      if (pickedRoutes(canvas).length) tieRoutes(pickedRoutes(canvas));
      else tieNodes(multi.size > 1 ? [...multi] : [hit!.id]);
    } else if (hit?.header && event.key === ' ') toggle(hit.id);
    else if (hit?.header && event.key === 'Enter' && use(hit.id)) open(hit.id);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onClick = (event: MouseEvent): void => {
    const hit = idOf(event);
    if (!hit || hit.field || !event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    toggle(hit.id);
  };
  const onDouble = (event: MouseEvent): void => {
    const hit = idOf(event);
    if (hit?.header && !hit.field && use(hit.id)) open(hit.id);
  };
  const undo = (): boolean => {
    const step = journal.back();
    if (step) restore(step.before);
    return !!step;
  };
  const redo = (): boolean => {
    const step = journal.forward();
    if (step) restore(step.after);
    return !!step;
  };
  const onTool = (event: Event): void => {
    const action = (event as CustomEvent<{ action?: string }>).detail?.action;
    if (action === 'undo') undo();
    else if (action === 'redo') redo();
    else if (action === 'tie') setTying(!tying);
  };
  toolbar?.addEventListener('toolbar-select', onTool);
  toolbar?.setAttribute('data-can-tie', '');
  tell();
  canvas.addEventListener('keydown', onKey, { capture: true });
  canvas.addEventListener('click', onClick, { capture: true });
  canvas.addEventListener('dblclick', onDouble);

  // The inspector leads with the node's own name, line and place.
  const withOwn = (node: GraphNode): GraphNode => {
    if (node.id.startsWith('#')) return node;
    const at = shown().nodes.find((n) => n.id === node.id);
    const editable = !readOnly();
    const own: GraphRow[] = [
      { name: '#heading', label: 'Name', control: 'text', value: node.heading, editable },
      { name: '#description', label: 'Description', control: 'text', value: node.description ?? '', editable },
      { name: '#x', label: 'X', control: 'number', value: at?.x, editable },
      { name: '#y', label: 'Y', control: 'number', value: at?.y, editable },
    ];
    return { ...node, rows: [...own, ...node.rows] };
  };
  const picks = pickedIn(canvas, inspector, (node, now) => {
    current = node.id;
    inspectNode(inspector!, withOwn(node), now, {
      onEdit, extra: extraFor(node), ...(readOnly() ? {} : { onCut: onBreak }),
      // With no pointer: beside the node it feeds, one column left, on the row's own line.
      onCustom: (row) => {
        const at = shown().nodes.find((n) => n.id === node.id);
        customAt(`${node.id}/${row.name}`, { x: (at?.x ?? 0) - 360, y: (at?.y ?? 0) + 72 + node.rows.indexOf(row) * 64 });
      },
      ...(readOnly() || node.id.startsWith('#') ? {} : { onRemove: () => onRemove(node.id) }),
    });
  }, () => { multi.clear(); current = null; });
  function draw(): void {
    if (path.length && !innerNow()) path = [];
    const ro = readOnly();
    const body = workflowGraph(shown(), facts, K());
    graph = ro ? { ...body, nodes: body.nodes.map((n) => ({ ...n, rows: n.rows.map((r) => ({ ...r, editable: false })) })) } : body;
    drawGraph(canvas, graph, {
      onEdit, onMove, onResize, onConnect, onReroute, onBreak, onCustom, onDeselect: picks.deselect,
      onBox: pickBox, onPicked: tellPicked,
      ...(ro ? {} : { tying, onTie, onTieMove, onUntie, onBreakAll }),
      onSelect: (node) => {
        multi.clear();
        picks.select(node, graph);
      },
      notes: new Map(staleUses(shown(), lib).map((id) => [id, 'Update available'])),
      locked: (node) => ro || node.id.startsWith('#'),
      ...(panel && !ro ? { onAdd: (context: AddContext) => panel.askAdd(context) } : {}),
    });
    trail();
    if (multi.size > 1) showMulti();
    else picks.follow(graph);
  }
  draw();
  // A run lights its nodes: each step names its node, and the run its workflow. N4 reports.
  const unwatch = watchSteps(canvas, { claims: (span) => span.detail?.['graph'] === workflow.id });
  return {
    save(): boolean {
      if (!checkWorkflow(draft, topKinds(), facts)) return false;
      if (dirty.size && !checkNodeLibrary(lib, kinds, facts)) return false;
      handOver(canvas, draft);
      for (const id of dirty) if (lib.nodes[id]) onSaveNode?.(id, structuredClone(lib.nodes[id]!));
      // The definitions hold them now: the drafts go.
      dirty.clear();
      handed = lib;
      original = draft;
      session?.set(editsAt, undefined);
      session?.set(pointer, undefined);
      return true;
    },
    discard(): void {
      draft = original;
      lib = handed;
      dirty.clear();
      journal.clear();
      lastTag = '';
      tell();
      path = [];
      session?.set(editsAt, undefined);
      session?.set(pointer, undefined);
      refreshPanel();
      enter(null);
    },
    open,
    back,
    refresh(next: NodeLibrary): void {
      given = next;
      handed = next;
      lib = { ...next, nodes: { ...next.nodes, ...Object.fromEntries([...dirty].flatMap((id) => (lib.nodes[id] ? [[id, lib.nodes[id]]] : []))) } };
      refreshPanel();
      draw();
    },
    library: () => lib,
    path: () => path.map((s) => s.use),
    workflow: () => draft,
    undo,
    redo,
    can: () => ({ undo: journal.canBack, redo: journal.canForward }),
    stop(): void {
      unwatch();
      panel?.removeEventListener('node-add', onAdded);
      toolbar?.removeEventListener('toolbar-select', onTool);
      toolbar?.removeAttribute('data-tie');
      canvas.removeEventListener('keydown', onKey, { capture: true });
      canvas.removeEventListener('click', onClick, { capture: true });
      canvas.removeEventListener('dblclick', onDouble);
      picks.stop();
    },
  };
}
