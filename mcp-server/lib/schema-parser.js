import fs from "fs";
import path from "path";

/* ── Category map (legacy `group` — layout-oriented sidebar grouping) ── */

export const GROUP_MAP = {
  "sherpa-button":             "core",
  "sherpa-tag":                "core",
  "sherpa-switch":             "core",
  "sherpa-loader":             "core",
  "sherpa-tooltip":            "core",
  "sherpa-container-overlay":  "core",

  "sherpa-panel":              "layout",
  "sherpa-accordion":          "layout",
  "sherpa-tabs":               "layout",
  "sherpa-dialog":             "layout",
  "sherpa-nav":                "navigation",
  "sherpa-nav-item":           "navigation",
  "sherpa-breadcrumbs":        "navigation",
  "sherpa-overlay-item":       "navigation",
  "sherpa-product-bar":        "navigation",
  "sherpa-input-text":         "form",
  "sherpa-input-number":       "form",
  "sherpa-input-password":     "form",
  "sherpa-input-search":       "form",
  "sherpa-input-select":       "form",
  "sherpa-input-date":         "form",
  "sherpa-input-date-range":   "form",
  "sherpa-input-time":         "form",
  "sherpa-file-upload":        "form",
  "sherpa-slider":             "form",
  "sherpa-stepper":            "form",
  "sherpa-data-grid":          "data-display",
  "sherpa-list-item":          "data-display",
  "sherpa-key-value-list":     "data-display",
  "sherpa-pagination":         "data-display",
  "sherpa-metric":             "data-display",
  "sherpa-empty-state":        "data-display",
  "sherpa-barchart":           "data-viz",
  "sherpa-donut-chart":        "data-viz",
  "sherpa-line-chart":         "data-viz",
  "sherpa-sparkline":          "data-viz",
  "sherpa-gauge-chart":        "data-viz",
  "sherpa-chart-legend":       "data-viz",
  "sherpa-data-viz-container": "data-viz",
  "sherpa-message":            "feedback",
  "sherpa-callout":            "feedback",
  "sherpa-toast":              "feedback",
  "sherpa-progress-bar":       "feedback",
  "sherpa-progress-tracker":   "feedback",
  "sherpa-view-header":        "page-level",
  "sherpa-section-header":     "page-level",
  "sherpa-toolbar":            "page-level",
  "sherpa-container-footer":   "page-level",
  "sherpa-filter-bar":         "page-level",
  "sherpa-container-pdf":      "page-level",
};

/* ── Role taxonomy ── */

export const VALID_CATEGORIES = new Set([
  "shell", "control", "input", "display", "feedback",
  "container", "content", "nav", "overlay", "media", "data", "ai", "utility",
]);

export const ROLE_TIERS = Object.freeze({
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

/* ── JSDoc utilities ── */

export function jsdocLines(block) {
  return block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, ""))
    .filter((l) => l !== undefined);
}

function extractJSDoc(source) {
  const match = source.match(/\/\*\*[\s\S]*?\*\//);
  return match ? match[0] : null;
}

/* ── Tag parsers ── */

function parseAttr(line) {
  const m = line.match(
    /^@attr\s+\{(\w+)\}\s+\[?([\w-]+)(?:=([^\]]*))?\]?\s*(?:[—–]\s+)?(.*)$/
  );
  if (!m) return { name: line.replace("@attr ", ""), type: "string", description: "" };

  let type = m[1].trim();
  if (type === "flag") type = "boolean";

  const attr = {
    name: m[2].trim(),
    type,
    description: (m[4] || "").trim(),
  };

  if (m[3] !== undefined) attr.default = parseDefault(m[3].trim(), attr.type);

  if (attr.type === "enum" && attr.description) {
    const pipeValues = attr.description.match(/([\w-]+(?:\s*\|\s*[\w-]+)+)/);
    if (pipeValues) attr.enumValues = pipeValues[1].split(/\s*\|\s*/);
  }

  return attr;
}

function parseSlot(line) {
  const stripped = line.replace(/^@slot\s*/, "");

  if (!stripped || stripped.startsWith("—") || stripped.startsWith("–") || stripped.startsWith("-")) {
    return { name: "", description: stripped.replace(/^[—–-]\s*/, "").trim() };
  }

  if (stripped.startsWith("(default)")) {
    return { name: "", description: stripped.replace(/^\(default\)\s*[—–-]?\s*/, "").trim() };
  }

  const m = stripped.match(/^(\S+)\s*(?:[—–]\s*(.*))?$/);
  return {
    name: m ? m[1].trim() : stripped.trim(),
    description: m && m[2] ? m[2].trim() : "",
  };
}

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

  while (nextIndex + 1 < lines.length) {
    const next = lines[nextIndex + 1];
    const trimmed = next.trim();
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
      event.detail = (detailStr === "none" || detailStr === "{}") ? null : parseDetailObject(detailStr);
    }

    nextIndex++;
  }

  return { data: event, nextIndex };
}

