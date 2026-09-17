/**
 * compile-def.mjs — the pure `def → code` transformation.
 *
 * `compileDef(def)` takes a def OBJECT and returns `{ ts, html, css }` — the
 * three component file strings. No file reads, no file writes, no process.argv:
 * a pure function so the MCP server, skills, and the CLI can all share one
 * implementation. The CLI (scripts/compile-def.mjs) owns arg parsing + I/O and
 * delegates the transformation here.
 *
 * Requires an `anatomy` block on the def (only enriched defs have one) — the
 * caller is responsible for that check.
 */

// ── helpers ───────────────────────────────────────────────────────────
const attrStr = (attrs = {}) =>
  Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
const tokenVar = (t) =>
  typeof t === 'string'
    ? `var(--sherpa-${t})`
    : `var(--_${t.override}, var(--sherpa-${t.fallback}))`;

// ── HTML: walk anatomy → one <template> per templates[] ────────────────
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
/**
 * Render a bare `<slot>` node (a slot child node: { slot, attrs?, children? }).
 *
 * `children` on a slot node is its FALLBACK content — what the slot shows when
 * nothing is projected in. It renders INLINE, with no padding between the tags,
 * because that is how it is hand-written: `<slot name="icon"><i class="glyph">
 * </i></slot>` sits on one line. Breaking it across lines would put text nodes
 * inside the slot and change what the browser shows.
 */
function slotTag(node, forTemplate = 'default') {
  const a = { name: node.slot || undefined, ...node.attrs };
  const s = attrStr(a);
  const open = s ? `<slot ${s}>` : '<slot>';
  const inner = (node.children ?? [])
    .map((c) => renderNode(c, forTemplate, 0))
    .filter(Boolean)
    .join('');
  return `${open}${inner}</slot>`;
}
function renderNode(node, forTemplate, indent) {
  const pad = '  '.repeat(indent);
  // A node only in the removable template is skipped elsewhere.
  if (node.showWhen && node.showWhen !== forTemplate) return '';

  // A bare slot child node — no `el`, just a `slot` name (+ optional attrs like
  // data-accepts, + optional `children`: its fallback content).
  if (node.el === undefined && node.component === undefined && node.slot !== undefined) {
    return `${pad}${slotTag(node, forTemplate)}`;
  }

  if (node.component) {
    // owned nested component
    const a = { class: node.class, part: node.part, ...node.attrs };
    return `${pad}<${node.component} ${attrStr(a)}></${node.component}>`;
  }
  const a = { class: node.class, part: node.part, ...node.attrs };
  // Void element (input/br/hr/img/meta/link) — self-closing, no children, no
  // close tag. Matches the real hand-written markup (`<input … />`).
  if (VOID_TAGS.has(node.el)) {
    return `${pad}<${node.el} ${attrStr(a)} />`;
  }
  const open = `${pad}<${node.el} ${attrStr(a)}>`;
  const kids = [];
  // The COLLAPSED slot form: `node.slot` set on an element node ⇒ a lone inline
  // <slot> child (sole child, no attrs, no fallback). Kept for byte-stable output
  // on components like sherpa-tag. Slots that carry attrs / siblings / fallback are
  // emitted as first-class child nodes instead (see the bare-slot branch above).
  if (node.slot !== undefined) {
    kids.push(node.slot ? `<slot name="${node.slot}"></slot>` : `<slot></slot>`);
  }
  for (const c of node.children ?? []) {
    const r = renderNode(c, forTemplate, indent + 1);
    if (r) kids.push('\n' + r);
  }
  const inner = (node.children?.length ? kids.join('') + '\n' + pad : kids.join(''));
  return `${open}${inner}</${node.el}>`;
}

/**
 * The anatomy's root node(s) for ONE template, as an ordered array.
 *
 * Three forms, in order of specificity: `byTemplate[tid]` (this template has its
 * own tree), `roots` (one multi-root tree shared by every template), `root` (one
 * single-root tree shared by every template). A `byTemplate` map with no entry
 * for `tid` falls back to its `default` entry, so a template that happens to
 * match the default need not repeat it.
 */
function anatomyRoots(def, tid = 'default') {
  const by = def.anatomy?.byTemplate;
  if (by) {
    const own = by[tid] ?? by['default'];
    return Array.isArray(own) ? own : [];
  }
  if (Array.isArray(def.anatomy?.roots)) return def.anatomy.roots;
  return def.anatomy?.root ? [def.anatomy.root] : [];
}

function compileHtml(def) {
  const templates = def.templates?.length ? def.templates : ['default'];
  const header = def.docs?.html ? `<!--\n${def.docs.html.split('\n').map((l) => '  ' + l).join('\n')}\n-->\n` : '';
  const blocks = templates.map((tid) => {
    const forTemplate = tid === 'removable' ? 'removable' : tid;
    // Render each sibling root in order. Single-root path (one root) produces
    // byte-identical output to the previous `renderNode(def.anatomy.root, …)`.
    const body = anatomyRoots(def, tid).map((r) => renderNode(r, forTemplate, 1)).filter(Boolean).join('\n');
    return `<template id="${tid}">\n${body}\n</template>`;
  });
  return header + blocks.join('\n\n') + '\n';
}

