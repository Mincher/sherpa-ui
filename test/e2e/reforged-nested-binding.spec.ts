import { test, expect } from './harness';

/**
 * A control bound INSIDE another is heard by its own binding only — TODO 512.
 * The panel is a column bar holding a bar per scope, each bound on its own;
 * the column's binding heard its section bars' events too.
 * TRAP T-a-nested-control-steers-through-its-own-binding
 */
test('a press in a panel section steers through its own bar\'s binding alone', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore, onReport } = await import('/dist/index.js');
    const seen = [];
    const undo = onReport((x) => seen.push(x.code));
    const provider = document.createElement('sherpa-provider');
    provider.innerHTML = '<sherpa-overlay-panel open data-heading="Filters"><sherpa-filter-panel data-scope="view data"></sherpa-filter-panel></sherpa-overlay-panel>';
    document.getElementById('root').replaceChildren(provider);
    const column = provider.querySelector('sherpa-filter-panel');
    const rows = [{ id: 1, plan: 'Pro', tier: 'gold' }, { id: 2, plan: 'Free', tier: 'gold' }, { id: 3, plan: 'Pro', tier: 'silver' }];
    const source = await provider.open({
      v: 1, id: 'plans',
      source: {
        store: 'plans', fields: { plan: { label: 'Plan' }, tier: { label: 'Tier' } },
        scopes: { view: { label: 'View', holds: ['tier'] }, data: { label: 'Rows', holds: ['plan'] } },
      },
    }, { stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
    const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    await settle();
    let changes = 0;
    source.query.addEventListener('query-change', () => { changes++; });
    const bar = column.shadowRoot.querySelector('[data-scope="data"]');
    // The section's own menu row: an event of the SECTION bar's.
    bar.shadowRoot.querySelector('.chips > .chip[data-id="plan"] sherpa-menu').querySelector('.menu-row:not(.qf-all) input[value="Pro"]').click();
    await settle();
    undo();
    return { unscoped: seen.filter((c) => c === 'bar-without-scope').length, plan: source.query.applied.scopes.data?.readings?.plan?.picked ?? null, changes };
  })()`) as { unscoped: number; plan: string[] | null; changes: number };
  expect(r.unscoped).toBe(0);
  expect(r.plan).toEqual(['Pro']);
  expect(r.changes).toBeGreaterThan(0);
});
