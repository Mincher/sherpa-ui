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

/* ONE order, the source's (Will, D2 A, TODOs 347–349): saved filters first, then
   fields. TRAP T-one-walk-counts-and-limits-in-order */
type Scoped = Bar & { addFilters(ids: string[]): void; available(d: unknown[]): void; drawScope(s: unknown): Promise<void> };
const SAVED = (id: string) => ({ id, label: id.toUpperCase(), readings: { status: { picked: ['active'] } } });
const FIELDS = ['region', 'status', 'customer'].map((id) => ({ id, label: id, removable: true,
  options: [{ value: 'a', label: 'a' }, { value: 'b', label: 'b' }] }));

test('a saved filter added to the bar lands after the other saved filters, not at the end', async ({ page }) => {
  const r = await page.evaluate(async ({ saved, fields }) => {
    const run = (b: HTMLElement) => [...b.shadowRoot!.querySelectorAll<HTMLElement>('.chips > .chip')].map((c) => c.dataset['id']);
    const bar = await window.__mount<Scoped>('sherpa-quick-filter-toolbar', [saved[0], ...fields], { style: 'inline-size: 1600px' });
    bar.available([saved[1], saved[2]]);
    bar.addFilters(['s2']);
    await window.__settled();
    const one = run(bar);
    const none = await window.__mount<Scoped>('sherpa-quick-filter-toolbar', fields, { style: 'inline-size: 1600px' });
    none.available([saved[2]]);
    none.addFilters(['s3']);
    await window.__settled();
    return { one, none: run(none) };
  }, { saved: [SAVED('s1'), SAVED('s2'), SAVED('s3')], fields: FIELDS });
  expect(r.one).toEqual(['s1', 's2', 'region', 'status', 'customer']);
  expect(r.none).toEqual(['s3', 'region', 'status', 'customer']);
});

test('drawScope puts the chips in the scope\'s order, and draws a saved filter the panel added', async ({ page }) => {
  const r = await page.evaluate(async ({ fields }) => {
    const run = (b: HTMLElement) => [...b.shadowRoot!.querySelectorAll<HTMLElement>('.chips > .chip')].map((c) => c.dataset['id']);
    const bar = await window.__mount<Scoped>('sherpa-quick-filter-toolbar', fields, { style: 'inline-size: 1600px' });
    await bar.drawScope({ scope: 'data', label: 'Rows', available: [], filters: [
      { id: 'p', label: 'P', readings: { status: { picked: ['a'] } }, active: true, removable: true },
      { id: 'status', label: 'status' }, { id: 'customer', label: 'customer' }, { id: 'region', label: 'region' },
    ] });
    await window.__settled();
    const on = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="p"]')?.hasAttribute('data-current') ?? null;
    return { run: run(bar), on };
  }, { fields: FIELDS });
  expect(r.run).toEqual(['p', 'status', 'customer', 'region']);
  expect(r.on).toBe(true);
});
