import { test, expect } from './harness';

/**
 * A FILTER SET, drawn — TODO 99; only an order since TODO 240 and 241. The
 * bar puts a set's chips together in the set's order, plain and not joined;
 * the panel orders its fields, with no box. A chip in a set is still the bar's.
 * TRAP T-a-filter-set-groups-or-chains
 */

const SET = { id: 'account', label: 'Account', mode: 'serial', fields: ['customer', 'region'] };

type Bar = HTMLElement & { groupSets(s: unknown[]): void; heldFields: string[] };

test('the bar puts a set\'s chips together in its order, as plain chips', async ({ page }) => {
  const r = await page.evaluate(async (set) => {
    const options = (values: string[]) => values.map((v) => ({ value: v, label: v }));
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'region', label: 'Region', options: options(['EMEA', 'APAC']) },
      { id: 'status', label: 'Status', options: options(['active', 'trial']) },
      { id: 'customer', label: 'Customer', options: options(['Contoso', 'Litware']) },
    ], { style: 'inline-size: 1200px' });
    bar.groupSets([set]);
    await window.__settled();
    const sr = bar.shadowRoot!;
    const chip = (id: string) => sr.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
    const corner = (id: string) => getComputedStyle(chip(id)).getPropertyValue('--sherpa-border-rounding-top-right').trim();
    return {
      run: [...sr.querySelector('.chips')!.children].map((n) => (n as HTMLElement).dataset['id'] ?? n.localName),
      // Not joined: each chip keeps its own round corners. Will, TODO 241.
      corners: [corner('customer'), corner('region')],
      held: bar.heldFields,
    };
  }, SET);
  expect(r.run).toEqual(['customer', 'region', 'status']);
  expect(r.corners).toEqual([r.corners[1], r.corners[1]]);
  expect(r.corners[0]).not.toBe('0px');
  expect(r.held.sort()).toEqual(['customer', 'region', 'status']);
});

test('the panel orders a set\'s fields where its first stands, with no box round them', async ({ page }) => {
  const r = await page.evaluate(async (set) => {
    const options = (values: string[]) => values.map((v) => ({ value: v, label: v }));
    const panel = await window.__mount<HTMLElement & { populate(s: unknown): Promise<void>; show(): void }>('sherpa-filter-panel');
    await panel.populate([{ scope: 'view', label: 'View filters', sets: [set], filters: [
      { id: 'region', label: 'Region', select: 'multiple', options: options(['EMEA', 'APAC']) },
      { id: 'status', label: 'Status', select: 'multiple', options: options(['active', 'trial']) },
      { id: 'customer', label: 'Customer', select: 'multiple', options: options(['Contoso', 'Litware']) },
    ] }]);
    panel.show();
    await window.__settled();
    const scope = panel.shadowRoot!.querySelector<HTMLElement>('.scope[data-scope="view"]')!;
    return {
      run: [...scope.children].filter((n) => n.matches('.field')).map((n) => (n as HTMLElement).dataset['field']),
      boxes: panel.shadowRoot!.querySelectorAll('sherpa-filterset').length,
    };
  }, SET);
  expect(r.run).toEqual(['customer', 'region', 'status']);
  expect(r.boxes).toBe(0);
});
