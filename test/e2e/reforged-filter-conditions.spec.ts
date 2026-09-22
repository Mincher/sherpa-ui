import { test, expect } from './harness';

/**
 * ONE FIELD, ONE FILTER MENU.
 *
 * A filter chip and a column heading ask the same question of the same field,
 * so they open the SAME menu: `sherpa-menu`'s `filter` template, whose header
 * carries a condition dropdown above the search. Before this the chip menu had
 * no conditions at all and the heading had its own hand-built body.
 *
 * TRAP T-one-field-one-filter-menu
 * TRAP T-an-operator-decides-pick-or-type
 */

/** A toolbar with one value chip over two values. */
async function bar(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    el.setAttribute('data-type', 'data');
    document.getElementById('root')!.replaceChildren(el);
    await customElements.whenDefined('sherpa-quick-filter-toolbar');
    await el.rendered;
    el.populate([
      {
        id: 'tier', label: 'Tier', select: 'multiple', removable: true,
        options: [{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }],
      },
      // A SELECTOR, not a field question — "which saved view" has no Contains.
      {
        id: 'view', label: 'View', persistent: true, select: 'single',
        options: [{ value: 'all', label: 'All' }],
      },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
  });
}

test('every value chip opens the FILTER menu, on Equals', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const menuFor = (id: string): HTMLElement =>
      el.shadowRoot!.querySelector(`sherpa-quick-filter[data-id="${id}"] sherpa-menu`)!;

    const tier = menuFor('tier');
    const select = tier.shadowRoot!.querySelector<HTMLSelectElement>('.condition')!;
    const box = tier.shadowRoot!.querySelector<HTMLInputElement>('.condition-value')!;

    return {
      type: tier.getAttribute('data-type'),
      ops: [...select.options].map((o) => o.value),
      op: tier.dataset['op'],
      takes: tier.getAttribute('data-takes'),
      // The condition leads the header, ABOVE the search box.
      firstControl: tier.shadowRoot!.querySelector('.header .filter-row, .header .search')!
        .className,
      // The typed box EXISTS from the start; CSS hides it.
      boxShown: getComputedStyle(box).display,
      rowsShown: getComputedStyle(tier.shadowRoot!.querySelector('.rows')!).display,
      // A SELECTOR gets none of it.
      selectorType: menuFor('view').getAttribute('data-type'),
      selectorHasCondition: !!menuFor('view').shadowRoot!.querySelector('.condition'),
    };
  });

  expect(r.type).toBe('filter');
  // `eq` LEADS, and is the same default a column heading opens on.
  expect(r.ops).toEqual(['eq', 'ne', 'contains', 'notcontains', 'startswith', 'endswith']);
  expect(r.op).toBe('eq');
  expect(r.takes).toBe('list');
  expect(r.firstControl).toBe('filter-row');
  expect(r.boxShown).toBe('none');
  expect(r.rowsShown).not.toBe('none');
  // A persistent chip is a selector: no condition, and its own plain menu.
  expect(r.selectorType).not.toBe('filter');
  expect(r.selectorHasCondition).toBe(false);
});

test('flipping the condition swaps the body and LOSES NOTHING', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const menu = el.shadowRoot!
      .querySelector('sherpa-quick-filter[data-id="tier"] sherpa-menu') as HTMLElement & {
        op: string; conditionValue: string; values: string[];
      };
    const sr = menu.shadowRoot!;
    const select = sr.querySelector<HTMLSelectElement>('.condition')!;
    const box = sr.querySelector<HTMLInputElement>('.condition-value')!;
    const pick = (op: string): void => {
      select.value = op;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Tick Gold under Equals.
    const gold = [...menu.querySelectorAll('input')].find((i) => i.value === 'gold')!;
    gold.checked = true;
    gold.dispatchEvent(new Event('change', { bubbles: true }));
    const onEq = { op: menu.op, values: [...menu.values] };

    // Flip to Contains: the rows and the search step aside for the box.
    pick('contains');
    const afterFlip = {
      takes: menu.getAttribute('data-takes'),
      op: menu.op,
      boxShown: getComputedStyle(box).display,
      rowsShown: getComputedStyle(sr.querySelector('.rows')!).display,
      searchShown: getComputedStyle(sr.querySelector('.search')!).display,
      typed: menu.conditionValue,
    };

    box.value = 'gol';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const onContains = { op: menu.op, typed: menu.conditionValue };

    // …and BACK. The tick is still there; so is what was typed.
    pick('eq');
    return {
      onEq, afterFlip, onContains,
      backToEq: { op: menu.op, values: [...menu.values] },
      goldStillTicked: gold.checked,
      typingKept: menu.conditionValue,
      rowsBack: getComputedStyle(sr.querySelector('.rows')!).display,
    };
  });

  expect(r.onEq).toEqual({ op: 'eq', values: ['gold'] });
  expect(r.afterFlip.takes).toBe('text');
  expect(r.afterFlip.op).toBe('contains');
  expect(r.afterFlip.boxShown).not.toBe('none');
  expect(r.afterFlip.rowsShown).toBe('none');
  expect(r.afterFlip.searchShown).toBe('none');
  expect(r.afterFlip.typed).toBe('');
  expect(r.onContains).toEqual({ op: 'contains', typed: 'gol' });
  // THE POINT: both halves survive the round trip, because both are stamped.
  expect(r.backToEq).toEqual({ op: 'eq', values: ['gold'] });
  expect(r.goldStillTicked).toBe(true);
  expect(r.typingKept).toBe('gol');
  expect(r.rowsBack).not.toBe('none');
});

