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

test('a toolbar chip says a number, a range and a date — and its matches, on or off', async ({ page }) => {
  const r = await page.evaluate(async (wait) => {
    const bar = await window.__mount<Bar & { setChipReading(id: string, reading: unknown): void }>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500, active: true },
      { id: 'created', label: 'Date', kind: 'date', range: true, active: true },
      { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }], active: true },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = (id: string): Chip => bar.shadowRoot!.querySelector(`.chip[data-id="${id}"]`)!;
    const tip = (id: string): string => chip(id).shadowRoot!.querySelector('.tip')!.textContent ?? '';
    const value = (id: string): string => chip(id).shadowRoot!.querySelector('.caret-label')!.textContent ?? '';
    const settle = async (): Promise<void> => { await window.__settled(); await eval(wait); };

    // A number's range is an Advanced Between row (TODO 375).
    bar.setChipReading('seats', { conditions: [{ op: 'between', picked: ['37', '120'] }], mode: 'advanced' });
    bar.setChipReading('created', { picked: ['2024-01-05', '2024-02-06'], range: true });
    bar.setChipReading('plan', { picked: ['Pro', 'Free'] });
    await settle();
    const said = { seats: [value('seats'), tip('seats')], created: [value('created'), tip('created')], plan: tip('plan') };

    chip('seats').results = 28;
    chip('plan').results = 1;
    const counted = { seats: tip('seats'), plan: tip('plan') };
    // OFF it says the same: on or off has no bearing on the tip (Will, 363).
    chip('seats').current = false;
    chip('seats').results = 28;
    const off = tip('seats');

    bar.setChipReading('seats', { picked: ['12'], mode: 'simple' });
    await settle();
    return { said, counted, off, one: [value('seats'), tip('seats')], described: chip('plan').shadowRoot!.querySelector('.body')!.getAttribute('aria-description') };
  }, frames);

  // A Between row reads as its condition, face and tip. Will, TODO 375 and 409
  expect(r.said.seats).toEqual(['between(37, 120)', 'between(37, 120)']);
  expect(r.said.created[0]).toBe(r.said.created[1]);
  expect(r.said.created[0]).toMatch(/05 .* to 06 .* 2024/);
  expect(r.said.plan).toBe('Pro, Free');
  expect(r.counted).toEqual({ seats: 'between(37, 120) - 28 matches', plan: 'Pro, Free - 1 match' });
  expect(r.off).toBe('between(37, 120) - 28 matches');
  expect(r.one).toEqual(['12', '12 - 28 matches']);
  // The same words for a screen reader, on the button.
  expect(r.described).toBe('Pro, Free - 1 match');
});

test('a greyed chip still says why on hover: held above, or off; its buttons hear no pointer, its box does (Will, TODO 585)', async ({ page }) => {
  await page.evaluate(async () => {
    await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }], active: true },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
  });
  const chip = page.locator('sherpa-quick-filter-toolbar .chip[data-id="plan"]');
  const said = async (): Promise<{ open: boolean; text: string }> => {
    const box = (await chip.locator('.body').first().boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.evaluate(() => window.__settled());
    const out = await chip.evaluate((c) => {
      const tip = c.shadowRoot!.querySelector<HTMLElement>('.tip')!;
      return { open: tip.matches(':popover-open'), text: (tip.textContent ?? '').trim() };
    });
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.__settled());
    return out;
  };
  await chip.evaluate((c) => {
    c.setAttribute('data-superseded', '');
    c.setAttribute('data-applied-at', 'View Context');
  });
  expect(await said()).toEqual({ open: true, text: 'Filter moved to View Context scope.' });
  await chip.evaluate((c) => {
    c.removeAttribute('data-superseded');
    c.setAttribute('disabled', '');
  });
  expect((await said()).open).toBe(true);
  // Gone when the pointer leaves, and a chip back in use opens its own as ever.
  expect(await chip.evaluate((c) => c.shadowRoot!.querySelector<HTMLElement>('.tip')!.matches(':popover-open'))).toBe(false);
  await chip.evaluate((c) => c.removeAttribute('disabled'));
  expect(await chip.evaluate((c) => c.shadowRoot!.querySelector('.chip')!.classList.contains('sherpa-anchor'))).toBe(false);
});

