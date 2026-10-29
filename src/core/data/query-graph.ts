/**
 * query-graph.ts — a page's Query drawn as nodes, for the Node Editor to show. DOM-free.
 * It is DERIVED each time the Query changes; only the nodes' places are the editor's own.
 * Will, TODO 555 · docs/history/plan-78-query-editor.md · TRAP T-the-node-editor-asks-the-query
 *
 * Map:
 * - QUERY_KINDS — What each node of a Query IS: its header, its sockets and its fixed rows.
 * - GraphComponent — One component a scope's rows reach: its id, its label and how it shows them.
 * - QueryGraphFacts — What drawing a Query needs that the Query does not say.
 * - queryGraph — A page's Query as nodes and routes, laid out in columns by depth.
 */
import type { PageDefinition } from './page-definition.js';
import { PRESENTATION_KINDS, VIEW, arranging, type Query } from './query.js';
import { whereOf, type Condition } from './where.js';
import type { DrawnGraph, GraphNode, GraphRow, NodeKind, WorkflowRoute } from './workflow.js';

/** One column's width, in plane px: a node and the room for its routes. */
const COLUMN = 360;
/** A node's height, estimated: its header, and each row. The reader moves what overlaps. */
const HEADER = 72;
const ROW = 64;
const GAP = 40;

/** What each node of a Query IS: its header, its sockets and its fixed rows. */
export const QUERY_KINDS: Readonly<Record<string, NodeKind>> = {
  store: { heading: 'Store', icon: 'storage', description: 'Where the rows come from.', output: 'object', rows: [] },
  source: {
    heading: 'Source', icon: 'server', description: 'How the page reads its store.', input: 'object', output: 'object',
    rows: [
      { name: 'pageSize', label: 'Page size', field: 'number' },
      { name: 'search', label: 'Search fields', field: 'text' },
      { name: 'applyOn', label: 'Apply on', field: 'text' },
    ],
  },
  // A scope's rows are the fields it holds, each with an input for its condition.
  scope: { heading: 'Scope', icon: 'filter', input: 'object', output: 'object', rows: [] },
  condition: {
    heading: 'Condition', icon: 'function', output: 'value',
    rows: [
      { name: 'field', label: 'Field', field: 'key' },
      { name: 'op', label: 'Condition', field: 'condition' },
      { name: 'value', label: 'Value', field: 'text' },
    ],
  },
  arrange: {
    heading: 'Arrange', icon: 'sort-ascending', description: 'The rows\' order, groups and search.', input: 'object', output: 'object',
    rows: [
      { name: 'sort', label: 'Sort', field: 'key' },
      { name: 'direction', label: 'Direction', field: 'direction' },
      { name: 'group', label: 'Group', field: 'key' },
      { name: 'search', label: 'Search', field: 'text' },
    ],
  },
  presentation: {
    heading: 'Presentation', icon: 'insights', description: 'How a slot shows its rows.', input: 'object', output: 'object',
    rows: [
      { name: 'kind', label: 'Show as', field: 'presentation' },
      { name: 'primary', label: 'Primary', field: 'key' },
      { name: 'secondary', label: 'Secondary', field: 'key' },
      { name: 'group', label: 'Group', field: 'key' },
      { name: 'sort', label: 'Sort', field: 'direction' },
    ],
  },
  component: { heading: 'Component', icon: 'table-columns', input: 'object', rows: [] },
};

/** One component a scope's rows reach: its id, its label and how it shows them. */
export interface GraphComponent {
  id: string;
  label: string;
  /** The scope it reads; its own id's when there is one, else the View. */
  scope?: string;
  /** How its definition shows it, before a reader's presentation. */
  kind?: (typeof PRESENTATION_KINDS)[number];
}

/** What drawing a Query needs that the Query does not say. */
export interface QueryGraphFacts {
  /** A field's name, as a reader sees it. */
  label?: (field: string) => string | undefined;
  /** The components the page binds, so each scope reaches its own. */
  components?: readonly GraphComponent[];
}

/** The keys of a condition that say HOW it holds, not what it compares. */
const NOT_OPS = new Set(['unit', 'off', 'band', 'all', 'and', 'or']);

/** One condition's operator and value, as its rows show them. */
function conditionRows(field: string, condition: Condition): GraphRow[] {
  const list = condition.and ?? condition.or;
  const op = list ? (condition.and ? 'and' : 'or')
    : condition.all ? 'all'
    : condition.band !== undefined ? 'band'
    : Object.keys(condition).find((key) => !NOT_OPS.has(key)) ?? '';
  const raw = list ? `${list.length} conditions`
    : op === 'band' ? condition.band
    : op === 'last' || op === 'next' ? `${String(condition[op])} ${condition.unit ?? 'day'}`
    : condition[op as keyof Condition];
  const value = Array.isArray(raw) ? raw.join(', ') : raw !== null && typeof raw === 'object' ? JSON.stringify(raw) : raw;
  return rowsOf('condition', { field, op, value: value ?? '' });
}

