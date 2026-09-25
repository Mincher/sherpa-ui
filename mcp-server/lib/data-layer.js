/**
 * data-layer.js — the one door from the MCP to `sherpa-ui/data`.
 *
 * `dist/` is gitignored and `npm run mcp` does not build it, so the import can
 * genuinely fail on a fresh clone. Load lazily and report it as that.
 *
 * Import `dist/data.js`, never `dist/core/*` — only the entry point is a stable
 * contract.
 *
 * Map:
 * - loadDataLayer — The data layer, or `null` if it is not built.
 * - dataLayerError — Why the data layer is unavailable, phrased for an agent that must act on it.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_ENTRY = join(ROOT, 'dist', 'data.js');

let _mod = null;
let _error = null;

/** The data layer, or `null` if it is not built. Success AND failure are cached. */
export async function loadDataLayer() {
  if (_mod || _error) return _mod;
  if (!existsSync(DATA_ENTRY)) {
    _error = 'not built';
    return null;
  }
  try {
    _mod = await import(`file://${DATA_ENTRY}`);
  } catch (e) {
    _error = e.message;
  }
  return _mod;
}

/** Why the data layer is unavailable, phrased for an agent that must act on it. */
export function dataLayerError() {
  return `The data layer is not available (${_error ?? 'unknown'}).\n\n`
    + 'It is TypeScript compiled into `dist/`, which is gitignored and which '
    + '`npm run mcp` does not build. Run `npm run build` in the repo root, then '
    + 'retry — no other setup is needed.';
}