test('a Sort chip says its column and which way; Group its column', async ({ page }) => {
  const r = await page.evaluate(async (wait) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [], { style: 'inline-size: 1200px' });
    bar.organise({ group: [{ field: 'plan', label: 'Plan' }], sort: [{ field: 'name', label: 'Name' }, { field: 'plan', label: 'Plan' }] });
    await window.__settled();
    const org = (kind: string): Chip => bar.shadowRoot!.querySelector(`.organise-chip[data-kind="${kind}"]`)!;
    const tip = (kind: string): string => org(kind).shadowRoot!.querySelector('.tip')!.textContent ?? '';
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

test('a grid heading\'s sort button says its column, and which way once it sorts', async ({ page }) => {
  const r = await page.evaluate(async (wait) => {
    const grid = await window.__mount<HTMLElement>('sherpa-data-grid', {
      columns: [{ field: 'name', header: 'Name', sortable: true }],
      rows: [{ name: 'Ada' }, { name: 'Grace' }],
    }, { 'data-column-filters': '' });
    await window.__settled();
    const tip = (): string => grid.shadowRoot!.querySelector('.head-cell[data-field="name"] .head-sort')!
      .shadowRoot!.querySelector('.tip')!.textContent ?? '';
    const before = tip();
    grid.setAttribute('data-sort-field', 'name');
    grid.setAttribute('data-sort-direction', 'desc');
    await window.__settled(); await eval(wait);
    return { before, sorted: tip() };
  }, frames);
  expect(r).toEqual({ before: 'Sort by Name', sorted: 'Sorted by Name, descending' });
});

test('a chip switched OFF still shows its tooltip — on or off has no bearing (Will, 363)', async ({ page }) => {
  await page.evaluate(async () => {
    const bar = await window.__mount<Bar & { setChipReading(id: string, reading: unknown): void }>('sherpa-quick-filter-toolbar', [
      { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }], active: true },
    ], { style: 'inline-size: 1200px' });
    bar.setChipReading('plan', { picked: ['Pro', 'Free'] });
    await window.__settled();
  });
  const body = page.locator('sherpa-quick-filter-toolbar .chip[data-id="plan"] .body');
  const open = (): Promise<boolean> => page.evaluate(() => document.querySelector('sherpa-quick-filter-toolbar')!
    .shadowRoot!.querySelector('.chip[data-id="plan"]')!.shadowRoot!.querySelector('.tip')!.matches(':popover-open'));
  const text = (): Promise<string> => page.evaluate(() => document.querySelector('sherpa-quick-filter-toolbar')!
    .shadowRoot!.querySelector('.chip[data-id="plan"]')!.shadowRoot!.querySelector('.tip')!.textContent ?? '');
  await body.hover();
  await expect.poll(open).toBe(true);
  // Switched OFF, then hovered again: the same tip.
  await body.click();
  await page.mouse.move(0, 0);
  await expect.poll(open).toBe(false);
  await body.hover();
  await expect.poll(open).toBe(true);
  expect(await text()).toBe('Pro, Free');
});

/* A SECTION's tip is its header's: over a value chip, only that chip's own tip
   shows. Will, TODO 437 */
