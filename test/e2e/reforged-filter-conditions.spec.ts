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
        // OPT IN: conditions are off by default, so a chip that wants the
        // And/Or rows asks for them. TRAP T-conditions-are-opt-in-per-field
        id: 'tier', label: 'Tier', select: 'multiple', removable: true, custom: true,
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

test('the two modes swap, and NEITHER loses what the other holds', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const menu = el.shadowRoot!
      .querySelector('sherpa-quick-filter[data-id="tier"] sherpa-menu') as HTMLElement & {
        mode: string; conditions: { op: string; text?: string; picked?: string[] }[];
        values: string[];
      };
    const sr = menu.shadowRoot!;
    const wait = (): Promise<void> => new Promise((res) => { setTimeout(res, 120); });
    const shown = (sel: string): string => {
      const node = sr.querySelector(sel);
      return node ? getComputedStyle(node).display : '(missing)';
    };

    // DEFAULT mode: a search over ticked rows, no condition rows.
    const gold = [...menu.querySelectorAll('input')].find((i) => i.value === 'gold')!;
    gold.checked = true;
    gold.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    const onDefault = {
      mode: menu.mode, values: [...menu.values],
      search: shown('.search'), rows: shown('.rows'),
      conditionRows: shown('.condition-rows'),
    };

    // The header button switches to CUSTOM mode.
    sr.querySelector<HTMLElement>('.use-condition sherpa-switch')!.shadowRoot!.querySelector('input')!.click();
    await wait();
    const onCustom = {
      mode: menu.mode,
      search: shown('.search'), rows: shown('.rows'),
      conditionRows: shown('.condition-rows'),
      // It opens with ONE row — an empty custom mode reads as broken.
      rowCount: sr.querySelectorAll('.condition-row').length,
      // The ticks are untouched: a mode is a VIEW of the filter, not a reset.
      goldStillTicked: gold.checked,
    };

    // Type an answer into row one.
    const row0 = sr.querySelector('.condition-row')!;
    const cond0 = row0.querySelector('.condition') as HTMLElement & { value: string };
    cond0.value = 'contains';
    cond0.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await wait();
    const box = row0.querySelector('.condition-value') as HTMLElement & { value: string };
    box.value = 'gol';
    box.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await wait();
    const typed = {
      takes: (row0 as HTMLElement).dataset['takes'],
      boxShown: getComputedStyle(row0.querySelector('.condition-value')!).display,
      pickShown: getComputedStyle(row0.querySelector('.condition-pick')!).display,
      conditions: menu.conditions,
    };

    // …and BACK to default. The rows are still there; so is the typing.
    sr.querySelector<HTMLElement>('.use-condition sherpa-switch')!.shadowRoot!.querySelector('input')!.click();
    await wait();
    return {
      onDefault, onCustom, typed,
      backToDefault: {
        mode: menu.mode, values: [...menu.values],
        search: shown('.search'), goldStillTicked: gold.checked,
        // Kept, not cleared — one more press brings the same rows back.
        conditionsKept: menu.conditions,
      },
    };
  });

  expect(r.onDefault).toEqual({
    mode: 'default', values: ['gold'],
    search: 'block', rows: 'flex', conditionRows: 'none',
  });

  // CUSTOM mode: the rows answer the field, so the search over them goes.
  expect(r.onCustom.mode).toBe('custom');
  expect(r.onCustom.search).toBe('none');
  expect(r.onCustom.rows).toBe('none');
  expect(r.onCustom.conditionRows).toBe('grid');
  expect(r.onCustom.rowCount).toBe(1);
  expect(r.onCustom.goldStillTicked).toBe(true);

  // A TYPING op answers with a box; a PICKING one with the field's own values.
  expect(r.typed.takes).toBe('text');
  expect(r.typed.boxShown).not.toBe('none');
  expect(r.typed.pickShown).toBe('none');
  expect(r.typed.conditions).toEqual([{ op: 'contains', text: 'gol' }]);

  // THE POINT: both modes survive the round trip, because both are stamped.
  expect(r.backToDefault.mode).toBe('default');
  expect(r.backToDefault.values).toEqual(['gold']);
  expect(r.backToDefault.search).toBe('block');
  expect(r.backToDefault.goldStillTicked).toBe(true);
  expect(r.backToDefault.conditionsKept).toEqual([{ op: 'contains', text: 'gol' }]);
});

