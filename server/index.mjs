/**
 * server/index.mjs — the Sherpa-UI framework Client Server (Node + Express).
 *
 *   UI (sherpa-*) → HTMX (hx-* : request → swap) → Client Server (this)
 *
 * HTML-over-the-wire: routes return snippets of sherpa-* markup (see fragments.mjs),
 * never JSON. Components stay pure UI. This file is the boilerplate entry — wire
 * new routes to new fragment renderers; the shell + html helper + data layer are
 * split into sibling modules. See FRAMEWORK.md.
 *
 *   npm run serve:app   →  http://localhost:4100
 */
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { shell } from './shell.mjs';
import { html, render } from './html.mjs';
import {
  filtersFragment,
  listFragment,
  detailFragment,
  toggleResponse,
  addResponse,
} from './fragments.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const PORT = process.env.PORT ?? 4100;

// ── the three framework asset layers ────────────────────────────────────────
app.use('/dist', express.static(join(ROOT, 'dist'))); // built components + tokens.css
app.use('/vendor/htmx.js', express.static(join(ROOT, 'node_modules/htmx.org/dist/htmx.min.js')));

// ── fragment routes (HTML-over-the-wire) ─────────────────────────────────────
// reads
app.get('/fragments/filters', (req, res) => res.type('html').send(render(filtersFragment(req.query.filter))));
app.get('/fragments/tasks', (req, res) => res.type('html').send(render(listFragment(req.query.filter))));
app.get('/fragments/task', (req, res) => res.type('html').send(render(detailFragment(req.query.id))));
// writes (hx-post) — return the targeted region + out-of-band sibling refreshes
app.post('/fragments/toggle', (req, res) => res.type('html').send(render(toggleResponse(req.query.id))));
app.post('/fragments/add', (req, res) => res.type('html').send(render(addResponse(req.query.label))));

// ── the app shell (one full document; regions load their first fragment) ──────
app.get('/', (_req, res) =>
  res.type('html').send(
    shell({
      title: 'Sherpa-UI — task app',
      body: html`<div class="app">
        <section>
          <div class="list-head">
            <h1>Tasks</h1>
            <sherpa-button data-variant="secondary" data-size="sm" data-label="Add task"
                hx-post="/fragments/add?label=New task" hx-trigger="button-click"
                hx-target="#detail" hx-swap="innerHTML"></sherpa-button>
          </div>
          <div id="filters" hx-get="/fragments/filters" hx-trigger="load" hx-swap="outerHTML"></div>
          <div id="list" hx-get="/fragments/tasks" hx-trigger="load" hx-swap="innerHTML"></div>
        </section>
        <section id="detail" aria-live="polite"></section>
      </div>`,
    }),
  ),
);

app.listen(PORT, () => console.log(`Sherpa-UI app → http://localhost:${PORT}`));
