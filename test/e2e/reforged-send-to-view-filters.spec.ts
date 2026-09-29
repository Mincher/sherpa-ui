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
