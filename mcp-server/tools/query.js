/**
 * query.js — the query tier's tools: a page's Query run; any definition drawn as a graph and edited, through its lens.
 * An act is a `QueryRequest` through `ask()`, the one a chip sends, and a problem
 * is the data layer's own report. TRAP T-one-command-one-door
 *
 *   query_source      a page definition over rows or a localhost data path, each command asked: rows, total, groups, field state
 *   definition_graph       a definition as a graph, through its type's lens: a page's Query, or an entity
 *   edit_definition_graph  edits on that graph, written back through the lens: the definition now, or its faults
 *
 * Map:
 * - register — register the query tools on an MCP server
 */
import { z } from 'zod/v3';
import { imported } from '../lib/sherpa.js';
import { traced } from '../lib/trace.js';
import { answer, refuse } from '../lib/reply.js';
import { typeProblems, withEntities } from '../lib/check.js';
import { typedStore } from '../lib/describe.js';

/** Hosts a data path may name: this machine, never another. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const SHOWN = 25;

/** A JSON argument, given as JSON or as its text. */
function given(value, what) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${what} is not JSON: ${error.message}`);
  }
}

/** A list argument: each item of it. */
function listOf(value, what) {
  const list = given(value ?? [], what);
  if (!Array.isArray(list)) throw new Error(`${what} is a list: [ … ].`);
  return list;
}

/** A list argument of objects. */
function objects(value, what) {
  const list = listOf(value, what);
  if (list.some((one) => !one || typeof one !== 'object')) throw new Error(`Each of ${what} is an object: { … }.`);
  return list;
}

let turn = Promise.resolve();
/** One act, with every report the data layer says during it. One at a time: `onReport` is one sink for the process. */
function hear(dl, act) {
  const run = turn.then(async () => {
    const reports = [];
    const undo = dl.onReport((r) => reports.push(r));
    try {
      return { value: await act(reports), reports };
    } catch (error) {
      return { error, reports };
    } finally {
      undo();
    }
  });
  turn = run;
  return run;
}

/** A report as a line: its code, its words. */
const said = (r) => `- \`${r.code}\` ${r.message}`;

/** A tool over the data layer: its act, heard; a refusal carries what was heard. */
const act = (run) => async (args) => {
  let dl;
  try {
    dl = await imported('sherpa-ui/data');
  } catch (error) {
    return refuse(error.message);
  }
  const { value, error, reports } = await hear(dl, (heard) => run(dl, args, heard));
  if (error) return refuse([error.message, ...(reports.length ? ['', 'The data layer said:', ...reports.map(said)] : [])].join('\n'));
  return value;
};

/** Words, then the JSON. */
const shown = (lines, data) => answer([...lines, '', '```json', JSON.stringify(data, null, 2), '```'].join('\n'));

/** The page's store: the rows given, made from their type when one is given, or the app's data path on this machine. */
async function storeOf(dl, source, { rows, data, key, type: givenType }) {
  if (data === undefined) {
    const type = givenType == null ? undefined : given(givenType, 'type');
    const wrong = type ? typeProblems(dl, type) : [];
    if (wrong.length) throw new Error(`The type is not one (type.v1):\n${wrong.map((w) => `- ${w}`).join('\n')}`);
    return typedStore(dl, listOf(rows, 'rows'), { key, type });
  }
  if (rows !== undefined || givenType !== undefined) throw new Error('Give `rows` (and their `type`) or `data`, not both.');
  let url;
  try {
    url = new URL(data);
  } catch {
    throw new Error(`data is no URL: "${data}".`);
  }
  if (!/^https?:$/.test(url.protocol) || !LOOPBACK.has(url.hostname)) {
    throw new Error(`data must be on this machine — http://localhost:<port>/ — and "${data}" is not, so nothing was asked of it.`);
  }
  const base = url.pathname === '/' ? dl.DATA_BASE : url.pathname.replace(/\/?$/, '/');
  try {
    // A redirect could leave this machine.
    return await dl.openRequestStore({ name: source.store, base, origin: url.origin, send: (request) => fetch(request, { redirect: 'error' }) });
  } catch (error) {
    throw new Error(`The store "${source.store}" at ${url.origin}${base} could not be opened: ${error.message}`);
  }
}

