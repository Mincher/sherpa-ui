/**
 * query-graph.ts — a page's Query drawn as nodes, for the Node Editor, and each edit made in
 * them as the command it asks. DERIVED each time the Query changes: the Source and its store's
 * status fields, each scope with its presets, saved filters, conditions and superseded answers,
 * its arrangement, presentation and components — and which node each step of a load lights; and
 * each Source a reader placed that the page does not read. Kinds are the one registry's. DOM-free.
 * Will, TODO 555 · docs/history/plan-78-query-editor.md · TRAP T-the-node-editor-asks-the-query
 * TRAP T-a-step-names-its-node · TRAP T-a-condition-is-a-tree-of-nodes
 *
 * Map:
 * - QUERY_NODE — Each Query node's id, as a step names it: the one scheme the graph is drawn by.
 * - queryStepNode — The node a span lights in a page's Query graph: the one it names, else its step's.
 * - WalkedNode — One node a scope's walk counted: its id, its rows, and the field it filters.
 * - walkedNodes — Each node a scope's walk counted, and its rows, by the walk's own step ids.
 * - LoadSteps — What a page's load did after its read: its walk's counts, and the rows it arranged.
 * - traceQuerySteps — Say what a load did after its read, each a step of its node, under the load.
 * - GraphComponent — One component a scope's rows reach: its id, its label and how it shows them.
 * - ScopePreset — One preset of a scope, as declared: its id, its name and the readings it writes.
 * - QueryGraphFacts — What drawing a Query needs that the Query does not say, and the Sources a reader keeps.
 * - editedCondition — A condition node's rows, edited, as the condition they say: the other half of drawing one.
 * - statusTallies — Each status field's rows per value, over the whole store: how many each Condition of its chain took.
 * - queryGraphFaults — What is wrong with a Query graph's chains, in words: a `when` that is no condition, a stray connection.
 * - queryGraph — A page's Query as nodes and connections, laid out in columns by depth.
 * - graphRequest — The command a node's edit asks, as a chip's would; none for a row nothing takes.
 * - PlaceFacts — What placing a node needs of the Query: its holds, fields, presets and which are on.
 * - KeptSource — A Source a reader placed that the page does not read: kept in the editor's draft, saved nowhere.
 * - PlaceAnswer — What placing a node asks: a command, a Source to keep, or why it cannot.
 * - QUERY_DRAWN_ONLY — The kinds a Query draws and never places: its node panel offers neither.
 * - placeRequest — The command placing a node asks in a scope, a Source to keep, or why it cannot.
 * - keptEdit — The kept Sources after an edit of one's Store row; none, the edit is no kept Source's.
 * - ConnectionAnswer — What a new connection asks: a command, or why it is refused; null, nothing to do.
 * - connectionRequest — The command a new connection asks: a condition into a field of a scope, moved or retargeted.
 */
import { SAVED_PRESET, type PageDefinition } from './page-definition.js';
import { PRESENTATION_KINDS, VIEW, arrangementOf, arranging, isSavedFilter, type Presentation, type Query, type QueryRequest } from './query.js';
import { OP_LABELS, OP_TAKES, OPS_FOR_TYPE, groupOf, type Condition, type ConditionLeaf, type Duration, type FilterOp, type Store } from './store.js';
import { answerTree, typedTree, typedValue, type FieldReading, type FieldType } from './filter-state.js';
import { readingsOf, treeReading } from './where.js';
import { presetHeld } from './query-edits.js';
import { entityRefOf } from './entity.js';
import { PRESET_FILTER } from './entity-types.js';
import type { FieldDomain } from './validate.js';
import {
  FALSE_SOCKET, LIST_OPS, NODE_KINDS, ROWS, kindNode, resolveKind, rowChoices, rowOf, socketOf,
  type DrawnGraph, type GraphEdit, type GraphNode, type GraphRow, type NodeConnection, type RowChoice,
} from './node-kinds.js';
import { traceStep, type Span, type TraceContext } from './trace.js';
import type { Walk } from './walk.js';

/** Each Query node's id, as a step names it: the one scheme the graph is drawn by.
 *  TRAP T-a-step-names-its-node */
export const QUERY_NODE = {
  source: 'source',
  status: (field: string): string => `status-${field}`,
  statusWhen: (field: string, value: string): string => `status-${field}.${value}`,
  scope: (scope: string): string => `scope-${scope}`,
  condition: (scope: string, field: string): string => `when-${scope}-${field}`,
  field: (scope: string, field: string): string => `field-${scope}-${field}`,
  preset: (scope: string, preset: string): string => `preset-${scope}-${preset}`,
  presetWhen: (scope: string, preset: string, field: string): string => `when-preset-${scope}-${preset}-${field}`,
  saved: (id: string): string => `saved-${id}`,
  savedWhen: (id: string, field: string): string => `when-saved-${id}-${field}`,
  arrange: (scope: string): string => `arrange-${scope}`,
  component: (id: string): string => `component-${id}`,
} as const;

/** The node an S3 span lights, by its step: the Source, by its load and by its store's reads. */
const STEP_NODES: Readonly<Record<string, string>> = Object.fromEntries(['load', 'request', 'answer', 'hold', 'recheck', 'send'].map((step) => [step, QUERY_NODE.source]));

/** The node a span lights in a page's Query graph: the one it names, else its step's. */
export function queryStepNode(span: Pick<Span, 'step' | 'detail'>): string | undefined {
  const named = span.detail?.['node'];
  return typeof named === 'string' ? named : STEP_NODES[span.step];
}

/** One node a scope's walk counted: its id, its rows, and the field it filters. */
export interface WalkedNode {
  node: string;
  rows: number;
  field?: string;
}

/** Each node a scope's walk counted, and its rows: by the walk's own step ids — a
 *  field's, or `preset:<id>` (planWalk) — as the graph names them. */
export function walkedNodes(scope: string, results: Readonly<Record<string, number>>): WalkedNode[] {
  return Object.entries(results).flatMap(([step, rows]): WalkedNode[] => {
    if (!step) return [];
    if (step.startsWith('preset:')) return [{ node: QUERY_NODE.preset(scope, step.slice('preset:'.length)), rows }];
    return [{ node: QUERY_NODE.condition(scope, step), rows, field: step }];
  });
}

/** What a page's load did after its read: each scope's walk — the rows each step
 *  counted and each scope ended with — and how many rows it arranged. */
