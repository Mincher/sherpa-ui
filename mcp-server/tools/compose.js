/**
 * compose.js — the compose tier: a need → a pattern → a page, each page checked
 * by validate_page before it is given (plan 700 §3, rule 3). Sherpa's patterns
 * and the app's, its patterns/ folder beside its app.json (Q4); the build_page
 * prompt is skills/build-page/SKILL.md (Q8).
 *
 *   pick_pattern           a need → the patterns that fit, ranked, with each part of each `when`
 *   generate_page          a pattern and the data → a Context's template, definition and first View, checked
 *   sherpa://patterns      every pattern, Sherpa's and the app's: what each is for and when it fits
 *   sherpa://pattern/{id}  one pattern, as its file holds it
 *   build_page             describe_data → pick_pattern → generate_page → validate_page → preview_page
 *
 * Map:
 * - register — register the compose tools, resources and prompt on an MCP server
 */
import { z } from 'zod/v3';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { spec } from '../lib/sherpa.js';
import { checkPageFiles, dataLayer, findings, schemaCheck } from '../lib/check.js';
import { fieldKinds, fromFields, fromRows, labelOf, needOf, statusProblems, statusRows, withStatus } from '../lib/describe.js';
import { KINDS, checkPattern, drawsViewBar, expandScopes, patternsFor, pickPattern, writeLayout } from '../lib/pattern.js';
import { answer, refuse } from '../lib/reply.js';
import { prompted } from '../lib/skills.js';

/** A tool's work: what it cannot do is said as a refusal, never thrown at the client. */
const tool = (run) => async (args) => {
  try {
    return await run(args);
  } catch (error) {
    return refuse(error.message);
  }
};

/** A JSON argument, given as JSON or as its text. */
function given(value, what) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`\`${what}\` is not JSON: ${error.message}`);
  }
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fenced = (text, lang = '') => `\`\`\`\`${lang}\n${text.replace(/\n$/, '')}\n\`\`\`\``;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const whose = (e) => (e.from === 'app' ? `the app's ${e.file}` : e.from === 'given' ? 'given' : `Sherpa's ${e.file}`);
/** One part of a `when`, as an agent reads it. */
const part = (p) => `\`${p.field}\` ${JSON.stringify(p.condition)}: ${p.value === undefined ? 'not in the need' : JSON.stringify(p.value)} — ${p.holds ? 'holds' : 'does not hold'}`;

const APP = z.string().optional().describe('The app\'s folder, or its app.json, whose patterns/ folder adds the app\'s own patterns; relative paths start where the MCP runs. Default: the folder the MCP runs in');

/** The status fields, checked as statusFields() takes them; null when none is given. */
function statusOf(value) {
  if (value == null) return null;
  const status = given(value, 'status');
  const wrong = statusProblems(status);
  if (wrong.length) throw new Error(`The status fields are not what statusFields() takes (defs.v1.json statusField):\n${wrong.map((w) => `- ${w}`).join('\n')}`);
  return status;
}

/** A pattern by id, from Sherpa's and the app's, or one given whole; it throws, naming those there are. */
function patternOf(value, app) {
  const { patterns, refused } = patternsFor(app);
  if (typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value)) {
    const found = patterns.find((e) => e.pattern.id === value);
    if (found) return found;
    const bad = refused.length ? ` Refused: ${refused.map((r) => `${whose(r)} (${r.problems[0]})`).join('; ')}.` : '';
    throw new Error(`No pattern "${value}". The patterns: ${patterns.map((e) => e.pattern.id).join(', ')}.${bad}`);
  }
  return { pattern: given(value, 'pattern'), from: 'given', file: null };
}

/** The grid's columns, one per field a page declares or searches, as its `columns` takes them. */
const columnsOf = (fields) => fields.filter((f) => f.field || f.search).map((f) => ({
  field: f.name, header: f.field?.label ?? labelOf(f.name), sortable: true,
  ...(f.field?.type === 'number' || f.field?.type === 'date' ? { type: f.field.type } : {}),
}));

/**
 * Each element's `ui`: the pattern's, and for an element that asks for a page of
 * rows and takes `columns` and `key` (its spec's jsProps), those of the data —
 * the pattern's own keys win.
 */
