/**
 * data.mjs — cached loaders for the generation lib's reference data.
 * The ontology, name-map, and variable graph. Loaded once, cached.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const P = {
  ontology: join(ROOT, 'docs', 'ontology', 'tokens.json'),
  structure: join(ROOT, 'docs', 'ontology', 'structure.json'),
  nameMap: join(ROOT, 'scripts', 'figma-data', 'name-map.json'),
  graph: join(ROOT, 'scripts', 'figma-data', 'variable-graph.json'),
  components: join(ROOT, 'src', 'components'),
};

const _cache = {};
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

export function loadOntology() {
  return (_cache.ontology ??= readJson(P.ontology) ?? {});
}
export function loadStructure() {
  return (_cache.structure ??= readJson(P.structure) ?? {});
}
export function loadNameMap() {
  return (_cache.nameMap ??= readJson(P.nameMap)?.map ?? {});
}
export function loadGraph() {
  return (_cache.graph ??= readJson(P.graph) ?? {});
}
/** The list of real components (dir names in src/components). */
export function loadComponentNames() {
  return (_cache.components ??= existsSync(P.components) ? readdirSync(P.components) : []);
}
/** Read a component's def, or null. */
export function loadDef(name) {
  const p = join(P.components, name, `${name}.def.json`);
  return readJson(p);
}
export const PATHS = P;
export const ROOT_DIR = ROOT;
