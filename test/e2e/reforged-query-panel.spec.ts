import { test, expect, type Page } from './harness';

/**
 * The Query editor's node panel — Will, TODO 734: "the query editor is a node editor". The panel
 * lists the kinds a Query takes placed (Sources, Logic, Presets, Saved filters, Status), and the page's
 * Preset Filters as its Custom Nodes (TODO 776); placing one, by a click or a drag, is a request
 * through the Query's one door: a Condition holds the scope's next field, a Preset switches on, a
 * Preset Filter switches itself on. A kind the Query cannot take is refused in words, and asks
 * nothing. Real pointer. TRAP T-one-command-one-door · TRAP T-a-preset-filter-is-a-preset-of-its-store
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
        <sherpa-node-panel slot="panel"></sherpa-node-panel>
      </sherpa-layout-canvas>`);
    await customElements.whenDefined('sherpa-node-panel');
    const { bindQueryEditor } = await import('/dist/app.js');
    const { onReport } = await import('/dist/data.js');
    const w = window as unknown as { asked: unknown[]; said: string[] };
    w.asked = [];
    w.said = [];
    onReport((r) => w.said.push(r.message));
    const query = Object.assign(new EventTarget(), {
      draft: { v: 1, scopes: { view: { holds: ['region'], readings: {} } } },
      ask: (request: unknown) => w.asked.push(request),
      presets: () => [{ id: 'big', label: 'Big', readings: {} }, { id: 'preset-filter:active', label: 'Active', readings: {} }],
      presetOn: () => false,
      scope: () => ['region'],
      fields: () => ['region', 'plan'],
      waiting: () => false,
    });
    const canvas = document.getElementById('cv') as HTMLElement;
    bindQueryEditor(canvas as never, { query } as never, {
      definition: { v: 1, id: 'records', source: { store: 'customers' } },
      panel: canvas.querySelector('sherpa-node-panel') as never, toolbar: canvas.querySelector('sherpa-node-toolbar') as HTMLElement,
    });
    await window.__settled();
  });
});

const item = (page: Page, kind: string) => page.locator(`sherpa-node-panel sherpa-list-item[data-kind="${kind}"]`);
const asked = (page: Page) => page.evaluate(() => (window as unknown as { asked: unknown[] }).asked);
const said = (page: Page) => page.evaluate(() => (window as unknown as { said: string[] }).said);

test('it lists the Query\'s kinds by category, flush to the top, bottom and left', async ({ page }) => {
  const heads = await page.locator('sherpa-node-panel .category-heading').evaluateAll((els) => els.map((e) => e.getAttribute('data-heading')));
  expect(heads).toEqual(['Sources', 'Custom Nodes', 'Variables', 'Logic', 'Presets', 'Saved filters', 'Status']);
  const [c, p] = await page.evaluate(() => [document.getElementById('cv')!, document.querySelector('sherpa-node-panel')!].map((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, top: r.top, bottom: r.bottom };
  }));
  // Docked flush in the canvas's panel area. TODO 796
  expect([p!.top, p!.bottom, p!.left]).toEqual([c!.top, c!.bottom, c!.left]);
});

test('a click on Field asks the Query to hold the next field; a Condition is refused in words; a click on Preset switches it on', async ({ page }) => {
  await item(page, 'field').click();
  expect(await asked(page)).toEqual([{ scope: 'view', hold: ['region', 'plan'] }]);
  // A Condition tests a Field (plan 783 D6): a Field's tests are its chip's.
  await item(page, 'condition').click();
  await expect.poll(() => said(page)).toEqual([expect.stringMatching(/^A Condition tests a Field: route one in\./)]);
  await item(page, 'preset').click();
  expect((await asked(page)).at(-1)).toEqual({ scope: 'view', preset: 'big', on: true });
  expect(await asked(page)).toHaveLength(2);
});

test('a Preset Filter is a Custom Node: listed by its name, and a click switches it on where it is declared', async ({ page }) => {
  await expect(item(page, 'preset-filter:active')).toHaveAttribute('data-label', 'Active');
  await item(page, 'preset-filter:active').click();
  expect(await asked(page)).toEqual([{ scope: 'view', preset: 'preset-filter:active', on: true }]);
  // Preset is the page's own: it never switches a Preset Filter on.
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
  await item(page, 'status').click();
  await item(page, 'saved').click();
  await expect.poll(async () => (await said(page)).length).toBeGreaterThanOrEqual(2);
  expect(await asked(page)).toHaveLength(1);
  const words = await said(page);
  expect(words[0]).toContain('statusFields()');
  expect(words[1]).toContain('saved filter');
});
