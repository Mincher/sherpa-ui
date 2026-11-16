/**
 * agent-tools.ts — the tools an agent works an app with, carried out over its outlet's own doors: its pages and their
 * sources, its acts, its shelf. Each tool's words are said once (agent-tool-words.ts, which the MCP shares); an app adds
 * its own beside them. A read is QUIET: it never takes the reader from the page they are on. The utility layer, plan 1008
 * G1 (Will: D1, the utility layer; D2 A, the app keeps the Undo; D3 A, the MCP keeps its own tools).
 *
 * Map:
 * - AgentAnswer — one tool's answer: done, with its data; or refused, with why, in words
 * - AgentToolOptions — what an app adds: its own words, what it shows besides the page, its agent's own panel
 * - AgentTools — the tools, the one way to run them, and the rules an agent reads
 * - agentTools — the tools over an outlet
 */
import type { SherpaOutlet } from '../../components/sherpa-outlet/sherpa-outlet.js';
import type { SherpaProvider } from '../../components/sherpa-provider/sherpa-provider.js';
import { ContextRequestEvent, SOURCE_CONTEXT } from '../ui/context.js';
import { agentToolWords, type AgentTool } from '../data/agent-tool-words.js';
import type { PageDefinition } from '../data/page-definition.js';
import type { pageFields } from '../data/type-definition.js';
import type { DataSource } from '../data/data-source.js';
import type { EntityShelf } from '../data/entity-shelf.js';
import type { Row, Store } from '../data/store.js';
import type { Where } from '../data/where.js';

/** One tool's answer: done, with its data; or refused, with why, in words. */
export type AgentAnswer = { ok: true; data: unknown } | { ok: false; data: string };

/** What an app adds to its agent's tools. */
export interface AgentToolOptions {
  /** The app's own words for its agent, read before the graph's. */
  readonly rules?: string;
  /** What the reader sees besides the page, by the app (a tab of its own, say): added to on_screen. */
  onScreen?(): Readonly<Record<string, unknown>>;
  /** The agent's own panel: a press in it is not the reader's. */
  readonly own?: Element | null;
}

/** The tools, the one way to run them, and the rules an agent reads. */
export interface AgentTools {
  readonly tools: readonly AgentTool[];
  run(name: string, input?: Readonly<Record<string, unknown>>): Promise<AgentAnswer>;
  /** The app's words, then the graph's (`graphRules`). */
  rules(): Promise<string>;
  /** Stop hearing the reader's presses. */
  stop(): void;
}

/** A page by its Context, read, not opened: its definition, its fields, its store, and its source where it is on screen. */
interface Page {
  context: string;
  label: string;
  page: PageDefinition;
  source: NonNullable<PageDefinition['source']>;
  fields: ReturnType<typeof pageFields>;
  store: Store;
  shown: DataSource | null;
}

const done = (data: unknown): AgentAnswer => ({ ok: true, data });
const fail = (data: string): AgentAnswer => ({ ok: false, data });

/** Up to `max` of a field's values, from the rows; many more say so. */
function valuesOf(rows: readonly Row[], field: string, max = 25): unknown[] | { some: unknown[]; many: true } {
  const seen = new Set<unknown>();
  for (const row of rows) {
    const v = row[field];
    for (const one of Array.isArray(v) ? v : [v]) if (one !== null && one !== undefined && one !== '') seen.add(one);
    if (seen.size > max) return { some: [...seen].slice(0, 5), many: true };
  }
  return [...seen];
}

/** Two values in order: numbers as numbers, the rest as text; none last. */
function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });
}

