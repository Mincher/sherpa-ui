#!/usr/bin/env node
/**
 * vendor.mjs — copy the generation code this MCP runs into `vendor/` as it is
 * packed, so sherpa-ui ships no tooling: only the data the code reads (specs,
 * tokens, the name map), which the code finds through SHERPA_UI_ROOT.
 * `--clean` removes the copy again. TRAP T-the-mcp-reads-sherpa-ui-through-one-door
 *
 *   node scripts/vendor.mjs [--clean]      (npm runs it as prepack / postpack)
 *
 * Map:
 * - CODE — the sherpa-ui files copied, by their path under sherpa-ui's root
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHERPA = join(HERE, '..', '..');
const VENDOR = join(HERE, '..', 'vendor');

/** The sherpa-ui files copied, by their path under sherpa-ui's root. Their own
 *  relative imports hold, because each keeps its place under `scripts/`. */
export const CODE = [
  'scripts/lib/generation/data.mjs', 'scripts/lib/generation/compile-def.mjs',
  'scripts/lib/generation/validate-def.mjs', 'scripts/lib/generation/resolve.mjs',
  'scripts/lib/contract-io.mjs', 'scripts/lib/scope-rules.mjs', 'scripts/lib/component-to-def.mjs',
  'scripts/audit-bindings.mjs',
];

rmSync(VENDOR, { recursive: true, force: true });
if (!process.argv.includes('--clean')) {
  for (const file of CODE) {
    mkdirSync(dirname(join(VENDOR, file)), { recursive: true });
    cpSync(join(SHERPA, file), join(VENDOR, file));
  }
}
