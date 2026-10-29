/**
 * node-graph.ts — a graph of nodes drawn on a sherpa-layout-canvas, and a page's Query kept drawn there.
 * Each node by its id, where the reader moved it; its rows; and a line for each route. Will, TODO 555.
 * TRAP T-the-node-editor-asks-the-query
 *
 * Map:
 * - GraphEdit — One row a reader changed: its node, its row and the new value.
 * - DrawOptions — What a drawing tells its host: each edit, which the host makes.
 * - drawGraph — Draw a graph on a canvas: each node by id, kept where the reader moved it; then its routes.
 * - QueryEditorOptions — What drawing a page's Query needs beyond its source: the definition, and the page's components.
 * - bindQueryEditor — Keep a page's Query drawn on a canvas as it changes, and ask it for each edit; returns the undo.
 */
import '../../components/sherpa-input-text/sherpa-input-text.js';
import '../../components/sherpa-node/sherpa-node.js';
import '../../components/sherpa-node-row/sherpa-node-row.js';
import '../../components/sherpa-switch/sherpa-switch.js';
import type { SherpaLayoutCanvas } from '../../components/sherpa-layout-canvas/sherpa-layout-canvas.js';
import type { SocketSide } from '../../components/sherpa-node/node-sockets.js';
import type { DataSource } from '../data/data-source.js';
import type { PageDefinition } from '../data/page-definition.js';
import { editedCondition, queryGraph, type QueryGraphFacts } from '../data/query-graph.js';
import { readingsOf } from '../data/where.js';
import { ask } from './bind-source.js';
import { OP_LABELS, type FilterOp } from '../data/store.js';
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

/** What a drawing tells its host: each edit, which the host makes — the drawing writes nothing. */
export interface DrawOptions {
  onEdit?: (edit: GraphEdit) => void;
}

/** A field a row draws: a text field or a select, or a switch. */
type Field = HTMLElement & { value: string; checked?: boolean; populate?(items: unknown): void };

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
  return String(value);
}

