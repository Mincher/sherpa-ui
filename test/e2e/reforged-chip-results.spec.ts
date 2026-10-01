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