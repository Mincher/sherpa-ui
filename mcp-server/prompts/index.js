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

  // ── spec_ideate ─────────────────────────────────────────────────────
  server.registerPrompt(
    "spec_ideate",
    {
      title: "Spec Ideate",
      description: "Guided ideation Q&A for a new Sherpa UI feature — produces a versioned spec.md document",
      argsSchema: {
        featureName: z.string().describe("Feature name in kebab-case (e.g. device-management)"),
        context:     z.string().optional().describe("What you already know about this feature"),
      },
    },
    async ({ featureName, context }) => {
      const componentSummary = [...schemas.values()]
        .map((s) => `- **${s.tagName}** (${s.category}): ${s.description}`)
        .join("\n");

      let patternSummary = "";
      if (patterns.size) {
        const grouped = {};
        for (const entry of patterns.values()) {
          (grouped[entry.category] ??= []).push(entry);
        }
        for (const [cat, items] of Object.entries(grouped)) {
          patternSummary += `### ${cat}\n`;
          for (const item of items) {
            patternSummary += `- **${item.id}**: ${item.name}`;
            if (item.description) patternSummary += ` — ${item.description}`;
            patternSummary += "\n";
          }
        }
      }

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Run a structured ideation session for the Sherpa UI feature: **${featureName}**${context ? `\n\nContext already known: ${context}` : ""}

## Your Task

Guide the user through three Q&A rounds to gather everything needed for a feature spec. Then produce the complete spec document and wait for confirmation before writing it.

**Rules:**
- Ask max 3 questions per round
- Skip a round (or individual questions) if the context above already answers them
- Never generate the spec until all relevant rounds are complete
- Show the complete spec draft and wait for explicit confirmation before instructing the user to write it

---

## Round 1 — Purpose & Users (always run)

Ask these questions (skip any already answered by the context):
1. What problem does this feature solve, and who uses it?
2. What are the 1–3 most important things users can *do* here?
3. Which views/screens does this feature need? (list briefly — e.g. "Device List, Device Detail, Settings")

---

## Round 2 — Views & Navigation (run per view named in Round 1)

For each view, ask:
- What data does this view show? What shape? (single record / list of ~N / KPI snapshot + charts)
- What are the primary actions on this view?
- Does it link to or open other views in this feature?

---

## Round 3 — Interactions & Edge Cases

Ask:
- Are any actions multi-step (wizard/dialog) or immediate (single click)?
- What happens when there's no data, or data can't be loaded?
- Anything explicitly out of scope for this first prototype?

---

## After Q&A — Produce the spec

Generate the complete spec in this exact format, then **show it to the user and wait for explicit confirmation** before instructing them to write the file:

\`\`\`markdown
---
title: {Human-Readable Feature Name}
status: draft
version: 1
---

## Summary
One paragraph describing what the feature does and the problem it solves.

## Views

### {View Name}
- Purpose: ...
- Key components: ...
- Primary actions: ...
- Empty state: ...

## Interactions

### {Flow Name}
- Trigger: ...
- Steps: ...
- On success: ...
- On cancel: ...

## Out of Scope

## Open Questions
\`\`\`

**File to write (after confirmation):** \`specs/${featureName}.spec.md\`

After the user confirms, instruct them to write the file, then offer: "Ready to prototype \`{first view name}\`? Use the \`prototype-view\` skill."

---

## Available Sherpa Components (for component selection guidance)

${componentSummary}

## Available Layout Patterns

${patternSummary || "Use get_pattern() to list patterns."}`,
          },
        }],
      };
    }
  );

  // ── spec_prototype ───────────────────────────────────────────────────
  server.registerPrompt(
    "spec_prototype",
    {
      title: "Spec Prototype",
      description: "Generate a self-contained Sherpa UI prototype HTML file for a view defined in a feature spec",
      argsSchema: {
        specContent:  z.string().describe("Full content of the spec.md file"),
        featureName:  z.string().describe("Feature name in kebab-case (e.g. device-management)"),
        viewName:     z.string().describe("View name in kebab-case (e.g. device-list)"),
        mode:         z.enum(["generate", "regenerate", "patch"]).optional().describe("generate (default) | regenerate (overwrite) | patch (targeted edit)"),
        patchRequest: z.string().optional().describe("For patch mode only: describe what to change"),
      },
    },
    async ({ specContent, featureName, viewName, mode = "generate", patchRequest }) => {
      const componentSchemas = [...schemas.values()].map((s) => {
        const attrs = (s.attributes ?? []).map((a) => {
          const vals = a.enumValues ?? a.values;
          return `  ${a.name} {${a.type}}${vals?.length ? ` [${vals.join("|")}]` : ""}${a.default != null ? ` (default: ${a.default})` : ""}`;
        }).join("\n");
        return `### ${s.tagName} (${s.category})\n${s.description}\nAttributes:\n${attrs || "  (none beyond standard)"}`;
      }).join("\n\n");

      let patternSummary = "";
      if (patterns.size) {
        for (const entry of patterns.values()) {
          patternSummary += `- **${entry.id}** (${entry.category}): ${entry.name}`;
          if (entry.description) patternSummary += ` — ${entry.description}`;
          patternSummary += "\n";
        }
      }

      const outputPath = `prototypes/${featureName}/${viewName}.html`;
      const seedPath   = `prototypes/${featureName}/_seed.js`;

      const modeInstructions = {
        generate:   "Generate the complete file from scratch.",
        regenerate: `The file \`${outputPath}\` already exists and will be REPLACED. Generate the complete new file. The caller will ask the user for explicit confirmation before writing.`,
        patch:      `The file \`${outputPath}\` already exists. Make ONLY this targeted change: ${patchRequest ?? "(see spec diff)"}. Output only the changed section(s) with enough surrounding context to locate them precisely. Do not touch unrelated sections.`,
      }[mode];

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Generate a Sherpa UI prototype HTML file.

## Task
${modeInstructions}

**Feature:** ${featureName}
**View:** ${viewName}
**Output file:** \`${outputPath}\`

---

## Feature Spec

\`\`\`markdown
${specContent}
\`\`\`

---

## Prototype File Rules

Every prototype file must follow these conventions exactly:

### 1. Self-contained — no build step
\`\`\`html
<!DOCTYPE html>
<html lang="en" data-theme="apex-2-purple">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{View Name} — {Feature Name} Prototype</title>
  <link rel="stylesheet" href="../../node_modules/sherpa-ui/css/styles/index.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body>
  <!-- prototype banner (see below) -->
  <!-- sherpa UI content -->
  <script type="module">
    import '../../node_modules/sherpa-ui/dist/index.js';
    // wiring...
  </script>
</body>
</html>
\`\`\`

### 2. Prototype banner (inline styles — does NOT affect sherpa layout)
\`\`\`html
<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1a1a2e;color:#fff;font-family:monospace;font-size:12px;padding:6px 16px;display:flex;align-items:center;gap:12px;">
  <span style="background:#e63946;color:#fff;padding:2px 8px;border-radius:3px;font-weight:bold;">PROTOTYPE</span>
  <span>{Feature Name} › {View Name}</span>
  <span style="opacity:0.6;">spec v{N} · ${featureName}.spec.md</span>
</div>
<div style="height:32px;"></div>
\`\`\`

### 3. Real Sherpa components with CORRECT attributes
Use only the attribute names listed in the schemas below — no guessing.

### 4. Hardcoded seed data — realistic, not "foo/bar/test"
Declare as \`const SEED = [...]\` in the module script. If other views exist in this prototype set, extract to \`${seedPath}\` and import.

### 5. \`<template>\` elements for repeated content
Clone with \`cloneNode(true)\` — never \`createElement()\`.

### 6. Minimal JS — no fetch() calls
Wire open/close and navigation only. Mark API call locations with TODO comments:
\`\`\`js
// TODO: POST /api/${featureName} with FormManager.read(form)
\`\`\`

### 7. Data wiring patterns
- Data grid: \`grid.setColumnConfig({...}); grid.setData({ columns, rows });\`
- Charts: \`chart.setData({...});\`
- Metrics: \`await metric.rendered; metric.setValues([...]);\` OR \`metric.setData({ name, summary: { total, delta, deltaPercent, values } });\`
- Dialog: \`el.setAttribute('data-open','');\` to open, \`el.removeAttribute('data-open');\` to close
- Toast: \`SherpaToast.success('...');\` / \`SherpaToast.critical('...');\`

---

## Layout Pattern Selection

Match the view's purpose to a pattern:
${patternSummary || "- Use list-view for browsable data tables with actions\n- Use dashboard-grid for KPIs + charts\n- Use detail-view for single-record pages\n- Use settings-form for configuration pages"}

Call \`get_pattern({ id: 'pattern-id' })\` to get the base HTML structure.

---

## Sherpa Component Schemas (use these for correct attribute names)

${componentSchemas}

---

## Architecture Rules

1. All custom attributes use \`data-\` prefix
2. Use \`--sherpa-*\` semantic tokens with hardcoded fallbacks — never \`--core-*\`
3. CSS controls visibility via \`data-*\` attribute selectors — no JS toggling of \`.hidden\` or \`display\`
4. All custom elements require explicit closing tags — no self-closing \`<sherpa-x />\`
5. Events: \`bubbles: true\`; cross-shadow events also \`composed: true\`
6. Disabled state: use inactive tokens per property — not \`opacity\``,
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
