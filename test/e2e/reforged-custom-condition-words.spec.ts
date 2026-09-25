import { test, expect, type Bar } from './harness';

/**
 * THE NEW WORDS, AND THE OLD ONES STILL HEARD.
 *
 * A filter is a Default Condition Filter or a Custom Condition Filter — Will,
 * 2026-09-25. The menu's attributes say so now: `data-custom`,
 * `data-custom-only`, and `data-mode="default" | "custom"`. A host that still
 * writes `data-conditional`, `data-conditions-only` or `select | condition`
 * gets the same menu. TRAP T-a-renamed-attribute-keeps-its-old-name
 */
type Menu = HTMLElement & { mode: string };

test('a menu speaks the new words', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = await window.__mount<HTMLElement & { mode: string }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-custom': true });
    const btn = menu.shadowRoot!.querySelector<HTMLElement>('.use-condition')!;
    const heard: unknown[] = [];
    menu.addEventListener('filter-mode-change', (e) => heard.push((e as CustomEvent).detail));
    const shown = getComputedStyle(btn).display !== 'none';
    const start = menu.mode;
    btn.click();
    await window.__settled();
    const on = { mode: menu.mode, attr: menu.getAttribute('data-mode') };
    btn.click();
    await window.__settled();
    const off = { mode: menu.mode, attr: menu.getAttribute('data-mode') };

    // CUSTOM ONLY opens in custom, hides the switch, and cannot leave.
    const only = await window.__mount<HTMLElement & { mode: string }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-custom-only': true });
    only.mode = 'default';
    await window.__settled();
    const onlyBtn = only.shadowRoot!.querySelector<HTMLElement>('.use-condition')!;
    return {
      shown, start, on, off, heard,
      only: { mode: only.mode, attr: only.getAttribute('data-mode'), btn: getComputedStyle(onlyBtn).display },
    };
  });

  expect(r.shown).toBe(true);
  expect(r.start).toBe('default');
  expect(r.on).toEqual({ mode: 'custom', attr: 'custom' });
  expect(r.off).toEqual({ mode: 'default', attr: 'default' });
  expect(r.heard).toEqual([{ mode: 'custom' }, { mode: 'default' }]);
  expect(r.only).toEqual({ mode: 'custom', attr: 'custom', btn: 'none' });
});

test('a menu still hears the old words', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = await window.__mount<HTMLElement & { mode: string }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-conditional': true });
    const sr = menu.shadowRoot!;
    const shown = getComputedStyle(sr.querySelector('.use-condition')!).display !== 'none';

    // The old VALUE is read, and rewritten to the new one.
    menu.setAttribute('data-mode', 'condition');
    await window.__settled();
    const written = {
      mode: menu.mode,
      attr: menu.getAttribute('data-mode'),
      rows: getComputedStyle(sr.querySelector('.condition-rows')!).display !== 'none',
    };
    (menu as unknown as { mode: string }).mode = 'select';
    await window.__settled();
    const back = { mode: menu.mode, attr: menu.getAttribute('data-mode') };

    const only = await window.__mount<HTMLElement & { mode: string }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-conditions-only': true });
    const onlyBtn = only.shadowRoot!.querySelector<HTMLElement>('.use-condition')!;
    return { shown, written, back, only: { mode: only.mode, btn: getComputedStyle(onlyBtn).display } };
  });

  expect(r.shown).toBe(true);
  expect(r.written).toEqual({ mode: 'custom', attr: 'custom', rows: true });
  expect(r.back).toEqual({ mode: 'default', attr: 'default' });
  expect(r.only).toEqual({ mode: 'custom', btn: 'none' });
});

/** `data-condition` is `state.condition`, written by the chip. */
async function chipCondition(page: import('@playwright/test').Page, def: Record<string, unknown>) {
  return page.evaluate(async (d) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [d],
      { style: 'inline-size: 1200px' });
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const c = bar.shadowRoot!.querySelector<HTMLElement>('.chips > .chip')!;
    return c.getAttribute('data-condition');
  }, def);
}

const OWNERS = [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }];

test('a chip says which condition it holds: default, custom, or none', async ({ page }) => {
  expect(await chipCondition(page, {
    id: 'owner', label: 'Owner', select: 'multiple', active: true,
    options: [{ value: 'Dana', label: 'Dana', selected: true }, { value: 'Ravi', label: 'Ravi' }],
  })).toBe('default');
  expect(await chipCondition(page, {
    id: 'owner', label: 'Owner', select: 'multiple', active: true, custom: true,
    op: 'contains', text: 'Da', options: OWNERS,
  })).toBe('custom');
  expect(await chipCondition(page, {
    id: 'owner', label: 'Owner', select: 'multiple', options: OWNERS,
  })).toBe(null);
});

/**
 * A GRID COLUMN READS THE SAME ANSWER — and keeps its NOT.
 *
 * The grid holds the CLAUSE op (`in`, `notin`, `between`) and handed it to the
 * data layer as a reading op. `notin` is not a reading op, so "Is not Pro,
 * Free" came back as `in` — the host filtered to exactly the rows the reader
 * excluded. TRAP T-a-held-clause-op-is-not-a-reading-op
 */
