#!/usr/bin/env node

/**
 * generate-component-docs.js
 *
 * Generates comprehensive markdown documentation for each component by
 * combining data from:
 *   - schemas/components/<tag>.json   (attributes, slots, events, methods, properties)
 *   - components/<tag>/<tag>.css      (CSS custom properties, host selectors)
 *   - components/<tag>/<tag>.html     (template structure, CSS parts)
 *
 * Output: components/<tag>/README.md  (one per component)
 *
 * Usage:  node scripts/generate-component-docs.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEMAS_DIR = path.join(ROOT, "schemas", "components");
const COMPONENTS_DIR = path.join(ROOT, "components");

/* ── Load schemas ──────────────────────────────────────────────── */

function loadSchemas() {
  const indexPath = path.join(SCHEMAS_DIR, "index.json");
  if (!fs.existsSync(indexPath)) {
    console.error("No schemas found. Run: npm run schemas");
    process.exit(1);
  }
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const schemas = [];
  for (const tag of index) {
    const fp = path.join(SCHEMAS_DIR, `${tag}.json`);
    if (fs.existsSync(fp)) schemas.push(JSON.parse(fs.readFileSync(fp, "utf8")));
  }
  return schemas;
}

/* ── Extract CSS custom properties from component CSS ──────────── */

function extractCSSProperties(tag) {
  const cssPath = path.join(COMPONENTS_DIR, tag, `${tag}.css`);
  if (!fs.existsSync(cssPath)) return { privateVars: [], hostSelectors: [] };

  const css = fs.readFileSync(cssPath, "utf8");

  // Private custom properties (--_ prefix)
  const privateVars = new Set();
  for (const m of css.matchAll(/--_([a-zA-Z0-9-]+)/g)) {
    privateVars.add(`--_${m[1]}`);
  }

  // Host attribute selectors for variants/states
  const hostSelectors = [];
  for (const m of css.matchAll(/:host\(\[([^\]]+)\]\)/g)) {
    const sel = m[1];
    if (!hostSelectors.includes(sel)) hostSelectors.push(sel);
  }

  return {
    privateVars: [...privateVars].sort(),
    hostSelectors: [...new Set(hostSelectors)].sort(),
  };
}

/* ── Extract templates and CSS parts from HTML ─────────────────── */

function extractHTMLInfo(tag) {
  const htmlPath = path.join(COMPONENTS_DIR, tag, `${tag}.html`);
  if (!fs.existsSync(htmlPath)) return { templates: [], cssParts: [], slotElements: [] };

  const html = fs.readFileSync(htmlPath, "utf8");

  // Template IDs — skip ones inside HTML comments
  const templates = [];
  // Remove HTML comments first
  const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const m of htmlNoComments.matchAll(/<template\s+id="([^"]+)"/g)) {
    templates.push(m[1]);
  }

  // CSS parts
  const cssParts = [];
  for (const m of html.matchAll(/part="([^"]+)"/g)) {
    for (const p of m[1].split(/\s+/)) {
      if (!cssParts.includes(p)) cssParts.push(p);
    }
  }

  // Slot elements
  const slotElements = [];
  for (const m of html.matchAll(/<slot(?:\s+name="([^"]*)")?/g)) {
    slotElements.push(m[1] || "(default)");
  }

  return { templates, cssParts, slotElements };
}

/* ── Generate HTML usage example ───────────────────────────────── */

