import { test, expect, type Page } from './harness';

/**
 * The Query editor's node panel — Will, TODO 734: "the query editor is a node editor". The panel
 * lists the kinds a reader may place in a Query (Sources, Variables, Presets, Saved filters), and the
 * page's Filters as its Custom Nodes (TODO 776); a kind the Query only draws — a Condition, a
 * Status, a Check (plan 944) — is not offered (Will, 2026-11-10). Placing one, by a click or a drag,
 * is a request through the Query's one door: a Field holds the scope's next field, a Preset switches
 * on, a Filter switches itself on. One the Query cannot take now is refused in words, and asks nothing. Real pointer. TRAP T-one-command-one-door · TRAP T-a-filter-is-a-preset-of-its-store
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
        <sherpa-overlay-panel data-side="start" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel>
      </sherpa-layout-canvas>`);
    await customElements.whenDefined('sherpa-node-list');
    const { bindQueryEditor } = await import('/dist/app.js');
    const { onReport } = await import('/dist/data.js');
    const w = window as unknown as { asked: unknown[]; said: string[] };
    w.asked = [];
    w.said = [];
    onReport((r) => w.said.push(r.message));
    const query = Object.assign(new EventTarget(), {
      draft: { v: 1, scopes: { view: { holds: ['region'], readings: {} } } },
      ask: (request: unknown) => w.asked.push(request),
      presets: () => [{ id: 'big', label: 'Big', readings: {} }, { id: 'filter:active', label: 'Active', readings: {} }],
      presetOn: () => false,
      scope: () => ['region'],
      fields: () => ['region', 'plan'],
      waiting: () => false,
    });
    const canvas = document.getElementById('cv') as HTMLElement;
    bindQueryEditor(canvas as never, { query } as never, {
      definition: { v: 1, id: 'records', source: { store: 'customers' } },
      panel: canvas.querySelector('sherpa-node-list') as never, toolbar: canvas.querySelector('sherpa-node-toolbar') as HTMLElement,
    });
    await window.__settled();
  });
});

const item = (page: Page, kind: string) => page.locator(`sherpa-node-list sherpa-list-item[data-kind="${kind}"]`);
const asked = (page: Page) => page.evaluate(() => (window as unknown as { asked: unknown[] }).asked);
const said = (page: Page) => page.evaluate(() => (window as unknown as { said: string[] }).said);

test('it lists the Query\'s kinds by category, 8px in from the top, bottom and left', async ({ page }) => {
  const heads = await page.locator('sherpa-node-list .category-heading').evaluateAll((els) => els.map((e) => e.getAttribute('data-heading')));
  // The Preset tab's, the page's preset Filters under Custom Nodes; then the Custom tab's, the reader's own (plan 936).
  expect(heads).toEqual(['Sources', 'Custom Nodes', 'Variables', 'Presets', 'Saved filters', 'Custom Nodes']);
  // The Query draws a Condition and a Status, and places neither: they are not offered (plans 944, 971).
  await expect(item(page, 'condition')).toHaveCount(0);
  await expect(item(page, 'status')).toHaveCount(0);
  const [c, p] = await page.evaluate(() => [document.getElementById('cv')!, document.querySelector('#cv > sherpa-overlay-panel')!].map((e) => {
    const r = (e.id === 'cv' ? e : e.shadowRoot!.querySelector('.root')!).getBoundingClientRect();
    return { left: r.left, top: r.top, bottom: r.bottom };
  }));
  // Docked in the canvas's panel area, a card 16px in. TODO 871
  expect([p!.top, p!.bottom, p!.left]).toEqual([c!.top + 8, c!.bottom - 8, c!.left + 8]);
});

test('a click on Field asks the Query to hold the next field; a click on Preset switches it on', async ({ page }) => {
  await item(page, 'field').click();
  expect(await asked(page)).toEqual([{ scope: 'view', hold: ['region', 'plan'] }]);
  await item(page, 'preset').click();
  expect((await asked(page)).at(-1)).toEqual({ scope: 'view', preset: 'big', on: true });
  expect(await asked(page)).toHaveLength(2);
});

test('a Filter is a Custom Node: listed by its name, and a click switches it on where it is declared', async ({ page }) => {
  // A preset, it is on the Preset Nodes tab (plan 936).
  await expect(item(page, 'filter:active')).toHaveAttribute('data-label', 'Active');
  await item(page, 'filter:active').click();
  expect(await asked(page)).toEqual([{ scope: 'view', preset: 'filter:active', on: true }]);
  // Preset is the page's own: it never switches a Filter on. It is a kind, on the Preset Nodes tab.
  await page.locator('sherpa-node-list sherpa-tabs .tab[data-id="preset"]').click();
  await item(page, 'preset').click();
  expect((await asked(page)).at(-1)).toEqual({ scope: 'view', preset: 'big', on: true });
  expect(await said(page)).toEqual([]);
});

test('a drag of Field onto the canvas asks the same; a kind the Query cannot take is refused in words', async ({ page }) => {
  const from = (await item(page, 'field').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 80, from.y + 40, { steps: 4 });
  await page.mouse.move(640, 360, { steps: 6 });
  await page.mouse.up();
  // A loaded WebKit can answer the drop a frame after the release: wait for it.
  await expect.poll(() => asked(page)).toEqual([{ scope: 'view', hold: ['region', 'plan'] }]);
  // The drag's window listeners are gone, so these clicks place. TRAP T-abort-signal-any-is-collected
  await item(page, 'saved').click();
  await expect.poll(async () => (await said(page)).length).toBeGreaterThanOrEqual(1);
  expect(await asked(page)).toHaveLength(1);
  expect((await said(page))[0]).toContain('saved filter');
});
