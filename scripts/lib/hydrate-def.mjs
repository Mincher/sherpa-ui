/**
 * hydrate-def.mjs — expand a THIN def + the shared element-map into a FULL def.
 *
 * A thin def carries only a component's shape and its exceptions. The systematic
 * parts — el→node defaults, prop-kind→figma mechanism, the status contract, event
 * defaults, the boilerplate `overrides` block, the derived `figma` summary — come
 * from element-map.yaml. hydrate() reconstructs the full object the pipeline reads,
 * so nothing downstream changes.
 *
 * Round-trip guarantee: hydrate(thin) must deep-equal the legacy full def. The
 * guard script enforces it; if it ever drifts, the build fails.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAP = yaml.load(readFileSync(join(ROOT, 'scripts/figma-data/element-map.yaml'), 'utf8'));

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** "data-icon" → "Icon"; "data-quick-filter" → "QuickFilter" */
const stemOf = (name) => name.replace(/^data-/, '').split('-').map(cap).join('');

// ── anatomy ──────────────────────────────────────────────────────────────────
// Thin nodes are keyed `class(el)` (root) or named specially (`dismiss`, an owned
// child). Expand each to the full { el, class, part, figma, children } shape.
function hydrateNode(key, body, { isRoot = false } = {}) {
  const out = {};
  const m = /^([\w-]+)\(([\w-]+)\)$/.exec(key);   // class(el) — el may be a hyphenated custom element
  if (body.el) out.el = body.el;                   // el carried in body (multi-class or no class)
  if (m) {
    out.el = m[2];
    out.class = m[1];
  } else {
    out.class = body.class ?? key;                 // body.class wins for multi-class nodes
  }
  if (body.owns) { out.component = body.owns; out.relationship = body.relationship ?? 'owned'; }

  // root part always equals class; every other node replays its part verbatim
  if (isRoot) out.part = out.class;
  else if (body.part) out.part = body.part;

  if ('slot' in body) out.slot = body.slot;
  if (body.showWhen) out.showWhen = body.showWhen;
  if (body.attrs) out.attrs = body.attrs;

  // figma node: explicit, else defaulted from the element table
  if (body.figma) out.figma = body.figma;
  else if (out.el && MAP.elements[out.el]) out.figma = { node: MAP.elements[out.el].node };

  if (body.listen) out.listen = body.listen;

  if (body.children) {
    out.children = body.children.map((child) => {
      const [ckey, cbody] = Object.entries(child)[0];
      return hydrateNode(ckey, cbody);
    });
  }
  return out;
}

// field order the legacy writer used — keep it so the round-trip is byte-stable
const ROOT_ORDER = ['el', 'class', 'part', 'slot', 'attrs', 'figma', 'children'];
const CHILD_ORDER = ['el', 'component', 'relationship', 'class', 'part', 'slot', 'showWhen', 'attrs', 'figma', 'listen'];
function order(obj, keys) {
  const o = {};
  for (const k of keys) if (k in obj) o[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in o)) o[k] = obj[k];
  return o;
}
function orderTree(node, isRoot) {
  const keys = isRoot ? ROOT_ORDER : CHILD_ORDER;
  const o = order(node, keys);
  if (o.children) o.children = o.children.map((c) => orderTree(c, false));
  return o;
}

// ── props ─────────────────────────────────────────────────────────────────────
function hydrateProps(props) {
  return Object.entries(props).map(([name, body]) => {
    // verbatim passthrough — scaffolded _TODO stubs hydrate cannot derive
    if (body && body.$verbatim) return { name, ...body.$verbatim };
    // $status reference — the whole prop comes from the map
    if (body === '$status') {
      const s = MAP.status;
      const map = {};
      for (const v of s.values) map[v] = { collection: `Status › ${v}`, mode: s.mode };
      return {
        name,
        type: 'enum',
        values: s.values,
        default: null,
        kind: 'content',
        description: s.description,
        figma: { extends: s.extends, map },
      };
    }
    const kindRule = MAP.propKind[body.kind] || {};
    const prop = {
      name,
      type: kindRule.type ?? 'boolean',
      // an explicit `default:` on the prop wins (mirrors the Figma prop default);
      // else fall back to the kind's default.
      default: 'default' in body ? body.default : ('default' in kindRule ? kindRule.default : false),
      kind: body.kind,
      description: body.description ?? '',
    };
    if (body.template) prop.template = body.template;
    // figma mechanism from the kind (figmaBoolean overrides the derived name).
    // Only emit when the def carries the needed data — a plain style toggle has
    // no axis, and gets no figma block.
    if (kindRule.figma === 'boolean') prop.figma = { boolean: body.figmaBoolean ?? 'has' + stemOf(name) };
    else if (kindRule.figma === 'axis' && body.axis) prop.figma = { axis: body.axis.name, value: body.axis.value };
    // reorder: template sits before description in the legacy shape
    if (prop.template) {
      const { name: n, type, default: d, kind, template, description, figma } = prop;
      return { name: n, type, default: d, kind, template, description, ...(figma ? { figma } : {}) };
    }
    return prop;
  });
}

