/**
 * css-reader.mjs — the single, PostCSS-based reader for authored component CSS.
 *
 * Both the spec generator (generate-component-spec.mjs) and the round-trip guard
 * (roundtrip-component.mjs) used to carry their own regex copies of this logic.
 * Regexes only understood FLAT `.class { … }` / `:host([data-*])` selectors, so
 * native nesting (`&`) or `:is()`/`:where()` wrappers would make them go blind and
 * silently drop states / token-bindings → spec drift → parity break.
 *
 * This module parses with PostCSS instead: it walks the real AST, resolves nested
 * `&` against the parent selector chain, and unwraps `:is()` / `:where()` so a
 * wrapped `:host(...)` is still seen. Output shapes are IDENTICAL to the old
 * regex functions, so the migration is parity-neutral on today's flat CSS.
 *
 * Chromium-only CSS features (color-mix, @property, @function) are irrelevant here
 * — we only read selectors and `var(--sherpa-*)` bindings, which parse fine.
 *
 * Map:
 * - authoredCss — Strip the generated projector region; return only hand-authored CSS.
 * - extractBindings — every token a component binds, as { selector, property, token }
 * - extractBindingsMap — Round-trip's shape: { '.el': { prop: 'sherpa-x-without-prefix' } }.
 * - parseStates — a component's CSS states — :host([data-*]), :hover, :focus-visible
 */
import postcss from 'postcss';

const TOKENS_MARK_END = '/* == end sherpa:tokens == */';

/** Strip the generated projector region; return only hand-authored CSS. */
export function authoredCss(css) {
  const end = css.indexOf(TOKENS_MARK_END);
  return end === -1 ? css : css.slice(end + TOKENS_MARK_END.length);
}

/** Parse to a PostCSS root; tolerant so odd (but valid) modern CSS never throws. */
function parse(css) {
  return postcss.parse(css, { from: undefined });
}

/**
 * Resolve a rule's own selector against its ancestor chain, expanding nested `&`.
 * PostCSS keeps nested rules as children with `&`-relative selectors; we flatten
 * so each leaf rule yields its full effective selector(s).
 */
function resolvedSelectors(rule) {
  // Build the ancestor selector list (outermost first), skipping at-rules.
  const chain = [];
  let node = rule;
  while (node && node.type === 'rule') {
    chain.unshift(splitSelectorList(node.selector));
    node = node.parent;
  }
  // Cartesian-combine parent × child, substituting `&` for the parent selector.
  let acc = [''];
  for (const level of chain) {
    const next = [];
    for (const parent of acc) {
      for (const sel of level) {
        if (sel.includes('&')) {
          next.push(sel.replace(/&/g, parent));
        } else if (parent) {
          // Descendant nesting without `&` → "parent sel".
          next.push(`${parent} ${sel}`);
        } else {
          next.push(sel);
        }
      }
    }
    acc = next;
  }
  return acc.map((s) => s.trim()).filter(Boolean);
}

/** Split a comma selector list, respecting parens (so `:is(a, b)` stays whole). */
function splitSelectorList(selector) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of selector) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Unwrap `:is(...)` / `:where(...)` one level so a `:host(...)` inside is visible
 * to the flat-selector matchers below. Returns the union of the outer selector and
 * each inner alternative spliced in place of the wrapper.
 */
function unwrapIsWhere(selector) {
  const m = /:(?:is|where)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/.exec(selector);
  if (!m) return [selector];
  const inners = splitSelectorList(m[1]);
  const results = [];
  for (const inner of inners) {
    const spliced = selector.slice(0, m.index) + inner + selector.slice(m.index + m[0].length);
    // recurse in case of multiple / nested wrappers
    results.push(...unwrapIsWhere(spliced));
  }
  return results;
}

/** Every effective, is/where-unwrapped selector string in the stylesheet. */
function allSelectors(css) {
  const root = parse(authoredNoComments(css));
  const sels = [];
  root.walkRules((rule) => {
    for (const s of resolvedSelectors(rule)) sels.push(...unwrapIsWhere(s));
  });
  return sels;
}

