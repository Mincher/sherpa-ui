/**
 * see.js — the see tier's tools: a page drawn, acted on and read, and its acts traced.
 * One preview at a time, on this machine only; the page runs the MCP's own code,
 * and a caller names an element, a method and JSON.
 * TRAP T-a-preview-is-this-machine-only
 *
 *   preview_page    a Context served over sample rows and drawn: a screenshot, the data layer's reports, the usage problems
 *   call_component  a method its spec lists, called on an element of the preview or a localhost page, and what it did
 *   read_component  an element of the preview or a localhost page: its attributes, states, properties and parts
 *   watch_trace     the spans of the last act, the MCP's own and the preview's, by Query graph node
 *   preview_close   the preview ended: its page, its browser and its server
 *   review_page     validate_page → check_usage → preview_page's reports: skills/review-page/SKILL.md
 *   explain_page    definition_graph → a query_source act → watch_trace: skills/explain-page/SKILL.md
 *
 * Map:
 * - register — register the see tools and prompts on an MCP server
 */
import path from 'node:path';
import { z } from 'zod/v3';
import { appFile, imported, load, spec } from '../lib/sherpa.js';
import { usageOwn } from '../lib/check.js';
import { atElement, begin, closePreview, elementAt, lastAct, openPreview, pageAt, settle, shot } from '../lib/preview.js';
import { byNode, lastCall } from '../lib/trace.js';
import { refuse } from '../lib/reply.js';
import { prompted } from '../lib/skills.js';

/** A JSON argument, given as JSON or as its text. */
function given(value, what) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`\`${what}\` is not JSON: ${error.message}`);
  }
}

/** A list argument: each item of it. */
function listOf(value, what) {
  const list = given(value ?? [], what);
  if (!Array.isArray(list)) throw new Error(`\`${what}\` is a JSON list: [ … ].`);
  return list;
}

/** A JSON file given as text or as its value: its text, and its value. */
function fileOf(value, what) {
  if (value == null) return { text: undefined, value: undefined };
  return typeof value === 'string' ? { text: value, value: given(value, what) } : { text: JSON.stringify(value), value };
}

let turn = Promise.resolve();
/** A tool's work, one at a time — a preview is one page — and what it cannot do said as a refusal. */
const tool = (run) => (args) => {
  const next = turn.then(() => run(args)).catch((error) => refuse(error.message));
  turn = next;
  return next;
};

/** Words, then the JSON, then any image. */
function shown(lines, data, png) {
  return {
    content: [
      { type: 'text', text: [...lines, '', '```json', JSON.stringify(data, null, 2), '```'].join('\n') },
      ...(png ? [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }] : []),
    ],
  };
}

/** A list under a heading: each item, or the word for none. */
const listed = (heading, items, none = 'None.') => ['', `### ${heading} (${items.length})`, '', ...(items.length ? items.map((i) => `- ${i}`) : [none])];

/** A Context's files, as preview_page takes them: from an app on disk, or given. */
function contextFiles(args) {
  if (args.path !== undefined || args.context !== undefined) {
    if (args.definition != null || args.template != null || args.views != null) throw new Error('Give an app\'s `path` and `context`, or the files, not both.');
    const target = args.path ?? '.';
    const [folder, file] = /\.json$/i.test(target) ? [path.dirname(target), path.basename(target)] : [target, 'app.json'];
    const text = appFile(folder, file);
    if (text == null) throw new Error(`There is no ${file} in ${path.resolve(folder)}. Give the path of an app.json, or of the folder that holds it.`);
    const app = given(text, file);
    const name = args.context ?? app.default;
    const ctx = app.contexts?.[name];
    if (!ctx) throw new Error(`${file} has no Context "${name}". Its Contexts: ${Object.keys(app.contexts ?? {}).join(', ') || 'none'}.`);
    const read = (key) => {
      if (typeof ctx[key] !== 'string') return undefined;
      const got = appFile(folder, ctx[key]);
      if (got == null) throw new Error(`contexts.${name}.${key} names "${ctx[key]}", which is not in the app's folder.`);
      return got;
    };
    // A View's file is beside its Views, anywhere in the app's folder.
    const beside = typeof ctx.views === 'string' ? path.posix.dirname(ctx.views) : '.';
    return {
      name, label: ctx.label ?? name, chrome: ctx.chrome, template: read('template'), definition: fileOf(read('definition'), ctx.definition),
      views: fileOf(read('views'), ctx.views), viewFile: (rel) => appFile(folder, path.posix.join(beside, rel)), own: usageOwn(folder),
    };
  }
  const definition = fileOf(args.definition, 'definition');
  const id = definition.value?.id;
  const name = typeof id === 'string' && /^[A-Za-z0-9][\w-]*$/.test(id) ? id : 'preview';
  return {
    name, label: name, template: args.template, definition, views: fileOf(args.views, 'views'),
    viewFile: (rel) => (args.folder ? appFile(args.folder, rel) : undefined), own: given(args.own ?? {}, 'own'),
  };
}

