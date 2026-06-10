import { z } from "zod/v3";
import fs from "fs";
import path from "path";
import { readDoc, parseTemplateIds } from "../lib/loader.js";

export function register(server, { schemas, patterns, cssUtilities }, paths) {
  const { docsDir, cssDir, copilotPath, componentsDir, rootDir } = paths;

  // ── build_ui ────────────────────────────────────────────────────────
  server.registerPrompt(
    "build_ui",
    {
      title: "Build UI",
      description: "Guided prompt for building a Sherpa UI layout from components and patterns",
      argsSchema: {
        description:   z.string().describe("Describe the UI you want to build"),
        components:    z.string().optional().describe("Comma-separated component tag names to include"),
        layoutPattern: z.string().optional().describe("Layout pattern ID to start from"),
      },
    },
    async ({ description, components: componentsList, layoutPattern }) => {
      let componentContext = "";
      if (componentsList) {
        for (const tag of componentsList.split(",").map((s) => s.trim())) {
          const schema = schemas.get(tag);
          if (schema) componentContext += `\n### ${tag}\n${JSON.stringify(schema, null, 2)}\n`;
        }
      } else {
        const summary = [...schemas.values()]
          .map((s) => `- **${s.tagName}** (${s.category}): ${s.description}`)
          .join("\n");
        componentContext = `\n### Available Components\nEach entry below lists the component tag, its category, and its usage description — what it is, when to use it, and key constraints. Use this to select the right component, then call query_component for the full attribute/slot/event API.\n\n${summary}\n`;
      }

      let layoutContext = "";
      if (layoutPattern) {
        const entry = patterns.get(layoutPattern);
        if (entry) {
          const filePath = path.join(rootDir, entry.file);
          if (fs.existsSync(filePath)) {
            layoutContext = `\n## Starting Layout\n\`\`\`html\n${fs.readFileSync(filePath, "utf8")}\n\`\`\`\n`;
          }
        }
      }

      let patternSummary = "";
      if (patterns.size) {
        const grouped = {};
        for (const entry of patterns.values()) {
          (grouped[entry.category] ??= []).push(entry);
        }
        patternSummary = "\n## Available Patterns\n";
        for (const [cat, items] of Object.entries(grouped)) {
          patternSummary += `### ${cat}\n`;
          for (const item of items) {
            patternSummary += `- **${item.id}**: ${item.name}`;
            if (item.description) patternSummary += ` — ${item.description}`;
            patternSummary += "\n";
          }
        }
      }

      let cssUtilSummary = "";
      if (cssUtilities.size) {
        cssUtilSummary = "\n## CSS Utility Classes\n";
        for (const u of cssUtilities.values()) {
          cssUtilSummary += `- **${u.className}** — ${u.description}\n`;
          cssUtilSummary += `  Usage: \`${u.usage}\`\n`;
        }
      }

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Build a UI layout using Sherpa UI web components.

## Requirements
${description}
${layoutContext}
## Component Reference
${componentContext}
${patternSummary}
${cssUtilSummary}
## Rules
1. Use data-* attributes for all custom attributes
2. Use semantic design tokens (--sherpa-*) with hardcoded fallbacks
3. CSS controls visibility via :host([data-*]) — never JS .hidden toggling
4. Custom events: bubbles: true, composed: true
5. All custom elements require explicit closing tags (no self-closing)
6. Use slot="name" for named content projection
7. CRUD flows use flow-start/flow-progress/flow-complete/flow-cancel/flow-error events
8. Flow state lives in app JS — never in DOM attributes
9. Dialogs use native ::backdrop via showModal() — no custom shim elements
10. Toast feedback: SherpaToast.success() on complete, SherpaToast.critical() on error
11. For progressive flex truncation use the .flex-truncate CSS utility class

Generate the HTML with inline comments explaining component usage.`,
          },
        }],
      };
    }
  );

  // ── review_component_usage ──────────────────────────────────────────
  server.registerPrompt(
    "review_component_usage",
    {
      title: "Review Component Usage",
      description: "Audit HTML that uses Sherpa UI components for correctness, anti-patterns, and accessibility issues",
      argsSchema: {
        html:    z.string().describe("HTML to review"),
        context: z.string().optional().describe("What this HTML is supposed to do (optional context)"),
      },
    },
    async ({ html, context }) => {
      const componentTags = [...new Set([...html.matchAll(/<(sherpa-[a-z][a-z0-9-]*)/g)].map((m) => m[1]))];
      let schemaContext = "";
      for (const tag of componentTags) {
        const schema = schemas.get(tag);
        if (schema) {
          const attrs = (schema.attributes ?? []).map((a) => {
            const vals = a.enumValues ?? a.values;
            return `  ${a.name} {${a.type}}${vals?.length ? ` [${vals.join("|")}]` : ""}`;
          }).join("\n");
          schemaContext += `\n### ${tag}\nAttributes:\n${attrs}\n`;
          if (schema.events?.length) {
            schemaContext += `Events: ${schema.events.map((e) => e.name).join(", ")}\n`;
          }
        }
      }

      const apiStandard = readDoc("COMPONENT-API-STANDARD.md", docsDir, cssDir, copilotPath) ?? "";
      const cssTemplate = readDoc("CSS-FILE-TEMPLATE.md", docsDir, cssDir, copilotPath) ?? "";

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Review the following Sherpa UI component usage for issues.
${context ? `\nContext: ${context}\n` : ""}
## HTML to Review
\`\`\`html
${html}
\`\`\`
## Component Schemas
${schemaContext || "No recognized Sherpa components found."}

## API & Naming Standards
${apiStandard || "Use data-* attributes, kebab-case event names, JSDoc @element/@attr/@slot/@event tags."}

## CSS Standards
${cssTemplate || "Section order locked; no chained :host:not(...); CSS owns visibility; semantic tokens only."}

## Check for
1. **Unknown attributes** — attributes not in the component schema
2. **Wrong enum values** — e.g. data-variant="ghost" when only "primary|secondary" are valid
3. **Missing required attributes** — attributes the component needs to function
4. **Self-closing tags** — custom elements must have explicit closing tags
5. **Incorrect slot usage** — wrong slot names or missing slot wrappers
6. **Event handling** — expected events that aren't being listened to
7. **CRUD flow anti-patterns** — state in DOM, missing FlowManager wiring
8. **Accessibility** — missing aria-label, role, tabindex on interactive elements
9. **Design token usage** — hardcoded values instead of --sherpa-* tokens
10. **Architecture violations** — JS visibility toggling, opacity for disabled state, chained :host:not selectors, core tokens in component CSS

Report findings grouped by severity (error, warning, suggestion).`,
          },
        }],
      };
    }
  );

  // ── create_component ────────────────────────────────────────────────
  server.registerPrompt(
    "create_component",
    {
      title: "Create Component",
      description: "Guided prompt for scaffolding a new Sherpa UI web component following library conventions",
      argsSchema: {
        tagName:     z.string().describe("Component tag name (e.g. sherpa-my-widget)"),
        description: z.string().describe("What the component does"),
        category:    z.string().optional().describe("Category: core, layout, navigation, form, data-display, data-viz, feedback, page-level"),
        attributes:  z.string().optional().describe("Comma-separated attribute names the component should have"),
      },
    },
    async ({ tagName, description: compDesc, category, attributes }) => {
      const template = readDoc("COMPONENT-TEMPLATE.md", docsDir, cssDir, copilotPath) ?? "";
      const apiStandard = readDoc("COMPONENT-API-STANDARD.md", docsDir, cssDir, copilotPath) ?? "";
      const cssTemplate = readDoc("CSS-FILE-TEMPLATE.md", docsDir, cssDir, copilotPath) ?? "";

      let attrHints = "";
      if (attributes) {
        attrHints = `\nRequested attributes: ${attributes}\n`;
      }

      // Find a similar component to reference
      const words = (compDesc + " " + (category ?? "")).toLowerCase().split(/\s+/);
      const similarSchema = [...schemas.values()].find((s) =>
        words.some((w) => w.length > 3 && (s.description?.toLowerCase().includes(w) || s.tagName.includes(w)))
      );
      const similarNote = similarSchema
        ? `\nSimilar existing component for reference: ${similarSchema.tagName} — ${similarSchema.description}\n`
        : "";

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Scaffold a new Sherpa UI web component.

## Component Spec
- **Tag name:** ${tagName}
- **Description:** ${compDesc}
- **Category:** ${category ?? "unspecified"}
${attrHints}${similarNote}
## Architecture Rules
${apiStandard || "Use data-* attributes, SherpaElement base class, separate HTML/CSS/JS files, semantic tokens."}

## Template to Follow
${template || "Follow standard web component patterns with shadow DOM, cloneNode template, and JSDoc @element/@attr/@event tags."}

## CSS Standards
${cssTemplate || "Follow section order: host base → internal elements → visibility toggles → variants → sizes → status → interaction states → container queries → motion."}

## Deliverables
Generate:
1. **${tagName}.html** — Shadow DOM template with `<style>` block using --sherpa-* tokens
2. **${tagName}.css** — External CSS (host styles, data-* attribute selectors, no JS-toggled classes)
3. **${tagName}.ts** — TypeScript class extending SherpaElement with JSDoc @element/@attr/@slot/@event tags
4. **JSDoc schema block** — All @attr, @slot, @event annotations for schema extraction

Follow the existing library conventions exactly. Do not add features beyond the spec.`,
          },
        }],
      };
    }
  );

  // ── debug_component ─────────────────────────────────────────────────
  server.registerPrompt(
    "debug_component",
    {
      title: "Debug Component",
      description: "Step-by-step diagnosis for a Sherpa UI component that isn't working as expected",
      argsSchema: {
        tagName: z.string().describe("Component tag name (e.g. sherpa-button)"),
        issue:   z.string().describe("What's wrong or not working"),
        html:    z.string().optional().describe("The HTML being used (if available)"),
      },
    },
    async ({ tagName, issue, html }) => {
      const apiStandard = readDoc("COMPONENT-API-STANDARD.md", docsDir, cssDir, copilotPath) ?? "";
      const cssTemplate = readDoc("CSS-FILE-TEMPLATE.md", docsDir, cssDir, copilotPath) ?? "";
      const schema = schemas.get(tagName);
      let schemaText = "";
      if (schema) {
        const attrs = (schema.attributes ?? []).map((a) => {
          const vals = a.enumValues ?? a.values;
          const valStr = vals?.length ? ` — valid values: ${vals.join(", ")}` : "";
          const def = a.default != null ? ` (default: ${a.default})` : "";
          return `  ${a.name} {${a.type}}${def}${valStr}`;
        }).join("\n");
        const events = (schema.events ?? []).map((e) =>
          `  ${e.name}${e.detail ? ` — detail: ${JSON.stringify(e.detail)}` : ""}`
        ).join("\n");
        const slots = (schema.slots ?? []).map((s) =>
          `  ${s.name ? `slot="${s.name}"` : "(default slot)"}: ${s.description ?? ""}`
        ).join("\n");

        schemaText = `## ${tagName} API\n`;
        if (attrs) schemaText += `\n### Attributes\n${attrs}\n`;
        if (events) schemaText += `\n### Events\n${events}\n`;
        if (slots) schemaText += `\n### Slots\n${slots}\n`;
      } else {
        schemaText = `**Note:** "${tagName}" is not a known Sherpa UI component. Check the tag name spelling.`;
      }

      const htmlSection = html
        ? `\n## Current HTML\n\`\`\`html\n${html}\n\`\`\`\n`
        : "";

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Debug this Sherpa UI component issue.

## Component: \`${tagName}\`
## Issue: ${issue}
${htmlSection}
${schemaText}

## Diagnostic Checklist
1. **Attribute names** — Are all data-* attribute names spelled exactly as in the schema above?
2. **Enum values** — Are all enum attribute values using only the documented values?
3. **Boolean attributes** — Are boolean attributes present without a value (not data-disabled="true")?
4. **Closing tags** — Does the element have an explicit closing tag?
5. **Slot names** — Are named slot children using the correct slot="..." attribute?
6. **Event listeners** — Is the code listening for the correct event names?
7. **CSS imports** — Is sherpa-ui's CSS (css/styles/index.css) loaded on the page?
8. **JS registration** — Is the component's JS file imported before it's used?
9. **Shadow DOM** — Remember custom element internals aren't accessible via querySelector
10. **CSS visibility** — Is visibility controlled by CSS :host([data-*]) selectors, not JS .hidden?
11. **Token usage** — Are --sherpa-* semantic tokens used (not --core-* or hardcoded values)?
12. **CSS section order** — Does the CSS follow the locked section order (host → elements → toggles → variants → sizes → status → interaction → container queries)?

## API & CSS Standards Reference
${apiStandard || ""}
${cssTemplate || ""}

Diagnose the root cause and provide a corrected, working example.`,
          },
        }],
      };
    }
  );
}
