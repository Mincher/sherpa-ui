import { test, expect } from './harness';

/**
 * ONE FIELD, ONE CONDITION, WHEREVER THE READER MEETS IT.
 *
 * A filter chip's menu and a column heading's filter menu ask the same
 * question, so they offer the same conditions from the same vocabulary, open on
 * the same default, and report the same `FilterClause` shape. Before this the
 * chip menu had no conditions at all and the heading defaulted to `contains`.
 *
 * TRAP T-an-operator-decides-pick-or-type
 */

/** A toolbar with one condition chip over two values. */
async function bar(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    el.setAttribute('data-type', 'data');
    document.getElementById('root')!.replaceChildren(el);
    await customElements.whenDefined('sherpa-quick-filter-toolbar');
    await el.rendered;
    el.populate([
      {
        id: 'tier', label: 'Tier', conditions: true, select: 'multiple', removable: true,
        options: [{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }],
      },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
  });
}

test('the condition row leads the menu and opens on Equals', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const chip = el.shadowRoot!.querySelector('sherpa-quick-filter[data-id="tier"]')!;
    const menu = chip.querySelector('sherpa-menu')!;
    const select = chip.querySelector<HTMLSelectElement>('.qf-op')!;
    const box = chip.querySelector<HTMLInputElement>('.qf-text')!;
    return {
      ops: [...select.options].map((o) => o.value),
      value: select.value,
      takes: menu.getAttribute('data-takes'),
      // The CONDITION row is first — it decides what everything below it means.
      firstRow: menu.firstElementChild?.className,
      // The typed box EXISTS from the start; CSS hides it.
      boxExists: !!box,
      boxShown: getComputedStyle(box.closest('.qf-text-row')!).display,
      rowsShown: getComputedStyle(menu.querySelector('label')!).display,
    };
  });

  // `eq` LEADS, and is the same default the column heading menu opens on.
  expect(r.ops).toEqual(['eq', 'ne', 'contains', 'notcontains', 'startswith', 'endswith']);
  expect(r.value).toBe('eq');
  expect(r.takes).toBe('list');
  expect(r.firstRow).toBe('qf-op-row');
  expect(r.boxExists).toBe(true);
  expect(r.boxShown).toBe('none');
  expect(r.rowsShown).not.toBe('none');
});

test('flipping the condition swaps the body and LOSES NOTHING', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-quick-filter-toolbar') as HTMLElement & {
      clauses: Record<string, unknown>;
    };
    const chip = el.shadowRoot!.querySelector('sherpa-quick-filter[data-id="tier"]')!;
    const menu = chip.querySelector('sherpa-menu')!;
    const select = chip.querySelector<HTMLSelectElement>('.qf-op')!;
    const box = chip.querySelector<HTMLInputElement>('.qf-text')!;
    const pick = (op: string): void => {
      select.value = op;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Tick Gold under Equals.
    const gold = [...menu.querySelectorAll('input')]
      .find((i) => i.value === 'gold')!;
    gold.checked = true;
    gold.dispatchEvent(new Event('change', { bubbles: true }));
    chip.setAttribute('data-current', '');
    const onEq = el.clauses;

    // Flip to Contains: the rows step aside, and NOTHING is typed yet.
    pick('contains');
    const afterFlip = {
      takes: menu.getAttribute('data-takes'),
      boxShown: getComputedStyle(box.closest('.qf-text-row')!).display,
      rowsShown: getComputedStyle(menu.querySelector('label')!).display,
      clauses: el.clauses,
    };

    box.value = 'gol';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const onContains = el.clauses;

    // …and BACK. The tick is still there; so is what was typed.
    pick('eq');
    return {
      onEq, afterFlip, onContains,
      backToEq: el.clauses,
      goldStillTicked: gold.checked,
      typingKept: box.value,
    };
  });

  expect(r.onEq).toEqual({ tier: ['tier', 'eq', 'gold'] });
  expect(r.afterFlip.takes).toBe('text');
  expect(r.afterFlip.boxShown).not.toBe('none');
  expect(r.afterFlip.rowsShown).toBe('none');
  // Nothing typed says nothing — an empty value is not a filter.
  expect(r.afterFlip.clauses).toEqual({});
  expect(r.onContains).toEqual({ tier: ['tier', 'contains', 'gol'] });
  // THE POINT: both halves survive the round trip, because both are stamped.
  expect(r.backToEq).toEqual({ tier: ['tier', 'eq', 'gold'] });
  expect(r.goldStillTicked).toBe(true);
  expect(r.typingKept).toBe('gol');
});

test('several picks read as `in`, because `eq` against a list matches nothing', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-quick-filter-toolbar') as HTMLElement & {
      clauses: Record<string, unknown>;
    };
    const chip = el.shadowRoot!.querySelector('sherpa-quick-filter[data-id="tier"]')!;
    const menu = chip.querySelector('sherpa-menu')!;
    for (const value of ['gold', 'silver']) {
      const box = [...menu.querySelectorAll('input')].find((i) => i.value === value)!;
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    }
    chip.setAttribute('data-current', '');
    return el.clauses;
  });
  expect(r).toEqual({ tier: ['tier', 'in', ['gold', 'silver']] });
});

test('setClause is the write path: what a column heading reports, a chip shows', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-quick-filter-toolbar') as HTMLElement & {
      clauses: Record<string, unknown>;
      setClause(id: string, clause: readonly unknown[] | null): void;
    };
    const chip = el.shadowRoot!.querySelector('sherpa-quick-filter[data-id="tier"]')!;
    const select = chip.querySelector<HTMLSelectElement>('.qf-op')!;
    const box = chip.querySelector<HTMLInputElement>('.qf-text')!;
    const seen: Record<string, unknown> = {};

    // The SHAPE `column-filter-change` reports.
    el.setClause('tier', ['tier', 'startswith', 'Go']);
    seen.typed = { op: select.value, text: box.value, clauses: el.clauses };

    // A LIST condition writes the ticks instead.
    el.setClause('tier', ['tier', 'in', ['gold', 'silver']]);
    chip.setAttribute('data-current', '');
    seen.picked = {
      // `in` is how SEVERAL reads; the chip's own condition stays `eq`.
      op: select.value,
      clauses: el.clauses,
    };

    el.setClause('tier', null);
    seen.cleared = { op: select.value, text: box.value, clauses: el.clauses };
    return seen;
  });

  expect(r.typed).toEqual({
    op: 'startswith', text: 'Go', clauses: { tier: ['tier', 'startswith', 'Go'] },
  });
  expect(r.picked).toEqual({
    op: 'eq', clauses: { tier: ['tier', 'in', ['gold', 'silver']] },
  });
  expect(r.cleared).toEqual({ op: 'eq', text: '', clauses: {} });
});