/** Set an attribute, or take it away when there is nothing to say. */
function put(el: Element, name: string, value: string | undefined): void {
  if (value === undefined || value === '') el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** A row's field: a switch, a select of its choices, or a text or number field — read only unless it may change. */
function fieldFor(row: GraphRow): Field {
  if (row.field === 'switch') return document.createElement('sherpa-switch') as Field;
  const field = document.createElement('sherpa-input-text') as Field;
  field.setAttribute('name', row.name);
  if (row.choices) field.setAttribute('data-type', 'select');
  else if (row.field === 'number') field.setAttribute('data-type', 'number');
  if (!row.editable) field.setAttribute(row.choices ? 'disabled' : 'readonly', '');
  return field;
}

/** One node's rows, made again when their shape changed and given their values. */
function drawRows(drawn: Drawn, el: HTMLElement, node: GraphNode): void {
  const shape = JSON.stringify(node.rows.map((r) => [r.name, r.field, r.input, r.output, r.editable, r.choices]));
  if (drawn.shapes.get(node.id) !== shape) {
    drawn.shapes.set(node.id, shape);
    for (const key of [...drawn.rows.keys()]) if (key.startsWith(`${node.id}/`)) drawn.rows.delete(key);
    el.replaceChildren(...node.rows.map((row) => {
      const line = document.createElement('sherpa-node-row');
      drawn.rows.set(`${node.id}/${row.name}`, line);
      drawn.addresses.set(line, [node.id, row.name]);
      if (row.field) {
        const field = fieldFor(row);
        line.append(field);
        if (row.choices) field.populate?.(row.choices);
      }
      return line;
    }));
  }
  for (const row of node.rows) {
    const line = drawn.rows.get(`${node.id}/${row.name}`)!;
    put(line, 'data-input-socket', row.input);
    put(line, 'data-output-socket', row.output);
    const field = line.firstElementChild as Field | null;
    if (field) {
      field.setAttribute('data-label', row.label);
      if (row.field === 'switch') field.checked = !!row.value;
      // A select holds its value's KEY, and shows its label itself.
      else field.value = row.choices ? String(row.value ?? '') : shown(row);
    } else {
      line.setAttribute('data-label', row.field === undefined && row.value !== undefined ? `${row.label}: ${shown(row)}` : row.label);
    }
  }
}

/** A socket's middle, on the canvas's plane. */
function onPlane(canvas: SherpaLayoutCanvas, rect: DOMRect): [number, number] {
  const box = canvas.getBoundingClientRect();
  const { x, y, zoom } = canvas.view;
  return [(rect.left + rect.width / 2 - box.left - x) / zoom, (rect.top + rect.height / 2 - box.top - y) / zoom];
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
    const [x1, y1] = onPlane(canvas, a);
    const [x2, y2] = onPlane(canvas, b);
    const bend = Math.max(40, Math.abs(x2 - x1) / 2);
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
    path.dataset['from'] = from;
    path.dataset['to'] = to;
    return [path];
  });
  drawn.lines.replaceChildren(...paths);
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
    nodes: new Map(), rows: new Map(), addresses: new WeakMap(), shapes: new Map(), lines, routes: [], fitted: false,
    // A node's height lands when its parts render: the lines follow, and the first fits the view.
    sizes: new ResizeObserver(() => {
      drawRoutes(canvas, made);
      if (!made.fitted && made.nodes.size) { made.fitted = true; canvas.fit(); }
    }),
  };
  canvas.addEventListener('node-move', () => drawRoutes(canvas, made));
  // A field's change, as an EDIT for the host: the drawing writes nothing itself.
  canvas.addEventListener('change', (event) => {
    const line = event.composedPath().find((n): n is HTMLElement => n instanceof HTMLElement && made.addresses.has(n));
    const [id, name] = line ? made.addresses.get(line)! : [];
    const node = made.graph.nodes.find((n) => n.id === id);
    const row = node?.rows.find((r) => r.name === name);
    if (!node || !row?.editable) return;
    const field = line!.firstElementChild as Field;
    made.options.onEdit?.({ node, row, value: row.field === 'switch' ? !!field.checked : field.value });
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

/** What drawing a page's Query needs beyond its source: the definition, and the page's components. */
export interface QueryEditorOptions extends QueryGraphFacts {
  definition: PageDefinition;
}

/** Keep a page's Query drawn on a canvas as it changes, and ask it for each edit; returns the undo.
 *  It draws what the controls show — the draft — and ASKS through the doors a chip
 *  asks through: whether a change applies at once or waits for Apply is the Query's. */
export function bindQueryEditor(
  canvas: SherpaLayoutCanvas,
  source: Pick<DataSource, 'query'>,
  { definition, ...facts }: QueryEditorOptions,
): () => void {
  const query = source.query;
  const onEdit = ({ node, row, value }: GraphEdit): void => {
    const scope = node.ref?.['scope'];
    if (!scope) return;
    const was = Object.fromEntries(node.rows.map((r) => [r.name, r.value]));
    if (node.kind === 'scope') {
      ask(query, { scope, suspended: !value }, scope);
    } else if (node.kind === 'condition') {
      const field = node.ref?.['field'] ?? '';
      const op = String(row.name === 'op' ? value : was['op']);
      const text = String(row.name === 'value' ? value : was['value'] ?? '');
      const type = facts.type?.(field) ?? definition.source?.fields?.[field]?.type;
      const reading = readingsOf({ [field]: editedCondition(op, text, type) })[field] ?? null;
      ask(query, { scope, field, reading }, scope);
    } else if (node.kind === 'arrange') {
      const pick = (name: string): string => String(row.name === name ? value : was[name] ?? '');
      if (row.name === 'group') query.setGroup(pick('group') || null, scope);
      else query.setSort(pick('sort') || null, pick('direction') === 'desc' ? 'desc' : 'asc', scope);
    }
  };
  const draw = (): void => drawGraph(canvas, queryGraph(query.draft, definition, facts), { onEdit });
  draw();
  query.addEventListener('query-change', draw);
  return () => query.removeEventListener('query-change', draw);
}
