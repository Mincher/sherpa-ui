import { test, expect } from './harness';

/**
 * THE FILTER MODE IS SET BEFORE THE PAGE PAINTS — TODO 352. A panel or a bar
 * asks its provider only once drawn, after the first paint; in Panel mode the
 * panel opened late and pushed the content aside (CLS 0.55 at 4x). Now a wanted
 * panel opens before it asks, `prepare()` sets a page's mode before its markup
 * is drawn, and a bar steps back as it asks, with or without a source.
 * TRAP T-the-filter-mode-is-set-before-the-page-paints
 */
const SETUP = `
  await import('/dist/index.js');
  const root = document.getElementById('root');
  root.innerHTML = '';
  const provider = document.createElement('sherpa-provider');
  const panel = document.createElement('sherpa-filter-panel');
  provider.append(panel);
  root.append(provider);
  const data = { v: 1, id: 'p', source: { store: 's', fields: { name: { label: 'Name' } } } };
  const none = { v: 1, id: 'q' };
`;

test('a wanted panel opens before it has drawn or asked', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.filterMode = 'panel';
    return { open: panel.hasAttribute('open') };
  })()`);
  expect(r).toEqual({ open: true });
});

test('prepare() opens or shuts the panel for the page about to be drawn', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.filterMode = 'panel';
    await panel.rendered;
    const seen = [];
    provider.prepare(none);
    seen.push(panel.hasAttribute('open'));
    provider.prepare(data);
    seen.push(panel.hasAttribute('open'));
    return { seen, mode: provider.filterMode };
  })()`);
  // A page with no data shuts it, which is not the reader's choice: the next page with data opens it.
  expect(r).toEqual({ seen: [false, true], mode: 'panel' });
});

test('leaving for another page keeps the panel; leaving for none shuts it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.filterMode = 'panel';
    await panel.rendered;
    provider.close({ next: true });
    const kept = panel.hasAttribute('open');
    provider.close();
    return { kept, shut: !panel.hasAttribute('open') };
  })()`);
  expect(r).toEqual({ kept: true, shut: true });
});

test('a bar steps back as it asks, with no source yet', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.filterMode = 'panel';
    await panel.rendered;
    const bar = document.createElement('sherpa-quick-filter-toolbar');
    bar.dataset.scope = 'data';
    provider.append(bar);
    await bar.rendered;
    return { stepped: bar.hasAttribute('data-panel-mode') };
  })()`);
  expect(r).toEqual({ stepped: true });
});