function generateExample(schema) {
  const parts = [`<${schema.tagName}`];

  // Pick representative attributes for the example
  const exampleAttrs = [];
  for (const attr of schema.attributes) {
    if (attr.name === "disabled" || attr.name === "readonly" || attr.name === "required") continue;
    if (attr.type === "boolean" && attr.name.startsWith("data-")) continue;

    if (attr.name === "data-label" || attr.name === "data-title" || attr.name === "data-variant") {
      exampleAttrs.push(attr);
    } else if (attr.type === "enum" && exampleAttrs.length < 3) {
      exampleAttrs.push(attr);
    } else if (attr.type === "string" && exampleAttrs.length < 3) {
      exampleAttrs.push(attr);
    }
    if (exampleAttrs.length >= 4) break;
  }

  for (const attr of exampleAttrs) {
    if (attr.type === "boolean") {
      parts.push(` ${attr.name}`);
    } else if (attr.type === "enum" && attr.enumValues?.length) {
      parts.push(` ${attr.name}="${attr.enumValues[0]}"`);
    } else if (attr.name === "data-label") {
      parts.push(` data-label="Example Label"`);
    } else if (attr.name === "data-title") {
      parts.push(` data-title="Example Title"`);
    } else if (attr.name === "data-description") {
      parts.push(` data-description="A brief description"`);
    } else if (attr.type === "string") {
      parts.push(` ${attr.name}="value"`);
    } else if (attr.type === "number") {
      parts.push(` ${attr.name}="10"`);
    }
  }

  parts.push(">");

  // Add slot content for components with slots
  const defaultSlot = schema.slots.find((s) => s.name === "" || s.name === "(default)" || s.name === "default");
  const namedSlots = schema.slots.filter((s) => s.name && s.name !== "" && s.name !== "(default)" && s.name !== "default");

  if (defaultSlot || namedSlots.length) {
    if (defaultSlot) {
      parts.push(`\n  <!-- Default slot content -->`);
      parts.push(`\n  <p>Your content here</p>`);
    }
    for (const slot of namedSlots.slice(0, 2)) {
      parts.push(`\n  <span slot="${slot.name}"><!-- ${slot.description || slot.name} --></span>`);
    }
    parts.push(`\n`);
  }

  parts.push(`</${schema.tagName}>`);
  return parts.join("");
}

/* ── Generate variant examples ─────────────────────────────────── */

function generateVariantExamples(schema) {
  const variantAttr = schema.attributes.find(
    (a) => a.name === "data-variant" && a.type === "enum" && a.enumValues?.length
  );
  if (!variantAttr) return "";

  const label = schema.attributes.find((a) => a.name === "data-label");
  let md = "### Variants\n\n```html\n";
  for (const v of variantAttr.enumValues) {
    md += `<${schema.tagName}`;
    md += ` data-variant="${v}"`;
    if (label) md += ` data-label="${v[0].toUpperCase() + v.slice(1)}"`;
    md += `></${schema.tagName}>\n`;
  }
  md += "```\n";
  return md;
}

/* ── Generate size examples ────────────────────────────────────── */

function generateSizeExamples(schema) {
  const sizeAttr = schema.attributes.find(
    (a) => a.name === "data-size" && a.type === "enum" && a.enumValues?.length
  );
  if (!sizeAttr) return "";

  const label = schema.attributes.find((a) => a.name === "data-label");
  let md = "### Sizes\n\n```html\n";
  for (const s of sizeAttr.enumValues) {
    md += `<${schema.tagName}`;
    md += ` data-size="${s}"`;
    if (label) md += ` data-label="${s[0].toUpperCase() + s.slice(1)}"`;
    md += `></${schema.tagName}>\n`;
  }
  md += "```\n";
  return md;
}

/* ── Build markdown ────────────────────────────────────────────── */

