/**
 * query-graph.ts — a page's Query drawn as nodes, for the Node Editor, and each edit made in
 * them as the command it asks. DERIVED each time the Query changes: the store and its status
 * fields, the source, each scope with its presets, saved filters, conditions and superseded
 * answers, its arrangement, presentation and components — and which node each step of a load
 * lights. Kinds are the one registry's. DOM-free.
 * Will, TODO 555 · docs/history/plan-78-query-editor.md · TRAP T-the-node-editor-asks-the-query
 * TRAP T-a-step-names-its-node
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
 * - QueryGraphFacts — What drawing a Query needs that the Query does not say.
 * - editedCondition — A condition node's rows, edited, as the condition they say: the other half of drawing one.
 * - queryGraph — A page's Query as nodes and routes, laid out in columns by depth.
 * - graphRequest — The command a node's edit asks, as a chip's would; none for a row nothing takes.
 * - RouteAnswer — What a new route asks: a command, or why it is refused; null, nothing to do.
 * - routeRequest — The command a new route asks: a condition into a field of a scope, moved or retargeted.
 */
import { SAVED_PRESET, type PageDefinition } from './page-definition.js';
import { PRESENTATION_KINDS, VIEW, arrangementOf, arranging, isSavedFilter, type Presentation, type Query, type QueryRequest } from './query.js';
import { OP_LABELS, OPS_FOR_TYPE, groupOf, type Condition, type ConditionLeaf, type Duration, type FilterOp } from './store.js';
import { answerTree, typedValue, type FieldReading, type FieldType } from './filter-state.js';
import { readingsOf, treeReading } from './where.js';
import { presetHeld } from './query-edits.js';
import type { FieldDomain } from './validate.js';
import { NODE_KINDS, ROWS, kindNode, rowChoices, socketOf, type DrawnGraph, type GraphEdit, type GraphNode, type GraphRow, type NodeRoute } from './node-kinds.js';
import { traceStep, type Span, type TraceContext } from './trace.js';
import type { Walk } from './walk.js';

/** Each Query node's id, as a step names it: the one scheme the graph is drawn by.
 *  TRAP T-a-step-names-its-node */
export const QUERY_NODE = {
  store: 'store',
  source: 'source',
  scope: (scope: string): string => `scope-${scope}`,
  condition: (scope: string, field: string): string => `when-${scope}-${field}`,
  preset: (scope: string, preset: string): string => `preset-${scope}-${preset}`,
  arrange: (scope: string): string => `arrange-${scope}`,
  component: (id: string): string => `component-${id}`,
} as const;

/** The node an S3 span lights, by its step: a load is the Source's, the rest the Store's. */
const STEP_NODES: Readonly<Record<string, string>> = {
  load: QUERY_NODE.source, request: QUERY_NODE.store, answer: QUERY_NODE.store,
  hold: QUERY_NODE.store, recheck: QUERY_NODE.store, send: QUERY_NODE.store,
};

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
}

/**
 * Say what a load did after its read, each a step of its Query graph node, under
 * the load: each scope its walk counted, each condition and preset with its rows,
 * and the scope it arranged. Off, or in a scope whose filters are off, a step is
 * skipped: it narrows nothing. TRAP T-a-step-names-its-node
 */
export function traceQuerySteps(applied: Query, { walk, total }: LoadSteps, parent: TraceContext): void {
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

/** One column's width, in plane px: a node and the room for its routes. */
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
  /** The stores the app registered, for the Store row's list; absent, the page's own. */
  stores?: readonly string[];
}

/** The operators a field's condition may take: its type's, and a pick list's. */
const PICK_OPS: readonly FilterOp[] = ['in', 'notin', 'eq', 'ne'];

/** The scope's filter Switch: the kind's own row, before its presets and fields. */
const SWITCH = '#filters';

/** Where a node sends its data rows on: its Rows row. Plan 713 §3 */
const sent = (node: string): string => `${node}/${ROWS.name}`;

/** Why a row is read only: nothing outside the editor takes its change. */
const FROM_DEFINITION = 'The page definition sets it: Save writes the definition.';
const FROM_STORE = 'The app\'s store works it out: statusFields().';
const SAVED_WORDS = 'A saved filter: Manage Saved Filters changes it.';
const NOT_ADDED = 'Not on a bar: add it from the Saved menu, and it joins as a preset.';
const SUPERSEDED = 'The View holds this field: kept, not in force. It comes back when the View lets it go.';

