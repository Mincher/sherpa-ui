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
      // The three field actions are OPT-IN, per field.
      ownerActions: ['conditional', 'clear', 'remove'].filter((a) =>
        getComputedStyle(sr.querySelector('.field[data-field="owner"] .field-' + a)).display !== 'none'),
      statusActions: ['conditional', 'clear', 'remove'].filter((a) =>
        getComputedStyle(sr.querySelector('.field[data-field="status"] .field-' + a)).display !== 'none'),
      presetActions: ['clear', 'remove'].filter((a) =>
        getComputedStyle(sr.querySelector('.field[data-field="presets"] .field-' + a)).display !== 'none'),
      canAdd: q('.scope[data-can-add]').map((s) => s.getAttribute('data-scope')),
      emptyScopes: q('.scope-empty').length,
    };
  })()`) as Record<string, unknown>;

  // A scope is NAMED for its content. TRAP T-a-scope-is-named-for-its-content
  expect(r['scopes']).toEqual(['View filters', 'Customer records']);

  /* PRESETS lead in ONE section; `created` is absent because a date is not a
     set of chips. TRAP T-a-chip-with-no-field-is-a-preset */
  expect(r['fields']).toEqual(['group', 'sort', 'presets', 'status', 'owner']);
  expect(r['presets']).toEqual(['at-risk', 'unassigned']);
  expect(r['presetOn']).toEqual(['unassigned']);

  // Owner asked for conditions, not Remove. Status asked for Remove.
  expect(r['ownerActions']).toEqual(['conditional', 'clear']);
  expect(r['statusActions']).toEqual(['clear', 'remove']);
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

    // Tick two more, across two fields.
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

test('a single-select field unticks its siblings; multi does not', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const click = (field, value) => sr
      .querySelector('.field[data-field="' + field + '"] .value[data-value="' + value + '"]')
      .dispatchEvent(new CustomEvent('quick-filter-click', { bubbles: true, composed: true }));

    // OWNER is single. Tick both; only the last survives.
    sr.querySelector('.field[data-field="owner"] .value[data-value="Dana"]')
      .setAttribute('data-current', '');
    sr.querySelector('.field[data-field="owner"] .value[data-value="Ravi"]')
      .setAttribute('data-current', '');
    click('owner', 'Ravi');
    await new Promise((r) => setTimeout(r, 100));

    // STATUS is multiple. Both stay.
    sr.querySelector('.field[data-field="status"] .value[data-value="churned"]')
      .setAttribute('data-current', '');
    click('status', 'churned');
    await new Promise((r) => setTimeout(r, 100));

    return { owner: el.values.data.owner, status: el.values.data.status };
  })()`) as { owner: string[]; status: string[] };

  expect(r.owner).toEqual(['Ravi']);
  expect(r.status).toEqual(['active', 'churned']);
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
  expect(r.empty).toEqual(['group', 'sort', 'status', 'owner']);
  // Every field still names itself.
  expect(r.labels).toBe(5);
});

/**
 * REMOVE AND ADD ARE REQUESTS. The HOST owns the list of fields.
 * TRAP T-a-panel-adds-through-the-bar-that-owns-the-list
 */
test('Remove and Add report, and change nothing by themselves', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    for (const n of ['filter-remove', 'filter-add-request']) {
      el.addEventListener(n, (e) => heard.push([n, e.detail]));
    }

    press('.field[data-field="status"] .field-remove');
    await new Promise((r) => setTimeout(r, 120));
    const afterRemove = q('.field').map((f) => f.dataset.field);

    sr.querySelector('.scope[data-scope="data"] .scope-add sherpa-menu')
      .dispatchEvent(new CustomEvent('menu-change', {
        bubbles: true, composed: true, detail: { values: ['seats'] },
      }));
    await new Promise((r) => setTimeout(r, 120));

    return { heard, afterRemove };
  })()`) as { heard: [string, unknown][]; afterRemove: string[] };

  expect(r.heard).toEqual([
    ['filter-remove', { scope: 'data', id: 'status' }],
    ['filter-add-request', { scope: 'data', ids: ['seats'] }],
  ]);
  /* The field is STILL THERE. A component that removed it would be deciding
     what the host's list holds. */
  expect(r.afterRemove).toEqual(['group', 'sort', 'presets', 'status', 'owner']);
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
      const sortOn = q('.field[data-field="sort"] .value[data-current]')
        .map((c) => c.dataset.value);

      // Pick a Group column. It reports IMMEDIATELY — no Apply.
      const g = sr.querySelector('.field[data-field="group"] .value[data-value="tier"]');
      g.setAttribute('data-current', '');
      g.dispatchEvent(new CustomEvent('quick-filter-click', { bubbles: true, composed: true }));
      await new Promise((r) => setTimeout(r, 120));

      // Both are SINGLE: picking Spend unticks Name.
      const s2 = sr.querySelector('.field[data-field="sort"] .value[data-value="spend"]');
      s2.setAttribute('data-current', '');
      s2.dispatchEvent(new CustomEvent('quick-filter-click', { bubbles: true, composed: true }));
      await new Promise((r) => setTimeout(r, 120));

      press('.apply');
      await new Promise((r) => setTimeout(r, 150));

      return {
        order, sortOn, heard,
        sortNow: q('.field[data-field="sort"] .value[data-current]').map((c) => c.dataset.value),
        applied: heard.find(([n]) => n === 'quick-filter-change')[1].values.data,
      };
    })()`) as Record<string, unknown>;

    // FIRST, above the presets — a reader reaches for them before narrowing.
    expect(r['order']).toEqual(['group', 'sort', 'presets', 'status', 'owner']);
    // The scope said which column each was on.
    expect(r['sortOn']).toEqual(['name']);
    // SINGLE: one column at a time.
    expect(r['sortNow']).toEqual(['spend']);

    const heard = r['heard'] as [string, Record<string, unknown>][];
    expect(heard.slice(0, 2)).toEqual([
      ['group-change', { scope: 'data', field: 'tier' }],
      ['sort-change', { scope: 'data', field: 'spend' }],
    ]);

    /* APPLY carries the FILTERS only. An arrangement is not part of which
       rows are shown, so it has no business in a filter event. */
    expect(Object.keys(r['applied'] as object).sort())
      .toEqual(['owner', 'presets', 'status']);
  });
