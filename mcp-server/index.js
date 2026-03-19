#!/usr/bin/env node

/**
 * Sherpa UI MCP Server
 *
 * Exposes the Sherpa UI component library API to AI agents via the
 * Model Context Protocol (MCP). Transport: stdio.
 *
 * Tools:
 *   query_component      — Look up a component's full API
 *   list_components      — List all components with optional category filter
 *   generate_component   — Generate valid HTML for a component
 *   browse_tokens        — Search design tokens by name or purpose
 *   validate_usage       — Check component HTML for common mistakes
 *
 * Resources:
 *   sherpa://guidelines/*  — Component guidelines, API standard, token usage
 *   sherpa://schema/{tag}  — Raw JSON schema per component
 *
 * Prompts:
 *   build_ui              — Guided prompt for building a UI layout
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEMAS_DIR = path.join(ROOT, "schemas", "components");
const DOCS_DIR = path.join(ROOT, "docs");
const CSS_DIR = path.join(ROOT, "css");
const COPILOT_INSTRUCTIONS = path.join(ROOT, ".github", "copilot-instructions.md");

/* ── Data loading ──────────────────────────────────────────────── */

function loadSchemas() {
  const indexPath = path.join(SCHEMAS_DIR, "index.json");
  if (!fs.existsSync(indexPath)) return new Map();

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const schemas = new Map();

  for (const tag of index) {
    const filePath = path.join(SCHEMAS_DIR, `${tag}.json`);
    if (fs.existsSync(filePath)) {
      schemas.set(tag, JSON.parse(fs.readFileSync(filePath, "utf8")));
    }
  }
  return schemas;
}

function loadTokens() {
  const tokensDir = path.join(ROOT, "css", "styles");
  const tokens = [];

  // Recursively find CSS files with custom properties
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        scanDir(path.join(dir, entry.name));
      } else if (entry.name.endsWith(".css")) {
        const content = fs.readFileSync(path.join(dir, entry.name), "utf8");
        const matches = content.matchAll(/\s*(--sherpa-[a-zA-Z0-9-]+)\s*:/g);
        for (const m of matches) {
          tokens.push({ name: m[1], file: path.relative(ROOT, path.join(dir, entry.name)) });
        }
      }
    }
  }

  scanDir(tokensDir);
  return tokens;
}

function readDoc(filename) {
  const filePath = path.join(DOCS_DIR, filename);
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf8");
  const cssPath = path.join(CSS_DIR, filename);
  if (fs.existsSync(cssPath)) return fs.readFileSync(cssPath, "utf8");
  if (filename === "copilot-instructions.md" && fs.existsSync(COPILOT_INSTRUCTIONS)) {
    return fs.readFileSync(COPILOT_INSTRUCTIONS, "utf8");
  }
  return null;
}

const schemas = loadSchemas();
const tokens = loadTokens();

/* ── HTML generation ───────────────────────────────────────────── */

function generateComponentHTML(schema, attrs = {}, slotContent = {}) {
  const parts = [`<${schema.tagName}`];

  // Add attributes
  for (const [name, value] of Object.entries(attrs)) {
    // Validate attribute exists in schema
    const attrDef = schema.attributes.find((a) => a.name === name);
    if (!attrDef) continue; // Skip unknown attributes

    if (attrDef.type === "boolean") {
      if (value === true || value === "true") parts.push(` ${name}`);
    } else {
      // Sanitize attribute values
      const safe = String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      parts.push(` ${name}="${safe}"`);
    }
  }

  parts.push(">");

  // Add slot content
  const hasSlots = Object.keys(slotContent).length > 0;
  if (hasSlots) {
    for (const [slotName, content] of Object.entries(slotContent)) {
      if (slotName === "" || slotName === "default") {
        parts.push(`\n  ${content}`);
      } else {
        parts.push(`\n  <span slot="${slotName}">${content}</span>`);
      }
    }
    parts.push(`\n`);
  }

  parts.push(`</${schema.tagName}>`);
  return parts.join("");
}

/* ── Validation ────────────────────────────────────────────────── */

