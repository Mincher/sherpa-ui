/**
 * contract-io.mjs — read/write authored contract files (defs, ontology, name-map).
 *
 * These files are authored (humans + AI read and edit them), so they live as YAML.
 * Machine dumps (figma-data/*, figma.tokens.json) stay JSON and DO NOT use this.
 *
 * Both helpers are format-tolerant on read: a `.yaml` file wins, but a legacy
 * `.json` sibling still loads. This lets the codebase migrate one file at a time
 * without a flag day.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';
import { hydrate } from './hydrate-def.mjs';

/** Strip a known contract extension (and a .thin/.def qualifier), return the stem. */
function stem(path) {
  return path.replace(/\.(ya?ml|json)$/i, '').replace(/\.(thin|def)$/i, '');
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
    `${base}.thin.yaml`,       // thin def wins — hydrated to full on load
    `${base}.def.yaml`,        // full def, YAML
    `${base}.yaml`,
    `${base}.yml`,
    `${base}.def.json`,        // full def, legacy JSON
    `${base}.json`,
  ].filter(Boolean);

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, 'utf8');
    const doc = /\.ya?ml$/i.test(file) ? yaml.load(raw) : JSON.parse(raw);
    // A thin def has no $schema — expand it via the shared element-map.
    return isThinDef(doc) ? hydrate(doc) : doc;
  }
  throw new Error(`No contract file found for ${path} (looked for .thin.yaml/.yaml/.json)`);
}

/** A thin component def declares an anatomy + props but omits $schema. */
function isThinDef(doc) {
  return doc && typeof doc === 'object' && !doc.$schema && doc.anatomy && doc.props;
}

/**
 * Write an authored contract as YAML to <stem>.yaml.
 * Returns the path written. Does not delete a legacy .json sibling — the
 * migration step does that once the round-trip check passes.
 */
export function writeContract(path, data) {
  const out = `${stem(path)}.yaml`;
  const body = yaml.dump(data, {
    lineWidth: 100,      // wrap long prose, not mid-token
    noRefs: true,        // never emit YAML anchors/aliases — keep it literal
    quotingType: '"',
    forceQuotes: false,
  });
  writeFileSync(out, body);
  return out;
}
