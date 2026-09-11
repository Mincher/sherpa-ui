import { test, expect } from '@playwright/test';

/** sherpa-quick-filter-toolbar — chips from populate(); toggling emits the active set (composedPath). */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders a quick-filter chip per filter, honouring initial active', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
      active?: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { id: 'status', label: 'Status' },
      { id: 'region', label: 'Region', active: true },
      { id: 'ai', label: 'Suggested', type: 'ai' },
    ]);
    await new Promise((res) => setTimeout(res, 20));
    const chips = Array.from(el.shadowRoot!.querySelectorAll('.chip'));
    return {
      count: chips.length,
      labels: chips.map((c) => c.getAttribute('data-label')),
      initialActive: el.active,
    };
  });
  expect(r.count).toBe(3);
  expect(r.labels).toEqual(['Status', 'Region', 'Suggested']);
  expect(r.initialActive).toEqual(['region']);
});

test('toggling a chip emits quick-filter-change with all active ids', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);
    await new Promise((res) => setTimeout(res, 20));

    const events: string[][] = [];
    el.addEventListener('quick-filter-change', (e) => events.push((e as CustomEvent).detail.active));

    // Click each chip's toggle target (.body — .chip is the shell that also holds
    // the menu caret).
    const chips = Array.from(el.shadowRoot!.querySelectorAll('.chip')) as HTMLElement[];
    (chips[0]!.shadowRoot!.querySelector('.body') as HTMLElement).click(); // A on
    await new Promise((res) => setTimeout(res, 10));
    (chips[1]!.shadowRoot!.querySelector('.body') as HTMLElement).click(); // B on
    await new Promise((res) => setTimeout(res, 10));

    return events;
  });
  // toolbar reports the full active set after each toggle
  expect(r).toEqual([['a'], ['a', 'b']]);
});

