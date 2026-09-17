/**
 * data-layer.js — the one door from the MCP to `sherpa-ui/data`.
 *
 * The data layer is TypeScript compiled into `dist/`, which is gitignored and
 * which `npm run mcp` does not build. So the import can genuinely fail on a
 * fresh clone, and a tool that throws `ERR_MODULE_NOT_FOUND` at an agent tells
 * it nothing useful. Load once, lazily, and hand back a sentence the agent can
 * act on instead.
 *
 * `dist/data.js` is the entry point, not `dist/core/*`: it is the documented
 * public contract (46 exports, no DOM, proven clean by a node test), and
 * reaching past it into individual core modules is how the MCP would end up
 * depending on internals that are free to move.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_ENTRY = join(ROOT, 'dist', 'data.js');

let _mod = null;
let _error = null;

/**
 * The data layer, or `null` if it is not built.
 *
 * Cached both ways — a repeated failure must not re-attempt the import on every
 * tool call, and the error text must stay the same each time it is reported.
 */
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
