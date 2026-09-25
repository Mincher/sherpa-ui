/**
 * logger.js — the MCP server's log, on STDERR.
 *
 * STDOUT is the stdio transport: a single stray line there corrupts the
 * JSON-RPC stream, so everything the server says goes to stderr.
 *
 * Map:
 * - log — info / warn / error, timestamped, to stderr
 */
const ts = () => new Date().toISOString();
export const log = {
  info:  (msg) => process.stderr.write(`[sherpa-mcp] INFO  ${ts()} ${msg}\n`),
  warn:  (msg) => process.stderr.write(`[sherpa-mcp] WARN  ${ts()} ${msg}\n`),
  error: (msg) => process.stderr.write(`[sherpa-mcp] ERROR ${ts()} ${msg}\n`),
};
