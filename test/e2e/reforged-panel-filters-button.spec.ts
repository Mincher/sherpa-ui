import { test, expect } from './harness';

/**
 * THE PANEL'S FILTERS BUTTON IS THE TOOLBAR'S. Will, 2026-09-25: "make the Add
 * Filters button in the filter panel behave the same as the toolbar version
 * BUT shows More Filters when the accordion is collapsed."
 *
 * A SHUT scope hides its filters the way a narrow bar folds its chips, so its
 * Filters menu leads with them: a door into each, a tick for each preset. The
 * badge counts them, and the button is ON while one of them is.
 * TRAP T-a-shut-scope-folds-like-a-bar
 */
const SETUP = `
  const el = document.createElement('sherpa-filter-panel');
  document.getElementById('root').replaceChildren(el);
  await customElements.whenDefined('sherpa-filter-panel');
  await el.rendered;
  const SCOPES = [
    { scope: 'view', label: 'View filters', filters: [] },
    {
      scope: 'data', label: 'Customer records',
      filters: [
        { id: 'at-risk', label: 'At risk', preset: true },
        { id: 'unassigned', label: 'Unassigned', preset: true },
        { id: 'status', label: 'Status', select: 'multiple', removable: true,
          options: [
            { value: 'active', label: 'active', selected: true },
            { value: 'churned', label: 'churned' },
          ] },
        { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 100 },
      ],
      available: [
        { id: 'plan', label: 'Plan' },
        { id: 'custom:mine', label: 'Mine', readings: { plan: { picked: ['gold'] } } },
      ],
      sort: [{ field: 'name', label: 'Name' }, { field: 'spend', label: 'Spend' }],
    },
  ];
  el.populate(SCOPES);
  await new Promise((r) => setTimeout(r, 250));
  el.open();
  await new Promise((r) => setTimeout(r, 150));
  const sr = el.shadowRoot;
  const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const scope = () => sr.querySelector('.scope[data-scope="data"]');
  const btn = () => scope().querySelector('.scope-add');
  const menu = () => btn().querySelector('sherpa-menu');
  /* The menu's rows in order: §Heading, a tick's value (+ ticked), › a caret. */
  const rows = () => [...menu().children].filter((n) => !n.classList.contains('qf-all')).map((n) => {
    if (n.classList.contains('menu-section')) return '§' + n.textContent;
    const box = n.querySelector('input');
    const caret = n.hasAttribute('data-drill') ? '›' : '';
    return box ? box.value + (box.checked ? '+' : '') + caret : caret + n.dataset.value;
  });
  const caret = (id) => menu().querySelector('.menu-row[data-value="' + id + '"] .menu-row-drill');
  const look = () => ({
    rows: rows(), badge: btn().getAttribute('data-badge'), on: btn().getAttribute('data-status'),
  });
  const shut = async () => { scope().open = false; await settle(); await window.__settled(); };
  /* The INNER button, as a pointer presses it. A click on a sherpa-button's
     host is not a control's click, so the summary it sits in takes it. */
  const press = (host) => host.shadowRoot.querySelector('button').click();
`;

test('the Filters and Save filter buttons have their own row, under the heading', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    el.setAttribute('data-saveable', '');
    await settle();
    const box = scope();
    const rect = (n) => { const b = n.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left }; };
    return {
      heading: rect(box.shadowRoot.querySelector('.heading')),
      chevron: rect(box.shadowRoot.querySelector('.chevron')),
      add: rect(btn()),
      save: rect(box.querySelector('.scope-save')),
    };
  })()`) as Record<string, { top: number; bottom: number; left: number }>;

  // A row of their own, BELOW the heading, starting where it starts.
  expect(r['add']!.top).toBeGreaterThanOrEqual(r['heading']!.bottom);
  expect(Math.abs(r['add']!.left - r['heading']!.left)).toBeLessThanOrEqual(1);
  expect(r['save']!.top).toBe(r['add']!.top);
  expect(r['save']!.left).toBeGreaterThan(r['add']!.left);
  // The chevron stays on the heading's row.
  expect(r['chevron']!.bottom).toBeLessThanOrEqual(r['add']!.top);
});

test('open, it is the whole list; shut, it leads with what the scope hides', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const open = look();
    await shut();
    return { open, shut: look() };
  })()`) as Record<string, { rows: string[]; badge: string | null; on: string | null }>;

  // OPEN: nothing is hidden, so no section of hidden filters and no badge.
  expect(r['open']).toEqual({
    rows: ['§Added filters', 'status+', '§Available filters', 'plan', '§Custom filters', 'custom:mine'],
    badge: null, on: null,
  });
  /* SHUT: every filter it draws, in its order, IN Added filters — one section,
     each row with a caret into its child menu. Only Status can be taken off,
     so only Status has a box. TRAP T-a-row-opens-its-child-menu */
  expect(r['shut']!.rows).toEqual([
    '§Added filters', '›sort', '›at-risk', '›unassigned', 'status+›', '›seats',
    '§Available filters', 'plan', '§Custom filters', 'custom:mine',
  ]);
  expect(r['shut']!.badge).toBe('5');
  // ON: Status is answered, and it is hidden.
  expect(r['shut']!.on).toBe('active');
});

