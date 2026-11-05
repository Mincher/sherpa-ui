import { test, expect, type Page } from './harness';

/**
 * A CELL READS IN WORDS — TODO 791. A grid draws a value as a reader reads it: a
 * dotted field's value, an object by its parts, a day in words, a value by its
 * field's name for it, a list as a list. Its sort, its filters and its groups
 * still read the raw value. TRAP T-a-cell-draws-words-not-its-value
 */
const AV = { id: 'av', label: 'Antivirus', select: 'multiple', options: [{ value: 'true', label: 'On' }, { value: 'false', label: 'Off' }] };
const DATA = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'location.building', header: 'Building' },
    { field: 'location', header: 'Location', filterable: false },
    { field: 'seen', header: 'Seen', type: 'date' },
    { field: 'av', header: 'Antivirus' },
    { field: 'tags', header: 'Tags', filterable: false },
  ],
  rows: [
    { id: 1, name: 'Ada', location: { building: 'B2', floor: 3 }, seen: '2026-01-05', av: true, tags: ['VIP', 'Legacy'] },
    { id: 2, name: 'Bob', location: { building: 'B1', floor: 0 }, seen: '2025-12-20', av: false, tags: [] },
    { id: 3, name: 'Cy', location: { building: 'B3' }, seen: '2026-02-01', av: true, tags: ['Remote'] },
  ],
  key: 'id',
  filters: { av: AV },
};
const FIELDS = DATA.columns.map((c) => c.field);

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (data) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate(data);
    await window.__settled();
    const w = window as unknown as { heard: unknown[] };
    w.heard = [];
    el.addEventListener('column-filter-change', (e) => {
      const { field, clause, reading } = (e as CustomEvent).detail;
      w.heard.push({ field, clause, reading });
    });
  }, DATA);
});

/** Each row's cells, as drawn. */
const drawn = (page: Page, fields: readonly string[]) => page.evaluate((fields) =>
  [...document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll('.body .row')].map((tr) =>
    fields.map((f) => tr.querySelector(`td.cell[data-field="${CSS.escape(f)}"]`)?.textContent?.trim() ?? null)), fields);
const cell = (page: Page, field: string, row: number) =>
  page.locator(`sherpa-data-grid .row >> nth=${row}`).locator(`td.cell[data-field="${field}"]`);
const heard = (page: Page) => page.evaluate(() => (window as unknown as { heard: unknown[] }).heard);

test('each cell draws its value in words: a dotted field, an object, a day, a value its field names, a list', async ({ page }) => {
  expect(await drawn(page, FIELDS)).toEqual([
    ['Ada', 'B2', 'building: B2, floor: 3', '05 Jan 2026', 'On', 'VIP, Legacy'],
    // A 0 is a value; an empty list is none.
    ['Bob', 'B1', 'building: B1, floor: 0', '20 Dec 2025', 'Off', ''],
    ['Cy', 'B3', 'building: B3', '01 Feb 2026', 'On', 'Remote'],
  ]);
});

test('a sort reads the raw value: days by the day, not by their words; a dotted field by its value', async ({ page }) => {
  const sortBy = async (field: string): Promise<void> => {
    await page.locator(`sherpa-data-grid .head-cell[data-field="${field}"] .head-sort`).click();
    await page.evaluate(() => window.__settled());
  };
  await sortBy('seen');
  // By the words, 01 Feb would lead.
  expect(await drawn(page, ['name', 'seen'])).toEqual([['Bob', '20 Dec 2025'], ['Ada', '05 Jan 2026'], ['Cy', '01 Feb 2026']]);
  await sortBy('location.building');
  expect(await drawn(page, ['name', 'location.building'])).toEqual([['Bob', 'B1'], ['Ada', 'B2'], ['Cy', 'B3']]);
});

test('a cell\'s filter picks the raw value: true, not On; the day, not its words; a dotted field\'s value', async ({ page }) => {
  const press = async (field: string, row: number): Promise<void> => {
    await cell(page, field, row).hover();
    await cell(page, field, row).locator('.cell-filter .caret').click();
  };
  await cell(page, 'av', 1).hover();
  // Named as it is drawn.
  await expect(cell(page, 'av', 1).locator('.cell-filter .caret')).toHaveAttribute('aria-label', 'Filter Antivirus: Off');
  await press('av', 1);
  await press('seen', 0);
  await press('location.building', 2);
  await expect.poll(() => heard(page)).toEqual([
    { field: 'av', clause: ['av', 'eq', false], reading: { picked: [false], mode: 'simple' } },
    { field: 'seen', clause: ['seen', 'eq', '2026-01-05'], reading: { picked: ['2026-01-05'], mode: 'simple' } },
    { field: 'location.building', clause: ['location.building', 'eq', 'B3'], reading: { picked: ['B3'], mode: 'simple' } },
  ]);
  // The value it picked is ON in its cell, by its key.
  await cell(page, 'av', 1).hover();
  await expect(cell(page, 'av', 1).locator('.cell-filter')).toHaveAttribute('data-current', '');
});

test('a group heading names its value in words, as its cells do; its key stays the raw value', async ({ page }) => {
  await page.evaluate(async () => {
    document.querySelector('sherpa-data-grid')!.setAttribute('data-group-field', 'av');
    await window.__settled();
  });
  const groups = await page.evaluate(() => [...document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll<HTMLElement>('.group-row')]
    .map((tr) => ({ key: tr.dataset['groupKey'], label: tr.querySelector('.group-label')!.textContent,
      toggle: tr.querySelector('.group-toggle')!.getAttribute('aria-label') })));
  expect(groups).toEqual([
    { key: 'false', label: 'Off', toggle: 'Collapse Off' },
    { key: 'true', label: 'On', toggle: 'Collapse On' },
  ]);
  // Shut, its toggle still says its name.
  await page.locator('sherpa-data-grid .group-row[data-group-key="true"] .group-toggle').click();
  await expect(page.locator('sherpa-data-grid .group-row[data-group-key="true"] .group-toggle')).toHaveAttribute('aria-label', 'Expand On');
});
