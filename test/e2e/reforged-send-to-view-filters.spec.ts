import { test, expect } from '@playwright/test';

/**
 * SEND TO VIEW FILTERS — TODO 21f, Will: a component's filter, raised from its
 * panel section to the View's, so it trickles down across the whole view. Its
 * answer goes with it, and the header gets ONE chip for it. Runs against the
 * EXAMPLES server (:4200).
 * TRAP T-send-to-view-filters
 */
test('a Records field sent to the view filters takes its answer, once, and the rows stay', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records&view=risk');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  // The page hands out its source a moment after its first rows draw.
  await page.waitForFunction(() => !!(window as unknown as { sherpa?: { source?: unknown } }).sherpa?.source);
  await page.evaluate(() => {
    (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = 'panel';
  });
  const raise = () => page.evaluate(() => (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
    .querySelector<HTMLElement>('.scope[data-scope="data"] .field[data-field="status"] .field-raise'));
  await expect.poll(async () => !!(await raise())).toBe(true);
  const r = await page.evaluate(async () => {
    type Source = {
      debugState(): { total: number }; scope(s: string): string[];
      query: { applied: { scopes: Record<string, { readings: Record<string, unknown> }> } };
    };
    const source = (window as unknown as { sherpa: { source: Source } }).sherpa.source;
    const panel = (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!;
    const button = panel.querySelector<HTMLElement>('.scope[data-scope="data"] .field[data-field="status"] .field-raise')!;
    const before = { total: source.debugState().total, label: button.getAttribute('aria-label') };
    button.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await new Promise((res) => setTimeout(res, 1000));
    const header = [...document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')!
      .shadowRoot!.querySelectorAll<HTMLElement>('.chips > .chip')].map((c) => c.dataset['id']);
    return {
      before,
      // The View's own fields have nothing to send up.
      onView: panel.querySelectorAll('.scope[data-scope="view"] .field-raise').length,
      total: source.debugState().total,
      held: source.scope('view').includes('status'),
      reading: source.query.applied.scopes['view']?.readings['status'] ?? null,
      statusChips: header.filter((id) => id === 'status').length,
    };
  });
  expect(r.before.label).toBe('Send Status to view filters');
  expect(r.onView).toBe(0);
  // Raised WITH its answer, so the rows do not move.
  expect(r).toMatchObject({ total: r.before.total, held: true, reading: { op: 'ne', picked: ['churned'] }, statusChips: 1 });
});

/**
 * …AND DOWN — TODO 120, Will: "'Send filter to View' should have a counterpart
 * button in the view context to 'Send to &componentScopeName' with a down
 * arrow icon." The View lets go; the answer goes with the field.
 */
test('a View field is sent DOWN to the one scope that has it, with its answer, and the rows stay', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await page.evaluate(() => {
    (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = 'panel';
  });
  const at = '.scope[data-scope="view"] .field[data-field="region"]';
  await expect.poll(() => page.evaluate((sel) => !!(document.querySelector('#filter-panel') as HTMLElement)
    .shadowRoot!.querySelector(`${sel} .value`), at)).toBe(true);
  // Answer it: the pair shows once there is something to send.
  await page.evaluate((sel) => {
    (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
      .querySelector<HTMLElement>(`${sel} .value[data-value="EMEA"]`)!.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
  }, at);
  type Source = {
    debugState(): { total: number }; scope(s: string): string[];
    query: { applied: { scopes: Record<string, { readings: Record<string, { picked?: string[] }> } | undefined> } };
  };
  const total = (): Promise<number> => page.evaluate(() =>
    (window as unknown as { sherpa: { source: Source } }).sherpa.source.debugState().total);
  await expect.poll(total).toBeLessThan(100);
  const before = await total();

  const r = await page.evaluate(async (sel) => {
    const source = (window as unknown as { sherpa: { source: Source } }).sherpa.source;
    const panel = (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!;
    const button = panel.querySelector<HTMLElement>(`${sel} .field-lower`)!;
    const glyph = button.getAttribute('data-icon-start');
    const label = button.getAttribute('aria-label');
    const group = [...button.parentElement!.children].map((b) => b.className);
    button.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await new Promise((res) => setTimeout(res, 1000));
    const chips = (bar: string): (string | undefined)[] => [...document.querySelector(bar)!
      .shadowRoot!.querySelectorAll<HTMLElement>('.chips > .chip')].map((c) => c.dataset['id']);
    return {
      glyph, label, group,
      view: source.scope('view').includes('region'),
      data: source.scope('data').includes('region'),
      reading: source.query.applied.scopes['data']?.readings['region']?.picked ?? null,
      ofView: source.query.applied.scopes['view']?.readings['region'] ?? null,
      header: chips('sherpa-quick-filter-toolbar[data-type="view"]').includes('region'),
      bar: chips('#qft').filter((id) => id === 'region').length,
      // In the panel it is the grid's field now, and can go up again.
      panel: !!panel.querySelector('.scope[data-scope="data"] .field[data-field="region"] .field-raise'),
      gone: !panel.querySelector(sel),
    };
  }, at);
  expect(r).toEqual({
    glyph: 'arrow-down', label: 'Send Region to Customer records', group: ['field-clear', 'field-lower'],
    view: false, data: true, reading: ['EMEA'], ofView: null, header: false, bar: 1, panel: true, gone: true,
  });
  expect(await total()).toBe(before);
});

/**
 * WILL'S BUG, TODO 158: "I can't move data viz filters back down from the view
 * scope." On Records the chart's field is the grid's too, so TWO scopes may
 * take it — and the source offered neither unless it remembered where the
 * field came up from, which a reload forgets. It offers both now, and the
 * reader picks.
 */
test('a chart\'s filter in the View goes back DOWN to its chart, after a reload too', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1700, height: 1200 });
  const open = async (): Promise<void> => {
    await page.waitForFunction(() => !!document.querySelector('#r-bar')?.shadowRoot?.querySelector('.bar'));
    await page.evaluate(() => {
      (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = 'panel';
    });
  };
  await page.goto('http://localhost:4200/?context=records');
  await open();
  const chart = 'picks:r-bar-legend';
  const field = (scope: string) => page.locator(`#filter-panel .scope[data-scope="${scope}"] .field[data-field="status"]`);
  /** Press a field's own header button — its trigger, not a row of its menu. */
  const press = (scope: string, button: string): Promise<void> => page.evaluate(([s, b]) => {
    (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
      .querySelector(`.scope[data-scope="${s}"] .field[data-field="status"] .${b}`)!
      .shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
  }, [scope, button]);
  type Source = { debugState(): { total: number }; scope(s: string): string[];
    query: { applied: { scopes: Record<string, { readings: Record<string, { picked?: string[] }> } | undefined> } } };
  const read = (): Promise<{ view: boolean; chart: string[] | null; total: number; bars: number }> => page.evaluate((s) => {
    const source = (window as unknown as { sherpa: { source: Source } }).sherpa.source;
    return {
      view: source.scope('view').includes('status'),
      chart: source.query.applied.scopes[s]?.readings['status']?.picked ?? null,
      total: source.debugState().total,
      bars: document.querySelector('#r-bar')!.shadowRoot!.querySelectorAll('.bar').length,
    };
  }, chart);

  await expect.poll(() => field(chart).locator('.value').count()).toBeGreaterThan(0);
  const all = (await read()).total;
  const first = await field(chart).locator('.value').first().getAttribute('data-value');
  await field(chart).locator('.value').first().locator('.body').click();
  await expect.poll(async () => (await read()).chart).toEqual([first]);
  await press(chart, 'field-raise');
  await expect.poll(async () => (await read()).view).toBe(true);
  await expect.poll(async () => (await read()).total).toBeLessThan(all);

  // A RELOAD: the View still holds it, and the source remembers nothing.
  await page.reload();
  await open();
  await expect.poll(() => field('view').locator('.field-lower').count()).toBe(1);
  const lower = field('view').locator('.field-lower');
  expect(await lower.getAttribute('aria-label')).toBe('Send Status to a scope');
  await expect(lower.locator('.lower-item')).toHaveText(['Send to Customer records', 'Send to By status']);

  await press('view', 'field-lower');
  await lower.locator('.lower-item', { hasText: 'Send to By status' }).click();
  // The chart alone again: its answer, every row, one bar.
  await expect.poll(read).toEqual({ view: false, chart: [first], total: all, bars: 1 });
});

/**
 * WILL'S BUG, TODO 168: "If I send a filter from component scope A to View
 * scope then back to component scope B then the filter shows again in
 * component scope A. A filter should only ever be in 1 scope at any time."
 */
test('sent from the grid to the View, then down to a chart, the filter is in the chart alone', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1700, height: 1200 });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() => !!document.querySelector('#r-bar')?.shadowRoot?.querySelector('.bar')
    && !!(window as unknown as { sherpa?: { source?: unknown } }).sherpa?.source);
  await page.evaluate(() => {
    (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = 'panel';
  });
  const chart = 'picks:r-bar-legend';
  const field = (scope: string) => page.locator(`#filter-panel .scope[data-scope="${scope}"] .field[data-field="status"]`);
  const press = (scope: string, button: string): Promise<void> => page.evaluate(([s, b]) => {
    (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
      .querySelector(`.scope[data-scope="${s}"] .field[data-field="status"] .${b}`)!
      .shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
  }, [scope, button]);
  type Source = { debugState(): { total: number }; scope(s: string): string[];
    query: { applied: { scopes: Record<string, { readings: Record<string, { picked?: string[] }> } | undefined> } } };
  const read = (): Promise<{ view: boolean; grid: boolean; chart: string[] | null; panelGrid: number; bar: number; total: number }> =>
    page.evaluate((s) => {
      const source = (window as unknown as { sherpa: { source: Source } }).sherpa.source;
      return {
        view: source.scope('view').includes('status'),
        grid: source.scope('data').includes('status'),
        chart: source.query.applied.scopes[s]?.readings['status']?.picked ?? null,
        // In the panel's grid section, and on the grid's own bar.
        panelGrid: (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
          .querySelectorAll('.scope[data-scope="data"] .field[data-field="status"]').length,
        bar: document.querySelector('#qft')!.shadowRoot!.querySelectorAll('.chips > .chip[data-id="status"]').length,
        total: source.debugState().total,
      };
    }, chart);

  await expect.poll(() => field('data').locator('.value').count()).toBeGreaterThan(0);
  const all = (await read()).total;
  const first = await field('data').locator('.value').first().getAttribute('data-value');
  await field('data').locator('.value').first().locator('.body').click();
  await expect.poll(async () => (await read()).total).toBeLessThan(all);

  // UP from the grid: the grid keeps a place for it, and says where it went.
  await press('data', 'field-raise');
  await expect.poll(read).toMatchObject({ view: true, grid: true, panelGrid: 1 });

  // DOWN to the chart.
  await press('view', 'field-lower');
  await field('view').locator('.field-lower .lower-item', { hasText: 'Send to By status' }).click();
  // In the chart ALONE: the grid has let go of it — in the Query, in the panel, on its bar.
  await expect.poll(read).toEqual({ view: false, grid: false, chart: [first], panelGrid: 0, bar: 0, total: all });
});
