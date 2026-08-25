/**
 * data.mjs — cached loaders for the generation lib's reference data.
 * The ontology, name-map, and variable graph. Loaded once, cached.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from '../contract-io.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const P = {
  // authored files — YAML preferred, resolved via loadContract (JSON fallback)
  ontology: join(ROOT, 'docs', 'ontology', 'tokens'),
  structure: join(ROOT, 'docs', 'ontology', 'structure'),
  nameMap: join(ROOT, 'scripts', 'figma-data', 'name-map'),
  // machine dump — stays JSON
  graph: join(ROOT, 'scripts', 'figma-data', 'variable-graph.json'),
  components: join(ROOT, 'src', 'components'),
};

const _cache = {};
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const readAuthored = (base) => { try { return loadContract(base); } catch { return null; } };

export function loadOntology() {
  return (_cache.ontology ??= readAuthored(P.ontology) ?? {});
}
export function loadStructure() {
  return (_cache.structure ??= readAuthored(P.structure) ?? {});
}
export function loadNameMap() {
  return (_cache.nameMap ??= readAuthored(P.nameMap)?.map ?? {});
}
export function loadGraph() {
  return (_cache.graph ??= readJson(P.graph) ?? {});
}
/** The list of real components (dir names in src/components). */
export function loadComponentNames() {
  return (_cache.components ??= existsSync(P.components) ? readdirSync(P.components) : []);
}
/** Read a component's def (thin YAML preferred, hydrated; JSON fallback), or null. */
export function loadDef(name) {
  const base = join(P.components, name, `${name}.def`);
  try { return loadContract(base); } catch { return null; }
}
export const PATHS = P;
export const ROOT_DIR = ROOT;
