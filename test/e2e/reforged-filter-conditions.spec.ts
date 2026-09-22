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
    /* Both halves are COMPOSED sherpa-input-texts, so the real controls are one
       shadow root deeper. TRAP T-compose-never-reimplement */
    const field = (sel: string): HTMLElement => tier.shadowRoot!.querySelector(sel)!;
    const select = field('.condition').shadowRoot!
      .querySelector<HTMLSelectElement>('.control')!;
    const box = field('.condition-value');

    return {
      type: tier.getAttribute('data-type'),
      ops: [...select.options].map((o) => o.value),
      op: tier.dataset['op'],
      takes: tier.getAttribute('data-takes'),
      /* The condition and the search share ONE row: the condition leads at
         40%, the search fills the rest. Measured, because DOM order alone does
         not prove they are side by side. */
      oneRow: (() => {
        const box = field('.condition').getBoundingClientRect();
        const search = tier.shadowRoot!.querySelector('.search')!.getBoundingClientRect();
        const mid = (b: DOMRect): number => (b.top + b.bottom) / 2;
        return {
          sameLine: Math.abs(mid(box) - mid(search)) < 1.5,
          inOrder: box.right <= search.left + 1,
        };
      })(),
      // The typed box EXISTS from the start; CSS hides it.
      boxShown: getComputedStyle(box).display,
      rowsShown: getComputedStyle(tier.shadowRoot!.querySelector('.rows')!).display,
      // A SELECTOR gets none of it.
      selectorType: menuFor('view').getAttribute('data-type'),
      selectorHasCondition: !!menuFor('view').shadowRoot!.querySelector('.condition'),
      // The platform's own element, not a re-implemented listbox.
      control: field('.condition').shadowRoot!.querySelector('.control')!.tagName,
    };
  });

  expect(r.type).toBe('filter');
  // `eq` LEADS, and is the same default a column heading opens on.
  expect(r.ops).toEqual(['eq', 'ne', 'contains', 'notcontains', 'startswith', 'endswith']);
  expect(r.op).toBe('eq');
  expect(r.takes).toBe('list');
  expect(r.oneRow.sameLine).toBe(true);
  expect(r.oneRow.inOrder).toBe(true);
  expect(r.control).toBe('SELECT');
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
      ops: [...sr.querySelector('.condition')!.shadowRoot!
        .querySelectorAll<HTMLOptionElement>('.control option')].map((o) => o.value),
      op: menu.op,
      // The rows are the COLUMN's own distinct values — deduped and sorted.
      // The MENU's own rows now, the same ones a filter chip gets.
      rows: [...menu.querySelectorAll('.menu-row:not(.qf-all) .menu-row-label')]
        .map((n) => n.textContent),
    };

    // Tick two and apply: SEVERAL picks read as `in`.
    for (const value of ['Gold', 'Silver']) {
      const box = [...menu.querySelectorAll<HTMLInputElement>('.menu-row input')]
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

test('the BADGE wears the condition sign; the caret keeps the value', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const chip = el.shadowRoot!.querySelector('sherpa-quick-filter[data-id="tier"]') as HTMLElement;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { conditionValue: string };
    const wait = (): Promise<void> => new Promise((res) => { setTimeout(res, 120); });
    const badge = (): Record<string, unknown> => ({
      sign: chip.dataset['count'] ?? null,
      // A sign announces as nothing, so the WORD is the accessible name.
      spoken: chip.shadowRoot!.querySelector('.count')?.getAttribute('aria-label') ?? null,
      caret: chip.shadowRoot!.querySelector('.caret-label')?.textContent ?? '',
    });
    const pick = (op: string): void => {
      const field = menu.shadowRoot!.querySelector('.condition') as HTMLElement & { value: string };
      field.value = op;
      field.shadowRoot!.querySelector('.control')!
        .dispatchEvent(new Event('change', { bubbles: true }));
    };

    // The menu names both at once: the word and the sign it will wear.
    const rows = [...menu.shadowRoot!.querySelector('.condition')!.shadowRoot!
      .querySelectorAll('.control option')].map((o) => o.textContent);

    const gold = [...menu.querySelectorAll('input')].find((i) => i.value === 'gold')!;
    gold.checked = true;
    gold.dispatchEvent(new Event('change', { bubbles: true }));
    menu.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await wait();
    const onEq = badge();

    pick('ne');
    await wait();
    const onNe = badge();

    pick('startswith');
    menu.conditionValue = 'Go';
    menu.dispatchEvent(new CustomEvent('condition-change', {
      bubbles: true, composed: true, detail: {},
    }));
    await wait();
    return { rows, onEq, onNe, onTyped: badge() };
  });

  // The word says what it does; the sign is what the chip will wear.
  expect(r.rows).toEqual([
    'Equals (=)', 'Does not equal (!=)', 'Contains (∷)',
    'Does not contain (!∷)', 'Starts with (∷*)', 'Ends with (*∷)',
  ]);
  // `eq` HAS a sign, but a badge on every default chip would be noise.
  expect(r.onEq).toEqual({ sign: null, spoken: null, caret: 'Gold' });
  expect(r.onNe).toEqual({ sign: '!=', spoken: 'Does not equal', caret: 'Gold' });
  // A typing condition answers with what was TYPED, and the caret keeps it all.
  expect(r.onTyped).toEqual({ sign: '∷*', spoken: 'Starts with', caret: 'Go' });
});

