/**
 * node-kinds.ts — the ONE registry of node kinds, for every graph Sherpa draws: a page's
 * Query and a workflow. Each kind once: its header, sockets, rows and what it stands for.
 * DOM-free. Will, TODOs 78, 555, 713 · plan 695 N1 · TRAP T-one-node-registry
 * TRAP T-a-socket-says-its-type
 *
 * Map:
 * - SocketType — What a socket carries: a value, an object, a boolean, or — an input only — any.
 * - SOCKET_WORDS — Each socket type in words, as a fault or a tip says it.
 * - accepts — Whether an output of one type may route into an input: its own type, or any.
 * - truthy — The road a value takes: True, unless it is nothing. Will, D2.
 * - RowControl — The control a row draws: text, a number, a switch, or the list a picklist reads.
 * - RowKind — One row a kind draws: its name, its label, its control and its sockets.
 * - NodeGraph — Where a kind is drawn: a page's Query, or a workflow.
 * - NodeKind — What a node IS: its header, its sockets, its rows, and what it stands for in the data layer.
 * - ROWS — The Rows row: the data rows a node sends on. They come in on its header.
 * - NODE_KINDS — Every kind the library ships, once. An app adds its own beside them.
 * - NODE_CATEGORIES — The node panel's categories, in order.
 * - PaletteItem — One node of the panel: the kind's id and the kind.
 * - PaletteGroup — One category of the panel, and its kinds in the registry's order.
 * - paletteOf — The node panel's list: each category with a workflow kind in it, in order; never a Query-only kind.
 * - fitOf — Where a new node of a kind joins a socket of a type: its header or a row; none, it does not fit.
 * - paletteFor — The palette's kinds a socket of a type could join, a Value first.
 * - Socket — A socket address, read: its node, and its row or none for the header's.
 * - socketOf — Read a socket address: `node`, the header's, or `node/row`.
 * - FALSE_SOCKET — The footer's False, as an address names it after its node.
 * - rowOf — The row of a kind a name says: its own, or one a group's part repeats.
 * - partName — A repeated row's name for a part of a group: the first part's is the row's own.
 * - partOf — A row's name as a part of a group: its base and its number, from 1.
 * - PartKind — One part of a condition group: a comparison, or a nested group.
 * - conditionRows — The rows a Condition node draws for its parts, in order: Join from two parts on.
 * - socketType — The type one socket of a kind carries; none, it has no such socket.
 * - takesMany — Whether an input of a kind takes several routes.
 * - NodeRoute — One route: an output socket to an input socket.
 * - NodeTie — One zip tie: a place, and the routes it funnels, in order. It changes no data.
 * - RowChoice — One pick in a row's list: the value it keeps, and its words.
 * - RowFacts — What a row's list is read from that the registry does not say.
 * - rowChoices — The list a picklist row reads; none, it is no picklist.
 * - fixedChoices — A fixed list, the same on every page; none, the list is open or the control is no picklist.
 * - mirrored — What a picklist row shows while routes drive it: what comes in, read only, each pick marked Custom.
 * - drivenSwitch — What a switch row shows while a boolean route drives it: True if any came in True, marked Custom.
 * - GraphRow — One row as drawn: its kind's parts, the value it shows, and whether a reader may change it.
 * - NodeSize — A node's size, in times its natural width and height, each 1 to 2.
 * - GraphNode — One node as drawn: its header, its sockets, its rows and its place.
 * - DrawnGraph — Nodes and routes, ready to draw: a workflow's, or a page's Query.
 * - GraphEdit — One row a reader changed: its node, its row and the new value.
 * - NodePlaces — Each node's place by its id: where a reader moved it.
 * - kindNode — A node of a kind, its rows given: the kind's header and sockets, under its own.
 * - placed — A graph with each node at its kept place.
 */
import { DATE_OP_LABELS, OP_LABELS, OPS_FOR_TYPE, type Duration, type FilterOp } from './store.js';
import { PRESENTATION_KINDS } from './query.js';

/** What a socket carries: one value; an object — a record, rows, or a list, for an array is
 *  an object (D17); a boolean, True or False; or, an input only, any of them (D1). */
