import { test, expect, type Page } from './harness';

/**
 * A Source's Fields (Will, 2026-11-13, TODO 969): ONE dropdown of ticks, its store's fields, All at the start — every
 * field ticked, its face "All", and nothing kept, so a field the store gains later is in it too. An untick keeps the
 * rest; every one ticked again keeps none. A Field after it picks from the fields kept. Real pointer.
 */
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.style.cssText = 'inline-size: 1100px; block-size: 700px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 3, id: 'g', nodes: [
      { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'f', kind: 'field', x: 420, y: 0 },
    ], connections: [{ from: 's/rows', to: 'f' }] };
    (window as unknown as { editor: unknown }).editor = bindWorkflow(el as never, flow as never, {
      session: new SessionStore(), inspector: panel as never, stores: ['customers'],
      fieldsOf: { customers: { name: { label: 'Name' }, status: { label: 'Status', values: ['trial', 'paid'] }, region: { label: 'Region' } } },
    });
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const FIELDS = '#root sherpa-node[data-heading="Source"] sherpa-input-text[name="fields"]';
/** What the Fields field shows, what the Source keeps, and what a Field after it picks from. */
const look = (page: Page) => page.evaluate((sel) => {
  const el = document.querySelector(sel) as HTMLElement & { values: string[] };
  const nodes = (window as unknown as { editor: { workflow(): { nodes: { id: string; values?: Record<string, unknown> }[] } } }).editor.workflow().nodes;
  const field = document.querySelector('#root sherpa-node[data-heading="Field"] sherpa-input-text[name="field"]')!;
  return {
    ticked: el.values, says: el.shadowRoot!.querySelector('select')!.selectedOptions[0]?.textContent,
    kept: nodes.find((n) => n.id === 's')?.values?.['fields'] ?? null,
    offered: [...field.shadowRoot!.querySelectorAll('option')].map((o) => o.value).filter(Boolean),
  };
}, FIELDS);

test('a Source\'s Fields is All at the start: every field ticked, none kept; an untick keeps the rest, and the Field after it picks from them', async ({ page }) => {
  expect(await look(page)).toEqual({ ticked: ['name', 'status', 'region'], says: 'All', kept: null, offered: ['name', 'status', 'region'] });
  await page.locator(FIELDS).locator('select.control').first().click();
  const menu = page.locator(`${FIELDS} .picks-menu`).first();
  await expect(menu).toHaveAttribute('open', '');
  await menu.locator('input[value="region"]').click();
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await look(page)).toEqual({ ticked: ['name', 'status'], says: 'Name, Status', kept: ['name', 'status'], offered: ['name', 'status'] });
  // Every one ticked again keeps none: All.
  await page.locator(FIELDS).locator('select.control').first().click();
  await expect(menu).toHaveAttribute('open', '');
  await menu.locator('input[value="region"]').click();
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await look(page)).toEqual({ ticked: ['name', 'status', 'region'], says: 'All', kept: null, offered: ['name', 'status', 'region'] });
});

/** Press a menu's Select all row. */
const selectAll = async (page: Page, field: string): Promise<void> => {
  await page.locator(field).locator('select.control').first().click();
  const menu = page.locator(`${field} .picks-menu`).first();
  await expect(menu).toHaveAttribute('open', '');
  await menu.locator('.qf-all input').click();
  await page.keyboard.press('Escape');
  await settle(page);
};

test('Select all leads the menu (Will, 2026-11-14): on a Source\'s Fields it is All, none kept; on a Field\'s Values, every value picked', async ({ page }) => {
  // Fields: some ticked, Select all is mixed; pressed, every one, and none kept.
  await page.locator(FIELDS).locator('select.control').first().click();
  const menu = page.locator(`${FIELDS} .picks-menu`).first();
  await menu.locator('input[value="region"]').click();
  const all = () => menu.locator('.qf-all input').evaluate((i: HTMLInputElement) => [i.checked, i.indeterminate]);
  expect(await all()).toEqual([false, true]);
  await page.keyboard.press('Escape');
  await settle(page);
  expect((await look(page)).kept).toEqual(['name', 'status']);
  await selectAll(page, FIELDS);
  expect(await look(page)).toEqual({ ticked: ['name', 'status', 'region'], says: 'All', kept: null, offered: ['name', 'status', 'region'] });
  // A Field on Status: its Values' Select all picks every value, kept as an answer (TODO 965).
  await page.locator('#root sherpa-node[data-heading="Field"] sherpa-input-text[name="field"] select').selectOption('status');
  await settle(page);
  const VALUES = '#root sherpa-node[data-heading="Field"] sherpa-input-text[name="values"]';
  await selectAll(page, VALUES);
  expect(await page.evaluate(() => (window as unknown as { editor: { workflow(): { nodes: { id: string; values?: Record<string, unknown> }[] } } }).editor.workflow().nodes.find((n) => n.id === 'f')?.values?.['values'])).toEqual(['trial', 'paid']);
  expect(await page.locator(VALUES).evaluate((el) => el.shadowRoot!.querySelector('select')!.selectedOptions[0]?.textContent)).toBe('All');
});

