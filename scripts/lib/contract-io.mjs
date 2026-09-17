/**
 * contract-io.mjs — read/write authored contract files (ontology, name-map).
 *
 * These files are authored (humans + AI read and edit them), so they live as YAML.
 * Machine dumps (figma-data/*, figma.tokens.json) stay JSON and DO NOT use this.
 *
 * Both helpers are format-tolerant on read: a `.yaml` file wins, but a legacy
 * `.json` sibling still loads. This lets the codebase migrate one file at a time
 * without a flag day.
 *
 * NOTE: the thin-def flow is retired. Component defs are no longer authored as
 * `*.thin.yaml` (nor hydrated here) — `*.component.yaml` is the single component
 * contract, read directly (see scripts/lib/generation/data.mjs :: loadDef). This
 * loader now serves only the non-component contracts (ontology/structure/name-map).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';

/** Strip a known contract extension (and a legacy .def qualifier), return the stem. */
function stem(path) {
  return path.replace(/\.(ya?ml|json)$/i, '').replace(/\.def$/i, '');
}

/**
 * Load an authored contract by path (with or without extension).
 * Resolution order: exact path if it exists → <stem>.yaml → <stem>.json.
 * Returns the parsed object. Throws if no sibling exists.
 */
export function loadContract(path) {
  const base = stem(path);
  const candidates = [
    /\.(ya?ml|json)$/i.test(path) ? path : null,
    `${base}.yaml`,
    `${base}.yml`,
    `${base}.json`,
  ].filter(Boolean);

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, 'utf8');
    return /\.ya?ml$/i.test(file) ? yaml.load(raw) : JSON.parse(raw);
  }
  throw new Error(`No contract file found for ${path} (looked for .yaml/.yml/.json)`);
}

