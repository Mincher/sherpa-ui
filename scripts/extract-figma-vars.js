#!/usr/bin/env node
/**
 * extract-figma-vars.js — Fetch Figma Variables via REST API
 *
 * Reads all variable collections from the Figma file and writes them
 * to figma-tokens/figma-variables.json in the shape consumed by
 * generate-css-tokens.js.
 *
 * Produces a full { modes: ["Light","Dark"], vars: [...] } object for
 * every theme collection (base + extended), so each theme can generate
 * a standalone CSS file.
 *
 * Requires:
 *   FIGMA_ACCESS_TOKEN  — personal access token with file_variables:read scope
 *                         (Enterprise plan required for the Variables API)
 *
 * Usage:
 *   FIGMA_ACCESS_TOKEN=xxx node scripts/extract-figma-vars.js
 *   # or: export FIGMA_ACCESS_TOKEN=xxx && npm run tokens:extract
 *   # or: npm run tokens:refresh   (extract + generate in one step)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Config ─────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT_FILE    = process.env.FIGMA_VARIABLES_OUT || path.join(ROOT, 'figma-tokens', 'figma-variables.json');
const CONFIG_FILE = path.join(ROOT, 'figma-tokens', 'figma-config.json');

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnvFile(path.join(ROOT, '.env'));

const TOKEN = process.env.FIGMA_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('Error: FIGMA_ACCESS_TOKEN environment variable is required.');
  console.error('  Copy .env.example → .env, fill in your token, then re-run.');
  console.error('  Usage: FIGMA_ACCESS_TOKEN=xxx npm run tokens:extract');
  process.exit(1);
}

// Read the committed bootstrap config (file key + theme collection IDs).
// figma-variables.json is gitignored; figma-config.json is the stable source.
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch {
  console.error(`Error: Cannot read ${CONFIG_FILE}.`);
  console.error('  Ensure figma-tokens/figma-config.json is present and valid JSON.');
  process.exit(1);
}

const FILE_KEY = config.file?.key;
if (!FILE_KEY || FILE_KEY.startsWith('REPLACE_WITH')) {
  console.error('Error: figma-config.json must contain a valid file.key (replace the placeholder).');
  process.exit(1);
}

const API_BASE = 'https://api.figma.com';

// ─── API Helpers ────────────────────────────────────────────────────

/**
 * GET a Figma API endpoint with exponential backoff on rate limit (429) responses.
 * Delays: 1s → 2s → 4s → 8s (maxRetries = 4 attempts beyond the initial try).
 */
async function figmaGet(endpoint, { maxRetries = 4, baseDelayMs = 1000 } = {}) {
  const url = `${API_BASE}${endpoint}`;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.log(`  Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, delay));
    }
    console.log(`  GET ${url}`);
    const res = await fetch(url, { headers: { 'X-Figma-Token': TOKEN } });
    if (res.status === 429 && attempt < maxRetries) continue;
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Figma API ${res.status}: ${body}`);
    }
    return res.json();
  }
}

// ─── Collection / Theme Identification ──────────────────────────────

/**
 * Resolve theme collection IDs against the live API response.
 *
 * Collection IDs change whenever a collection is recreated in Figma. This
 * function treats the IDs stored in figma-config.json as a cache: if a stored
 * ID is no longer present in the API, it falls back to name-matching and
 * automatically writes the updated ID back to figma-config.json so the next
 * run is silent. No manual maintenance required.
 */
function resolveAndHealCollectionIds(themes, collections, configFilePath) {
  const nameToId = {};
  for (const [id, col] of Object.entries(collections)) {
    // Keep the first match per name (Figma may surface duplicates)
    if (!nameToId[col.name]) nameToId[col.name] = id;
  }

  let healed = false;

  function resolveEntry(entry) {
    if (collections[entry.collectionId]) return; // ID still valid
    const resolvedId = nameToId[entry.name];
    if (resolvedId) {
      entry.collectionId = resolvedId;
      healed = true;
    } else {
      console.warn(`  ⚠ Collection "${entry.name}" not found in API — theme may be incomplete`);
    }
  }

  resolveEntry(themes.base);
  for (const ext of themes.extended) resolveEntry(ext);

  if (healed) {
    const configObj = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    configObj.themes.base.collectionId = themes.base.collectionId;
    for (const ext of themes.extended) {
      const stored = configObj.themes.extended.find(e => e.name === ext.name);
      if (stored) stored.collectionId = ext.collectionId;
    }
    fs.writeFileSync(configFilePath, JSON.stringify(configObj, null, 2) + '\n', 'utf8');
    console.log(`  ✓ figma-config.json collection IDs auto-updated\n`);
  }
}

