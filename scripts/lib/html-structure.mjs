/**
 * html-structure.mjs — parse a component's `<template>` markup into a node tree,
 * and compare two trees structurally.
 *
 * ONE copy, because there were two and they had drifted.
 * `generate-component-spec.mjs` (the gated `spec:check` path) and
 * `roundtrip-component.mjs` (the per-component human report) each carried a
 * private copy of these six functions. Three were byte-identical; the rest were
 * not, and every divergence was a fix that had landed in one copy only:
 *
 *   - `findMatchingClose` was made COMMENT-AWARE in the generator after a comment
 *     that merely mentioned `<span>` pushed the tag depth one too deep and made an
 *     element swallow every sibling after it. The other copy never got it.
 *   - The `<slot>` FALLBACK-content handling landed in the generator only.
 *
 * The two then disagreed on 5 of 58 components — one reporting 58/58 green while
 * the other failed five. A second implementation of a check is a second answer to
 * "is this correct", and the two will not stay equal.
 *
 * Parsing is deliberately NOT general HTML. It handles exactly the deterministic
 * markup both sides emit: nested tags with attributes, void elements, and
 * `<slot>`. That is enough, and a real parser would accept markup the compiler
 * can never produce.
 */

/* ══ parsing ═══════════════════════════════════════════════════════════════════ */

/** `<template id="x">…</template>` blocks → `{ id: nodes[] }`. */
export function parseTemplates(html) {
  const templates = {};
  const re = /<template id="([^"]+)">([\s\S]*?)<\/template>/g;
  let m;
  while ((m = re.exec(html))) templates[m[1]] = parseNodes(m[2].trim());
  return templates;
}

function voidTag(t) {
  return ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(t);
}

function parseAttrs(s) {
  const attrs = {};
  const re = /([:\w-]+)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(s))) { if (m[1]) attrs[m[1]] = m[2] ?? ''; }
  return attrs;
}

/**
 * The byte range each `<!-- … -->` occupies, so tag scanning can ignore them.
 *
 * `parseNodes` already skips comments; `findMatchingClose` did NOT, and it is the
 * one that COUNTS tags. A comment that merely MENTIONS a tag — "a bare <span>
 * with an aria-label is ignored by AT" — therefore pushed the depth one too deep,
 * the true close was never matched, and the element swallowed every sibling after
 * it to the end of the source. In sherpa-quick-filter that put `.icon` and
 * `.label` inside `.count-wrap` and emitted a phantom `/span` node from the
 * unconsumed close tag.
 */
function commentRanges(src) {
  const out = [];
  let i = 0;
  for (;;) {
    const start = src.indexOf('<!--', i);
    if (start === -1) return out;
    const close = src.indexOf('-->', start + 4);
    const end = close === -1 ? src.length : close + 3;
    out.push([start, end]);
    i = end;
  }
}

function findMatchingClose(src, from, tag, endTag) {
  const comments = commentRanges(src);
  // A hit inside a comment is TEXT, not markup — step past the whole comment and
  // look again, rather than counting it.
  const skip = (at) => {
    for (const [start, end] of comments) if (at >= start && at < end) return end;
    return -1;
  };
  const find = (needle, at) => {
    let k = at;
    for (;;) {
      const hit = src.indexOf(needle, k);
      if (hit === -1) return -1;
      const past = skip(hit);
      if (past === -1) return hit;
      k = past;
    }
  };
  let depth = 1, i = from;
  while (i < src.length) {
    const nextOpen = find(`<${tag}`, i);
    const nextClose = find(endTag, i);
    if (nextClose === -1) return src.length;
    if (nextOpen !== -1 && nextOpen < nextClose && /[\s>/]/.test(src[nextOpen + 1 + tag.length] || '>')) {
      depth++; i = nextOpen + 1;
    } else { depth--; if (depth === 0) return nextClose; i = nextClose + endTag.length; }
  }
  return src.length;
}