test('a section shows its tip over its header, never over its value chips', async ({ page }) => {
  await page.evaluate(async () => {
    const bar = await window.__mount<Bar & { setChipReading(id: string, reading: unknown): void }>('sherpa-quick-filter-toolbar',
      undefined, { 'data-orientation': 'portrait' });
    bar.populate!([{ id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro' }, { value: 'free', label: 'Free' }] }]);
    await window.__settled();
    bar.setChipReading('plan', { picked: ['pro'] });
    await window.__settled();
  });
  const section = page.locator('sherpa-quick-filter-toolbar .chips > .chip[data-id="plan"]');
  const open = (): Promise<boolean> => section.evaluate((s) => s.shadowRoot!.querySelector('.tip')!.matches(':popover-open'));
  expect(await section.getAttribute('data-layout')).toBe('section');
  const centre = (inValue: boolean) => section.evaluate((s, v) => {
    const host = v ? s.querySelector('.value')! : s;
    const r = host.shadowRoot!.querySelector('.body')!.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, inValue);
  const value = await centre(true);
  await page.mouse.move(value.x, value.y);
  await expect.poll(open).toBe(false);
  const header = await centre(false);
  await page.mouse.move(header.x, header.y);
  await expect.poll(open).toBe(true);
  await page.mouse.move(value.x, value.y);
  await expect.poll(open).toBe(false);
});

test('a RESET leaves a date chip with no value — a kept range holds no ends, never `undefined`; its face reads Today', async ({ page }) => {
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
    const now = new Date();
    return { fresh, set, emptied: face(), range: menu.hasAttribute('data-range'), today: `${now.getDate()} ${now.getFullYear()}` };
  }, frames);
  // No value; the face reads the default day, Today. TODO 394
  const [day, year] = r.today.split(' ');
  for (const empty of [r.fresh, r.emptied]) {
    expect(empty).toMatchObject({ values: [], start: null });
    expect(empty.label).toMatch(new RegExp(`^${day} \\S+ ${year}$`));
  }
  expect(r.set).toEqual(['2024-01-05', '2024-02-06']);
  // The shape is kept: it is still a range.
  expect(r.range).toBe(true);
});

/* TODO 130, second half: the toolbar and the panel each read, drew and emptied
   a chip in their own way. The CHIP has the one door now — `reading`, get and
   set, and `clear()` — for a list, a number and a date alike. */
test('a chip reads, draws and empties its own answer: a list, a number and a date', async ({ page }) => {
  const r = await page.evaluate(async (wait) => {
    type Door = Chip & { reading: Record<string, unknown> | null; clear(): void; readonly answered: boolean };
    const bar = await window.__mount<Bar & { readings: Record<string, Record<string, unknown>> }>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500 },
      { id: 'created', label: 'Date', kind: 'date', range: true },
      { id: 'plan', label: 'Plan', advanced: true, options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }] },
      { id: 'risk', label: 'At risk' },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = (id: string): Door => bar.shadowRoot!.querySelector(`.chip[data-id="${id}"]`)!;
    const settle = async (): Promise<void> => { await window.__settled(); await eval(wait); };
    const look = (id: string) => ({ on: chip(id).current, answered: chip(id).answered, picked: chip(id).reading?.['picked'], off: chip(id).reading?.['suspended'] });

    const empty = { seats: look('seats'), created: look('created'), plan: look('plan') };
    // DRAWN — silent, as every steer is.
    let heard = 0;
    bar.addEventListener('quick-filter-change', () => { heard += 1; });
    chip('seats').reading = { picked: ['37'] };
    chip('created').reading = { picked: ['2024-01-05', '2024-02-06'], range: true };
    chip('plan').reading = { picked: ['Pro'] };
    await settle();
    const drawn = { seats: look('seats'), created: look('created'), plan: look('plan') };
    // The bar reports what each chip says.
    const reported = Object.fromEntries(Object.entries(bar.readings).map(([id, x]) => [id, [x['picked'], x['suspended']]]));

    // SUSPENDED: the answer is kept, and the chip is off.
    chip('plan').reading = { picked: ['Pro'], suspended: true };
    await settle();
    const suspended = look('plan');
    // Rows answer it too: Advanced, and on.
    chip('plan').reading = { picked: [], mode: 'advanced', conditions: [{ op: 'contains', text: 'Pr' }] };
    await settle();
    const rows = { ...look('plan'), mode: chip('plan').reading?.['mode'] };

    // EMPTIED: every kind, and off.
    for (const id of ['seats', 'created', 'plan']) chip(id).clear();
    await settle();
    const cleared = { seats: look('seats'), created: look('created'), plan: { ...look('plan'), mode: chip('plan').reading?.['mode'] } };
    // A toggle chip answers no field.
    return { empty, drawn, reported, suspended, rows, cleared, toggle: chip('risk').reading, heard };
  }, frames);

  for (const id of ['seats', 'created', 'plan'] as const) {
    expect(r.empty[id]).toMatchObject({ on: false, answered: false, off: true });
    expect(r.cleared[id]).toMatchObject({ on: false, answered: false, off: true });
  }
  expect(r.drawn.seats).toEqual({ on: true, answered: true, picked: ['37'], off: undefined });
  expect(r.drawn.created).toEqual({ on: true, answered: true, picked: ['2024-01-05', '2024-02-06'], off: undefined });
  expect(r.drawn.plan).toEqual({ on: true, answered: true, picked: ['Pro'], off: undefined });
  expect(r.reported).toEqual({
    seats: [['37'], false], created: [['2024-01-05', '2024-02-06'], false], plan: [['Pro'], false],
  });
  expect(r.suspended).toEqual({ on: false, answered: true, picked: ['Pro'], off: true });
  expect(r.rows).toMatchObject({ on: true, answered: true, mode: 'advanced' });
  expect(r.cleared.plan.mode).toBe('simple');
  expect(r.cleared.seats.picked).toEqual([]);
  expect(r.toggle).toBeNull();
  expect(r.heard).toBe(0);
});
