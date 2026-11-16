/**
 * agent-tools.ts — the tools an agent works an app with, carried out over its outlet's own doors: its pages and their
 * sources, its acts, its shelf. Each tool's words are said once (agent-tool-words.ts, which the MCP shares); an app adds
 * its own beside them. A read is QUIET: it never takes the reader from the page they are on. The utility layer, plan 1008
 * G1 (Will: D1, the utility layer; D2 A, the app keeps the Undo; D3 A, the MCP keeps its own tools).
 *
 * Map:
 * - AgentAnswer — one tool's answer: done, with its data; or refused, with why, in words
 * - AgentChange — one change a tool made, for the app's own Undo: its words, how it is undone, and where it is seen
 * - AgentToolOptions — what an app adds: its words, what it shows besides the page, its own panel, and how it asks the reader
 * - AgentTools — the tools, the one way to run them, and the rules an agent reads
 * - agentTools — the tools over an outlet
 */
import type { SherpaOutlet } from '../../components/sherpa-outlet/sherpa-outlet.js';
import type { SherpaProvider } from '../../components/sherpa-provider/sherpa-provider.js';
import type { SherpaRouter } from '../../components/sherpa-router/sherpa-router.js';
import { ContextRequestEvent, SOURCE_CONTEXT } from '../ui/context.js';
import { agentToolWords, type AgentTool } from '../data/agent-tool-words.js';
import type { PageDefinition } from '../data/page-definition.js';
import type { pageFields } from '../data/type-definition.js';
import type { DataSource } from '../data/data-source.js';
import type { EntityShelf } from '../data/entity-shelf.js';
import type { Row, Store } from '../data/store.js';
import type { Where } from '../data/where.js';
import type { QueryRequest } from '../data/query.js';
import type { SortDirection } from '../data/store.js';
import type { Act, ActAnswer, ActCall } from '../data/acts.js';
import type { Ask, FlowAnswers } from '../data/flows.js';
import { GRAPH_CHIP } from '../ui/shared-constants.js';

/** One tool's answer: done, with its data; or refused, with why, in words. */
export type AgentAnswer = { ok: true; data: unknown } | { ok: false; data: string };

/** One change a tool made, for the app's own Undo (D2 A): its words, how it is undone (why not, in words, where it cannot
 *  be), and where it is seen — its page, and its row where the router names its type. */
export interface AgentChange {
  readonly label: string;
  undo(): Promise<string | undefined>;
  readonly route: Readonly<Record<string, string>> | null;
}

/** What an app adds to its agent's tools. */
export interface AgentToolOptions {
  /** The app's own words for its agent, read before the graph's. */
  readonly rules?: string;
  /** What the reader sees besides the page, by the app (a tab of its own, say): added to on_screen. */
  onScreen?(): Readonly<Record<string, unknown>>;
  /** The agent's own panel: a press in it is not the reader's. */
  readonly own?: Element | null;
  /** Ask the reader to allow a change, in words: whether they did. Without it, no tool that changes data is offered. */
  ask?(words: string): Promise<boolean>;
  /** Ask the reader one step of a flow, where the app asks (its chat): the answer, or none where they stopped. Without it,
   *  `flow` is not offered. */
  step?(step: Ask): Promise<unknown>;
  /** Tell the reader something on the way: a flow's answer refused, and why. */
  say?(words: string): void;
  /** Each change a tool made, for the app's own Undo. */
  onChange?(change: AgentChange): void;
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
  /** The page on screen, for a tool that changes what it shows: with its source. */
  const shownPage = async (): Promise<(Page & { shown: DataSource }) | { why: string }> => {
    const now = await pageOf();
    return 'why' in now ? now : now.shown ? { ...now, shown: now.shown } : { why: 'The page is still opening. Try again.' };
  };
  /** The scope a field's filter goes in: the one that holds it, else the one that offers every field, else the first. */
  const scopeOf = (page: Page, field?: string): string => {
    const scopes = Object.entries(page.source.scopes ?? {});
    return (field ? scopes.find(([, s]) => s.holds?.includes(field)) : undefined)?.[0]
      ?? scopes.find(([, s]) => s.offers === 'all')?.[0] ?? scopes[0]?.[0] ?? 'data';
  };
  /** Wait for what the page draws, then say how many rows it shows, and its filters. */
  const shown = async (source: DataSource): Promise<AgentAnswer> => {
    const { settled } = await import('../ui/settled.js');
    await settled();
    return done({ total: source.total, filters: provider()?.export().query ?? null });
  };