/** The tools over an outlet: what each says (`tools`), and `run`, which answers one call. */
export function agentTools(outlet: SherpaOutlet, options: AgentToolOptions = {}): AgentTools {
  const stopping = new AbortController();
  const shelf = (): EntityShelf | undefined => outlet.actContext()?.entities;
  const provider = (): SherpaProvider | null => outlet.closest<SherpaProvider>('sherpa-provider');

  // WHAT THE READER LAST PRESSED, by its words, outside the agent's own panel: so "this" and "here" can be read. Only its
  // words and where, never what they typed.
  let pressed: Record<string, string | null> | null = null;
  const wordsOf = (el: Element): string => (el.getAttribute('aria-label') ?? (el as HTMLElement).dataset['label'] ?? (el as HTMLElement).dataset['heading'] ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  document.addEventListener('click', (e) => {
    const path = e.composedPath().filter((n): n is Element => n instanceof Element);
    if (options.own && path.includes(options.own)) return;
    const hit = path.find((n) => /^(SHERPA-BUTTON|SHERPA-LIST-ITEM|SHERPA-NODE|SHERPA-TAB|BUTTON|A|TD|TR)$/.test(n.tagName) || n.getAttribute('role') === 'tab');
    if (!hit) return;
    const owner = path.find((n) => n.tagName.startsWith('SHERPA-') && n !== hit);
    pressed = { what: hit.tagName.toLowerCase(), words: wordsOf(hit), in: owner ? (owner.id || owner.tagName.toLowerCase()) : null, context: outlet.context, at: new Date().toISOString() };
  }, { capture: true, signal: stopping.signal });

  /** The source of the page on screen, as its provider answers a component inside it. */
  const sourceOf = (): DataSource | null => {
    let source: DataSource | null = null;
    outlet.dispatchEvent(new ContextRequestEvent(SOURCE_CONTEXT, outlet, (given) => { source = given as DataSource; }));
    return source;
  };

  /** A page by its Context, the one on screen when none is named, NOT opened; or why there is none. */
  const pageOf = async (asked?: string): Promise<Page | { why: string }> => {
    const [{ storeOf }, { pageFields, storeOfType }] = await Promise.all([import('../data/page-definition.js'), import('../data/type-definition.js')]);
    const here = outlet.context;
    const at = asked ?? here;
    const label = outlet.contexts.find((c) => c.id === at)?.label ?? at ?? '';
    const page = at ? await outlet.pageDefinition(at) : null;
    if (!at || !page?.source) return { why: `The ${label} page holds no records. get_app says which pages do.` };
    const shown = at === here ? sourceOf() : null;
    if (at === here && !shown) return { why: 'The page is still opening. Try again.' };
    const name = storeOf(page.source);
    const store = shown?.store ?? (name ? storeOfType(outlet.actContext()?.stores ?? {}, name) : undefined);
    if (!store) return { why: `This app reads no store ${name ?? ''}.` };
    return { context: at, label, page, source: page.source, fields: pageFields(page.source), store, shown };
  };

  /** The rows a page holds — on screen, what its filters match; else every record — narrowed by `where` in a source of
   *  their own, over a copy, that nothing draws. */
  const rowsOf = async ({ store, shown, fields }: Page, where?: Where): Promise<Row[]> => {
    const rows = shown ? [...await shown.allRows()] : [...(await store.load({})).rows];
    if (!where) return rows;
    const [{ openSource }, { ArrayStore }] = await Promise.all([import('../data/page-definition.js'), import('../data/stores.js')]);
    const quiet = await openSource({ fields, scopes: { data: { label: 'Agent', offers: 'all', holds: [] } } }, new ArrayStore(rows, { key: store.key }));
    try {
      await quiet.load();
      quiet.query.ask(Object.entries(quiet.readingsOf(where)).map(([field, reading]) => ({ scope: 'data', field, reading, commit: true })));
      await quiet.load();
      return [...await quiet.allRows()];
    } finally {
      quiet.close();
    }
  };

  const unknown = (page: Page, names: readonly string[]): AgentAnswer | null => {
    const missing = names.filter((name) => !(name in page.fields));
    return missing.length ? fail(`The ${page.label} page has no field ${missing.join(', ')}. Call describe_page.`) : null;
  };
  const viewsOf = (context: string): { id: string; label: string | undefined }[] => Object.entries(outlet.viewsOf(context)).map(([id, v]) => ({ id, label: v.label }));
  /** The graph a graph View shows, and the reader's unsaved draft of it. */
  const graphOnScreen = (): { graph?: Record<string, unknown> } => {
    const id = outlet.graph?.id;
    if (!id) return {};
    const draft = outlet.actContext()?.draftOf?.(id);
    return { graph: { id, label: shelf()?.get(id)?.label, ...(draft ? { unsavedInTheEditor: { nodes: draft.nodes?.length ?? 0, connections: draft.connections?.length ?? 0 } } : {}) } };
  };

  const handlers: Record<string, (input: Record<string, unknown>) => Promise<AgentAnswer>> = {
    async get_app() {
      await outlet.viewsReady;
      const { actSchema, actsOf } = await import('../data/acts.js');
      const ctx = outlet.actContext() ?? undefined;
      const acts = await Promise.all(actsOf().map(async (a) => ({
        id: a.id, label: a.label, description: a.description, type: a.type, changes: !!a.changes, many: !!a.many, where: a.where?.contexts ?? null, input: await actSchema(a, ctx),
      })));
      return done({
        contexts: outlet.contexts.map((c) => ({ ...c, views: viewsOf(c.id) })),
        now: { context: outlet.context, view: outlet.view, ...graphOnScreen() },
        acts,
      });
    },

    async on_screen() {
      const { actsOf } = await import('../data/acts.js');
      const context = outlet.context;
      const source = sourceOf();
      const grid = outlet.querySelector<HTMLElement & { current?: Row | null; selectedKeys?: string[] }>('sherpa-data-grid');
      const row = grid?.current;
      const key = source?.store.key;
      const open = [...document.querySelectorAll<HTMLElement & { open?: boolean }>('sherpa-overlay-panel, sherpa-dialog')]
        .filter((p) => p.open && p !== options.own && !options.own?.contains(p)).map((p) => ({ id: p.id || null, heading: p.dataset['heading'] ?? null }));
      const picked = outlet.graph ? [...outlet.querySelectorAll<HTMLElement>('sherpa-node[data-current]')].map((n) => ({ kind: n.dataset['kind'] ?? null, heading: n.dataset['heading'] ?? null })) : [];
      return done({
        context, label: outlet.contexts.find((c) => c.id === context)?.label ?? null, view: outlet.view,
        ...(source ? { filters: provider()?.export().query ?? null, rows: source.rows.length } : {}),
        ...(row ? { currentRow: { key: key ? row[key] : null, name: row['name'] ?? row['label'] ?? null } } : {}),
        ...(grid?.selectedKeys?.length ? { selected: grid.selectedKeys.slice(0, 25) } : {}),
        ...graphOnScreen(),
        ...(picked.length ? { pickedNodes: picked } : {}),
        open,
        acts: actsOf(context ? { context } : {}).map((a) => a.id),
        ...(pressed ? { lastPressed: pressed } : {}),
        ...options.onScreen?.(),
      });
    },

    async describe_page({ context }) {
      const now = await pageOf(context as string | undefined);
      if ('why' in now) return fail(now.why);
      const [rows, { FILTER }, { storeOf }] = await Promise.all([rowsOf(now), import('../data/entity-types.js'), import('../data/page-definition.js')]);
      const scopes = now.source.scopes ?? {};
      return done({
        context: now.context, onScreen: !!now.shown, key: now.store.key, total: rows.length,
        ...(now.shown ? { view: outlet.view, filters: provider()?.export().query ?? null } : { note: 'Not on screen: its rows are every record its store holds.' }),
        fields: Object.entries(now.fields).map(([name, f]) => ({ name, label: f.label ?? name, ...(f.description ? { description: f.description } : {}), values: valuesOf(rows, name) })),
        scopes: Object.entries(scopes).map(([id, s]) => ({ id, label: s.label, holds: s.holds, presets: (s.presets ?? []).map((p) => ({ id: p.id, label: p.label, where: p.where })) })),
        // The Filters over its store, the app's and the reader's: each a chip of its own, off until turned on.
        filters: (shelf()?.list(FILTER) ?? []).map((e) => shelf()!.get(e.id)!).filter((f) => f?.settings?.['source'] === storeOf(now.source))
          .map((f) => ({ id: `filter:${f.id}`, label: f.label, where: f.query?.where ?? null, mine: f.origin === 'mine' })),
        views: viewsOf(now.context),
      });
    },

    async read_rows({ context, where, limit = 20, offset = 0, fields: only, sort, direction = 'asc' }) {
      const now = await pageOf(context as string | undefined);
      if ('why' in now) return fail(now.why);
      const named = [...Object.keys((where as Where | undefined) ?? {}), ...((only as string[] | undefined) ?? []), ...(sort ? [sort as string] : [])];
      const refused = unknown(now, named);
      if (refused) return refused;
      const rows = await rowsOf(now, where as Where | undefined);
      if (sort) rows.sort((a, b) => compare(a[sort as string], b[sort as string]) * (direction === 'desc' ? -1 : 1));
      const from = offset as number;
      const picked = rows.slice(from, from + (limit as number)).map((row) => (only ? Object.fromEntries((only as string[]).map((f) => [f, row[f]])) : row));
      return done({ context: now.context, matched: rows.length, offset: from, rows: picked });
    },

    async summarize({ context, where, by, sum = [], top = 25 }) {
      const now = await pageOf(context as string | undefined);
      if ('why' in now) return fail(now.why);
      const sums = sum as string[];
      const refused = unknown(now, [...Object.keys((where as Where | undefined) ?? {}), by as string, ...sums]);
      if (refused) return refused;
      const groups = new Map<unknown, { value: unknown; rows: number; sums: Record<string, number> }>();
      const rows = await rowsOf(now, where as Where | undefined);
      for (const row of rows) {
        const value = row[by as string];
        const group = groups.get(value) ?? groups.set(value, { value, rows: 0, sums: Object.fromEntries(sums.map((f) => [f, 0])) }).get(value)!;
        group.rows += 1;
        for (const f of sums) group.sums[f]! += Number(row[f]) || 0;
      }
      const largest = (g: { rows: number; sums: Record<string, number> }): number => (sums.length ? g.sums[sums[0]!]! : g.rows);
      return done({ context: now.context, matched: rows.length, groups: [...groups.values()].sort((a, b) => largest(b) - largest(a)).slice(0, top as number) });
    },

    async node_kinds({ kinds }) {
      const [{ nodeKinds }, { asNode }, { entityKind }] = await Promise.all([import('../data/node-kinds.js'), import('../data/entity-types.js'), import('../data/entity.js')]);
      const all = nodeKinds();
      // The Custom Nodes a graph may place: each entity the shelf offers as one, by its kind.
      const library = shelf()?.library().nodes ?? {};
      const custom = (shelf()?.list() ?? []).filter((e) => entityKind(e) in library).map((e) => {
        const entity = shelf()!.get(e.id)!;
        const node = asNode(entity);
        const said = (list: typeof node.inputs): { name: string; label: string | undefined; type: string | undefined }[] => (list ?? []).map(({ name, label, type }) => ({ name, label, type }));
        return { kind: entityKind(e), heading: e.label, description: entity.description, category: node.category, custom: { id: e.id, type: e.type, mine: e.origin === 'mine', inputs: said(node.inputs), outputs: said(node.outputs) } };
      });
      const asked = kinds as string[] | undefined;
      if (asked?.length) {
        return done(Object.fromEntries(asked.map((k) => [k, all[k] ?? custom.find((c) => c.kind === k) ?? 'no such kind'])));
      }
      return done([...Object.entries(all).map(([kind, k]) => ({ kind, heading: k.heading, description: k.description, types: Object.keys(k.types ?? {}) })), ...custom]);
    },
  };

  const tools = (): AgentTool[] => agentToolWords(outlet.contexts.map((c) => c.id)).filter((t) => t.name in handlers);
  return {
    get tools() {
      return tools();
    },
    async run(name, input = {}) {
      const handler = handlers[name];
      return handler ? handler({ ...input }) : fail(`No tool is called ${name}.`);
    },
    async rules() {
      const { graphRules, nodeKinds } = await import('../data/node-kinds.js');
      return [options.rules, graphRules(nodeKinds())].filter(Boolean).join('\n');
    },
    stop: () => stopping.abort(),
  };
}