function uiOf(pattern, fields, key) {
  const ui = structuredClone(pattern.page?.ui ?? {});
  const visit = (node) => {
    const id = node.attrs?.id;
    const s = typeof node.el === 'string' && node.el.includes('-') ? spec(node.el) : null;
    const props = new Set((s?.$extensions?.sherpa?.jsProps ?? []).map((p) => p.name));
    if (typeof id === 'string' && !id.includes('{') && s?.asks?.shape === 'rows' && props.has('columns') && props.has('key')) {
      ui[id] = { key, columns: columnsOf(fields), ...ui[id] };
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(pattern.layout);
  return ui;
}

/** The events each role's element fires, from its spec: what its module hears. */
function heardBy(layout) {
  const out = [];
  const visit = (node) => {
    const id = node.attrs?.id;
    const s = typeof node.el === 'string' && node.el.includes('-') ? spec(node.el) : null;
    if (node.role && typeof id === 'string' && s?.events?.length) out.push(`- \`#${id}\` (${node.role}), a <${node.el}>, fires ${s.events.map((e) => `\`${e.name}\``).join(', ')}`);
    for (const child of node.children ?? []) visit(child);
  };
  visit(layout);
  return out;
}

/** A page from a pattern and the data: its files, its app.json entry, what each role draws, and validate_page's findings. */
async function generate(args) {
  const dl = await dataLayer();
  const entry = patternOf(args.pattern, args.app ?? '.');
  const { pattern } = entry;
  const key = args.key ?? 'id';
  const id = args.id;
  const status = statusOf(args.status);
  if ((args.rows == null) === (args.fields == null)) throw new Error('Give the data as `rows` or as a page\'s `fields`, one of them.');
  const rows = args.rows == null ? null : given(args.rows, 'rows');
  if (rows && (!Array.isArray(rows) || rows.some((r) => !isObject(r)))) throw new Error('`rows` is a JSON array of rows, each a plain object.');
  const read = rows && status ? await statusRows(dl, rows, status, key) : rows;
  const fields = withStatus(read ? fromRows(dl, read, key) : fromFields(given(args.fields, 'fields')), status);
  const named = status ? Object.keys(status) : [];
  const kinds = fieldKinds(fields, { key, status: named });
  const need = needOf(fields, { rows: rows?.length, task: args.task, writes: args.writes, status: status ? named : undefined, declared: args.fields != null });
  const checked = await checkPattern(pattern, { need });
  if (checked.problems.length) {
    throw new Error([`The pattern "${pattern?.id ?? '(no id)'}" (${whose(entry)}) cannot make this page: ${checked.problems.length} problem(s).`, '', ...checked.problems.map((p) => `- ${p}`)].join('\n'));
  }

  const asks = checked.roles.some((r) => r.shape);
  const label = args.label ?? labelOf(id);
  const paths = { template: `templates/${id}.html`, definition: `view-schemas/${id}.json`, views: `views/${id}-views.json` };
  const search = fields.filter((f) => f.search).map((f) => f.name);
  const ui = uiOf(pattern, fields, key);
  const definition = pattern.page || asks ? {
    $schema: '../node_modules/sherpa-ui/schemas/page.v1.json', v: 1, id,
    source: {
      store: args.store ?? id,
      ...(search.length ? { search } : {}),
      fields: Object.fromEntries(fields.filter((f) => f.field).map((f) => [f.name, f.field])),
      ...(pattern.page?.scopes ? { scopes: expandScopes(pattern.page.scopes, kinds) } : {}),
    },
    ...(Object.keys(ui).length ? { ui } : {}),
  } : null;
  const views = definition ? {
    $schema: '../node_modules/sherpa-ui/schemas/views.v1.json',
    all: { label: 'All', query: { v: 1, scopes: Object.fromEntries(Object.keys(definition.source.scopes ?? {}).map((s) => [s, {}])) } },
  } : null;
  const what = definition ? `The "${id}" Context` : `The "${id}" Settings page`;
  const template = `<!-- ${what}, from the pattern "${pattern.id}" (generate_page).${asks ? ' Each component ASKS its provider for its data.' : ''} -->\n${writeLayout(pattern.layout, { kinds, id })}`;
  const place = definition
    ? { contexts: { [id]: { label, template: paths.template, definition: paths.definition, views: paths.views, ...(drawsViewBar(pattern.layout) ? { chrome: { filters: false } } : {}) } } }
    : { settings: { pages: { [id]: { label, template: paths.template } } } };

  // Rule 3: checked before it is given, by validate_page's own check, and its app.json entry by app.v1's shapes.
  const page = await checkPageFiles({
    definition: definition ? json(definition) : undefined, views: views ? json(views) : undefined, template,
    names: { definition: paths.definition, views: paths.views, template: paths.template },
  });
  const [where, value] = definition ? ['context', place.contexts[id]] : ['settingsPage', place.settings.pages[id]];
  const parts = [...page.parts, { name: 'app.json entry', checked: `defs.v1.json ${where}`, problems: schemaCheck(`defs.v1.json#/$defs/${where}`)(value), notes: [] }];
  const found = findings({ title: `${what}`, parts });
  return { entry, pattern, need, kinds, checked, definition, views, template, place, paths, found };
}

export function register(server) {
  server.registerTool('pick_pattern', {
    title: 'Pick a pattern',
    description: 'The patterns that fit a need, as describe_data gives it: each pattern\'s `when` run over the need as ONE row, through the data layer\'s own condition (`parseWhere`, `conditionClause`, `filterRows`). Highest `rank` first; each with every part of its `when` and whether it held, and the ones that do not fit, with the part that failed. Sherpa\'s patterns and the app\'s own — a patterns/ folder beside its app.json, where one of the same id replaces Sherpa\'s. A pattern that fits but fails checkPattern against the need is listed with its problems, never picked. generate_page makes the page from the first.',
    inputSchema: {
      need: z.union([z.string(), z.record(z.unknown())]).describe('The need, as JSON (pattern.v1.json need): `{ "task": "triage", "rows": 4200, "fields": 9, "dateFields": 1, "numberFields": 3, "statusFields": 1, "writes": true }`'),
      app: APP,
    },
  }, tool(async ({ need: value, app }) => {
    const need = given(value, 'need');
    const wrong = schemaCheck('pattern.v1.json#/$defs/need')(need);
    if (!isObject(need) || wrong.length) return refuse(`The need is not one (pattern.v1.json need):\n${wrong.map((w) => `- ${w}`).join('\n')}\n\ndescribe_data makes one from rows, a schema or a page's fields.`);
    const dl = await dataLayer();
    const { patterns, refused } = patternsFor(app ?? '.');
    const { fit, unfit, said } = pickPattern(dl, need, patterns);
    const sound = [];
    const failing = [];
    for (const e of fit) {
      const { problems } = await checkPattern(e.pattern, { need });
      (problems.length ? failing : sound).push({ ...e, problems });
    }
    const out = [`## ${sound.length} of ${patterns.length} pattern(s) fit the need`, ''];
    sound.forEach((e, i) => out.push(`${i + 1}. **${e.pattern.id}** — ${e.pattern.label} (rank ${e.pattern.rank ?? 0}; ${whose(e)}${e.replaces ? `, in place of Sherpa's ${e.replaces}` : ''})`,
      `   ${e.pattern.use}`, ...e.parts.map((p) => `   - ${part(p)}`)));
    if (!sound.length) out.push('None. Say what the need lacks, or add a pattern of the app\'s own: a patterns/ folder beside its app.json (`sherpa://schemas/pattern`).');
    if (failing.length) out.push('', '### Fit, but checkPattern refuses them', '', ...failing.flatMap((e) => [`- **${e.pattern.id}** (${whose(e)})`, ...e.problems.map((p) => `  - ${p}`)]));
    if (unfit.length) out.push('', '### Do not fit', '', ...unfit.map((e) => `- **${e.pattern.id}** (${whose(e)}): ${e.parts.filter((p) => !p.holds).map(part).join('; ')}`));
    if (refused.length) out.push('', '### Refused: not a pattern by pattern.v1.json', '', ...refused.flatMap((r) => [`- ${whose(r)}`, ...r.problems.map((p) => `  - ${p}`)]));
    if (said.length) out.push('', 'The data layer said:', ...said.map((s) => `- ${s}`));
    if (sound.length) out.push('', '### Next', '', `\`generate_page\` with \`"pattern": "${sound[0].pattern.id}"\`, the page's \`id\`, and the rows or the fields the need was made from.`);
    out.push('', fenced(JSON.stringify({ need, picked: sound.map((e) => ({ id: e.pattern.id, rank: e.pattern.rank ?? 0, from: e.from, parts: e.parts })) }, null, 2), 'json'));
    return answer(out.join('\n'));
  }));

  server.registerTool('generate_page', {
    title: 'Generate a page',
    description: 'A pattern and the data → a page: its template (the layout written as HTML, each `each` once per field of its kind), its page definition (the data\'s fields, the pattern\'s scopes with each `{kind}` the fields of that kind, its `ui`, and a grid\'s columns and key from the data) and its first View; or, for a pattern with no data source, a Settings page\'s template. With the paths to write them at and the app.json entry; a page that draws its own View bar takes the header\'s away (`chrome.filters: false`). The pattern is checked against the need first (checkPattern), and every file by validate_page\'s own check before it is given: one that fails is refused, with what failed.',
    inputSchema: {
      pattern: z.union([z.string(), z.record(z.unknown())]).describe('A pattern\'s id, as pick_pattern gives it, or a pattern as JSON (pattern.v1.json), to try one of the app\'s own'),
      id: z.string().regex(/^[a-z][a-z0-9-]*$/).describe('The page\'s id: its Context\'s name in app.json, and its files\', e.g. customers'),
      rows: z.union([z.string(), z.array(z.record(z.unknown()))]).optional().describe('The rows, as a JSON array: what describe_data was given'),
      fields: z.union([z.string(), z.record(z.unknown())]).optional().describe('Instead of rows: a page\'s own fields, as JSON (its definition\'s `source.fields`)'),
      status: z.union([z.string(), z.record(z.unknown())]).optional().describe('The status fields the store works out, as statusFields(store, { … }) takes them, as describe_data takes them'),
      key: z.string().optional().describe('The field each row is known by. Default: id'),
      store: z.string().optional().describe('The name the app registers its store under. Default: the page\'s id'),
      label: z.string().optional().describe('Its row\'s name in the nav. Default: from its id'),
      task: z.string().optional().describe('The agent\'s word for the work, for the need, as pick_pattern was given it'),
      writes: z.boolean().optional().describe('Whether a reader may change the rows, for the need'),
      app: APP,
    },
  }, tool(async (args) => {
    const g = await generate(args);
    const files = [[g.paths.template, g.template, 'html'], ...(g.definition ? [[g.paths.definition, json(g.definition), 'json'], [g.paths.views, json(g.views), 'json']] : [])];
    if (g.found.problems) {
      return refuse([`generate_page made what validate_page refuses, from the pattern "${g.pattern.id}" (${whose(g.entry)}): nothing is given.`, '', g.found.text, '', ...files.flatMap(([p, text, lang]) => [`### \`${p}\``, '', fenced(text, lang), ''])].join('\n').trimEnd());
    }
    const drawn = g.checked.roles.filter((r) => r.role).map((r) => {
      const many = r.own ? (g.kinds[r.each] ?? []).slice(0, r.max ?? Infinity) : null;
      return `- \`${r.role}\` — <${r.tag}>${r.shape ? ` asks for ${r.shape}${r.kind ? `, drawn as ${r.kind}` : ''}` : ''}${many ? ` — one per ${r.each}: ${many.map((f) => f.name).join(', ') || 'none in this data'}` : ''}`;
    });
    const out = [
      `## ${g.definition ? 'A Context' : 'A Settings page'}, "${args.id}", from the pattern "${g.pattern.id}" (${whose(g.entry)}): checked, sound`, '',
      `**${g.pattern.label}.** ${g.pattern.use}`, '',
      '### The need', '', fenced(JSON.stringify(g.need, null, 2), 'json'), '',
      '### What each role draws', '', ...drawn, ...g.checked.notes.map((n) => `- _${n}_`), '',
      ...files.flatMap(([p, text, lang]) => [`### \`${p}\``, '', fenced(text, lang), '']),
      `### \`app.json\`: add to its \`${g.definition ? 'contexts' : 'settings.pages'}\``, '', fenced(JSON.stringify(g.place, null, 2), 'json'), '',
      '### Checked by validate_page', '', g.found.text, '',
      '### Next', '',
      '1. Write each file at its path, in the app\'s folder, and add the entry to app.json; `validate_app` checks them there.',
      `2. ${g.definition ? `Its module (app.json \`module\`, \`contexts/${args.id}.js\`)` : 'Its module (app.json `settings.module`)'} does what the pattern's use says, above. What it hears:`,
      ...heardBy(g.pattern.layout).map((l) => `   ${l}`),
      `3. \`preview_page\` draws it over the rows (the see tier). Change only what the pattern's agent.may names (${(g.pattern.agent?.may ?? []).join(', ') || 'nothing'}); keep ${(g.pattern.agent?.keeps ?? []).join(', ') || 'every role'}.`,
    ];
    return answer(out.join('\n'));
  }));

  const listed = () => patternsFor(process.cwd());
  server.registerResource('patterns', 'sherpa://patterns', {
    title: 'The patterns',
    description: 'Every pattern pick_pattern picks from, as JSON: Sherpa\'s (sherpa-ui\'s patterns/) and the app\'s own (a patterns/ folder beside the app.json in the folder the MCP runs in), where one of the same id replaces Sherpa\'s — each one\'s id, label, use, when and rank, and where it is from; and each file refused, with why. Each is pattern.v1.json (`sherpa://schemas/pattern`)',
    mimeType: 'application/json',
  }, async (uri) => {
    const { patterns, refused } = listed();
    const text = JSON.stringify({
      patterns: patterns.map((e) => ({ id: e.pattern.id, label: e.pattern.label, use: e.pattern.use, when: e.pattern.when, rank: e.pattern.rank ?? 0, from: e.from, file: e.file, ...(e.replaces ? { replaces: e.replaces } : {}) })),
      refused: refused.map((r) => ({ file: r.file, from: r.from, problems: r.problems })),
      kinds: KINDS,
    }, null, 2);
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text }] };
  });

  server.registerResource('pattern', new ResourceTemplate('sherpa://pattern/{id}', {
    list: async () => ({
      resources: listed().patterns.map((e) => ({ uri: `sherpa://pattern/${e.pattern.id}`, name: `${e.pattern.id} pattern`, description: e.pattern.label, mimeType: 'application/json' })),
    }),
    complete: { id: (typed) => listed().patterns.map((e) => e.pattern.id).filter((n) => n.startsWith(typed ?? '')) },
  }), {
    title: 'A pattern',
    description: 'One pattern, by id, as its file holds it: the app\'s where it has one of that id, else Sherpa\'s',
    mimeType: 'application/json',
  }, async (uri, { id }) => {
    const found = listed().patterns.find((e) => e.pattern.id === id);
    if (!found) throw Object.assign(new Error(`No such resource: ${uri.href}`), { code: ErrorCode.InvalidParams });
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: found.text }] };
  });

  // The prompt IS the skill: one SKILL.md, served as both (Q8).
  server.registerPrompt('build_page', {
    title: 'Build a page',
    description: 'Build a page of a Sherpa app from its data: describe_data → pick_pattern → generate_page → validate_page → preview_page. The steps are skills/build-page/SKILL.md, the skill this package ships.',
    argsSchema: {
      task: z.string().optional().describe('The reader\'s work on the page: browse, find, triage, edit, settings…'),
      data: z.string().optional().describe('Where the rows are: a file, a localhost data path, or the rows themselves'),
      app: z.string().optional().describe('The app\'s folder'),
    },
  }, ({ task, data, app }) => prompted('build-page', [task && `The task: ${task}.`, data && `The data: ${data}.`, app && `The app: ${app}.`]));
}
