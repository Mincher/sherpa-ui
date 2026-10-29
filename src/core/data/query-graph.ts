/**
 * query-graph.ts — a page's Query drawn as nodes, for the Node Editor to show. DOM-free.
 * It is DERIVED each time the Query changes; only the nodes' places are the editor's own.
 * Will, TODO 555 · docs/history/plan-78-query-editor.md · TRAP T-the-node-editor-asks-the-query
 *
 * Map:
 * - QUERY_KINDS — What each node of a Query IS: its header, its sockets and its fixed rows.
 * - GraphComponent — One component a scope's rows reach: its id, its label and how it shows them.
 * - QueryGraphFacts — What drawing a Query needs that the Query does not say.
 * - editedCondition — A condition node's rows, edited, as the condition they say: the other half of drawing one.
 * - queryGraph — A page's Query as nodes and routes, laid out in columns by depth.
 */
import type { PageDefinition } from './page-definition.js';
import { PRESENTATION_KINDS, VIEW, arranging, type Presentation, type Query } from './query.js';
import { OP_LABELS, OPS_FOR_TYPE, type FilterOp } from './store.js';
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
  /** A field's type — text, number or date — which picks its operators. */
  type?: (field: string) => string | undefined;
  /** Every value a field may take, for a condition to pick from rather than type. */
  values?: (field: string) => readonly string[] | undefined;
}

/** The operators a field's condition may take: its type's, and a pick list's. */
const PICK_OPS: readonly FilterOp[] = ['in', 'notin', 'eq', 'ne'];

/** The scope's filter Switch: a row of its own, before its fields. Not a field's name. */
const SWITCH = '#filters';

/** Why a row is read only: nothing outside the editor takes its change yet. */
const FROM_DEFINITION = 'The page definition sets it: Save will change it (later).';

/** The operators that pick several values; the ones that pick one. */
const MANY = new Set(['in', 'notin']);
const ONE = new Set(['eq', 'ne']);

/** The keys of a condition that say HOW it holds, not what it compares. */
const NOT_OPS = new Set(['unit', 'off', 'band', 'all', 'and', 'or']);

/** One condition's field, operator and value, as its rows show them — each editable, as
 *  a chip's are; a value the field's own values can say is PICKED, not typed. A chain,
 *  a band or All is read only. */
function conditionRows(
  field: string, condition: Condition, type: string | undefined,
  fields: readonly { value: string; label: string }[], values: readonly string[] | undefined,
): GraphRow[] {
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
  const plain = op in OP_LABELS;
  const ops = [...new Set([...(OPS_FOR_TYPE[type ?? ''] ?? PICK_OPS), ...(plain ? [op as FilterOp] : [])])];
  const picks = values?.length ? values.map((v) => ({ value: v, label: v })) : undefined;
  /* A field whose values are known is PICKED, as its chip picks: ticks, Is one of or
     Is not one of. Equals is Is one of with one tick — the Query writes it so — and
     reads back as that. */
  if (picks && (ONE.has(op) || MANY.has(op))) {
    const many = op === 'ne' || op === 'notin' ? 'notin' : 'in';
    const ticked = (Array.isArray(raw) ? raw : raw === undefined || raw === '' ? [] : [raw]).map(String);
    return rowsOf('condition', { field, op: many, value: ticked }).map((row): GraphRow => (row.name === 'field'
      ? { ...row, editable: true, choices: fields }
      : row.name === 'op' ? { ...row, editable: true, choices: [...MANY].map((o) => ({ value: o, label: OP_LABELS[o as FilterOp] })) }
      : { ...row, field: 'values', editable: true, choices: picks }));
  }
  return rowsOf('condition', { field, op, value: value ?? '' }).map((row): GraphRow => {
    if (!plain) return row;
    if (row.name === 'field') return { ...row, editable: true, choices: fields };
    if (row.name === 'op') return { ...row, editable: true, choices: ops.map((o) => ({ value: o, label: OP_LABELS[o] })) };
    return { ...row, editable: true };
  });
}

/** A condition node's rows, edited, as the condition they say: the other half of drawing one.
 *  A value is typed text, or the values picked. */
export function editedCondition(op: string, given: string | readonly string[], type?: string): Condition {
  const one = (v: string): string | number => (type === 'number' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : v);
  const text = Array.isArray(given) ? given.join(',') : String(given);
  const list = text.split(',').map((v) => v.trim()).filter(Boolean).map(one);
  if (op === 'in' || op === 'notin' || op === 'between' || op === 'notbetween') return { [op]: list };
  if (op === 'last' || op === 'next') {
    const [n = '1', unit = 'day'] = text.trim().split(/\s+/);
    return { [op]: Number(n), unit: unit.replace(/s$/, '') as NonNullable<Condition['unit']> };
  }
  return { [op]: one(text.trim()) };
}

/** A presentation's rows: editable where it has a slot to keep them, its kind the definition's by default. */
function presentationRows(
  presented: Presentation, kind: string | undefined,
  keys: readonly { value: string; label: string }[], slot: boolean,
): GraphRow[] {
  const kinds = [{ value: '', label: kind ? `Default (${kind})` : 'Default' }, ...PRESENTATION_KINDS.map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) }))];
  const sorts = [{ value: '', label: 'None' }, { value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }];
  return rowsOf('presentation', { ...presented, kind: presented.kind ?? '' }).map((row): GraphRow => (slot
    ? { ...row, editable: true, choices: row.name === 'kind' ? kinds : row.name === 'sort' ? sorts : keys, value: String(row.value ?? '') }
    : { ...row, value: row.name === 'kind' ? kind : row.value, hint: 'It shares the View: no slot keeps its own.' }));
}

