#!/usr/bin/env node

/**
 * extract-component-schemas.js
 *
 * Parses canonical JSDoc headers from every sherpa-* component JS file
 * and generates machine-readable JSON files per schemas/component-schema.json.
 *
 * Output: schemas/components/<tag-name>.json  (one per component)
 *         schemas/components/index.json       (array of all tag-names)
 *
 * Usage:  node scripts/extract-component-schemas.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(ROOT, "components");
const OUT_DIR = path.join(ROOT, "schemas", "components");

/* ── Category map ──────────────────────────────────────────────── */

const CATEGORY_MAP = {
  "sherpa-button":              "core",
  "sherpa-tag":                 "core",
  "sherpa-switch":              "core",
  "sherpa-loader":              "core",
  "sherpa-tooltip":             "core",
  "sherpa-popover":             "core",
  "sherpa-card":                "layout",
  "sherpa-panel":               "layout",
  "sherpa-accordion":           "layout",
  "sherpa-tabs":                "layout",
  "sherpa-dialog":              "layout",
  "sherpa-nav":                 "navigation",
  "sherpa-nav-item":            "navigation",
  "sherpa-nav-promo":           "navigation",
  "sherpa-breadcrumbs":         "navigation",
  "sherpa-menu":                "navigation",
  "sherpa-menu-item":           "navigation",
  "sherpa-product-bar":         "navigation",
  "sherpa-input-text":          "form",
  "sherpa-input-number":        "form",
  "sherpa-input-password":      "form",
  "sherpa-input-search":        "form",
  "sherpa-input-select":        "form",
  "sherpa-input-date":          "form",
  "sherpa-input-date-range":    "form",
  "sherpa-input-time":          "form",
  "sherpa-file-upload":         "form",
  "sherpa-slider":              "form",
  "sherpa-stepper":             "form",
  "sherpa-data-grid":           "data-display",
  "sherpa-list-item":           "data-display",
  "sherpa-key-value-list":      "data-display",
  "sherpa-pagination":          "data-display",
  "sherpa-metric":              "data-display",
  "sherpa-empty-state":         "data-display",
  "sherpa-barchart":            "data-viz",
  "sherpa-donut-chart":         "data-viz",
  "sherpa-line-chart":          "data-viz",
  "sherpa-sparkline":           "data-viz",
  "sherpa-gauge-chart":         "data-viz",
  "sherpa-chart-legend":        "data-viz",
  "sherpa-data-viz-container":  "data-viz",
  "sherpa-message":             "feedback",
  "sherpa-callout":             "feedback",
  "sherpa-toast":               "feedback",
  "sherpa-progress-bar":        "feedback",
  "sherpa-progress-tracker":    "feedback",
  "sherpa-view-header":         "page-level",
  "sherpa-section-header":      "page-level",
  "sherpa-toolbar":             "page-level",
  "sherpa-footer":              "page-level",
  "sherpa-filter-bar":          "page-level",
  "sherpa-container-pdf":       "page-level",
};

/* ── Helpers ───────────────────────────────────────────────────── */

/** Extract the first JSDoc block (/** ... *​/) from source */
function extractJSDoc(source) {
  const match = source.match(/\/\*\*[\s\S]*?\*\//);
  return match ? match[0] : null;
}

/** Split a JSDoc block into an array of cleaned lines */
function jsdocLines(block) {
  return block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, ""))
    .filter((l) => l !== undefined);
}

/**
 * Parse a JSDoc block into structured component API data.
 *
 * Supported tags:
 *   @element, @extends, @description,
 *   @attr, @slot, @fires, @method, @prop, @csspart, @cssprop
 */
