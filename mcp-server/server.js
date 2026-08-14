/**
 * Sherpa UI MCP server — the def-driven design-system surface.
 *
 * The def (`<name>.def.json`) is the hub; the tools are thin wrappers over the
 * shared generation lib (scripts/lib/generation/*) — one implementation, two
 * surfaces (this MCP + the generate-sherpa-component skill).
 *
 *   Discover  list_components · explain_token · browse_ontology · get_component
 *   Generate  scaffold_def · validate_def · compile_def · token_for
 *   Verify    audit_component · check_bindings
 *   Resources sherpa://def/{name} · sherpa://ontology/{id}
 *             · sherpa://component/{name}/{ts|html|css|def} · sherpa://rules
 *   Prompts   generate_component · review_component_usage · debug_component
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { log } from "./lib/logger.js";
import { register as registerDiscoverTools } from "./tools/discover.js";
import { register as registerGenerateTools } from "./tools/generate.js";
import { register as registerVerifyTools }   from "./tools/verify.js";
import { register as registerResources }     from "./resources/index.js";
import { register as registerPrompts }       from "./prompts/index.js";

export async function createServer() {
  const startTime = Date.now();
  log.info("Starting Sherpa UI MCP server (def-driven)…");

  const server = new McpServer(
    { name: "sherpa-ui", version: "3.0.0" },
    { capabilities: { resources: {}, tools: {}, prompts: {} } }
  );

  // Tools — thin wrappers over scripts/lib/generation/*. They load their own
  // reference data (ontology, defs, name-map) via the shared cached loaders.
  registerDiscoverTools(server);
  registerGenerateTools(server);
  registerVerifyTools(server);

  // Resources + prompts
  registerResources(server);
  registerPrompts(server);

  log.info(`Server ready — ${Date.now() - startTime}ms startup`);
  return server;
}
