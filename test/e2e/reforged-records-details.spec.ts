import { test, expect } from '@playwright/test';

/**
 * The CURRENT row opens its details — TODO 23.
 *
 * The grid holds the current row BY KEY, and a caller can set and step it; one
 * overlay panel is open at a time; and in the Records Context a row click opens
 * the details panel, its chevrons step the row, and the header's trail names it.
 *
 * TRAP T-a-current-row-opens-its-details · TRAP T-one-overlay-panel-at-a-time
 */
const HARNESS = '/test/reforged/harness.html';

type Grid = HTMLElement & {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
  currentKey?: string | null;
  current?: Record<string, unknown> | null;
  neighbour?: (by: number) => Record<string, unknown> | null;
  stepCurrent?: (by: number) => Record<string, unknown> | null;
};

const CONFIG = {
  key: 'id',
  columns: [{ field: 'name', header: 'Name', sortable: true }],
  rows: [{ id: 'c', name: 'Charlie' }, { id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }],
};

test.describe('the grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  });

  test('holds the current row by key, sets it silently, and steps it', async ({ page }) => {
    const r = await page.evaluate(async (config) => {
      const el = document.createElement('sherpa-data-grid') as Grid;
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      el.populate!(config);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const marked = () => [...el.shadowRoot!.querySelectorAll('.body .row[data-current]')]
        .map((tr) => tr.querySelector('.cell')!.textContent);
      let fired = 0;
      el.addEventListener('row-select', () => fired++);

      el.shadowRoot!.querySelectorAll<HTMLElement>('.body .row')[1]!.click();
      const clicked = { key: el.currentKey, marked: marked(), fired };

      el.currentKey = 'c';
      const set = { name: el.current?.name, marked: marked(), fired };

      const up = el.neighbour!(-1);
      const down = el.stepCurrent!(1);
      const stepped = { up, down: down?.name, key: el.currentKey, marked: marked() };
      el.stepCurrent!(1);
      const atEnd = { step: el.stepCurrent!(1), key: el.currentKey };

      // A re-populate (an edit reloads the rows) keeps it: the key names the row.
      el.populate!({ ...config, rows: config.rows.map((row) => ({ ...row })) });
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return { clicked, set, stepped, atEnd, kept: { key: el.currentKey, marked: marked() } };
    }, CONFIG);
    expect(r.clicked).toEqual({ key: 'a', marked: ['Alice'], fired: 1 });
    // Silent, as select() is.
    expect(r.set).toEqual({ name: 'Charlie', marked: ['Charlie'], fired: 1 });
    expect(r.stepped).toEqual({ up: null, down: 'Alice', key: 'a', marked: ['Alice'] });
    expect(r.atEnd).toEqual({ step: null, key: 'b' });
    expect(r.kept).toEqual({ key: 'b', marked: ['Bob'] });
  });

  test('opening one overlay panel shuts the other', async ({ page }) => {
    const r = await page.evaluate(async () => {
      type Panel = HTMLElement & { rendered?: Promise<void>; show?: () => void; open?: boolean };
      const make = () => {
        const el = document.createElement('sherpa-overlay-panel') as Panel;
        document.getElementById('root')!.appendChild(el);
        return el;
      };
      const one = make();
      const two = make();
      await Promise.all([one.rendered, two.rendered]);
      let closed = 0;
      one.addEventListener('panel-close', () => closed++);
      one.show!();
      two.show!();
      await new Promise((res) => setTimeout(res, 50));
      return { one: one.open, two: two.open, closed };
    });
    expect(r).toEqual({ one: false, two: true, closed: 1 });
  });
});