function parseDetailObject(str) {
  const inner = str.replace(/^\{/, "").replace(/\}$/, "").trim();
  if (!inner) return null;
  const detail = {};
  for (const part of inner.split(/,\s*/)) {
    const kv = part.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) detail[kv[1].trim()] = kv[2].trim();
  }
  return Object.keys(detail).length ? detail : null;
}

function parseMethod(line) {
  const m = line.match(/^@method\s+(\S+(?:\([^)]*\))?)\s*(?:[—–]\s*(.*))?$/);
  if (!m) return { name: line.replace("@method ", "").trim(), description: "" };

  let name = m[1].trim();
  let description = (m[2] || "").trim();
  let isStatic = false;

  if (name.includes(".")) { isStatic = true; name = name.substring(name.indexOf(".") + 1); }
  if (description.startsWith("(static)")) { isStatic = true; description = description.replace("(static)", "").trim(); }

  const method = { name, description };
  if (isStatic) method.static = true;

  const paramMatch = name.match(/\(([^)]*)\)/);
  if (paramMatch && paramMatch[1].trim()) {
    method.params = paramMatch[1].split(",").map((p) => {
      const trimmed = p.trim();
      const isOptional = trimmed.startsWith("[");
      return { name: trimmed.replace(/[[\]]/g, ""), type: "any", ...(isOptional ? { optional: true } : {}) };
    });
  }

  return method;
}

function parseProp(line) {
  const m = line.match(/^@prop\s+\{([^}]+)\}\s+(\S+)\s*(?:[—–]\s*(.*))?$/);
  if (!m) return { name: line.replace("@prop ", "").trim(), type: "any", description: "" };

  const prop = { name: m[2].trim(), type: m[1].trim(), description: (m[3] || "").trim() };
  if (prop.description.toLowerCase().includes("read-only") || prop.description.toLowerCase().includes("readonly")) {
    prop.readonly = true;
  }
  return prop;
}

function parseCssPart(line) {
  const m = line.match(/^@csspart\s+(\S+)\s*(?:[—–]\s*(.*))?$/);
  return { name: m ? m[1].trim() : line.replace("@csspart ", "").trim(), description: m && m[2] ? m[2].trim() : "" };
}

function parseCssProp(line) {
  const m = line.match(/^@cssprop\s+(\S+)\s*(?:[—–]\s*(.*))?$/);
  return { name: m ? m[1].trim() : line.replace("@cssprop ", "").trim(), description: m && m[2] ? m[2].trim() : "" };
}

function parseDefault(val, type) {
  if (type === "boolean") return val === "true";
  if (type === "number") return Number(val);
  return val;
}

/* ── JSDoc block parser ── */

function parseJSDoc(lines) {
  const result = {
    tagName: null, category: null, description: "", extendedDescription: "",
    baseClass: "SherpaElement",
    attributes: [], slots: [], events: [], methods: [], properties: [],
    cssParts: [], cssProperties: [],
  };

  let i = 0;
  const descLines = [];

  while (i < lines.length && !lines[i].startsWith("@")) {
    let trimmed = lines[i].trim();
    if (trimmed.match(/^sherpa-[\w-]+\.(js|ts)$/)) { i++; continue; }
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
      let desc = line.replace("@description ", "").trim();
      while (i + 1 < lines.length && !lines[i + 1].trim().startsWith("@")) {
        i++;
        const next = lines[i].trim();
        if (next) desc += " " + next; else break;
      }
      result.description = desc;
    } else if (line.startsWith("@attr ")) {
      result.attributes.push(parseAttr(line));
    } else if (line.startsWith("@slot ") || line === "@slot" || line.startsWith("@slot —") || line.startsWith("@slot –")) {
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

    i++;
  }

  if (descLines.length && !result.description) {
    result.description = descLines.join(" ");
  } else if (descLines.length) {
    result.extendedDescription = descLines.join(" ");
  }

  return result;
}

/* ── Slot accepts (from HTML template) ── */

function parseSlotAccepts(html) {
  const map = new Map();
  const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
  const slotRe = /<slot\b([^>]*)>/g;
  let m;
  while ((m = slotRe.exec(stripped)) !== null) {
    const attrs = m[1];
    const acceptsMatch = attrs.match(/data-accepts\s*=\s*["']([^"']+)["']/);
    if (!acceptsMatch) continue;
    const nameMatch = attrs.match(/\bname\s*=\s*["']([^"']+)["']/);
    const name = nameMatch ? nameMatch[1] : "";
    map.set(name, acceptsMatch[1].split(",").map((s) => s.trim()).filter(Boolean));
  }
  return map;
}

/* ── Inherited attribute resolution ── */

