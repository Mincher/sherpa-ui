/**
 * node-kinds.ts — the ONE registry of node kinds, for every graph Sherpa draws: a page's
 * Query and a workflow. Each kind once: its header, sockets, rows and what it stands for.
 * DOM-free. Will, TODOs 78, 555, 713 · plan 695 N1 · TRAP T-one-node-registry
 * TRAP T-a-socket-says-its-type
 *
 * Map:
 * - SocketType — What a socket carries: a value, an object, a boolean, or — an input only — any.
 * - SOCKET_WORDS — Each socket type in words, as a fault or a tip says it.
 * - accepts — Whether an input reads what an output of a type sends: its own type, or any; else it reads null.
 * - truthy — The road a value takes: True, unless it is nothing. Will, D2.
 * - RowControl — The control a row draws: text, a message, a number, a switch, or the list a picklist reads.
 * - RowKind — One row a kind draws: its name, its label, its control and its sockets.
 * - NodeGraph — Where a kind is drawn: a page's Query, or a workflow.
 * - NodeType — One type of a family kind: its words, its hint and what it adds to the kind's rows and sockets.
 * - NodeKind — What a node IS: its header, its sockets, its rows, and what it stands for in the data layer.
 * - propertyRow — A property row, the one definition: output only, no control and no value, sending what the node's data or log…
 * - ROWS — The Rows row: the data rows a node sends on. They come in on its header.
 * - addTypes — A family with more types: an app's own beside the shipped ones, as a Ticket Output.
 * - LIST_OPS — The operators whose value is a list: Is one of, Is not one of.
 * - NODE_KINDS — Every kind the library ships, once. An app adds its own beside them.
 * - categorySlug — A category as the slug a node's, and its panel row's, `data-category` says.
 * - typeOf — The type of a family kind a node's `type` names: its own, else the kind's default.
 * - typeChoices — The types of a family kind as a picklist reads them; none, it is no family.
 * - resolveKind — A family kind as an ordinary kind for one type: the type row first, then the kind's rows and the type's.
 * - resolveKind — A family kind as an ordinary kind for one type: the type row first, then the kind's rows and the type's.
 * - resolveKind — A family kind as an ordinary kind for one type: the type row first, then the kind's rows and the type's.
 * - kindIn — A kind as one graph draws it: a family with only the types that graph takes; none, it draws no such kind.
 * - kindOfNode — The kind a node is, for its own type and operators; none, no such kind.
 * - rowOfOtherType — A row a family kind has under another type than this one: it, and the types that hold it.
 * - NODE_CATEGORIES — The node panel's categories, in order.
 * - PaletteItem — One node of the panel: the kind's id and the kind.
 * - PaletteGroup — One category of the panel, and its kinds in the registry's order.
 * - paletteOf — The node panel's list: each category with a workflow kind in it, in order; never a Query-only kind.
 * - paletteMatch — How a panel item answers a search: by its name or a tag, or by a type's name, whole first.
 * - fitOf — Where a new node of a kind joins a socket of a type: its header or a row, as a family's type.
 * - paletteFor — The palette's kinds a socket of a type could join, a Value first.
 * - Socket — A socket address, read: its node, and its row or none for the header's.
 * - socketOf — Read a socket address: `node`, the header's, or `node/row`.
 * - downstreamOf — Every node the routes lead to from these, and on from each; these left out.
 * - FALSE_SOCKET — The footer's False, as an address names it after its node.
 * - rowOf — The row of a kind a name says.
 * - socketType — The type one socket of a kind carries; none, it has no such socket.
 * - takesMany — Whether an input of a kind takes several routes.
 * - NodeRoute — One route: an output socket to an input socket.
 * - NodeTie — One zip tie: a place, and the routes it funnels, in order. It changes no data.
 * - RowChoice — One pick in a row's list: the value it keeps, and its words.
 * - RowFacts — What a row's list is read from that the registry does not say.
 * - rowChoices — The list a picklist row reads, a Type row's the family's types; none, it is no picklist.
 * - fixedChoices — A fixed list: a pick row's own, or one the same on every page; none, an open list or no picklist.
 * - mirrored — What a picklist row shows while routes drive it: what comes in, read only, each pick marked Custom.
 * - drivenSwitch — What a switch row shows while a boolean route drives it: True if any came in True, marked Custom.
 * - rowFault — A value's fault a row cannot say, in words: a closed list's stranger, no date, a number off its step.
 * - GraphRow — One row as drawn: its kind's parts, the value it shows, and whether a reader may change it.
 * - NodeSize — A node's size, in times its natural width and height, each 1 to 2.
 * - GraphNode — One node as drawn: its header, its sockets, its rows and its place.
 * - DrawnGraph — Nodes and routes, ready to draw: a workflow's, or a page's Query.
 * - GraphEdit — One row a reader changed: its node, its row and the new value.
 * - NodePlaces — Each node's place by its id: where a reader moved it.
 * - kindNode — A node of a kind, its rows given: the kind's header and sockets, under its own.
 * - placed — A graph with each node at its kept place.
 */
import { OP_LABELS, OP_TAKES, type Duration, type FilterOp } from './store.js';
import { PRESENTATION_KINDS } from './query.js';
import { isDateTime } from './format-date.js';
import type { Given, Need } from './node-input.js';
import { nextPortalName } from './node-portals.js';

/** What a socket carries: one value; an object — a record, rows, or a list, for an array is
 *  an object (D17); a boolean, True or False; or, an input only, any of them (D1). */
export type SocketType = 'value' | 'object' | 'boolean' | 'any';

/** Each socket type in words, as a fault or a tip says it. */
export const SOCKET_WORDS: Readonly<Record<SocketType, string>> = { value: 'a value', object: 'an object', boolean: 'a boolean', any: 'any type' };