export interface LoadSteps {
  walk: Pick<Walk, 'results'> & Partial<Pick<Walk, 'ends'>>;
  total?: number;
  /** Each status field's rows per value, over the whole store: `statusTallies`. */
  statuses?: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/**
 * Say what a load did after its read, each a step of its Query graph node, under
 * the load: each scope its walk counted, each condition and preset with its rows,
 * and the scope it arranged. Off, or in a scope whose filters are off, a step is
 * skipped: it narrows nothing. TRAP T-a-step-names-its-node
 */
export function traceQuerySteps(applied: Query, { walk, total, statuses }: LoadSteps, parent: TraceContext): void {
  // A status field's step: each value's Condition lit with the rows that took it, the field with them all.
  for (const [field, tally] of Object.entries(statuses ?? {})) {
    traceStep(QUERY_NODE.status(field), { parent, state: 'done', rows: Object.values(tally).reduce((a, b) => a + b, 0) });
    for (const [value, rows] of Object.entries(tally)) traceStep(QUERY_NODE.statusWhen(field, value), { parent, state: 'done', rows });
  }
  for (const [scope, results] of Object.entries(walk.results)) {
    const q = applied.scopes[scope];
    const rows = walk.ends?.[scope];
    traceStep(QUERY_NODE.scope(scope), { parent, state: q?.suspended ? 'skipped' : 'done', ...(rows !== undefined ? { rows } : {}) });
    for (const { node, rows: counted, field } of walkedNodes(scope, results)) {
      const off = !!q?.suspended || !!(field && q?.readings[field]?.suspended);
      traceStep(node, { parent, state: off ? 'skipped' : 'done', rows: counted });
    }
  }
  const arranged = arrangementOf(applied).scope;
  if (arranged) traceStep(QUERY_NODE.arrange(arranged), { parent, state: 'done', ...(total !== undefined ? { rows: total } : {}) });
}

/** One column's width, in plane px: a node and the room for its connections. */
const COLUMN = 360;
/** A node's height, estimated: its header, and each row. The reader moves what overlaps. */
const HEADER = 72;
const ROW = 64;
const GAP = 40;

/** One component a scope's rows reach: its id, its label and how it shows them. */
export interface GraphComponent {
  id: string;
  label: string;
  /** The scope it reads; its own id's when there is one, else the View. */
  scope?: string;
  /** How its definition shows it, before a reader's presentation. */
  kind?: (typeof PRESENTATION_KINDS)[number];
}

/** One preset of a scope, as declared: its id, its name and the readings it writes. */
export interface ScopePreset {
  id: string;
  label: string;
  readings: Readonly<Record<string, FieldReading>>;
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
  /** A scope's presets as declared now — the app's, and each saved filter on its bar. Absent, the definition's. */
  presets?: (scope: string) => readonly ScopePreset[];
  /** The store's domains: a status field's values, their looks and when a row has each. */
  domains?: Readonly<Record<string, FieldDomain>>;
  /** The rows per page now, where the reader changed them. */
  pageSize?: number | null;
  /** The stores the app registered, for a Store row's list; absent, the page's own. */
  stores?: readonly string[];
  /** The Sources a reader placed that the page does not read, kept in the editor's draft (TODO 808). */
  kept?: readonly KeptSource[];
}

/** The operators a field's condition may take: its type's, and a pick list's. */
const PICK_OPS: readonly FilterOp[] = ['in', 'notin', 'eq', 'ne'];

/** The scope's filter Switch: the kind's own row, before its presets and fields. */
const SWITCH = '#filters';

/** Where a node sends its data rows on: its Rows row. Plan 713 §3 */
const sent = (node: string): string => `${node}/${ROWS.name}`;

/** How the page reads its store: the Query's own rows on its Source, after the kind's. */
const PAGE_ROWS: readonly GraphRow[] = [
  { name: 'pageSize', label: 'Page size', control: 'number' },
  { name: 'search', label: 'Search fields', control: 'tags', multiple: true },
  { name: 'applyOn', label: 'Apply on', control: 'apply' },
];

/** What a kept Source says: the page reads its own store, and the Query nothing from this one. */
const notThePage = (store: string | undefined): string => `The page reads ${store ?? 'its own store'}. This Source is not the page's: the Query reads nothing from it.`;

/** Why a row is read only: nothing outside the editor takes its change. */
const FROM_DEFINITION = 'The page definition sets it: Save writes the definition.';
const FROM_STORE = 'The app\'s store works it out: statusFields().';
const SAVED_WORDS = 'A saved filter: Manage Saved Filters changes it.';
const FROM_ENTITY = 'A Preset Filter: its own graph changes it, in the Node Editor.';
const NOT_ADDED = 'Not on a bar: add it from the Saved menu, and it joins as a preset.';
const SUPERSEDED = 'The View holds this field: kept, not in force. It comes back when the View lets it go.';

/** The operators that pick several values; the ones that pick one. */
const MANY = new Set(['in', 'notin']);
const ONE = new Set(['eq', 'ne']);

/** How a group is said, under its node. */
const groupWords = (tree: Condition): string => {
  const [join, parts] = groupOf(tree) ?? ['and', [tree]];
  return `${join === 'and' ? 'All' : 'Any'} of ${parts.length} condition${parts.length === 1 ? '' : 's'}`;
};

/** The ids of a condition tree's nodes: its root's, and a part's by the numbers of its path. */
const treeNodeId = (root: string, path: readonly number[]): string => (path.length ? `${root}.${path.join('.')}` : root);

/** What drawing a tree's nodes needs: the field it reads, its type, the fields a reader may pick, and the field's values. */
interface TreeFacts {
  field: string;
  type: (field: string) => string | undefined;
  fields: readonly { value: string; label: string }[];
  values: (field: string) => readonly string[] | undefined;
  label: (field: string) => string;
}

/** The Operation an And or an Or picks: And or Or, in Logic's own words. */
const JOINS: readonly RowChoice[] = (['and', 'or'] as const).map((j) => ({ value: j, label: NODE_KINDS['condition']!.types![j]!.label }));

/** Each field a tree's leaves read, in order: a reading's own, or each a status `when` names. */
function fieldsOf(tree: Condition, field: string): string[] {
  const parts = groupOf(tree);
  return [...new Set(parts ? parts[1].flatMap((p) => fieldsOf(p, field)) : [(tree as ConditionLeaf).field ?? field])];
}

/** One leaf of a tree as the rows of its test (plan 783 D6): its Operation, the field's operators — Is one of and Is not
 *  one of where its values are known, Equals read back as Is one of with one tick — then what the operator takes: Value B,
 *  the Values or Start and End, each editable as a chip's are. A span from today is Time › Duration's: When, Value, Unit. */
function leafRows(leaf: ConditionLeaf, { field, type: typeOf, values: valuesOf }: TreeFacts): { kind: 'condition' | 'time'; type: string; rows: GraphRow[] } {
  const of = leaf.field ?? field;
  const type = typeOf(of);
  const picks = valuesOf(of)?.map((v) => ({ value: v, label: v }));
  const { op } = leaf;
  const operation = (value: string, choices: readonly RowChoice[]): GraphRow => ({ name: 'type', label: 'Operation', control: 'type', value, editable: true, choices });
  if (op === 'last' || op === 'next') {
    const span = leaf.value as Duration;
    const time = resolveKind(NODE_KINDS['time']!, 'duration').rows.filter((r) => r.control !== 'type');
    const rows = time.map(({ input: _in, ...r }): GraphRow => ({ ...r, value: r.name === 'when' ? op : r.name === 'n' ? span?.n : span?.unit, editable: true, ...(rowChoices(r) ? { choices: rowChoices(r, { count: span?.n })! } : {}) }));
    return { kind: 'time', type: 'duration', rows: [{ ...operation('duration', []), editable: false, hint: 'A span from today.' }, ...rows] };
  }
  if (!(op in OP_LABELS)) return { kind: 'condition', type: op, rows: [{ ...operation(op, []), editable: false }] };
  // A field whose values are known is PICKED, as its chip picks: ticks, Is one of or Is not one of.
  const ticks = !!picks?.length && (ONE.has(op) || MANY.has(op));
  const shown = ticks ? (op === 'ne' || op === 'notin' ? 'notin' : 'in') : op;
  const ops = ticks ? [...MANY] as FilterOp[] : [...new Set([...(OPS_FOR_TYPE[type ?? ''] ?? PICK_OPS), op])];
  const head = operation(shown, ops.map((o) => ({ value: o, label: OP_LABELS[o] })));
  const raw = leaf.value;
  const list = (Array.isArray(raw) ? raw : raw === undefined || raw === '' || raw === null ? [] : [raw]).map(String);
  if (OP_TAKES[op] === 'range') return { kind: 'condition', type: shown, rows: [head, { name: 'start', label: 'Start', control: 'text', value: list[0] ?? '', editable: true }, { name: 'end', label: 'End', control: 'text', value: list[1] ?? '', editable: true }] };
  if (ticks) return { kind: 'condition', type: shown, rows: [head, { name: 'b', label: 'Values', control: 'values', multiple: true, value: list, editable: true, choices: picks! }] };
  // Is one of with no values to pick from: each typed word a tag. Plan 749 P4
  if (LIST_OPS.includes(op)) return { kind: 'condition', type: shown, rows: [head, { name: 'b', label: 'Values', control: 'tags', multiple: true, value: list, editable: true }] };
  const value = raw !== null && typeof raw === 'object' ? JSON.stringify(raw) : raw;
  return { kind: 'condition', type: shown, rows: [head, { name: 'b', label: 'Value B', control: 'text', value: value ?? '', editable: true }] };
}

/** A condition node's rows, edited, as the condition they say: the other half of drawing one —
 *  the Query editor's row and a Preset Filter's graph alike (TODO 776). A value is typed text, or the
 *  values picked — each whole, a comma and all; only a TYPED list is split at its commas. Each is
 *  typed by its field. TRAP T-a-value-is-typed-once */
export function editedCondition(op: string, given: string | readonly string[], type?: string): ConditionLeaf {
  const one = (v: string): unknown => typedValue(type as FieldType | undefined, v);
  const text = Array.isArray(given) ? String(given[0] ?? '') : String(given);
  const list = (Array.isArray(given) ? [...given] : text.split(',')).map((v) => v.trim()).filter(Boolean).map(one);
  const at = op as FilterOp;
  if (at === 'in' || at === 'notin' || at === 'between' || at === 'notbetween') return { op: at, value: list };
  if (at === 'last' || at === 'next') {
    const [n = '1', unit = 'day'] = text.trim().split(/\s+/);
    return { op: at, value: { n: Number(n), unit: unit.replace(/s$/, '') as Duration['unit'] } };
  }
  return { op: at, value: one(text.trim()) };
}

/** A presentation's rows: editable where it has a slot to keep them, its kind the definition's by default. */
function presentationRows(
  presented: Presentation, kind: string | undefined,
  keys: readonly { value: string; label: string }[], slot: boolean,
): GraphRow[] {
  const kinds = rowChoices({ control: 'presentation' })!.map((c) => (c.value || !kind ? c : { ...c, label: `Default (${kind})` }));
  const sorts = [{ value: '', label: 'None' }, ...rowChoices({ control: 'direction' })!];
  return rowsOf('presentation', { ...presented, kind: presented.kind ?? '' }).map((row): GraphRow => (row.name === ROWS.name ? row : slot
    ? { ...row, editable: true, choices: row.name === 'kind' ? kinds : row.name === 'sort' ? sorts : keys, value: String(row.value ?? '') }
    : {
      ...row, value: String((row.name === 'kind' ? kind : row.value) ?? ''), hint: 'It shares the View: no slot keeps its own.',
      choices: row.name === 'kind' ? kinds : row.name === 'sort' ? sorts : keys,
    }));
}

/** A row of the Query the definition owns: its list, read only, and no socket — no connection reaches it. */
function owned(row: GraphRow, list: readonly { value: string; label: string }[] | undefined): GraphRow {
  const { input: _in, output: _out, ...rest } = row;
  return { ...rest, hint: FROM_DEFINITION, ...(list ? { choices: list } : {}) };
}

/** A kind's fixed rows, each with its value. */
function rowsOf(kind: string, values: Readonly<Record<string, unknown>>): GraphRow[] {
  return NODE_KINDS[kind]!.rows.map((row) => ({ ...row, value: values[row.name] }));
}

/** Whether a status value's `when` is a condition: a group of conditions, or one comparison. */
function isCondition(when: unknown): when is Condition {
  if (!when || typeof when !== 'object') return false;
  const t = when as Record<string, unknown>;
  const parts = t['and'] ?? t['or'];
  return parts !== undefined ? Array.isArray(parts) && parts.length > 0 && parts.every(isCondition) : typeof t['op'] === 'string' && 'value' in t;
}

/** Each status field's rows per value, over the whole store: how many each Condition of its chain took.
 *  A value with no `when` has no Condition, so none is counted. */
export async function statusTallies(
  store: Pick<Store, 'totalCount'>, domains: Readonly<Record<string, FieldDomain>>,
): Promise<Record<string, Record<string, number>>> {
  const done: Record<string, Record<string, number>> = {};
  for (const [field, domain] of Object.entries(domains)) {
    const named = Object.keys(domain.when ?? {});
    if (!named.length) continue;
    done[field] = Object.fromEntries(await Promise.all(named.map(async (value) => [value, await store.totalCount({ filter: [field, 'eq', value] })] as const)));
  }
  return done;
}

/** What is wrong with a Query graph's chains, in words: a status value whose `when` is no condition, and a
 *  connection that ends where no node, row or False is — a False needs a node that forks. */
export function queryGraphFaults(graph: DrawnGraph, domains: Readonly<Record<string, FieldDomain>> = {}): string[] {
  const faults: string[] = [];
  for (const [field, domain] of Object.entries(domains)) {
    for (const [value, when] of Object.entries(domain.when ?? {})) {
      if (!isCondition(when)) faults.push(`Status "${field}": the \`when\` of "${value}" is not a condition.`);
    }
  }
  const node = (id: string): GraphNode | undefined => graph.nodes.find((n) => n.id === id);
  for (const { from, to } of graph.connections) {
    const [a, b] = [socketOf(from), socketOf(to)];
    const [start, end] = [node(a.node), node(b.node)];
    if (!start || !end) faults.push(`A connection from "${from}" to "${to}" ends at a node that is not drawn.`);
    else if (a.row === FALSE_SOCKET && !start.branches) faults.push(`"${start.heading}" has no False to connection from "${from}".`);
    else if (b.row !== undefined && !end.rows.some((r) => r.name === b.row)) faults.push(`A connection into "${to}" ends at a row "${end.heading}" does not have.`);
  }
  return faults;
}

/** A page's Query as nodes and connections, laid out in columns by depth. */
export function queryGraph(query: Query, definition: PageDefinition, facts: QueryGraphFacts = {}): DrawnGraph {
  const label = (field: string): string => facts.label?.(field) ?? definition.source?.fields?.[field]?.label ?? field;
  const typeOf = (field: string): string | undefined => facts.type?.(field) ?? definition.source?.fields?.[field]?.type;
  const typed = (field: string): { type?: FieldType } => {
    const type = typeOf(field) as FieldType | undefined;
    return type ? { type } : {};
  };
  // Every field a Sort or Group may pick: the declared ones, then any a scope holds.
  const known = [...new Set([...Object.keys(definition.source?.fields ?? {}), ...Object.values(query.scopes).flatMap((s) => s.holds)])];
  const keys = [{ value: '', label: 'None' }, ...known.map((f) => ({ value: f, label: label(f) }))];
  const components = facts.components ?? [];
  const scopeOf = (c: GraphComponent): string => c.scope ?? (c.id in query.scopes ? c.id : VIEW);
  const nodes: (Omit<GraphNode, 'x' | 'y'> & { column: number })[] = [];
  const connections: NodeConnection[] = [];
  const add = (column: number, id: string, kind: string, rows: GraphRow[], own: Partial<GraphNode> = {}, type?: string): string => {
    const made = kindNode({ ...NODE_KINDS, [kind]: resolveKind(NODE_KINDS[kind]!, type) }, kind, id, rows, own);
    nodes.push({ ...made, column });
    return id;
  };
  // A field's whole tree (plan 783 D6): a Field node per field it reads, a test per leaf on its Field, an And or an Or per
  // group, a part's True into its group's header. `into`: the connections into its Fields, where a status chain hands rows on.
  const treeNodes = (
    column: number, root: string, tree: Condition, ctx: TreeFacts, own: Partial<GraphNode>, ref: Record<string, string>,
    apply: (row: GraphRow) => GraphRow = (r) => r, { back = 0.25, into = [] }: { back?: number; into?: readonly string[] } = {},
  ): string => {
    const whole = JSON.stringify(tree);
    const depth = (t: Condition): number => 1 + Math.max(0, ...(groupOf(t)?.[1] ?? []).map(depth));
    const fields = fieldsOf(tree, ctx.field);
    const base = root.startsWith('when-') ? root.slice('when-'.length) : root;
    const fieldNode = new Map(fields.map((f) => {
      const id = `field-${base}${fields.length > 1 || !root.startsWith('when-') ? `-${f}` : ''}`;
      const row: GraphRow = { name: 'field', label: 'Field', control: 'field', output: 'object', gives: 'field', value: f, editable: true, choices: ctx.fields };
      add(column - depth(tree) * back, id, 'field', [apply(row)], { heading: ctx.label(f), ref: { ...ref, field: f, tree: whole } });
      // Its header takes rows only where a chain hands them on; it forks nowhere in a Query.
      const made = nodes.at(-1)!;
      delete made.branches;
      if (!into.length) delete made.input;
      for (const from of into) connections.push({ from, to: id });
      return [f, id] as const;
    }));
    const walk = (part: Condition, path: readonly number[]): string => {
      const id = treeNodeId(root, path);
      const at = path.length ? { heading: ctx.label(ctx.field), description: groupWords(part) } : own;
      const nodeRef = { ...ref, path: path.join('.'), tree: whole };
      const off = part.off ? (row: GraphRow): GraphRow => apply({ ...row, hint: 'Off: kept, not applied.' }) : apply;
      const parts = groupOf(part);
      if (parts) {
        add(column - path.length * back, id, 'condition', [off({ name: 'type', label: 'Operation', control: 'type', value: parts[0], editable: true, choices: JOINS })], { ...at, ref: nodeRef }, parts[0]);
        parts[1].forEach((p, i) => connections.push({ from: walk(p, [...path, i + 1]), to: id }));
        return id;
      }
      const leaf = part as ConditionLeaf;
      const drawn = leafRows(leaf, ctx);
      add(column - path.length * back, id, drawn.kind, drawn.rows.map(off), { ...(path.length ? { heading: ctx.label(leaf.field ?? ctx.field) } : own), ref: nodeRef }, drawn.kind === 'time' ? 'duration' : drawn.type);
      connections.push({ from: `${fieldNode.get(leaf.field ?? ctx.field)}/field`, to: id });
      return id;
    };
    return walk(tree, []);
  };
  // A scope's presets: as declared now, else as its definition says them.
  const presetsOf = (scope: string): readonly ScopePreset[] => facts.presets?.(scope)
    ?? (definition.source?.scopes?.[scope]?.presets ?? []).map((p) => ({ id: p.id, label: p.label, readings: readingsOf(p.where, typed) }));

  // The Source ─▶ each status field its store works out ─▶ the View: the rows go Rows row to header. Its store and how
  // the page reads it are the definition's, until Save; its page size changes live. It forks nowhere in a Query.
  const source = definition.source;
  const stores = (value: unknown): RowChoice[] => rowChoices({ control: 'store', value }, { stores: facts.stores ?? [] })!;
  add(0, QUERY_NODE.source, 'source', [
    ...rowsOf('source', { store: source?.store }).map((row) => (row.name === ROWS.name ? row : owned(row, stores(source?.store)))),
    ...PAGE_ROWS.map((row): GraphRow => {
      const value = row.name === 'pageSize' ? facts.pageSize ?? source?.pageSize : row.name === 'search' ? source?.search ?? [] : source?.applyOn ?? 'change';
      return row.name === 'pageSize' ? { ...row, value, editable: true } : owned({ ...row, value }, row.name === 'search' ? known.map((f) => ({ value: f, label: label(f) })) : rowChoices(row));
    }),
  ]);
  delete nodes.at(-1)!.branches;
  // Each Source the reader placed, under it: its Store theirs to pick, and nothing the Query reads. TODO 808
  for (const kept of facts.kept ?? []) {
    add(0, kept.id, 'source', rowsOf('source', { store: kept.store }).map((row) => (row.name === ROWS.name ? row
      : { ...owned(row, stores(kept.store)), editable: true, hint: 'Yours to pick: the page reads its own.' })), { ref: { kept: kept.id }, warnings: [{ words: notThePage(source?.store) }] });
    delete nodes.at(-1)!.branches;
  }
  const statuses = Object.entries(facts.domains ?? {}).filter(([, d]) => d.when || d.statuses);
  const everyField = known.map((f) => ({ value: f, label: label(f) }));
  const readOnly = (hint: string) => (row: GraphRow): GraphRow => ({ ...row, editable: false, hint });
  const ctxOf = (field: string, fields: TreeFacts['fields']): TreeFacts => ({ field, type: typeOf, fields, values: (f) => facts.values?.(f), label });
  for (const [field, domain] of statuses) {
    const node = QUERY_NODE.status(field);
    const values = (domain.values ?? []).map(String);
    const whens = values.map((v) => domain.when?.[v]);
    const rows = values.map((value, i): GraphRow => ({
      name: value, label: value, input: 'boolean', value: domain.statuses?.[value] ?? '',
      hint: whens[i] === undefined ? 'Every row the values before it left. ' + FROM_STORE : !isCondition(whens[i]) ? `Its \`when\` is not a condition. ${FROM_STORE}` : FROM_STORE,
    }));
    connections.push({ from: sent(QUERY_NODE.source), to: add(1, node, 'status', [...rowsOf('status', {}), ...rows], { heading: label(field), ref: { field } }) });
    // Each value's `when` is a tree of tests on a Field per field it names; False hands the rows it left to the next value's Fields.
    let before: string | null = null;
    let at = 0;
    values.forEach((value, i) => {
      const when = whens[i];
      if (!isCondition(when)) {
        if (before && when === undefined) connections.push({ from: `${before}/${FALSE_SOCKET}`, to: `${node}/${value}` });
        before = null;
        return;
      }
      const id = treeNodes(0.5 + at++ * 0.01, QUERY_NODE.statusWhen(field, value), when, ctxOf(field, everyField), {
        heading: value, description: groupWords(when),
      }, { status: field, value }, readOnly(FROM_STORE), { back: 0.001, into: before ? [`${before}/${FALSE_SOCKET}`] : [] });
      connections.push({ from: id, to: `${node}/${value}` });
      before = id;
    });
  }
  // What the View's rows come from: each status field's, else the Source's.
  const fed = statuses.length ? statuses.map(([field]) => sent(QUERY_NODE.status(field))) : [sent(QUERY_NODE.source)];

  // Each scope — and one its definition gives presets, held or not.
  const scopes = Object.entries(query.scopes);
  for (const [id, declared] of Object.entries(source?.scopes ?? {})) {
    if (declared.presets?.length && !query.scopes[id]) scopes.push([id, { holds: [], readings: {} }]);
  }
  const view = scopes.find(([id]) => id === VIEW);
  const ordered = view ? [view, ...scopes.filter(([id]) => id !== VIEW)] : scopes;
  const onBars = new Set<string>();
  for (const [id, scope] of ordered) {
    const top = id === VIEW;
    const into = top ? 3 : 5;
    // The reader's own answer: a preset's rows are its own node's.
    const where = Object.entries(scope.readings).flatMap(([f, reading]) => {
      const tree = answerTree({ ...reading, suspended: false });
      return tree ? [[f, tree, !!reading.suspended] as const] : [];
    });
    const kept = Object.entries(scope.superseded ?? {}).flatMap(([f, reading]) => {
      const tree = answerTree(reading);
      return tree ? [[f, tree] as const] : [];
    });
    const presets = presetsOf(id);
    const fields = [...new Set([...scope.holds, ...where.map(([f]) => f), ...kept.map(([f]) => f)])];
    const shows = components.filter((c) => scopeOf(c) === id);
    // Its name: the definition's, else the one component that reads it.
    const named = source?.scopes?.[id]?.label
      ?? (components.find((c) => c.id === id) ?? (shows.length === 1 ? shows[0] : undefined))?.label;
    // Each preset's and each condition's True comes into its row.
    const rows: GraphRow[] = [
      ...rowsOf('scope', { [SWITCH]: !scope.suspended }).map((row) => (row.name === SWITCH ? { ...row, editable: true } : row)),
      ...presets.map((p): GraphRow => ({ name: `@${p.id}`, label: p.label, input: 'boolean' })),
      ...fields.map((f): GraphRow => ({ name: f, label: label(f), input: 'boolean' })),
    ];
    const node = add(top ? 4 : 6, QUERY_NODE.scope(id), 'scope', rows, {
      heading: named ?? (top ? 'View' : id),
      description: `${scope.holds.length} held${scope.suspended ? ' · filters off' : ''}`,
      ref: { scope: id },
    });
    for (const from of top || !view ? fed : [sent(QUERY_NODE.scope(VIEW))]) connections.push({ from, to: node });
    // Each preset, and each saved filter on its bar: on or off, and what it writes.
    for (const p of presets) {
      const saved = p.id.startsWith(SAVED_PRESET);
      if (saved) onBars.add(p.id.slice(SAVED_PRESET.length));
      const wrote = Object.entries(p.readings).flatMap(([f, reading]) => {
        const tree = answerTree(reading, typed(f));
        return tree ? [[f, tree] as const] : [];
      });
      const on = presetHeld(query, id, p.id, p.readings);
      // A Preset Filter is a preset too: its own graph says what it writes. TODO 776
      const entity = entityRefOf(p.id).type === PRESET_FILTER;
      const from = add(into, QUERY_NODE.preset(id, p.id), saved ? 'saved' : 'preset', [
        ...rowsOf(saved ? 'saved' : 'preset', { on }).map((row) => ({ ...row, editable: true })),
        ...wrote.map(([f]): GraphRow => ({ name: f, label: label(f), input: 'boolean' })),
      ], { heading: p.label, ref: { scope: id, preset: p.id }, ...(entity ? { icon: 'filter', description: FROM_ENTITY } : {}) });
      connections.push({ from, to: `${node}/@${p.id}` });
      // What it writes: each field a Condition, the definition's to change.
      for (const [f, tree] of wrote) {
        const hint = saved ? SAVED_WORDS : entity ? FROM_ENTITY : FROM_DEFINITION;
        connections.push({ from: treeNodes(into - 0.5, QUERY_NODE.presetWhen(id, p.id, f), tree, ctxOf(f, everyField), { heading: label(f), description: hint }, { preset: p.id, field: f }, readOnly(hint)), to: `${from}/${f}` });
      }
    }
    const held = fields.map((f) => ({ value: f, label: label(f) }));
    const factsOf = (field: string): TreeFacts => ctxOf(field, held);
    for (const [field, condition, off] of where) {
      const when = treeNodes(into, QUERY_NODE.condition(id, field), condition, factsOf(field), {
        heading: label(field),
        description: off ? 'Off: kept, not applied.' : 'Applied.',
      }, { scope: id, field });
      connections.push({ from: when, to: `${node}/${field}` });
    }
    // Its own answers the View holds over it: kept, not in force.
    for (const [field, condition] of kept) {
      const from = treeNodes(into, `kept-${id}-${field}`, condition, factsOf(field), {
        heading: label(field), description: 'Superseded: kept, not in force.',
      }, { scope: id, field, superseded: 'true' }, (row) => ({ ...row, editable: false, hint: SUPERSEDED }));
      connections.push({ from, to: `${node}/${field}` });
    }
    // The scope's rows on their way out: arranged, presented, then shown.
    let out = node;
    if (arranging(scope)) {
      const first = scope.sort?.[0];
      // Sort, Group and Search change as their chips do.
      out = add(7, QUERY_NODE.arrange(id), 'arrange', rowsOf('arrange', {
        sort: first?.field ?? '', direction: first?.direction ?? 'asc', group: scope.group ?? '', search: scope.search ?? '',
      }).map((row) => (row.name === ROWS.name ? row : row.name === 'search' ? { ...row, editable: true } : { ...row, editable: true, choices: row.name === 'direction' ? rowChoices(row)! : keys })), {
        ref: { scope: id },
      });
      connections.push({ from: sent(node), to: out });
    }
    // Each component its own Presentation: its SLOT's — its card's scope, kept in the
    // Query — and changed as Show as, Group and Sort change it. On the View it has no slot.
    for (const c of shows) {
      const slot = !top && (c.id === id || shows.length === 1);
      const presented = slot ? scope.presentation : undefined;
      let to = out;
      if (presented || c.kind) {
        to = add(8, `show-${c.id}`, 'presentation', presentationRows(presented ?? {}, c.kind, keys, slot), slot ? { ref: { scope: id } } : {});
        connections.push({ from: sent(out), to });
      }
      connections.push({ from: sent(to), to: add(9, QUERY_NODE.component(c.id), 'component', [], { heading: c.label, ref: { component: c.id, scope: id } }) });
    }
    // A slot's presentation with no component named to show it is still drawn.
    if (scope.presentation && !shows.length) {
      connections.push({ from: sent(out), to: add(8, `show-${id}`, 'presentation', presentationRows(scope.presentation, undefined, keys, !top), { ref: { scope: id } }) });
    }
  }
  // The page's own saved filters on no bar: what each would add, and no connection.
  for (const [id, set] of Object.entries(definition.savedFilters ?? {})) {
    if (!isSavedFilter(set) || onBars.has(id)) continue;
    const wrote = Object.entries(set.query.scopes).flatMap(([scope, s]) => Object.entries(readingsOf(s.where ?? {}, typed)).flatMap(([f, reading]) => {
      const tree = answerTree(reading, typed(f));
      return tree ? [{ name: `${scope}:${f}`, field: f, scope, tree }] : [];
    }));
    const from = add(3, QUERY_NODE.saved(id), 'saved', [
      ...rowsOf('saved', { on: false }).map((row) => ({ ...row, hint: NOT_ADDED })),
      ...wrote.map(({ name, field, scope }): GraphRow => ({ name, label: scope === VIEW ? label(field) : `${label(field)} (${scope})`, input: 'boolean' })),
    ], { heading: set.label, ref: { saved: id } });
    // What it would add: each field a Condition the saved filter owns, and no connection out.
    for (const { name, field, tree } of wrote) {
      connections.push({ from: treeNodes(2.5, QUERY_NODE.savedWhen(id, name), tree, ctxOf(field, everyField), { heading: label(field), description: SAVED_WORDS }, { saved: id, field }, readOnly(SAVED_WORDS)), to: `${from}/${name}` });
    }
  }

  // Columns with nothing in them close up; each column stacks its nodes.
  const used = [...new Set(nodes.map((n) => n.column))].sort((a, b) => a - b);
  const down = new Map<number, number>();
  const laid = nodes.map(({ column, ...node }) => {
    const x = used.indexOf(column) * COLUMN;
    const y = down.get(column) ?? 0;
    down.set(column, y + HEADER + node.rows.length * ROW + GAP);
    return { ...node, x, y };
  });
  return { nodes: laid, connections };
}

/** The whole tree a Condition node is a group of: its ref keeps it. */
function treeOf(node: Pick<GraphNode, 'ref'>): Condition | undefined {
  try {
    return JSON.parse(node.ref?.['tree'] ?? '') as Condition;
  } catch {
    return undefined;
  }
}

/** A group without its join: what is left to give it another. */
function withoutJoin(group: Condition): Record<string, unknown> {
  const { and: _and, or: _or, ...rest } = group as Record<string, unknown>;
  return rest;
}

/** A tree with the part at a path of part numbers made again by `edit`; the rest as it was. */
function atPath(tree: Condition, path: readonly number[], edit: (part: Condition) => Condition): Condition {
  const parts = groupOf(tree);
  if (!path.length || !parts) return edit(tree);
  return { ...tree, [parts[0]]: parts[1].map((p, i) => (i === path[0]! - 1 ? atPath(p, path.slice(1), edit) : p)) } as Condition;
}

/** A test's new leaf, from the edit of one of its rows and what the others show: a Condition's Operation and its value —
 *  Value B, the Values, or Start and End — or a span's When, Value and Unit. Each typed by its field. */
function editedLeaf(node: GraphNode, name: string, value: unknown, type: string | undefined): ConditionLeaf {
  const was = Object.fromEntries(node.rows.map((r) => [r.name, r.value]));
  const now = { ...was, [name]: value };
  if (node.kind === 'time') {
    const n = typedValue('number', String(now['n'] ?? ''));
    return { op: now['when'] === 'next' ? 'next' : 'last', value: { n: typeof n === 'number' ? n : 1, unit: (now['unit'] ?? 'day') as Duration['unit'] } };
  }
  const op = String(now['type']);
  // What the row showed before: a range's two ends, else its value; one value where one is asked, a list where several are.
  const ends = [now['start'], now['end']].filter((v) => v != null && v !== '').map(String);
  const one = [now['b'] ?? []].flat().filter((v) => v != null && v !== '').map(String);
  let given = OP_TAKES[op as FilterOp] === 'range' ? (ends.length ? ends : one) : now['b'] ?? (ends.length ? ends : '');
  if (ONE.has(op) && Array.isArray(given)) given = given[0] ?? '';
  return editedCondition(op, given as string | string[], type);
}

/**
 * The command a node's edit asks — the one a chip, a Switch or a menu asks for the same
 * act; none for a row nothing takes. A value is typed by its field. Plan 695 N1
 * TRAP T-one-command-one-door
 */
export function graphRequest({ node, row, value }: GraphEdit, facts: Pick<QueryGraphFacts, 'type'> = {}): QueryRequest | undefined {
  if (node.kind === 'source') {
    const size = typedValue('number', String(value ?? ''));
    return row.name === 'pageSize' && typeof size === 'number' && size >= 1 ? { pageSize: size } : undefined;
  }
  const scope = node.ref?.['scope'];
  if (!scope) return undefined;
  const was = Object.fromEntries(node.rows.map((r) => [r.name, r.value]));
  if (node.kind === 'scope') return row.name === SWITCH ? { scope, suspended: !value } : undefined;
  if (node.kind === 'preset' || node.kind === 'saved') {
    const preset = node.ref?.['preset'];
    return preset && row.name === 'on' ? { scope, preset, on: !!value } : undefined;
  }
  const field = node.ref?.['field'] ?? '';
  const tree = treeOf(node);
  // A Field picks another: the whole reading MOVES there, as one change (plan 783 D6).
  if (node.kind === 'field' && tree) {
    if (row.name !== 'field') return undefined;
    const to = String(value);
    const type = facts.type?.(to);
    const reading = treeReading(typedTree(tree, type as FieldType | undefined), type as FieldType | undefined);
    return to === field ? { scope, field, reading } : [{ scope, field, reading: null }, { scope, field: to, reading }];
  }
  if ((node.kind === 'condition' || node.kind === 'time') && tree) {
    const type = facts.type?.(field);
    const path = (node.ref?.['path'] ?? '').split('.').filter(Boolean).map(Number);
    const next = atPath(tree, path, (part) => {
      const parts = groupOf(part);
      // An And or an Or's Operation is its group's join.
      if (parts) return row.name === 'type' ? { ...withoutJoin(part), [value === 'or' ? 'or' : 'and']: parts[1] } as Condition : part;
      return { ...part, ...editedLeaf(node, row.name, value, type) } as Condition;
    });
    return { scope, field, reading: treeReading(next, type as FieldType | undefined) };
  }
  if (node.kind === 'arrange') {
    // A row cleared has no value: it asks for none, never the word "undefined".
    const pick = (name: string): string => String((row.name === name ? value : was[name]) ?? '');
    if (row.name === 'group') return { scope, group: pick('group') || null };
    if (row.name === 'search') return { scope, search: pick('search') };
    return { scope, sort: pick('sort') || null, direction: pick('direction') === 'desc' ? 'desc' : 'asc' };
  }
  if (node.kind === 'presentation') return { scope, presentation: { [row.name]: value ? String(value) : undefined } };
  return undefined;
}

/** What placing a node needs to know of the Query: what a scope holds and may hold, its presets, and which are on; the
 *  page's store, the app's, and the Sources kept. */
export interface PlaceFacts {
  holds: (scope: string) => readonly string[];
  fields: (scope: string) => readonly string[];
  presets: (scope: string) => readonly ScopePreset[];
  on: (scope: string, preset: string) => boolean;
  store?: string;
  stores?: readonly string[];
  kept?: readonly KeptSource[];
}

/** A Source a reader placed that the page does not read: its id and the store it names. Kept in the editor's draft for
 *  the tab, as a place is; Save writes the page's own definition, so it is saved nowhere (TODO 808). */
export interface KeptSource {
  id: string;
  store: string;
}

/** What placing a node asks: a command through the Query's door, a Source the editor keeps, or why it cannot. */
export type PlaceAnswer = { request: QueryRequest } | { refused: string } | { keep: KeptSource };

/** The kinds a Query draws and never places: a Field's tests are its chip's, and a status field the app's. Its node panel
 *  offers neither; `placeRequest` still says why, to one that asks. Will, 2026-11-10 */
export const QUERY_DRAWN_ONLY: readonly string[] = ['condition', 'status'];

/**
 * The command placing a node of a kind in a scope asks, or why it cannot: a Field holds the
 * scope's next field (its chip appears); a Condition tests a Field, so it is refused in words;
 * a Preset or a Saved filter switches on the next one the scope's bar has; a preset named by
 * its own id — a Preset Filter, a Custom Node of the Query's panel (TODO 776) — switches that
 * one on. A Status field is the app's own, so it is refused. A Source is KEPT: the page reads
 * one store, so it asks the Query nothing, and names the first store the page does not read
 * (TODO 808). Plan 783 D6 · TRAP T-one-command-one-door · TRAP T-a-second-source-is-kept
 */
export function placeRequest(kind: string, scope: string, facts: PlaceFacts): PlaceAnswer {
  const own = facts.presets(scope).find((p) => p.id === kind);
  if (own) return facts.on(scope, kind) ? { refused: `"${own.label}" is on already: its chip is pressed.` } : { request: { scope, preset: kind, on: true } };
  const name = NODE_KINDS[kind]?.heading ?? kind;
  if (kind === 'field') {
    const held = facts.holds(scope);
    const next = facts.fields(scope).find((f) => !held.includes(f));
    return next ? { request: { scope, hold: [...held, next] } }
      : { refused: `Scope "${scope}" holds every field it may, so it takes no new ${name}: take one from another scope, or free a field first.` };
  }
  if (kind === 'condition') return { refused: 'A Condition tests a Field: connect one in. In a Query, a Field\'s tests are its chip\'s: place a Field, then add them there.' };
  if (kind === 'preset' || kind === 'saved') {
    // The app's own, or the saved; a Preset Filter is its own Custom Node.
    const next = facts.presets(scope).find((p) => p.id.startsWith(SAVED_PRESET) === (kind === 'saved') && entityRefOf(p.id).type !== PRESET_FILTER && !facts.on(scope, p.id));
    return next ? { request: { scope, preset: next.id, on: true } }
      : { refused: `Scope "${scope}" has no ${name.toLowerCase()} left to switch on${kind === 'saved' ? ': a saved filter joins from the bar\'s Saved menu' : ''}.` };
  }
  if (kind === 'status') return { refused: `A ${name.toLowerCase()} is the app's own: the store's statusFields() works it out, and a Query cannot add one.` };
  if (kind === 'source') {
    const ids = new Set((facts.kept ?? []).map((k) => k.id));
    const free = (n: number): string => (ids.has(`source-${n}`) ? free(n + 1) : `source-${n}`);
    return { keep: { id: free(2), store: facts.stores?.find((s) => s !== facts.store) ?? facts.store ?? '' } };
  }
  return { refused: `The Query has no "${name}" to place.` };
}

/** The kept Sources after an edit of one's Store row; none, the edit is no kept Source's. */
export function keptEdit(kept: readonly KeptSource[], { node, row, value }: GraphEdit): KeptSource[] | undefined {
  const id = node.ref?.['kept'];
  if (!id || row.name !== 'store' || !kept.some((k) => k.id === id)) return undefined;
  return kept.map((k) => (k.id === id ? { ...k, store: String(value ?? '') } : k));
}

/** What a new connection asks: a command, or why it is refused; null, nothing to do. */
export type ConnectionAnswer = { request: QueryRequest } | { refused: string } | null;

/**
 * The command a new connection asks. The Query takes a condition into a field of a scope:
 * the same field in another scope MOVES it there; another field takes it, keeping the
 * values that field has. Anything else, or a move that would then say nothing, is refused.
 */
export function connectionRequest(graph: DrawnGraph, { from, to }: NodeConnection, facts: Pick<QueryGraphFacts, 'type' | 'values'> = {}): ConnectionAnswer {
  const was = graph.nodes.find((n) => n.id === socketOf(from).node);
  const { node: into, row: field = '' } = socketOf(to);
  const target = graph.nodes.find((n) => n.id === into);
  const scope = was?.ref?.['scope'];
  const old = was?.ref?.['field'];
  const there = target?.ref?.['scope'];
  // A kept Source is no part of the Query: nothing it sends reaches one.
  if (was?.ref?.['kept']) return { refused: `"${was.heading}" is not the page's Source: the Query reads nothing from it.` };
  // A switch takes no connection here: nothing in a page's Query says "driven by a node".
  if (rowOf(target?.rows ?? [], field)?.control === 'switch') {
    return { refused: `The Query takes no connection into "${target?.heading ?? into} › ${rowOf(target?.rows ?? [], field)?.label}": its Switch is the reader's, and a page's Query has no way to say a node drives it.` };
  }
  // A condition's True, at its tree's root: its header. Its False says nothing a scope's field takes.
  if (!['condition', 'time'].includes(was?.kind ?? '') || socketOf(from).row !== undefined || was!.ref?.['superseded'] || was!.ref?.['path'] || target?.kind !== 'scope' || !field || field.startsWith('@') || !scope || !old || !there) {
    return { refused: `The Query has no connection from "${was?.heading ?? from}" to "${target?.heading ?? to}": a condition's True goes into a field of a scope.` };
  }
  if (scope === there && old === field) return null;
  const whole = treeOf(was!);
  if (!whole) return { refused: `"${was!.heading}" holds no condition to move.` };
  const type = facts.type?.(field);
  const known = facts.values?.(field);
  // Another field takes only the values it has.
  const kept = (t: Condition): Condition => {
    const parts = groupOf(t);
    if (parts) return { ...t, [parts[0]]: parts[1].map(kept) } as Condition;
    const leaf = t as ConditionLeaf;
    if (field === old || !known || !(ONE.has(leaf.op) || MANY.has(leaf.op))) return leaf;
    const have = [leaf.value].flat().filter((v) => known.includes(String(v)));
    // Nothing it picks is there: a pick of none, which says nothing.
    if (!have.length) return { ...leaf, op: leaf.op === 'ne' || leaf.op === 'notin' ? 'notin' : 'in', value: [] };
    return { ...leaf, value: ONE.has(leaf.op) ? have[0] : have };
  };
  const reading = treeReading(typedTree(kept(whole), type as FieldType | undefined), type as FieldType | undefined);
  // It must still SAY something there: an empty pick filters nothing, so nothing moves.
  if (!answerTree(reading)) return { refused: `Nothing "${was!.heading}" picks is a value of "${field}": tick its values there.` };
  return { request: [{ scope, field: old, reading: null }, { scope: there, field, reading }] };
}
