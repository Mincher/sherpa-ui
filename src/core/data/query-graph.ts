/**
 * query-graph.ts — a page's Query drawn as nodes, for the Node Editor, and each edit made in
 * them as the command it asks. DERIVED each time the Query changes: the Source and its store's
 * status fields; the View Filters, the View's bar; each card's Presentation, its own filters and
 * Organise on its rows' path; the View they go into; presets, a store's Filters and superseded answers
 * — and which node each step of a load lights; and each Source a reader placed that the page does
 * not read. Kinds are the one registry's. DOM-free. Will, TODO 555 · plan 960 U4.8
 * docs/history/plan-78-query-editor.md · TRAP T-the-node-editor-asks-the-query
 * TRAP T-a-step-names-its-node · TRAP T-a-condition-is-a-tree-of-nodes
 *
 * Map:
 * - QUERY_NODE — Each Query node's id, as a step names it: the one scheme the graph is drawn by.
 * - queryStepNode — The node a span lights in a page's Query graph: the one it names, else its step's.
 * - WalkedNode — One node a scope's walk counted: its id, its rows, and the field it filters.
 * - walkedNodes — Each node a scope's walk counted, and its rows, by the walk's own step ids.
 * - LoadSteps — What a page's load did after its read: its walk's counts, and the rows it arranged.
 * - traceQuerySteps — Say what a load did after its read, each a step of its node, under the load.
 * - GraphComponent — One component of the page: a Content of the View, its id, its label and how it shows its rows.
 * - ScopePreset — One preset of a scope, as declared: its id, its name and the readings it writes.
 * - QueryGraphFacts — What drawing a Query needs that the Query does not say, and the Sources a reader keeps.
 * - whereGraph — A Where as the graph a Filter keeps it as: a Source, a Field and a test per field, each group joined.
 * - statusRule — A status field's rule as a Custom Node's inside, read only: each value's tree, its Pass out at its value.
 * - editedCondition — A condition node's rows, edited, as the condition they say: the other half of drawing one.
 * - statusTallies — Each status field's rows per value, over the whole store: how many rows each value takes.
 * - queryGraphFaults — What is wrong with a Query graph's chains, in words: a `when` that is no condition, a stray connection.
 * - LensGraph — A page's Query as its lens says it, each node as the definition holds it, and as it is drawn now.
 * - queryGraph — A page's Query as nodes and connections, laid out in columns by depth.
 * - queryLensGraph — A page's Query as its lens says it: kinds, values, own words, refs, editable rows, hints and Off.
 * - graphRequest — The command a node's edit asks, as a chip's would; none for a row nothing takes.
 * - orderRequest — The order a bar's chips are written in, as the Query's request; none where it is the drawn one.
 * - PlaceFacts — What placing a node needs of the Query: its holds, fields, presets and which are on.
 * - KeptSource — A Source a reader placed that the page does not read: kept in the editor's draft, saved nowhere.
 * - PlaceAnswer — What placing a node asks: a command, a Source to keep, or why it cannot.
 * - QUERY_DRAWN_ONLY — The kinds a Query draws and never places: its node panel offers neither.
 * - placeRequest — The command placing a node asks in a scope, a Source to keep, or why it cannot.
 * - keptEdit — The kept Sources after an edit of one's Store row; none, the edit is no kept Source's.
 * - ConnectionAnswer — What a new connection asks: a command, or why it is refused; null, nothing to do.
 * - connectionRequest — The command a new connection asks: a filter moved into a chip of View Filters, or onto a card's rows.
 */
import { storeOf, type PageDefinition } from './page-definition.js';
import { pageFields } from './type-definition.js';
import { PRESENTATION_KINDS, VIEW, arrangementOf, arranging, type Presentation, type Query, type QueryRequest, type ScopeQuery } from './query.js';
import { OP_LABELS, OP_TAKES, OPS_FOR_TYPE, groupOf, type Condition, type ConditionLeaf, type Duration, type FilterOp, type Store } from './store.js';
import { answerTree, typedTree, typedValue, type FieldReading, type FieldType } from './filter-state.js';
import { ALL, spellConditions } from './filter-face.js';
import { parseWhere, readingsOf, treeReading, type Where } from './where.js';
import { presetHeld } from './query-edits.js';
import { entityRefOf, type EntityGraph } from './entity.js';
import { FILTER } from './entity-types.js';
import type { FieldDomain } from './validate.js';
import {
  LIST_OPS, NODE_KINDS, ROWS, TEST_KINDS, kindNode, resolveKind, rowChoices, rowOf, socketOf, storedValues, typedControl,
  type DrawnGraph, type GraphEdit, type GraphNode, type GraphRow, type NodeConnection, type RowChoice,
} from './node-kinds.js';
import { traceStep, type Span, type TraceContext } from './trace.js';
import type { Walk } from './walk.js';
import type { WorkflowNode } from './workflow.js';
import type { NodeDefinition } from './node-library.js';
import type { LensNode } from './lens-registry.js';
import { conditionWords } from './graph-text.js';

/** A test's properties, as its kind gives them (plan 971 A): Pass and Fail. */
const TEST_ROWS: Readonly<Record<'condition' | 'time', readonly GraphRow[]>> = {
  condition: resolveKind(NODE_KINDS['condition']!, 'and').rows.filter((r) => r.property),
  time: resolveKind(NODE_KINDS['time']!, 'duration').rows.filter((r) => r.property),
};
/** A reading with every value ticked, as the Query graph's test names it. */
const EVERY = 'all';

/** Each Query node's id, as a step names it: the one scheme the graph is drawn by.
 *  TRAP T-a-step-names-its-node */