/** Whether an input reads what an output of a type sends: its own type, or `any`, which takes all. Any route
 *  joins any input; where this is false, the input reads null (TODO 770). An output never sends `any`. */
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

/** The control a row draws: text, a message (text with values, `{node.name}`; plan 891), a number, a switch, tags (a
 *  list, D17) or a date and time; else the list a picklist reads — the row's own (`pick`), the fields, the field's values,
 *  units, a span's way (last or next), directions, presentations, Apply on, stores, scopes, a family's types or a graph's
 *  portal names (`rowChoices`). */
export type RowControl =
  | 'text' | 'message' | 'number' | 'switch' | 'tags' | 'datetime'
  | 'pick' | 'field' | 'values' | 'unit' | 'span' | 'direction' | 'presentation' | 'apply' | 'store' | 'scope' | 'type' | 'portal';

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
  /** A number's least, and its step, HTML's own names: a step of 1 takes only whole numbers. */
  min?: number;
  step?: number;
  /** What its input can use, where its control does not say it (`needOf`): what it cannot use reads null. TODO 764 */
  needs?: Need;
  /** What its output sends, finer than its type: rows, a list, a number. */
  gives?: Given;
  /** Its output socket is DRAWN on the row of this name, and it draws no line of its own: a Source's Rows leave from its Store row.
   *  The address stays `node/<name>`. TODO 830 */
  beside?: string;
  /** A PROPERTY row: output only, a value the node provides from its own data or logic (`propertyRow`). TODO 835 */
  property?: true;
  /** A `pick` row's own fixed list, so a kind an app adds needs no control of its own. Drawn, the list as shown. Plan 891 */
  choices?: readonly RowChoice[];
}

/** Where a kind is drawn: a page's Query, or a workflow. */
export type NodeGraph = 'query' | 'workflow';

/** One type of a family kind (plan 749): the hint under its select, and what it adds to the kind's own rows and sockets. */
export interface NodeType {
  label: string;
  help?: string;
  /** Its section in the Type picker: an Output's family, as Notification or Request. Plan 891 */
  group?: string;
  /** Its header's icon, over the kind's. */
  icon?: string;
  /** Words the node panel's search finds it by, beside its label: "notify" finds Notification. */
  tags?: readonly string[];
  /** What it would do, where it acts outside the graph: Simulate says it and does nothing (an Output's). */
  would?: string;
  /** Its rows, after the kind's own. */
  rows?: readonly RowKind[];
  /** Its sockets, where they differ from the kind's. */
  input?: SocketType;
  many?: true;
  output?: SocketType;
  branches?: boolean;
  /** Where it is drawn, where not every graph of its kind: Not and Is empty are a workflow's alone. */
  graphs?: readonly NodeGraph[];
  /** What its header's input can use, over the kind's. */
  needs?: Need;
}

/** What a node IS: its header, its sockets, its rows, and what it stands for in the data layer. */
export interface NodeKind {
  heading: string;
  icon: string;
  /** Its synopsis: what it is, in a few words, on one line. The panel's line, and a node's when it has none of its own (809). */
  description?: string;
  /** The whole node's sockets, on its header. Its input is its DATA, of any type (D1): its rows
   *  and values say what it does with it. With `branches`, its output is True. */
  input?: SocketType;
  /** What its header's input can use; what it cannot is null, and the node a warning (TODO 764). None: anything. */
  needs?: Need;
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
  /** A reader's words for a Custom Node: the panel lists it under each, inside its category, and its search finds it by one. */
  tags?: readonly string[];
  /** What it would do, where it acts outside the graph: a type's (`NodeType.would`). */
  would?: string;
  /** A FAMILY: one node, and its first row picks the type, kept as the node's `type` value. Its rows and sockets
   *  follow the type (`resolveKind`). With one type there is no row. Plan 749 */
  types?: Readonly<Record<string, NodeType>>;
  /** That first row's label: "Check", "Operation", "Type". */
  typeLabel?: string;
  /** The type a node with none shows; else the first. */
  defaultType?: string;
}

/** A property row, the one definition: output only, no control and no value, sending what the node's data or logic gives
 *  (`gives`): a value (a number, the default; text; a boolean) or an object (a row, a set of rows, a record). Count is its
 *  first use, a number like any other. TODO 835
 *  TRAP T-a-property-row-is-an-output */
export const propertyRow = (name: string, label: string, gives: Given = 'number'): RowKind => ({ name, label, output: propertySocket(gives), gives, property: true });
/** The socket a property's given takes: a number, text or value a circle; a boolean a circle; rows, a list, a field or an object a diamond. */
const propertySocket = (gives: Given): SocketType => (gives === 'boolean' ? 'boolean' : ['object', 'list', 'rows', 'field'].includes(gives) ? 'object' : 'value');
const COUNT = propertyRow('count', 'Count');
/** Results: the data rows a node sends on, a property like Count; they come in on its header (D1). It keeps the address `node/rows`. Plan 713 §3 */
export const ROWS: Readonly<RowKind> = propertyRow('rows', 'Results', 'rows');

/** A family's rows, each once: a type names the ones it draws. */
const VALUE: RowKind = { name: 'value', label: 'Value', control: 'text', output: 'value' };
const numberRow = (name: string, label: string): RowKind => ({ name, label, control: 'number', input: 'value' });
const textRow = (name: string, label: string): RowKind => ({ name, label, control: 'text', input: 'value' });
const dateRow = (name: string, label: string): RowKind => ({ name, label, control: 'datetime', input: 'value' });
/** A count: a whole number, from `min`. */
const countRow = (name: string, label: string, min: number): RowKind => ({ ...numberRow(name, label), min, step: 1 });
/** A list in, an object (D17): what Floor, Ceiling, Average and Join read. It takes several. Will, D9 */
const LIST: RowKind = { name: 'values', label: 'Values', input: 'object', many: true, needs: 'list' };
const NUMBERS: RowKind = { ...LIST, needs: 'numbers' };
/** What a Math or Text node gives, as a Value gives its own: from a row, its header forking (D2). A PROPERTY, as Count and
 *  Results are: it stands in the Properties box, not the Parameters (Will, 2026-11-11). */
