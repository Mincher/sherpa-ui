import { test, expect, type Page } from './harness';

/**
 * ONE CONDITION TREE — plan 695 S1 and P3, TODO 692. A field's Advanced answer
 * nests as deep as it says: `A or (B and C)` is held whole, filters the rows,
 * and its chip says it with its brackets. The menu draws it whole — rows, and
 * GROUPS of rows, each with its own And or Or — and a reader builds one there,
 * by pointer or by keyboard.
 * TRAP T-one-condition-tree · TRAP T-a-condition-tree-draws-whole
 */
const ROWS = [
  { id: 1, seats: 5 }, { id: 2, seats: 55 }, { id: 3, seats: 58 },
  { id: 4, seats: 70 }, { id: 5, seats: 30 }, { id: 6, seats: 8 },
];

/** `A or (B and C)` over Seats: under 10, or over 50 and under 60. */
const A_OR_B_AND_C = { or: [{ op: 'lt', value: 10 }, { and: [{ op: 'gt', value: 50 }, { op: 'lt', value: 60 }] }] };

type Win = Window & {
  __src: { rows: { id: number }[]; query: { applied: { scopes: Record<string, { readings: Record<string, unknown> }> } } };
  __chip: HTMLElement;
  __menu: HTMLElement & { reading: { tree?: unknown; mode?: string }; condition?: unknown; show(t: Element): void; rendered?: Promise<void> };
};

/** A bar over a page whose View may start with `where` on Seats. */
async function open(page: Page, where?: object): Promise<void> {
  await page.evaluate(async ({ rows, where }) => {
    const { ArrayStore, openSource, bindSource } = await import('/dist/index.js') as unknown as {
      ArrayStore: new (r: unknown[], o: object) => unknown;
      openSource(d: object, s: unknown): Promise<{ describe(s: string): unknown; load(): Promise<void> }>;
      bindSource(s: unknown, el: Element, o: object): void;
    };
    const src = await openSource({
      store: 'rows', fields: { seats: { label: 'Seats', type: 'number', advanced: true, min: 0, max: 100 } },
      scopes: { view: { label: 'View', holds: ['seats'], ...(where ? { where: { seats: where } } : {}) } },
    }, new ArrayStore(rows, { key: 'id' }));
    const bar = await window.__mount('sherpa-quick-filter-toolbar',
      (src.describe('view') as { filters: unknown[] }).filters, { style: 'inline-size: 1200px' });
    bindSource(src, bar, { steerOnly: true, scope: 'view' });
    await src.load();
    await window.__settled();
    const w = window as unknown as Win;
    w.__src = src as unknown as Win['__src'];
    w.__chip = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="seats"]')!;
    w.__menu = w.__chip.querySelector('sherpa-menu') as Win['__menu'];
    await w.__menu.rendered;
    await window.__settled();
  }, { rows: ROWS, where });
}

/** The page's rows, its held reading, and the chip's face. */
function state(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as Win;
    return {
      rows: w.__src.rows.map((r) => r.id).sort((a, b) => a - b),
      held: w.__src.query.applied.scopes['view']!.readings['seats'],
      tip: w.__chip.shadowRoot!.querySelector('.tip')?.textContent ?? '',
      tree: w.__menu.reading.tree,
    };
  });
}

/** The menu's rows as drawn: each group by its join, each row as its op and typed box. */
function drawn(page: Page) {
  return page.evaluate(() => {
    const menu = (window as unknown as Win).__menu;
    const shape = (group: Element): unknown => {
      const box = group.matches('.condition-rows') ? group : group.querySelector(':scope > .condition-parts')!;
      return {
        [group.getAttribute('data-join')!]: [...box.children].map((part) => (part.matches('.condition-group') ? shape(part)
          : `${part.getAttribute('data-op')} ${(part.querySelector('.condition-value') as HTMLElement & { value: string }).value}`)),
      };
    };
    return shape(menu.shadowRoot!.querySelector('.condition-rows')!);
  });
}

/** Is the focused element — through every shadow root — inside one matching `sel`? */
function focusIn(page: Page, sel: string) {
  return page.evaluate((sel) => {
    for (let at: Element | null | undefined = document.activeElement; at; at = at.shadowRoot?.activeElement) {
      if (at.matches(sel)) return true;
    }
    return false;
  }, sel);
}

