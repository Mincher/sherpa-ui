import { test, expect } from './harness';

/**
 * A SERIAL set's chain, drawn — TODO 99. A value the chain does not offer is
 * REMOVED; a pick it rules out stays, greyed and set aside.
 * TRAP T-a-filter-set-groups-or-chains
 */

const REGIONS = [{ value: 'AMER', label: 'AMER' }, { value: 'EMEA', label: 'EMEA' }, { value: 'APAC', label: 'APAC' }];

type Offered = Record<string, readonly string[]>;

test('a menu removes a row its chain does not offer, and keeps a pick, greyed', async ({ page }) => {
  const r = await page.evaluate(async (items) => {
    const menu = await window.__mount<HTMLElement & {
      items(i: unknown): void; values: string[]; offered: readonly string[] | null;
    }>('sherpa-menu', undefined, { 'data-select': 'multiple' });
    menu.items(items);
    menu.values = ['EMEA'];
    await window.__settled();
    const read = (): string[] => [...menu.querySelectorAll<HTMLElement>('.menu-row:not(.qf-all)')]
      .filter((row) => getComputedStyle(row).display !== 'none')
      .map((row) => `${row.querySelector('input')!.value}${row.hasAttribute('data-unavailable') ? ' [dim]' : ''}`);
    menu.offered = ['AMER'];
    const chained = read();
    menu.offered = null;
    return { chained, all: read() };
  }, REGIONS);
  expect(r.chained).toEqual(['AMER', 'EMEA [dim]']);
  expect(r.all).toEqual(['AMER', 'EMEA', 'APAC']);
});

test('the bar tells a chip\'s menu what its chain offers', async ({ page }) => {
  const r = await page.evaluate(async (options) => {
    const bar = await window.__mount<HTMLElement & { drawOffered(o: Offered): void }>('sherpa-quick-filter-toolbar', [
      { id: 'region', label: 'Region', options },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    bar.drawOffered({ region: ['APAC'] });
    const menu = bar.shadowRoot!.querySelector<HTMLElement & { offered: readonly string[] | null }>('.chip[data-id="region"] sherpa-menu')!;
    return { offered: menu.offered, shown: [...menu.querySelectorAll<HTMLElement>('.menu-row:not(.qf-all)')]
      .filter((row) => getComputedStyle(row).display !== 'none').map((row) => row.querySelector('input')!.value) };
  }, REGIONS);
  expect(r.offered).toEqual(['APAC']);
  expect(r.shown).toEqual(['APAC']);
});

test('the panel removes a value chip its chain does not offer, and keeps one that is on', async ({ page }) => {
  const r = await page.evaluate(async (options) => {
    const panel = await window.__mount<HTMLElement & {
      populate(s: unknown): Promise<void>; show(): void; drawOffered(o: Offered, scope: string): void;
    }>('sherpa-filter-panel');
    await panel.populate([{ scope: 'view', label: 'View filters', filters: [
      { id: 'region', label: 'Region', select: 'multiple', options: options.map((o) => ({ ...o, selected: o.value === 'EMEA' })) },
    ] }]);
    panel.show();
    await window.__settled();
    panel.drawOffered({ region: ['AMER'] }, 'view');
    return [...panel.shadowRoot!.querySelectorAll<HTMLElement>('.field[data-field="region"] .value')]
      .filter((chip) => getComputedStyle(chip).display !== 'none')
      .map((chip) => `${chip.dataset['value']}${chip.hasAttribute('data-unavailable') ? ' [dim]' : ''}`);
  }, REGIONS);
  expect(r).toEqual(['AMER', 'EMEA [dim]']);
});