test('a TYPED condition survives Apply, and its hits mark', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
      clauses: Record<string, unknown>;
    };
    document.getElementById('root')!.replaceChildren(el);
    await customElements.whenDefined('sherpa-quick-filter-toolbar');
    await el.rendered;
    el.populate([{
      id: 'owner', label: 'Owner', select: 'single', removable: true, commit: true,
      options: [{ value: 'ravi', label: 'Ravi' }, { value: 'dana', label: 'Dana' }],
    }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const chip = el.shadowRoot!.querySelector('sherpa-quick-filter[data-id="owner"]')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { conditionValue: string };
    const wait = (): Promise<void> => new Promise((res) => { setTimeout(res, 120); });

    const field = menu.shadowRoot!.querySelector('.condition') as HTMLElement & { value: string };
    field.value = 'contains';
    field.shadowRoot!.querySelector('.control')!
      .dispatchEvent(new Event('change', { bubbles: true }));
    await wait();

    const input = menu.shadowRoot!.querySelector('.condition-value')!
      .shadowRoot!.querySelector('.control') as HTMLInputElement;
    input.value = 'Rav';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    const typed = chip.hasAttribute('data-current');

    /* APPLY is where this broke: the bar re-derived `data-current` from ticked
       rows alone, so a typed answer switched its own chip back OFF while still
       filtering. TRAP T-an-operator-decides-pick-or-type */
    menu.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await wait();
    return { typed, applied: chip.hasAttribute('data-current'), clauses: el.clauses };
  });

  expect(r.typed).toBe(true);
  expect(r.applied).toBe(true);
  expect(r.clauses).toEqual({ owner: ['owner', 'contains', 'Rav'] });
});

test('the grid marks what a filter matched, from EITHER direction', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'owner', header: 'Owner' }],
      rows: [{ owner: 'Ravi Menon' }, { owner: 'Dana Whitlock' }],
    });
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();
    const marks = (): string[] =>
      [...el.shadowRoot!.querySelectorAll('mark.match')].map((m) => m.textContent ?? '');

    const before = marks().length;

    /* `data-needles` is how a clause set ANYWHERE reaches the cells — the grid
       cannot see the toolbar that holds the chip.
       TRAP T-a-needle-comes-from-either-direction */
    el.setAttribute('data-needles', 'owner:contains:rav');
    await settle();
    const external = marks();

    // `eq` matched the WHOLE value, so there is nothing to point at.
    el.setAttribute('data-needles', 'owner:eq:Ravi Menon');
    await settle();
    const exact = marks().length;
    return { before, external, exact };
  });

  expect(r.before).toBe(0);
  // The CELL's casing wins: "rav" against "Ravi" leaves "Rav".
  expect(r.external).toEqual(['Rav']);
  expect(r.exact).toBe(0);
});