/** Where the Query and its page stand, to tell an act that moved nothing. */
const mark = (source) => JSON.stringify([source.query.applied, source.query.draft, source.state.page, source.state.pageSize]);

/** Ask one command as a chip asks it, and wait for the rows it brings. */
async function ask(source, request, heard) {
  const from = heard.length;
  const before = mark(source);
  // Heard, for watch_trace.
  await traced({ asked: request }, source, async () => {
    source.query.ask(request);
    await source.load();
  });
  return {
    asked: request,
    ...(mark(source) === before ? { changed: false } : {}),
    total: source.total,
    ...(heard.length > from ? { reports: heard.slice(from) } : {}),
  };
}

/** A page opened as its provider opens it — checked, then its source — and each command asked. */
async function opened(dl, args, heard) {
  const definition = given(args.definition, 'definition');
  dl.checkPage(definition);
  if (definition?.v !== 1) throw new Error('The definition is not a page definition: { "v": 1, "id", "source" }.');
  if (!definition.source) throw new Error(`The page "${definition.id}" has no source, so it has no Query to ask.`);
  const store = await storeOf(dl, definition.source, args);
  let source;
  const close = () => {
    source?.close();
    store.close?.();
  };
  try {
    source = await dl.openSource(definition.source, store);
    await traced({ open: definition.id }, source, () => source.load());
    const asked = [];
    for (const request of listOf(args.commands, 'commands')) asked.push(await ask(source, request, heard));
    return { definition, store, source, asked, close };
  } catch (error) {
    close();
    throw error;
  }
}

/** Run an act over an opened page, and close it after. */
async function overPage(dl, args, heard, run) {
  const page = await opened(dl, args, heard);
  try {
    return await run(page);
  } finally {
    page.close();
  }
}

/** A field's type, as the page declares it: what types a value entered. */
const typeIn = (definition) => (field) => definition.source?.fields?.[field]?.type;

/** The facts the Node Editor draws a page's Query with. */
function graphFacts(dl, { definition, source }, components) {
  return {
    values: (field) => source.valuesFor(field).map((v) => dl.valueKey(v)),
    presets: (scope) => source.query.presets(scope),
    domains: source.store.domains ?? {},
    pageSize: source.state.pageSize ?? null,
    ...(components ? { components: listOf(components, 'components') } : {}),
    type: typeIn(definition),
  };
}

/** Each field a scope holds or answers: its status, as every control reads it — what is
 *  unset left out — and its chip's results. */
async function fieldsOf(dl, source) {
  const out = {};
  for (const [scope, s] of Object.entries(source.query.draft.scopes)) {
    const results = await source.results(scope);
    for (const field of new Set([...s.holds, ...Object.keys(s.readings)])) {
      if (out[field]) continue;
      const { home, on, reading, applied, above, presets, pending, failed } = source.fieldStatus(field, s.holds.includes(field) ? scope : dl.VIEW);
      out[field] = {
        home, on, reading,
        ...(JSON.stringify(applied) !== JSON.stringify(reading) ? { applied } : {}),
        ...(above ? { above } : {}), ...(presets.length ? { presets } : {}), ...(pending ? { pending } : {}), ...(failed ? { failed } : {}),
        ...(results[field] !== undefined ? { results: results[field] } : {}),
      };
    }
  }
  return out;
}