const RESULT: RowKind = { name: 'result', label: 'Result', output: 'value', property: true };
const NUMBER: RowKind = { ...RESULT, gives: 'number' };
const [A, B, SEPARATOR] = [numberRow('a', 'Value A'), numberRow('b', 'Value B'), textRow('separator', 'Separator')];
/** A portal's name: picked from the graph's names, or New name… (TODO 779). */
const PORTAL_NAME: RowKind = { name: 'name', label: 'Name', control: 'portal' };

/** An Output's rows (plan 891). A message field takes text with values; each parameter can be routed too. */
const messageRow = (name: string, label: string): RowKind => ({ name, label, control: 'message', input: 'value' });
const pickRow = (name: string, label: string, choices: readonly (readonly [string, string])[], multiple?: true): RowKind => ({
  name, label, control: 'pick', choices: choices.map(([value, words]) => ({ value, label: words })),
  ...(multiple ? { multiple, input: 'object' as const } : { input: 'value' as const }),
});
const objectIn = (name: string, label: string): RowKind => ({ name, label, input: 'object' });
const [TITLE, MESSAGE, SENT] = [messageRow('title', 'Title'), messageRow('message', 'Message'), propertyRow('sent', 'Sent', 'boolean')];

/** What an Output does, each a type in a family (plan 891). The host app adds its own: `addTypes`. */
const OUTPUTS: Readonly<Record<string, NodeType>> = {
  notification: {
    label: 'Notification', would: 'Would send a notification', group: 'Notification', icon: 'notifications', tags: ['notify'], help: 'Send a message in the app, by email or to a phone',
    rows: [
      pickRow('channels', 'Channels', [['app', 'In app'], ['email', 'Email'], ['push', 'Mobile push']], true),
      textRow('to', 'To'), TITLE, MESSAGE, textRow('url', 'Link'), pickRow('priority', 'Priority', [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']]),
      SENT, propertyRow('delivered', 'Delivered', 'value'), propertyRow('messageId', 'Message ID', 'value'),
    ],
  },
  view: {
    label: 'On a view', would: 'Would show it on a view', group: 'Content', icon: 'dashboard', help: 'Show content on a view',
    rows: [
      textRow('view', 'View'), pickRow('place', 'Place', [['widget', 'Widget'], ['card', 'Card'], ['row', 'List row']]), objectIn('content', 'Content'), dateRow('until', 'Keep until'),
      propertyRow('contentId', 'Content ID', 'value'), propertyRow('link', 'Link', 'value'),
    ],
  },
  file: {
    label: 'Generated file', would: 'Would make a file', group: 'Content', icon: 'file-lines', help: 'Make a file from the data',
    rows: [
      pickRow('format', 'Format', [['pdf', 'PDF'], ['csv', 'CSV'], ['xlsx', 'XLSX'], ['docx', 'DOCX'], ['md', 'Markdown']]), textRow('template', 'Template'),
      messageRow('fileName', 'File name'), objectIn('data', 'Data'), textRow('saveTo', 'Save to'),
      propertyRow('file', 'File', 'object'), propertyRow('link', 'Link', 'value'),
    ],
  },
  toast: {
    label: 'Toast', would: 'Would show a toast', group: 'Response', icon: 'megaphone', help: 'Show a short message on the screen',
    rows: [pickRow('tone', 'Tone', [['info', 'Info'], ['success', 'Success'], ['warning', 'Warning'], ['critical', 'Critical']]), MESSAGE, textRow('action', 'Action'), propertyRow('shown', 'Shown', 'boolean')],
  },
  alert: {
    label: 'Alert', would: 'Would raise an alert', group: 'Response', icon: 'status-warning', help: 'Raise an alert on a device or a customer (to be defined)',
    rows: [
      pickRow('severity', 'Severity', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['critical', 'Critical']]), pickRow('on', 'On', [['device', 'Device'], ['customer', 'Customer']]),
      TITLE, MESSAGE, propertyRow('alertId', 'Alert ID', 'value'),
    ],
  },
  api: {
    label: 'API response', would: 'Would answer the call', group: 'Response', icon: 'cloud', help: 'Answer the call that started the run',
    rows: [countRow('code', 'Status', 100), objectIn('body', 'Body'), pickRow('encoding', 'Format', [['json', 'JSON'], ['csv', 'CSV'], ['text', 'Text']]), SENT],
  },
  result: {
    label: 'Run result', would: 'Would end the run', group: 'Run result', icon: 'flag', help: 'End the run with a status and a summary',
    rows: [pickRow('status', 'Status', [['succeeded', 'Succeeded'], ['skipped', 'Skipped'], ['failed', 'Failed'], ['deferred', 'Deferred']]), messageRow('summary', 'Summary')],
  },
};

/** A family with more types: the host app's own beside the shipped ones, as `addTypes(NODE_KINDS.output, { ticket })`. */
export function addTypes(kind: NodeKind, types: Readonly<Record<string, NodeType>>): NodeKind {
  return { ...kind, types: { ...kind.types, ...types } };
}

/** The operators whose value is a list: Is one of, Is not one of. */
export const LIST_OPS: readonly FilterOp[] = ['in', 'notin'];

/** A Logic type that is one of the data layer's operators: it tests what comes in on its header — a Field's column, or a
 *  value — against what the operator takes: Value B, a list of Values, or Start and End. Its words the operator's own
 *  (`OP_LABELS`). Plan 783 D3 · TRAP T-a-logic-type-is-an-operator */
function compareType(op: FilterOp): NodeType {
  const [list, range] = [LIST_OPS.includes(op), OP_TAKES[op] === 'range'];
  const rows: RowKind[] = list ? [{ name: 'b', label: 'Values', control: 'tags', multiple: true, input: 'object' }]
    : range ? [textRow('start', 'Start'), textRow('end', 'End')] : [{ name: 'b', label: 'Value B', control: 'values', input: 'value' }];
  const against = list ? 'the Values' : range ? 'Start and End' : 'Value B';
  const words = OP_LABELS[op].toLowerCase();
  const said = /^(is|does|equals|contains|starts|ends)\b/.test(words) ? words : `is ${words}`;
  return { label: OP_LABELS[op], help: `True when what comes in ${said} ${against}`, input: 'any', needs: 'tested', rows: [ROWS, ...rows, COUNT] };
}

/** Figma's six comparisons, in its order; the operators after them are Sherpa's. A span from today is Time › Duration's. */
const FIGMA_OPS: readonly FilterOp[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'ne'];
const SHERPA_OPS = (Object.keys(OP_LABELS) as FilterOp[]).filter((op) => !FIGMA_OPS.includes(op) && op !== 'last' && op !== 'next');
const compareTypes = (ops: readonly FilterOp[]): Record<string, NodeType> => Object.fromEntries(ops.map((op) => [op, compareType(op)]));

/** Logic's types, one test each (plan 783 D4): And and Or join the tests that come in, booleans on the header, read as
 *  `truthOf` reads them; then the comparisons. Each leads with Rows: the rows it lets through. A Query draws its tree
 *  with these: Not and Is empty are a workflow's alone. Plan 749 P5 */
const LOGIC: Readonly<Record<string, NodeType>> = {
  and: { label: 'And', help: 'True when every value that comes in is true', input: 'boolean', many: true, rows: [ROWS] },
  or: { label: 'Or', help: 'True when any value that comes in is true', input: 'boolean', many: true, rows: [ROWS] },
  ...compareTypes(FIGMA_OPS),
  not: { label: 'Not', help: 'True when the value that comes in is false', input: 'boolean', rows: [ROWS], graphs: ['workflow'] },
  empty: { label: 'Is empty', help: 'True when the value that comes in is nothing: none, 0, false, or empty text or list', input: 'any', rows: [ROWS], graphs: ['workflow'] },
  ...compareTypes(SHERPA_OPS),
};

/** Every kind the library ships, once. An app adds its own beside them: `{ ...NODE_KINDS, mine }`.
 *  A kind a workflow runs forks (`branches`): its True and False are a boolean only, whether it gave anything,
 *  never rows (D2); rows that do not match are not sent: set the Check to its inverse. The Query's own steps do not: nothing routes a branch from them. */
export const NODE_KINDS: Readonly<Record<string, NodeKind>> = {
  // Where the rows come from, in every graph: the store it names. A Query adds how its page reads it. TODO 808
  source: {
    heading: 'Source', icon: 'storage', description: 'Connect a data source',
    rows: [{ ...ROWS, beside: 'store' }, { name: 'store', label: 'Store', control: 'store', input: 'value' }, COUNT], model: 'SourceDefinition', graphs: ['query', 'workflow'], category: 'Sources',
  },
  // A page's Query: its rows read left to right, as the data flows.
  status: {
    heading: 'Status field', icon: 'status-ok', description: 'Label each row by conditions',
    input: 'any', rows: [ROWS], model: 'StatusField', graphs: ['query'], category: 'Status',
  },
  // Its Switch, then a row per preset and per field it holds, each with a boolean input: a True.
  scope: {
    heading: 'Scope', icon: 'filter', input: 'any',
    rows: [ROWS, { name: '#filters', label: 'Filters', control: 'switch', input: 'boolean' }], model: 'ScopeQuery', graphs: ['query'],
  },
  // Logic: one test per Condition, And and Or joining tests (plan 783 D4). TRAP T-a-condition-is-a-tree-of-nodes
  condition: {
    heading: 'Condition', icon: 'function', description: 'Logical checks of a value against a condition', branches: true,
    typeLabel: 'Check', defaultType: 'eq', types: LOGIC, rows: [], model: 'Condition', graphs: ['query', 'workflow'], category: 'Logic',
  },
  // Its on, then each field it writes.
  preset: {
    heading: 'Preset', icon: 'star', description: 'Apply a filter the app named', output: 'boolean',
    rows: [{ name: 'on', label: 'On', control: 'switch', input: 'boolean' }], model: 'ScopeDefinition.presets', graphs: ['query'], category: 'Presets',
  },
  saved: {
    heading: 'Saved filter', icon: 'floppy-disk', description: 'Apply a filter the reader saved', output: 'boolean',
    rows: [{ name: 'on', label: 'On', control: 'switch', input: 'boolean' }], model: 'SavedFilter', graphs: ['query'], category: 'Saved filters',
  },
  arrange: {
    heading: 'Arrange', icon: 'sort-ascending', description: 'Order, group and search rows', input: 'any',
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
    heading: 'Presentation', icon: 'insights', description: 'Choose how rows are shown', input: 'any',
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
  // A workflow: each kind over the data-layer function it runs by; a family's Type row picks what it does (plan 749).
  value: {
    heading: 'Value', icon: 'function', description: 'Primitive value variables', typeLabel: 'Type', defaultType: 'text',
    types: {
      text: { label: 'Text', rows: [VALUE] },
      integer: { label: 'Integer', help: 'A whole number, as 42', rows: [VALUE] },
      decimal: { label: 'Decimal', help: 'A number with places, as 4.25', rows: [VALUE] },
      date: { label: 'Date', help: 'A day, written year-month-day: 2024-01-31', rows: [VALUE] },
      boolean: { label: 'True/false', help: 'True or false', rows: [{ ...VALUE, gives: 'boolean' }] },
      list: { label: 'List', help: 'Values, each a tag, sent as a list', rows: [{ ...VALUE, control: 'tags', multiple: true, output: 'object', gives: 'list' }] },
    },
    rows: [], model: 'typedValue', graphs: ['workflow'], category: 'Variables',
  },
  // Rows in, a column out, `{ rows, field }`; one record in, that field's value. Its True: the field is there. Plan 783 D1, D2
  field: {
    heading: 'Field', icon: 'price-tag', description: 'Target a field from a connected Source', input: 'any', needs: 'object',
    rows: [{ name: 'field', label: 'Field', control: 'field', input: 'value', output: 'object', gives: 'field' }, COUNT], model: 'readField', graphs: ['query', 'workflow'], category: 'Variables',
  },
  // One number from numbers, given from its Result row. Floor, Ceiling and Average read a list (D9).
  math: {
    heading: 'Math', icon: 'function', description: 'Numbers in, one number out', typeLabel: 'Operation', defaultType: 'add',
    types: {
      add: { label: 'Add', help: 'Add Value B to Value A', rows: [A, B, NUMBER] },
      subtract: { label: 'Subtract', help: 'Subtract Value B from Value A', rows: [A, B, NUMBER] },
      multiply: { label: 'Multiply', help: 'Multiply 2 values together', rows: [A, B, NUMBER] },
      divide: { label: 'Divide', help: 'Divide Value A by Value B', rows: [A, B, NUMBER] },
      ratio: { label: 'Ratio', help: 'Decimal ratio between 0 and 1', rows: [A, B, NUMBER] },
      round: { label: 'Round', help: 'Rounds a decimal to a set number of places', rows: [countRow('places', 'Places', 0), numberRow('a', 'Value'), NUMBER] },
      increment: { label: 'Increment', help: 'Increment Value A by Value B, in its smallest unit', rows: [A, B, NUMBER] },
      floor: { label: 'Floor', help: 'Lowest value from the list', rows: [NUMBERS, NUMBER] },
      ceiling: { label: 'Ceiling', help: 'Highest value from the list', rows: [NUMBERS, NUMBER] },
      average: { label: 'Average', help: 'Average value of the list', rows: [NUMBERS, NUMBER] },
    },
    rows: [], model: 'math', graphs: ['workflow'], category: 'Math',
  },
  // Whether the date that comes in, of any type (D1), holds: True takes it, False the rest.
  time: {
    heading: 'Time', icon: 'time', description: 'Check a date against a time', input: 'any', needs: 'date', output: 'boolean', typeLabel: 'Check', defaultType: 'between',
    types: {
      between: { label: 'Between', help: 'True when the date is from Start to End', rows: [dateRow('start', 'Start'), dateRow('end', 'End')] },
      duration: {
        label: 'Duration', help: 'True when the date is within a span of today',
        rows: [{ name: 'when', label: 'When', control: 'span', input: 'value' }, countRow('n', 'Value', 1), { name: 'unit', label: 'Unit', control: 'unit', input: 'value' }],
      },
    },
    rows: [], model: 'timeCheck', graphs: ['workflow'], category: 'Time',
  },
  // Sort and Group take the Field they work on, on the header (plan 783 D5); a count is a property row (TODO 835).
  sort: {
    heading: 'Sort', icon: 'sort-ascending', description: 'Put rows in order of a field', input: 'any', needs: 'field',
    rows: [ROWS, { name: 'direction', label: 'Direction', control: 'direction', input: 'value' }], model: 'sortRows', graphs: ['workflow'], category: 'Organise',
  },
  group: {
    heading: 'Group', icon: 'group', description: 'Group rows by a field', input: 'any', needs: 'field',
    rows: [ROWS, COUNT], model: 'groupRows', graphs: ['workflow'], category: 'Organise',
  },
  // Text from text, given from its Result row: a list, where Split by makes one.
  text: {
    heading: 'Text', icon: 'pencil', description: 'Change and combine text values', typeLabel: 'Operation', defaultType: 'append',
    types: {
      append: { label: 'Append', help: 'Add Value B to the end of Value A', rows: [textRow('a', 'Value A'), textRow('b', 'Value B'), RESULT] },
      prepend: { label: 'Prepend', help: 'Add Value B to the start of Value A', rows: [textRow('a', 'Value A'), textRow('b', 'Value B'), RESULT] },
      split: { label: 'Split by', help: 'Value as a list, split at each Separator', rows: [textRow('a', 'Value'), SEPARATOR, { ...RESULT, output: 'object', gives: 'list' }] },
      join: { label: 'Join', help: 'The list as one text, Separator between each', rows: [LIST, SEPARATOR, RESULT] },
    },
    rows: [], model: 'modifyText', graphs: ['workflow'], category: 'Utils',
  },
  // A rows check by the Field of tags that comes in: closed to its values, where they are known (plan 783 D5).
  tag: {
    heading: 'Tag', icon: 'price-tag', description: 'Keep rows with chosen tags', input: 'any', needs: 'field', output: 'boolean',
    types: { includes: { label: 'Includes', rows: [ROWS, { name: 'value', label: 'Tags', control: 'tags', multiple: true, input: 'object' }] } },
    rows: [], model: 'tagCheck', graphs: ['workflow'], category: 'Utils',
  },
  // An In and an Out joined by a name, no line between them. An In takes many routes; an Out draws a row for each route
  // into an In of its name, once drawn, and sends from those rows alone (TODOs 779, 826). TRAP T-a-portal-hop-is-resolved-once
  portal: {
    heading: 'Portal', icon: 'link-simple', description: 'Link two nodes without a line',
    typeLabel: 'Type', defaultType: 'in',
    types: {
      in: { label: 'In', help: 'Each route in is a row on every Out portal of its name', input: 'any', many: true, rows: [PORTAL_NAME] },
      out: { label: 'Out', help: 'A row for each route into an In portal of its name', rows: [PORTAL_NAME] },
    },
    rows: [], model: 'portal', graphs: ['workflow'], category: 'Utils',
  },
  // One Output, many types; Run result, the default, is what an Output with no type was (plan 891). It may sit mid-graph:
  // its properties route on.
  output: {
    heading: 'Output', icon: 'flag', description: 'Do something with what the flow found', input: 'any',
    typeLabel: 'Type', defaultType: 'result', types: OUTPUTS, rows: [], model: 'LoadResult', graphs: ['workflow'], category: 'Output',
  },
};

/** A category as the slug a node's, and its panel row's, `data-category` says: lower case, words joined by hyphens. TODO 840 */
export const categorySlug = (category: string | undefined): string | undefined => category?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The type of a family kind a node's `type` value names: that one, else the kind's default or first. */
export function typeOf(kind: Pick<NodeKind, 'types' | 'defaultType'>, type?: unknown): { id: string; type: NodeType } | undefined {
  const types = kind.types ?? {};
  const id = typeof type === 'string' && Object.hasOwn(types, type) ? type : kind.defaultType ?? Object.keys(types)[0];
  return id !== undefined && types[id] ? { id, type: types[id]! } : undefined;
}

/** The types of a family kind as a picklist reads them; none, it is no family. */
export function typeChoices(kind: Pick<NodeKind, 'types'>): RowChoice[] | undefined {
  return kind.types && Object.entries(kind.types).map(([value, t]) => ({ value, label: t.label }));
}

/** A family kind as an ordinary kind for one type, so a reader learns nothing of types: the type
 *  row first (none for a kind of one type), then the kind's rows and the type's; the type's sockets
 *  over the kind's. A kind with no types is as it is. */
export function resolveKind(kind: NodeKind, type?: unknown): NodeKind;
export function resolveKind(kind: NodeKind | undefined, type?: unknown): NodeKind | undefined;
export function resolveKind(kind: NodeKind | undefined, type?: unknown): NodeKind | undefined {
  const at = kind && typeOf(kind, type);
  if (!kind || !at) return kind;
  const { types, typeLabel, defaultType: _default, branches: forks, ...plain } = kind;
  const { input, many, output, branches = forks, graphs = kind.graphs, needs, icon, would } = at.type;
  const row: RowKind = { name: 'type', label: typeLabel ?? 'Type', control: 'type' };
  return {
    ...plain, ...(icon ? { icon } : {}), ...(would ? { would } : {}), ...(input ? { input } : {}), ...(many ? { many } : {}), ...(output ? { output } : {}), ...(needs ? { needs } : {}),
    ...(branches ? { branches: true as const } : {}), graphs,
    rows: [...(Object.keys(types!).length > 1 ? [row] : []), ...kind.rows, ...(at.type.rows ?? [])],
  };
}

/** A kind as one graph draws it: a family with only the types that graph takes; none, the graph draws no such kind. */
export function kindIn(kind: NodeKind, graph: NodeGraph): NodeKind | undefined {
  if (!kind.graphs.includes(graph)) return undefined;
  if (!kind.types) return kind;
  const types = Object.fromEntries(Object.entries(kind.types).filter(([, t]) => (t.graphs ?? kind.graphs).includes(graph)));
  if (Object.keys(types).length === Object.keys(kind.types).length) return kind;
  const { defaultType, ...rest } = kind;
  return Object.keys(types).length ? { ...rest, types, ...(defaultType && types[defaultType] ? { defaultType } : {}) } : undefined;
}

/** The kind a node is, resolved for its own type: the registry's `kind`, its `type` row's. The operator, a type, shapes
 *  its Value B. TRAP T-an-operator-shapes-its-value */
export function kindOfNode(kinds: Readonly<Record<string, NodeKind>>, node: { kind: string; values?: Readonly<Record<string, unknown>> } | undefined): NodeKind | undefined {
  return node && resolveKind(kinds[node.kind], node.values?.['type']);
}

/** A row a family kind has under another type than this node's: the row, and the labels of the types that hold it. */
export function rowOfOtherType(kind: NodeKind, type: unknown, row: string): { row: RowKind; types: string[] } | undefined {
  const now = typeOf(kind, type)?.id;
  const held = Object.entries(kind.types ?? {}).flatMap(([id, t]) => (id !== now && rowOf(t.rows ?? [], row) ? [{ row: rowOf(t.rows ?? [], row)!, label: t.label }] : []));
  return held[0] ? { row: held[0].row, types: held.map((h) => h.label) } : undefined;
}

/** The node panel's categories, in order, after Figma's (plan 713 §9.1). Each is empty until a kind
 *  names it; `Custom Nodes` (D9) stays empty until saved nodes come (M9, M12). */
export const NODE_CATEGORIES: readonly string[] = ['Sources', 'Custom Nodes', 'Variables', 'Math', 'Logic', 'Time', 'Organise', 'Utils', 'Output', 'Presets', 'Saved filters', 'Status'];

/** The categories a Query's panel lists: the kinds a Query takes placed — a Source (TODO 808), a Field (plan 783 D6) — and
 *  its Custom Nodes, its page's Preset Filters (TODO 776). */
const QUERY_CATEGORIES: readonly string[] = ['Sources', 'Custom Nodes', 'Variables', 'Logic', 'Presets', 'Saved filters', 'Status'];

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
  for (const [id, family] of Object.entries(kinds)) {
    // A family lists only the types its graph takes: the Query's Condition is its Rows that hold alone.
    const kind = kindIn(family, graph);
    if (!kind) continue;
    const category = kind.category ?? 'Other';
    if (graph === 'query' && !QUERY_CATEGORIES.includes(category)) continue;
    const items = groups.get(category) ?? [];
    items.push({ id, kind });
    groups.set(category, items);
  }
  const known = new Set(NODE_CATEGORIES);
  return [...groups].filter(([c, items]) => items.length || (graph === 'workflow' && c === 'Custom Nodes')).sort(([a], [b]) => Number(!known.has(a)) - Number(!known.has(b))).map(([category, items]) => ({ category, items }));
}

/** How a panel item answers a search: by its name or a tag, `{}`; by a type's name, `{ type }`, the one it names whole first
 *  ("not" is Not, not Does not equal); none, not at all. Nothing typed finds all. */
export function paletteMatch(kind: Pick<NodeKind, 'heading' | 'types' | 'tags'>, query: string): { type?: string } | undefined {
  const q = query.trim().toLowerCase();
  if (!q || kind.heading.toLowerCase().includes(q) || kind.tags?.some((t) => t.toLowerCase().includes(q))) return {};
  const types = Object.entries(kind.types ?? {});
  const said = (t: NodeType): string[] => [t.label, ...(t.tags ?? [])].map((w) => w.toLowerCase());
  const hit = types.find(([, t]) => said(t).includes(q)) ?? types.find(([, t]) => said(t).some((w) => w.includes(q)));
  return hit ? { type: hit[0] } : undefined;
}

/** Where a new node of a kind joins a socket of a type: on the dragged OUTPUT's side, its header
 *  or row INPUT that takes the type; on a dragged INPUT's, its header or row OUTPUT the input takes.
 *  A family tries its default type first, then the rest in order; `type` names one other than the
 *  default. `{}` the header, `{ row }` a row; none, no type of it fits. */
export function fitOf(family: NodeKind, type: SocketType, side: 'out' | 'in'): { row?: string; type?: string } | undefined {
  const key = side === 'out' ? 'input' : 'output';
  const fits = (t: SocketType | undefined): boolean => !!t && (side === 'out' ? accepts(type, t) : accepts(t, type));
  const first = typeOf(family)?.id;
  for (const id of [first, ...Object.keys(family.types ?? {}).filter((t) => t !== first)]) {
    const kind = resolveKind(family, id);
    const row = fits(kind[key]) ? undefined : kind.rows.find((r) => fits(r[key]));
    if (fits(kind[key]) || row) return { ...(row ? { row: row.name } : {}), ...(id !== first ? { type: id! } : {}) };
  }
  return undefined;
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

/** Every node the routes lead to from these, and on from each; these left out. TODO 889 */
export function downstreamOf(routes: readonly NodeRoute[], from: Iterable<string>): Set<string> {
  const start = new Set(from);
  const next = new Map<string, string[]>();
  for (const route of routes) {
    const [a, b] = [socketOf(route.from).node, socketOf(route.to).node];
    next.set(a, [...(next.get(a) ?? []), b]);
  }
  const seen = new Set<string>();
  const queue = [...start];
  while (queue.length) {
    for (const to of next.get(queue.pop()!) ?? []) {
      if (seen.has(to) || start.has(to)) continue;
      seen.add(to);
      queue.push(to);
    }
  }
  return seen;
}

/** The footer's False, as an address names it after its node: `node/#false`. A `#` part is no row. */
export const FALSE_SOCKET = '#false';

/** The sockets a kind says, or a node drawn of it. */
type Sockets = Pick<NodeKind, 'input' | 'output' | 'many' | 'branches'> & { rows: readonly RowKind[] };

/** The row of a kind a name says. */
export function rowOf<R extends Pick<RowKind, 'name'>>(rows: readonly R[], name: string): R | undefined {
  return rows.find((r) => r.name === name);
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
  /** Every value that field may take. */
  values?: readonly string[];
  /** The stores, by the names the app registered them under. */
  stores?: readonly string[];
  scopes?: readonly string[];
  /** The types of the row's family kind: what a Type row picks (`typeChoices`). */
  types?: readonly RowChoice[];
  /** The count a Unit row's words follow: its node's Value, so 1 reads "day". */
  count?: number;
  /** Every name the graph's portals hold, in order: what a portal's Name row picks. */
  portals?: readonly string[];
}

const UNITS: readonly Duration['unit'][] = ['day', 'week', 'month', 'year'];
const SPANS: readonly ('last' | 'next')[] = ['last', 'next'];

/** The units in words for a count, as the platform says them: "day" for 1, "days" else. */
const unitWords = (count = 2): RowChoice[] => UNITS.map((u) => ({
  value: u, label: new Intl.NumberFormat(undefined, { style: 'unit', unit: u, unitDisplay: 'long' }).formatToParts(count).filter((p) => p.type === 'unit').map((p) => p.value).join('').trim(),
}));

/** The lists that are the same on every page. */
const FIXED: Partial<Record<RowControl, readonly RowChoice[]>> = {
  unit: unitWords(),
  span: SPANS.map((op) => ({ value: op, label: OP_LABELS[op] })),
  direction: [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }],
  presentation: [{ value: '', label: 'Default' }, ...PRESENTATION_KINDS.map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) }))],
  apply: [{ value: 'change', label: 'Change' }, { value: 'input', label: 'Input' }],
};