/**
 * Build the set of collection IDs that are "theme" collections.
 * Call resolveAndHealCollectionIds first to ensure IDs are current.
 */
function identifyThemeCollections(collections, themes) {
  const baseId = themes.base.collectionId;
  const themeIds = new Set([baseId, ...themes.extended.map(e => e.collectionId)]);

  // Also include any API-reported extensions of the base (isExtension flag)
  for (const [id, col] of Object.entries(collections)) {
    if (col.isExtension && (col.rootVariableCollectionId === baseId || col.parentVariableCollectionId === baseId)) {
      themeIds.add(id);
    }
  }

  return themeIds;
}

// ─── Value Conversion ───────────────────────────────────────────────

/**
 * Build a lookup map from variable ID → { name, collectionName, collectionId }.
 * Used to resolve VariableAlias references into `@path/name` strings.
 */
function buildVarIdMap(variables, collections) {
  const map = new Map();
  for (const [varId, v] of Object.entries(variables)) {
    const col = collections[v.variableCollectionId];
    map.set(varId, {
      name: v.name,
      collectionName: col?.name || '',
      collectionId: v.variableCollectionId,
    });
  }
  return map;
}

function varIdToRef(varId, varIdMap) {
  const info = varIdMap.get(varId);
  if (!info) return null;
  return `@${info.name}`;
}

/**
 * Convert a Figma API variable value to the JSON format used by our system.
 *
 *   Boolean / Number / String  — pass through
 *   Color { r, g, b, a }       — rgba() string
 *   VariableAlias { type, id } — @reference string
 */
function convertValue(val, varIdMap) {
  if (val === null || val === undefined) return null;

  if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    return varIdToRef(val.id, varIdMap);
  }

  if (typeof val === 'object' && 'r' in val && 'g' in val && 'b' in val) {
    const r = Math.round(val.r * 255);
    const g = Math.round(val.g * 255);
    const b = Math.round(val.b * 255);
    const a = val.a !== undefined ? val.a : 1;
    if (a < 1) return `rgba(${r},${g},${b},${parseFloat(a.toFixed(4))})`;
    return `rgba(${r},${g},${b},1)`;
  }

  return val;
}

// ─── Collection Extraction ──────────────────────────────────────────

/**
 * Extract a single collection's variables into our JSON format.
 *
 * For extended collections, we merge inherited variables from the base
 * with any overrides, so the output is a complete set of variables.
 *
 * NOTE (mode ID quirk): In the Figma Plugin API, extended collections store
 * their valuesByMode using the BASE collection's mode IDs (e.g. "10845:5"),
 * not the extended collection's own mode IDs. The REST API handles this
 * differently via the isExtension/variableOverrides/parentModeId mechanism.
 * If switching from REST to Plugin API extraction, the mode ID lookup must
 * be adjusted accordingly.
 *
 * @param {string} collectionId - The collection to extract
 * @param {object} collections  - All collections from the API
 * @param {object} variables    - All variables from the API
 * @param {Map} varIdMap        - Variable ID → name/collection lookup
 * @returns {{ modes: string[], vars: object[] } | null}
 */
