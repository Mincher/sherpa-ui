/**
 * check.js — an app's files, checked by what sherpa-ui ships: ONE Ajv over every
 * contract in schemas/, the data layer's own reports, check-usage's
 * `markupProblems`, and the specs for each `ui`. Each problem is said in its
 * checker's words.
 *
 * Map:
 * - schemaCheck — a contract in schemas/, or a shape in it, as a check: a value → its errors, [] when valid
 * - dataLayer — sherpa-ui/data as it ships; it throws, saying why, when it is not built
 * - heard — what the data layer reports while a check runs, each in its own words and code
 * - withEntities — an app's entities (an entities.v3 file, or a list), its types registered while `run` runs, then taken back
 * - checkPageFiles — a Context's files: its definition, its Views, its template and each View's, and each `ui`
 * - checkAppFolder — an app.json and every file it names; each Context as checkPageFiles checks it
 * - usageOwn — a project's own hooks, from the sherpa-usage.json nearest an app's folder
 * - findings — what a check found, as an agent reads it, and how many problems
 */
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { appFile, imported, load, readSchema, schemas, spec } from './sherpa.js';

const Ajv = Ajv2020.default ?? Ajv2020;
let ajv;

/** Ajv's error, with what it names: the key it did not expect, the values it takes. */
function sayError(e) {
  const p = e.params ?? {};
  const named = p.additionalProperty ? `: "${p.additionalProperty}"`
    : p.allowedValues ? `: ${p.allowedValues.map((v) => JSON.stringify(v)).join(', ')}` : '';
  return `${e.instancePath || '/'} ${e.message}${named}`;
}

/** A contract in schemas/, or a shape in it (`defs.v1.json#/$defs/field`), as a check: a value → its errors, [] when it is valid. */
export function schemaCheck(ref) {
  if (!ajv) {
    // Every contract first, so one's `$ref` into another resolves.
    ajv = new Ajv({ allErrors: true, strict: false });
    for (const { name } of schemas()) ajv.addSchema(JSON.parse(readSchema(name)));
  }
  const validate = ajv.getSchema(new URL(ref, 'https://sherpa-ui.dev/schemas/').href);
  if (!validate) throw new Error(`schemaCheck: sherpa-ui's schemas/ has no ${ref}`);
  return (value) => (validate(value) ? [] : validate.errors.map(sayError));
}

/** sherpa-ui/data as it ships; it throws, saying why, when it is not built. */
export const dataLayer = () => imported('sherpa-ui/data');

/** What the data layer reports while `run` runs, each in its own words and code. `run` is synchronous, so no other call's report is heard. */
export function heard(dl, run) {
  const said = [];
  const undo = dl.onReport((r) => said.push(`${r.message} (${r.code})`));
  try {
    run();
  } finally {
    undo();
  }
  return said;
}

/** An app's entities, given as an entities.v3 file (`{ v, types, entities }`) or a list of them: its types registered while
 *  `run` runs, then taken back, so one call's types never reach the next. `run` is handed the entities and the node
 *  library they make, each a Custom Node by its use's kind. */
export async function withEntities(dl, given, run) {
  const file = typeof given === 'string' ? JSON.parse(given) : given ?? [];
  const list = Array.isArray(file) ? file : Object.values(file?.entities ?? {});
  const types = Object.entries(Array.isArray(file) ? {} : file?.types ?? {});
  const misnamed = types.find(([key, type]) => type?.id !== key);
  if (misnamed) throw new Error(`The type under "${misnamed[0]}" has the id ${JSON.stringify(misnamed[1]?.id ?? null)}: a type's key is its id (entities.v3).`);
  const undo = types.flatMap(([, type]) => dl.registerEntityType(type) ?? []);
  try {
    return await run(list, dl.libraryOf(list));
  } finally {
    for (const back of undo) back();
  }
}

/** JSON text as a value, or why it is not JSON. */
function parsed(text, name) {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { problem: `${name} is not JSON: ${error.message}` };
  }
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** Comments keep their length, as check-usage keeps them, so no element in one is read. */
const uncommented = (html) => html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));