/** PostCSS keeps comments as nodes; strip them so string scans stay clean. */
function authoredNoComments(css) {
  const root = parse(css);
  root.walkComments((c) => c.remove());
  return root.toString();
}

/* ══ token bindings ══════════════════════════════════════════════════════════════
 * Ordered [{ el, prop, sherpaVar }], FIRST binding per `el.prop`. Only plain
 * single-class rules (`.track`, `.knob`) contribute — combinators/pseudos ignored,
 * exactly like the old readers. `border` shorthand expands to width+color longhands.
 */
export function extractBindings(cssRaw) {
  const root = parse(authoredNoComments(cssRaw));
  const seen = new Set();
  const out = [];
  root.walkRules((rule) => {
    for (const sel of resolvedSelectors(rule)) {
      const cm = /^\.([\w-]+)$/.exec(sel.trim());
      if (!cm) continue;
      const el = cm[1];
      const record = (prop, sherpaVar) => {
        const key = `${el}.${prop}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ el, prop, sherpaVar });
      };
      // Only this rule's OWN direct declarations — NOT nested child rules'
      // (`&:hover`, `&:focus-visible` …). walkDecls would recurse and wrongly
      // attribute a nested pseudo's binding to the plain-class parent.
      for (const node of rule.nodes ?? []) {
        if (node.type !== 'decl') continue;
        const prop = node.prop;
        const val = node.value;
        if (prop === 'border') {
          const vars = [...val.matchAll(/var\(\s*--sherpa-([\w-]+)/g)].map((mm) => mm[1]);
          if (vars[0]) record('border-width', vars[0]);
          if (vars[1]) record('border-color', vars[1]);
          continue;
        }
        const vm = /var\(\s*--sherpa-([\w-]+)/.exec(val);
        if (vm) record(prop, vm[1]);
      }
    }
  });
  return out;
}

/** Round-trip's shape: { '.el': { prop: 'sherpa-x-without-prefix' } }. */
export function extractBindingsMap(cssRaw) {
  const map = {};
  for (const { el, prop, sherpaVar } of extractBindings(cssRaw)) {
    (map[el] ??= {})[prop] = sherpaVar;
  }
  return map;
}

/* ══ state selectors ═════════════════════════════════════════════════════════════
 * [{ name, selector }] from `:host([data-*])`, `:host(:not([data-*]))`,
 * `:host([disabled])`, and `:focus-visible` (`.el:focus-visible` if scoped). Now
 * fed by resolved + is/where-unwrapped selectors, so nesting can't hide a state.
 */
export function parseStates(cssAuthored) {
  const states = [];
  const seen = new Set();
  const add = (name, selector) => {
    if (seen.has(selector)) return;
    seen.add(selector);
    states.push({ name, selector });
  };
  const sels = allSelectors(cssAuthored);
  const joined = sels.join('\n');

  // Match the legacy reader's ORDER exactly: all plain :host([data-*]) first
  // (across the whole sheet), then all :host(:not([data-*])), then disabled, then
  // focus-visible. The plain matcher runs on the full joined text; the `:not`
  // wrapper's inner `[data-*]` is NOT matched by it (the `(` after :host differs),
  // so the two passes stay disjoint just as before.
  let m;
  const hostRe = /:host\(\[data-([\w-]+)(?:="([^"]*)")?\]\)/g;
  while ((m = hostRe.exec(joined))) add(m[2] || m[1], m[0]);
  const notRe = /:host\(:not\(\[data-([\w-]+)(?:="([^"]*)")?\]\)\)/g;
  while ((m = notRe.exec(joined))) add(`not-${m[2] || m[1]}`, m[0]);
  if (/:host\(\[disabled\]\)/.test(joined)) add('disabled', ':host([disabled])');
  // scoped focus-visible (`.el:focus-visible`) if present, else bare.
  const fv = sels.map((s) => /(\.[\w-]+):focus-visible/.exec(s)).find(Boolean);
  if (fv) add('focus-visible', fv[0]);
  else if (/:focus-visible/.test(joined)) add('focus-visible', ':focus-visible');
  return states;
}
