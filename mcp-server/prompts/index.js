/**
 * Prompts — guided workflows over the def-driven tool surface.
 *
 *   generate_component   — the paved path: scaffold → author → validate → compile → (Figma) → audit
 *   review_component_usage — audit HTML that uses Sherpa components against the defs
 *   debug_component      — diagnose a component that isn't behaving
 *
 * The old pattern-based prompts (build_ui, spec_ideate, spec_prototype) were
 * dropped — patterns/ was removed from the reforged tree.
 */
import { z } from "zod/v3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const COMPONENTS_DIR = path.join(ROOT, "src", "components");
const DOCS_DIR = path.join(ROOT, "docs");

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);
const readDoc = (name) => {
  const p = path.join(DOCS_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};
const listComponents = () =>
  fs.existsSync(COMPONENTS_DIR)
    ? fs.readdirSync(COMPONENTS_DIR).filter((n) => n.startsWith("sherpa-")).sort()
    : [];
const loadDef = (name) => readJson(path.join(COMPONENTS_DIR, name, `${name}.def.json`));

function componentSummary() {
  return listComponents()
    .map((n) => loadDef(n))
    .filter(Boolean)
    .map((d) => `- **${d.name}** (${d.category ?? "?"}): ${d.description ?? ""}`)
    .join("\n");
}

export function register(server) {
  // ── generate_component — the paved def-driven path ─────────────────
  server.registerPrompt(
    "generate_component",
    {
      title: "Generate a Component (def-driven)",
      description: "The paved path for a new Sherpa component: scaffold a def, author it, validate against the design-system rules, compile to TS/HTML/CSS, then optionally build in Figma and audit.",
      argsSchema: {
        name: z.string().describe("Component element name (sherpa-<kebab>, e.g. sherpa-badge)"),
        description: z.string().describe("What the component does"),
        category: z.string().optional().describe("control | container | content | data | nav | chart"),
      },
    },
    async ({ name, description, category }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Generate a new Sherpa-UI component the def-driven way.

## Spec
- **name:** ${name}
- **category:** ${category ?? "(choose: control | container | content | data | nav | chart)"}
- **description:** ${description}

## Follow this exact workflow (cite the MCP tools)

1. **Reuse check first (Rule 1).** For every leaf role this component needs (count, dot, dismiss, avatar, field…), call \`list_components\` and reuse an existing component — a count is a Badge, a dismiss is an icon Button. NEVER invent a look-alike primitive.
2. **Scaffold.** Call \`scaffold_def({ name: "${name}", category: "${category ?? "…"}" })\` to get the right-shaped starter def.
3. **Author.** Fill every TODO: anatomy (node tree + figma hints), props (data-* + shared vocabulary, one \`kind\` each), slots (with \`accepts\`), events (unprefixed noun-verb + trigger + default), and the \`tokens\` map (aliases without the --sherpa- prefix; status colours as { override, fallback }). Use \`explain_token\` / \`browse_ontology\` to pick correct tokens, and \`token_for(property, value)\` for any geometry value.
4. **Validate — loop until clean.** Call \`validate_def(def)\`. Fix every error (warnings too, where sensible). Re-run until it passes. Watch for: control labels must bind control-content NOT status-content (Rule 4); status containers bind container-* which alias through status (Rule 3).
5. **Compile.** Call \`compile_def(def)\` → TS/HTML/CSS. Write the three files to \`src/components/${name}/\`, then hand-finish the CSS (hex fallbacks, edge-case rules, transitions).
6. **Figma (optional).** To build the Figma component, invoke the \`build-figma-component\` skill — it binds Typography vars on text, keeps buttons on the Button size collection, and verifies icon swaps.
7. **Audit.** Call \`audit_component("${name}")\` and \`check_bindings("${name}")\` to confirm bindings + ontology accuracy.

## Rules to honour (read \`sherpa://rules\` for the full set)
- data-* public API; reuse the shared vocabulary; native attrs stay bare.
- Every text node binds all six Typography vars + a content colour (Rule 2).
- Every geometry property binds the token that resolves to its value (Rule 9); skip off-scale values.
- Events: bubbles + composed, unprefixed noun-verb, a matching @fires in the TS JSDoc.

## Existing components (reuse these)
${componentSummary()}`,
          },
        }],
      };
    }
  );

  // ── review_component_usage — audit HTML against the defs ───────────
  server.registerPrompt(
    "review_component_usage",
    {
      title: "Review Component Usage",
      description: "Audit HTML that uses Sherpa components for correct attributes, enum values, slots, events, and architecture rules.",
      argsSchema: {
        html: z.string().describe("HTML to review"),
        context: z.string().optional().describe("What this HTML is supposed to do (optional)"),
      },
    },
    async ({ html, context }) => {
      const tags = [...new Set([...html.matchAll(/<(sherpa-[a-z][a-z0-9-]*)/g)].map((m) => m[1]))];
      let defContext = "";
      for (const tag of tags) {
        const d = loadDef(tag);
        if (!d) { defContext += `\n### ${tag}\n(unknown component — check the tag name)\n`; continue; }
        const attrs = (d.props ?? []).map((p) => {
          const vals = p.values?.length ? ` [${p.values.join("|")}]` : "";
          return `  ${p.name} {${p.type}}${vals}${p.default != null ? ` (default: ${p.default})` : ""}`;
        }).join("\n");
        defContext += `\n### ${tag} (${d.category ?? "?"})\n${d.description ?? ""}\nProps:\n${attrs || "  (none)"}\n`;
        if (d.events?.length) defContext += `Events: ${d.events.map((e) => e.name).join(", ")}\n`;
        if (d.slots?.length) defContext += `Slots: ${d.slots.map((s) => `"${s.name}" (${(s.accepts ?? []).join("/")})`).join(", ")}\n`;
      }

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Review this Sherpa-UI component usage for issues.
${context ? `\nContext: ${context}\n` : ""}
## HTML to Review
\`\`\`html
${html}
\`\`\`
## Component Defs (the public API — the source of truth)
${defContext || "No recognised Sherpa components found."}

## Check for
1. **Unknown attributes** — not in the def's props.
2. **Wrong enum values** — e.g. data-variant="ghost" when only "primary|secondary" are valid.
3. **Missing required attributes**.
4. **Self-closing custom elements** — must have explicit closing tags.
5. **Wrong slot names / missing slot wrappers** — check each slot's \`accepts\`.
6. **Event handling** — correct unprefixed noun-verb event names.
7. **Accessibility** — aria-label / role / tabindex on interactive elements.
8. **Architecture** — no JS visibility toggling, no opacity for disabled, semantic --sherpa-* tokens with fallbacks.

Report findings grouped by severity (error, warning, suggestion).`,
          },
        }],
      };
    }
  );

  // ── debug_component — diagnose a misbehaving component ──────────────
  server.registerPrompt(
    "debug_component",
    {
      title: "Debug Component",
      description: "Step-by-step diagnosis for a Sherpa component that isn't working as expected.",
      argsSchema: {
        name: z.string().describe("Component element name (e.g. sherpa-button)"),
        issue: z.string().describe("What's wrong or not working"),
        html: z.string().optional().describe("The HTML being used (if available)"),
      },
    },
    async ({ name, issue, html }) => {
      const d = loadDef(name);
      let defText;
      if (d) {
        const attrs = (d.props ?? []).map((p) => {
          const vals = p.values?.length ? ` — valid: ${p.values.join(", ")}` : "";
          return `  ${p.name} {${p.type}}${p.default != null ? ` (default: ${p.default})` : ""}${vals}`;
        }).join("\n");
        const events = (d.events ?? []).map((e) => `  ${e.name}${e.detail ? ` — detail: ${JSON.stringify(e.detail)}` : ""}`).join("\n");
        const slots = (d.slots ?? []).map((s) => `  "${s.name}" (${(s.accepts ?? []).join("/")}): ${s.description ?? ""}`).join("\n");
        defText = `## ${name} API (from its def)\n`;
        if (attrs) defText += `\n### Props\n${attrs}\n`;
        if (events) defText += `\n### Events\n${events}\n`;
        if (slots) defText += `\n### Slots\n${slots}\n`;
      } else {
        defText = `**Note:** "${name}" has no def — check the tag name spelling.`;
      }
      const cssTemplate = readDoc("CSS-FILE-TEMPLATE.md") ?? "";

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Debug this Sherpa-UI component issue.

## Component: \`${name}\`
## Issue: ${issue}
${html ? `\n## Current HTML\n\`\`\`html\n${html}\n\`\`\`\n` : ""}
${defText}

## Diagnostic Checklist
1. **Attribute names** — spelled exactly as in the def's props?
2. **Enum values** — only the documented values?
3. **Boolean attributes** — present without a value (not data-x="true")?
4. **Closing tags** — explicit closing tag on the custom element?
5. **Slot names** — children use the correct slot="…"?
6. **Event listeners** — listening for the exact unprefixed noun-verb names?
7. **JS registration** — the component's module imported before use?
8. **Shadow DOM** — internals are not reachable via document.querySelector.
9. **CSS visibility** — controlled by :host([data-*]) selectors, not JS .hidden?
10. **Token usage** — --sherpa-* semantic tokens with hardcoded fallbacks (never --core-*)?

## CSS Standards Reference
${cssTemplate}

Read \`sherpa://component/${name}/{ts,html,css}\` for the shipped source and \`sherpa://def/${name}\` for the full def. Diagnose the root cause and give a corrected, working example.`,
          },
        }],
      };
    }
  );
}
