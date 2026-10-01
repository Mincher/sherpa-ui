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
  el.show();
  await new Promise((r) => setTimeout(r, 150));
  const sr = el.shadowRoot;
  const q = (s) => [...sr.querySelectorAll(s)];
  const press = (s) => sr.querySelector(s).dispatchEvent(
    new CustomEvent('button-click', { bubbles: true, composed: true }));
  const flip = (s) => sr.querySelector(s).shadowRoot.querySelector('button').click();
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
      ownerActions: ['advanced', 'clear', 'remove']
        .filter((a) => !!sr.querySelector('.field[data-field="owner"] .field-' + a)),
      statusActions: ['advanced', 'clear', 'remove']
        .filter((a) => !!sr.querySelector('.field[data-field="status"] .field-' + a)),
      presetActions: ['advanced', 'clear', 'remove']
        .filter((a) => !!sr.querySelector('.field[data-field="presets"] .field-' + a)),
      // Group and Sort ARRANGE; a condition means nothing to them.
      organiseActions: ['advanced', 'clear', 'remove']
        .filter((a) => !!sr.querySelector('.field[data-field="organise"] .field-' + a)),
      // ONE Filters button, in the panel's header, live while any scope has a list.
      canAdd: [q('.filters-btn').length, q('.filters-btn[disabled]').length, q('.scope-add').length],
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
  expect(r['ownerActions']).toEqual(['advanced', 'clear']);
  expect(r['statusActions']).toEqual(['clear']);
  // A PRESETS section has no field to clear or remove.
  expect(r['presetActions']).toEqual([]);
  expect(r['organiseActions']).toEqual([]);

  expect(r['canAdd']).toEqual([1, 0, 0]);
  // An empty scope SAYS SO; absent, it reads as a bug rather than an answer.
  expect(r['emptyScopes']).toBe(1);
});

/**
 * NO FOOTER: a change applies as it is made, and reports ITS field alone.
 * Every field at once would switch a field that is off back on. Will,
 * 2026-09-27 (TODO 62). TRAP T-the-panel-reports-its-own-reading
 */
test('a change reports its own field alone, as it is made — there is no footer', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    el.addEventListener('quick-filter-change', (e) => heard.push(e.detail.readings));
    const chip = (field, value) => sr.querySelector('.field[data-field="' + field + '"] .value[data-value="' + value + '"]');
    chip('status', 'churned').shadowRoot.querySelector('.body').click();
    await new Promise((r) => setTimeout(r, 150));
    chip('owner', 'Dana').shadowRoot.querySelector('.body').click();
    await new Promise((r) => setTimeout(r, 150));
    return { heard, footer: !!sr.querySelector('sherpa-container-footer, .apply, .discard') };
  })()`) as { heard: Record<string, Record<string, { picked: string[] }>>[]; footer: boolean };

  expect(r.footer).toBe(false);
  expect(r.heard.map((h) => Object.keys(h['data'] ?? {}))).toEqual([['status'], ['owner']]);
  expect(r.heard[0]!['data']!['status']!.picked).toEqual(['active', 'churned']);
  expect(r.heard[1]!['data']!['owner']!.picked).toEqual(['Dana']);
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
      flag: sr.querySelector('.field[data-field="owner"]').hasAttribute('data-advanced'),
      pressed: sr.querySelector('.field[data-field="owner"] .field-advanced').getAttribute('aria-pressed'),
      chips: getComputedStyle(
        sr.querySelector('.field[data-field="owner"] .field-values')).display,
    });

    const before = read();
    flip('.field[data-field="owner"] .field-advanced');
    await new Promise((r) => setTimeout(r, 120));
    const on = read();
    flip('.field[data-field="owner"] .field-advanced');
    await new Promise((r) => setTimeout(r, 120));
    return { before, on, off: read(), heard };
  })()`) as Record<string, unknown>;

  expect(r['before']).toEqual({ flag: false, pressed: 'false', chips: 'flex' });
  // The rows REPLACE them: two answers side by side is what this avoids.
  expect(r['on']).toEqual({ flag: true, pressed: 'true', chips: 'none' });
  expect(r['off']).toEqual({ flag: false, pressed: 'false', chips: 'flex' });
  expect(r['heard']).toEqual([
    { scope: 'data', id: 'owner', mode: 'advanced' },
    { scope: 'data', id: 'owner', mode: 'simple' },
  ]);
});

/**
 * A FIELD'S HEADER IS ONE HEIGHT, with or without its buttons, so the column
 * does not jump as Clear comes and goes. A token gap sits under it.
 * Will, 2026-09-26.
 */