/** The operators that pick several values; the ones that pick one. */
const MANY = new Set(['in', 'notin']);
const ONE = new Set(['eq', 'ne']);

/** A condition in words — `Status is one of active, trial` — for a row that only shows it. */
function said(tree: Condition, name?: (field: string) => string): string {
  const parts = groupOf(tree);
  if (parts) {
    const each = parts[1].filter((p) => !p.off).map((p) => (groupOf(p) ? `(${said(p, name)})` : said(p, name)));
    return each.join(parts[0] === 'and' ? ' and ' : ' or ');
  }
  const { field, op, value } = tree as ConditionLeaf;
  const span = value as Duration;
  const what = op === 'last' || op === 'next' ? `${span.n} ${span.unit}${span.n === 1 ? '' : 's'}`
    : Array.isArray(value) ? value.join(', ') : String(value);
  return [field && name ? name(field) : undefined, (OP_LABELS[op] ?? op).toLowerCase(), what].filter(Boolean).join(' ');
}

/** One condition's field, operator and value, as its rows show them — each editable, as
 *  a chip's are; a value the field's own values can say is PICKED, not typed. A group
 *  is read only. */
function conditionRows(
  field: string, condition: Condition, type: string | undefined,
  fields: readonly { value: string; label: string }[], values: readonly string[] | undefined,
): GraphRow[] {
  const list = groupOf(condition);
  const leaf = condition as ConditionLeaf;
  const op = list ? list[0] : leaf.op;
  const raw = list ? `${list[1].length} conditions`
    : op === 'last' || op === 'next' ? `${String((leaf.value as Duration).n)} ${(leaf.value as Duration).unit}`
    : leaf.value;
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
      : { ...row, control: 'values', multiple: true, editable: true, choices: picks }));
  }
  return rowsOf('condition', { field, op, value: value ?? '' }).map((row): GraphRow => {
    if (!plain) return row;
    if (row.name === 'field') return { ...row, editable: true, choices: fields };
    if (row.name === 'op') return { ...row, editable: true, choices: ops.map((o) => ({ value: o, label: OP_LABELS[o] })) };
    return { ...row, editable: true };
  });
}

/** A condition node's rows, edited, as the condition they say: the other half of drawing one.
 *  A value is typed text, or the values picked — each whole, a comma and all; only a
 *  TYPED list is split at its commas. Each is typed by its field. TRAP T-a-value-is-typed-once */
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

/** A row of the Query the definition owns: its list, read only, and no socket — no route reaches it. */
function owned(row: GraphRow, list: readonly { value: string; label: string }[] | undefined): GraphRow {
  const { input: _in, output: _out, ...rest } = row;
  return { ...rest, hint: FROM_DEFINITION, ...(list ? { choices: list } : {}) };
}

/** A kind's fixed rows, each with its value. */
function rowsOf(kind: string, values: Readonly<Record<string, unknown>>): GraphRow[] {
  return NODE_KINDS[kind]!.rows.map((row) => ({ ...row, value: values[row.name] }));
}

