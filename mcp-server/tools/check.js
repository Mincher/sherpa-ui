/**
 * check.js — the check tier's tools: an app, its markup and its data, checked.
 * Each is a thin wrapper over what sherpa-ui ships; scaffold_app gives a new
 * app's files, which validate_app checks.
 *
 *   validate_page  a Context's definition, Views and template, and each `ui`
 *   validate_app   an app.json, then every Context and Settings page it names
 *   check_usage    markup against the component specs
 *   check_custom_node  a Custom Node's JSON, checked as Save checks it: each fault in words, or the node it offers
 *   describe_data  rows, a JSON Schema or a page's fields → store rules, a page's fields and the need
 *   validate_rows  rows against store rules, as the store reads them
 *   scaffold_app   a new app's files: the Starter's, which validate_app checks
 *
 * Map:
 * - register — register the check tools on an MCP server
 */
import { z } from 'zod/v3';
import { appFile, load, starterFiles } from '../lib/sherpa.js';
import { checkAppFolder, checkPageFiles, dataLayer, findings, schemaCheck, withEntities } from '../lib/check.js';
import { RULE_FORM, fromFields, fromRows, fromSchema, needOf, ruleCode, ruleMap, statusProblems, statusRows, withStatus } from '../lib/describe.js';
import { answer, refuse } from '../lib/reply.js';

/** A tool's work: what it cannot do is said as a refusal, never thrown at the client. */
const tool = (run) => async (args) => {
  try {
    return await run(args);
  } catch (error) {
    return refuse(error.message);
  }
};

/** JSON text as a value; it throws, saying which argument is not JSON. */
function json(text, name) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`\`${name}\` is not JSON: ${error.message}`);
  }
}

/** A JSON array of rows, each a plain object; it throws, saying what it is not. */
function rowsOf(text) {
  const rows = json(text, 'rows');
  if (!Array.isArray(rows) || !rows.length) throw new Error('`rows` is not a JSON array of rows: give at least one, each a plain object.');
  if (rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) throw new Error('Every row is a plain object: that is what a Sherpa row is.');
  return rows;
}

/** A project's own hooks, by tag, as its sherpa-usage.json `own` holds them. */
const ownOf = (text) => {
  if (!text) return {};
  const own = json(text, 'own');
  const ok = own && typeof own === 'object' && !Array.isArray(own) && Object.values(own).every((v) => Array.isArray(v));
  if (!ok) throw new Error('`own` is an object of tag → the attributes the project adds to it: {"sherpa-button":["data-by"]}.');
  return own;
};

const OWN = z.string().optional().describe('A project\'s own data-* hooks, by tag, as JSON, as its sherpa-usage.json "own" lists them: {"sherpa-button":["data-by"]}');

/** A file's text in a fenced block that its own fences cannot close. */
const fenced = (text, lang = '') => `\`\`\`\`${lang}\n${text.replace(/\n$/, '')}\n\`\`\`\``;