test('a field header keeps one height with or without its buttons, and Advanced is an f(x) button at its end', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const shown = (e) => e.getClientRects().length > 0;
    const read = () => q('.field').filter(shown).map((f) => {
      const head = f.querySelector('.field-head').getBoundingClientRect();
      const next = [...f.children].find((c) => !c.classList.contains('field-head') && shown(c));
      const acts = f.querySelector('.field-acts');
      return {
        field: f.dataset.field,
        acts: !!acts && [...acts.querySelectorAll('sherpa-button')].some(shown),
        height: Math.round(head.height),
        gap: next ? Math.round(next.getBoundingClientRect().top - head.bottom) : null,
      };
    });
    // ADVANCED is an f(x) icon button IN the header, at its end. Will, TODO 141.
    const owner = sr.querySelector('.field[data-field="owner"]');
    const button = owner.querySelector('.field-advanced');
    const b = button.getBoundingClientRect();
    const h = owner.querySelector('.field-head').getBoundingClientRect();
    const advanced = {
      is: button.localName, glyph: button.getAttribute('data-icon-start'), type: button.getAttribute('data-type'),
      name: button.getAttribute('aria-label'), pressed: button.getAttribute('aria-pressed'),
      inHead: b.top >= h.top && b.bottom <= h.bottom, atEnd: Math.abs(b.right - h.right) <= 1,
    };
    return { fields: read(), advanced };
  })()`) as { advanced: Record<string, unknown>; fields: { field: string; acts: boolean; height: number; gap: number | null }[] };

  // Both kinds are here, so the height is tested across the change.
  expect(r.fields.some((f) => f.acts)).toBe(true);
  expect(r.fields.some((f) => !f.acts)).toBe(true);
  expect(new Set(r.fields.map((f) => f.height)).size).toBe(1);
  for (const f of r.fields) if (f.gap !== null) expect(f.gap).toBe(8);
  expect(r.advanced).toEqual({ is: 'sherpa-button', glyph: 'function', type: 'icon',
    name: 'Advanced Owner', pressed: 'false', inHead: true, atEnd: true });
});

/**
 * RESET ALL clears BOTH scopes — picks, presets, Group and Sort — and applies
 * at once, as the toolbar's Reset does. Both header buttons wear the DEFAULT
 * look. Will, 2026-09-26.
 */
test('Reset all clears every scope, Group and Sort too, and applies', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    for (const n of ['quick-filter-change', 'group-change', 'sort-change']) {
      el.addEventListener(n, (e) => heard.push([n, e.detail]));
    }
    const before = q('.value[data-current]').map((c) => c.dataset.value);
    press('.reset-all');
    await new Promise((r) => setTimeout(r, 150));
    const applied = heard.find(([n]) => n === 'quick-filter-change');
    return {
      before, after: q('.value[data-current]').length,
      picked: applied ? Object.values(applied[1].readings).flatMap((f) =>
        Object.values(f).flatMap((x) => x.picked ?? [])) : null,
      organise: heard.filter(([n]) => n !== 'quick-filter-change'),
      looks: ['.reset-all'].map((s) => sr.querySelector(s).getAttribute('data-look')),
    };
  })()`) as { before: string[]; after: number; picked: string[] | null;
    organise: unknown[]; looks: (string | null)[] };

  expect(r.before.length).toBeGreaterThan(0);
  expect(r.after).toBe(0);
  expect(r.picked).toEqual([]);
  expect(r.organise).toEqual([
    ['group-change', { scope: 'data', field: null }],
    ['sort-change', { scope: 'data', field: null, direction: 'asc' }],
  ]);
  expect(r.looks).toEqual([null]);
});

/**
 * ONE SEARCH, ACROSS EVERY VALUE. It hides value chips, never the label of a
 * field that still shows one: a reader searching "gold" still needs to see
 * that Gold is a Tier.
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

/* Will, TODO 171: "Search in the filter panel should search field labels as
   well as value labels." A named field shows whole. */
