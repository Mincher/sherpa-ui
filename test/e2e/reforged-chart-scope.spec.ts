import { test, expect, type Page } from '@playwright/test';

/**
 * A CHART'S OWN SCOPE IN THE FILTER PANEL — TODO 52.
 *
 * Will, 2026-09-30: "I'd expect them between the view and grid scope
 * accordions. They will only have 1 filter section. Each is just a Simple
 * filter with a chip per legend item (might be nice to include the swatch
 * where the left icon usually is). … component scope filters don't affect
 * other component scopes. Filters should be elevated to view scope to achieve
 * that."
 *
 * Runs against the EXAMPLES server (:4200). Records is the hard page: its bar
 * chart segments by `status`, a field the grid's scope holds too.
 * TRAP T-a-chart-scope-is-its-legend-field
 */
test.use({ viewport: { width: 1600, height: 1200 } });

const BAR = 'picks:r-bar-legend';

async function open(page: Page): Promise<void> {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row')
    && !!document.querySelector('#r-bar')?.shadowRoot?.querySelector('.bar'));
  await page.evaluate(() => {
    (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = 'panel';
  });
  await expect.poll(() => page.evaluate((scope) => !!(document.querySelector('#filter-panel') as HTMLElement)
    .shadowRoot!.querySelector(`.scope[data-scope="${scope}"] .value`), BAR)).toBe(true);
}

/** What the page shows now: each scope's ticked chips, the chart, its legend, the rows. */
const read = (page: Page): Promise<{
  scopes: Record<string, Record<string, string[]>>; bars: number; legend: string[]; total: number; donut: number;
}> => page.evaluate(() => {
  const q = <T extends Element>(s: string): T => document.querySelector<T>(s)!;
  const panel = q<HTMLElement>('#filter-panel').shadowRoot!;
  const scopes: Record<string, Record<string, string[]>> = {};
  for (const box of panel.querySelectorAll<HTMLElement>('.field[data-scope]')) {
    (scopes[box.dataset['scope']!] ??= {})[box.dataset['field']!] =
      [...box.querySelectorAll<HTMLElement>('.value[data-current]')].map((c) => c.dataset['value']!);
  }
  type App = { sherpa: { source: { debugState(): { total: number } } } };
  return {
    scopes,
    bars: q('#r-bar').shadowRoot!.querySelectorAll('.bar').length,
    legend: (q('#r-bar-legend') as HTMLElement & { picked: string[] }).picked,
    total: (window as unknown as App).sherpa.source.debugState().total,
    donut: q('#r-donut').shadowRoot!.querySelectorAll('.segment').length,
  };
});

