/**
 * check.js — the check tier's tools: an app, its markup and its data, checked.
 * Each is a thin wrapper over what sherpa-ui ships; scaffold_app gives a new
 * app's files, which validate_app checks.
 *
 *   validate_page  a Context's definition, Views and template, and each `ui`
 *   validate_app   an app.json, then every Context and Settings page it names
 *   check_usage    markup against the component specs
 *   check_custom_node  a Custom Node's JSON, checked as Save checks it: each fault in words, or the node it offers
 *   describe_data  rows, a JSON Schema or a page's fields → a type (type.v1), the controls a page keeps, and the need
 *   validate_rows  rows against a type, as a store made from it reads them
 *   scaffold_app   a new app's files: the Starter's, which validate_app checks
 *
 * Map:
 * - register — register the check tools on an MCP server
 */
import { z } from 'zod/v3';
import { appFile, load, starterFiles } from '../lib/sherpa.js';
import { checkAppFolder, checkPageFiles, dataLayer, findings, schemaCheck, typeProblems, withEntities } from '../lib/check.js';
import { fromRows, fromSchema, fromType, needOf, splitFields, statusProblems, typeOf, typedStore } from '../lib/describe.js';
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
      entities: z.string().optional().describe('The app\'s entities file, as JSON (entities.v3: `{ "v": 3, "types", "entities" }`, each type a type.v1 by its id), or a list of entities: its types are known, and a use of one of its entities is no fault'),
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
    description: 'Rows, a JSON Schema or an OpenAPI document, or a page\'s own fields, said in Sherpa\'s terms: a TYPE (type.v1), which says each field\'s data once, with the evidence for each field; the controls a page keeps, where a page\'s fields were given; and the need a pattern is picked by (pattern.v1.json), which pick_pattern takes. The data layer makes the store\'s rules, what a page knows of each field and a grid\'s columns from the type. From rows nothing is drawn from a field\'s name, and nothing a sample cannot show is proposed; from a schema, what it promises may be said, and what no type field carries is listed. A status field is the type\'s, so the need counts one only when `status` gives it, and a child is the page\'s, so only when `fields` are given. Each output is checked against its contract before it is given. validate_rows checks the type against rows; generate_page takes it.',
    inputSchema: {
      rows: z.string().optional().describe('The rows, as a JSON array of plain objects: a real page of a real answer'),
      schema: z.string().optional().describe('Instead of rows: a JSON Schema of one row or of an array of rows, or an OpenAPI document, as JSON'),
      fields: z.string().optional().describe('Instead of rows: a page\'s own fields, as JSON — its definition\'s `source.fields` — split into its type\'s words and the controls the page keeps'),
      status: z.string().optional().describe('The status fields its store works out, as JSON (defs.v1.json statusField), each a field of the type: {"health":{"type":"status","values":[{"value":"At risk","status":"critical","when":[{"score":{"lt":60}}]},{"value":"Healthy"}]}}'),
      id: z.string().regex(/^[a-z][a-z0-9-]*$/).optional().describe('The type\'s id: what one row is, e.g. customer. Default: record'),
      label: z.string().optional().describe('The type\'s name, as a reader reads it. Default: from its id'),
      path: z.string().optional().describe('For an OpenAPI document: the path whose GET answers with the rows, e.g. /customers. Default: its first'),
      key: z.string().optional().describe('The field each row is known by. Default: id'),
      task: z.string().optional().describe('The agent\'s word for the work, for the need: browse, find, triage, edit, settings…'),
      writes: z.boolean().optional().describe('Whether a reader may change the rows, for the need'),
    },
  }, tool(async ({ rows, schema, fields: declared, status: given, id, label, path: openPath, key = 'id', task, writes }) => {
    if ([rows, schema, declared].filter((v) => v != null).length !== 1) return refuse('Give `rows`, a `schema` or a page\'s `fields`, one of them.');
    const dl = await dataLayer();
    const status = given == null ? null : json(given, 'status');
    const wrongStatus = status == null ? [] : statusProblems(status);
    if (wrongStatus.length) return refuse(`The status fields are not what statusFields() takes (defs.v1.json statusField):\n${wrongStatus.map((w) => `- ${w}`).join('\n')}`);
    const list = rows != null ? rowsOf(rows) : null;
    const split = declared != null ? splitFields(json(declared, 'fields')) : null;
    const described = list ? { fields: fromRows(dl, list, key), via: `${list.length} row(s)`, uncarried: [] }
      : split ? { fields: split.fields, via: 'the page\'s fields', uncarried: [] }
        : fromSchema(json(schema, 'schema'), { path: openPath, key });
    if (!described.fields.some((f) => f.name === key && f.field)) return refuse(`The key, "${key}", is no field of the data: name the row's key with \`key\`.`);
    const type = typeOf(described.fields, { id, label, key, status });
    const page = split ? split.page : {};
    // What a page keeps of it: the free text it searches (every value differs), and each control a page's fields gave.
    const search = described.fields.filter((f) => f.search).map((f) => f.name);
    const own = { ...(search.length ? { search } : {}), ...(Object.keys(page).length ? { fields: page } : {}) };
    const need = needOf(fromType(type, split?.page), { rows: list?.length, task, writes, status: status != null, declared: !!split });
    // Checked before it is given: each against the contract that takes it, and a status field as statusFields() works it out.
    const wrong = [
      ...typeProblems(dl, type),
      ...Object.entries(page).flatMap(([f, d]) => schemaCheck('defs.v1.json#/$defs/field')(d).map((e) => `fields.${f}${e}`)),
      ...schemaCheck('pattern.v1.json#/$defs/need')(need).map((e) => `need${e}`),
    ];
    if (status && !wrong.length) {
      try {
        dl.statusFields(new dl.ArrayStore([]), dl.typeStatusFields(type));
      } catch (error) {
        wrong.push(error.message);
      }
    }
    if (wrong.length) return refuse(`describe_data made what its contracts refuse${status ? ', or a status field it cannot work out' : ', which is its own fault'}:\n${wrong.map((w) => `- ${w}`).join('\n')}`);
    const out = [`## ${described.fields.length} field(s), from ${described.via}`, '', '### The type', '',
      `Each field's data, said once (type.v1). Save it as \`types/${type.id}.json\`.`, '', fenced(JSON.stringify(type, null, 2), 'json'), '',
      'The store is made from it, and checks every row it reads and writes; a page over it knows each field\'s words:', '',
      fenced(`import { ArrayStore, statusFields, typeStatusFields, typeStoreOptions } from 'sherpa-ui/data';\n\nconst store = statusFields(new ArrayStore(rows, typeStoreOptions(type)), typeStatusFields(type));`, 'js'),
      '', '#### Why each field has what it has', ''];
    for (const f of described.fields) {
      const has = f.field ? Object.entries(f.field).filter(([k]) => k !== 'label' && k !== 'description').map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(', ') || 'text' : `left out (${f.left})`;
      const note = f.field && f.left && f.left !== 'the key' ? `; ${f.left}` : '';
      out.push(`- \`${f.name}\` → ${has}${note}${f.why.length ? ` — ${f.why.join('; ')}` : ''}`);
    }
    for (const name of Object.keys(status ?? {})) out.push(`- \`${name}\` → a status field: its store works it out`);
    if (list) out.push('', 'Not drawn from a sample, by design: `required` but for the key (present is not promised), `min` and `max` (a sample cannot bound a store), `values` (nor close a set), and anything from a field\'s name.');
    if (described.uncarried.length) out.push('', '#### What the schema says that nothing here carries', '', ...described.uncarried.map((u) => `- ${u}`));
    if (Object.keys(own).length) {
      out.push('', '### The page\'s own', '', 'For its definition\'s `source`: only what its controls do — what it searches, and each field\'s control. The words are the type\'s. generate_page takes it as `source`.', '', fenced(JSON.stringify(own, null, 2), 'json'));
    }
    const unknown = [...(status ? [] : ['`statusFields` (give `status`: a status field is its type\'s)']), ...(split ? [] : ['`childFields` (give the page\'s `fields`: a child is its page\'s)'])];
    out.push('', '### The need', '', `What pick_pattern picks a pattern by. Add the \`task\`, and whether the reader \`writes\`, when they are known.${unknown.length ? ` Left out, as a sample never shows them, so unknown, not none: ${unknown.join(', ')}.` : ''}`, '', fenced(JSON.stringify(need, null, 2), 'json'));
    out.push('', '### Next', '', '1. `validate_rows`: this type against another page of rows. A type that fits only the rows it was drawn from has proved nothing.',
      '2. The type goes on the STORE, never a form: a dialog, a paste and an answer reach the same rows.',
      '3. The need goes to `pick_pattern`, and the pattern it picks, with this type and the page\'s own `source`, to `generate_page`.');
    return answer(out.join('\n'));
  }));

  server.registerTool('validate_rows', {
    title: 'Validate rows',
    description: 'Rows against a type (type.v1), as sherpa-ui/data checks them: the rules its typeSchema() makes, each row run through its own validate(), and the rows read through a store made from the type (typeStoreOptions, with its status fields), which drops each row it refuses. Says how many pass, why each refused row was refused, and which fields the type does not name. The type is checked first: its schema, then typeFaults().',
    inputSchema: {
      type: z.string().describe('The type, as JSON (type.v1), as describe_data gives it: { "v": 1, "id", "label", "fields": { "seats": { "type": "number", "min": 0 } } }'),
      rows: z.string().describe('The rows, as a JSON array of plain objects'),
    },
  }, tool(async ({ type: given, rows }) => {
    const dl = await dataLayer();
    const type = json(given, 'type');
    const problems = typeProblems(dl, type);
    if (problems.length) return refuse(`The type is not one (type.v1):\n${problems.map((p) => `- ${p}`).join('\n')}`);
    const list = rowsOf(rows);
    const schema = dl.typeSchema(type);
    const refused = [];
    for (const [i, row] of list.entries()) {
      const result = await dl.validate(schema, row);
      if (!dl.isValid(result)) refused.push({ i, row, issues: result.issues });
    }
    const read = await typedStore(dl, list, { type }).load({});
    const why = Object.groupBy(refused.flatMap((r) => r.issues.map((issue) => `\`${issue.path?.join('.') || '(row)'}\`: ${issue.message}`)), (s) => s);
    const fields = new Set(list.flatMap((r) => Object.keys(r)));
    const named = Object.entries(type.fields);
    const unnamed = [...fields].filter((f) => !(f in type.fields));
    const absentFields = named.filter(([f, d]) => d.type !== 'status' && !d.from && !fields.has(f)).map(([f]) => f);
    const out = [refused.length ? `## ${refused.length} of ${list.length} row(s) refused` : `## All ${list.length} row(s) pass`, '',
      `Read through a store made from the type, ${read.dropped ?? 0} row(s) are dropped and ${read.total} reach a component.`];
    if (refused.length) {
      out.push('', '### Why', '', ...Object.entries(why).sort(([, a], [, b]) => b.length - a.length).map(([w, all]) => `- ${w} — ${all.length} row(s)`));
      out.push('', '### The first refused rows', '');
      for (const r of refused.slice(0, 5)) {
        const text = JSON.stringify(r.row);
        out.push(`- row ${r.i}: ${r.issues.map((issue) => `${issue.path?.join('.')}: ${issue.message}`).join('; ')} — \`${text.length > 160 ? `${text.slice(0, 159)}…` : text}\``);
      }
      if (refused.length > 5) out.push(`- …${refused.length - 5} more`);
    }
    if (unnamed.length || absentFields.length) {
      out.push('', '### Fields', '');
      if (unnamed.length) out.push(`- in the rows, not in the type: ${unnamed.map((f) => `\`${f}\``).join(', ')}`);
      if (absentFields.length) out.push(`- in the type, in no row: ${absentFields.map((f) => `\`${f}\``).join(', ')}`);
    }
    out.push('', refused.length
      ? 'A refused row never reaches a component, and the store says so in `dropped` and `issues`. Fix the type or the data, not the screen.'
      : 'Make the store from the type: `new ArrayStore(rows, typeStoreOptions(type))`.');
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