test('the search matches a field by its NAME too, and then shows every value of it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const search = sr.querySelector('.search');
    const type = async (text) => {
      search.value = text;
      search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return {
        shown: q('.value:not([data-filtered-out])').map((c) => c.dataset.value),
        fields: q('.field:not([data-no-matches])').map((f) => f.dataset.field),
      };
    };
    const all = await type('');
    return { all, owner: await type('own'), sort: await type('SORT'), section: await type('preset'),
      mixed: await type('ri'), none: await type('zzz'), back: await type('') };
  })()`) as Record<string, { shown: string[]; fields: string[] }>;

  // A field's name: the field, with EVERY value of it.
  expect(r.owner).toEqual({ shown: ['Dana', 'Ravi'], fields: ['owner'] });
  // One of two chips in a shared section is named: the other goes.
  expect(r.sort).toEqual({ shown: ['sort'], fields: ['organise'] });
  // A section's own heading names everything in it.
  expect(r.section).toEqual({ shown: ['at-risk', 'unassigned'], fields: ['presets'] });
  // A value still matches on its own: "At RIsk".
  expect(r.mixed).toEqual({ shown: ['at-risk'], fields: ['presets'] });
  expect(r.none).toEqual({ shown: [], fields: [] });
  // Emptied, everything is back.
  expect(r.back).toEqual(r.all);
  expect(r.all.fields).toEqual(['organise', 'presets', 'status', 'owner']);
});

test('a field with a body of its own — a number — is found by its name, and comes back', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const panel = await window.__mount<HTMLElement>('sherpa-filter-panel', [{
      scope: 'data', label: 'Customer records',
      filters: [
        { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500 },
        { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }] },
      ],
    }], { open: true, style: 'inline-size: 400px' });
    await window.__settled();
    const sr = panel.shadowRoot!;
    const search = sr.querySelector<HTMLElement & { value: string }>('.search')!;
    const type = async (text: string): Promise<string[]> => {
      search.value = text;
      search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await window.__settled();
      return [...sr.querySelectorAll<HTMLElement>('.field')]
        .filter((f) => getComputedStyle(f).display !== 'none').map((f) => f.dataset['field'] ?? '');
    };
    return { named: await type('seat'), value: await type('pro'), back: await type('') };
  });

  expect(r.named).toEqual(['seats']);
  // It has no value chips, so a value's name does not find it.
  expect(r.value).toEqual(['plan']);
  // It was left hidden once a search had run, even with the box emptied.
  expect(r.back).toEqual(['seats', 'plan']);
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

    // WHAT THE MENU HOLDS: every removable field, the held ones ticked. ONE
    // menu, in the panel's header; each row's value says its scope (TODO 124).
    const menu = sr.querySelector('.filters-btn sherpa-menu');
    await new Promise((r) => setTimeout(r, 200));
    const rows = [...menu.querySelectorAll('.menu-row')]
      .filter((row) => !row.matches('.qf-all, .menu-all, .menu-section'))
      .map((row) => [row.querySelector('input').value, row.querySelector('input').checked, row.dataset.note ?? null]);

    /* SEATS ticked, STATUS unticked — one of each, in one commit. */
    menu.dispatchEvent(new CustomEvent('menu-change', {
      bubbles: true, composed: true, detail: { values: ['data:seats'] },
    }));
    await new Promise((r) => setTimeout(r, 120));

    return { heard, rows, after: q('.field').map((f) => f.dataset.field) };
  })()`) as { heard: [string, unknown][]; rows: [string, boolean, string | null][]; after: string[] };

  // The held field is TICKED; what is left to add is not. Each says its scope.
  expect(r.rows).toEqual([
    ['data:status', true, 'Customer records'], ['data:seats', false, 'Customer records'],
  ]);

  expect(r.heard).toEqual([
    ['filter-add-request', { scope: 'data', ids: ['seats'] }],
    ['filter-remove', { scope: 'data', id: 'status' }],
  ]);
  /* The field is STILL THERE. A component that removed it would be deciding
     what the host's list holds. */
  expect(r.after).toEqual(['organise', 'presets', 'status', 'owner']);
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

      return { order, shape, sortOn, heard };
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

    /* A FILTER event never carries it. An arrangement is not part of which
       rows are shown, so it has no business in one. */
    expect(heard.filter(([n]) => n === 'quick-filter-change')).toEqual([]);
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
    el.show();
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

    el.show();
    await new Promise((r) => setTimeout(r, 250));
    const whileOpen = home();
    // The panel drew its OWN, and it is not this one.
    const own = el.shadowRoot.querySelector('.field[data-field="seats"] sherpa-menu');
    const mine = !!own && own !== menu;

    el.close();
    await new Promise((r) => setTimeout(r, 200));
    const afterClose = home();

    el.show();
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
 * REMOTE: a CHANGED field shows its own Apply and Discard, and each reports
 * the field — the source commits or discards it. Locally they never show.
 * Will, 2026-09-27 (TODO 62). TRAP T-apply-and-discard-wait-for-a-change
 */
