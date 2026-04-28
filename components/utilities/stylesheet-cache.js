/**
 * stylesheet-cache.js — Constructable-stylesheet cache for SherpaElement.
 *
 * Fetches CSS text once per URL, resolves @import statements by inlining
 * the imported CSS, and returns a shared CSSStyleSheet object that can
 * be assigned to multiple shadow roots via adoptedStyleSheets.
 *
 * Every caller requesting the same URL receives the identical CSSStyleSheet
 * reference, eliminating duplicate parse work across component instances.
 */

/** @type {Map<string, Promise<CSSStyleSheet>>} */
const _cache = new Map();

const IMPORT_RE =
  /@import\s+(?:url\(\s*['"]?(.+?)['"]?\s*\)|['"](.+?)['"])\s*;/g;

/**
 * Recursively inline @import rules in CSS text.
 * @param {string} css  — raw CSS text
 * @param {string} base — absolute URL of the CSS file (for relative resolution)
 */
async function resolveImports(css, base) {
  const matches = [...css.matchAll(IMPORT_RE)];
  if (!matches.length) return css;

  let resolved = css;
  for (const m of matches) {
    const href = m[1] || m[2];
    const url = new URL(href, base).href;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(resp.status);
      const imported = await resp.text();
      const inlined = await resolveImports(imported, url);
      resolved = resolved.replace(m[0], inlined);
    } catch {
      resolved = resolved.replace(m[0], `/* @import failed: ${href} */`);
    }
  }
  return resolved;
}

/**
 * Return a shared CSSStyleSheet for the given URL.  The sheet is fetched
 * and parsed once; every subsequent caller receives the same object.
 *
 * @param {string} url — absolute URL of the CSS file
 * @returns {Promise<CSSStyleSheet>}
 */
export function getSheet(url) {
  if (_cache.has(url)) return _cache.get(url);

  const promise = (async () => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`CSS ${resp.status} ${url}`);
    const raw = await resp.text();
    const css = await resolveImports(raw, url);
    const sheet = new CSSStyleSheet();
    await sheet.replace(css);
    return sheet;
  })();

  _cache.set(url, promise);

  // On failure remove cache entry so the next caller can retry.
  promise.catch(() => {
    if (_cache.get(url) === promise) _cache.delete(url);
  });

  return promise;
}
