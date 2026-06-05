import { z } from "zod/v3";
import { parseExampleTemplates, readComponentSource } from "../lib/loader.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

export function register(server, { schemas }, { componentsDir }) {
  server.registerTool(
    "get_component_source",
    {
      title: "Get Component Source",
      description: "Read the canonical source file for a Sherpa UI component: HTML template, CSS, JS, examples, or README. Use this when the schema isn't enough — e.g. to inspect internal CSS custom properties, lifecycle hooks, or actual template structure.",
      inputSchema: {
        tagName: z.string().describe("Component tag name (e.g. sherpa-button)"),
        kind: z.enum(["html", "css", "js", "examples", "readme"])
          .describe("Which source file to read"),
      },
    },
    async ({ tagName, kind }) => {
      try {
        if (!schemas.has(tagName)) {
          return ok(`Unknown component: ${tagName}`);
        }
        const src = readComponentSource(tagName, kind, componentsDir);
        if (src == null) return ok(`No ${kind} file for ${tagName}`);
        return ok(src);
      } catch (e) {
        return err(`get_component_source: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "get_component_examples",
    {
      title: "Get Component Examples",
      description: "Return structured examples from a component's .examples.html file. Each example has { id, label, description, layout, preview, setup } and is guaranteed to use the current API. Use this BEFORE generate_component to follow proven authoring patterns.",
      inputSchema: {
        tagName: z.string().describe("Component tag name (e.g. sherpa-button)"),
        format: z.enum(["json", "raw"]).optional()
          .describe('"json" (default) returns parsed entries; "raw" returns the full .examples.html'),
      },
    },
    async ({ tagName, format }) => {
      try {
        const src = readComponentSource(tagName, "examples", componentsDir);
        if (src == null) {
          return ok(`No examples file for ${tagName} (expected ${tagName}.examples.html).`);
        }
        if (format === "raw") return ok(src);
        const examples = parseExampleTemplates(src);
        return ok(JSON.stringify({ tagName, count: examples.length, examples }, null, 2));
      } catch (e) {
        return err(`get_component_examples: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "list_component_examples",
    {
      title: "List Component Examples",
      description: "List every component that ships with a .examples.html file, with the count and labels of example blocks. Use this to discover documented usage patterns across the library.",
      inputSchema: {},
    },
    async () => {
      try {
        const rows = [];
        for (const tag of schemas.keys()) {
          const src = readComponentSource(tag, "examples", componentsDir);
          if (src == null) continue;
          const examples = parseExampleTemplates(src);
          rows.push({
            tagName: tag,
            count: examples.length,
            labels: examples.map((e) => e.label),
          });
        }
        return ok(JSON.stringify(rows, null, 2));
      } catch (e) {
        return err(`list_component_examples: ${e.message}`);
      }
    }
  );
}
