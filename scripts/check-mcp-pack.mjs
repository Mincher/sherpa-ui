#!/usr/bin/env node
/**
 * check-mcp-pack.mjs — the MCP as a user gets it: sherpa-ui and sherpa-ui-mcp
 * packed, installed into an empty folder, started the way a new app's
 * `.mcp.json` starts it, and every tool, resource and prompt called.
 * TRAP T-the-mcp-reads-sherpa-ui-through-one-door
 *
 *   npm run check:mcp-pack   needs ../Sherpa Starter, whose template says how an
 *                            app starts the MCP; the install uses the npm cache,
 *                            and the network for a file it lacks
 *
 * Map:
 * - SAMPLES — the arguments each tool or prompt is called with; one with none is a failure
 * - mcpGraph — every file the MCP imports, by its path here, and every outside package
 * - callEverything — every tool, resource and prompt a client reaches, called: the counts and the failures
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STARTER = resolve(ROOT, '..', 'Sherpa Starter');

/** The arguments each tool or prompt is called with; one with none is a failure. */
export const SAMPLES = {
  list_components: {},
  get_component: { name: 'sherpa-data-grid' },
  find_token: { query: 'surface' },
};

/** A static import or re-export at the start of a line: `import 'x'`, or `… from 'x'`. */
const IMPORT = /^(?:import|export)\s(?:[^'";]*?\sfrom\s)?['"]([^'"]+)['"]/gm;

/** Every file the MCP imports, by its path here, and every outside package. */
export function mcpGraph() {
  const local = new Set();
  const outside = new Set();
  const visit = (file) => {
    if (local.has(file) || !existsSync(file)) return;
    local.add(file);
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      if (spec.startsWith('.')) visit(resolve(dirname(file), spec));
      else if (!spec.startsWith('node:')) outside.add(spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/'));
    }
  };
  visit(join(ROOT, 'mcp-server', 'index.js'));
  return { files: [...local].map((f) => relative(ROOT, f)).sort(), outside: [...outside].sort() };
}

/** Every tool, resource and prompt a client reaches, called: the counts and the failures. */
export async function callEverything(client) {
  const failures = [];
  const said = (r) => r.content?.[0]?.text ?? '';
  const { tools } = await client.listTools();
  for (const tool of tools) {
    if (!SAMPLES[tool.name]) { failures.push(`${tool.name}: no arguments in SAMPLES to call it with`); continue; }
    const r = await client.callTool({ name: tool.name, arguments: SAMPLES[tool.name] })
      .catch((error) => ({ isError: true, content: [{ text: error.message }] }));
    if (r.isError || !said(r)) failures.push(`${tool.name}: ${said(r).slice(0, 100) || 'no answer'}`);
  }
  const { resources } = await client.listResources();
  for (const { uri } of resources) {
    const text = await client.readResource({ uri }).then((r) => r.contents[0]?.text ?? '', (error) => error);
    if (text instanceof Error) failures.push(`${uri}: ${text.message}`);
    else if (!text) failures.push(`${uri}: empty`);
  }
  // A template that lists nothing would never be read here.
  for (const { uriTemplate } of (await client.listResourceTemplates()).resourceTemplates) {
    if (!resources.some((r) => r.uri.startsWith(uriTemplate.split('{')[0]))) failures.push(`${uriTemplate}: lists no resource`);
  }
  const prompts = client.getServerCapabilities()?.prompts ? (await client.listPrompts()).prompts : [];
  for (const p of prompts) {
    if (!SAMPLES[p.name]) { failures.push(`prompt ${p.name}: no arguments in SAMPLES to get it with`); continue; }
    await client.getPrompt({ name: p.name, arguments: SAMPLES[p.name] }).catch((error) => failures.push(`prompt ${p.name}: ${error.message}`));
  }
  return { tools: tools.length, resources: resources.length, prompts: prompts.length, failures };
}

/** Pack both, install them into an empty folder, start the installed server as an app does and call everything. */
async function smoke() {
  // TRAP T-a-starter-is-one-folder
  const mcpJson = join(STARTER, 'template', 'mcp.json');
  if (!existsSync(mcpJson)) throw new Error(`no ${mcpJson}: a new app's .mcp.json says how it starts the MCP`);
  const [server] = Object.values(JSON.parse(readFileSync(mcpJson, 'utf8')).mcpServers);
  const work = mkdtempSync(join(tmpdir(), 'sherpa-mcp-pack-'));
  try {
    const pack = (cwd) => join(work, execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', work], { cwd, encoding: 'utf8' })
      .trim().split('\n').at(-1));
    const tarballs = [pack(ROOT), pack(join(ROOT, 'mcp-server'))];
    writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'probe', version: '1.0.0', private: true }));
    execFileSync('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund', ...tarballs], { cwd: work, stdio: 'pipe' });
    const sdk = (file) => import(pathToFileURL(join(work, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'esm', 'client', file)).href);
    const { Client } = await sdk('index.js');
    const { StdioClientTransport } = await sdk('stdio.js');
    const client = new Client({ name: 'check-mcp-pack', version: '1' });
    await client.connect(new StdioClientTransport({
      command: server.command === 'node' ? process.execPath : server.command, args: server.args, cwd: work, stderr: 'pipe',
    }));
    try {
      return await callEverything(client);
    } finally {
      await client.close();
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { tools, resources, prompts, failures } = await smoke();
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.log(`check-mcp-pack: ${tools} tools, ${resources} resources, ${prompts} prompts from the installed packages — ${failures.length} failure(s)`);
  process.exit(failures.length ? 1 : 0);
}
