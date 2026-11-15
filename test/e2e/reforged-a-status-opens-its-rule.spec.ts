import { test, expect, type Page } from './harness';

/**
 * A STATUS OPENS ITS RULE — plan 960 U4.7b (Will, 2026-11-14). In a page's Query graph a status field is ONE Field node,
 * a row per value saying its rule. Enter on it (or ⛶) opens the rule inside it, read only, as a preset Custom Node's
 * inside opens: Group Input, each value's tests, Group Output, a trail; Escape goes back. Real keys.
 * TRAP T-a-status-opens-its-rule
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 640px"><sherpa-stack id="trail" slot="trail" data-direction="inline" data-gap="sm"><sherpa-button data-action="back" data-type="icon" data-look="transparent" data-icon-start="arrow-left" aria-label="Back" data-tip="Back (Esc)"></sherpa-button><sherpa-breadcrumbs></sherpa-breadcrumbs></sherpa-stack><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>`);
    const { bindQueryEditor } = await import('/dist/app.js');
    const { ArrayStore, onReport } = await import('/dist/data.js');
    const { statusFields } = await import('/dist/core/data/status-field.js');
    const w = window as unknown as { asked: unknown[]; said: string[]; ed: { path(): string[] } };
    w.asked = [];
    w.said = [];
    onReport((r) => w.said.push(r.message));
    const store = statusFields(new ArrayStore([{ id: 1, score: 40, openTickets: 0 }], { key: 'id' }), {
      health: { type: 'status', label: 'Health', values: [
        { value: 'At risk', status: 'critical', when: [{ score: { lt: 60 } }, { openTickets: { gte: 5 } }] },
        { value: 'Healthy', status: 'success' },
      ] },
    });
    const query = Object.assign(new EventTarget(), {
      draft: { v: 1, scopes: { view: { holds: [], readings: {} } } },
      ask: (request: unknown) => w.asked.push(request),
      presets: () => [], presetOn: () => false, scope: () => [], fields: () => ['score', 'openTickets'], waiting: () => false,
    });
    const canvas = document.getElementById('cv') as HTMLElement;
    const filterDef = (f: string) => ({ label: f === 'health' ? 'Health' : f });
    w.ed = bindQueryEditor(canvas as never, { query, store, filterDef } as never, {
      definition: { v: 1, id: 'records', source: { store: 'customers', fields: { score: { label: 'Score', type: 'number' }, openTickets: { label: 'Open tickets', type: 'number' } } } },
      toolbar: canvas.querySelector('sherpa-node-toolbar') as HTMLElement,
    }) as never;
    await window.__settled();
  });
});

const settle = (page: Page) => page.evaluate(async () => {
  await window.__settled();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
});
const headings = (page: Page) => page.locator('#cv > sherpa-node').evaluateAll((els) => els.map((e) => e.getAttribute('data-heading')).sort());
const node = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`);
const path = (page: Page) => page.evaluate(() => (window as unknown as { ed: { path(): string[] } }).ed.path());

test('Health is one Field node, its values saying their rules; Enter opens the rule read only, and Escape goes back', async ({ page }) => {
  await expect(node(page, 'Health')).toHaveAttribute('data-sub-graph', '');
  const said = await node(page, 'Health').locator('sherpa-node-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')).filter((l) => l?.includes(':')));
  expect(said).toEqual(['At risk: Score is less than 60 or Open tickets is at least 5', 'Healthy: Every row the values before it left.']);
  // It names its own field, read only. Its Values row is a Field's, as in every graph (plan 1004 D1).
  // Its choices are the page's fields, as a Field's are in every graph; read only, it shows its own.
  expect(await node(page, 'Health').locator('select[name="field"]').evaluate((s: HTMLSelectElement) => [s.value, s.selectedOptions[0]?.text, s.hasAttribute('readonly')])).toEqual(['health', 'Health', true]);
  expect(await headings(page)).not.toContain('At risk');

  await node(page, 'Health').locator('.header[role="button"]').focus();
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await path(page)).toEqual(['status-health']);
  expect(await headings(page)).toEqual(['At risk', 'Condition', 'Condition', 'Field', 'Field', 'Group Input', 'Group Output']);
  // The way out names it; its Group Output has a row per value.
  await page.locator('#trail > sherpa-breadcrumbs .crumb .link').first().waitFor();
  const crumbs = await page.locator('#trail > sherpa-breadcrumbs').evaluate((el) => [...el.shadowRoot!.querySelectorAll('.crumb .link')].map((a) => a.textContent));
  expect(crumbs).toEqual(['Query', 'Health']);
  expect(await node(page, 'Group Output').locator('sherpa-node-row:not([data-label="Parameters"])').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')))).toEqual(['At risk', 'Healthy']);
  // Read only: each test's fields, its Operation and its Value B, take no typing; nothing is asked of the Query.
  const fields = await page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-node-row > sherpa-input-text').evaluateAll((els) => els.map((e) => e.hasAttribute('readonly')));
  expect(fields).toEqual([true, true, true, true]);

  await page.keyboard.press('Escape');
  await settle(page);
  expect(await path(page)).toEqual([]);
  expect(await headings(page)).toContain('Health');
  expect(await headings(page)).not.toContain('Group Input');
  expect(await page.evaluate(() => (window as unknown as { asked: unknown[] }).asked)).toEqual([]);
});

test('a load lights the node on top and each root inside, drawn now or later; Back keeps the light', async ({ page }) => {
  // A load of this page, as its source traces one: Health's rows, and At risk's 1.
  await page.evaluate(async () => {
    const { traceStep, traceQuerySteps } = await import('/dist/data.js');
    const load = traceStep('load', { graph: 'records' });
    traceQuerySteps({ v: 1, scopes: {} }, { walk: { results: {} }, statuses: { health: { 'At risk': 1 } } }, load!);
  });
  await settle(page);
  const lit = (heading: string) => node(page, heading).evaluate((el) => [el.getAttribute('data-step'), el.getAttribute('data-caption')]);
  expect(await lit('Health')).toEqual(['done', '1 row']);
  // Its value's row ends with its count, on the label's line (Will, TODO 983).
  const row = node(page, 'Health').locator('sherpa-node-row[data-label^="At risk:"]');
  await expect(row).toHaveAttribute('data-caption', '1 row');
  const [label, caption] = await row.evaluate((el) => ['.label', '.caption'].map((s) => el.shadowRoot!.querySelector(s)!.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, top: r.top, w: r.width })));
  expect(caption!.w).toBeGreaterThan(0);
  expect(caption!.left).toBeGreaterThanOrEqual(label!.right);
  expect(Math.abs(caption!.top - label!.top)).toBeLessThanOrEqual(4);
  // Not drawn when the load spoke, and lit as it is drawn.
  await node(page, 'Health').locator('.header[role="button"]').focus();
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await lit('At risk')).toEqual(['done', '1 row']);
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await lit('Health')).toEqual(['done', '1 row']);
  await expect(row).toHaveAttribute('data-caption', '1 row');
});