/** Each file the Views name, `file.html#id`: its text; null when it is not there, undefined when there is no folder to read it in. */
function viewFilesOf(views, viewFile) {
  const files = new Set(Object.entries(views ?? {})
    .filter(([id, v]) => id !== '$schema' && typeof v?.template === 'string' && v.template.includes('#'))
    .map(([, v]) => v.template.split('#')[0]));
  return [...files].map((rel) => [rel, viewFile(rel)]);
}

/** A step of a node, as a line: its step, host, state, time and rows. */
const stepLine = (s) => `${s.step} (${s.host}): ${s.state}${s.ms !== undefined ? `, ${s.ms} ms` : ''}`
  + `${s.rows !== undefined ? `, ${s.rows} row(s)` : ''}${s.total !== undefined ? ` of ${s.total}` : ''}${s.store ? `, store "${s.store}"` : ''}`;

/** Nodes as lines: each node, and its steps. */
const nodeLines = (nodes) => nodes.map(({ node, steps }) => `- \`${node}\` — ${steps.map(stepLine).join('; ')}`);

/** The spec's states, for read_component's `on`; the readable properties, its default `props`. */
function surfaceOf(tag) {
  const s = tag.startsWith('sherpa-') ? spec(tag) : null;
  const ext = s?.$extensions?.sherpa ?? {};
  return {
    spec: s,
    methods: (ext.methods ?? []).map((m) => m.name),
    readable: (ext.jsProps ?? []).filter((p) => String(p.access ?? '').includes('read')).map((p) => p.name),
    states: (s?.states ?? []).map(({ name, selector }) => ({ name, selector })),
  };
}

const URL_ARG = z.string().optional().describe('A page on this machine, `http://localhost:<port>/…`, in place of the preview; any other host is refused before anything opens');
const SELECTOR = z.string().describe('A CSS selector for the element, `#grid` or `sherpa-pagination`: found in the page, else inside a component\'s shadow root');

