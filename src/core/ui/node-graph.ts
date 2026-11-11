/**
 * node-graph.ts — a graph of nodes drawn on a sherpa-layout-canvas, and the two editors kept
 * drawn there: a page's Query, which each edit ASKS, and a workflow, whose draft each edit
 * writes. Places last the tab; Save hands the app a checked definition. Each node lights as
 * its step runs, from the one trace stream. A workflow's Custom Node opens, is edited as its
 * definition, updates its uses, and is made from picked nodes. A zip tie funnels connections through one place (plan 562); a frame
 * holds picked nodes in a column under one header (plan 778). A picked portal lights every portal of its name (plan 779).
 * Unfurl lays the whole graph out round its hub (plan 569). Will, TODOs 555, 551, 671, 719, 562, 735, 778, 779, 569.
 * TRAP T-the-node-editor-asks-the-query · TRAP T-a-step-names-its-node · TRAP T-a-frame-is-drawn-round-its-nodes
 * TRAP T-a-portal-hop-is-resolved-once · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 * TRAP T-a-task-queue-knows-nothing-of-what-it-runs
 *
 * Map:
 * - DrawOptions — What a drawing tells its host: each edit, each node a reader picks or moves, and each new connection.
 * - tieSpot — Where connections would be tied with no pointer: the middle of the way each takes, on the plane.
 * - drawGraph — Draw a graph on a canvas: each node by id, at its place when that moved; then its connections.
 * - markNode — Mark one node as the one picked, or none.
 * - markFrame — Mark one frame as the one picked, or none: no node is picked with it.
 * - pickedFrame — The frame picked, by id, or none.
 * - pickedNodes — The nodes picked, by id: a click, a box, or the keys.
 * - arrangement — Where these nodes go, from the boxes they are drawn in: a grid.
 * - arrangePicked — Lay the picked nodes out on a grid and hand the host the places: one move, ties and bends with it.
 * - unfurlment — Where every node goes when the graph is unfurled, from the boxes, frames and socket heights drawn.
 * - unfurlGraph — Unfurl the whole graph and hand the host the places: one step; the view fits it after.
 * - watchArrange — Tell a toolbar, in `data-can-arrange` and any flag given, when two or more nodes are picked.
 * - zoomToPicked — Zoom to the picked nodes, centred; with none picked, or `all`, to the whole graph.
 * - watchView — A toolbar's view toggles, kept by the canvas: Collapse all (pressed while every node is) and Hide unconnected…
 * - markNodes — Mark several nodes as the ones picked.
 * - collapseNodes — Collapse these nodes, or expand them; `'all'`, every node drawn.
 * - collapsedNodes — The nodes drawn collapsed.
 * - hideUnconnected — Whether a collapsed node hides the sockets no connection joins; a hover, or a line dragged, shows them.
 * - markActive — Mark the one picked node whose panel is shown, in a stronger ring.
 * - markConnections — Mark connections as the ones picked.
 * - pickedConnections — The connections picked: by a click, a box, or the keys.
 * - WatchOptions — What a graph's watch is told: which traces are its, and which node each span lights.
 * - watchSteps — Light a canvas's nodes from the one trace stream as their steps run; its stop lets it go.
 * - InspectOptions — What an inspector shows beside a node's rows, and whom it tells of an edit.
 * - inspectNode — Fill an overlay panel with one node: its rows again, their connections, and a visual.
 * - inspectNone — The inspector with nothing picked: its empty state, in place of a node.
 * - Inspector — The overlay panel a picked node opens in.
 * - GraphEditor — What an editor's binding gives back: Save, and the undo.
 * - Undoable — An editor whose edits are steps.
 * - WorkflowEditor — A workflow's editor: Save and stop, and the Custom Nodes it opens, discards and holds.
 * - handOver — Tell the app a definition to keep.
 * - watchQuery — Light a page's Query graph as its source loads: the Source by the load and by its store's reads — the page's…
 * - GraphDocument — What the ONE node editor edits where it is not a stored workflow: a page's Query (plan 885).
 * - WorkflowEditorOptions — What editing a workflow needs beyond it: its facts, an inspector, a node panel, a session, the kinds.
 * - bindWorkflow — Keep a workflow's draft drawn on a canvas, and write each edit to it.
 */
import '../../components/sherpa-accordion/sherpa-accordion.js';
import '../../components/sherpa-button/sherpa-button.js';
import '../../components/sherpa-code-block/sherpa-code-block.js';
import '../../components/sherpa-empty-state/sherpa-empty-state.js';
import '../../components/sherpa-tabs/sherpa-tabs.js';
import '../../components/sherpa-input-text/sherpa-input-text.js';
import '../../components/sherpa-key-value-list/sherpa-key-value-list.js';
import '../../components/sherpa-node/sherpa-node.js';
import '../../components/sherpa-node-row/sherpa-node-row.js';
import '../../components/sherpa-node-frame/sherpa-node-frame.js';
import '../../components/sherpa-menu/sherpa-menu.js';
import '../../components/sherpa-quick-filter/sherpa-quick-filter.js';
import '../../components/sherpa-group/sherpa-group.js';
import '../../components/sherpa-stack/sherpa-stack.js';
import '../../components/sherpa-switch/sherpa-switch.js';
import type { AddContext, SherpaNodeList } from '../../components/sherpa-node-list/sherpa-node-list.js';
import type { SherpaLayoutCanvas } from '../../components/sherpa-layout-canvas/sherpa-layout-canvas.js';
import { primaryKey } from './modifier-key.js';
import { keepOrder, morph } from './keep-order.js';
import { boxOf, pointIn } from './plane.js';
import { boxCover, boxPick, type BoxMode, type PickBox } from './box-pick.js';
import { dotsThrough, handlesOf, pathThrough, waypointsOf, type Pt } from './connector-path.js';
import { clampedVia } from '../data/connector-bends.js';
import type { SocketSide } from '../../components/sherpa-node/node-sockets.js';
import type { SessionStore } from '../browser/session.js';
import type { DataSource } from '../data/data-source.js';
import { Journal, type Change } from '../data/journal.js';
import { copyNodes, pasteNodes, type NodeClip } from '../data/node-clipboard.js';
import { fitStages } from '../data/node-stages.js';
import { LANES_BY_FAMILY, fitLanes } from '../data/node-lanes.js';
import { drawLanes } from './node-lanes-ui.js';
import { clearOfNodes, placeBeside, type Box } from '../data/tie-place.js';
import { bindStages, type Stages } from './node-stages-ui.js';
import { type PageDefinition } from '../data/page-definition.js';
import { queryStepNode, statusTallies, traceQuerySteps } from '../data/query-graph.js';
import { onTrace, type Span, type StepState, type TraceHost } from '../data/trace.js';
import { report } from '../data/report.js';
import {
  checkNodeLibrary, copyToMine, definitionDiff, editDefinition, innerOf, kindsOf, staleUses, tagDefinition, updateAll, updateInstance, useOf, workflowFaultsDeep,
  type Inner, type NodeDefinition, type NodeLibrary,
} from '../data/node-library.js';
import { aiCatalog, aiWords, runbookGraphs } from '../data/ai-catalog.js';
import { tidyTags } from '../data/tags.js';
import { groupNodes, headerInput, heldInputs, ungroupUse } from '../data/node-group.js';
import { entityKind, type EntityRef, inNewWords } from '../data/entity.js';
import { offeredKinds } from '../data/entity-types.js';
import { dataPane, flowPane, instancePane, updatePane } from './node-group-panel.js';
import { messageField, outputPane, testButton, valueMenu, type OutputFacts } from './node-output-panel.js';
import { valuesAt, valuesIn } from '../data/node-messages.js';
import { arrangeNodes, type Arranged } from '../data/node-arrange.js';
import { unfurlNodes } from '../data/node-unfurl.js';
import { nodeTitle } from '../data/node-title.js';
import { isSource, routeRead } from '../data/node-routes.js';
import { lightOf, simulation as beginSimulation, stepSimulation, SimulationControl, type Simulated, type SimulatedNode } from '../data/node-simulate.js';
import { cachedSource, fetchSource, sourceWords, type SourceCache, type SourceLimit } from '../browser/source-cache.js';
import type { Row, Store } from '../data/store.js';
import { TaskQueue, type Task, type TaskNotice } from '../data/task-queue.js';
import { SherpaToast } from '../../components/sherpa-toast/sherpa-toast.js';
import type { FramedGraph, NodeFrame } from '../data/node-frames.js';
import { nodeFlow, type ConditionFacts } from '../data/node-flow.js';
import { portalFlow, portalLinks, portalOf } from '../data/node-portals.js';
import { formatDateTime, isDateTime, readDateTime } from '../data/format-date.js';
import { nodeKinds, categorySlug, downstreamOf, fitOf, paletteOf, rowChoices, socketOf, socketType, typeOf, type DrawnGraph, type GraphEdit, type GraphNode, type GraphRow, type NodeKind, type NodeSize, type NodeConnection, type NodeTie, type SocketType } from '../data/node-kinds.js';
import { TIE_GAP, addCustomValue, checkWorkflow, editWorkflow, finalGraph, nodeWidth, readWorkflow, tieLimit, workflowFaults, workflowGraph, type WorkflowDefinition, type WorkflowFacts, type WorkflowNode } from '../data/workflow.js';

const SVG = 'http://www.w3.org/2000/svg';

/** Anything with a socket to join: a node's header, or one of its rows. */
type HasSockets = HTMLElement & { socketRect(side: SocketSide): DOMRect | null };

/** What a drawing tells its host: each edit, each node a reader picks or moves, and each
 *  connect a reader draws — the drawing writes nothing. */
export interface DrawOptions {
  onEdit?: (edit: GraphEdit) => void;
  onSelect?: (node: GraphNode) => void;
  /** A node the reader moved, and where to. */
  onMove?: (node: GraphNode, x: number, y: number) => void;
  /** Picked nodes moved together by one drag or key, each to its new place: the host writes ONE step (TODO 752). */
  onMoveMany?: (moves: { id: string; x: number; y: number }[]) => void;
  /** The picked nodes arranged on a grid: where each goes, and each tie. One step (TODO 752). */
  onArrange?: (placed: Arranged) => void;
  /** A node the reader resized, and its new size in times its natural one (TODO 740). */
  onResize?: (node: GraphNode, size: NodeSize) => void;
  /** A line dragged from an output socket and let go on an input socket. */
  onConnect?: (connection: NodeConnection) => void;
  /** A connection's input end dragged off its socket and let go on another input socket (TODO 557). */
  onReconnect?: (was: NodeConnection, now: NodeConnection) => void;
  /** A connection let go over the bare canvas, or a clicked one deleted (TODO 558). */
  onBreak?: (connection: NodeConnection) => void;
  /** The zip tie tool is on. */
  tying?: boolean;
  /** A line dragged across connections: they are tied, at a place on the plane. */
  onTie?: (connections: NodeConnection[], at: { x: number; y: number }) => void;
  /** A tie dragged or moved by a key, to a place. */
  onTieMove?: (id: string, x: number, y: number) => void;
  /** A picked tie deleted. */
  onUntie?: (id: string) => void;
  /** A bend point of a connection moved, or (`insert`) put in at an index: where, on the plane (TODO 744). */
  onBend?: (connection: NodeConnection, at: number, x: number, y: number, insert: boolean, drag: number) => void;
  /** A picked bend point removed. */
  onUnbend?: (connection: NodeConnection, index: number) => void;
  /** A connector line dragged onto a zip tie: it is added to the tie. */
  onTieDrop?: (id: string, connection: NodeConnection) => void;
  /** The bend point picked, or none: the editor says so. */
  onBendPicked?: (pick: { connection: NodeConnection; index: number } | null) => void;
  /** A click on blank canvas: no node is picked, the panel shuts (TODO 559). */
  onDeselect?: () => void;
  /** A box dragged on the blank canvas picked these nodes (TODO 735); the connections it crossed are picked and drawn. */
  onBox?: (nodes: string[]) => void;
  /** The picked connections changed: a click, a box, or a key. */
  onPicked?: (connections: NodeConnection[]) => void;
  /** Picked connections cut with Delete or Backspace, as one edit; unset, each goes to `onBreak`. */
  onBreakAll?: (connections: NodeConnection[]) => void;
  /** Delete or Backspace with nodes picked: these nodes and these connections, as one edit. Unset, a node stays. */
  onRemove?: (nodes: string[], connections: NodeConnection[]) => void;
  /** A line dragged out of an unconnected picklist's input socket and let go on the bare canvas, at a place on the plane. */
  onCustom?: (to: string, at: { x: number; y: number }) => void;
  /** A line let go on the bare canvas from a socket of any type: "Add a node" opens there (D16). Where unset, the line goes nowhere. */
  onAdd?: (context: AddContext) => void;
  /** A line over a node, by its id, while no run lights it: "Update available" on an out-of-date instance. */
  notes?: ReadonlyMap<string, string>;
  /** A node whose place the host owns: a drag reports and moves nothing (the Group Input, a preset's inside). */
  locked?: (node: GraphNode) => boolean;
  /** A frame's header pressed, or Enter or Space there: the drawing marks it picked (TODO 778). */
  onFrameSelect?: (frame: NodeFrame) => void;
  /** A frame's Release, or Delete on its header: the frame goes, its nodes stay. Unset, the frames are read only. */
  onRelease?: (id: string) => void;
  /** A node a double click on its header OPENS (a Custom Node's use): it does not collapse. */
  opens?: (node: GraphNode) => boolean;
  /** Nodes were collapsed or expanded: their heights changed. */
  onCollapse?: () => void;
}

/** A field a row draws: a text field, a select or tags, a menu of ticks (a quick-filter chip), or a switch. */
type Field = HTMLElement & {
  value: unknown; values?: string[]; tags?: readonly string[]; suggestions?: readonly { value: string; label?: string }[];
  menu?: HTMLElement & { populate(items: unknown): void }; checked?: boolean; populate?(items: unknown): void;
};

/** The events a field says its change by: its own `change`, or a chip's pick. */
const CHANGES = ['change', 'quick-filter-change'] as const;

/** What a canvas has drawn: each node and row by its address, the lines, and the connections they draw. */
interface Drawn {
  /** The canvas it is drawn on. */
  canvas: SherpaLayoutCanvas;
  graph: FramedGraph;
  options: DrawOptions;
  nodes: Map<string, HTMLElement>;
  rows: Map<string, HTMLElement>;
  /** Each row element's address, for an edit to name. */
  addresses: WeakMap<HTMLElement, [string, string]>;
  /** A row whose output is drawn on another's (`beside`): its address, and the address of the row that wears it. */
  beside: Map<string, string>;
  shapes: Map<string, string>;
  /** The place each node was last given by its graph: a new one moves it, the same one leaves the reader's. */
  placedAt: Map<string, string>;
  /** Where a node was when a drag last reported it, so a group moves by the delta. Cleared when the graph places it. */
  movedTo: Map<string, [number, number]>;
  lines: SVGSVGElement;
  connections: readonly NodeConnection[];
  /** The zip ties, and the one a click picked: Delete removes it, the arrow keys move it. */
  ties: readonly NodeTie[];
  selectedTie: string | null;
  /** Each drawn connection's points on the plane, for a tie's line to cross. */
  lanes: { connection: NodeConnection; dots: [number, number][] }[];
  /** The tie tool is on: a drag on the blank canvas ties what it crosses. */
  tying: boolean;
  /** The line a reader is drawing, kept over each redraw of the connections. */
  draft: SVGPathElement | null;
  /** The connection whose end the reader holds: not drawn while it is. */
  lifted: NodeConnection | null;
  /** The connections picked, by a click or a box: Delete or Backspace breaks them, T ties them. */
  picked: NodeConnection[];
  /** The bend point picked (`index` in `via`): Delete removes it, the arrows move it. `proposed`: the mid-point dot
   *  of an unbent connection, in no `via` until an arrow moves it in at `index`. */
  handle: { connection: NodeConnection; index: number; proposed?: true } | null;
  /** The tie a dragged connector would join. */
  target: string | null;
  /** A drag just ended on a connector line: the click after it picks nothing. */
  dragged: boolean;
  /** Drags of a handle so far: each is one step. */
  drags: number;
  /** The id of the filter a picked tie's shadow is. */
  shadow: string;
  sizes: ResizeObserver;
  fitted: boolean;
  /** Each frame drawn, by id, and the one picked. TODO 778 */
  frames: Map<string, HTMLElement>;
  selectedFrame: string | null;
  /** The nodes drawn collapsed, and whether a collapsed node hides its unconnected sockets: the view's, never the graph's. */
  collapsed: Set<string>;
  hideUnconnected: boolean;
  /** The row whose field has focus, by its address: the nodes joined to it wear the active border. TODO 889 */
  focusRow: string | null;
}

const drawnOn = new WeakMap<HTMLElement, Drawn>();
let shadows = 0;

/** How a row's value reads: a direction in full. */
function shown(row: GraphRow): string {
  const value = row.value;
  if (value === undefined || value === null) return '';
  if (row.control === 'direction') return value === 'desc' ? 'Descending' : value === 'asc' ? 'Ascending' : String(value);
  // A joined provider or model, by its words (plan 926).
  if (row.needs === 'provider' || row.needs === 'model') return aiWords(row.needs, value) ?? String(value);
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/** A row's value as its socket's tip says it: a pick by its label. */
function valueWords(row: GraphRow): string {
  const value = row.value;
  if (row.choices && (typeof value === 'string' || Array.isArray(value))) {
    const label = (v: unknown): string => row.choices!.find((c) => c.value === v)?.label ?? String(v);
    return Array.isArray(value) ? value.map(label).join(', ') : label(value);
  }
  return shown(row);
}

/** Set an attribute, or take it away when there is nothing to say. */
/** The header's words when a simulation finds no row true. */

function put(el: Element, name: string, value: string | undefined): void {
  if (value === undefined || value === '') el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** A row's field: a switch, a menu of ticks, a select of its choices, or a text or number field.
 *  LOCKED — read only — where a connection drives it, or nothing outside takes its change. */
/** A row the graph feeds reads READ ONLY: the control's own look, not the inactive pin, and it takes no press or key. */
function lock(field: Field, typed = false): void {
  field.setAttribute('readonly', '');
  field.setAttribute('aria-readonly', 'true');
  // A text field's own readonly does the rest.
  if (typed) return;
  for (const type of ['keydown', 'keyup', 'click'] as const) {
    field.addEventListener(type, (event) => {
      if (type !== 'click' && (event as KeyboardEvent).key === 'Tab') return;
      event.preventDefault();
      if (type === 'click') event.stopImmediatePropagation();
    }, true);
  }
}

/** A date row's calendar: a button in its field's actions, opening a menu of one calendar with its time. A pick is the field's
 *  change. The calendar is fetched with the first date row: no other row needs it. Its value is an ATTRIBUTE, safe before it upgrades. */
function datePicker(field: Field): HTMLElement {
  void import('../../components/sherpa-calendar/sherpa-calendar.js');
  const button = document.createElement('sherpa-button');
  for (const [k, v] of Object.entries({ slot: 'actions', 'data-type': 'icon', 'data-look': 'transparent', 'data-icon-start': 'calendar', 'aria-label': 'Pick a date and time' })) button.setAttribute(k, v);
  const menu = document.createElement('sherpa-menu');
  for (const [k, v] of Object.entries({ slot: 'menu', 'data-type': 'calendar', 'data-align': 'end' })) menu.setAttribute(k, v);
  const calendar = document.createElement('sherpa-calendar');
  calendar.setAttribute('data-embedded', '');
  calendar.setAttribute('data-has-time', '');
  calendar.addEventListener('datetime-change', (event) => {
    event.stopPropagation();
    field.value = formatDateTime((event as CustomEvent<{ value: string }>).detail.value);
    field.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { value: field.value } }));
  });
  menu.append(calendar);
  button.append(menu);
  return button;
}

function fieldFor(row: GraphRow, locked: boolean, inNode = false): Field {
  if (row.control === 'tags') {
    // Each word a tag; a closed list takes only its choices.
    const field = document.createElement('sherpa-input-text') as Field;
    field.setAttribute('name', row.name);
    field.setAttribute('data-type', 'tags');
    field.toggleAttribute('data-closed', !!row.closed);
    if (locked) lock(field, true);
    return field;
  }
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
    if (locked) lock(chip);
    return chip;
  }
  if (row.control === 'switch') {
    const field = document.createElement('sherpa-switch') as Field;
    if (locked) lock(field);
    return field;
  }
  // In the node, a message is a text area, a title one line (Will, 2026-11-11); the Details panel edits it as Markdown.
  if (row.control === 'message' && inNode) {
    const field = document.createElement('sherpa-input-text') as Field;
    field.setAttribute('name', row.name);
    if (!row.singleLine) field.setAttribute('data-multiline', '');
    if (locked) lock(field, true);
    return field;
  }
  // A message is Markdown, edited as it reads (plan 892).
  if (row.control === 'message') {
    const field: Field = messageField(row.name, row.singleLine);
    if (locked) lock(field, true);
    return field;
  }
  const field = document.createElement('sherpa-input-text') as Field;
  field.setAttribute('name', row.name);
  if (row.choices) field.setAttribute('data-type', 'select');
  else if (row.control === 'number') field.setAttribute('data-type', 'number');
  // A count's bounds are the platform's own: its steppers stop there. With no step, any number: the platform's is 1.
  if (row.control === 'number') {
    if (row.min !== undefined) field.setAttribute('min', String(row.min));
    field.setAttribute('step', row.step === undefined ? 'any' : String(row.step));
  }
  if (row.control === 'datetime' && !locked) field.append(datePicker(field));
  if (locked) lock(field, !row.choices);
  if (row.choices) field.populate?.(row.choices);
  return field;
}

/** What each field was last filled with: the same again, while the field still shows it, is skipped — a draw fills every
 *  field, and a fill sets values a field then measures (a tags field: a forced layout each). */
const filled = new WeakMap<Field, string>();

/** Whether a field shows its row's value as a fill would put it. */
function shows(field: Field, row: GraphRow): boolean {
  if (row.control === 'tags') return JSON.stringify(field.tags ?? []) === JSON.stringify([row.value ?? []].flat().map(String));
  if (row.control === 'switch') return !!field.checked === !!row.value;
  if (row.control === 'datetime') return field.value === formatDateTime(String(row.value ?? ''));
  if (row.multiple) return JSON.stringify(field.values ?? []) === JSON.stringify(Array.isArray(row.value) ? row.value.map(String) : []);
  return field.value === (row.choices ? String(row.value ?? '') : shown(row));
}

/** Give a field its row's value, and its words: its fault, red, in the field's own message. TRAP T-a-row-says-its-own-fault */
function fill(field: Field, row: GraphRow, note?: string): void {
  const said = JSON.stringify([row.label, note ?? row.hint, row.fault, row.control, row.multiple, row.value, row.choices]);
  if (filled.get(field) === said && shows(field, row)) return;
  filled.set(field, said);
  field.setAttribute('data-label', row.label);
  put(field, 'data-description', note ?? row.hint);
  put(field, 'data-error', row.fault);
  if (row.control === 'tags') {
    field.suggestions = row.choices ?? [];
    field.tags = [row.value ?? []].flat().map(String);
  } else if (row.control === 'datetime') {
    // A day reads in words; the calendar holds it as ISO.
    field.value = formatDateTime(String(row.value ?? ''));
    const calendar = field.querySelector('sherpa-calendar');
    if (calendar) put(calendar, 'value', isDateTime(String(row.value ?? '')) ? String(row.value) : undefined);
  } else if (row.control === 'switch') field.checked = !!row.value;
  else if (row.multiple) {
    const picks = Array.isArray(row.value) ? row.value.map(String) : [];
    const menu = field.menu ?? field.querySelector<NonNullable<Field['menu']>>('sherpa-menu');
    menu?.populate((row.choices ?? []).map((c) => ({ value: c.value, label: c.label, selected: picks.includes(c.value) })));
    field.values = picks;
  }
  // A select holds its value's KEY, and shows its label itself.
  else field.value = row.choices ? String(row.value ?? '') : shown(row);
}

