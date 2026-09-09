/**
 * shell.mjs — the app shell (the one full HTML document).
 *
 * Loads the three framework layers once: the token layer (light-DOM CSS), the
 * component registry (dist/index.js), and the HTMX runtime. Then a `.sherpa-view`
 * with named regions; each region is an empty box that hx-get's its first fragment
 * on load. Interaction fragments swap into these regions by id (the region contract).
 */
import { html, render } from './html.mjs';

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body  — raw HTML for the app body (regions).
 */
export function shell({ title, body }) {
  return render(html`<!doctype html>
<html lang="en" data-theme="sherpa" data-mode="auto">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="/dist/styles/tokens/tokens.css" />
  <script type="module" src="/dist/index.js"></script>
  <script src="/vendor/htmx.js" defer></script>
  <style>
    body { margin: 0; font-family: var(--sherpa-font-family-body, system-ui, sans-serif); }
    .app { display: grid; grid-template-columns: 340px 1fr; gap: 24px; padding: 24px; align-items: start; }
    h1 { font: var(--sherpa-font-weight-semibold, 600) var(--sherpa-font-size-heading-h2, 20px)/1.3 sans-serif; margin: 0; }
    .list-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .filters { display: flex; gap: 8px; margin-bottom: 12px; }
    .detail-actions { margin-top: 16px; }
    #detail:empty::before { content: "Select a task"; color: var(--sherpa-style-content-secondary, #5c5c66); }
  </style>
</head>
<body>
  ${body}
</body>
</html>`);
}