function extractInheritedAttrs(srcPath, visited = new Set()) {
  const inherited = new Map();
  if (!fs.existsSync(srcPath) || visited.has(srcPath)) return inherited;
  visited.add(srcPath);

  const src = fs.readFileSync(srcPath, "utf8");
  const ext = src.match(/class\s+\w+\s+extends\s+([\w()\s,]+?)\s*\{/);
  if (!ext) return inherited;

  const idents = [...new Set(ext[1].match(/\b[A-Z]\w*/g) || [])];

  for (const ident of idents) {
    const impRe = new RegExp(
      `import\\s*\\{[^}]*\\b${ident}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`
    );
    const imp = src.match(impRe);
    if (!imp) continue;

    // Resolve .js import specifiers to the actual .ts file on disk
    let basePath;
    try {
      basePath = new URL(imp[1], "file://" + srcPath).pathname;
    } catch {
      continue;
    }
    // TypeScript projects import with .js extension; try .ts counterpart
    if (!fs.existsSync(basePath) && basePath.endsWith(".js")) {
      const tsPath = basePath.slice(0, -3) + ".ts";
      if (fs.existsSync(tsPath)) basePath = tsPath;
    }
    if (!fs.existsSync(basePath)) continue;

    const baseSrc = fs.readFileSync(basePath, "utf8");
    const baseJsdoc = extractJSDoc(baseSrc);
    if (baseJsdoc) {
      for (const raw of jsdocLines(baseJsdoc)) {
        const line = raw.trim();
        if (line.startsWith("@attr ")) {
          const attr = parseAttr(line);
          if (attr?.name && !inherited.has(attr.name)) {
            inherited.set(attr.name, { ...attr, inherited: ident });
          }
        }
      }
    }

    // Fallback: bare observedAttributes strings when @attr not present
    for (const ob of baseSrc.matchAll(/observedAttributes\s*\(\s*\)\s*\{[\s\S]*?return\s*\[([\s\S]*?)\]/g)) {
      for (const m of ob[1].matchAll(/['"]([a-z][\w-]*)['"]/g)) {
        const name = m[1];
        if (!inherited.has(name)) {
          inherited.set(name, { name, type: "string", description: "", inherited: ident });
        }
      }
    }

    for (const [k, v] of extractInheritedAttrs(basePath, visited)) {
      if (!inherited.has(k)) inherited.set(k, v);
    }
  }

  return inherited;
}

/* ── Public API ── */

/**
 * Enumerate all sherpa-* component tag names under componentsDir.
 * Only reads directory listings — no file content is parsed.
 */
export function discoverComponentTags(componentsDir) {
  if (!fs.existsSync(componentsDir)) return [];
  return fs.readdirSync(componentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("sherpa-"))
    .map((e) => e.name)
    .filter((name) => {
      const dir = path.join(componentsDir, name);
      return fs.existsSync(path.join(dir, `${name}.ts`)) || fs.existsSync(path.join(dir, `${name}.js`));
    })
    .sort();
}

/**
 * Parse the schema for a single component from its source files.
 * Returns null if the component directory or JSDoc block is missing.
 */
export function parseComponentSchema(tagName, componentsDir) {
  const dir = path.join(componentsDir, tagName);
  const tsFile = path.join(dir, `${tagName}.ts`);
  const jsFile = path.join(dir, `${tagName}.js`);
  const srcPath = fs.existsSync(tsFile) ? tsFile : fs.existsSync(jsFile) ? jsFile : null;
  if (!srcPath) return null;

  const source = fs.readFileSync(srcPath, "utf8");
  const jsdoc = extractJSDoc(source);
  if (!jsdoc) return null;

  const api = parseJSDoc(jsdocLines(jsdoc));
  if (!api.tagName) return null;

  // Merge inherited attrs from base classes
  const inherited = extractInheritedAttrs(srcPath);
  const ownNames = new Set(api.attributes.map((a) => a.name));
  for (const [name, attr] of inherited) {
    if (!ownNames.has(name)) api.attributes.push(attr);
  }

  // Metadata
  api.group = GROUP_MAP[api.tagName] || "core";
  const hostTier = ROLE_TIERS[api.category] ?? null;
  if (hostTier) api.tier = hostTier;

  // Merge slot accepts from HTML template
  const htmlPath = path.join(dir, `${tagName}.html`);
  if (fs.existsSync(htmlPath)) {
    const slotAccepts = parseSlotAccepts(fs.readFileSync(htmlPath, "utf8"));
    for (const slot of api.slots) {
      const key = slot.name || "";
      if (slotAccepts.has(key)) slot.accepts = slotAccepts.get(key);
    }
  }

  // Build clean output — same shape as the pre-generated JSON files
  const output = { tagName: api.tagName, description: api.description };
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

  return output;
}

/**
 * Map-like session cache for component schemas.
 * Schemas are parsed from source on first access and cached for the session.
 */
export class SchemaRegistry {
  #componentsDir;
  #cache = new Map();
  #tagNames = null;

  constructor(componentsDir) {
    this.#componentsDir = componentsDir;
  }

  #tags() {
    if (!this.#tagNames) this.#tagNames = discoverComponentTags(this.#componentsDir);
    return this.#tagNames;
  }

  get(tagName) {
    if (this.#cache.has(tagName)) return this.#cache.get(tagName);
    const schema = parseComponentSchema(tagName, this.#componentsDir);
    if (schema) this.#cache.set(tagName, schema);
    return schema ?? undefined;
  }

  has(tagName) {
    return this.#tags().includes(tagName);
  }

  *keys() { yield* this.#tags(); }

  *values() { for (const tag of this.#tags()) yield this.get(tag); }

  get size() { return this.#tags().length; }
}
