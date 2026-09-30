import { test, expect, type Bar } from './harness';

/**
 * A CHIP SAYS ITS OWN ANSWER — TODO 130.
 *
 * Will, 2026-09-30: "Filter panel chips don't display tooltips. This
 * functionality should be on the filter chip component." And: number and date
 * chips showed none, and a tip should end ` - X matches`.
 *
 * TRAP T-a-chip-says-its-own-answer
 */
type Chip = HTMLElement & { results: number | null; current: boolean; refresh(): void; arrangeBy(f: string, d?: string | null): void };

const frames = `new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res))))`;

test('a toolbar chip says a number, a range and a date — and its matches while it is on', async ({ page }) => {
  const r = await page.evaluate(async (wait) => {
    const bar = await window.__mount<Bar & { setChipReading(id: string, reading: unknown): void }>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500, active: true },
      { id: 'created', label: 'Date', kind: 'date', range: true, active: true },
      { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }], active: true },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = (id: string): Chip => bar.shadowRoot!.querySelector(`.chip[data-id="${id}"]`)!;
    const tip = (id: string): string => chip(id).shadowRoot!.querySelector<HTMLElement>('.count-wrap')!.dataset['text'] ?? '';
    const value = (id: string): string => chip(id).shadowRoot!.querySelector('.caret-label')!.textContent ?? '';
    const settle = async (): Promise<void> => { await window.__settled(); await eval(wait); };

    bar.setChipReading('seats', { picked: ['37', '120'], range: true });
    bar.setChipReading('created', { picked: ['2024-01-05', '2024-02-06'], range: true });
    bar.setChipReading('plan', { picked: ['Pro', 'Free'] });
    await settle();
    const said = { seats: [value('seats'), tip('seats')], created: [value('created'), tip('created')], plan: tip('plan') };

    chip('seats').results = 28;
    chip('plan').results = 1;
    const counted = { seats: tip('seats'), plan: tip('plan') };
    // OFF: it filters nothing, so it says nothing.
    chip('seats').current = false;
    chip('seats').results = 28;
    const off = tip('seats');

    bar.setChipReading('seats', { picked: ['12'], range: false });
    await settle();
    return { said, counted, off, one: [value('seats'), tip('seats')], described: chip('plan').shadowRoot!.querySelector('.body')!.getAttribute('aria-description') };
  }, frames);

  expect(r.said.seats).toEqual(['37 to 120', '37 to 120']);
  expect(r.said.created[0]).toBe(r.said.created[1]);
  expect(r.said.created[0]).toMatch(/05 .* to 06 .* 2024/);
  expect(r.said.plan).toBe('Pro, Free');
  expect(r.counted).toEqual({ seats: '37 to 120 - 28 matches', plan: 'Pro, Free - 1 match' });
  expect(r.off).toBe('');
  expect(r.one).toEqual(['12', '12 - 28 matches']);
  // The same words for a screen reader, on the button.
  expect(r.described).toBe('Pro, Free - 1 match');
});

test('a Sort chip says its column and which way; Group its column', async ({ page }) => {
  const r = await page.evaluate(async (wait) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [], { style: 'inline-size: 1200px' });
    bar.organise({ group: [{ field: 'plan', label: 'Plan' }], sort: [{ field: 'name', label: 'Name' }, { field: 'plan', label: 'Plan' }] });
    await window.__settled();
    const org = (kind: string): Chip => bar.shadowRoot!.querySelector(`.organise-chip[data-kind="${kind}"]`)!;
    const tip = (kind: string): string => org(kind).shadowRoot!.querySelector<HTMLElement>('.count-wrap')!.dataset['text'] ?? '';
    const none = [tip('sort'), tip('group')];
    // As a bound source writes it: the bar follows its attributes through the chip.
    bar.setAttribute('data-sort-field', 'name');
    bar.setAttribute('data-sort-direction', 'desc');
    bar.setAttribute('data-group-field', 'plan');
    await window.__settled(); await eval(wait);
    const set = [tip('sort'), tip('group')];
    org('sort').arrangeBy('plan', 'asc');
    const steered = tip('sort');
    org('sort').arrangeBy('');
    return { none, set, steered, off: [tip('sort'), org('sort').hasAttribute('data-current')] };
  }, frames);
  expect(r.none).toEqual(['', '']);
  expect(r.set).toEqual(['Name, descending', 'Plan']);
  expect(r.steered).toBe('Plan, ascending');
  expect(r.off).toEqual(['', false]);
});