export const QUERY_NODE = {
  source: 'source',
  status: (field: string): string => `status-${field}`,
  statusWhen: (field: string, value: string): string => `status-${field}.${value}`,
  /** A value's row on its status field's node: a step lights a row by its address. TODO 983 */
  statusValue: (field: string, value: string): string => `status-${field}/${value}`,
  scope: (scope: string): string => `scope-${scope}`,
  condition: (scope: string, field: string): string => `when-${scope}-${field}`,
  field: (scope: string, field: string): string => `field-${scope}-${field}`,
  preset: (scope: string, preset: string): string => `preset-${scope}-${preset}`,
  presetWhen: (scope: string, preset: string, field: string): string => `when-preset-${scope}-${preset}-${field}`,
  organise: (scope: string): string => `organise-${scope}`,
  viewFilters: 'view-filters',
  view: 'view',
  /** A Content: a card's, the one that carries its bar, by its scope; any other by its component's id. */
  presentation: (id: string): string => `presentation-${id}`,
  /** The node that carries a scope's bar: the View's View Filters, a card's Presentation. */
  bar: (scope: string): string => (scope === VIEW ? 'view-filters' : `presentation-${scope}`),
  /** A card's own filters, two or more, joined. */
  and: (scope: string): string => `and-${scope}`,
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
  // A status field's step: the field with them all; each value's row and its Condition inside with the rows that took it.
  for (const [field, tally] of Object.entries(statuses ?? {})) {
    traceStep(QUERY_NODE.status(field), { parent, state: 'done', rows: Object.values(tally).reduce((a, b) => a + b, 0) });
    for (const [value, rows] of Object.entries(tally)) {
      traceStep(QUERY_NODE.statusValue(field, value), { parent, state: 'done', rows });
      traceStep(QUERY_NODE.statusWhen(field, value), { parent, state: 'done', rows });
    }
  }
  for (const [scope, results] of Object.entries(walk.results)) {
    const q = applied.scopes[scope];
    const rows = walk.ends?.[scope];
    traceStep(QUERY_NODE.bar(scope), { parent, state: q?.suspended ? 'skipped' : 'done', ...(rows !== undefined ? { rows } : {}) });
    for (const { node, rows: counted, field } of walkedNodes(scope, results)) {
      const off = !!q?.suspended || !!(field && q?.readings[field]?.suspended);
      traceStep(node, { parent, state: off ? 'skipped' : 'done', rows: counted });
    }
  }
  const arranged = arrangementOf(applied).scope;
  if (arranged) traceStep(QUERY_NODE.organise(arranged), { parent, state: 'done', ...(total !== undefined ? { rows: total } : {}) });
}

/** One column's width, in plane px: a node and the room for its connections. */
const COLUMN = 360;
/** A node's height, estimated: its header, and each row. The reader moves what overlaps. */
const HEADER = 72;
const ROW = 64;
const GAP = 40;

/** One component of the page: a Content of the View, its id, its label and how it shows its rows. */
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
  /** The components the page binds: each is a Presentation, a Content of the View. */
  components?: readonly GraphComponent[];
  /** A field's type — text, number or date — which picks its operators. */
  type?: (field: string) => string | undefined;
  /** Every value a field may take, for a condition to pick from rather than type. */
  values?: (field: string) => readonly string[] | undefined;
  /** A scope's presets as declared now — the app's, and each Filter over its store. Absent, the definition's. */
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

/** A bar's filter Switch: the kind's own row, before its chips and presets. */
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
const OPENS_RULE = 'The app\'s store works it out. Open the node to see its rule.';
const FROM_ENTITY = 'A Filter: its own graph changes it, in the Node Editor.';
const SUPERSEDED = 'The View holds this field: kept, not in force. It comes back when the View lets it go.';
const CHIP = 'Its Condition changes it.';
const EVERY_FILTER = 'Rows in every filter of the card.';

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
  // Every value ticked (TODO 965): "has a value", said as its chip says it. Its chip changes it.
  if ((op as string) === EVERY) return { kind: 'condition', type: EVERY, rows: [{ ...operation(EVERY, [{ value: EVERY, label: ALL }]), editable: false, hint: 'Has a value: every row with a value of this field. Its chip changes it.' }] };
  if (!(op in OP_LABELS)) return { kind: 'condition', type: op, rows: [{ ...operation(op, []), editable: false }] };
  // A field whose values are known is PICKED, as its chip picks: ticks, Is one of or Is not one of.
  const ticks = !!picks?.length && (ONE.has(op) || MANY.has(op));
  const shown = ticks ? (op === 'ne' || op === 'notin' ? 'notin' : 'in') : op;
  const ops = ticks ? [...MANY] as FilterOp[] : [...new Set([...(OPS_FOR_TYPE[type ?? ''] ?? PICK_OPS), op])];
  const head = operation(shown, ops.map((o) => ({ value: o, label: OP_LABELS[o] })));
  const raw = leaf.value;
  const list = (Array.isArray(raw) ? raw : raw === undefined || raw === '' || raw === null ? [] : [raw]).map(String);
  // A value of its field takes that field's type's control: a number, a date (plan 986). TRAP T-a-row-takes-its-values-type
  const control = typedControl(type) ?? 'text';
  if (OP_TAKES[op] === 'range') return { kind: 'condition', type: shown, rows: [head, { name: 'start', label: 'Start', control, value: list[0] ?? '', editable: true }, { name: 'end', label: 'End', control, value: list[1] ?? '', editable: true }] };
  if (ticks) return { kind: 'condition', type: shown, rows: [head, { name: 'b', label: 'Values', control: 'values', multiple: true, value: list, editable: true, choices: picks! }] };
  // Is one of with no values to pick from: each typed word a tag. Plan 749 P4
  if (LIST_OPS.includes(op)) return { kind: 'condition', type: shown, rows: [head, { name: 'b', label: 'Values', control: 'tags', multiple: true, value: list, editable: true }] };
  const value = raw !== null && typeof raw === 'object' ? JSON.stringify(raw) : raw;
  return { kind: 'condition', type: shown, rows: [head, { name: 'b', label: 'Value B', control, value: value ?? '', editable: true }] };
}