function validateUsage(html) {
  const issues = [];

  // Check for known components
  const tagMatches = html.matchAll(/<(sherpa-[a-z][a-z0-9-]*)/g);
  for (const m of tagMatches) {
    if (!schemas.has(m[1])) {
      issues.push({ severity: "error", message: `Unknown component: <${m[1]}>` });
    }
  }

  // Check for bare custom attributes (should use data-* prefix)
  const attrMatches = html.matchAll(/<sherpa-[a-z-]+\s([^>]+)>/g);
  for (const m of attrMatches) {
    const attrStr = m[1];
    // Find bare attributes that aren't standard HTML
    const bareAttrs = attrStr.matchAll(/\b([a-z][a-z-]*?)(?:=|[\s>])/g);
    const STANDARD = new Set(["class", "id", "style", "hidden", "slot", "role", "tabindex",
      "aria-label", "aria-hidden", "aria-expanded", "aria-controls", "aria-describedby",
      "disabled", "readonly", "required", "name", "value", "placeholder", "type",
      "min", "max", "step", "pattern", "minlength", "maxlength", "novalidate", "open"]);
    for (const am of bareAttrs) {
      const attr = am[1];
      if (!attr.startsWith("data-") && !attr.startsWith("aria-") && !STANDARD.has(attr)) {
        issues.push({
          severity: "warning",
          message: `Attribute "${attr}" should use data-* prefix (e.g. data-${attr})`,
        });
      }
    }
  }

  // Check for self-closing custom elements
  const selfClosing = html.matchAll(/<(sherpa-[a-z-]+)\s[^>]*\/>/g);
  for (const m of selfClosing) {
    issues.push({
      severity: "error",
      message: `<${m[1]}/> is self-closing — custom elements require explicit closing tags`,
    });
  }

  // Check for opacity-based disabled styling
  if (html.includes("opacity") && html.includes("disabled")) {
    issues.push({
      severity: "warning",
      message: "Avoid opacity for disabled state — use inactive tokens per property",
    });
  }

  return issues;
}

/* ── MCP Server setup ──────────────────────────────────────────── */

const server = new McpServer({
  name: "sherpa-ui",
  version: "1.0.0",
}, {
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  },
});

/* ── Tools ─────────────────────────────────────────────────────── */

server.registerTool(
  "query_component",
  {
    title: "Query Component",
    description: "Look up a Sherpa UI component's full API: attributes, slots, events, methods, properties",
    inputSchema: { tagName: z.string().describe("Component tag name (e.g. sherpa-button)") },
  },
  async ({ tagName }) => {
    const schema = schemas.get(tagName);
    if (!schema) {
      const available = [...schemas.keys()].join(", ");
      return {
        content: [{
          type: "text",
          text: `Component "${tagName}" not found. Available: ${available}`,
        }],
      };
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify(schema, null, 2),
      }],
    };
  }
);

server.registerTool(
  "list_components",
  {
    title: "List Components",
    description: "List all Sherpa UI components, optionally filtered by category",
    inputSchema: {
      category: z.string().optional()
        .describe("Filter by category: core, layout, navigation, form, data-display, data-viz, feedback, page-level"),
    },
  },
  async ({ category }) => {
    let components = [...schemas.values()];
    if (category) {
      components = components.filter((c) => c.category === category);
    }
    const list = components.map((c) => ({
      tagName: c.tagName,
      description: c.description,
      category: c.category,
      attributes: c.attributes.length,
      slots: c.slots.length,
      events: c.events.length,
    }));
    return {
      content: [{
        type: "text",
        text: JSON.stringify(list, null, 2),
      }],
    };
  }
);

server.registerTool(
  "generate_component",
  {
    title: "Generate Component",
    description: "Generate valid HTML markup for a Sherpa UI component with specified attributes and slot content",
    inputSchema: {
      tagName: z.string().describe("Component tag name (e.g. sherpa-button)"),
      attributes: z.record(z.union([z.string(), z.boolean(), z.number()]))
        .optional()
        .describe('Attributes as key-value pairs (e.g. {"data-label": "Click me", "data-variant": "primary"})'),
      slots: z.record(z.string())
        .optional()
        .describe('Slot content as name-value pairs. Use "" or "default" key for default slot.'),
    },
  },
  async ({ tagName, attributes, slots }) => {
    const schema = schemas.get(tagName);
    if (!schema) {
      return {
        content: [{ type: "text", text: `Unknown component: ${tagName}` }],
      };
    }

    const html = generateComponentHTML(schema, attributes || {}, slots || {});
    const validation = validateUsage(html);

    let response = html;
    if (validation.length) {
      response += "\n\n<!-- Validation notes:\n";
      for (const issue of validation) {
        response += `  ${issue.severity}: ${issue.message}\n`;
      }
      response += "-->";
    }

    return {
      content: [{ type: "text", text: response }],
    };
  }
);

server.registerTool(
  "browse_tokens",
  {
    title: "Browse Tokens",
    description: "Search Sherpa UI design tokens by name pattern or keyword",
    inputSchema: {
      query: z.string().describe("Search term or pattern to match against token names (e.g. 'surface', 'space-sm', 'color')"),
    },
  },
  async ({ query }) => {
    const lowerQuery = query.toLowerCase();
    const matches = tokens.filter((t) => t.name.toLowerCase().includes(lowerQuery));

    if (!matches.length) {
      return {
        content: [{
          type: "text",
          text: `No tokens matching "${query}". Try broader terms like "surface", "text", "space", "border", "radius".`,
        }],
      };
    }

    // Group by file
    const grouped = {};
    for (const t of matches) {
      if (!grouped[t.file]) grouped[t.file] = [];
      grouped[t.file].push(t.name);
    }

    let result = `Found ${matches.length} tokens matching "${query}":\n\n`;
    for (const [file, names] of Object.entries(grouped)) {
      result += `## ${file}\n`;
      for (const name of names) result += `  ${name}\n`;
      result += "\n";
    }

    return { content: [{ type: "text", text: result }] };
  }
);

