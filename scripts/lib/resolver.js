/**
 * resolver.js — Token chain resolver for Token Studio.
 *
 * Builds a resolution map from parsed CSS files and resolves
 * CSS custom property references into their full alias chains,
 * down to a terminal value.
 */

// ── Colour detection ────────────────────────────────────────────────

const COLOR_RE = /^(oklch|rgb|rgba|hsl|hsla|#[0-9a-f]{3,8}|transparent|currentcolor)/i;

function isColor(value) {
  return COLOR_RE.test(value.trim());
}

// ── var() extraction ────────────────────────────────────────────────

/**
 * Extract the first var(--prop) reference and its fallback from a CSS value.
 * Handles nested var() in the fallback.
 *
 * @param {string} value
 * @returns {{ prop: string, fallback: string|null } | null}
 */
function extractVar(value) {
  const m = value.match(/var\((--[\w-]+)(?:,\s*([\s\S]+))?\)$/);
  if (!m) {
    // Try from start
    const m2 = value.match(/var\((--[\w-]+)(?:,\s*([\s\S]*))?\)/);
    if (!m2) return null;
    return { prop: m2[1], fallback: m2[2]?.trim() ?? null };
  }
  return { prop: m[1], fallback: m[2]?.trim() ?? null };
}

// ── Theme/mode selector parsing ─────────────────────────────────────

/**
 * Extract theme slug and mode from a :where(:root[...]) selector.
 * Returns null/null for the default (no data-theme, no data-mode).
 */
function parseThemeSelector(selector) {
  const themeMatch = selector.match(/data-theme="([^"]+)"/);
  const modeMatch  = selector.match(/data-mode="([^"]+)"/);
  const mediaMatch = selector.match(/prefers-color-scheme:\s*(dark)/i)
                  || selector.match(/prefers-contrast:\s*(more)/i);

  return {
    theme: themeMatch?.[1] ?? null,  // null = default theme
    mode:  modeMatch?.[1] ?? (mediaMatch ? (mediaMatch[1] === 'dark' ? 'dark' : 'hc') : null),
  };
}

// ── Resolution map builder ──────────────────────────────────────────

/**
 * Build a resolution map from a list of parsed CSS file results.
 *
 * Map shape:
 *   propName → [{
 *     value, selector, file, layer,
 *     theme: string|null,   // null = all themes (default)
 *     mode:  string|null,   // null = light (default)
 *   }]
 *
 * @param {Array<{ file: string, selectors: Array }>} parsedFiles
 * @returns {Map<string, Array>}
 */
export function buildResolutionMap(parsedFiles) {
  const map = new Map();

  for (const { file, selectors } of parsedFiles) {
    for (const block of selectors) {
      const { selector, layer, media, properties } = block;
      const { theme, mode } = parseThemeSelector(selector + (media ? ' ' + media : ''));

      for (const { name, value } of properties) {
        if (!map.has(name)) map.set(name, []);
        map.get(name).push({ value, selector, file, layer, theme, mode });
      }
    }
  }

  return map;
}

// ── Resolution priority ─────────────────────────────────────────────

/**
 * Find the best entry for a property given a theme + mode context.
 * Priority (highest first):
 *   1. Exact theme + exact mode match
 *   2. Exact theme + no mode (light default)
 *   3. No theme (default) + exact mode
 *   4. No theme + no mode (global default)
 *   5. Any entry (fallback)
 */
function findEntry(entries, theme, mode) {
  const norm = s => (s || '').toLowerCase();
  const t = norm(theme);
  const m = norm(mode);

  return (
    entries.find(e => norm(e.theme) === t && norm(e.mode) === m) ||
    entries.find(e => norm(e.theme) === t && !e.mode) ||
    entries.find(e => !e.theme && norm(e.mode) === m) ||
    entries.find(e => !e.theme && !e.mode) ||
    entries[0]
  );
}

// ── Chain resolution ────────────────────────────────────────────────

const MAX_DEPTH = 12;

/**
 * Resolve a CSS custom property to its full alias chain.
 *
 * @param {string} propName          — e.g. '--sherpa-surface-control-primary-default'
 * @param {Map}    resolutionMap     — built by buildResolutionMap()
 * @param {string} [theme]           — theme slug, e.g. 'apex-2-core'
 * @param {string} [mode]            — 'light' | 'dark' | 'hc'
 * @returns {Array<ChainStep>}
 *
 * @typedef {{
 *   property: string,
 *   rawValue: string,
 *   file: string,
 *   selector: string,
 *   layer: string|null,
 *   isTerminal: boolean,
 *   isColor: boolean,
 *   displayValue: string|null,
 *   fallback: string|null,
 * }} ChainStep
 */
export function resolve(propName, resolutionMap, theme = null, mode = null) {
  const chain = [];
  const visited = new Set();

  function step(prop, depth) {
    if (depth > MAX_DEPTH || visited.has(prop)) {
      chain.push({
        property: prop, rawValue: '(unresolved)', file: null, selector: null,
        layer: null, isTerminal: true, isColor: false, displayValue: '(unresolved)', fallback: null,
      });
      return;
    }
    visited.add(prop);

    const entries = resolutionMap.get(prop);
    if (!entries || entries.length === 0) {
      // Property not found in any CSS file — terminal unknown
      chain.push({
        property: prop, rawValue: '(not found)', file: null, selector: null,
        layer: null, isTerminal: true, isColor: false, displayValue: '(not found)', fallback: null,
      });
      return;
    }

    const entry = findEntry(entries, theme, mode);
    const varRef = extractVar(entry.value);

    if (!varRef) {
      // Terminal — direct value
      chain.push({
        property: prop,
        rawValue: entry.value,
        file: entry.file,
        selector: entry.selector,
        layer: entry.layer,
        isTerminal: true,
        isColor: isColor(entry.value),
        displayValue: entry.value,
        fallback: null,
      });
      return;
    }

    // Non-terminal — has a var() reference
    chain.push({
      property: prop,
      rawValue: entry.value,
      file: entry.file,
      selector: entry.selector,
      layer: entry.layer,
      isTerminal: false,
      isColor: false,
      displayValue: null,
      fallback: varRef.fallback ?? null,
    });

    // Check if the referenced property exists; if not, use fallback
    if (!resolutionMap.has(varRef.prop) && varRef.fallback) {
      chain.push({
        property: varRef.prop,
        rawValue: varRef.fallback,
        file: null,
        selector: '(fallback)',
        layer: null,
        isTerminal: true,
        isColor: isColor(varRef.fallback),
        displayValue: varRef.fallback,
        fallback: null,
      });
      return;
    }

    step(varRef.prop, depth + 1);
  }

  step(propName, 0);
  return chain;
}