export function register(server) {
  server.registerTool('validate_page', {
    title: 'Validate a page',
    description: 'A Context\'s files, as text, checked by what sherpa-ui ships: its page definition against page.v1.json and then checkPage; its Views against views.v1.json, with each View\'s template read from `folder`; its template and each View\'s against the component specs (check_usage); and each `ui` — every id an element in the markup, every key a property or a method its spec lists. Give any of the three files. Each problem is said in its checker\'s own words. validate_app checks the files an app.json names, on disk.',
    inputSchema: {
      definition: z.string().optional().describe('The page definition, as JSON: the file a Context\'s `definition` names'),
      views: z.string().optional().describe('Its Views, as JSON: the file a Context\'s `views` names'),
      template: z.string().optional().describe('Its markup: the file a Context\'s `template` names'),
      folder: z.string().optional().describe('The folder the Views\' file sits in, so a View\'s `template`, file.html#id, is read from it'),
      own: OWN,
    },
  }, tool(async ({ definition, views, template, folder, own }) => {
    if (definition == null && views == null && template == null) return refuse('Give a page\'s `definition`, its `views` or its `template`, as text.');
    const page = await checkPageFiles({
      definition, views, template, own: ownOf(own),
      viewFile: (rel) => (folder ? appFile(folder, rel) : undefined),
    });
    const { text } = findings({ title: page.id ? `Page "${page.id}"` : 'Page', parts: page.parts });
    return answer(text);
  }));

  server.registerTool('validate_app', {
    title: 'Validate an app',
    description: 'An app on disk, checked: its app.json against app.v1.json and then checkApp; that every file it names is in its folder; then each Context as validate_page checks it — its definition, its Views and their templates, its markup and each `ui` — and each Settings page\'s markup. The project\'s own data-* hooks come from its sherpa-usage.json. Run it after scaffold_app, and after every change to an app.',
    inputSchema: {
      path: z.string().optional().describe('The app.json, or the folder that holds it; relative paths start where the MCP runs. Default: the folder the MCP runs in'),
      context: z.string().optional().describe('Only this Context, by its name in app.json'),
    },
  }, tool(async ({ path: target = '.', context }) => answer(findings(await checkAppFolder(target, { context })).text)));

  server.registerTool('check_usage', {
    title: 'Check markup',
    description: 'Markup against the component specs, as `npx sherpa-ui check-usage` checks an app: every sherpa-* tag is a component, every data-* on one is its own or one every component may carry, an enum takes the value written, and a native button wearing `sherpa-button` takes the Button\'s names. A typo does nothing and says nothing in a browser; here it is a line.',
    inputSchema: {
      markup: z.string().describe('The HTML: a template, a View\'s markup or a page'),
      name: z.string().optional().describe('What to call it in each line, e.g. its file: templates/records.html. Default: markup'),
      own: OWN,
    },
  }, tool(async ({ markup, name = 'markup', own }) => {
    const { markupProblems } = await load('usage');
    const { problems, tags } = markupProblems(markup, name, ownOf(own));
    if (!problems.length) return answer(`${tags} tag(s) in ${name} match their specs.${tags ? '' : ' It has no sherpa-* tag and no native button wearing sherpa-button.'}`);
    return answer([`${problems.length} problem(s) in ${tags} tag(s):`, '', ...problems.map((p) => `- ${p}`),
      '', 'Fix the markup, or list a project\'s own hook in `own`, as its sherpa-usage.json does.'].join('\n'));
  }));

  server.registerTool('check_custom_node', {
    title: 'Check a Custom Node',
    description: 'A Custom Node\'s JSON, an entity (entity.v2) of the type node or any other type, checked as the shelf\'s Save checks it (plan 942 D3 A): against entity.v2.json, then `entityFaults`, over the app\'s other entities and its types. Each fault is said in words; with none, the node it offers: its use\'s kind, its category, its inputs and outputs, and how many nodes its graph holds. It writes nothing: an agent writes the JSON into the app\'s entities file itself',
    inputSchema: {
      node: z.string().describe('The Custom Node, as JSON: `{ "v": 2, "type": "node", "id", "label", "graph": { "nodes", "connections" }, "settings": { "inputs", "outputs" } }`'),
      entities: z.string().optional().describe('The app\'s entities file, as JSON (entities.v2: `{ "v": 2, "types", "entities" }`), or a list of entities: its types are known, and a use of one of its entities is no fault'),
    },
  }, tool(async ({ node: text, entities }) => {
    let entity;
    try {
      entity = JSON.parse(text);
    } catch (error) {
      return refuse(`The node is not JSON: ${error.message}`);
    }
    const shape = schemaCheck('entity.v2.json')(entity).map((e) => `entity.v2: ${e}`);
    const dl = await dataLayer();
    return withEntities(dl, entities, (list) => {
      const faults = [...shape, ...(dl.isEntity(entity) ? dl.entityFaults(entity, { entities: list.filter((e) => e.id !== entity.id) }) : [])];
      if (faults.length) return answer([`${faults.length} fault(s) in "${entity?.label ?? entity?.id ?? 'the node'}":`, '', ...faults.map((f) => `- ${f}`)].join('\n'));
      const offered = dl.asNode(entity);
      const sockets = (list) => list.map((s) => `${s.label ?? s.name} (${s.type})`).join(', ') || 'none';
      return answer([
        `No fault. "${offered.label}" is a Custom Node of ${offered.category ?? 'Custom Nodes'}, placed as the kind "${dl.entityKind(entity)}".`,
        `Inputs: ${sockets(offered.inputs)}. Outputs: ${sockets(offered.outputs)}. Its graph holds ${offered.nodes.length} node(s).`,
      ].join('\n'));
    });
  }));

  server.registerTool('describe_data', {
    title: 'Describe data',
    description: 'Rows, a JSON Schema or an OpenAPI document, or a page\'s own fields, said in Sherpa\'s terms: the store\'s rules, by name, with the evidence for each and as code; a page\'s `fields`, each a field declaration (defs.v1.json); and the need a pattern is picked by (pattern.v1.json), which pick_pattern takes. From rows nothing is drawn from a field\'s name, and nothing a sample cannot show is proposed; from a schema, what it promises may be a rule, and what no rule carries is listed. A status field is the store\'s, so the need counts one only when `status` gives it, and a child is the page\'s, so only when `fields` are given. Each output is checked against its contract before it is given. validate_rows checks the rules against rows.',
    inputSchema: {
      rows: z.string().optional().describe('The rows, as a JSON array of plain objects: a real page of a real answer'),
      schema: z.string().optional().describe('Instead of rows: a JSON Schema of one row or of an array of rows, or an OpenAPI document, as JSON'),
      fields: z.string().optional().describe('Instead of rows: a page\'s own fields, as JSON — its definition\'s `source.fields` — so the need counts each child a field names (`child`)'),
      status: z.string().optional().describe('The status fields its store works out, as JSON, as `statusFields(store, { … })` takes them (defs.v1.json statusField): {"health":{"type":"status","values":[{"value":"At risk","status":"critical","when":[{"score":{"lt":60}}]},{"value":"Healthy"}]}}. With rows, each row is given its value by the data layer\'s own statusFields()'),
      path: z.string().optional().describe('For an OpenAPI document: the path whose GET answers with the rows, e.g. /customers. Default: its first'),
      key: z.string().optional().describe('The field each row is known by. Default: id'),
      task: z.string().optional().describe('The agent\'s word for the work, for the need: browse, find, triage, edit, settings…'),
      writes: z.boolean().optional().describe('Whether a reader may change the rows, for the need'),
    },
  }, tool(async ({ rows, schema, fields: declared, status: given, path: openPath, key = 'id', task, writes }) => {
    if ([rows, schema, declared].filter((v) => v != null).length !== 1) return refuse('Give `rows`, a `schema` or a page\'s `fields`, one of them.');
    const dl = await dataLayer();
    const status = given == null ? null : json(given, 'status');
    const wrongStatus = status == null ? [] : statusProblems(status);
    if (wrongStatus.length) return refuse(`The status fields are not what statusFields() takes (defs.v1.json statusField):\n${wrongStatus.map((w) => `- ${w}`).join('\n')}`);
    const list = rows != null ? rowsOf(rows) : null;
    // A status field's values are the data's: its store works each out, as the app's does.
    const read = list && status ? await statusRows(dl, list, status, key) : list;
    const described = read ? { fields: fromRows(dl, read, key), via: `${read.length} row(s)`, uncarried: [] }
      : declared != null ? { fields: fromFields(json(declared, 'fields')), via: 'the page\'s fields', uncarried: [] }
        : fromSchema(json(schema, 'schema'), { path: openPath, key });
    withStatus(described.fields, status);
    const named = Object.fromEntries(described.fields.filter((f) => f.rules.length).map((f) => [f.name, f.rules]));
    const fields = Object.fromEntries(described.fields.filter((f) => f.field).map((f) => [f.name, f.field]));
    const need = needOf(described.fields, { rows: list?.length, task, writes, status: status ? Object.keys(status) : undefined, declared: declared != null });
    // Checked before it is given: each against the contract that takes it.
    const wrong = [
      ...ruleMap(dl, named).problems,
      ...Object.entries(fields).flatMap(([f, d]) => schemaCheck('defs.v1.json#/$defs/field')(d).map((e) => `fields.${f}${e}`)),
      ...schemaCheck('pattern.v1.json#/$defs/need')(need).map((e) => `need${e}`),
    ];
    if (wrong.length) return refuse(`describe_data made what its contracts refuse, which is its own fault:\n${wrong.map((w) => `- ${w}`).join('\n')}`);
    const out = [`## ${described.fields.length} field(s), from ${described.via}`, '', '### Store rules', ''];
    if (Object.keys(named).length) {
      out.push(fenced(JSON.stringify(named, null, 2), 'json'), '', 'As code, on the store, which checks every row it reads and writes:', '',
        fenced(`${ruleCode(named)}\nnew ArrayStore(rows, { key: ${JSON.stringify(key)}, schema });`, 'js'));
    } else out.push('None: nothing in the data argues for a rule.');
    out.push('', '#### Why each field has what it has', '');
    for (const f of described.fields) {
      const has = [f.rules.length ? f.rules.map((r) => (typeof r === 'string' ? r : Object.keys(r)[0])).join(', ') : 'no rule',
        f.field ? `a ${f.field.type ?? 'list'} field` : `no page field (${f.left ?? 'nothing to filter by'})`];
      out.push(`- \`${f.name}\` → ${has.join('; ')}${f.why.length ? ` — ${f.why.join('; ')}` : ''}`);
    }
    if (list) out.push('', 'Not drawn from a sample, by design: `required` but for the key (present is not promised), `min` and `max` (a sample cannot bound a store), `oneOf` (nor close a set), and any rule from a field\'s name.');
    if (described.uncarried.length) out.push('', '#### What the schema says that nothing here carries', '', ...described.uncarried.map((u) => `- ${u}`));
    out.push('', '### The page\'s fields', '', 'For its definition\'s `source.fields`. No field lists its values: the data says them.', '', fenced(JSON.stringify(fields, null, 2), 'json'));
    const unknown = [...(status ? [] : ['`statusFields` (give `status`: a status field is its store\'s)']), ...(declared != null ? [] : ['`childFields` (give the page\'s `fields`: a child is its page\'s)'])];
    out.push('', '### The need', '', `What pick_pattern picks a pattern by. Add the \`task\`, and whether the reader \`writes\`, when they are known.${unknown.length ? ` Left out, as a sample never shows them, so unknown, not none: ${unknown.join(', ')}.` : ''}`, '', fenced(JSON.stringify(need, null, 2), 'json'));
    out.push('', '### Next', '', '1. `validate_rows`: these rules against another page of rows. A rule that fits only the rows it was drawn from has proved nothing.',
      '2. The rules go on the STORE, never a form: a dialog, a paste and an answer reach the same rows.',
      '3. The fields go in the page definition; `validate_page` checks it.',
      '4. The need goes to `pick_pattern`, and the pattern it picks, with these rows, to `generate_page`.');
    return answer(out.join('\n'));
  }));

  server.registerTool('validate_rows', {
    title: 'Validate rows',
    description: 'Rows against store rules, as sherpa-ui/data checks them: the rules made by its own rules(), each row run through its own validate(), and the rows read through an ArrayStore that holds the schema, which drops each row it refuses. Says how many pass, why each refused row was refused, and which fields no rule checks. Rules are by name, as describe_data gives them: {"email":["required","email"],"seats":["number",{"min":0}]}.',
    inputSchema: {
      rules: z.string().describe('The rules, as JSON: field → a rule or a list of them. A rule is a name, "required", or { name: argument }, {"min": 0}. The rules: required, number, email, url, min, max, pattern, oneOf'),
      rows: z.string().describe('The rows, as a JSON array of plain objects'),
      key: z.string().optional().describe('The field each row is known by. Default: id'),
    },
  }, tool(async ({ rules: given, rows, key = 'id' }) => {
    const dl = await dataLayer();
    const { map, problems } = ruleMap(dl, json(given, 'rules'));
    if (problems.length) return refuse(`These rules cannot be made:\n${problems.map((p) => `- ${p}`).join('\n')}\n\n${RULE_FORM}`);
    const list = rowsOf(rows);
    const schema = dl.rules(map);
    const refused = [];
    for (const [i, row] of list.entries()) {
      const result = await dl.validate(schema, row);
      if (!dl.isValid(result)) refused.push({ i, row, issues: result.issues });
    }
    const read = await new dl.ArrayStore(list, { key, schema }).load({});
    const why = Object.groupBy(refused.flatMap((r) => r.issues.map((issue) => `\`${issue.path?.join('.') || '(row)'}\`: ${issue.message}`)), (s) => s);
    const fields = new Set(list.flatMap((r) => Object.keys(r)));
    const unchecked = [...fields].filter((f) => !(f in map));
    const absentFields = Object.keys(map).filter((f) => !fields.has(f));
    const out = [refused.length ? `## ${refused.length} of ${list.length} row(s) refused` : `## All ${list.length} row(s) pass`, '',
      `Read through an ArrayStore with this schema, ${read.dropped ?? 0} row(s) are dropped and ${read.total} reach a component.`];
    if (refused.length) {
      out.push('', '### Why', '', ...Object.entries(why).sort(([, a], [, b]) => b.length - a.length).map(([w, all]) => `- ${w} — ${all.length} row(s)`));
      out.push('', '### The first refused rows', '');
      for (const r of refused.slice(0, 5)) {
        const text = JSON.stringify(r.row);
        out.push(`- row ${r.i}: ${r.issues.map((issue) => `${issue.path?.join('.')}: ${issue.message}`).join('; ')} — \`${text.length > 160 ? `${text.slice(0, 159)}…` : text}\``);
      }
      if (refused.length > 5) out.push(`- …${refused.length - 5} more`);
    }
    if (unchecked.length || absentFields.length) {
      out.push('', '### Fields', '');
      if (unchecked.length) out.push(`- in the rows, checked by no rule: ${unchecked.map((f) => `\`${f}\``).join(', ')}`);
      if (absentFields.length) out.push(`- named by the rules, in no row: ${absentFields.map((f) => `\`${f}\``).join(', ')}`);
    }
    out.push('', refused.length
      ? 'A refused row never reaches a component, and the store says so in `dropped` and `issues`. Fix the rules or the data, not the screen.'
      : 'Put the rules on the store: `new ArrayStore(rows, { key, schema: rules({…}) })`.');
    return answer(out.join('\n'));
  }));

  server.registerTool('scaffold_app', {
    title: 'Scaffold an app',
    description: 'A new app\'s files, as `npm create sherpa-ui <folder>` writes them: one folder with no build — index.html (the shell and outlet.start()), app.json, one Context\'s template, page definition and Views, its store with seed rows, its module, package.json, .mcp.json and an AGENTS.md that says where each kind of file goes. Write each into an empty folder, then `npm install && npm start`. Read sherpa://app-guide before changing them; validate_app checks them.',
    inputSchema: {
      name: z.string().optional().describe('The app\'s name: its package.json takes it, lower case with hyphens. Default: sherpa-app'),
    },
  }, tool(async ({ name = 'sherpa-app' }) => {
    const files = await starterFiles(name);
    if (!files) return refuse('create-sherpa-ui is not here: install it beside sherpa-ui-mcp, or keep ../Sherpa Starter beside the sherpa-ui checkout.');
    const out = [`## A new app: ${files.length} files`, '', 'Write each into an empty folder, then `npm install && npm start`. `validate_app` checks them.', ''];
    for (const f of files) out.push(`### \`${f.path}\``, '', fenced(f.text), '');
    return answer(out.join('\n').trimEnd());
  }));
}
