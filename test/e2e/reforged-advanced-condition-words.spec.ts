import { test, expect, type Bar } from './harness';

/**
 * THE NEW WORDS, AND THE OLD ONES STILL HEARD.
 *
 * A filter is Simple or Advanced — Will, 2026-09-27 (TODO 75). It was a
 * Default or a Custom Condition Filter, and before that Conditional. The menu's
 * attributes say so now: `data-advanced`, `data-advanced-only`, and
 * `data-mode="simple" | "advanced"`. A host that still
 * writes `data-conditional`, `data-conditions-only` or `select | condition`
 * gets the same menu. TRAP T-a-renamed-attribute-keeps-its-old-name
 */
type Menu = HTMLElement & { mode: string };

test('a menu speaks the new words', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = await window.__mount<HTMLElement & { mode: string }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-advanced': true });
    const btn = menu.shadowRoot!.querySelector<HTMLElement>('.use-condition')!;
    const flip = () => btn.querySelector('sherpa-switch')!.shadowRoot!.querySelector('input')!.click();
    const heard: unknown[] = [];
    menu.addEventListener('filter-mode-change', (e) => heard.push((e as CustomEvent).detail));
    const shown = getComputedStyle(btn).display !== 'none';
    const start = menu.mode;
    flip();
    await window.__settled();
    const sw = btn.querySelector('sherpa-switch')!;
    const on = { mode: menu.mode, attr: menu.getAttribute('data-mode'), checked: sw.hasAttribute('checked') };
    flip();
    await window.__settled();
    const off = { mode: menu.mode, attr: menu.getAttribute('data-mode'), checked: sw.hasAttribute('checked') };

    // ADVANCED ONLY opens in Advanced, hides the switch, and cannot leave.
    const only = await window.__mount<HTMLElement & { mode: string }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-advanced-only': true });
    only.mode = 'simple';
    await window.__settled();
    const onlyBtn = only.shadowRoot!.querySelector<HTMLElement>('.use-condition')!;
    return {
      shown, start, on, off, heard, label: btn.textContent!.trim(),
      only: { mode: only.mode, attr: only.getAttribute('data-mode'), btn: getComputedStyle(onlyBtn).display },
    };
  });

  expect(r.shown).toBe(true);
  expect(r.start).toBe('simple');
  // A SWITCH labelled Advanced, as Range is — Will's word (TODO 75).
  expect(r.label).toBe('Advanced');
  expect(r.on).toEqual({ mode: 'advanced', attr: 'advanced', checked: true });
  expect(r.off).toEqual({ mode: 'simple', attr: 'simple', checked: false });
  expect(r.heard).toEqual([{ mode: 'advanced' }, { mode: 'simple' }]);
  expect(r.only).toEqual({ mode: 'advanced', attr: 'advanced', btn: 'none' });
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
  expect(r.written).toEqual({ mode: 'advanced', attr: 'advanced', rows: true });
  expect(r.back).toEqual({ mode: 'simple', attr: 'simple' });
  expect(r.only).toEqual({ mode: 'advanced', btn: 'none' });
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

test('a chip says which condition it holds: simple, advanced, or none', async ({ page }) => {
  expect(await chipCondition(page, {
    id: 'owner', label: 'Owner', select: 'multiple', active: true,
    options: [{ value: 'Dana', label: 'Dana', selected: true }, { value: 'Ravi', label: 'Ravi' }],
  })).toBe('simple');
  expect(await chipCondition(page, {
    id: 'owner', label: 'Owner', select: 'multiple', active: true, advanced: true,
    op: 'contains', text: 'Da', options: OWNERS,
  })).toBe('advanced');
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
test('a grid column set to Is not keeps its NOT, and reads as Advanced', async ({ page }) => {
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

  expect(r.not).toEqual({ clause: ['plan', 'notin', ['Pro', 'Free']], condition: 'advanced', icon: 'function' });
  expect(r.oneOf).toEqual({ clause: ['plan', 'in', ['Pro', 'Free']], condition: 'simple', icon: null });
  expect(r.typed).toEqual({ clause: ['plan', 'contains', 'ro'], condition: 'advanced', icon: 'function' });
  // A range is filtered, and it is a SIMPLE condition — as a toolbar chip reads it.
  expect(r.range).toEqual({ clause: ['spend', 'between', [10, 20]], condition: 'simple', icon: null });
  expect(r.off).toEqual({ condition: null, icon: null });
});

test('the panel reports its mode in the menu\'s own words', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const panel = await window.__mount<HTMLElement & { show(): void }>('sherpa-filter-panel', [{
      scope: 'data', label: 'Data', filters: [{
        id: 'owner', label: 'Owner', select: 'multiple', advanced: true,
        options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }],
      }],
    }], { style: 'inline-size: 400px', 'data-min-width': '0' });
    panel.show();
    await window.__settled();
    const heard: unknown[] = [];
    panel.addEventListener('filter-condition-change', (e) => heard.push((e as CustomEvent).detail));
    const sr = panel.shadowRoot!;
    const press = () => sr.querySelector('.field[data-field="owner"] .field-advanced sherpa-switch')!
      .shadowRoot!.querySelector('input')!.click();
    press();
    await window.__settled();
    const menu = sr.querySelector('.field[data-field="owner"] sherpa-menu') as Menu | null;
    const on = { box: sr.querySelector('.field[data-field="owner"]')!.hasAttribute('data-advanced'), mode: menu?.mode };
    press();
    await window.__settled();
    return { on, off: menu?.mode, heard };
  });

  expect(r.on).toEqual({ box: true, mode: 'advanced' });
  expect(r.off).toBe('simple');
  expect(r.heard).toEqual([
    { scope: 'data', id: 'owner', mode: 'advanced' },
    { scope: 'data', id: 'owner', mode: 'simple' },
  ]);
});

