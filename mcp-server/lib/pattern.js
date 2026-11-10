/**
 * pattern.js — a pattern (pattern.v1.json; plan 700 §3): Sherpa's and an app's,
 * checked by the contracts it reuses, picked by its `when` run over the need with
 * the data layer's own condition, and its layout written as HTML. Nothing here is
 * a second contract: a layout node is a spec's anatomy node, `when` a `where`, and
 * `page` a page definition's. TRAP T-a-pattern-is-checked-by-the-contracts-it-reuses
 *
 * Map:
 * - KINDS — the kinds of field a node may stand for one of (`each`), and the need's count of each
 * - patternsFor — Sherpa's patterns and an app's, by id, each with its text: an app's wins an id; and each refused
 * - expandScopes — a pattern's scopes, each `{kind}` in a field list the fields of that kind
 * - drawsViewBar — whether a layout draws the View's own filter bar, so its Context takes the header's away
 * - checkPattern — every problem in a pattern, by where it is, and what each role draws; with a need, against it too
 * - pickPattern — the patterns whose `when` holds for the need, highest rank first, each with the parts that held
 * - writeLayout — a layout as HTML: each `each` once per field of its kind, its tokens filled
 */
import path from 'node:path';
import { appFile, appFiles, load, patterns, read, readSchema, spec } from './sherpa.js';
import { checkPageFiles, heard, schemaCheck } from './check.js';

/** The kinds of field a node may stand for one of (`each`), and the need's count of each. */
export const KINDS = {
  field: 'fields', dateField: 'dateFields', numberField: 'numberFields', statusField: 'statusFields', childField: 'childFields',
};

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** One pattern file's text as a pattern; its problem when it is not JSON. */
function parsed(text, file) {
  try {
    return { pattern: JSON.parse(text) };
  } catch (error) {
    return { problem: `${file} is not JSON: ${error.message}` };
  }
}

/**
 * Sherpa's patterns (sherpa-ui's patterns/) and an app's (a patterns/ folder
 * beside its app.json, Q4): an app's replaces Sherpa's of the same id. `folder`
 * is the app's folder, or its app.json; none, or one with no app.json, adds none.
 * A file that is not JSON, or not a pattern by pattern.v1.json, is refused, and says why.
 */
export function patternsFor(folder) {
  const check = schemaCheck('pattern.v1.json');
  const found = new Map();
  const refused = [];
  const take = (text, file, from) => {
    const { pattern, problem } = parsed(text, file);
    const wrong = problem ? [problem] : check(pattern);
    if (wrong.length) return refused.push({ file, from, problems: wrong });
    const replaces = found.get(pattern.id);
    found.set(pattern.id, { pattern, text, file, from, ...(replaces && replaces.from !== from ? { replaces: replaces.file } : {}) });
  };
  for (const name of patterns()) take(read('pattern', { name }), `patterns/${name}.json`, 'sherpa');
  const root = folder && (/\.json$/i.test(folder) ? path.dirname(folder) : folder);
  if (root && appFile(root, 'app.json') != null) {
    for (const f of appFiles(root, 'patterns').filter((n) => n.endsWith('.json'))) take(appFile(root, `patterns/${f}`), `patterns/${f}`, 'app');
  }
  return { patterns: [...found.values()].sort((a, b) => (a.pattern.id < b.pattern.id ? -1 : 1)), refused };
}

// ── What a child IS, in a slot's words (T-a-slot-says-what-it-accepts) ──

