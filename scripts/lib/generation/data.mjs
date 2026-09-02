/**
 * data.mjs — cached loaders for the generation lib's reference data.
 * The ontology, name-map, and variable graph. Loaded once, cached.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { loadContract } from '../contract-io.mjs';
import { specToDef } from '../component-to-def.mjs';

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
/**
 * Read a component's def, or null.
 *
 * The single component contract is `<name>.component.yaml` (the DTCG-dialect spec —
 * `*.thin.yaml` is retired). We adapt it to the legacy `def` shape the MCP + the
 * generation lib consume: specToDef supplies name/description/anatomy/templates/
 * props/events/tokens; the Figma binding (figmaName, category, figma summary) is
 * lifted from `$extensions.sherpa`.
 */
export function loadDef(name) {
  const specPath = join(P.components, name, `${name}.component.yaml`);
  if (!existsSync(specPath)) return null;
  let spec;
  try { spec = yaml.load(readFileSync(specPath, 'utf8')); } catch { return null; }
  if (!spec || typeof spec !== 'object') return null;
  const def = specToDef(spec);
  // specToDef drops native-no-kind props (e.g. `disabled`) because compileDef must
  // not observe them — but the MCP wants the FULL public API. Use the raw spec props
  // (strip the $type marker), keeping name/type/kind/values/default/native/description.
  if (Array.isArray(spec.props)) {
    def.props = spec.props.map(({ $type, ...p }) => p);
  }
  const ext = (spec.$extensions && spec.$extensions.sherpa) || {};
  if (ext.figmaName) def.figmaName = ext.figmaName;
  if (ext.category) def.category = ext.category;
  // A minimal `figma` summary in the legacy shape (the MCP reads figma.built +
  // variant/bool props). `built:true` when a figmaName is bound.
  def.figma = {
    _status: ext.figmaName ? 'matched' : 'no-figma',
    figmaName: ext.figmaName ?? null,
    built: !!ext.figmaName,
    variantAxes: ext.variantAxes ?? [],
    booleanProps: ext.booleanProps ?? [],
  };
  return def;
}
export const PATHS = P;
export const ROOT_DIR = ROOT;
