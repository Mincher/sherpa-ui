/**
 * audit.mjs — check a component's def/bindings against the design-system rules.
 *
 * Two audits, both pure (no live Figma):
 *  - auditDefBindings(def): every geometry value in the def's `tokens` should map
 *    to a token (the "every property uses a variable" rule, def-side).
 *  - auditDefOntology(def): every token the def binds resolves to an ontology role
 *    consistent with the property it's bound to.
 *
 * The LIVE Figma audit (reading actual bound variables off nodes) runs through the
 * build-figma skill via the bridge — this module covers what's checkable from the
 * def alone, which is what an AI edits.
 */
import { loadOntology } from './data.mjs';
import { tokenForValue } from './resolve.mjs';

/** Property → expected ontology role, for the def token map. */
const PROP_ROLE = {
  background: 'surface', surface: 'surface', fill: 'surface',
  borderColor: 'border', border: 'border', color: 'content',
  borderRadius: 'radius', borderWidth: 'border',
  gap: 'space', paddingBlock: 'space', paddingInline: 'space', padding: 'space',
  fontSize: 'type', fontWeight: 'type', size: 'size',
};

const normName = (s) => s.toLowerCase().replace(/^.*::/, '').replace(/[/-]/g, '');

/** Find the ontology entry a def token name refers to. */
function ontologyHit(name, ontology) {
  const target = normName(name);
  const key = Object.keys(ontology).find((id) => normName(id).endsWith(target) || normName(id) === target);
  return key ? ontology[key] : null;
}

/** Every token the def binds → does its role match the property? */
export function auditDefOntology(def, ontology = loadOntology()) {
  const findings = [];
  let checked = 0, agree = 0;
  for (const [key, tok] of Object.entries(def.tokens ?? {})) {
    const prop = key.split('.').pop();
    const expected = PROP_ROLE[prop];
    if (!expected) continue;
    const names = typeof tok === 'string' ? [tok] : [tok.override, tok.fallback].filter(Boolean);
    for (const nm of names) {
      const e = ontologyHit(nm, ontology);
      if (!e) { findings.push({ level: 'warn', key, msg: `token "${nm}" not in ontology` }); continue; }
      checked++;
      const ok = e.role === expected
        || (expected === 'surface' && e.role === 'palette')
        || (expected === 'space' && e.role === 'size');
      if (ok) agree++;
      else findings.push({ level: 'warn', key, msg: `"${nm}" role=${e.role} but ${prop} implies ${expected}` });
    }
  }
  return { checked, agree, accuracy: checked ? +(agree / checked * 100).toFixed(1) : 100, findings };
}

/**
 * For any literal geometry value found in the def (rare — defs should already use
 * token names), suggest the token it should be. Mostly a safety net.
 */
export function auditDefBindings(def) {
  const suggestions = [];
  const scan = (node, path = 'root') => {
    if (!node) return;
    for (const [k, v] of Object.entries(node.attrs ?? {})) {
      if (typeof v === 'number' || /^\d+px$/.test(String(v))) {
        const px = parseInt(v, 10);
        const t = tokenForValue('paddingLeft', px) ?? tokenForValue('topLeftRadius', px);
        if (t) suggestions.push({ path, attr: k, value: v, suggest: t });
      }
    }
    for (const c of node.children ?? []) scan(c, `${path} > ${c.class ?? c.el ?? '?'}`);
  };
  scan(def.anatomy?.root);
  return { suggestions };
}
