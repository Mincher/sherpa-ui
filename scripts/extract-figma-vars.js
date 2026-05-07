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
 *
 * Usage:
 *   FIGMA_ACCESS_TOKEN=xxx node scripts/extract-figma-vars.js
 *   # or export FIGMA_ACCESS_TOKEN first
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Config ─────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'figma-tokens', 'figma-variables.json');

const TOKEN = process.env.FIGMA_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('Error: FIGMA_ACCESS_TOKEN environment variable is required.');
  console.error('Usage: FIGMA_ACCESS_TOKEN=xxx node scripts/extract-figma-vars.js');
  process.exit(1);
}

// Read the existing JSON to get the file key
let existingData;
try {
  existingData = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
} catch {
  console.error(`Error: Cannot read ${OUT_FILE}. Ensure figma-variables.json exists with at least a "meta" section.`);
  process.exit(1);
}

const FILE_KEY = existingData.meta?.file;
if (!FILE_KEY) {
  console.error('Error: No meta.file key found in figma-variables.json');
  process.exit(1);
}

const API_BASE = 'https://api.figma.com';

// ─── API Helpers ────────────────────────────────────────────────────

async function figmaGet(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  console.log(`  GET ${url}`);
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': TOKEN }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Collection / Theme Identification ──────────────────────────────

/**
 * Identify which collections are "theme" collections.
 * The base collection and all its extensions are themes.
 * Everything else (Primitives, Alias, Status, Density, component collections)
 * is a non-theme collection.
 */
function identifyThemeCollections(collections) {
  const themes = existingData.themes;
  const baseId = themes.base.collectionId;

  // Base collection
  const themeIds = new Set([baseId]);

  // Extended collections — match by collectionId from metadata or by
  // parentVariableCollectionId / rootVariableCollectionId from the API
  for (const ext of themes.extended) {
    themeIds.add(ext.collectionId);
  }

  // Also add any API-reported extensions of the base
  for (const [id, col] of Object.entries(collections)) {
    if (col.isExtension && (col.rootVariableCollectionId === baseId || col.parentVariableCollectionId === baseId)) {
      themeIds.add(id);
    }
  }

  return themeIds;
}

// ─── Value Conversion ───────────────────────────────────────────────

/**
 * Build a lookup map from variable ID → { collectionName, variableName }
 * Used to resolve VariableAlias references into `@path/name` strings.
 */
function buildVarIdMap(variables, collections) {
  const map = new Map();
  for (const [varId, v] of Object.entries(variables)) {
    const col = collections[v.variableCollectionId];
    const collectionName = col?.name || '';
    map.set(varId, {
      name: v.name,
      collectionName,
      collectionId: v.variableCollectionId
    });
  }
  return map;
}

/**
 * Map a Figma collection name to the prefix used in our @-reference syntax.
 * e.g., "Primitives" vars are referenced as @color/basic/... or @scale/...
 *       "Alias" vars are referenced as @color/neutral/... or @border/rounding/...
 *       Theme vars referencing each other use the Figma variable name directly.
 *
 * The existing JSON uses a flat @name convention where the collection prefix
 * is omitted and variable names are unique across collections.
 */
function varIdToRef(varId, varIdMap) {
  const info = varIdMap.get(varId);
  if (!info) return null;
  // Use the Figma variable name as the reference path
  // Figma uses "/" separators already - matches our JSON format
  return `@${info.name}`;
}

/**
 * Convert a Figma API variable value to the JSON format used by our system.
 *
 * Figma value types:
 *   - Boolean / Number / String — pass through
 *   - Color object { r, g, b, a } — convert to rgba() string
 *   - VariableAlias { type: "VARIABLE_ALIAS", id: "VariableID:..." } — convert to @ref
 */
function convertValue(val, varIdMap) {
  if (val === null || val === undefined) return null;

  // VariableAlias
  if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    return varIdToRef(val.id, varIdMap);
  }

  // Color object { r, g, b, a }
  if (typeof val === 'object' && 'r' in val && 'g' in val && 'b' in val) {
    const r = Math.round(val.r * 255);
    const g = Math.round(val.g * 255);
    const b = Math.round(val.b * 255);
    const a = val.a !== undefined ? val.a : 1;
    if (a < 1) {
      return `rgba(${r},${g},${b},${parseFloat(a.toFixed(4))})`;
    }
    // Fully opaque — still use rgba for consistency
    return `rgba(${r},${g},${b},1)`;
  }

  // Boolean / Number / String — pass through
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
 * @returns {{ modes: string[], vars: object[] }}
 */
function extractCollection(collectionId, collections, variables, varIdMap) {
  const col = collections[collectionId];
  if (!col) return null;

  // Mode names and IDs
  const modes = col.modes.map(m => m.name);
  const modeIdToName = {};
  for (const m of col.modes) {
    modeIdToName[m.modeId] = m.name;
  }

  // For extended collections, build a mapping from extended modeId → parent modeId
  // and collect the base variable values
  let parentModeMap = null;   // extendedModeId → parentModeName
  let baseVariables = null;   // variableId → { values per mode name }

  if (col.isExtension) {
    parentModeMap = {};
    for (const m of col.modes) {
      if (m.parentModeId) {
        // Find the parent mode name
        const parentCol = collections[col.parentVariableCollectionId || col.rootVariableCollectionId];
        if (parentCol) {
          const parentMode = parentCol.modes.find(pm => pm.modeId === m.parentModeId);
          if (parentMode) {
            parentModeMap[m.modeId] = parentMode.name;
          }
        }
      }
    }

    // Collect base variable values
    const rootId = col.rootVariableCollectionId || col.parentVariableCollectionId;
    if (rootId) {
      baseVariables = {};
      for (const [varId, v] of Object.entries(variables)) {
        if (v.variableCollectionId === rootId) {
          const vals = {};
          const rootCol = collections[rootId];
          for (const m of rootCol.modes) {
            const modeName = m.name;
            const rawVal = v.valuesByMode?.[m.modeId];
            vals[modeName] = convertValue(rawVal, varIdMap);
          }
          baseVariables[varId] = {
            name: v.name,
            type: v.resolvedType,
            values: vals
          };
        }
      }
    }
  }

  // Collect this collection's own variables
  const varList = [];
  const processedNames = new Set();

  // For extended collections: start with inherited variables (from base)
  if (col.isExtension && baseVariables) {
    const overrides = col.variableOverrides || {};

    for (const [varId, base] of Object.entries(baseVariables)) {
      const v = {};
      for (const modeName of modes) {
        // Find the modeId for this mode in the extended collection
        const extMode = col.modes.find(m => m.name === modeName);
        const overrideForVar = overrides[varId];

        if (overrideForVar && extMode && overrideForVar[extMode.modeId] !== undefined) {
          // This variable has an override in this mode
          v[modeName] = convertValue(overrideForVar[extMode.modeId], varIdMap);
        } else {
          // Inherit from base
          v[modeName] = base.values[modeName];
        }
      }

      varList.push({
        n: base.name,
        t: base.type,
        v
      });
      processedNames.add(base.name);
    }
  }

  // Add variables that belong directly to this collection
  for (const [varId, v] of Object.entries(variables)) {
    if (v.variableCollectionId !== collectionId) continue;
    if (processedNames.has(v.name)) continue; // Already processed as inherited

    const vals = {};
    for (const m of col.modes) {
      const modeName = modeIdToName[m.modeId];
      const rawVal = v.valuesByMode?.[m.modeId];
      vals[modeName] = convertValue(rawVal, varIdMap);
    }

    varList.push({
      n: v.name,
      t: v.resolvedType,
      v: vals
    });
  }

  return { modes, vars: varList };
}

// ─── Non-Theme Collection Extraction ────────────────────────────────

/**
 * Extract non-theme collections (Primitives, Alias, Status, Density,
 * component collections) into the same JSON format.
 */
function extractNonThemeCollections(collections, variables, varIdMap, themeCollectionIds) {
  const result = {};

  for (const [colId, col] of Object.entries(collections)) {
    if (themeCollectionIds.has(colId)) continue; // Skip theme collections

    const data = extractCollection(colId, collections, variables, varIdMap);
    if (data && data.vars.length > 0) {
      // Use collection name as the key
      result[col.name] = data;
    }
  }

  return result;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`\nExtracting Figma variables from file: ${FILE_KEY}\n`);

  // Fetch all local variables
  const response = await figmaGet(`/v1/files/${FILE_KEY}/variables/local`);
  const { variables, variableCollections: collections } = response.meta;

  const varCount = Object.keys(variables).length;
  const colCount = Object.keys(collections).length;
  console.log(`\n  Found ${varCount} variables in ${colCount} collections\n`);

  // Build lookup map
  const varIdMap = buildVarIdMap(variables, collections);

  // Identify theme collections
  const themeCollectionIds = identifyThemeCollections(collections);

  // ── Build output ──

  const themes = existingData.themes;
  const output = {};

  // 1. Meta
  output.meta = {
    file: FILE_KEY,
    name: existingData.meta.name,
    date: new Date().toISOString()
  };

  // 2. Themes metadata — update with fresh mode IDs from API
  const baseCol = collections[themes.base.collectionId];
  if (baseCol) {
    const baseModes = {};
    for (const m of baseCol.modes) {
      baseModes[m.name] = m.modeId;
    }
    output.themes = {
      _doc: themes._doc,
      base: {
        name: themes.base.name,
        // Preserve hand-authored slug + folder (required by the generator;
        // the Figma REST API does not expose them).
        slug: themes.base.slug,
        folder: themes.base.folder,
        collectionId: themes.base.collectionId,
        defaultModeId: baseCol.defaultModeId,
        modes: baseModes
      },
      extended: themes.extended.map(ext => {
        const extCol = collections[ext.collectionId];
        if (!extCol) return ext; // Keep existing if not found in API

        const extModes = {};
        for (const m of extCol.modes) {
          extModes[m.name] = {
            modeId: m.modeId,
            parentModeId: m.parentModeId || null
          };
        }
        return {
          name: ext.name,
          slug: ext.slug,
          // Preserve hand-authored folder.
          folder: ext.folder,
          collectionId: ext.collectionId,
          defaultModeId: extCol.defaultModeId,
          modes: extModes
        };
      })
    };
  } else {
    output.themes = themes;
  }

  // 3. Non-theme collections (Primitives, Alias, Status, Density, components)
  const nonTheme = extractNonThemeCollections(collections, variables, varIdMap, themeCollectionIds);
  for (const [name, data] of Object.entries(nonTheme)) {
    output[name] = data;
  }

  // 4. Theme collections — each as a fully standalone entry
  //    Base theme — use the Figma collection name (e.g. "Apex 2.0") as the JSON key.
  //    The generator tries data[themes.base.name] then data["Apex 2.0"] as fallback.
  const baseColName = baseCol?.name || themes.base.name;
  const baseData = extractCollection(themes.base.collectionId, collections, variables, varIdMap);
  if (baseData) {
    output[baseColName] = baseData;
    console.log(`  Theme "${baseColName}": ${baseData.vars.length} variables (${baseData.modes.join(', ')})`);
  }

  //    Extended themes
  for (const ext of themes.extended) {
    const extData = extractCollection(ext.collectionId, collections, variables, varIdMap);
    if (extData) {
      output[ext.name] = extData;
      console.log(`  Theme "${ext.name}": ${extData.vars.length} variables (${extData.modes.join(', ')})`);
    } else {
      console.warn(`  ⚠ Theme "${ext.name}" (${ext.collectionId}) — collection not found in API response`);
    }
  }

  // ── Write output ──

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');

  const size = fs.statSync(OUT_FILE).size;
  console.log(`\n✓ Wrote ${OUT_FILE} (${(size / 1024).toFixed(1)} KB)\n`);
}

main().catch(err => {
  console.error('\nExtraction failed:', err.message);
  process.exit(1);
});
