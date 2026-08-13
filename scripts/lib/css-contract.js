/**
 * css-contract.js — extract a component's STYLING CONTRACT from its CSS.
 *
 * In Sherpa-UI, CSS is the *primary* contract source: a component's states,
 * variants, style hooks and interaction live in the CSS, keyed off `data-*`
 * attributes — not in the JSDoc (which lags and under-reports; see
 * docs/COMPOSITION-MAP.md "Contract tier"). This module reads the CSS truth:
 *
 *   1. data-* attributes and their ENUMERATED values, parsed from selectors
 *      (`:host([data-variant="primary"])`, `[data-status]`, `[data-active]`).
 *   2. the custom-property style API — `--*` DECLARATIONS (what the component
 *      exposes/defines) and `var(--*)` USES (what it consumes), classified into
 *      private (`--_*`), cross-component (`--_status-*`, `--_cg-*`) and token
 *      (`--sherpa-*`) surfaces.
 *   3. the interaction surface — the pseudo-classes the CSS responds to
 *      (`:hover`, `:focus-visible`, `:checked`, `:user-invalid`, `[popover]`…).
 *   4. the projected Figma rule per data-* attr — read from a `@figma:<rule>`
 *      comment placed beside the selectors (authored in CSS, per the ratified
 *      decision), else INFERRED from the attr's CSS shape.
 *
 * Built on parseCSS() (this dir) — which already yields selector blocks + custom
 * -property declarations — plus a light raw-CSS pass for var() uses and the
 * `@figma:` comments (which parseCSS strips). No new heavy parser.
 */

import { parseCSS } from './css-parser.js';

/** Pull every `[data-foo]` / `[data-foo="bar"]` occurrence out of a selector string. */
function attrsInSelector(selector) {
  const out = [];
  const re = /\[data-([\w-]+)(?:\s*([~|^$*]?=)\s*"([^"]*)")?\]/g;
  let m;
  while ((m = re.exec(selector)) !== null) {
    out.push({ name: `data-${m[1]}`, value: m[3] ?? null });
  }
  return out;
}

/** Interaction-bearing selector fragments we care about, as a detectable set. */
const INTERACTION_TOKENS = [
  ':hover', ':focus-visible', ':focus-within', ':focus', ':active', ':checked',
  ':disabled', ':user-invalid', ':user-valid', ':indeterminate', ':target',
  ':has(', ':is(', ':not(', ':state(', '::slotted(', '[popover]',
];

/** Classify a custom-property name into its API surface. */
function classifyCustomProp(name) {
  if (name.startsWith('--_status-')) return 'cross-status';
  if (name.startsWith('--_cg-')) return 'cross-group';
  if (name.startsWith('--_')) return 'private';
  if (name.startsWith('--sherpa-')) return 'token';
  if (name.startsWith('--core-')) return 'core';
  return 'other';
}

/** Read the leading `@figma:<rule>` from a comment block, if present. */
function figmaRuleFromComment(comment) {
  const m = comment.match(/@figma:([\w:-]+(?:\s[\w. ]+)?)/i);
  return m ? m[1].trim() : null;
}

/**
 * A single pass over the RAW css — everything that lives in selector strings, which
 * parseCSS either filters (it only keeps blocks with custom-prop declarations) or
 * discards (comments, var() uses). We collect here:
 *   - `var(--x)` USES (parseCSS records declarations only);
 *   - every `data-*` attr + its enumerated value across ALL selector lines;
 *   - the interaction pseudo-classes/tokens present in ANY selector;
 *   - the `@figma:<rule>` authored in a comment immediately preceding a selector
 *     that mentions a given data-* attr (rule → attr association).
 * Line-oriented and forgiving; the goal is coverage, not a full CSS AST.
 */