/** What a tree's nodes need: the ids its root starts, the rows its Fields take, a Field's id, its first column, the field a
 *  leaf that names none reads, and each field's type. */
interface TreeAt {
  root: string;
  into: readonly string[];
  fieldId: (field: string) => string;
  x: number;
  field: string;
  type: (field: string) => string | undefined;
  own?: Pick<WorkflowNode, 'heading' | 'description'>;
}

/** A condition tree as a Filter keeps it: a Field per field it tests, each taking the rows `into` sends; a test per leaf,
 *  drawn as the Query graph draws one (`leafRows`); an And or an Or per group, each part's Pass into its header. Where the
 *  root says its tree: its Pass (a Time's, its header). */
function treeGraph(tree: Condition, at: TreeAt, nodes: WorkflowNode[], connections: NodeConnection[]): string {
  const fields = new Map<string, string>();
  const fieldOf = (field: string): string => {
    if (!fields.has(field)) {
      const id = at.fieldId(field);
      nodes.push({ id, kind: 'field', x: at.x, y: fields.size * 200, values: { field } });
      for (const from of at.into) connections.push({ from, to: id });
      fields.set(field, id);
    }
    return fields.get(field)!;
  };
  let tests = 0;
  const walk = (part: Condition, path: readonly number[]): string => {
    const id = treeNodeId(at.root, path);
    const own = path.length ? {} : at.own ?? {};
    const parts = groupOf(part);
    if (parts) {
      const ends = parts[1].map((p, i) => walk(p, [...path, i + 1]));
      nodes.push({ id, kind: 'condition', x: at.x + 720 + path.length * 120, y: 0, values: { type: parts[0] }, ...own });
      for (const from of ends) connections.push({ from, to: id });
      return `${id}/pass`;
    }
    const leaf = part as ConditionLeaf;
    const field = leaf.field ?? at.field;
    const drawn = leafRows(leaf, { field, type: at.type, fields: [], values: () => undefined, label: (f) => f });
    // A list's values as the Where gives them, typed: the rows show them as text.
    const values = storedValues(drawn.rows);
    const list = Array.isArray(leaf.value) ? [...leaf.value as unknown[]] : undefined;
    if (list && 'start' in values) Object.assign(values, { start: list[0], end: list[1] });
    else if (list && Array.isArray(values['b'])) values['b'] = list;
    nodes.push({ id, kind: drawn.kind, x: at.x + 360, y: tests++ * 200, values, ...own });
    connections.push({ from: `${fieldOf(field)}/field`, to: id });
    return drawn.kind === 'condition' ? `${id}/pass` : id;
  };
  return walk(tree, []);
}

/**
 * A Where as the graph a Filter keeps it as (plan 960 U4.4b, D6): a Source over its store, then its tree (`treeGraph`), the
 * root's Pass into `#out/where`. Its places are a first layout: it unfurls the first time it is shown.
 */
export function whereGraph(where: Readonly<Where>, { source, type = () => undefined }: { source?: string; type?: (field: string) => string | undefined } = {}): EntityGraph {
  const nodes: WorkflowNode[] = [{ id: 'source', kind: 'source', x: 0, y: 0, ...(source ? { values: { store: source } } : {}) }];
  const connections: NodeConnection[] = [];
  const tree = parseWhere(where);
  if (tree) {
    const says = treeGraph(tree, { root: 'when', into: [`source/${ROWS.name}`], fieldId: (f) => `field-${f}`, x: 360, field: '', type }, nodes, connections);
    connections.push({ from: says, to: '#out/where' });
  }
  return { nodes, connections, unfurl: true };
}

/**
 * A status field's rule as a Custom Node's inside, read only (plan 960 U4.7b): the rows in at its Group Input; each value's
 * `when` a tree (`treeGraph`), its Pass out at that value's row of the Group Output, its Fail into the next value's Fields,
 * in the order the first match is taken; the last value, with no `when`, the rows the rest left. A load lights each root.
 */
export function statusRule(field: string, domain: FieldDomain, { label = (f) => f, type = () => undefined }: { label?: (field: string) => string; type?: (field: string) => string | undefined } = {}): NodeDefinition {
  const values = (domain.values ?? []).map(String);
  const nodes: WorkflowNode[] = [];
  const connections: NodeConnection[] = [];
  const rows = `#in/${ROWS.name}`;
  let before: string | null = null;
  let at = 0;
  for (const value of values) {
    const when = domain.when?.[value];
    if (!isCondition(when)) {
      if (before && when === undefined) connections.push({ from: before, to: `#out/${value}` });
      before = null;
      continue;
    }
    const root = QUERY_NODE.statusWhen(field, value);
    const own = { heading: value, description: conditionWords(when, label) };
    connections.push({ from: treeGraph(when, { root, into: [before ?? rows], fieldId: (f) => `field-${root}-${f}`, x: at++ * 1080, field, type, own }, nodes, connections), to: `#out/${value}` });
    before = `${treeNodeId(root, [])}/fail`;
  }
  return {
    v: 1, label: label(field), preset: true, unfurl: true, description: FROM_STORE,
    inputs: [{ name: ROWS.name, label: ROWS.label, type: 'object' }],
    outputs: values.map((v) => ({ name: v, label: v, type: 'object' })),
    nodes, connections,
  };
}

/** A condition node's rows, edited, as the condition they say: the other half of drawing one —
 *  the Query editor's row and a Filter's graph alike (TODO 776). A value is typed text, or the
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

/** What a presentation's row says where no slot keeps it: the View's is shared. */
const SHARED = 'It shares the View: no slot keeps its own.';

/** A Presentation's rows: its card's bar, where it carries it; then how it shows its rows, editable where it has a slot to
 *  keep them, its kind the definition's by default; then its Content. */