export type SocketType = 'value' | 'object' | 'boolean' | 'any';

/** Each socket type in words, as a fault or a tip says it. */
export const SOCKET_WORDS: Readonly<Record<SocketType, string>> = { value: 'a value', object: 'an object', boolean: 'a boolean', any: 'any type' };

/** Whether an output of one type may route into an input: its own type, or `any`, which takes
 *  all. An output never sends `any`: it says what it sends. */
export function accepts(from: SocketType, to: SocketType): boolean {
  return from !== 'any' && (to === 'any' || to === from);
}

/** The road a value takes: True, unless it is nothing — none, false, 0, NaN, empty text, or
 *  an empty list, set or record. Will, D2. */
export function truthy(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Map || value instanceof Set) return value.size > 0;
  const proto: unknown = typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
  return (proto !== Object.prototype && proto !== null) || Object.keys(value).length > 0;
}

/** The control a row draws: text, a number or a switch; else the list a picklist reads — the
 *  fields, operators, the field's values, units, directions, presentations, Apply on, stores,
 *  scopes, joins or value types (`rowChoices`). */
export type RowControl =
  | 'text' | 'number' | 'switch'
  | 'field' | 'op' | 'values' | 'unit' | 'direction' | 'presentation' | 'apply' | 'store' | 'scope' | 'join' | 'type';

/** One row a kind draws: its name, its label, its control and its sockets. */
export interface RowKind {
  /** A route names the row by it, and a node keeps the row's value under it. */
  name: string;
  label: string;
  /** None: the row only names a socket, or shows a value. */
  control?: RowControl;
  /** Its list picks several, HTML's own name: its value is a list, and its sockets an object (D17). */
  multiple?: true;
  input?: SocketType;
  /** Its input takes several routes, each joined as the row says (D4); else a new one replaces it. */
  many?: true;
  output?: SocketType;
  /** One per PART of a group: a node draws it for each, named by `partName`. A Condition's field,
   *  operator, value and nested group. */
  repeat?: true;
  /** Its input takes only the True of a node of one of these kinds. */
  from?: readonly string[];
}

/** Where a kind is drawn: a page's Query, or a workflow. */
export type NodeGraph = 'query' | 'workflow';

/** What a node IS: its header, its sockets, its rows, and what it stands for in the data layer. */
export interface NodeKind {
  heading: string;
  icon: string;
  description?: string;
  /** The whole node's sockets, on its header. Its input is its DATA, of any type (D1): its rows
   *  and values say what it does with it. With `branches`, its output is True. */
  input?: SocketType;
  /** Its header input takes several routes (D4). */
  many?: true;
  output?: SocketType;
  /** A fork: True on the header's output, False on the footer's (`node/#false`), both booleans. */
  branches?: true;
  /** Its fixed rows; a Query node adds its own after them (a scope's fields). */
  rows: readonly RowKind[];
  /** The data layer's name for what it stands for: a shape, or the function a workflow runs it by. */
  model: string;
  graphs: readonly NodeGraph[];
  /** The node panel's category, one of `NODE_CATEGORIES` or an app's own; a workflow kind has one. */
  category?: string;
}

/** The Rows row: the data rows a node sends on, an object. They come in on its header (D1);
 *  it is first on each kind that gives them. Plan 713 §3 */
export const ROWS: Readonly<RowKind> = { name: 'rows', label: 'Rows', output: 'object' };

/** Every kind the library ships, once. An app adds its own beside them: `{ ...NODE_KINDS, mine }`.
 *  A kind a workflow runs forks (`branches`): its True and False say whether it gave anything
 *  (D2). The Query's own steps do not: nothing routes a branch from them. */