/**
 * THE DEF SPEAKS THEM TOO. `advanced: true | 'only'` on a chip, a column and a
 * panel field; the old `custom` and `conditions` keys still work.
 */
test('a def says advanced — and the old custom and conditions keys still work', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const opts = [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }];
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', advanced: true, options: opts },
      { id: 'email', label: 'Email', advanced: 'only', op: 'contains' },
      { id: 'old', label: 'Old', conditions: 'only', op: 'contains' },
      { id: 'was', label: 'Was', custom: 'only', op: 'contains' },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const menu = (id: string) => {
      const m = bar.shadowRoot!.querySelector(`.chip[data-id="${id}"] sherpa-menu`) as Menu | null;
      return m && {
        advanced: m.hasAttribute('data-advanced'),
        only: m.hasAttribute('data-advanced-only'),
        mode: m.mode,
      };
    };
    const chips = { owner: menu('owner'), email: menu('email'), old: menu('old'), was: menu('was') };

    const grid = await window.__mount<HTMLElement>('sherpa-data-grid', {
      columns: [{ field: 'email', header: 'Email', advanced: 'only', op: 'contains' }],
      rows: [{ email: 'a@x.io' }, { email: 'b@x.io' }],
    }, { 'data-column-filters': true });
    const col = grid.shadowRoot!.querySelector('.head-cell[data-field="email"] sherpa-menu')!;
    const column = {
      only: col.hasAttribute('data-advanced-only'),
      // NO WALL OF ROWS: an advanced-only column stamps no values.
      rows: [...col.children].length,
    };

    const panel = await window.__mount<HTMLElement>('sherpa-filter-panel', [{
      scope: 'data', label: 'Data', filters: [
        { id: 'owner', label: 'Owner', advanced: true, options: opts },
        { id: 'email', label: 'Email', advanced: 'only', op: 'contains' },
      ],
    }], { 'data-min-width': '0' });
    (panel as HTMLElement & { show(): void }).show();
    await window.__settled();
    const psr = panel.shadowRoot!;
    const field = !!psr.querySelector('.field[data-field="owner"] .field-advanced');
    /* CONDITIONS ONLY: nowhere to switch to, so no switch — and its rows show
       from the start. Will, 2026-09-26. */
    const emailRows = psr.querySelector('.field[data-field="email"] sherpa-menu')
      ?.shadowRoot?.querySelector('.condition-row');
    const onlyField = {
      switch: !!psr.querySelector('.field[data-field="email"] .field-advanced'),
      rows: !!emailRows && emailRows.getClientRects().length > 0,
    };
    return { chips, column, field, onlyField };
  });

  expect(r.chips.owner).toEqual({ advanced: true, only: false, mode: 'simple' });
  expect(r.chips.email).toEqual({ advanced: true, only: true, mode: 'advanced' });
  expect(r.chips.old).toEqual({ advanced: true, only: true, mode: 'advanced' });
  expect(r.chips.was).toEqual({ advanced: true, only: true, mode: 'advanced' });
  expect(r.column).toEqual({ only: true, rows: 0 });
  expect(r.field).toBe(true);
  expect(r.onlyField).toEqual({ switch: false, rows: true });
});