test('the leading Group / Sort chips organise the grid, separate from filtering', async ({ page }) => {
  // Figma Filter Toolbar Type=data (150:3688) opens its content slot with TWO menu
  // chips, then a 1x16 Divider, then the filter chips. These are those two.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      organise(d: unknown): void;
      sortField: string | null;
      sortDirection: string;
      sortSuspended: boolean;
      groupField: string | null;
      active: string[];
      values: Record<string, string[]>;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { id: 'live', label: 'Live' },
      // A value-MENU chip: its id names a COLUMN, its menu holds the values.
      { id: 'plan', label: 'Plan', select: 'multiple',
        options: [{ value: 'pro', label: 'Pro' }, { value: 'free', label: 'Free' }] },
    ]);
    el.organise({
      group: [{ field: 'team', label: 'Team' }],
      sort: [{ field: 'name', label: 'Name' }],
    });
    await new Promise((res) => setTimeout(res, 30));

    const sr = el.shadowRoot!;
    const zone = sr.querySelector('.organise-zone')!;
    const sortChip = sr.querySelector<HTMLElement>('.organise-chip[data-id="sort"]')!;
    const groupChip = sr.querySelector<HTMLElement>('.organise-chip[data-id="group"]')!;
    const planChip = sr.querySelector<HTMLElement>('.chip[data-id="plan"]')!;

    const layout = {
      flag: el.hasAttribute('data-has-organise'),
      // Group first, Sort second, and BEFORE the filter run.
      ids: Array.from(zone.children).map((c) => (c as HTMLElement).dataset['id']),
      beforeFilters:
        zone.getBoundingClientRect().right <= sr.querySelector('.chips')!.getBoundingClientRect().left,
      // The 1x16 divider rectangle after the zone.
      divider: getComputedStyle(zone, '::after').inlineSize,
      // Sort lists each column ONCE — not twice for the two directions.
      sortRows: sortChip.querySelectorAll('input').length,
      sortRadios: sortChip.querySelector('input')!.getAttribute('type'),
    };

    // Pick the sort column from the MENU, then commit.
    const pick = async (chip: HTMLElement, value: string) => {
      const menu = chip.querySelector('sherpa-menu')!;
      const input = Array.from(menu.querySelectorAll<HTMLInputElement>('input')).find(
        (i) => i.value === value,
      )!;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      (menu.shadowRoot!.querySelector('.apply') as HTMLElement).click();
      await new Promise((res) => setTimeout(res, 40));
    };

    const events: Array<Record<string, unknown>> = [];
    el.addEventListener('sort-change', (e) => events.push({ type: 'sort', ...(e as CustomEvent).detail }));
    el.addEventListener('group-change', (e) => events.push({ type: 'group', ...(e as CustomEvent).detail }));
    el.addEventListener('quick-filter-change', (e) =>
      events.push({ type: 'filter', ...(e as CustomEvent).detail }));

    await pick(sortChip, 'name');
    await pick(groupChip, 'team');

    // The TRI-STATE cycle runs off the chip BODY: asc → desc → suspended → asc.
    // SIX clicks, not three — TWO full cycles. Three only proved the first lap,
    // and the bug that shipped was that the SECOND lap never returned to
    // ascending: it ping-ponged between descending and off forever.
    const cycle: Array<Record<string, unknown>> = [
      { step: 'picked', field: el.sortField, dir: el.sortDirection, suspended: el.sortSuspended },
    ];
    for (const step of ['1', '2', '3', '4', '5', '6']) {
      (sortChip.shadowRoot!.querySelector('.body') as HTMLElement).click();
      await new Promise((res) => setTimeout(res, 40));
      cycle.push({ step, field: el.sortField, dir: el.sortDirection, suspended: el.sortSuspended });
    }

    // A menu chip's picks must NOT land in `active` — its id names a column, so a
    // host matching row values against that list found nothing.
    await pick(planChip, 'pro');
    const filtering = { active: el.active, values: el.values, group: el.groupField };

    return { layout, cycle, filtering, events: events.map((e) => e['type']) };
  });

  expect(r.layout.flag).toBe(true);
  expect(r.layout.ids).toEqual(['group', 'sort']);
  expect(r.layout.beforeFilters).toBe(true);
  expect(r.layout.divider).toBe('1px');
  expect(r.layout.sortRows).toBe(1);
  expect(r.layout.sortRadios).toBe('radio'); // one column at a time

  // Ascending → descending → SUSPENDED → ascending, twice round.
  expect(r.cycle[0]).toEqual({ step: 'picked', field: 'name', dir: 'asc', suspended: false });
  expect(r.cycle[1]).toEqual({ step: '1', field: 'name', dir: 'desc', suspended: false });
  // Suspended: sortField reads null so a host applies no sort, but the chip still
  // remembers the COLUMN — this is a temporary disable, not a reset. The
  // DIRECTION does rewind to ascending, so the next lap starts over rather than
  // sticking on descending.
  expect(r.cycle[2]).toEqual({ step: '2', field: null, dir: 'asc', suspended: true });
  expect(r.cycle[3]).toEqual({ step: '3', field: 'name', dir: 'asc', suspended: false });
  // …and the SECOND lap behaves identically. This is the assertion the shipped
  // bug would have failed: it left the chip alternating desc / off.
  expect(r.cycle[4]).toEqual({ step: '4', field: 'name', dir: 'desc', suspended: false });
  expect(r.cycle[5]).toEqual({ step: '5', field: null, dir: 'asc', suspended: true });
  expect(r.cycle[6]).toEqual({ step: '6', field: 'name', dir: 'asc', suspended: false });

  // Grouping and filtering stay in their own lanes.
  expect(r.filtering.group).toBe('team');
  expect(r.filtering.active).toEqual([]); // 'plan' is a MENU chip, not a toggle
  expect(r.filtering.values).toEqual({ plan: ['pro'] });

  // A group/sort pick never reports itself as a filter change.
  expect(r.events).toEqual([
    'sort', 'group',
    'sort', 'sort', 'sort', 'sort', 'sort', 'sort',
    'filter',
  ]);
});