/** What a field says now, as its row's value: a date typed in words is read as ISO, and one that is no date as typed. */
function read(field: Field, row: GraphRow): unknown {
  if (row.control === 'tags') return [...(field.tags ?? [])];
  if (row.control === 'datetime') return readDateTime(String(field.value ?? '')) ?? String(field.value ?? '').trim();
  return row.control === 'switch' ? !!field.checked : row.multiple ? [...(field.values ?? [])] : field.value;
}

/** A graph's connected inputs and sending outputs, by address: worked out once a graph. */
const connectionSets = new WeakMap<DrawnGraph, { connected: Set<string>; sent: Set<string> }>();
function connectionsOf(graph: DrawnGraph): { connected: Set<string>; sent: Set<string> } {
  let sets = connectionSets.get(graph);
  if (!sets) connectionSets.set(graph, (sets = { connected: new Set(graph.connections.map((r) => r.to)), sent: new Set(graph.connections.map((r) => r.from)) }));
  return sets;
}

/** One node's rows, made again when their shape changed and given their values. */
function drawRows(drawn: Drawn, el: HTMLElement, node: GraphNode): void {
  // Read once a draw, not once a node.
  const { connected, sent } = connectionsOf(drawn.graph);
  const locked = (row: GraphRow): boolean => !row.editable || connected.has(`${node.id}/${row.name}`);
  const shape = JSON.stringify(node.rows.map((r) => [r.name, r.control, r.input, r.output, r.beside, locked(r), r.choices]));
  if (drawn.shapes.get(node.id) !== shape) {
    drawn.shapes.set(node.id, shape);
    for (const key of [...drawn.rows.keys()]) if (key.startsWith(`${node.id}/`)) drawn.rows.delete(key);
    for (const key of [...drawn.beside.keys()]) if (key.startsWith(`${node.id}/`)) drawn.beside.delete(key);
    // A row drawn `beside` another has no line: its output is the other's.
    // Three sections, each its own grey box: the type pick, the inputs, then the properties under their own label.
    const lines = (rows: readonly GraphRow[]): HTMLElement[] => rows.filter((row) => !row.beside).map((row) => {
      const line = document.createElement('sherpa-node-row');
      drawn.rows.set(`${node.id}/${row.name}`, line);
      drawn.addresses.set(line, [node.id, row.name]);
      if (row.control) line.append(fieldFor(row, locked(row), true));
      return line;
    });
    const section = (...kids: HTMLElement[]): HTMLElement[] => {
      if (!kids.length) return [];
      const box = document.createElement('div');
      box.className = 'section';
      box.append(...kids);
      return [box];
    };
    const titled = (label: string): HTMLElement => {
      const title = document.createElement('sherpa-node-row');
      title.setAttribute('data-label', label);
      return title;
    };
    const inputs = lines(node.rows.filter((r) => r.control !== 'type' && !r.property));
    el.replaceChildren(
      ...section(...lines(node.rows.filter((r) => r.control === 'type'))),
      ...(inputs.length ? section(titled('Parameters'), ...inputs) : []),
      // A property drawn beside another row (a Source's Results) leaves no box of its own.
      ...(node.rows.some((r) => r.property && !r.beside) ? section(titled('Properties'), ...lines(node.rows.filter((r) => r.property))) : []),
    );
    for (const row of node.rows) {
      const wearer = row.beside && drawn.rows.get(`${node.id}/${row.beside}`);
      if (!wearer) continue;
      drawn.rows.set(`${node.id}/${row.name}`, wearer);
      drawn.beside.set(`${node.id}/${row.name}`, `${node.id}/${row.beside}`);
    }
  }
  const worn = new Set(node.rows.flatMap((r) => (r.beside ? [r.beside] : [])));
  for (const row of node.rows) {
    const line = drawn.rows.get(`${node.id}/${row.name}`)!;
    const address = `${node.id}/${row.name}`;
    // A row that wears another's output leaves it to that row; one that is worn sets only its output.
    if (!row.beside) put(line, 'data-input-socket', row.input);
    if (!worn.has(row.name) || row.beside) put(line, 'data-output-socket', row.output);
    if (!row.beside) line.toggleAttribute('data-input-many', !!row.many);
    if (!row.beside) line.toggleAttribute('data-input-connected', connected.has(address));
    if (!worn.has(row.name) || row.beside) line.toggleAttribute('data-output-connected', sent.has(address));
    const field = line.firstElementChild as Field | null;
    if (row.beside) continue;
    // A Results with no rows to say hides, unless a connection still leaves it (TODO 924).
    line.toggleAttribute('data-idle', !!row.idle);
    // Each socket's tip names its row and says its value: a collapsed node shows neither.
    put(line, 'data-socket-name', row.label);
    put(line, 'data-socket-value', connected.has(address) ? undefined : valueWords(row));
    if (field) fill(field, row);
    // A row with no field says what it reads; one that reads null, only its name.
    else {
      line.setAttribute('data-label', row.control === undefined && row.value != null ? `${row.label}: ${shown(row)}` : row.label);
      line.toggleAttribute('data-property', !!row.property);
    }
  }
  // A section with no socket: a collapsed node draws none of it; none a connection joins: hiding the unconnected, none of it.
  for (const box of el.querySelectorAll(':scope > .section')) {
    const rows = [...box.children];
    box.toggleAttribute('data-bare', !rows.some((r) => r.hasAttribute('data-input-socket') || r.hasAttribute('data-output-socket')));
    box.toggleAttribute('data-unconnected', !rows.some((r) => r.hasAttribute('data-input-connected') || r.hasAttribute('data-output-connected')));
    // Every row of it idle and unconnected: the box goes too (TODO 924).
    const sockets = rows.filter((r) => r.hasAttribute('data-input-socket') || r.hasAttribute('data-output-socket'));
    box.toggleAttribute('data-idle', sockets.length > 0 && sockets.every((r) => r.hasAttribute('data-idle') && !r.hasAttribute('data-output-connected')));
  }
}

/**
 * A collapsed node's two stacks: each socket's place, in its order — the header's, then the rows', then a fork's False —
 * among all, and among the connected only; and each stack's counts. Written on the node and its rows.
 */
function stackPlaces(el: HTMLElement, collapsed: boolean): void {
  const at = { in: 0, out: 0, inConnected: 0, outConnected: 0 };
  if (el.hasAttribute('data-input-socket')) {
    at.in++;
    if (el.hasAttribute('data-input-connected')) at.inConnected++;
  }
  if (el.hasAttribute('data-output-socket')) {
    at.out++;
    if (el.hasAttribute('data-output-connected')) at.outConnected++;
  }
  for (const row of el.querySelectorAll<HTMLElement>('sherpa-node-row')) {
    row.toggleAttribute('data-collapsed', collapsed);
    // An idle row, hidden, holds no place in a stack (TODO 924).
    if (row.hasAttribute('data-idle') && !row.hasAttribute('data-output-connected')) {
      for (const name of ['input', 'output']) for (const end of ['at', 'at-connected']) row.removeAttribute(`data-${name}-${end}`);
      continue;
    }
    const side = (socket: string, connected: string, all: 'in' | 'out', only: 'inConnected' | 'outConnected', name: string): void => {
      const has = row.hasAttribute(socket);
      put(row, `data-${name}-at`, has ? String(at[all]++) : undefined);
      put(row, `data-${name}-at-connected`, has && row.hasAttribute(connected) ? String(at[only]++) : undefined);
    };
    side('data-input-socket', 'data-input-connected', 'in', 'inConnected', 'input');
    side('data-output-socket', 'data-output-connected', 'out', 'outConnected', 'output');
  }
  el.setAttribute('data-inputs', String(at.in));
  el.setAttribute('data-outputs', String(at.out));
  el.setAttribute('data-inputs-connected', String(at.inConnected));
  el.setAttribute('data-outputs-connected', String(at.outConnected));
}

