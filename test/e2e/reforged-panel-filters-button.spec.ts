import { test, expect } from './harness';

/**
 * THE PANEL'S FILTERS BUTTON IS THE TOOLBAR'S. Will, 2026-09-25: "make the Add
 * Filters button in the filter panel behave the same as the toolbar version
 * BUT shows More Filters when the accordion is collapsed."
 *
 * ONE button, in the panel's HEADER, for every scope (TODO 124): each row says
 * its scope, and a filter is added to its default scope.
 *
 * A SHUT scope hides its filters the way a narrow bar folds its chips, so the
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
  el.show();
  await new Promise((r) => setTimeout(r, 150));
  const sr = el.shadowRoot;
  const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const scope = () => sr.querySelector('.scope[data-scope="data"]');
  const btn = () => sr.querySelector('.filters-btn');
  const menu = () => btn().querySelector('sherpa-menu');
  /* The menu's rows in order: §Heading, a tick's value (+ ticked), › a caret. */
  const rows = () => [...menu().children].filter((n) => !n.classList.contains('qf-all')).map((n) => {
    if (n.classList.contains('menu-section')) return '§' + n.textContent;
    const box = n.querySelector('input');
    const caret = n.hasAttribute('data-drill') ? '›' : '';
    return box ? box.value + (box.checked ? '+' : '') + caret : caret + n.dataset.value;
  });
  // A row's value names its SCOPE: every filter here is in the data scope.
  const caret = (id) => menu().querySelector('.menu-row[data-value="data:' + id + '"] .menu-row-drill');
  const look = () => ({
    rows: rows(), badge: btn().getAttribute('data-badge'), on: btn().getAttribute('data-status'),
  });
  const shut = async () => { scope().open = false; await settle(); await window.__settled(); };
  /* The INNER button, as a pointer presses it. A click on a sherpa-button's
     host is not a control's click, so the summary it sits in takes it. */
  const press = (host) => host.shadowRoot.querySelector('button').click();
