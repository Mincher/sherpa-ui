/**
 * node-graph.ts — a graph of nodes drawn on a sherpa-layout-canvas, and the two editors kept
 * drawn there: a page's Query, which each edit ASKS, and a workflow, whose draft each edit
 * writes. Places last the tab; Save hands the app a checked definition. Each node lights as
 * its step runs, from the one trace stream. A workflow's Custom Node opens, is edited as its
 * definition, updates its uses, and is made from picked nodes. A zip tie funnels routes through one place (plan 562); a frame
 * holds picked nodes in a column under one header (plan 778). A picked portal lights every portal of its name (plan 779).
 * Unfurl lays the whole graph out round its hub (plan 569). Will, TODOs 555, 551, 671, 719, 562, 735, 778, 779, 569.
 * TRAP T-the-node-editor-asks-the-query · TRAP T-a-step-names-its-node · TRAP T-a-frame-is-drawn-round-its-nodes
 * TRAP T-a-portal-hop-is-resolved-once · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 * TRAP T-a-task-queue-knows-nothing-of-what-it-runs
 *
 * Map:
 * - DrawOptions — What a drawing tells its host: each edit, each node a reader picks or moves, and each new route.
 * - tieSpot — Where routes would be tied with no pointer: the middle of the way each takes, on the plane.
 * - drawGraph — Draw a graph on a canvas: each node by id, at its place when that moved; then its routes.
 * - markNode — Mark one node as the one picked, or none.
 * - markFrame — Mark one frame as the one picked, or none: no node is picked with it.
 * - pickedFrame — The frame picked, by id, or none.
 * - pickedNodes — The nodes picked, by id: a click, a box, or the keys.
 * - arrangement — Where these nodes go, from the boxes they are drawn in: a grid, or one column.
 * - arrangePicked — Lay the picked nodes out on a grid and hand the host the places: one move, ties and bends with it.
 * - unfurlment — Where every node goes when the graph is unfurled, from the boxes, frames and socket heights drawn.
 * - unfurlGraph — Unfurl the whole graph and hand the host the places: one step; the view fits it after.
 * - watchArrange — Tell a toolbar, in `data-can-arrange` and any flag given, when two or more nodes are picked.
 * - markNodes — Mark several nodes as the ones picked.
 * - markActive — Mark the one picked node whose panel is shown, in a stronger ring.
 * - markRoutes — Mark routes as the ones picked.
 * - pickedRoutes — The routes picked: by a click, a box, or the keys.
 * - WatchOptions — What a graph's watch is told: which traces are its, and which node each span lights.
 * - watchSteps — Light a canvas's nodes from the one trace stream as their steps run; its stop lets it go.
 * - InspectOptions — What an inspector shows beside a node's rows, and whom it tells of an edit.
 * - inspectNode — Fill an overlay panel with one node: its rows again, their routes, and a visual.
 * - inspectNone — The inspector with nothing picked: its empty state, in place of a node.
 * - Inspector — The overlay panel a picked node opens in.
 * - GraphEditor — What an editor's binding gives back: Save, and the undo.
 * - Undoable — An editor whose edits are steps.
 * - WorkflowEditor — A workflow's editor: Save and stop, and the Custom Nodes it opens, discards and holds.
 * - QueryEditorOptions — What drawing a page's Query needs beyond its source: its definition, an inspector, a session.
 * - bindQueryEditor — Keep a page's Query drawn on a canvas as it changes, and ask it for each edit.
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
import { boxCover, boxPick, type BoxMode, type PickBox } from './box-pick.js';
import { dotsThrough, handlesOf, pathThrough, piece, waypointsOf, type Pt } from './route-path.js';
import { bendFault, clampBend, clampedVia, dropBend, placeBend, type Bend } from '../data/route-bends.js';
import type { SocketSide } from '../../components/sherpa-node/node-sockets.js';
import type { SessionStore } from '../browser/session.js';
import type { DataSource } from '../data/data-source.js';
import { Journal, type Change } from '../data/journal.js';
import type { Query } from '../data/query.js';
import { checkPage, pageWithQuery, type PageDefinition } from '../data/page-definition.js';
import { graphRequest, keptEdit, placeRequest, queryGraph, queryStepNode, routeRequest, statusTallies, traceQuerySteps, type KeptSource, type QueryGraphFacts } from '../data/query-graph.js';
import { onTrace, type Span, type StepState, type TraceHost } from '../data/trace.js';
import { VIEW } from '../data/query.js';
import { valueKey } from '../data/store.js';
import { report } from '../data/report.js';
import {
  checkNodeLibrary, copyToMine, definitionDiff, editDefinition, innerOf, kindsOf, staleUses, tagDefinition, updateAll, updateInstance, useOf, workflowFaultsDeep,
  type Inner, type NodeDefinition, type NodeLibrary,
} from '../data/node-library.js';
import { tidyTags } from '../data/tags.js';
import { groupNodes, headerInput, heldInputs, ungroupUse } from '../data/node-group.js';
import { entityKind, entityRefOf, type EntityRef } from '../data/entity.js';
import { PRESET_FILTER, offeredKinds } from '../data/entity-types.js';
import { dataPane, flowPane, instancePane, updatePane } from './node-group-panel.js';
import { arrangeNodes, type Arranged } from '../data/node-arrange.js';
import { unfurlNodes } from '../data/node-unfurl.js';
import { isSource, pathRead } from '../data/node-paths.js';
import { lightOf, trueOf, simulation as beginSimulation, stepSimulation, SimulationControl, type Simulated, type SimulatedNode } from '../data/node-simulate.js';
import { cachedSource, fetchSource, sourceWords, type SourceCache, type SourceLimit } from '../browser/source-cache.js';
import type { Row, Store } from '../data/store.js';
import { TaskQueue, type Task, type TaskNotice } from '../data/task-queue.js';
import { SherpaToast } from '../../components/sherpa-toast/sherpa-toast.js';
import type { FramedGraph, NodeFrame } from '../data/node-frames.js';
import { nodeFlow, type ConditionFacts } from '../data/node-flow.js';
import { portalLinks, portalOf } from '../data/node-portals.js';
import type { FieldType } from '../data/filter-state.js';
import { formatDateTime, isDateTime, readDateTime } from '../data/format-date.js';
import {
  FALSE_SOCKET, NODE_KINDS, categorySlug, fitOf, paletteOf, placed, rowChoices, socketOf, socketType,
  type DrawnGraph, type GraphEdit, type GraphNode, type GraphRow, type NodeKind, type NodePlaces, type NodeSize, type NodeRoute, type NodeTie, type SocketType,
} from '../data/node-kinds.js';
import {
  NODE_WIDTH, TIE_GAP, addCustomValue, checkWorkflow, editWorkflow, finalGraph, readWorkflow, tieLimit, workflowFaults, workflowGraph,
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
  /** Picked nodes moved together by one drag or key, each to its new place: the host writes ONE step (TODO 752). */
  onMoveMany?: (moves: { id: string; x: number; y: number }[]) => void;
  /** The picked nodes arranged on a grid: where each goes, and each tie. One step (TODO 752). */
  onArrange?: (placed: Arranged) => void;
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
  /** A bend point of a route moved, or (`insert`) put in at an index: where, on the plane (TODO 744). */
  onBend?: (route: NodeRoute, at: number, x: number, y: number, insert: boolean, drag: number) => void;
  /** A picked bend point removed. */
  onUnbend?: (route: NodeRoute, index: number) => void;
  /** A connector line dragged onto a zip tie: it is added to the tie. */
  onTieDrop?: (id: string, route: NodeRoute) => void;
  /** The bend point picked, or none: the editor says so. */
  onBendPicked?: (pick: { route: NodeRoute; index: number } | null) => void;
  /** A click on blank canvas: no node is picked, the panel shuts (TODO 559). */
  onDeselect?: () => void;
  /** A box dragged on the blank canvas picked these nodes (TODO 735); the routes it crossed are picked and drawn. */
  onBox?: (nodes: string[]) => void;
  /** The picked routes changed: a click, a box, or a key. */
  onPicked?: (routes: NodeRoute[]) => void;
  /** Picked routes cut with Delete or Backspace, as one edit; unset, each goes to `onBreak`. */
  onBreakAll?: (routes: NodeRoute[]) => void;
  /** Delete or Backspace with nodes picked: these nodes and these routes, as one edit. Unset, a node stays. */
  onRemove?: (nodes: string[], routes: NodeRoute[]) => void;
  /** A line dragged out of an unrouted picklist's input socket and let go on the bare canvas, at a place on the plane. */
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
}