function parseJSDoc(lines) {
  const result = {
    tagName: null,
    description: "",
    extendedDescription: "",
    baseClass: "SherpaElement",
    attributes: [],
    slots: [],
    events: [],
    methods: [],
    properties: [],
    cssParts: [],
    cssProperties: [],
  };

  let i = 0;
  const descLines = [];

  // Collect free-text lines before @element or any tag, cleaning file headers
  while (i < lines.length && !lines[i].startsWith("@")) {
    let trimmed = lines[i].trim();
    // Skip bare "filename.js" lines
    if (trimmed.match(/^sherpa-[\w-]+\.js$/)) { i++; continue; }
    // Strip "ClassName — " prefix, keep the description after the dash
    const classPrefix = trimmed.match(/^Sherpa\w+\s*[—–-]\s*(.+)$/);
    if (classPrefix) trimmed = classPrefix[1];
    if (trimmed) descLines.push(trimmed);
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith("@element ")) {
      result.tagName = line.replace("@element ", "").trim();
    } else if (line.startsWith("@extends ")) {
      result.baseClass = line.replace("@extends ", "").trim();
    } else if (line.startsWith("@description ")) {
      // Collect multi-line description
      let desc = line.replace("@description ", "").trim();
      while (i + 1 < lines.length && !lines[i + 1].trim().startsWith("@")) {
        i++;
        const next = lines[i].trim();
        if (next) desc += " " + next;
        else break;
      }
      result.description = desc;
    } else if (line.startsWith("@attr ")) {
      result.attributes.push(parseAttr(line));
    } else if (line.startsWith("@slot ")) {
      result.slots.push(parseSlot(line));
    } else if (line === "@slot" || line.startsWith("@slot —") || line.startsWith("@slot —")) {
      // Default slot: "@slot — Description"
      result.slots.push(parseSlot(line));
    } else if (line.startsWith("@fires ")) {
      const event = parseEvent(line, lines, i);
      result.events.push(event.data);
      i = event.nextIndex;
    } else if (line.startsWith("@method ")) {
      result.methods.push(parseMethod(line));
    } else if (line.startsWith("@prop ")) {
      result.properties.push(parseProp(line));
    } else if (line.startsWith("@csspart ")) {
      result.cssParts.push(parseCssPart(line));
    } else if (line.startsWith("@cssprop ")) {
      result.cssProperties.push(parseCssProp(line));
    }
    // Skip @param / @returns (consumed by @method) and unknown lines

    i++;
  }

  // Use pre-tag text as extended description if @description handled separately
  if (descLines.length && !result.description) {
    result.description = descLines.join(" ");
  } else if (descLines.length) {
    result.extendedDescription = descLines.join(" ");
  }

  return result;
}

/* ── Tag parsers ───────────────────────────────────────────────── */

/**
 * @attr {type} [name=default] — Description
 * @attr {type} name           — Description
 */
function parseAttr(line) {
  //          {type}    [name=default]  or name   — desc
  const m = line.match(
    /^@attr\s+\{(\w+)\}\s+\[?([^\]=\s]+)(?:=([^\]]*))?\]?\s*(?:[—–-]\s*(.*))?$/
  );
  if (!m) return { name: line.replace("@attr ", ""), type: "string", description: "" };

  const attr = {
    name: m[2].trim(),
    type: m[1].trim(),
    description: (m[4] || "").trim(),
  };

  if (m[3] !== undefined) attr.default = parseDefault(m[3].trim(), attr.type);

  // Parse enum values from description "primary | secondary | tertiary"
  if (attr.type === "enum" && attr.description) {
    const enumMatch = attr.description.match(/^([\w-]+(?:\s*\|\s*[\w-]+)+)(?:\s*[—–-]\s*(.*))?$/);
    if (enumMatch) {
      // The entire description is enum values (possibly followed by dash + explanation)
      // But more often enum values are inline: "primary | secondary | tertiary"
    }
    // Extract pipe-separated values anywhere in description
    const pipeValues = attr.description.match(/([\w-]+(?:\s*\|\s*[\w-]+)+)/);
    if (pipeValues) {
      attr.enumValues = pipeValues[1].split(/\s*\|\s*/);
    }
  }

  return attr;
}

/**
 * @slot name — Description
 * @slot — Default slot description
 * @slot (default) — Description
 */