export const NODE_KINDS: Readonly<Record<string, NodeKind>> = {
  store: {
    heading: 'Store', icon: 'storage', description: 'Where the rows come from.', branches: true,
    rows: [ROWS, { name: 'store', label: 'Store', control: 'store', input: 'value' }], model: 'Store', graphs: ['query', 'workflow'], category: 'Sources',
  },
  // A page's Query: its rows read left to right, as the data flows.
  status: {
    heading: 'Status field', icon: 'status-ok', description: 'Each row given a value by conditions on its other fields.',
    input: 'any', rows: [ROWS], model: 'StatusField', graphs: ['query'], category: 'Status',
  },
  source: {
    heading: 'Source', icon: 'server', description: 'How the page reads its store.', input: 'any',
    rows: [
      ROWS,
      { name: 'pageSize', label: 'Page size', control: 'number' },
      { name: 'search', label: 'Search fields', control: 'field', multiple: true, input: 'object', output: 'object' },
      { name: 'applyOn', label: 'Apply on', control: 'apply' },
    ],
    model: 'SourceDefinition', graphs: ['query'],
  },
  // Its Switch, then a row per preset and per field it holds, each with a boolean input: a True.
  scope: {
    heading: 'Scope', icon: 'filter', input: 'any',
    rows: [ROWS, { name: '#filters', label: 'Filters', control: 'switch', input: 'boolean' }], model: 'ScopeQuery', graphs: ['query'],
  },
  // ONE group of the condition tree (D3): its join, then each part — a comparison's field, operator
  // and value, or a nested group's True into a Group row. True takes the rows that hold, False the rest.
  condition: {
    heading: 'Condition', icon: 'function', description: 'The rows that hold for a group of conditions.', input: 'any', branches: true,
    rows: [
      ROWS,
      { name: 'join', label: 'Join', control: 'join' },
      { name: 'field', label: 'Field', control: 'field', repeat: true, input: 'value', output: 'value' },
      { name: 'op', label: 'Operator', control: 'op', repeat: true, input: 'value' },
      { name: 'value', label: 'Value', control: 'values', repeat: true, input: 'value' },
      { name: 'group', label: 'Group', repeat: true, input: 'boolean', from: ['condition'] },
      { name: 'matches', label: 'Matches', output: 'value' },
    ],
    model: 'Condition', graphs: ['query', 'workflow'], category: 'Logic',
  },
  // Its on, then each field it writes.
  preset: {
    heading: 'Preset', icon: 'star', description: 'The app\'s own named conditions: a chip leading its scope.', branches: true,
    rows: [{ name: 'on', label: 'On', control: 'switch', input: 'boolean' }], model: 'ScopeDefinition.presets', graphs: ['query'], category: 'Presets',
  },
  saved: {
    heading: 'Saved filter', icon: 'floppy-disk', description: 'Filters kept under one name: a preset the reader made.', branches: true,
    rows: [{ name: 'on', label: 'On', control: 'switch', input: 'boolean' }], model: 'SavedFilter', graphs: ['query'], category: 'Saved filters',
  },
  arrange: {
    heading: 'Arrange', icon: 'sort-ascending', description: 'The rows\' order, groups and search.', input: 'any',
    rows: [
      ROWS,
      { name: 'sort', label: 'Sort', control: 'field' },
      { name: 'direction', label: 'Direction', control: 'direction' },
      { name: 'group', label: 'Group', control: 'field' },
      { name: 'search', label: 'Search', control: 'text' },
    ],
    model: 'Arrangement', graphs: ['query'],
  },
  presentation: {
    heading: 'Presentation', icon: 'insights', description: 'How a slot shows its rows.', input: 'any',
    rows: [
      ROWS,
      { name: 'kind', label: 'Show as', control: 'presentation' },
      { name: 'primary', label: 'Primary', control: 'field' },
      { name: 'secondary', label: 'Secondary', control: 'field' },
      { name: 'group', label: 'Group', control: 'field' },
      { name: 'sort', label: 'Sort', control: 'direction' },
    ],
    model: 'Presentation', graphs: ['query'],
  },
  component: { heading: 'Component', icon: 'table-columns', input: 'any', rows: [], model: 'bindSource', graphs: ['query'] },
  // A workflow: each kind over the data-layer function it runs by.
  value: {
    heading: 'Value', icon: 'function', description: 'One value, typed.', branches: true,
    rows: [{ name: 'value', label: 'Value', control: 'text', output: 'value' }, { name: 'type', label: 'Type', control: 'type' }], model: 'typedValue', graphs: ['workflow'], category: 'Variables',
  },
  pick: {
    heading: 'Pick', icon: 'price-tag', description: 'One field of the input.', input: 'any', branches: true,
    rows: [{ name: 'field', label: 'Field', control: 'field', input: 'value', output: 'value' }], model: 'readField', graphs: ['workflow'], category: 'Variables',
  },
  sort: {
    heading: 'Sort', icon: 'sort-ascending', description: 'The rows in order.', input: 'any', branches: true,
    rows: [
      ROWS,
      { name: 'field', label: 'Field', control: 'field', input: 'value' },
      { name: 'direction', label: 'Direction', control: 'direction', input: 'value' },
    ],
    model: 'sortRows', graphs: ['workflow'], category: 'Collections',
  },
  group: {
    heading: 'Group', icon: 'group', description: 'The rows by a field.', input: 'any', branches: true,
    rows: [ROWS, { name: 'field', label: 'Field', control: 'field', input: 'value' }], model: 'groupRows', graphs: ['workflow'], category: 'Collections',
  },
  count: {
    heading: 'Count', icon: 'insights', description: 'How many rows.', input: 'any', branches: true,
    rows: [{ name: 'count', label: 'Count', output: 'value' }], model: 'reduceRows', graphs: ['workflow'], category: 'Collections',
  },
  output: {
    heading: 'Output', icon: 'flag', description: 'Where the flow ends.', input: 'any', rows: [], model: 'LoadResult', graphs: ['workflow'], category: 'Output',
  },
};

