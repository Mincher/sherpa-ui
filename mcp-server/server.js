/**
 * server.js — the MCP server: every module that registers, in tier order.
 * The read and check tiers are here; query, compose, see and run add their
 * modules to MODULES (plan 700 §5), and `npm run check:mcp` writes the README from it.
 *
 * Map:
 * - MODULES — every module that registers tools, resources or prompts, by its path in this package
 * - createServer — an MCP server with every module registered
 */
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as readTools from './tools/read.js';
import * as readResources from './resources/read.js';
import * as checkTools from './tools/check.js';
import * as queryTools from './tools/query.js';
import * as queryResources from './resources/query.js';
import * as composeTools from './tools/compose.js';
import * as seeTools from './tools/see.js';

/** Every module that registers tools, resources or prompts, by its path in this package. */
export const MODULES = {
  'tools/read.js': readTools,
  'resources/read.js': readResources,
  'tools/check.js': checkTools,
  'tools/query.js': queryTools,
  'resources/query.js': queryResources,
  'tools/compose.js': composeTools,
  'tools/see.js': seeTools,
};

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** An MCP server with every module registered. */
export function createServer() {
  const server = new McpServer({ name: 'sherpa-ui', version });
  for (const mod of Object.values(MODULES)) mod.register(server);
  return server;
}
