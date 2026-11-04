/**
 * server.js — the MCP server: every module that registers, in tier order.
 * The read tier is here; check, query, compose, see and run add their modules
 * to MODULES (plan 700 §5), and `npm run check:mcp` writes the README from it.
 *
 * Map:
 * - MODULES — every module that registers tools, resources or prompts, by its path in this package
 * - createServer — an MCP server with every module registered
 */
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as readTools from './tools/read.js';
import * as readResources from './resources/read.js';
import * as queryTools from './tools/query.js';
import * as queryResources from './resources/query.js';

/** Every module that registers tools, resources or prompts, by its path in this package. */
export const MODULES = {
  'tools/read.js': readTools,
  'resources/read.js': readResources,
  'tools/query.js': queryTools,
  'resources/query.js': queryResources,
};

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** An MCP server with every module registered. */
export function createServer() {
  const server = new McpServer({ name: 'sherpa-ui', version });
  for (const mod of Object.values(MODULES)) mod.register(server);
  return server;
}