/** The list a picklist row reads, for one pick or several (`multiple`); none, it is no picklist.
 *  An open list — fields, values, stores, scopes — also offers each of the row's own
 *  values it lacks, so a select shows it. A tags row's list is the field's values, and only them:
 *  it is CLOSED to them (`rowFault`); none known, its tags are free. */
export function rowChoices(row: Pick<RowKind, 'control'> & Partial<Pick<RowKind, 'choices' | 'multiple'>> & { value?: unknown }, facts: RowFacts = {}): RowChoice[] | undefined {
  // A row's own list; one pick with none picked says so, as a Store row does: a select would show its first.
  if (row.control === 'pick') return [...(row.multiple || (row.value != null && row.value !== '') ? [] : [{ value: '', label: 'Pick one' }]), ...(row.choices ?? [])];
  if (row.control === 'unit' && facts.count !== undefined) return unitWords(facts.count);
  const fixed = row.control && FIXED[row.control];
  if (fixed) return [...fixed];
  if (row.control === 'type') return facts.types && [...facts.types];
  if (row.control === 'portal') return portalChoices(row.value, facts.portals ?? []);
  const named = (list: readonly string[] = []): RowChoice[] => list.map((v) => ({ value: v, label: v }));
  if (row.control === 'tags') return facts.values?.length ? named(facts.values) : undefined;
  const open = row.control === 'field' ? Object.entries(facts.fields ?? {}).map(([value, f]) => ({ value, label: f.label ?? value }))
    : row.control === 'values' ? named(facts.values)
    : row.control === 'store' ? named(facts.stores)
    : row.control === 'scope' ? named(facts.scopes)
    : undefined;
  if (!open) return undefined;
  const own = [...new Set([row.value].flat().filter((v) => v != null && v !== '').map(String))];
  // A Store row with none says so, drawn the same every time: a select would show its first store. TODO 824
  const none = row.control === 'store' && !own.length ? [{ value: '', label: 'Pick a store' }] : [];
  return [...none, ...open, ...named(own.filter((v) => !open.some((c) => c.value === v)))];
}

