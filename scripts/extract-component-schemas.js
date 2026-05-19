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

/* ── Category map (legacy `group` — layout-oriented sidebar grouping) ─ */

const GROUP_MAP = {
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

/* ── Role taxonomy (new `category` — see docs/COMPONENT-CATEGORIES.md) ── */

const VALID_CATEGORIES = new Set([
  "shell",
  "control",
  "input",
  "display",
  "feedback",
  "container",
  "content",
  "nav",
  "overlay",
  "media",
  "data",
  "ai",
  "utility",
]);

/* ── Composition tiers (see docs/COMPONENT-CATEGORIES.md §4) ──
 * A slot may host children whose tier number is >= the host's tier
 * (i.e. equal-or-deeper in the application structure).
 *
 * Tier 5 (`utility`) is reserved for docs-site / developer tooling
 * components that are not part of the public application UI taxonomy. */
const ROLE_TIERS = Object.freeze({
  shell:     1,
  nav:       1,
  container: 2,
  overlay:   2,
  content:   3,
  ai:        3,
  control:   4,
  input:     4,
  display:   4,
  feedback:  4,
  media:     4,
  data:      4,
  utility:   5,
});

/* ── Role display metadata (docs sidebar + home grid) ──
 * Listed in tier order (1 → 4). Edit alongside ROLE_TIERS when adding
 * a new role per docs/COMPONENT-CATEGORIES.md §6. */
const ROLE_META = [
  { id: "shell",     label: "Shell",      icon: "fa-solid fa-window-maximize" },
  { id: "nav",       label: "Navigation", icon: "fa-solid fa-bars" },
  { id: "container", label: "Containers", icon: "fa-solid fa-table-columns" },
  { id: "overlay",   label: "Overlays",   icon: "fa-solid fa-clone" },
  { id: "content",   label: "Content",    icon: "fa-solid fa-layer-group" },
  { id: "control",   label: "Controls",   icon: "fa-solid fa-hand-pointer" },
  { id: "input",     label: "Inputs",     icon: "fa-solid fa-keyboard" },
  { id: "display",   label: "Displays",   icon: "fa-solid fa-eye" },
  { id: "feedback",  label: "Feedback",   icon: "fa-solid fa-bell" },
  { id: "media",     label: "Media",      icon: "fa-solid fa-chart-bar" },
  { id: "data",      label: "Data",       icon: "fa-solid fa-table" },
  { id: "ai",        label: "AI",         icon: "fa-solid fa-wand-magic-sparkles" },
  { id: "utility",   label: "Utilities",  icon: "fa-solid fa-screwdriver-wrench" },
];

function tierOf(role) {
  return ROLE_TIERS[role] ?? null;
}

function prettyLabel(tag) {
  return tag
    .replace(/^sherpa-/, "")
    .split("-")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

/* ── Helpers ───────────────────────────────────────────────────── */

/**
 * Scan template HTML for `<slot ... data-accepts="...">` declarations.
 * Returns Map<slotName, string[]> where slotName is "" for the default slot.
 */
function parseSlotAccepts(html) {
  const map = new Map();
  // Strip HTML comments first so commented-out templates are ignored.
  const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
  // Match every <slot ...> tag; capture the attribute span
  const slotRe = /<slot\b([^>]*)>/g;
  let m;
  while ((m = slotRe.exec(stripped)) !== null) {
    const attrs = m[1];
    const acceptsMatch = attrs.match(/data-accepts\s*=\s*["']([^"']+)["']/);
    if (!acceptsMatch) continue;
    const nameMatch = attrs.match(/\bname\s*=\s*["']([^"']+)["']/);
    const name = nameMatch ? nameMatch[1] : "";
    const accepts = acceptsMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    map.set(name, accepts);
  }
  return map;
}

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
    category: null,
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
    } else if (line.startsWith("@category ")) {
      result.category = line.replace("@category ", "").trim();
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
  // Name accepts only [\w-]+ so a hyphen inside a name (e.g. `data-empty`)
  // can't be confused with the optional em/en-dash separator. Description
  // greedily captures the rest, with or without an em-dash separator, so
  // both canonical (`name — desc`) and lazy (`name desc`) forms work.
  //          {type}    [name=default]   [— ]?desc
  const m = line.match(
    /^@attr\s+\{(\w+)\}\s+\[?([\w-]+)(?:=([^\]]*))?\]?\s*(?:[—–]\s+)?(.*)$/
  );
  if (!m) return { name: line.replace("@attr ", ""), type: "string", description: "" };

  // Normalise legacy {flag} → {boolean} (the standard recognises only string,
  // boolean, enum, number, json).
  let type = m[1].trim();
  if (type === "flag") type = "boolean";

  const attr = {
    name: m[2].trim(),
    type,
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

  const m = stripped.match(/^(\S+)\s*(?:[—–]\s*(.*))?$/);
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
  const m = line.match(/^@fires\s+(\S+)\s*(?:[—–]\s*(.*))?$/);
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
  const m = line.match(/^@method\s+(\S+(?:\([^)]*\))?)\s*(?:[—–]\s*(.*))?$/);
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
  const m = line.match(/^@prop\s+\{([^}]+)\}\s+(\S+)\s*(?:[—–]\s*(.*))?$/);
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
  const m = line.match(/^@csspart\s+(\S+)\s*(?:[—–]\s*(.*))?$/);
  return {
    name: m ? m[1].trim() : line.replace("@csspart ", "").trim(),
    description: m && m[2] ? m[2].trim() : "",
  };
}

