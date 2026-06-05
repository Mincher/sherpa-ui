import { z } from "zod/v3";
import { generateComponentHTML } from "../lib/generators.js";
import { validateUsage } from "../lib/validation.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

export function register(server, { schemas }, { parseTemplateIds, componentsDir }) {
  server.registerTool(
    "query_component",
    {
      title: "Query Component",
      description: "Look up a Sherpa UI component's full API: attributes, slots, events, methods, properties. Returns schema JSON plus links to source resources.",
      inputSchema: {
        tagName: z.string().describe("Component tag name (e.g. sherpa-button)"),
      },
    },
    async ({ tagName }) => {
      try {
        const schema = schemas.get(tagName);
        if (!schema) {
          const available = [...schemas.keys()].join(", ");
          return ok(`Component "${tagName}" not found.\n\nAvailable: ${available}`);
        }

        const result = { ...schema };

        const templateIds = parseTemplateIds(tagName, componentsDir);
        if (templateIds.length > 0) result.templates = templateIds;

        result.sources = {
          schema:   `sherpa://schema/${tagName}`,
          html:     `sherpa://template/${tagName}`,
          css:      `sherpa://component/${tagName}/css`,
          js:       `sherpa://component/${tagName}/js`,
          examples: `sherpa://component/${tagName}/examples`,
          readme:   `sherpa://component/${tagName}/readme`,
        };

        return ok(JSON.stringify(result, null, 2));
      } catch (e) {
        return err(`query_component: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "list_components",
    {
      title: "List Components",
      description: "List all Sherpa UI components with summary info (tag, description, category, attribute/slot/event counts). Optionally filter by category.",
      inputSchema: {
        category: z.string().optional().describe(
          "Filter by category: core, layout, navigation, form, data-display, data-viz, feedback, page-level"
        ),
      },
    },
    async ({ category }) => {
      try {
        let components = [...schemas.values()];
        if (category) {
          components = components.filter(
            (c) => c.group === category || c.category === category
          );
        }
        const list = components.map((c) => ({
          tagName:    c.tagName,
          description: c.description,
          category:   c.category,
          attributes: c.attributes?.length ?? 0,
          slots:      c.slots?.length ?? 0,
          events:     c.events?.length ?? 0,
        }));
        return ok(JSON.stringify(list, null, 2));
      } catch (e) {
        return err(`list_components: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "generate_component",
    {
      title: "Generate Component",
      description: "Generate valid HTML markup for a Sherpa UI component. Only known attributes are emitted; boolean attributes render without values; icon names are converted to unicode entities.",
      inputSchema: {
        tagName: z.string().describe("Component tag name (e.g. sherpa-button)"),
        attributes: z.record(z.union([z.string(), z.boolean(), z.number()]))
          .optional()
          .describe('Attribute key-value pairs, e.g. {"data-label": "Save", "data-variant": "primary"}'),
        slots: z.record(z.string())
          .optional()
          .describe('Slot content map. Use "" or "default" for the default slot.'),
        templateId: z.string().optional()
          .describe('Template variant (e.g. "icon", "button-menu"). Omit for the default template.'),
      },
    },
    async ({ tagName, attributes, slots, templateId }) => {
      try {
        const schema = schemas.get(tagName);
        if (!schema) return ok(`Unknown component: ${tagName}`);

        if (templateId) {
          const available = parseTemplateIds(tagName, componentsDir);
          if (available.length && !available.includes(templateId)) {
            return ok(`Unknown template "${templateId}" for ${tagName}. Available: ${available.join(", ")}`);
          }
        }

        const html = generateComponentHTML(schema, attributes || {}, slots || {});
        const issues = validateUsage(html, schemas);

        let response = templateId ? `<!-- template: ${templateId} -->\n` : "";
        response += html;
        if (issues.length) {
          response += "\n\n<!-- Validation notes:\n";
          for (const issue of issues) {
            response += `  ${issue.severity}: ${issue.message}\n`;
          }
          response += "-->";
        }
        return ok(response);
      } catch (e) {
        return err(`generate_component: ${e.message}`);
      }
    }
  );
}
