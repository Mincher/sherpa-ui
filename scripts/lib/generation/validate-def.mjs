/**
 * validate-def.mjs — check a component def against every design-system rule.
 * Returns { ok, errors[], warnings[] }. The single validator the MCP + skills use.
 *
 * Encodes the rules from docs/DEF-TO-FIGMA-BUILD-RULES.md so an AI can't ship a
 * def that repeats a known defect.
 */
import { loadOntology, loadNameMap, loadComponentNames } from './data.mjs';
import { roleForToken, scopeAllows, explainToken } from './resolve.mjs';

const err = (code, msg, where) => ({ level: 'error', code, msg, where });
const warn = (code, msg, where) => ({ level: 'warning', code, msg, where });

/** Walk anatomy nodes depth-first. */
function* walk(node, path = 'root') {
  if (!node) return;
  yield [node, path];
  for (const c of node.children ?? []) yield* walk(c, `${path} > ${c.class ?? c.component ?? c.el ?? '?'}`);
}

export function validateDef(def, opts = {}) {
  const ontology = opts.ontology ?? loadOntology();
  const nameMap = opts.nameMap ?? loadNameMap();
  const components = new Set(opts.components ?? loadComponentNames());
  const out = [];

  // ── shape basics ──
  if (!def || typeof def !== 'object') return { ok: false, errors: [err('shape', 'def is not an object')], warnings: [] };
  if (!def.name || !/^sherpa-[a-z-]+$/.test(def.name)) out.push(err('name', `name must be sherpa-<kebab>, got "${def.name}"`));
  if (!def.category) out.push(warn('category', 'no category set'));
  if (!def.anatomy?.root) out.push(warn('anatomy', 'no anatomy.root — def→code/Figma compile needs it'));

  // ── Rule 1: reuse existing components (nested must be real) ──
  for (const n of def.nested ?? []) {
    if (n.component && !components.has(n.component)) {
      out.push(err('reuse', `nested "${n.component}" is not a real component — reuse an existing one (Rule 1)`, 'nested'));
    }
    if (!['owned', 'slotted'].includes(n.relationship)) {
      out.push(warn('nesting', `nested "${n.component}" missing relationship (owned|slotted)`, 'nested'));
    }
  }

  // ── Rule 9 / tokens: every token entry must resolve to a real ontology token + right role ──
  const PROP_ROLE = {
    background: 'surface', surface: 'surface', fill: 'surface',
    borderColor: 'border', border: 'border', color: 'content',
    borderRadius: 'radius', borderWidth: 'border',
    gap: 'space', paddingBlock: 'space', paddingInline: 'space', padding: 'space',
    fontSize: 'type', fontWeight: 'type', size: 'size',
  };
  for (const [key, tok] of Object.entries(def.tokens ?? {})) {
    const prop = key.split('.').pop();
    const expected = PROP_ROLE[prop];
    // token can be a string alias or {override, fallback}
    const names = typeof tok === 'string' ? [tok] : [tok.override, tok.fallback].filter(Boolean);
    for (const nm of names) {
      // ontology keys are "Collection::name/path"; def uses dash-joined short names.
      // Normalise both (drop collection, unify / and -) and compare.
      const norm = (s) => s.toLowerCase().replace(/^.*::/, '').replace(/[/-]/g, '');
      const target = norm(nm);
      const hit = Object.keys(ontology).find((id) => norm(id).endsWith(target) || norm(id) === target);
      if (!hit) { out.push(warn('token', `token "${nm}" (${key}) not found in ontology — verify the name`, key)); continue; }
      const role = ontology[hit].role;
      if (expected && role && role !== expected && !(expected === 'surface' && role === 'palette') && !(expected === 'space' && role === 'size')) {
        out.push(warn('token-role', `${key} binds "${nm}" (role=${role}) but property implies ${expected}`, key));
      }
      // Rule 4: a control LABEL (color) must not bind status-content directly
      if (prop === 'color' && /status-content/.test(nm)) {
        const cav = explainToken(hit)?.caveat;
        out.push(err('button-content', `control label binds status-content ("${nm}") — light-on-light bug (Rule 4). Bind control-content instead.${cav ? ' ' + cav.slice(0, 80) : ''}`, key));
      }
    }
  }

  // ── Rule 3: status container should bind container-* not status-* for surface/border ──
  if (def.category === 'container') {
    for (const [key, tok] of Object.entries(def.tokens ?? {})) {
      const nm = typeof tok === 'string' ? tok : tok.override;
      if (nm && /^status-(surface|border)/.test(nm) && /(background|surface|border)/.test(key)) {
        out.push(warn('container-alias', `container "${key}" binds status-* directly — prefer container-* which aliases through status (Rule 3)`, key));
      }
    }
  }

  // ── anatomy: owned nested buttons must carry size, text nodes need a role ──
  for (const [node] of walk(def.anatomy?.root)) {
    if (node.component === 'sherpa-button' && node.relationship === 'owned') {
      if (!node.attrs || !('data-size' in node.attrs)) {
        out.push(warn('button-size', `owned sherpa-button "${node.class ?? ''}" has no data-size — buttons must set a size so the size mode works (Rule 6)`, node.class));
      }
    }
    if (node.figma?.node === 'TEXT' && !node.figma?.role && !node.slot === undefined) {
      out.push(warn('text-role', `text node "${node.class ?? node.slot ?? ''}" has no content role — bind a content colour + Typography vars (Rule 2)`, node.class));
    }
  }

  // ── events well-formed ──
  for (const e of def.events ?? []) {
    if (!/^[a-z]+(-[a-z]+)+$/.test(e.name)) out.push(warn('event-name', `event "${e.name}" should be unprefixed noun-verb`, e.name));
    if (e.cancelable && !e.default) out.push(warn('event-default', `cancelable event "${e.name}" should document its default action`, e.name));
  }

  const errors = out.filter((o) => o.level === 'error');
  const warnings = out.filter((o) => o.level === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}
