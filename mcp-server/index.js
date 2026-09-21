#!/usr/bin/env node
/**
 * Sherpa UI MCP Server — stdio entry point. Run with `npm run mcp`.
 * Capabilities are registered in server.js; tools live in tools/, resources in
 * resources/, prompts in prompts/.
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