function presentationRows(presented: Presentation, kind: string | undefined, slot: boolean, bar: readonly GraphRow[]): GraphRow[] {
  const kinds = rowChoices({ control: 'presentation' })!.map((c) => (c.value || !kind ? c : { ...c, label: `Default (${kind})` }));
  const sorts = [{ value: '', label: 'None' }, ...rowChoices({ control: 'direction' })!];
  return [...bar, ...rowsOf('presentation', { ...presented, kind: presented.kind ?? '' }).flatMap((row): GraphRow[] => {
    if (row.name === SWITCH) return [];
    if (row.property) return [row];
    return [slot
      ? { ...row, editable: true, choices: row.name === 'kind' ? kinds : sorts, value: String(row.value ?? '') }
      : { ...row, value: String((row.name === 'kind' ? kind : row.value) ?? ''), hint: SHARED, choices: row.name === 'kind' ? kinds : sorts }];
  })];
}

/** A chip's pick in words, as its chip's tip spells it; none, it picks nothing. */
function pickWords(reading: FieldReading | undefined, type: FieldType | undefined): string | undefined {
  if (!reading) return undefined;
  const tree = reading.all ? undefined : answerTree({ ...reading, suspended: false });
  const said = reading.all ? ALL : tree ? spellConditions({ type: type ?? 'text', values: [], answer: tree }) : '';
  return said ? `${reading.suspended ? 'Off: ' : ''}${said}` : undefined;
}

/** The axes an Organise node sets, by row, and the presentation key each keeps. */
const AXES: Readonly<Record<string, keyof Presentation>> = { primary: 'primary', secondary: 'secondary', segments: 'group' };

/** A scope's Organise rows (plan 960 U4.2): its sort, group and search, editable as their chips are; its axes, its slot's
 *  presentation, editable where it has a slot to keep them. */
function organiseRows(scope: ScopeQuery, keys: readonly { value: string; label: string }[], slot: boolean): GraphRow[] {
  const first = scope.sort?.[0];
  const presented = slot ? scope.presentation ?? {} : {};
  const values: Record<string, unknown> = { sort: first?.field ?? '', direction: first?.direction ?? 'asc', group: scope.group ?? '', search: scope.search ?? '' };
  for (const [row, key] of Object.entries(AXES)) values[row] = presented[key] ?? '';
  // The Query owns each row: none takes a connection, as a chip's value takes none.
  return rowsOf('organise', values).map(({ input: _in, ...row }): GraphRow => {
    if (row.name === ROWS.name) return row;
    if (row.name === 'search') return { ...row, editable: true };
    if (row.name in AXES && !slot) return { ...row, choices: keys, hint: SHARED };
    return { ...row, editable: true, choices: row.name === 'direction' ? rowChoices(row)! : keys };
  });
}

/** A row of the Query the definition owns: its list, read only, and no socket — no connection reaches it. */
function owned(row: GraphRow, list: readonly { value: string; label: string }[] | undefined): GraphRow {
  const { input: _in, output: _out, ...rest } = row;
  return { ...rest, hint: FROM_DEFINITION, ...(list ? { choices: list } : {}) };
}

/** A kind's fixed rows, each with its value. */
function rowsOf(kind: string, values: Readonly<Record<string, unknown>>): GraphRow[] {
  // A row a workflow's alone is not drawn: a page reads every field, and its Query filters its rows.
  return NODE_KINDS[kind]!.rows.filter((row) => !row.graphs || row.graphs.includes('query')).map((row) => ({ ...row, value: values[row.name] }));
}

/** Whether a status value's `when` is a condition: a group of conditions, or one comparison. */
function isCondition(when: unknown): when is Condition {
  if (!when || typeof when !== 'object') return false;
  const t = when as Record<string, unknown>;
  const parts = t['and'] ?? t['or'];
  return parts !== undefined ? Array.isArray(parts) && parts.length > 0 && parts.every(isCondition) : typeof t['op'] === 'string' && 'value' in t;
}

/** Each status field's rows per value, over the whole store: how many rows each value takes, the last too. */
export async function statusTallies(
  store: Pick<Store, 'totalCount'>, domains: Readonly<Record<string, FieldDomain>>,
): Promise<Record<string, Record<string, number>>> {
  const done: Record<string, Record<string, number>> = {};
  for (const [field, domain] of Object.entries(domains)) {
    const ruled = Object.keys(domain.when ?? {});
    if (!ruled.length) continue;
    // Every value, the last too: it is the rows the rest left, and the store says which those are.
    const named = (domain.values ?? ruled).map(String);
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
    else if (a.row !== undefined && !start.rows.some((r) => r.name === a.row)) faults.push(`A connection from "${from}" leaves a row "${start.heading}" does not have.`);
    else if (b.row !== undefined && !end.rows.some((r) => r.name === b.row)) faults.push(`A connection into "${to}" ends at a row "${end.heading}" does not have.`);
  }
  return faults;
}

/** A page's Query as its lens says it (plan 1004c), each node as a definition holds it, and as it is drawn now: one
 *  builder makes both, node by node, so they never disagree. */
export interface LensGraph {
  nodes: readonly LensNode[];
  connections: readonly NodeConnection[];
  drawn: DrawnGraph;
}

/** A page's Query as nodes and connections, laid out in columns by depth. */
export function queryGraph(query: Query, definition: PageDefinition, facts: QueryGraphFacts = {}): DrawnGraph {
  return queryLensGraph(query, definition, facts).drawn;
}

/**
 * A page's Query as its lens says it: each node's kind, values, own words and `ref`, the rows a reader may change, each
 * row's hint, and Off; with the same nodes drawn, in columns by depth. Its ids are QUERY_NODE's, in the order drawn.
 * TRAP T-the-node-editor-asks-the-query
 */