/**
 * MANY CONDITIONS, CHAINED.
 *
 * `Add condition` appends a row, and every row after the first LEADS with an
 * And/Or select. Each row asks its OWN question, so one can be a typed
 * `Contains` while the next picks a value from the field's own list.
 *
 * TRAP T-many-conditions-are-one-reading
 */
test('Add condition chains rows, and each row asks its own question', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const menu = el.shadowRoot!
      .querySelector('sherpa-quick-filter[data-id="tier"] sherpa-menu') as HTMLElement & {
        mode: string; conditions: { op: string; join?: string; text?: string; picked?: string[] }[];
      };
    const sr = menu.shadowRoot!;
    const wait = (): Promise<void> => new Promise((res) => { setTimeout(res, 120); });
    const rows = (): HTMLElement[] => [...sr.querySelectorAll<HTMLElement>('.condition-row')];
    const set = (row: HTMLElement, sel: string, value: string, ev = 'change'): void => {
      const field = row.querySelector(sel) as HTMLElement & { value: string };
      field.value = value;
      field.dispatchEvent(new Event(ev, { bubbles: true, composed: true }));
    };

    // OPEN, so a control in it can take focus.
    (menu as HTMLElement & { show(): void }).show();
    sr.querySelector<HTMLElement>('.use-condition sherpa-switch')!.shadowRoot!.querySelector('input')!.click();
    await wait();

    // ROW ONE: a typed Contains. It has NO join — nothing precedes it.
    set(rows()[0]!, '.condition', 'contains');
    await wait();
    set(rows()[0]!, '.condition-value', 'gol', 'input');
    await wait();
    const shown = (row: HTMLElement, sel: string): boolean =>
      getComputedStyle(row.querySelector(sel)!).display !== 'none';
    const firstRow = {
      joinShown: getComputedStyle(rows()[0]!.querySelector('.join')!).display,
      // A LONE row has nothing to drop, so its Remove is hidden too.
      dropShown: getComputedStyle(rows()[0]!.querySelector('.drop-condition')!).display,
      /* ONE Add, BELOW the rows, labelled and in the default look — not in a
         row. Will, 2026-09-26. TRAP T-add-condition-sits-below-the-rows */
      inRow: !!rows()[0]!.querySelector('.add-condition'),
      add: (() => {
        const b = sr.querySelector<HTMLElement>('.add-condition');
        return { text: b?.textContent?.trim(), look: b?.getAttribute('data-look') ?? null,
          below: !!b && b.getBoundingClientRect().top >= rows()[0]!.getBoundingClientRect().bottom };
      })(),
    };

    // ROW TWO: Or, Equals, picked from the field's own values.
    sr.querySelector<HTMLElement>('.add-condition')!.click();
    await wait();
    set(rows()[1]!, '.join', 'or');
    set(rows()[1]!, '.condition-pick', 'silver');
    await wait();

    const secondRow = {
      count: rows().length,
      joinShown: getComputedStyle(rows()[1]!.querySelector('.join')!).display,
      // Row ONE gains its Remove the moment there are two, and gives up Add.
      firstDropShown: getComputedStyle(rows()[0]!.querySelector('.drop-condition')!).display,
      // EVERY row ends in Remove once there are two.
      drops: rows().map((row) => shown(row, '.drop-condition')),
      // The focus went with the Add: to the new row.
      focus: rows()[1]!.contains(sr.activeElement),
      joinOptions: [...(rows()[1]!.querySelector('.join') as HTMLElement).shadowRoot!
        .querySelectorAll('option')].map((o) => (o as HTMLOptionElement).value),
      /* `Equals` answers with the FIELD's own values, never a text box — one
         vocabulary, so a chip and a column heading agree.
         TRAP T-equals-answers-with-the-fields-own-values */
      pickOptions: [...(rows()[1]!.querySelector('.condition-pick') as HTMLElement).shadowRoot!
        .querySelectorAll('option')].map((o) => (o as HTMLOptionElement).value),
      conditions: menu.conditions,
    };

    // Drop row two again. The LAST row is never dropped.
    rows()[1]!.querySelector<HTMLElement>('.drop-condition')!.click();
    await wait();
    const afterDrop = { count: rows().length, conditions: menu.conditions };
    rows()[0]!.querySelector<HTMLElement>('.drop-condition')!.click();
    await wait();

    return { firstRow, secondRow, afterDrop, lastRowKept: rows().length };
  });

  // Row ONE leads, so it has no join and — while alone — nothing to remove.
  expect(r.firstRow.joinShown).toBe('none');
  expect(r.firstRow.dropShown).toBe('none');
  expect(r.firstRow.inRow).toBe(false);
  expect(r.firstRow.add).toEqual({ text: 'Add condition', look: null, below: true });

  expect(r.secondRow.count).toBe(2);
  expect(r.secondRow.joinShown).not.toBe('none');
  expect(r.secondRow.firstDropShown).not.toBe('none');
  expect(r.secondRow.drops).toEqual([true, true]);
  expect(r.secondRow.focus).toBe(true);
  expect(r.secondRow.joinOptions).toEqual(['and', 'or']);
  // Led by the `Select…` placeholder — an empty value is "not answered yet".
  expect(r.secondRow.pickOptions).toEqual(['', 'gold', 'silver']);

  // TWO rows, each with its own op and its own kind of answer.
  expect(r.secondRow.conditions).toEqual([
    { op: 'contains', text: 'gol' },
    { op: 'eq', join: 'or', picked: ['silver'] },
  ]);

  expect(r.afterDrop.count).toBe(1);
  expect(r.afterDrop.conditions).toEqual([{ op: 'contains', text: 'gol' }]);
  // Clear is how you mean "no filter"; an empty condition mode reads as broken.
  expect(r.lastRowKept).toBe(1);
});