// ── CSS: :host + token rules + kind-driven rules ───────────────────────
function compileCss(def) {
  const L = [];
  L.push(`:host {`, `  display: inline-flex;`, `  vertical-align: middle;`, `}`, '');
  // group tokens by element
  const byEl = {};
  for (const [key, tok] of Object.entries(def.tokens ?? {})) {
    const [el, prop] = key.split('.');
    (byEl[el] ??= []).push([prop, tok]);
  }
  const propCss = { gap: 'gap', paddingBlock: 'padding-block', paddingInline: 'padding-inline',
    borderWidth: 'border-width', borderColor: 'border-color', borderRadius: 'border-radius',
    background: 'background', color: 'color', fontSize: 'font-size', fontWeight: 'font-weight', size: 'inline-size' };
  for (const [el, pairs] of Object.entries(byEl)) {
    L.push(`.${el} {`);
    for (const [prop, tok] of pairs) L.push(`  ${propCss[prop] ?? prop}: ${tokenVar(tok)};`);
    L.push(`}`, '');
  }
  // kind: visibility → hide unless the flag attr is present
  for (const p of def.props ?? []) {
    if (p.kind === 'visibility') {
      const cls = p.name.replace(/^data-/, '');
      L.push(`.${cls} { display: none; }`, `:host([${p.name}]) .${cls} { display: inline-flex; }`, '');
    }
  }
  return L.join('\n');
}

// ── TS: class, observed, templateId, nested-event reemit ───────────────
function compileTs(def, name, cls) {
  const observed = (def.props ?? []).filter((p) => p.kind !== 'style').map((p) => p.name);
  const tmplProp = (def.props ?? []).find((p) => p.kind === 'template');
  // find reemit wiring from anatomy children
  const reemits = [];
  const walk = (node) => {
    for (const l of node.listen ?? []) if (l.action === 'reemit') reemits.push({ node, l });
    (node.children ?? []).forEach(walk);
  };
  // Reemit wiring is a property of the COMPONENT, not of one template, so walk
  // every template's roots — a `byTemplate` anatomy keeps a different tree per
  // template and a listener declared only in the second one would be missed.
  // A node object is shared by reference when templates share a tree, so `seen`
  // keeps one visit per node rather than one per template.
  const seen = new Set();
  const walkOnce = (node) => { if (seen.has(node)) return; seen.add(node); walk(node); };
  for (const tid of (def.templates?.length ? def.templates : ['default'])) {
    anatomyRoots(def, tid).forEach(walkOnce);
  }

  const L = [];
  const fires = (def.events ?? []).map((e) => e.name).join(', ') || 'none';
  // @behaviour tags — runtime behaviours documented in Figma's description that
  // have no node/prop (column pinning, sticky headers, scroll). MCP parses these.
  const behaviourLines = (def.behaviours ?? []).map((b) =>
    ` * @behaviour ${b.id}${b.api ? ` — ${b.api}` : ''}${b.figmaCant ? ' [no Figma equivalent]' : ''}\n *   ${b.summary ?? ''}`.trimEnd());
  if (def.docs?.ts) {
    L.push(`/**`, ...def.docs.ts.split('\n').map((l) => ` * ${l}`.trimEnd()), ` *`, ...behaviourLines, ` * @fires ${fires}`, ` */`);
  } else {
    L.push(`/**`, ` * ${name} — ${def.description}`, ` *`, ...behaviourLines, ` * Generated from ${name}.component.yaml. @fires ${fires}`, ` */`);
  }
  L.push(`import { SherpaElement } from '../../core/sherpa-element.js';`, '');
  L.push(`export class ${cls} extends SherpaElement {`);
  L.push(`  static override css = new URL('./${name}.css', import.meta.url);`);
  L.push(`  static override html = new URL('./${name}.html', import.meta.url);`);
  if (observed.length) L.push(`  static override observed = [${observed.map((o) => `'${o}'`).join(', ')}];`);
  L.push('');
  if (tmplProp) {
    L.push(`  protected override get templateId(): string | null {`);
    L.push(`    return this.hasAttribute('${tmplProp.name}') ? '${tmplProp.template}' : 'default';`);
    L.push(`  }`, '');
  }
  if (reemits.length) {
    L.push(`  override onRender(): void {`);
    for (const { node, l } of reemits) {
      L.push(`    this.$('.${node.class}')?.addEventListener('${l.event}', this.#on_${l.event.replace(/-/g, '_')});`);
    }
    L.push(`  }`, '');
    for (const { l } of reemits) {
      L.push(`  #on_${l.event.replace(/-/g, '_')} = (event: Event): void => {`);
      L.push(`    event.stopPropagation();`);
      L.push(`    this.emit('${l.as}');`);
      L.push(`  };`, '');
    }
  }
  // Behaviour TODO stubs — one per documented behaviour, so the author must
  // acknowledge each (Figma can't draw these; the def is their only spec).
  for (const b of def.behaviours ?? []) {
    L.push(`  // TODO(behaviour: ${b.id}) — ${b.summary ?? b.api ?? ''}`.trimEnd());
  }
  if ((def.behaviours ?? []).length) L.push('');
  L.push(`}`, '');
  L.push(`customElements.define('${name}', ${cls});`, '');
  return L.join('\n');
}

/** Derive the class name (SherpaFoo) from a sherpa-foo element name. */
function classFor(name) {
  return 'Sherpa' + name.replace(/^sherpa-/, '').split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('');
}

/**
 * Pure `def → code`. Takes a def object (must carry an `anatomy` block) and
 * returns the three component file strings.
 * @param {object} def — the parsed def.json object. Must have `def.name`.
 * @returns {{ ts: string, html: string, css: string }}
 */
export function compileDef(def) {
  const name = def.name;
  const cls = classFor(name);
  return {
    ts: compileTs(def, name, cls),
    html: compileHtml(def),
    css: compileCss(def),
  };
}