test('a value-menu chip toggles OFF without clearing its picks', async ({ page }) => {
  // ON = filter this field by the picked values. OFF = ignore this field, but KEEP
  // the picks — the same "temporary disable" the Sort chip has. `values` reports
  // what is APPLIED; `pickedValues` reports what is REMEMBERED.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      values: Record<string, string[]>;
      pickedValues: Record<string, string[]>;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { id: 'plan', label: 'Plan', select: 'multiple',
        options: [{ value: 'pro', label: 'Pro' }, { value: 'free', label: 'Free' }] },
    ]);
    await new Promise((res) => setTimeout(res, 30));

    const chip = el.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="plan"]')!;
    const menu = chip.querySelector('sherpa-menu')!;
    const boxes = Array.from(menu.querySelectorAll<HTMLInputElement>('input'));

    // Tick two values and Apply.
    for (const b of [boxes[0]!, boxes[1]!]) {
      b.checked = true;
      b.dispatchEvent(new Event('change', { bubbles: true }));
    }
    (menu.shadowRoot!.querySelector('.apply') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 40));

    const snap = () => ({
      on: chip.hasAttribute('data-current'),
      values: el.values,
      picked: el.pickedValues,
      ticked: Array.from(chip.querySelectorAll<HTMLInputElement>('input:checked')).map((i) => i.value),
    });
    const applied = snap();

    // Toggle OFF from the chip body.
    (chip.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 40));
    const off = snap();

    // …and back ON.
    (chip.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 40));
    const back = snap();

    return { applied, off, back };
  });

  expect(r.applied.on).toBe(true);
  expect(r.applied.values).toEqual({ plan: ['pro', 'free'] });

  // OFF: nothing is applied, but the picks survive — in `pickedValues` AND as
  // still-ticked rows in the menu, so re-enabling needs no re-picking.
  expect(r.off.on).toBe(false);
  expect(r.off.values).toEqual({});
  expect(r.off.picked).toEqual({ plan: ['pro', 'free'] });
  expect(r.off.ticked).toEqual(['pro', 'free']);

  // Back ON restores exactly the same constraint.
  expect(r.back.on).toBe(true);
  expect(r.back.values).toEqual({ plan: ['pro', 'free'] });
});

/**
 * Mount a toolbar and wait for its CLUSTER to be measurable.
 *
 * The toolbar's own `rendered` resolves when ITS shadow root exists — but the
 * cluster is made of nested sherpa-buttons with shadow roots of their own, and
 * those are still zero-width at that point. Awaiting every child's `rendered`
 * is what makes a width or a corner radius mean anything. Passed into
 * page.evaluate as source, because it has to run in the browser.
 */
const MOUNT = `
  async function mountToolbar(type) {
    const el = document.createElement('sherpa-quick-filter-toolbar');
    if (type) el.setAttribute('data-type', type);
    document.getElementById('root').appendChild(el);
    await el.rendered;
    const kids = [...el.shadowRoot.querySelectorAll('sherpa-button, sherpa-quick-filter')];
    await Promise.all(kids.map((k) => k.rendered));
    return el;
  }
`;

/* ── The built-in action cluster ─────────────────────────────────────────────
 * Figma "Filter Toolbar" (150:3688) bakes the trailing cluster in and varies it
 * on a `Type` axis. This used to be an empty `actions` slot; these tests hold
 * the reversal in place. */

test('the action cluster is built in, and data-type=view adds the save group', async ({ page }) => {
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const probe = async (type?: string) => {
      const el = await mountToolbar(type);
      const sr = el.shadowRoot!;
      const shown = (sel: string) => {
        const n = sr.querySelector(sel) as HTMLElement | null;
        return !!n && n.getBoundingClientRect().width > 0;
      };
      return {
        add: shown('.add-chip'),
        ai: shown('[data-act="ai"]'),
        clear: shown('[data-act="clear"]'),
        configure: shown('[data-act="configure"]'),
        refresh: shown('[data-act="refresh"]'),
        overflow: shown('[data-act="overflow"]'),
        favourite: shown('[data-act="favourite"]'),
        save: shown('[data-act="save"]'),
        viewMenu: shown('[data-act="view-menu"]'),
      };
    };
    return { data: await probe(), view: await probe('view') };
  }, MOUNT);

  // Both types carry the shared run: Add · AI · undo · configure · | · refresh · ⋮
  for (const t of [r.data, r.view]) {
    expect(t.add).toBe(true);
    expect(t.ai).toBe(true);
    expect(t.clear).toBe(true);
    expect(t.configure).toBe(true);
    expect(t.refresh).toBe(true);
    expect(t.overflow).toBe(true);
  }
  // Only `view` gets the ★ | Save | ▾ group — Figma's Type=data cluster ends at
  // the divider.
  expect(r.data.favourite).toBe(false);
  expect(r.data.save).toBe(false);
  expect(r.data.viewMenu).toBe(false);
  expect(r.view.favourite).toBe(true);
  expect(r.view.save).toBe(true);
  expect(r.view.viewMenu).toBe(true);
});

