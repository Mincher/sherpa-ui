/**
 * query.js — the query tier's tools: a page's Query run, drawn and edited; a workflow's too.
 * An act is a `QueryRequest` through `ask()`, the one a chip sends, and a problem
 * is the data layer's own report. TRAP T-one-command-one-door
 *
 *   query_source      a page definition over rows or a localhost data path, each command asked: rows, total, groups, field state
 *   query_graph       a page's Query as nodes and connections, as the Node Editor draws it
 *   edit_query_graph  a node's edit or a new connection, as the command it asks: the new Query and its saved definition
 *   workflow_graph    a workflow as nodes and connections, its faults, and the kinds a workflow runs
 *   edit_workflow     a workflow after each edit, checked
 *
 * Map:
 * - register — register the query tools on an MCP server
 */
import { z } from 'zod/v3';
import { imported } from '../lib/sherpa.js';
import { traced } from '../lib/trace.js';
import { answer, refuse } from '../lib/reply.js';
import { withEntities } from '../lib/check.js';
import { typedStore, typeProblems } from '../lib/describe.js';

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

  server.registerTool('query_graph', {
    title: 'Draw a page\'s Query as nodes',
    description: `A page's Query as the Node Editor draws it (\`queryGraph\`): its store, status fields, source, each scope with its presets, saved filters and conditions, its arrangement, presentation and components — each node's id, kind, rows (a row's \`editable\`, \`choices\` and \`hint\`), sockets and place, and the connections between them, as JSON. Opened as query_source opens it, after each command, which it takes as query_source does. Edit it with edit_query_graph. Each kind is in \`sherpa://node-kinds\`.`,
    inputSchema: {
      ...PAGE,
      components: z.union([z.string(), z.array(z.record(z.unknown()))]).optional().describe('The components the page binds, each `{ "id", "label", "scope"?, "kind"? }`, so each scope reaches its own'),
    },
  }, act((dl, args, heard) => overPage(dl, args, heard, async (page) => {
    const graph = dl.queryGraph(page.source.query.draft, page.definition, graphFacts(dl, page, args.components));
    const lines = [`${graph.nodes.length} nodes, ${graph.connections.length} connections. A row a reader may change is \`editable\`; edit_query_graph asks its command.`];
    if (heard.length) lines.push('', `The data layer said (${heard.length}):`, ...heard.map(said));
    return shown(lines, { ...graph, asked: page.asked, reports: heard });
  })));

  server.registerTool('edit_query_graph', {
    title: 'Edit a page\'s Query by its nodes',
    description: 'Each edit as the Node Editor makes it: a row\'s new value, `{ "node": "when-view-region", "row": "b", "value": ["EMEA"] }`, asks its command (`graphRequest`); a new connection, `{ "from": "when-data-status", "to": "scope-view/status" }`, asks its move (`connectionRequest`). Each command goes through `ask()`, the graph drawn again before the next edit. It gives each command asked, the new Query, and the page definition Save would write (`pageWithQuery`), checked by `checkPage`. A node or row the graph has not got, a row no command takes and a connection the Query refuses are refused, in the data layer\'s words. Node ids are query_graph\'s.',
    inputSchema: {
      ...PAGE,
      components: z.union([z.string(), z.array(z.record(z.unknown()))]).optional().describe('The components the page binds, as query_graph takes them'),
      edits: z.union([z.string(), z.array(z.record(z.unknown()))]).describe('Each `{ "node", "row", "value" }` or `{ "from", "to" }`, in turn'),
    },
  }, act((dl, args, heard) => overPage(dl, args, heard, async (page) => {
    const { source, definition } = page;
    const type = typeIn(definition);
    const facts = graphFacts(dl, page, args.components);
    const edited = [];
    for (const edit of objects(args.edits, 'edits')) {
      const graph = dl.queryGraph(source.query.draft, definition, facts);
      let request;
      if ('from' in edit || 'to' in edit) {
        const connection = dl.connectionRequest(graph, { from: String(edit.from), to: String(edit.to) }, facts);
        if (connection && 'refused' in connection) throw new Error(connection.refused);
        if (!connection) {
          edited.push({ edit, asked: null });
          continue;
        }
        request = connection.request;
      } else {
        const node = graph.nodes.find((n) => n.id === edit.node);
        if (!node) throw new Error(`The Query graph has no node "${edit.node}". Its nodes: ${graph.nodes.map((n) => n.id).join(', ')}.`);
        const row = node.rows.find((r) => r.name === edit.row);
        if (!row) throw new Error(`The node "${node.id}" has no row "${edit.row}". Its rows: ${node.rows.map((r) => r.name).join(', ')}.`);
        request = dl.graphRequest({ node, row, value: edit.value }, { type });
        if (!request) throw new Error(`No command takes "${row.label}" on "${node.heading}"${row.hint ? `: ${row.hint}` : '.'}`);
      }
      const { asked: _, ...result } = await ask(source, request, heard);
      edited.push({ edit, asked: request, ...result });
    }
    const saved = dl.pageWithQuery(definition, source.query.draft, { pageSize: source.state.pageSize ?? null, type });
    const sound = dl.checkPage(saved);
    const lines = [`${edited.length} edit(s); ${source.total} row(s) match. The definition Save writes ${sound ? 'passes' : 'fails'} checkPage.`];
    if (heard.length) lines.push('', `The data layer said (${heard.length}):`, ...heard.map(said));
    return shown(lines, { edited, total: source.total, query: source.query.draft, definition: saved, reports: heard });
  })));

  const FACTS = {
    fieldsOf: z.union([z.string(), z.record(z.unknown())]).optional().describe('Each store\'s fields, by the store\'s name — a page definition\'s `source.fields`, each with the `values` it may take: a Field row picks from those of the Source its rows come from'),
    stores: z.union([z.string(), z.array(z.string())]).optional().describe('The stores a Source\'s Store row picks, by the names the app gives them'),
    entities: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]).optional().describe('The app\'s entities file (entities.v2: `{ "v": 2, "types", "entities" }`) or a list of entities: each is a Custom Node a node may place by its use\'s kind, so a use of one is no fault (plan 942 D3 A)'),
  };
  const factsOf = (args) => ({
    ...(args.fieldsOf ? { fieldsOf: given(args.fieldsOf, 'fieldsOf') } : {}), ...(args.stores ? { stores: listOf(args.stores, 'stores') } : {}),
  });
  /** The kinds a workflow may place: the shipped, and each entity's Custom Node. */
  const kindsWith = (dl, library) => ({ ...dl.nodeKinds(), ...dl.kindsOf(library) });
  /** A workflow, given: a v3; anything else is refused, in checkWorkflow's words. */
  const workflowOf = (dl, value) => {
    const workflow = given(value, 'workflow');
    if (!dl.readWorkflow(workflow).workflow) {
      dl.checkWorkflow(workflow);
      throw new Error('The workflow is not a workflow definition: { "v": 3, "id", "nodes", "connections" }.');
    }
    return workflow;
  };
  const workflowKinds = (dl) => Object.fromEntries(Object.entries(dl.NODE_KINDS).filter(([, k]) => k.graphs.includes('workflow')));

  server.registerTool('workflow_graph', {
    title: 'Draw a workflow as nodes',
    description: 'A workflow definition (workflow.v3) as nodes and connections (`workflowGraph`) — each node its kind\'s header, sockets and rows with their values and choices, at its own place — with every fault `checkWorkflow` reports (a node, a kind, a value or a connection that cannot be), and the kinds a workflow runs, from `NODE_KINDS`. Edit it with edit_workflow.',
    inputSchema: {
      workflow: z.union([z.string(), z.record(z.unknown())]).describe('The workflow definition, as its JSON: `{ "v": 3, "id", "nodes", "connections" }`'),
      ...FACTS,
    },
  }, act(async (dl, args, heard) => withEntities(dl, given(args.entities, 'entities'), (_entities, library) => {
    const workflow = workflowOf(dl, args.workflow);
    const kinds = kindsWith(dl, library);
    const sound = dl.checkWorkflow(workflow, kinds, factsOf(args));
    const graph = dl.workflowGraph(workflow, factsOf(args), kinds);
    const lines = [`${graph.nodes.length} nodes, ${graph.connections.length} connections; ${sound ? 'no fault' : `${heard.length} fault(s)`}.`];
    if (heard.length) lines.push('', 'The data layer said:', ...heard.map(said));
    return shown(lines, { ...graph, kinds: { ...workflowKinds(dl), ...dl.kindsOf(library) }, reports: heard });
  })));

  server.registerTool('edit_workflow', {
    title: 'Edit a workflow',
    description: 'A workflow after each edit (`editWorkflow`), checked by `checkWorkflow`: a v3. An edit is a row\'s value, `{ "node": "status", "row": "value", "value": "trial" }`; a node\'s own name, line or place, `{ "node": "filter", "set": { "heading": "Active only", "x": 400 } }`; a connection made into an input, in place of the one there (beside it, where the input takes `many`), `{ "connection": { "from": "status/value", "to": "filter/value" } }`; or connections cut, each by the input it enters, `{ "cut": "filter/value" }`, or one, `{ "cut": { "from", "to" } }`. A value is typed as its row takes it. An edit to a node the workflow has not got is refused.',
    inputSchema: {
      workflow: z.union([z.string(), z.record(z.unknown())]).describe('The workflow definition, as its JSON'),
      edits: z.union([z.string(), z.array(z.record(z.unknown()))]).describe('Each a WorkflowEdit, in turn'),
      entities: FACTS.entities,
    },
  }, act(async (dl, args, heard) => withEntities(dl, given(args.entities, 'entities'), (_entities, library) => {
    const kinds = kindsWith(dl, library);
    let workflow = workflowOf(dl, args.workflow);
    const edited = [];
    for (const edit of objects(args.edits, 'edits')) {
      if ('node' in edit && !workflow.nodes.some((n) => n.id === edit.node)) {
        throw new Error(`The workflow has no node "${edit.node}", so no edit was made. Its nodes: ${workflow.nodes.map((n) => n.id).join(', ')}.`);
      }
      const next = dl.editWorkflow(workflow, edit, kinds);
      edited.push({ edit, ...(JSON.stringify(next) === JSON.stringify(workflow) ? { changed: false } : {}) });
      workflow = next;
    }
    const sound = dl.checkWorkflow(workflow, kinds);
    const lines = [`${edited.length} edit(s); the workflow has ${sound ? 'no fault' : `${heard.length} fault(s)`}.`];
    if (heard.length) lines.push('', 'The data layer said:', ...heard.map(said));
    return shown(lines, { workflow, edited, reports: heard });
  })));
}
