#!/usr/bin/env node
/**
 * Sherpa UI MCP Server — entry point
 *
 * Transport: stdio (launched by AI clients, not used directly in a browser).
 * All capabilities are registered in server.js. Tools are thin wrappers over
 * the shared generation lib (scripts/lib/generation/*).
 *
 * To add a tool: edit tools/{discover,generate,verify}.js.
 * To add a resource: edit resources/index.js.
 * To add a prompt: edit prompts/index.js.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { log } from "./lib/logger.js";

try {
  const server    = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("Connected on stdio — ready");
} catch (e) {
  log.error(`Fatal startup error: ${e.message}\n${e.stack}`);
  process.exit(1);
}