function extractCollection(collectionId, collections, variables, varIdMap) {
  const col = collections[collectionId];
  if (!col) return null;

  const modes = col.modes.map(m => m.name);
  const modeIdToName = {};
  for (const m of col.modes) {
    modeIdToName[m.modeId] = m.name;
  }

  let baseVariables = null;

  if (col.isExtension) {
    // Build parent mode name mapping (extended modeId → parent mode name)
    const parentModeMap = {};
    for (const m of col.modes) {
      if (m.parentModeId) {
        const parentCol = collections[col.parentVariableCollectionId || col.rootVariableCollectionId];
        if (parentCol) {
          const parentMode = parentCol.modes.find(pm => pm.modeId === m.parentModeId);
          if (parentMode) parentModeMap[m.modeId] = parentMode.name;
        }
      }
    }

    // Collect base (root) variable values for inheritance
    const rootId = col.rootVariableCollectionId || col.parentVariableCollectionId;
    if (rootId) {
      baseVariables = {};
      const rootCol = collections[rootId];
      for (const [varId, v] of Object.entries(variables)) {
        if (v.variableCollectionId !== rootId) continue;
        const vals = {};
        for (const m of rootCol.modes) {
          vals[m.name] = convertValue(v.valuesByMode?.[m.modeId], varIdMap);
        }
        baseVariables[varId] = { name: v.name, type: v.resolvedType, values: vals };
      }
    }
  }

  const varList = [];
  const processedNames = new Set();

  // Extended: start with inherited base variables, applying per-variable overrides
  if (col.isExtension && baseVariables) {
    const overrides = col.variableOverrides || {};

    for (const [varId, base] of Object.entries(baseVariables)) {
      const v = {};
      for (const modeName of modes) {
        const extMode = col.modes.find(m => m.name === modeName);
        const overrideForVar = overrides[varId];
        if (overrideForVar && extMode && overrideForVar[extMode.modeId] !== undefined) {
          v[modeName] = convertValue(overrideForVar[extMode.modeId], varIdMap);
        } else {
          v[modeName] = base.values[modeName];
        }
      }
      varList.push({ n: base.name, t: base.type, v });
      processedNames.add(base.name);
    }
  }

  // Add variables that belong directly to this collection (not already inherited)
  for (const [, v] of Object.entries(variables)) {
    if (v.variableCollectionId !== collectionId) continue;
    if (processedNames.has(v.name)) continue;

    const vals = {};
    for (const m of col.modes) {
      vals[modeIdToName[m.modeId]] = convertValue(v.valuesByMode?.[m.modeId], varIdMap);
    }
    varList.push({ n: v.name, t: v.resolvedType, v: vals });
  }

  return { modes, vars: varList };
}

// ─── Non-Theme Collection Extraction ────────────────────────────────

/**
 * Extract non-theme collections (Primitives, Alias, Status, Density, etc.)
 * into the same JSON format. Uses the Figma collection display name as key.
 */