/** The node panel's categories, in order, after Figma's (plan 713 §9.1). Each is empty until a kind
 *  names it; `Custom Nodes` (D9) stays empty until saved nodes come (M9, M12). */
export const NODE_CATEGORIES: readonly string[] = ['Sources', 'Custom Nodes', 'Variables', 'Math', 'Logic', 'Time', 'Utils', 'Collections', 'Output', 'Presets', 'Saved filters', 'Status'];

/** The categories a Query's panel lists: the kinds a Query takes placed. */
const QUERY_CATEGORIES: readonly string[] = ['Logic', 'Presets', 'Saved filters', 'Status'];

/** One node of the panel: the kind's id and the kind. */
export interface PaletteItem {
  id: string;
  kind: NodeKind;
}

/** One category of the panel, and its kinds in the registry's order. */
export interface PaletteGroup {
  category: string;
  items: PaletteItem[];
}

/** The node panel's list: each category with a kind of the graph in it, in `NODE_CATEGORIES`' order and
 *  then an app's own, in the order met. A workflow's has `Custom Nodes` always, empty or not, and never a
 *  Query-only kind; a Query's lists only the kinds a Query takes placed (`QUERY_CATEGORIES`). */
export function paletteOf(kinds: Readonly<Record<string, NodeKind>>, graph: NodeGraph = 'workflow'): PaletteGroup[] {
  const groups = new Map<string, PaletteItem[]>(NODE_CATEGORIES.map((c) => [c, []]));
  for (const [id, kind] of Object.entries(kinds)) {
    if (!kind.graphs.includes(graph)) continue;
    const category = kind.category ?? 'Other';
    if (graph === 'query' && !QUERY_CATEGORIES.includes(category)) continue;
    const items = groups.get(category) ?? [];
    items.push({ id, kind });
    groups.set(category, items);
  }
  const known = new Set(NODE_CATEGORIES);
  return [...groups].filter(([c, items]) => items.length || (graph === 'workflow' && c === 'Custom Nodes')).sort(([a], [b]) => Number(!known.has(a)) - Number(!known.has(b))).map(([category, items]) => ({ category, items }));
}

/** Where a new node of a kind joins a socket of a type: on the dragged OUTPUT's side, its header
 *  or row INPUT that takes the type; on a dragged INPUT's, its header or row OUTPUT the input takes.
 *  `{}` the header, `{ row }` a row; none, it does not fit. */