/**
 * CONDITIONS ARE OPT-IN.
 *
 * A field answered by ticking a closed set of three — Region, Customer — gets
 * a plain list and no mode button. The reader never meets a control that
 * cannot help them. TRAP T-conditions-are-opt-in-per-field
 */
test('a chip that did not opt in has NO custom mode at all', async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    el.setAttribute('data-type', 'data');
    document.getElementById('root')!.replaceChildren(el);
    await customElements.whenDefined('sherpa-quick-filter-toolbar');
    await el.rendered;
    el.populate([{
      // No `conditions` — the default, and the common case.
      id: 'region', label: 'Region', select: 'multiple',
      options: [{ value: 'emea', label: 'EMEA' }, { value: 'apac', label: 'APAC' }],
    }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
  });

  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const menu = el.shadowRoot!
      .querySelector('sherpa-quick-filter[data-id="region"] sherpa-menu') as HTMLElement & {
        mode: string;
      };
    const sr = menu.shadowRoot!;
    const btn = sr.querySelector<HTMLElement>('.use-condition')!;
    const before = { custom: menu.hasAttribute('data-custom'), btn: getComputedStyle(btn).display };

    // Press it anyway. Nothing happens — the mode does not exist for this field.
    btn.querySelector('sherpa-switch')!.shadowRoot!.querySelector('input')!.click();
    await new Promise((res) => { setTimeout(res, 120); });
    const afterClick = { mode: menu.mode, rows: sr.querySelectorAll('.condition-row').length };

    // And a host WRITING the attribute gets no custom mode either.
    menu.setAttribute('data-mode', 'custom');
    await new Promise((res) => { setTimeout(res, 120); });
    const afterWrite = {
      mode: menu.mode,
      search: getComputedStyle(sr.querySelector('.search')!).display,
    };
    return { before, afterClick, afterWrite };
  });

  expect(r.before.custom).toBe(false);
  expect(r.before.btn).toBe('none');
  expect(r.afterClick).toEqual({ mode: 'default', rows: 0 });
  /* The ATTRIBUTE is not the door. A hidden button and a live mode would be a
     control a reader cannot reach but a script can. */
  expect(r.afterWrite.mode).toBe('default');
  expect(r.afterWrite.search).toBe('block');
});

/**
 * ONE MARK, NOT A SIGN PER OPERATOR.
 *
 * A per-op sign cannot say anything true about a field holding three chained
 * rows. So the badge says only THAT conditions are
 * applied — `fx`, like a spreadsheet's formula mark — and the TOOLTIP spells
 * out which. TRAP T-a-condition-badge-says-that-not-which
 */