/** A field a row draws: a text field, a select or tags, a menu of ticks (a quick-filter chip), or a switch. */
type Field = HTMLElement & {
  value: unknown; values?: string[]; tags?: readonly string[]; suggestions?: readonly { value: string; label?: string }[];
  menu?: HTMLElement & { populate(items: unknown): void }; checked?: boolean; populate?(items: unknown): void;
};

/** The events a field says its change by: its own `change`, or a chip's pick. */
const CHANGES = ['change', 'quick-filter-change'] as const;

/** What a canvas has drawn: each node and row by its address, the lines, and the routes they draw. */
interface Drawn {
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
  /** The bend point picked (`index` in `via`): Delete removes it, the arrows move it. `proposed`: the mid-point dot
   *  of an unbent route, in no `via` until an arrow moves it in at `index`. */
  handle: { route: NodeRoute; index: number; proposed?: true } | null;
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
}

const drawnOn = new WeakMap<HTMLElement, Drawn>();
let shadows = 0;

/** How a row's value reads: a direction in full. */
function shown(row: GraphRow): string {
  const value = row.value;
  if (value === undefined || value === null) return '';
  if (row.control === 'direction') return value === 'desc' ? 'Descending' : value === 'asc' ? 'Ascending' : String(value);
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/** Set an attribute, or take it away when there is nothing to say. */
/** The header's words when a simulation finds no row true. */
const NO_TRUE = 'No true matches: no row passes this test, so nothing reaches True.';

function put(el: Element, name: string, value: string | undefined): void {
  if (value === undefined || value === '') el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** A row's field: a switch, a menu of ticks, a select of its choices, or a text or number field.
 *  LOCKED — read only — where a route drives it, or nothing outside takes its change. */
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

function fieldFor(row: GraphRow, locked: boolean): Field {
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

/** Give a field its row's value, and its words: its fault, red, in the field's own message. TRAP T-a-row-says-its-own-fault */
function fill(field: Field, row: GraphRow, note?: string): void {
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

/** The input addresses a route drives: their fields mirror what comes in, read only. */
function driven(graph: DrawnGraph): Set<string> {
  return new Set(graph.routes.map((r) => r.to));
}

/** One node's rows, made again when their shape changed and given their values. */
function drawRows(drawn: Drawn, el: HTMLElement, node: GraphNode): void {
  const routed = driven(drawn.graph);
  const sent = new Set(drawn.graph.routes.map((r) => r.from));
  const locked = (row: GraphRow): boolean => !row.editable || routed.has(`${node.id}/${row.name}`);
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
      if (row.control) line.append(fieldFor(row, locked(row)));
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
      ...(node.rows.some((r) => r.property) ? section(titled('Properties'), ...lines(node.rows.filter((r) => r.property))) : []),
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
    if (!row.beside) line.toggleAttribute('data-input-routed', routed.has(address));
    if (!worn.has(row.name) || row.beside) line.toggleAttribute('data-output-routed', sent.has(address));
    const field = line.firstElementChild as Field | null;
    if (row.beside) continue;
    if (field) fill(field, row);
    // A row with no field says what it reads; one that reads null, only its name.
    else {
      line.setAttribute('data-label', row.control === undefined && row.value != null ? `${row.label}: ${shown(row)}` : row.label);
      line.toggleAttribute('data-property', !!row.property);
    }
  }
}

/** A socket's middle, on the canvas's plane. */
function onPlane(canvas: SherpaLayoutCanvas, rect: DOMRect): [number, number] {
  const box = canvas.getBoundingClientRect();
  const { x, y, zoom } = canvas.view;
  return [(rect.left + rect.width / 2 - box.left - x) / zoom, (rect.top + rect.height / 2 - box.top - y) / zoom];
}

/** A route's curve on the plane: out of one socket, into the next. */
function curve(from: Pt, to: Pt): string {
  return `M ${from[0]} ${from[1]} ${piece(from, to)}`;
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

/** The handles of one route: a dot at each bend point, and a proposed one at the middle of each piece, saved only once moved. They show on hover, and when the route or the handle is picked. */
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
    const [left, top] = [Math.min(...cards.map((c) => c.offsetLeft)), Math.min(...cards.map((c) => c.offsetTop))];
    const [right, bottom] = [Math.max(...cards.map((c) => c.offsetLeft + c.offsetWidth)), Math.max(...cards.map((c) => c.offsetTop + c.offsetHeight))];
    return [el, { x: left, y: top, w: right - left, h: bottom - top }] as const;
  });
  // Every read first, then every write: one layout.
  for (const [el, box] of boxes) {
    el.toggleAttribute('hidden', !box);
    for (const [k, v] of Object.entries(box ?? {})) if (el.getAttribute(`data-${k}`) !== String(Math.round(v))) el.setAttribute(`data-${k}`, String(Math.round(v)));
  }
}

/** A curve for each route, from its output socket to its input socket; the frames round their nodes first. */
function drawRoutes(canvas: SherpaLayoutCanvas, drawn: Drawn): void {
  placeFrames(drawn);
  const same = (a: NodeRoute | null, b: NodeRoute): boolean => !!a && a.from === b.from && a.to === b.to;
  const lanes: Drawn['lanes'] = [];
  const paths = drawn.routes.flatMap((route) => {
    const a = socketAt(drawn, route.from, 'output');
    const b = socketAt(drawn, route.to, 'input');
    if (!a || !b || same(drawn.lifted, route)) return [];
    const [from, to] = [onPlane(canvas, a), onPlane(canvas, b)];
    // The ties it passes, or else the bend points it holds, left to right: a flat piece to each.
    const stops = drawn.ties.flatMap((tie) => {
      const n = tie.routes.findIndex((r) => same(r, route));
      return n < 0 ? [] : [slotOf(drawn, tie, n)];
    });
    // As drawn, the bends stay inside the end sockets: a node moved later never loops the line back. The saved list stays.
    const way = waypointsOf(route.via && clampedVia(route.via, { from: from[0], to: to[0] }), stops);
    const points = [from, ...way.map((w) => w.at), to];
    const soft = way.some((w) => w.bend !== undefined);
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', pathThrough(points, soft));
    path.dataset['type'] = outputType(drawn.graph, route.from);
    path.dataset['from'] = route.from;
    path.dataset['to'] = route.to;
    if (drawn.picked.some((r) => same(r, route))) path.setAttribute('data-selected', '');
    // The line a click lands on: wide, unseen, and the only part of the lines that takes the pointer.
    const hit = document.createElementNS(SVG, 'polyline');
    const dots = dotsThrough(points, soft);
    lanes.push({ route, dots });
    hit.setAttribute('points', dots.map(([x, y]) => `${x},${y}`).join(' '));
    hit.setAttribute('class', 'graph-hit');
    hit.setAttribute('style', 'stroke: transparent; stroke-width: 14px; pointer-events: stroke; cursor: pointer');
    hit.dataset['from'] = route.from;
    hit.dataset['to'] = route.to;
    const group = document.createElementNS(SVG, 'g');
    group.setAttribute('class', 'graph-route');
    group.dataset['from'] = route.from;
    group.dataset['to'] = route.to;
    const mine = drawn.handle && same(drawn.handle.route, route) ? drawn.handle : null;
    if (mine || drawn.picked.some((r) => same(r, route))) group.setAttribute('data-active', '');
    group.append(path, hit, ...handleMarks(way, handlesOf(from, to, way), mine));
    return [group];
  });
  drawn.lanes = lanes;
  const bars = drawn.ties.map((tie) => {
    const [x, y] = slotOf(drawn, tie, 0);
    const high = (tie.routes.length - 1) * TIE_GAP + 16;
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
  drawn.lines.replaceChildren(...paths, ...bars, ...(drawn.selectedTie ? [shadowFilter(drawn.shadow)] : []), ...(drawn.draft ? [drawn.draft] : []));
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
  const wornAs = (address: string): string => (out ? [...drawn.beside].find(([, to]) => to === address)?.[0] ?? address : address);
  const own = owner ? addressOf(drawn, owner) : null;
  if (!owner || !own) return;
  const fork = hit.classList.contains('socket-false');
  // What the line is joined to at its start: the output it leaves, or the input it runs back to.
  const lifting = out ? undefined : drawn.routes.findLast((r) => r.to === own);
  if (!out && !lifting && !takesCustom(drawn, own) && !(drawn.options.onAdd && typeAt(drawn, own, 'input'))) return;
  const from = out ? (fork ? `${own}/${FALSE_SOCKET}` : wornAs(own)) : lifting?.from;
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
  // "Add a node" for a line let go on the bare canvas: the socket's type, what an output gives (a Field's column), and where.
  const addFrom = (socket: string, side: 'out' | 'in', e: PointerEvent): void => {
    const type = typeAt(drawn, socket, side === 'out' ? 'output' : 'input');
    const [x, y] = plane(e);
    const { node, row } = socketOf(socket);
    const gives = side === 'out' ? drawn.graph.nodes.find((n) => n.id === node)?.rows.find((r) => r.name === row)?.gives : undefined;
    if (type) drawn.options.onAdd?.({ socket, type, side, ...(gives ? { gives } : {}), client: { x: e.clientX, y: e.clientY }, at: { x: Math.round(x), y: Math.round(y) } });
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

/** A route picked by a click: alone, or with Shift added to the pick or taken off it. Delete or Backspace then breaks it. */
function pickRoute(canvas: SherpaLayoutCanvas, drawn: Drawn, route: NodeRoute, shift: boolean): void {
  const held = drawn.picked.some((r) => r.from === route.from && r.to === route.to);
  if (drawn.handle) drawn.options.onBendPicked?.(null);
  drawn.handle = null;
  drawn.picked = shift ? (held ? drawn.picked.filter((r) => r.from !== route.from || r.to !== route.to) : [...drawn.picked, route]) : [route];
  drawn.selectedTie = null;
  unpickFrame(drawn);
  drawRoutes(canvas, drawn);
  drawn.options.onPicked?.(drawn.picked);
  // The canvas's own keys hear the break.
  canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
}

/** The route a handle or a line belongs to, from its group. */
function routeOf(el: Element): NodeRoute | undefined {
  const group = el.closest<SVGElement>('g.graph-route');
  return group ? { from: group.dataset['from']!, to: group.dataset['to']! } : undefined;
}

/** Pick a handle, or none; the picked routes and tie let go. The editor is told. */
function pickHandle(canvas: SherpaLayoutCanvas, drawn: Drawn, handle: Drawn['handle']): void {
  drawn.handle = handle;
  if (handle) {
    drawn.selectedTie = null;
    drawn.picked = [];
    drawn.options.onPicked?.([]);
  }
  drawRoutes(canvas, drawn);
  drawn.options.onBendPicked?.(handle && !handle.proposed ? { route: handle.route, index: handle.index } : null);
  if (handle) canvas.shadowRoot?.querySelector<HTMLElement>('.viewport')?.focus();
}

/**
 * A handle pressed. Dragged past 4px, a mid-point handle puts a bend point there and a bend point moves,
 * one edit each move; the host tags them as one step. Not dragged, it is picked. TODO 744
 */
function dragHandle(canvas: SherpaLayoutCanvas, drawn: Drawn, grab: SVGElement, down: PointerEvent): void {
  const handle = grab.closest<SVGElement>('.graph-handle');
  const route = handle && routeOf(handle);
  const held = route && drawn.routes.find((r) => r.from === route.from && r.to === route.to);
  if (!handle || !route || !held) return;
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
    drawn.handle = { route, index: at };
    drawn.options.onBend?.(route, at, x, y, insert, drag);
    insert = false;
  };
  const stop = (e: PointerEvent): void => {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    if (e.type !== 'pointerup') return;
    if (moved) pickHandle(canvas, drawn, drawn.handle);
    // A click on a bend point picks it; on a middle nothing has moved from, it is a click on the line.
    else if (mid) pickRoute(canvas, drawn, route, e.shiftKey);
    else pickHandle(canvas, drawn, { route, index: at });
  };
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
}

/**
 * A press on a connector's line. A click picks it. Dragged past 4px, a ghost line follows and the
 * tie under the pointer lights; let go there, the route joins that tie; anywhere else, nothing
 * moves. TODO 744
 */
function dragLine(canvas: SherpaLayoutCanvas, drawn: Drawn, line: Element, down: PointerEvent): void {
  const route = { from: (line as SVGElement).dataset['from']!, to: (line as SVGElement).dataset['to']! };
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
    drawRoutes(canvas, drawn);
    if (target) drawn.options.onTieDrop?.(target, route);
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
  if (drawn.picked.length || drawn.selectedTie || drawn.handle) {
    drawn.picked = [];
    drawn.selectedTie = null;
    if (drawn.handle) drawn.options.onBendPicked?.(null);
    drawn.handle = null;
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
  lines.setAttribute('class', 'graph-routes');
  lines.setAttribute('width', '1');
  lines.setAttribute('height', '1');
  lines.setAttribute('aria-hidden', 'true');
  lines.setAttribute('style', '--x: 0px; --y: 0px; overflow: visible; pointer-events: none; fill: none;'
    + ' stroke: var(--sherpa-style-border-base, #b3b3c3); stroke-width: 2px');
  canvas.prepend(lines);
  const made: Drawn = {
    graph: { nodes: [], routes: [] }, options: {},
    nodes: new Map(), rows: new Map(), addresses: new WeakMap(), beside: new Map(), shapes: new Map(), placedAt: new Map(), movedTo: new Map(),
    lines, routes: [], ties: [], selectedTie: null, lanes: [], tying: false, draft: null, lifted: null, picked: [], handle: null, target: null, dragged: false, drags: 0, shadow: `graph-tie-shadow-${++shadows}`, fitted: false,
    frames: new Map(), selectedFrame: null,
    // A node's height lands when its parts render: the lines follow, and the first fits the view.
    sizes: new ResizeObserver(() => {
      drawRoutes(canvas, made);
      if (!made.fitted && made.nodes.size) { made.fitted = true; canvas.fit(); }
    }),
  };
  canvas.addEventListener('node-move', (event) => {
    const node = nodeOf(made, event.target);
    const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
    if (!node) return drawRoutes(canvas, made);
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
      drawRoutes(canvas, made);
      made.options.onMoveMany(moves);
      return;
    }
    drawRoutes(canvas, made);
    made.options.onMove?.(node, x, y);
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
    drawRoutes(canvas, made);
    const only = moves.length === 1 ? made.graph.nodes.find((n) => n.id === moves[0]!.id) : undefined;
    if (only) made.options.onMove?.(only, moves[0]!.x, moves[0]!.y);
    else made.options.onMoveMany?.(moves);
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true });
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
  // A click on a route picks it; Delete or Backspace breaks it. TODO 558
  lines.addEventListener('click', (event) => {
    const hit = event.target instanceof SVGElement && event.target.classList.contains('graph-hit') ? event.target : null;
    if (!hit || made.dragged) return;
    pickRoute(canvas, made, { from: hit.dataset['from']!, to: hit.dataset['to']! }, event.shiftKey);
  });
  // A picked bend point: Delete removes it, the arrows move it (8px, 32 with Shift), Escape lets go. With a
  // connector picked, B picks its first bend point, or its proposed middle dot, which the first arrow moves in;
  // on a tied connector, its first tie. TODO 744, 754
  canvas.addEventListener('keydown', (event) => {
    if (event.target !== canvas || event.ctrlKey || event.metaKey || event.altKey) return;
    const route = made.handle?.route ?? (event.code === 'KeyB' ? made.picked[0] : undefined);
    const held = route && made.routes.find((r) => r.from === route.from && r.to === route.to);
    if (!route || !held) return;
    const step = event.shiftKey ? 32 : 8;
    const by: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const pick = made.handle;
    const bend = pick && !pick.proposed ? held.via?.[pick.index] : undefined;
    const tie = made.ties.filter((t) => t.routes.some((r) => r.from === route.from && r.to === route.to)).sort((a, b) => tieX(made, a) - tieX(made, b))[0];
    if (event.code === 'KeyB' && tie) {
      made.picked = [];
      made.selectedTie = tie.id;
      pickHandle(canvas, made, null);
      made.options.onPicked?.([]);
    } else if (event.code === 'KeyB') pickHandle(canvas, made, held.via?.length ? { route, index: 0 } : { route, index: 0, proposed: true });
    else if (event.key === 'Escape' && pick) pickHandle(canvas, made, null);
    else if ((event.key === 'Delete' || event.key === 'Backspace') && pick) {
      if (bend) made.options.onUnbend?.(route, pick.index);
      pickHandle(canvas, made, null);
    } else if (bend && by[event.key]) {
      made.options.onBend?.(route, pick!.index, bend.x + by[event.key]![0], bend.y + by[event.key]![1], false, 0);
    } else if (pick?.proposed && by[event.key]) {
      // Moved by the reader: the proposed dot is a bend point now, from where it was drawn.
      const lane = made.lanes.find((l) => l.route.from === route.from && l.route.to === route.to);
      const [a, b] = [lane?.dots[0], lane?.dots.at(-1)];
      if (!a || !b) return;
      made.options.onBend?.(route, pick.index, (a[0] + b[0]) / 2 + by[event.key]![0], (a[1] + b[1]) / 2 + by[event.key]![1], true, 0);
      pickHandle(canvas, made, { route, index: pick.index });
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
    const ids = remove && made.options.onRemove ? [...made.nodes].filter(([, el]) => el.hasAttribute('data-current')).map(([id]) => id) : [];
    if (event.target !== canvas && !ids.length) return;
    if (!made.picked.length && !ids.length) return;
    if (event.key === 'Escape') {
      deselect(canvas, made);
    } else if (remove) {
      const routes = made.picked;
      made.picked = [];
      if (ids.length) made.options.onRemove!(ids, routes);
      else if (routes.length > 1 && made.options.onBreakAll) made.options.onBreakAll(routes);
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
    drawRoutes(canvas, made);
    if (moves.length === 1) made.options.onMove?.(moves[0]!.node, moves[0]!.x, moves[0]!.y);
    else if (moves.length) made.options.onMoveMany?.(moves.map(({ id, x, y }) => ({ id, x, y })));
  });
  canvas.addEventListener('frame-release', (event) => {
    const frame = frameOf(event.target);
    if (frame) made.options.onRelease?.(frame.id);
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
    put(el, 'data-category', categorySlug(node.category));
    put(el, 'data-scale-w', node.size ? String(node.size.w) : undefined);
    put(el, 'data-scale-h', node.size ? String(node.size.h) : undefined);
    el.toggleAttribute('data-branches', !!node.branches);
    el.toggleAttribute('data-input-routed', graph.routes.some((r) => r.to === node.id));
    el.toggleAttribute('data-output-routed', graph.routes.some((r) => r.from === node.id));
    el.toggleAttribute('data-false-routed', graph.routes.some((r) => r.from === `${node.id}/${FALSE_SOCKET}`));
    drawRows(drawn, el, node);
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
  drawn.routes = graph.routes;
  drawn.ties = graph.ties ?? [];
  drawn.tying = !!options.tying;
  if (drawn.selectedTie && !drawn.ties.some((t) => t.id === drawn.selectedTie)) drawn.selectedTie = null;
  const held = drawn.handle && graph.routes.find((r) => r.from === drawn.handle!.route.from && r.to === drawn.handle!.route.to);
  const tied = !!held && drawn.ties.some((t) => t.routes.some((r) => r.from === held.from && r.to === held.to));
  if (drawn.handle && (tied || !(drawn.handle.proposed ? held && !held.via?.length : held?.via?.[drawn.handle.index]))) drawn.handle = null;
  const left = drawn.picked.filter((p) => graph.routes.some((r) => r.from === p.from && r.to === p.to));
  if (left.length !== drawn.picked.length) {
    drawn.picked = left;
    options.onPicked?.(left);
  }
  linkPortals(drawn);
  requestAnimationFrame(() => drawRoutes(canvas, drawn));
}

/** Each portal of a picked portal's name, lit as picked is (`data-linked`): In and Out alike. TODO 779 */
function linkPortals(drawn: Drawn | undefined): void {
  if (!drawn) return;
  const picked = [...drawn.nodes].filter(([, el]) => el.hasAttribute('data-current')).map(([id]) => id);
  const lit = new Set(picked.flatMap((id) => portalLinks(drawn.graph.nodes, id)));
  for (const [id, el] of drawn.nodes) el.toggleAttribute('data-linked', lit.has(id) && !picked.includes(id));
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

/** Mark one frame as the one picked, or none: no node, route or tie is picked with it. TODO 778 */
export function markFrame(canvas: SherpaLayoutCanvas, id: string | null): void {
  const drawn = drawnOn.get(canvas);
  if (!drawn) return;
  if (id) {
    markNode(canvas, null);
    if (drawn.picked.length || drawn.selectedTie || drawn.handle) {
      drawn.picked = [];
      drawn.selectedTie = null;
      if (drawn.handle) drawn.options.onBendPicked?.(null);
      drawn.handle = null;
      drawRoutes(canvas, drawn);
      drawn.options.onPicked?.([]);
    }
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
  return [...(drawnOn.get(canvas)?.nodes ?? [])].filter(([, el]) => el.hasAttribute('data-current')).map(([id]) => id);
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

/** Where these nodes go, from the boxes they are drawn in: on a grid, or in ONE column (TODO 778). None, fewer than two. */
export function arrangement(canvas: SherpaLayoutCanvas, picked: readonly string[], column = false): Arranged | undefined {
  const drawn = drawnOn.get(canvas);
  const ids = picked.filter((id) => !id.startsWith('#'));
  if (!drawn || ids.length < 2) return undefined;
  const { gap, nodes, boxes } = laidAs(canvas, drawn);
  const placed = arrangeNodes({ nodes, routes: drawn.routes, ties: drawn.ties }, ids, { gapX: gap, gapY: gap, boxes, column });
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
  // Each routed socket's height in its node, as drawn: a node's neighbours stand in its sockets' order. TODO 827
  const sockets: { inputs: Record<string, number>; outputs: Record<string, number> } = { inputs: {}, outputs: {} };
  for (const route of drawn.routes) {
    for (const [address, side, into] of [[route.from, 'output', sockets.outputs], [route.to, 'input', sockets.inputs]] as const) {
      const [rect, el] = [socketAt(drawn, address, side), drawn.nodes.get(socketOf(address).node)];
      if (rect && el) into[address] = onPlane(canvas, rect)[1] - (Number(el.getAttribute('data-y')) || 0);
    }
  }
  // A graph reads left to right: Sources and Portal Ins stand left, Outputs and Portal Outs right; an In hands on to each Out of
  // its name with no line, and the hop holds the order a route would. TODO 839
  const bands: Record<string, 'left' | 'right'> = {};
  const hops: { from: string; to: string }[] = [];
  const portals = drawn.graph.nodes.flatMap((n) => { const p = portalOf(n); return p ? [{ id: n.id, ...p }] : []; });
  for (const n of drawn.graph.nodes) if (n.kind === 'source') bands[n.id] = 'left'; else if (n.kind === 'output') bands[n.id] = 'right';
  for (const p of portals) {
    bands[p.id] = p.side === 'in' ? 'left' : 'right';
    if (p.side === 'in' && p.name) for (const o of portals) if (o.side === 'out' && o.name === p.name) hops.push({ from: p.id, to: o.id });
  }
  const placed = unfurlNodes({ nodes, routes: drawn.routes, ties: drawn.ties, frames: drawn.graph.frames ?? [], hops, bands }, ids, { gapX: gap, gapY: gap, boxes, frameMargin: { top, side }, sockets });
  return Object.keys(placed.nodes).length ? placed : undefined;
}

/** Unfurl the whole graph and hand the host the places, ties and bends with them: one step. The view fits it after. TODO 569 */
export function unfurlGraph(canvas: SherpaLayoutCanvas): Arranged | undefined {
  const drawn = drawnOn.get(canvas);
  const placed = drawn?.options.onArrange ? unfurlment(canvas) : undefined;
  if (!drawn || !placed) return undefined;
  handOn(drawn, placed);
  requestAnimationFrame(() => requestAnimationFrame(() => canvas.fit()));
  return placed;
}

/** Say in `data-can-arrange`, and each flag given, whether two or more nodes are picked; stop lets go. */
export function watchArrange(
  canvas: SherpaLayoutCanvas, toolbar: HTMLElement | null | undefined, allowed: () => boolean = () => true, flags: readonly string[] = ['data-can-arrange'],
): () => void {
  if (!toolbar) return () => undefined;
  const tell = (): void => {
    const can = pickedNodes(canvas).filter((id) => !id.startsWith('#')).length > 1 && allowed();
    for (const flag of flags) toolbar.toggleAttribute(flag, can);
  };
  const watch = new MutationObserver(tell);
  watch.observe(canvas, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-current'] });
  tell();
  return () => { watch.disconnect(); for (const flag of flags) toolbar.removeAttribute(flag); };
}

/** Mark several nodes as the ones picked. */
export function markNodes(canvas: SherpaLayoutCanvas, ids: ReadonlySet<string>): void {
  for (const [key, el] of drawnOn.get(canvas)?.nodes ?? []) el.toggleAttribute('data-current', ids.has(key));
  if (ids.size) unpickFrame(drawnOn.get(canvas));
  linkPortals(drawnOn.get(canvas));
}

/** Mark the one of the picked nodes whose panel is shown: a stronger ring than the others'. */
export function markActive(canvas: SherpaLayoutCanvas, id: string | null): void {
  for (const [key, el] of drawnOn.get(canvas)?.nodes ?? []) el.toggleAttribute('data-active', key === id);
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
  /** A reader asks a Value node for an unrouted picklist row: the button that is the drag, with no pointer. */
  onCustom?: (row: GraphRow) => void;
  /** A reader cuts one route, by the button that is the drag's break. */
  onCut?: (route: NodeRoute) => void;
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
}

/** What an inspector holds: its node, the fields by their element, and whom it tells. */
interface Inspecting {
  node: GraphNode;
  fields: WeakMap<Element, GraphRow>;
  options: InspectOptions;
}

const inspecting = new WeakMap<HTMLElement, Inspecting>();

const contentTab = new WeakMap<HTMLElement, string>();

/** A node's body: Details, and a JSON and a Data tab when it has them. The reader's tab is kept per inspector. */
function contentTabs(panel: HTMLElement, details: HTMLElement, json?: HTMLElement, data?: HTMLElement): HTMLElement {
  if (!json && !data) return details;
  const pages = [{ id: 'details', label: 'Details', el: details }, ...(json ? [{ id: 'json', label: 'JSON', el: json }] : []), ...(data ? [{ id: 'data', label: 'Data', el: data }] : [])];
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
    const part = row === FALSE_SOCKET ? 'False' : row ? from?.rows.find((r) => r.name === row)?.label : from?.branches && address === from.id ? 'True' : undefined;
    return [from?.heading ?? id, part].filter(Boolean).join(' › ');
  };
  const routed = driven(graph);
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
  // A node of many rows scrolls, in the panel or in its tab: a run that fits by shrinking lays its fields over its buttons.
  stack.setAttribute('data-scroll', '');
  const remove = options.onRemove ? [button('Remove node', options.onRemove, 'Remove this node and its routes. Keyboard: Backspace or Delete.')] : [];
  const flow = nodeFlow(graph, node.id, options.flow);
  stack.append(...(options.extra ?? []), ...(options.visual ? [options.visual] : []), ...(whole.length ? [header] : []), ...items, ...remove);
  const body = contentTabs(panel, stack, 'fault' in flow ? undefined : flowPane(flow), options.data ? dataPane(options.data) : undefined);
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
  panel.setAttribute('data-heading', tabs?.heading ?? node.heading);
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
    if (!inspector.hasAttribute('data-minimised') && !inspector.hasAttribute('data-state-restored')) inspector.setAttribute('data-minimised', '');
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
function handOver(canvas: HTMLElement, definition: PageDefinition | WorkflowDefinition): void {
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

/** The Sources a reader keeps in a Query, as a session keeps them. */
function isKept(v: unknown): v is KeptSource[] {
  return Array.isArray(v) && v.every((k: Partial<KeptSource> | null) => typeof k?.id === 'string' && typeof k.store === 'string');
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
  panel?: SherpaNodeList;
  /** Where a component node's live copy is copied from, by id: the page's markup where the page is not on screen. Default, the document. */
  markup?: NonElementParentNode;
}

/** Keep a page's Query drawn on a canvas as it changes, and ask it for each edit.
 *  It draws what the controls show — the draft — and ASKS through the one door a chip
 *  asks through: whether a change applies at once or waits for Apply is the Query's,
 *  and so is a slot's Sort and Group. TRAP T-one-command-one-door */
export function bindQueryEditor(
  canvas: SherpaLayoutCanvas,
  source: Pick<DataSource, 'query'> & Partial<Pick<DataSource, 'valuesFor' | 'store' | 'state' | 'results' | 'addEventListener' | 'removeEventListener'>>,
  { definition, inspector, session, toolbar, panel, markup = document, ...facts }: QueryEditorOptions,
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
  // Picked nodes moved together, or arranged: every place in one write, and an arranged route's bends reset. TODO 752
  const onMoveMany = (moves: { id: string; x: number; y: number }[]): void => {
    places = { ...places, ...Object.fromEntries(moves.map((m) => [m.id, { ...places[m.id], x: m.x, y: m.y }])) };
    session?.set(pointer, places);
  };
  const onArrange = (placed: Arranged): void => {
    onMoveMany(Object.entries(placed.nodes).map(([id, p]) => ({ id, ...p })));
    const touched = (r: NodeRoute): boolean => socketOf(r.from).node in placed.nodes || socketOf(r.to).node in placed.nodes;
    keepBends(Object.fromEntries(Object.entries(bends).filter(([key]) => !graph.routes.some((r) => bendKey(r) === key && touched(r)))));
  };
  // A resized node's size: the reader's for the tab, kept beside its place. TODO 740
  const onResize = (node: GraphNode, size: NodeSize): void => {
    places = { ...places, [node.id]: { x: node.x, y: node.y, ...places[node.id], size } };
    session?.set(pointer, places);
  };
  // A Source the page does not read is the editor's, kept for the tab beside the places: placed, its Store picked, deleted,
  // each an Undo step. Save writes the page's definition, so it is never saved. TRAP T-a-second-source-is-kept
  const keptAt = `/node-sources/${definition.id}`;
  session?.persist(keptAt, { shared: false, guard: isKept });
  let kept: readonly KeptSource[] = (session?.get(keptAt) as KeptSource[] | undefined) ?? [];
  const keep = (next: readonly KeptSource[]): void => {
    kept = next;
    session?.set(keptAt, kept);
    draw();
    note();
  };
  const onEdit = (edit: GraphEdit): void => {
    const edited = keptEdit(kept, edit);
    if (edited) return keep(edited);
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
    // A Preset Filter is asked of the scope that declares it. TODO 776
    const own = customs().find((c) => c.id === kind)?.scope;
    const answer = placeRequest(kind, own ?? from?.ref?.['scope'] ?? VIEW, {
      holds: (scope) => query.scope(scope), fields: (scope) => query.fields(scope),
      presets: (scope) => query.presets(scope), on: (scope, id) => query.presetOn(scope, id),
      kept, ...(definition.source?.store ? { store: definition.source.store } : {}), ...(facts.stores ? { stores: facts.stores } : {}),
    });
    if ('refused' in answer) report({ code: 'query-place', message: answer.refused });
    else if ('keep' in answer) keep([...kept, answer.keep]);
    else query.ask(answer.request);
  };
  const onAdded = (event: Event): void => {
    const { kind, context } = (event as CustomEvent<{ kind: string; context?: AddContext }>).detail;
    place(kind, context);
  };
  panel?.addEventListener('node-add', onAdded);
  // The page's Preset Filters, as its Query declares them: Custom Nodes, each switched on where it is declared. TODO 776
  const scopesOf = (): string[] => [...new Set([VIEW, ...Object.keys(definition.source?.scopes ?? {}), ...Object.keys(query.draft.scopes)])];
  const customs = (): { id: string; label: string; scope: string }[] => scopesOf().flatMap((scope) => query.presets(scope)
    .filter((p) => entityRefOf(p.id).type === PRESET_FILTER).map((p) => ({ id: p.id, label: p.label, scope })));
  let listed = '';
  const fillPanel = (): void => {
    const now = customs();
    const said = JSON.stringify(now);
    if (said === listed) return;
    listed = said;
    const kinds: Record<string, NodeKind> = Object.fromEntries(now.map((c) => [c.id, {
      heading: c.label, icon: 'filter', description: 'This page\'s Preset Filter.', rows: [], model: 'ScopeDefinition.presets', graphs: ['query'], category: 'Custom Nodes',
    }]));
    void panel?.populate(paletteOf({ ...NODE_KINDS, ...kinds }, 'query'));
  };
  // The node in the inspector, and its live visual: kept while the same component is shown.
  let visual: { id: string; el: HTMLElement } | null = null;
  const visualOf = (node: GraphNode): HTMLElement | null => {
    const id = node.ref?.['component'];
    const page = id ? markup.getElementById(id) : null;
    if (!id || !page) return null;
    if (visual?.id === id) return visual.el;
    // A COPY of the page's own component: it asks the provider as the page's does,
    // so it draws what the Query says. Its ids would clash, so it has none.
    const el = document.importNode(page, true) as HTMLElement;
    for (const one of [el, ...el.querySelectorAll('[id]')]) one.removeAttribute('id');
    const scope = node.ref?.['scope'];
    if (scope && scope !== VIEW) el.setAttribute('data-scope', scope);
    el.style.blockSize = '18rem';
    visual = { id, el };
    return el;
  };
  let inspected: string | null = null;
  const picks = pickedIn(canvas, inspector, (node, now) => {
    inspected = node.id;
    inspectNode(inspector!, node, now, { onEdit, visual: visualOf(node), ...(node.ref?.['kept'] ? { onRemove: () => removeNodes([node.id]) } : {}) });
  }, () => { visual = null; inspected = null; }, () => removeNodes(inspected ? [inspected] : []));
  keepOpen(inspector);
  let graph: DrawnGraph = { nodes: [], routes: [] };
  /** A cut is reported, never applied: once, however many routes are picked. */
  const cutRefused = (): void => report({ code: 'query-route', message: 'The Query\'s routes are its readings: turn a condition off, or clear it, to take it from its scope.' });
  // A bend is a LAYOUT fact, kept for the tab beside the nodes' places: the Query's routes are readings, which hold none. TODO 744
  const bendsAt = `/node-bends/${definition.id}`;
  session?.persist(bendsAt, { shared: false, guard: (v): v is Record<string, Bend[]> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((b) => !bendFault(b)) });
  let bends = (session?.get(bendsAt) as Record<string, Bend[]> | undefined) ?? {};
  const bendKey = (r: NodeRoute): string => `${r.from}>${r.to}`;
  const keepBends = (next: Record<string, Bend[] | undefined>): void => {
    bends = Object.fromEntries(Object.entries(next).flatMap(([k, v]) => (v ? [[k, v]] : [])));
    session?.set(bendsAt, bends);
    draw();
  };
  const onBend = (route: NodeRoute, at: number, x: number, y: number, insert: boolean): void => {
    const [a, b] = [socketOf(route.from).node, socketOf(route.to).node].map((id) => graph.nodes.find((n) => n.id === id));
    const placed = a && b ? clampBend({ from: a.x + NODE_WIDTH, to: b.x }, bends[bendKey(route)], at, x, insert) : x;
    keepBends({ ...bends, [bendKey(route)]: placeBend(bends[bendKey(route)], at, placed, y, insert).via });
  };
  const onUnbend = (route: NodeRoute, index: number): void => keepBends({ ...bends, [bendKey(route)]: dropBend(bends[bendKey(route)], index) });
  const removeRefused = (): void => report({ code: 'query-remove', message: 'The Query\'s nodes are its readings: turn a condition off, or clear it, to take it from its scope.' });
  // A kept Source goes; any other node is a reading, and stays.
  const removeNodes = (ids: readonly string[]): void => {
    const gone = kept.filter((k) => ids.includes(k.id));
    if (gone.length) {
      if (gone.some((k) => k.id === inspected)) picks.deselect();
      keep(kept.filter((k) => !gone.includes(k)));
    }
    if (gone.length < ids.length) removeRefused();
  };
  const draw = (): void => {
    const read = placed(queryGraph(query.draft, definition, {
      ...facts, values, presets: (scope) => query.presets(scope), domains: source.store?.domains ?? {}, pageSize: source.state?.pageSize ?? null, kept,
    }), places);
    graph = { ...read, routes: read.routes.map((r) => (bends[bendKey(r)] ? { ...r, via: bends[bendKey(r)]! } : r)) };
    fillPanel();
    drawGraph(canvas, graph, {
      onEdit, onMove, onMoveMany, onArrange, onResize, onConnect, onSelect: (node) => picks.select(node, graph), onDeselect: picks.deselect, onBend, onUnbend,
      onBendPicked: (pick) => toolbar?.toggleAttribute('data-picked-bend', !!pick),
      // Its routes are readings, which another field or scope takes: a moved end is a new route.
      onReroute: (_was, now) => onConnect(now),
      ...(panel ? { onAdd: (context: AddContext) => panel.askAdd(context) } : {}),
      onBreak: cutRefused, onBreakAll: cutRefused, onRemove: removeNodes,
      // A box picks, and opens no panel (756); an open one shows the one node, and shuts for several or none. TODO 735
      onBox: (ids) => {
        const node = ids.length === 1 ? graph.nodes.find((n) => n.id === ids[0]) : undefined;
        if (node) picks.peek(node, graph);
        else picks.deselect();
      },
      onPicked: (routes) => toolbar?.setAttribute('data-picked-routes', String(routes.length)),
    });
    toolbar?.toggleAttribute('data-can-unfurl', graph.nodes.length > 1);
    picks.follow(graph);
  };
  draw();
  // — Undo and Redo: the Query's draft, as copies, before and after each change anyone made (a chip's too), and the kept Sources.
  //   A step is put back through the Query's own whole restore, so every reader redraws as for any edit.
  //   Where a scope waits for Apply a step moves the DRAFT only (`restoreDraft`): an Apply is no step. TRAP T-an-edit-is-a-step
  const journal = new Journal<{ query: Query; kept: readonly KeptSource[] }>(HISTORY);
  let last = { query: query.draft, kept };
  let restoring = false;
  const tell = (): void => {
    toolbar?.toggleAttribute('data-can-undo', journal.canBack);
    toolbar?.toggleAttribute('data-can-redo', journal.canForward);
    canvas.dispatchEvent(new CustomEvent('history-change', { detail: { undo: journal.canBack, redo: journal.canForward }, bubbles: true, composed: true }));
  };
  const note = (): void => {
    if (restoring) return;
    const now = { query: query.draft, kept };
    if (JSON.stringify(now) !== JSON.stringify(last)) journal.push({ before: last, after: now });
    last = now;
    tell();
  };
  const onChange = (): void => {
    draw();
    note();
  };
  const step = (to: { query: Query; kept: readonly KeptSource[] } | undefined): boolean => {
    if (!to) return false;
    restoring = true;
    kept = to.kept;
    session?.set(keptAt, kept);
    draw();
    const asked = JSON.stringify(to.query) === JSON.stringify(query.draft) ? Promise.resolve() : query.restoreDraft(to.query, { by: 'undo' });
    void asked.finally(() => {
      restoring = false;
      last = { query: query.draft, kept };
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
    else if (action === 'arrange') arrangePicked(canvas);
    else if (action === 'unfurl') unfurlGraph(canvas);
  };
  const unarrange = watchArrange(canvas, toolbar);
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
      unarrange();
      toolbar?.removeAttribute('data-can-unfurl');
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
 * Light a page's Query graph as its source loads: the Source by the load and by its
 * store's reads — the page's and its worker's, by the store's name or the load's
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
}

/** One Custom Node opened: its definition's id, the use that opened it, and its name. */
interface Opened {
  kind: string;
  use: string;
  label: string;
}

/** Whether a value is a library's edits: definitions by id. */
const isEdits = (v: unknown): v is Record<string, NodeDefinition> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Whether a value is a list of tags. */
const isTags = (v: unknown): v is string[] => Array.isArray(v) && v.every((t) => typeof t === 'string');

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
  { inspector, panel, session, kinds = NODE_KINDS, library, onSaveNode, header, confirm, customDialog, onUpdateAll, toolbar, readOnly: preset = false, entity, ...facts }: WorkflowEditorOptions = {},
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
  const topKinds = (): Readonly<Record<string, NodeKind>> => ({ ...kinds, ...kindsOf(lib) });
  // This tab's draft wins: a reload loses nothing. What a v1's read cannot map is said once.
  const kept = session?.get(pointer) as WorkflowDefinition | WorkflowDefinitionV1 | undefined;
  const read = readWorkflow(kept ?? structuredClone(workflow), topKinds());
  for (const fault of read.faults) report({ code: 'workflow-definition', message: `bindWorkflow: ${fault}.`, at: { workflow: workflow.id } });
  let draft: WorkflowDefinition = read.workflow ?? { v: 2, id: workflow.id, nodes: [] };
  let original: WorkflowDefinition = readWorkflow(structuredClone(workflow), topKinds()).workflow ?? draft;
  /** The graph as it was when the editor loaded: what Reset node graph puts back. A Save moves `original`, never this. */
  const starting = original;
  /** The view bar of the app header, where its ⋮ holds Reset node graph (TODO 837). */
  const resetBar = (): HTMLElement | null | undefined => header?.querySelector<HTMLElement>('sherpa-quick-filter-toolbar[data-type="view"]');
  const edits = (): Record<string, NodeDefinition> => Object.fromEntries([...dirty].flatMap((id) => (lib.nodes[id] ? [[id, lib.nodes[id]]] : [])));
  /** A route a use's header holds from before reads once as its own new input, drafted; Save writes it. TRAP T-a-custom-node-header-adds-an-input */
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
  let graph: FramedGraph = { nodes: [], routes: [] };
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
  /** A preset's inside is read only (D15), at any depth; a preset workflow, everywhere. */
  const insidePreset = (): boolean => path.some((s) => lib.nodes[s.kind]?.preset);
  const readOnly = (): boolean => preset || insidePreset();
  // A graph's own Group Input and Output are drawn, never placed; the rest are what the graph shown may place.
  const refreshPanel = (): void => {
    const placeable = Object.fromEntries(Object.entries(topKinds()).filter(([id]) => !id.startsWith('#')));
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
    resetBar()?.toggleAttribute('data-graph-unchanged', (draft === starting || JSON.stringify(draft) === JSON.stringify(starting)) && !dirty.size && ownTags === handedTags);
  };
  /** Two steps as one: the first's before, the second's after, for every definition either changed. */
  const fold = (last: Change<Snap>, next: Change<Snap>): Change<Snap> => ({
    before: { draft: last.before.draft, defs: { ...next.before.defs, ...last.before.defs }, tags: last.before.tags },
    after: { draft: next.after.draft, defs: { ...last.after.defs, ...next.after.defs }, tags: next.after.tags },
  });
  let depth = 0;
  let begun: { draft: WorkflowDefinition; nodes: NodeLibrary['nodes']; tags: readonly string[] } | undefined;
  let lastTag = '';
  let lastAt = 0;
  /** One edit, however many writes it makes: ONE step. The same `tag` within a second (a drag, a typed word) is one too. */
  const edit = (fn: () => void, tag = ''): void => {
    if (depth++ === 0) begun = { draft, nodes: lib.nodes, tags: ownTags };
    try {
      fn();
    } finally {
      if (--depth === 0) {
        const was = begun!.nodes;
        const ids = [...new Set([...Object.keys(was), ...Object.keys(lib.nodes)])].filter((id) => was[id] !== lib.nodes[id]);
        if (begun!.draft !== draft || begun!.tags !== ownTags || ids.length) {
          const of = (nodes: NodeLibrary['nodes']): Snap['defs'] => Object.fromEntries(ids.map((id) => [id, nodes[id]]));
          const now = performance.now();
          const merge = tag && tag === lastTag && now - lastAt < 1000;
          journal.push({ before: { draft: begun!.draft, defs: of(was), tags: begun!.tags }, after: { draft, defs: of(lib.nodes), tags: ownTags } }, merge ? fold : undefined);
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
  const write = (next: WorkflowDefinition, tag?: string): void => edit(() => {
    if (!path.length && preset) {
      report({ code: 'node-readonly', message: 'bindWorkflow: this workflow is a preset, read only: change a copy of it.', at: { workflow: workflow.id } });
    } else if (!path.length) {
      draft = next;
      session?.set(pointer, next);
    } else if (readOnly()) {
      report({ code: 'node-readonly', message: 'bindWorkflow: this Custom Node is a preset, read only. Copy to my nodes, and change the copy.', at: { workflow: workflow.id } });
    } else {
      const id = path.at(-1)!.kind;
      setLib(editDefinition(lib, id, { nodes: next.nodes.filter((n) => !n.id.startsWith('#')), routes: next.routes ?? [], ties: next.ties ?? [], frames: next.frames ?? [] }), [id]);
    }
    draw();
  }, tag);
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
    // A portal's name, or a Rename, can join a loop: checked as a route is, and refused the same way; a refused pick draws back. TODO 779
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
    write(editWorkflow(shown(), { node: node.id, set: { x, y } }, K()), `move:${node.id}`);
  };
  // Picked nodes moved by one drag: ONE step. A tie whose routes all join them goes with them, and so do the
  // bends of a route with both ends among them; the rest stay. TODO 752
  const onMoveMany = (moves: { id: string; x: number; y: number }[]): void => {
    const nodes = Object.fromEntries(moves.filter((m) => !m.id.startsWith('#')).map((m) => [m.id, { x: m.x, y: m.y }]));
    const head = shown().nodes.find((n) => n.id === moves[0]?.id);
    if (!head || !nodes[head.id] || Object.keys(nodes).length < 2) return;
    const [dx, dy] = [nodes[head.id]!.x - head.x, nodes[head.id]!.y - head.y];
    const inside = (r: NodeRoute): boolean => socketOf(r.from).node in nodes && socketOf(r.to).node in nodes;
    const ties = Object.fromEntries((shown().ties ?? []).filter((t) => t.routes.length && t.routes.every(inside)).map((t) => [t.id, { x: t.x + dx, y: t.y + dy }]));
    write(editWorkflow(shown(), { place: { nodes, ties, bends: { dx, dy } } }, K()), `move:${Object.keys(nodes).sort().join(',')}`);
  };
  // Arrange: every place, tie and bend in ONE edit. TODO 752
  const onArrange = (placed: Arranged): void => {
    if (readOnly()) return;
    write(editWorkflow(shown(), { place: { nodes: placed.nodes, ties: placed.ties, bends: 'reset' } }, K()));
  };
  const onResize = (node: GraphNode, size: NodeSize): void => {
    if (node.id.startsWith('#')) return;
    write(editWorkflow(shown(), { resize: { node: node.id, ...size } }, K()), `size:${node.id}`);
  };
  // A route that would break the workflow is refused, and says why — a loop, one into a Rows row, a row's own fault; one
  // of another type joins, and the node it enters warns (TODO 770). Else the draft takes it, with the definition it changed.
  const take = (next: WorkflowDefinition, made?: { library: NodeLibrary; id: string }): void => {
    const was = new Set(workflowFaultsDeep(shown(), lib, K(), facts));
    const now = made ? { ...K(), ...kindsOf(made.library) } : K();
    const added = workflowFaultsDeep(next, made?.library ?? lib, now, facts).filter((f) => !was.has(f));
    if (added.length) report({ code: 'workflow-route', message: `bindWorkflow: ${added.join('; ')}.`, at: { workflow: shown().id } });
    else if (!made) write(next);
    else edit(() => { setLib(made.library, [made.id]); write(next); });
  };
  // A route into a Custom Node's header takes anything, as a new input of its definition; a preset's refuses it as
  // any refused drop does (TODO 803). TRAP T-a-custom-node-header-adds-an-input
  const join = (on: WorkflowDefinition, route: NodeRoute): void => {
    const { node, row } = socketOf(route.to);
    if (row !== undefined || !use(node) || readOnly()) return take(editWorkflow(on, { route }, K()));
    const made = headerInput(on, route, lib, K());
    if ('fault' in made) report({ code: 'workflow-route', message: `bindWorkflow: ${made.fault}.`, at: { workflow: shown().id } });
    else take(made.workflow, made);
  };
  const onConnect = (route: NodeRoute): void => join(shown(), route);
  // A moved end is one edit: the route cut, then made, checked as one.
  const onReroute = (was: NodeRoute, now: NodeRoute): void => join(editWorkflow(shown(), { cut: was }, K()), now);
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
  // — Bend points (744): a drag is one step, as a tie's is; a refusal reports and writes nothing.
  const onBend = (route: NodeRoute, at: number, x: number, y: number, insert: boolean, drag: number): void => {
    const next = editWorkflow(shown(), { bend: { route, at, x, y, insert } }, K());
    if (next !== shown()) write(next, `bend:${route.from}>${route.to}:${drag}`);
  };
  const onUnbend = (route: NodeRoute, index: number): void => {
    const next = editWorkflow(shown(), { unbend: { route, index } }, K());
    if (next !== shown()) write(next);
  };
  const onTieDrop = (id: string, route: NodeRoute): void => {
    const next = editWorkflow(shown(), { tieAdd: { id, route } }, K());
    if (next !== shown()) write(next);
  };
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
    const placed = readOnly() ? undefined : arrangement(canvas, ids, true);
    if (!placed) return;
    const had = new Set((shown().frames ?? []).map((f) => f.id));
    edit(() => {
      const column = editWorkflow(shown(), { place: { nodes: placed.nodes, ties: placed.ties, bends: 'reset' } }, K());
      write(editWorkflow(column, { frame: { nodes: ids } }, K()));
    });
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
      const fit = context && fitOf(K()[kind]!, context.type, context.side);
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
    const box = canvas.getBoundingClientRect();
    const { x, y, zoom } = canvas.view;
    return { x: (clientX - box.left - x) / zoom, y: (clientY - box.top - y) / zoom };
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
  // Delete or Backspace on picked nodes: they and the routes picked go as ONE step. A Group Input or Output stays, and says so.
  const onRemoveNodes = (ids: string[], routes: NodeRoute[]): void => {
    const gone = ids.filter((id) => !id.startsWith('#'));
    if (gone.length < ids.length) report({ code: 'node-remove', message: 'The Group Input and Group Output are a Custom Node\'s doors: they cannot be removed.', at: { workflow: shown().id } });
    if (!gone.length && !routes.length) return;
    multi.clear();
    picks.deselect();
    edit(() => {
      let next = shown();
      for (const route of routes) next = editWorkflow(next, { cut: route }, K());
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
    if (inspector) inspectNone(inspector);
  });
  const scopeNote = (): HTMLElement[] => {
    if (!insidePreset()) return [];
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
      if (id === own || definition.preset || !definition.nodes.some((n) => n.kind === kind)) continue;
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
    } else if (mod && event.key === 'Enter' && toolbar?.hasAttribute('data-can-play')) {
      // Play: Ctrl or Cmd and Enter; with Shift, Fetch. TODO 836
      if (event.shiftKey) void fetchRows('keys');
      else play('keys');
    } else if (event.key === 'Escape') {
      const routes = pickedRoutes(canvas).length > 0;
      if (routes) markRoutes(canvas, []);
      if (tying) setTying(false);
      else if (multi.size) {
        multi.clear();
        markNode(canvas, null);
        picks.deselect();
      } else if (pickedFrame(canvas)) {
        markFrame(canvas, null);
        if (framePanel) picks.deselect();
      } else if (path.length && !routes) back();
      else if (!routes) return;
    } else if (event.key.toLowerCase() === 't' && !mod && !event.shiftKey && (pickedRoutes(canvas).length || multi.size > 1 || (hit && !hit.field))) {
      // Picked routes first; else the routes of the picked nodes.
      if (pickedRoutes(canvas).length) tieRoutes(pickedRoutes(canvas));
      else tieNodes(multi.size > 1 ? [...multi] : [hit!.id]);
    } else if (mod && event.key.toLowerCase() === 'g') openSave();
    else if (event.key.toLowerCase() === 'f' && !mod && !event.altKey && !event.shiftKey && pickedNodes(canvas).filter((id) => !id.startsWith('#')).length > 1) framePicked(true);
    else if (hit?.header && event.key === ' ') toggle(hit.id);
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
    else if (action === 'group') openSave();
    else if (action === 'arrange') arrangePicked(canvas);
    else if (action === 'unfurl') unfurlGraph(canvas);
    else if (action === 'fetch') void fetchRows('toolbar');
    else if (action === 'play') play('toolbar');
    else if (action === 'pause') pause();
    else if (action === 'stop') stop();
    else if (action === 'frame') framePicked();
  };
  toolbar?.addEventListener('toolbar-select', onTool);
  toolbar?.setAttribute('data-can-tie', '');
  const unarrange = watchArrange(canvas, toolbar, () => !readOnly(), ['data-can-arrange', 'data-can-frame']);
  tell();
  canvas.addEventListener('keydown', onKey, { capture: true });
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
  const fillInspector = (node: GraphNode, now: DrawnGraph, tabs?: InspectOptions['tabs']): void => {
    inspectNode(inspector!, withOwn(node), now, {
      onEdit, extra: extraFor(node), ...(readOnly() ? {} : { onCut: onBreak }), ...(tabs ? { tabs } : {}), flow: { inner: innerGraph },
      ...(simulation?.result.nodes[node.id] ? { data: { node: simulation.result.nodes[node.id]!, stale: simulation.stale } } : {}),
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
  /** What a simulation reads of the graph: its nodes' kinds and values and its routes, never a place. */
  const dataSig = (): string => JSON.stringify([shown().nodes.map((n) => [n.id, n.kind, n.values]), shown().routes]);
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
      el?.removeAttribute('data-badge');
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
      // Where it forks: the rows that are true, on the tab; none, and the tab and the header say so.
      const hits = trueOf(node);
      put(el, 'data-badge', hits === undefined ? undefined : hits.toLocaleString('en'));
      const own = graph.nodes.find((n) => n.id === id)?.warnings?.map((w) => w.words) ?? [];
      put(el, 'data-warning', (hits === 0 ? [...own, NO_TRUE] : own).join('\n'));
    }
  };
  /** Take the lights off. */
  const unlightNodes = (): void => {
    for (const id of Object.keys(simulation?.result.nodes ?? {})) {
      const el = drawnOn.get(canvas)?.nodes.get(id);
      el?.removeAttribute('data-step');
      el?.removeAttribute('data-caption');
      el?.removeAttribute('data-badge');
      if (el) put(el, 'data-warning', graph.nodes.find((n) => n.id === id)?.warnings?.map((w) => w.words).join('\n'));
    }
  };
  /** Run the graph on the rows kept, and show it: node by node, the page let draw between them when one takes a while. */
  const runSimulation = async (): Promise<{ nodes: number; faults: number; stopped: boolean }> => {
    const { rows, partial, any } = await cachedRows();
    const run = beginSimulation(graph, rows, { partial });
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
    if (path.length || !pathRead(graph, { inner: innerGraph }).ok) return;
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
    for (const id of pathRead(graph, { inner: innerGraph }).sources) {
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
    const read = path.length ? { ok: false, why: 'Open the graph that uses this Custom Node: Fetch and Simulate run on a whole graph' } : pathRead(graph, { inner: innerGraph });
    for (const flag of ['data-can-fetch', 'data-can-play']) toolbar?.toggleAttribute(flag, read.ok);
    if (read.ok || !read.why) toolbar?.removeAttribute('data-path-why');
    else toolbar?.setAttribute('data-path-why', read.why);
  };
  function draw(): void {
    if (path.length && !innerNow()) path = [];
    const ro = readOnly();
    const body = workflowGraph(shown(), facts, K());
    graph = ro ? { ...body, nodes: body.nodes.map((n) => ({ ...n, rows: n.rows.map((r) => ({ ...r, editable: false })) })) } : body;
    drawGraph(canvas, graph, {
      onEdit, onMove, onResize, onConnect, onReroute, onBreak, onCustom, onDeselect: picks.deselect,
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
    });
    toolbar?.toggleAttribute('data-can-unfurl', !ro && graph.nodes.filter((n) => !n.id.startsWith('#')).length > 1);
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
  draw();
  // A run lights its nodes: each step names its node, and the run its workflow. N4 reports.
  const unwatch = watchSteps(canvas, { claims: (span) => span.detail?.['graph'] === workflow.id });
  return {
    save(): boolean {
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
      for (const flag of ['data-can-fetch', 'data-can-play', 'data-path-why', 'data-cached', 'data-fetching', 'data-simulating', 'data-paused']) toolbar?.removeAttribute(flag);
      dialogSave?.removeEventListener('click', saveAs);
      dialogCancel?.removeEventListener('click', onCancel);
      dialogField('label')?.removeEventListener('keydown', onSaveKey);
      canvas.removeEventListener('keydown', onKey, { capture: true });
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