/** A portal's Name list: the graph's names, its own among them; New name…, whose value is the next free `Portal N`; and
 *  Pick a name while it has none (TODO 779). */
function portalChoices(value: unknown, names: readonly string[]): RowChoice[] {
  const own = typeof value === 'string' && value.trim() ? value.trim() : '';
  const listed = [...new Set([...names, ...(own ? [own] : [])])];
  return [...(own ? [] : [{ value: '', label: 'Pick a name' }]), ...listed.map((v) => ({ value: v, label: v })), { value: nextPortalName(listed), label: 'New name…' }];
}

/** A fixed list, the same on every page — a `pick` row's own, directions, units, spans, Apply on, presentations; none, an
 *  open list or no picklist. */
export function fixedChoices(row: Pick<RowKind, 'control' | 'choices'> | undefined): readonly RowChoice[] | undefined {
  if (row?.control === 'pick') return row.choices;
  return row?.control ? FIXED[row.control] : undefined;
}

/** What a picklist row shows while routes drive it (D7): what comes in, read only, each pick
 *  marked Custom. A single pick shows the one that came in, and only it; a `multiple` row
 *  ticks each that came in, and marks Custom each its list lacks. The row's own pick is not
 *  here: the draft keeps it, and cutting the routes gives it back. Plan 713 §5, §9.5 */
