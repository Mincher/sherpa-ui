import fs from "fs";
import path from "path";
import { z } from "zod/v3";
import { generateFlowHTML, generatePatternComponent } from "../lib/generators.js";
import { validateUsage } from "../lib/validation.js";
import { parseTemplateIds } from "../lib/loader.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

const V2_PATTERNS = ["add-entity-flow", "edit-entity-flow", "delete-entity-flow"];

export function register(server, { schemas, patterns }, { patternsDir, rootDir, componentsDir }) {
  server.registerTool(
    "list_patterns",
    {
      title: "List Patterns",
      description: "List available view layout and UX patterns, optionally filtered by category.",
      inputSchema: {
        category: z.string().optional()
          .describe('Filter by category: "layouts", "feedback", "flows"'),
      },
    },
    async ({ category }) => {
      try {
        if (!patterns.size) {
          return ok("No patterns available. Run `npm run patterns` to generate the pattern index.");
        }
        let entries = [...patterns.values()];
        if (category) {
          entries = entries.filter((e) => e.category.toLowerCase() === category.toLowerCase());
          if (!entries.length) {
            const cats = [...new Set([...patterns.values()].map((e) => e.category))];
            return ok(`No patterns in category "${category}". Available: ${cats.join(", ")}`);
          }
        }

        const grouped = {};
        for (const e of entries) {
          if (!grouped[e.category]) grouped[e.category] = [];
          grouped[e.category].push(e);
        }

        let result = `Found ${entries.length} pattern(s):\n\n`;
        for (const [cat, items] of Object.entries(grouped)) {
          result += `## ${cat}\n`;
          for (const item of items) {
            const status = item.status ? ` [${item.status}]` : "";
            const ver = item.version ? ` v${item.version}` : "";
            result += `- **${item.id}**${ver}${status}: ${item.name}\n`;
            if (item.description) result += `  ${item.description}\n`;
            if (item.components?.length) result += `  Components: ${item.components.join(", ")}\n`;
          }
          result += "\n";
        }
        return ok(result);
      } catch (e) {
        return err(`list_patterns: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "get_pattern",
    {
      title: "Get Pattern",
      description: "Get the full HTML source for a layout or UX pattern.",
      inputSchema: {
        patternId: z.string().describe('Pattern ID (e.g. "app-shell", "dashboard-grid")'),
      },
    },
    async ({ patternId }) => {
      try {
        const entry = patterns.get(patternId);
        if (!entry) {
          const available = [...patterns.keys()].join(", ");
          return ok(`Unknown pattern "${patternId}". Available: ${available}`);
        }
        const filePath = path.join(rootDir, entry.file);
        if (!fs.existsSync(filePath)) {
          return ok(`Pattern file not found: ${entry.file}`);
        }
        return ok(fs.readFileSync(filePath, "utf8"));
      } catch (e) {
        return err(`get_pattern: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "generate_pattern",
    {
      title: "Generate Pattern (v2.0)",
      description: `Generate a complete behavior-driven pattern with HTML, JavaScript, and event wiring.

Presentation-Interaction-Resolution paradigm:
- Presentation: component layout
- Interaction: user actions and validations
- Resolution: success/error outcomes with feedback

Available v2.0 patterns: add-entity-flow, edit-entity-flow, delete-entity-flow
For static layouts use get_pattern instead.`,
      inputSchema: {
        patternId: z.string().describe('"add-entity-flow" | "edit-entity-flow" | "delete-entity-flow"'),
        entityType: z.string().describe('Entity type (e.g. "User", "Device", "Task")'),
        entityName: z.string().optional().describe("Entity variable name (defaults to lowercase entityType)"),
        fields: z.array(z.object({
          name: z.string(),
          label: z.string(),
          type: z.string().optional(),
          required: z.boolean().optional(),
          placeholder: z.string().optional(),
        })).optional().describe("Form fields configuration"),
        customData: z.record(z.any()).optional().describe("Additional custom data for pattern"),
      },
    },
    async ({ patternId, entityType, entityName, fields, customData }) => {
      try {
        if (!V2_PATTERNS.includes(patternId)) {
          return ok(
            `Pattern "${patternId}" is not available in v2.0 format.\n\n` +
            `Available v2.0 patterns:\n` +
            `- add-entity-flow: Add flow with dialog, validation, feedback\n` +
            `- edit-entity-flow: Edit flow with pre-population\n` +
            `- delete-entity-flow: Delete flow with confirmation\n\n` +
            `For v1.0 static patterns use get_pattern.`
          );
        }

        const patternPath = path.join(patternsDir, "flows", `${patternId}.json`);
        if (!fs.existsSync(patternPath)) {
          return err(`Pattern definition not found: ${patternPath}`);
        }

        const pattern = JSON.parse(fs.readFileSync(patternPath, "utf8"));
        const eName = entityName || entityType.toLowerCase();

        let html = `<!-- Generated Pattern: ${pattern.name} -->\n<!-- Entity: ${entityType} -->\n\n`;
        for (const component of pattern.presentation.components) {
          html += generatePatternComponent(component, {
            entityType, entityName: eName, fields, ...customData,
          }) + "\n\n";
        }

        let js = `// Generated JavaScript for ${patternId} — Entity: ${entityType}\n\n`;
        js += `import { FlowManager } from 'sherpa-ui/components/app-utils/flow-manager.js';\n`;
        js += `import { FormManager } from 'sherpa-ui/components/app-utils/form-manager.js';\n\n`;
        const dialogComp = pattern.presentation.components.find((c) => c.type === "sherpa-dialog");
        js += `const dialog = document.getElementById('${dialogComp?.id ?? `${eName}-dialog`}');\n`;
        js += `const form = new FormManager(dialog);\n\n`;
        js += `// TODO: Implement ${patternId === "delete-entity-flow" ? "onDelete" : "onSave"} callback\n`;
        js += `// TODO: Wire up trigger button event listeners\n`;

        let output = `# Generated Pattern: ${pattern.name}\n\n`;
        output += `**Entity:** ${entityType} | **Version:** ${pattern.metadata?.version ?? "2.0"} | **Status:** ${pattern.metadata?.status ?? "stable"}\n\n`;
        output += `${pattern.description}\n\n---\n\n`;
        output += `## HTML\n\n\`\`\`html\n${html}\`\`\`\n\n---\n\n`;
        output += `## JavaScript\n\n\`\`\`javascript\n${js}\`\`\`\n\n---\n\n`;
        output += `## Next Steps\n\n`;
        output += `1. Copy the HTML into your application\n`;
        output += `2. Copy the JavaScript and implement the TODO callbacks\n`;
        output += `3. Wire up API calls for ${entityType} operations\n\n`;
        if (pattern.resolution?.success?.events?.length) {
          output += `## Events Dispatched\n`;
          for (const event of pattern.resolution.success.events) {
            output += `- \`${event}\`\n`;
          }
          output += "\n";
        }
        if (pattern.resolution?.success?.feedback || pattern.resolution?.error?.feedback) {
          output += `## Feedback\n`;
          if (pattern.resolution.success?.feedback?.message) {
            output += `- Success: "${pattern.resolution.success.feedback.message}"\n`;
          }
          if (pattern.resolution.error?.feedback?.message) {
            output += `- Error: "${pattern.resolution.error.feedback.message}"\n`;
          }
        }
        return ok(output);
      } catch (e) {
        return err(`generate_pattern: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "compose_view",
    {
      title: "Compose View",
      description: "Combine a layout pattern with component API references. Returns the layout HTML annotated with attribute/slot APIs for the components you'll customise.",
      inputSchema: {
        layoutPattern: z.string().describe('Layout pattern ID (e.g. "app-shell", "dashboard-grid")'),
        components: z.array(z.string()).optional()
          .describe("Component tag names whose APIs to inline as reference"),
        description: z.string().optional()
          .describe("Description of what this view should accomplish"),
      },
    },
    async ({ layoutPattern, components: componentList, description: desc }) => {
      try {
        const entry = patterns.get(layoutPattern);
        if (!entry) {
          const available = [...patterns.keys()].join(", ");
          return ok(`Unknown pattern "${layoutPattern}". Available: ${available}`);
        }

        const layoutPath = path.join(rootDir, entry.file);
        if (!fs.existsSync(layoutPath)) {
          return ok(`Pattern file not found: ${entry.file}`);
        }
        const layoutHTML = fs.readFileSync(layoutPath, "utf8");

        let result = desc ? `<!-- View: ${desc} -->\n\n` : "";
        result += `<!-- Layout pattern: ${entry.name} (${entry.id}) -->\n`;
        result += layoutHTML;

        if (componentList?.length) {
          result += "\n\n<!-- Component API reference:\n";
          for (const tag of componentList) {
            const schema = schemas.get(tag);
            if (!schema) continue;
            const attrs = (schema.attributes || []).map((a) => {
              const vals = a.enumValues ?? a.values;
              const valStr = vals?.length ? ` [${vals.join("|")}]` : "";
              const def = a.default != null ? ` = ${a.default}` : "";
              return `  ${a.name} {${a.type}}${def}${valStr}${a.description ? ` — ${a.description}` : ""}`;
            }).join("\n");
            const slots = (schema.slots || []).map((s) =>
              `  <slot${s.name ? ` name="${s.name}"` : ""}>: ${s.description || ""}`
            ).join("\n");
            result += `\n${tag}:\n`;
            if (attrs) result += `  Attributes:\n${attrs}\n`;
            if (slots) result += `  Slots:\n${slots}\n`;
            const templates = parseTemplateIds(tag, componentsDir);
            if (templates.length > 1) result += `  Templates: ${templates.join(", ")}\n`;
          }
          result += "\n-->";
        }
        return ok(result);
      } catch (e) {
        return err(`compose_view: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "generate_flow",
    {
      title: "Generate Flow",
      description: "Generate a complete CRUD flow (add/edit/delete) with trigger button, dialog, form fields, and JavaScript wiring for a given entity.",
      inputSchema: {
        flowType: z.enum(["add", "edit", "delete"]).describe("Flow type"),
        entityName: z.string().describe('Entity name (e.g. "device", "user", "policy")'),
        fields: z.array(z.object({
          name: z.string().describe("Field name (used as the name attribute)"),
          label: z.string().optional().describe("Field label (defaults to capitalised name)"),
          type: z.enum(["text", "select"]).optional().describe("Input type (defaults to text)"),
          required: z.boolean().optional(),
        })).optional().describe("Form fields for add/edit flows (ignored for delete)"),
      },
    },
    async ({ flowType, entityName, fields }) => {
      try {
        const html = generateFlowHTML(flowType, entityName, fields);
        const issues = validateUsage(html, schemas);

        let result = html;
        if (issues.length) {
          result += "\n\n<!-- Validation notes:\n";
          for (const issue of issues) {
            result += `  ${issue.severity}: ${issue.message}\n`;
          }
          result += "-->";
        }
        return ok(result);
      } catch (e) {
        return err(`generate_flow: ${e.message}`);
      }
    }
  );
}
