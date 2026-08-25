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
function renderNode(node, forTemplate, indent) {
  const pad = '  '.repeat(indent);
  // A node only in the removable template is skipped elsewhere.
  if (node.showWhen && node.showWhen !== forTemplate) return '';

  if (node.component) {
    // owned nested component
    const a = { class: node.class, part: node.part, ...node.attrs };
    return `${pad}<${node.component} ${attrStr(a)}></${node.component}>`;
  }
  const a = { class: node.class, part: node.part, ...node.attrs };
  const open = `${pad}<${node.el} ${attrStr(a)}>`;
  const kids = [];
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

function compileHtml(def) {
  const templates = def.templates?.length ? def.templates : ['default'];
  const header = def.docs?.html ? `<!--\n${def.docs.html.split('\n').map((l) => '  ' + l).join('\n')}\n-->\n` : '';
  const blocks = templates.map((tid) =>
    // body indents one level inside <template>
    `<template id="${tid}">\n${renderNode(def.anatomy.root, tid === 'removable' ? 'removable' : tid, 1)}\n</template>`,
  );
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
  (function walk(node) {
    for (const l of node.listen ?? []) if (l.action === 'reemit') reemits.push({ node, l });
    (node.children ?? []).forEach(walk);
  })(def.anatomy.root);

  const L = [];
  const fires = (def.events ?? []).map((e) => e.name).join(', ') || 'none';
  if (def.docs?.ts) {
    L.push(`/**`, ...def.docs.ts.split('\n').map((l) => ` * ${l}`.trimEnd()), ` *`, ` * @fires ${fires}`, ` */`);
  } else {
    L.push(`/**`, ` * ${name} — ${def.description}`, ` *`, ` * Generated from ${name}.thin.yaml. @fires ${fires}`, ` */`);
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