export function queryLensGraph(query: Query, definition: PageDefinition, facts: QueryGraphFacts = {}): LensGraph {
  // The fields the page declares: its own, else its type's.
  const declared = pageFields(definition.source);
  const label = (field: string): string => facts.label?.(field) ?? declared[field]?.label ?? field;
  const typeOf = (field: string): string | undefined => facts.type?.(field) ?? declared[field]?.type;
  const typed = (field: string): { type?: FieldType } => {
    const type = typeOf(field) as FieldType | undefined;
    return type ? { type } : {};
  };
  // Every field a Sort or Group may pick: the declared ones, then any a scope holds.
  const known = [...new Set([...Object.keys(declared), ...Object.values(query.scopes).flatMap((s) => s.holds)])];
  const keys = [{ value: '', label: 'None' }, ...known.map((f) => ({ value: f, label: label(f) }))];
  const components = facts.components ?? [];
  const scopeOf = (c: GraphComponent): string => c.scope ?? (c.id in query.scopes ? c.id : VIEW);
  const nodes: (Omit<GraphNode, 'x' | 'y'> & { column: number })[] = [];
  const meant: Omit<LensNode, 'x' | 'y'>[] = [];
  const connections: NodeConnection[] = [];
  // Each node twice, from the one call: as drawn, and as the lens's definition says it.
  const add = (column: number, id: string, kind: string, rows: GraphRow[], own: Partial<GraphNode> & { off?: boolean } = {}, type?: string): string => {
    const { off, ...drawn } = own;
    const made = kindNode({ ...NODE_KINDS, [kind]: resolveKind(NODE_KINDS[kind]!, type) }, kind, id, rows, drawn);
    nodes.push({ ...made, column });
    const values = storedValues(rows);
    const hints = Object.fromEntries(rows.flatMap((r) => (r.hint ? [[r.name, r.hint]] : [])));
    meant.push({
      id, kind, ...(drawn.heading ? { heading: drawn.heading } : {}), ...(drawn.description ? { description: drawn.description } : {}),
      ...(Object.keys(values).length ? { values } : {}), ...(drawn.ref ? { ref: drawn.ref } : {}),
      editable: rows.filter((r) => r.editable).map((r) => r.name), ...(Object.keys(hints).length ? { hints } : {}), ...(off ? { off: true } : {}),
    });
    return id;
  };
  // The page's rows: the Source's. Every Field reads them.
  const fed: readonly string[] = [sent(QUERY_NODE.source)];
  // A field's whole tree (plan 783 D6): a Field node per field it reads, a test per leaf on its Field, an And or an Or per
  // group, a part's Pass into its group's header; each Field takes the page's rows. It returns where the root says its tree
  // (a Condition's Pass, a Time's header), and its Pass and Fail (plan 971 §9).
  const treeNodes = (
    column: number, root: string, tree: Condition, ctx: TreeFacts, own: Partial<GraphNode> & { off?: boolean }, ref: Record<string, string>,
    apply: (row: GraphRow) => GraphRow = (r) => r,
  ): { says: string; pass: string; fail: string } => {
    const back = 0.25;
    const whole = JSON.stringify(tree);
    const depth = (t: Condition): number => 1 + Math.max(0, ...(groupOf(t)?.[1] ?? []).map(depth));
    const fields = fieldsOf(tree, ctx.field);
    const base = root.startsWith('when-') ? root.slice('when-'.length) : root;
    const fieldNode = new Map(fields.map((f) => {
      const id = `field-${base}${fields.length > 1 || !root.startsWith('when-') ? `-${f}` : ''}`;
      const row: GraphRow = { name: 'field', label: 'Field', control: 'field', output: 'object', gives: 'field', value: f, editable: true, choices: ctx.fields };
      add(column - depth(tree) * back, id, 'field', [apply(row)], { heading: ctx.label(f), ref: { ...ref, field: f, tree: whole } });
      for (const from of fed) connections.push({ from, to: id });
      return [f, id] as const;
    }));
    const walk = (part: Condition, path: readonly number[]): string => {
      const id = treeNodeId(root, path);
      const at = path.length ? { heading: ctx.label(ctx.field), description: groupWords(part) } : own;
      const nodeRef = { ...ref, path: path.join('.'), tree: whole };
      const off = part.off ? (row: GraphRow): GraphRow => apply({ ...row, hint: 'Off: kept, not applied.' }) : apply;
      // Off: a part turned off, or a whole filter suspended (its root's).
      const kept = { ...(part.off || (!path.length && own.off) ? { off: true } : {}), ref: nodeRef };
      const parts = groupOf(part);
      if (parts) {
        add(column - path.length * back, id, 'condition', [off({ name: 'type', label: 'Operation', control: 'type', value: parts[0], editable: true, choices: JOINS }), ...TEST_ROWS.condition], { ...at, ...kept }, parts[0]);
        parts[1].forEach((p, i) => connections.push({ from: walk(p, [...path, i + 1]), to: id }));
        return `${id}/pass`;
      }
      const leaf = part as ConditionLeaf;
      const drawn = leafRows(leaf, ctx);
      add(column - path.length * back, id, drawn.kind, [...drawn.rows.map(off), ...TEST_ROWS[drawn.kind]], { ...(path.length ? { heading: ctx.label(leaf.field ?? ctx.field) } : own), ...kept }, drawn.kind === 'time' ? 'duration' : drawn.type);
      connections.push({ from: `${fieldNode.get(leaf.field ?? ctx.field)}/field`, to: id });
      return drawn.kind === 'condition' ? `${id}/pass` : id;
    };
    return { says: walk(tree, []), pass: `${treeNodeId(root, [])}/pass`, fail: `${treeNodeId(root, [])}/fail` };
  };
  // A scope's presets: as declared now, else as its definition says them.
  const presetsOf = (scope: string): readonly ScopePreset[] => facts.presets?.(scope)
    ?? (definition.source?.scopes?.[scope]?.presets ?? []).map((p) => ({ id: p.id, label: p.label, readings: readingsOf(p.where, typed) }));

  // The Source ─▶ each status field its store works out ─▶ each Field and card: the rows go Rows row to header. Its store and how
  // the page reads it are the definition's, until Save; its page size changes live. It forks nowhere in a Query.
  const source = definition.source;
  const store = source && storeOf(source);
  const stores = (value: unknown): RowChoice[] => rowChoices({ control: 'store', value }, { stores: facts.stores ?? [] })!;
  add(0, QUERY_NODE.source, 'source', [
    ...rowsOf('source', { store }).map((row) => (row.name === ROWS.name ? row : owned(row, stores(store)))),
    ...PAGE_ROWS.map((row): GraphRow => {
      const value = row.name === 'pageSize' ? facts.pageSize ?? source?.pageSize : row.name === 'search' ? source?.search ?? [] : source?.applyOn ?? 'change';
      return row.name === 'pageSize' ? { ...row, value, editable: true } : owned({ ...row, value }, row.name === 'search' ? known.map((f) => ({ value: f, label: label(f) })) : rowChoices(row));
    }),
  ]);
  // Each Source the reader placed, under it: its Store theirs to pick, and nothing the Query reads. TODO 808
  for (const kept of facts.kept ?? []) {
    add(0, kept.id, 'source', rowsOf('source', { store: kept.store }).map((row) => (row.name === ROWS.name ? row
      : { ...owned(row, stores(kept.store)), editable: true, hint: 'Yours to pick: the page reads its own.' })), { ref: { kept: kept.id }, warnings: [{ words: notThePage(store) }] });
  }
  // A worked-out status field: one with `when`. A stored field may carry looks per value (`statuses`) and is no status node.
  const statuses = Object.entries(facts.domains ?? {}).filter(([, d]) => d.when);
  const everyField = known.map((f) => ({ value: f, label: label(f) }));
  const readOnly = (hint: string) => (row: GraphRow): GraphRow => ({ ...row, editable: false, hint });
  const ctxOf = (field: string, fields: TreeFacts['fields']): TreeFacts => ({ field, type: typeOf, fields, values: (f) => facts.values?.(f), label });
  // A worked-out status field is ONE Field node on the page's rows, a row per value saying its rule (plan 960 U4.7b): the
  // rule itself is its inside, `statusRule`, opened read only. TRAP T-a-status-opens-its-rule
  for (const [field, domain] of statuses) {
    const said = (value: string): string => {
      const when = domain.when?.[value];
      return when === undefined ? 'Every row the values before it left.' : isCondition(when) ? conditionWords(when, label) : 'Its `when` is not a condition.';
    };
    const rows: GraphRow[] = [
      { name: 'field', label: 'Field', control: 'field', value: field, editable: false, hint: FROM_STORE, choices: [{ value: field, label: label(field) }] },
      ...(domain.values ?? []).map(String).map((value): GraphRow => ({ name: value, label: value, value: said(value), hint: OPENS_RULE })),
    ];
    connections.push({ from: sent(QUERY_NODE.source), to: add(1, QUERY_NODE.status(field), 'field', rows, { heading: label(field), ref: { field, status: field } }) });
  }

  // Each scope, the View first — and one its definition gives presets, held or not. Every page has its View.
  const scopes = Object.entries(query.scopes);
  for (const [id, declared] of Object.entries(source?.scopes ?? {})) {
    if (declared.presets?.length && !query.scopes[id]) scopes.push([id, { holds: [], readings: {} }]);
  }
  const ordered: [string, ScopeQuery][] = [[VIEW, query.scopes[VIEW] ?? { holds: [], readings: {} }], ...scopes.filter(([id]) => id !== VIEW)];
  const view = QUERY_NODE.view;
  for (const [id, scope] of ordered) {
    const top = id === VIEW;
    const into = top ? 3 : 5;
    // The reader's own answer: a preset's rows are its own node's.
    const where = Object.entries(scope.readings).flatMap(([f, reading]) => {
      // Every value ticked is in force, "has a value" (TODO 965): drawn as its own test, as its chip shows it.
      const tree = reading.all ? ({ op: EVERY } as unknown as Condition) : answerTree({ ...reading, suspended: false });
      return tree ? [[f, tree, !!reading.suspended] as const] : [];
    });
    const kept = Object.entries(scope.superseded ?? {}).flatMap(([f, reading]) => {
      const tree = answerTree(reading);
      return tree ? [[f, tree] as const] : [];
    });
    const superseded = new Set(kept.map(([f]) => f));
    const presets = presetsOf(id);
    const fields = [...new Set([...scope.holds, ...where.map(([f]) => f), ...kept.map(([f]) => f)])];
    const shows = components.filter((c) => scopeOf(c) === id);
    // Its name: the definition's, else the one component that reads it.
    const named = source?.scopes?.[id]?.label
      ?? (components.find((c) => c.id === id) ?? (shows.length === 1 ? shows[0] : undefined))?.label;
    // Its bar (plan 960 U4.8): the Switch, a chip per field it holds in order, saying its pick, then a row per preset. On View
    // Filters each chip takes its filter's Pass; a card's chip takes no line, its filter on the rows' path.
    const bar = QUERY_NODE.bar(id);
    const chip = (f: string): GraphRow => {
      const said = pickWords(scope.readings[f], typeOf(f) as FieldType | undefined);
      return { name: f, label: label(f), ...(top || superseded.has(f) ? { input: 'any' as const } : {}), ...(said ? { value: said } : {}), hint: superseded.has(f) ? SUPERSEDED : CHIP };
    };
    const barRows: GraphRow[] = [
      { ...rowOf(NODE_KINDS['view-filters']!.rows, SWITCH)!, value: !scope.suspended, editable: true },
      ...fields.map(chip),
      ...presets.map((p): GraphRow => ({ name: `@${p.id}`, label: p.label, input: 'boolean' })),
    ];
    const description = `${scope.holds.length} held${scope.suspended ? ' · filters off' : ''}`;
    // Each preset, the app's or a Filter: on or off, and what it writes.
    for (const p of presets) {
      const wrote = Object.entries(p.readings).flatMap(([f, reading]) => {
        const tree = answerTree(reading, typed(f));
        return tree ? [[f, tree] as const] : [];
      });
      const on = presetHeld(query, id, p.id, p.readings);
      // A Filter is a preset too: its own graph says what it writes. TODO 776
      const entity = entityRefOf(p.id).type === FILTER;
      const from = add(into, QUERY_NODE.preset(id, p.id), 'preset', [
        ...rowsOf('preset', { on }).map((row) => ({ ...row, editable: true })),
        ...wrote.map(([f]): GraphRow => ({ name: f, label: label(f), input: 'any' })),
      ], { heading: p.label, ref: { scope: id, preset: p.id }, ...(entity ? { icon: 'filter', description: FROM_ENTITY } : {}) });
      connections.push({ from, to: `${bar}/@${p.id}` });
      // What it writes: each field a Condition, the definition's to change.
      for (const [f, tree] of wrote) {
        const hint = entity ? FROM_ENTITY : FROM_DEFINITION;
        connections.push({ from: treeNodes(into - 0.5, QUERY_NODE.presetWhen(id, p.id, f), tree, ctxOf(f, everyField), { heading: label(f), description: hint }, { preset: p.id, field: f }, readOnly(hint)).says, to: `${from}/${f}` });
      }
    }
    const held = fields.map((f) => ({ value: f, label: label(f) }));
    const factsOf = (field: string): TreeFacts => ctxOf(field, held);
    // Its own filters: a View filter's Pass into its chip; a card's onto its rows' path (plan 971 §9: no True).
    const passes: string[] = [];
    for (const [field, condition, off] of where) {
      const { says, pass } = treeNodes(into, QUERY_NODE.condition(id, field), condition, factsOf(field), {
        heading: label(field),
        description: off ? 'Off: kept, not applied.' : 'Applied.', ...(off ? { off } : {}),
      }, { scope: id, field });
      if (top) connections.push({ from: says, to: `${bar}/${field}` });
      else passes.push(pass);
    }
    // Its own answers the View holds over it: kept, not in force, into its chip.
    for (const [field, condition] of kept) {
      const { says } = treeNodes(into, `kept-${id}-${field}`, condition, factsOf(field), {
        heading: label(field), description: 'Superseded: kept, not in force.',
      }, { scope: id, field, superseded: 'true' }, (row) => ({ ...row, editable: false, hint: SUPERSEDED }));
      connections.push({ from: says, to: `${bar}/${field}` });
    }
    // A card's rows on their way: its filters, two or more joined in ONE And; then its Organise.
    let rows: readonly string[] = passes.length ? passes : fed;
    if (passes.length > 1) {
      const and = add(6, QUERY_NODE.and(id), 'condition', [
        { name: 'type', label: 'Operation', control: 'type', value: 'and', choices: JOINS, hint: EVERY_FILTER }, ...TEST_ROWS.condition,
      ], { heading: named ?? id, description: `All of ${passes.length} filters`, ref: { scope: id } }, 'and');
      for (const from of passes) connections.push({ from, to: and });
      rows = [`${and}/pass`];
    }
    // A slot keeps its card's presentation: a card's scope, not the View.
    const slotted = !top && (shows.length === 1 || shows.some((c) => c.id === id) || (!shows.length && !!scope.presentation));
    if (arranging(scope) || slotted) {
      // Sort, Group and Search change as their chips do; the axes as a card's do. The View's arranges every card (Q2 A).
      const organise = add(7, QUERY_NODE.organise(id), 'organise', organiseRows(scope, keys, slotted), { ref: { scope: id } });
      for (const from of rows) connections.push({ from, to: organise });
      rows = [sent(organise)];
    }
    if (top) {
      add(8, bar, 'view-filters', [...barRows, ...rowsOf('view-filters', {}).filter((row) => row.name !== SWITCH)], { description, ref: { scope: id } });
      if (rows !== fed) connections.push({ from: rows[0]!, to: bar });
      connections.push({ from: `${bar}/filters`, to: `${view}/filters` });
    }
    // Each component a Content (Will, D4): its Presentation, its rows from the Source, a card's through its path. A card's
    // bar is on one of them, the component named as its scope, else its first; a card with none still has its own.
    const holder = top ? undefined : shows.find((c) => c.id === id) ?? shows[0];
    const contents = shows.length ? shows : top && !scope.presentation ? [] : [undefined];
    for (const c of contents) {
      const bears = !top && c === holder;
      const slot = !top && (!c || c.id === id || shows.length === 1);
      const presented = slot ? scope.presentation ?? {} : {};
      const node = add(8, bears ? bar : QUERY_NODE.presentation(c?.id ?? id), 'presentation', presentationRows(presented, c?.kind, slot, bears ? barRows : []), {
        heading: c?.label ?? named ?? (top ? 'View' : id), ...(bears ? { description } : {}), ref: { scope: id, ...(c ? { component: c.id } : {}) },
      });
      for (const from of top ? fed : rows) connections.push({ from, to: node });
      connections.push({ from: `${node}/content`, to: `${view}/content` });
    }
  }
  // The View: the View Filters over every Content (Will, D4).
  add(9, view, 'view', rowsOf('view', {}));

  // Columns with nothing in them close up; each column stacks its nodes.
  const used = [...new Set(nodes.map((n) => n.column))].sort((a, b) => a - b);
  const down = new Map<number, number>();
  const laid = nodes.map(({ column, ...node }) => {
    const x = used.indexOf(column) * COLUMN;
    const y = down.get(column) ?? 0;
    down.set(column, y + HEADER + node.rows.length * ROW + GAP);
    return { ...node, x, y };
  });
  return { nodes: meant.map((n, i) => ({ ...n, x: laid[i]!.x, y: laid[i]!.y })), connections, drawn: { nodes: laid, connections } };
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
  // A bar's Switch: on View Filters, or on a card's Presentation.
  if (row.name === SWITCH) return { scope, suspended: !value };
  if (node.kind === 'preset') {
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
  if (node.kind === 'organise') {
    // An axis is the slot's presentation, as a card's chip sets it.
    const axis = AXES[row.name];
    if (axis) return { scope, presentation: { [axis]: value ? String(value) : undefined } };
    // A row cleared has no value: it asks for none, never the word "undefined".
    const pick = (name: string): string => String((row.name === name ? value : was[name]) ?? '');
    if (row.name === 'group') return { scope, group: pick('group') || null };
    if (row.name === 'search') return { scope, search: pick('search') };
    return { scope, sort: pick('sort') || null, direction: pick('direction') === 'desc' ? 'desc' : 'asc' };
  }
  if (node.kind === 'presentation') return row.name === 'kind' || row.name === 'sort' ? { scope, presentation: { [row.name]: value ? String(value) : undefined } } : undefined;
  return undefined;
}

/** The order a bar's chips are written in, as the Query's request, `{ scope, order }`; none where it is the drawn one. A
 *  bar's chips are its rows its kind has not, but its presets. A chip with no pick keeps no value, so it keeps its place. */
export function orderRequest(node: GraphNode, written: Readonly<Record<string, unknown>> = {}): QueryRequest | undefined {
  const scope = node.ref?.['scope'];
  if (!scope || !node.rows.some((r) => r.name === SWITCH)) return undefined;
  const own = new Set(NODE_KINDS[node.kind]?.rows.map((r) => r.name));
  const chips = node.rows.map((r) => r.name).filter((name) => !own.has(name) && !name.startsWith('@'));
  const order = Object.keys(written).filter((name) => chips.includes(name));
  return order.join('\n') === chips.filter((name) => order.includes(name)).join('\n') ? undefined : { scope, order };
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

/** The kinds a Query draws and never places: a Field's tests are its chip's, and a scope has its one Organise. Its node
 *  panel offers neither; `placeRequest` still says why, to one that asks. Will, 2026-11-10 */
export const QUERY_DRAWN_ONLY: readonly string[] = ['condition', 'organise'];

/**
 * The command placing a node of a kind in a scope asks, or why it cannot: a Field holds the
 * scope's next field (its chip appears); a Condition tests a Field, so it is refused in words;
 * a Preset switches on the next of the app's own the scope's bar has; a preset named by
 * its own id — a Filter, a Custom Node of the Query's panel (TODO 776) — switches that
 * one on. A Source is KEPT: the page reads
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
  if (kind === 'preset') {
    // The app's own; a Filter is its own Custom Node.
    const next = facts.presets(scope).find((p) => entityRefOf(p.id).type !== FILTER && !facts.on(scope, p.id));
    return next ? { request: { scope, preset: next.id, on: true } }
      : { refused: `Scope "${scope}" has no ${name.toLowerCase()} left to switch on.` };
  }
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
 * The command a new connection asks. A filter's tree leaves by its root's True or Pass: into a chip of View Filters, it
 * moves into the View, under that chip's field; onto a card's rows' path (the header of its Presentation, its Organise or
 * its And), it moves into that card, its field the same. Another field takes it, keeping the values that field has. Anything
 * else, or a move that would then say nothing, is refused. Plan 960 U4.8
 */
export function connectionRequest(graph: DrawnGraph, { from, to }: NodeConnection, facts: Pick<QueryGraphFacts, 'type' | 'values'> = {}): ConnectionAnswer {
  const was = graph.nodes.find((n) => n.id === socketOf(from).node);
  const { node: into, row = '' } = socketOf(to);
  const target = graph.nodes.find((n) => n.id === into);
  const scope = was?.ref?.['scope'];
  const old = was?.ref?.['field'];
  const there = target?.ref?.['scope'];
  // A kept Source is no part of the Query: nothing it sends reaches one.
  if (was?.ref?.['kept']) return { refused: `"${was.heading}" is not the page's Source: the Query reads nothing from it.` };
  // A switch takes no connection here: nothing in a page's Query says "driven by a node".
  if (rowOf(target?.rows ?? [], row)?.control === 'switch') {
    return { refused: `The Query takes no connection into "${target?.heading ?? into} › ${rowOf(target?.rows ?? [], row)?.label}": its Switch is the reader's, and a page's Query has no way to say a node drives it.` };
  }
  // A tree's root leaves by its Pass (a Time's by its header too, plan 971); a part, or one kept, moves nowhere.
  const via = socketOf(from).row;
  const root = !!was && TEST_KINDS.has(was.kind) && !was.ref?.['path'] && !was.ref?.['superseded']
    && (via === 'pass' || (was.kind === 'time' && via === undefined));
  // Where it lands: a chip that takes a line, its field; a card's rows' path, its own.
  const chip = !!row && !row.startsWith('@') && !!rowOf(target?.rows ?? [], row)?.input;
  const path = !row && !!there && there !== VIEW && !target?.ref?.['field'] && !target?.ref?.['preset'];
  const field = chip ? row : path ? old : undefined;
  if (!root || !scope || !old || !there || !field) {
    return { refused: `The Query has no connection from "${was?.heading ?? from}" to "${target?.heading ?? to}": a filter's Pass goes into a chip of View Filters, or onto a card's rows.` };
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
