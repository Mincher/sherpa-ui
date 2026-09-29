/**
 * The dashboard Context. init(root) populates the metric tiles, charts and
 * summary inside `root`; the nav and header live once in index.html.
 *
 * Map:
 * - init — bind the dashboard Context — charts, tiles and legends — to one source
 */
import { DataSource } from '../../dist/index.js';
import { namePrompt } from './ask-name.js';
import { customerStore, customersReady } from './records-data.js';

/* THE PAGE IS ITS DEFINITION: the router opened dashboard.json — the source
   over the alerts, the header's chips and the kept Query. Each chart and tile
   declares what it needs in dashboard.html and asks.
   TRAP T-a-page-is-its-definition · TRAP T-a-component-declares-its-summary */
export async function init(root, { source }) {
  // Summary read from the SAME store the Records page uses, so adding a
  // customer there moves these numbers.
  const customerSummary = (rows) => {
    const count = (field, value) => rows.filter((r) => r[field] === value).length;
    const seats = rows.reduce((n, r) => n + (Number(r.seats) || 0), 0);
    return [
      { key: 'Customers',   value: String(rows.length) },
      { key: 'Active',      value: String(count('status', 'active')) },
      { key: 'Trials',      value: String(count('status', 'trial')) },
      { key: 'Churned',     value: String(count('status', 'churned')) },
      { key: 'Seats sold',  value: seats.toLocaleString() },
      { key: 'Enterprise',  value: String(count('plan', 'Enterprise')) },
    ];
  };

  // Wait for the Context's elements to define, then populate.
  await Promise.all([
    customElements.whenDefined('sherpa-app-header'),
    customElements.whenDefined('sherpa-metric'),
    customElements.whenDefined('sherpa-barchart'),
    customElements.whenDefined('sherpa-radial-chart'),
    customElements.whenDefined('sherpa-gauge-chart'),
    customElements.whenDefined('sherpa-line-chart'),
    customElements.whenDefined('sherpa-chart-legend'),
    customElements.whenDefined('sherpa-container-header'),
    customElements.whenDefined('sherpa-key-value-list'),
  ]);

  const $ = (sel) => root.querySelector(sel);

  // Shared header — it lives in index.html, not in this Context's root.
  const header = document.querySelector('sherpa-app-shell > sherpa-app-header');
  // No breadcrumb: this view IS home, so a trail would name one page twice.
  await header?.populate({ breadcrumb: [] });
  header?.setAttribute('data-notifications', '4');

  // ONE lifetime: while this Context is mounted.
  const page = new AbortController();

  const provider = document.querySelector('sherpa-provider');

  // The gauge legend names THRESHOLD ZONES. No colour indices: a zone's colour
  // is a status, not a categorical series hue.
  $('#gauge-legend')?.populate([
    { label: 'Healthy (0–60%)', status: 'success' },
    { label: 'Warning (60–85%)', status: 'warning' },
    { label: 'Critical (85–100%)', status: 'critical' },
  ]);
  // A second DataSource over the shared customer store — a different store to
  // the one the charts read, which is the point of the demonstration.
  const customerSource = new DataSource({ store: customerStore });
  const kv = $('#kv');
  // SEED FIRST, THEN BIND. The customer store is IndexedDB, and `bind()`
  // populates straight away — binding first paints "Customers 0". Not awaited
  // at the top of init: the rest of the page reads a different store.
  if (kv) {
    void customersReady.then(() => {
      if (page.signal.aborted) return;
      customerSource.bind(kv, { readonly: true, as: customerSummary, signal: page.signal });
      return customerSource.load();
    });
  }

  /* Legends are FILTERS of their own chart: each reads its chart's field and
     asks, and the provider wires the pick. TRAP T-a-legend-toggle-is-a-filter
     The gauge legend is a KEY, not a filter — a gauge shows one value. */

  // A little interactivity so the demo is live.
  $('#bar')?.addEventListener('bar-click', (e) => {
    console.log('bar-click', e.detail);
  });

  // SAVE THIS VIEW — as JSON: the Query on screen and how its rows are arranged.
  // TRAP T-a-view-is-json
  const askViewName = namePrompt(root.querySelector('#save-view'), page.signal);
  header?.addEventListener('view-save', async () => {
    // The page's own dialog, never the browser's prompt(). Will, 2026-09-25.
    const label = await askViewName();
    if (label) await provider?.saveView(label);
  }, { signal: page.signal });
  header?.addEventListener('view-favorite', (e) => console.log('view-favorite', e.detail), { signal: page.signal });
  header?.addEventListener('data-refresh', () => console.log('data-refresh'), { signal: page.signal });

  await source?.load();

  // The router calls whatever init() returns when it swaps away. ONE ABORT
  // covers every bind and the view-picker's listener; a list is a thing to
  // forget.
  return () => page.abort();
}