/** A page's Query as nodes and routes, laid out in columns by depth. */
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
  const routes: NodeRoute[] = [];
  const add = (column: number, id: string, kind: string, rows: GraphRow[], own: Partial<GraphNode> = {}): string => {
    nodes.push({ ...kindNode(NODE_KINDS, kind, id, rows, own), column });
    return id;
  };
  // A scope's presets: as declared now, else as its definition says them.
  const presetsOf = (scope: string): readonly ScopePreset[] => facts.presets?.(scope)
    ?? (definition.source?.scopes?.[scope]?.presets ?? []).map((p) => ({ id: p.id, label: p.label, readings: readingsOf(p.where, typed) }));

  // Store ─▶ each status field it works out ─▶ Source: the rows go Rows row to header.
  const source = definition.source;
  add(0, QUERY_NODE.store, 'store', rowsOf('store', { store: source?.store }).map((row) => (row.name === ROWS.name ? row
    : owned(row, rowChoices({ ...row, value: source?.store }, { stores: facts.stores ?? [] })))), { heading: source?.store ?? 'Store' });
  const statuses = Object.entries(facts.domains ?? {}).filter(([, d]) => d.when || d.statuses);
  for (const [field, domain] of statuses) {
    const rows = (domain.values ?? []).map(String).map((value): GraphRow => {
      const when = domain.when?.[value];
      return { name: value, label: value, value: when ? said(when, label) : 'every row the values before it left', hint: FROM_STORE };
    });
    routes.push({ from: sent(QUERY_NODE.store), to: add(1, `status-${field}`, 'status', [...rowsOf('status', {}), ...rows], { heading: label(field), ref: { field } }) });
  }
  // Its page size changes live; the rest is the definition's, until Save.
  add(2, QUERY_NODE.source, 'source', rowsOf('source', {
    pageSize: facts.pageSize ?? source?.pageSize, search: source?.search ?? [], applyOn: source?.applyOn ?? 'change',
  }).map((row) => (row.name === 'pageSize' ? { ...row, editable: true } : row.name === ROWS.name ? row
    : owned(row, row.name === 'search' ? known.map((f) => ({ value: f, label: label(f) })) : rowChoices(row)))));
  if (statuses.length) for (const [field] of statuses) routes.push({ from: sent(`status-${field}`), to: QUERY_NODE.source });
  else routes.push({ from: sent(QUERY_NODE.store), to: QUERY_NODE.source });

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
    routes.push({ from: sent(top || !view ? QUERY_NODE.source : QUERY_NODE.scope(VIEW)), to: node });
    // Each preset, and each saved filter on its bar: on or off, and what it writes.
    for (const p of presets) {
      const saved = p.id.startsWith(SAVED_PRESET);
      if (saved) onBars.add(p.id.slice(SAVED_PRESET.length));
      const writes = Object.entries(p.readings).flatMap(([f, reading]): GraphRow[] => {
        const tree = answerTree(reading, typed(f));
        return tree ? [{ name: f, label: label(f), value: said(tree), hint: saved ? SAVED_WORDS : FROM_DEFINITION }] : [];
      });
      const on = presetHeld(query, id, p.id, p.readings);
      const from = add(into, QUERY_NODE.preset(id, p.id), saved ? 'saved' : 'preset', [
        ...rowsOf(saved ? 'saved' : 'preset', { on }).map((row) => ({ ...row, editable: true })), ...writes,
      ], { heading: p.label, ref: { scope: id, preset: p.id } });
      routes.push({ from, to: `${node}/@${p.id}` });
    }
    const held = fields.map((f) => ({ value: f, label: label(f) }));
    for (const [field, condition, off] of where) {
      const when = add(into, QUERY_NODE.condition(id, field), 'condition', conditionRows(field, condition, typeOf(field), held, facts.values?.(field)), {
        heading: label(field),
        description: off ? 'Off: kept, not applied.' : 'Applied.',
        ref: { scope: id, field },
      });
      routes.push({ from: when, to: `${node}/${field}` });
    }
    // Its own answers the View holds over it: kept, not in force.
    for (const [field, condition] of kept) {
      const rows = conditionRows(field, condition, typeOf(field), held, facts.values?.(field)).map((row) => ({ ...row, editable: false, hint: SUPERSEDED }));
      const from = add(into, `kept-${id}-${field}`, 'condition', rows, {
        heading: label(field), description: 'Superseded: kept, not in force.', ref: { scope: id, field, superseded: 'true' },
      });
      routes.push({ from, to: `${node}/${field}` });
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
      routes.push({ from: sent(node), to: out });
    }
    // Each component its own Presentation: its SLOT's — its card's scope, kept in the
    // Query — and changed as Show as, Group and Sort change it. On the View it has no slot.
    for (const c of shows) {
      const slot = !top && (c.id === id || shows.length === 1);
      const presented = slot ? scope.presentation : undefined;
      let to = out;
      if (presented || c.kind) {
        to = add(8, `show-${c.id}`, 'presentation', presentationRows(presented ?? {}, c.kind, keys, slot), slot ? { ref: { scope: id } } : {});
        routes.push({ from: sent(out), to });
      }
      routes.push({ from: sent(to), to: add(9, QUERY_NODE.component(c.id), 'component', [], { heading: c.label, ref: { component: c.id, scope: id } }) });
    }
    // A slot's presentation with no component named to show it is still drawn.
    if (scope.presentation && !shows.length) {
      routes.push({ from: sent(out), to: add(8, `show-${id}`, 'presentation', presentationRows(scope.presentation, undefined, keys, !top), { ref: { scope: id } }) });
    }
  }
  // The page's own saved filters on no bar: what each would add, and no route.
  for (const [id, set] of Object.entries(definition.savedFilters ?? {})) {
    if (!isSavedFilter(set) || onBars.has(id)) continue;
    const writes = Object.entries(set.query.scopes).flatMap(([scope, s]) => Object.entries(readingsOf(s.where ?? {}, typed)).flatMap(([f, reading]): GraphRow[] => {
      const tree = answerTree(reading, typed(f));
      return tree ? [{ name: `${scope}:${f}`, label: scope === VIEW ? label(f) : `${label(f)} (${scope})`, value: said(tree), hint: SAVED_WORDS }] : [];
    }));
    add(3, `saved-${id}`, 'saved', [...rowsOf('saved', { on: false }).map((row) => ({ ...row, hint: NOT_ADDED })), ...writes], {
      heading: set.label, ref: { saved: id },
    });
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
  return { nodes: laid, routes };
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
  if (node.kind === 'condition') {
    const field = node.ref?.['field'] ?? '';
    const to = String(row.name === 'field' ? value : field);
    const op = String(row.name === 'op' ? value : was['op']);
    let given = row.name === 'value' ? value : was['value'];
    // One value where one is asked; a list where several are.
    if (ONE.has(op) && Array.isArray(given)) given = given[0] ?? '';
    const type = facts.type?.(to);
    const reading = treeReading(editedCondition(op, given as string | string[] ?? '', type), type as FieldType | undefined);
    // Another field: the condition MOVES there, as one change.
    return to === field ? { scope, field, reading } : [{ scope, field, reading: null }, { scope, field: to, reading }];
  }
  if (node.kind === 'arrange') {
    const pick = (name: string): string => String(row.name === name ? value : was[name] ?? '');
    if (row.name === 'group') return { scope, group: pick('group') || null };
    if (row.name === 'search') return { scope, search: pick('search') };
    return { scope, sort: pick('sort') || null, direction: pick('direction') === 'desc' ? 'desc' : 'asc' };
  }
  if (node.kind === 'presentation') return { scope, presentation: { [row.name]: value ? String(value) : undefined } };
  return undefined;
}

