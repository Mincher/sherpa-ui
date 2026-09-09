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
 *   2. BESPOKE per-view markup   — GET /template/view/:view
 *      The app-specific composed layout, served from examples/templates/<view>.html.
 *
 * No htmx: the example pages fetch their view template with plain `fetch` and
 * inject it, then their own module script does populate()/event wiring. Plain
 * fetch+inject is enough here — there is no server-driven partial swapping — so
 * a client-side swap library would only add weight.
 *
 *   npm run serve:examples  →  http://localhost:4200
 */
import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { html, render } from './html.mjs';
import { componentUsage } from './component-usage.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const PORT = process.env.PORT ?? 4200;

const VIEWS = ['dashboard', 'records', 'settings', 'chat'];
const NAME_RE = /^sherpa-[a-z0-9-]+$/;
const VIEW_RE = /^[a-z0-9-]+$/;

// ── static assets ────────────────────────────────────────────────────────────
app.use('/dist', express.static(join(ROOT, 'dist')));           // built components + tokens.css
app.use('/server', express.static(join(ROOT, 'server')));       // shared parser (browser sandbox imports it too)
app.use('/examples', express.static(join(ROOT, 'examples')));   // example page CSS/JS assets if any

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

// ── template source #2: bespoke per-view markup ───────────────────────────────
app.get('/template/view/:view', async (req, res) => {
  const view = String(req.params.view);
  if (!VIEW_RE.test(view)) return res.status(400).type('text').send('bad view name');
  try {
    const markup = await readFile(join(ROOT, 'examples', 'templates', `${view}.html`), 'utf8');
    res.type('html').send(markup);
  } catch {
    res.status(404).type('text').send(`no such view template: ${view}`);
  }
});

// ── the example page shell for a view ──────────────────────────────────────────
// Serves the example .html document verbatim (its <head> + module bootstrap);
// the page then fetches /template/view/<view> and injects it into itself.
app.get(['/', '/:view'], async (req, res) => {
  const view = String(req.params.view ?? 'dashboard').replace(/\.html$/, '');
  if (!VIEWS.includes(view)) return res.status(404).type('text').send('unknown view');
  try {
    const page = await readFile(join(ROOT, 'examples', `${view}.html`), 'utf8');
    res.type('html').send(page);
  } catch {
    res.status(404).type('text').send('unknown view');
  }
});

// A tiny index that lists the views (uses the html helper, kept from the old server).
app.get('/index', (_req, res) =>
  res.type('html').send(
    render(html`<!doctype html><html><head><meta charset="utf-8"><title>Sherpa-UI examples</title></head>
      <body><h1>Sherpa-UI examples</h1><ul>${VIEWS.map(
        (v) => html`<li><a href="/${v}">${v}</a></li>`,
      )}</ul></body></html>`),
  ),
);

app.listen(PORT, () => console.log(`Sherpa-UI examples → http://localhost:${PORT}`));