/** The Sherpa roles: a slot that takes ONE kind of component names it. */
const ROLES = new Set(['item', 'menu', 'legend', 'header', 'footer', 'nav', 'panel', 'dialog', 'toolbar', 'badge']);
/** A component its name does not say the role of. */
const ALSO = {
  'sherpa-breadcrumbs': ['nav'],
  // A metric group's slot holds 1 to 4 of them.
  'sherpa-metric': ['item'],
  'sherpa-nav-section': ['item'],
  'sherpa-node-row': ['item'],
  // A card's pager brings its own rule and padding: it IS the card's footer.
  'sherpa-pagination': ['footer'],
  // Turned portrait, the filter toolbar is the filter panel.
  'sherpa-quick-filter-toolbar': ['panel'],
};
/** Each native element a pattern may write, and what it is beyond content. `div` fits any slot: it is a wrapper. */
const NATIVE = {
  div: ['*'], section: [], article: [], aside: [], main: [], header: ['header'], footer: ['footer'], nav: ['nav'],
  form: [], fieldset: [], dialog: ['dialog'], details: [], summary: ['control'], figure: [], figcaption: ['text'],
  p: ['text'], span: ['text'], strong: ['text'], em: ['text'], b: ['text'], i: ['text'], small: ['text'], mark: ['text'],
  code: ['text'], kbd: ['text'], abbr: ['text'], time: ['text'], label: ['text'], br: ['text'], pre: ['text'],
  h1: ['text'], h2: ['text'], h3: ['text'], h4: ['text'], h5: ['text'], h6: ['text'], hr: [],
  ul: [], ol: [], li: ['item'], dl: [], dt: ['item'], dd: ['item'],
  table: [], thead: [], tbody: [], tfoot: [], tr: [], th: [], td: [], caption: ['text'],
  a: ['control'], button: ['control'], input: ['control', 'input'], select: ['control', 'input'], textarea: ['control', 'input'],
  output: ['text'], progress: [], meter: [], img: ['icon'], svg: ['icon'], picture: ['icon'],
};
const VOID = new Set(['br', 'hr', 'img', 'input']);

/** What an element is, in a slot's words: content, HTML's categories, and its Sherpa role. */
function isWords(tag, s) {
  if (!s) return new Set(['content', ...(NATIVE[tag] ?? [])]);
  const words = new Set(['content', ...(ALSO[tag] ?? [])]);
  const last = tag.split('-').at(-1);
  if (ROLES.has(last)) words.add(last);
  const named = (s.props ?? []).some((p) => p.name === 'name');
  if (named) words.add('input');
  if (named || s.$extensions?.sherpa?.category === 'control') words.add('control');
  return words;
}

// ── What a data role draws: its ask's shape, against the kind of field it stands for ──

/** Each shape a component asks for (component.v1.json `shape`): what it draws, and the kinds of field it can draw ONE of. */
const SHAPES = {
  rows: { is: 'a page of rows', one: [] },
  all: { is: 'every matching row', one: [] },
  state: { is: 'the view state alone', one: [] },
  scope: { is: 'its scope\'s filters', one: [] },
  aggregate: { is: 'one number over the rows', one: ['field', 'numberField', 'dateField', 'statusField', 'childField'] },
  segments: { is: 'the rows split by a list\'s values — never a number\'s or a date\'s', one: ['field', 'statusField', 'childField'] },
  series: { is: 'a number over a date', one: ['dateField'] },
};

/** The kind of Show a node draws (its component's `presents`): the one whose `is` its attrs agree with, else its first; null when its attrs pick none. */
function presented(s, attrs) {
  const kinds = s.presents ?? [];
  const said = (a) => (attrs?.[a] === true ? '' : String(attrs?.[a]));
  const set = [...new Set(kinds.flatMap((k) => Object.keys(k.is ?? {})))].filter((a) => attrs?.[a] !== undefined && attrs[a] !== false);
  if (!set.length) return kinds[0];
  return kinds.find((k) => set.every((a) => k.is?.[a] === said(a))) ?? null;
}

/** One attribute as HTML writes it: a bare name for true, none for false. */
const attr = (key, value) => (value === true ? ` ${key}` : value === false || value == null ? '' : ` ${key}="${String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`);

// ── Tokens: {id} anywhere; {field} and {label} under an `each`; {kind} in a scope's field lists ──

const TOKEN = /\{(\w+)\}/g;
const fill = (text, vars) => String(text).replace(TOKEN, (all, name) => (name in vars ? vars[name] : all));

/** Each node with where it is, its parent, the `each` it stands for (its own or one above it) and the one above it; depth first. */
function walk(node, at = 'layout', parent = null, above = null, out = []) {
  if (!isObject(node)) return out;
  const each = node.each ?? above;
  out.push({ node, at, parent, each, above });
  (Array.isArray(node.children) ? node.children : []).forEach((child, i) => walk(child, `${at}.children[${i}]`, node, each, out));
  return out;
}
const tagOf = (node) => node.component ?? node.el;