test('the BADGE says THAT conditions apply, never WHICH', async ({ page }) => {
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
    /* A condition lives in a ROW now, so setting one means being IN condition
       mode. The mode button is the only way in. */
    let inCondition = false;
    const pick = async (op: string): Promise<void> => {
      if (!inCondition) {
        menu.shadowRoot!.querySelector<HTMLElement>('.use-condition sherpa-switch')!.shadowRoot!.querySelector('input')!.click();
        inCondition = true;
        // The row's composed fields upgrade on their own schedule.
        await wait();
        await wait();
      }
      const row = menu.shadowRoot!.querySelector('.condition-row')!;
      const field = row.querySelector('.condition') as HTMLElement & { value: string };
      field.value = op;
      field.shadowRoot!.querySelector('.control')!
        .dispatchEvent(new Event('change', { bubbles: true }));
    };
    /** Answer the current row, so the condition is real rather than drafted. */
    const answer = (value: string): void => {
      const row = menu.shadowRoot!.querySelector('.condition-row')!;
      const box = row.querySelector('.condition-value') as HTMLElement & { value: string };
      box.value = value;
      box.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
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

    /* `ne` PICKS from the field's own values, so the row is answered by
       choosing one. TRAP T-equals-answers-with-the-fields-own-values */
    await pick('ne');
    await wait();
    const row = menu.shadowRoot!.querySelector('.condition-row')!;
    const sel = row.querySelector('.condition-pick') as HTMLElement & { value: string };
    sel.value = 'gold';
    sel.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await wait();
    menu.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await wait();
    await wait();
    const onNe = badge();

    await pick('startswith');
    await wait();
    answer('Go');
    await wait();
    menu.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await wait();
    await wait();
    return { rows, onEq, onNe, onTyped: badge() };
  });

  // The word alone. No operator sign.
  expect(r.rows).toEqual([
    'Equals', 'Does not equal', 'Contains',
    'Does not contain', 'Starts with', 'Ends with',
  ]);
  // The DEFAULT names no condition, so it wears no mark at all.
  expect(r.onEq).toEqual({ sign: null, spoken: null, caret: 'Gold' });
  // ONE mark, whatever the condition is. The word is still the accessible name.
  expect(r.onNe.sign).toBe('fx');
  /* The WORD, not the value: `condition` is the accessible name, and the
     tooltip carries the whole phrase. */
  expect(r.onNe.spoken).toBe('Does not equal');
  // A typing condition answers with what was TYPED, and the caret keeps it all.
  expect(r.onTyped.sign).toBe('fx');
  expect(r.onTyped.spoken).toBe('Starts with');
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
      // OPT IN. TRAP T-conditions-are-opt-in-per-field
      id: 'owner', label: 'Owner', select: 'single', removable: true, commit: true,
      custom: true,
      options: [{ value: 'ravi', label: 'Ravi' }, { value: 'dana', label: 'Dana' }],
    }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const chip = el.shadowRoot!.querySelector('sherpa-quick-filter[data-id="owner"]')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { conditionValue: string };
    const wait = (): Promise<void> => new Promise((res) => { setTimeout(res, 120); });

    // Into CONDITION mode; the rows live there.
    menu.shadowRoot!.querySelector<HTMLElement>('.use-condition sherpa-switch')!.shadowRoot!.querySelector('input')!.click();
    await wait();
    const row = menu.shadowRoot!.querySelector('.condition-row')!;

    const field = row.querySelector('.condition') as HTMLElement & { value: string };
    field.value = 'contains';
    field.shadowRoot!.querySelector('.control')!
      .dispatchEvent(new Event('change', { bubbles: true }));
    await wait();

    const input = row.querySelector('.condition-value')!
      .shadowRoot!.querySelector('.control') as HTMLInputElement;
    input.value = 'Rav';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    /* NOT yet. This menu COMMITS, so a typed condition is a DRAFT until Apply
       — the same as a ticked row. TRAP T-a-condition-is-a-draft-too */
    const typed = chip.hasAttribute('data-current');

    /* APPLY is where this broke: the bar re-derived `data-current` from ticked
       rows alone, so a typed answer switched its own chip back OFF while still
       filtering. TRAP T-an-operator-decides-pick-or-type */
    menu.shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await wait();
    return { typed, applied: chip.hasAttribute('data-current'), clauses: el.clauses };
  });

  // A DRAFT until Apply, exactly as ticked rows are.
  expect(r.typed).toBe(false);
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
  /* The badge says only THAT a condition applies, so the TOOLTIP is the only
     place the reader can find out which. The VALUE is what was TYPED:
     a typing condition is answered by its box, not by ticks left over from the
     list condition — the ticks survive the flip, but they are not the answer
     while `notcontains` is what the field holds.
     TRAP T-one-state-per-filtered-field */
  expect(r.onCondition).toEqual({
    badge: 'fx', weight: '600', tip: 'Does not contain: Ravi',
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
    /* `---` and `[dim]` would show a divider or a dimmed row if either came
       back. Neither is drawn any more. */
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
  /* THE POINT: three values still, in the declared order, none dropped —
     dropping them makes the current filter a one-way door. They are NOT drawn
     differently: no divider and no dimming, because the checkbox already says
     what is picked. TRAP T-unavailable-value-sorts-below-a-divider */
  expect(r.narrowed).toEqual(['Ravi Menon', 'Dana Whitlock', 'Unassigned']);
  expect(r.stillSelectable).toBe(true);
  expect(r.flags).toEqual({
    type: 'filter', select: 'multiple', clearable: true, search: true, heading: 'Owner',
  });
});

