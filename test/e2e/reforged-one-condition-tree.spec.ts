import { test, expect, type Page } from './harness';

/**
 * ONE CONDITION TREE — plan 695 S1, TODO 692's data half. A page definition's
 * condition nests as deep as it says: `A or (B and C)` is held whole, filters the
 * rows, and its chip says it with its brackets. A tree a flat menu cannot draw —
 * two groups — is kept whole by the menu until the reader edits a row.
 * TRAP T-one-condition-tree
 */
const ROWS = [
  { id: 1, seats: 5 }, { id: 2, seats: 55 }, { id: 3, seats: 58 },
  { id: 4, seats: 70 }, { id: 5, seats: 30 }, { id: 6, seats: 8 },
];

/** A bar over a page whose View starts with `where` on Seats; the chip's face, menu and the rows. */
async function open(page: Page, where: object) {
  return page.evaluate(async ({ rows, where }) => {
    const { ArrayStore, openSource, bindSource } = await import('/dist/index.js') as unknown as {
      ArrayStore: new (r: unknown[], o: object) => unknown;
      openSource(d: object, s: unknown): Promise<{ describe(s: string): unknown; load(): Promise<void>;
        rows: { id: number }[]; query: { applied: { scopes: Record<string, { readings: Record<string, unknown> }> } } }>;
      bindSource(s: unknown, el: Element, o: object): void;
    };
    const src = await openSource({
      store: 'rows', fields: { seats: { label: 'Seats', type: 'number', advanced: true, min: 0, max: 100 } },
      scopes: { view: { label: 'View', holds: ['seats'], where: { seats: where } } },
    }, new ArrayStore(rows, { key: 'id' }));
    const bar = await window.__mount('sherpa-quick-filter-toolbar',
      (src.describe('view') as { filters: unknown[] }).filters, { style: 'inline-size: 1200px' });
    bindSource(src, bar, { steerOnly: true, scope: 'view' });
    await src.load();
    await window.__settled();
    const chip = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="seats"]')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & {
      reading: { tree?: unknown; mode?: string }; conditions: unknown[]; rendered?: Promise<void>;
    };
    await menu.rendered;
    await window.__settled();
    return {
      rows: src.rows.map((r) => r.id).sort((a, b) => a - b),
      held: src.query.applied.scopes['view']!.readings['seats'],
      on: chip.hasAttribute('data-current'),
      condition: chip.getAttribute('data-condition'),
      tip: chip.shadowRoot!.querySelector('.tip')?.textContent ?? '',
      menu: { tree: menu.reading.tree, mode: menu.reading.mode, rows: menu.conditions },
    };
  }, { rows: ROWS, where });
}

test('A or (B and C) from a page definition filters the rows, and its chip and menu hold it whole', async ({ page }) => {
  const tree = { or: [{ op: 'lt', value: 10 }, { and: [{ op: 'gt', value: 50 }, { op: 'lt', value: 60 }] }] };
  const r = await open(page, { or: [{ lt: 10 }, { and: [{ gt: 50 }, { lt: 60 }] }] });
  expect(r.rows).toEqual([1, 2, 3, 6]);
  expect(r.held).toEqual({ tree, mode: 'advanced' });
  expect(r.on).toBe(true);
  expect(r.condition).toBe('advanced');
  expect(r.tip).toBe('lessThan(10) OR (greaterThan(50) AND lessThan(60)) - 4 matches');
  // A flat menu draws it with its group leading, and reads back the same tree.
  expect(r.menu.mode).toBe('advanced');
  expect(r.menu.rows).toEqual([
    { op: 'gt', text: '50' }, { op: 'lt', join: 'and', text: '60' }, { op: 'lt', join: 'or', text: '10' },
  ]);
  // Unedited, it reads back as it was given — its order, its numbers.
  expect(r.menu.tree).toEqual(tree);
});

test('(A and B) or (C and D): no flat rows can say it, so the menu keeps it whole, and it still filters', async ({ page }) => {
  const r = await open(page, { or: [{ gt: 50, lt: 60 }, { gt: 0, lt: 10 }] });
  const tree = { or: [{ and: [{ op: 'gt', value: 50 }, { op: 'lt', value: 60 }] }, { and: [{ op: 'gt', value: 0 }, { op: 'lt', value: 10 }] }] };
  expect(r.rows).toEqual([1, 2, 3, 6]);
  expect(r.held).toEqual({ tree, mode: 'advanced' });
  expect(r.tip).toBe('greaterThan(50) AND lessThan(60) OR (greaterThan(0) AND lessThan(10)) - 4 matches');
  // TODO 692 nests the menu; until then it holds what it cannot draw.
  expect(r.menu.tree).toEqual(tree);
});
