/**
 * node-graph.ts — a graph of nodes drawn on a sherpa-layout-canvas, and a page's Query kept drawn there.
 * Each node by its id, where the reader moved it; its rows; and a line for each route. Will, TODO 555.
 * TRAP T-the-node-editor-asks-the-query
 *
 * Map:
 * - GraphEdit — One row a reader changed: its node, its row and the new value.
 * - DrawOptions — What a drawing tells its host: each edit, each node a reader picks, and each new route.
 * - drawGraph — Draw a graph on a canvas: each node by id, kept where the reader moved it; then its routes.
 * - markNode — Mark one node as the one picked, or none.
 * - InspectOptions — What an inspector shows beside a node's rows, and whom it tells of an edit.
 * - inspectNode — Fill an overlay panel with one node: its rows again, their routes, and a visual.
 * - QueryEditorOptions — What drawing a page's Query needs beyond its source: the definition, the page's components, an inspector.
 * - bindQueryEditor — Keep a page's Query drawn on a canvas as it changes, and ask it for each edit; returns the undo.
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
import type { DataSource } from '../data/data-source.js';
import type { PageDefinition } from '../data/page-definition.js';
import { editedCondition, queryGraph, type QueryGraphFacts } from '../data/query-graph.js';
import { VIEW } from '../data/query.js';
import { OP_LABELS, valueKey, type FilterOp } from '../data/store.js';
import { report } from '../data/report.js';
import { answerTree, type FieldType } from '../data/filter-state.js';
import { treeReading } from '../data/where.js';
import type { DrawnGraph, GraphNode, GraphRow, WorkflowRoute } from '../data/workflow.js';

const SVG = 'http://www.w3.org/2000/svg';

/** Anything with a socket to join: a node's header, or one of its rows. */
type HasSockets = HTMLElement & { socketRect(side: SocketSide): DOMRect | null };

/** One row a reader changed: its node, its row and the new value. */
export interface GraphEdit {
  node: GraphNode;
  row: GraphRow;
  value: unknown;
}

/** What a drawing tells its host: each edit, each node a reader picks, and each route a
 *  reader draws — the drawing writes nothing. */
export interface DrawOptions {
  onEdit?: (edit: GraphEdit) => void;
  onSelect?: (node: GraphNode) => void;
  /** A line dragged from an output socket and let go on an input socket. */
  onConnect?: (route: WorkflowRoute) => void;
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
  lines: SVGSVGElement;
  routes: readonly WorkflowRoute[];
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
  if (row.field === 'condition') return OP_LABELS[value as FilterOp] ?? String(value);
  if (row.field === 'direction') return value === 'desc' ? 'Descending' : value === 'asc' ? 'Ascending' : String(value);
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
  if (row.field === 'switch' || row.field === 'values') {
    const field = document.createElement(row.field === 'switch' ? 'sherpa-switch' : 'sherpa-select-group') as Field;
    if (row.field === 'values') field.setAttribute('multiple', '');
    if (locked) field.setAttribute('disabled', '');
    if (row.field === 'values') field.populate?.(row.choices ?? []);
    return field;
  }
  const field = document.createElement('sherpa-input-text') as Field;
  field.setAttribute('name', row.name);
  if (row.choices) field.setAttribute('data-type', 'select');
  else if (row.field === 'number') field.setAttribute('data-type', 'number');
  if (locked) field.setAttribute(row.choices ? 'disabled' : 'readonly', '');
  if (row.choices) field.populate?.(row.choices);
  return field;
}

/** Give a field its row's value, and its words. */
function fill(field: Field, row: GraphRow, note?: string): void {
  field.setAttribute('data-label', row.label);
  put(field, 'data-description', note ?? row.hint);
  if (row.field === 'switch') field.checked = !!row.value;
  else if (row.field === 'values') field.value = Array.isArray(row.value) ? row.value.map(String) : [];
  // A select holds its value's KEY, and shows its label itself.
  else field.value = row.choices ? String(row.value ?? '') : shown(row);
}