test('a filter panel\'s date chip says its days, and follows a sort', async ({ page }) => {
  const r = await page.evaluate(async (wait) => {
    const panel = await window.__mount<HTMLElement & {
      show(): void; setFieldReading(id: string, reading: unknown): void; drawResults(r: Record<string, number>, scope: string): void;
    }>('sherpa-filter-panel', [{
      scope: 'data', label: 'Data',
      sort: [{ field: 'name', label: 'Name' }, { field: 'plan', label: 'Plan' }],
      filters: [{ id: 'created', label: 'Date', kind: 'date', range: true, asChip: true }],
    }], { 'data-min-width': '0' });
    panel.show();
    await window.__settled();
    const chip = (id: string): Chip => panel.shadowRoot!.querySelector(`.value[data-value="${id}"]`)!;
    const tip = (id: string): string => chip(id).shadowRoot!.querySelector<HTMLElement>('.count-wrap')!.dataset['text'] ?? '';
    panel.setFieldReading('created', { picked: ['2024-01-05', '2024-02-06'], range: true });
    panel.setAttribute('data-sort-field', 'plan');
    panel.setAttribute('data-sort-direction', 'asc');
    await window.__settled(); await eval(wait);
    const days = tip('created');
    panel.drawResults({ created: 10 }, 'data');
    return {
      days, counted: tip('created'), on: chip('created').hasAttribute('data-current'),
      value: chip('created').shadowRoot!.querySelector('.caret-label')!.textContent,
      sort: [tip('sort'), chip('sort').hasAttribute('data-current')],
    };
  }, frames);
  expect(r.days).toMatch(/05 .* to 06 .* 2024/);
  expect(r.value).toBe(r.days);
  expect(r.on).toBe(true);
  expect(r.counted).toBe(`${r.days} - 10 matches`);
  expect(r.sort).toEqual(['Plan, ascending', true]);
});

test('a grid heading\'s sort button says its column, and which way once it sorts', async ({ page }) => {
  const r = await page.evaluate(async (wait) => {
    const grid = await window.__mount<HTMLElement>('sherpa-data-grid', {
      columns: [{ field: 'name', header: 'Name', sortable: true }],
      rows: [{ name: 'Ada' }, { name: 'Grace' }],
    }, { 'data-column-filters': '' });
    await window.__settled();
    const tip = (): string => grid.shadowRoot!.querySelector('.head-cell[data-field="name"] .head-sort')!
      .shadowRoot!.querySelector<HTMLElement>('.count-wrap')!.dataset['text'] ?? '';
    const before = tip();
    grid.setAttribute('data-sort-field', 'name');
    grid.setAttribute('data-sort-direction', 'desc');
    await window.__settled(); await eval(wait);
    return { before, sorted: tip() };
  }, frames);
  expect(r).toEqual({ before: 'Sort by Name', sorted: 'Sorted by Name, descending' });
});

test('a chip switched OFF under the pointer shuts its whole tooltip, not only its words', async ({ page }) => {
  await page.evaluate(async () => {
    const bar = await window.__mount<Bar & { setChipReading(id: string, reading: unknown): void }>('sherpa-quick-filter-toolbar', [
      { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }], active: true },
    ], { style: 'inline-size: 1200px' });
    bar.setChipReading('plan', { picked: ['Pro', 'Free'] });
    await window.__settled();
  });
  const body = page.locator('sherpa-quick-filter-toolbar .chip[data-id="plan"] .body');
  const open = (): Promise<boolean> => page.evaluate(() => document.querySelector('sherpa-quick-filter-toolbar')!
    .shadowRoot!.querySelector('.chip[data-id="plan"]')!.shadowRoot!.querySelector('.count-wrap')!
    .shadowRoot!.querySelector('.bubble')!.matches(':popover-open'));
  await body.hover();
  await expect.poll(open).toBe(true);
  await body.click();
  await expect.poll(open).toBe(false);
});

test('a RESET leaves a date chip with no value — a kept range holds no ends, never `undefined`', async ({ page }) => {
  const r = await page.evaluate(async (wait) => {
    const bar = await window.__mount<Bar & { setChipReading(id: string, reading: unknown): void; setChipValues(id: string, v: string[]): void }>('sherpa-quick-filter-toolbar', [
      { id: 'created', label: 'Date', kind: 'date', range: true, active: true },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = bar.shadowRoot!.querySelector<Chip>('.chip[data-id="created"]')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { values: string[] };
    const face = (): { label: string; values: string[]; start: string | null } => ({
      label: chip.shadowRoot!.querySelector('.caret-label')!.textContent ?? '',
      values: menu.values,
      start: menu.querySelector('sherpa-calendar')!.getAttribute('data-value-start'),
    });
    const settle = async (): Promise<void> => { await window.__settled(); await eval(wait); };
    // Nothing set, then emptied: the reader's Reset on a fresh page.
    bar.setChipValues('created', []);
    await settle();
    const fresh = face();
    bar.setChipReading('created', { picked: ['2024-01-05', '2024-02-06'], range: true });
    await settle();
    const set = face().values;
    bar.setChipValues('created', []);
    await settle();
    return { fresh, set, emptied: face(), range: menu.hasAttribute('data-range') };
  }, frames);
  expect(r.fresh).toEqual({ label: '', values: [], start: null });
  expect(r.set).toEqual(['2024-01-05', '2024-02-06']);
  expect(r.emptied).toEqual({ label: '', values: [], start: null });
  // The shape is kept: it is still a range.
  expect(r.range).toBe(true);
});