function buildMarkdown(schema) {
  const { privateVars, hostSelectors } = extractCSSProperties(schema.tagName);
  const { templates, cssParts, slotElements } = extractHTMLInfo(schema.tagName);

  const lines = [];

  // Title & description
  lines.push(`# ${schema.tagName}`);
  lines.push("");
  lines.push(`> **Category:** ${schema.category} · **Base class:** ${schema.baseClass}`);
  lines.push("");
  // Format long descriptions into readable paragraphs
  const desc = schema.description
    .replace(/\s*\n\s*/g, " ")   // Normalize line breaks to spaces
    .replace(/\s{2,}/g, " ")     // Collapse multiple spaces
    .trim();
  lines.push(desc);
  lines.push("");

  // Templates
  if (templates.length > 1) {
    lines.push("## Templates");
    lines.push("");
    const typeAttr = schema.attributes.find((a) => a.name === "data-type");
    if (typeAttr) {
      lines.push(`Set via \`data-type\` attribute:`);
    } else {
      lines.push(`Available templates:`);
    }
    lines.push("");
    for (const t of templates) {
      lines.push(`- \`${t}\``);
    }
    lines.push("");
  }

  // ── Attributes ────────────────────────────────────────────────
  if (schema.attributes.length) {
    lines.push("## Attributes");
    lines.push("");
    lines.push("| Attribute | Type | Description | Default | Values |");
    lines.push("| --------- | ---- | ----------- | ------- | ------ |");
    for (const attr of schema.attributes) {
      const def = attr.default != null ? `\`${attr.default}\`` : "—";
      const vals = attr.type === "enum" && attr.enumValues?.length
        ? attr.enumValues.map((v) => `\`${v}\``).join(", ")
        : "—";
      const desc = (attr.description || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| \`${attr.name}\` | ${attr.type} | ${desc} | ${def} | ${vals} |`);
    }
    lines.push("");
  }

  // ── Slots ─────────────────────────────────────────────────────
  if (schema.slots.length) {
    lines.push("## Slots");
    lines.push("");
    lines.push("| Slot | Description |");
    lines.push("| ---- | ----------- |");
    for (const slot of schema.slots) {
      const name = slot.name || "(default)";
      lines.push(`| \`${name}\` | ${slot.description || "—"} |`);
    }
    lines.push("");
    lines.push("Slot usage:");
    lines.push("");
    lines.push("```html");
    lines.push(`<${schema.tagName}>`);
    const defaultSlot = schema.slots.find((s) => !s.name || s.name === "default" || s.name === "(default)");
    if (defaultSlot) {
      lines.push("  <!-- Default slot -->");
      lines.push("  <p>Content goes here</p>");
    }
    for (const slot of schema.slots.filter((s) => s.name && s.name !== "default" && s.name !== "(default)")) {
      lines.push(`  <div slot="${slot.name}"><!-- ${slot.description || slot.name} --></div>`);
    }
    lines.push(`</${schema.tagName}>`);
    lines.push("```");
    lines.push("");
  }

  // ── Events ────────────────────────────────────────────────────
  if (schema.events.length) {
    lines.push("## Events");
    lines.push("");
    for (const event of schema.events) {
      lines.push(`### \`${event.name}\``);
      lines.push("");
      if (event.description) lines.push(event.description);
      lines.push("");
      const flags = [];
      if (event.bubbles) flags.push("bubbles");
      if (event.composed) flags.push("composed");
      lines.push(`**Propagation:** ${flags.length ? flags.join(", ") : "does not bubble"}`);
      lines.push("");
      if (event.detail && Object.keys(event.detail).length) {
        lines.push("**Detail:**");
        lines.push("");
        lines.push("```js");
        lines.push(`event.detail = {`);
        for (const [key, type] of Object.entries(event.detail)) {
          lines.push(`  ${key}: ${type},`);
        }
        lines.push("};");
        lines.push("```");
      } else {
        lines.push("**Detail:** none");
      }
      lines.push("");
      lines.push("```js");
      lines.push(`element.addEventListener("${event.name}", (e) => {`);
      if (event.detail && Object.keys(event.detail).length) {
        const firstKey = Object.keys(event.detail)[0];
        lines.push(`  console.log(e.detail.${firstKey});`);
      } else {
        lines.push(`  // handle event`);
      }
      lines.push("});");
      lines.push("```");
      lines.push("");
    }
  }

  // ── Methods ───────────────────────────────────────────────────
  if (schema.methods?.length) {
    lines.push("## Methods");
    lines.push("");
    lines.push("| Method | Description |");
    lines.push("| ------ | ----------- |");
    for (const method of schema.methods) {
      const desc = (method.description || "").replace(/\|/g, "\\|");
      lines.push(`| \`${method.name}\` | ${desc} |`);
    }
    lines.push("");

    // Detailed method docs
    for (const method of schema.methods) {
      if (method.params?.length || method.returns) {
        lines.push(`### \`${method.name}\``);
        lines.push("");
        if (method.description) lines.push(method.description);
        lines.push("");
        if (method.params?.length) {
          lines.push("**Parameters:**");
          lines.push("");
          for (const p of method.params) {
            lines.push(`- \`${p.name}\` (\`${p.type || "any"}\`) — ${p.description || ""}`);
          }
          lines.push("");
        }
        if (method.returns) {
          lines.push(`**Returns:** \`${method.returns}\``);
          lines.push("");
        }
      }
    }
  }

  // ── Properties ────────────────────────────────────────────────
  if (schema.properties?.length) {
    lines.push("## Properties");
    lines.push("");
    lines.push("| Property | Type | Description | Access |");
    lines.push("| -------- | ---- | ----------- | ------ |");
    for (const prop of schema.properties) {
      const access = prop.readonly ? "read-only" : "read/write";
      const desc = (prop.description || "").replace(/\|/g, "\\|");
      lines.push(`| \`${prop.name}\` | \`${prop.type || "any"}\` | ${desc} | ${access} |`);
    }
    lines.push("");
  }

  // ── CSS Parts ─────────────────────────────────────────────────
  if (cssParts.length) {
    lines.push("## CSS Parts");
    lines.push("");
    lines.push("Style internal elements from outside the shadow DOM:");
    lines.push("");
    for (const part of cssParts) {
      lines.push(`- \`${part}\``);
    }
    lines.push("");
    lines.push("```css");
    lines.push(`${schema.tagName}::part(${cssParts[0]}) {`);
    lines.push("  /* custom styles */");
    lines.push("}");
    lines.push("```");
    lines.push("");
  }

  // ── CSS Custom Properties (internal) ──────────────────────────
  if (privateVars.length) {
    lines.push("## Internal CSS Custom Properties");
    lines.push("");
    lines.push("These `--_` prefixed properties are used internally and can be");
    lines.push("influenced by setting `data-*` attributes or status on ancestors:");
    lines.push("");
    const shown = privateVars.slice(0, 20);
    for (const v of shown) {
      lines.push(`- \`${v}\``);
    }
    if (privateVars.length > 20) {
      lines.push(`- ... and ${privateVars.length - 20} more`);
    }
    lines.push("");
  }

  // ── Usage Examples ────────────────────────────────────────────
  lines.push("## Usage");
  lines.push("");
  lines.push("### Basic");
  lines.push("");
  lines.push("```html");
  lines.push(generateExample(schema));
  lines.push("```");
  lines.push("");

  const variantExample = generateVariantExamples(schema);
  if (variantExample) {
    lines.push(variantExample);
  }

  const sizeExample = generateSizeExamples(schema);
  if (sizeExample) {
    lines.push(sizeExample);
  }

  // Disabled example if supported
  if (schema.attributes.find((a) => a.name === "disabled")) {
    lines.push("### Disabled");
    lines.push("");
    lines.push("```html");
    const labelAttr = schema.attributes.find((a) => a.name === "data-label");
    lines.push(`<${schema.tagName}${labelAttr ? ' data-label="Disabled"' : ""} disabled></${schema.tagName}>`);
    lines.push("```");
    lines.push("");
  }

  // ── Import ────────────────────────────────────────────────────
  lines.push("## Import");
  lines.push("");
  lines.push("```js");
  lines.push(`// Individual import`);
  lines.push(`import "sherpa-ui/components/${schema.tagName}/${schema.tagName}.js";`);
  lines.push("");
  lines.push(`// Or import everything`);
  lines.push(`import "sherpa-ui";`);
  lines.push("```");
  lines.push("");

  // ── File structure ────────────────────────────────────────────
  lines.push("## Files");
  lines.push("");
  lines.push("| File | Purpose |");
  lines.push("| ---- | ------- |");
  lines.push(`| [\`${schema.tagName}.js\`](${schema.tagName}.js) | Component class, lifecycle, events |`);

  const cssExists = fs.existsSync(path.join(COMPONENTS_DIR, schema.tagName, `${schema.tagName}.css`));
  if (cssExists) {
    lines.push(`| [\`${schema.tagName}.css\`](${schema.tagName}.css) | Styles, variants, states |`);
  }

  const htmlExists = fs.existsSync(path.join(COMPONENTS_DIR, schema.tagName, `${schema.tagName}.html`));
  if (htmlExists) {
    lines.push(`| [\`${schema.tagName}.html\`](${schema.tagName}.html) | Shadow DOM template(s) |`);
  }

  lines.push("");

  return lines.join("\n");
}

/* ── Main ──────────────────────────────────────────────────────── */

const schemas = loadSchemas();
let count = 0;

for (const schema of schemas) {
  const md = buildMarkdown(schema);
  const outPath = path.join(COMPONENTS_DIR, schema.tagName, "README.md");
  fs.writeFileSync(outPath, md, "utf8");
  count++;
}

console.log(`Generated ${count} component README.md files`);