function parseNodes(src) {
  const nodes = [];
  let i = 0;
  const len = src.length;
  while (i < len) {
    while (i < len && /\s/.test(src[i])) i++;
    if (i >= len) break;
    if (src.startsWith('<!--', i)) { i = src.indexOf('-->', i) + 3; continue; }
    if (src[i] !== '<') { const next = src.indexOf('<', i); i = next === -1 ? len : next; continue; }
    const close = src.indexOf('>', i);
    const raw = src.slice(i + 1, close);
    const selfClosing = raw.endsWith('/');
    const inner = selfClosing ? raw.slice(0, -1).trim() : raw.trim();
    const sp = inner.search(/\s/);
    const tag = (sp === -1 ? inner : inner.slice(0, sp)).toLowerCase();
    const attrStr = sp === -1 ? '' : inner.slice(sp + 1);
    const attrs = parseAttrs(attrStr);
    i = close + 1;
    if (selfClosing || voidTag(tag)) { nodes.push({ tag, attrs, children: [] }); continue; }
    // `<slot>` is a CONTAINER (it may hold fallback content) — consume its close
    // tag rather than leaving `</slot>` to be mis-parsed as a phantom node. Its
    // children are KEPT: a slot's fallback is what it shows when nothing is
    // projected, and dropping it was the largest round-trip gap this repo had.
    const endTag = `</${tag}>`;
    const endIdx = findMatchingClose(src, i, tag, endTag);
    const childSrc = src.slice(i, endIdx);
    nodes.push({ tag, attrs, children: parseNodes(childSrc) });
    i = endIdx + endTag.length;
  }
  return nodes;
}

/* ══ structural compare ════════════════════════════════════════════════════════ */

/**
 * A node reduced to what the spec DETERMINES: tag, class, part, the attribute
 * set, and child order. Everything else is formatting, and comparing it would
 * fail on whitespace.
 */
function normNode(n) {
  const a = { ...n.attrs };
  const out = { tag: n.tag };
  if (n.tag === 'slot') out.slotName = a.name ?? '';
  out.class = a.class ?? '';
  out.part = a.part ?? '';
  delete a.class; delete a.part;
  out.attrs = Object.fromEntries(Object.entries(a).sort());
  out.children = (n.children ?? []).map(normNode);
  return out;
}

/** Walk two normalised nodes in step, pushing a line per difference. */
function nodeDiff(gen, real, path, diffs) {
  if (!gen || !real) { diffs.push(`${path}: node present on one side only`); return; }
  for (const k of ['tag', 'class', 'part', 'slotName']) {
    if ((gen[k] ?? '') !== (real[k] ?? '')) diffs.push(`${path}: ${k} "${gen[k] ?? ''}"≠"${real[k] ?? ''}"`);
  }
  if (JSON.stringify(gen.attrs) !== JSON.stringify(real.attrs)) diffs.push(`${path}: attrs differ`);
  const gc = gen.children ?? [], rc = real.children ?? [];
  if (gc.length !== rc.length) diffs.push(`${path}: ${gc.length}≠${rc.length} children`);
  for (let i = 0; i < Math.max(gc.length, rc.length); i++) {
    nodeDiff(gc[i], rc[i], `${path}>${(gc[i]?.tag || rc[i]?.tag)}[${i}]`, diffs);
  }
}

/** Compare every `<template>` in two documents. Pushes into `diffs`. */
export function htmlDiff(genHtml, realHtml, diffs) {
  const g = parseTemplates(genHtml), r = parseTemplates(realHtml);
  for (const id of new Set([...Object.keys(g), ...Object.keys(r)])) {
    if (!g[id] || !r[id]) { diffs.push(`HTML template "${id}" one-sided`); continue; }
    const gn = g[id].map(normNode), rn = r[id].map(normNode);
    for (let i = 0; i < Math.max(gn.length, rn.length); i++) {
      nodeDiff(gn[i], rn[i], `HTML ${id}[${i}]`, diffs);
    }
  }
}
