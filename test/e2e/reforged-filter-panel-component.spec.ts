import { test, expect } from './harness';

/**
 * sherpa-filter-panel — THE TOOLBAR IN A COLUMN, as a component.
 *
 * A SIBLING of sherpa-quick-filter-toolbar over the same DataSource, never a
 * reader of one: it takes the same filter definitions and emits the same
 * `quick-filter-change`. TRAP T-the-panel-is-the-toolbar-in-a-column
 */

/** A panel over two scopes, open, with its rows drawn. */
const SETUP = `
  const el = document.createElement('sherpa-filter-panel');
  document.getElementById('root').replaceChildren(el);
  await customElements.whenDefined('sherpa-filter-panel');
  await el.rendered;
  el.populate([
    { scope: 'view', label: 'View filters', filters: [] },
    {
      scope: 'data', label: 'Customer records',
      filters: [
        { id: 'at-risk', label: 'At risk', preset: true },
        { id: 'unassigned', label: 'Unassigned', preset: true, active: true },
        { id: 'status', label: 'Status', select: 'multiple', removable: true,
          options: [
            { value: 'active', label: 'active', selected: true },
            { value: 'churned', label: 'churned' },
          ] },
        { id: 'owner', label: 'Owner', select: 'single', custom: true,
          options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }] },
        // NO OPTIONS — a date has nothing honest to draw as a run of chips.
        { id: 'created', label: 'Created date' },
      ],
      available: [{ id: 'seats', label: 'Seats' }],
      // HOW the rows are arranged, not which rows. They lead the scope.
      group: [{ field: 'plan', label: 'Plan' }, { field: 'tier', label: 'Tier' }],
      sort: [{ field: 'name', label: 'Name' }, { field: 'spend', label: 'Spend' }],
      sortField: 'name',
    },
  ]);
  await new Promise((r) => setTimeout(r, 250));
  el.open();
  await new Promise((r) => setTimeout(r, 150));
  const sr = el.shadowRoot;
  const q = (s) => [...sr.querySelectorAll(s)];
  const press = (s) => sr.querySelector(s).dispatchEvent(
    new CustomEvent('button-click', { bubbles: true, composed: true }));
  const flip = (s) => sr.querySelector(s + ' sherpa-switch').shadowRoot.querySelector('input').click();
`;

test('a scope draws its presets, its fields, and nothing it cannot', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    return {
      scopes: q('.scope').map((s) => s.getAttribute('data-heading')),
      fields: q('.field').map((f) => f.dataset.field),
      presets: q('.field[data-field="presets"] .value').map((c) => c.dataset.value),
      presetOn: q('.field[data-field="presets"] .value[data-current]').map((c) => c.dataset.value),
      // The field actions are OPT-IN, per field; one not offered is not drawn.
      ownerActions: ['custom', 'clear', 'remove']
        .filter((a) => !!sr.querySelector('.field[data-field="owner"] .field-' + a)),
      statusActions: ['custom', 'clear', 'remove']
        .filter((a) => !!sr.querySelector('.field[data-field="status"] .field-' + a)),
      presetActions: ['clear', 'remove']
        .filter((a) => !!sr.querySelector('.field[data-field="presets"] .field-' + a)),
      canAdd: q('.scope[data-can-add]').map((s) => s.getAttribute('data-scope')),
      emptyScopes: q('.scope-empty').length,
    };
  })()`) as Record<string, unknown>;

  // A scope is NAMED for its content. TRAP T-a-scope-is-named-for-its-content
  expect(r['scopes']).toEqual(['View filters', 'Customer records']);

  /* PRESETS lead in ONE section; `created` is absent because a date is not a
     set of chips. TRAP T-a-chip-with-no-field-is-a-preset */
  /* ONE Organise section holds Group and Sort — they answer the same
     question, and two headers for two chips is a header per control.
     TRAP T-organise-chips-lead-the-bar */
  expect(r['fields']).toEqual(['organise', 'presets', 'status', 'owner']);
  expect(r['presets']).toEqual(['at-risk', 'unassigned']);
  expect(r['presetOn']).toEqual(['unassigned']);

  /* Owner asked for conditions. NEITHER has a Remove: the scope's Add menu is
     the whole list and unticking a row removes it.
     TRAP T-the-add-menu-is-the-whole-list */
  expect(r['ownerActions']).toEqual(['custom', 'clear']);
  expect(r['statusActions']).toEqual(['clear']);
  // A PRESETS section has no field to clear or remove.
  expect(r['presetActions']).toEqual([]);

  expect(r['canAdd']).toEqual(['data']);
  // An empty scope SAYS SO; absent, it reads as a bug rather than an answer.
  expect(r['emptyScopes']).toBe(1);
});

test('Apply reports EVERY field in one event; Discard reverts to it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    el.addEventListener('quick-filter-change', (e) => heard.push(e.detail));

    /* Tick two more. OWNER is single-select, so it is ONE chip carrying the
       field's id — not a run of its values.
       TRAP T-only-group-and-sort-stay-one-chip */
    sr.querySelector('.field[data-field="status"] .value[data-value="churned"]')
      .setAttribute('data-current', '');
    sr.querySelector('.field[data-field="owner"] .value[data-value="Dana"]')
      .setAttribute('data-current', '');
    await new Promise((r) => setTimeout(r, 100));

    press('.apply');
    await new Promise((r) => setTimeout(r, 150));

    // Change again, then DISCARD.
    sr.querySelector('.field[data-field="status"] .value[data-value="active"]')
      .removeAttribute('data-current');
    await new Promise((r) => setTimeout(r, 100));
    const drafted = el.values.data.status;
    press('.discard');
    await new Promise((r) => setTimeout(r, 150));

    return { heard, drafted, after: el.values.data };
  })()`) as { heard: { values: Record<string, Record<string, string[]>> }[];
    drafted: string[]; after: Record<string, string[]> };

  // ONE event, carrying every field — not one per field.
  expect(r.heard).toHaveLength(1);
  expect(r.heard[0]!.values['data']).toEqual({
    presets: ['unassigned'], status: ['active', 'churned'], owner: ['Dana'],
  });

  // The draft really changed…
  expect(r.drafted).toEqual(['churned']);
  // …and DISCARD put back what Apply left, not nothing.
  expect(r.after['status']).toEqual(['active', 'churned']);
});