function rawPass(css) {
  const varUses = new Set();
  for (const m of css.matchAll(/var\(\s*(--[\w-]+)/g)) varUses.add(m[1]);

  const attrMap = new Map(); // name → Set(values)
  const interaction = new Set();
  const figmaByAttr = {};
  const lines = css.replace(/\r\n/g, '\n').split('\n');
  let pendingRule = null;

  for (const raw of lines) {
    const line = raw.trim();

    const cmt = line.match(/\/\*\s*(@figma:[^*]+?)\s*\*\//i);
    if (cmt) {
      pendingRule = figmaRuleFromComment(cmt[1]);
      continue;
    }
    if (!line || line.startsWith('//')) continue;

    // Only look at lines that could be a selector (open a block or continue a
    // selector list) — not declarations, which never contain `[data-` or pseudo.
    const looksLikeSelector = line.includes('{') || line.endsWith(',') || /^[.:*\[&]/.test(line);
    if (looksLikeSelector) {
      for (const a of attrsInSelector(line)) {
        if (!attrMap.has(a.name)) attrMap.set(a.name, new Set());
        if (a.value != null) attrMap.get(a.name).add(a.value);
        if (pendingRule && !figmaByAttr[a.name]) figmaByAttr[a.name] = pendingRule;
      }
      for (const tok of INTERACTION_TOKENS) {
        if (line.includes(tok)) interaction.add(tok.replace(/\($/, ''));
      }
    }

    // A non-comment, non-blank line consumes the pending rule (it applies only to
    // the block it immediately precedes).
    if (!line.endsWith(',')) pendingRule = null;
  }

  return { varUses, attrMap, interaction, figmaByAttr };
}

/**
 * Infer the Figma projection rule for a data-* attr from its CSS shape:
 *   - enumerated values in selectors → 'variant'
 *   - a bare presence attr (no ="value") → 'boolean'
 *   - status is special (override mechanism, not an axis) → 'mode:Status'
 *   - a content presence-hook (icon/label/count) → 'instance'
 */
function inferFigmaRule(attr) {
  if (attr.name === 'data-status') return 'mode:Status';
  const contentHook = /^data-(icon|label|count|title|description|src|unicode)/;
  if (contentHook.test(attr.name)) return 'instance';
  return attr.values.length > 0 ? 'variant' : 'boolean';
}

/**
 * Extract the contract from one component's CSS string.
 *
 * @param {string} css   raw component CSS
 * @param {string} file  relative filename (metadata)
 * @returns {{
 *   file: string,
 *   attributes: Array<{ name, values: string[], figma: string, figmaSource: 'css'|'inferred' }>,
 *   customProps: { declares: Record<string,string[]>, uses: Record<string,string[]> },
 *   interaction: string[],
 * }}
 */
export function extractCssContract(css, file) {
  const { selectors } = parseCSS(css, file);
  const { varUses, attrMap, interaction, figmaByAttr } = rawPass(css);

  // ── data-* attributes + enum values (from the raw-pass over all selectors) ──
  const attributes = [...attrMap.entries()]
    .map(([name, valueSet]) => {
      const attr = { name, values: [...valueSet].sort() };
      const cssRule = figmaByAttr[name];
      attr.figma = cssRule ?? inferFigmaRule(attr);
      attr.figmaSource = cssRule ? 'css' : 'inferred';
      return attr;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── custom-property API (declarations from parseCSS; uses from raw pass) ──
  const declares = {}; // surface → [names]
  const declSeen = new Set();
  for (const block of selectors) {
    for (const p of block.properties) {
      if (!p.name.startsWith('--') || declSeen.has(p.name)) continue;
      declSeen.add(p.name);
      const surface = classifyCustomProp(p.name);
      (declares[surface] ??= []).push(p.name);
    }
  }
  const uses = {};
  for (const name of varUses) {
    const surface = classifyCustomProp(name);
    (uses[surface] ??= []).push(name);
  }
  for (const k of Object.keys(declares)) declares[k].sort();
  for (const k of Object.keys(uses)) uses[k].sort();

  return {
    file,
    attributes,
    customProps: { declares, uses },
    interaction: [...interaction].sort(),
  };
}
