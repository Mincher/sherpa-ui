import fs from "fs";
import { z } from "zod/v3";
import { extractJsdocSummary, readUtilitySource } from "../lib/loader.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

export function register(server, { utilities, cssUtilities }) {
  server.registerTool(
    "list_utilities",
    {
      title: "List Utilities",
      description: "List utility modules under components/utilities/ and components/app-utils/ — FlowManager, FormManager, ThemeManager, formatters, mixins, base classes. Each entry supports get_utility for source access.",
      inputSchema: {},
    },
    async () => {
      try {
        if (!utilities.size) return ok("No utilities found.");
        const entries = [...utilities.values()].sort((a, b) => a.id.localeCompare(b.id));
        let out = `Found ${entries.length} utility module(s):\n\n`;
        for (const u of entries) {
          const jsPath = u.files.js ?? u.files.ts;
          const summary = jsPath
            ? extractJsdocSummary(fs.readFileSync(jsPath, "utf8"))
            : "";
          const exts = Object.keys(u.files).join(", ");
          out += `- **${u.id}** (${exts})`;
          if (summary) out += ` — ${summary}`;
          out += "\n";
        }
        return ok(out);
      } catch (e) {
        return err(`list_utilities: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "get_utility",
    {
      title: "Get Utility Source",
      description: "Read the source file for a utility module by ID (e.g. 'flow-manager', 'form-manager', 'sherpa-element'). Defaults to JS/TS; pass kind='css' or 'html' for utilities with those files.",
      inputSchema: {
        id: z.string().describe("Utility ID (e.g. 'flow-manager', 'format-utils', 'sherpa-element')"),
        kind: z.enum(["js", "ts", "css", "html"]).optional()
          .describe("File type to read (defaults to js/ts)"),
      },
    },
    async ({ id, kind }) => {
      try {
        const src = readUtilitySource(id, kind || "js", utilities);
        if (src == null) {
          const available = [...utilities.keys()].join(", ");
          return ok(`Unknown utility "${id}" (or no ${kind || "js/ts"} file). Available: ${available}`);
        }
        return ok(src);
      } catch (e) {
        return err(`get_utility: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "list_css_utilities",
    {
      title: "List CSS Utilities",
      description: "List CSS utility classes available in sherpa-utility-classes.css (e.g. flex-truncate). These are plain CSS classes applied to HTML elements — not web components.",
      inputSchema: {},
    },
    async () => {
      try {
        if (!cssUtilities.size) return ok("No CSS utilities found.");
        const entries = [...cssUtilities.values()];
        let out = `Found ${entries.length} CSS utility class(es):\n\n`;
        for (const u of entries) {
          out += `- **${u.className}** — ${u.description}\n`;
          const attrs = (u.attributes || []).map((a) => a.name).join(", ") || "none";
          const props = (u.cssProperties || []).map((p) => p.name).join(", ") || "none";
          out += `  CSS attrs: ${attrs} | CSS properties: ${props}\n`;
        }
        out += "\nUse get_css_utility for the full schema and usage examples.";
        return ok(out);
      } catch (e) {
        return err(`list_css_utilities: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "get_css_utility",
    {
      title: "Get CSS Utility",
      description: "Get the full schema, attributes, CSS custom properties, usage notes and examples for a CSS utility class (e.g. flex-truncate).",
      inputSchema: {
        className: z.string().describe("CSS utility class name (e.g. 'flex-truncate')"),
      },
    },
    async ({ className }) => {
      try {
        const util = cssUtilities.get(className);
        if (!util) {
          const available = [...cssUtilities.keys()].join(", ");
          return ok(`Unknown CSS utility "${className}". Available: ${available}`);
        }
        return ok(JSON.stringify(util, null, 2));
      } catch (e) {
        return err(`get_css_utility: ${e.message}`);
      }
    }
  );
}