/**
 * EVERY FILTER FIELD EXPLODES — only GROUP and SORT stay as one chip.
 *
 * The whole point of the panel is that a reader sees the values without
 * opening anything, so a single-select field is a run of chips like any other.
 * Group and Sort are not filters — they say HOW the rows are arranged — and
 * read as the two controls a toolbar already shows.
 * TRAP T-only-group-and-sort-stay-one-chip
 */
test('every filter field is a run; group and sort are one chip', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const chips = (field) => [...sr.querySelectorAll(
      '.field[data-field="' + field + '"] .value')].map((c) => c.dataset.value);

    // STATUS is multiple: every value is visible, and both stay ticked.
    sr.querySelector('.field[data-field="status"] .value[data-value="churned"]')
      .setAttribute('data-current', '');
    sr.querySelector('.field[data-field="status"] .value[data-value="churned"]')
      .dispatchEvent(new CustomEvent('quick-filter-click', { bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 100));

    return {
      // OWNER is single-select, and it STILL explodes.
      owner: chips('owner'),
      ownerChip: sr.querySelector('.field[data-field="owner"]').hasAttribute('data-chip'),
      // GROUP and SORT are the exception: two chips in ONE Organise section.
      organise: chips('organise'),
      // STATUS: a run of its values.
      status: chips('status'),
      statusPicked: el.values.data.status,
    };
  })()`) as Record<string, unknown>;

  expect(r['owner']).toEqual(['Dana', 'Ravi']);
  expect(r['ownerChip']).toBe(false);
  expect(r['organise']).toEqual(['group', 'sort']);
  expect(r['status']).toEqual(['active', 'churned']);
  expect(r['statusPicked']).toEqual(['active', 'churned']);
});

/**
 * CONDITION MODE REPLACES THE VALUE CHIPS.
 *
 * The button is in the FIELD's own header, beside Clear and Remove. The rows
 * are the HOST's to draw: the panel reports the intent and flags the field.
 * TRAP T-conditions-are-opt-in-per-field
 */
test('the condition button flags the field and hides its chips', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    el.addEventListener('filter-condition-change', (e) => heard.push(e.detail));
    const read = () => ({
      flag: sr.querySelector('.field[data-field="owner"]').hasAttribute('data-custom'),
      pressed: String(sr.querySelector('.field[data-field="owner"] .field-custom sherpa-switch')
        .hasAttribute('checked')),
      chips: getComputedStyle(
        sr.querySelector('.field[data-field="owner"] .field-values')).display,
    });

    const before = read();
    flip('.field[data-field="owner"] .field-custom');
    await new Promise((r) => setTimeout(r, 120));
    const on = read();
    flip('.field[data-field="owner"] .field-custom');
    await new Promise((r) => setTimeout(r, 120));
    return { before, on, off: read(), heard };
  })()`) as Record<string, unknown>;

  expect(r['before']).toEqual({ flag: false, pressed: 'false', chips: 'flex' });
  // The rows REPLACE them: two answers side by side is what this avoids.
  expect(r['on']).toEqual({ flag: true, pressed: 'true', chips: 'none' });
  expect(r['off']).toEqual({ flag: false, pressed: 'false', chips: 'flex' });
  expect(r['heard']).toEqual([
    { scope: 'data', id: 'owner', mode: 'custom' },
    { scope: 'data', id: 'owner', mode: 'default' },
  ]);
});