/** A stand-in field for each kind, so a scope's `{kind}` names a field a page declares. */
const STAND_IN = {
  field: { label: 'A field', select: 'multiple' }, dateField: { label: 'A date', type: 'date' },
  numberField: { label: 'A number', type: 'number' }, statusField: { label: 'A status', select: 'multiple' },
  childField: { label: 'A child', select: 'multiple' },
};
const SCOPE_LISTS = ['holds', 'fixed', 'alwaysOn', 'offers'];
/** A part of a page `agent.may` may name, beside a role. */
const PAGE_PARTS = new Set(['columns', 'actions', 'presets', 'fields', 'scopes', 'search', 'saved-filters', 'views']);

/** A pattern's scopes, each `{kind}` in a field list (`holds`, `fixed`, `alwaysOn`, `offers`) the names of the fields of that kind. */
export function expandScopes(scopes, kinds) {
  if (!isObject(scopes)) return scopes;
  return Object.fromEntries(Object.entries(scopes).map(([id, scope]) => {
    const out = { ...scope };
    for (const list of SCOPE_LISTS) {
      if (!Array.isArray(scope?.[list])) continue;
      out[list] = [...new Set(scope[list].flatMap((name) => {
        const kind = /^\{(\w+)\}$/.exec(name)?.[1];
        return kind ? (kinds[kind] ?? []).map((f) => f.name) : [name];
      }))];
    }
    return [id, out];
  }));
}

/** Whether a layout draws the View's own filter bar (a filter toolbar whose `data-scope` names `view`): its Context then takes the header's away. */
export function drawsViewBar(layout) {
  return walk(layout).some(({ node }) => tagOf(node) === 'sherpa-quick-filter-toolbar' && String(node.attrs?.['data-scope'] ?? '').split(/\s+/).includes('view'));
}

/**
 * Every problem in a pattern, by where it is in it, and what each role draws.
 * The schema first (pattern.v1.json); then each node — its element a component
 * with a spec or a native element, its `data-*` the component's own (check-usage's
 * own check), its tokens, its slot one its parent has and accepts it in; each
 * role that draws data, by its component's `asks` and `presents`; `page` as
 * page.v1 and checkPage take it, and its `ui` against the specs; `agent`'s roles.
 * With a need, each role is held to it as well.
 */
