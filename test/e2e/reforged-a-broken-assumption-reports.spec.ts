import { test, expect, type Bar } from './harness';

/**
 * THE COMPONENTS REPORT THROUGH THE SAME CHANNEL.
 *
 * A host that names a filter the bar does not offer, or sets a clause on a chip
 * that cannot hold one, used to get an empty screen and no explanation. One `onReport` sink now catches
 * every one of them, and an app can route or silence a kind by its `code`.
 *
 * TRAP T-a-broken-assumption-reports
 */

test('a bar reports an unknown filter on add, on remove, and on setClause',
  async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { onReport } = await import('/dist/data.js') as {
        onReport(fn: ((r: { code: string; message: string }) => void) | null): () => void;
      };
      const seen: Array<{ code: string; message: string }> = [];
      const undo = onReport((issue) => seen.push(issue));

      const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
        { id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro' }] },
      ]);
      el.available([{ id: 'owner', label: 'Owner', options: [{ value: 'Dana', label: 'Dana' }] }]);
      await window.__settled();

      // Two host mistakes, each naming something that is not there.
      el.addFilters(['nothing-offers-this']);
      el.removeFilter('never-held');

      undo();
      return seen.map((s) => s.code);
    });

    expect(r).toEqual(['unknown-filter', 'unknown-filter']);
  });