/** Tab until the focus is inside `sel`. WebKit's Tab skips buttons as Safari does; Alt+Tab reaches every control. */
async function tabTo(page: Page, sel: string): Promise<void> {
  const tab = test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab';
  for (let i = 0; i < 40 && !(await focusIn(page, sel)); i++) await page.keyboard.press(tab);
  expect(await focusIn(page, sel)).toBe(true);
}

test('A or (B and C) from a page definition filters the rows, and the menu draws it whole: a row, then a group', async ({ page }) => {
  await open(page, { or: [{ lt: 10 }, { and: [{ gt: 50 }, { lt: 60 }] }] });
  const r = await state(page);
  expect(r.rows).toEqual([1, 2, 3, 6]);
  expect(r.held).toEqual({ tree: A_OR_B_AND_C, mode: 'advanced' });
  expect(r.tip).toBe('lessThan(10) OR (greaterThan(50) AND lessThan(60)) - 4 matches');
  // Drawn as it was said: no flat rows between, nothing held aside.
  expect(await drawn(page)).toEqual({ or: ['lt 10', { and: ['gt 50', 'lt 60'] }] });
  // Unedited, it reads back as it was given — its order, its numbers.
  expect(r.tree).toEqual(A_OR_B_AND_C);
});

test('(A and B) or (C and D): two groups, drawn whole, read back whole, and it filters', async ({ page }) => {
  await open(page, { or: [{ gt: 50, lt: 60 }, { gt: 0, lt: 10 }] });
  const tree = { or: [{ and: [{ op: 'gt', value: 50 }, { op: 'lt', value: 60 }] }, { and: [{ op: 'gt', value: 0 }, { op: 'lt', value: 10 }] }] };
  const r = await state(page);
  expect(r.rows).toEqual([1, 2, 3, 6]);
  expect(r.held).toEqual({ tree, mode: 'advanced' });
  expect(await drawn(page)).toEqual({ or: [{ and: ['gt 50', 'lt 60'] }, { and: ['gt 0', 'lt 10'] }] });
  expect(r.tree).toEqual(tree);
});

test('a reader builds A or (B and C) by POINTER: a row, Add group, its own Add condition, Apply — and it filters', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { const w = window as unknown as Win; w.__menu.show(w.__chip); });
  const menu = page.locator('.chip[data-id="seats"] sherpa-menu');
  await menu.locator('.use-advanced button').click();
  await page.evaluate(() => window.__settled());
  const root = menu.locator('.condition-rows');
  await root.locator('> .condition-row .condition select').selectOption('lt');
  await root.locator('> .condition-row .condition-value input').fill('10');
  await menu.locator('.condition-adds .add-group button').click();
  await page.evaluate(() => window.__settled());
  const group = root.locator('> .condition-group');
  // A new group joins the other way from its parent: `or` above, `and` inside.
  await expect(group).toHaveAttribute('data-join', 'and');
  await group.locator('.condition-row').first().locator('.condition select').selectOption('gt');
  await group.locator('.condition-row').first().locator('.condition-value input').fill('50');
  await group.locator('.group-adds .add-condition button').click();
  await page.evaluate(() => window.__settled());
  await group.locator('.condition-row').nth(1).locator('.condition select').selectOption('lt');
  await group.locator('.condition-row').nth(1).locator('.condition-value input').fill('60');
  expect(await drawn(page)).toEqual({ or: ['lt 10', { and: ['gt 50', 'lt 60'] }] });
  await menu.locator('.apply button').click();
  await page.evaluate(() => window.__settled());
  const r = await state(page);
  expect(r.rows).toEqual([1, 2, 3, 6]);
  expect(r.held).toMatchObject({ tree: A_OR_B_AND_C, mode: 'advanced' });
});

