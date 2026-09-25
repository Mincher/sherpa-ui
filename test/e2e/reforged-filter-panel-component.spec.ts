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
        { id: 'owner', label: 'Owner', select: 'single', conditions: true,
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
`;

test('a scope draws its presets, its fields, and nothing it cannot', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    return {
      scopes: q('.scope').map((s) => s.getAttribute('data-heading')),
      fields: q('.field').map((f) => f.dataset.field),
      presets: q('.field[data-field="presets"] .value').map((c) => c.dataset.value),
      presetOn: q('.field[data-field="presets"] .value[data-current]').map((c) => c.dataset.value),
      /* The three field actions are OPT-IN, per field — and the ones a field
         does not offer are REMOVED, not hidden: a group squares corners by
         POSITION, and a hidden first child still counts.
         TRAP T-a-hidden-sibling-still-counts-as-first-child */
      ownerActions: ['conditional', 'clear', 'remove']
        .filter((a) => !!sr.querySelector('.field[data-field="owner"] .field-' + a)),
      statusActions: ['conditional', 'clear', 'remove']
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
  expect(r['ownerActions']).toEqual(['conditional', 'clear']);
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
      flag: sr.querySelector('.field[data-field="owner"]').hasAttribute('data-conditional'),
      pressed: sr.querySelector('.field[data-field="owner"] .field-conditional')
        .getAttribute('aria-pressed'),
      chips: getComputedStyle(
        sr.querySelector('.field[data-field="owner"] .field-values')).display,
    });

    const before = read();
    press('.field[data-field="owner"] .field-conditional');
    await new Promise((r) => setTimeout(r, 120));
    const on = read();
    press('.field[data-field="owner"] .field-conditional');
    await new Promise((r) => setTimeout(r, 120));
    return { before, on, off: read(), heard };
  })()`) as Record<string, unknown>;

  expect(r['before']).toEqual({ flag: false, pressed: 'false', chips: 'flex' });
  // The rows REPLACE them: two answers side by side is what this avoids.
  expect(r['on']).toEqual({ flag: true, pressed: 'true', chips: 'none' });
  expect(r['off']).toEqual({ flag: false, pressed: 'false', chips: 'flex' });
  expect(r['heard']).toEqual([
    { scope: 'data', id: 'owner', conditional: true },
    { scope: 'data', id: 'owner', conditional: false },
  ]);
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
      .filter((row) => !row.matches('.qf-all, .menu-all'))
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

      /* Click SORT's body. It reports IMMEDIATELY — no Apply — and reports the
         COLUMN the scope named, not the chip's own name.
         TRAP T-an-organise-chip-is-named-for-its-job-not-its-field */
      const st = sr.querySelector('.field[data-field="organise"] .value[data-value="sort"]');
      st.dispatchEvent(new CustomEvent('quick-filter-click', { bubbles: true, composed: true }));
      await new Promise((r) => setTimeout(r, 120));

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
 * A FIELD ANSWERED BY ITS MENU DRAWS THAT MENU.
 *
 * A condition, a number, a range — none of them is a run of chips, and none of
 * them should be a second copy of a control the menu already owns. The panel
 * borrows the field's own `<sherpa-menu>`, draws it INLINE, and gives it back
 * untouched. TRAP T-an-inline-menu-is-the-same-menu
 */
test('a number field shows its own menu body, and gets it back', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const root = document.getElementById('root');

    // A NUMBER field's menu, the shape a toolbar builds for one.
    const holder = document.createElement('div');
    const menu = document.createElement('sherpa-menu');
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-heading', 'Seats');
    const body = document.createElement('div');
    body.className = 'qf-number';
    body.innerHTML = '<input class="qf-number-one" type="number" value="42" />';
    menu.append(body);
    holder.append(menu);
    root.append(holder);

    const el = document.createElement('sherpa-filter-panel');
    root.append(el);
    await customElements.whenDefined('sherpa-filter-panel');
    await el.rendered;
    el.populate([{ scope: 'data', label: 'Grid', filters: [
      { id: 'status', label: 'Status', select: 'multiple',
        options: [{ value: 'active', label: 'active' }] },
      // NO options, but a MENU — the panel draws that body instead.
      { id: 'seats', label: 'Seats', menu },
    ] }]);
    await new Promise((r) => setTimeout(r, 300));
    el.open();
    await new Promise((r) => setTimeout(r, 200));

    const sr = el.shadowRoot;
    const seats = sr.querySelector('.field[data-field="seats"]');
    const card = menu.shadowRoot.querySelector('.menu');
    const drawn = {
      fields: [...sr.querySelectorAll('.field')].map((f) => f.dataset.field),
      hasBody: seats.hasAttribute('data-body'),
      inline: menu.hasAttribute('data-inline'),
      // A plain box in the flow, not a popover in the top layer.
      popover: card.getAttribute('popover'),
      position: getComputedStyle(card).position,
      drawn: getComputedStyle(card).display,
      // The field's OWN control travelled with it, state and all.
      inputValue: seats.querySelector('.qf-number-one').value,
      // The chip run steps aside for it.
      chips: getComputedStyle(seats.querySelector('.field-values')).display,
    };

    el.populate([{ scope: 'data', label: 'Grid', filters: [] }]);
    await new Promise((r) => setTimeout(r, 250));
    return { drawn, home: {
      back: holder.contains(menu),
      slot: menu.getAttribute('slot'),
      inline: menu.hasAttribute('data-inline'),
      popover: card.getAttribute('popover'),
    } };
  })()`) as Record<string, Record<string, unknown>>;

  // A field with no options but a MENU is still drawn.
  expect(r['drawn']!['fields']).toEqual(['status', 'seats']);
  expect(r['drawn']!['hasBody']).toBe(true);
  expect(r['drawn']!['inline']).toBe(true);
  // INLINE: no popover, in the flow, and showing.
  expect(r['drawn']!['popover']).toBeNull();
  expect(r['drawn']!['position']).toBe('static');
  expect(r['drawn']!['drawn']).toBe('flex');
  // The same input, not a copy of it.
  expect(r['drawn']!['inputValue']).toBe('42');
  expect(r['drawn']!['chips']).toBe('none');

  /* HOME, exactly as it was: its slot back, and a popover again. `manual`,
     not `auto` — the menu owns its own dismiss, because its rows are SLOTTED
     and the browser reads the DOM tree for light-dismiss.
     TRAP T-a-slotted-row-is-outside-its-own-popover */
  expect(r['home']).toEqual({
    back: true, slot: 'menu', inline: false, popover: 'manual',
  });
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
