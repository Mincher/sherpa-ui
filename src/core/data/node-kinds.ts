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
 * - TRIGGER_RUNS — The runtime's kind of each Trigger type, as a server reads it: on demand, scheduled or an event.
 * - OUTPUT_TRIGGER — The Output Trigger family's kind id: an app adds its types to it, as a Run Coworker (plan 949).
 * - addTypes — A family with more types: an app's own beside the shipped ones, as a Ticket Output.
 * - registerNodeTypes — An app adds its own types to a shipped family, from its own file: an Output's Ticket.
 * - nodeKinds — Every kind the library ships, with the types apps added: what a check and an editor read.
 * - LIST_OPS — The operators whose value is a list: Is one of, Is not one of.
 * - typedControl — The control a value of a field's type takes: a number, a date; none for text, which keeps the row's own (plan…
 * - TEST_KINDS — The kinds that test: each gives Pass, Fail and its truth (plan 971 A).
 * - ConditionInput — One input into a Condition, for what fits it: a value or a column, by its type; or data.
 * - CONDITION_INPUT_WORDS — Each input in words, as a warning says it.
 * - fitsCondition — Whether a Logic type fits an input.
 * - conditionFits — The Logic types that fit what comes in: each one an input fits.
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
 * - RecentUse — A kind placed or set last: with its picks on its `recalls` rows, a use of its own.
 * - PaletteChoice — One choice of "Add a node": a kind, or a use of it with its picks.
 * - paletteFor — The palette's kinds a socket of a type could join: the ones used last first, then a Value.
 * - Socket — A socket address, read: its node, and its row or none for the header's.
 * - socketOf — Read a socket address: `node`, the header's, or `node/row`.
 * - downstreamOf — Every node the connections lead to from these, and on from each; these left out.
 * - rowOf — The row of a kind a name says.
 * - UNFOLDED — The prefix of a row a pick unfolds: "At risk" unfolds as `v-at-risk` (a socket's name takes no space).
 * - unfoldedRows — The output rows a pick unfolds, one per value picked: named by its words (`v-at-risk`; a clash, `-2`), each a…
 * - rowsOfNode — A node's rows: its kind's, each row that unfolds followed by the rows its pick unfolds.
 * - rowTitle — A row's title as a reader sees it: an optional one says so, "Values (Optional)".
 * - socketType — The type one socket of a kind carries; none, it has no such socket.
 * - takesMany — Whether an input of a kind takes several connections.
 * - NodeConnection — One connection: an output socket to an input socket.
 * - NodeTie — One zip tie: a place, and the connections it funnels, in order. It changes no data.
 * - RowChoice — One pick in a row's list: the value it keeps, and its words.
 * - RowFacts — What a row's list is read from that the registry does not say.
 * - rowChoices — The list a picklist row reads, a Type row's the family's types; none, it is no picklist.
 * - fixedChoices — A fixed list: a pick row's own, or one the same on every page; none, an open list or no picklist.
 * - mirrored — What a picklist row shows while connections drive it: what comes in, read only, each pick marked Custom.
 * - drivenSwitch — What a switch row shows while a boolean connection drives it: True if any came in True, marked Custom.
 * - rowFault — A value's fault a row cannot say, in words: a closed list's stranger, no date, a number off its step.
 * - GraphRow — One row as drawn: its kind's parts, the value it shows, and whether a reader may change it.
 * - NodeSize — A node's size, in times its natural width and height, each 1 to 2.
 * - GraphNode — One node as drawn: its header, its sockets, its rows and its place.
 * - DrawnGraph — Nodes and connections, ready to draw: a workflow's, or a page's Query.
 * - GraphEdit — One row a reader changed: its node, its row and the new value.
 * - NodePlaces — Each node's place by its id: where a reader moved it.
 * - storedValues — What a node keeps of its drawn rows: each that holds a value, by its name.
 * - fieldsSent — The fields a node's rows carry, by its `every` field pick: those it keeps; none kept, every field.
 * - kindNode — A node of a kind, its rows given: the kind's header and sockets, under its own.
 * - placed — A graph with each node at its kept place.
 */
import { OP_LABELS, OP_TAKES, OPS_FOR_TYPE, type Duration, type FilterOp } from './store.js';
import { PRESENTATION_KINDS } from './query.js';
import { isDateTime } from './format-date.js';
import type { Given, Need } from './node-input.js';
import { nextPortalName } from './node-portals.js';
import { catalogChoices } from './ai-catalog.js';
import { report } from './report.js';

/** What a socket carries: one value; an object — a record, rows, or a list, for an array is
 *  an object (D17); a boolean, True or False; or, an input only, any of them (D1). */
export type SocketType = 'value' | 'object' | 'boolean' | 'any';

/** Each socket type in words, as a fault or a tip says it. */
export const SOCKET_WORDS: Readonly<Record<SocketType, string>> = { value: 'a value', object: 'an object', boolean: 'a boolean', any: 'any type' };

/** Whether an input reads what an output of a type sends: its own type, or `any`, which takes all. Any connection
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

/** The control a row draws: text, a message (text with values, `{{value:node.name}}`; plan 891), a number, a switch, tags (a
 *  list, D17) or a date and time; else the list a picklist reads — the row's own (`pick`), the fields, the field's values,
 *  units, a span's way (last or next), directions, presentations, Apply on, stores, scopes, a family's types, a graph's
 *  portal names, or the app's AI providers, a provider's models or its skills (`rowChoices`; plan 926), or the shelf's
 *  entities of one type (`entity`; plan 949). */
export type RowControl =
  | 'text' | 'message' | 'number' | 'switch' | 'tags' | 'datetime'
  | 'pick' | 'field' | 'values' | 'unit' | 'span' | 'direction' | 'presentation' | 'apply' | 'store' | 'scope' | 'type' | 'portal'
  | 'provider' | 'model' | 'skill' | 'event' | 'task' | 'agent' | 'endpoint' | 'entity';

/** One row a kind draws: its name, its label, its control and its sockets. */
export interface RowKind {
  /** A connection names the row by it, and a node keeps the row's value under it. */
  name: string;
  label: string;
  /** None: the row only names a socket, or shows a value. */
  control?: RowControl;
  /** Its list picks several, HTML's own name: its value is a list, and its sockets an object (D17). */
  multiple?: true;
  input?: SocketType;
  /** Its input takes several connections, each joined as the row says (D4); else a new one replaces it. */
  many?: true;
  output?: SocketType;
  /** It takes a value of the field reaching its node: its control follows that field's type (`typedControl`, plan 986). */
  ofField?: true;
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
  /** A property that sends on what reaches its node's HEADER: a test's Pass and Fail, on one value (plan 971 §9; Will, TODO 994:
   *  the data comes in at the header, always). */
  passes?: true;
  /** One way of a fork: what it sends goes no other way, as a test's Pass and Fail (plan 971). */
  fork?: true;
  /** It draws an output row per value picked on it, right after it, each a fork of that value's rows (Fork, plan 991 D6).
   *  TRAP T-a-fork-unfolds-its-picks */
  unfolds?: true;
  /** A pick on it is kept with the kinds placed last, so "Add a node" offers the kind with it picked (TODO 968). */
  recalls?: true;
  /** A many pick that keeps none means every choice: drawn all ticked, and all ticked keeps none (TODO 969). */
  every?: true;
  /** Where it is drawn, where not every graph of its kind: a Source's Fields is a workflow's alone. */
  graphs?: readonly NodeGraph[];
  /** A `pick` row's own fixed list, so a kind an app adds needs no control of its own. Drawn, the list as shown. Plan 891 */
  choices?: readonly RowChoice[];
  /** An `entity` row's type: it picks one of the shelf's entities of it, as a Run Coworker's Coworker (plan 949). */
  of?: string;
  /** A `message` row of one line, as a title or a file name: its editor has no toolbar and takes no line break. TODO 913 */
  singleLine?: true;
  /** A pick the node cannot do without: left blank, with nothing joined, it warns "Pick a …" (plan 951). */
  required?: true;
  /** An input the node can do without: nothing joined, it does not warn, as a `needs` row else would (plan 951). */
  optional?: true;
  /** Its choices are the values the field its node's row of this name picks declares (a Field's Values, Will D1): only
   *  that field's; drawn only where it declares some. A multi-select in a node is ONE row with one dropdown and a menu of
   *  ticks, never a row per choice (Will, 2026-11-13). TRAP T-a-multi-select-is-one-row */
  valuesOf?: string;
  /** Its rows are people or agents a message goes to: an app's type that says `recipient: true` (Users, Groups, Roles,
   *  Coworkers); rows of another type warn (Will, 2026-11-13, plan 960 U4.9). */
  recipients?: true;
}

/** Where a kind is drawn: a page's Query, or a workflow. */
export type NodeGraph = 'query' | 'workflow';

/** One type of a family kind (plan 749): the hint under its select, and what it adds to the kind's own rows and sockets. */
export interface NodeType {
  label: string;
  help?: string;
  /** Its header's icon, over the kind's. */
  icon?: string;
  /** What it would do, where it acts outside the graph: Simulate says it and does nothing (an Output's). */
  would?: string;
  /** Its rows, after the kind's own. */
  rows?: readonly RowKind[];
  /** Its sockets, where they differ from the kind's. */
  input?: SocketType;
  many?: true;
  output?: SocketType;
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
   *  and values say what it does with it. */
  input?: SocketType;
  /** What its header's input can use; what it cannot is null, and the node a warning (TODO 764). None: anything. */
  needs?: Need;
  /** Its header input takes several connections (D4). */
  many?: true;
  output?: SocketType;
  /** Its header's output sends on what reaches its header, drawn as that type: the Boolean (plan 971 §9). */
  passes?: true;
  /** What it sends holds the fields of every set of rows that reaches it, not only the first: a Merge's (plan 992 O3). */
  joins?: true;
  /** Its fixed rows; a Query node adds its own among them (a bar's chips and presets). */
  rows: readonly RowKind[];
  /** The data layer's name for what it stands for: a shape, or the function a workflow runs it by. */
  model: string;
  graphs: readonly NodeGraph[];
  /** The node panel's category, one of `NODE_CATEGORIES` or an app's own; a workflow kind has one. */
  category?: string;
  /** A reader's words for a Custom Node: the panel lists it under each, inside its category, and its search finds it by one. */
  tags?: readonly string[];
  /** Words the panel's search finds it by, beside its name, and lists it under none: what it does, as "sort" finds Organise. */
  keywords?: readonly string[];
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
/** A test's True: 1 where it holds, 0 where not (Will, plan 944). No node has a True or a False socket. */
const TRUE = propertyRow('true', 'True');
/** A bar's filter Switch: off, its filters are kept and filter nothing (a page's Query; plan 960 U4.8). */
const FILTERS: RowKind = { name: '#filters', label: 'Filters', control: 'switch', input: 'boolean' };
/** Results: the data rows a node sends on, a property like Count; they come in on its header (D1). It keeps the address `node/rows`. Plan 713 §3 */
export const ROWS: Readonly<RowKind> = propertyRow('rows', 'Results', 'rows');

/** A family's rows, each once: a type names the ones it draws. */
const VALUE: RowKind = { name: 'value', label: 'Value', control: 'text', output: 'value' };
const numberRow = (name: string, label: string): RowKind => ({ name, label, control: 'number', input: 'value' });
const textRow = (name: string, label: string): RowKind => ({ name, label, control: 'text', input: 'value' });
const dateRow = (name: string, label: string): RowKind => ({ name, label, control: 'datetime', input: 'value' });
/** A count: a whole number, from `min`. */
const countRow = (name: string, label: string, min: number): RowKind => ({ ...numberRow(name, label), min, step: 1 });
/** A list in, an object (D17): what Min, Max, Average and Join read. It takes several. Will, D9 */
const LIST: RowKind = { name: 'values', label: 'Values', input: 'object', many: true, needs: 'list' };
const NUMBERS: RowKind = { ...LIST, needs: 'numbers' };
/** What a Math or Text node gives, as a Value gives its own: from a row, its header forking (D2). A PROPERTY, as Count and
 *  Results are: it stands in the Properties box, not the Parameters (Will, 2026-11-11). */
const RESULT: RowKind = { name: 'result', label: 'Result', output: 'value', property: true };
const NUMBER: RowKind = { ...RESULT, gives: 'number' };
const [A, B, SEPARATOR] = [numberRow('a', 'Value A'), numberRow('b', 'Value B'), textRow('separator', 'Separator')];
/** A portal's name: picked from the graph's names, or New name… (TODO 779). */
const PORTAL_NAME: RowKind = { name: 'name', label: 'Name', control: 'portal' };

/** An Output's rows (plan 891). A message field takes text with values; each parameter can be connected too. */
const messageRow = (name: string, label: string, singleLine?: true): RowKind => ({ name, label, control: 'message', input: 'value', ...(singleLine ? { singleLine } : {}) });
const pickRow = (name: string, label: string, choices: readonly (readonly [string, string])[], multiple?: true): RowKind => ({
  name, label, control: 'pick', choices: choices.map(([value, words]) => ({ value, label: words })),
  ...(multiple ? { multiple, input: 'object' as const } : { input: 'value' as const }),
});
const objectIn = (name: string, label: string): RowKind => ({ name, label, input: 'object' });
const [TITLE, MESSAGE, SENT] = [messageRow('title', 'Title', true), messageRow('message', 'Message'), propertyRow('sent', 'Sent', 'boolean')];

/** The AI nodes' rows (plan 926): the model an AI node asks, and its instructions. */
const MODEL_IN: RowKind = { name: 'model', label: 'Model', input: 'object', needs: 'model' };
const INSTRUCTIONS = messageRow('instructions', 'Instructions');
/** What an AI node EXPECTS, its Type picker, the same for each (D2 A): True/false gives a True, 1 or 0, as a Condition does
 *  (plan 944); the rest an Answer, a property. An AI answer is fuzzy, so the reader says what shape it takes, and the sockets
 *  follow. */
const expects = (rows: readonly RowKind[], would: string): Readonly<Record<string, NodeType>> => ({
  boolean: { label: 'True/false', help: 'True, 1 or 0', rows: [...rows, TRUE], would },
  text: { label: 'Text', help: 'A text answer', rows: [...rows, propertyRow('answer', 'Answer', 'value')], would },
  number: { label: 'Number', help: 'A number', rows: [...rows, propertyRow('answer', 'Answer', 'number')], would },
  data: { label: 'Data', help: 'Rows of data', rows: [...rows, propertyRow('answer', 'Answer', 'rows')], would },
  list: { label: 'List', help: 'A list of values', rows: [...rows, propertyRow('answer', 'Answer', 'list')], would },
});

/** A row a Trigger listens by, which sends on what it heard: its pick, or its words (plan 941). It takes nothing in. */
const heard = (name: string, label: string, control: RowControl, gives: Given = 'value', choices?: readonly (readonly [string, string])[]): RowKind => ({
  name, label, control, output: propertySocket(gives), gives, ...(choices ? { choices: choices.map(([value, words]) => ({ value, label: words })) } : {}),
});

/** A Task's statuses, as a Trigger hears them and an Output Trigger sets them. */
const TASK_STATUSES = [['queued', 'Queued'], ['running', 'Running'], ['succeeded', 'Succeeded'], ['failed', 'Failed'], ['cancelled', 'Cancelled']] as const;

/** What a Trigger listens for, each a type (Will, plan 941). The app's SERVER listens and starts the graph: the node holds
 *  only what it listens for, and Simulate says what it would hear. The app's catalog lists what can be heard. */
const TRIGGERS: Readonly<Record<string, NodeType>> = {
  action: {
    label: 'User action', icon: 'person', help: 'A person starts it', would: 'Would start when a person asks',
    rows: [{ name: 'label', label: 'Label', control: 'text' }, propertyRow('by', 'Asked by', 'value')],
  },
  ui: {
    label: 'UI event', icon: 'bolt', help: 'Something happens in the app', would: 'Would start on the event',
    rows: [heard('event', 'Event', 'event'), propertyRow('at', 'At', 'value')],
  },
  schedule: {
    label: 'Task schedule', icon: 'calendar-clock', help: 'At a time, or again and again', would: 'Would start on its schedule',
    rows: [pickRow('every', 'Every', [['once', 'Once'], ['hour', 'Hour'], ['day', 'Day'], ['week', 'Week'], ['month', 'Month']]), heard('at', 'At', 'text')],
  },
  status: {
    label: 'Task status', icon: 'clipboard-w-tick', help: 'A task changes status', would: 'Would start when the task changes',
    rows: [heard('task', 'Task', 'task'), heard('status', 'Status', 'pick', 'value', TASK_STATUSES)],
  },
  message: {
    label: 'AI message', icon: 'chat', help: 'An agent says something', would: 'Would start when the agent says it',
    rows: [heard('from', 'From', 'agent'), { name: 'says', label: 'Says', control: 'text' }, propertyRow('message', 'Message', 'value')],
  },
  api: {
    label: 'API response', icon: 'transmitter-w-signal', help: 'An API answers', would: 'Would start on the response',
    rows: [heard('endpoint', 'Endpoint', 'endpoint'), heard('code', 'Status code', 'number', 'number'), propertyRow('response', 'Response', 'object')],
  },
};

/** The runtime's kind of each Trigger type, as a server reads it (plan 941): a person asks, a time comes, or an event. */
export const TRIGGER_RUNS: Readonly<Record<string, 'on_demand' | 'scheduled' | 'event'>> = {
  action: 'on_demand', ui: 'event', schedule: 'scheduled', status: 'event', message: 'event', api: 'event',
};

/** What an Output does: one kind per family, each its types (Will, plan 917). A host app adds its own to a family:
 *  `registerNodeTypes('content', { … })`. */
const NOTIFY_TYPES: Readonly<Record<string, NodeType>> = {
  notification: {
    label: 'Notification', would: 'Would send a notification', icon: 'notifications', help: 'Send a message by app, email or phone',
    rows: [
      pickRow('channels', 'Channels', [['app', 'In app'], ['email', 'Email'], ['push', 'Mobile push']], true),
      { name: 'to', label: 'To', input: 'object', needs: 'rows', recipients: true }, TITLE, MESSAGE, objectIn('attachments', 'Attachments'), textRow('url', 'Link'), pickRow('priority', 'Priority', [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']]),
      SENT, propertyRow('delivered', 'Delivered', 'value'), propertyRow('message-id', 'Message ID', 'value'),
    ],
  },
};
const CONTENT_TYPES: Readonly<Record<string, NodeType>> = {
  view: {
    label: 'On a view', would: 'Would show it on a view', icon: 'dashboard', help: 'Show content on a view',
    rows: [
      textRow('view', 'View'), pickRow('place', 'Place', [['widget', 'Widget'], ['card', 'Card'], ['row', 'List row']]), objectIn('content', 'Content'), dateRow('until', 'Keep until'),
      propertyRow('content-id', 'Content ID', 'value'), propertyRow('link', 'Link', 'value'),
    ],
  },
  file: {
    label: 'Generated file', would: 'Would make a file', icon: 'file-lines', help: 'Make a file from the data',
    rows: [
      pickRow('format', 'Format', [['pdf', 'PDF'], ['csv', 'CSV'], ['xlsx', 'XLSX'], ['docx', 'DOCX'], ['md', 'Markdown']]), textRow('template', 'Template'),
      messageRow('file-name', 'File name', true), objectIn('data', 'Data'), textRow('save-to', 'Save to'),
      propertyRow('file', 'File', 'object'), propertyRow('link', 'Link', 'value'),
    ],
  },
};
const RESPONSE_TYPES: Readonly<Record<string, NodeType>> = {
  toast: {
    label: 'Toast', would: 'Would show a toast', icon: 'megaphone', help: 'Show a short message on the screen',
    rows: [pickRow('tone', 'Tone', [['info', 'Info'], ['success', 'Success'], ['warning', 'Warning'], ['critical', 'Critical']]), MESSAGE, textRow('action', 'Action'), propertyRow('shown', 'Shown', 'boolean')],
  },
  alert: {
    label: 'Alert', would: 'Would raise an alert', icon: 'status-warning', help: 'Raise an alert on a device or customer',
    rows: [
      pickRow('severity', 'Severity', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['critical', 'Critical']]), pickRow('on', 'On', [['device', 'Device'], ['customer', 'Customer']]),
      TITLE, MESSAGE, propertyRow('alert-id', 'Alert ID', 'value'),
    ],
  },
  api: {
    label: 'API response', would: 'Would answer the call', icon: 'cloud', help: 'Answer the call that started the run',
    rows: [countRow('code', 'Status', 100), objectIn('body', 'Body'), pickRow('encoding', 'Format', [['json', 'JSON'], ['csv', 'CSV'], ['text', 'Text']]), SENT],
  },
};
const RESULT_TYPES: Readonly<Record<string, NodeType>> = {
  result: {
    label: 'Run result', would: 'Would end the run', icon: 'flag', help: 'End the run with a status and summary',
    rows: [pickRow('status', 'Status', [['succeeded', 'Succeeded'], ['skipped', 'Skipped'], ['failed', 'Failed'], ['deferred', 'Deferred']]), messageRow('summary', 'Summary')],
  },
};

/** The Output Trigger family's kind id: an app adds its types to it, as a Run Coworker (plan 949). */
export const OUTPUT_TRIGGER = 'output-trigger';

/** What an Output Trigger starts (Will, plan 949 D4 B): an event a Trigger hears — each row named as the Trigger's row it
 *  makes — and an app's own, by a row that picks an entity. A User action, a schedule and an API response come from
 *  outside, so no Output makes them. */
const OUTPUT_TRIGGER_TYPES: Readonly<Record<string, NodeType>> = {
  ui: { label: 'UI event', icon: 'bolt', help: 'Fire an event in the app', would: 'Would fire the event', rows: [{ name: 'event', label: 'Event', control: 'event', input: 'value' }] },
  status: {
    label: 'Task status', icon: 'clipboard-w-tick', help: 'Set a task\'s status', would: 'Would set the task\'s status',
    rows: [{ name: 'task', label: 'Task', control: 'task', input: 'value' }, pickRow('status', 'Status', TASK_STATUSES)],
  },
  message: {
    label: 'AI message', icon: 'chat', help: 'Say something, as an agent', would: 'Would send the message',
    rows: [{ name: 'from', label: 'From', control: 'agent', input: 'value' }, messageRow('says', 'Says')],
  },
};

/** One Output family as a kind: its types, the Output's look, lane and place (plan 917). It may sit mid-graph: its properties
 *  connection on. */
const outputFamily = (heading: string, icon: string, description: string, types: Readonly<Record<string, NodeType>>): NodeKind => ({
  heading, icon, description, input: 'any', typeLabel: 'Type', types, rows: [], model: 'LoadResult', graphs: ['workflow'], category: 'Output',
});

/** A family with more types: the host app's own beside the shipped ones, as `addTypes(NODE_KINDS.request, { ticket })`. */
export function addTypes(kind: NodeKind, types: Readonly<Record<string, NodeType>>): NodeKind {
  return { ...kind, types: { ...kind.types, ...types } };
}

/** The types each app adds to a shipped family, by the family's kind id. */
const added = new Map<string, Readonly<Record<string, NodeType>>>();
let joined: Readonly<Record<string, NodeKind>> | undefined;

/** An app adds its own types to a shipped family, from its own file: an Output's Ticket. A kind that is no shipped family,
 *  or a type the family ships, is refused and reported. It answers how to take them back, or none when refused. Plan 891 */
export function registerNodeTypes(kind: string, types: Readonly<Record<string, NodeType>>): (() => void) | undefined {
  const family = NODE_KINDS[kind];
  if (!family?.types) {
    report({ code: 'node-types', message: `registerNodeTypes: "${kind}" is no family the library ships.`, at: { kind } });
    return undefined;
  }
  const clash = Object.keys(types).find((id) => Object.hasOwn(family.types!, id));
  if (clash) {
    report({ code: 'node-types', message: `registerNodeTypes: "${clash}" is a type "${kind}" ships, which an app does not replace.`, at: { kind, type: clash } });
    return undefined;
  }
  added.set(kind, { ...added.get(kind), ...types });
  joined = undefined;
  return () => {
    const now = Object.fromEntries(Object.entries(added.get(kind) ?? {}).filter(([id, t]) => types[id] !== t));
    if (Object.keys(now).length) added.set(kind, now);
    else added.delete(kind);
    joined = undefined;
  };
}

/** Every kind the library ships, with the types apps added (`registerNodeTypes`): what a check and an editor read. */
export function nodeKinds(): Readonly<Record<string, NodeKind>> {
  return (joined ??= added.size ? { ...NODE_KINDS, ...Object.fromEntries([...added].map(([id, types]) => [id, addTypes(NODE_KINDS[id]!, types)])) } : NODE_KINDS);
}

/** The operators whose value is a list: Is one of, Is not one of. */
export const LIST_OPS: readonly FilterOp[] = ['in', 'notin'];

/** The control a value of a field's type takes: a number, a date; none for text, which keeps the row's own (plan 986).
 *  TRAP T-a-row-takes-its-values-type */
export function typedControl(type: string | undefined): RowControl | undefined {
  return type === 'number' ? 'number' : type === 'date' ? 'datetime' : undefined;
}

/** A Logic type that is one of the data layer's operators: it tests what comes in on its header — a Field's column, or a
 *  value — against what the operator takes: Value B, a list of Values, or Start and End. Its words the operator's own
 *  (`OP_LABELS`). Plan 783 D3 · TRAP T-a-logic-type-is-an-operator */
function compareType(op: FilterOp): NodeType {
  const [list, range] = [LIST_OPS.includes(op), OP_TAKES[op] === 'range'];
  const rows: RowKind[] = list ? [{ name: 'b', label: 'Values', control: 'tags', multiple: true, input: 'object' }]
    : range ? [{ ...textRow('start', 'Start'), ofField: true }, { ...textRow('end', 'End'), ofField: true }]
      : [{ name: 'b', label: 'Value B', control: 'values', input: 'value', ofField: true }];
  const against = list ? 'the Values' : range ? 'Start and End' : 'Value B';
  const words = OP_LABELS[op].toLowerCase();
  const said = /^(is|does|equals|contains|starts|ends)\b/.test(words) ? words : `is ${words}`;
  return { label: OP_LABELS[op], help: `True when what comes in ${said} ${against}`, input: 'any', needs: 'tested', rows: [PASS, FAIL, VALUE_A, ...rows] };
}

/** Figma's six comparisons, in its order; the operators after them are Sherpa's. A span from today is Time › Duration's. */
const FIGMA_OPS: readonly FilterOp[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'ne'];
const SHERPA_OPS = (Object.keys(OP_LABELS) as FilterOp[]).filter((op) => !FIGMA_OPS.includes(op) && op !== 'last' && op !== 'next');
const compareTypes = (ops: readonly FilterOp[]): Record<string, NodeType> => Object.fromEntries(ops.map((op) => [op, compareType(op)]));

/** Logic's types, one test each (plan 783 D4): And and Or join the tests that come in, booleans on the header, read as
 *  `truthOf` reads them; then the comparisons. Each leads with Rows: the rows it lets through. A Query draws its tree
 *  with these: Not and Is empty are a workflow's alone. Plan 749 P5 */
/** A test's Pass: the rows that hold it; its Fail: the rows that do not, so neither route is lost (Will, plan 971 A). On ONE
 *  value, the way its truth takes sends ALL that came into its header, else the value tested; the other sends nothing (plan
 *  971 §9; TODO 994). */
const [PASS, FAIL]: readonly [RowKind, RowKind] = [
  { ...propertyRow('pass', 'Pass', 'rows'), fork: true, passes: true }, { ...propertyRow('fail', 'Fail', 'rows'), fork: true, passes: true },
];
/** The value a test tests when it is not the data (an AI step's True, a Count): the header is the data, always (Will, TODO
 *  994, A). Not joined, the test tests its header. TRAP T-the-data-comes-in-at-the-header */
const VALUE_A: RowKind = { name: 'a', label: 'Value A', input: 'any', needs: 'tested', optional: true };
/** The kinds that test: each gives Pass, Fail and its truth (plan 971 A). */
export const TEST_KINDS: ReadonlySet<string> = new Set(['condition', 'time']);
const LOGIC: Readonly<Record<string, NodeType>> = {
  // And and Or join anything, several: rows, counts, values, tests. An input is true where it is above zero, true, or not
  // empty; Pass is the rows in all of the inputs (And) or in any true one (Or), Fail the rest (plan 971 A).
  and: { label: 'And', help: 'True when every input is true: above zero, true, or not empty', input: 'any', many: true, rows: [PASS, FAIL] },
  or: { label: 'Or', help: 'True when any input is true: above zero, true, or not empty', input: 'any', many: true, rows: [PASS, FAIL] },
  ...compareTypes(FIGMA_OPS),
  not: { label: 'Not', help: 'True when the value that comes in is false', input: 'any', rows: [PASS, FAIL, VALUE_A], graphs: ['workflow'] },
  empty: { label: 'Is empty', help: 'True when what comes in is nothing: none, 0, false, empty text or list, or no rows', input: 'any', rows: [PASS, FAIL, VALUE_A], graphs: ['workflow'] },
  ...compareTypes(SHERPA_OPS),
};

/** What one input into a Condition is, for the operations that fit it: a value or a column, by its type; or data. TODO 940 */
export type ConditionInput = 'text' | 'number' | 'date' | 'boolean' | 'data';

/** Each input in words, as a warning says it. */
export const CONDITION_INPUT_WORDS: Readonly<Record<ConditionInput, string>> = { text: 'text', number: 'a number', date: 'a date', boolean: 'a boolean', data: 'rows' };

/** The Logic types each input fits (TODO 940): a value's comparisons by its type, and a list's; And, Or and Is empty fit
 *  every input, Not a number or a boolean. Data, rows or an object, fits those three alone: a comparison needs a Field. */
const JOINS = ['and', 'or', 'empty'];
const FITS: Readonly<Record<ConditionInput, readonly string[]>> = {
  text: [...JOINS, ...OPS_FOR_TYPE['text']!, ...LIST_OPS],
  number: [...JOINS, 'not', ...OPS_FOR_TYPE['number']!, ...LIST_OPS],
  date: [...JOINS, ...OPS_FOR_TYPE['date']!.filter((op) => op in LOGIC), ...LIST_OPS],
  boolean: [...JOINS, 'not', 'eq', 'ne'],
  data: JOINS,
};

/** Whether a Logic type fits an input. TODO 940 */
export function fitsCondition(type: string, input: ConditionInput): boolean {
  return FITS[input].includes(type);
}

/** The Logic types that fit what comes in: each one an input fits. None comes in: undefined, every type fits. TODO 940 */
export function conditionFits(inputs: readonly ConditionInput[]): ReadonlySet<string> | undefined {
  return inputs.length ? new Set(inputs.flatMap((i) => FITS[i])) : undefined;
}

/** Every kind the library ships, once. An app adds its own beside them: `{ ...NODE_KINDS, mine }`.
 *  A test branches (plans 944, 971 §9): Pass and Fail split a column's rows, or send all that came into its header by one value's truth. No
 *  True row (Will: "This removes the need for the 'True' property"), no True or False socket, and no Branch node. */
export const NODE_KINDS: Readonly<Record<string, NodeKind>> = {
  // Where the rows come from, in every graph: the store it names. A Query adds how its page reads it. TODO 808
  // A Start node: nothing comes in; what it heard leaves by its rows. Any one of a graph's Triggers starts it (Will, D2 B). Its
  // header sends True when it fires, to the Start (plan 949 D1 A).
  trigger: {
    heading: 'Trigger', icon: 'bolt', description: 'Start the graph when its event comes', output: 'boolean',
    typeLabel: 'Listens for', defaultType: 'action', types: TRIGGERS, rows: [], model: 'trigger', graphs: ['workflow'], category: 'Triggers',
  },
  source: {
    heading: 'Source', icon: 'storage', description: 'Connect a data source',
    rows: [
      { ...ROWS, beside: 'store' }, { name: 'store', label: 'Store', control: 'store', input: 'value' },
      // The fields its rows carry, All at the start (Will, 2026-11-13, TODO 969). A page's Query reads every field.
      { name: 'fields', label: 'Fields', control: 'field', multiple: true, optional: true, every: true, graphs: ['workflow'] },
    ], model: 'SourceDefinition', graphs: ['query', 'workflow'], category: 'Sources',
  },
  // A page's Query: its rows read left to right, as the data flows.
  // The View's bar (plan 960 U4.8): its Switch, then a chip per held field (its tree's True joins it) and a row per preset.
  // Its header takes the View's Organise; it goes into the View.
  'view-filters': {
    heading: 'View Filters', icon: 'filter', description: 'Filter every card in the View', input: 'any',
    rows: [FILTERS, propertyRow('filters', 'View Filters', 'object')], model: 'ScopeQuery', graphs: ['query'],
  },
  // Logic: one test per Condition, And and Or joining tests (plan 783 D4). TRAP T-a-condition-is-a-tree-of-nodes
  condition: {
    heading: 'Condition', icon: 'function', description: 'Logical checks of a value against a condition',
    typeLabel: 'Check', defaultType: 'eq', types: LOGIC, rows: [], model: 'Condition', graphs: ['query', 'workflow'], category: 'Logic',
  },
  // Rows on by ONE field's value (Will, plan 991 D6 A; plan 992: a Condition is one test, a Fork many places; Will named it Fork, so
  // a Route stays a full path, PRINCIPLES 19): a Field on its header; Ways, the values it picks, one dropdown of ticks; an output per value picked, and Otherwise.
  fork: {
    heading: 'Fork', icon: 'link-simple', description: 'Send each row on by a field\'s value', input: 'any', needs: 'field',
    rows: [{ name: 'ways', label: 'Ways', control: 'tags', multiple: true, input: 'object', unfolds: true },
      { name: 'otherwise', label: 'Otherwise', output: 'object', gives: 'rows', fork: true }],
    model: 'fork', graphs: ['workflow'], category: 'Logic',
  },
  // "If true then" (Will, plan 971 §9): what comes in goes on where it is true (above 0, true, not empty), else the route
  // stops. No rows: one header in, one out, of what came in.
  boolean: {
    heading: 'Boolean', icon: 'tick', description: 'Pass the input on when it is true', input: 'any', output: 'object', passes: true,
    rows: [], model: 'boolean', graphs: ['workflow'], category: 'Logic',
  },
  // Its on, then each field it writes.
  preset: {
    heading: 'Preset', icon: 'star', description: 'Apply a filter the app named', output: 'boolean',
    rows: [{ name: 'on', label: 'On', control: 'switch', input: 'boolean' }], model: 'ScopeDefinition.presets', graphs: ['query'], category: 'Presets',
  },
  // ONE node for how rows are organised (Will, plan 960 U4.2): sorting, grouping, search, and the axes a chart reads —
  // its Primary (X), its Secondary (Y) and its Segments' parts. An empty row does nothing.
  organise: {
    heading: 'Organise', icon: 'sort-ascending', description: 'Sort, group, search rows and set axes', input: 'any', needs: 'rows',
    keywords: ['sort', 'group', 'search', 'axes'],
    rows: [
      ROWS,
      { name: 'sort', label: 'Sort', control: 'field', input: 'value' },
      { name: 'direction', label: 'Direction', control: 'direction', input: 'value' },
      { name: 'group', label: 'Group', control: 'field', input: 'value' },
      { name: 'search', label: 'Search', control: 'text', input: 'value' },
      { name: 'primary', label: 'Primary', control: 'field', input: 'value' },
      { name: 'secondary', label: 'Secondary', control: 'field', input: 'value' },
      { name: 'segments', label: 'Segments', control: 'field', input: 'value' },
    ],
    model: 'Arrangement', graphs: ['query', 'workflow'], category: 'Organise',
  },
  // Two sets of rows joined by a field of each (Will, plan 992 O3 A; no Compare): a Field of the A rows on its header, one of
  // the B rows on B. TRAP T-a-merge-joins-by-a-field-of-each
  merge: {
    heading: 'Merge', icon: 'table-columns', description: 'Join two sets of rows by matching fields', input: 'any', needs: 'field', joins: true,
    keywords: ['join', 'compare', 'match'],
    rows: [
      { name: 'b', label: 'B', input: 'any', needs: 'field' },
      { name: 'compare', label: 'Compare', control: 'field', multiple: true, optional: true },
      propertyRow('matched', 'Matched', 'rows'), propertyRow('only-a', 'Only in A', 'rows'), propertyRow('only-b', 'Only in B', 'rows'),
      propertyRow('changed', 'Changed', 'rows'),
    ],
    model: 'merge', graphs: ['workflow'], category: 'Organise',
  },
  // A card, the Content (plan 960 U4.8): its rows come in on its header; its bar, where it carries one (a Query adds its
  // chips and presets after the Switch), then how its rows are shown. Its axes are the Organise node's.
  presentation: {
    heading: 'Presentation', icon: 'insights', description: 'Choose how a card shows its rows', input: 'any',
    rows: [
      FILTERS,
      { name: 'kind', label: 'Show as', control: 'presentation' },
      { name: 'sort', label: 'Segment order', control: 'direction' },
      propertyRow('content', 'Content', 'object'),
    ],
    model: 'Presentation', graphs: ['query'],
  },
  // The View (Will, D4): the View Filters over every Content. No rows of its own, and nothing out.
  view: {
    heading: 'View', icon: 'table-columns', description: 'Put the View Filters over every card',
    rows: [{ name: 'filters', label: 'View Filters', input: 'object' }, { name: 'content', label: 'Content', input: 'object', many: true }],
    model: 'PageDefinition', graphs: ['query'],
  },
  // A workflow: each kind over the data-layer function it runs by; a family's Type row picks what it does (plan 749).
  value: {
    heading: 'Value', icon: 'function', description: 'Primitive value variables', typeLabel: 'Type', defaultType: 'text',
    types: {
      text: { label: 'Text', rows: [VALUE] },
      // Each takes its value in its type's control (Will, plan 986).
      integer: { label: 'Integer', help: 'A whole number, as 42', rows: [{ ...VALUE, control: 'number', step: 1 }] },
      decimal: { label: 'Decimal', help: 'A number with places, as 4.25', rows: [{ ...VALUE, control: 'number' }] },
      date: { label: 'Date', help: 'A day, written year-month-day: 2024-01-31', rows: [{ ...VALUE, control: 'datetime' }] },
      boolean: { label: 'True/false', help: 'True or false', rows: [{ ...VALUE, control: 'switch', gives: 'boolean' }] },
      list: { label: 'List', help: 'Values, each a tag, sent as a list', rows: [{ ...VALUE, control: 'tags', multiple: true, output: 'object', gives: 'list' }] },
    },
    rows: [], model: 'typedValue', graphs: ['workflow'], category: 'Variables',
  },
  // Rows in, a column out, `{ rows, field }`; one record in, that field's value. Its True: the field is there. Plan 783 D1, D2
  field: {
    heading: 'Field', icon: 'price-tag', description: 'Target a field from a connected Source', input: 'any', needs: 'object',
    rows: [
      { name: 'field', label: 'Field', control: 'field', input: 'value', output: 'object', gives: 'field', recalls: true },
      // The values it sends, picked from its field's own: one dropdown, a menu of ticks (Will, D1, E1 A).
      { name: 'values', label: 'Values', control: 'values', multiple: true, output: 'object', valuesOf: 'field', optional: true },
    ], model: 'readField', graphs: ['query', 'workflow'], category: 'Variables',
  },
  // One number from numbers, given from its Result row. Min, Max and Average read a list (D9; Will, plan 991 D4: once Floor
  // and Ceiling).
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
      min: { label: 'Min', help: 'The lowest value of the list', rows: [NUMBERS, NUMBER] },
      max: { label: 'Max', help: 'The highest value of the list', rows: [NUMBERS, NUMBER] },
      average: { label: 'Average', help: 'Average value of the list', rows: [NUMBERS, NUMBER] },
      // The list's statistics (plan 991a): each a list of numbers in, one number out.
      sum: { label: 'Sum', help: 'Every value of the list added up', rows: [NUMBERS, NUMBER] },
      median: { label: 'Median', help: 'The middle value of the list, in order', rows: [NUMBERS, NUMBER] },
      range: { label: 'Range', help: 'The highest value of the list less the lowest', rows: [NUMBERS, NUMBER] },
      // Rows in, how many out: Count is no property (Will, plan 944, D3 A).
      count: { label: 'Count', help: 'How many rows come in. How many differ is Count unique', rows: [{ name: 'rows', label: 'Rows', input: 'object', needs: 'rows' }, NUMBER] },
      unique: { label: 'Count unique', help: 'How many different values the list holds. How many rows is Count', rows: [LIST, NUMBER] },
      // A number into named steps: the label of the first band it is up to, else the last (plan 991a).
      band: {
        // One job (Will, plan 992 O1): a value worked out in this graph; a label every page shows is a type's status field.
        label: 'Band', help: 'The label of the first band a value worked out here is up to. A column every page shows is a status field',
        rows: [numberRow('a', 'Value'), { name: 'bands', label: 'Up to', control: 'tags', multiple: true, input: 'object', needs: 'numbers' },
          { name: 'labels', label: 'Labels', control: 'tags', multiple: true, input: 'object' }, RESULT],
      },
    },
    rows: [], model: 'math', graphs: ['workflow'], category: 'Math',
  },
  // Whether the date that comes in, of any type (D1), holds: True takes it, False the rest.
  time: {
    heading: 'Time', icon: 'time', description: 'Check a date against a time', input: 'any', needs: 'date', output: 'boolean', typeLabel: 'Check', defaultType: 'between',
    types: {
      between: { label: 'Between', help: 'True when the date is from Start to End', rows: [PASS, FAIL, dateRow('start', 'Start'), dateRow('end', 'End')] },
      duration: {
        label: 'Duration', help: 'True when the date is within a span of today',
        rows: [PASS, FAIL, { name: 'when', label: 'When', control: 'span', input: 'value' }, countRow('n', 'Value', 1), { name: 'unit', label: 'Unit', control: 'unit', input: 'value' }],
      },
    },
    rows: [], model: 'timeCheck', graphs: ['workflow'], category: 'Time',
  },
  // Text from text, given from its Result row: a list, where Split by makes one.
  text: {
    heading: 'Text', icon: 'pencil', description: 'Change and combine text values', typeLabel: 'Operation', defaultType: 'format',
    types: {
      // A Template filled from what reaches its Data: one text per row, else one text. It is Append and Prepend too (Will,
      // plan 992 O2): "{{value:a.value}} and more". TRAP T-format-is-the-one-text-door
      format: {
        label: 'Format', help: 'The Template filled from its Data: one text per row, else one text. An Output fills its own message',
        rows: [{ name: 'data', label: 'Data', input: 'any', many: true }, { name: 'template', label: 'Template', control: 'message', input: 'value' }, RESULT],
      },
      split: { label: 'Split by', help: 'Value as a list, split at each Separator', rows: [textRow('a', 'Value'), SEPARATOR, { ...RESULT, output: 'object', gives: 'list' }] },
      join: { label: 'Join', help: 'The list as one text, Separator between each', rows: [LIST, SEPARATOR, RESULT] },
    },
    rows: [], model: 'modifyText', graphs: ['workflow'], category: 'Utils',
  },
  // An In and an Out joined by a name, no line between them. An In takes many connections; an Out draws a row for each connection
  // into an In of its name, once drawn, and sends from those rows alone (TODOs 779, 826). TRAP T-a-portal-hop-is-resolved-once
  portal: {
    heading: 'Portal', icon: 'link-simple', description: 'Link two nodes without a line',
    typeLabel: 'Type', defaultType: 'in',
    types: {
      in: { label: 'In', help: 'Each connection in is a row on every Out portal of its name', input: 'any', many: true, rows: [PORTAL_NAME] },
      out: { label: 'Out', help: 'A row for each connection into an In portal of its name', rows: [PORTAL_NAME] },
    },
    rows: [], model: 'portal', graphs: ['workflow'], category: 'Utils',
  },
  // AI (plans 926, 951): a Model says which provider and model, both; a Prompt, a Runbook and a Skill ask it, each giving
  // what it Expects. One joined to the Start is the graph's primary. The app gives the lists (`registerAiCatalog`). Simulate
  // asks no model: each says what it would do.
  model: {
    heading: 'Model', icon: 'microchip-ai', description: 'Pick an AI provider and its model',
    rows: [
      { name: 'provider', label: 'Provider', control: 'provider', required: true },
      { name: 'model', label: 'Model', control: 'model', output: 'object', gives: 'model', required: true },
    ],
    model: 'aiModel', graphs: ['workflow'], category: 'AI',
  },
  prompt: {
    heading: 'Prompt', icon: 'chat', description: 'Ask the joined model, in your words', input: 'any', typeLabel: 'Expects', defaultType: 'text',
    types: expects([MODEL_IN, messageRow('prompt', 'Prompt')], 'Would ask the model'), rows: [], model: 'aiPrompt', graphs: ['workflow'], category: 'AI',
  },
  runbook: {
    // A runbook of its own words: the app's runbooks are nodes of the Runbooks category (Will, plan 936 D1 B).
    heading: 'Runbook', icon: 'book-open-lines', description: 'Write a runbook for the model to run', input: 'any', typeLabel: 'Expects', defaultType: 'text',
    types: expects([MODEL_IN, INSTRUCTIONS], 'Would run the runbook'),
    rows: [], model: 'aiRunbook', graphs: ['workflow'], category: 'AI',
  },
  skill: {
    heading: 'Skill', icon: 'wand-magic-sparkles', description: 'Use a skill, or write a new one', input: 'any', typeLabel: 'Expects', defaultType: 'text',
    types: expects([MODEL_IN, { name: 'skill', label: 'Skill', control: 'skill', input: 'value' }, INSTRUCTIONS], 'Would use the skill'),
    rows: [], model: 'aiSkill', graphs: ['workflow'], category: 'AI',
  },
  // The Output families, each a kind (Will, plan 917). Request ships no type: a host adds its own, and it is listed then.
  notify: outputFamily('Notification', 'notifications', 'Send a message by app, email or phone', NOTIFY_TYPES),
  content: outputFamily('Content', 'dashboard', 'Show content, or make a file', CONTENT_TYPES),
  response: outputFamily('Response', 'megaphone', 'Answer on the screen, or the call', RESPONSE_TYPES),
  result: outputFamily('Run result', 'flag', 'End the run with a status and summary', RESULT_TYPES),
  request: outputFamily('Request', 'export', 'Ask another system or agent', {}),
  [OUTPUT_TRIGGER]: outputFamily('Output Trigger', 'bolt-in-circle', 'Start something when the run gets here', OUTPUT_TRIGGER_TYPES),
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
  return kind.types && Object.entries(kind.types).map(([value, t]) => ({ value, label: t.label, ...(t.help ? { title: t.help } : {}) }));
}

/** A family kind as an ordinary kind for one type, so a reader learns nothing of types: the type
 *  row first (none for a kind of one type), then the kind's rows and the type's; the type's sockets
 *  over the kind's. A kind with no types is as it is. */
export function resolveKind(kind: NodeKind, type?: unknown): NodeKind;
export function resolveKind(kind: NodeKind | undefined, type?: unknown): NodeKind | undefined;
export function resolveKind(kind: NodeKind | undefined, type?: unknown): NodeKind | undefined {
  const at = kind && typeOf(kind, type);
  if (!kind || !at) return kind;
  const { types, typeLabel, defaultType: _default, ...plain } = kind;
  const { input, many, output, graphs = kind.graphs, needs, icon, would } = at.type;
  const row: RowKind = { name: 'type', label: typeLabel ?? 'Type', control: 'type' };
  return {
    ...plain, ...(icon ? { icon } : {}), ...(would ? { would } : {}), ...(input ? { input } : {}), ...(many ? { many } : {}), ...(output ? { output } : {}), ...(needs ? { needs } : {}),
    graphs,
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
export const NODE_CATEGORIES: readonly string[] = ['Triggers', 'Sources', 'Custom Nodes', 'Runbooks', 'Variables', 'Math', 'Logic', 'AI', 'Time', 'Organise', 'Utils', 'Output', 'Presets'];

/** The categories a Query's panel lists: the kinds a Query takes placed — a Source (TODO 808), a Field (plan 783 D6) — and
 *  its Custom Nodes, its page's Filters (TODO 776). */
const QUERY_CATEGORIES: readonly string[] = ['Sources', 'Custom Nodes', 'Variables', 'Logic', 'Presets'];

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
    // A family with no type of its own, as Request before a host adds one, places nothing (plan 917).
    if (!kind || (kind.types && !Object.keys(kind.types).length)) continue;
    const category = kind.category ?? 'Other';
    if (graph === 'query' && !QUERY_CATEGORIES.includes(category)) continue;
    const items = groups.get(category) ?? [];
    items.push({ id, kind });
    groups.set(category, items);
  }
  const known = new Set(NODE_CATEGORIES);
  return [...groups].filter(([c, items]) => items.length || (graph === 'workflow' && c === 'Custom Nodes')).sort(([a], [b]) => Number(!known.has(a)) - Number(!known.has(b))).map(([category, items]) => ({ category, items }));
}

/** How a panel item answers a search: by its name, a tag or a keyword, `{}`; by a type's name, `{ type }`, the one it names
 *  whole first ("not" is Not, not Does not equal); none, not at all. Nothing typed finds all. */
export function paletteMatch(kind: Pick<NodeKind, 'heading' | 'types' | 'tags' | 'keywords'>, query: string): { type?: string } | undefined {
  const q = query.trim().toLowerCase();
  if (!q || kind.heading.toLowerCase().includes(q) || [...kind.tags ?? [], ...kind.keywords ?? []].some((t) => t.toLowerCase().includes(q))) return {};
  const types = Object.entries(kind.types ?? {});
  // A type is found whole first, else by the start of a word: "and" is And, never the inside of Band (plan 991a).
  const starts = (label: string): boolean => label.toLowerCase().split(/\s+/).some((_, i, words) => words.slice(i).join(' ').startsWith(q));
  const hit = types.find(([, t]) => t.label.toLowerCase() === q) ?? types.find(([, t]) => starts(t.label));
  return hit ? { type: hit[0] } : undefined;
}

/** Where a new node of a kind joins a socket of a type: on the dragged OUTPUT's side, its header
 *  or row INPUT that takes the type; on a dragged INPUT's, its header or row OUTPUT the input takes.
 *  A family tries its default type first, then the rest in order; `type` names one other than the
 *  default. `{}` the header, `{ row }` a row; none, no type of it fits. */
export function fitOf(family: NodeKind, type: SocketType, side: 'out' | 'in', gives?: string): { row?: string; type?: string } | undefined {
  const key = side === 'out' ? 'input' : 'output';
  const fits = (t: SocketType | undefined): boolean => !!t && (side === 'out' ? accepts(type, t) : accepts(t, type));
  const first = typeOf(family)?.id;
  const ids = [first, ...Object.keys(family.types ?? {}).filter((t) => t !== first)];
  // A row that needs just what the line gives comes first: rows into Math are its Count, not its Min (plan 944).
  if (gives && side === 'out') {
    for (const id of ids) {
      const row = resolveKind(family, id).rows.find((r) => r.input && r.needs === gives);
      if (row) return { row: row.name, ...(id !== first ? { type: id! } : {}) };
    }
  }
  for (const id of ids) {
    const kind = resolveKind(family, id);
    const row = fits(kind[key]) ? undefined : kind.rows.find((r) => fits(r[key]));
    if (fits(kind[key]) || row) return { ...(row ? { row: row.name } : {}), ...(id !== first ? { type: id! } : {}) };
  }
  return undefined;
}

/** A kind placed or set last: with its picks on its `recalls` rows, a use of its own (TODO 968). */
export interface RecentUse {
  kind: string;
  values?: Readonly<Record<string, string>>;
  /** How its picks read, found when "Add a node" opens; never kept. */
  label?: string;
}

/** One choice of "Add a node": a kind, or a use of it with its picks. */
export interface PaletteChoice extends PaletteItem {
  values?: Readonly<Record<string, string>>;
  label?: string;
}

/** The palette's kinds a socket of a type could join: the ones used last first, newest first, a use with its picks its own
 *  choice (TODO 968); then a Value (D16), then the palette's order. */
export function paletteFor(palette: readonly PaletteGroup[], type: SocketType, side: 'out' | 'in', recent: readonly RecentUse[] = []): PaletteChoice[] {
  const fit = palette.flatMap((g) => g.items).filter((i) => fitOf(i.kind, type, side));
  const byId = new Map(fit.map((i) => [i.id, i]));
  const used = recent.flatMap(({ kind, values, label }): PaletteChoice[] => {
    const item = byId.get(kind);
    return item ? [values ? { ...item, values, ...(label ? { label } : {}) } : item] : [];
  });
  const plain = new Set(used.filter((c) => !c.values).map((c) => c.id));
  const value = byId.get('value');
  return [...used, ...(value && !plain.has('value') ? [value] : []), ...fit.filter((i) => i.id !== 'value' && !plain.has(i.id))];
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

/** Every node the connections lead to from these, and on from each; these left out. TODO 889 */
export function downstreamOf(connections: readonly NodeConnection[], from: Iterable<string>): Set<string> {
  const start = new Set(from);
  const next = new Map<string, string[]>();
  for (const connection of connections) {
    const [a, b] = [socketOf(connection.from).node, socketOf(connection.to).node];
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

/** The sockets a kind says, or a node drawn of it. */
type Sockets = Pick<NodeKind, 'input' | 'output' | 'many'> & { rows: readonly RowKind[] };

/** The row of a kind a name says. */
export function rowOf<R extends Pick<RowKind, 'name'>>(rows: readonly R[], name: string): R | undefined {
  return rows.find((r) => r.name === name);
}

/** The prefix of a row a pick unfolds: "At risk" unfolds as `v-at-risk` (a socket's name takes no space). */
export const UNFOLDED = 'v-';

/** The output rows a pick unfolds, one per value picked: named by its words (`v-at-risk`; a clash, `-2`), each a fork of that
 *  value's rows (Fork, plan 991 D6). TRAP T-a-fork-unfolds-its-picks */
export function unfoldedRows(picked: unknown): RowKind[] {
  const taken = new Set<string>();
  return [picked ?? []].flat().filter((v) => v != null && v !== '').map((value): RowKind => {
    const base = `${UNFOLDED}${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'value'}`;
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
    taken.add(name);
    return { name, label: String(value), output: 'object', gives: 'rows', fork: true };
  });
}

/** A node's rows: its kind's, each row that unfolds followed by the rows its pick unfolds. One door, so the drawing, a run and
 *  the text read the same rows. */
export function rowsOfNode(kind: Pick<Sockets, 'rows'>, values: Readonly<Record<string, unknown>> = {}): RowKind[] {
  return kind.rows.flatMap((r) => (r.unfolds ? [r, ...unfoldedRows(values[r.name])] : [r]));
}

/** A row's title as a reader sees it: one the node can do without says so, "Values (Optional)". Its name, its
 *  connections and its warnings keep its label. Will, 2026-11-14, TODO 984 */
export function rowTitle(row: Pick<RowKind, 'label' | 'optional'>): string {
  return row.optional ? `${row.label} (Optional)` : row.label;
}

/** The type one socket of a kind, or of a node drawn of it, carries — its header's (no row) or a row's — on one side;
 *  none, it has no such socket. */
export function socketType(kind: Sockets, row: string | undefined, side: 'input' | 'output'): SocketType | undefined {
  if (row === undefined) return kind[side];
  // A row a pick unfolds (`v-…`) is an output of rows, on a kind that unfolds one.
  return rowOf(kind.rows, row)?.[side] ?? (side === 'output' && row.startsWith(UNFOLDED) && kind.rows.some((r) => r.unfolds) ? 'object' : undefined);
}

/** Whether an input of a kind, or of a node drawn of it, takes several connections: its header's (no row), or a row's. */
export function takesMany(kind: Sockets, row?: string): boolean {
  return !!(row === undefined ? kind.many : rowOf(kind.rows, row)?.many);
}

/** One connection: an output socket to an input socket, each `node`, `node/row` or `node/#false`. */
export interface NodeConnection {
  from: string;
  to: string;
  /** Bend points a reader gave it, in plane px, sorted by x. None, the default curve. TODO 744 */
  via?: readonly { x: number; y: number }[];
}

/** One zip tie: where it stands, and the connections it funnels, top to bottom. It changes no data. TODO 562 */
export interface NodeTie {
  id: string;
  x: number;
  y: number;
  connections: readonly NodeConnection[];
}

/** One pick in a row's list: the value it keeps, and its words; its section and its line, where a list has them. */
export interface RowChoice {
  value: string;
  label: string;
  /** Its section in the list: a family's types by their `group` (plan 891). */
  group?: string;
  /** What it does, in a line, on hover. */
  title?: string;
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
  /** The provider a Model node picked: what its Model row picks from (plans 926, 951). */
  provider?: unknown;
  /** The shelf's entities of an `entity` row's type: what it picks (plan 949). */
  entities?: readonly RowChoice[];
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
  // The app's catalog (plans 926, 941), or the shelf's entities of a type (949): one with none picked says so, as a pick does.
  const listed = row.control === 'entity' ? facts.entities : catalogChoices(row.control, facts.provider);
  if (listed) return [...(row.value != null && row.value !== '' ? [] : [{ value: '', label: 'Pick one' }]), ...listed];
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

/** What a picklist row shows while connections drive it (D7): what comes in, read only, each pick
 *  marked Custom. A single pick shows the one that came in, and only it; a `multiple` row
 *  ticks each that came in, and marks Custom each its list lacks. The row's own pick is not
 *  here: the draft keeps it, and cutting the connections gives it back. Plan 713 §5, §9.5 */
export function mirrored(row: Pick<RowKind, 'multiple' | 'control'>, given: readonly unknown[], list: readonly RowChoice[] = []): Pick<GraphRow, 'value' | 'choices' | 'custom'> {
  const custom = (v: string): RowChoice => ({ value: v, label: `${v} Custom` });
  const picks = [...new Set(given.flat().filter((v) => v != null && v !== '').map(String))];
  if (!row.multiple) return { value: picks[0] ?? '', choices: picks.slice(0, 1).map(custom), custom: true };
  // Tags say each value as itself: the hint says they are Custom, and a closed list's stranger is a fault.
  if (row.control === 'tags') return { value: picks, choices: list, custom: true };
  return { value: picks, choices: [...list, ...picks.filter((v) => !list.some((c) => c.value === v)).map(custom)], custom: true };
}

/** What a switch row shows while a connection drives it (D7): True if any boolean that came in is
 *  True, else False, marked Custom. The row's own state is not here: the draft keeps it, and
 *  cutting the connection gives it back. Plan 731, 732 */
export function drivenSwitch(given: readonly boolean[]): Pick<GraphRow, 'value' | 'custom'> {
  return { value: given.some(Boolean), custom: true };
}

/** What is wrong with a value its row's control cannot say, in words, as the row draws them: a stranger
 *  in a closed list (`of` names whose values it lists), no date, a number off its step or under its least.
 *  None, it holds. A value of the wrong kind (text in a number row) is `workflowFaults`' own. TRAP T-a-row-says-its-own-fault */
export function rowFault(row: Pick<GraphRow, 'control' | 'closed' | 'choices' | 'min' | 'step'>, value: unknown, of = 'its list'): string | undefined {
  if (value == null || value === '') return undefined;
  if ((row.control === 'tags' || row.control === 'values') && row.closed) {
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
  /** Connections drive its picklist: it shows what comes in, each marked Custom, and its own pick waits. */
  custom?: true;
  /** A row of rows with nothing to say: Results, or a test's Pass and Fail, where only a value reaches its node (TODO 924). */
  idle?: true;
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
  /** Its kind's name, where it has a title of its own: drawn before that title. TRAP T-a-custom-title-follows-its-kind */
  kindHeading?: string;
  icon: string;
  description?: string;
  input?: SocketType;
  many?: true;
  output?: SocketType;
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
  /** A Source the Start's line reaches (Will, plan 949): its header shows an input for it, which takes no connection. The
   *  line is drawn, never kept. */
  started?: true;
  /** What comes in on its header that its type does not fit, by where from, and why: it is IGNORED there, its connector
   *  dashed; no warning, since another input fits (TODO 940 D2). */
  ignored?: { from: readonly string[]; words: string };
}

/** Nodes and connections, ready to draw: a workflow's, or a page's Query. */
export interface DrawnGraph {
  nodes: readonly GraphNode[];
  connections: readonly NodeConnection[];
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

/** What a node keeps of its drawn rows: each that holds a value, by its name. */
export const storedValues = (rows: readonly GraphRow[]): Record<string, unknown> =>
  Object.fromEntries(rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== '').map((r) => [r.name, r.value]));

/** The fields a node's rows carry, by its `every` field pick: those it keeps; none kept, every field (TODO 969). */
export function fieldsSent(rows: readonly Pick<RowKind, 'name' | 'control' | 'every'>[], values: Readonly<Record<string, unknown>> | undefined): readonly string[] | undefined {
  const row = rows.find((r) => r.every && r.control === 'field');
  const kept = row && values?.[row.name];
  return Array.isArray(kept) && kept.length ? kept.map(String) : undefined;
}

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
    ...(k.category ? { category: k.category } : {}),
    ...(k.would ? { would: k.would } : {}),
    ...own,
  };
}

/** A graph with each node at its kept place; one never moved stays where it was laid out. */
export function placed(graph: DrawnGraph, places: NodePlaces): DrawnGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (places[n.id] ? { ...n, x: places[n.id]!.x, y: places[n.id]!.y, ...(places[n.id]!.size ? { size: places[n.id]!.size } : {}) } : n)) };
}