export function fitOf(kind: NodeKind, type: SocketType, side: 'out' | 'in'): { row?: string } | undefined {
  const key = side === 'out' ? 'input' : 'output';
  const fits = (t: SocketType | undefined): boolean => !!t && (side === 'out' ? accepts(type, t) : accepts(t, type));
  if (fits(kind[key])) return {};
  const row = kind.rows.find((r) => fits(r[key]));
  return row ? { row: row.name } : undefined;
}

/** The palette's kinds a socket of a type could join, a Value first (D16), then the palette's order. */
export function paletteFor(palette: readonly PaletteGroup[], type: SocketType, side: 'out' | 'in'): PaletteItem[] {
  const fit = palette.flatMap((g) => g.items).filter((i) => fitOf(i.kind, type, side));
  return [...fit.filter((i) => i.id === 'value'), ...fit.filter((i) => i.id !== 'value')];
}

/** A socket address, read: its node, and its row or none for the header's. */
export interface Socket {
  node: string;
  row?: string;
}

/** Read a socket address: `node`, the header's, or `node/row`. */
export function socketOf(address: string): Socket {
  const at = address.indexOf('/');
  return at < 0 ? { node: address } : { node: address.slice(0, at), row: address.slice(at + 1) };
}

/** The footer's False, as an address names it after its node: `node/#false`. A `#` part is no row. */
export const FALSE_SOCKET = '#false';

/** The sockets a kind says, or a node drawn of it. */
type Sockets = Pick<NodeKind, 'input' | 'output' | 'many' | 'branches'> & { rows: readonly RowKind[] };

/** The row of a kind a name says: its own, or the one a group's part repeats — `field-2` is the
 *  second part's `field`. */
export function rowOf<R extends Pick<RowKind, 'name' | 'repeat'>>(rows: readonly R[], name: string): R | undefined {
  const own = rows.find((r) => r.name === name);
  if (own) return own;
  const { base, part } = partOf(name);
  return part > 1 ? rows.find((r) => r.repeat && r.name === base) : undefined;
}

/** A repeated row's name for a part of a group, from 1: the first part's is the row's own. */
export function partName(base: string, part: number): string {
  return part > 1 ? `${base}-${part}` : base;
}

/** A row's name as a part of a group: its base and its number, from 1. */
export function partOf(name: string): { base: string; part: number } {
  const found = /^(.+)-(\d+)$/.exec(name);
  return found && Number(found[2]) > 1 ? { base: found[1]!, part: Number(found[2]) } : { base: name, part: 1 };
}

/** One part of a condition group: a comparison, or a nested group. */
export type PartKind = 'leaf' | 'group';

/** The rows a Condition node draws for its parts, in order: its Rows, its Join from two parts on,
 *  each part's — a comparison's Field, Operator and Value, or a Group — then Matches. `rows: false`
 *  leaves out what only a run gives: Rows and Matches. */
export function conditionRows(kind: Pick<NodeKind, 'rows'>, parts: readonly PartKind[], { rows = true }: { rows?: boolean } = {}): RowKind[] {
  const of = (name: string): RowKind => kind.rows.find((r) => r.name === name)!;
  const part = (names: readonly string[], n: number): RowKind[] => names.map((name) => {
    const { repeat: _repeat, from: _from, ...row } = of(name);
    return { ...row, name: partName(name, n) };
  });
  return [
    ...(rows ? [of(ROWS.name)] : []),
    ...(parts.length >= 2 ? [of('join')] : []),
    ...parts.flatMap((p, i) => part(p === 'leaf' ? ['field', 'op', 'value'] : ['group'], i + 1)),
    ...(rows ? [of('matches')] : []),
  ];
}

/** The type one socket of a kind, or of a node drawn of it, carries — its header's (no row), a
 *  row's, or its footer's False — on one side; none, it has no such socket. */
export function socketType(kind: Sockets, row: string | undefined, side: 'input' | 'output'): SocketType | undefined {
  const fork = side === 'output' && kind.branches ? 'boolean' : undefined;
  if (row === FALSE_SOCKET) return fork;
  return row === undefined ? fork ?? kind[side] : rowOf(kind.rows, row)?.[side];
}