  /** Where an act's change is seen: its page (the act's own, else the one its type's other acts name), and the one row it
   *  changed where the router has a param for its type; a graph type's entity in the View that shows its type's graphs. */
  const routeOf = async (act: Act, keys: readonly unknown[], answer: ActAnswer): Promise<Record<string, string> | null> => {
    const { actsOf } = await import('../data/acts.js');
    const made = 'result' in answer ? (answer.result as { id?: unknown } | undefined)?.id : undefined;
    const key = keys.length === 1 ? keys[0] : made;
    const context = act.where?.contexts?.[0] ?? actsOf().find((a) => a.type === act.type && a.where?.contexts?.length)?.where?.contexts?.[0];
    const params = document.querySelector<SherpaRouter>('sherpa-router')?.dataset['params']?.split(/\s+/) ?? [];
    const type = act.type;
    if (context) return { context, ...(key !== undefined && type && params.includes(type) ? { [type]: String(key) } : {}) };
    if (key === undefined || !type) return null;
    for (const c of outlet.contexts) {
      const view = Object.entries(outlet.viewsOf(c.id)).find(([, v]) => v.graph?.type === type)?.[0];
      if (view) return { context: c.id, view, [GRAPH_CHIP]: String(key) };
    }
    return null;
  };
  /** Keep one change for the app's Undo. */
  const told = (label: string, undo: () => Promise<string | undefined>, route: Record<string, string> | null): void => {
    options.onChange?.({ label, route, undo });
  };

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

    /* WHAT A PAGE SHOWS, changed only when the reader asks to see it: the page, its filters, its order. 1008c2 */
    async open_page({ context, view }) {
      await outlet.viewsReady;
      const at = context as string;
      if (!outlet.contexts.some((c) => c.id === at)) return fail(`No page is called ${at}. get_app lists them.`);
      const views = outlet.viewsOf(at);
      if (view && !(view as string in views)) return fail(`${at} has no View "${view as string}". Its Views: ${Object.keys(views).join(', ') || 'none'}.`);
      const router = document.querySelector<SherpaRouter>('sherpa-router');
      if (!router) return fail('This app has no router.');
      const arrived = outlet.context === at ? null : new Promise<void>((resolve) => {
        const heard = (e: Event): void => { if ((e as CustomEvent<{ context?: string }>).detail?.context === at) { outlet.removeEventListener('context-load', heard); resolve(); } };
        outlet.addEventListener('context-load', heard);
        setTimeout(resolve, 10_000);
      });
      // A page's own params go with it: the new page starts from its own.
      const cleared = Object.fromEntries(Object.keys(router.route).map((k) => [k, null]));
      await router.go({ ...cleared, context: at, view: !view || view === outlet.firstView(at) ? null : view as string });
      await arrived;
      const { settled } = await import('../ui/settled.js');
      await settled();
      return done({ context: outlet.context, view: outlet.view });
    },

    async filter({ where, replace }) {
      const now = await shownPage();
      if ('why' in now) return fail(now.why);
      const refused = unknown(now, Object.keys(where as Where));
      if (refused) return refused;
      const asks: QueryRequest[] = Object.entries(now.shown.readingsOf(where as Where)).map(([field, reading]) => ({ scope: scopeOf(now, field), field, reading, commit: true as const }));
      if (replace) asks.unshift(...Object.keys(now.source.scopes ?? {}).map((scope) => ({ scope, reset: {}, commit: true as const })));
      now.shown.query.ask(asks);
      return shown(now.shown);
    },

    async use_preset({ id, on = true }) {
      const now = await shownPage();
      if ('why' in now) return fail(now.why);
      // A page's preset and a Filter alike: each a preset of the scope whose bar it is on.
      const scope = Object.keys(now.source.scopes ?? {}).find((s) => now.shown.query.presets(s).some((p) => p.id === id));
      if (!scope) return fail(`This page has no preset or Filter ${id as string}. Call describe_page.`);
      now.shown.query.ask({ scope, preset: id as string, on: on as boolean, commit: true });
      return shown(now.shown);
    },