/** What a field says now, as its row's value. */
function read(field: Field, row: GraphRow): unknown {
  return row.field === 'switch' ? !!field.checked : field.value;
}

/** The input addresses a route drives: their fields mirror what comes in, read only. */
function driven(graph: DrawnGraph): Set<string> {
  return new Set(graph.routes.map((r) => r.to));
}

/** One node's rows, made again when their shape changed and given their values. */
function drawRows(drawn: Drawn, el: HTMLElement, node: GraphNode): void {
  const routed = driven(drawn.graph);
  const locked = (row: GraphRow): boolean => !row.editable || routed.has(`${node.id}/${row.name}`);
  const shape = JSON.stringify(node.rows.map((r) => [r.name, r.field, r.input, r.output, locked(r), r.choices]));
  if (drawn.shapes.get(node.id) !== shape) {
    drawn.shapes.set(node.id, shape);
    for (const key of [...drawn.rows.keys()]) if (key.startsWith(`${node.id}/`)) drawn.rows.delete(key);
    el.replaceChildren(...node.rows.map((row) => {
      const line = document.createElement('sherpa-node-row');
      drawn.rows.set(`${node.id}/${row.name}`, line);
      drawn.addresses.set(line, [node.id, row.name]);
      if (row.field) line.append(fieldFor(row, locked(row)));
      return line;
    }));
  }
  for (const row of node.rows) {
    const line = drawn.rows.get(`${node.id}/${row.name}`)!;
    put(line, 'data-input-socket', row.input);
    put(line, 'data-output-socket', row.output);
    const field = line.firstElementChild as Field | null;
    if (field) fill(field, row);
    else line.setAttribute('data-label', row.field === undefined && row.value !== undefined ? `${row.label}: ${shown(row)}` : row.label);
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

/** A curve for each route, from its output socket to its input socket. */
function drawRoutes(canvas: SherpaLayoutCanvas, drawn: Drawn): void {
  const end = (address: string, side: SocketSide): DOMRect | null => {
    const [id = '', row] = address.split('/');
    const el = (row === undefined ? drawn.nodes.get(id) : drawn.rows.get(address)) as HasSockets | undefined;
    return el?.socketRect?.(side) ?? null;
  };
  const paths = drawn.routes.flatMap(({ from, to }) => {
    const a = end(from, 'output');
    const b = end(to, 'input');
    if (!a || !b) return [];
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', curve(onPlane(canvas, a), onPlane(canvas, b)));
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
    if (to && to.split('/')[0] !== from.split('/')[0]) drawn.options.onConnect?.({ from, to });
  };
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
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
    nodes: new Map(), rows: new Map(), addresses: new WeakMap(), shapes: new Map(), lines, routes: [], draft: null, fitted: false,
    // A node's height lands when its parts render: the lines follow, and the first fits the view.
    sizes: new ResizeObserver(() => {
      drawRoutes(canvas, made);
      if (!made.fitted && made.nodes.size) { made.fitted = true; canvas.fit(); }
    }),
  };
  canvas.addEventListener('node-move', () => drawRoutes(canvas, made));
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
    const id = [...made.nodes].find(([, el]) => el === event.target)?.[0];
    const node = made.graph.nodes.find((n) => n.id === id);
    if (!node) return;
    markNode(canvas, node.id);
    made.options.onSelect?.(node);
  });
  drawnOn.set(canvas, made);
  drawn = made;
  return drawn;
}