/** Whether an input of a kind, or of a node drawn of it, takes several routes: its header's (no row), or a row's. */
export function takesMany(kind: Sockets, row?: string): boolean {
  return !!(row === undefined ? kind.many : rowOf(kind.rows, row)?.many);
}

/** One route: an output socket to an input socket, each `node`, `node/row` or `node/#false`. */
export interface NodeRoute {
  from: string;
  to: string;
  /** Bend points a reader gave it, in plane px, sorted by x. None, the default curve. TODO 744 */
  via?: readonly { x: number; y: number }[];
}

/** One zip tie: where it stands, and the routes it funnels, top to bottom. It changes no data. TODO 562 */
export interface NodeTie {
  id: string;
  x: number;
  y: number;
  routes: readonly NodeRoute[];
}

/** One pick in a row's list: the value it keeps, and its words. */
export interface RowChoice {
  value: string;
  label: string;
}

/** What a row's list is read from that the registry does not say. */
export interface RowFacts {
  /** Each field by name, its label and type: a page definition's `source.fields`. */
  fields?: Readonly<Record<string, { label?: string; type?: string }>>;
  /** The type of the field the row's node is on: it picks the operators. */
  type?: string;
  /** Every value that field may take. */
  values?: readonly string[];
  /** The stores, by the names the app registered them under. */
  stores?: readonly string[];
  scopes?: readonly string[];
}

const UNITS: readonly Duration['unit'][] = ['day', 'week', 'month', 'year'];

