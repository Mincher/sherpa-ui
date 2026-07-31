import { z } from "zod/v3";
import { generateComponentJSON } from "../lib/generators.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

export function register(server, { schemas }, { parseTemplateIds, componentsDir }) {
  server.registerTool(
    "query_component",
    {
      title: "Query Component",
      description: "Look up a Sherpa UI component's full API: attributes, slots, events, methods, properties. The returned JSON includes a `description` field with usage guidance — what the component is for, when to use it, key constraints, and what it composes with. Always read this field before writing component markup.",
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
      description: "List all Sherpa UI components with their usage descriptions, category, and API counts. The `description` field for each entry explains what the component is, when to use it, and key constraints — use it to identify the right component before calling query_component for the full API. Optionally filter by category.",
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
      description:
        "Generate an element JSON node (an ElementNode) for a Sherpa UI component. " +
        "Return shape: { type, props?, data?, slots?, children? }. Hand this to renderElement(node) " +
        "(components/utilities/render-element.ts) or el.populate(node.data) to render. `props` are " +
        "literal attributes (only known attrs are kept; booleans become true/omitted); `data` is the " +
        "component's populate() payload (see the component's `data` field from query_component for its " +
        "shape); `slots`/`children` hold nested ElementNodes. Values are carried raw (icon tokens are " +
        "NOT entity-encoded). This tool emits JSON, not HTML.",
      inputSchema: {
        tagName: z.string().describe("Component tag name (e.g. sherpa-button)"),
        attributes: z.record(z.union([z.string(), z.boolean(), z.number()]))
          .optional()
          .describe('Attribute key-value pairs → props, e.g. {"data-label": "Save", "data-variant": "primary"}'),
        data: z.any()
          .optional()
          .describe("populate() payload: an array (1-D collection), a keyed object ({rows,columns}/{steps}), or an HTML string. See the component's `data` shape from query_component."),
        slots: z.record(z.any())
          .optional()
          .describe('Named-slot fills: slot name → an ElementNode (or array of nodes).'),
        children: z.array(z.any())
          .optional()
          .describe("Default-slot content: an array of ElementNodes."),
        templateId: z.string().optional()
          .describe('Template variant (e.g. "icon", "button-menu"). Omit for the default template.'),
      },
    },
    async ({ tagName, attributes, data, slots, children, templateId }) => {
      try {
        const schema = schemas.get(tagName);
        if (!schema) return ok(`Unknown component: ${tagName}`);

        if (templateId) {
          const available = parseTemplateIds(tagName, componentsDir);
          if (available.length && !available.includes(templateId)) {
            return ok(`Unknown template "${templateId}" for ${tagName}. Available: ${available.join(", ")}`);
          }
        }

        const node = generateComponentJSON(schema, attributes || {}, data, slots, children);

        // Surface unknown attributes as notes so callers can correct them.
        const known = new Set((schema.attributes || []).map((a) => a.name));
        const dropped = Object.keys(attributes || {}).filter((n) => !known.has(n));

        const payload = { node };
        if (dropped.length) payload.notes = [`Dropped unknown attributes: ${dropped.join(", ")}`];
        if (templateId) payload.templateId = templateId;

        return ok(JSON.stringify(payload, null, 2));
      } catch (e) {
        return err(`generate_component: ${e.message}`);
      }
    }
  );
}
