import { z } from "zod/v3";
import { validateUsage } from "../lib/validation.js";
import { readDoc } from "../lib/loader.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

const SERVER_VERSION = "2.0.0";

const ALL_TOOLS = [
  "query_component", "list_components", "generate_component",
  "get_component_source", "get_component_examples", "list_component_examples",
  "browse_tokens", "list_token_groups", "get_token_value",
  "list_patterns", "get_pattern", "generate_pattern", "compose_view", "generate_flow",
  "list_utilities", "get_utility", "list_css_utilities", "get_css_utility",
  "search_api", "suggest_components",
  "get_architecture", "validate_usage", "server_info",
];

export function register(server, { schemas, tokens, patterns, utilities, cssUtilities, startTime }, paths) {
  const { docsDir, cssDir, copilotPath } = paths;

  server.registerTool(
    "server_info",
    {
      title: "Server Info",
      description: "Return metadata about the Sherpa UI MCP server: library stats, loaded data counts, server version, and a list of all available tools.",
      inputSchema: {},
    },
    async () => {
      try {
        const uptime = Date.now() - startTime;
        const info = {
          server:     "sherpa-ui",
          version:    SERVER_VERSION,
          uptimeMs:   uptime,
          library: {
            components:    schemas.size,
            tokens:        tokens.length,
            patterns:      patterns.size,
            utilities:     utilities.size,
            cssUtilities:  cssUtilities.size,
          },
          tools:      ALL_TOOLS,
          toolCount:  ALL_TOOLS.length,
          resources: [
            "sherpa://guidelines/{slug}",
            "sherpa://schema/{tagName}",
            "sherpa://template/{tagName}",
            "sherpa://component/{tagName}/{css|js|examples|readme}",
            "sherpa://utility/{id}",
            "sherpa://pattern/{patternId}",
            "sherpa://css-utility/{className}",
          ],
          prompts: ["build_ui", "review_component_usage", "create_component", "debug_component"],
        };
        return ok(JSON.stringify(info, null, 2));
      } catch (e) {
        return err(`server_info: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "validate_usage",
    {
      title: "Validate Usage",
      description: "Schema-aware audit of component HTML. Checks for: unknown components, unknown or incorrectly-valued attributes (enum validation), self-closing custom elements, and opacity-based disabled patterns.",
      inputSchema: {
        html: z.string().describe("HTML string containing Sherpa UI components to validate"),
      },
    },
    async ({ html }) => {
      try {
        const issues = validateUsage(html, schemas);
        if (!issues.length) return ok("✓ No issues found.");

        let result = `Found ${issues.length} issue(s):\n\n`;
        const errors   = issues.filter((i) => i.severity === "error");
        const warnings = issues.filter((i) => i.severity === "warning");
        for (const issue of [...errors, ...warnings]) {
          result += `${issue.severity.toUpperCase()}: ${issue.message}\n`;
        }
        return ok(result);
      } catch (e) {
        return err(`validate_usage: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "get_architecture",
    {
      title: "Get Architecture Overview",
      description: "Return the canonical architecture rules for the Sherpa UI library: layer separation (HTML/CSS/JS), SherpaElement base class lifecycle, data-* attribute patterns, cloning-template pattern, and CRUD flow composition. Read once at the start of any non-trivial task.",
      inputSchema: {},
    },
    async () => {
      try {
        const copilot = readDoc("copilot-instructions.md", docsDir, cssDir, copilotPath);
        if (copilot) {
          return ok("# Sherpa UI — Architecture & Coding Rules\n\n" + copilot);
        }

        // Fallback: synthesise a minimal summary from available docs
        const apiStandard = readDoc("COMPONENT-API-STANDARD.md", docsDir, cssDir, copilotPath);
        if (apiStandard) {
          return ok("# Sherpa UI — Component API Standard\n\n" + apiStandard);
        }

        return ok(
          "# Sherpa UI Architecture\n\n" +
          "Architecture document not found (expected .github/copilot-instructions.md).\n\n" +
          "Key rules:\n" +
          "- HTML/CSS/JS are in separate files per component\n" +
          "- All custom attributes use data-* prefix\n" +
          "- CSS controls visibility via :host([data-*]) — never JS .hidden toggling\n" +
          "- Custom events: bubbles: true, composed: true\n" +
          "- All custom elements need explicit closing tags\n" +
          "- Use semantic --sherpa-* design tokens with hardcoded fallbacks\n" +
          "- CRUD flows: FlowManager + FormManager in app-utils/"
        );
      } catch (e) {
        return err(`get_architecture: ${e.message}`);
      }
    }
  );
}