/** The lists that are the same on every page. */
const FIXED: Partial<Record<RowControl, readonly RowChoice[]>> = {
  unit: UNITS.map((u) => ({ value: u, label: `${u}s` })),
  direction: [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }],
  presentation: [{ value: '', label: 'Default' }, ...PRESENTATION_KINDS.map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) }))],
  apply: [{ value: 'change', label: 'Change' }, { value: 'input', label: 'Input' }],
  join: [{ value: 'and', label: 'All of' }, { value: 'or', label: 'Any of' }],
  type: [{ value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' }, { value: 'boolean', label: 'True/false' }],
};

/** The list a picklist row reads, for one pick or several (`multiple`); none, it is no picklist.
 *  An open list — fields, operators, values, stores, scopes — also offers each of the row's own
 *  values it lacks, so a select shows it. */
export function rowChoices(row: Pick<RowKind, 'control'> & { value?: unknown }, facts: RowFacts = {}): RowChoice[] | undefined {
  const fixed = row.control && FIXED[row.control];
  if (fixed) return [...fixed];
  const named = (list: readonly string[] = []): RowChoice[] => list.map((v) => ({ value: v, label: v }));
  const type = facts.type ?? 'text';
  const labels: Partial<Record<FilterOp, string>> = type === 'date' ? { ...OP_LABELS, ...DATE_OP_LABELS } : OP_LABELS;
  // Is one of and Is not one of, where the field's values are known.
  const ops = [...new Set([...OPS_FOR_TYPE[type] ?? [], ...(facts.values?.length ? ['in', 'notin'] as const : [])])];
  const open = row.control === 'field' ? Object.entries(facts.fields ?? {}).map(([value, f]) => ({ value, label: f.label ?? value }))
    : row.control === 'op' ? ops.map((op) => ({ value: op, label: labels[op] ?? op }))
    : row.control === 'values' ? named(facts.values)
    : row.control === 'store' ? named(facts.stores)
    : row.control === 'scope' ? named(facts.scopes)
    : undefined;
  if (!open) return undefined;
  const own = [...new Set([row.value].flat().filter((v) => v != null && v !== '').map(String))];
  return [...open, ...named(own.filter((v) => !open.some((c) => c.value === v)))];
}

/** A fixed list, the same on every page — directions, units, Apply on, joins, presentations,
 *  value types; none, a control whose list is open or that is no picklist. */
export function fixedChoices(control: RowControl | undefined): readonly RowChoice[] | undefined {
  return control ? FIXED[control] : undefined;
}

/** What a picklist row shows while routes drive it (D7): what comes in, read only, each pick
 *  marked Custom. A single pick shows the one that came in, and only it; a `multiple` row
 *  ticks each that came in, and marks Custom each its list lacks. The row's own pick is not
 *  here: the draft keeps it, and cutting the routes gives it back. Plan 713 §5, §9.5 */
export function mirrored(row: Pick<RowKind, 'multiple'>, given: readonly unknown[], list: readonly RowChoice[] = []): Pick<GraphRow, 'value' | 'choices' | 'custom'> {
  const custom = (v: string): RowChoice => ({ value: v, label: `${v} Custom` });
  const picks = [...new Set(given.flat().filter((v) => v != null && v !== '').map(String))];
  if (!row.multiple) return { value: picks[0] ?? '', choices: picks.slice(0, 1).map(custom), custom: true };
  return { value: picks, choices: [...list, ...picks.filter((v) => !list.some((c) => c.value === v)).map(custom)], custom: true };
}

/** What a switch row shows while a route drives it (D7): True if any boolean that came in is
 *  True, else False, marked Custom. The row's own state is not here: the draft keeps it, and
 *  cutting the route gives it back. Plan 731, 732 */
export function drivenSwitch(given: readonly boolean[]): Pick<GraphRow, 'value' | 'custom'> {
  return { value: given.some(Boolean), custom: true };
}

/** One row as drawn: its kind's parts, the value it shows, and whether a reader may change it. */
export interface GraphRow extends RowKind {
  value?: unknown;
  /** A select's choices, by value. */
  choices?: readonly RowChoice[];
  /** A reader may change it; else it is read only. */
  editable?: boolean;
  /** A line under it: what it is, or why it is read only. */
  hint?: string;
  /** Routes drive its picklist: it shows what comes in, each marked Custom, and its own pick waits. */
  custom?: true;
}

/** A node's size, in times its natural width and height; each from 1 (as it is) to 2 (double). */
export interface NodeSize {
  w: number;
  h: number;
}

/** One node as drawn: its header, its sockets, its rows and its place. */
export interface GraphNode {
  id: string;
  kind: string;
  heading: string;
  icon: string;
  description?: string;
  input?: SocketType;
  many?: true;
  output?: SocketType;
  branches?: true;
  rows: readonly GraphRow[];
  x: number;
  y: number;
  /** Its kind's panel category: the node's look is styled by it. */
  category?: string;
  /** How far a reader grew it, each way, in times its natural size: 1 to 2. */
  size?: NodeSize;
  /** What it stands for, for whoever takes its edits: a Query node's scope, field or preset. */
  ref?: Readonly<Record<string, string>>;
}

/** Nodes and routes, ready to draw: a workflow's, or a page's Query. */
export interface DrawnGraph {
  nodes: readonly GraphNode[];
  routes: readonly NodeRoute[];
  ties?: readonly NodeTie[];
}

/** One row a reader changed: its node, its row and the new value. */
export interface GraphEdit {
  node: GraphNode;
  row: GraphRow;
  value: unknown;
}

/** Each node's place by its id: where a reader moved it. */
export type NodePlaces = Readonly<Record<string, { x: number; y: number; size?: NodeSize }>>;

/** A node of a kind, its rows given: the kind's header and sockets, under its own. */
export function kindNode(
  kinds: Readonly<Record<string, NodeKind>>, kind: string, id: string, rows: readonly GraphRow[], own: Partial<GraphNode> = {},
): Omit<GraphNode, 'x' | 'y'> {
  const k = kinds[kind]!;
  return {
    id, kind, heading: k.heading, icon: k.icon, rows,
    ...(k.description ? { description: k.description } : {}),
    ...(k.input ? { input: k.input } : {}),
    ...(k.many ? { many: k.many } : {}),
    ...(k.output ? { output: k.output } : {}),
    ...(k.branches ? { branches: k.branches } : {}),
    ...(k.category ? { category: k.category } : {}),
    ...own,
  };
}

/** A graph with each node at its kept place; one never moved stays where it was laid out. */
export function placed(graph: DrawnGraph, places: NodePlaces): DrawnGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (places[n.id] ? { ...n, x: places[n.id]!.x, y: places[n.id]!.y, ...(places[n.id]!.size ? { size: places[n.id]!.size } : {}) } : n)) };
}