/** Each element with an id in some markup: id → tag. */
function idsIn(html) {
  const ids = new Map();
  for (const [, tag, id] of uncommented(html).matchAll(/<([a-z][\w-]*)\b[^>]*?\sid="([^"]+)"/g)) if (!ids.has(id)) ids.set(id, tag);
  return ids;
}

/** A `<template id>`'s markup in a file, or null. */
function templateIn(html, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return uncommented(html).match(new RegExp(`<template\\b[^>]*\\sid="${escaped}"[^>]*>([\\s\\S]*?)</template>`))?.[1] ?? null;
}

/**
 * Each `ui` key against the spec of the element it names: a property or a
 * method of its `$extensions.sherpa` (defs.v1.json componentConfig). The
 * provider says the same at run time, once the page is open.
 * TRAP T-configuration-is-not-data
 */
function uiProblems(ui, ids, where) {
  const problems = [];
  for (const [id, config] of Object.entries(ui ?? {})) {
    const tag = ids.get(id);
    if (!tag) {
      problems.push(`${where}: #${id} is in no template, so nothing is configured (at run time: provider-unknown-element)`);
      continue;
    }
    // A native element is set as the DOM sets it; a tag no spec has, check_usage says.
    const s = tag.startsWith('sherpa-') ? spec(tag) : null;
    if (!s) continue;
    const ext = s.$extensions?.sherpa ?? {};
    const props = new Map((ext.jsProps ?? []).map((p) => [p.name, p]));
    const methods = new Set((ext.methods ?? []).map((m) => m.name));
    for (const key of Object.keys(isObject(config) ? config : {})) {
      if (methods.has(key)) continue;
      const p = props.get(key);
      if (!p) problems.push(`${where}: #${id} is a <${tag}>, which has no property or method "${key}" (at run time: provider-unknown-setting). get_component ${tag} lists them`);
      else if (p.access === 'read') problems.push(`${where}: #${id}'s "${key}" is read-only on <${tag}>, so it is refused (at run time: provider-refused-setting)`);
    }
  }
  return problems;
}

/**
 * A Context's files, as text, checked: its definition (page.v1, then
 * checkPage), its Views (views.v1, and each View's template read), its
 * template and each View's (check_usage), and each `ui` against the specs.
 * `viewFile(rel)` reads a file beside the Views: text, null when it is not
 * there, undefined when there is no folder to read it in.
 */