test('the typed value survives a variant RE-STAMP', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = document.createElement('sherpa-menu') as HTMLElement & {
      rendered?: Promise<void>; op: string; conditionValue: string;
    };
    menu.setAttribute('data-type', 'filter');
    menu.setAttribute('data-heading', 'Name');
    document.getElementById('root')!.replaceChildren(menu);
    await customElements.whenDefined('sherpa-menu');
    await menu.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    menu.op = 'contains';
    menu.conditionValue = 'Ad';
    const before = menu.conditionValue;

    /* `data-type` is a VARIANT attribute, so this replaces the whole shadow
       tree — and the box with it. The value lives in an attribute for exactly
       this reason. TRAP T-restamp-does-not-abort */
    menu.setAttribute('data-type', 'list');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const asPlainMenu = menu.shadowRoot!.querySelector('.condition-value');

    menu.setAttribute('data-type', 'filter');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      before,
      // A plain menu stamps no condition markup at all.
      plainHasBox: !!asPlainMenu,
      after: menu.conditionValue,
      boxValue: menu.shadowRoot!.querySelector<HTMLInputElement>('.condition-value')!.value,
      op: menu.op,
    };
  });

  expect(r.before).toBe('Ad');
  expect(r.plainHasBox).toBe(false);
  expect(r.after).toBe('Ad');
  expect(r.boxValue).toBe('Ad');
  expect(r.op).toBe('contains');
});

test('a column heading opens the SAME menu, over the column own values', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
      columnClause(field: string): unknown[] | null;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'tier', header: 'Tier' }],
      rows: [{ tier: 'Gold' }, { tier: 'Gold' }, { tier: 'Silver' }, { tier: 'Bronze' }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const chip = el.shadowRoot!.querySelector('.head-cell[data-field="tier"] .head-filter')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { op: string };
    const sr = menu.shadowRoot!;

    const shape = {
      type: menu.getAttribute('data-type'),
      ops: [...sr.querySelectorAll<HTMLOptionElement>('.condition option')].map((o) => o.value),
      op: menu.op,
      // The rows are the COLUMN's own distinct values — deduped and sorted.
      rows: [...menu.querySelectorAll('.head-value-label')].map((n) => n.textContent),
    };

    // Tick two and apply: SEVERAL picks read as `in`.
    for (const value of ['Gold', 'Silver']) {
      const box = [...menu.querySelectorAll<HTMLInputElement>('.head-value-row input')]
        .find((b) => b.value === value)!;
      box.checked = true;
    }
    sr.querySelector<HTMLElement>('.apply')!.click();
    await new Promise((res) => setTimeout(res, 60));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { shape, clause: el.columnClause('tier') };
  });

  expect(r.shape.type).toBe('filter');
  // The SAME six conditions a filter chip offers, from the one vocabulary.
  expect(r.shape.ops).toEqual(['eq', 'ne', 'contains', 'notcontains', 'startswith', 'endswith']);
  expect(r.shape.op).toBe('eq');
  expect(r.shape.rows).toEqual(['Bronze', 'Gold', 'Silver']);
  // `eq` against a list can never match, so several picks become `in`.
  expect(r.clause).toEqual(['tier', 'in', ['Gold', 'Silver']]);
});
