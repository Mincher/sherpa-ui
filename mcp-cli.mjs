#!/usr/bin/env node
/**
 * mcp-cli.mjs — Tiny stdio client for the Sherpa UI MCP server.
 *
 * Spawns the server, performs the JSON-RPC initialize handshake, then sends
 * a single tools/call request and prints the result. Designed for one-shot
 * scripted use from a shell — not a persistent session.
 *
 * Usage:
 *   node mcp-cli.mjs <tool-name> '<json-args>'
 *   node mcp-cli.mjs list_components
 *   node mcp-cli.mjs query_component '{"tagName":"sherpa-button"}'
 *   node mcp-cli.mjs generate_component '{"tagName":"sherpa-metric","attributes":{"data-label":"Revenue","value":"$1.24M"}}'
 *
 * The server writes its log lines to stderr — they're preserved so callers can
 * still see [sherpa-mcp] INFO / WARN output alongside the tool result.
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, "mcp-server", "index.js");

// When this script is launched via a node binary that lives outside the
// default $PATH (e.g. inside a container overlay), child processes spawned
// with the bare name "node" can't find it. Detect our own executable and
// forward that to the child.
const NODE_BIN = process.execPath;

const [, , toolName, argsJson] = process.argv;
if (!toolName) {
  console.error("Usage: node mcp-cli.mjs <tool-name> [json-args]");
  process.exit(2);
}

const args = (() => {
  if (!argsJson) return {};
  try { return JSON.parse(argsJson); }
  catch (e) {
    console.error("Invalid JSON args:", e.message);
    process.exit(2);
  }
})();

const child = spawn(NODE_BIN, [SERVER_PATH], { stdio: ["pipe", "pipe", "inherit"] });

let nextId = 1;
const pending = new Map();
let buffer = "";

function send(method, params, isNotification = false) {
  const msg = { jsonrpc: "2.0", method };
  if (!isNotification) msg.id = nextId++;
  if (params !== undefined) msg.params = params;
  child.stdin.write(JSON.stringify(msg) + "\n");
  if (isNotification) {
    // Notifications don't carry a response, but we still need to return
    // a resolved promise so callers can `await` uniformly.
    return Promise.resolve(null);
  }
  return new Promise((resolveP, rejectP) => {
    pending.set(msg.id, { resolve: resolveP, reject: rejectP });
  });
}

child.stdout.setEncoding("utf8");
child.stdout.on("data", chunk => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let parsed;
    try { parsed = JSON.parse(line); }
    catch { continue; }
    if (parsed.id != null && pending.has(parsed.id)) {
      const { resolve: r, reject: j } = pending.get(parsed.id);
      pending.delete(parsed.id);
      if (parsed.error) j(new Error(`${parsed.error.message} (code ${parsed.error.code})`));
      else r(parsed.result);
    }
  }
});

child.on("exit", code => {
  if (pending.size) {
    console.error(`Server exited (code ${code}) with ${pending.size} pending request(s)`);
    for (const { reject } of pending.values()) reject(new Error("Server exited"));
  }
});

try {
  // 1. Initialize
  const initResult = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "mcp-cli", version: "1.0.0" },
  });
  if (initResult.protocolVersion) {
    /* handshake OK */
  }

  // 2. Acknowledge
  await send("notifications/initialized", {}, true);

  // 3. Call the tool
  const result = await send("tools/call", {
    name: toolName,
    arguments: args,
  });

  // Result is { content: [{ type: "text", text: "..." }], isError?: bool }
  for (const item of result.content ?? []) {
    if (item.type === "text") process.stdout.write(item.text);
    else process.stdout.write(JSON.stringify(item));
  }
  process.stdout.write("\n");

  // 4. Hard-exit — the stdio transport doesn't always shut down cleanly on
  //    end(), and we don't need the server alive for a one-shot call.
  child.kill();
  process.exit(result.isError ? 1 : 0);
} catch (err) {
  console.error("\n[cli] error:", err.message);
  child.kill();
  process.exit(1);
}