test('a grid column set to Is not keeps its NOT, and reads as custom', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<HTMLElement & {
      setColumnFilter(f: string, c: unknown[] | null): void;
      columnClause(f: string): unknown[] | null;
    }>('sherpa-data-grid', {
      columns: [{ field: 'plan', header: 'Plan' }, { field: 'spend', header: 'Spend', type: 'number' }],
      rows: [{ plan: 'Pro', spend: 10 }, { plan: 'Free', spend: 20 }, { plan: 'Team', spend: 30 }],
    }, { 'data-column-filters': true });
    const chip = (f: string) =>
      el.shadowRoot!.querySelector<HTMLElement>(`.head-cell[data-field="${f}"] .head-filter`)!;
    const look = (f: string) => ({
      condition: chip(f).getAttribute('data-condition'),
      icon: chip(f).getAttribute('data-icon-start'),
    });
    const heard: unknown[] = [];
    el.addEventListener('column-filter-change', (e) => heard.push((e as CustomEvent).detail.clause));

    el.setColumnFilter('plan', ['plan', 'notin', ['Pro', 'Free']]);
    await window.__settled();
    const not = { clause: el.columnClause('plan'), ...look('plan') };
    el.setColumnFilter('plan', ['plan', 'in', ['Pro', 'Free']]);
    await window.__settled();
    const oneOf = { clause: el.columnClause('plan'), ...look('plan') };
    el.setColumnFilter('plan', ['plan', 'contains', 'ro']);
    el.setColumnFilter('spend', ['spend', 'between', [10, 20]]);
    await window.__settled();
    const typed = { clause: el.columnClause('plan'), ...look('plan') };
    const range = { clause: el.columnClause('spend'), ...look('spend') };
    el.setColumnFilter('plan', null);
    await window.__settled();
    return { not, oneOf, typed, range, off: look('plan') };
  });

  expect(r.not).toEqual({ clause: ['plan', 'notin', ['Pro', 'Free']], condition: 'custom', icon: 'function' });
  expect(r.oneOf).toEqual({ clause: ['plan', 'in', ['Pro', 'Free']], condition: 'default', icon: null });
  expect(r.typed).toEqual({ clause: ['plan', 'contains', 'ro'], condition: 'custom', icon: 'function' });
  // A range is filtered, and it is a DEFAULT condition — as a toolbar chip reads it.
  expect(r.range).toEqual({ clause: ['spend', 'between', [10, 20]], condition: 'default', icon: null });
  expect(r.off).toEqual({ condition: null, icon: null });
});

test('the panel reports its mode in the menu\'s own words', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const panel = await window.__mount<HTMLElement & { open(): void }>('sherpa-filter-panel', [{
      scope: 'data', label: 'Data', filters: [{
        id: 'owner', label: 'Owner', select: 'multiple', custom: true,
        options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }],
      }],
    }], { style: 'inline-size: 400px', 'data-min-width': '0' });
    panel.open();
    await window.__settled();
    const heard: unknown[] = [];
    panel.addEventListener('filter-condition-change', (e) => heard.push((e as CustomEvent).detail));
    const sr = panel.shadowRoot!;
    const press = () => sr.querySelector('.field[data-field="owner"] .field-custom')!
      .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
    press();
    await window.__settled();
    const menu = sr.querySelector('.field[data-field="owner"] sherpa-menu') as Menu | null;
    const on = { box: sr.querySelector('.field[data-field="owner"]')!.hasAttribute('data-custom'), mode: menu?.mode };
    press();
    await window.__settled();
    return { on, off: menu?.mode, heard };
  });

  expect(r.on).toEqual({ box: true, mode: 'custom' });
  expect(r.off).toBe('default');
  expect(r.heard).toEqual([
    { scope: 'data', id: 'owner', mode: 'custom' },
    { scope: 'data', id: 'owner', mode: 'default' },
  ]);
});

/**
 * THE DEF SPEAKS THEM TOO. `custom: true | 'only'` on a chip, a column and a
 * panel field; the old `conditions` key still works.
 */
test('a def says custom — and the old conditions key still works', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const opts = [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }];
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', custom: true, options: opts },
      { id: 'email', label: 'Email', custom: 'only', op: 'contains' },
      { id: 'old', label: 'Old', conditions: 'only', op: 'contains' },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const menu = (id: string) => {
      const m = bar.shadowRoot!.querySelector(`.chip[data-id="${id}"] sherpa-menu`) as Menu | null;
      return m && {
        custom: m.hasAttribute('data-custom'),
        only: m.hasAttribute('data-custom-only'),
        mode: m.mode,
      };
    };
    const chips = { owner: menu('owner'), email: menu('email'), old: menu('old') };

    const grid = await window.__mount<HTMLElement>('sherpa-data-grid', {
      columns: [{ field: 'email', header: 'Email', custom: 'only', op: 'contains' }],
      rows: [{ email: 'a@x.io' }, { email: 'b@x.io' }],
    }, { 'data-column-filters': true });
    const col = grid.shadowRoot!.querySelector('.head-cell[data-field="email"] sherpa-menu')!;
    const column = {
      only: col.hasAttribute('data-custom-only'),
      // NO WALL OF ROWS: a custom-only column stamps no values.
      rows: [...col.children].length,
    };

    const panel = await window.__mount<HTMLElement>('sherpa-filter-panel', [{
      scope: 'data', label: 'Data', filters: [{ id: 'owner', label: 'Owner', custom: true, options: opts }],
    }], { 'data-min-width': '0' });
    const field = !!panel.shadowRoot!.querySelector('.field[data-field="owner"] .field-custom');
    return { chips, column, field };
  });

  expect(r.chips.owner).toEqual({ custom: true, only: false, mode: 'default' });
  expect(r.chips.email).toEqual({ custom: true, only: true, mode: 'custom' });
  expect(r.chips.old).toEqual({ custom: true, only: true, mode: 'custom' });
  expect(r.column).toEqual({ only: true, rows: 0 });
  expect(r.field).toBe(true);
});
