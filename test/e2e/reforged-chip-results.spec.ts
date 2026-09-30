import { test, expect, type Bar } from './harness';

/**
 * A CHIP'S BADGE IS ITS RESULTS — TODO 60. The rows its OWN answer matches, as
 * its source counted them; shown on or off (TODO 123), and never while pending.
 * TRAP T-a-chip-counts-its-own-results
 */
test('a chip shows the results it is drawn, on or off, and none while pending', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<Bar & { drawResults(r: Record<string, number>): void }>(
      'sherpa-quick-filter-toolbar', [
        { id: 'plan', label: 'Plan', select: 'multiple', active: true,
          options: [{ value: 'Pro', label: 'Pro', selected: true }, { value: 'Free', label: 'Free' }] },
        { id: 'tier', label: 'Tier', select: 'multiple', options: [{ value: 'Gold', label: 'Gold' }] },
      ], { 'data-remote': '' });
    await window.__settled();
    const chip = (id: string) => bar.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
    const look = (id: string) => ({
      count: chip(id).dataset['count'] ?? null,
      said: chip(id).shadowRoot!.querySelector('.count')?.getAttribute('aria-label') ?? null,
    });
    const before = look('plan');
    bar.drawResults({ plan: 1234, tier: 9 });
    await window.__settled();
    const drawn = { plan: look('plan'), tier: look('tier') };
    bar.setAttribute('data-pending', 'plan');
    await window.__settled();
    const pending = look('plan');
    bar.removeAttribute('data-pending');
    await window.__settled();
    return { before, drawn, pending, after: look('plan') };
  });
  expect(r.before).toEqual({ count: null, said: null });
  // Its number, in the reader's own digits — off (Tier) too: the source counts
  // only a chip that holds an answer. Will, TODO 123.
  expect(r.drawn).toEqual({ plan: { count: '1,234', said: '1,234 results' }, tier: { count: '9', said: '9 results' } });
  // A draft has no results yet.
  expect(r.pending).toEqual({ count: null, said: null });
  expect(r.after).toEqual({ count: '1,234', said: '1,234 results' });
});

/**
 * ON THE RECORDS PAGE: At risk. Each chip counts its OWN answer — not the 13
 * rows the whole filter leaves. Runs against the EXAMPLES server (:4200).
 */
test('on Records, each answered chip shows the rows its own answer matches', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records&view=risk');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const read = () => page.evaluate(async () => {
    type Source = { debugState(): { total: number }; results(s: string): Promise<Record<string, number>> };
    const source = (window as unknown as { sherpa: { source: Source } }).sherpa.source;
    const bar = document.querySelector('#qft') as HTMLElement;
    const chips = Object.fromEntries([...bar.shadowRoot!.querySelectorAll<HTMLElement>('.chips > .chip')]
      .map((c) => [c.dataset['id'], c.dataset['count'] ?? null]));
    return { total: source.debugState().total, counted: await source.results('data'), chips };
  });
  await expect.poll(async () => (await read()).chips['openTickets']).not.toBeNull();
  const r = await read();
  expect(r.total).toBe(13);
  // Each answered chip wears ITS count, and every one is more than the 13.
  for (const [id, n] of Object.entries(r.counted)) {
    expect(r.chips[id]).toBe(String(n));
    expect(n).toBeGreaterThan(r.total);
  }
  expect(Object.keys(r.counted).sort()).toEqual(['at-risk', 'openTickets', 'status']);
  // An unanswered chip shows none.
  expect(r.chips['plan']).toBeNull();
});

/**
 * OFF KEEPS ITS BADGE — Will, TODO 123: "Don't hide the match count badge when
 * a filter chip is set to inactive. Only remove the badge when all
 * values/conditions are removed from the filter."
 */
test('on Records, a chip switched OFF keeps its number, and an emptied one loses it', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records&view=risk');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const chip = (): Promise<{ on: boolean; count: string | null; tip: string }> => page.evaluate(() => {
    const c = document.querySelector('#qft')!.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="status"]')!;
    return { on: c.hasAttribute('data-current'), count: c.dataset['count'] ?? null,
      tip: c.shadowRoot!.querySelector<HTMLElement>('.count-wrap')!.dataset['text'] ?? '' };
  });
  type Source = { debugState(): { total: number } };
  const total = (): Promise<number> => page.evaluate(() =>
    (window as unknown as { sherpa: { source: Source } }).sherpa.source.debugState().total);
  await expect.poll(async () => (await chip()).count).not.toBeNull();
  const before = await chip();
  const rows = await total();
  expect(before.on).toBe(true);

  // OFF: the rows widen, the number stays, and the tip says nothing.
  await page.evaluate(() => document.querySelector('#qft')!.shadowRoot!
    .querySelector('.chip[data-id="status"]')!.shadowRoot!.querySelector<HTMLElement>('.body')!.click());
  await expect.poll(total).toBeGreaterThan(rows);
  await expect.poll(chip).toEqual({ on: false, count: before.count, tip: '' });

  // EMPTIED: nothing left to count.
  await page.evaluate(() => (document.querySelector('#qft') as HTMLElement & {
    setChipReading(id: string, r: unknown): void; report(): void }).setChipReading('status', { picked: [] }));
  await page.evaluate(() => (document.querySelector('#qft') as HTMLElement & { report(): void }).report());
  await expect.poll(async () => (await chip()).count).toBeNull();
});
