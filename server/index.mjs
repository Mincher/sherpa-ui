/**
 * server/index.mjs — the example-apps template server (Node + Express).
 *
 * Simulates a template engine for the 4 example apps. Its whole job is to keep
 * the examples from drifting off the real components by serving their markup
 * instead of letting each example hardcode it. Two template sources:
 *
 *   1. DEFAULT component usage  — GET /template/component/:name
 *      A ready-to-use `<sherpa-x data-…>` tag DERIVED from the component's own
 *      Public API comment (server/component-usage.mjs). Cannot drift.
 *   2. BESPOKE per-Context markup — GET /template/context/:context
 *      The app-specific composed layout, served from examples/templates/<context>.html.
 *
 * No htmx: the example pages fetch their Context template with plain `fetch` and
 * inject it, then their own module script does populate()/event wiring. Plain
 * fetch+inject is enough here — there is no server-driven partial swapping — so
 * a client-side swap library would only add weight.
 *
 *   npm run serve:examples  →  http://localhost:4200
 */
import express from 'express';
import { readFile } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { componentUsage } from './component-usage.mjs';
import { alertRow } from '../examples/contexts/dashboard-data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const PORT = process.env.PORT ?? 4200;

// The pages a nav row opens are CONTEXTS (CLAUDE.md "Navigation terms").
const CONTEXTS = ['dashboard', 'records', 'chat'];
const NAME_RE = /^sherpa-[a-z0-9-]+$/;
const CONTEXT_RE = /^[a-z0-9-]+$/;

// ── static assets ────────────────────────────────────────────────────────────
app.use('/dist', express.static(join(ROOT, 'dist')));           // built components + tokens.css
app.use('/server', express.static(join(ROOT, 'server')));       // shared parser (browser sandbox imports it too)
app.use('/examples', express.static(join(ROOT, 'examples')));   // example page CSS/JS assets if any
app.use('/contexts', express.static(join(ROOT, 'examples', 'contexts'))); // SPA Context modules (index.html imports ./contexts/<c>.js)

// ── LIVE ALERTS: Server-Sent Events, a new alert every 2 s (or `?every=ms`), as
//    a real feed would push them. The Dashboard connects with `?live`. TODO 14.
//    TRAP T-a-live-feed-goes-into-the-store
app.get('/live/alerts', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const every = Math.max(100, Number(req.query.every) || 2000);
  let next = 1284;
  const tick = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'insert', row: alertRow(next++) })}\n\n`);
  }, every);
  req.on('close', () => clearInterval(tick));
});

// ── LIVE FILES: a component's BUILT markup or CSS changed, so every page draws
//    it again (`SherpaElement.reload`). Run `npm run build:watch` beside this.
//    Will, TODO 68. TRAP T-a-templater-owns-the-files
const pages = new Set();
app.get('/live/files', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  pages.add(res);
  req.on('close', () => pages.delete(res));
});
if (existsSync(join(ROOT, 'dist'))) {
  // A save writes several files: they go out as ONE message.
  let changed = new Set();
  let timer;
  watch(join(ROOT, 'dist'), { recursive: true }, (_event, file) => {
    if (!file || !/\.(html|css)$/.test(file)) return;
    // A component's own file names it; a shared sheet redraws every one.
    changed.add(/components[\\/](sherpa-[a-z0-9-]+)[\\/]/.exec(file)?.[1] ?? '*');
    clearTimeout(timer);
    timer = setTimeout(() => {
      const tags = [...changed];
      changed = new Set();
      for (const res of pages) res.write(`data: ${JSON.stringify({ tags })}\n\n`);
    }, 150);
  });
}

// ── template source #1: derived default component usage ───────────────────────
app.get('/template/component/:name', async (req, res) => {
  const name = String(req.params.name);
  if (!NAME_RE.test(name)) return res.status(400).type('text').send('bad component name');
  try {
    const { tag } = await componentUsage(name);
    res.type('html').send(tag);
  } catch (e) {
    res.status(404).type('text').send(`no such component: ${name} (${e.message})`);
  }
});

// ── template source #2: bespoke per-Context markup ────────────────────────────
app.get('/template/context/:context', async (req, res) => {
  const context = String(req.params.context);
  if (!CONTEXT_RE.test(context)) return res.status(400).type('text').send('bad context name');
  try {
    const markup = await readFile(join(ROOT, 'examples', 'templates', `${context}.html`), 'utf8');
    res.type('html').send(markup);
  } catch {
    res.status(404).type('text').send(`no such context template: ${context}`);
  }
});

// ── the single-page app shell ───────────────────────────────────────────────
// One document (examples/index.html) owns the app-shell + nav + header. Its
// router reads ?context=<c>, fetches /template/context/<c> and hot-swaps the
// content — no per-Context HTML documents, no full reloads.
app.get('/', async (_req, res) => {
  try {
    const page = await readFile(join(ROOT, 'examples', 'index.html'), 'utf8');
    res.type('html').send(page);
  } catch {
    res.status(500).type('text').send('missing examples/index.html');
  }
});

// Legacy per-page URLs (/records, /records.html) → redirect into the SPA.
app.get('/:context', (req, res) => {
  const context = String(req.params.context).replace(/\.html$/, '');
  if (!CONTEXTS.includes(context)) return res.status(404).type('text').send('unknown context');
  res.redirect(302, `/?context=${context}`);
});


app.listen(PORT, () => console.log(`Sherpa-UI examples → http://localhost:${PORT}`));