/** A kind's fixed rows, each with its value. */
function rowsOf(kind: string, values: Readonly<Record<string, unknown>>): GraphRow[] {
  return QUERY_KINDS[kind]!.rows.map((row) => ({ ...row, value: values[row.name] }));
}

/** A page's Query as nodes and routes, laid out in columns by depth. */
export function queryGraph(query: Query, definition: PageDefinition, facts: QueryGraphFacts = {}): DrawnGraph {
  const label = (field: string): string => facts.label?.(field) ?? definition.source?.fields?.[field]?.label ?? field;
  const components = facts.components ?? [];
  const scopes = Object.entries(query.scopes);
  const scopeOf = (c: GraphComponent): string => c.scope ?? (c.id in query.scopes ? c.id : VIEW);
  const nodes: (Omit<GraphNode, 'x' | 'y'> & { column: number })[] = [];
  const routes: WorkflowRoute[] = [];
  const add = (column: number, id: string, kind: string, rows: GraphRow[], own: Partial<GraphNode> = {}): string => {
    const k = QUERY_KINDS[kind]!;
    nodes.push({
      id, kind, column, heading: k.heading, icon: k.icon, rows,
      ...(k.description ? { description: k.description } : {}),
      ...(k.input ? { input: k.input } : {}),
      ...(k.output ? { output: k.output } : {}),
      ...own,
    });
    return id;
  };

  // Store ─▶ Source ─▶ the View.
  const source = definition.source;
  add(0, 'store', 'store', [], { heading: source?.store ?? 'Store' });
  add(1, 'source', 'source', rowsOf('source', {
    pageSize: source?.pageSize, search: source?.search?.join(', '), applyOn: source?.applyOn ?? 'change',
  }));
  routes.push({ from: 'store', to: 'source' });

  // Each scope: its held fields as rows, and a condition into each field it answers.
  const view = scopes.find(([id]) => id === VIEW);
  const ordered = view ? [view, ...scopes.filter(([id]) => id !== VIEW)] : scopes;
  for (const [id, scope] of ordered) {
    const top = id === VIEW;
    const where = whereOf(scope.readings);
    const fields = [...scope.holds, ...Object.keys(where).filter((f) => !scope.holds.includes(f))];
    const own = components.find((c) => c.id === id);
    const node = add(top ? 3 : 5, `scope-${id}`, 'scope', fields.map((f) => ({ name: f, label: label(f), input: 'value' })), {
      heading: top ? 'View' : own?.label ?? id,
      description: `${scope.holds.length} held${scope.suspended ? ' · filters off' : ''}`,
    });
    routes.push({ from: top || !view ? 'source' : `scope-${VIEW}`, to: node });
    for (const [field, condition] of Object.entries(where)) {
      const when = add(top ? 2 : 4, `when-${id}-${field}`, 'condition', conditionRows(field, condition), {
        heading: label(field),
        description: condition.off ? 'Off: kept, not applied.' : 'Applied.',
      });
      routes.push({ from: when, to: `${node}/${field}` });
    }
    // The scope's rows on their way out: arranged, presented, then shown.
    let out = node;
    if (arranging(scope)) {
      const first = scope.sort?.[0];
      out = add(6, `arrange-${id}`, 'arrange', rowsOf('arrange', {
        sort: first?.field, direction: first?.direction ?? (first ? 'asc' : undefined), group: scope.group ?? undefined, search: scope.search,
      }));
      routes.push({ from: node, to: out });
    }
    const shows = components.filter((c) => scopeOf(c) === id);
    const presented = scope.presentation ?? (shows.find((c) => c.kind) ? {} : undefined);
    if (presented) {
      const show = add(7, `show-${id}`, 'presentation', rowsOf('presentation', {
        ...presented, kind: presented.kind ?? shows.find((c) => c.kind)?.kind,
      }));
      routes.push({ from: out, to: show });
      out = show;
    }
    for (const c of shows) {
      routes.push({ from: out, to: add(8, `component-${c.id}`, 'component', [], { heading: c.label }) });
    }
  }

  // Columns with nothing in them close up; each column stacks its nodes.
  const used = [...new Set(nodes.map((n) => n.column))].sort((a, b) => a - b);
  const down = new Map<number, number>();
  const placed = nodes.map(({ column, ...node }) => {
    const x = used.indexOf(column) * COLUMN;
    const y = down.get(column) ?? 0;
    down.set(column, y + HEADER + node.rows.length * ROW + GAP);
    return { ...node, x, y };
  });
  return { nodes: placed, routes };
}
