import { test, expect } from './harness';

/**
 * A KEYLESS ROW SELECTS BY KEY — TODO 103.
 *
 * Rows with no key field: the data layer gives each a key BESIDE it, so the
 * grid's selection names rows by key — never by position, which a sort
 * changes — and a stale made-up key from another page load picks nothing.
 * TRAP T-a-made-up-key-never-leaves-the-data-layer
 */

type Grid = HTMLElement & {
  shadowRoot: ShadowRoot; selectedKeys: string[]; select(k: string[]): void;
  selectedRecords: Record<string, unknown>[];
};

test('a grid over keyless rows selects by made-up key, and a sort keeps the selection', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, isMadeUpKey, onReport } = await import('/dist/data.js') as unknown as {
      ArrayStore: new (rows: unknown[]) => unknown;
      DataSource: new (o: { store: unknown }) => {
        bind(el: HTMLElement, o?: Record<string, unknown>): void; load(): Promise<unknown>;
        sort(field: string, direction: string): void;
      };
      isMadeUpKey(k: unknown): boolean;
      onReport(fn: (r: { code: string }) => void): () => void;
    };
    const store = new ArrayStore([{ name: 'Ada' }, { name: 'Bob' }, { name: 'Cy' }]);
    const source = new DataSource({ store });
    const grid = await window.__mount<Grid>('sherpa-data-grid', undefined, { 'data-selectable': true });
    source.bind(grid, { as: (rows: unknown[]) => ({ columns: [{ field: 'name', header: 'Name' }], rows }) });
    await source.load();
    await window.__settled();
    const heard: string[][] = [];
    grid.addEventListener('selection-change', (e) => heard.push((e as CustomEvent).detail.selected));
    const tick = async (name: string): Promise<void> => {
      const row = [...grid.shadowRoot.querySelectorAll<HTMLElement>('.body .row')]
        .find((x) => x.textContent?.includes(name))!;
      const box = row.querySelector('.row-multi') as HTMLElement & { shadowRoot: ShadowRoot };
      box.shadowRoot.querySelector<HTMLInputElement>('input')!.click();
      await window.__settled();
    };
    const names = () => grid.selectedRecords.map((x) => x['name']).sort();

    await tick('Ada');
    await tick('Cy');
    const keys = grid.selectedKeys;
    grid.dispatchEvent(new CustomEvent('sort-change', {
      bubbles: true, composed: true, detail: { field: 'name', direction: 'desc' },
    }));
    await source.load();
    await window.__settled();
    const afterSort = { keys: grid.selectedKeys, names: names() };

    const reports: string[] = [];
    const stop = onReport((rep) => reports.push(rep.code));
    grid.select(['sherpa:zzzzzz:1']);
    stop();
    return {
      made: keys.length === 2 && keys.every(isMadeUpKey),
      sent: heard.at(-1), keys, afterSort,
      stale: { keys: grid.selectedKeys, reports },
    };
  });

  expect(r.made).toBe(true);
  // The event sends the KEYS, not row positions.
  expect(r.sent).toEqual(r.keys);
  expect(r.afterSort).toEqual({ keys: r.keys, names: ['Ada', 'Cy'] });
  expect(r.stale).toEqual({ keys: [], reports: ['stale-made-up-key'] });
});
