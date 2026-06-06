#!/usr/bin/env node
/**
 * Token Studio — local HTTP server
 *
 * Usage: node tools/token-studio/server.js [--open]
 *   or:  npm run tokens:studio
 *
 * Port: 3001
 */

import http    from 'http';
import fs      from 'fs';
import path    from 'path';
import { spawn, execFile } from 'child_process';
import { fileURLToPath }   from 'url';

import { parseCSS }           from './lib/css-parser.js';
import { buildResolutionMap, resolve } from './lib/resolver.js';
import { diff }               from './lib/differ.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '../..');
const PORT      = 3001;
const OPEN      = process.argv.includes('--open');

// ── Paths ────────────────────────────────────────────────────────────

const PATHS = {
  currentVars:  path.join(ROOT, 'figma-tokens', 'figma-variables.json'),
  stagedVars:   path.join(ROOT, 'figma-tokens', 'figma-variables.staged.json'),
  configFile:   path.join(ROOT, 'figma-tokens', 'figma-config.json'),
  cssStyles:    path.join(ROOT, 'css', 'styles'),
  components:   path.join(ROOT, 'components'),
  distComp:     path.join(ROOT, 'dist', 'components'),
  extractor:    path.join(ROOT, 'scripts', 'extract-figma-vars.js'),
  generator:    path.join(ROOT, 'scripts', 'generate-css-tokens.js'),
  indexHtml:    path.join(__dirname, 'index.html'),
};

// Generated CSS files the chain explorer covers
const GENERATED_CSS_FILES = [
  'tokens/primitives.css',
  'tokens/sherpa-alias.css',
  'tokens/sherpa-platform.css',
  'sherpa-themes.css',
  'sherpa-overrides.css',
];

// ── CSS file cache ───────────────────────────────────────────────────

let resolutionMap = new Map();
let cssFileIndex  = [];  // [{ path, label, group }]

function buildCssIndex() {
  const generated = GENERATED_CSS_FILES
    .filter(f => fs.existsSync(path.join(PATHS.cssStyles, f)))
    .map(f => ({ path: f, label: path.basename(f), group: 'Generated CSS' }));

  const components = [];
  try {
    const dirs = fs.readdirSync(PATHS.components);
    for (const dir of dirs.sort()) {
      const cssFile = path.join(PATHS.components, dir, `${dir}.css`);
      if (fs.existsSync(cssFile)) {
        components.push({
          path: `@components/${dir}/${dir}.css`,
          label: `${dir}.css`,
          group: 'Components',
        });
      }
    }
  } catch { /* components dir may not exist */ }

  cssFileIndex = [...generated, ...components];
  return cssFileIndex;
}

function resolveFilePath(virtualPath) {
  if (virtualPath.startsWith('@components/')) {
    return path.join(PATHS.components, virtualPath.slice('@components/'.length));
  }
  return path.join(PATHS.cssStyles, virtualPath);
}

function rebuildResolutionMap() {
  const parsed = [];
  for (const { path: vPath } of cssFileIndex) {
    const abs = resolveFilePath(vPath);
    if (!fs.existsSync(abs)) continue;
    try {
      const css = fs.readFileSync(abs, 'utf8');
      parsed.push(parseCSS(css, vPath));
    } catch { /* skip unparseable files */ }
  }
  resolutionMap = buildResolutionMap(parsed);
  return resolutionMap;
}

// ── SSE ──────────────────────────────────────────────────────────────

const sseClients = new Set();

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

// ── Active child process ─────────────────────────────────────────────

let activeChild = null;

function spawnScript(scriptPath, env = {}) {
  if (activeChild) activeChild.kill();
  activeChild = spawn(process.execPath, [scriptPath], {
    cwd: ROOT,
    env: { ...process.env, ...env },
  });

  activeChild.stdout.on('data', d => broadcast({ type: 'log', text: d.toString() }));
  activeChild.stderr.on('data', d => broadcast({ type: 'log', text: d.toString() }));
  activeChild.on('close', code => {
    broadcast({ type: 'done', code });
    activeChild = null;
  });
  return activeChild;
}

// ── Request helpers ──────────────────────────────────────────────────

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function err(res, msg, status = 500) {
  json(res, { error: msg }, status);
}

function mimeType(ext) {
  return ({
    '.js': 'text/javascript', '.css': 'text/css',
    '.html': 'text/html',     '.json': 'application/json',
    '.woff2': 'font/woff2',   '.woff': 'font/woff',
  })[ext] || 'application/octet-stream';
}