server.registerTool(
  "validate_usage",
  {
    title: "Validate Usage",
    description: "Check component HTML for common mistakes: unknown components, missing data-* prefix, self-closing tags",
    inputSchema: {
      html: z.string().describe("HTML string containing Sherpa UI components to validate"),
    },
  },
  async ({ html }) => {
    const issues = validateUsage(html);

    if (!issues.length) {
      return {
        content: [{ type: "text", text: "✓ No issues found." }],
      };
    }

    let result = `Found ${issues.length} issue(s):\n\n`;
    for (const issue of issues) {
      result += `${issue.severity.toUpperCase()}: ${issue.message}\n`;
    }

    return { content: [{ type: "text", text: result }] };
  }
);

/* ── Resources ─────────────────────────────────────────────────── */

// Static guideline documents
const GUIDE_FILES = {
  "component-guidelines": { file: "COMPONENT-GUIDELINES.md", name: "Component Guidelines" },
  "api-standard": { file: "COMPONENT-API-STANDARD.md", name: "Component API Standard" },
  "component-template": { file: "COMPONENT-TEMPLATE.md", name: "Component Template" },
  "token-usage": { file: "TOKENS-USAGE-GUIDE.md", name: "Design Token Usage Guide" },
  "text-styles": { file: "TEXT-STYLES.md", name: "Text Styles Reference" },
  "copilot-instructions": { file: "copilot-instructions.md", name: "Copilot Instructions" },
};

for (const [slug, info] of Object.entries(GUIDE_FILES)) {
  server.registerResource(
    info.name,
    `sherpa://guidelines/${slug}`,
    { description: info.name, mimeType: "text/markdown" },
    async () => {
      const content = readDoc(info.file);
      return {
        contents: [{
          uri: `sherpa://guidelines/${slug}`,
          mimeType: "text/markdown",
          text: content || `Document not found: ${info.file}`,
        }],
      };
    }
  );
}

// Component schemas as resources (dynamic via template)
server.registerResource(
  "Component Schema",
  new ResourceTemplate("sherpa://schema/{tagName}", { list: async () => {
    return { resources: [...schemas.keys()].map((tag) => ({
      uri: `sherpa://schema/${tag}`,
      name: tag,
      description: schemas.get(tag)?.description || "",
      mimeType: "application/json",
    })) };
  }}),
  { description: "JSON API schema for a Sherpa UI component", mimeType: "application/json" },
  async (uri, { tagName }) => {
    const schema = schemas.get(tagName);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: schema ? JSON.stringify(schema, null, 2) : `{"error": "Unknown component: ${tagName}"}`,
      }],
    };
  }
);

/* ── Prompts ───────────────────────────────────────────────────── */

server.registerPrompt(
  "build_ui",
  {
    title: "Build UI",
    description: "Guided prompt for building a Sherpa UI layout",
    argsSchema: {
      description: z.string().describe("Describe the UI you want to build"),
      components: z.string().optional().describe("Comma-separated component names to include"),
    },
  },
  async ({ description, components: componentsList }) => {
    let componentContext = "";

    if (componentsList) {
      const requested = componentsList.split(",").map((s) => s.trim());
      for (const tag of requested) {
        const schema = schemas.get(tag);
        if (schema) {
          componentContext += `\n### ${tag}\n${JSON.stringify(schema, null, 2)}\n`;
        }
      }
    } else {
      // Include a summary of all available components
      const summary = [...schemas.values()].map((s) =>
        `- **${s.tagName}** (${s.category}): ${s.description}`
      ).join("\n");
      componentContext = `\n### Available Components\n${summary}\n`;
    }

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Build a UI layout using Sherpa UI web components.

## Requirements
${description}

## Component Reference
${componentContext}

## Rules
1. Use data-* attributes for all custom attributes (not bare attributes)
2. Use semantic design tokens (--sherpa-*) with hardcoded fallbacks
3. CSS handles all visibility via :host([data-*]) selectors — never JS .hidden toggling
4. Custom events use bubbles: true
5. All components need explicit closing tags (no self-closing)
6. Use slot="name" for named content projection

Generate the HTML with inline comments explaining the component usage.`,
          },
        },
      ],
    };
  }
);

/* ── Start ─────────────────────────────────────────────────────── */

const transport = new StdioServerTransport();
await server.connect(transport);