export function register(server) {
  server.registerTool('preview_page', {
    title: 'Preview a page',
    description: 'A Context drawn as a reader sees it: its page definition, template and Views served on this machine — at 127.0.0.1, on a port the system picks — by sherpa-ui\'s own Node host (`nodeHandler`), its data handler holding the sample rows as the store the page names, beside sherpa-ui\'s build; opened in a headless Chromium in the app shell a new app has, and waited for until the Context has loaded, its source answered and every component drawn (`settled`). Gives a screenshot, the data layer\'s own reports (`onReport` in the page), the usage problems (`check_usage` on the template and each View\'s markup), what the page threw and each request it was not answered, and its source\'s rows. The page asks nothing of another host and runs no inline script. One preview at a time: another closes it; preview_close ends it. Give an app\'s `path` and `context`, or the files. Its browser is Playwright\'s, `playwright-core`, a peer dependency npm installs beside this package: its Chromium (`npx playwright install chromium`), else the machine\'s Chrome.',
    inputSchema: {
      path: z.string().optional().describe('An app.json, or the folder that holds it, whose Context `context` is previewed: its three files read from disk. Relative paths start where the MCP runs'),
      context: z.string().optional().describe('With `path`: the Context, by its name in app.json. Default: its `default`'),
      definition: z.union([z.string(), z.record(z.unknown())]).optional().describe('In place of `path`: the page definition (page.v1), as JSON — the file a Context\'s `definition` names'),
      template: z.string().optional().describe('In place of `path`: its markup — the file a Context\'s `template` names'),
      views: z.union([z.string(), z.record(z.unknown())]).optional().describe('In place of `path`: its Views (views.v1), as JSON — the file a Context\'s `views` names'),
      folder: z.string().optional().describe('With the files: the folder the Views\' file sits in, so each file a View names, file.html#id, is read from it and served'),
      rows: z.union([z.string(), z.array(z.record(z.unknown()))]).optional().describe('The rows the page\'s store holds, as a JSON list: a real page of a real answer. Default none'),
      key: z.string().optional().describe('The field each row is keyed by. Default: id'),
      type: z.union([z.string(), z.record(z.unknown())]).optional().describe('The rows\' type (type.v1), as describe_data gives it: the store is made from it, as the app makes it, so the page shows each field\'s words and status fields'),
      view: z.string().optional().describe('The View it opens on, by its id in the Views. Default: the first'),
      width: z.number().int().min(320).max(3840).optional().describe('The window\'s width in px. Default 1280'),
      height: z.number().int().min(240).max(2160).optional().describe('The window\'s height in px. Default 800'),
      mode: z.enum(['light', 'dark']).optional().describe('The display mode the page follows. Default light'),
      own: z.string().optional().describe('With the files: a project\'s own data-* hooks, by tag, as JSON, as its sherpa-usage.json "own" lists them. From `path`, its sherpa-usage.json is read'),
    },
  }, tool(async (args) => {
    const files = contextFiles(args);
    if (files.template == null) return refuse('A Context has a template: give its `template`, or an app\'s `path` and `context`.');
    // Its own store, else its type's (storeOf, plan 960 U3).
    const own = files.definition.value?.source;
    const named = own?.store ?? own?.type;
    const store = typeof named === 'string' ? named : undefined;
    const rows = listOf(args.rows, 'rows');
    if (rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) return refuse('Every row is a plain object: that is what a Sherpa row is.');
    const viewFiles = viewFilesOf(files.views.value, files.viewFile);
    const { markupProblems } = await load('usage');
    const usage = [['template', files.template], ...viewFiles.filter(([, text]) => text != null)]
      .flatMap(([where, html]) => markupProblems(html, where, files.own).problems);
    const opened = await openPreview({
      context: files.name, label: files.label, chrome: files.chrome, template: files.template, definition: files.definition.text, views: files.views.text,
      viewFiles: viewFiles.filter(([, text]) => text != null), store, rows, key: args.key, ...(args.type != null ? { type: given(args.type, 'type') } : {}),
    }, { width: args.width, height: args.height, mode: args.mode, view: args.view });
    const { facts: page, heard } = opened;
    const unread = viewFiles.filter(([, text]) => text == null).map(([rel, text]) => `${rel}, which a View names, was not read: ${text === null ? 'it is not beside the Views' : 'give the `folder` the Views sit in'}`);
    const lines = [
      `## Preview of "${files.name}": ${page.reports.length} report(s), ${usage.length} usage problem(s)`, '',
      `Served on this machine at ${opened.url}${store ? `, over ${rows.length} row(s) in the store "${store}"` : ''}; ${args.width ?? 1280}×${args.height ?? 800}, ${args.mode ?? 'light'}. It stays open: call_component and read_component act on it, watch_trace says its last act, preview_close ends it.`,
    ];
    if (!opened.loaded) lines.push('', '**The Context did not load** within the wait: the reports and what the page threw say why.');
    else if (!opened.settled) lines.push('', '**It did not settle** within the wait: a load was still running, or another began.');
    if (page.failure) lines.push('', page.failure);
    if (page.source) {
      const s = page.source;
      lines.push('', `Its source: ${s.total} row(s) match; ${s.rows} on page ${s.page} of ${s.totalPages}; its store ${s.reach === 'ok' ? 'answers' : `is ${s.reach}${s.failure ? `: ${s.failure.message}` : ''}`}.`);
    } else if (store) lines.push('', 'It opened no source.');
    lines.push(...listed('The data layer\'s reports', page.reports.map((r) => `\`${r.code}\` ${r.message}`)));
    lines.push(...listed('Usage problems — check_usage', usage));
    const said = [...heard.errors, ...heard.failed.map((f) => `not answered: ${f}`), ...unread];
    if (said.length) lines.push(...listed('The page', said));
    return shown(lines, {
      url: opened.url, context: files.name, loaded: opened.loaded, settled: opened.settled, source: page.source,
      reports: page.reports, usage, page: { errors: heard.errors, failed: heard.failed, unread }, drawn: page.drawn,
    }, opened.shot);
  }));

  server.registerTool('call_component', {
    title: 'Call a component',
    description: 'Call a method a component\'s spec lists (get_component names them) on an element of the preview, or of a page on this machine, with JSON arguments; wait for the page — on the preview, until its source has answered and every component drawn — then give what it returned or threw, its attributes and any properties read back, and, on the preview, the data layer\'s reports during the act. watch_trace then says what the act did, by node. Only a Sherpa component\'s listed methods: no script crosses, and any host but this machine is refused.',
    inputSchema: {
      selector: SELECTOR,
      method: z.string().describe('The method to call: one its spec lists'),
      args: z.union([z.string(), z.array(z.unknown())]).optional().describe('Its arguments, as a JSON list: `[2]`. Default none'),
      readBack: z.union([z.string(), z.array(z.string())]).optional().describe('Properties to read after, as a JSON list of names: `["page"]`'),
      url: URL_ARG,
      screenshot: z.boolean().optional().describe('Give the page as it is after, as an image. Default false'),
    },
  }, tool(async ({ selector, method, args, readBack, url, screenshot }) => {
    const argList = listOf(args, 'args');
    const reads = listOf(readBack, 'readBack');
    const at = await pageAt(url);
    const tag = await elementAt(at.page, selector).catch((error) => { throw new Error(`"${selector}" is not a selector: ${error.message.split('\n')[0]}`); });
    if (!tag) return refuse(`No element matches "${selector}" on ${at.url}.`);
    const { spec: s, methods, states } = surfaceOf(tag);
    if (!s) return refuse(`"${selector}" is a <${tag}>, which is no Sherpa component: only a component's listed methods are called.`);
    if (!methods.includes(method)) return refuse(`<${tag}> lists no method "${method}". It lists: ${methods.join(', ') || 'none — it is driven by its attributes and events'}.`);
    if (at.preview) await begin(`call_component ${selector} ${method}()`);
    const out = await atElement(at.page, { selector, tag, call: { method, args: argList }, props: reads, states, preview: at.preview });
    if (out.gone) return refuse(`"${selector}" left the page before it was called.`);
    const act = at.preview ? await lastAct() : null;
    const lines = [`## <${tag}>.${method}() on ${at.url}`, ''];
    lines.push(out.threw !== undefined ? `**It threw:** ${out.threw}` : `Called with ${argList.length} argument(s)${out.returned != null ? '; it returned the value below' : ''}.`);
    if (out.waited && !out.waited.settled) lines.push('', 'The page did not settle within the wait: a load was still running, or another began.');
    if (act) lines.push(...listed('The data layer\'s reports during it', act.reports.map((r) => `\`${r.code}\` ${r.message}`)));
    lines.push('', 'watch_trace says what it did, by node.');
    return shown(lines, {
      tag, method, args: argList, ...(out.threw !== undefined ? { threw: out.threw } : { returned: out.returned }),
      attrs: out.attrs, on: out.on, ...(reads.length ? { readBack: out.values } : {}), ...(act ? { reports: act.reports } : {}),
    }, screenshot ? await shot(at.page) : null);
  }));

  server.registerTool('read_component', {
    title: 'Read a component',
    description: 'An element of the preview, or of a page on this machine, as it stands once drawn: its attributes; which states its spec names are on (each `states` selector tested on it); its properties — every one its spec says is readable, or those named; and the parts of its shadow root, each shown or not, with its text. It calls nothing. Any host but this machine is refused.',
    inputSchema: {
      selector: SELECTOR,
      props: z.union([z.string(), z.array(z.string())]).optional().describe('Properties to read, as a JSON list of names. Default: every property its spec says is readable'),
      url: URL_ARG,
    },
  }, tool(async ({ selector, props, url }) => {
    const at = await pageAt(url);
    await settle(at);
    const tag = await elementAt(at.page, selector).catch((error) => { throw new Error(`"${selector}" is not a selector: ${error.message.split('\n')[0]}`); });
    if (!tag) return refuse(`No element matches "${selector}" on ${at.url}.`);
    const { spec: s, readable, states } = surfaceOf(tag);
    const names = props === undefined ? readable : listOf(props, 'props');
    const out = await atElement(at.page, { selector, tag, props: names, states });
    if (out.gone) return refuse(`"${selector}" left the page before it was read.`);
    const shownParts = out.parts.filter((p) => p.shown).length;
    const lines = [
      `## <${tag}> on ${at.url}`, '',
      `${Object.keys(out.attrs).length} attribute(s); ${s ? `${out.on.length} of its spec's ${states.length} state(s) on` : 'no Sherpa spec, so no states'}; ${names.length} propert${names.length === 1 ? 'y' : 'ies'} read; ${out.parts.length} part(s), ${shownParts} shown${out.inShadow ? '. It sits in a component\'s shadow root' : ''}.`,
    ];
    if (out.on.length) lines.push('', `On: ${out.on.join(', ')}.`);
    return shown(lines, { tag, attrs: out.attrs, on: out.on, values: out.values, parts: out.parts });
  }));

  server.registerTool('watch_trace', {
    title: 'Watch the trace',
    description: 'The spans of the last act, by the Query graph node each lights (`queryStepNode`) — node ids as definition_graph draws a page\'s Query: the MCP\'s own, each load of the last query_source, definition_graph or edit_definition_graph call; and the preview\'s, since it opened or since the last call_component — its page\'s and its Node host\'s, joined by their trace. Each step with its host, state, time and rows; what each load\'s walk counted is said under it (`traceQuerySteps`), each condition and preset with the rows it left.',
    inputSchema: {
      node: z.string().optional().describe('Only this node, by its id as definition_graph draws it: `when-data-status`, `source`, `store`'),
    },
  }, tool(async ({ node }) => {
    const dl = await imported('sherpa-ui/data');
    const only = (nodes) => (node ? nodes.filter((n) => n.node === node) : nodes);
    const call = lastCall();
    const act = await lastAct();
    if (!call && !act) return refuse('Nothing has run yet: query_source runs a page\'s Query here, and preview_page opens a page whose acts are heard.');
    const lines = ['## The last acts, by node'];
    const data = {};
    if (call) {
      data.mcp = { page: call.page, loads: call.loads.map((l) => ({ asked: l.asked, nodes: only(byNode(dl, l.spans)) })) };
      lines.push('', `### The MCP's own: the page "${call.page}", ${call.loads.length} load(s)`);
      for (const [i, l] of data.mcp.loads.entries()) {
        lines.push('', `${i + 1}. ${l.asked === 'open' ? 'Opened' : `Asked \`${JSON.stringify(l.asked)}\``}`, ...(l.nodes.length ? nodeLines(l.nodes) : ['- (nothing heard)']));
      }
    }
    if (act) {
      data.preview = { act: act.act, url: act.url, nodes: only(byNode(dl, act.spans)), reports: act.reports };
      lines.push('', `### The preview's: ${act.act === 'open' ? 'opened' : act.act}, at ${act.url}`, '', ...(data.preview.nodes.length ? nodeLines(data.preview.nodes) : ['- (nothing heard)']));
      if (act.reports.length) lines.push(...listed('Its reports', act.reports.map((r) => `\`${r.code}\` ${r.message}`)));
    }
    return shown(lines, data);
  }));

  server.registerTool('preview_close', {
    title: 'Close the preview',
    description: 'End the preview: its pages, its browser and its Node host, so nothing of it listens or runs. Safe when none is open. preview_page closes the one before it too.',
    inputSchema: {},
  }, tool(async () => {
    const was = await closePreview();
    return { content: [{ type: 'text', text: was ? `Closed: ${[was.url, was.other].filter(Boolean).join(' and ')} — its browser and its server are gone.` : 'No preview was open.' }] };
  }));

  // Each prompt IS its skill: one SKILL.md, served as both (Q8).
  const CONTEXT = z.string().describe('The Context, by its name in app.json');
  const PATH = z.string().optional().describe('The app.json, or the folder that holds it. Default: the folder the MCP runs in');
  const where = (context, path) => [`The Context: ${context}.`, `The app: ${path ?? '.'}.`];

  server.registerPrompt('review_page', {
    title: 'Review a page',
    description: 'Review one Context: its files checked (validate_page), its markup against the specs (check_usage), then the page drawn over real rows (preview_page) — the data layer\'s reports, the usage problems and a screenshot — each problem fixed where it is named. The steps are skills/review-page/SKILL.md, the skill this package ships.',
    argsSchema: { context: CONTEXT, path: PATH },
  }, ({ context, path }) => prompted('review-page', where(context, path)));

  server.registerPrompt('explain_page', {
    title: 'Explain a page',
    description: 'Explain how one Context\'s Query reaches its rows: drawn as nodes (definition_graph), one act a reader would make run (query_source), then the spans of that act by node (watch_trace) — each condition with the rows it left — said in the graph\'s terms. The steps are skills/explain-page/SKILL.md, the skill this package ships.',
    argsSchema: { context: CONTEXT, path: PATH, field: z.string().optional().describe('A field to act on, by its name in the page\'s `source.fields`') },
  }, ({ context, path, field }) => prompted('explain-page', [...where(context, path), field && `The field to act on: ${field}.`]));
}