/** The input every page tool opens a page from. */
const PAGE = {
  definition: z.union([z.string(), z.record(z.unknown())]).describe('The page definition (page.v1), as its JSON: `{ "v": 1, "id", "source": { "store", "fields", "scopes" } }`'),
  rows: z.union([z.string(), z.array(z.record(z.unknown()))]).optional().describe('The rows its store holds, as a JSON list. Left out with `data` left out, it has none'),
  data: z.string().optional().describe('In place of rows: the app\'s data path on this machine, e.g. `http://localhost:4200/` (its /sherpa/data/) or `http://localhost:4200/api/data/`; the store asked is the page\'s `source.store`. Any other host is refused'),
  key: z.string().optional().describe('With `rows`: the field each row is keyed by, e.g. id'),
  type: z.union([z.string(), z.record(z.unknown())]).optional().describe('With `rows`: their type (type.v1), as describe_data gives it — the store is made from it, as the app makes it, so the page knows each field\'s words and status fields'),
  commands: z.union([z.string(), z.array(z.unknown())]).optional().describe('Each a QueryRequest, asked in turn through `ask()`; a list inside one is one change'),
};

const COMMANDS = 'A command is a `QueryRequest`, as a chip asks it: `{ "scope": "data", "field": "status", "reading": { "picked": ["active"] } }` (ticks); `{ "scope": "data", "field": "seats", "reading": { "tree": { "op": "gt", "value": 5 }, "mode": "advanced" } }` (a condition); `{ "field": "status", "reading": null }` (none); `{ "scope": "data", "sort": "seats", "direction": "desc" }`, `{ "group": "plan" }`, `{ "search": "acme" }`, `{ "page": 2 }`, `{ "scope": "data", "preset": "high-risk", "on": true }`, `{ "scope": "data", "suspended": true }` (its Switch), `{ "scope": "data", "hold": ["status"] }`, `{ "commit": true }` (Apply). Left out, `scope` is the View. The whole union is `QueryRequest` in sherpa-ui\'s src/core/data/query.ts.';