function extractNonThemeCollections(collections, variables, varIdMap, themeCollectionIds) {
  const result = {};
  for (const [colId, col] of Object.entries(collections)) {
    if (themeCollectionIds.has(colId)) continue;
    const data = extractCollection(colId, collections, variables, varIdMap);
    if (data && data.vars.length > 0) {
      result[col.name] = data;
    }
  }
  return result;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`\nExtracting Figma variables from file: ${FILE_KEY}\n`);

  const response = await figmaGet(`/v1/files/${FILE_KEY}/variables/local`);
  const { variables, variableCollections: collections } = response.meta;

  const varCount = Object.keys(variables).length;
  const colCount = Object.keys(collections).length;
  console.log(`\n  Found ${varCount} variables in ${colCount} collections\n`);

  const varIdMap = buildVarIdMap(variables, collections);
  const themes = config.themes;
  resolveAndHealCollectionIds(themes, collections, CONFIG_FILE);
  const themeCollectionIds = identifyThemeCollections(collections, themes);

  // ── Build output ──

  const output = {};

  // 1. Meta
  output.meta = {
    file: FILE_KEY,
    name: config.file.name,
    date: new Date().toISOString(),
  };

  // 2. Themes metadata — refresh mode IDs from API while preserving hand-authored slugs/folders
  const baseCol = collections[themes.base.collectionId];
  if (baseCol) {
    const baseModes = {};
    for (const m of baseCol.modes) baseModes[m.name] = m.modeId;

    output.themes = {
      base: {
        name:          themes.base.name,
        slug:          themes.base.slug,
        folder:        themes.base.folder,
        collectionId:  themes.base.collectionId,
        defaultModeId: baseCol.defaultModeId,
        modes:         baseModes,
      },
      extended: themes.extended.map(ext => {
        const extCol = collections[ext.collectionId];
        if (!extCol) return ext; // Keep existing if not found in API

        const extModes = {};
        for (const m of extCol.modes) {
          extModes[m.name] = { modeId: m.modeId, parentModeId: m.parentModeId || null };
        }
        return {
          name:          ext.name,
          slug:          ext.slug,
          folder:        ext.folder,
          collectionId:  ext.collectionId,
          defaultModeId: extCol.defaultModeId,
          modes:         extModes,
        };
      }),
    };
  } else {
    output.themes = themes;
  }

  // 3. Non-theme collections (Primitives, Alias, Status, Density, etc.)
  const nonTheme = extractNonThemeCollections(collections, variables, varIdMap, themeCollectionIds);
  for (const [name, data] of Object.entries(nonTheme)) {
    output[name] = data;
  }

  // Alias completeness check — warn early if live Alias collection is shallow.
  // The aliasSnapshot in token-overrides.json fills the gap, but a warning here
  // prompts the operator to verify output rather than silently accepting bad data.
  const minVarCount = config.aliasValidation?.minVarCount ?? 150;
  const liveAliasVars = (nonTheme['Alias']?.vars || []).filter(v => !v.n.startsWith('properties/'));
  if (liveAliasVars.length < minVarCount) {
    console.warn(
      `\n  ⚠ ALIAS COLLECTION SHALLOW: live Alias has ${liveAliasVars.length} semantic vars ` +
      `(threshold: ${minVarCount}).\n` +
      `  The aliasSnapshot in figma-tokens/token-overrides.json will fill the gap — verify output.\n`
    );
  }

  // 4. Theme collections — each as a fully standalone entry
  const baseColName = baseCol?.name || themes.base.name;
  const baseData = extractCollection(themes.base.collectionId, collections, variables, varIdMap);
  if (baseData) output[baseColName] = baseData;

  for (const ext of themes.extended) {
    const extData = extractCollection(ext.collectionId, collections, variables, varIdMap);
    if (extData) {
      output[ext.name] = extData;
    } else {
      console.warn(`  ⚠ Theme "${ext.name}" (${ext.collectionId}) — collection not found in API response`);
    }
  }

  // ── Summary table ──

  const summaryRows = [
    { label: 'Base theme', name: baseColName, count: baseData?.vars.length ?? 0 },
    ...themes.extended.map(ext => ({
      label: 'Extended theme',
      name:  ext.name,
      count: output[ext.name]?.vars.length ?? 0,
    })),
    ...Object.entries(nonTheme).map(([name, d]) => ({
      label: 'Collection',
      name,
      count: d.vars.length,
    })),
  ];

  console.log('\n  Extraction summary:');
  console.log('  ─────────────────────────────────────────────────');
  for (const row of summaryRows) {
    const pad = ' '.repeat(Math.max(1, 36 - row.name.length));
    console.log(`  ${row.name}${pad}${row.count} vars`);
  }
  console.log('  ─────────────────────────────────────────────────\n');

  // ── Validate before writing ──
  // If any collection required by the generate script comes back too shallow,
  // abort NOW before overwriting figma-variables.json (and thus before the
  // generate step runs with corrupted data).
  //
  // Thresholds are sourced from figma-config.json so operators can tune them
  // without touching the script. The generate script also has per-file guards
  // but those only protect the CSS output — this guard protects the JSON source.

  const hardFailures = [];

  // Alias collection — the largest semantically important collection.
  const minAlias = config.aliasValidation?.minVarCount ?? 150;
  const liveAlias = (nonTheme['Alias']?.vars || []).filter(v => !v.n.startsWith('properties/'));
  if (liveAlias.length < minAlias) {
    hardFailures.push(
      `Alias collection has ${liveAlias.length} vars (minimum: ${minAlias}). ` +
      `The Figma API response is too shallow to generate valid CSS — aborting to protect existing files.`
    );
  }

  // Per-collection minimums from config (optional; only evaluated if present).
  const collectionMins = config.collectionValidation ?? {};
  for (const [colName, min] of Object.entries(collectionMins)) {
    const count = (nonTheme[colName]?.vars || []).length;
    if (count < min) {
      hardFailures.push(
        `Collection "${colName}" has ${count} vars (minimum: ${min}). ` +
        `Aborting to protect existing files.`
      );
    }
  }

  if (hardFailures.length > 0) {
    console.error('\n  ✖ EXTRACTION ABORTED — sparse data detected:\n');
    for (const msg of hardFailures) {
      console.error(`    • ${msg}`);
    }
    console.error('\n  Existing figma-variables.json has NOT been modified.');
    console.error('  Fix the Figma API response or lower the thresholds in figma-config.json.\n');
    process.exit(2);
  }

  // ── Write output ──

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');

  const size = fs.statSync(OUT_FILE).size;
  console.log(`✓ Wrote ${OUT_FILE} (${(size / 1024).toFixed(1)} KB)\n`);
}

main().catch(err => {
  console.error('\nExtraction failed:', err.message);
  process.exit(1);
});