function parseSlot(line) {
  const stripped = line.replace(/^@slot\s*/, "");

  // Default slot variants
  if (!stripped || stripped.startsWith("—") || stripped.startsWith("–") || stripped.startsWith("-")) {
    return {
      name: "",
      description: stripped.replace(/^[—–-]\s*/, "").trim(),
    };
  }

  if (stripped.startsWith("(default)")) {
    return {
      name: "",
      description: stripped.replace(/^\(default\)\s*[—–-]?\s*/, "").trim(),
    };
  }

  const m = stripped.match(/^(\S+)\s*(?:[—–-]\s*(.*))?$/);
  return {
    name: m ? m[1].trim() : stripped.trim(),
    description: m && m[2] ? m[2].trim() : "",
  };
}

/**
 * @fires event-name — Description
 *   bubbles: true, composed: true
 *   detail: { key: type, key: type }
 *   detail: none
 */
function parseEvent(line, lines, currentIndex) {
  const m = line.match(/^@fires\s+(\S+)\s*(?:[—–-]\s*(.*))?$/);
  const event = {
    name: m ? m[1] : line.replace("@fires ", "").trim(),
    description: m && m[2] ? m[2].trim() : "",
    bubbles: true,
    composed: false,
    detail: null,
  };

  let nextIndex = currentIndex;

  // Peek at subsequent indented lines for bubbles/composed/detail
  while (nextIndex + 1 < lines.length) {
    const next = lines[nextIndex + 1];
    const trimmed = next.trim();

    // Stop at next tag or non-indented content
    if (trimmed.startsWith("@") || (!next.startsWith("  ") && trimmed !== "")) break;
    if (!trimmed) { nextIndex++; continue; }

    if (trimmed.startsWith("bubbles:")) {
      const parts = trimmed.split(",").map((s) => s.trim());
      for (const part of parts) {
        if (part.startsWith("bubbles:")) event.bubbles = part.includes("true");
        if (part.startsWith("composed:")) event.composed = part.includes("true");
      }
    } else if (trimmed.startsWith("detail:")) {
      const detailStr = trimmed.replace("detail:", "").trim();
      if (detailStr === "none" || detailStr === "{}") {
        event.detail = null;
      } else {
        event.detail = parseDetailObject(detailStr);
      }
    }

    nextIndex++;
  }

  return { data: event, nextIndex };
}

/** Parse a { key: type, key: type } string into an object */
function parseDetailObject(str) {
  const inner = str.replace(/^\{/, "").replace(/\}$/, "").trim();
  if (!inner) return null;

  const detail = {};
  // Split on commas, handling nested types like Array<string>
  const parts = inner.split(/,\s*/);
  for (const part of parts) {
    const kv = part.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) detail[kv[1].trim()] = kv[2].trim();
  }
  return Object.keys(detail).length ? detail : null;
}

/**
 * @method name(params) — Description
 * @method ClassName.name(params) — (static) Description
 */
function parseMethod(line) {
  const m = line.match(/^@method\s+(\S+(?:\([^)]*\))?)\s*(?:[—–-]\s*(.*))?$/);
  if (!m) return { name: line.replace("@method ", "").trim(), description: "" };

  let name = m[1].trim();
  let description = (m[2] || "").trim();
  let isStatic = false;

  // Detect static: "ClassName.method()" or description contains "(static)"
  if (name.includes(".")) {
    isStatic = true;
    name = name.substring(name.indexOf(".") + 1);
  }
  if (description.startsWith("(static)")) {
    isStatic = true;
    description = description.replace("(static)", "").trim();
  }

  const method = { name, description };
  if (isStatic) method.static = true;

  // Extract params from name
  const paramMatch = name.match(/\(([^)]*)\)/);
  if (paramMatch && paramMatch[1].trim()) {
    method.params = paramMatch[1].split(",").map((p) => {
      const trimmed = p.trim();
      // Handle [optional] params
      const isOptional = trimmed.startsWith("[");
      const clean = trimmed.replace(/[[\]]/g, "");
      return { name: clean, type: "any", ...(isOptional ? { optional: true } : {}) };
    });
  }

  return method;
}

/**
 * @prop {type} name — Description
 */
