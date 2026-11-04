#!/usr/bin/env node
/**
 * index.js — the MCP server on stdio: `npm run mcp` in a checkout, or
 * `node node_modules/sherpa-ui-mcp/index.js` in an app. Stdout is the
 * transport, so a failure is said on stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

try {
  await createServer().connect(new StdioServerTransport());
} catch (error) {
  process.stderr.write(`sherpa-ui-mcp: ${error.stack ?? error}\n`);
  process.exit(1);
}