/** Draw a graph on a canvas: each node by id, kept where the reader moved it; then its routes. */
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
  }
  for (const node of graph.nodes) {
    let el = drawn.nodes.get(node.id);
    if (!el) {
      el = document.createElement('sherpa-node');
      // Placed once: after that, the place is the reader's.
      el.setAttribute('data-x', String(node.x));
      el.setAttribute('data-y', String(node.y));
      drawn.nodes.set(node.id, el);
      canvas.append(el);
      drawn.sizes.observe(el);
    }
    el.setAttribute('data-heading', node.heading);
    put(el, 'data-icon', node.icon);
    put(el, 'data-description', node.description);
    put(el, 'data-input-socket', node.input);
    put(el, 'data-output-socket', node.output);
    drawRows(drawn, el, node);
  }
  drawn.routes = graph.routes;
  requestAnimationFrame(() => drawRoutes(canvas, drawn));
}

/** Mark one node as the one picked, or none. */
export function markNode(canvas: SherpaLayoutCanvas, id: string | null): void {
  for (const [key, el] of drawnOn.get(canvas)?.nodes ?? []) el.toggleAttribute('data-current', key === id);
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
    const [id, row] = address.split('/');
    const from = graph.nodes.find((n) => n.id === id);
    const part = row ? from?.rows.find((r) => r.name === row)?.label : undefined;
    return [from?.heading ?? id, part].filter(Boolean).join(' › ');
  };
  const routed = driven(graph);
  const fields = new WeakMap<Element, GraphRow>();
  const items = node.rows.map((row) => {
    const at = `${node.id}/${row.name}`;
    const ins = graph.routes.filter((r) => r.to === at).map((r) => `From ${name(r.from)}`);
    const outs = graph.routes.filter((r) => r.from === at).map((r) => `To ${name(r.to)}`);
    const field = fieldFor(row.field ? row : { ...row, field: 'text' }, !row.editable || routed.has(at) || !row.field);
    fill(field, row, [...ins, ...outs, row.hint].filter(Boolean).join(' · ') || undefined);
    fields.set(field, row);
    return field;
  });
  // The whole node's routes, in and out.
  const header = document.createElement('sherpa-key-value-list');
  header.setAttribute('data-orientation', 'vertical');
  const whole = [
    ...graph.routes.filter((r) => r.to === node.id).map((r) => ({ key: 'In', value: name(r.from) })),
    ...graph.routes.filter((r) => r.from === node.id).map((r) => ({ key: 'Out', value: name(r.to) })),
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

/** What drawing a page's Query needs beyond its source: the definition, the page's components, an inspector. */
export interface QueryEditorOptions extends QueryGraphFacts {
  definition: PageDefinition;
  /** The overlay panel a picked node opens in: its rows again, and a component's live visual. */
  inspector?: HTMLElement & { show(): void; hide(): void; open: boolean };
}

/** The operators that pick one value. */
const ONE = new Set(['eq', 'ne']);

/** Keep a page's Query drawn on a canvas as it changes, and ask it for each edit; returns the undo.
 *  It draws what the controls show — the draft — and ASKS through the one door a chip
 *  asks through: whether a change applies at once or waits for Apply is the Query's,
 *  and so is a slot's Sort and Group. TRAP T-one-command-one-door */
export function bindQueryEditor(
  canvas: SherpaLayoutCanvas,
  source: Pick<DataSource, 'query'> & Partial<Pick<DataSource, 'valuesFor'>>,
  { definition, inspector, ...facts }: QueryEditorOptions,
): () => void {
  const query = source.query;
  const typeOf = (field: string): string | undefined => facts.type?.(field) ?? definition.source?.fields?.[field]?.type;
  const values = facts.values ?? ((field: string) => source.valuesFor?.(field)?.map((v) => valueKey(v)));
  const onEdit = ({ node, row, value }: GraphEdit): void => {
    const scope = node.ref?.['scope'];
    const was = Object.fromEntries(node.rows.map((r) => [r.name, r.value]));
    if (node.kind === 'source' && row.name === 'pageSize') query.ask({ pageSize: Number(value) });
    if (!scope) return;
    if (node.kind === 'scope') {
      query.ask({ scope, suspended: !value });
    } else if (node.kind === 'condition') {
      const field = node.ref?.['field'] ?? '';
      const to = String(row.name === 'field' ? value : field);
      const op = String(row.name === 'op' ? value : was['op']);
      let given = row.name === 'value' ? value : was['value'];
      // One value where one is asked; a list where several are.
      if (ONE.has(op) && Array.isArray(given)) given = given[0] ?? '';
      const reading = treeReading(editedCondition(op, given as string | string[] ?? '', typeOf(to)), typeOf(to) as FieldType | undefined);
      // Another field: the condition MOVES there, as one change.
      query.ask(to === field ? { scope, field, reading } : [{ scope, field, reading: null }, { scope, field: to, reading }]);
    } else if (node.kind === 'arrange') {
      const pick = (name: string): string => String(row.name === name ? value : was[name] ?? '');
      if (row.name === 'group') query.ask({ scope, group: pick('group') || null });
      else if (row.name === 'search') query.ask({ scope, search: pick('search') });
      else query.ask({ scope, sort: pick('sort') || null, direction: pick('direction') === 'desc' ? 'desc' : 'asc' });
    } else if (node.kind === 'presentation') {
      query.ask({ scope, presentation: { [row.name]: value ? String(value) : undefined } });
    }
  };
  /* A NEW ROUTE, as the Query can take one: a condition into a field of a scope. The
     same field in another scope MOVES it there; another field takes it, keeping the
     values that field has. Anything else is no route the Query has. */
  const onConnect = ({ from, to }: WorkflowRoute): void => {
    const was = graph.nodes.find((n) => n.id === from.split('/')[0]);
    const [into = '', field = ''] = to.split('/');
    const target = graph.nodes.find((n) => n.id === into);
    const scope = was?.ref?.['scope'];
    const old = was?.ref?.['field'];
    const there = target?.ref?.['scope'];
    if (was?.kind !== 'condition' || target?.kind !== 'scope' || !field || !scope || !old || !there) {
      report({ code: 'query-route', message: `The Query has no route from "${was?.heading ?? from}" to "${target?.heading ?? to}": a condition goes into a field of a scope.` });
      return;
    }
    if (scope === there && old === field) return;
    const rows = Object.fromEntries(was.rows.map((r) => [r.name, r.value]));
    let given = rows['value'] as string | string[];
    const known = values(field);
    if (field !== old && known && Array.isArray(given)) given = given.filter((v) => known.includes(v));
    const reading = treeReading(editedCondition(String(rows['op']), given ?? '', typeOf(field)), typeOf(field) as FieldType | undefined);
    // It must still SAY something there: an empty pick filters nothing, so nothing moves.
    if (!answerTree(reading)) {
      report({ code: 'query-route', message: `Nothing "${was.heading}" picks is a value of "${field}": tick its values there.` });
      return;
    }
    query.ask([{ scope, field: old, reading: null }, { scope: there, field, reading }]);
  };
  // The node in the inspector, and its live visual: kept while the same component is shown.
  let picked: string | null = null;
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
  const show = (graph: DrawnGraph): void => {
    const node = graph.nodes.find((n) => n.id === picked);
    if (!inspector || !node) return;
    inspectNode(inspector, node, graph, { onEdit, visual: visualOf(node) });
  };
  let graph: DrawnGraph = { nodes: [], routes: [] };
  const onSelect = (node: GraphNode): void => {
    picked = node.id;
    show(graph);
    inspector?.show();
  };
  const onClose = (event: Event): void => {
    if (event.target !== inspector) return;
    picked = null;
    visual = null;
    markNode(canvas, null);
  };
  inspector?.addEventListener('panel-close', onClose);
  const draw = (): void => {
    graph = queryGraph(query.draft, definition, { ...facts, values });
    drawGraph(canvas, graph, { onEdit, onSelect, onConnect });
    if (inspector?.open) show(graph);
  };
  draw();
  query.addEventListener('query-change', draw);
  return () => {
    query.removeEventListener('query-change', draw);
    inspector?.removeEventListener('panel-close', onClose);
    inspector?.hide();
  };
}