export async function checkPattern(pattern, { need } = {}) {
  const problems = [];
  const notes = [];
  const roles = [];
  const shape = schemaCheck('pattern.v1.json')(pattern);
  problems.push(...shape.map((e) => `pattern: ${e}`));
  if (!isObject(pattern) || !isObject(pattern.layout)) return { problems, notes, roles };
  const { markupProblems } = await load('usage');
  const nodes = walk(pattern.layout);

  for (const { node, at, parent, each, above } of nodes) {
    const tag = tagOf(node);
    if (node.el && node.component) problems.push(`${at}: names both el "${node.el}" and component "${node.component}"; a node is one element`);
    if (typeof tag !== 'string' || !tag) {
      problems.push(`${at}: names no element (el)`);
      continue;
    }
    const s = tag.includes('-') ? spec(tag) : null;
    if (tag.includes('-') && !s) problems.push(`${at}: <${tag}> is no Sherpa component${tag.startsWith('sherpa-') ? '' : ', and no native element'}`);
    else if (!tag.includes('-') && !(tag in NATIVE)) problems.push(`${at}: <${tag}> is not an element a page writes`);
    const attrs = isObject(node.attrs) ? node.attrs : {};
    // check-usage's own check, on this one element: its data-* and their values.
    const open = `<${tag}${Object.entries({ ...attrs, ...(node.class ? { class: node.class } : {}) }).map(([k, v]) => attr(k, v)).join('')}>`;
    if (s || tag in NATIVE) problems.push(...markupProblems(open, at).problems.map((p) => p.replace(`${at}:1  `, `${at}: `)));
    for (const [key, value] of Object.entries(attrs)) {
      for (const [, name] of String(value).matchAll(TOKEN)) {
        if (name === 'id') continue;
        if (name === 'field' || name === 'label') {
          if (!each) problems.push(`${at}: ${key}="${value}" names {${name}}, and no each above it says which field`);
        } else problems.push(`${at}: ${key}="${value}" names {${name}}: a node's tokens are {id}, and {field} and {label} under an each`);
      }
    }
    if (node.max !== undefined && !node.each) problems.push(`${at}: max ${node.max} limits nothing: it has no each`);
    if (node.each && above) problems.push(`${at}: each ${node.each} under an each ${above}: one node stands for one kind of field`);

    // Its slot: one its parent has, which takes what it is.
    const ps = parent && tagOf(parent)?.includes('-') ? spec(tagOf(parent)) : null;
    const slotName = typeof attrs.slot === 'string' ? attrs.slot : '';
    if (ps) {
      const slot = (ps.slots ?? []).find((sl) => sl.name === slotName);
      const words = isWords(tag, s);
      if (!slot) {
        problems.push(slotName
          ? `${at}: <${tagOf(parent)}> has no slot "${slotName}"; its slots: ${(ps.slots ?? []).map((sl) => sl.name || '(default)').join(', ') || 'none'}`
          : `${at}: <${tagOf(parent)}> has no default slot, so <${tag}> is never shown; give it a slot: ${(ps.slots ?? []).map((sl) => sl.name).join(', ') || 'it has none'}`);
      } else if (!words.has('*') && !slot.accepts.some((w) => words.has(w))) {
        problems.push(`${at}: <${tagOf(parent)}>'s ${slotName ? `"${slotName}" slot` : 'default slot'} accepts ${slot.accepts.join(', ')}, and <${tag}> is ${[...words].join(', ')}`);
      }
    } else if (parent && slotName) {
      problems.push(`${at}: slot="${slotName}" under <${tagOf(parent)}> does nothing: only a component has slots`);
    }

    // A role that draws data: what its component asks for, against the kind of field it stands for.
    const shape = s?.asks?.shape;
    if (shape) {
      const kind = s.presents?.length ? presented(s, attrs) : null;
      if (s.presents?.length && !kind) problems.push(`${at}: <${tag}> presents ${s.presents.map((k) => `${k.kind} (${JSON.stringify(k.is ?? {})})`).join(', ')}, and its attrs pick none of them`);
      if (each && !SHAPES[shape]?.one.includes(each)) {
        problems.push(`${at}: <${tag}> asks for ${shape}, ${SHAPES[shape]?.is ?? 'a shape'}, so it cannot draw one ${each} (each): it draws one ${SHAPES[shape]?.one.join(', ') || 'field of no kind'}`);
      }
      roles.push({ role: node.role ?? null, at, tag, shape, ...(kind ? { kind: kind.kind } : {}), ...(each ? { each } : {}), ...(node.max ? { max: node.max } : {}), own: !!node.each });
    } else if (node.role) roles.push({ role: node.role, at, tag, ...(node.each ? { each: node.each } : {}), ...(node.max ? { max: node.max } : {}), own: !!node.each });
  }

  // Roles: what agent names must be in the layout.
  const named = new Set(nodes.map(({ node }) => node.role).filter(Boolean));
  for (const role of pattern.agent?.keeps ?? []) if (!named.has(role)) problems.push(`agent.keeps names "${role}", which is no role of the layout: ${[...named].join(', ') || 'it has none'}`);
  for (const part of pattern.agent?.may ?? []) {
    if (!named.has(part) && !PAGE_PARTS.has(part)) problems.push(`agent.may names "${part}", which is no role of the layout and no part of a page (${[...PAGE_PARTS].join(', ')})`);
  }

  // The page: as page.v1 and checkPage take it, its scopes' {kind} a stand-in field; its ui against the layout's elements.
  if (isObject(pattern.page)) {
    for (const [id, scope] of Object.entries(isObject(pattern.page.scopes) ? pattern.page.scopes : {})) {
      for (const list of SCOPE_LISTS) {
        for (const name of Array.isArray(scope?.[list]) ? scope[list] : []) {
          const kind = /^\{(\w+)\}$/.exec(name)?.[1];
          if (kind && !(kind in KINDS)) problems.push(`page.scopes.${id}.${list}: {${kind}} is no kind of field: ${Object.keys(KINDS).map((k) => `{${k}}`).join(', ')}`);
          else if (!kind) problems.push(`page.scopes.${id}.${list}: "${name}" names a field, and a pattern's fields are the data's: name a kind, {statusField}`);
        }
      }
    }
    const kinds = Object.fromEntries(Object.keys(KINDS).map((k) => [k, [{ name: k, label: STAND_IN[k].label }]]));
    const definition = {
      v: 1, id: pattern.id,
      ...(pattern.page.scopes ? { source: { store: pattern.id, fields: STAND_IN, scopes: expandScopes(pattern.page.scopes, kinds) } } : {}),
      ...(pattern.page.ui ? { ui: pattern.page.ui } : {}),
    };
    const page = await checkPageFiles({ definition: JSON.stringify(definition), template: writeLayout(pattern.layout, { kinds, id: pattern.id }) });
    // The schema's words on `page` are said once, above; checkPage's and the ui check's are its own.
    const said = shape.some((e) => e.startsWith('/page'));
    for (const part of page.parts.filter((p) => p.name !== 'Markup')) {
      for (const p of part.problems) if (!(said && p.startsWith('/'))) problems.push(`page${part.name === 'ui' ? '.ui' : ''}: ${p.replace(/^definition: /, '')}`);
    }
  }

  // With a need: each role that stands for a kind of field draws as many as the need has.
  if (need) {
    const kept = new Set(pattern.agent?.keeps ?? []);
    const lists = (need.fields ?? 0) - (need.dateFields ?? 0) - (need.numberFields ?? 0);
    for (const r of roles) {
      const count = r.own ? need[KINDS[r.each]] ?? 0 : null;
      if (count === 0) (kept.has(r.role) ? problems : notes).push(`${r.at}: ${r.role ?? `<${r.tag}>`} stands for each ${r.each}, and the need has none${kept.has(r.role) ? ', and agent.keeps it' : ', so none is drawn'}`);
      if (!r.each && r.shape === 'segments' && lists <= 0 && !need.statusFields) problems.push(`${r.at}: <${r.tag}> splits rows by a list's values, and the need has no list field`);
      if (!r.each && r.shape === 'series' && !need.dateFields) problems.push(`${r.at}: <${r.tag}> draws a number over a date, and the need has no date field`);
    }
  }
  return { problems, notes, roles };
}