export function register(server) {
  server.registerTool('query_source', {
    title: 'Run a page\'s Query',
    description: `Open a page as its provider does — \`checkPage\`, then \`openSource\` over the rows given, or over the app's data path on this machine — ask each command through \`ask()\`, and give what its components are given: the page of rows, the total before paging, the groups, each held field's state and its chip's results, the Query applied, and the data layer's own reports — every one, and each under the command that raised it; a command that moved neither the Query nor its page says \`"changed": false\`. ${COMMANDS}`,
    inputSchema: {
      ...PAGE,
      limit: z.number().int().min(0).max(500).optional().describe(`The most rows of the page to show; default ${SHOWN}`),
    },
  }, act((dl, args, heard) => overPage(dl, args, heard, async ({ source, asked }) => {
    const { page, pageSize, sort, group, search, filter } = source.state;
    const rows = source.rows.slice(0, args.limit ?? SHOWN);
    const out = {
      total: source.total, page, pageSize, totalPages: source.totalPages,
      rows,
      ...(group ? { groups: source.groups() } : {}),
      arrangement: { sort, group, search },
      filter: filter ?? null,
      fields: await fieldsOf(dl, source),
      query: source.query.applied,
      ...(source.query.dirty() ? { draft: source.query.draft } : {}),
      asked,
      reports: heard,
    };
    const idle = asked.flatMap((a, i) => (a.changed === false ? [i + 1] : []));
    const lines = [
      `${source.total} row(s) match; page ${page} of ${source.totalPages}${pageSize ? `, ${pageSize} a page` : ''}; ${rows.length} of the page's ${source.rows.length} shown.`,
      `${asked.length} command(s) asked${idle.length ? `; the Query and its page did not move at ${idle.map((n) => `#${n}`).join(', ')}` : ''}.`,
    ];
    if (source.query.dirty()) lines.push('Edits wait for Apply: `{ "commit": true }` applies them.');
    if (heard.length) lines.push('', `The data layer said (${heard.length}):`, ...heard.map(said));
    return shown(lines, out);
  })));

  const FACTS = {
    fieldsOf: z.union([z.string(), z.record(z.unknown())]).optional().describe('Each store\'s fields, by the store\'s name — a page definition\'s `source.fields`, each with the `values` it may take: a Field row picks from those of the Source its rows come from'),
    stores: z.union([z.string(), z.array(z.string())]).optional().describe('The stores a Source\'s Store row picks, by the names the app gives them'),
    entities: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]).optional().describe('The app\'s entities file (entities.v3: `{ "v": 3, "types", "entities" }`, each type a type.v1 by its id) or a list of entities: each is a Custom Node a node may place by its use\'s kind, so a use of one is no fault (plan 942 D3 A)'),
  };
  const factsOf = (args) => ({
    ...(args.fieldsOf ? { fieldsOf: given(args.fieldsOf, 'fieldsOf') } : {}), ...(args.stores ? { stores: listOf(args.stores, 'stores') } : {}),
  });
  /** The kinds a workflow may place: the shipped, and each entity's Custom Node. */
  const kindsWith = (dl, library) => ({ ...dl.nodeKinds(), ...dl.kindsOf(library) });
  /** What a definition is: `query` for a page (page.v1), else the type an entity says. */
  const whatOf = (args, definition) => args.of ?? (definition?.source ? 'query' : definition?.type);
  /** The lens that draws it (plan 960 U4), or why there is none. */
  const lensFor = (dl, of) => {
    const lens = typeof of === 'string' ? dl.lensOf(of) : undefined;
    if (!lens) throw new Error(`No lens draws "${of ?? 'it'}": give a page (page.v1) for its Query, or an entity (entity.v2) of a type the app has, with its entities file for an app's types.`);
    return lens;
  };
  /**
   * A definition through its lens. A page's Query is opened over its rows, as query_source opens it; an entity is drawn
   * as its canvas edits it, over the app's entities. `then` is handed the lens, the facts it reads, the definition, the
   * graph drawn now, the kinds a graph may place, and the page where it is one.
   */
  const throughLens = async (dl, args, heard, list, library, then) => {
    const definition = given(args.definition, 'definition');
    const of = whatOf(args, definition);
    const lens = lensFor(dl, of);
    if (of === 'query') {
      return overPage(dl, args, heard, (page) => {
        const facts = { ...graphFacts(dl, page, args.components), query: page.source.query };
        return then({ lens, facts, definition: page.definition, drawn: () => dl.queryDrawn(page.definition, facts), kinds: dl.NODE_KINDS, page });
      });
    }
    const kinds = kindsWith(dl, library);
    // Its check reads the app's other entities, so a use of one is no fault.
    const facts = { kinds, ...factsOf(args), entities: list.filter((e) => e.id !== definition?.id) };
    const drawn = () => {
      const { workflow, kinds: own } = lens.toGraph(definition, facts);
      return dl.workflowGraph(workflow, factsOf(args), { ...kinds, ...own });
    };
    return then({ lens, facts, definition, drawn, kinds });
  };
  const DEFINITION = {
    ...PAGE,
    definition: z.union([z.string(), z.record(z.unknown())]).describe('The definition: a page (page.v1), for its Query, as `{ "v": 1, "id", "source" }`; or an entity (entity.v2): a workflow, a Custom Node, a Preset Filter, an app\'s own type'),
    of: z.string().optional().describe('What the definition is: `query`, a page\'s Query; else an entity\'s type. Left out, it is read from the definition: a page has a `source`, an entity says its `type`'),
    components: z.union([z.string(), z.array(z.record(z.unknown()))]).optional().describe('For a page: the components it binds, each `{ "id", "label", "scope"?, "kind"? }`, so each scope reaches its own'),
    ...FACTS,
  };

  server.registerTool('definition_graph', {
    title: 'Draw a definition as a graph',
    description: 'A definition as the one Node Editor draws it, through its type\'s lens (`lensOf(type).toGraph`, plan 960 U4): a page\'s Query, opened over its rows as query_source opens it, or an entity, as its canvas edits it. Each node its kind\'s header, sockets and rows with their values, choices and `editable`, at its place; the connections; every fault its check reports; the graph as the definition the editor edits; and the kinds a graph may place',
    inputSchema: DEFINITION,
  }, act(async (dl, args, heard) => withEntities(dl, given(args.entities, 'entities'), (list, library) => throughLens(dl, args, heard, list, library, ({ lens, facts, definition, drawn, kinds, page }) => {
    const shownNow = drawn();
    const faults = page ? dl.queryGraphFaults(shownNow, facts.domains ?? {}) : dl.entityFaults(definition, facts);
    const lines = [`${shownNow.nodes.length} nodes, ${shownNow.connections.length} connections; ${faults.length ? `${faults.length} fault(s)` : 'no fault'}. A row a reader may change is \`editable\`: edit_definition_graph changes it.`];
    if (faults.length) lines.push('', ...faults.map((f) => `- ${f}`));
    if (heard.length) lines.push('', `The data layer said (${heard.length}):`, ...heard.map(said));
    return shown(lines, { nodes: shownNow.nodes, connections: shownNow.connections, graph: lens.toGraph(definition, facts).workflow, kinds: page ? undefined : kinds, faults, reports: heard });
  }))));

  server.registerTool('edit_definition_graph', {
    title: 'Edit a definition by its graph',
    description: 'Each edit made on the graph a definition\'s lens draws (`editWorkflow`, as the one Node Editor makes it): a row\'s value, `{ "node", "row", "value" }`; a node\'s own name, line or place, `{ "node", "set": { … } }`; a new connection, `{ "connection": { "from", "to" } }`. Then the graph is written back through the lens (`fromGraph`): the definition it says now, checked, or the faults that refuse it, in words. A page\'s Query asks each change as a chip asks it, and its page is saved as the Query holds it then (`pageWithQuery`)',
    inputSchema: { ...DEFINITION, edits: z.union([z.string(), z.array(z.record(z.unknown()))]).describe('Each a WorkflowEdit, in turn') },
  }, act(async (dl, args, heard) => withEntities(dl, given(args.entities, 'entities'), (list, library) => throughLens(dl, args, heard, list, library, async ({ lens, facts, definition, kinds, page }) => {
    let graph = lens.toGraph(definition, facts).workflow;
    const all = { ...kinds, ...lens.toGraph(definition, facts).kinds };
    const edited = [];
    for (const edit of objects(args.edits, 'edits')) {
      if ('node' in edit && !graph.nodes.some((n) => n.id === edit.node)) {
        throw new Error(`The graph has no node "${edit.node}", so no edit was made. Its nodes: ${graph.nodes.map((n) => n.id).join(', ')}.`);
      }
      const next = dl.editWorkflow(graph, edit, all);
      edited.push({ edit, ...(JSON.stringify(next) === JSON.stringify(graph) ? { changed: false } : {}) });
      graph = next;
    }
    // A page's Query asks each change live: its rows load after, so the total says them.
    const answer = lens.fromGraph(definition, graph, facts);
    if (page) await page.source.load();
    const faults = 'faults' in answer ? answer.faults : [];
    const lines = [`${edited.length} edit(s); ${faults.length ? `refused: ${faults.length} fault(s)` : 'written back'}${page ? `; ${page.source.total} row(s) match` : ''}.`];
    if (faults.length) lines.push('', ...faults.map((f) => `- ${f}`));
    if (heard.length) lines.push('', `The data layer said (${heard.length}):`, ...heard.map(said));
    return shown(lines, { definition: 'definition' in answer ? answer.definition : undefined, faults, edited, ...(page ? { total: page.source.total, query: page.source.query.draft } : {}), reports: heard });
  }))));

}