/** What a new route asks: a command, or why it is refused; null, nothing to do. */
export type RouteAnswer = { request: QueryRequest } | { refused: string } | null;

/**
 * The command a new route asks. The Query takes a condition into a field of a scope:
 * the same field in another scope MOVES it there; another field takes it, keeping the
 * values that field has. Anything else, or a move that would then say nothing, is refused.
 */
export function routeRequest(graph: DrawnGraph, { from, to }: NodeRoute, facts: Pick<QueryGraphFacts, 'type' | 'values'> = {}): RouteAnswer {
  const was = graph.nodes.find((n) => n.id === socketOf(from).node);
  const { node: into, row: field = '' } = socketOf(to);
  const target = graph.nodes.find((n) => n.id === into);
  const scope = was?.ref?.['scope'];
  const old = was?.ref?.['field'];
  const there = target?.ref?.['scope'];
  // A condition's True: its header. Its False says nothing a scope's field takes.
  if (was?.kind !== 'condition' || socketOf(from).row !== undefined || was.ref?.['superseded'] || target?.kind !== 'scope' || !field || field.startsWith('@') || !scope || !old || !there) {
    return { refused: `The Query has no route from "${was?.heading ?? from}" to "${target?.heading ?? to}": a condition's True goes into a field of a scope.` };
  }
  if (scope === there && old === field) return null;
  const rows = Object.fromEntries(was.rows.map((r) => [r.name, r.value]));
  let given = rows['value'] as string | string[];
  const known = facts.values?.(field);
  if (field !== old && known && Array.isArray(given)) given = given.filter((v) => known.includes(v));
  const type = facts.type?.(field);
  const reading = treeReading(editedCondition(String(rows['op']), given ?? '', type), type as FieldType | undefined);
  // It must still SAY something there: an empty pick filters nothing, so nothing moves.
  if (!answerTree(reading)) return { refused: `Nothing "${was.heading}" picks is a value of "${field}": tick its values there.` };
  return { request: [{ scope, field: old, reading: null }, { scope: there, field, reading }] };
}