test('remote: a changed field shows its own Apply and Discard; locally, never', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    for (const n of ['filter-apply', 'filter-discard']) el.addEventListener(n, (e) => heard.push([n, e.detail]));
    const shown = (sel) => { const n = sr.querySelector(sel); return !!n && getComputedStyle(n).display !== 'none'; };
    const f = '.field[data-field="status"]';
    el.setAttribute('data-remote', '');
    await new Promise((r) => setTimeout(r, 50));
    const before = shown(f + ' .field-apply');
    // The SOURCE says which fields wait, by field.
    el.setAttribute('data-pending', 'status');
    await new Promise((r) => setTimeout(r, 50));
    const pending = { apply: shown(f + ' .field-apply'), discard: shown(f + ' .field-discard'),
      other: shown('.field[data-field="owner"] .field-apply') };
    press(f + ' .field-apply');
    press(f + ' .field-discard');
    el.removeAttribute('data-remote');
    await new Promise((r) => setTimeout(r, 50));
    return { before, pending, heard, local: shown(f + ' .field-apply') };
  })()`) as Record<string, unknown>;

  expect(r['before']).toBe(false);
  expect(r['pending']).toEqual({ apply: true, discard: true, other: false });
  expect(r['heard']).toEqual([
    ['filter-apply', { scope: 'data', id: 'status', field: 'status' }],
    ['filter-discard', { scope: 'data', id: 'status', field: 'status' }],
  ]);
  expect(r['local']).toBe(false);
});

/**
 * A FIELD ALREADY ANSWERED BY CONDITIONS OPENS ON THEM — Advanced mode, its rows.
 * Drawn as plain value chips, a refill hid Owner's rows and the next Apply
 * reported it unanswered. TRAP T-a-conditioned-field-opens-on-its-rows
 */
test('a field populated with conditions opens in Advanced mode on its rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-filter-panel') as HTMLElement & {
      rendered: Promise<void>; populate(d: unknown): void; show(): void;
      readings: Record<string, Record<string, { conditions?: unknown[] }>> };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([{ scope: 'data', label: 'Data', filters: [
      { id: 'owner', label: 'Owner', select: 'multiple', custom: true,
        options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }],
        state: { picked: [], conditions: [{ op: 'contains', text: 'Da' }] } },
    ] }]);
    el.show();
    await window.__settled();
    for (let i = 0; i < 4; i++) await new Promise((res) => requestAnimationFrame(res));
    const box = el.shadowRoot!.querySelector('.field[data-field="owner"]')!;
    return {
      custom: box.hasAttribute('data-advanced'),
      switchOn: box.querySelector('.field-advanced')?.getAttribute('aria-pressed') === 'true',
      reading: el.readings['data']?.['owner']?.conditions,
    };
  });
  expect(r).toEqual({ custom: true, switchOn: true, reading: [{ op: 'contains', text: 'Da' }] });
});

/**
 * CLEAR AND SEND TO ARE ONE CONTROL — a button group, joined by position, so
 * Clear alone (a View field has nowhere to send to) keeps both its corners.
 * Will, 2026-09-30 (TODO 121). SEND TO IS ALWAYS THERE, before the first edit
 * too (TODO 155); Clear comes once there is something to clear.
 */
test('Clear and Send to are one button group; Send to shows before any answer, and leads the group alone', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    el.populate([
      { scope: 'view', label: 'View filters', filters: [
        { id: 'region', label: 'Region', options: [{ value: 'EMEA', label: 'EMEA', selected: true }] },
        { id: 'customer', label: 'Customer', options: [{ value: 'Contoso', label: 'Contoso' }] } ] },
      { scope: 'data', label: 'Customer records', filters: [
        { id: 'status', label: 'Status', options: [{ value: 'active', label: 'active', selected: true }] },
        { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }] } ] },
    ]);
    await new Promise((r) => setTimeout(r, 300));
    const read = (field) => {
      const group = sr.querySelector('.field[data-field="' + field + '"] .field-group');
      return {
        grouped: group.classList.contains('sherpa-group'),
        shown: group.getClientRects().length > 0,
        // Only what a reader SEES: Clear is hidden until there is an answer.
        buttons: [...group.children].filter((b) => b.getClientRects().length > 0).map((b) => {
          const t = getComputedStyle(b.shadowRoot.querySelector('button'));
          const box = b.getBoundingClientRect();
          return { is: b.className, corners: [t.borderStartStartRadius, t.borderStartEndRadius], x: box.x, w: box.width };
        }),
      };
    };
    return { view: read('region'), data: read('status'), idle: read('plan'), nowhere: read('customer') };
  })()`) as Record<string, { grouped: boolean; shown: boolean; buttons: { is: string; corners: string[]; x: number; w: number }[] }>;

  expect(r['view']!.buttons.map((b) => [b.is, b.corners])).toEqual([['field-clear', ['4px', '4px']]]);
  const [clear, raise] = r['data']!.buttons;
  expect(r['data']!.grouped).toBe(true);
  expect([clear!.is, clear!.corners]).toEqual(['field-clear', ['4px', '0px']]);
  expect([raise!.is, raise!.corners]).toEqual(['field-raise', ['0px', '4px']]);
  // Joined: no gap between the two.
  expect(raise!.x).toBe(clear!.x + clear!.w);
  // NO ANSWER YET: Send to is there all the same, alone, with all its corners.
  expect(r['idle']!.buttons.map((b) => [b.is, b.corners])).toEqual([['field-raise', ['4px', '4px']]]);
  // Nothing to clear and nowhere to send: nothing drawn.
  expect(r['nowhere']!.buttons).toEqual([]);
});