export function mirrored(row: Pick<RowKind, 'multiple' | 'control'>, given: readonly unknown[], list: readonly RowChoice[] = []): Pick<GraphRow, 'value' | 'choices' | 'custom'> {
  const custom = (v: string): RowChoice => ({ value: v, label: `${v} Custom` });
  const picks = [...new Set(given.flat().filter((v) => v != null && v !== '').map(String))];
  if (!row.multiple) return { value: picks[0] ?? '', choices: picks.slice(0, 1).map(custom), custom: true };
  // Tags say each value as itself: the hint says they are Custom, and a closed list's stranger is a fault.
  if (row.control === 'tags') return { value: picks, choices: list, custom: true };
  return { value: picks, choices: [...list, ...picks.filter((v) => !list.some((c) => c.value === v)).map(custom)], custom: true };
}

/** What a switch row shows while a route drives it (D7): True if any boolean that came in is
 *  True, else False, marked Custom. The row's own state is not here: the draft keeps it, and
 *  cutting the route gives it back. Plan 731, 732 */
export function drivenSwitch(given: readonly boolean[]): Pick<GraphRow, 'value' | 'custom'> {
  return { value: given.some(Boolean), custom: true };
}

/** What is wrong with a value its row's control cannot say, in words, as the row draws them: a stranger
 *  in a closed list (`of` names whose values it lists), no date, a number off its step or under its least.
 *  None, it holds. A value of the wrong kind (text in a number row) is `workflowFaults`' own. TRAP T-a-row-says-its-own-fault */