/**
 * A VALUE SELECT WAITS FOR THE ROWS.
 *
 * Row one is stamped by `#syncConditions`, which runs BEFORE the menu's own
 * value rows arrive — so it opened with an empty `Equals` select while row two,
 * added by hand afterwards, was full. `slotchange` re-fills every row.
 *
 * TRAP T-a-value-select-waits-for-the-rows
 */
test('row ONE\'s value select is populated, not just later rows', async ({ page }) => {
  await bar(page);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const menu = el.shadowRoot!
      .querySelector('sherpa-quick-filter[data-id="tier"] sherpa-menu') as
      HTMLElement & { shadowRoot: ShadowRoot };
    const sr = menu.shadowRoot;
    const wait = (ms = 150): Promise<void> => new Promise((res) => { setTimeout(res, ms); });

    sr.querySelector<HTMLElement>('.use-condition sherpa-switch')!.shadowRoot!.querySelector('input')!.click();
    await wait();
    const opts = (row: Element): string[] => {
      const pick = row.querySelector('.condition-pick') as HTMLElement & { shadowRoot: ShadowRoot };
      return [...pick.shadowRoot.querySelectorAll('option')]
        .map((o) => (o as HTMLOptionElement).value);
    };
    const first = opts(sr.querySelector('.condition-row')!);

    const lastAdd = (): HTMLElement => sr.querySelector<HTMLElement>('.add-condition')!;
    lastAdd().click();
    await wait();
    const second = opts(sr.querySelectorAll('.condition-row')[1]!);

    // A pick SURVIVES a re-fill — the values are re-sent, not reset.
    const pick = sr.querySelector('.condition-pick') as HTMLElement & { value: string };
    pick.value = 'silver';
    pick.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await wait();
    lastAdd().click();
    await wait();

    return { first, second, kept: pick.value };
  });

  // BOTH rows offer the field's own values. Row one used to be empty.
  expect(r.first).toEqual(['', 'gold', 'silver']);
  expect(r.second).toEqual(['', 'gold', 'silver']);
  expect(r.kept).toBe('silver');
});

/**
 * A PLAIN LIST STILL FILTERS.
 *
 * A ticked list reports a clause too — `["tier","eq","gold"]` — so a host that
 * skipped `select()` on `clauses[field]` alone stopped EVERY list filtering
 * the moment conditions arrived. The skip is on the MODE, not the clause.
 *
 * TRAP T-a-conditioned-chip-answers-with-its-clause
 */