export async function checkPageFiles({ definition, views, template, viewFile = () => undefined, own = {}, names = {} }) {
  const dl = definition != null ? await dataLayer() : null;
  const { markupProblems } = await load('usage');
  const at = { definition: 'definition', views: 'views', template: 'template', ...names };
  const parts = [];
  let def = null;
  let id = null;

  if (definition != null) {
    const part = { name: names.definition ? `Definition (${names.definition})` : 'Definition', checked: 'page.v1.json, then checkPage', problems: [], notes: [] };
    const read = parsed(definition, at.definition);
    if (read.problem) part.problems.push(read.problem);
    else {
      def = read.value;
      id = typeof def?.id === 'string' ? def.id : null;
      part.problems.push(...schemaCheck('page.v1.json')(def), ...heard(dl, () => dl.checkPage(def)));
    }
    parts.push(part);
  }

  /** Each View's own markup, by its id — null for one whose template was not read; each file named, once, with its text. */
  const viewMarkup = new Map();
  const viewFiles = new Map();
  let library = null;
  if (views != null) {
    const part = { name: names.views ? `Views (${names.views})` : 'Views', checked: 'views.v1.json, and each View\'s template read', problems: [], notes: [] };
    const read = parsed(views, at.views);
    if (read.problem) part.problems.push(read.problem);
    else {
      library = isObject(read.value) ? read.value : null;
      part.problems.push(...schemaCheck('views.v1.json')(read.value));
      for (const [viewId, view] of Object.entries(library ?? {})) {
        if (viewId === '$schema' || typeof view?.template !== 'string' || !view.template.includes('#')) continue;
        const [file, name] = view.template.split('#');
        if (!viewFiles.has(file)) viewFiles.set(file, viewFile(file));
        const text = viewFiles.get(file);
        viewMarkup.set(viewId, text ? templateIn(text, name) : null);
        // TRAP T-a-views-markup-lives-in-a-template
        if (text === undefined) part.notes.push(`View "${viewId}" names ${view.template}: not read, as no folder was given for the files beside the Views`);
        else if (text === null) part.problems.push(`View "${viewId}" names ${view.template}, and ${file} is not beside the Views: it draws the page's own content`);
        else if (viewMarkup.get(viewId) == null) part.problems.push(`View "${viewId}" names ${view.template}, and ${file} holds no <template id="${name}">: it draws the page's own content (at run time: unknown-template)`);
      }
    }
    parts.push(part);
  }

  const marked = [...viewFiles].filter(([, text]) => typeof text === 'string');
  if (template != null || marked.length) {
    const part = { name: 'Markup', checked: 'check_usage, every sherpa-* tag, data-* and enum value against the specs', problems: [], notes: [] };
    let tags = 0;
    for (const [where, html] of [...(template != null ? [[at.template, template]] : []), ...marked]) {
      const found = markupProblems(html, where, own);
      part.problems.push(...found.problems);
      tags += found.tags;
    }
    part.notes.push(`${tags} tag(s) checked`);
    parts.push(part);
  }

  const configured = [
    ...(isObject(def?.ui) ? [[at.definition, def.ui, null]] : []),
    ...Object.entries(library ?? {}).filter(([, v]) => isObject(v?.ui)).map(([viewId, v]) => [`View "${viewId}"`, v.ui, viewId]),
  ];
  if (configured.length) {
    const part = { name: 'ui', checked: 'each id an element in the markup, each key a property or a method its spec lists', problems: [], notes: [] };
    if (template == null) part.notes.push('not checked: the ids are the template\'s, and no template was given');
    else {
      for (const [where, ui, viewId] of configured) {
        if (viewId && viewMarkup.get(viewId) === null) {
          part.notes.push(`${where}'s ui is not checked: its template was not read`);
          continue;
        }
        part.problems.push(...uiProblems(ui, idsIn(template + (viewId ? viewMarkup.get(viewId) ?? '' : '')), where));
      }
    }
    parts.push(part);
  }
  return { id, parts };
}

/** The files a Context names in app.json, by key. */
const FILES = ['template', 'definition', 'views', 'module'];

/**
 * An app.json, and every file it names, checked: app.v1, then checkApp; then
 * each Context, that its files are in the app's folder and as checkPageFiles
 * checks them; and the Settings pages' markup. `context` checks one Context alone.
 */