export function rowFault(row: Pick<GraphRow, 'control' | 'closed' | 'choices' | 'min' | 'step'>, value: unknown, of = 'its list'): string | undefined {
  if (value == null || value === '') return undefined;
  if (row.control === 'tags' && row.closed) {
    const strangers = [...new Set([value].flat().map(String))].filter((v) => !row.choices?.some((c) => c.value === v));
    const said = new Intl.ListFormat('en', { type: 'conjunction' }).format(strangers.map((v) => `"${v}"`));
    return strangers.length ? `${said} ${strangers.length > 1 ? 'are not values' : 'is not a value'} of ${of}` : undefined;
  }
  if (row.control === 'datetime' && !isDateTime(String(value))) return `"${String(value)}" is not a date: pick one, or write it as 31 Jan 2024`;
  if (row.control !== 'number' || typeof value !== 'number') return undefined;
  if (row.step === 1 && !Number.isInteger(value)) return `${value} is not a whole number`;
  return row.min !== undefined && value < row.min ? `${value} is less than ${row.min}` : undefined;
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
  /** Its tags take only its choices: a stranger is refused, and one held is its fault. */
  closed?: true;
  /** What is wrong with the value it shows, in words, drawn in the row: never a vanished row's (the draft keeps those). */
  fault?: string;
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
  /** What reached it that it cannot use, each by its row (none: its header), in words: it reads null there (TODO 764). */
  warnings?: readonly { row?: string; words: string }[];
  /** What it would do: an Output's, which Simulate says and never does. Plan 891 */
  would?: string;
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
    ...(k.would ? { would: k.would } : {}),
    ...own,
  };
}

/** A graph with each node at its kept place; one never moved stays where it was laid out. */
export function placed(graph: DrawnGraph, places: NodePlaces): DrawnGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (places[n.id] ? { ...n, x: places[n.id]!.x, y: places[n.id]!.y, ...(places[n.id]!.size ? { size: places[n.id]!.size } : {}) } : n)) };
}