/**
 * A FIELD'S HEADER IS ONE HEIGHT, with or without its buttons, so the column
 * does not jump as Clear comes and goes. A token gap sits under it.
 * Will, 2026-09-26.
 */
test('a field header keeps one height with or without its buttons, and the switch sits under it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const shown = (e) => e.getClientRects().length > 0;
    const read = () => q('.field').filter(shown).map((f) => {
      const head = f.querySelector('.field-head').getBoundingClientRect();
      const next = [...f.children].find((c) => !c.classList.contains('field-head') && shown(c));
      const acts = f.querySelector('.field-acts');
      return {
        field: f.dataset.field,
        acts: !!acts && shown(acts),
        height: Math.round(head.height),
        gap: next ? Math.round(next.getBoundingClientRect().top - head.bottom) : null,
      };
    });
    // The Conditional switch is its OWN row, under the header. Will, 2026-09-26.
    const owner = sr.querySelector('.field[data-field="owner"]');
    const below = owner.querySelector('.field-custom').getBoundingClientRect().top
      >= owner.querySelector('.field-head').getBoundingClientRect().bottom;
    return { fields: read(), below };
  })()`) as { below: boolean; fields: { field: string; acts: boolean; height: number; gap: number | null }[] };

  // Both kinds are here, so the height is tested across the change.
  expect(r.fields.some((f) => f.acts)).toBe(true);
  expect(r.fields.some((f) => !f.acts)).toBe(true);
  expect(new Set(r.fields.map((f) => f.height)).size).toBe(1);
  for (const f of r.fields) if (f.gap !== null) expect(f.gap).toBe(8);
  expect(r.below).toBe(true);
});

/**
 * ONE SEARCH, ACROSS EVERY VALUE. It hides value chips, never field labels: a
 * reader searching "gold" still needs to see that Gold is a Tier.
 */
test('the search matches values everywhere, and keeps the labels', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const search = sr.querySelector('.search');
    search.value = 'as';
    search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 150));
    return {
      shown: q('.value:not([data-filtered-out])').map((c) => c.dataset.value),
      empty: q('.field[data-no-matches]').map((f) => f.dataset.field),
      labels: q('.field-head').length,
    };
  })()`) as { shown: string[]; empty: string[]; labels: number };

  // A value matches its OWN label, and nothing else in the panel.
  expect(r.shown).toEqual(['unassigned']);
  expect(r.empty).toEqual(['organise', 'status', 'owner']);
  // Every field still names itself.
  expect(r.labels).toBe(4);
});

/**
 * THE ADD MENU IS THE WHOLE LIST — ticked is held, unticked is gone — and both
 * are REQUESTS. The HOST owns the list of fields.
 * TRAP T-the-add-menu-is-the-whole-list
 * TRAP T-a-panel-adds-through-the-bar-that-owns-the-list
 */