export async function checkAppFolder(target, { context } = {}) {
  const [folder, file] = /\.json$/i.test(target) ? [path.dirname(target), path.basename(target)] : [target, 'app.json'];
  const text = appFile(folder, file);
  if (text == null) throw new Error(`There is no ${file} in ${path.resolve(folder)}. Give the path of an app.json, or of the folder that holds it.`);
  const dl = await dataLayer();
  const { markupProblems } = await load('usage');
  const own = usageOwn(folder);
  const head = { name: file, checked: 'app.v1.json, then checkApp', problems: [], notes: [] };
  const read = parsed(text, file);
  if (read.problem) {
    head.problems.push(read.problem);
    return { title: `App (${file})`, parts: [head], pages: [] };
  }
  const app = read.value;
  head.problems.push(...schemaCheck('app.v1.json')(app), ...heard(dl, () => dl.checkApp(app)));
  const contexts = isObject(app?.contexts) ? app.contexts : {};
  if (context && !(context in contexts)) throw new Error(`${file} has no Context "${context}". Its Contexts: ${Object.keys(contexts).join(', ') || 'none'}.`);

  /** The files a Context or the Settings name, each read; one not in the folder is a problem of `part`. */
  const filesPart = () => ({ name: 'Files', checked: `each file it names is in the app's folder`, problems: [], notes: [] });
  const named = (part, key, rel) => {
    if (typeof rel !== 'string') return undefined;
    const got = appFile(folder, rel);
    if (got == null) part.problems.push(`${key} names "${rel}", which is not in the app's folder (at run time: context-file-unread)`);
    return got;
  };
  const pages = [];
  for (const [name, ctx] of Object.entries(contexts).filter(([n]) => !context || n === context)) {
    const files = filesPart();
    const got = Object.fromEntries(FILES.map((key) => [key, named(files, `contexts.${name}.${key}`, ctx?.[key])]));
    const views = typeof ctx?.views === 'string' ? path.posix.dirname(ctx.views) : '.';
    const page = await checkPageFiles({
      definition: got.definition ?? undefined,
      views: got.views ?? undefined,
      template: got.template ?? undefined,
      viewFile: (rel) => appFile(folder, path.posix.join(views, rel)),
      own,
      names: { definition: ctx.definition, views: ctx.views, template: ctx.template },
    });
    pages.push({ title: `Context "${name}"${page.id && page.id !== name ? ` (page "${page.id}")` : ''}`, parts: [files, ...page.parts] });
  }
  if (!context && isObject(app.settings)) {
    const files = filesPart();
    named(files, 'settings.module', app.settings.module);
    const part = { name: 'Markup', checked: 'check_usage on each Settings page\'s markup', problems: [], notes: [] };
    let tags = 0;
    for (const [name, page] of Object.entries(isObject(app.settings.pages) ? app.settings.pages : {})) {
      const html = named(files, `settings.pages.${name}.template`, page?.template);
      if (html == null) continue;
      const found = markupProblems(html, page.template, own);
      part.problems.push(...found.problems);
      tags += found.tags;
    }
    part.notes.push(`${tags} tag(s) checked`);
    pages.push({ title: 'Settings', parts: [files, part] });
  }
  if (Object.keys(own).length) head.notes.push(`the project's own hooks, from its sherpa-usage.json: ${Object.entries(own).map(([tag, list]) => `${tag} ${list.join(' ')}`).join('; ')}`);
  const title = `App${typeof app?.product?.name === 'string' ? ` "${app.product.name}"` : ''} (${path.join(path.resolve(folder), file)})`;
  return { title, parts: [head], pages };
}

/** A project's own hooks, from the sherpa-usage.json nearest an app's folder: up to the folder with its package.json. */
export function usageOwn(folder) {
  for (let dir = path.resolve(folder); ; dir = path.dirname(dir)) {
    const text = appFile(dir, 'sherpa-usage.json');
    if (text != null) return parsed(text, 'sherpa-usage.json').value?.own ?? {};
    if (appFile(dir, 'package.json') != null || path.dirname(dir) === dir) return {};
  }
}

/** One part, as an agent reads it: what was checked, then each problem and note beneath it. */
function sayPart(part) {
  const verdict = part.problems.length ? `${part.problems.length} problem(s)` : 'sound';
  return [`- **${part.name}** — ${part.checked}: ${verdict}`, ...part.problems.map((p) => `  - ${p}`), ...part.notes.map((n) => `  - _${n}_`)];
}

/** What a check found, as an agent reads it, and how many problems. `pages` are an app's Contexts, each under its own heading. */
export function findings({ title, parts, pages = [] }) {
  const count = (ps) => ps.reduce((n, p) => n + p.problems.length, 0);
  const total = count(parts) + pages.reduce((n, pg) => n + count(pg.parts), 0);
  const out = [`## ${title}: ${total ? `${total} problem(s)` : 'sound'}`, '', ...parts.flatMap(sayPart)];
  for (const page of pages) out.push('', `### ${page.title}: ${count(page.parts) ? `${count(page.parts)} problem(s)` : 'sound'}`, '', ...page.parts.flatMap(sayPart));
  return { text: out.join('\n'), problems: total };
}
