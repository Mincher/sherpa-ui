import { test, expect } from './harness';

/**
 * A filter bar loses nothing set before `populate()` gave it chips — TODO 113.
 * TRAP T-a-value-before-the-first-render-is-held
 */
type Reading = { picked?: string[] };
type Bar = HTMLElement & {
  populate(defs: unknown[]): Promise<void>;
  values: Record<string, string[]>;
  superseded: string[];
  setChipValues(id: string, picks: string[]): void;
  setChipReading(id: string, reading: Reading): void;
  supersede(ids: string[], appliedAt?: string): void;
  drawResults(results: Record<string, number>): void;
};
const DEFS = [
  { id: 'region', label: 'Region', options: [{ value: 'emea', label: 'EMEA' }, { value: 'apac', label: 'APAC' }] },
  { id: 'plan', label: 'Plan', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
  { id: 'tier', label: 'Tier', options: [{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }] },
];

test('values set before populate are the chips\' picks, and read back before', async ({ page }) => {
  const r = await page.evaluate(async (defs) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    bar.values = { region: ['apac'] };
    const before = bar.values;
    await bar.populate(defs);
    await window.__settled();
    return { before, after: bar.values };
  }, DEFS);
  expect(r).toEqual({ before: { region: ['apac'] }, after: { region: ['apac'] } });
});

test('one chip\'s picks, a reading and a supersede set before populate all land', async ({ page }) => {
  const r = await page.evaluate(async (defs) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    bar.setChipValues('plan', ['pro']);
    bar.setChipReading('region', { picked: ['emea'] });
    bar.supersede(['tier'], 'the View');
    const before = bar.superseded;
    await bar.populate(defs);
    await window.__settled();
    const tier = bar.shadowRoot!.querySelector('.chip[data-id="tier"]')!;
    return { before, values: bar.values, superseded: bar.superseded, at: tier.getAttribute('data-applied-at') };
  }, DEFS);
  expect(r).toEqual({
    before: ['tier'], values: { region: ['emea'], plan: ['pro'] }, superseded: ['tier'], at: 'the View',
  });
});

test('results drawn before populate, or before a rebuild, are on the chips', async ({ page }) => {
  const r = await page.evaluate(async (defs) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    bar.drawResults({ region: 12 });
    await bar.populate(defs);
    await window.__settled();
    const read = () => (bar.shadowRoot!.querySelector('.chip[data-id="region"]') as HTMLElement & { results: number | null }).results;
    const first = read();
    await bar.populate([...defs]);
    await window.__settled();
    return { first, rebuilt: read() };
  }, DEFS);
  expect(r).toEqual({ first: 12, rebuilt: 12 });
});

test('a rebuilt bar reads its picks at once, not empty until its menus stamp', async ({ page }) => {
  const r = await page.evaluate(async (defs) => {
    const bar = await window.__mount<Bar & { allowFields(list: string[] | null): void }>('sherpa-quick-filter-toolbar');
    await bar.populate(defs);
    await window.__settled();
    bar.values = { region: ['apac'], plan: ['free'] };
    // A rebuild, in this same task. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp
    bar.allowFields(null);
    return bar.values;
  }, DEFS);
  expect(r).toEqual({ region: ['apac'], plan: ['free'] });
});
