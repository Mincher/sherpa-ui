import { test, expect } from './harness';

/**
 * ONE BODY DRAW PER ACT — plan 695 P4. A bound grid is told a heading's new answer
 * before its source has read the rows that answer leaves: the heading draws then,
 * the body once, with the rows. It drew twice: the old rows under the new answer,
 * then the new rows. TRAP T-a-grid-draws-once-per-moment
 */

const ROWS = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}`, tier: i % 5 === 0 ? 'Gold' : 'Silver' }));

type Grid = HTMLElement & { columns: unknown[]; key: string };

test('a heading\'s answer and its rows draw the body once; the same answer again, not at all', async ({ page }) => {
  const r = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const provider = document.createElement('sherpa-provider') as HTMLElement & { provide(o: unknown): void };
    document.getElementById('root')!.replaceChildren(provider);
    provider.innerHTML = '<sherpa-data-grid data-scope="data" data-column-filters></sherpa-data-grid>';
    const grid = provider.querySelector('sherpa-data-grid') as Grid;
    grid.columns = [{ field: 'name', header: 'Name' }, { field: 'tier', header: 'Tier' }];
    grid.key = 'id';
    const source = new DataSource({ store: new ArrayStore(data, { key: 'id' }) });
    source.declareValues('tier', ['Gold', 'Silver']);
    source.query.ask({ scope: 'data', hold: ['tier'] });
    provider.provide({ sources: { rows: source } });
    await source.load();
    await window.__settled();
    const sr = grid.shadowRoot!;
    let draws = 0;
    new MutationObserver((list) => { draws += list.filter((m) => m.removedNodes.length > 0).length; })
      .observe(sr.querySelector('.body')!, { childList: true });
    const act = async (reading: Record<string, unknown>): Promise<{ draws: number; rows: number; on: boolean }> => {
      draws = 0;
      source.query.ask({ scope: 'data', field: 'tier', reading });
      await source.load();
      await window.__settled();
      return { draws, rows: sr.querySelectorAll('.row').length, on: sr.querySelector('.head-cell[data-field="tier"] .head-filter')!.hasAttribute('data-current') };
    };
    const picked = await act({ picked: ['Gold'] });
    // The same answer again: no rows come, and the body is not drawn for nothing.
    const again = await act({ picked: ['Gold'] });
    return { picked, again };
  }, ROWS);
  expect(r.picked).toEqual({ draws: 1, rows: 5, on: true });
  expect(r.again).toEqual({ draws: 0, rows: 5, on: true });
});
