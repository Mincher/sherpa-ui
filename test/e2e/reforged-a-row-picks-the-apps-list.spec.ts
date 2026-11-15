import { test, expect } from './harness';

/**
 * A ROW PICKS THE APP'S LIST — plan 986c. The app gives its lists to the editor (`lists`), and a row that names one draws it
 * as a dropdown: Content › On a view picks one of the app's Views. TRAP T-a-row-takes-its-values-type
 */
test('Content › On a view picks one of the app\'s Views, a dropdown of the list the app gives', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 600px"></sherpa-layout-canvas>');
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void> };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const graph = { v: 3, byHand: true, id: 'show', nodes: [{ id: 'c', kind: 'content', x: 40, y: 40, heading: 'Show it', values: { type: 'view' } }], connections: [] };
    bindWorkflow(canvas as never, graph as never, { session: new SessionStore(), lists: { views: ['Overview', { value: 'risk', label: 'At risk' }] } } as never);
    await window.__settled();
  });
  const view = page.locator('#cv > sherpa-node[data-heading="Show it"] sherpa-input-text[name="view"]');
  await expect(view).toHaveAttribute('data-type', 'select');
  expect(await view.evaluate((f) => [...f.shadowRoot!.querySelectorAll('option')].map((o) => o.textContent?.trim()))).toEqual(['Pick one', 'Overview', 'At risk']);
});