/** How the need's fields are typed, from its contract: an integer is a number. */
function needTypes() {
  const props = JSON.parse(readSchema('pattern')).$defs.need.properties;
  return (field) => (props[field]?.type === 'integer' ? { type: 'number' } : {});
}

/**
 * The patterns whose `when` holds for the need: the need as ONE row, through the
 * data layer's own `parseWhere`, `conditionClause` and `filterRows`. Highest
 * `rank` first (none is 0), then by id; each with every part of its `when`, and
 * whether it held. Those that do not fit come after, and what the data layer said.
 */
export function pickPattern(dl, need, list) {
  const typed = needTypes();
  const holds = (where) => dl.filterRows([need], dl.conditionClause(dl.parseWhere(where), undefined, typed)).length === 1;
  const fit = [];
  const unfit = [];
  const said = heard(dl, () => {
    for (const entry of list) {
      const { when = {} } = entry.pattern;
      const parts = Object.entries(when).map(([field, condition]) => ({ field, condition, value: need[field], holds: holds({ [field]: condition }) }));
      (holds(when) ? fit : unfit).push({ ...entry, parts });
    }
  });
  const order = (a, b) => (b.pattern.rank ?? 0) - (a.pattern.rank ?? 0) || (a.pattern.id < b.pattern.id ? -1 : 1);
  return { fit: fit.sort(order), unfit: unfit.sort(order), said };
}

/**
 * A layout as HTML, two spaces a level. A node with `each` is written once for
 * each field of its kind, at most `max`, its subtree's {field} and {label} that
 * field's; {id} is the page's anywhere. `kinds` is each kind's fields, `{ name, label }`.
 */
export function writeLayout(layout, { kinds = {}, id = '' } = {}) {
  const lines = [];
  const write = (node, depth, vars) => {
    if (!isObject(node)) return;
    if (node.each && !('field' in vars)) {
      for (const f of (kinds[node.each] ?? []).slice(0, node.max ?? Infinity)) write(node, depth, { ...vars, field: f.name, label: f.label });
      return;
    }
    const tag = tagOf(node);
    const pad = '  '.repeat(depth);
    const attrs = { ...(node.class ? { class: node.class } : {}), ...(isObject(node.attrs) ? node.attrs : {}), ...(node.part ? { part: node.part } : {}) };
    const open = `${pad}<${tag}${Object.entries(attrs).map(([k, v]) => attr(k, typeof v === 'string' ? fill(v, vars) : v)).join('')}>`;
    const children = Array.isArray(node.children) ? node.children : [];
    if (VOID.has(tag)) lines.push(open);
    else if (!children.length) lines.push(`${open}</${tag}>`);
    else {
      lines.push(open);
      for (const child of children) write(child, depth + 1, vars);
      lines.push(`${pad}</${tag}>`);
    }
  };
  write(layout, 0, { id });
  return `${lines.join('\n')}\n`;
}
