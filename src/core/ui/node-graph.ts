/**
 * node-graph.ts — a graph of nodes drawn on a sherpa-layout-canvas, and a page's Query kept drawn there.
 * Each node by its id, where the reader moved it; its rows; and a line for each route. Will, TODO 555.
 * TRAP T-the-node-editor-asks-the-query
 *
 * Map:
 * - drawGraph — Draw a graph on a canvas: each node by id, kept where the reader moved it; then its routes.
 * - QueryEditorOptions — What drawing a page's Query needs beyond its source: the definition, and the page's components.
 * - bindQueryEditor — Keep a page's Query drawn on a canvas, read only, as it changes; returns the undo.
 */
import '../../components/sherpa-input-text/sherpa-input-text.js';
import '../../components/sherpa-node/sherpa-node.js';
import '../../components/sherpa-node-row/sherpa-node-row.js';
import type { SherpaLayoutCanvas } from '../../components/sherpa-layout-canvas/sherpa-layout-canvas.js';
import type { SocketSide } from '../../components/sherpa-node/node-sockets.js';
import type { DataSource } from '../data/data-source.js';
import type { PageDefinition } from '../data/page-definition.js';
import { queryGraph, type QueryGraphFacts } from '../data/query-graph.js';
import { OP_LABELS, type FilterOp } from '../data/store.js';
import type { DrawnGraph, GraphNode, GraphRow, WorkflowRoute } from '../data/workflow.js';

const SVG = 'http://www.w3.org/2000/svg';

/** Anything with a socket to join: a node's header, or one of its rows. */
type HasSockets = HTMLElement & { socketRect(side: SocketSide): DOMRect | null };

/** What a canvas has drawn: each node and row by its address, the lines, and the routes they draw. */
interface Drawn {
  nodes: Map<string, HTMLElement>;
  rows: Map<string, HTMLElement>;
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

/** One node's rows, made again when their shape changed and given their values. */
function drawRows(drawn: Drawn, el: HTMLElement, node: GraphNode): void {
  const shape = node.rows.map((r) => `${r.name}:${r.field ?? ''}:${r.input ?? ''}:${r.output ?? ''}`).join('|');
  if (drawn.shapes.get(node.id) !== shape) {
    drawn.shapes.set(node.id, shape);
    for (const key of [...drawn.rows.keys()]) if (key.startsWith(`${node.id}/`)) drawn.rows.delete(key);
    el.replaceChildren(...node.rows.map((row) => {
      const line = document.createElement('sherpa-node-row');
      drawn.rows.set(`${node.id}/${row.name}`, line);
      if (row.field) {
        const field = document.createElement('sherpa-input-text');
        field.setAttribute('name', row.name);
        // Read only: the editor shows the Query; a change is the Query's to make (Q3).
        field.setAttribute('readonly', '');
        line.append(field);
      }
      return line;
    }));
  }
  for (const row of node.rows) {
    const line = drawn.rows.get(`${node.id}/${row.name}`)!;
    put(line, 'data-input-socket', row.input);
    put(line, 'data-output-socket', row.output);
    const field = line.firstElementChild as (HTMLElement & { value: string }) | null;
    if (field) {
      field.setAttribute('data-label', row.label);
      field.value = shown(row);
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
    nodes: new Map(), rows: new Map(), shapes: new Map(), lines, routes: [], fitted: false,
    // A node's height lands when its parts render: the lines follow, and the first fits the view.
    sizes: new ResizeObserver(() => {
      drawRoutes(canvas, made);
      if (!made.fitted && made.nodes.size) { made.fitted = true; canvas.fit(); }
    }),
  };
  canvas.addEventListener('node-move', () => drawRoutes(canvas, made));
  drawnOn.set(canvas, made);
  drawn = made;
  return drawn;
}

/** Draw a graph on a canvas: each node by id, kept where the reader moved it; then its routes. */
export function drawGraph(canvas: SherpaLayoutCanvas, graph: DrawnGraph): void {
  const drawn = drawnFor(canvas);
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

/** Keep a page's Query drawn on a canvas, read only, as it changes; returns the undo.
 *  It draws what the controls show — the draft — and asks for nothing yet. */
export function bindQueryEditor(
  canvas: SherpaLayoutCanvas,
  source: Pick<DataSource, 'query'>,
  { definition, ...facts }: QueryEditorOptions,
): () => void {
  const draw = (): void => drawGraph(canvas, queryGraph(source.query.draft, definition, facts));
  draw();
  source.query.addEventListener('query-change', draw);
  return () => source.query.removeEventListener('query-change', draw);
}
