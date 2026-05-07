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

/**
 * Per-page-load cache-busting token. Appended as a query string to every
 * fetched CSS URL so a hard reload always pulls the latest stylesheet from
 * disk, defeating any aggressive HTTP caching by browsers, Vite dev servers,
 * or CDN intermediaries. The in-memory _cache (above) is keyed by the
 * original URL so we still dedupe parse work within a single page load.
 */
const _bust = `v=${Date.now()}`;

function _withBust(url) {
  return url + (url.includes("?") ? "&" : "?") + _bust;
}

const IMPORT_RE =
  /@import\s+(?:url\(\s*['"]?(.+?)['"]?\s*\)|['"](.+?)['"])\s*;/g;

/* Match url(...) refs that are NOT inside an @import (handled separately).
   Skips data: URIs and already-absolute URLs. */
const URL_RE = /url\(\s*(['"]?)(?!data:|https?:|\/\/|#)([^'")]+)\1\s*\)/g;

/**
 * Rewrite relative url(...) references in CSS text to be absolute against
 * the CSS file's own URL. Required because constructable stylesheets
 * resolve url() against the *document* base, not the source CSS URL —
 * which would break @font-face src paths for stylesheets fetched from a
 * CDN (e.g. Font Awesome's webfonts/ folder).
 */
function absolutiseUrls(css, base) {
  return css.replace(URL_RE, (match, quote, href) => {
    try {
      const abs = new URL(href, base).href;
      return `url(${quote}${abs}${quote})`;
    } catch {
      return match;
    }
  });
}

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
      const resp = await fetch(_withBust(url));
      if (!resp.ok) throw new Error(resp.status);
      const imported = await resp.text();
      const inlined = await resolveImports(imported, url);
      // Absolutise url() refs in the imported CSS against ITS source URL
      // before splicing into the parent stylesheet — relative paths in the
      // child must not be re-resolved against the parent's location.
      const absolutised = absolutiseUrls(inlined, url);
      resolved = resolved.replace(m[0], absolutised);
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
    const resp = await fetch(_withBust(url));
    if (!resp.ok) throw new Error(`CSS ${resp.status} ${url}`);
    const raw = await resp.text();
    const imported = await resolveImports(raw, url);
    // Absolutise url() refs against the source CSS URL — constructable
    // stylesheets otherwise resolve relative paths against the document,
    // which breaks @font-face for sheets fetched from a CDN.
    const css = absolutiseUrls(imported, url);
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