    async arrange({ sort, direction, group, search }) {
      const now = await shownPage();
      if ('why' in now) return fail(now.why);
      const refused = unknown(now, [sort, group].filter((f): f is string => typeof f === 'string'));
      if (refused) return refused;
      const scope = scopeOf(now);
      const asks: QueryRequest[] = [];
      if (sort !== undefined) asks.push(sort === null ? { scope, sort: null, clear: true } : { scope, sort: sort as string, direction: (direction ?? 'asc') as SortDirection });
      if (group !== undefined) asks.push({ scope, group: group as string | null });
      if (search !== undefined) asks.push({ scope, search: search as string });
      if (!asks.length) return fail('Name a sort, a group or a search.');
      now.shown.query.ask(asks);
      return shown(now.shown);
    },

    async clear_filters() {
      const now = await shownPage();
      if ('why' in now) return fail(now.why);
      now.shown.query.ask(Object.keys(now.source.scopes ?? {}).map((scope) => ({ scope, reset: { organise: true }, commit: true as const })));
      return shown(now.shown);
    },

    /* AN ACT, said once (plan 964): through the outlet's one door, as a press is, so the page draws it; a change asked of
       the reader first, and told to the app for its Undo. 1008c3 */
    async act({ id, keys = [], input, calls }) {
      const { actsOf } = await import('../data/acts.js');
      const act = actsOf().find((a) => a.id === id);
      if (!act) return fail(`No act has the id ${id as string}. get_app lists the acts.`);
      const list: ActCall[] = (calls as ActCall[] | undefined)?.length
        ? (calls as ActCall[]).map((c) => ({ keys: c.keys ?? [], ...(c.input ? { input: c.input } : {}) }))
        : [{ keys: keys as unknown[], ...(input ? { input: input as NonNullable<ActCall['input']> } : {}) }];
      /** The rows or entities keys name, by their titles: an entity's label, else its row's title field in its type's store. */
      const titles = async (named: readonly unknown[]): Promise<string[]> => {
        const [{ entityTypes }, { storeOfType, titleOf }] = await Promise.all([import('../data/entity-types.js'), import('../data/type-definition.js')]);
        const type = act.type ? entityTypes()[act.type] : undefined;
        const store = act.type ? storeOfType(outlet.actContext()?.stores ?? {}, act.type) : undefined;
        const field = type ? titleOf(type) : undefined;
        const rows = store && field ? (await store.load({ filter: [store.key, 'in', named.map(String)] })).rows : [];
        return named.map((k) => shelf()?.get(String(k))?.label ?? String(rows.find((r) => String(r[store!.key]) === String(k))?.[field!] ?? k));
      };
      /** One call, in words: the rows it names and the input it gives. */
      const words = async (call: ActCall): Promise<string> => {
        const said = Object.entries(call.input ?? {}).filter(([k]) => k !== 'graph' && k !== 'settings')
          .map(([k, v]) => `${act.input?.[k]?.label ?? k} ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(', ');
        const keyed = call.keys ?? [];
        const named = !keyed.length ? '' : keyed.length > 3 ? ` ${keyed.length} rows` : ` ${(await titles(keyed)).map((t) => `"${t}"`).join(', ')}`;
        return `${act.label}${named}${said ? `: ${said}` : ''}`;
      };
      // What would be refused is said first, never asked: the reader is asked only what can run.
      for (const call of list) {
        const checked = await outlet.checkAct(act.id, call);
        if (checked.refused) return fail(checked.refused);
      }
      const asked = list.length === 1 ? `${await words(list[0]!)}?` : `${act.label}, ${list.length} times?\n${(await Promise.all(list.map(words))).join('\n')}`;
      if (act.changes && !(await options.ask?.(asked))) {
        return fail('The reader declined. Do not try this another way; ask the reader what they want.');
      }
      const answers: ActAnswer[] = [];
      for (const call of list) answers.push(await outlet.act(act.id, call));
      const ran = answers.filter((a): a is Extract<ActAnswer, { done: string }> => 'done' in a);
      const refused = answers.flatMap((a) => ('refused' in a ? [a.refused] : []));
      // One Undo for all of them, the last first, in the acts' own words.
      const undos = ran.map((a) => a.undo).filter((u): u is () => Promise<string | undefined> => !!u).reverse();
      if (undos.length) {
        const label = ran.length === 1 ? ran[0]!.done.replace(/\.$/, '') : `${act.label}, ${ran.length} times`;
        // Each undone, the last first; the first that cannot says why.
        const undoAll = async (): Promise<string | undefined> => {
          let why: string | undefined;
          for (const undo of undos) {
            const not = await undo();
            why ??= not;
          }
          return why;
        };
        told(label, undoAll, await routeOf(act, list.length === 1 ? list[0]!.keys ?? [] : [], ran.length === 1 ? ran[0]! : { done: '' }));
      }
      if (!ran.length) return fail(refused.join(' '));
      return done({
        done: ran.length === 1 ? ran[0]!.done : ran.map((a) => a.done),
        ...(ran.length === 1 && ran[0]!.result !== undefined ? { result: ran[0]!.result } : {}),
        ...(refused.length ? { refused } : {}),
      });
    },

    /* AN ACT AS ITS FLOW (plan 964 N4): each field it still needs asked of the reader where the app asks, a step at a time,
       then its confirm, then the act through the outlet's door. What the reader already said is given as `input`. */
    async flow({ act: id, keys = [], input = {} }) {
      const [{ actsOf }, { answerStep, flowOf, nextStep }] = await Promise.all([import('../data/acts.js'), import('../data/flows.js')]);
      const act = actsOf().find((a) => a.id === id);
      const flow = act ? flowOf(act.id) : undefined;
      const ctx = outlet.actContext();
      if (!act || !flow || !ctx) return fail(`No act has the id ${id as string}. get_app lists the acts.`);
      const named = keys as unknown[];
      let answers: FlowAnswers = {};
      for (const [field, value] of Object.entries(input as Record<string, unknown>)) {
        const given = await answerStep(flow, answers, field, value, ctx);
        if ('answers' in given) answers = given.answers;
        else options.say?.(given.refused);
      }
      for (let turn = 0; turn < 40; turn += 1) {
        const next = await nextStep(flow, answers, { ...ctx, keys: named });
        if ('refused' in next) return fail(next.refused);
        if ('step' in next) {
          const value = await options.step?.(next.step);
          if (value === undefined) return fail('The reader stopped it. Ask them what they want.');
          const given = await answerStep(flow, answers, next.step.field, value, ctx);
          if ('answers' in given) answers = given.answers;
          else options.say?.(given.refused);
          continue;
        }
        const call: ActCall = { keys: named, input: 'confirm' in next ? next.input : next.run };
        const checked = await outlet.checkAct(act.id, call);
        if (checked.refused) return fail(checked.refused);
        if ('confirm' in next && !(await options.ask?.(next.confirm))) return fail('The reader declined. Do not try this another way; ask the reader what they want.');
        const answer = await outlet.act(act.id, call);
        if ('refused' in answer) return fail(answer.refused);
        if (answer.undo) told(answer.done.replace(/\.$/, ''), answer.undo, await routeOf(act, named, answer));
        return done({ done: answer.done, ...(answer.result !== undefined ? { result: answer.result } : {}) });
      }
      return fail('The flow asked too many steps.');
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

  // A tool that changes data only where the app asks the reader; a flow only where it asks its steps too.
  const offered = (t: AgentTool): boolean => t.name in handlers && (!t.changes || !!options.ask) && (t.name !== 'flow' || !!options.step);
  const tools = (): AgentTool[] => agentToolWords(outlet.contexts.map((c) => c.id)).filter(offered);
  return {
    get tools() {
      return tools();
    },
    async run(name, input = {}) {
      const handler = handlers[name];
      return handler && tools().some((t) => t.name === name) ? handler({ ...input }) : fail(`No tool is called ${name}.`);
    },
    async rules() {
      const { graphRules, nodeKinds } = await import('../data/node-kinds.js');
      return [options.rules, graphRules(nodeKinds())].filter(Boolean).join('\n');
    },
    stop: () => stopping.abort(),
  };
}
