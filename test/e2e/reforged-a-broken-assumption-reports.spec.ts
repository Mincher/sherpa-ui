import { test, expect, type Bar } from './harness';

/**
 * THE COMPONENTS REPORT THROUGH THE SAME CHANNEL.
 *
 * A host that names a filter the bar does not offer, sets a clause on a chip
 * that cannot hold one, or hands the panel a field with nothing to draw, used
 * to get an empty screen and no explanation. One `onReport` sink now catches
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

      // Three host mistakes, each naming something that is not there.
      el.addFilters(['nothing-offers-this']);
      el.removeFilter('never-held');
      el.setClause('plan', ['plan', 'contains', 'pro']);   // a chip with a menu — fine
      el.setClause('not-a-chip', ['x', 'contains', 'y']);  // …and one without

      undo();
      return seen.map((s) => s.code);
    });

    expect(r).toEqual(['unknown-filter', 'unknown-filter', 'no-filter-menu']);
  });

test('the panel reports a field it cannot draw, naming its scope', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { onReport } = await import('/dist/data.js') as {
      onReport(fn: ((r: {
        code: string; at?: Record<string, string> }) => void) | null): () => void;
    };
    const seen: Array<{ code: string; at?: Record<string, string> }> = [];
    const undo = onReport((issue) => seen.push(issue));

    const el = await window.__mount('sherpa-filter-panel');
    (el as unknown as { populate(d: unknown): void }).populate([{
      scope: 'data',
      label: 'Records',
      filters: [
        { id: 'status', label: 'Status', options: [{ value: 'live', label: 'Live' }] },
        // NO options and NO body of its own — nothing to draw at all.
        { id: 'ghost', label: 'Ghost' },
      ],
    }]);
    await window.__settled();

    undo();
    return {
      codes: seen.map((s) => s.code),
      at: seen.find((s) => s.code === 'undrawable-filter')?.at,
      // …and the field that COULD be drawn still was.
      drawn: [...el.shadowRoot!.querySelectorAll('.field')].map(
        (f) => (f as HTMLElement).dataset['field'],
      ),
    };
  });

  expect(r.codes).toContain('undrawable-filter');
  // Rule 5: every report names the thing.
  expect(r.at).toMatchObject({ scope: 'data', id: 'ghost' });
  // The scope is not abandoned because one field was wrong.
  expect(r.drawn).toEqual(['status']);
});