`;

test('the Filters button is in the panel header; a scope header holds no button, and Save is its body\'s first row', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    el.setAttribute('data-saveable', '');
    await settle();
    const box = scope();
    const rect = (n) => { const b = n.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, mid: (b.top + b.bottom) / 2 }; };
    const summary = box.shadowRoot.querySelector('.header');
    return {
      header: rect(summary),
      heading: rect(box.shadowRoot.querySelector('.heading')),
      chevron: rect(box.shadowRoot.querySelector('.chevron')),
      filters: rect(btn()),
      reset: rect(sr.querySelector('.reset-all')),
      save: rect(box.querySelector('.scope-save')),
      firstField: rect(box.querySelector('.field')),
      // A summary is a button: nothing a reader can press may sit in it. TODO 117.
      inSummary: box.querySelectorAll(':scope > [slot="actions"]').length,
      inPanelHead: !!btn().closest('.head'),
      // The old button is gone, not hidden.
      old: sr.querySelectorAll('.scope-add').length,
    };
  })()`) as Record<string, { top: number; bottom: number; left: number; right: number; mid: number }> &
    { inSummary: number; inPanelHead: boolean; old: number };

  // Will, 2026-09-26: the chevron LEFT of the label.
  expect(r['chevron']!.right).toBeLessThanOrEqual(r['heading']!.left);
  expect(r.inSummary).toBe(0);
  expect(r.old).toBe(0);
  // ONE Filters button, in the panel's header, before Reset on its row.
  expect(r.inPanelHead).toBe(true);
  expect(r['filters']!.right).toBeLessThanOrEqual(r['reset']!.left);
  expect(Math.abs(r['filters']!.mid - r['reset']!.mid)).toBeLessThanOrEqual(2);
  // Save filter: under the scope's header, above its first field, at the right.
  expect(r['save']!.top).toBeGreaterThanOrEqual(r['header']!.bottom);
  expect(r['save']!.bottom).toBeLessThanOrEqual(r['firstField']!.top);
  // Rounded: Firefox on Linux measured this 16.000015.
  expect(Math.round(r['header']!.right - r['save']!.right)).toBeLessThanOrEqual(16);
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
    rows: ['§Added filters', 'data:status+', '§Available filters', 'data:plan', '§Saved filters', 'data:custom:mine'],
    badge: null, on: null,
  });
  /* SHUT: every filter it draws, in its order, IN Added filters — one section,
     each row with a caret into its child menu. Only Status can be taken off,
     so only Status has a box. TRAP T-a-row-opens-its-child-menu */
  expect(r['shut']!.rows).toEqual([
    '§Added filters', '›data:sort', '›data:at-risk', '›data:unassigned', 'data:status+›', '›data:seats',
    '§Available filters', 'data:plan', '§Saved filters', 'data:custom:mine',
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

/* Will, TODO 124: "move the 'Filters' button, and menu, to the filter panel
   header. This will consolidate the filter menu for all scopes into 1 menu…
   Filters will get added to their default scope." */
test('ONE menu for every scope: each row says its scope, and a filter is added to its default scope', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const panel = await window.__mount<HTMLElement>('sherpa-filter-panel', [
      { scope: 'view', label: 'View filters',
        filters: [{ id: 'region', label: 'Region', removable: true, options: [{ value: 'EMEA', label: 'EMEA' }] }],
        // The View may take ANY component's field — and one of its own.
        available: [{ id: 'seats', label: 'Seats' }, { id: 'status', label: 'Status', note: 'Customer records' },
          { id: 'owner', label: 'Owner' }] },
      // A chart's own field shares its id with the grid's.
      { scope: 'picks:bar', label: 'By status', part: true,
        filters: [{ id: 'status', label: 'Status', options: [{ value: 'active', label: 'active' }] }] },
      { scope: 'data', label: 'Customer records',
        filters: [{ id: 'status', label: 'Status', removable: true, options: [{ value: 'active', label: 'active' }] }],
        available: [{ id: 'seats', label: 'Seats' }, { id: 'custom:mine', label: 'Mine', readings: { plan: { picked: ['gold'] } } }] },
    ], { open: true, style: 'inline-size: 480px' });
    await window.__settled();
    const sr = panel.shadowRoot!;
    const btn = sr.querySelector<HTMLElement>('.filters-btn')!;
    const menu = (): HTMLElement => btn.querySelector('sherpa-menu')!;
    const rows = (): string[] => [...menu().children].map((n) => {
      if (n.classList.contains('menu-section')) return `§${n.textContent}`;
      const box = n.querySelector('input');
      return `${box?.value ?? (n as HTMLElement).dataset['value']}${box?.checked ? '+' : ''} · ${(n as HTMLElement).dataset['note'] ?? ''}`;
    });
    const heard: [string, unknown][] = [];
    for (const type of ['filter-add-request', 'filter-remove']) {
      panel.addEventListener(type, (e) => heard.push([type, (e as CustomEvent).detail]));
    }
    const listed = rows();
    // Seats and Owner ticked, Region unticked: one commit.
    menu().dispatchEvent(new CustomEvent('menu-change', {
      bubbles: true, composed: true, detail: { values: ['data:status', 'data:seats', 'view:owner'] },
    }));
    await window.__settled();
    return { listed, heard, buttons: sr.querySelectorAll('.filters-btn, .scope-add').length };
  });

  expect(r.buttons).toBe(1);
  expect(r.listed).toEqual([
    '§Added filters',
    'view:region+ · View filters',
    'data:status+ · Customer records',
    '§Available filters',
    // ONCE, in its DEFAULT scope: the component scope that offers it…
    'data:seats · Customer records',
    // …and the View only for a field no component offers.
    'view:owner · View filters',
    '§Saved filters',
    'data:custom:mine · Customer records',
  ]);
  // Each ask goes to the scope its row names.
  expect(r.heard).toEqual([
    ['filter-add-request', { scope: 'data', ids: ['seats'] }],
    ['filter-add-request', { scope: 'view', ids: ['owner'] }],
    ['filter-remove', { scope: 'view', id: 'region' }],
  ]);
});