test('the Add menu adds AND removes, and changes nothing by itself', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    for (const n of ['filter-remove', 'filter-add-request']) {
      el.addEventListener(n, (e) => heard.push([n, e.detail]));
    }

    // WHAT THE MENU HOLDS: every removable field, the held ones ticked.
    const menu = sr.querySelector('.scope[data-scope="data"] .scope-add sherpa-menu');
    await new Promise((r) => setTimeout(r, 200));
    const rows = [...menu.querySelectorAll('.menu-row')]
      .filter((row) => !row.matches('.qf-all, .menu-all, .menu-section'))
      .map((row) => [row.querySelector('input').value, row.querySelector('input').checked]);

    /* SEATS ticked, STATUS unticked — one of each, in one commit. */
    menu.dispatchEvent(new CustomEvent('menu-change', {
      bubbles: true, composed: true, detail: { values: ['seats'] },
    }));
    await new Promise((r) => setTimeout(r, 120));

    return { heard, rows, after: q('.field').map((f) => f.dataset.field) };
  })()`) as { heard: [string, unknown][]; rows: [string, boolean][]; after: string[] };

  // The held field is TICKED; what is left to add is not.
  expect(r.rows).toEqual([['status', true], ['seats', false]]);

  expect(r.heard).toEqual([
    ['filter-add-request', { scope: 'data', ids: ['seats'] }],
    ['filter-remove', { scope: 'data', id: 'status' }],
  ]);
  /* The field is STILL THERE. A component that removed it would be deciding
     what the host's list holds. */
  expect(r.after).toEqual(['organise', 'presets', 'status', 'owner']);
});

/**
 * BELOW ITS WIDTH THE PANEL REFUSES TO SHOW.
 * TRAP T-the-panel-is-desktop-only
 */
test('a narrow window refuses the panel, and shuts an open one', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const wide = await page.evaluate(`(async () => {
    ${SETUP}
    return el.hasAttribute('data-open');
  })()`);
  expect(wide).toBe(true);

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForTimeout(300);

  const narrow = await page.evaluate(`(async () => {
    const el = document.querySelector('sherpa-filter-panel');
    const shut = el.hasAttribute('data-open');
    el.open();
    await new Promise((r) => setTimeout(r, 120));
    return { shut, afterAsk: el.hasAttribute('data-open') };
  })()`) as { shut: boolean; afterAsk: boolean };

  // It closed ITSELF when the window narrowed…
  expect(narrow.shut).toBe(false);
  // …and refuses to open again while it stays narrow.
  expect(narrow.afterAsk).toBe(false);
});

/**
 * GROUP AND SORT LEAD, AND ARE NOT FILTERS.
 *
 * They say HOW the rows are arranged, not WHICH rows are shown — so they
 * report at once and by their own names, and Apply never carries them.
 * Component scope only: "sorted by name" is a property of a table, not of a
 * population. TRAP T-organise-chips-lead-the-bar
 * TRAP T-group-and-sort-are-component-scope
 */
test('group and sort lead the scope, report at once, and skip Apply',
  async ({ page }) => {
    const r = await page.evaluate(`(async () => {
      ${SETUP}
      const heard = [];
      for (const n of ['group-change', 'sort-change', 'quick-filter-change']) {
        el.addEventListener(n, (e) => heard.push([n, e.detail]));
      }

      const order = q('.field').map((f) => f.dataset.field);
      /* ONE chip each, named for the field — the ONLY two that stay chips.
         TRAP T-only-group-and-sort-stay-one-chip */
      const shape = ['organise'].map((id) =>
        q('.field[data-field="' + id + '"] .value').map((c) => c.dataset.value));
      // The scope said which column Sort was on, so its chip arrived ON.
      const sortOn = sr.querySelector('.field[data-field="organise"] .value[data-value="sort"]')
        .hasAttribute('data-current');

      /* Click SORT's BODY, for real. The chip owns the gesture now, so a
         synthetic quick-filter-click is not one. It reports IMMEDIATELY — no
         Apply — and reports the COLUMN the scope named, not its own name.
         TRAP T-a-chip-knows-what-kind-it-is */
      const st = sr.querySelector('.field[data-field="organise"] .value[data-value="sort"]');
      st.shadowRoot.querySelector('.body').click();
      await new Promise((r) => setTimeout(r, 200));

      press('.apply');
      await new Promise((r) => setTimeout(r, 150));

      return {
        order, shape, sortOn, heard,
        applied: heard.find(([n]) => n === 'quick-filter-change')[1].values.data,
      };
    })()`) as Record<string, unknown>;

    // FIRST, above the presets — a reader reaches for them before narrowing.
    expect(r['order']).toEqual(['organise', 'presets', 'status', 'owner']);
    // ONE chip each in ONE section, not fourteen columns each.
    expect(r['shape']).toEqual([['group', 'sort']]);
    // The scope said which column Sort was on, so its chip arrived ON.
    expect(r['sortOn']).toBe(true);

    const heard = r['heard'] as [string, Record<string, unknown>][];
    /* THE COLUMN, not the chip's own name. `group` and `sort` are what the
       chips are CALLED; the column lives in their menu, and the scope named
       `name`. The body CYCLES, so the first click steps a live `asc` to `desc`.
       TRAP T-an-organise-chip-is-named-for-its-job-not-its-field */
    expect(heard[0]).toEqual(
      ['sort-change', { scope: 'data', field: 'name', direction: 'desc' }]);

    /* APPLY carries the FILTERS only. An arrangement is not part of which
       rows are shown, so it has no business in a filter event. */
    expect(Object.keys(r['applied'] as object).sort())
      .toEqual(['owner', 'presets', 'status']);
  });

/**
 * A FIELD ANSWERED BY ITS MENU DRAWS ONE OF ITS OWN.
 *
 * A condition, a number, a range — none of them is a run of chips, and none of
 * them should be a second copy of a control the menu already owns. The panel
 * BUILDS a `<sherpa-menu>` from the same `menuFor` a toolbar uses and draws it
 * INLINE. It never takes another view's element.
 * TRAP T-a-panel-builds-its-own-menus
 * TRAP T-an-inline-menu-is-the-same-menu
 */
test('a number field draws its own menu body, inline', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const root = document.getElementById('root');

    const el = document.createElement('sherpa-filter-panel');
    root.append(el);
    await customElements.whenDefined('sherpa-filter-panel');
    await el.rendered;
    el.populate([{ scope: 'data', label: 'Grid', filters: [
      { id: 'status', label: 'Status', select: 'multiple',
        options: [{ value: 'active', label: 'active' }] },
      // NO options, but a NUMBER — the panel draws that body instead.
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 100 },
    ] }]);
    await new Promise((r) => setTimeout(r, 300));
    el.open();
    await new Promise((r) => setTimeout(r, 250));

    const sr = el.shadowRoot;
    const seats = sr.querySelector('.field[data-field="seats"]');
    const menu = seats.querySelector('sherpa-menu');
    await menu.rendered;
    const card = menu.shadowRoot.querySelector('.menu');
    return {
      fields: [...sr.querySelectorAll('.field')].map((f) => f.dataset.field),
      hasBody: seats.hasAttribute('data-body'),
      inline: menu.hasAttribute('data-inline'),
      // A plain box in the flow, not a popover in the top layer.
      popover: card.getAttribute('popover'),
      position: getComputedStyle(card).position,
      drawn: getComputedStyle(card).display,
      // The MENU owns the number body. TRAP T-a-menu-owns-its-own-bodies
      body: menu.dataset.body,
      numberBox: !!menu.shadowRoot.querySelector('.body-number'),
      // The chip run steps aside for it.
      chips: getComputedStyle(seats.querySelector('.field-values')).display,
    };
  })()`) as Record<string, unknown>;

  // A field with no options but a BODY is still drawn.
  expect(r['fields']).toEqual(['status', 'seats']);
  expect(r['hasBody']).toBe(true);
  expect(r['inline']).toBe(true);
  // INLINE: no popover, in the flow, and showing.
  expect(r['popover']).toBeNull();
  expect(r['position']).toBe('static');
  expect(r['drawn']).toBe('flex');
  expect(r['body']).toBe('number');
  expect(r['numberBox']).toBe(true);
  expect(r['chips']).toBe('none');
});