function parseProp(line) {
  const m = line.match(/^@prop\s+\{([^}]+)\}\s+(\S+)\s*(?:[—–-]\s*(.*))?$/);
  if (!m) return { name: line.replace("@prop ", "").trim(), type: "any", description: "" };

  const prop = {
    name: m[2].trim(),
    type: m[1].trim(),
    description: (m[3] || "").trim(),
  };

  if (prop.description.toLowerCase().includes("read-only") ||
      prop.description.toLowerCase().includes("readonly")) {
    prop.readonly = true;
  }

  return prop;
}

/**
 * @csspart name — Description
 */
function parseCssPart(line) {
  const m = line.match(/^@csspart\s+(\S+)\s*(?:[—–-]\s*(.*))?$/);
  return {
    name: m ? m[1].trim() : line.replace("@csspart ", "").trim(),
    description: m && m[2] ? m[2].trim() : "",
  };
}

/**
 * @cssprop --name — Description
 */
function parseCssProp(line) {
  const m = line.match(/^@cssprop\s+(\S+)\s*(?:[—–-]\s*(.*))?$/);
  return {
    name: m ? m[1].trim() : line.replace("@cssprop ", "").trim(),
    description: m && m[2] ? m[2].trim() : "",
  };
}

/** Convert default value string to appropriate type */
function parseDefault(val, type) {
  if (type === "boolean") return val === "true";
  if (type === "number") return Number(val);
  return val;
}

/* ── Discovery ─────────────────────────────────────────────────── */

/** Find all sherpa-* component directories under components/ */
function discoverComponents() {
  const dirs = fs.readdirSync(COMPONENTS_DIR, { withFileTypes: true });
  const components = [];

  for (const entry of dirs) {
    if (!entry.isDirectory() || !entry.name.startsWith("sherpa-")) continue;
    const jsFile = path.join(COMPONENTS_DIR, entry.name, `${entry.name}.js`);
    if (fs.existsSync(jsFile)) {
      components.push({ name: entry.name, jsPath: jsFile });
    }
  }

  return components.sort((a, b) => a.name.localeCompare(b.name));
}

/* ── Main ──────────────────────────────────────────────────────── */

function main() {
  const components = discoverComponents();
  console.log(`Found ${components.length} components\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const index = [];
  let errorCount = 0;

  for (const comp of components) {
    const source = fs.readFileSync(comp.jsPath, "utf8");
    const jsdoc = extractJSDoc(source);

    if (!jsdoc) {
      console.warn(`  ⚠ ${comp.name}: No JSDoc block found, skipping`);
      errorCount++;
      continue;
    }

    const lines = jsdocLines(jsdoc);
    const api = parseJSDoc(lines);

    if (!api.tagName) {
      console.warn(`  ⚠ ${comp.name}: No @element tag found, skipping`);
      errorCount++;
      continue;
    }

    // Add category
    api.category = CATEGORY_MAP[api.tagName] || "core";

    // Clean up empty arrays / strings
    const output = {
      tagName: api.tagName,
      description: api.description,
    };

    if (api.extendedDescription) output.extendedDescription = api.extendedDescription;
    output.category = api.category;
    output.baseClass = api.baseClass;
    output.attributes = api.attributes;
    output.slots = api.slots;
    output.events = api.events;
    if (api.methods.length) output.methods = api.methods;
    if (api.properties.length) output.properties = api.properties;
    if (api.cssParts.length) output.cssParts = api.cssParts;
    if (api.cssProperties.length) output.cssProperties = api.cssProperties;

    const outPath = path.join(OUT_DIR, `${api.tagName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
    index.push(api.tagName);

    const counts = [
      `${api.attributes.length}a`,
      `${api.slots.length}s`,
      `${api.events.length}e`,
      `${api.methods.length}m`,
      `${api.properties.length}p`,
    ].join(" ");
    console.log(`  ✓ ${api.tagName} (${counts})`);
  }

  // Write index
  fs.writeFileSync(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify(index, null, 2) + "\n"
  );

  console.log(`\nDone: ${index.length} schemas written to schemas/components/`);
  if (errorCount) console.log(`  ${errorCount} components skipped due to errors`);
}

main();