test('a hidden preset opens "On"; the button is ON only while a hidden filter is', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    // Nothing on: Status cleared.
    sr.querySelector('.field[data-field="status"] .field-clear').dispatchEvent(
      new CustomEvent('button-click', { bubbles: true, composed: true }));
    await shut();
    const before = look().on;
    menu().show(btn());
    await settle();
    caret('at-risk').click();
    await new Promise((r) => setTimeout(r, 200));
    const box = menu().querySelector('input[value="on"]');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const chip = sr.querySelector('.field[data-field="presets"] .value[data-value="at-risk"]');
    const after = look().on;
    scope().open = true;
    await settle();
    return { before, after, chip: chip.hasAttribute('data-current'), opened: look() };
  })()`) as Record<string, unknown>;

  expect(r['before']).toBeNull();
  expect(r['chip']).toBe(true);
  expect(r['after']).toBe('active');
  // OPEN again: the scope speaks for itself.
  expect(r['opened']).toMatchObject({ badge: null, on: null });
});

test('a door drills into a run of values; its Apply ticks the chips and applies', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    el.addEventListener('quick-filter-change', (e) => heard.push(e.detail.readings?.data?.status?.picked));
    await shut();
    menu().show(btn());
    await settle();
    caret('status').click();
    await settle();
    await new Promise((r) => setTimeout(r, 50));
    const drilled = { heading: menu().getAttribute('data-heading'), drill: menu().hasAttribute('data-drill'),
      rows: rows(), commit: menu().hasAttribute('data-commit'),
      // The FIELD's own Select all comes with its rows; the Filters list has none.
      selectAll: !!menu().querySelector('.qf-all') };
    const churned = [...menu().querySelectorAll('input')].find((i) => i.value === 'churned');
    churned.checked = true;
    churned.dispatchEvent(new Event('change', { bubbles: true }));
    press(menu().shadowRoot.querySelector('.apply'));
    await settle();
    return {
      drilled, heard,
      chips: [...sr.querySelectorAll('.field[data-field="status"] .value[data-current]')].map((c) => c.dataset.value),
      back: { drill: menu().hasAttribute('data-drill'), first: rows()[0], selectAll: !!menu().querySelector('.qf-all') },
      // The menu built for the drill is gone with it.
      built: sr.querySelectorAll('.field[data-field="status"] sherpa-menu').length,
    };
  })()`) as Record<string, unknown>;

  expect(r['drilled']).toEqual({
    heading: 'Status', drill: true, rows: ['active+', 'churned'], commit: true, selectAll: true,
  });
  expect(r['chips']).toEqual(['active', 'churned']);
  expect(r['heard']).toEqual([['active', 'churned']]);
  expect(r['back']).toEqual({ drill: false, first: '§Added filters', selectAll: false });
  expect(r['built']).toBe(0);
});

test('a door drills into Sort, and the chip hears the pick as its own', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    el.addEventListener('sort-change', (e) => heard.push([e.detail.scope, e.detail.field]));
    await shut();
    menu().show(btn());
    await settle();
    caret('sort').click();
    await settle();
    const heading = menu().getAttribute('data-heading');
    const spend = [...menu().querySelectorAll('input')].find((i) => i.value === 'spend');
    spend.checked = true;
    spend.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const chip = sr.querySelector('.value[data-value="sort"]');
    return {
      heading, heard: heard.slice(0, 1),
      on: chip.hasAttribute('data-current'),
      // The rows are HOME again, the pick with them.
      home: chip.querySelector('sherpa-menu').values,
      drill: menu().hasAttribute('data-drill'),
    };
  })()`) as Record<string, unknown>;

  expect(r['heading']).toBe('Sort by');
  expect(r['heard']).toEqual([['data', 'spend']]);
  expect(r['on']).toBe(true);
  expect(r['home']).toEqual(['spend']);
  expect(r['drill']).toBe(false);
});

test('Back returns the list; a body of its own opens the scope on it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    await shut();
    menu().show(btn());
    await settle();
    caret('status').click();
    await settle();
    await new Promise((r) => setTimeout(r, 50));
    press(menu().shadowRoot.querySelector('.drill-back'));
    await settle();
    const back = { heading: menu().getAttribute('data-heading'), first: rows()[0], drill: menu().hasAttribute('data-drill') };
    // SEATS is a number: its answer is drawn in the scope, so the door opens it.
    caret('seats').click();
    await settle();
    return { back, open: scope().hasAttribute('open'), after: look() };
  })()`) as Record<string, unknown>;

  expect(r['back']).toEqual({ heading: 'Filters', first: '§Added filters', drill: false });
  expect(r['open']).toBe(true);
  expect(r['after']).toMatchObject({ badge: null });
});

test('a shut scope stays shut when the panel is filled again', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    await shut();
    el.populate(SCOPES);
    await new Promise((r) => setTimeout(r, 250));
    return { open: scope().hasAttribute('open'), carets: rows().filter((x) => x.includes('›')).length, view: sr.querySelector('.scope[data-scope="view"]').hasAttribute('open') };
  })()`) as Record<string, unknown>;

  expect(r).toEqual({ open: false, carets: 5, view: true });
});