/** A socket's middle, on the canvas's plane. */
function onPlane(canvas: SherpaLayoutCanvas, rect: DOMRect): [number, number] {
  return planeOf(canvas, { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
}

/** A tie's place as drawn: its x kept within the limit of its connections' nodes. Drawing never writes. */
function tieX(drawn: Drawn, tie: NodeTie): number {
  const limit = tieLimit(drawn.graph, tie);
  return limit ? Math.min(limit.max, Math.max(limit.min, tie.x)) : tie.x;
}

/** The place a tie funnels its nth connection through. */
function slotOf(drawn: Drawn, tie: NodeTie, n: number): [number, number] {
  return [tieX(drawn, tie), tie.y + (n - (tie.connections.length - 1) / 2) * TIE_GAP];
}

/** The type a connection carries, from its output socket: a row's, or the header's. */
function outputType(graph: DrawnGraph, from: string): string {
  const { node: id, row } = socketOf(from);
  const node = graph.nodes.find((n) => n.id === id);
  if (row !== undefined) return node?.rows.find((r) => r.name === row)?.output ?? '';
  return node?.output ?? '';
}

/** The handles of one connection: a dot at each bend point, and a proposed one at the middle of each piece, saved only once moved. They show on hover, and when the connection or the handle is picked. */
function handleMarks(
  way: readonly { at: Pt; bend?: number }[], mids: readonly { at: Pt; insert: number }[], pick: Drawn['handle'],
): SVGElement[] {
  const mark = (at: Pt, data: Record<string, string>, on: boolean): SVGElement => {
    const handle = document.createElementNS(SVG, 'g');
    handle.setAttribute('class', 'graph-handle');
    for (const [k, v] of Object.entries(data)) handle.dataset[k] = v;
    if (on) handle.setAttribute('data-selected', '');
    // A larger unseen circle takes the pointer; the dot is what shows.
    const grab = document.createElementNS(SVG, 'circle');
    const dot = document.createElementNS(SVG, 'circle');
    for (const [el, r] of [[grab, 10], [dot, 5]] as const) for (const [k, v] of Object.entries({ cx: at[0], cy: at[1], r })) el.setAttribute(k, String(v));
    grab.setAttribute('class', 'graph-handle-grab');
    grab.setAttribute('style', 'fill: transparent; stroke: none; pointer-events: all; cursor: grab');
    dot.setAttribute('class', 'graph-handle-dot');
    dot.setAttribute('style', 'pointer-events: none');
    handle.append(grab, dot);
    return handle;
  };
  return [
    ...mids.map((m, k) => mark(m.at, { mid: String(k), insert: String(m.insert) }, !!pick?.proposed && pick.index === m.insert)),
    ...way.flatMap((w) => (w.bend === undefined ? [] : [mark(w.at, { bend: String(w.bend) }, !pick?.proposed && pick?.index === w.bend)])),
  ];
}

/** The shadow a picked tie casts, as an SVG filter: the one every engine paints on a shape, which CSS `drop-shadow` is not. Its box is wide, the tie being thin. */
function shadowFilter(id: string): SVGElement {
  const defs = document.createElementNS(SVG, 'defs');
  const filter = document.createElementNS(SVG, 'filter');
  const shadow = document.createElementNS(SVG, 'feDropShadow');
  for (const [k, v] of Object.entries({ id, x: '-600%', y: '-100%', width: '1300%', height: '300%', 'color-interpolation-filters': 'sRGB' })) filter.setAttribute(k, v);
  for (const [k, v] of Object.entries({ dx: '3', dy: '4', stdDeviation: '2.5' })) shadow.setAttribute(k, v);
  shadow.setAttribute('style', 'flood-color: var(--sherpa-style-surface-shadow, #35353d); flood-opacity: 0.7');
  filter.append(shadow);
  defs.append(filter);
  return defs;
}

/** Each frame round its nodes as drawn: the box of their cards, which it stands clear of. None drawn, it is hidden.
 *  TRAP T-a-frame-is-drawn-round-its-nodes */
function placeFrames(drawn: Drawn): void {
  const boxes = [...drawn.frames].map(([id, el]) => {
    const cards = (drawn.graph.frames?.find((f) => f.id === id)?.nodes ?? []).flatMap((n) => drawn.nodes.get(n) ?? []);
    if (!cards.length) return [el, null] as const;
    const placed = cards.map(boxOf);
    const [left, top] = [Math.min(...placed.map((b) => b.left)), Math.min(...placed.map((b) => b.top))];
    const [right, bottom] = [Math.max(...placed.map((b) => b.right)), Math.max(...placed.map((b) => b.bottom))];
    return [el, { x: left, y: top, w: right - left, h: bottom - top }] as const;
  });
  // Every read first, then every write: one layout.
  for (const [el, box] of boxes) {
    el.toggleAttribute('hidden', !box);
    for (const [k, v] of Object.entries(box ?? {})) if (el.getAttribute(`data-${k}`) !== String(Math.round(v))) el.setAttribute(`data-${k}`, String(Math.round(v)));
  }
}

/** Draw the lines again, from where the sockets are drawn now: nodes moved by hand, not by a draw. With a graph, its
 *  connections and ties: a tie or a bend dragged, the nodes as they are. */
function relayConnections(canvas: SherpaLayoutCanvas, graph?: FramedGraph): void {
  const drawn = drawnOn.get(canvas);
  if (!drawn) return;
  if (graph) [drawn.graph, drawn.connections, drawn.ties] = [graph, graph.connections, graph.ties ?? []];
  drawConnections(drawn);
}

/** A curve for each connection, from its output socket to its input socket; the frames round their nodes first. */
function drawConnections(drawn: Drawn): void {
  placeFrames(drawn);
  const same = (a: NodeConnection | null, b: NodeConnection): boolean => !!a && a.from === b.from && a.to === b.to;
  const lanes: Drawn['lanes'] = [];
  const paths = drawn.connections.flatMap((connection) => {
    const [from, to] = [socketPoint(drawn, connection.from, 'output'), socketPoint(drawn, connection.to, 'input')];
    if (!from || !to || same(drawn.lifted, connection)) return [];
    // The ties it passes, or else the bend points it holds, left to right: a flat piece to each.
    const stops = drawn.ties.flatMap((tie) => {
      const n = tie.connections.findIndex((r) => same(r, connection));
      return n < 0 ? [] : [slotOf(drawn, tie, n)];
    });
    // As drawn, the bends stay inside the end sockets: a node moved later never loops the line back. The saved list stays.
    const way = waypointsOf(connection.via && clampedVia(connection.via, { from: from[0], to: to[0] }), stops);
    const points = [from, ...way.map((w) => w.at), to];
    const soft = way.some((w) => w.bend !== undefined);
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', pathThrough(points, soft));
    path.dataset['type'] = outputType(drawn.graph, connection.from);
    path.dataset['from'] = connection.from;
    path.dataset['to'] = connection.to;
    if (drawn.picked.some((r) => same(r, connection))) path.setAttribute('data-selected', '');
    // An input its Condition's type ignores: dashed, and its tip says why (TODO 940 D2).
    const ignored = drawn.graph.nodes.find((n) => n.id === connection.to)?.ignored;
    const why = ignored?.from.includes(connection.from) ? ignored.words : undefined;
    if (why) path.setAttribute('data-ignored', '');
    // The line a click lands on: wide, unseen, and the only part of the lines that takes the pointer.
    const hit = document.createElementNS(SVG, 'polyline');
    const dots = dotsThrough(points, soft);
    lanes.push({ connection, dots });
    hit.setAttribute('points', dots.map(([x, y]) => `${x},${y}`).join(' '));
    hit.setAttribute('class', 'graph-hit');
    hit.setAttribute('style', 'stroke: transparent; stroke-width: 14px; pointer-events: stroke; cursor: pointer');
    hit.dataset['from'] = connection.from;
    hit.dataset['to'] = connection.to;
    if (why) {
      const tip = document.createElementNS(SVG, 'title');
      tip.textContent = why;
      hit.append(tip);
    }
    const group = document.createElementNS(SVG, 'g');
    group.setAttribute('class', 'graph-connector');
    group.dataset['from'] = connection.from;
    group.dataset['to'] = connection.to;
    const mine = drawn.handle && same(drawn.handle.connection, connection) ? drawn.handle : null;
    if (mine || drawn.picked.some((r) => same(r, connection))) group.setAttribute('data-active', '');
    group.append(path, hit, ...handleMarks(way, handlesOf(from, to, way), mine));
    return [group];
  });
  drawn.lanes = lanes;
  const bars = drawn.ties.map((tie) => {
    const [x, y] = slotOf(drawn, tie, 0);
    const high = (tie.connections.length - 1) * TIE_GAP + 16;
    const bar = document.createElementNS(SVG, 'rect');
    for (const [k, v] of Object.entries({ x: x - 2, y: y - 8, width: 4, height: high, rx: 2, class: 'graph-tie' })) bar.setAttribute(k, String(v));
    const base = 'fill: var(--sherpa-style-border-base, #b3b3c3); stroke: none';
    // A picked tie: the active accent, a ring, and the elevation's shadow.
    const active = 'fill: var(--sherpa-style-active-indicator-accent, #3b4ccd); stroke: var(--sherpa-style-active-indicator-accent, #3b4ccd); stroke-width: 3px; paint-order: stroke;'
      + ` filter: url(#${drawn.shadow})`;
    bar.setAttribute('style', `${drawn.selectedTie === tie.id ? active : base}; pointer-events: all; cursor: grab`);
    bar.dataset['tie'] = tie.id;
    if (drawn.selectedTie === tie.id) bar.setAttribute('data-selected', '');
    if (drawn.target === tie.id) bar.setAttribute('data-target', '');
    return bar;
  });
  // The lines drawn last time, by what each is, take what changed: a node dragged moves its lines and leaves the rest.
  // TRAP T-a-redraw-keeps-what-it-can
  const keyOf = (el: Element): string => `${el.localName}:${el.getAttribute('data-from')}>${el.getAttribute('data-to')}:${el.getAttribute('data-tie')}`;
  const was = new Map([...drawn.lines.children].map((el) => [keyOf(el), el]));
  const fresh = [...paths, ...bars, ...(drawn.selectedTie ? [shadowFilter(drawn.shadow)] : [])].map((el) => {
    const old = was.get(keyOf(el));
    return old ? morph(old, el) : el;
  });
  keepOrder(drawn.lines, [...fresh, ...(drawn.draft ? [drawn.draft] : [])], true);
  fitLines(drawn);
  // A connection picked, or let go: what it joins wears the active border, or no longer.
  markJoined(drawn);
}

/**
 * The lines' own box: round every connection, tie and handle — and, while a line is drawn by hand, the whole view — so a canvas
 * that draws the lines as one element draws them all (a 1px box drew none). Their coordinates stay the plane's: a viewBox
 * at the box. Plan 852 step 4.
 */
function fitLines(drawn: Drawn): void {
  const [xs, ys]: [number[], number[]] = [[], []];
  for (const { dots } of drawn.lanes) for (const [x, y] of dots) { xs.push(x); ys.push(y); }
  for (const tie of drawn.ties) {
    const [x, y] = slotOf(drawn, tie, 0);
    xs.push(x);
    ys.push(y - TIE_GAP, y + tie.connections.length * TIE_GAP);
  }
  if (drawn.draft) {
    const { x, y, zoom } = drawn.canvas.view;
    xs.push(-x / zoom, (drawn.canvas.clientWidth - x) / zoom);
    ys.push(-y / zoom, (drawn.canvas.clientHeight - y) / zoom);
  }
  // Past the lines by a handle and a selected line's width.
  const PAD = 24;
  const [l, t] = xs.length ? [Math.floor(Math.min(...xs)) - PAD, Math.floor(Math.min(...ys)) - PAD] : [0, 0];
  const [r, b] = xs.length ? [Math.ceil(Math.max(...xs)) + PAD, Math.ceil(Math.max(...ys)) + PAD] : [1, 1];
  const put = (name: string, value: string): void => { if (drawn.lines.getAttribute(name) !== value) drawn.lines.setAttribute(name, value); };
  put('width', String(r - l));
  put('height', String(b - t));
  put('viewBox', `${l} ${t} ${r - l} ${b - t}`);
  if (drawn.lines.style.getPropertyValue('--x') !== `${l}px`) drawn.lines.style.setProperty('--x', `${l}px`);
  if (drawn.lines.style.getPropertyValue('--y') !== `${t}px`) drawn.lines.style.setProperty('--y', `${t}px`);
}

/** A socket's box on the screen: a node's or a row's, on one side. */
function socketAt(drawn: Drawn, address: string, side: SocketSide): DOMRect | null {
  const { node, row } = socketOf(address);
  const el = (row === undefined ? drawn.nodes.get(node) : drawn.rows.get(address)) as HasSockets | undefined;
  return el?.socketRect?.(side) ?? null;
}

/** A socket's middle on the plane, through its node: a node a canvas does not draw (out of its view) still has its sockets. */
function socketPoint(drawn: Drawn, address: string, side: SocketSide): [number, number] | null {
  const rect = socketAt(drawn, address, side);
  const node = drawn.nodes.get(socketOf(address).node);
  return rect && node ? pointIn(node, rect, drawn.canvas.view.zoom) : null;
}

/** Where a drawn node or row is: `node`, or `node/row`. */
function addressOf(drawn: Drawn, el: HTMLElement): string | null {
  const row = drawn.addresses.get(el);
  if (row) return `${row[0]}/${row[1]}`;
  return [...drawn.nodes].find(([, node]) => node === el)?.[0] ?? null;
}

/** The socket of one side nearest a point on the screen, within reach, or none. */
function socketNear(drawn: Drawn, side: 'input' | 'output', x: number, y: number): string | null {
  const REACH = 20;
  let best: [string, number] | null = null;
  const worn = new Set(drawn.beside.values());
  for (const [address, el] of [...drawn.nodes, ...drawn.rows]) {
    // A row's output drawn on another's is that one's by its own address only (`beside`).
    if (drawn.beside.has(address) ? side !== 'output' : side === 'output' && worn.has(address)) continue;
    const rect = (el as HasSockets).socketRect?.(side);
    if (!rect) continue;
    const far = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
    if (far <= REACH && (!best || far < best[1])) best = [address, far];
  }
  return best?.[0] ?? null;
}

/** Whether an input is a picklist a Value node may be connected to (D7): a row, one value in. */
function takesCustom(drawn: Drawn, address: string): boolean {
  const { node, row: name } = socketOf(address);
  const row = name === undefined ? undefined : drawn.graph.nodes.find((n) => n.id === node)?.rows.find((r) => r.name === name);
  return !!row && row.input === 'value' && !row.many && rowChoices(row) !== undefined;
}

/**
 * A press on a socket draws a line. From an OUTPUT, a new connection: let go on an input socket and
 * the host is asked to join them. On a CONNECTED input, its end comes up (TODO 557): let go on
 * another input socket, the connection moves there; on the bare canvas it breaks (558); where it
 * began, nothing. On an UNCONNECTED picklist's input, the line runs the other way: let go on an
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
  const wornAs = (address: string): string => (out ? [...drawn.beside].find(([, to]) => to === address)?.[0] ?? address : address);
  const own = owner ? addressOf(drawn, owner) : null;
  if (!owner || !own) return;
  // What the line is joined to at its start: the output it leaves, or the input it runs back to.
  const lifting = out ? undefined : drawn.connections.findLast((r) => r.to === own);
  if (!out && !lifting && !takesCustom(drawn, own) && !(drawn.options.onAdd && typeAt(drawn, own, 'input'))) return;
  const from = out ? wornAs(own) : lifting?.from;
  const start = out ? (owner as HasSockets).socketRect?.('output') : lifting ? socketAt(drawn, lifting.from, 'output') : (owner as HasSockets).socketRect?.('input');
  if (!start) return;
  event.preventDefault();
  event.stopPropagation();
  const draft = document.createElementNS(SVG, 'path');
  draft.setAttribute('class', 'graph-draft');
  draft.setAttribute('stroke-dasharray', '6 4');
  drawn.draft = draft;
  drawn.lifted = lifting ?? null;
  // While a line is dragged, every hidden socket shows: the one it left, and each it may join.
  const reveal = (on: boolean): void => { for (const el of drawn.nodes.values()) el.toggleAttribute('data-reveal', on); };
  reveal(true);
  drawn.lines.append(draft);
  fitLines(drawn);
  if (lifting) drawConnections(drawn);
  const begin = onPlane(canvas, start);
  const follow = (e: PointerEvent): void => {
    draft.setAttribute('d', out || lifting ? pathThrough([begin, planeOf(canvas, e)]) : pathThrough([planeOf(canvas, e), begin]));
  };
  // "Add a node" for a line let go on the bare canvas: the socket's type, what an output gives (a Field's column), and where.
  const addFrom = (socket: string, side: 'out' | 'in', e: PointerEvent): void => {
    const type = typeAt(drawn, socket, side === 'out' ? 'output' : 'input');
    const [x, y] = planeOf(canvas, e);
    const { node, row } = socketOf(socket);
    const gives = side === 'out' ? drawn.graph.nodes.find((n) => n.id === node)?.rows.find((r) => r.name === row)?.gives : undefined;
    if (type) drawn.options.onAdd?.({ socket, type, side, ...(gives ? { gives } : {}), client: { x: e.clientX, y: e.clientY }, at: { x: Math.round(x), y: Math.round(y) } });
  };
  const stop = (e: PointerEvent): void => {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    draft.remove();
    reveal(false);
    drawn.draft = null;
    drawn.lifted = null;
    drawConnections(drawn);
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
      if (to && to !== lifting.to && socketOf(to).node !== socketOf(lifting.from).node) drawn.options.onReconnect?.(lifting, { from: lifting.from, to });
      else if (bare) drawn.options.onBreak?.(lifting);
    } else {
      const source = socketNear(drawn, 'output', e.clientX, e.clientY);
      if (source && socketOf(source).node !== socketOf(own).node) drawn.options.onConnect?.({ from: source, to: own });
      else if (bare) {
        const [x, y] = planeOf(canvas, e);
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

/** A connection picked by a click: alone, or with Shift added to the pick or taken off it. Delete or Backspace then breaks it. */
function pickConnection(canvas: SherpaLayoutCanvas, drawn: Drawn, connection: NodeConnection, shift: boolean): void {
  const held = drawn.picked.some((r) => r.from === connection.from && r.to === connection.to);
  if (drawn.handle) drawn.options.onBendPicked?.(null);
  drawn.handle = null;
  drawn.picked = shift ? (held ? drawn.picked.filter((r) => r.from !== connection.from || r.to !== connection.to) : [...drawn.picked, connection]) : [connection];
  drawn.selectedTie = null;
  unpickFrame(drawn);
  drawConnections(drawn);
  drawn.options.onPicked?.(drawn.picked);
  // The canvas's own keys hear the break.
  canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
}

/** The connection a handle or a line belongs to, from its group. */
function connectionOf(el: Element): NodeConnection | undefined {
  const group = el.closest<SVGElement>('g.graph-connector');
  return group ? { from: group.dataset['from']!, to: group.dataset['to']! } : undefined;
}

/** Pick a handle, or none; the picked connections and tie let go. The editor is told. */
function pickHandle(canvas: SherpaLayoutCanvas, drawn: Drawn, handle: Drawn['handle']): void {
  drawn.handle = handle;
  if (handle) {
    drawn.selectedTie = null;
    drawn.picked = [];
    drawn.options.onPicked?.([]);
  }
  drawConnections(drawn);
  drawn.options.onBendPicked?.(handle && !handle.proposed ? { connection: handle.connection, index: handle.index } : null);
  if (handle) canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
}

/**
 * A handle pressed. Dragged past 4px, a mid-point handle puts a bend point there and a bend point moves,
 * one edit each move; the host tags them as one step. Not dragged, it is picked. TODO 744
 */
function dragHandle(canvas: SherpaLayoutCanvas, drawn: Drawn, grab: SVGElement, down: PointerEvent): void {
  const handle = grab.closest<SVGElement>('.graph-handle');
  const connection = handle && connectionOf(handle);
  const held = connection && drawn.connections.find((r) => r.from === connection.from && r.to === connection.to);
  if (!handle || !connection || !held) return;
  down.preventDefault();
  down.stopPropagation();
  const mid = handle.dataset['mid'] !== undefined;
  // The index in `via` the dragged point has: a mid-point handle's is the one a new point would take.
  const at = mid ? Number(handle.dataset['insert']) : Number(handle.dataset['bend']);
  let moved = false;
  let insert = mid;
  const drag = ++drawn.drags;
  const follow = (e: PointerEvent): void => {
    if (!moved && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < 4) return;
    moved = true;
    const [x, y] = planeOf(canvas, e);
    drawn.handle = { connection, index: at };
    drawn.options.onBend?.(connection, at, x, y, insert, drag);
    insert = false;
  };
  const stop = (e: PointerEvent): void => {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    if (e.type !== 'pointerup') return;
    if (moved) pickHandle(canvas, drawn, drawn.handle);
    // A click on a bend point picks it; on a middle nothing has moved from, it is a click on the line.
    else if (mid) pickConnection(canvas, drawn, connection, e.shiftKey);
    else pickHandle(canvas, drawn, { connection, index: at });
  };
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

/**
 * A press on a connector's line. A click picks it. Dragged past 4px, a ghost line follows and the
 * tie under the pointer lights; let go there, the connection joins that tie; anywhere else, nothing
 * moves. TODO 744
 */
function dragLine(canvas: SherpaLayoutCanvas, drawn: Drawn, line: Element, down: PointerEvent): void {
  const connection = { from: (line as SVGElement).dataset['from']!, to: (line as SVGElement).dataset['to']! };
  const begin = planeOf(canvas, down);
  let ghost: SVGPathElement | null = null;
  const tieAt = (e: PointerEvent): string | null => {
    const first = e.composedPath()[0];
    return first instanceof SVGElement && first.classList.contains('graph-tie') ? first.dataset['tie'] ?? null : null;
  };
  const follow = (e: PointerEvent): void => {
    if (!ghost && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < 4) return;
    if (!ghost) {
      ghost = document.createElementNS(SVG, 'path');
      ghost.setAttribute('class', 'graph-draft');
      ghost.setAttribute('stroke-dasharray', '6 4');
      drawn.draft = ghost;
      drawn.lines.append(ghost);
      fitLines(drawn);
    }
    const [x, y] = planeOf(canvas, e);
    ghost.setAttribute('d', `M ${begin[0]} ${begin[1]} L ${x} ${y}`);
    const target = tieAt(e);
    if (target !== drawn.target) {
      drawn.target = target;
      for (const bar of drawn.lines.querySelectorAll<SVGElement>('rect.graph-tie')) bar.toggleAttribute('data-target', bar.dataset['tie'] === target);
    }
  };
  const stop = (e: PointerEvent): void => {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    if (!ghost) return;
    ghost.remove();
    drawn.draft = null;
    drawn.dragged = true;
    setTimeout(() => { drawn.dragged = false; });
    const target = e.type === 'pointerup' ? tieAt(e) : null;
    drawn.target = null;
    drawConnections(drawn);
    if (target) drawn.options.onTieDrop?.(target, connection);
  };
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

/** A tie dragged: it follows the pointer, and its host moves it within its limit. */
function dragTie(canvas: SherpaLayoutCanvas, drawn: Drawn, id: string, down: PointerEvent): void {
  const tie = drawn.ties.find((t) => t.id === id);
  if (!tie) return;
  down.preventDefault();
  down.stopPropagation();
  drawn.selectedTie = id;
  drawn.picked = [];
  unpickFrame(drawn);
  drawConnections(drawn);
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

/** With the tie tool on, a line dragged on the blank canvas: each connection it crosses is tied, top to bottom. */
function lineTie(canvas: SherpaLayoutCanvas, drawn: Drawn, down: PointerEvent): void {
  down.preventDefault();
  down.stopPropagation();
  const begin = planeOf(canvas, down);
  const draft = document.createElementNS(SVG, 'path');
  draft.setAttribute('class', 'graph-draft');
  draft.setAttribute('stroke-dasharray', '6 4');
  drawn.draft = draft;
  drawn.lines.append(draft);
  fitLines(drawn);
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
    const hits = drawn.lanes.flatMap(({ connection, dots }) => {
      for (let i = 1; i < dots.length; i++) {
        const at = crossing(begin, end, dots[i - 1]!, dots[i]!);
        if (at) return [{ connection, at }];
      }
      return [];
    }).sort((a, b) => a.at[1] - b.at[1]);
    if (!hits.length) return;
    const mean = (n: 0 | 1): number => Math.round(hits.reduce((sum, h) => sum + h.at[n], 0) / hits.length);
    drawn.options.onTie?.(hits.map((h) => h.connection), { x: mean(0), y: mean(1) });
  };
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

/**
 * A GHOST of these nodes: a dashed box of each, its name in it, over every node, that a drag moves while the nodes stay.
 * Removed when the drag lets go. Will, 2026-11-10
 */
function ghostOf(canvas: SherpaLayoutCanvas, ids: readonly string[]): { move(dx: number, dy: number): void; remove(): void } {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'graph-ghost');
  svg.setAttribute('width', '1');
  svg.setAttribute('height', '1');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', '--x: 0px; --y: 0px; overflow: visible; pointer-events: none');
  const group = document.createElementNS(SVG, 'g');
  for (const id of ids) {
    const el = drawnOn.get(canvas)?.nodes.get(id);
    if (!el) continue;
    const [x, y] = [Number(el.getAttribute('data-x')) || 0, Number(el.getAttribute('data-y')) || 0];
    const box = document.createElementNS(SVG, 'rect');
    for (const [k, v] of Object.entries({ x, y, width: el.offsetWidth, height: el.offsetHeight, rx: 4 })) box.setAttribute(k, String(v));
    box.setAttribute('style', 'fill: var(--sherpa-style-surface-base, #ffffff); fill-opacity: 0.7;'
      + ' stroke: var(--sherpa-style-active-indicator-accent, #3b4ccd); stroke-width: 1.5px; stroke-dasharray: 6 4');
    const name = document.createElementNS(SVG, 'text');
    name.setAttribute('x', String(x + 12));
    name.setAttribute('y', String(y + 22));
    name.setAttribute('style', 'fill: var(--sherpa-style-content-secondary, #35353d); font: 500 12px var(--sherpa-font-family-body, Inter, system-ui, sans-serif)');
    name.textContent = el.getAttribute('data-heading') ?? '';
    group.append(box, name);
  }
  svg.append(group);
  canvas.append(svg);
  return {
    move: (dx, dy) => group.setAttribute('transform', `translate(${dx} ${dy})`),
    remove: () => svg.remove(),
  };
}

/** Where connections would be tied with no pointer: the middle of the way each takes, on the plane. */
export function tieSpot(canvas: SherpaLayoutCanvas, connections: readonly NodeConnection[]): { x: number; y: number } {
  const lanes = (drawnOn.get(canvas)?.lanes ?? []).filter((l) => connections.some((r) => r.from === l.connection.from && r.to === l.connection.to));
  const ends = lanes.map((l) => [l.dots[0]!, l.dots.at(-1)!] as const);
  const mean = (n: 0 | 1): number => (ends.length ? Math.round(ends.reduce((sum, [a, b]) => sum + (a[n] + b[n]) / 2, 0) / ends.length) : 0);
  return { x: mean(0), y: mean(1) };
}

/** Clear what is picked: every node, and every connection. */
function deselect(canvas: SherpaLayoutCanvas, drawn: Drawn): void {
  markNode(canvas, null);
  unpickConnections(drawn);
  drawn.options.onDeselect?.();
}

/** No connection, tie or bend picked; the editor is told, where any was. */
function unpickConnections(drawn: Drawn): void {
  if (!drawn.picked.length && !drawn.selectedTie && !drawn.handle) return;
  drawn.picked = [];
  drawn.selectedTie = null;
  if (drawn.handle) drawn.options.onBendPicked?.(null);
  drawn.handle = null;
  drawConnections(drawn);
  drawn.options.onPicked?.([]);
}

/** The drawn node an event came from. */
function nodeOf(drawn: Drawn, target: EventTarget | null): GraphNode | undefined {
  const id = [...drawn.nodes].find(([, el]) => el === target)?.[0];
  return drawn.graph.nodes.find((n) => n.id === id);
}

/** Where a node stands now: its last reported move, else the place its graph gave it. */
function nowAt(drawn: Drawn, id: string): [number, number] | undefined {
  const kept = drawn.movedTo.get(id);
  if (kept) return kept;
  const [x, y] = (drawn.placedAt.get(id) ?? '').split(',').map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? [x!, y!] : undefined;
}

/** What a canvas has drawn, made the first time. */
function drawnFor(canvas: SherpaLayoutCanvas): Drawn {
  let drawn = drawnOn.get(canvas);
  if (drawn) return drawn;
  // The lines, under the nodes: one SVG at the plane's origin that draws past its box.
  const lines = document.createElementNS(SVG, 'svg');
  lines.setAttribute('class', 'graph-connectors');
  lines.setAttribute('width', '1');
  lines.setAttribute('height', '1');
  lines.setAttribute('aria-hidden', 'true');
  lines.setAttribute('style', '--x: 0px; --y: 0px; overflow: visible; pointer-events: none; fill: none;'
    + ' stroke: var(--sherpa-style-border-base, #b3b3c3); stroke-width: 2px');
  canvas.prepend(lines);
  const made: Drawn = {
    canvas, graph: { nodes: [], connections: [] }, options: {},
    nodes: new Map(), rows: new Map(), addresses: new WeakMap(), beside: new Map(), shapes: new Map(), placedAt: new Map(), movedTo: new Map(),
    lines, connections: [], ties: [], selectedTie: null, lanes: [], tying: false, draft: null, lifted: null, picked: [], handle: null, target: null, dragged: false, drags: 0, shadow: `graph-tie-shadow-${++shadows}`, fitted: false,
    frames: new Map(), selectedFrame: null, collapsed: new Set(), hideUnconnected: false, focusRow: null,
    // A node's height lands when its parts render: the lines follow, and the first fits the view.
    sizes: new ResizeObserver(() => {
      drawConnections(made);
      if (!made.fitted && made.nodes.size) { made.fitted = true; canvas.fit(); }
    }),
  };
  canvas.addEventListener('node-move', (event) => {
    const node = nodeOf(made, event.target);
    const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
    if (!node) return drawConnections(made);
    const group = pickedNodes(canvas);
    // A drag on a node outside the pick picks only it, as a click would.
    if (group.length && !group.includes(node.id) && made.options.onSelect) {
      markNode(canvas, node.id);
      made.options.onSelect(node);
    }
    const before = nowAt(made, node.id) ?? [x, y];
    made.movedTo.set(node.id, [x, y]);
    if (made.options.onMoveMany && group.length > 1 && group.includes(node.id) && !made.options.locked?.(node)) {
      const [dx, dy] = [x - before[0], y - before[1]];
      const moves = [{ id: node.id, x, y }];
      for (const id of group) {
        const el = made.nodes.get(id);
        const at = nowAt(made, id);
        const other = made.graph.nodes.find((n) => n.id === id);
        if (id === node.id || !el || !at || !other || made.options.locked?.(other)) continue;
        const to: [number, number] = [at[0] + dx, at[1] + dy];
        made.movedTo.set(id, to);
        el.setAttribute('data-x', String(to[0]));
        el.setAttribute('data-y', String(to[1]));
        moves.push({ id, x: to[0], y: to[1] });
      }
      drawConnections(made);
      made.options.onMoveMany(moves);
      return;
    }
    drawConnections(made);
    made.options.onMove?.(node, x, y);
  });
  // A double click on a node's header collapses or expands it, unless it opens (a Custom Node's use).
  canvas.addEventListener('dblclick', (event) => {
    const path = event.composedPath();
    const el = path.find((n): n is HTMLElement => n instanceof HTMLElement && n.localName === 'sherpa-node');
    const onHeader = path.some((n) => n instanceof Element && n.classList.contains('header'));
    const node = el && nodeOf(made, el);
    if (!node || !onHeader || made.options.opens?.(node)) return;
    if (path.some((n) => n instanceof Element && n.matches('input, select, textarea, button'))) return;
    toggleCollapsed(made, [node.id], !made.collapsed.has(node.id));
  });
  // With nodes picked and the canvas itself focused: Ctrl or Cmd and an arrow moves them, 8px (32 with Shift). TODO 752
  canvas.addEventListener('keydown', (event) => {
    const by = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[event.key];
    if (!by || !primaryKey(event) || event.altKey || event.target !== canvas) return;
    const ids = pickedNodes(canvas).filter((id) => {
      const node = made.graph.nodes.find((n) => n.id === id);
      return node && !made.options.locked?.(node);
    });
    if (!ids.length) return;
    const step = event.shiftKey ? 32 : 8;
    const moves = ids.flatMap((id) => {
      const at = nowAt(made, id);
      return at ? [{ id, x: at[0] + by[0] * step, y: at[1] + by[1] * step }] : [];
    });
    for (const m of moves) {
      made.movedTo.set(m.id, [m.x, m.y]);
      made.nodes.get(m.id)?.setAttribute('data-x', String(m.x));
      made.nodes.get(m.id)?.setAttribute('data-y', String(m.y));
    }
    drawConnections(made);
    const only = moves.length === 1 ? made.graph.nodes.find((n) => n.id === moves[0]!.id) : undefined;
    if (only) made.options.onMove?.(only, moves[0]!.x, moves[0]!.y);
    else made.options.onMoveMany?.(moves);
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true });
  canvas.addEventListener('node-resize', (event) => {
    drawConnections(made);
    const node = nodeOf(made, event.target);
    if (node) made.options.onResize?.(node, (event as CustomEvent<NodeSize>).detail);
  });
  // Before the node and the view hear it: a drag from an output socket is a new connection.
  canvas.addEventListener('pointerdown', (event) => connectFrom(canvas, made, event), { capture: true });
  // A tie is dragged; with the tool on, a line on the blank canvas ties the connections it crosses. TODO 562
  canvas.addEventListener('pointerdown', (down) => {
    const first = down.composedPath()[0];
    if (down.button !== 0 || !(first instanceof Element)) return;
    const id = first instanceof SVGElement && first.classList.contains('graph-tie') ? first.dataset['tie'] : undefined;
    if (id) dragTie(canvas, made, id, down);
    else if (first.classList.contains('graph-handle-grab')) dragHandle(canvas, made, first as SVGElement, down);
    else if (first.classList.contains('graph-hit')) dragLine(canvas, made, first, down);
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
  // A click on a connection picks it; Delete or Backspace breaks it. TODO 558
  lines.addEventListener('click', (event) => {
    const hit = event.target instanceof SVGElement && event.target.classList.contains('graph-hit') ? event.target : null;
    if (!hit || made.dragged) return;
    pickConnection(canvas, made, { from: hit.dataset['from']!, to: hit.dataset['to']! }, event.shiftKey);
  });
  // A picked bend point: Delete removes it, the arrows move it (8px, 32 with Shift), Escape lets go. With a
  // connector picked, B picks its first bend point, or its proposed middle dot, which the first arrow moves in;
  // on a tied connector, its first tie. TODO 744, 754
  canvas.addEventListener('keydown', (event) => {
    if (event.target !== canvas || event.ctrlKey || event.metaKey || event.altKey) return;
    const connection = made.handle?.connection ?? (event.code === 'KeyB' ? made.picked[0] : undefined);
    const held = connection && made.connections.find((r) => r.from === connection.from && r.to === connection.to);
    if (!connection || !held) return;
    const step = event.shiftKey ? 32 : 8;
    const by: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const pick = made.handle;
    const bend = pick && !pick.proposed ? held.via?.[pick.index] : undefined;
    const tie = made.ties.filter((t) => t.connections.some((r) => r.from === connection.from && r.to === connection.to)).sort((a, b) => tieX(made, a) - tieX(made, b))[0];
    if (event.code === 'KeyB' && tie) {
      made.picked = [];
      made.selectedTie = tie.id;
      pickHandle(canvas, made, null);
      made.options.onPicked?.([]);
    } else if (event.code === 'KeyB') pickHandle(canvas, made, held.via?.length ? { connection, index: 0 } : { connection, index: 0, proposed: true });
    else if (event.key === 'Escape' && pick) pickHandle(canvas, made, null);
    else if ((event.key === 'Delete' || event.key === 'Backspace') && pick) {
      if (bend) made.options.onUnbend?.(connection, pick.index);
      pickHandle(canvas, made, null);
    } else if (bend && by[event.key]) {
      made.options.onBend?.(connection, pick!.index, bend.x + by[event.key]![0], bend.y + by[event.key]![1], false, 0);
    } else if (pick?.proposed && by[event.key]) {
      // Moved by the reader: the proposed dot is a bend point now, from where it was drawn.
      const lane = made.lanes.find((l) => l.connection.from === connection.from && l.connection.to === connection.to);
      const [a, b] = [lane?.dots[0], lane?.dots.at(-1)];
      if (!a || !b) return;
      made.options.onBend?.(connection, pick.index, (a[0] + b[0]) / 2 + by[event.key]![0], (a[1] + b[1]) / 2 + by[event.key]![1], true, 0);
      pickHandle(canvas, made, { connection, index: pick.index });
    } else return;
    event.preventDefault();
    event.stopImmediatePropagation();
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
    const first = event.composedPath()[0];
    if (first instanceof Element && first.matches('input, select, textarea, [contenteditable]')) return;
    const remove = event.key === 'Delete' || event.key === 'Backspace';
    const ids = remove && made.options.onRemove ? currentOf(made.nodes) : [];
    if (event.target !== canvas && !ids.length) return;
    if (!made.picked.length && !ids.length) return;
    if (event.key === 'Escape') {
      deselect(canvas, made);
    } else if (remove) {
      const connections = made.picked;
      made.picked = [];
      if (ids.length) made.options.onRemove!(ids, connections);
      else if (connections.length > 1 && made.options.onBreakAll) made.options.onBreakAll(connections);
      else for (const connection of connections) made.options.onBreak?.(connection);
      drawConnections(made);
      made.options.onPicked?.([]);
    } else return;
    event.preventDefault();
  });
  // With no pointer: C picks the connections of the picked nodes — or of the node the keys are on; Shift+C adds
  // them to the pick, Alt+C takes them off it (TODO 735, 739).
  canvas.addEventListener('keydown', (event) => {
    const first = event.composedPath()[0];
    if (event.code !== 'KeyC' || event.ctrlKey || event.metaKey || (event.altKey && event.shiftKey)) return;
    if (first instanceof Element && first.matches('input, select, textarea, [contenteditable]')) return;
    const own = event.composedPath().find((n): n is HTMLElement => n instanceof HTMLElement && n.localName === 'sherpa-node');
    const held = [...made.nodes].filter(([, el]) => el.hasAttribute('data-current') || el === own).map(([id]) => id);
    const connections = made.connections.filter((r) => held.includes(socketOf(r.from).node) || held.includes(socketOf(r.to).node));
    if (!connections.length) return;
    const has = (r: NodeConnection): boolean => connections.some((x) => x.from === r.from && x.to === r.to);
    const mine = connections.map(({ from, to }) => ({ from, to }));
    made.picked = event.altKey ? made.picked.filter((r) => !has(r)) : event.shiftKey ? [...made.picked.filter((r) => !has(r)), ...mine] : mine;
    made.selectedTie = null;
    drawConnections(made);
    made.options.onPicked?.(made.picked);
    event.preventDefault();
    event.stopPropagation();
  });
  // A box dragged on the blank canvas: plain, the nodes it encloses or else the connections it crosses; Shift adds
  // both kinds; Ctrl takes both kinds off the pick. TODO 735, 739
  canvas.setAttribute('data-select-box', '');
  canvas.addEventListener('canvas-box', (event) => {
    const { mode, ...box } = (event as CustomEvent<PickBox & { mode: BoxMode }>).detail;
    const boxes = [...made.nodes].map(([id, el]) => [id, boxOf(el)] as const);
    const same = (a: NodeConnection, b: NodeConnection): boolean => a.from === b.from && a.to === b.to;
    let ids: Set<string>;
    let hit: { nodes: string[]; connections: NodeConnection[] };
    if (mode === 'replace') {
      hit = boxPick(box, boxes, made.lanes);
      ids = new Set(hit.nodes);
    } else {
      const cover = boxCover(box, boxes, made.lanes);
      const held = new Set(currentOf(made.nodes));
      if (mode === 'add') {
        ids = new Set([...held, ...cover.nodes]);
        hit = { nodes: [...ids], connections: [...made.picked, ...cover.connections.filter((r) => !made.picked.some((p) => same(p, r)))] };
      } else {
        ids = new Set([...held].filter((id) => !cover.nodes.includes(id)));
        hit = { nodes: [...ids], connections: made.picked.filter((p) => !cover.connections.some((r) => same(p, r))) };
      }
    }
    made.picked = hit.connections.map(({ from, to }) => ({ from, to }));
    made.selectedTie = null;
    markNodes(canvas, ids);
    drawConnections(made);
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
  // A FRAME: its header picks it; a drag or an arrow there moves every node in it as one move; Release lets them go. TODO 778
  const frameOf = (target: EventTarget | null): NodeFrame | undefined => {
    const id = [...made.frames].find(([, el]) => el === target)?.[0];
    return made.graph.frames?.find((f) => f.id === id);
  };
  canvas.addEventListener('frame-select', (event) => {
    const frame = frameOf(event.target);
    if (!frame) return;
    markFrame(canvas, frame.id);
    made.options.onFrameSelect?.(frame);
  });
  canvas.addEventListener('frame-move', (event) => {
    const frame = frameOf(event.target);
    const { dx, dy } = (event as CustomEvent<{ dx: number; dy: number }>).detail;
    if (!frame || !made.options.onRelease) return;
    const moves = frame.nodes.flatMap((id) => {
      const el = made.nodes.get(id);
      const node = made.graph.nodes.find((n) => n.id === id);
      const at = nowAt(made, id);
      return el && node && at && !made.options.locked?.(node) ? [{ id, x: at[0] + dx, y: at[1] + dy, el, node }] : [];
    });
    for (const m of moves) {
      made.movedTo.set(m.id, [m.x, m.y]);
      m.el.setAttribute('data-x', String(m.x));
      m.el.setAttribute('data-y', String(m.y));
    }
    drawConnections(made);
    if (moves.length === 1) made.options.onMove?.(moves[0]!.node, moves[0]!.x, moves[0]!.y);
    else if (moves.length) made.options.onMoveMany?.(moves.map(({ id, x, y }) => ({ id, x, y })));
  });
  canvas.addEventListener('frame-release', (event) => {
    const frame = frameOf(event.target);
    if (frame) made.options.onRelease?.(frame.id);
  });
  // A row's field in focus: the nodes joined to that row wear the active border, until it goes. TODO 889
  canvas.addEventListener('focusin', (event) => {
    const row = event.composedPath().find((el): el is HTMLElement => el instanceof HTMLElement && made.addresses.has(el));
    const at = row ? made.addresses.get(row)! : null;
    made.focusRow = at ? `${at[0]}/${at[1]}` : null;
    markJoined(made);
  });
  canvas.addEventListener('focusout', () => {
    made.focusRow = null;
    markJoined(made);
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
 *  moved — else where the reader left it; then its connections. */
export function drawGraph(canvas: SherpaLayoutCanvas, graph: FramedGraph, options: DrawOptions = {}): void {
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
    drawn.movedTo.delete(id);
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
      drawn.movedTo.delete(node.id);
      el.setAttribute('data-x', String(node.x));
      el.setAttribute('data-y', String(node.y));
    }
    el.setAttribute('data-heading', node.heading);
    // A title of its own is drawn after its kind's name. TRAP T-a-custom-title-follows-its-kind
    put(el, 'data-kind', node.kindHeading);
    put(el, 'data-icon', node.icon);
    put(el, 'data-description', node.description);
    el.toggleAttribute('data-locked', !!options.locked?.(node));
    // A run's caption wins; else the host's note.
    if (!el.hasAttribute('data-step')) put(el, 'data-caption', options.notes?.get(node.id));
    // What reached it that it cannot use: the warning look, and its words in the header's tip. TRAP T-a-node-reads-null-from-what-it-cannot-use
    put(el, 'data-warning', node.warnings?.map((w) => w.words).join('\n'));
    // Its data in, of any type; out, its True where it forks.
    put(el, 'data-input-socket', socketType(node, undefined, 'input'));
    put(el, 'data-output-socket', socketType(node, undefined, 'output'));
    el.toggleAttribute('data-input-many', !!node.many);
    // A portal's look is its side's: In blue, Out orange (Will, TODO 907).
    const portal = portalOf(node);
    put(el, 'data-category', portal ? `portal-${portal.side}` : categorySlug(node.category));
    put(el, 'data-scale-w', node.size ? String(node.size.w) : undefined);
    put(el, 'data-scale-h', node.size ? String(node.size.h) : undefined);
    el.toggleAttribute('data-input-connected', graph.connections.some((r) => r.to === node.id));
    el.toggleAttribute('data-output-connected', graph.connections.some((r) => r.from === node.id));
    el.toggleAttribute('data-collapsed', drawn.collapsed.has(node.id));
    // What its first field holds, in words: a collapsed node's name ends with it.
    const first = node.rows.find((r) => r.control && !r.beside);
    const words = first ? valueWords(first) : '';
    put(el, 'data-summary', words && words.charAt(0).toUpperCase() + words.slice(1));
    el.toggleAttribute('data-hide-unconnected', drawn.hideUnconnected);
    drawRows(drawn, el, node);
    stackPlaces(el, drawn.collapsed.has(node.id));
  }
  // Frames: behind the lines and the nodes, each round its nodes. TODO 778
  const frames = graph.frames ?? [];
  for (const [id, el] of drawn.frames) {
    if (frames.some((f) => f.id === id)) continue;
    el.remove();
    drawn.frames.delete(id);
  }
  if (drawn.selectedFrame && !drawn.frames.has(drawn.selectedFrame)) drawn.selectedFrame = null;
  for (const frame of frames) {
    let el = drawn.frames.get(frame.id);
    if (!el) {
      el = document.createElement('sherpa-node-frame');
      drawn.frames.set(frame.id, el);
      canvas.insertBefore(el, drawn.lines);
    }
    put(el, 'data-heading', frame.label);
    put(el, 'data-description', frame.description);
    el.toggleAttribute('data-current', drawn.selectedFrame === frame.id);
    el.toggleAttribute('data-locked', !options.onRelease);
  }
  placeFrames(drawn);
  drawn.connections = graph.connections;
  drawn.ties = graph.ties ?? [];
  drawn.tying = !!options.tying;
  if (drawn.selectedTie && !drawn.ties.some((t) => t.id === drawn.selectedTie)) drawn.selectedTie = null;
  const held = drawn.handle && graph.connections.find((r) => r.from === drawn.handle!.connection.from && r.to === drawn.handle!.connection.to);
  const tied = !!held && drawn.ties.some((t) => t.connections.some((r) => r.from === held.from && r.to === held.to));
  if (drawn.handle && (tied || !(drawn.handle.proposed ? held && !held.via?.length : held?.via?.[drawn.handle.index]))) drawn.handle = null;
  const left = drawn.picked.filter((p) => graph.connections.some((r) => r.from === p.from && r.to === p.to));
  if (left.length !== drawn.picked.length) {
    drawn.picked = left;
    options.onPicked?.(left);
  }
  linkPortals(drawn);
  requestAnimationFrame(() => drawConnections(drawn));
}

/** Each portal of a picked portal's name, lit as picked is (`data-linked`): In and Out alike. TODO 779 */
function linkPortals(drawn: Drawn | undefined): void {
  if (!drawn) return;
  const picked = currentOf(drawn.nodes);
  const lit = new Set(picked.flatMap((id) => portalLinks(drawn.graph.nodes, id)));
  for (const [id, el] of drawn.nodes) el.toggleAttribute('data-linked', lit.has(id) && !picked.includes(id));
  markJoined(drawn);
}

/**
 * The ACTIVE border on what is joined to the pick (`data-joined`): every node downstream of a picked node, each node a
 * picked connection joins, and each node joined to the row whose field has focus (its output drawn on another row's, too). A
 * picked node wears the picked look instead. Will, TODO 889
 */
function markJoined(drawn: Drawn | undefined): void {
  if (!drawn) return;
  const picked = new Set(currentOf(drawn.nodes));
  const joined = downstreamOf(drawn.connections, picked);
  for (const connection of drawn.picked) for (const end of [connection.from, connection.to]) joined.add(socketOf(end).node);
  const focus = drawn.focusRow;
  if (focus) {
    const rows = new Set([focus, ...[...drawn.beside].flatMap(([row, wears]) => (wears === focus ? [row] : []))]);
    for (const connection of drawn.connections) {
      if (rows.has(connection.to)) joined.add(socketOf(connection.from).node);
      if (rows.has(connection.from)) joined.add(socketOf(connection.to).node);
    }
  }
  for (const [id, el] of drawn.nodes) {
    const on = joined.has(id) && !picked.has(id);
    if (el.hasAttribute('data-joined') !== on) el.toggleAttribute('data-joined', on);
  }
}

/** Mark one node as the one picked, or none. */
export function markNode(canvas: SherpaLayoutCanvas, id: string | null): void {
  for (const [key, el] of drawnOn.get(canvas)?.nodes ?? []) {
    el.toggleAttribute('data-current', key === id);
    el.removeAttribute('data-active');
  }
  unpickFrame(drawnOn.get(canvas));
  linkPortals(drawnOn.get(canvas));
}

/** No frame is picked. */
function unpickFrame(drawn: Drawn | undefined): void {
  if (!drawn?.selectedFrame) return;
  drawn.selectedFrame = null;
  for (const el of drawn.frames.values()) el.removeAttribute('data-current');
}

/** Mark one frame as the one picked, or none: no node, connection or tie is picked with it. TODO 778 */
export function markFrame(canvas: SherpaLayoutCanvas, id: string | null): void {
  const drawn = drawnOn.get(canvas);
  if (!drawn) return;
  if (id) {
    markNode(canvas, null);
    unpickConnections(drawn);
  }
  drawn.selectedFrame = id && drawn.frames.has(id) ? id : null;
  for (const [key, el] of drawn.frames) el.toggleAttribute('data-current', key === drawn.selectedFrame);
}

/** The frame picked, by id, or none. */
export function pickedFrame(canvas: SherpaLayoutCanvas): string | null {
  return drawnOn.get(canvas)?.selectedFrame ?? null;
}

/** The nodes picked, by id: a click, a box, or the keys. */
export function pickedNodes(canvas: SherpaLayoutCanvas): string[] {
  return currentOf(drawnOn.get(canvas)?.nodes ?? new Map());
}

/** The ids of the nodes marked picked. */
function currentOf(nodes: ReadonlyMap<string, HTMLElement>): string[] {
  return [...nodes].filter(([, el]) => el.hasAttribute('data-current')).map(([id]) => id);
}

/** The gaps of an arrangement: one spacing token, read from the canvas, three times over (Will, TODO 756). The fallback mirrors the token's value. */
const ARRANGE_GAP = '--sherpa-display-mode-space-5xl';
const ARRANGE_GAP_STEPS = 3;
const ARRANGE_GAP_FALLBACK = 56;

/** What a layout reads off a drawing: Arrange's gap, each node's place and drawn box. */
function laidAs(canvas: SherpaLayoutCanvas, drawn: Drawn): { gap: number; nodes: { id: string; x: number; y: number }[]; boxes: Record<string, { w: number; h: number }> } {
  return {
    gap: ARRANGE_GAP_STEPS * (parseFloat(getComputedStyle(canvas).getPropertyValue(ARRANGE_GAP)) || ARRANGE_GAP_FALLBACK),
    nodes: [...drawn.nodes].map(([id, el]) => ({ id, x: Number(el.getAttribute('data-x')) || 0, y: Number(el.getAttribute('data-y')) || 0 })),
    boxes: Object.fromEntries([...drawn.nodes].map(([id, el]) => [id, { w: el.offsetWidth, h: el.offsetHeight }])),
  };
}

/** Where these nodes go, from the boxes they are drawn in: on a grid. None, fewer than two. */
export function arrangement(canvas: SherpaLayoutCanvas, picked: readonly string[]): Arranged | undefined {
  const drawn = drawnOn.get(canvas);
  const ids = picked.filter((id) => !id.startsWith('#'));
  if (!drawn || ids.length < 2) return undefined;
  const { gap, nodes, boxes } = laidAs(canvas, drawn);
  const placed = arrangeNodes({ nodes, connections: drawn.connections, ties: drawn.ties }, ids, { gapX: gap, gapY: gap, boxes });
  return Object.keys(placed.nodes).length ? placed : undefined;
}

/** Each node where a layout puts it, and the places to the host: one move. */
function handOn(drawn: Drawn, placed: Arranged): Arranged {
  for (const [id, at] of Object.entries(placed.nodes)) {
    const el = drawn.nodes.get(id);
    if (!el || el.hasAttribute('data-locked')) continue;
    drawn.movedTo.set(id, [at.x, at.y]);
    el.setAttribute('data-x', String(at.x));
    el.setAttribute('data-y', String(at.y));
  }
  drawn.options.onArrange!(placed);
  return placed;
}

/** Lay the picked nodes out on a grid, from the boxes they are drawn in, and hand the host the places. */
export function arrangePicked(canvas: SherpaLayoutCanvas): Arranged | undefined {
  const drawn = drawnOn.get(canvas);
  const placed = drawn?.options.onArrange ? arrangement(canvas, pickedNodes(canvas)) : undefined;
  // Each moves there, not jumps. TODO 902
  if (placed) canvas.easePieces();
  return drawn && placed ? handOn(drawn, placed) : undefined;
}

/** Where every node goes when the graph is unfurled, from the boxes and frames drawn: none locked moves. None, fewer than two.
 *  TODO 569 · TRAP T-unfurl-keeps-the-flow */
export function unfurlment(canvas: SherpaLayoutCanvas): Arranged | undefined {
  const drawn = drawnOn.get(canvas);
  const ids = [...(drawn?.nodes ?? [])].filter(([id, el]) => !id.startsWith('#') && !el.hasAttribute('data-locked')).map(([id]) => id);
  if (!drawn || ids.length < 2) return undefined;
  const { gap, nodes, boxes } = laidAs(canvas, drawn);
  // A frame's box past its nodes', read off one drawn: its pad each side, and its header and pad above.
  const frame = [...drawn.frames.values()].find((el) => !el.hasAttribute('hidden') && el.offsetWidth);
  const side = frame ? Math.max(0, (frame.offsetWidth - Number(frame.getAttribute('data-w'))) / 2) : 0;
  const top = frame ? Math.max(0, frame.offsetHeight - Number(frame.getAttribute('data-h')) - side) : 0;
  // Each connected socket's height in its node, as drawn: a node's neighbours stand in its sockets' order. TODO 827
  const sockets: { inputs: Record<string, number>; outputs: Record<string, number> } = { inputs: {}, outputs: {} };
  for (const connection of drawn.connections) {
    for (const [address, side, into] of [[connection.from, 'output', sockets.outputs], [connection.to, 'input', sockets.inputs]] as const) {
      const [at, el] = [socketPoint(drawn, address, side), drawn.nodes.get(socketOf(address).node)];
      if (at && el) into[address] = at[1] - (Number(el.getAttribute('data-y')) || 0);
    }
  }
  // A graph reads left to right: Sources and Portal Ins stand left, Outputs and Portal Outs right; an In hands on to each Out of
  // its name with no line, and the hop holds the order a connection would. TODO 839
  const bands: Record<string, 'left' | 'right'> = {};
  const hops: { from: string; to: string }[] = [];
  const portals = drawn.graph.nodes.flatMap((n) => { const p = portalOf(n); return p ? [{ id: n.id, ...p }] : []; });
  for (const n of drawn.graph.nodes) if (n.kind === 'source') bands[n.id] = 'left'; else if (n.kind === 'output') bands[n.id] = 'right';
  for (const p of portals) {
    bands[p.id] = p.side === 'in' ? 'left' : 'right';
    if (p.side === 'in' && p.name) for (const o of portals) if (o.side === 'out' && o.name === p.name) hops.push({ from: p.id, to: o.id });
  }
  const placed = unfurlNodes({ nodes, connections: drawn.connections, ties: drawn.ties, frames: drawn.graph.frames ?? [], hops, bands }, ids, { gapX: gap, gapY: gap, boxes, frameMargin: { top, side }, sockets });
  return Object.keys(placed.nodes).length ? placed : undefined;
}

/** Unfurl the whole graph and hand the host the places, ties and bends with them: one step. The view fits it after. TODO 569 */
export function unfurlGraph(canvas: SherpaLayoutCanvas): Arranged | undefined {
  const drawn = drawnOn.get(canvas);
  const placed = drawn?.options.onArrange ? unfurlment(canvas) : undefined;
  if (!drawn || !placed) return undefined;
  // Each node moves there, and the view eases round them all. TODO 902
  canvas.easePieces();
  handOn(drawn, placed);
  requestAnimationFrame(() => requestAnimationFrame(() => canvas.fit(undefined, { ease: true })));
  return placed;
}

/** Say in `data-can-arrange`, and each flag given, whether two or more nodes are picked; stop lets go. */
export function watchArrange(
  canvas: SherpaLayoutCanvas, toolbar: HTMLElement | null | undefined, allowed: () => boolean = () => true, flags: readonly string[] = ['data-can-arrange'],
): (() => void) & { tell(): void } {
  if (!toolbar) return Object.assign(() => undefined, { tell: () => undefined });
  const tell = (): void => {
    const can = pickedNodes(canvas).filter((id) => !id.startsWith('#')).length > 1 && allowed();
    for (const flag of flags) toolbar.toggleAttribute(flag, can);
  };
  const watch = new MutationObserver(tell);
  watch.observe(canvas, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-current'] });
  tell();
  return Object.assign(() => { watch.disconnect(); for (const flag of flags) toolbar.removeAttribute(flag); }, { tell });
}

/** Zoom to the picked nodes, centred; with none picked, or `all`, to the whole graph. Eased, as a reader's step. TODO 905 */
export function zoomToPicked(canvas: SherpaLayoutCanvas, all = false): void {
  const els = drawnOn.get(canvas)?.nodes;
  const picked = all ? [] : pickedNodes(canvas).flatMap((id) => els?.get(id) ?? []);
  canvas.fit(picked, { ease: true });
}

/** A toolbar's view toggles, kept by the canvas: Collapse all (pressed while every node is) and Hide unconnected
 *  (on while a node is collapsed). The toolbar's presses are heard here. Returns the stop. */
export function watchView(canvas: SherpaLayoutCanvas, toolbar: HTMLElement | null | undefined): () => void {
  if (!toolbar) return () => undefined;
  const tell = (): void => {
    const nodes = drawnOn.get(canvas)?.nodes.size ?? 0;
    const shut = collapsedNodes(canvas).length;
    toolbar.toggleAttribute('data-can-collapse', nodes > 0);
    toolbar.toggleAttribute('data-collapsed', nodes > 0 && shut === nodes);
    toolbar.toggleAttribute('data-can-hide', shut > 0);
    toolbar.toggleAttribute('data-hide-unconnected', !!drawnOn.get(canvas)?.hideUnconnected);
    toolbar.toggleAttribute('data-can-zoom-fit', nodes > 0);
    toolbar.toggleAttribute('data-can-zoom-picked', pickedNodes(canvas).length > 0);
  };
  const onTool = (event: Event): void => {
    const action = (event as CustomEvent<{ action?: string }>).detail?.action;
    if (action === 'collapse') collapseNodes(canvas, 'all', !toolbar.hasAttribute('data-collapsed'));
    else if (action === 'hide') hideUnconnected(canvas, !drawnOn.get(canvas)?.hideUnconnected);
    else if (action === 'zoom-picked' || action === 'zoom-fit') zoomToPicked(canvas, action === 'zoom-fit');
    else return;
    tell();
  };
  const watch = new MutationObserver(tell);
  watch.observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-collapsed', 'data-current'] });
  toolbar.addEventListener('toolbar-select', onTool);
  tell();
  return () => {
    watch.disconnect();
    toolbar.removeEventListener('toolbar-select', onTool);
    for (const flag of ['data-can-collapse', 'data-collapsed', 'data-can-hide', 'data-hide-unconnected', 'data-can-zoom-picked', 'data-can-zoom-fit']) toolbar.removeAttribute(flag);
  };
}

/** Mark several nodes as the ones picked. */
export function markNodes(canvas: SherpaLayoutCanvas, ids: ReadonlySet<string>): void {
  for (const [key, el] of drawnOn.get(canvas)?.nodes ?? []) el.toggleAttribute('data-current', ids.has(key));
  if (ids.size) unpickFrame(drawnOn.get(canvas));
  linkPortals(drawnOn.get(canvas));
}

/** Collapse or expand nodes, and tell the host. */
function toggleCollapsed(drawn: Drawn, ids: readonly string[], on: boolean): void {
  for (const id of ids) {
    if (on) drawn.collapsed.add(id);
    else drawn.collapsed.delete(id);
    const el = drawn.nodes.get(id);
    el?.toggleAttribute('data-collapsed', on);
    if (el) stackPlaces(el, on);
  }
  drawConnections(drawn);
  drawn.options.onCollapse?.();
}

/** Collapse these nodes, or expand them; `'all'`, every node drawn. A collapsed node shows only its sockets. */
export function collapseNodes(canvas: SherpaLayoutCanvas, ids: readonly string[] | 'all', on: boolean): void {
  const drawn = drawnOn.get(canvas);
  if (drawn) toggleCollapsed(drawn, ids === 'all' ? [...drawn.nodes.keys()] : ids, on);
}

/** The nodes drawn collapsed. */
export function collapsedNodes(canvas: SherpaLayoutCanvas): string[] {
  const drawn = drawnOn.get(canvas);
  return drawn ? [...drawn.collapsed].filter((id) => drawn.nodes.has(id)) : [];
}

/** Whether a collapsed node hides the sockets no connection joins; a hover, or a line dragged, shows them. */
export function hideUnconnected(canvas: SherpaLayoutCanvas, on: boolean): void {
  const drawn = drawnOn.get(canvas);
  if (!drawn) return;
  drawn.hideUnconnected = on;
  for (const el of drawn.nodes.values()) el.toggleAttribute('data-hide-unconnected', on);
}

/** Mark the one of the picked nodes whose panel is shown: a stronger ring than the others'. */
export function markActive(canvas: SherpaLayoutCanvas, id: string | null): void {
  for (const [key, el] of drawnOn.get(canvas)?.nodes ?? []) el.toggleAttribute('data-active', key === id);
}

/** Mark connections as the ones picked. */
export function markConnections(canvas: SherpaLayoutCanvas, connections: readonly NodeConnection[]): void {
  const drawn = drawnOn.get(canvas);
  if (!drawn) return;
  drawn.picked = connections.map(({ from, to }) => ({ from, to }));
  drawConnections(drawn);
  drawn.options.onPicked?.(drawn.picked);
}

/** The connections picked: by a click, a box, or the keys. */
export function pickedConnections(canvas: SherpaLayoutCanvas): NodeConnection[] {
  return [...(drawnOn.get(canvas)?.picked ?? [])];
}

/** Put the keyboard on one drawn node's header, or a frame's, once it is drawn. */
function focusNode(canvas: SherpaLayoutCanvas, id: string, frame = false): void {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = drawnOn.get(canvas)?.[frame ? 'frames' : 'nodes'].get(id);
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

/** What the last copy took, shared by every graph in the tab: a paste goes into any of them. */
let clipboard: NodeClip | null = null;

const MS = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'millisecond', unitDisplay: 'short', maximumFractionDigits: 1 });
const COUNT = new Intl.NumberFormat();

/** How a span stands: begun, or how it ended — a failure said, or its own word. */
function stateOf(span: Span): StepState {
  if (span.ms === undefined) return 'start';
  const said = span.detail?.['state'];
  if (said === 'failed' || said === 'skipped') return said;
  return span.detail && 'failed' in span.detail ? 'failed' : 'done';
}

/** A node's step, from every span that lit it this run, in the order each last spoke: running while one is open, else
 *  failed, skipped or done; the time and rows the latest said, and where each ran. The Source's load ends after its
 *  store's reads, so it says the page's rows (TODO 808). */
function light(el: HTMLElement, spans: ReadonlyMap<string, Lit>): void {
  const all = [...spans.values()];
  const state = all.some((s) => s.state === 'start') ? 'running'
    : all.some((s) => s.state === 'failed') ? 'failed'
    : all.every((s) => s.state === 'skipped') ? 'skipped' : 'done';
  const ms = all.findLast((s) => s.ms !== undefined)?.ms ?? 0;
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
    // Last to speak, last in the list: a span that ends moves after those that ended before it.
    spans.delete(span.id);
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
  /** A reader asks a Value node for an unconnected picklist row: the button that is the drag, with no pointer. */
  onCustom?: (row: GraphRow) => void;
  /** A reader cuts one connection, by the button that is the drag's break. */
  onCut?: (connection: NodeConnection) => void;
  /** A reader removes this node. */
  onRemove?: () => void;
  /** What a Custom Node adds above the rows: its update, its Open and Ungroup. */
  extra?: readonly HTMLElement[];
  /** Several nodes are picked: a tab each, the shown one current; a reader's tab is `onTab`, which changes no pick. */
  tabs?: { nodes: readonly { id: string; label: string }[]; current: string; onTab: (id: string) => void; heading: string };
  /** How the Outgoing JSON reads a use's condition: the graph inside it, drawn. TODO 776 */
  flow?: ConditionFacts;
  /** What the node heard and said in the last simulation: its rows per socket. TODO 836 */
  data?: { node: SimulatedNode; stale: boolean };
  /** An Output's: the values its messages can name, their samples, and Send a test. Plan 891 */
  output?: OutputFacts;
}

/** What an inspector holds: its node, the fields by their element, and whom it tells. */
interface Inspecting {
  node: GraphNode;
  fields: WeakMap<Element, GraphRow>;
  options: InspectOptions;
}

const inspecting = new WeakMap<HTMLElement, Inspecting>();

const contentTab = new WeakMap<HTMLElement, string>();

/** A node's body: Details, and an Output, a JSON and a Data tab when it has them. The reader's tab is kept per inspector. */
function contentTabs(panel: HTMLElement, details: HTMLElement, json?: HTMLElement, data?: HTMLElement, output?: HTMLElement): HTMLElement {
  if (!json && !data && !output) return details;
  const pages = [{ id: 'details', label: 'Details', el: details }, ...(output ? [{ id: 'output', label: 'Output', el: output }] : []), ...(json ? [{ id: 'json', label: 'JSON', el: json }] : []), ...(data ? [{ id: 'data', label: 'Data', el: data }] : [])];
  const asked = contentTab.get(panel);
  const current = pages.some((p) => p.id === asked) ? asked! : 'details';
  const strip = document.createElement('sherpa-tabs') as HTMLElement & { populate(items: unknown): void };
  strip.setAttribute('data-current-id', current);
  strip.className = 'content-tabs';
  strip.style.cssText = 'block-size: 100%; min-block-size: 0';
  for (const p of pages) {
    const page = document.createElement('div');
    page.dataset['tab'] = p.id;
    page.style.cssText = 'block-size: 100%';
    if (p.el === details) page.append(p.el);
    else {
      const run = document.createElement('sherpa-stack');
      run.setAttribute('data-scroll', '');
      run.append(p.el);
      page.append(run);
    }
    strip.append(page);
  }
  strip.populate(pages.map((p) => ({ id: p.id, label: p.label })));
  strip.addEventListener('tab-select', (event) => {
    event.stopPropagation();
    contentTab.set(panel, (event as CustomEvent<{ id: string }>).detail.id);
  });
  return strip;
}

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
    const part = row ? from?.rows.find((r) => r.name === row)?.label : undefined;
    return [from?.heading ?? id, part].filter(Boolean).join(' › ');
  };
  // The inputs a connection drives: their fields mirror what comes in, read only.
  const connected = connectionsOf(graph).connected;
  const fields = new WeakMap<Element, GraphRow>();
  const button = (label: string, act: () => void, tip?: string): HTMLElement => {
    const el = document.createElement('sherpa-button');
    el.setAttribute('data-label', label);
    if (tip) el.setAttribute('data-description', tip);
    el.setAttribute('data-size', 'sm');
    el.addEventListener('button-click', act);
    return el;
  };
  const items = node.rows.flatMap((row) => {
    const at = `${node.id}/${row.name}`;
    const ins = graph.connections.filter((r) => r.to === at);
    const outs = graph.connections.filter((r) => r.from === at).map((r) => `To ${name(r.to)}`);
    const field = fieldFor(row.control ? row : { ...row, control: 'text' }, !row.editable || connected.has(at) || !row.control);
    // A custom row says where it comes from once, in its own words.
    fill(field, row, [...(row.custom ? [] : ins.map((r) => `From ${name(r.from)}`)), ...outs, row.hint].filter(Boolean).join(' · ') || undefined);
    fields.set(field, row);
    const cuts = options.onCut ? ins.map((r) => button(`Cut connection from ${name(r.from)}`, () => options.onCut!(r))) : [];
    const custom = options.onCustom && row.editable && !ins.length && row.input === 'value' && !row.many && rowChoices(row) !== undefined
      ? [button('Custom value', () => options.onCustom!(row))] : [];
    // A message takes the values its connections give, by Insert value (plan 891).
    const insert = options.output && row.control === 'message' && row.editable && !connected.has(at) ? [valueMenu(field, row.label, options.output)] : [];
    return [field, ...insert, ...cuts, ...custom];
  });
  // The whole node's connections: in, and out — its True and False where it forks.
  const header = document.createElement('sherpa-key-value-list');
  header.setAttribute('data-orientation', 'vertical');
  const whole = [
    ...graph.connections.filter((r) => r.to === node.id).map((r) => ({ key: 'In', value: name(r.from) })),
    ...graph.connections.filter((r) => r.from === node.id).map((r) => ({ key: 'Out', value: name(r.to) })),
  ];
  const stack = document.createElement('sherpa-stack');
  stack.setAttribute('data-gap', 'lg');
  // A node of many rows scrolls, in the panel or in its tab: a run that fits by shrinking lays its fields over its buttons.
  stack.setAttribute('data-scroll', '');
  const remove = options.onRemove ? [button('Remove node', options.onRemove)] : [];
  const flow = nodeFlow(graph, node.id, options.flow);
  const test = options.output ? testButton(options.output) : undefined;
  stack.append(...(options.extra ?? []), ...(options.visual ? [options.visual] : []), ...(whole.length ? [header] : []), ...items, ...(test ? [test] : []), ...remove);
  const connectedTo = (row: string): string[] => graph.connections.filter((r) => r.from === `${node.id}/${row}`).map((r) => name(r.to));
  const output = options.output ? outputPane(node, options.output, connectedTo) : undefined;
  const body = contentTabs(panel, stack, 'fault' in flow ? undefined : flowPane(flow), options.data ? dataPane(options.data) : undefined, output);
  const { tabs } = options;
  if (tabs) {
    const strip = document.createElement('sherpa-tabs') as HTMLElement & { populate(items: unknown): void };
    const page = document.createElement('div');
    page.dataset['tab'] = tabs.current;
    page.append(body);
    strip.setAttribute('data-current-id', tabs.current);
    strip.append(page);
    strip.populate(tabs.nodes.map((t) => ({ id: t.id, label: t.label })));
    strip.addEventListener('tab-select', (event) => {
      event.stopPropagation();
      tabs.onTab((event as CustomEvent<{ id: string }>).detail.id);
      // The strip is rebuilt for the node now shown: the reader stays on their tab.
      requestAnimationFrame(() => panel.querySelector('sherpa-tabs')?.shadowRoot?.querySelector<HTMLElement>('.tab[data-current]')?.focus());
    });
    panel.replaceChildren(strip);
  } else panel.replaceChildren(body);
  if (whole.length) (header as HTMLElement & { populate(items: unknown): void }).populate(whole);
  panel.setAttribute('data-heading', tabs?.heading ?? nodeTitle(node.kindHeading ?? node.heading, node.heading));
  put(panel, 'data-icon', node.icon);
  inspecting.set(panel, { node, fields, options });
}

/** The inspector with nothing picked: its empty state, in place of a node. */
export function inspectNone(panel: HTMLElement): void {
  inspecting.delete(panel);
  const note = document.createElement('sherpa-empty-state');
  note.setAttribute('data-size', 'sm');
  note.setAttribute('data-heading', 'No node selected');
  note.setAttribute('data-description', 'Pick a node on the canvas to see its details.');
  panel.replaceChildren(note);
  panel.setAttribute('data-heading', 'Details');
  panel.removeAttribute('data-icon');
}

/** The editor's inspector is always there: a tab to begin with, and its empty state until a node is picked. */
function keepOpen(inspector: Inspector | undefined): void {
  if (!inspector) return;
  const open = (): void => {
    if (inspector.open) return;
    // A tab to begin with, unless the app has put the reader's own state back (`data-state-restored`).
    if (!inspector.hasAttribute('data-mode') && !inspector.hasAttribute('data-state-restored')) inspector.setAttribute('data-mode', 'tab');
    inspectNone(inspector);
    inspector.show();
  };
  open();
  // A graph that replaces another shuts the old one's panel as the new one opens: open it again once that is done.
  queueMicrotask(open);
}

/** What a frame's inspector edits, and whom it tells: none, it is read only. */
interface FrameInspect {
  onEdit?: (set: { label?: string; description?: string }) => void;
  onRelease?: () => void;
}

/** Fill an overlay panel with one frame: its name and line, the nodes it holds, and Release. Shown already, its
 *  fields take the new values in place, so a reader moving between them keeps the keyboard. TODO 778 */
function inspectFrame(panel: HTMLElement, frame: NodeFrame, graph: DrawnGraph, { onEdit, onRelease }: FrameInspect = {}): void {
  const names = frame.nodes.map((id) => graph.nodes.find((n) => n.id === id)?.heading ?? id).join(', ');
  const held = [...panel.children].find((el): el is HTMLElement => el instanceof HTMLElement && el.dataset['frame'] === frame.id);
  const stack = held ?? document.createElement('sherpa-stack');
  if (!held) {
    stack.dataset['frame'] = frame.id;
    stack.setAttribute('data-gap', 'lg');
    const field = (name: 'label' | 'description', label: string): Field => {
      const el = document.createElement('sherpa-input-text') as Field;
      el.setAttribute('name', name);
      el.setAttribute('data-label', label);
      if (!onEdit) lock(el, true);
      el.addEventListener('change', () => onEdit?.({ [name]: String(el.value ?? '') }));
      return el;
    };
    const list = document.createElement('sherpa-key-value-list');
    list.setAttribute('data-orientation', 'vertical');
    const release = document.createElement('sherpa-button');
    release.setAttribute('data-label', 'Release frame');
    release.setAttribute('data-description', 'The frame goes; its nodes stay where they are. Keyboard: Delete or Backspace on its header.');
    release.setAttribute('data-size', 'sm');
    release.addEventListener('button-click', () => onRelease?.());
    stack.append(field('label', 'Name'), field('description', 'Description'), list, ...(onRelease ? [release] : []));
    panel.replaceChildren(stack);
  }
  let typing: Element | null = document.activeElement;
  while (typing?.shadowRoot?.activeElement) typing = typing.shadowRoot.activeElement;
  for (const el of stack.querySelectorAll<Field>('sherpa-input-text')) {
    const value = frame[el.getAttribute('name') as 'label' | 'description'] ?? '';
    if (el.value !== value && !el.contains(typing) && !el.shadowRoot?.contains(typing)) el.value = value;
  }
  void customElements.whenDefined('sherpa-key-value-list').then(() => {
    (stack.querySelector('sherpa-key-value-list') as (HTMLElement & { populate(items: unknown): void }) | null)?.populate([{ key: 'Nodes', value: names }]);
  });
  panel.setAttribute('data-heading', frame.label ?? 'Frame');
  panel.setAttribute('data-icon', 'frame');
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
  /** Fetch: read each Source on a path once, at the cap, and simulate; run again, it reads again. A second press while one
   *  runs is blocked. Settles when its task ends. The press of the toolbar's Fetch, for a host or an agent. TODO 836, 843 */
  fetch(): Promise<void>;
  /** Simulate: run the graph on the rows cached, and show each node's data. Never on an edit; blocked while one runs. */
  simulate(): Promise<void>;
  /** The last simulation, and whether an edit has changed the graph since. */
  simulation(): { result: Simulated; stale: boolean } | undefined;
  /** The open entity's own tags as the draft holds them, for the app's Save to write; none without an entity. TODO 828 */
  tags(): readonly string[] | undefined;
}

/** Tell the app a definition to keep. */
export function handOver(canvas: HTMLElement, definition: PageDefinition | WorkflowDefinition): void {
  canvas.dispatchEvent(new CustomEvent('definition-save', { detail: { definition }, bubbles: true, composed: true }));
}

/** The node a canvas's inspector shows: picked, followed on each draw, and let go. */
interface Picked {
  select(node: GraphNode, graph: DrawnGraph): void;
  /** Picked by a box, or added: the panel opens for none; open, it shows this one. TODO 756 */
  peek(node: GraphNode, graph: DrawnGraph): void;
  follow(graph: DrawnGraph): void;
  /** A click on blank canvas: none picked, and the panel says so. */
  deselect(): void;
  /** None picked, and the panel left as it is: something else fills it (a frame). */
  clear(): void;
  stop(): void;
}

/** A canvas's picked node in its inspector: opened on a pick, followed on each draw, let go as it shuts. */
function pickedIn(
  canvas: SherpaLayoutCanvas, inspector: Inspector | undefined, show: (node: GraphNode, graph: DrawnGraph) => void, onClose?: () => void,
  /** Delete or Backspace with the keys in the inspector, and not in a text field. */
  onDelete?: () => void,
): Picked {
  let picked: string | null = null;
  const close = (event: Event): void => {
    if (event.target !== inspector) return;
    picked = null;
    markNode(canvas, null);
    onClose?.();
  };
  inspector?.addEventListener('panel-close', close);
  const keys = (event: KeyboardEvent): void => {
    const first = event.composedPath()[0];
    // A key a field took already (a tag chip's Backspace removes the tag) is never the node's. TODO 819
    if ((event.key !== 'Delete' && event.key !== 'Backspace') || event.defaultPrevented || (first instanceof Element && first.matches('input, select, textarea, [contenteditable]'))) return;
    event.preventDefault();
    onDelete?.();
  };
  if (onDelete) inspector?.addEventListener('keydown', keys);
  return {
    select(node, graph): void {
      picked = node.id;
      // The panel is always there, a tab or open: a pick fills it and never opens it.
      if (inspector) show(node, graph);
    },
    peek(node, graph): void {
      picked = node.id;
      if (inspector?.open) show(node, graph);
    },
    follow(graph): void {
      const node = graph.nodes.find((n) => n.id === picked);
      if (inspector?.open && node) show(node, graph);
    },
    deselect(): void {
      picked = null;
      if (inspector) inspectNone(inspector);
      onClose?.();
    },
    clear(): void {
      picked = null;
    },
    stop(): void {
      inspector?.removeEventListener('panel-close', close);
      inspector?.removeEventListener('keydown', keys);
      inspector?.hide();
    },
  };
}



/**
 * Light a page's Query graph as its source loads: the Source by the load and by its
 * store's reads — the page's and its worker's, by the store's name or the load's
 * trace — then what the walk counted. A load is the source's when it begins as the
 * source says `loading`. TRAP T-a-step-names-its-node
 */
export function watchQuery(
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
/**
 * What the ONE node editor edits where it is not a stored workflow: a page's Query (plan 885). The editor reads its
 * definition, writes each edit back as one definition, and draws what the document says. TRAP T-one-node-editor
 */
export interface GraphDocument {
  /** Its definition now, with its layout. */
  read(): WorkflowDefinition;
  /** What to draw for a definition read from it, as the document draws its nodes. */
  graph(definition: WorkflowDefinition): FramedGraph;
  /** The editor's next definition, ONE edit's worth: what it cannot take it says, in words. Read it again after. */
  write(next: WorkflowDefinition): void;
  /** Its own state for Undo; putting one back may settle later. */
  snapshot(): unknown;
  restore(snap: unknown): void | Promise<void>;
  /** Hear it change from outside the editor (a chip, Apply, another tab). Returns the stop. */
  watch(changed: () => void): () => void;
  /** The kinds its graph draws and places, and the panel's palette of them. */
  kinds: Readonly<Record<string, NodeKind>>;
  palette(): ReturnType<typeof paletteOf>;
  /** What a picked node's inspector shows beside its rows: a component's live copy. */
  visual?(node: GraphNode): HTMLElement | null;
  /** Save: what to hand over, or false where it may not be saved. */
  save(): unknown;
  /** Why Fetch and Play do not run it; none, they do. */
  runs?: string;
  /** Light its nodes as it runs. Returns the stop. */
  lights?(canvas: SherpaLayoutCanvas): () => void;
}

export interface WorkflowEditorOptions extends WorkflowFacts {
  /** The document to edit in place of a stored workflow: a page's Query. Its draft, its layout and its save are its own. */
  document?: GraphDocument;
  inspector?: Inspector;
  /** The node panel floating on the canvas: it lists the kinds, and each node it asks for is placed. */
  panel?: SherpaNodeList;
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
  /** A `sherpa-dialog` that asks a Custom Node's name and description: inputs `[name=label]` and `[name=description]`, buttons `[data-action=save]` and `[data-action=cancel]`; a tags input `[name=tags]` if it is to be tagged. Without it Save as Custom Node is not offered. */
  customDialog?: HTMLElement & { show(): void; hide(): void };
  /** A `sherpa-dialog` that asks a stage's name, line and colour: fields `[name=label]`, `[name=description]` and
   *  `[name=colour]`, buttons `[data-action=save]` and `[data-action=cancel]`. Without it, a stage's Edit does nothing. */
  stageDialog?: HTMLElement & { show(): void; hide(): void };
  /** A `sherpa-dialog` (status critical) that confirms the two bulk updates. Without it they are not offered. */
  confirm?: HTMLElement & { confirm(ask: { heading?: string; words?: string; action?: string; critical?: boolean }): Promise<boolean> };
  /** "Update all instances" was confirmed: the app's other workflows are its own to update. */
  onUpdateAll?: (kind: string) => void;
  /** A `sherpa-node-toolbar`: its Undo and Redo are this editor's, and it says when they can be pressed. */
  toolbar?: HTMLElement;
  /** The workflow is a preset: drawn, opened, never edited, as a preset Custom Node's inside is. TRAP T-a-graph-is-a-view-of-a-type */
  readOnly?: boolean;
  /** The entity this graph is: the panel offers what `offeredKinds` says of it, and inside each node opened, of
   *  that one; "Update all instances" never writes its saved copy over the draft. TRAP T-an-entity-is-used-as-a-node */
  entity?: EntityRef;
  /** The store a Source names, by its id: what Fetch reads. None, or it says none, the Source is "not fetched yet". TODO 836 */
  storeOf?: (id: string) => Store | undefined | Promise<Store | undefined>;
  /** The cap of a fetch: rows and bytes. Left out, 100,000 rows and 50 MB. */
  fetchLimit?: SourceLimit;
  /** The queue Fetch and Simulate run in, shared with whatever else the app queues; left out, the editor's own. TODO 843 */
  tasks?: TaskQueue;
  /** Where an end notice goes: the words, and how it went. Left out, a toast. */
  notify?: (words: string, status: 'success' | 'critical' | 'info') => void;
}

/** A node's own name and line, as its inspector's first rows edit them. Its place is not one: a drag moves it, and the
 *  draft holds it (TODO 838). */
const OWN: Readonly<Record<string, keyof Pick<WorkflowNode, 'heading' | 'description'>>> = {
  '#heading': 'heading', '#description': 'description',
};

/** The most steps Undo goes back. */
const HISTORY = 100;

/** One side of a step: the draft, and each definition the step changed as it was (none, it was not there). */
interface Snap {
  draft: WorkflowDefinition;
  defs: Record<string, NodeDefinition | undefined>;
  /** The open entity's own tags. */
  tags: readonly string[];
  /** A document's own state (plan 885). */
  doc?: unknown;
}

/** One Custom Node opened: its definition's id, the use that opened it, and its name. */
interface Opened {
  kind: string;
  use: string;
  label: string;
  /** A Runbook node's sub-graph, opened read only: `kind` is the definition its runbook names (plan 926 D3). */
  runbook?: true;
}

/** Whether a value is a library's edits: definitions by id. */
const isEdits = (v: unknown): v is Record<string, NodeDefinition> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Whether a value is a list of tags. */
const isTags = (v: unknown): v is string[] => Array.isArray(v) && v.every((t) => typeof t === 'string');

/** Keep a workflow's draft drawn on a canvas, and write each edit to it as a pure edit:
 *  a value, a move, a connection, a node's own name. A connection that would break the workflow is
 *  refused, and says why. A v1 — given, or a tab's draft — is read once as v2, and Save
 *  hands over the v2. N4 runs the draft. A Custom Node OPENS: the canvas shows its inside
 *  under a trail, and an edit there is an edit to the DEFINITION, drafted beside the workflow
 *  and handed over by the same Save (`onSaveNode`); a use whose definition moved on says so, and
 *  an update keeps the draft's changes until Save or `discard`. TRAP T-a-workflow-is-its-definition
 *  · TRAP T-a-custom-node-is-an-instance */
export function bindWorkflow(
  canvas: SherpaLayoutCanvas, workflow: WorkflowDefinition,
  { inspector, panel, session: kept$, kinds = nodeKinds(), library, onSaveNode, header, confirm, customDialog, stageDialog, onUpdateAll, toolbar, readOnly: preset = false, entity, document: doc, ...facts }: WorkflowEditorOptions = {},
): WorkflowEditor {
  // A document keeps its own draft and layout: the session keeps none of it here.
  const session = doc ? undefined : kept$;
  const pointer = `/workflows/${workflow.id}`;
  const isDraft = (v: unknown): v is WorkflowDefinition => {
    const d = v as { v?: unknown; id?: unknown; nodes?: unknown } | null;
    // A v2, kept before plan 934, is the reader's draft too: readWorkflow reads it in the new words, never drops it.
    return !!d && typeof d === 'object' && (d.v === 3 || d.v === 2) && d.id === workflow.id && Array.isArray(d.nodes);
  };
  session?.persist(pointer, { shared: false, guard: isDraft });
  // The definitions this tab edited: kept beside the draft, over the app's library.
  const editsAt = `/node-edits/${workflow.id}`;
  session?.persist(editsAt, { shared: false, guard: isEdits });
  // Each kept before plan 934 reads in the new words. TRAP T-a-saved-graph-is-read-in-the-new-words
  const edited = Object.fromEntries(Object.entries(session?.get(editsAt) as Record<string, NodeDefinition> | undefined ?? {}).map(([k, d]) => [k, inNewWords(d)]));
  // The entity this graph is, by the kind its use has: the library holds its SAVED copy; the draft is its own.
  const own = entity && entityKind(entity);
  let given = library ?? { v: 1, nodes: {} };
  let lib: NodeLibrary = { ...given, nodes: { ...given.nodes, ...edited } };
  let handed: NodeLibrary = given;
  // The open entity's own tags, a draft beside the workflow's, kept for the tab: the app's Save writes them. TODO 828
  const tagsAt = `/graph-tags/${workflow.id}`;
  session?.persist(tagsAt, { shared: false, guard: isTags });
  let handedTags: readonly string[] = own ? tidyTags(lib.nodes[own]?.tags) : [];
  let ownTags: readonly string[] = (session?.get(tagsAt) as string[] | undefined) ?? handedTags;
  const dirty = new Set(Object.keys(edited));
  const topKinds = (): Readonly<Record<string, NodeKind>> => ({ ...(doc?.kinds ?? kinds), ...kindsOf(lib) });
  // This tab's draft wins: a reload loses nothing. What a v1's read cannot map is said once.
  const kept = session?.get(pointer) as WorkflowDefinition | undefined;
  const read = readWorkflow(kept ?? structuredClone(workflow));
  for (const fault of read.faults) report({ code: 'workflow-definition', message: `bindWorkflow: ${fault}.`, at: { workflow: workflow.id } });
  let draft: WorkflowDefinition = read.workflow ?? { v: 3, id: workflow.id, nodes: [] };
  let original: WorkflowDefinition = readWorkflow(structuredClone(workflow)).workflow ?? draft;
  /** The graph as it was when the editor loaded: what Reset node graph puts back. A Save moves `original`, never this. */
  const starting = original;
  /** It never changes: its JSON, once. */
  const startingJSON = JSON.stringify(starting);
  /** The view bar of the app header, where its ⋮ holds Reset node graph (TODO 837). */
  const resetBar = (): HTMLElement | null | undefined => header?.querySelector<HTMLElement>('sherpa-quick-filter-toolbar[data-type="view"]');
  const edits = (): Record<string, NodeDefinition> => Object.fromEntries([...dirty].flatMap((id) => (lib.nodes[id] ? [[id, lib.nodes[id]]] : [])));
  /** A connection a use's header holds from before reads once as its own new input, drafted; Save writes it. TRAP T-a-custom-node-header-adds-an-input */
  const readHeld = (): void => {
    const held = heldInputs(draft, lib, topKinds());
    if (!held.ids.length) return;
    draft = held.workflow;
    lib = held.library;
    for (const id of held.ids) dirty.add(id);
    session?.set(pointer, draft);
    session?.set(editsAt, edits());
  };
  readHeld();
  let graph: FramedGraph = { nodes: [], connections: [] };
  // The Custom Nodes opened, outermost first. What is shown is the innermost one's body.
  let path: Opened[] = [];
  const innerNow = (): Inner | undefined => {
    let at: WorkflowDefinition = draft;
    let inner: Inner | undefined;
    for (const step of path) {
      const use = at.nodes.find((n) => n.id === step.use);
      // A runbook's sub-graph is the definition it names, not its node's kind.
      inner = use && innerOf(step.runbook ? { id: use.id, kind: step.kind } : use, lib, topKinds());
      if (!inner) return undefined;
      at = inner.workflow;
    }
    return inner;
  };
  const shown = (): WorkflowDefinition => (path.length ? innerNow()?.workflow ?? draft : draft);
  const K = (): Readonly<Record<string, NodeKind>> => (path.length ? innerNow()?.kinds ?? topKinds() : topKinds());
  /** A preset's inside is read only (D15), at any depth; a preset workflow, everywhere. */
  const insidePreset = (): boolean => path.some((s) => s.runbook || lib.nodes[s.kind]?.preset);
  const readOnly = (): boolean => preset || insidePreset();
  // A graph's own Group Input and Output are drawn, never placed; the rest are what the graph shown may place.
  const refreshPanel = (): void => {
    if (doc) return void panel?.populate(doc.palette());
    // A runbook's steps are reached through its Runbook node, never placed (plan 926 D3).
    const steps = runbookGraphs();
    const placeable = Object.fromEntries(Object.entries(topKinds()).filter(([id]) => !id.startsWith('#') && !steps.has(id)));
    // A loop is read through the draft: what it places now, not what was saved.
    void panel?.populate(paletteOf(offeredKinds(placeable, path.at(-1)?.kind ?? own, own ? { ...lib.nodes, [own]: { nodes: draft.nodes } } : lib.nodes)));
  };
  // — Undo and Redo: each edit is a pure function on the draft, so a step is the draft before and
  //   after, and each definition it changed, before and after. They share structure: a step is cheap.
  //   TRAP T-an-edit-is-a-step
  const journal = new Journal<Snap>(HISTORY);
  const tell = (): void => {
    toolbar?.toggleAttribute('data-can-undo', journal.canBack);
    toolbar?.toggleAttribute('data-can-redo', journal.canForward);
    canvas.dispatchEvent(new CustomEvent('history-change', { detail: { undo: journal.canBack, redo: journal.canForward }, bubbles: true, composed: true }));
    // Reset node graph is off while the graph is as it was when the editor loaded (a preset's never changes).
    resetBar()?.toggleAttribute('data-graph-unchanged', (draft === starting || JSON.stringify(draft) === startingJSON) && !dirty.size && ownTags === handedTags);
  };
  /** Two steps as one: the first's before, the second's after, for every definition either changed. */
  const fold = (last: Change<Snap>, next: Change<Snap>): Change<Snap> => ({
    before: { draft: last.before.draft, defs: { ...next.before.defs, ...last.before.defs }, tags: last.before.tags, doc: last.before.doc },
    after: { draft: next.after.draft, defs: { ...last.after.defs, ...next.after.defs }, tags: next.after.tags, doc: next.after.doc },
  });
  // — A DOCUMENT (plan 885): an edit's writes reach it as ONE definition when the edit ends, and what it keeps is read back.
  //   Its own state is each step's; a change from outside the editor is a step too.
  /** The document's state as the last step left it; a write of its own is not a change from outside. */
  let docLast: unknown = doc?.snapshot();
  /** The definition the document last gave: a draft that is not it has edits the document has not heard — a drag's, say,
   *  which it hears only as the drag ends, from a write that may change nothing more. */
  let docRead = draft;
  let docWriting = false;
  const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);
  let depth = 0;
  let begun: { draft: WorkflowDefinition; nodes: NodeLibrary['nodes']; tags: readonly string[] } | undefined;
  let lastTag = '';
  let lastAt = 0;
  /** A document's edit draws once, as it ends: a write inside it only says so. */
  let drawSoon = false;
  /** One edit, however many writes it makes: ONE step. The same `tag` within a second (a drag, a typed word) is one too. */
  const edit = (fn: () => void, tag = ''): void => {
    if (depth++ === 0) begun = { draft, nodes: lib.nodes, tags: ownTags };
    try {
      fn();
    } finally {
      if (--depth === 0) {
        const was = begun!.nodes;
        const ids = [...new Set([...Object.keys(was), ...Object.keys(lib.nodes)])].filter((id) => was[id] !== lib.nodes[id]);
        const docBefore = docLast;
        if (doc && draft !== docRead && !dragging) {
          docWriting = true;
          try {
            doc.write(draft);
          } finally {
            docWriting = false;
          }
          draft = docRead = doc.read();
          docLast = doc.snapshot();
          // What it kept is drawn: its ids, its new nodes, its refusals undone.
          drawSoon = true;
        }
        // ONE draw for the edit, of what the document kept: each write's own draw of the editor's draft was thrown away.
        if (drawSoon) {
          drawSoon = false;
          draw();
        }
        const moved = doc ? !same(docBefore, docLast) : begun!.draft !== draft || begun!.tags !== ownTags || ids.length > 0;
        if (moved) {
          const of = (nodes: NodeLibrary['nodes']): Snap['defs'] => Object.fromEntries(ids.map((id) => [id, nodes[id]]));
          const now = performance.now();
          const merge = tag && tag === lastTag && now - lastAt < 1000;
          journal.push({ before: { draft: begun!.draft, defs: of(was), tags: begun!.tags, doc: docBefore }, after: { draft, defs: of(lib.nodes), tags: ownTags, doc: docLast } }, merge ? fold : undefined);
          lastTag = tag;
          lastAt = now;
          tell();
        }
      }
    }
  };
  /** Put the draft back as a step left it, and each definition the step changed, over the library as it is
   *  now: a refresh is not undone, and a Save is no wall. A definition a step made stays once saved: it is the app's. */
  const restore = (to: Snap): void => {
    if (doc) {
      // The document puts its own state back; the editor reads it once it has.
      const settled = (): void => {
        draft = docRead = doc.read();
        docLast = doc.snapshot();
        draw();
        tell();
      };
      docWriting = true;
      const put = doc.restore(to.doc);
      docWriting = false;
      lastTag = '';
      settled();
      if (put) void put.finally(settled);
      return;
    }
    draft = to.draft;
    ownTags = to.tags;
    session?.set(tagsAt, ownTags === handedTags ? undefined : ownTags);
    const put = new Map(Object.entries(to.defs).map(([id, was]) => [id, was ?? handed.nodes[id]] as const));
    for (const [id, definition] of put) {
      // It is a draft edit while it differs from what Save last handed over.
      if (definition === handed.nodes[id] || JSON.stringify(definition) === JSON.stringify(handed.nodes[id])) dirty.delete(id);
      else dirty.add(id);
    }
    // In the library's own order, so the panel's does not move.
    const kept = Object.entries(lib.nodes).flatMap(([id, d]) => (put.has(id) ? (put.get(id) ? [[id, put.get(id)!] as const] : []) : [[id, d] as const]));
    const added = [...put].flatMap(([id, d]) => (d && !(id in lib.nodes) ? [[id, d] as const] : []));
    lib = { ...lib, nodes: Object.fromEntries([...kept, ...added]) };
    session?.set(pointer, draft);
    session?.set(editsAt, edits());
    lastTag = '';
    refreshPanel();
    draw();
    tell();
  };
  /** Reset node graph: the graph back to its starting definition, and each definition edited since back to what Save last
   *  handed over — a draft, ONE step, and nothing saved. Will, TODO 837 */
  const reset = (): void => {
    if (preset) return;
    edit(() => {
      path = [];
      draft = starting;
      ownTags = handedTags;
      const back = new Map([...dirty].map((id) => [id, handed.nodes[id]] as const));
      lib = { ...lib, nodes: Object.fromEntries(Object.entries(lib.nodes).flatMap(([id, d]) => (back.has(id) ? (back.get(id) ? [[id, back.get(id)!] as const] : []) : [[id, d] as const]))) };
      dirty.clear();
      session?.set(pointer, undefined);
      session?.set(editsAt, undefined);
      session?.set(tagsAt, undefined);
      refreshPanel();
      draw();
    });
  };
  /** The library after a change to these definitions: drafted, and kept for the tab. */
  const setLib = (next: NodeLibrary, ids: readonly string[]): void => {
    edit(() => {
      lib = next;
      for (const id of ids) dirty.add(id);
      session?.set(editsAt, edits());
      refreshPanel();
    });
  };
  // — Stages (the top workflow's): a dragged node stays in its stage, which grows with it as it goes, the rest a flex row
  // after it. With SHIFT held it leaves its stage: the stages hold still as they stood, and let go, it joins the stage it
  // stands in, or none. Will, 2026-11-10
  // Its callbacks are read when a stage is pressed, or the canvas drawn: by then each is set.
  const stages: Stages = bindStages(canvas, {
    workflow: () => (path.length ? null : shown()),
    write: (next) => write(next),
    readOnly: () => readOnly(),
    dialog: stageDialog ?? null,
    moving: () => (settling ? moved : new Set()),
  });
  /** A pointer is down on the canvas; Shift is held; the nodes a drag has moved: written when it lets go. */
  let pressing = false;
  let shifted = false;
  let settling = false;
  /** A pointer drag is under way: a write draws only what moves — of nodes, or a size; of a tie or a bend, only the
   *  lines (`linesOnly`) — and a document hears it when it ends. */
  let dragging = false;
  let linesOnly = false;
  const moved = new Set<string>();
  let movedTag = '';
  /** A drag just ended: the click it ends with is no Shift-click pick. */
  let justDragged = false;
  /** A node's height as drawn, in plane px: what a lane holds. Not drawn yet, a node's usual height. */
  const heightOf = (node: { id: string }): number => drawnOn.get(canvas)?.nodes.get(node.id)?.offsetHeight || 120;
  const settle = (): void => {
    settling = false;
    dragging = false;
    const ids = [...moved];
    moved.clear();
    if (path.length || readOnly()) return;
    // Shift held: it joins the stage it was let go in — a frame's nodes as ONE. Else it is where its stage still is.
    const framed = (shown().frames ?? []).some((f) => f.nodes.length === ids.length && f.nodes.every((id) => ids.includes(id)));
    write(ids.length && shiftDrag ? editWorkflow(shown(), { restage: ids, together: framed }, K()) : shown(), movedTag);
    shiftDrag = false;
  };
  let shiftDrag = false;
  const dragged = (ids: readonly string[], tag: string): void => {
    for (const id of ids) moved.add(id);
    movedTag = tag;
    if (pressing && shifted) shiftDrag = true;
    if (!pressing) settle();
  };
  const onPress = (event: PointerEvent): void => {
    pressing = true;
    shifted = event.shiftKey;
  };
  const onPointerMove = (event: PointerEvent): void => { if (pressing) shifted = event.shiftKey; };
  const onLetGo = (): void => {
    pressing = false;
    // A tie, a bend or a size let go: the whole draft, written and drawn once, as one step with the drag's.
    if (!moved.size && dragging) {
      dragging = linesOnly = false;
      return write(shown(), lastTag);
    }
    if (!moved.size) return;
    justDragged = true;
    setTimeout(() => { justDragged = false; });
    settle();
  };
  const write = (next: WorkflowDefinition, tag?: string): void => edit(() => {
    if (!path.length && preset) {
      report({ code: 'node-readonly', message: 'bindWorkflow: this workflow is a preset, read only: change a copy of it.', at: { workflow: workflow.id } });
    } else if (!path.length) {
      // Its stages hold their nodes: a stage grows, and pushes the next. Not while a drag is under way: its end does it.
      draft = settling ? next : fitLanes(fitStages(next, nodeWidth), heightOf, K());
      // Kept for the tab as the drag ends, not each pointer move: each is the whole workflow as JSON.
      if (!dragging) session?.set(pointer, draft);
    } else if (readOnly()) {
      report({ code: 'node-readonly', message: 'bindWorkflow: this Custom Node is a preset, read only. Copy to my nodes, and change the copy.', at: { workflow: workflow.id } });
    } else {
      const id = path.at(-1)!.kind;
      setLib(editDefinition(lib, id, { nodes: next.nodes.filter((n) => !n.id.startsWith('#')), connections: next.connections ?? [], ties: next.ties ?? [], frames: next.frames ?? [] }), [id]);
    }
    // Mid-drag, only what moves is drawn: a whole draw a pointer move cost 220ms on 45 nodes (2026-11-10). The drag's end draws all.
    if (dragging && linesOnly) relayConnections(canvas, lineGraph());
    else if (dragging) drawMoves();
    else if (doc) drawSoon = true;
    else draw();
  }, tag);
  /** Mid-drag of a tie or a bend: the connections and ties as the draft has them, the nodes as drawn. */
  const lineGraph = (): FramedGraph => {
    const body = doc ? doc.graph(shown()) : workflowGraph(shown(), facts, K());
    return lanesOn() ? { ...body, ties: [] } : body;
  };
  /** Mid-drag: each node where the draft says (a stage that grew pushes others), the lines, the stages and lanes. */
  const drawMoves = (): void => {
    const els = drawnOn.get(canvas)?.nodes;
    if (!els || path.length) return draw();
    let moved = false;
    for (const n of shown().nodes) {
      const el = els.get(n.id);
      if (!el) continue;
      const [x, y] = [String(n.x), String(n.y)];
      if (el.getAttribute('data-x') !== x) { el.setAttribute('data-x', x); moved = true; }
      if (el.getAttribute('data-y') !== y) { el.setAttribute('data-y', y); moved = true; }
    }
    if (moved) relayConnections(canvas);
    stages.draw();
    drawLanes(canvas, shown(), heightOf, K());
  };
  const onEdit = ({ node, row, value }: GraphEdit): void => {
    // A Custom Node's tags are its definition's: one step, and the panel's headings follow. TODO 819
    if (row.name === '#tags') {
      // The open entity's own, on its Group Input and Output: a draft beside the workflow's. TODO 828
      if (ownTagged(node)) {
        const next = tidyTags(value);
        if (!readOnly() && JSON.stringify(next) !== JSON.stringify(ownTags)) edit(() => { ownTags = next; session?.set(tagsAt, next); });
        return;
      }
      const id = taggedBy(node);
      const next = id && !readOnly() ? tagDefinition(lib, id, value) : lib;
      if (next !== lib) setLib(next, [id!]);
      return;
    }
    const own = OWN[row.name];
    // A portal's name, or a Rename, can join a loop: checked as a connection is, and refused the same way; a refused pick draws back. TODO 779
    const portal = portalOf(node);
    if (portal && (row.name === '#rename' || !own)) {
      take(editWorkflow(shown(), row.name === '#rename' ? { renamePortal: { from: portal.name, to: String(value ?? '') } } : { node: node.id, row: row.name, value }, K(), facts));
      return draw();
    }
    if (!own) return write(editWorkflow(shown(), { node: node.id, row: row.name, value }, K(), facts), `row:${node.id}/${row.name}`);
    write(editWorkflow(shown(), { node: node.id, set: { [own]: String(value ?? '') } }, K()), `own:${node.id}/${own}`);
  };
  const onMove = (node: GraphNode, x: number, y: number): void => {
    if (node.id.startsWith('#')) return;
    settling = pressing && shifted;
    dragging = pressing;
    write(editWorkflow(shown(), { node: node.id, set: { x, y } }, K()), `move:${node.id}`);
    dragged([node.id], `move:${node.id}`);
  };
  // Picked nodes moved by one drag: ONE step. A tie whose connections all join them goes with them, and so do the
  // bends of a connection with both ends among them; the rest stay. TODO 752
  const onMoveMany = (moves: { id: string; x: number; y: number }[]): void => {
    const nodes = Object.fromEntries(moves.filter((m) => !m.id.startsWith('#')).map((m) => [m.id, { x: m.x, y: m.y }]));
    const head = shown().nodes.find((n) => n.id === moves[0]?.id);
    if (!head || !nodes[head.id] || Object.keys(nodes).length < 2) return;
    const [dx, dy] = [nodes[head.id]!.x - head.x, nodes[head.id]!.y - head.y];
    const inside = (r: NodeConnection): boolean => socketOf(r.from).node in nodes && socketOf(r.to).node in nodes;
    const ties = Object.fromEntries((shown().ties ?? []).filter((t) => t.connections.length && t.connections.every(inside)).map((t) => [t.id, { x: t.x + dx, y: t.y + dy }]));
    const tag = `move:${Object.keys(nodes).sort().join(',')}`;
    settling = pressing && shifted;
    dragging = pressing;
    write(editWorkflow(shown(), { place: { nodes, ties, bends: { dx, dy } } }, K()), tag);
    dragged(Object.keys(nodes), tag);
  };
  // Arrange: every place, tie and bend in ONE edit. TODO 752
  const onArrange = (placed: Arranged): void => {
    if (readOnly()) return;
    write(editWorkflow(shown(), { place: { nodes: placed.nodes, ties: placed.ties, bends: 'reset' } }, K()));
  };
  const onResize = (node: GraphNode, size: NodeSize): void => {
    if (node.id.startsWith('#')) return;
    dragging = pressing;
    write(editWorkflow(shown(), { resize: { node: node.id, ...size } }, K()), `size:${node.id}`);
  };
  // A connection that would break the workflow is refused, and says why — a loop, one into a Rows row, a row's own fault; one
  // of another type joins, and the node it enters warns (TODO 770). Else the draft takes it, with the definition it changed.
  const take = (next: WorkflowDefinition, made?: { library: NodeLibrary; id: string }): void => {
    // A document checks what it is given itself, and says what it refuses.
    if (doc) return write(next);
    const was = new Set(workflowFaultsDeep(shown(), lib, K(), facts));
    const now = made ? { ...K(), ...kindsOf(made.library) } : K();
    const added = workflowFaultsDeep(next, made?.library ?? lib, now, facts).filter((f) => !was.has(f));
    if (added.length) report({ code: 'workflow-connection', message: `bindWorkflow: ${added.join('; ')}.`, at: { workflow: shown().id } });
    else if (!made) write(next);
    else edit(() => { setLib(made.library, [made.id]); write(next); });
  };
  // A connection into a Custom Node's header takes anything, as a new input of its definition; a preset's refuses it as
  // any refused drop does (TODO 803). TRAP T-a-custom-node-header-adds-an-input
  const join = (on: WorkflowDefinition, connection: NodeConnection): void => {
    const { node, row } = socketOf(connection.to);
    if (row !== undefined || !use(node) || readOnly()) return take(editWorkflow(on, { connection }, K()));
    const made = headerInput(on, connection, lib, K());
    if ('fault' in made) report({ code: 'workflow-connection', message: `bindWorkflow: ${made.fault}.`, at: { workflow: shown().id } });
    else take(made.workflow, made);
  };
  const onConnect = (connection: NodeConnection): void => join(shown(), connection);
  // A moved end is one edit: the connection cut, then made, checked as one.
  const onReconnect = (was: NodeConnection, now: NodeConnection): void => join(editWorkflow(shown(), { cut: was }, K()), now);
  const onBreak = (connection: NodeConnection): void => write(editWorkflow(shown(), { cut: connection }, K()));
  // Picked connections cut together are ONE step.
  const onBreakAll = (connections: NodeConnection[]): void => edit(() => { for (const connection of connections) onBreak(connection); });
  // — Swimlanes on: the lanes place the nodes, so Arrange, Unfurl and the zip tie are off, and the ties are hidden till they
  //   go; a frame is still a bucket. Will, 2026-11-10
  const lanesOn = (): boolean => !path.length && !!shown().lanes?.length;
  const SWIMLANES_OWN = 'Swimlanes are on: they place the nodes';
  // — Zip ties (562): a tie is a part of the draft, so each is one edit, and one step.
  let tying = false;
  const setTying = (on: boolean): void => {
    tying = on;
    toolbar?.toggleAttribute('data-tie', on);
    draw();
  };
  /** Each node's box on the plane, as drawn. */
  const nodeBoxes = (): Box[] => [...(drawnOn.get(canvas)?.nodes.values() ?? [])].map((el) => {
    const [x, y] = [Number(el.getAttribute('data-x')) || 0, Number(el.getAttribute('data-y')) || 0];
    return { left: x, top: y, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
  });
  // A new tie that would stand behind a node stands beside it, on the side with the most room. TODO 882
  const onTie = (connections: NodeConnection[], at: { x: number; y: number }): void => {
    const clear = clearOfNodes(at, (connections.length - 1) * TIE_GAP + 16, nodeBoxes(), tieLimit(shown(), { connections }));
    take(editWorkflow(shown(), { tie: { connections, ...clear } }, K()));
  };
  const onTieMove = (id: string, x: number, y: number): void => {
    dragging = linesOnly = pressing;
    write(editWorkflow(shown(), { moveTie: { id, x, y } }, K()), `tie:${id}`);
  };
  const onUntie = (id: string): void => write(editWorkflow(shown(), { untie: id }, K()));
  // — Bend points (744): a drag is one step, as a tie's is; a refusal reports and writes nothing.
  const onBend = (connection: NodeConnection, at: number, x: number, y: number, insert: boolean, drag: number): void => {
    const next = editWorkflow(shown(), { bend: { connection, at, x, y, insert } }, K());
    dragging = linesOnly = pressing;
    if (next !== shown()) write(next, `bend:${connection.from}>${connection.to}:${drag}`);
  };
  const onUnbend = (connection: NodeConnection, index: number): void => {
    const next = editWorkflow(shown(), { unbend: { connection, index } }, K());
    if (next !== shown()) write(next);
  };
  const onTieDrop = (id: string, connection: NodeConnection): void => {
    const next = editWorkflow(shown(), { tieAdd: { id, connection } }, K());
    if (next !== shown()) write(next);
  };
  /** With no pointer: tie the connections between picked nodes, or into one. */
  const tieNodes = (ids: readonly string[]): void => {
    tieConnections((shown().connections ?? []).filter((r) => (ids.length > 1 ? ids.includes(socketOf(r.from).node) && ids.includes(socketOf(r.to).node) : socketOf(r.to).node === ids[0])));
  };
  /** One tie across these connections; where they are all tied together already, untie them. */
  const tieConnections = (connections: readonly NodeConnection[]): void => {
    if (readOnly() || !connections.length) return;
    const same = (a: NodeConnection, b: NodeConnection): boolean => a.from === b.from && a.to === b.to;
    const held = (shown().ties ?? []).find((t) => t.connections.length === connections.length && connections.every((r) => t.connections.some((q) => same(q, r))));
    if (held) onUntie(held.id);
    else onTie([...connections], tieSpot(canvas, connections));
  };
  // — Frames (778): Frame, Release, a frame's name and line; each one edit, and one step. TRAP T-a-frame-is-drawn-round-its-nodes
  /** The frame the inspector shows, or none. */
  let framePanel: string | null = null;
  const showFrame = (id: string): void => {
    const frame = (shown().frames ?? []).find((f) => f.id === id);
    if (!inspector || !frame) return;
    framePanel = id;
    markActive(canvas, null);
    inspectFrame(inspector, frame, graph, readOnly() ? {} : {
      onEdit: (set) => write(editWorkflow(shown(), { setFrame: { id, ...set } }, K()), `frame:${id}/${Object.keys(set).join()}`),
      onRelease: () => release(id),
    });
    inspector.show();
  };
  const onFrameSelect = (frame: NodeFrame): void => {
    multi.clear();
    current = null;
    active = null;
    shut = false;
    picks.clear();
    showFrame(frame.id);
  };
  /** Release: the frame goes, its nodes stay where they are. */
  const release = (id: string): void => {
    if (readOnly()) return;
    const was = framePanel === id;
    write(editWorkflow(shown(), { unframe: id }, K()));
    if (was) picks.deselect();
    canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
  };
  /** Frame the picked nodes: ONE column, with Arrange's gap, and a frame round it, as ONE step. The frame is picked. */
  const framePicked = (focus = false): void => {
    const ids = pickedNodes(canvas).filter((id) => !id.startsWith('#'));
    if (readOnly() || ids.length < 2) return;
    const had = new Set((shown().frames ?? []).map((f) => f.id));
    // A frame is a bucket: its nodes stay where they are. Will, 2026-11-10
    write(editWorkflow(shown(), { frame: { nodes: ids } }, K()));
    const made = (shown().frames ?? []).find((f) => !had.has(f.id));
    if (!made) return;
    const open = !!inspector?.open;
    multi.clear();
    current = null;
    picks.clear();
    markFrame(canvas, made.id);
    if (open) showFrame(made.id);
    if (focus) focusNode(canvas, made.id, true);
  };
  // A Value node for a picklist row: the row keeps its own pick, and mirrors the node.
  const customAt = (to: string, at: { x: number; y: number }): void => take(addCustomValue(shown(), to, at, K()));
  const onCustom = (to: string, at: { x: number; y: number }): void => customAt(to, { x: Math.round(at.x), y: Math.round(at.y) });
  // A node the reader asked for, from the panel or "Add a node": through the one door, `{ add }`; picked, its panel shut. TODO 756
  const place = (kind: string, at: { x: number; y: number }, context?: AddContext, type?: string): void => {
    if (!K()[kind] || readOnly()) return;
    const free = (n: number): string => (shown().nodes.some((x) => x.id === `${kind}-${n}`) ? free(n + 1) : `${kind}-${n}`);
    const id = free(1);
    edit(() => {
      const fit = context && fitOf(K()[kind]!, context.type, context.side, context.gives);
      // A node let go by its output sits left of the point, so its output meets the line. A family takes the type it fits, or was found by.
      const x = Math.round(at.x - (context?.side === 'in' ? 280 : 0));
      const typed = type ?? fit?.type;
      const added = { id, kind, x, y: Math.round(at.y), ...(typed ? { values: { type: typed } } : {}) };
      // A use of a Custom Node records the definition it is placed from (D11).
      write(editWorkflow(shown(), { add: K()[kind]!.model === 'graph' && lib.nodes[kind] ? useOf(lib, kind, added) : added }, K()));
      if (context && fit) {
        const own = fit.row ? `${id}/${fit.row}` : id;
        join(shown(), context.side === 'out' ? { from: context.socket, to: own } : { from: own, to: context.socket });
      }
      // In the stage under the point it is let go at: its left edge is there, so its middle may be in the next (923).
      if (!path.length) write(editWorkflow(shown(), { restage: [id], by: at.x }, K()));
    });
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return;
    multi.clear();
    markNode(canvas, id);
    current = id;
    shut = !inspector?.open;
    picks.peek(node, graph);
  };
  const planeAt = (clientX: number, clientY: number): { x: number; y: number } => {
    const [x, y] = planeOf(canvas, { clientX, clientY });
    return { x, y };
  };
  const onAdded = (event: Event): void => {
    const { kind, type, point, context } = (event as CustomEvent<{ kind: string; type?: string; point?: { x: number; y: number }; context?: AddContext }>).detail;
    if (context) return place(kind, context.at, context);
    const box = canvas.getBoundingClientRect();
    if (!point) return place(kind, planeAt(box.left + box.width / 2 - 120, box.top + box.height / 2 - 40), undefined, type);
    // Let go off the canvas: nothing is placed.
    if (point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom) return;
    place(kind, planeAt(point.x, point.y), undefined, type);
  };
  panel?.addEventListener('node-add', onAdded);
  refreshPanel();
  const onRemove = (id: string): void => {
    picks.deselect();
    write(editWorkflow(shown(), { remove: id }, K()));
  };
  // Delete or Backspace on picked nodes: they and the connections picked go as ONE step. A Group Input or Output stays, and says so.
  const onRemoveNodes = (ids: string[], connections: NodeConnection[]): void => {
    const gone = ids.filter((id) => !id.startsWith('#'));
    if (gone.length < ids.length) report({ code: 'node-remove', message: 'The Group Input and Group Output are a Custom Node\'s doors: they cannot be removed.', at: { workflow: shown().id } });
    if (!gone.length && !connections.length) return;
    multi.clear();
    picks.deselect();
    edit(() => {
      let next = shown();
      for (const connection of connections) next = editWorkflow(next, { cut: connection }, K());
      for (const id of gone) next = editWorkflow(next, { remove: id }, K());
      write(next);
    });
    // The canvas's own keys (Undo) hear what comes next.
    canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
  };

  // — Custom Nodes: open, the trail, update, save as, ungroup —
  // The picked set tells the toolbar when Save as Custom Node can be pressed: two or more.
  const tellGroup = (): void => { toolbar?.toggleAttribute('data-can-group', multi.size > 1 && !readOnly() && !!customDialog); };
  const multi = new (class extends Set<string> {
    override add(id: string): this { super.add(id); tellGroup(); return this; }
    override delete(id: string): boolean { const done = super.delete(id); tellGroup(); return done; }
    override clear(): void { super.clear(); tellGroup(); }
  })();
  let active: string | null = null;
  const use = (id: string): WorkflowNode | undefined => {
    const at = shown().nodes.find((n) => n.id === id);
    return at && K()[at.kind]?.model === 'graph' && lib.nodes[at.kind] ? at : undefined;
  };
  const trail = (): void => {
    void header?.populate({ breadcrumb: path.length ? [{ label: draft.label ?? 'Workflow' }, ...path.map((s) => ({ label: s.label }))] : [] });
  };
  /** The canvas shows another graph: nothing is picked, the view fits it, and the panel lists what it may place. */
  const enter = (focus: string | null): void => {
    multi.clear();
    markNode(canvas, null);
    picks.deselect();
    refreshPanel();
    draw();
    requestAnimationFrame(() => requestAnimationFrame(() => canvas.fit()));
    if (focus) focusNode(canvas, focus);
    else canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
  };
  /** A Runbook node's predefined runbook: its sub-graph opens read only, with the trail back (plan 926 D3 A). */
  const openRunbook = (id: string): void => {
    const at = shown().nodes.find((n) => n.id === id);
    const picked = at?.kind === 'runbook' ? aiCatalog().runbooks[String(at.values?.['runbook'] ?? '')] : undefined;
    if (!picked?.graph || !lib.nodes[picked.graph]) return;
    path = [...path, { kind: picked.graph, use: id, label: picked.label, runbook: true }];
    enter(null);
    if (inspector) showScope();
  };
  const open = (id: string): void => {
    const at = use(id);
    if (!at) return;
    path = [...path, { kind: at.kind, use: id, label: at.heading ?? lib.nodes[at.kind]!.label }];
    enter(null);
    // A preset says it is read only, and where its copy is: the panel opens beside it.
    if (insidePreset() && inspector) showScope();
  };
  const back = (depth = path.length - 1): void => {
    if (depth < 0 || depth >= path.length) return;
    const from = path[depth]!.use;
    path = path.slice(0, depth);
    enter(from);
  };
  const onCrumb = (event: Event): void => back((event as CustomEvent<{ index: number }>).detail.index);
  header?.addEventListener('breadcrumb-select', onCrumb);
  header?.addEventListener('graph-reset', reset);
  resetBar()?.setAttribute('data-reset-graph', '');
  /** "Copy to my nodes": an editable copy of the preset opened, which takes the use that opened it. */
  const copy = (): void => edit(() => {
    const step = path.at(-1);
    if (!step || step.runbook) return;
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
    if (inspector) inspectNone(inspector);
  });
  const scopeNote = (): HTMLElement[] => {
    if (!insidePreset()) return [];
    const note = document.createElement('sherpa-stack');
    note.setAttribute('data-gap', 'md');
    const words = document.createElement('p');
    words.style.margin = '0';
    // A runbook's steps are the app's: read only, with nothing to copy.
    if (path.at(-1)?.runbook) {
      words.textContent = 'These are the runbook\'s steps: read only.';
      note.append(words);
      return [note];
    }
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
    if (await ask('Update all instances on graph?', `Every “${name}” on this graph takes its current definition. Their own values stay; a connection to a socket it lost stays, and is reported.`)) write(updateAll(shown(), kind, lib, K()));
  };
  const updateEverywhere = async (kind: string): Promise<void> => {
    const name = lib.nodes[kind]?.label ?? kind;
    if (!await ask('Update all instances?', `Every “${name}” takes its current definition: on this graph, inside every other Custom Node, and on every workflow of the app. Their own values stay.`)) return;
    let next = lib;
    const ids: string[] = [];
    for (const [id, definition] of Object.entries(lib.nodes)) {
      if (id === own || definition.preset || !definition.nodes.some((n) => n.kind === kind)) continue;
      const body = updateAll({ v: 3, id, nodes: definition.nodes, connections: definition.connections ?? [] }, kind, lib, topKinds());
      next = editDefinition(next, id, { nodes: body.nodes, connections: body.connections ?? [] });
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
  const group = (label: string, description: string, tags: readonly string[]): string | undefined => {
    if (readOnly()) return 'this Custom Node is a preset, read only';
    const made = groupNodes(shown(), [...multi], lib, { label, description, tags }, K(), facts);
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
      current = node.id;
      shut = !inspector?.open;
      picks.peek(node, graph);
    }
    return undefined;
  };
  /** The picked nodes in the panel: a tab each, the active one's node filling it. A tab changes the shown node, never the pick. */
  const showMulti = (): void => {
    if (!inspector) return;
    framePanel = null;
    markNodes(canvas, multi);
    const nodes = graph.nodes.filter((n) => multi.has(n.id));
    if (!nodes.length) return;
    if (!active || !multi.has(active)) active = nodes[0]!.id;
    shut = false;
    markActive(canvas, active);
    fillInspector(nodes.find((n) => n.id === active)!, graph, {
      nodes: nodes.map((n) => ({ id: n.id, label: n.heading })), current: active, heading: `${nodes.length} nodes picked`,
      onTab: (id) => { active = id; showMulti(); },
    });
    inspector.show();
  };
  // — the dialog Save as Custom Node asks in —
  type Field = HTMLElement & { value: string; tags?: string[]; suggestions?: { value: string }[] };
  const dialogField = (name: string): Field | null => customDialog?.querySelector(`[name="${name}"]`) ?? null;
  const saveAs = (): void => {
    const name = dialogField('label');
    const fault = group(String(name?.value ?? ''), String(dialogField('description')?.value ?? ''), dialogField('tags')?.tags ?? []);
    if (fault) name?.setAttribute('data-description', fault.charAt(0).toUpperCase() + fault.slice(1));
    else customDialog?.hide();
  };
  const openSave = (): void => {
    if (!customDialog || multi.size < 2 || readOnly()) return;
    for (const field of ['label', 'description']) dialogField(field)!.value = '';
    // An optional Tags field (`[name=tags]`, a tags input) offers the tags the app's Custom Nodes have already.
    const tags = dialogField('tags');
    if (tags) {
      tags.tags = [];
      tags.suggestions = knownTags().map((value) => ({ value }));
    }
    dialogField('label')?.removeAttribute('data-description');
    customDialog.show();
    dialogField('label')?.focus();
  };
  const onSaveKey = (event: Event): void => {
    if ((event as KeyboardEvent).key !== 'Enter') return;
    event.stopPropagation();
    saveAs();
  };
  const dialogSave = customDialog?.querySelector('[data-action="save"]');
  const dialogCancel = customDialog?.querySelector('[data-action="cancel"]');
  const onCancel = (): void => customDialog?.hide();
  dialogSave?.addEventListener('click', saveAs);
  dialogCancel?.addEventListener('click', onCancel);
  dialogField('label')?.addEventListener('keydown', onSaveKey);
  let current: string | null = null;
  /** The pick was made with the panel shut, by a box or an add: it holds without it. TODO 756 */
  let shut = false;
  /** Add a node to the picked, or take it off (Shift-click, Space); with one left, it is simply picked. */
  const toggle = (id: string): void => {
    // The panel shut by the reader: what it held is no longer picked. A box or an add picks with it shut (756).
    if (inspector && !inspector.open && !shut) {
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
  /** A box picked these nodes: one, or several as a group; none shuts the panel. The panel opens for none; open, it shows the pick. TODO 756 */
  const pickBox = (ids: string[]): void => {
    multi.clear();
    for (const id of ids) multi.add(id);
    const [only] = ids;
    const node = ids.length === 1 ? graph.nodes.find((n) => n.id === only) : undefined;
    shut = !inspector?.open;
    if (node) {
      multi.clear();
      current = node.id;
      picks.peek(node, graph);
    } else if (multi.size) {
      if (inspector?.open) showMulti();
    } else picks.deselect();
  };
  const tellPicked = (connections: NodeConnection[]): void => {
    toolbar?.setAttribute('data-picked-connections', String(connections.length));
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
  // — Copy and paste: Cmd or Ctrl and C copies the picked nodes; V pastes them, and with Shift their connections too, in, between and out. Each paste is ONE step.
  const paste = (connections: boolean, by: { dx: number; dy: number }): void => {
    const clip = clipboard;
    if (!clip || readOnly()) return;
    const have: NodeClip = { nodes: clip.nodes.filter((n) => K()[n.kind]), connections: clip.connections };
    if (!have.nodes.length) return;
    let ids: string[] = [];
    edit(() => {
      const made = pasteNodes(shown(), have, { ...by, connections }, K());
      ids = made.ids;
      take(path.length ? made.workflow : editWorkflow(made.workflow, { restage: made.ids }, K()));
    });
    ids = ids.filter((id) => shown().nodes.some((n) => n.id === id));
    if (!ids.length) return;
    multi.clear();
    picks.clear();
    for (const id of ids) multi.add(id);
    markNodes(canvas, new Set(ids));
    current = null;
    if (ids.length === 1) {
      multi.clear();
      markNode(canvas, ids[0]!);
      current = ids[0]!;
      shut = !inspector?.open;
      const node = graph.nodes.find((n) => n.id === ids[0]);
      if (node) picks.peek(node, graph);
    }
  };
  /** Where a paste goes: beside what was copied, on the side with the most room; each paste after it finds the next. */
  const pasteSpot = (clip: NodeClip): { dx: number; dy: number } => {
    const sized = clip.nodes.map((n) => {
      const el = drawnOn.get(canvas)?.nodes.get(n.id);
      return { left: n.x, top: n.y, right: n.x + (el?.offsetWidth || nodeWidth(n)), bottom: n.y + (el?.offsetHeight || 120) };
    });
    const round = { left: Math.min(...sized.map((b) => b.left)), top: Math.min(...sized.map((b) => b.top)), right: Math.max(...sized.map((b) => b.right)), bottom: Math.max(...sized.map((b) => b.bottom)) };
    return placeBeside(round, nodeBoxes());
  };
  const copyPicked = (ids: readonly string[]): void => {
    const held = ids.filter((id) => !id.startsWith('#') && shown().nodes.some((n) => n.id === id));
    if (!held.length) return;
    clipboard = copyNodes(shown(), held);
  };
  // Alt and a drag on a node drags a GHOST of it, the original staying where it is; let go, a copy stands where the ghost
  // was. With Shift too, the copy keeps the connections. Escape lets go of it. Will, 2026-11-10
  const onLift = (down: PointerEvent): void => {
    if (down.button !== 0 || !down.altKey || primaryKey(down) || readOnly()) return;
    const hit = idOf(down);
    if (!hit?.header || hit.field || hit.id.startsWith('#')) return;
    const picked = pickedNodes(canvas);
    const ids = (picked.includes(hit.id) ? picked : [hit.id]).filter((id) => !id.startsWith('#'));
    if (!ids.length) return;
    // The node's own drag never starts: the original stays.
    down.preventDefault();
    down.stopPropagation();
    const ghost = ghostOf(canvas, ids);
    const zoom = canvas.view.zoom || 1;
    let by = { dx: 0, dy: 0 };
    const follow = (e: PointerEvent): void => {
      by = { dx: Math.round((e.clientX - down.clientX) / zoom), dy: Math.round((e.clientY - down.clientY) / zoom) };
      ghost.move(by.dx, by.dy);
    };
    const end = (e: Event): void => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      window.removeEventListener('pointermove', follow);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('keydown', end, { capture: true });
      ghost.remove();
      const moved = Math.hypot(by.dx * zoom, by.dy * zoom) >= 4;
      if (e.type !== 'pointerup' || !moved) return;
      const was = clipboard;
      clipboard = copyNodes(shown(), ids);
      paste(down.shiftKey || (e as PointerEvent).shiftKey, by);
      clipboard = was;
    };
    window.addEventListener('pointermove', follow);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', end, { capture: true });
  };
  const onKey = (event: KeyboardEvent): void => {
    const hit = idOf(event);
    const first = event.composedPath()[0];
    if (first instanceof Element && first.matches('input, select, textarea, [contenteditable]')) return;
    const mod = primaryKey(event) && !event.altKey;
    if (mod && !event.shiftKey && event.key.toLowerCase() === 'c' && (pickedNodes(canvas).length || hit)) {
      copyPicked(pickedNodes(canvas).length ? pickedNodes(canvas) : [hit!.id]);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (mod && event.key.toLowerCase() === 'v' && clipboard) {
      paste(event.shiftKey, pasteSpot(clipboard));
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (mod && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
      if (event.key.toLowerCase() === 'y' || event.shiftKey) redo();
      else undo();
    } else if (mod && event.key === 'Enter' && toolbar?.hasAttribute('data-can-play')) {
      // Play: Ctrl or Cmd and Enter; with Shift, Fetch. TODO 836
      if (event.shiftKey) void fetchRows('keys');
      else play('keys');
    } else if (event.key === 'Escape') {
      const connections = pickedConnections(canvas).length > 0;
      if (connections) markConnections(canvas, []);
      if (tying) setTying(false);
      else if (multi.size) {
        multi.clear();
        markNode(canvas, null);
        picks.deselect();
      } else if (pickedFrame(canvas)) {
        markFrame(canvas, null);
        if (framePanel) picks.deselect();
      } else if (path.length && !connections) back();
      else if (!connections) return;
    } else if (event.key.toLowerCase() === 't' && !mod && !event.shiftKey && !lanesOn() && (pickedConnections(canvas).length || multi.size > 1 || (hit && !hit.field))) {
      // Picked connections first; else the connections of the picked nodes.
      if (pickedConnections(canvas).length) tieConnections(pickedConnections(canvas));
      else tieNodes(multi.size > 1 ? [...multi] : [hit!.id]);
    } else if (mod && event.key.toLowerCase() === 'g') openSave();
    // F zooms to the picked nodes, or the whole graph; Shift+S frames the picked. Will, TODO 905
    else if (event.key.toLowerCase() === 'f' && !mod && !event.altKey && !event.shiftKey) zoomToPicked(canvas);
    else if (event.key.toLowerCase() === 's' && event.shiftKey && !mod && !event.altKey && pickedNodes(canvas).filter((id) => !id.startsWith('#')).length > 1) framePicked(true);
    else if (hit?.header && event.key === ' ') toggle(hit.id);
    else if (hit?.header && event.key === 'Enter' && use(hit.id)) open(hit.id);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onClick = (event: MouseEvent): void => {
    const hit = idOf(event);
    if (!hit || hit.field || !event.shiftKey || justDragged) return;
    event.preventDefault();
    event.stopPropagation();
    toggle(hit.id);
  };
  const onDouble = (event: MouseEvent): void => {
    const hit = idOf(event);
    if (!hit?.header || hit.field) return;
    if (use(hit.id)) open(hit.id);
    else openRunbook(hit.id);
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
    // Zip tie with connectors picked: it ties them, at once; else the tool goes on or off. Will, 2026-11-10
    else if ((action === 'tie' || action === 'arrange' || action === 'unfurl') && lanesOn()) report({ code: 'node-lanes', message: `${SWIMLANES_OWN}: turn them off to ${action === 'tie' ? 'tie connectors' : action}.` });
    else if (action === 'tie' && !tying && pickedConnections(canvas).length > 1) tieConnections(pickedConnections(canvas));
    else if (action === 'tie') setTying(!tying);
    else if (action === 'group') openSave();
    else if (action === 'arrange') arrangePicked(canvas);
    else if (action === 'unfurl') unfurlGraph(canvas);
    else if (action === 'fetch') void fetchRows('toolbar');
    else if (action === 'play') play('toolbar');
    else if (action === 'pause') pause();
    else if (action === 'stop') stop();
    else if (action === 'frame') framePicked();
    // Swimlanes on, a lane for each family; off, none. One step; the nodes stay where they are. Will, 2026-11-10
    else if (action === 'lanes' && !path.length && !readOnly()) {
      // On or off, each node moves to its place, as Unfurl's do, and the view eases round them all (TODO 929).
      canvas.easePieces();
      write(editWorkflow(shown(), { lanes: shown().lanes?.length ? null : LANES_BY_FAMILY }, K()));
      requestAnimationFrame(() => requestAnimationFrame(() => canvas.fit(undefined, { ease: true })));
    }
  };
  toolbar?.addEventListener('toolbar-select', onTool);
  const unarrange = watchArrange(canvas, toolbar, () => !readOnly() && !lanesOn(), ['data-can-arrange']);
  const unframe = watchArrange(canvas, toolbar, () => !readOnly(), ['data-can-frame']);
  const unview = watchView(canvas, toolbar);
  tell();
  canvas.addEventListener('keydown', onKey, { capture: true });
  canvas.addEventListener('pointerdown', onLift, { capture: true });
  canvas.addEventListener('click', onClick, { capture: true });
  canvas.addEventListener('dblclick', onDouble);

  // A use's inside, drawn: its Outgoing JSON says the condition it sends, read there. TODO 776
  const innerGraph = (node: GraphNode): DrawnGraph | undefined => {
    const use = innerOf(node, lib, K());
    return use && workflowGraph(use.workflow, facts, use.kinds);
  };
  /** Every tag the app's Custom Nodes have: what a Tags field offers. */
  const knownTags = (): string[] => [...new Set(Object.values(lib.nodes).flatMap((d) => tidyTags(d.tags)))].sort();
  /** The definition a Tags field edits: a use's; inside an opened one, its Group Input's and Output's. */
  const taggedBy = (node: Pick<GraphNode, 'id'>): string | undefined => (node.id.startsWith('#') ? path.at(-1)?.kind : use(node.id)?.kind);
  /** A Group Input or Output of the open entity itself: its Tags field is the entity's own. TODO 828 */
  const ownTagged = (node: Pick<GraphNode, 'id'>): boolean => !!own && !path.length && node.id.startsWith('#');
  /** The Tags row: the DEFINITION's tags, which every use shares; read only for a preset. TRAP T-a-custom-node-is-an-instance */
  const tagsRow = (node: GraphNode): GraphRow[] => {
    const id = taggedBy(node);
    const definition = id ? lib.nodes[id] : undefined;
    const mine = ownTagged(node);
    if (!definition && !mine) return [];
    const locked = mine ? preset : !!definition?.preset;
    return [{
      name: '#tags', label: 'Tags', control: 'tags', multiple: true, value: mine ? [...ownTags] : tidyTags(definition?.tags), editable: !readOnly() && !locked,
      choices: knownTags().map((value) => ({ value, label: value })),
      hint: locked ? 'The Custom Node\'s own tags, read only: it is a preset' : 'The Custom Node\'s own tags: every use of it shares them',
    }];
  };
  // The inspector leads with the node's own name, line and place; a Custom Node's tags after its line.
  const withOwn = (node: GraphNode): GraphNode => {
    const tags = tagsRow(node);
    if (node.id.startsWith('#')) return tags.length ? { ...node, rows: [...tags, ...node.rows] } : node;
    const editable = !readOnly();
    const own: GraphRow[] = [
      { name: '#heading', label: 'Name', control: 'text', value: node.heading, editable },
      { name: '#description', label: 'Description', control: 'text', value: node.description ?? '', editable },
      ...tags,
    ];
    // A named portal: Rename, on every portal of its name, so its links stay. TODO 779
    const portal = portalOf(node);
    const rename: GraphRow[] = portal?.name ? [{ name: '#rename', label: 'Rename', control: 'text', value: portal.name, editable, hint: `Every portal named "${portal.name}" takes the new name` }] : [];
    return { ...node, rows: [...own, ...node.rows, ...rename] };
  };
  /** An Output's inspector: the values its messages can name, each one's sample from the last simulation, and Send a test,
   *  asked of the host as `output-test`: Sherpa sends nothing. Plan 891 */
  const outputFacts = (node: GraphNode): OutputFacts => {
    const flow = shown();
    const ran = simulation?.result.nodes;
    const held = flow.nodes.find((n) => n.id === node.id);
    const sample = (key: string): unknown => {
      const part = valuesIn(key)[0];
      const out = part && ran?.[part.node]?.outgoing;
      if (!part || !out) return undefined;
      const slot = out.find((s) => s.socket === `${part.node}/${part.name}`);
      return slot ? slot.value ?? slot.rows?.length : out.find((s) => s.rows?.length)?.rows?.[0]?.[part.name];
    };
    const type = typeOf(K()[node.kind] ?? {}, held?.values?.['type'])?.id;
    return {
      sources: valuesAt(flow.nodes, portalFlow(flow.nodes, flow.connections ?? []).connections, node.id, K(), facts.fieldsOf), sample, simulated: !!ran,
      onTest: () => canvas.dispatchEvent(new CustomEvent('output-test', { bubbles: true, composed: true, detail: { node: node.id, ...(type ? { type } : {}), values: { ...held?.values } } })),
    };
  };
  const fillInspector = (node: GraphNode, now: DrawnGraph, tabs?: InspectOptions['tabs']): void => {
    inspectNode(inspector!, withOwn(node), now, {
      onEdit, extra: extraFor(node), ...(doc?.visual ? { visual: doc.visual(node) } : {}), ...(readOnly() ? {} : { onCut: onBreak }), ...(tabs ? { tabs } : {}), flow: { inner: innerGraph },
      ...(simulation?.result.nodes[node.id] ? { data: { node: simulation.result.nodes[node.id]!, stale: simulation.stale } } : {}),
      ...(node.kind === 'output' && !doc ? { output: outputFacts(node) } : {}),
      // With no pointer: beside the node it feeds, one column left, on the row's own line.
      onCustom: (row) => {
        const at = shown().nodes.find((n) => n.id === node.id);
        customAt(`${node.id}/${row.name}`, { x: (at?.x ?? 0) - 360, y: (at?.y ?? 0) + 72 + node.rows.indexOf(row) * 64 });
      },
      ...(readOnly() || node.id.startsWith('#') ? {} : { onRemove: () => onRemove(node.id) }),
    });
  };
  const picks = pickedIn(canvas, inspector, (node, now) => {
    current = node.id;
    shut = false;
    framePanel = null;
    markActive(canvas, null);
    fillInspector(node, now);
  }, () => {
    multi.clear(); current = null; active = null; shut = false;
    // The panel shut on a frame: the frame is let go too.
    if (framePanel) markFrame(canvas, null);
    framePanel = null;
  }, () => {
    if (framePanel) return release(framePanel);
    const ids = multi.size ? [...multi] : current ? [current] : [];
    if (ids.length && !readOnly()) onRemoveNodes(ids, []);
  });
  keepOpen(inspector);
  // — Fetch and Simulate (836): a press reads each Source on a path once, at the cap, and runs the graph on the rows kept.
  //   Nothing fetches on its own, and an edit never runs a simulation: it only marks the last one stale.
  let simulation: { result: Simulated; stale: boolean; sig: string; times: Record<string, number> } | undefined;
  /** What a simulation reads of the graph: its nodes' kinds and values and its connections, never a place. */
  const dataSig = (): string => JSON.stringify([shown().nodes.map((n) => [n.id, n.kind, n.values]), shown().connections]);
  /** Each Source's store id, by node. */
  const storesOf = (): Map<string, string> => new Map(graph.nodes.flatMap((n) => {
    const store = isSource(n) ? n.rows.find((r) => r.control === 'store')?.value : undefined;
    return typeof store === 'string' && store ? [[n.id, store] as const] : [];
  }));
  const storeFor = async (id: string): Promise<Store | undefined> => facts.storeOf?.(id);
  /** The rows kept for each store the graph names, and where a fetch stopped at the cap. */
  const cachedRows = async (): Promise<{ rows: Record<string, readonly Row[]>; partial: Record<string, string>; any: boolean }> => {
    const rows: Record<string, readonly Row[]> = {};
    const partial: Record<string, string> = {};
    for (const id of new Set(storesOf().values())) {
      const store = await storeFor(id);
      const cache: SourceCache | undefined = store ? await cachedSource(store, id) : undefined;
      if (!cache) continue;
      rows[id] = cache.rows;
      if (cache.partial || cache.stale) partial[id] = sourceWords(cache);
    }
    return { rows, partial, any: Object.keys(rows).length > 0 };
  };
  const showData = (): void => {
    if (multi.size > 1 && inspector?.open) showMulti();
    else picks.follow(graph);
  };
  // — The running look: the node a task is on wears the step's tab on its top edge and the active border, and says how long
  //   the task has run, which the task's own history gives. One look for every kind of task. TODO 845
  let lit: { kind: string; ids: readonly string[] } | undefined;
  /** The simulation in hand: its play, pause and stop. TODO (Will, 2026-11-06) */
  let control: SimulationControl | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;
  /** The task of this graph that is queued or running. */
  const activeTask = (): Task | undefined => queue.list().find((t) => t.key === taskKey && t.state !== 'ok' && t.state !== 'failed');
  const paintRunning = (): void => {
    if (!lit) return;
    const started = activeTask()?.history.find((h) => h.state === 'running')?.at ?? Date.now();
    const seconds = Math.max(1, Math.ceil((Date.now() - started) / 1000));
    const held = control?.paused === true;
    for (const id of lit.ids) {
      const el = drawnOn.get(canvas)?.nodes.get(id);
      el?.setAttribute('data-step', 'running');
      if (el) put(el, 'data-caption', held ? 'Paused here' : `${lit.kind === 'fetch' ? 'Fetching' : 'Simulating'}… ${seconds}s`);
    }
  };
  /** Take the look off the node it was on, and put it on these. */
  const runningOn = (kind: string, ids: readonly string[]): void => {
    for (const id of lit?.ids ?? []) if (!ids.includes(id)) {
      const el = drawnOn.get(canvas)?.nodes.get(id);
      el?.removeAttribute('data-step');
      el?.removeAttribute('data-caption');
    }
    lit = { kind, ids };
    paintRunning();
    tick ??= setInterval(paintRunning, 1000);
  };
  const runningOff = (): void => {
    runningOn('', []);
    lit = undefined;
    clearInterval(tick);
    tick = undefined;
  };
  /** Each node's light after a simulation, on its tab: the rows it heard and said, and its time; "stale" once an edit changed the graph. */
  const lightNodes = (): void => {
    if (!simulation) return;
    for (const [id, node] of Object.entries(simulation.result.nodes)) {
      const el = drawnOn.get(canvas)?.nodes.get(id);
      if (!el) continue;
      el.setAttribute('data-step', 'done');
      put(el, 'data-caption', `${lightOf(node, simulation.times[id] ?? 0)}${simulation.stale ? ' · stale' : ''}`);
      put(el, 'data-warning', graph.nodes.find((n) => n.id === id)?.warnings?.map((w) => w.words).join('\n'));
    }
  };
  /** Take the lights off. */
  const unlightNodes = (): void => {
    for (const id of Object.keys(simulation?.result.nodes ?? {})) {
      const el = drawnOn.get(canvas)?.nodes.get(id);
      el?.removeAttribute('data-step');
      el?.removeAttribute('data-caption');
      if (el) put(el, 'data-warning', graph.nodes.find((n) => n.id === id)?.warnings?.map((w) => w.words).join('\n'));
    }
  };
  /** Run the graph on the rows kept, and show it: node by node, the page let draw between them when one takes a while. */
  const runSimulation = async (): Promise<{ nodes: number; faults: number; stopped: boolean }> => {
    const { rows, partial, any } = await cachedRows();
    const run = beginSimulation(graph, rows, { partial, inner: innerGraph });
    const times: Record<string, number> = {};
    let result: Simulated;
    const mine = new SimulationControl();
    control = mine;
    try {
      result = await stepSimulation(run, {
        control: mine,
        onStep: (id) => runningOn('simulate', [id]),
        onDone: (id, ms) => { times[id] = ms; },
        // Paused: the node it stopped at says so, and the toolbar's Play and Pause swap.
        onPause: (held) => {
          toolbar?.toggleAttribute('data-paused', held);
          paintRunning();
        },
        pause: () => new Promise<void>((done) => setTimeout(done, 0)),
      });
    } finally {
      control = undefined;
      toolbar?.removeAttribute('data-paused');
      runningOff();
    }
    simulation = { result, stale: false, sig: dataSig(), times };
    lightNodes();
    toolbar?.toggleAttribute('data-cached', any);
    showData();
    return { nodes: Object.keys(result.nodes).length, faults: result.faults.length, stopped: mine.stopped };
  };
  // The tasks: one queue (the app's, or this editor's own), one key for this graph, so a second press is blocked. TODO 843
  const queue = facts.tasks ?? new TaskQueue();
  const taskKey = `graph:${workflow.id}`;
  const notify = facts.notify ?? ((words: string, status: 'success' | 'critical' | 'info'): void => void SherpaToast.show(words, status));
  const ours = (task: Task): boolean => task.key === taskKey;
  const over = (task: Task | undefined): boolean => task?.state === 'ok' || task?.state === 'failed';
  /** Settles when a task ends. */
  const ended = (id: string): Promise<void> => new Promise((done) => {
    const hear = (event: Event): void => {
      const task = (event as CustomEvent<Task>).detail;
      if (task.id !== id || !over(task)) return;
      queue.removeEventListener('task-change', hear);
      done();
    };
    queue.addEventListener('task-change', hear);
    if (over(queue.get(id))) hear(new CustomEvent('task-change', { detail: queue.get(id) }));
  });
  /** Ask for a task of this graph; a second while one runs is blocked, and said. */
  const request = async (kind: 'fetch' | 'simulate', by: string, run: Parameters<TaskQueue['submit']>[0]['run']): Promise<void> => {
    if (path.length || !routeRead(graph, { inner: innerGraph }).ok) return;
    const { task, accepted } = queue.submit({ kind, requestedBy: by, key: taskKey, run });
    if (accepted) await ended(task.id);
  };
  const simulate = (by = 'host'): Promise<void> => request('simulate', by, async () => {
    const { nodes, faults, stopped } = await runSimulation();
    return { words: `${stopped ? 'Stopped after' : 'Simulated'} ${nodes} nodes${faults ? `, ${faults} to look at` : ''}.` };
  });
  /** Play: start a simulation, or go on from the node a paused one waits at. */
  const play = (by: string): void => {
    if (control?.paused) {
      control.play();
      toolbar?.removeAttribute('data-paused');
    } else void simulate(by);
  };
  /** Pause: the node in hand finishes, and nothing goes on until Play. */
  const pause = (): void => {
    if (!control || control.paused) return;
    control.pause();
    toolbar?.setAttribute('data-paused', '');
    paintRunning();
  };
  /** Stop: the run ends, the nodes done keep their lights. */
  const stop = (): void => {
    control?.stop();
    toolbar?.removeAttribute('data-paused');
  };
  const fetchRows = (by = 'host'): Promise<void> => request('fetch', by, async ({ signal, state }) => {
    const stores = storesOf();
    const said: string[] = [];
    for (const id of routeRead(graph, { inner: innerGraph }).sources) {
      const name = stores.get(id);
      const store = name ? await storeFor(name) : undefined;
      if (!name || !store) throw new Error(`the Source "${id}" names a store the page cannot reach`);
      state(`reading ${name}`);
      runningOn('fetch', [...stores].filter(([, s]) => s === name).map(([node]) => node));
      let cache: SourceCache;
      try {
        cache = await fetchSource(store, name, { ...(facts.fetchLimit ? { limit: facts.fetchLimit } : {}), signal });
      } finally {
        runningOff();
      }
      said.push(`${name}: ${sourceWords(cache)}`);
    }
    state('simulating');
    await runSimulation();
    return { words: `Fetched. ${said.join(' ')}` };
  });
  /** The button shows it is busy while its task is queued or running. */
  const tellBusy = (): void => {
    for (const [kind, flag] of [['fetch', 'data-fetching'], ['simulate', 'data-simulating']] as const) {
      toolbar?.toggleAttribute(flag, queue.list({ kind }).some((t) => ours(t) && !over(t)));
    }
  };
  const onChange = (event: Event): void => { if (ours((event as CustomEvent<Task>).detail)) tellBusy(); };
  const onBlocked = (event: Event): void => {
    const task = (event as CustomEvent<Task>).detail;
    if (ours(task)) notify(`${task.kind === 'fetch' ? 'Fetch' : 'Simulate'} is still running: wait for it to end.`, 'info');
  };
  const onNotice = (event: Event): void => {
    const notice = (event as CustomEvent<TaskNotice>).detail;
    const mine = notice.tasks.filter(ours);
    if (!mine.length) return;
    const failed = mine.filter((t) => t.state === 'failed').length;
    const words = mine.length === notice.tasks.length ? notice.words : mine.length === 1 ? (mine[0]!.outcome?.words ?? `${mine[0]!.kind} ${mine[0]!.state}`) : `${mine.length} tasks finished${failed ? `, ${failed} failed` : ''}`;
    notify(words, failed ? 'critical' : 'success');
  };
  queue.addEventListener('task-change', onChange);
  queue.addEventListener('task-blocked', onBlocked);
  queue.addEventListener('task-notice', onNotice);
  // Fetch and Simulate wait for a path from a Source to an Output; inside a Custom Node's definition they wait for its use. TODO 836
  const tellPath = (): void => {
    const read = doc?.runs ? { ok: false, why: doc.runs }
      : path.length ? { ok: false, why: 'Open the graph that uses this Custom Node: Fetch and Simulate run on a whole graph' } : routeRead(graph, { inner: innerGraph });
    for (const flag of ['data-can-fetch', 'data-can-play']) toolbar?.toggleAttribute(flag, read.ok);
    if (read.ok || !read.why) toolbar?.removeAttribute('data-route-why');
    else toolbar?.setAttribute('data-route-why', read.why);
  };
  function draw(): void {
    if (path.length && !innerNow()) path = [];
    const ro = readOnly();
    const body = doc ? doc.graph(shown()) : workflowGraph(shown(), facts, K());
    graph = ro ? { ...body, nodes: body.nodes.map((n) => ({ ...n, rows: n.rows.map((r) => ({ ...r, editable: false })) })) } : body;
    // Swimlanes on: the tie tool goes off, and the ties are hidden, not gone.
    const laning = lanesOn();
    if (laning && tying) {
      tying = false;
      toolbar?.removeAttribute('data-tie');
    }
    toolbar?.toggleAttribute('data-can-tie', !laning);
    drawGraph(canvas, laning ? { ...graph, ties: [] } : graph, {
      onEdit, onMove, onResize, onConnect, onReconnect, onBreak, onCustom, onDeselect: picks.deselect, opens: (node) => !!use(node.id),
      ...(ro ? {} : { onMoveMany, onArrange }),
      onBox: pickBox, onPicked: tellPicked, onBendPicked: (pick) => toolbar?.toggleAttribute('data-picked-bend', !!pick),
      ...(ro ? {} : { tying, onTie, onTieMove, onUntie, onBreakAll, onBend, onUnbend, onTieDrop, onRemove: onRemoveNodes, onRelease: release }),
      onFrameSelect,
      onSelect: (node) => {
        multi.clear();
        picks.select(node, graph);
      },
      notes: new Map(staleUses(shown(), lib).map((id) => [id, 'Update available'])),
      locked: (node) => ro || node.id.startsWith('#'),
      ...(panel && !ro ? { onAdd: (context: AddContext) => panel.askAdd(context) } : {}),
      // A collapsed or expanded node changes height: its lane fits again.
      onCollapse: () => { if (!path.length && shown().lanes?.length) write(shown()); },
    });
    stages.draw();
    const laned = path.length ? null : shown();
    drawLanes(canvas, laned, heightOf, K());
    // A node's height lands when its parts render: the lanes draw again then.
    requestAnimationFrame(() => drawLanes(canvas, path.length ? null : shown(), heightOf, K()));
    toolbar?.toggleAttribute('data-can-lanes', !path.length && !ro);
    toolbar?.toggleAttribute('data-lanes', !!laned?.lanes?.length);
    toolbar?.toggleAttribute('data-can-unfurl', !ro && !laning && graph.nodes.filter((n) => !n.id.startsWith('#')).length > 1);
    unarrange.tell();
    tellPath();
    if (simulation && !simulation.stale && simulation.sig !== dataSig()) {
      simulation.stale = true;
      lightNodes();
    }
    trail();
    if (multi.size > 1 && inspector?.open) showMulti();
    else if (framePanel && !(shown().frames ?? []).some((f) => f.id === framePanel)) picks.deselect();
    else if (framePanel && inspector?.open) showFrame(framePanel);
    else picks.follow(graph);
  }
  // A document changed from outside the editor (a chip, Apply, another tab): read again, and keep it as a step.
  const unwatchDoc = doc?.watch(() => {
    if (docWriting) return;
    const before: Snap = { draft, defs: {}, tags: ownTags, doc: docLast };
    draft = docRead = doc.read();
    const now = doc.snapshot();
    if (!same(now, docLast)) journal.push({ before, after: { draft, defs: {}, tags: ownTags, doc: now } });
    docLast = now;
    draw();
    tell();
  });
  const unlights = doc?.lights?.(canvas);
  canvas.addEventListener('pointerdown', onPress, { capture: true });
  window.addEventListener('pointermove', onPointerMove, { capture: true });
  window.addEventListener('pointerup', onLetGo);
  window.addEventListener('pointercancel', onLetGo);
  // A graph, as it opens, frames all its nodes, centred: also one picked after another on the same canvas, whose view the
  // last left (Will, TODO 932). Its nodes' first sizes fit it; a frame after the first draw fits what was drawn the same.
  const shownBefore = drawnOn.get(canvas);
  if (shownBefore) shownBefore.fitted = false;
  const viewAtBind = JSON.stringify(canvas.view);
  draw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const made = drawnOn.get(canvas);
    // Not where its host has set the view since.
    if (made && !made.fitted && made.nodes.size && JSON.stringify(canvas.view) === viewAtBind) {
      made.fitted = true;
      canvas.fit();
    }
  }));
  // A run lights its nodes: each step names its node, and the run its workflow. N4 reports.
  const unwatch = watchSteps(canvas, { claims: (span) => span.detail?.['graph'] === workflow.id });
  return {
    save(): boolean {
      // A document saves itself: what it hands over, or nothing where it may not be saved.
      if (doc) {
        const out = doc.save();
        if (out === false || out === undefined) return false;
        handOver(canvas, out as PageDefinition | WorkflowDefinition);
        return true;
      }
      // Save writes the final graph: what the draft keeps for a node's other types stays behind.
      const final = finalGraph(draft, topKinds());
      const finished = { ...lib, nodes: { ...lib.nodes, ...Object.fromEntries([...dirty].flatMap((id) => (lib.nodes[id] ? [[id, finalGraph(lib.nodes[id]!, topKinds())]] : []))) } };
      // A graph with a fault does not save: each fault is said, and `definition-refused` carries them to the app. TODO 835
      if (!checkWorkflow(final, topKinds(), facts)) {
        canvas.dispatchEvent(new CustomEvent('definition-refused', { detail: { faults: workflowFaults(final, topKinds(), facts) }, bubbles: true, composed: true }));
        return false;
      }
      if (dirty.size && !checkNodeLibrary(finished, kinds, facts)) return false;
      draft = final;
      lib = finished;
      handOver(canvas, draft);
      for (const id of dirty) if (lib.nodes[id]) onSaveNode?.(id, structuredClone(lib.nodes[id]!));
      // The definitions hold them now: the drafts go.
      dirty.clear();
      handed = lib;
      original = draft;
      handedTags = ownTags;
      session?.set(tagsAt, undefined);
      session?.set(editsAt, undefined);
      session?.set(pointer, undefined);
      return true;
    },
    discard(): void {
      draft = original;
      lib = handed;
      ownTags = handedTags;
      session?.set(tagsAt, undefined);
      dirty.clear();
      journal.clear();
      lastTag = '';
      tell();
      path = [];
      session?.set(editsAt, undefined);
      session?.set(pointer, undefined);
      readHeld();
      refreshPanel();
      enter(null);
    },
    open,
    back,
    refresh(next: NodeLibrary): void {
      given = next;
      // Its own tags follow another tab's save, unless this tab's draft has its own.
      if (own && JSON.stringify(ownTags) === JSON.stringify(handedTags)) ownTags = handedTags = tidyTags(next.nodes[own]?.tags);
      handed = next;
      lib = { ...next, nodes: { ...next.nodes, ...edits() } };
      refreshPanel();
      draw();
    },
    library: () => lib,
    path: () => path.map((s) => s.use),
    workflow: () => draft,
    fetch: () => fetchRows(),
    simulate: () => simulate(),
    simulation: () => (simulation ? { result: simulation.result, stale: simulation.stale } : undefined),
    tags: () => (own ? ownTags : undefined),
    undo,
    redo,
    can: () => ({ undo: journal.canBack, redo: journal.canForward }),
    stop(): void {
      unwatch();
      unarrange();
      unframe();
      unview();
      stages.stop();
      unwatchDoc?.();
      unlights?.();
      drawLanes(canvas, null, heightOf, K());
      for (const flag of ['data-can-lanes', 'data-lanes']) toolbar?.removeAttribute(flag);
      canvas.removeEventListener('pointerdown', onPress, { capture: true });
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('pointerup', onLetGo);
      window.removeEventListener('pointercancel', onLetGo);
      for (const task of queue.list()) if (ours(task)) queue.cancel(task.id);
      runningOff();
      unlightNodes();
      queue.removeEventListener('task-change', onChange);
      queue.removeEventListener('task-blocked', onBlocked);
      queue.removeEventListener('task-notice', onNotice);
      panel?.removeEventListener('node-add', onAdded);
      toolbar?.removeEventListener('toolbar-select', onTool);
      toolbar?.removeAttribute('data-tie');
      toolbar?.removeAttribute('data-can-group');
      toolbar?.removeAttribute('data-can-unfurl');
      for (const flag of ['data-can-fetch', 'data-can-play', 'data-route-why', 'data-cached', 'data-fetching', 'data-simulating', 'data-paused']) toolbar?.removeAttribute(flag);
      dialogSave?.removeEventListener('click', saveAs);
      dialogCancel?.removeEventListener('click', onCancel);
      dialogField('label')?.removeEventListener('keydown', onSaveKey);
      canvas.removeEventListener('keydown', onKey, { capture: true });
      canvas.removeEventListener('pointerdown', onLift, { capture: true });
      canvas.removeEventListener('click', onClick, { capture: true });
      canvas.removeEventListener('dblclick', onDouble);
      header?.removeEventListener('breadcrumb-select', onCrumb);
      header?.removeEventListener('graph-reset', reset);
      resetBar()?.removeAttribute('data-reset-graph');
      resetBar()?.removeAttribute('data-graph-unchanged');
      picks.stop();
    },
  };
}
