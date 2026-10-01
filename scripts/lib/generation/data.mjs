/**
 * data.mjs — cached loaders for the generation lib's reference data.
 * The component specs, the name-map, and the generated token sheet. Loaded
 * once, cached.
 *
 * There is no ontology loader. `docs/ontology/` was deleted 2026-09-16 for
 * having rotted, `loadOntology()` returned `{}` for a year of callers that read
 * that as "this token is wrong", and the scripts that built it went
 * 2026-09-17. Token NAMES come from `loadCssTokenNames()` — the generated
 * sheet, which cannot go stale by hand. ROLE and PURPOSE have no source, and
 * that is now a stated gap rather than a silent null.
 *
 * Map:
 * - loadCssTokenNames — Every `--sherpa-*` token name declared in the generated sheet, as a Set.
 * - loadNameMap — the Figma-name → component map, cached
 * - loadComponentNames — The list of real components (dir names in src/components).
 * - loadSpec — The RAW spec — `<name>.component.json` as written, or null.
 * - loadDef — a component's spec as a def, or null
 * - PATHS — where every generation input lives
 * - ROOT_DIR — the repo root, as an absolute path
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from '../contract-io.mjs';
import { specToDef } from '../component-to-def.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const P = {
  // authored files — YAML preferred, resolved via loadContract (JSON fallback)
  nameMap: join(ROOT, 'scripts', 'figma-data', 'name-map'),
  components: join(ROOT, 'src', 'components'),
  // The GENERATED token sheet — re-projected from Figma by project-tokens.mjs,
  // so it is the one list of token names that cannot go stale by hand.
  tokensCss: join(ROOT, 'src', 'styles', 'tokens', 'tokens.css'),
};

const _cache = {};
const readAuthored = (base) => { try { return loadContract(base); } catch { return null; } };

/**
 * Every `--sherpa-*` token name declared in the generated sheet, as a Set.
 *
 * This is the answer to "is this token real", and the only one there is. The
 * ontology used to answer it; when it was deleted, every caller that read "no
 * entry" as "wrong name" reported all 115 def token aliases as suspect — 1173
 * warnings, 1157 of them false, hiding 14 real ones.
 *
 * `tokens.css` is re-projected from Figma and gated, so it cannot rot the way a
 * hand-written ontology did. It carries only the NAME — no role, no caveat —
 * which is exactly the question the name check asks.
 *
 * Returns an EMPTY set if the sheet is missing; callers must treat that as "I
 * cannot answer" and stay quiet, never as "nothing is real".
 */
export function loadCssTokenNames() {
  return (_cache.cssTokens ??= (() => {
    const set = new Set();
    if (!existsSync(P.tokensCss)) return set;
    const css = readFileSync(P.tokensCss, 'utf8');
    for (const m of css.matchAll(/^\s*(--sherpa-[a-z0-9-]+)\s*:/gm)) set.add(m[1]);
    return set;
  })());
}
export function loadNameMap() {
  return (_cache.nameMap ??= readAuthored(P.nameMap)?.map ?? {});
}
/** The list of real components (dir names in src/components). */
export function loadComponentNames() {
  return (_cache.components ??= existsSync(P.components) ? readdirSync(P.components) : []);
}
/**
 * Read a component's def, or null.
 *
 * The single component contract is `<name>.component.json` (the DTCG-dialect spec —
 * `*.thin.yaml` is retired). We adapt it to the legacy `def` shape the MCP + the
 * generation lib consume: specToDef supplies name/description/anatomy/templates/
 * props/events/tokens; the Figma binding (figmaName, category, figma summary) is
 * lifted from `$extensions.sherpa`.
 */
/**
 * The RAW spec — `<name>.component.json` as written, or null.
 *
 * `loadDef` converts a spec into the shape `compileDef` walks, and that
 * conversion drops `$extensions` entirely: the compiler has no use for a Figma
 * name or a method list. But the METHODS live there, and they are the whole
 * callable surface — 45 of them across 23 components — so anything asking
 * "what can a caller DO to this" has to read the spec, not the def.
 */
export function loadSpec(name) {
  const specPath = join(P.components, name, `${name}.component.json`);
  if (!existsSync(specPath)) return null;
  try { return JSON.parse(readFileSync(specPath, 'utf8')) ?? null; } catch { return null; }
}

export function loadDef(name) {
  const specPath = join(P.components, name, `${name}.component.json`);
  if (!existsSync(specPath)) return null;
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return null; }
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