/**
 * @cssprop --name — Description
 */
function parseCssProp(line) {
  const m = line.match(/^@cssprop\s+(\S+)\s*(?:[—–]\s*(.*))?$/);
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

/* ── Base-class / mixin attribute resolution ───────────────────── */

/**
 * Resolve every attribute (and slot/event) contributed by base classes and
 * mixins in a component's `extends` chain.
 *
 * We walk the JS source's `class Foo extends Expr { ... }` clause, pull every
 * capitalised identifier from `Expr` (covers `Base`, `Mixin(Base)`,
 * `M1(M2(Base))`, etc.), resolve each identifier via its matching `import`
 * statement, then recursively extract:
 *   • JSDoc `@attr` tags
 *   • `observedAttributes` quoted strings
 *
 * Returns a Map<attrName, { name, type, description, inherited }> so callers
 * can merge inherited attrs without overwriting the component's own entries.
 */
function extractInheritedAttrs(jsPath, visited = new Set()) {
  const inherited = new Map();
  if (!fs.existsSync(jsPath) || visited.has(jsPath)) return inherited;
  visited.add(jsPath);

  const src = fs.readFileSync(jsPath, "utf8");

  // 1) Find the class declaration and its extends expression
  const ext = src.match(/class\s+\w+\s+extends\s+([\w()\s,]+?)\s*\{/);
  if (!ext) return inherited;

  // 2) Pull every capitalised identifier from the expression
  const idents = [...new Set(ext[1].match(/\b[A-Z]\w*/g) || [])];

  for (const ident of idents) {
    // 3) Resolve the identifier to a source file via its import
    const impRe = new RegExp(
      `import\\s*\\{[^}]*\\b${ident}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`
    );
    const imp = src.match(impRe);
    if (!imp) continue;

    let basePath;
    try {
      basePath = new URL(imp[1], "file://" + jsPath).pathname;
    } catch {
      continue;
    }
    if (!fs.existsSync(basePath)) continue;

    const baseSrc = fs.readFileSync(basePath, "utf8");

    // 3a) @attr JSDoc tags in the base file
    const baseJsdoc = extractJSDoc(baseSrc);
    if (baseJsdoc) {
      const baseLines = jsdocLines(baseJsdoc);
      for (const raw of baseLines) {
        const line = raw.trim();
        if (line.startsWith("@attr ")) {
          const attr = parseAttr(line);
          if (attr?.name && !inherited.has(attr.name)) {
            inherited.set(attr.name, { ...attr, inherited: ident });
          }
        }
      }
    }

    // 3b) Bare observedAttributes strings (fallback when @attr not present)
    const obsBlocks = baseSrc.matchAll(
      /observedAttributes\s*\(\s*\)\s*\{[\s\S]*?return\s*\[([\s\S]*?)\]/g
    );
    for (const ob of obsBlocks) {
      for (const m of ob[1].matchAll(/['"]([a-z][\w-]*)['"]/g)) {
        const name = m[1];
        if (!inherited.has(name)) {
          inherited.set(name, {
            name,
            type: name.startsWith("data-") ? "string" : "string",
            description: "",
            inherited: ident,
          });
        }
      }
    }

    // 4) Recurse — the base class may itself extend / wrap something
    for (const [k, v] of extractInheritedAttrs(basePath, visited)) {
      if (!inherited.has(k)) inherited.set(k, v);
    }
  }

  return inherited;
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
  const categoryMap = {};
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

    // Merge attributes inherited from base classes + mixins so the
    // emitted schema reflects the FULL public attribute surface, not
    // just the attrs the subclass declares directly. Crucial for the
    // MCP server + docs / validators that read these schemas.
    const inherited = extractInheritedAttrs(comp.jsPath);
    const ownNames = new Set(api.attributes.map((a) => a.name));
    for (const [name, attr] of inherited) {
      if (!ownNames.has(name)) {
        api.attributes.push(attr);
      }
    }

    // Drift check: every attribute in observedAttributes should also have an
    // @attr entry in the JSDoc header. Catches authors who add an observed
    // attribute but forget to document it.
    const observedMatch = source.match(/observedAttributes[\s\S]*?return\s*\[([\s\S]*?)\]/);
    if (observedMatch) {
      const observed = [...observedMatch[1].matchAll(/['"]([\w-]+)['"]/g)]
        .map((m) => m[1]);
      const documented = new Set(api.attributes.map((a) => a.name));
      const undocumented = observed.filter((n) => !documented.has(n));
      if (undocumented.length) {
        console.warn(
          `  ⚠ ${api.tagName}: observedAttributes not documented in JSDoc → ${undocumented.join(", ")}`
        );
      }
    }

    // Add legacy layout group
    api.group = GROUP_MAP[api.tagName] || "core";

    // Validate / default the role category
    if (api.category && !VALID_CATEGORIES.has(api.category)) {
      console.warn(
        `  ⚠ ${api.tagName}: unknown @category "${api.category}" (valid: ${[...VALID_CATEGORIES].join(", ")})`
      );
    }
    if (!api.category) {
      console.warn(`  ⚠ ${api.tagName}: missing @category JSDoc tag`);
    }

    // Stamp tier on the schema for downstream consumers.
    const hostTier = tierOf(api.category);
    if (hostTier) api.tier = hostTier;

    // Merge data-accepts from the HTML template into slots[].accepts,
    // and validate every entry against the tier rule.
    const htmlPath = path.join(
      COMPONENTS_DIR,
      comp.name,
      `${comp.name}.html`
    );
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, "utf8");
      const slotAccepts = parseSlotAccepts(html);
      for (const slot of api.slots) {
        const key = slot.name || "";
        if (slotAccepts.has(key)) {
          slot.accepts = slotAccepts.get(key);
          if (hostTier) {
            for (const role of slot.accepts) {
              if (role === "html") continue;
              const childTier = tierOf(role);
              if (childTier == null) {
                console.warn(
                  `  ⚠ ${api.tagName} slot="${key || "(default)"}": unknown role "${role}" in data-accepts`
                );
              } else if (childTier < hostTier) {
                console.warn(
                  `  ⚠ ${api.tagName} (tier ${hostTier}) slot="${key || "(default)"}": ` +
                  `role "${role}" is tier ${childTier} — violates same-tier-or-below rule`
                );
              }
            }
          }
        }
      }
    }

    // Clean up empty arrays / strings
    const output = {
      tagName: api.tagName,
      description: api.description,
    };

    if (api.extendedDescription) output.extendedDescription = api.extendedDescription;
    if (api.category) output.category = api.category;
    if (api.tier) output.tier = api.tier;
    output.group = api.group;
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
    if (api.category) categoryMap[api.tagName] = api.category;

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

  // Write generated tag → category map for runtime slot validation.
  // Consumed by SherpaElement (components/utilities/sherpa-element/sherpa-element.js).
  const categoriesModulePath = path.join(
    ROOT,
    "components",
    "utilities",
    "component-categories.js"
  );
  // Build tag→tier map by composing categoryMap with ROLE_TIERS.
  const tierMap = {};
  for (const [tag, role] of Object.entries(categoryMap)) {
    const t = tierOf(role);
    if (t) tierMap[tag] = t;
  }
  const categoriesModule =
    "/**\n" +
    " * component-categories.js\n" +
    " * GENERATED by scripts/extract-component-schemas.js — do not edit by hand.\n" +
    " *\n" +
    " * Maps every sherpa-* custom element tag name to its role category and\n" +
    " * composition tier. Roles + tiers are defined in docs/COMPONENT-CATEGORIES.md.\n" +
    " */\n\n" +
    "export const COMPONENT_CATEGORIES = Object.freeze(" +
    JSON.stringify(categoryMap, null, 2) +
    ");\n\n" +
    "export const ROLE_TIERS = Object.freeze(" +
    JSON.stringify(ROLE_TIERS, null, 2) +
    ");\n\n" +
    "export const COMPONENT_TIERS = Object.freeze(" +
    JSON.stringify(tierMap, null, 2) +
    ");\n\n" +
    "/** Look up the role category for a given tag name. Returns null if unknown. */\n" +
    "export function getCategory(tagName) {\n" +
    "  if (!tagName) return null;\n" +
    "  return COMPONENT_CATEGORIES[tagName.toLowerCase()] || null;\n" +
    "}\n\n" +
    "/** Look up the composition tier (1–4) for a given tag name. Null if unknown. */\n" +
    "export function getTier(tagName) {\n" +
    "  if (!tagName) return null;\n" +
    "  return COMPONENT_TIERS[tagName.toLowerCase()] || null;\n" +
    "}\n";
  fs.writeFileSync(categoriesModulePath, categoriesModule);

  // ── Generate docs/nav.html ────────────────────────────────────────
  // Static nav template for the docs shell, grouped by role (tier order).
  const navPath = path.join(ROOT, "docs", "nav.html");
  writeDocsNav(navPath, categoryMap);

  console.log(`\nDone: ${index.length} schemas written to schemas/components/`);
  console.log(
    `      ${Object.keys(categoryMap).length} components categorised → components/utilities/component-categories.js`
  );
  console.log(`      docs/nav.html regenerated`);
  if (errorCount) console.log(`  ${errorCount} components skipped due to errors`);
}

/**
 * Emit docs/nav.html from the tag→role map, grouped by role in tier order.
 * Each role becomes one <details> section under .nav-sections, with one
 * <sherpa-nav-item data-variant="child"> per component sorted alphabetically.
 */
function writeDocsNav(outPath, categoryMap) {
  // Child components whose docs are merged into a parent's page. Mirror of
  // MERGED_CHILDREN in docs/router.js — kept in sync by hand. Children remain
  // in the schema index (for direct links + MCP) but are hidden from the
  // sidebar so the parent's combined page is the canonical entry point.
  const MERGED_CHILDREN = new Set([
    "sherpa-nav-item",
    "sherpa-nav-section",
    "sherpa-node-header",
    "sherpa-node-row",
    "sherpa-node-socket",
    "sherpa-list-item",
  ]);

  const byRole = new Map(ROLE_META.map((r) => [r.id, []]));
  for (const [tag, role] of Object.entries(categoryMap)) {
    if (MERGED_CHILDREN.has(tag)) continue;
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role).push(tag);
  }
  for (const list of byRole.values()) list.sort();

  // Flatten all roles into a single alphabetical list by label.
  const sections = ROLE_META
    .map((meta) => ({ ...meta, tags: byRole.get(meta.id) ?? [] }))
    .filter((s) => s.tags.length)
    .sort((a, b) => a.label.localeCompare(b.label));

  const lines = [];
  lines.push("<!--");
  lines.push("  docs/nav.html — Navigation template for the Sherpa UI docs shell.");
  lines.push("  Loaded by <sherpa-nav data-src=\"/docs/nav.html\"> via fetch().");
  lines.push("");
  lines.push("  GENERATED by scripts/extract-component-schemas.js — do not edit by hand.");
  lines.push("  Sections are sorted alphabetically by role label.");
  lines.push("-->");
  lines.push('<div class="sherpa-nav-root" data-pinned="false" data-mode="default" data-searchable>');
  lines.push("");
  lines.push('  <header class="nav-header">');
  lines.push('    <div class="nav-toolbar">');
  lines.push('      <svg class="nav-logo" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">');
  lines.push('        <path d="M0 0H3.80301L12.9974 9.83439V13.9026H9.19381L4.59663 8.98333V13.9002H0V0ZM8.39098 4.91692H12.9876V0H8.39098V4.91692Z" fill="currentColor"/>');
  lines.push('        <path fill-rule="evenodd" clip-rule="evenodd" d="M12.9974 9.83439H17.594V4.91689H8.40023L12.9974 9.83439Z" fill="#C046FF"/>');
  lines.push("      </svg>");
  lines.push('      <span class="nav-product-name text-heading-lg">Sherpa UI</span>');
  lines.push('      <div class="nav-toolbar-actions">');
  lines.push("        <sherpa-button");
  lines.push('          class="nav-pin-btn"');
  lines.push('          data-variant="tertiary"');
  lines.push('          data-size="small"');
  lines.push('          data-icon-start="&#xf08d;"');
  lines.push('          title="Pin navigation"');
  lines.push('          aria-label="Pin navigation"');
  lines.push("        ></sherpa-button>");
  lines.push("      </div>");
  lines.push("    </div>");
  lines.push("");
  lines.push("    <!-- Search -->");
  lines.push('    <div class="nav-search" role="search">');
  lines.push("      <sherpa-nav-item");
  lines.push('        class="nav-search-icon"');
  lines.push('        data-nav-target="search"');
  lines.push('        data-icon="fa-solid fa-magnifying-glass"');
  lines.push('        tabindex="0"');
  lines.push('        role="button"');
  lines.push('        aria-label="Search"');
  lines.push("        >Search</sherpa-nav-item");
  lines.push("      >");
  lines.push("      <sherpa-input-search");
  lines.push('        class="nav-search-input"');
  lines.push('        placeholder="Type here to filter…"');
  lines.push('        aria-label="Filter navigation"');
  lines.push("      ></sherpa-input-search>");
  lines.push("    </div>");
  lines.push("");
  lines.push("    <sherpa-nav-item");
  lines.push('      data-nav-target="home"');
  lines.push('      data-item-id="/"');
  lines.push('      data-icon="fa-solid fa-house"');
  lines.push('      data-route="/"');
  lines.push('      tabindex="0"');
  lines.push('      role="button"');
  lines.push('      aria-label="Home"');
  lines.push("    >Home</sherpa-nav-item>");
  lines.push("  </header>");
  lines.push("");
  lines.push('  <div class="nav-sections" role="tree">');

  lines.push('    <div class="nav-group" data-group-index="1">');
  for (const role of sections) {
    lines.push(`      <details class="nav-section" data-section-id="${role.id}">`);
    lines.push("        <summary>");
    lines.push("          <sherpa-nav-item");
    lines.push('            data-variant="section"');
    lines.push(`            data-icon="${role.icon}"`);
    lines.push('            tabindex="0"');
    lines.push('            role="button"');
    lines.push(`          >${escapeHtml(role.label)}</sherpa-nav-item>`);
    lines.push("        </summary>");
    for (const tag of role.tags) {
      lines.push("        <sherpa-nav-item");
      lines.push('          data-variant="child"');
      lines.push(`          data-item-id="${tag}"`);
      lines.push(`          data-route="/components/${tag}"`);
      lines.push('          tabindex="0"');
      lines.push('          role="button"');
      lines.push(`        >${escapeHtml(prettyLabel(tag))}</sherpa-nav-item>`);
    }
    lines.push("      </details>");
  }
  lines.push("    </div>");

  lines.push("  </div>");
  lines.push("");
  lines.push('  <template class="nav-item-tpl">');
  lines.push('    <sherpa-nav-item data-variant="child" tabindex="0" role="button"></sherpa-nav-item>');
  lines.push("  </template>");
  lines.push('  <template class="badge-tpl">');
  lines.push('    <sherpa-tag slot="badge" data-status="success"></sherpa-tag>');
  lines.push("  </template>");
  lines.push("");
  lines.push("</div>");
  lines.push("");

  fs.writeFileSync(outPath, lines.join("\n"));
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main();