/**
 * `Organise` is a HEADING over two separate controls, not their field.
 *
 * Group and Sort share one `.field-values` container and are both
 * `select: 'single'`, so the "one of many, untick the siblings" sweep cleared
 * the other one. Will: "if I deactivate Sort then Group is also deactivated
 * and bugs out." It bugs out twice: the grid stays grouped while the chip
 * reads OFF, so the next click toggles it the wrong way.
 *
 * TRAP T-a-section-heading-is-not-a-field
 */
test('clicking Sort leaves Group alone — Organise is a heading, not a field', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const chip = (v) => sr.querySelector('.value[data-value="' + v + '"]');
    const body = (v) => chip(v).shadowRoot.querySelector('.body');
    const snap = () => ({
      group: chip('group').hasAttribute('data-current'),
      sort: chip('sort').hasAttribute('data-current'),
    });

    // Pick a column in each menu, then turn GROUP on.
    for (const [id, field] of [['group', 'tier'], ['sort', 'name']]) {
      const radio = chip(id).querySelector('input[value="' + field + '"]');
      if (radio) { radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    chip('group').setAttribute('data-current', '');
    await new Promise((r) => setTimeout(r, 120));
    const before = snap();

    // Click SORT's body — the gesture that used to clear Group.
    body('sort').click();
    await new Promise((r) => setTimeout(r, 160));
    const afterSort = snap();

    // And the other way round: clicking GROUP must not clear Sort.
    body('group').click();
    await new Promise((r) => setTimeout(r, 160));
    return { before, afterSort, afterGroup: snap() };
  })()`) as Record<string, { group: boolean; sort: boolean }>;

  expect(r.before.group).toBe(true);
  // SORT turned on, and GROUP is exactly where it was.
  expect(r.afterSort).toEqual({ group: true, sort: true });
  // Neither control owns the other.
  expect(r.afterGroup.sort).toBe(true);
});


/**
 * THE PANEL NEVER TOUCHES A CHIP'S MENU.
 *
 * It used to BORROW one — move the element into its own body and give it back
 * on close. Six bugs came from that; see the trap. Opening, closing and
 * re-opening must leave the chip exactly as it was.
 *
 * TRAP T-a-panel-builds-its-own-menus
 */
test('opening and closing the panel leaves a chip\'s own menu alone', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const root = document.getElementById('root');
    root.replaceChildren();

    // The CHIP that owns the menu, exactly as a toolbar holds one.
    const chip = document.createElement('sherpa-quick-filter');
    chip.dataset.id = 'seats';
    const menu = document.createElement('sherpa-menu');
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-heading', 'Seats');
    chip.append(menu);
    root.append(chip);

    const el = document.createElement('sherpa-filter-panel');
    root.append(el);
    await customElements.whenDefined('sherpa-filter-panel');
    await el.rendered;
    el.populate([{ scope: 'data', label: 'Grid', filters: [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 100 },
    ] }]);
    await new Promise((r) => setTimeout(r, 300));

    const home = () => chip.contains(menu) && menu.getAttribute('slot') === 'menu'
      && !menu.hasAttribute('data-inline');

    el.open();
    await new Promise((r) => setTimeout(r, 250));
    const whileOpen = home();
    // The panel drew its OWN, and it is not this one.
    const own = el.shadowRoot.querySelector('.field[data-field="seats"] sherpa-menu');
    const mine = !!own && own !== menu;

    el.close();
    await new Promise((r) => setTimeout(r, 200));
    const afterClose = home();

    el.open();
    await new Promise((r) => setTimeout(r, 300));
    const afterReopen = home()
      && !!el.shadowRoot.querySelector('.field[data-field="seats"] sherpa-menu');
    return { whileOpen, mine, afterClose, afterReopen };
  })()`) as Record<string, boolean>;

  // Untouched throughout — open, closed and open again.
  expect(r.whileOpen).toBe(true);
  expect(r.mine).toBe(true);
  expect(r.afterClose).toBe(true);
  // And the panel still has a body the second time.
  expect(r.afterReopen).toBe(true);
});