// ── events ────────────────────────────────────────────────────────────────────
function hydrateEvents(events) {
  return Object.entries(events).map(([name, body]) => {
    const v = body.$verbatim || {};
    // start from defaults, override with any verbatim-stored non-defaults
    const ev = { name };
    if ('description' in body || 'description' in v) ev.description = body.description ?? v.description ?? '';
    ev.bubbles = v.bubbles ?? MAP.eventDefaults.bubbles;
    ev.composed = v.composed ?? MAP.eventDefaults.composed;
    ev.cancelable = 'cancelable' in body ? body.cancelable : MAP.eventDefaults.cancelable;
    ev.detail = v.detail ?? MAP.eventDefaults.detail;
    // remaining bespoke fields (trigger, default, _todo…) in original order
    for (const [k, val] of Object.entries(v)) {
      if (['bubbles', 'composed', 'detail'].includes(k)) continue;
      ev[k] = val;
    }
    return ev;
  });
}

// ── figma summary ─────────────────────────────────────────────────────────────
// Derived from the anatomy + props, not hand-written.
function deriveFigma(full, thinFigma) {
  const variantAxes = full.props
    .filter((p) => p.figma?.axis)
    .map((p) => ({ name: p.figma.axis, values: null }));
  // collapse to unique axes with their value list from the style props
  const axisMap = {};
  for (const p of full.props) {
    if (p.figma?.axis) {
      axisMap[p.figma.axis] ??= new Set();
      axisMap[p.figma.axis].add(p.figma.value);
    }
  }
  const booleanProps = full.props.filter((p) => p.figma?.boolean).map((p) => p.figma.boolean);
  const textProps = [];
  const walk = (n) => {
    if (n?.figma?.prop) textProps.push(n.figma.prop);
    (n?.children || []).forEach(walk);
  };
  walk(full.anatomy.root);

  return {
    _status: 'matched',
    figmaName: full.figmaName,
    nodeType: 'COMPONENT_SET',
    built: true,
    variantAxes: Object.entries(axisMap).map(([name, vals]) => {
      // tag's Type axis is [dot, full] — the def only names `dot`; `full` is the base
      const values = [...vals];
      if (name === 'Type' && !values.includes('full')) values.push('full');
      return { name, values };
    }),
    booleanProps,
    textProps,
    instanceProps: [],
    modePins: {},
    figmaEvents: [],
    ...(thinFigma?.note ? { note: thinFigma.note } : {}),
  };
}

// ── progressive-enhancement linter ───────────────────────────────────────────
// Progressive enhancement is the law: if a semantic element or CSS already gives
// a behaviour, the def must not rebuild it in JS. This walks a thin def's anatomy
// and returns warnings — surfaced by generate-defs and the guard, not thrown.
const JS_FOR = {
  // a listen/handler intent → the native capability that would make it redundant
  click: 'click', activate: 'click', press: 'click',
  keydown: 'keyboard', keyup: 'keyboard', keypress: 'keyboard',
  focus: 'focus', blur: 'focus',
  toggle: 'toggle', open: 'open-state', close: 'open-state',
};
export function checkProgressiveEnhancement(thin) {
  const warns = [];
  if (!thin.anatomy) return warns;   // nothing to walk on scaffolded defs
  const walk = (key, body) => {
    const m = /^([\w-]+)\((\w+)\)$/.exec(key);
    const el = m ? m[2] : null;
    const provides = (el && MAP.elements[el]?.provides) || [];
    for (const l of body.listen || []) {
      const need = JS_FOR[l.on] || JS_FOR[l.event];
      // Re-emitting a semantic event (emit/reemit) is COMPOSITION, not a rebuild
      // of native behaviour — a native <button> handling its own click, then the
      // component re-dispatching it as a domain event, is the correct pattern.
      const isComposition = l.action === 'emit' || l.action === 'reemit';
      if (need && provides.includes(need) && !isComposition) {
        warns.push(`${thin.name}: <${el}> "${key}" already provides "${need}" natively — drop the JS listener for "${l.event || l.on}".`);
      }
    }
    for (const child of body.children || []) {
      const [ckey, cbody] = Object.entries(child)[0];
      walk(ckey, cbody);
    }
  };
  const [rootKey, rootBody] = Object.entries(thin.anatomy)[0];
  walk(rootKey, rootBody);
  return warns;
}

