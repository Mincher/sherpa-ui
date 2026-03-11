/**
 * data-store.js — Shared cache for query bundle JSON files.
 *
 * Provides deduped fetch + cache so multiple viz components that share
 * the same query bundle URL don't re-fetch.
 *
 * Query bundle JSON shape:
 *
 *   {
 *     "total-revenue":    { "dataset": "sales", ... },
 *     "sales-by-region": { "dataset": "sales", ... }
 *   }
 *
 * Exports:
 *   loadQueryBundle(url)       — Fetch + cache a bundle.  Returns the full object.
 *   getQueryConfig(url, key)   — Returns a single query config entry from a bundle.
 */

/* ── Bundle cache ───────────────────────────────────────────────── */

const bundleCache = new Map();

/**
 * Fetch and cache a query bundle JSON file.
 * Concurrent calls for the same URL share a single in-flight request.
 *
 * @param {string} url — URL of the query bundle JSON file.
 * @returns {Promise<Object>} — The full bundle object.
 */
export async function loadQueryBundle(url) {
  if (!url) return {};
  if (bundleCache.has(url)) return bundleCache.get(url);

  const promise = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      // Replace the Promise in the cache with the resolved object
      // so synchronous callers (getQueryConfig) can read it.
      bundleCache.set(url, data);
      return data;
    });
  bundleCache.set(url, promise);
  return promise;
}

/**
 * Return a single query config entry from a cached bundle.
 *
 * @param {string} url — URL of the query bundle JSON file.
 * @param {string} key — Query key within the bundle.
 * @returns {Object|null}
 */
export function getQueryConfig(url, key) {
  if (!url || !key || !bundleCache.has(url)) return null;
  const entry = bundleCache.get(url);
  if (entry && typeof entry.then !== "function") {
    return entry[key] || null;
  }
  return null;
}