test('every cluster button fires the event Figma names for it', async ({ page }) => {
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = await mountToolbar('view');

    const seen: string[] = [];
    for (const ev of [
      'ai-filter-request', 'filter-configure', 'data-refresh', 'filter-overflow',
      'view-save', 'view-menu-open', 'filter-add',
    ]) el.addEventListener(ev, () => seen.push(ev));

    const press = async (act: string) => {
      const btn = el.shadowRoot!.querySelector(`[data-act="${act}"]`) as HTMLElement;
      (btn.shadowRoot!.querySelector('button') as HTMLElement).click();
      await new Promise((res) => setTimeout(res, 30));
    };
    for (const a of ['ai', 'configure', 'refresh', 'overflow', 'save', 'view-menu']) await press(a);

    // The Add control is a CHIP (Figma State=menu), so it reports through its own
    // click path, not button-click.
    const add = el.shadowRoot!.querySelector('.add-chip') as HTMLElement;
    (add.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 30));

    return { seen, addStuckOn: add.hasAttribute('data-current') };
  }, MOUNT);

  expect(r.seen).toEqual([
    'ai-filter-request', 'filter-configure', 'data-refresh', 'filter-overflow',
    'view-save', 'view-menu-open', 'filter-add',
  ]);
  // Add is a TRIGGER, not a state: a chip flips itself on click, and leaving that
  // flip would show "Add" in the bar as though it were an active filter.
  expect(r.addStuckOn).toBe(false);
});

test('the star toggles, swaps its glyph, and reports both ways', async ({ page }) => {
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = await mountToolbar('view');

    const detail: boolean[] = [];
    el.addEventListener('view-favorite', (e) => detail.push((e as CustomEvent).detail.favourite));
    const star = el.shadowRoot!.querySelector('[data-act="favourite"]') as HTMLElement;
    const press = async () => {
      (star.shadowRoot!.querySelector('button') as HTMLElement).click();
      await new Promise((res) => setTimeout(res, 30));
      return {
        on: el.hasAttribute('data-favourite'),
        icon: star.getAttribute('data-icon-start'),
        pressed: star.getAttribute('aria-pressed'),
      };
    };
    return { first: await press(), second: await press(), detail };
  }, MOUNT);

  // The GLYPH carries the state too (outline → solid), so it survives for anyone
  // who cannot tell the brand purple from the default ink.
  expect(r.first).toEqual({ on: true, icon: 'fa-solid fa-star', pressed: 'true' });
  expect(r.second).toEqual({ on: false, icon: 'fa-regular fa-star', pressed: 'false' });
  expect(r.detail).toEqual([true, false]);
});

test('the undo button clears every chip and the organise state', async ({ page }) => {
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = (await mountToolbar()) as HTMLElement & {
      populate?: (d: unknown) => void;
      organise?: (d: unknown) => void;
      active?: string[];
      values?: Record<string, string[]>;
      groupField?: string | null;
    };
    el.populate!([
      { id: 'active', label: 'Active', active: true },
      { id: 'trial', label: 'Trial', active: true },
      { id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro', selected: true }] },
    ]);
    el.organise!({ group: [{ field: 'region', label: 'Region' }] });
    // populate() stamps the chips, which are themselves custom elements — give
    // them a turn to upgrade before reaching for one.
    await new Promise((res) => setTimeout(res, 60));

    // Turn the menu chip on so there is a live value constraint to clear.
    const plan = el.shadowRoot!.querySelector('.chip[data-id="plan"]') as HTMLElement;
    plan.toggleAttribute('data-current', true);
    const before = { active: el.active, values: el.values };

    const seen: string[] = [];
    for (const ev of ['filter-clear', 'quick-filter-change', 'group-change', 'sort-change'])
      el.addEventListener(ev, () => seen.push(ev));

    const undo = el.shadowRoot!.querySelector('[data-act="clear"]') as HTMLElement;
    (undo.shadowRoot!.querySelector('button') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 40));

    return {
      before,
      after: { active: el.active, values: el.values, group: el.groupField },
      seen,
    };
  }, MOUNT);

  expect(r.before.active).toEqual(['active', 'trial']);
  expect(r.before.values).toEqual({ plan: ['pro'] });

  // "Reset filters" means back to NO filters — including the organise chips,
  // since a grouping is as much a view state as a filter is.
  expect(r.after.active).toEqual([]);
  expect(r.after.values).toEqual({});
  expect(r.after.group).toBe(null);

  // One event per concern, not one per chip.
  expect(r.seen).toEqual(['filter-clear', 'quick-filter-change', 'group-change', 'sort-change']);
});