// ── anatomy-less hydrate ──────────────────────────────────────────────────────
// Scaffolded (generated) defs have no anatomy tree, so the figma block can't be
// derived — it is kept verbatim in the thin form. We only restore boilerplate,
// event defaults, and the empty-array fields the writer always emitted.
function hydrateFlat(thin) {
  const full = {
    $schema: 'https://sherpa-ui.dev/schema/component-definition/v2.json',
    generated: thin.generated ?? true,
    name: thin.name,
    figmaName: thin.figmaName,
    category: thin.category,
    description: thin.description,
    props: (thin.props ? hydrateProps(thin.props) : []),
    templates: thin.templates ?? [],
    slots: thin.slots ? Object.entries(thin.slots).map(([name, b]) => ({ name, accepts: b.accepts ?? [], description: b.description ?? '', ...(b.examples ? { examples: b.examples } : {}) })) : [],
    parts: thin.parts ?? [],
    nested: thin.nested ?? [],
    props_public: thin.props_public ?? [],
    events: thin.events ? hydrateEvents(thin.events) : [],
    tokens: thin.tokens ?? {},
    figma: thin.figmaVerbatim ?? thin.figma,   // exact node structure, any type
  };
  return full;
}

// ── top level ─────────────────────────────────────────────────────────────────
export function hydrate(thin) {
  if (!thin.anatomy) return hydrateFlat(thin);
  const [rootKey, rootBody] = Object.entries(thin.anatomy)[0];
  const rootNode = orderTree(hydrateNode(rootKey, rootBody, { isRoot: true }), true);

  const full = {
    $schema: 'https://sherpa-ui.dev/schema/component-definition/v2.json',
    generated: false,
    name: thin.name,
    figmaName: thin.figmaName,
    category: thin.category,
    description: thin.description,
  };
  // optional top-level fields the thinner keeps verbatim when present, in
  // the legacy writer's order (tier/parentComponent sit before anatomy)
  if ('tier' in thin) full.tier = thin.tier;
  if ('parentComponent' in thin) full.parentComponent = thin.parentComponent;

  full.anatomy = { root: rootNode };
  full.props = hydrateProps(thin.props);
  full.templates = thin.templates ?? [];
  full.slots = thin.slots ? Object.entries(thin.slots).map(([name, b]) => ({ name, accepts: b.accepts, description: b.description, ...(b.examples ? { examples: b.examples } : {}) })) : [];
  // parts: explicit if the thin def carries them (robust), else derived
  full.parts = thin.parts ?? derriveParts(rootNode);
  full.nested = thin.nested ?? deriveNested(rootNode);
  full.events = thin.events ? hydrateEvents(thin.events) : [];
  // overrides: omitted → none; $standard → the shared boilerplate; else verbatim
  if (thin.overrides === '$standard') full.overrides = { ...MAP.overrides };
  else if (thin.overrides) full.overrides = thin.overrides;
  full.tokens = thin.tokens;
  if ('_divergence' in thin) full._divergence = thin._divergence;
  if ('_notes' in thin) full._notes = thin._notes;
  // figma: verbatim if kept (robust — any node type), else derived
  full.figma = thin.figmaVerbatim ?? deriveFigma(full, thin.figma);
  return full;
}

function derriveParts(root) {
  const parts = [];
  const walk = (n) => {
    if (n?.part) parts.push(n.part);
    (n?.children || []).forEach(walk);
  };
  walk(root);
  return parts;
}
function deriveNested(root) {
  const nested = [];
  const walk = (n) => {
    if (n?.component && n?.relationship) nested.push({ component: n.component, relationship: n.relationship });
    (n?.children || []).forEach(walk);
  };
  walk(root);
  return nested;
}