test('the badge is legible, and the tooltip SPELLS the condition', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const chip = el.shadowRoot!.querySelector('sherpa-quick-filter[data-id="tier"]') as HTMLElement;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { conditionValue: string };
    const wait = (): Promise<void> => new Promise((res) => { setTimeout(res, 120); });
    const read = (): Record<string, unknown> => ({
      badge: chip.dataset['count'] ?? null,
      // A two-glyph sign at 12px is a smudge in body weight.
      weight: getComputedStyle(chip.shadowRoot!.querySelector('.count')!).fontWeight,
      tip: chip.shadowRoot!.querySelector<HTMLElement>('.count-wrap')?.dataset['text'] ?? null,
    });

    const gold = [...menu.querySelectorAll('input')].find((i) => i.value === 'gold')!;
    gold.checked = true;
    gold.dispatchEvent(new Event('change', { bubbles: true }));
    menu.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await wait();
    const onEq = read();

    const field = menu.shadowRoot!.querySelector('.condition') as HTMLElement & { value: string };
    field.value = 'notcontains';
    field.shadowRoot!.querySelector('.control')!
      .dispatchEvent(new Event('change', { bubbles: true }));
    menu.conditionValue = 'Ravi';
    menu.dispatchEvent(new CustomEvent('condition-change', {
      bubbles: true, composed: true, detail: {},
    }));
    await wait();
    return { onEq, onCondition: read() };
  });

  // The DEFAULT names no condition — there is nothing to explain.
  expect(r.onEq).toEqual({ badge: null, weight: '600', tip: 'Gold' });
  /* A tooltip is where a reader goes to find out what `!∷` MEANS, so it spells
     the condition rather than repeating the sign. The VALUE is still the ticked
     "Gold": flipping a condition keeps the ticks, which is the whole point of
     stamping both bodies.
     TRAP T-an-operator-decides-pick-or-type */
  expect(r.onCondition).toEqual({
    badge: '!∷', weight: '600', tip: 'Does not contain: Gold',
  });
});

test('a column menu offers the WHOLE column, never just the drawn rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    el.setAttribute('data-column-filters', '');
    /* The WHOLE column, which only the host knows: the grid is handed a PAGE.
       TRAP T-unavailable-value-sorts-below-a-divider */
    el.setAttribute('data-column-values', 'owner:Ravi Menon|Dana Whitlock|Unassigned');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;

    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();
    const menu = (): HTMLElement =>
      el.shadowRoot!.querySelector('.head-cell[data-field="owner"] .head-filter sherpa-menu')!;
    const read = (): Array<string> => [...menu().children]
      .filter((n) => !n.classList.contains('qf-all'))
      .map((n) => n.tagName === 'HR' ? '---'
        : `${n.querySelector('.menu-row-label')?.textContent}${
          n.hasAttribute('data-unavailable') ? ' [dim]' : ''}`);

    // EVERY owner is on the page.
    el.populate({
      columns: [{ field: 'owner', header: 'Owner' }],
      rows: [{ owner: 'Ravi Menon' }, { owner: 'Dana Whitlock' }, { owner: 'Unassigned' }],
    });
    await settle();
    const whole = read();

    // A filter elsewhere leaves one owner drawn — the other two must STAY.
    el.populate({
      columns: [{ field: 'owner', header: 'Owner' }],
      rows: [{ owner: 'Ravi Menon' }],
    });
    await settle();
    const narrowed = read();

    return {
      whole, narrowed,
      // The same flags a filter CHIP's menu carries for the same field.
      flags: {
        type: menu().getAttribute('data-type'),
        select: menu().getAttribute('data-select'),
        clearable: menu().hasAttribute('data-clearable'),
        search: menu().hasAttribute('data-search'),
        heading: menu().getAttribute('data-heading'),
      },
      // Dimmed is not DISABLED: ticking it is how a reader broadens back out.
      stillSelectable: [...menu().querySelectorAll<HTMLInputElement>('.head-value-row input')]
        .every((b) => !b.disabled),
    };
  });

  expect(r.whole).toEqual(['Ravi Menon', 'Dana Whitlock', 'Unassigned']);
  /* THE POINT: three values still, with the two no drawn row carries sorted
     below a divider rather than dropped. Dropping them makes the current
     filter a one-way door. */
  expect(r.narrowed).toEqual([
    'Ravi Menon', '---', 'Dana Whitlock [dim]', 'Unassigned [dim]',
  ]);
  expect(r.stillSelectable).toBe(true);
  expect(r.flags).toEqual({
    type: 'filter', select: 'multiple', clearable: true, search: true, heading: 'Owner',
  });
});
