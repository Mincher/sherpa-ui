import { test, expect } from './harness';

/**
 * A ROW OFFERS ITS STORE'S VALUES — plan 986 D1 A (Will, 2026-11-14): on the canvas, Source › Field Name › Is one of lists
 * the names the store holds, as soon as the graph is drawn, with no Fetch, though the app declares no values for Name.
 * TRAP T-a-row-offers-its-stores-values
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1100px; block-size: 640px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { ArrayStore } = await import('/dist/data.js');
    const users = new ArrayStore([{ id: 1, name: 'Bo' }, { id: 2, name: 'Ann' }, { id: 3, name: 'Cy' }], { key: 'id' });
    bindWorkflow(el as never, {
      v: 3, id: 'names',
      nodes: [
        { id: 's', kind: 'source', x: 20, y: 20, values: { store: 'users' } }, { id: 'f', kind: 'field', x: 380, y: 20, values: { field: 'name' } },
        { id: 'c', kind: 'condition', x: 740, y: 20, values: { type: 'in', b: [] } },
      ],
      connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }],
    } as never, { session: new SessionStore(), stores: ['users'], fieldsOf: { users: { name: { label: 'Name' } } }, storeOf: (id: string) => (id === 'users' ? users : undefined) } as never);
    await window.__settled();
  });
});

const VALUES = '#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="b"]';

test('Is one of offers the names the store holds, with no Fetch', async ({ page }) => {
  // Its menu of ticks, opened as a reader opens it: each name the store holds, once, in order.
  const offered = async (): Promise<string[]> => {
    await page.locator(VALUES).locator('select.control').first().click();
    const menu = page.locator(`${VALUES} .picks-menu`).first();
    await expect(menu).toHaveAttribute('open', '');
    const values = await menu.locator('input:not(.qf-all input)').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).filter((v) => v && v !== 'on'));
    await page.keyboard.press('Escape');
    return values;
  };
  await expect.poll(offered).toEqual(['Ann', 'Bo', 'Cy']);
});