/** Press a value chip's body — the control a reader presses. */
const press = (page: Page, scope: string, value: string): Promise<void> => page.evaluate(([s, v]) => {
  (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
    .querySelector<HTMLElement>(`.scope[data-scope="${s}"] .value[data-value="${v}"]`)!
    .shadowRoot!.querySelector<HTMLElement>('.body')!.click();
}, [scope, value]);

test('each chart has a section between the View and the grid: one filter, a chip per legend item, with its swatch', async ({ page }) => {
  await open(page);
  const r = await page.evaluate((bar) => {
    const panel = (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!;
    const box = panel.querySelector<HTMLElement>(`.scope[data-scope="${bar}"]`)!;
    const paint = (el: Element): string => getComputedStyle(el).backgroundColor;
    const legend = document.querySelector('#r-bar-legend')!.shadowRoot!;
    return {
      order: [...panel.querySelectorAll<HTMLElement>('.scope')].map((a) => a.dataset['scope']),
      heading: box.dataset['heading'],
      fields: [...box.querySelectorAll<HTMLElement>('.field')].map((f) => f.dataset['field']),
      // Nothing to add, to save, or to switch to Advanced.
      add: box.hasAttribute('data-can-add'),
      advanced: !!box.querySelector('.field-advanced'),
      chips: [...box.querySelectorAll<HTMLElement>('.value')].map((c) => c.dataset['value']),
      swatches: [...box.querySelectorAll<HTMLElement>('.value')].map((c) => paint(c.shadowRoot!.querySelector('.swatch')!)),
      shown: [...box.querySelectorAll<HTMLElement>('.value')].every((c) =>
        c.shadowRoot!.querySelector<HTMLElement>('.swatch')!.getBoundingClientRect().width === 12),
      legend: [...legend.querySelectorAll<HTMLElement>('.item')].map((i) => i.querySelector('.label')!.textContent),
      legendSwatches: [...legend.querySelectorAll<HTMLElement>('.item .swatch')].map(paint),
    };
  }, BAR);

  expect(r.order).toEqual(['view', BAR, 'picks:r-donut-legend', 'data']);
  expect(r.heading).toBe('By status');
  expect(r.fields).toEqual(['status']);
  expect(r.add).toBe(false);
  expect(r.advanced).toBe(false);
  expect(r.chips).toEqual(r.legend);
  expect(r.shown).toBe(true);
  // The SAME paint as the legend's, item for item.
  expect(r.swatches).toEqual(r.legendSwatches);
  expect(new Set(r.swatches).size).toBe(r.swatches.length);
});

test('a chip narrows its chart alone; the legend and the chip follow each other; the grid and the other chart do not', async ({ page }) => {
  await open(page);
  const start = await read(page);
  const [first, second] = start.legend.length ? start.legend : await page.evaluate(() =>
    [...document.querySelector('#r-bar-legend')!.shadowRoot!.querySelectorAll('.item .label')].map((l) => l.textContent!));

  await press(page, BAR, first!);
  await expect.poll(async () => (await read(page)).bars).toBe(1);
  let now = await read(page);
  expect(now.legend).toEqual([first]);
  expect(now.scopes[BAR]).toEqual({ status: [first] });
  // The grid holds `status` too: its own chips, its rows and the other chart stay.
  expect(now.scopes['data']!['status']).toEqual([]);
  expect(now.total).toBe(start.total);
  expect(now.donut).toBe(start.donut);

  // The LEGEND switches a second one on: the panel's chip follows.
  await page.evaluate(() => {
    (document.querySelector('#r-bar-legend')!.shadowRoot!.querySelectorAll<HTMLElement>('.item')[1]!).click();
  });
  await expect.poll(async () => (await read(page)).scopes[BAR]!['status']).toEqual([first, second]);
  expect((await read(page)).bars).toBe(2);

  // Clear puts every bar back.
  await page.evaluate((bar) => {
    (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
      .querySelector<HTMLElement>(`.scope[data-scope="${bar}"] .field-clear`)!
      .shadowRoot!.querySelector<HTMLElement>('button')!.click();
  }, BAR);
  await expect.poll(async () => (await read(page)).bars).toBe(start.bars);
  now = await read(page);
  expect(now.legend).toEqual([]);
  expect(now.scopes[BAR]).toEqual({ status: [] });
});

test('SENT UP to the View, a chart\'s answer narrows every component, and its section says where it went', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=dashboard');
  await page.waitForFunction(() => !!document.querySelector('#bar')?.shadowRoot?.querySelector('.bar'));
  await page.evaluate(() => {
    (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = 'panel';
  });
  const scope = 'picks:bar-legend';
  await expect.poll(() => page.evaluate((s) => !!(document.querySelector('#filter-panel') as HTMLElement)
    .shadowRoot!.querySelector(`.scope[data-scope="${s}"] .value`), scope)).toBe(true);
  const alerts = (): Promise<string> => page.evaluate(() =>
    document.querySelector('#m-endpoints')!.shadowRoot!.querySelector('.value')!.textContent ?? '');
  const all = await alerts();

  await press(page, scope, 'Disk');
  await expect.poll(() => page.evaluate(() => document.querySelector('#bar')!.shadowRoot!.querySelectorAll('.bar').length)).toBe(1);
  // Its own chart only: the tile still counts every alert.
  expect(await alerts()).toBe(all);

  await page.evaluate((s) => {
    (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
      .querySelector<HTMLElement>(`.scope[data-scope="${s}"] .field-raise`)!
      .shadowRoot!.querySelector<HTMLElement>('button')!.click();
  }, scope);
  await expect.poll(alerts).not.toBe(all);
  const r = await page.evaluate((s) => {
    const panel = (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!;
    const view = panel.querySelector<HTMLElement>('.scope[data-scope="view"] .field[data-field="category"]');
    const part = panel.querySelector<HTMLElement>(`.scope[data-scope="${s}"] .field[data-field="category"]`)!;
    return {
      view: [...(view?.querySelectorAll<HTMLElement>('.value[data-current]') ?? [])].map((c) => c.dataset['value']),
      above: part.hasAttribute('data-applied-at'),
      chips: part.querySelectorAll('.value').length,
      legend: (document.querySelector('#bar-legend') as HTMLElement & { picked: string[] }).picked,
    };
  }, scope);
  // The legend shows the VIEW's answer now: it is the one in force (159).
  expect(r).toEqual({ view: ['Disk'], above: true, chips: 0, legend: ['Disk'] });
});

/**
 * Will, TODO 159: "When a data viz filter is added to the view scope then
 * clicking on a legend item should adjust values at the view scope as well as
 * toggling the legend item active state."
 * TRAP T-a-legend-follows-the-view-when-it-holds-the-field
 */
test('while the View holds a chart\'s field, a legend press changes the VIEW\'s values and every component', async ({ page }) => {
  await open(page);
  type Source = { debugState(): { total: number };
    query: { applied: { scopes: Record<string, { readings: Record<string, { picked?: string[] }> } | undefined> } } };
  const state = (): Promise<{ view: string[]; own: string[] | null; chips: string[]; legend: string[]; bars: number; total: number }> =>
    page.evaluate((s) => {
      const source = (window as unknown as { sherpa: { source: Source } }).sherpa.source;
      const panel = (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!;
      return {
        view: source.query.applied.scopes['view']?.readings['status']?.picked ?? [],
        own: source.query.applied.scopes[s]?.readings['status']?.picked ?? null,
        chips: [...panel.querySelectorAll<HTMLElement>('.scope[data-scope="view"] .field[data-field="status"] .value[data-current]')]
          .map((c) => c.dataset['value']!),
        legend: (document.querySelector('#r-bar-legend') as HTMLElement & { picked: string[] }).picked,
        bars: document.querySelector('#r-bar')!.shadowRoot!.querySelectorAll('.bar').length,
        total: source.debugState().total,
      };
    }, BAR);
  const legendItem = (n: number): Promise<void> => page.evaluate((i) => {
    (document.querySelector('#r-bar-legend')!.shadowRoot!.querySelectorAll<HTMLElement>('.item')[i]!).click();
  }, n);
  const names = await page.evaluate(() =>
    [...document.querySelector('#r-bar-legend')!.shadowRoot!.querySelectorAll('.item .label')].map((l) => l.textContent!));
  const [a, b, c] = names as [string, string, string];
  const all = (await state()).total;

  // Two values, in the chart's own scope — the grid keeps every row — then UP to the View.
  await press(page, BAR, a);
  await press(page, BAR, b);
  await expect.poll(async () => (await state()).own).toEqual([a, b]);
  expect((await state()).total).toBe(all);
  await page.evaluate((s) => {
    (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
      .querySelector(`.scope[data-scope="${s}"] .field-raise`)!.shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
  }, BAR);
  await expect.poll(state).toMatchObject({ view: [a, b], own: null, legend: [a, b] });
  await expect.poll(async () => (await state()).total).toBeLessThan(all);
  const two = (await state()).total;

  // The LEGEND switches the second off: the View's values change, its chips follow, the grid narrows.
  await legendItem(1);
  await expect.poll(state).toMatchObject({ view: [a], own: null, chips: [a], legend: [a], bars: 1 });
  await expect.poll(async () => (await state()).total).toBeLessThan(two);

  // …and the third on.
  await legendItem(2);
  await expect.poll(state).toMatchObject({ view: [a, c], own: null, chips: [a, c], legend: [a, c], bars: 2 });
});