test('the view group is snapped: outer corners round, inner ones square', async ({ page }) => {
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = await mountToolbar('view');
    const kids = [...el.shadowRoot!.querySelector('.view-group')!.children] as HTMLElement[];
    return kids.map((k) => {
      const cs = getComputedStyle(k);
      const b = k.getBoundingClientRect();
      return {
        act: k.dataset['act'],
        tl: parseFloat(cs.borderStartStartRadius),
        tr: parseFloat(cs.borderStartEndRadius),
        left: b.left,
        right: b.right,
      };
    });
  }, MOUNT);

  // Figma's "Frame 1" joins the three at gap -0.5 so their borders overlap and
  // they read as ONE control. The rounding is set in the toolbar's own CSS, not
  // by [data-snap]: that selector lives in tokens.css, which is loaded into the
  // DOCUMENT and is deliberately not in sharedStyles, so it never reaches a
  // button inside this shadow root.
  expect(r.map((k) => k.act)).toEqual(['favourite', 'save', 'view-menu']);
  expect(r[0]!.tl).toBeGreaterThan(0); // leading edge stays round
  expect(r[0]!.tr).toBe(0);
  expect(r[1]!.tl).toBe(0); // the middle is square all round
  expect(r[1]!.tr).toBe(0);
  expect(r[2]!.tl).toBe(0);
  expect(r[2]!.tr).toBeGreaterThan(0); // trailing edge stays round

  // …and they actually touch, rather than merely looking square.
  expect(r[1]!.left).toBeLessThan(r[0]!.right);
  expect(r[2]!.left).toBeLessThan(r[1]!.right);
});

test('a persistent chip is a SELECTOR: it cannot be switched off', async ({ page }) => {
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = (await mountToolbar('view')) as HTMLElement & { populate?: (d: unknown) => void };
    el.populate!([
      {
        id: 'view',
        label: 'All customers',
        persistent: true,
        select: 'single',
        options: [{ value: 'all', label: 'All customers', selected: true }],
      },
      { id: 'trial', label: 'Trial', active: true },
    ]);
    await new Promise((res) => setTimeout(res, 60));

    const view = el.shadowRoot!.querySelector('.chip[data-id="view"]') as HTMLElement;
    const trial = el.shadowRoot!.querySelector('.chip[data-id="trial"]') as HTMLElement;
    const on = (c: HTMLElement) => c.hasAttribute('data-current');

    const start = { view: on(view), trial: on(trial) };

    // Click the persistent chip's body — an ordinary chip would go off.
    (view.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 40));
    const afterClick = { view: on(view), trial: on(trial) };

    // …and the ordinary one still toggles, so this is not just "nothing works".
    (trial.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 40));
    const afterTrial = { view: on(view), trial: on(trial) };

    // A full reset must not leave the page with no view.
    const undo = el.shadowRoot!.querySelector('[data-act="clear"]') as HTMLElement;
    (undo.shadowRoot!.querySelector('button') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 60));

    return { start, afterClick, afterTrial, afterReset: { view: on(view), trial: on(trial) } };
  }, MOUNT);

  expect(r.start).toEqual({ view: true, trial: true });

  // The view chip stays ON. You are always looking at SOME view — "no view" is
  // not a state the page can be in, and the menu is what changes which one.
  expect(r.afterClick.view).toBe(true);

  // An ordinary chip still toggles, so the persistent one is special, not broken.
  expect(r.afterTrial.trial).toBe(false);
  expect(r.afterTrial.view).toBe(true);

  // Reset clears the filters and leaves the view in place.
  expect(r.afterReset).toEqual({ view: true, trial: false });
});