test('a reader builds A or (B and C) by KEYBOARD: Tab to each control, Enter on Add group and Add condition, focus follows', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { const w = window as unknown as Win; w.__menu.show(w.__chip); });
  const menu = page.locator('.chip[data-id="seats"] sherpa-menu');
  await menu.locator('.use-advanced button').focus();
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.__settled());
  const root = menu.locator('.condition-rows');
  // A select's own keys are the platform's popup; a focused one is chosen as a reader's keys would.
  const pick = async (row: ReturnType<typeof root.locator>, op: string): Promise<void> => {
    expect(await row.locator('.condition select').evaluate((s) => s.matches(':focus'))).toBe(true);
    await row.locator('.condition select').selectOption(op);
  };
  await tabTo(page, '.condition-rows > .condition-row .condition');
  await pick(root.locator('> .condition-row'), 'lt');
  await tabTo(page, '.condition-rows > .condition-row .condition-value');
  await page.keyboard.type('10');
  await tabTo(page, '.condition-adds .add-group');
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.__settled());
  // Focus goes to the new group's first row.
  const group = root.locator('> .condition-group');
  expect(await focusIn(page, '.condition-group .condition-row .condition')).toBe(true);
  await pick(group.locator('.condition-row').first(), 'gt');
  await tabTo(page, '.condition-group .condition-row .condition-value');
  await page.keyboard.type('50');
  await tabTo(page, '.condition-group .group-adds .add-condition');
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.__settled());
  expect(await focusIn(page, '.condition-group .condition-row:nth-child(2) .condition')).toBe(true);
  await pick(group.locator('.condition-row').nth(1), 'lt');
  await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
  await page.keyboard.type('60');
  expect(await drawn(page)).toEqual({ or: ['lt 10', { and: ['gt 50', 'lt 60'] }] });
  await tabTo(page, '.apply');
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.__settled());
  const r = await state(page);
  expect(r.rows).toEqual([1, 2, 3, 6]);
  expect(r.held).toMatchObject({ tree: A_OR_B_AND_C, mode: 'advanced' });
});

test('a group\'s join is its own: one part changes it for all; a group\'s last row has no Remove, the group does', async ({ page }) => {
  await open(page, { or: [{ lt: 10 }, { and: [{ gt: 50 }, { lt: 60 }] }] });
  await page.evaluate(() => { const w = window as unknown as Win; w.__menu.show(w.__chip); });
  const menu = page.locator('.chip[data-id="seats"] sherpa-menu');
  const group = menu.locator('.condition-rows > .condition-group');
  const shown = (loc: ReturnType<typeof menu.locator>) => loc.evaluate((n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden');
  // The parent's join is shown at the group; inside, the second row shows the group's.
  expect(await group.locator('> .join select').inputValue()).toBe('or');
  expect(await group.locator('.condition-row').nth(1).locator('.join select').inputValue()).toBe('and');
  expect(await shown(group.locator('.condition-row').first().locator('.join'))).toBe(false);
  // Or inside the group: (B or C).
  await group.locator('.condition-row').nth(1).locator('.join select').selectOption('or');
  await page.evaluate(() => window.__settled());
  expect(await drawn(page)).toEqual({ or: ['lt 10', { or: ['gt 50', 'lt 60'] }] });
  // Drop one row of the group: its last row has no Remove; the group has.
  await group.locator('.condition-row').nth(1).locator('.drop-condition button').click();
  await page.evaluate(() => window.__settled());
  expect(await shown(group.locator('.condition-row .drop-condition'))).toBe(false);
  expect(await shown(group.locator('> .group-adds .drop-group'))).toBe(true);
  await group.locator('> .group-adds .drop-group button').click();
  await page.evaluate(() => window.__settled());
  expect(await drawn(page)).toEqual({ or: ['lt 10'] });
  // The focus goes to the part that took its place.
  expect(await focusIn(page, '.condition-rows > .condition-row .condition')).toBe(true);
});

test('a caller with no pointer does the same: `condition` draws any tree whole, and reads back its answer', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(async (tree) => {
    const menu = (window as unknown as Win).__menu;
    menu.setAttribute('data-mode', 'advanced');
    menu.condition = { and: [{ op: 'gt', value: 0 }, { or: [{ op: 'lt', value: 10 }, { and: [{ op: 'gt', value: 50 }, { op: 'lt' }] }] }] };
    await window.__settled();
    const half = menu.condition;
    menu.condition = tree;
    await window.__settled();
    return { half, whole: menu.condition };
  }, A_OR_B_AND_C);
  // A half-built row says nothing; its group is drawn all the same.
  expect(r.half).toEqual({ and: [{ op: 'gt', value: 0 }, { or: [{ op: 'lt', value: 10 }, { op: 'gt', value: 50 }] }] });
  expect(r.whole).toEqual(A_OR_B_AND_C);
  expect(await drawn(page)).toEqual({ or: ['lt 10', { and: ['gt 50', 'lt 60'] }] });
});