function serveFile(res, absPath) {
  if (!fs.existsSync(absPath)) { err(res, 'Not found', 404); return; }
  const ext = path.extname(absPath);
  res.writeHead(200, { 'Content-Type': mimeType(ext) });
  fs.createReadStream(absPath).pipe(res);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function body(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

// ── Route handlers ───────────────────────────────────────────────────

function handleStatus(res) {
  const currentExists = fs.existsSync(PATHS.currentVars);
  const stagedExists  = fs.existsSync(PATHS.stagedVars);
  let lastExtracted = null;
  if (currentExists) {
    try {
      const d = readJson(PATHS.currentVars);
      lastExtracted = d?.meta?.date ?? null;
    } catch { /* ignore */ }
  }
  json(res, {
    lastExtracted,
    stagedExists,
    hasToken: !!process.env.FIGMA_ACCESS_TOKEN,
    cssFilesLoaded: cssFileIndex.length,
    tokensMapped: resolutionMap.size,
  });
}

function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(': connected\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

function handleExtract(res) {
  if (!process.env.FIGMA_ACCESS_TOKEN) {
    err(res, 'FIGMA_ACCESS_TOKEN not set', 400); return;
  }
  json(res, { started: true });
  broadcast({ type: 'start', stage: 'extract' });
  spawnScript(PATHS.extractor, { FIGMA_VARIABLES_OUT: PATHS.stagedVars });
}

function handleDiff(res) {
  const current = readJson(PATHS.currentVars);
  const staged  = readJson(PATHS.stagedVars);
  if (!staged) { err(res, 'No staged data. Run Pull first.', 404); return; }
  json(res, diff(current, staged));
}

function handleApply(res) {
  if (!fs.existsSync(PATHS.stagedVars)) {
    err(res, 'No staged data to apply.', 400); return;
  }
  // Promote staged → current
  fs.copyFileSync(PATHS.stagedVars, PATHS.currentVars);
  fs.unlinkSync(PATHS.stagedVars);
  json(res, { started: true });
  broadcast({ type: 'start', stage: 'generate' });
  const child = spawnScript(PATHS.generator);
  child.on('close', code => {
    if (code === 0) {
      // Rebuild CSS cache with new files
      rebuildResolutionMap();
      broadcast({ type: 'applied' });
    }
  });
}

function handleCancelStaged(res) {
  if (fs.existsSync(PATHS.stagedVars)) fs.unlinkSync(PATHS.stagedVars);
  json(res, { cancelled: true });
}

function handleCssFiles(res) {
  json(res, cssFileIndex);
}

function handleCssFile(url, res) {
  const vPath = new URL(url, 'http://x').searchParams.get('path');
  if (!vPath) { err(res, 'Missing ?path=', 400); return; }
  const abs = resolveFilePath(vPath);
  if (!fs.existsSync(abs)) { err(res, 'File not found', 404); return; }
  const css = fs.readFileSync(abs, 'utf8');
  json(res, parseCSS(css, vPath));
}

function handleResolve(url, res) {
  const params = new URL(url, 'http://x').searchParams;
  const prop  = params.get('prop');
  const theme = params.get('theme') || null;
  const mode  = params.get('mode')  || null;
  if (!prop) { err(res, 'Missing ?prop=', 400); return; }
  const chain = resolve(prop, resolutionMap, theme, mode);
  json(res, { prop, theme, mode, chain });
}

// ── Main router ──────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');

  // Static: Sherpa dist components
  if (pathname.startsWith('/sherpa/components/')) {
    const rel = pathname.slice('/sherpa/components/'.length);
    serveFile(res, path.join(PATHS.distComp, rel)); return;
  }

  // Static: Sherpa CSS
  if (pathname.startsWith('/sherpa/css/')) {
    const rel = pathname.slice('/sherpa/css/'.length);
    serveFile(res, path.join(PATHS.cssStyles, rel)); return;
  }

  // UI
  if (pathname === '/' || pathname === '/index.html') {
    serveFile(res, PATHS.indexHtml); return;
  }

  // API
  if (pathname === '/api/status'    && method === 'GET')    { handleStatus(res);               return; }
  if (pathname === '/api/events'    && method === 'GET')    { handleEvents(req, res);           return; }
  if (pathname === '/api/extract'   && method === 'POST')   { handleExtract(res);              return; }
  if (pathname === '/api/diff'      && method === 'GET')    { handleDiff(res);                 return; }
  if (pathname === '/api/apply'     && method === 'POST')   { handleApply(res);                return; }
  if (pathname === '/api/staged'    && method === 'DELETE') { handleCancelStaged(res);         return; }
  if (pathname === '/api/css-files' && method === 'GET')    { handleCssFiles(res);             return; }
  if (pathname === '/api/css-file'  && method === 'GET')    { handleCssFile(req.url, res);     return; }
  if (pathname === '/api/resolve'   && method === 'GET')    { handleResolve(req.url, res);     return; }

  err(res, 'Not found', 404);
});

// ── Startup ──────────────────────────────────────────────────────────

buildCssIndex();
rebuildResolutionMap();

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  ◈ Sherpa Token Studio\n`);
  console.log(`  ${url}\n`);
  console.log(`  CSS files indexed:  ${cssFileIndex.length}`);
  console.log(`  Tokens mapped:      ${resolutionMap.size}`);
  console.log(`  Figma token:        ${process.env.FIGMA_ACCESS_TOKEN ? '✓ set' : '✗ not set (Pull disabled)'}`);
  console.log();

  if (OPEN) {
    const opener = process.platform === 'darwin' ? 'open'
                 : process.platform === 'win32'  ? 'start'
                 : 'xdg-open';
    execFile(opener, [url], err => { if (err) console.log(`  Open ${url} in your browser.`); });
  }
});