/** A kind's fixed rows, each with its value. */
function rowsOf(kind: string, values: Readonly<Record<string, unknown>>): GraphRow[] {
  return QUERY_KINDS[kind]!.rows.map((row) => ({ ...row, value: values[row.name] }));
}

/** A page's Query as nodes and routes, laid out in columns by depth. */
export function queryGraph(query: Query, definition: PageDefinition, facts: QueryGraphFacts = {}): DrawnGraph {
  const label = (field: string): string => facts.label?.(field) ?? definition.source?.fields?.[field]?.label ?? field;
  const typeOf = (field: string): string | undefined => facts.type?.(field) ?? definition.source?.fields?.[field]?.type;
  // Every field a Sort or Group may pick: the declared ones, then any a scope holds.
  const known = [...new Set([...Object.keys(definition.source?.fields ?? {}), ...Object.values(query.scopes).flatMap((s) => s.holds)])];
  const keys = [{ value: '', label: 'None' }, ...known.map((f) => ({ value: f, label: label(f) }))];
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
  // Its page size changes live; the rest is the definition's, until Save.
  add(1, 'source', 'source', rowsOf('source', {
    pageSize: source?.pageSize, search: source?.search?.join(', '), applyOn: source?.applyOn ?? 'change',
  }).map((row) => (row.name === 'pageSize' ? { ...row, editable: true } : { ...row, hint: FROM_DEFINITION })));
  routes.push({ from: 'store', to: 'source' });

  // Each scope: its held fields as rows, and a condition into each field it answers.
  const view = scopes.find(([id]) => id === VIEW);
  const ordered = view ? [view, ...scopes.filter(([id]) => id !== VIEW)] : scopes;
  for (const [id, scope] of ordered) {
    const top = id === VIEW;
    const where = whereOf(scope.readings);
    const fields = [...scope.holds, ...Object.keys(where).filter((f) => !scope.holds.includes(f))];
    const shows = components.filter((c) => scopeOf(c) === id);
    // Its name: the definition's, else the one component that reads it.
    const named = definition.source?.scopes?.[id]?.label
      ?? (components.find((c) => c.id === id) ?? (shows.length === 1 ? shows[0] : undefined))?.label;
    const rows: GraphRow[] = [
      { name: SWITCH, label: 'Filters', field: 'switch', value: !scope.suspended, editable: true },
      ...fields.map((f): GraphRow => ({ name: f, label: label(f), input: 'value' })),
    ];
    const node = add(top ? 3 : 5, `scope-${id}`, 'scope', rows, {
      heading: named ?? (top ? 'View' : id),
      description: `${scope.holds.length} held${scope.suspended ? ' · filters off' : ''}`,
      ref: { scope: id },
    });
    routes.push({ from: top || !view ? 'source' : `scope-${VIEW}`, to: node });
    const held = fields.map((f) => ({ value: f, label: label(f) }));
    for (const [field, condition] of Object.entries(where)) {
      const when = add(top ? 2 : 4, `when-${id}-${field}`, 'condition', conditionRows(field, condition, typeOf(field), held, facts.values?.(field)), {
        heading: label(field),
        description: condition.off ? 'Off: kept, not applied.' : 'Applied.',
        ref: { scope: id, field },
      });
      routes.push({ from: when, to: `${node}/${field}` });
    }
    // The scope's rows on their way out: arranged, presented, then shown.
    let out = node;
    if (arranging(scope)) {
      const first = scope.sort?.[0];
      const directions = [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }];
      // Sort, Group and Search change as their chips do.
      out = add(6, `arrange-${id}`, 'arrange', rowsOf('arrange', {
        sort: first?.field ?? '', direction: first?.direction ?? 'asc', group: scope.group ?? '', search: scope.search ?? '',
      }).map((row) => (row.name === 'search' ? { ...row, editable: true } : { ...row, editable: true, choices: row.name === 'direction' ? directions : keys })), {
        ref: { scope: id },
      });
      routes.push({ from: node, to: out });
    }
    // Each component its own Presentation: its SLOT's — its card's scope, kept in the
    // Query — and changed as Show as, Group and Sort change it. On the View it has no slot.
    for (const c of shows) {
      const slot = !top && (c.id === id || shows.length === 1);
      const presented = slot ? scope.presentation : undefined;
      let to = out;
      if (presented || c.kind) {
        to = add(7, `show-${c.id}`, 'presentation', presentationRows(presented ?? {}, c.kind, keys, slot), slot ? { ref: { scope: id } } : {});
        routes.push({ from: out, to });
      }
      routes.push({ from: to, to: add(8, `component-${c.id}`, 'component', [], { heading: c.label, ref: { component: c.id, scope: id } }) });
    }
    // A slot's presentation with no component named to show it is still drawn.
    if (scope.presentation && !shows.length) {
      routes.push({ from: out, to: add(7, `show-${id}`, 'presentation', presentationRows(scope.presentation, undefined, keys, !top), { ref: { scope: id } }) });
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