/**
 * APPLY AND DISCARD WAIT FOR A CHANGE. Will, 2026-09-26: "The Apply & Discard
 * buttons should be inactive unless there are changes to the filters to apply
 * or discard." A change is any field's whole answer — picks, rows or text —
 * against the last Apply. TRAP T-apply-and-discard-wait-for-a-change
 */
test('Apply and Discard are off until a field changes, and off again after either', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const off = () => ({
      apply: sr.querySelector('.apply').hasAttribute('disabled'),
      discard: sr.querySelector('.discard').hasAttribute('disabled'),
    });
    const wait = () => new Promise((r) => setTimeout(r, 120));
    const chip = (field, value) => sr.querySelector('.field[data-field="' + field + '"] .value[data-value="' + value + '"]');
    const opened = off();

    chip('status', 'churned').shadowRoot.querySelector('.body').click();
    await wait();
    const picked = off();
    press('.discard');
    await wait();
    const discarded = { ...off(), churned: chip('status', 'churned').hasAttribute('data-current') };

    // A CONDITION typed in a row is a change too.
    flip('.field[data-field="owner"] .field-custom');
    await wait();
    const menu = sr.querySelector('.field[data-field="owner"] sherpa-menu');
    const row = menu.shadowRoot.querySelector('.condition-row');
    const cond = row.querySelector('.condition');
    cond.value = 'contains';
    cond.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await wait();
    const text = row.querySelector('.condition-value');
    text.value = 'Da';
    text.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await wait();
    const typed = off();
    press('.apply');
    await wait();
    return { opened, picked, discarded, typed, applied: off() };
  })()`) as Record<string, Record<string, boolean>>;

  expect(r['opened']).toEqual({ apply: true, discard: true });
  expect(r['picked']).toEqual({ apply: false, discard: false });
  expect(r['discarded']).toEqual({ apply: true, discard: true, churned: false });
  expect(r['typed']).toEqual({ apply: false, discard: false });
  expect(r['applied']).toEqual({ apply: true, discard: true });
});
