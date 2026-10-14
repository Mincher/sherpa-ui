#!/usr/bin/env node
/**
 * check-mcp-pack.mjs — the MCP as a user gets it: its three packages packed,
 * installed into an empty folder, and every tool, resource and prompt called.
 * TRAP T-the-mcp-reads-sherpa-ui-through-one-door
 *
 *   npm run check:mcp-pack     needs dist/ — npm run build first; the install
 *                              uses the npm cache, and the network for a file it lacks
 *
 * Map:
 * - READS — the sherpa-ui files the MCP reads from disk, beside the code it imports
 * - mcpGraph — every sherpa-ui file the MCP imports, and every outside package
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STARTER = resolve(ROOT, '..', 'Sherpa Starter');

/** The sherpa-ui files the MCP reads from disk, beside the code it imports. */
export const READS = [
  'dist/data.js',
  'schemas/component.v1.json', 'schemas/page.v1.json', 'schemas/app.v1.json',
  'docs/APP-GUIDE.md', 'docs/DATA-SOURCE-RULES.md', 'docs/DEF-TO-FIGMA-BUILD-RULES.md',
  'scripts/figma-data/name-map.yaml',
  'src/styles/tokens/tokens.css',
  'src/components/sherpa-button/sherpa-button.component.json',
  'src/components/sherpa-button/sherpa-button.ts',
];

const IMPORT = /(?:import|export)\s*(?:[^'"`;]*?\bfrom\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const SHERPA_LIB = /lib\("([^"]+)"\)/g;

/** Every sherpa-ui file the MCP imports, and every outside package. */
export function mcpGraph() {
  const local = new Set();
  const outside = new Set();
  const visit = (file) => {
    if (local.has(file) || !existsSync(file)) return;
    local.add(file);
    const src = readFileSync(file, 'utf8');
    for (const [, a, b] of src.matchAll(IMPORT)) {
      const spec = a ?? b;
      if (spec.startsWith('.')) visit(resolve(dirname(file), spec));
      else if (!spec.startsWith('node:') && !['fs', 'path', 'url'].includes(spec)) {
        outside.add(spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/'));
      }
    }
    // lib/sherpa.js reaches sherpa-ui's generation lib by path, not by import.
    for (const [, name] of src.matchAll(SHERPA_LIB)) visit(join(ROOT, 'scripts', 'lib', 'generation', name));
  };
  visit(join(ROOT, 'mcp-server', 'index.js'));
  const files = [...local].map((f) => relative(ROOT, f));
  return {
    mcp: files.filter((f) => f.startsWith('mcp-server/')).sort(),
    sherpa: files.filter((f) => !f.startsWith('mcp-server/')).sort(),
    outside: [...outside].sort(),
  };
}

/** Pack, install into an empty folder, start the installed server and call everything. */
async function smoke() {
  if (!existsSync(join(ROOT, 'dist', 'data.js'))) throw new Error('no dist/ — run npm run build first');
  const work = mkdtempSync(join(tmpdir(), 'sherpa-mcp-pack-'));
  try {
    // The MCP's own prepack makes its vendor/ copy; sherpa-ui's scripts stay off.
    const pack = (cwd, scripts = false) => execFileSync('npm', ['pack', ...(scripts ? [] : ['--ignore-scripts']), '--pack-destination', work], { cwd, encoding: 'utf8' })
      .trim().split('\n').at(-1);
    // scaffold_app's template is create-sherpa-ui's, the sibling project. TRAP T-a-starter-is-one-folder
    if (!existsSync(STARTER)) throw new Error(`no ${STARTER} — scaffold_app reads create-sherpa-ui from there`);
    const tarballs = [pack(ROOT), pack(join(ROOT, 'mcp-server'), true), pack(STARTER)].map((t) => join(work, t));
    writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'probe', version: '1.0.0', private: true }));
    execFileSync('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund', ...tarballs], { cwd: work, stdio: 'pipe' });
    const at = (p) => pathToFileURL(join(work, 'node_modules', p)).href;
    const { Client } = await import(at('@modelcontextprotocol/sdk/dist/esm/client/index.js'));
    const { StdioClientTransport } = await import(at('@modelcontextprotocol/sdk/dist/esm/client/stdio.js'));
    const client = new Client({ name: 'check-mcp-pack', version: '1' });
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [join(work, 'node_modules', 'sherpa-ui-mcp', 'index.js')], cwd: work, stderr: 'pipe',
    }));
    const failures = [];
    const { tools } = await client.listTools();
    for (const tool of tools) {
      // These two launch a browser against a page; the rest answer from files.
      if (tool.name === 'call_component' || tool.name === 'read_component') continue;
      const args = {};
      for (const key of tool.inputSchema?.required ?? []) args[key] = tool.inputSchema.properties[key]?.type === 'number' ? 1 : 'sherpa-button';
      try {
        const r = await client.callTool({ name: tool.name, arguments: args });
        if (!r.content?.length) failures.push(`${tool.name}: no answer`);
        else if (tool.name === 'scaffold_app' && !r.content[0].text.includes('### `index.html`')) failures.push(`scaffold_app: ${r.content[0].text.slice(0, 80)}`);
      } catch (error) {
        failures.push(`${tool.name}: ${error.message}`);
      }
    }
    const { resources } = await client.listResources();
    for (const uri of [...resources.map((r) => r.uri), 'sherpa://def/sherpa-button']) {
      const text = (await client.readResource({ uri })).contents[0]?.text ?? '';
      if (!text || /not found\)/.test(text.slice(0, 80))) failures.push(`${uri}: ${text.slice(0, 60) || 'empty'}`);
    }
    const { prompts } = await client.listPrompts();
    for (const p of prompts) {
      const args = Object.fromEntries((p.arguments ?? []).filter((a) => a.required).map((a) => [a.name, 'sherpa-button']));
      try {
        await client.getPrompt({ name: p.name, arguments: args });
      } catch (error) {
        failures.push(`prompt ${p.name}: ${error.message}`);
      }
    }
    await client.close();
    return { tools: tools.length, resources: resources.length, prompts: prompts.length, failures };
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