test('a chip in DEFAULT mode reports picks AND a clause, and is not custom',
  async ({ page }) => {
    await bar(page);
    const r = await page.evaluate(async () => {
      const el = document.querySelector('sherpa-quick-filter-toolbar') as HTMLElement & {
        shadowRoot: ShadowRoot; values: unknown; clauses: unknown;
      };
      const chip = el.shadowRoot.querySelector('sherpa-quick-filter[data-id="tier"]')!;
      const menu = chip.querySelector('sherpa-menu') as HTMLElement & { shadowRoot: ShadowRoot };
      const wait = (ms = 150): Promise<void> => new Promise((res) => { setTimeout(res, ms); });

      const gold = [...chip.querySelectorAll('input')].find((i) => i.value === 'gold')!;
      gold.checked = true;
      gold.dispatchEvent(new Event('change', { bubbles: true }));
      menu.shadowRoot.querySelector<HTMLElement>('.apply')?.click();
      await wait(250);

      return {
        values: JSON.stringify(el.values),
        clauses: JSON.stringify(el.clauses),
        on: chip.hasAttribute('data-current'),
        // The flag a host reads to decide whether `select()` applies.
        condition: chip.getAttribute('data-condition'),
      };
    });

    // The `view` chip is persistent, so it is always in `values`.
    expect(JSON.parse(r.values).tier).toEqual(['gold']);
    expect(JSON.parse(r.clauses).tier).toEqual(['tier', 'eq', 'gold']);
    expect(r.on).toBe(true);
    /* DEFAULT, not custom. Both shapes describe the same ticks, and a host uses
       `values`; only a chip in CUSTOM mode answers with its clause alone. */
    expect(r.condition).toBe('default');
  });

/**
 * THREE WAYS TO ANSWER A FILTER, and the field says which.
 *
 * `conditions` absent → a list of values. `true` → both, with a switch.
 * `'only'` → the condition rows alone, for a field whose values are a wall
 * nobody ticks. Will: "Email data … always a conditional filter, only, that
 * defaults to 'Contains'."
 *
 * TRAP T-a-filter-answers-by-values-conditions-or-both
 */
test('a filter answers by values, by conditions, or by both', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.style.cssText = 'inline-size: 1200px';
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    const opts = [{ value: 'a', label: 'a' }, { value: 'b', label: 'b' }];
    el.populate([
      // DEFAULT — a closed set, ticked.
      { id: 'status', label: 'Status', select: 'multiple', options: opts },
      // BOTH — a short list, and a condition over it.
      { id: 'owner', label: 'Owner', select: 'multiple', custom: true, options: opts },
      // ONLY — a wall. No list at all, opening on Contains.
      { id: 'email', label: 'Email', custom: 'only', op: 'contains' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const look = (id: string) => {
      const chip = el.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
      const menu = chip.querySelector('sherpa-menu') as
        (HTMLElement & { shadowRoot: ShadowRoot; mode?: string }) | null;
      if (!menu) return { menu: false };
      const sw = menu.shadowRoot.querySelector('.use-condition');
      return {
        menu: true,
        custom: menu.hasAttribute('data-custom'),
        only: menu.hasAttribute('data-custom-only'),
        mode: menu.getAttribute('data-mode'),
        op: menu.getAttribute('data-op'),
        switchShown: sw ? getComputedStyle(sw).display !== 'none' : null,
      };
    };

    // And a custom-only menu must REFUSE to go back to a list.
    const email = el.shadowRoot!.querySelector('.chip[data-id="email"] sherpa-menu') as
      HTMLElement & { mode: string };
    email.mode = 'default';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return {
      status: look('status'), owner: look('owner'), email: look('email'),
      afterForcingDefault: email.getAttribute('data-mode'),
    };
  });

  // VALUES only — no condition offered at all.
  expect(r.status.custom).toBe(false);
  expect(r.status.switchShown).toBe(false);

  // BOTH — the switch is there, and it opens on the list.
  expect(r.owner.custom).toBe(true);
  expect(r.owner.only).toBe(false);
  expect(r.owner.switchShown).toBe(true);

  // ONLY — opens in custom mode, on its own op, with nowhere to switch to.
  expect(r.email).toEqual({
    menu: true, custom: true, only: true,
    mode: 'custom', op: 'contains', switchShown: false,
  });
  // The attribute is not a second door back either.
  expect(r.afterForcingDefault).toBe('custom');
});
