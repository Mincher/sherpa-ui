import { test, expect } from './harness';

/**
 * A FILTER SET, drawn — TODO 99. The bar gathers a set's chips into one
 * `sherpa-filterset`, joined, in the set's order, with a chain mark when
 * serial; the panel gathers its fields. A chip in a set is still the bar's.
 * TRAP T-a-filter-set-groups-or-chains
 */

const SET = { id: 'account', label: 'Account', mode: 'serial', fields: ['customer', 'region'] };

type Bar = HTMLElement & { groupSets(s: unknown[]): void; heldFields: string[] };

test('the bar draws a set\'s chips as one group, in its order, with a chain mark', async ({ page }) => {
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
    const box = sr.querySelector<HTMLElement>('.chips > sherpa-filterset')!;
    const chip = (id: string) => sr.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
    const corner = (id: string) => getComputedStyle(chip(id)).getPropertyValue('--sherpa-border-rounding-top-right').trim();
    return {
      run: [...sr.querySelector('.chips')!.children].map((n) => n.localName === 'sherpa-filterset'
        ? `set:${[...n.children].map((c) => (c as HTMLElement).dataset['id']).join('+')}` : (n as HTMLElement).dataset['id']),
      heading: box.shadowRoot!.querySelector('.heading')!.textContent,
      chain: getComputedStyle(box.shadowRoot!.querySelector('.chain')!).display,
      joined: [corner('customer'), corner('region')],
      held: bar.heldFields,
    };
  }, SET);
  expect(r.run).toEqual(['set:customer+region', 'status']);
  expect(r.heading).toBe('Account');
  expect(r.chain).not.toBe('none');
  // The first chip's inner corner is square; the last keeps its round end.
  expect(r.joined[0]).toBe('0px');
  expect(r.joined[1]).not.toBe('0px');
  expect(r.held.sort()).toEqual(['customer', 'region', 'status']);
});

test('a set whose chips all fold is parked, not hidden, so their menus still open', async ({ page }) => {
  const r = await page.evaluate(async (set) => {
    const options = (values: string[]) => values.map((v) => ({ value: v, label: v }));
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'status', label: 'Status', options: options(['active', 'trial']) },
      { id: 'customer', label: 'Customer', options: options(['Contoso', 'Litware']) },
      { id: 'region', label: 'Region', options: options(['EMEA', 'APAC']) },
    ], { style: 'inline-size: 260px' });
    bar.groupSets([set]);
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const box = bar.shadowRoot!.querySelector<HTMLElement>('.chips > sherpa-filterset')!;
    const style = getComputedStyle(box);
    return {
      folded: [...box.children].every((c) => c.hasAttribute('data-folded-away')),
      display: style.display, position: style.position,
    };
  }, SET);
  expect(r.folded).toBe(true);
  expect(r.display).not.toBe('none');
  expect(r.position).toBe('absolute');
});

test('the panel draws a set\'s fields as one vertical group, in its order', async ({ page }) => {
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
    const box = scope.querySelector<HTMLElement>(':scope > sherpa-filterset')!;
    return {
      run: [...scope.children].filter((n) => n.matches('.field, sherpa-filterset')).map((n) => n.localName === 'sherpa-filterset'
        ? `set:${[...n.children].map((c) => (c as HTMLElement).dataset['field']).join('+')}` : (n as HTMLElement).dataset['field']),
      orientation: box.dataset['orientation'],
      heading: box.shadowRoot!.querySelector('.heading')!.textContent,
    };
  }, SET);
  expect(r.run).toEqual(['set:customer+region', 'status']);
  expect(r.orientation).toBe('vertical');
  expect(r.heading).toBe('Account');
});
