/**
 * differ.js — Variable diff for Token Studio.
 *
 * Compares two figma-variables.json snapshots and returns a structured
 * diff grouped by collection, with per-mode old/new values.
 */

const COLOR_RE = /^rgba?\(/i;

function isColor(v) {
  return typeof v === 'string' && COLOR_RE.test(v.trim());
}

/**
 * Diff two figma-variables.json objects.
 *
 * @param {object} current — contents of figma-variables.json
 * @param {object} staged  — contents of figma-variables.staged.json
 * @returns {DiffResult}
 *
 * @typedef {{
 *   summary: { added: number, changed: number, removed: number },
 *   byCollection: Record<string, CollectionDiff>
 * }} DiffResult
 *
 * @typedef {{
 *   added:   Array<{ n: string, t: string, newValues: object }>,
 *   removed: Array<{ n: string, t: string, oldValues: object }>,
 *   changed: Array<{ n: string, t: string, oldValues: object, newValues: object, isColor: boolean }>,
 * }} CollectionDiff
 */
export function diff(current, staged) {
  // Collections to compare: all keys that look like variable collections
  // (i.e. have a `vars` array). Skip meta and themes.
  const skip = new Set(['meta', 'themes']);
  const collectionNames = new Set([
    ...Object.keys(current || {}),
    ...Object.keys(staged  || {}),
  ].filter(k => !skip.has(k)));

  const byCollection = {};
  let totalAdded = 0, totalChanged = 0, totalRemoved = 0;

  for (const colName of collectionNames) {
    const curVars  = (current?.[colName]?.vars || []);
    const stagVars = (staged?.[colName]?.vars  || []);

    // Index by variable name
    const curMap  = new Map(curVars.map(v => [v.n, v]));
    const stagMap = new Map(stagVars.map(v => [v.n, v]));

    const added   = [];
    const removed = [];
    const changed = [];

    for (const [n, stagVar] of stagMap) {
      if (!curMap.has(n)) {
        added.push({ n, t: stagVar.t, newValues: stagVar.v });
      } else {
        const curVar = curMap.get(n);
        if (!valuesEqual(curVar.v, stagVar.v)) {
          changed.push({
            n,
            t: stagVar.t,
            oldValues: curVar.v,
            newValues: stagVar.v,
            isColor: stagVar.t === 'COLOR' || isColor(Object.values(stagVar.v)[0]),
          });
        }
      }
    }

    for (const [n, curVar] of curMap) {
      if (!stagMap.has(n)) {
        removed.push({ n, t: curVar.t, oldValues: curVar.v });
      }
    }

    if (added.length || removed.length || changed.length) {
      byCollection[colName] = { added, removed, changed };
      totalAdded   += added.length;
      totalChanged += changed.length;
      totalRemoved += removed.length;
    }
  }

  return {
    summary: { added: totalAdded, changed: totalChanged, removed: totalRemoved },
    byCollection,
  };
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null) return false;
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => a[k] === b[k]);
}
