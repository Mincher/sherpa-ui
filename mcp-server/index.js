#!/usr/bin/env node
/**
 * Sherpa UI MCP Server — entry point
 *
 * Transport: stdio (launched by AI clients, not used directly in a browser).
 * All capabilities are registered in server.js; data loading in lib/loader.js.
 *
 * To add a tool: edit the appropriate file under tools/.
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
