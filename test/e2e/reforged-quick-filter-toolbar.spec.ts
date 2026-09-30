import { test, expect, type Bar } from './harness';

/** sherpa-quick-filter-toolbar — chips from populate(); toggling emits the active set (composedPath). */


test('renders a quick-filter chip per filter, honouring initial active', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate!([
      { id: 'status', label: 'Status' },
      { id: 'region', label: 'Region', active: true },
      { id: 'ai', label: 'Suggested', type: 'ai' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
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
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate!([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);
    // WAIT FOR THE CHIPS, not for 20ms. Each stamped chip renders its own shadow
    // root, and this test reads `chips[0].shadowRoot.querySelector(...)` — on a
    // loaded machine the chip had not rendered, shadowRoot was null, and the
    // test threw rather than failed. __settled() awaits every pending
    // sherpa-* render, including inside shadow roots.
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const events: string[][] = [];
    el.addEventListener('quick-filter-change', (e) => events.push((e as CustomEvent).detail.active));

    // Click each chip's toggle target (.body — .chip is the shell that also holds
    // the menu caret).
    const chips = Array.from(el.shadowRoot!.querySelectorAll('.chip')) as HTMLElement[];
    (chips[0]!.shadowRoot!.querySelector('.body') as HTMLElement).click(); // A on
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    (chips[1]!.shadowRoot!.querySelector('.body') as HTMLElement).click(); // B on
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return events;
  });
  // toolbar reports the full active set after each toggle
  expect(r).toEqual([['a'], ['a', 'b']]);
});

test('the leading Group / Sort chips organise the grid, separate from filtering', async ({ page }) => {
  // Figma Filter Toolbar Type=data (150:3688) opens its content slot with TWO menu
  // chips, then a 1x16 Divider, then the filter chips. These are those two.
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

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

    // Pick a value from the MENU. These menus AUTO-APPLY — a chip only defers
    // behind an Apply footer when its definition asks for `commit: true` — so
    // the tick IS the commit and clicking Apply as well would fire twice.
    const pick = async (chip: HTMLElement, value: string) => {
      const menu = chip.querySelector('sherpa-menu')!;
      const input = Array.from(menu.querySelectorAll<HTMLInputElement>('input')).find(
        (i) => i.value === value,
      )!;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (menu.hasAttribute('data-commit')) {
        (menu.shadowRoot!.querySelector('.apply') as HTMLElement).click();
      }
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
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
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
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
  // what is APPLIED; `readings` keeps what is REMEMBERED, as `picked`.
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate([
      { id: 'plan', label: 'Plan', select: 'multiple',
        options: [{ value: 'pro', label: 'Pro' }, { value: 'free', label: 'Free' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const chip = el.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="plan"]')!;
    const menu = chip.querySelector('sherpa-menu')!;
    // `label:not(.qf-all)` skips the select-all row a multi menu now leads with —
    // it is a control OVER the set, not a member of it, and indexing past it
    // would tick "all" instead of the first value.
    const boxes = Array.from(
      menu.querySelectorAll<HTMLInputElement>('label:not(.qf-all) input'),
    );

    // Tick two values and Apply.
    for (const b of [boxes[0]!, boxes[1]!]) {
      b.checked = true;
      b.dispatchEvent(new Event('change', { bubbles: true }));
    }
    (menu.shadowRoot!.querySelector('.apply') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const snap = () => ({
      on: chip.hasAttribute('data-current'),
      values: el.values,
      picked: Object.fromEntries(Object.entries(el.readings).map(([f, r]) => [f, r.picked ?? []])),
      // `label:not(.qf-all)` again: with both values ticked the select-all row is
      // ticked too, and its box reports its own default "on" rather than a value.
      ticked: Array.from(
        chip.querySelectorAll<HTMLInputElement>('label:not(.qf-all) input:checked'),
      ).map((i) => i.value),
    });
    const applied = snap();

    // Toggle OFF from the chip body.
    (chip.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const off = snap();

    // …and back ON.
    (chip.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const back = snap();

    return { applied, off, back };
  });

  expect(r.applied.on).toBe(true);
  expect(r.applied.values).toEqual({ plan: ['pro', 'free'] });

  // OFF: nothing is applied, but the picks survive — in `readings` AND as
  // still-ticked rows in the menu, so re-enabling needs no re-picking.
  expect(r.off.on).toBe(false);
  expect(r.off.values).toEqual({});
  expect(r.off.picked).toEqual({ plan: ['pro', 'free'] });
  expect(r.off.ticked).toEqual(['pro', 'free']);

  // Back ON restores exactly the same constraint.
  expect(r.back.on).toBe(true);
  expect(r.back.values).toEqual({ plan: ['pro', 'free'] });
});

/* ── The built-in action cluster ─────────────────────────────────────────────
 * Figma "Filter Toolbar" (150:3688) bakes the trailing cluster in and varies it
 * on a `Type` axis. This used to be an empty `actions` slot; these tests hold
 * the reversal in place. */

test('the action cluster is built in, and data-type=view adds the save group', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const probe = async (type?: string) => {
      const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': type });
      const sr = el.shadowRoot!;
      const shown = (sel: string) => {
        const n = sr.querySelector(sel) as HTMLElement | null;
        return !!n && n.getBoundingClientRect().width > 0;
      };
      return {
        add: shown('.add-btn'),
        ai: shown('[data-act="ai"]'),
        clear: shown('[data-act="clear"]'),
        // The panel switch is the PAGE's, never the bar's own. TRAP T-the-mode-switch-is-the-pages-own
        configure: !!sr.querySelector('[data-act="configure"]'),
        refresh: shown('[data-act="refresh"]'),
        overflow: shown('[data-act="overflow"]'),
        favourite: shown('[data-act="favourite"]'),
        save: shown('[data-act="save"]'),
        viewMenu: shown('[data-act="view-menu"]'),
      };
    };
    return { data: await probe(), view: await probe('view') };
  });

  // Both types carry the shared run: Add · AI · undo · | · refresh.
  for (const t of [r.data, r.view]) {
    expect(t.add).toBe(true);
    expect(t.ai).toBe(true);
    expect(t.clear).toBe(true);
    expect(t.configure).toBe(false);
    expect(t.refresh).toBe(true);
    // The ⋮ is NOT among them. It is where the cluster folds when the bar runs
    // out of room, and an empty one on a bar wide enough to show everything is a
    // button that opens nothing — so it appears only once something has folded.
    expect(t.overflow).toBe(false);
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
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });

    const seen: string[] = [];
    for (const ev of [
      'ai-filter-request', 'data-refresh',
      'view-save', 'view-save-as', 'filter-add',
    ]) el.addEventListener(ev, () => seen.push(ev));

    const press = async (act: string) => {
      const btn = el.shadowRoot!.querySelector(`[data-act="${act}"]`) as HTMLElement;
      (btn.shadowRoot!.querySelector('button') as HTMLElement).click();
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    };
    // The ⋮ opens its own menu now. TRAP T-the-more-menu-holds-what-folded
    for (const a of ['ai', 'refresh', 'save']) await press(a);
    // The Save group's ▾ opens its menu; Save view as asks for a name. TODO 15.
    await press('view-menu');
    el.shadowRoot!.querySelector<HTMLElement>('.view-menu button[value="save-as"]')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    // ADD is deliberately absent from this list. It is a single button now, and
    // clicking it OPENS THE MENU rather than announcing anything — `filter-add`
    // fires when the menu commits, which its own test covers.
    const add = el.shadowRoot!.querySelector('.add-btn') as HTMLElement;
    const expanded = () => add.shadowRoot!.querySelector('button')!.getAttribute('aria-expanded');
    return { seen, addIsButton: add.localName, addExpanded: expanded() };
  });

  expect(r.seen).toEqual([
    'ai-filter-request', 'data-refresh',
    'view-save', 'view-save-as',
  ]);
  // A plain button, announcing itself as a menu trigger.
  expect(r.addIsButton).toBe('sherpa-button');
  // Nothing has opened it, so the trigger has not yet said either way.
  expect(r.addExpanded).toBe(null);
});

/**
 * THE ⋮ MENU HOLDS WHAT FOLDED — TODO 43. With every action folded, it lists
 * them in Will's order: the filter actions, the page's own buttons, a
 * divider, then the view's. A row does what its button does.
 * TRAP T-the-more-menu-holds-what-folded
 */
test('the ⋮ menu lists every folded action in order, and a row does what its button does', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // Eight chips at 620px: every action folds (the fold test's own setup).
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined,
      { 'data-type': 'view', style: 'inline-size: 620px' });
    const extra = document.createElement('sherpa-button');
    extra.slot = 'actions';
    extra.setAttribute('aria-label', 'View as filter panel');
    el.append(extra);
    el.populate(['Server', 'Region', 'Customer', 'Date', 'Preset', 'Owner', 'Tier', 'Plan'].map((label) => ({
      id: label.toLowerCase(), label, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    })));
    const settle = (window as unknown as { __settled: () => Promise<void> }).__settled;
    await settle();
    for (let i = 0; i < 20 && el.getAttribute('data-collapse') !== '3'; i++) await new Promise((res) => setTimeout(res, 50));
    const sr = el.shadowRoot!;
    const more = sr.querySelector('[data-act="overflow"]') as HTMLElement & { shadowRoot: ShadowRoot };
    const open = async (): Promise<void> => {
      more.shadowRoot.querySelector<HTMLElement>('button')!.click();
      await settle();
    };
    await open();
    const menu = sr.querySelector('.more-menu') as HTMLElement;
    const rows = [...menu.children].map((n) => (n.tagName === 'HR' ? '---' : (n.textContent ?? '').trim()));
    const heard: string[] = [];
    for (const ev of ['data-refresh', 'view-save']) el.addEventListener(ev, () => heard.push(ev));
    extra.addEventListener('button-click', () => heard.push('extra'));
    const pick = async (label: string): Promise<void> => {
      await open();
      [...menu.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === label)!.click();
      await settle();
    };
    await pick('Refresh view');
    await pick('Save view');
    await pick('View as filter panel');
    return { collapse: el.getAttribute('data-collapse'), rows, heard };
  });

  expect(r.collapse).toBe('3');
  expect(r.rows).toEqual([
    'Suggest filters', 'Reset filters', 'Reset all to default', 'View as filter panel', '---',
    'Favorite', 'Save view', 'Save view as', 'Refresh view',
  ]);
  expect(r.heard).toEqual(['data-refresh', 'view-save', 'extra']);
});

test('a trigger button goes active while its menu is open, and back on a second click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });
    const settled = (window as unknown as { __settled: () => Promise<void> }).__settled;
    // The Add menu is only stamped when something is LEFT to add.
    el.available!([{ id: 'seats', label: 'Seats', options: [{ value: '10', label: '10' }] }]);
    await settled();
    /* AT REST first. The bar measures itself again a frame or two after it
       fills, and a reflow closes an open menu — so a click made before that
       lands was shut by it. TRAP T-open-menu-resize-closes */
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    await settled();

    const add = el.shadowRoot!.querySelector('.add-btn') as HTMLElement;
    const trigger = add.shadowRoot!.querySelector('button') as HTMLElement;
    const menu = add.querySelector('sherpa-menu') as HTMLElement & { open: boolean };
    const state = () => ({
      open: menu.open,
      active: add.hasAttribute('data-open'),
      expanded: trigger.getAttribute('aria-expanded'),
    });

    trigger.click();
    await settled();
    const opened = state();

    /* The SECOND click. A real pointer light-dismisses the popover before the
       click lands, which is the case `.click()` alone does not reproduce. */
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    trigger.click();
    await settled();
    const closed = state();

    return { opened, closed };
  });

  expect(r.opened).toEqual({ open: true, active: true, expanded: 'true' });
  expect(r.closed).toEqual({ open: false, active: false, expanded: 'false' });
});

/**
 * THE ACTION NAMES, Will's words, 2026-09-26 — each is the button's name and
 * its tip. Asked of the accessibility tree. TRAP T-a-host-label-must-reach-its-control
 */
test('the bar\'s icon actions are named for what they do', async ({ page }) => {
  await page.evaluate(async () => {
    await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });
    await window.__settled();
  });
  // "View as filter panel" is the PAGE's button now. TRAP T-the-mode-switch-is-the-pages-own
  for (const name of ['Suggest filters', 'Reset all filters',
    'Add to Favorites', 'Save view options']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(1);
  }
});

test('the star toggles, swaps its glyph, and reports both ways', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });

    const detail: boolean[] = [];
    el.addEventListener('view-favorite', (e) => detail.push((e as CustomEvent).detail.favourite));
    const star = el.shadowRoot!.querySelector('[data-act="favourite"]') as HTMLElement;
    const press = async () => {
      (star.shadowRoot!.querySelector('button') as HTMLElement).click();
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return {
        on: el.hasAttribute('data-favourite'),
        icon: star.getAttribute('data-icon-start'),
        pressed: star.getAttribute('aria-pressed'),
        // The name says what the NEXT press does. Will, 2026-09-26.
        name: star.getAttribute('aria-label'),
        // The DRAWING, not the name — TRAP T-favourite-star-swaps-its-glyph.
        d: star.shadowRoot?.querySelector('svg path')?.getAttribute('d') ?? null,
      };
    };
    return { first: await press(), second: await press(), detail };
  });

  // The GLYPH carries the state too (outline → solid), so it survives for anyone
  // who cannot tell the brand purple from the default ink.
  expect(r.first).toMatchObject({ on: true, icon: 'star-filled', pressed: 'true', name: 'Remove from Favorites' });
  expect(r.second).toMatchObject({ on: false, icon: 'star', pressed: 'false', name: 'Add to Favorites' });
  /* The PATH must differ. Asserting the name alone is what let the two states
     resolve to one outline drawing for three months: the two weights were one
     Font Awesome name, and the weight token was dropped on the way in. They are
     two SEPARATE Figma drawings now — `star` and `star-filled`. */
  expect(r.first.d).toBeTruthy();
  expect(r.second.d).toBeTruthy();
  expect(r.first.d).not.toBe(r.second.d);
  expect(r.detail).toEqual([true, false]);
});

test('a favourited star takes the ACTIVE Style mode, face ring and ink', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });
    const star = el.shadowRoot!.querySelector('[data-act="favourite"]') as HTMLElement & {
      shadowRoot: ShadowRoot;
    };
    // WAIT OUT THE FADE, do not guess at it. The button transitions its
    // background, border and colour over 120ms, so a fixed wait samples the
    // middle of the animation under parallel load and reads an in-between
    // colour — rgb(255, 254, 255) instead of white, which looks like the toggle
    // failing to reverse rather than a test reading too early.
    const settled = async () => {
      const trigger = star.shadowRoot.querySelector('.trigger') as HTMLElement;
      await Promise.all(
        trigger.getAnimations().map((a) => a.finished.catch(() => undefined)),
      );
    };
    const read = () => {
      const t = getComputedStyle(star.shadowRoot.querySelector('.trigger')!);
      return {
        status: star.dataset['status'] ?? null,
        bg: t.backgroundColor,
        border: t.borderTopColor,
        ink: getComputedStyle(star.shadowRoot.querySelector('i')!).color,
      };
    };
    await settled();
    const off = read();
    (star.shadowRoot.querySelector('button') as HTMLElement).click();
    await settled();
    const on = read();

    // READ WHILE IT IS ON. These properties only exist in the favourited state,
    // so reading them after the second click returns empty strings — which is
    // what the first version of this test did, and it looked like the fix had
    // not worked at all.
    //
    // The star's OWN --_status-* values are the exact chain its trigger paints
    // from, so the comparison is like-for-like. Not a hand-converted hex (the
    // browser rounds #F2DFFF to 224, not the arithmetic 223) and not a probe
    // elsewhere in the tree (a light-DOM one resolves through tokens.css's
    // [data-status] block, a different chain).
    const sc = getComputedStyle(star);
    const expected = {
      surface: sc.getPropertyValue('--_status-surface').trim(),
      border: sc.getPropertyValue('--_status-border').trim(),
      text: sc.getPropertyValue('--_status-text').trim(),
    };

    (star.shadowRoot.querySelector('button') as HTMLElement).click();
    await settled();

    return { off, on, backOff: read(), expected };
  });

  // Each resolved to a real colour, so the assertions below mean something — an
  // EMPTY value (the properties never reaching the button) is exactly the bug
  // this test exists for, and would otherwise pass silently.
  // Minified CSS may shorten a hex to 3 digits (#fff).
  expect(r.expected.surface).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  expect(r.expected.border).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  expect(r.expected.text).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  // ACTIVE is a Style MODE in the design, not an invented colour. The pin
  // reaches the star inside the toolbar's shadow root through the adopted
  // style-modes sheet — TRAP T-tokens-css-never-reaches-shadow.
  expect(r.on.status).toBe('active');

  // The ring and the ink PAINT differently from the default look. The face is
  // not asserted as changed: since 2026-09-24 the active mode's surface IS the
  // default surface in Figma. Not fixed triples either — the exact rgb depends
  // on the browser's rounding of the token hex, which is not what this tests.
  expect(r.on.border).not.toBe(r.off.border);
  expect(r.on.ink).not.toBe(r.off.ink);

  // …and they are the ACTIVE tokens, not some other colour: each painted value
  // carries the same leading channel as the property it came from.
  const firstChannel = (v: string): number => {
    const hex = /^#(..)/.exec(v);
    return hex ? parseInt(hex[1]!, 16) : Number(/(\d+)/.exec(v)?.[1] ?? -1);
  };
  expect(firstChannel(r.on.bg)).toBe(firstChannel(r.expected.surface));
  expect(firstChannel(r.on.border)).toBe(firstChannel(r.expected.border));
  expect(firstChannel(r.on.ink)).toBe(firstChannel(r.expected.text));

  // Off is the plain default look, and the toggle is REVERSIBLE — clicking again
  // returns every one of the three to exactly what it was.
  expect(r.off.status).toBe(null);
  expect(r.backOff.status).toBe(null);
  expect(r.backOff.bg).toBe(r.off.bg);
  expect(r.backOff.border).toBe(r.off.border);
  expect(r.backOff.ink).toBe(r.off.ink);
});

test('the undo button clears every chip and the organise state', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate!([
      { id: 'active', label: 'Active', active: true },
      { id: 'trial', label: 'Trial', active: true },
      { id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro', selected: true }] },
    ]);
    el.organise!({ group: [{ field: 'region', label: 'Region' }] });
    // populate() stamps the chips, which are themselves custom elements — give
    // them a turn to upgrade before reaching for one.
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    // Turn the menu chip on so there is a live value constraint to clear.
    const plan = el.shadowRoot!.querySelector('.chip[data-id="plan"]') as HTMLElement;
    plan.toggleAttribute('data-current', true);
    const before = { active: el.active, values: el.values };

    const seen: string[] = [];
    for (const ev of ['filter-clear', 'quick-filter-change', 'group-change', 'sort-change'])
      el.addEventListener(ev, () => seen.push(ev));

    const undo = el.shadowRoot!.querySelector('[data-act="clear"]') as HTMLElement;
    (undo.shadowRoot!.querySelector('button') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return {
      before,
      after: { active: el.active, values: el.values, group: el.groupField },
      seen,
    };
  });

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
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });
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
  });

  // Figma's "Frame 1" joins the three at `structure-space/snapped` (0) so they sit
  // flush and read as ONE control. The rounding is set in the toolbar's own CSS, not
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

  // …and they actually TOUCH, rather than merely looking square. The snap gap is
  // `--sherpa-structure-space-snapped`, which resolves to space/none = 0, so each
  // button starts exactly where the one before it ended — no gap, no overlap.
  // Compare with a tolerance, not `===`: sub-pixel layout makes the shared edge
  // tie only approximately.
  expect(r[1]!.left).toBeCloseTo(r[0]!.right, 2);
  expect(r[2]!.left).toBeCloseTo(r[1]!.right, 2);
});

test('a persistent chip is a SELECTOR: it cannot be switched off', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });
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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const view = el.shadowRoot!.querySelector('.chip[data-id="view"]') as HTMLElement;
    const trial = el.shadowRoot!.querySelector('.chip[data-id="trial"]') as HTMLElement;
    const on = (c: HTMLElement) => c.hasAttribute('data-current');

    const start = { view: on(view), trial: on(trial) };

    // Click the persistent chip's body — an ordinary chip would go off.
    (view.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const afterClick = { view: on(view), trial: on(trial) };

    // …and the ordinary one still toggles, so this is not just "nothing works".
    (trial.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const afterTrial = { view: on(view), trial: on(trial) };

    // A full reset must not leave the page with no view.
    const undo = el.shadowRoot!.querySelector('[data-act="clear"]') as HTMLElement;
    (undo.shadowRoot!.querySelector('button') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { start, afterClick, afterTrial, afterReset: { view: on(view), trial: on(trial) } };
  });

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

/**
 * The view chip is a SELECTOR, and the three things that follow from that are
 * all one idea: it is never removable, it always holds a value, and it is
 * therefore never "on with nothing picked".
 *
 * The last one is what shipped as a bug: the amber WARNING look appeared on the
 * view chip at load, intermittently. It was intermittent because it depended on
 * whether the host had remembered to mark an option `selected` — nothing in the
 * chip made sure a selector had a selection.
 *
 * NOTE the definition below deliberately marks NO option `selected`, and asks
 * for no `removable`. That is the failing shape.
 */
test('the view chip offers no remove, defaults to its first option, and never goes amber', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });
    el.populate!([
      {
        id: 'view',
        label: 'Fleet overview',
        persistent: true,
        select: 'single',
        // NO `selected`, and NO `removable`.
        options: [
          { value: 'fleet', label: 'Fleet overview' },
          { value: 'critical', label: 'Critical only' },
        ],
      },
      // An ordinary chip that DOES opt in, so "no remove row" is proved to be
      // the persistent chip's doing and not the row being broken outright.
      {
        id: 'plan',
        label: 'Plan',
        removable: true,
        options: [{ value: 'pro', label: 'Pro' }],
      },
      // …and one that opts OUT, which is the new default.
      { id: 'region', label: 'Region', options: [{ value: 'emea', label: 'EMEA' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const chip = (id: string) => sr.querySelector(`.chip[data-id="${id}"]`) as HTMLElement;
    const view = chip('view');
    const checked = [...view.querySelectorAll('input')]
      .filter((i) => (i as HTMLInputElement).checked)
      .map((i) => (i as HTMLInputElement).value);

    return {
      // The first option stands in for the pick the host did not name.
      checked,
      viewOn: view.hasAttribute('data-current'),
      // …so the chip is never ON-with-nothing, and never wears the warning tint.
      viewEmpty: view.hasAttribute('data-empty'),
      // The bar reports it like any other applied filter.
      values: JSON.parse(JSON.stringify(el.values)),
      // "Remove" is a FOOTER BUTTON on the chip's menu now, not a row in
      // its list — so the offer is the menu's own data-removable flag.
      remove: {
        view: !!view.querySelector('sherpa-menu[data-removable]'),
        plan: !!chip('plan').querySelector('sherpa-menu[data-removable]'),
        region: !!chip('region').querySelector('sherpa-menu[data-removable]'),
      },
    };
  });

  // ONE value, the first, without the host having said so.
  expect(r.checked).toEqual(['fleet']);
  expect(r.viewOn).toBe(true);

  // The amber state is a contradiction a selector cannot be in.
  expect(r.viewEmpty).toBe(false);

  expect(r.values).toEqual({ view: ['fleet'] });

  // "Remove" is OPT-IN. The selector never offers it; a chip that asked
  // for it gets it; a chip that did not, does not.
  expect(r.remove).toEqual({ view: false, plan: true, region: false });
});

test('the Add button puts an available filter on the bar and drops it from its menu', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate!([{ id: 'active', label: 'Active' }]);
    el.available!([
      { id: 'health', label: 'Health', options: [{ value: 'good', label: 'Good' }] },
      { id: 'seats', label: 'Seats', options: [{ value: '10', label: '10' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const chips = () => [...sr.querySelectorAll('.chips > .chip')].map((c) => (c as HTMLElement).dataset['id']);
    const add = sr.querySelector('.add-btn') as HTMLElement;
    // Skips the select-all row the multi menu leads with; it carries no filter id.
    /* THE WHOLE LIST, with ticks saying what is held: `+id` held, `-id` offered.
       TRAP T-the-add-menu-is-the-whole-list */
    const offered = () =>
      [...add.querySelectorAll('label:not(.qf-all) input')]
        .map((i) => ((i as HTMLInputElement).checked ? '+' : '-') + (i as HTMLInputElement).value);

    const before = { chips: chips(), offered: offered() };

    // OPEN, as a reader must: a shut menu's Apply is off, and an off button
    // acts on nothing. TRAP T-a-disabled-button-acts-on-nothing
    (add.querySelector('sherpa-menu') as HTMLElement & { show(t: HTMLElement): void }).show(add);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    // MULTI-select: pick one and commit it, exactly as the caret's menu does.
    ([...add.querySelectorAll('input')] as HTMLInputElement[]).find((i) => i.value === 'health')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const menu = add.querySelector('sherpa-menu') as HTMLElement & { shadowRoot: ShadowRoot };
    (menu.shadowRoot.querySelector('[data-act="apply"], .apply, button') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 120));

    return {
      before,
      after: { chips: chips(), offered: offered() },
      // A MENU chip is deliberately absent from `active` (its id names a column,
      // not a value), so "did it arrive on?" is read off the chip itself.
      addedIsOn: !!sr.querySelector('.chip[data-id="health"]')?.hasAttribute('data-current'),
      // On with no values is the AMBER warning, which is what we are avoiding.
      addedIsWarning: !!sr.querySelector('.chip[data-id="health"]')?.hasAttribute('data-empty'),
    };
  });

  expect(r.before.chips).toEqual(['active']);
  expect(r.before.offered).toEqual(['-health', '-seats']);

  /* The picked filter goes onto the bar and STAYS in the menu, now ticked —
     the tick is what says it is held, and unticking is how it comes off.
     TRAP T-the-add-menu-is-the-whole-list */
  expect(r.after.chips).toEqual(['active', 'health']);
  expect(r.after.offered).toContain('+health');
  expect(r.after.offered).toContain('-seats');

  /* It arrives OFF, in the DEFAULT look. A chip added ON holds no values yet,
     and "on but filtering by nothing" paints the amber warning — shown to a
     reader who has done nothing but add the chip they asked for. They add it,
     then answer it. TRAP T-a-new-chip-opens-in-default-not-warning */
  expect(r.addedIsOn).toBe(false);
  expect(r.addedIsWarning).toBe(false);
});

test('the Add menu is multi-select and searchable; a chip can be removed', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate!([{ id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro' }] }]);
    el.available!([
      { id: 'health', label: 'Health', options: [{ value: 'good', label: 'Good' }] },
      { id: 'seats', label: 'Seats', options: [{ value: '10', label: '10' }] },
      { id: 'tickets', label: 'Tickets', options: [{ value: '1', label: '1' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const chips = () => [...sr.querySelectorAll('.chips > .chip')].map((c) => (c as HTMLElement).dataset['id']);
    const add = sr.querySelector('.add-btn') as HTMLElement;
    const addMenu = add.querySelector('sherpa-menu') as HTMLElement;
    // Skips the select-all row the multi menu leads with; it carries no filter id.
    /* THE WHOLE LIST, with ticks saying what is held: `+id` held, `-id` offered.
       TRAP T-the-add-menu-is-the-whole-list */
    const offered = () =>
      [...add.querySelectorAll('label:not(.qf-all) input')]
        .map((i) => ((i as HTMLInputElement).checked ? '+' : '-') + (i as HTMLInputElement).value);
    const apply = async (host: HTMLElement) => {
      const menu = host.querySelector('sherpa-menu') as HTMLElement & { shadowRoot: ShadowRoot };
      (menu.shadowRoot.querySelector('[data-act="apply"], .apply, button') as HTMLElement).click();
      await new Promise((res) => setTimeout(res, 120));
    };

    const menuShape = {
      select: addMenu.getAttribute('data-select'),
      inputType: (add.querySelector('input') as HTMLInputElement).type,
      addSearch: addMenu.hasAttribute('data-search'),
      // Every VALUE menu gets one too — a filter's values are the user's own data.
      chipSearch: (sr.querySelector('.chip[data-id="plan"] sherpa-menu') as HTMLElement).hasAttribute('data-search'),
    };

    // Add TWO in one visit — the point of multi-select. OPEN first, as a
    // reader must. TRAP T-a-disabled-button-acts-on-nothing
    (addMenu as HTMLElement & { show(t: HTMLElement): void }).show(add);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    for (const v of ['health', 'seats']) {
      ([...add.querySelectorAll('input')] as HTMLInputElement[]).find((i) => i.value === v)!.click();
    }
    await apply(add);
    const afterAdd = { chips: chips(), offered: offered() };

    // …then take one back off through its own menu's "Remove" BUTTON, which
    // lives in the menu's HEADER (shadow DOM), not in the chip's list. It is
    // icon-only, so its name is the aria-label, not its text.
    const health = sr.querySelector('.chip[data-id="health"]') as HTMLElement;
    const healthMenu = health.querySelector('sherpa-menu')!;
    await (healthMenu as unknown as { rendered: Promise<void> }).rendered;
    const removeBtn = healthMenu.shadowRoot!.querySelector('.remove') as HTMLElement;
    const removeLabel = (removeBtn.textContent ?? '').trim();
    removeBtn.click();
    await new Promise((res) => setTimeout(res, 200));

    return { menuShape, afterAdd, removeLabel, afterRemove: { chips: chips(), offered: offered() } };
  });

  // MULTI-select: checkbox rows, and a search for a long field list.
  expect(r.menuShape.select).toBe('multiple');
  expect(r.menuShape.inputType).toBe('checkbox');
  expect(r.menuShape.addSearch).toBe(true);
  expect(r.menuShape.chipSearch).toBe(true);

  // Two added in ONE visit, and both still listed — ticked.
  expect(r.afterAdd.chips).toEqual(['plan', 'health', 'seats']);
  expect(r.afterAdd.offered).toContain('+health');
  expect(r.afterAdd.offered).toContain('+seats');
  expect(r.afterAdd.offered).toContain('-tickets');

  // REMOVE puts it back where it came from: a user who removes a chip by mistake
  // should find it where they got it. Its picks are dropped — "remove" means
  // remove, not "hide and remember".
  expect(r.removeLabel).toBe('Remove');
  expect(r.afterRemove.chips).toEqual(['plan', 'seats']);
  // Removed, so its row is UNTICKED — still listed, ready to be ticked back.
  expect(r.afterRemove.offered).toContain('-health');
  expect(r.afterRemove.offered).toContain('-tickets');
});

test('adding or removing a filter never disturbs the others', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    // `removable: true` — the opt-in that puts "Remove" in the menu.
    el.populate!([
      { id: 'plan', label: 'Plan', removable: true, options: [{ value: 'pro', label: 'Pro' }] },
      { id: 'region', label: 'Region', removable: true, options: [{ value: 'emea', label: 'EMEA' }] },
      { id: 'trial', label: 'Trial' },
    ]);
    el.available!([{ id: 'seats', label: 'Seats', options: [{ value: '10', label: '10' }] }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const apply = async (host: Element) => {
      const m = host.querySelector('sherpa-menu') as HTMLElement & { shadowRoot: ShadowRoot };
      (m.shadowRoot.querySelector('[data-act="apply"], .apply, button') as HTMLElement).click();
      await new Promise((res) => setTimeout(res, 150));
    };
    const snap = () => ({
      values: JSON.parse(JSON.stringify(el.values)),
      trialOn: !!sr.querySelector('.chip[data-id="trial"]')?.hasAttribute('data-current'),
    });

    // Build up some state: two menu chips picked, one toggle chip ON.
    for (const id of ['plan', 'region']) {
      const chip = sr.querySelector(`.chip[data-id="${id}"]`)!;
      (chip.querySelector('input') as HTMLInputElement).click();
      await apply(chip);
    }
    (sr.querySelector('.chip[data-id="trial"]')!.shadowRoot!.querySelector('.body') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const before = snap();

    // ADD one — by name: the Filters menu has no Select all to lead it.
    const add = sr.querySelector('.add-btn')!;
    (add.querySelector('input[value="seats"]') as HTMLInputElement).click();
    await apply(add);
    const afterAdd = snap();

    // …and REMOVE a different one.
    const regionMenu = sr.querySelector('.chip[data-id="region"] sherpa-menu')!;
    await (regionMenu as unknown as { rendered: Promise<void> }).rendered;
    (regionMenu.shadowRoot!.querySelector('.remove') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 200));
    const afterRemove = snap();

    return { before, afterAdd, afterRemove };
  });

  expect(r.before.values).toEqual({ plan: ['pro'], region: ['emea'] });
  expect(r.before.trialOn).toBe(true);

  // A re-render rebuilds every chip from #filters, whose `options` still carry
  // the flags they were POPULATED with — so adding one filter used to reset
  // every other chip's picks and its on/off state. The live DOM is the only
  // record of what the user has done since.
  expect(r.afterAdd.values).toEqual({ plan: ['pro'], region: ['emea'] });
  expect(r.afterAdd.trialOn).toBe(true);

  // Removing one drops ONLY its own values.
  expect(r.afterRemove.values).toEqual({ plan: ['pro'] });
  expect(r.afterRemove.trialOn).toBe(true);
});

test('a DATE chip opens a calendar, commits through the menu, and labels its day', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate!([
      { id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro' }] },
      { id: 'created', label: 'Created', kind: 'date', removable: true },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const chip = sr.querySelector('.chip[data-id="created"]') as HTMLElement;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & {
      rendered?: Promise<void>;
      shadowRoot: ShadowRoot;
    };
    /* THE MENU FIRST. Its calendar is in its own SHADOW root now, so there is
       nothing to query until the menu has rendered.
       TRAP T-a-menu-owns-its-own-bodies */
    await menu.rendered;
    const cal = menu.querySelector('sherpa-calendar') as HTMLElement & {
      rendered?: Promise<void>;
      shadowRoot: ShadowRoot;
    };
    // BOTH, not just the calendar: reading getComputedStyle off a shadow root
    // that has not rendered gives "" rather than "none". It passed alone and
    // failed in a full run, which is the shape of every flake.
    await cal.rendered;

    const projected = menu.querySelector('.cal-header-projected') as HTMLElement;
    const before = {
      label: chip.getAttribute('data-label'),
      on: chip.hasAttribute('data-current'),
      // ONE footer: the menu's. Figma's Calendar composes a Container Footer
      // rather than drawing its own, so a Calendar inside a Menu has one.
      calFooter: getComputedStyle(cal.shadowRoot.querySelector('.cal-footer')!).display,
      menuFooter: getComputedStyle(menu.shadowRoot.querySelector('.footer')!).display,
      // A calendar is not a list to search.
      hasSearch: menu.hasAttribute('data-search'),
      // …and ONE header: the MENU's, holding the calendar's own stepper.
      projectedSlot: projected?.assignedSlot?.name ?? null,
      menuHeaderShown: getComputedStyle(menu.shadowRoot.querySelector('.header')!).display,
      calOwnHeader: getComputedStyle(cal.shadowRoot.querySelector('.cal-header')!).display,
      monthLabel: projected?.querySelector('.cal-label')?.textContent ?? null,
      // The Calendar footer's LEFT slot holds Today (Figma 1156:29251), not
      // Clear — so that is the button a date menu shows there.
      todayShown: getComputedStyle(menu.shadowRoot.querySelector('.today')!).display,
      clearShown: getComputedStyle(menu.shadowRoot.querySelector('.clear')!).display,
      // …and the way OFF the bar is a FOOTER BUTTON after Today. A calendar
      // menu has no list, so the action ROW a value menu carries has nowhere to
      // sit — the date branch skipped it entirely, which left a date filter as
      // the one kind of chip a reader could add and never take away.
      removeShown: getComputedStyle(menu.shadowRoot.querySelector('.remove')!).display,
      // No geometry here — this menu is never SHOWN, so every rect reads 0. The
      // footer's order and the card's width are measured in
      // reforged-menu-calendar.spec.ts, which opens one.
      removable: menu.hasAttribute('data-removable'),
    };

    // The projected stepper still drives the calendar it came from.
    (projected.querySelector('.cal-next') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const steppedTo = projected.querySelector('.cal-label')!.textContent;

    cal.setAttribute('data-value', '2024-06-15');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    (menu.shadowRoot.querySelector('[data-act="apply"], .apply, button') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 200));

    const after = {
      label: chip.getAttribute('data-label'),
      // The day now reads in the CARET button, not folded into the chip label.
      caret: (chip.shadowRoot?.querySelector('.caret-label')?.textContent ?? '').trim(),
      on: chip.hasAttribute('data-current'),
      values: JSON.parse(JSON.stringify(el.values)),
    };

    // TODAY re-picks rather than empties, so the date after it is today's.
    const todayBtn = menu.shadowRoot.querySelector('.today') as HTMLElement & {
      shadowRoot: ShadowRoot;
    };
    (todayBtn.shadowRoot.querySelector('button') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 120));

    const now = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    return {
      before, steppedTo, after,
      afterToday: cal.dataset['value'] ?? null,
      todayIso: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`,
    };
  });

  // The menu holds a CALENDAR, and only the menu draws an action row.
  expect(r.before.calFooter).toBe('none');
  expect(r.before.menuFooter).not.toBe('none');
  expect(r.before.hasSearch).toBe(false);
  expect(r.before.label).toBe('Created');
  expect(r.before.on).toBe(false);

  // Committing turns the chip ON and reports the day in the SAME shape a value
  // chip uses — an array — so no consumer has to branch on the chip's kind.
  expect(r.after.on).toBe(true);
  expect(r.after.values).toEqual({ created: ['2024-06-15'] });

  // The chip label NEVER moves — the field name stays put so the bar does not
  // re-flow every time a day is picked.
  expect(r.after.label).toBe('Created');
  // …and the CARET carries the day, formatted, rather than an ISO string.
  expect(r.after.caret).not.toBe('');
  expect(r.after.caret).not.toContain('2024-06-15');

  // ONE HEADER, and it is the MENU's. The Calendar node is a card of three
  // regions whose first is a `header` slot holding ‹ · "August 2026" · › — so a
  // calendar inside a menu contributes its stepper to that slot rather than
  // drawing a second header of its own.
  expect(r.before.projectedSlot).toBe('header');
  expect(r.before.menuHeaderShown).not.toBe('none');
  expect(r.before.calOwnHeader).toBe('none');
  expect(r.before.monthLabel).toMatch(/\w+ \d{4}/);

  // The projected stepper still drives the calendar it was stamped from.
  expect(r.steppedTo).not.toBe(r.before.monthLabel);

  // TODAY is the left footer button on a calendar menu — Figma's Calendar
  // footer puts it in that slot. It jumps the calendar to today rather than
  // emptying it.
  expect(r.before.todayShown).not.toBe('none');
  expect(r.afterToday).toBe(r.todayIso);

  // CLEAR is offered TOO, now that it no longer competes for that slot: it is
  // an icon button in the menu's HEADER. A date chip was the one kind with no
  // way back to "no date" short of removing the chip, because Clear was a
  // footer button and Today had already taken the only footer position.
  expect(r.before.clearShown).not.toBe('none');

  // The way OFF the bar is the second header icon button, beside Clear. A date
  // chip had neither before: no remove row (the branch returned past it) and no
  // footer position left to put one in.
  expect(r.before.removable).toBe(true);
  expect(r.before.removeShown).not.toBe('none');
});

test('the VIEW selector keeps its own icon, whatever the app passes', async ({ page }) => {
  // "You are looking at a saved view" is the same statement on every screen, so
  // the glyph must not borrow whatever page the bar happens to sit on. The
  // examples each passed their own nav icon — a table for records, a gauge for
  // the dashboard — which made one control look like several.
  const got = await page.evaluate(async () => {
    const read = async (icon?: string) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
      bar.populate([
        { id: 'view', label: 'View', persistent: true, active: true, select: 'single',
          ...(icon ? { icon } : {}),
          options: [{ value: 'all', label: 'All', selected: true }] },
        // A normal chip beside it still takes the icon it was given.
        { id: 'plan', label: 'Plan', icon: 'price-tag', options: [{ value: 'pro', label: 'Pro' }] },
      ]);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const chips = [...bar.shadowRoot!.querySelectorAll('sherpa-quick-filter')];
      return chips.map((c) => c.getAttribute('data-icon-start'));
    };
    return {
      // An app passing its own page icon must NOT override the view glyph…
      overridden: await read('gauge'),
      // …and passing none gets it anyway.
      absent: await read(),
    };
  });

  for (const pair of [got.overridden, got.absent]) {
    expect(pair[0]).toBe('desktop');
    // The neighbouring chip is untouched.
    expect(pair[1]).toBe('price-tag');
  }
});

test('a PERSISTENT chip selects its first option on init; a plain filter chip does not', async ({ page }) => {
  // A view selector is never "off" — you are always looking at some view — so it
  // must arrive with a value picked and its caret naming that value, without the
  // app having to mark an option `selected`. A plain FILTER chip is the opposite:
  // "no filter" is a real state, so it must arrive holding nothing.
  const got = await page.evaluate(async () => {
    const build = async (def: Record<string, unknown>) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
      // NOTE: no `selected` on any option — the chip decides.
      bar.populate([{ ...def, options: [{ value: 'a', label: 'First' }, { value: 'b', label: 'Second' }] }]);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const chip = bar.shadowRoot!.querySelector('sherpa-quick-filter')!;
      return {
        caret: chip.shadowRoot!.querySelector('.caret-label')!.textContent,
        checked: [...chip.querySelectorAll('input')].filter((i) => (i as HTMLInputElement).checked)
          .map((i) => (i as HTMLInputElement).value),
        reported: bar.values,
      };
    };
    return {
      persistent: await build({ id: 'view', label: 'View', persistent: true, active: true, select: 'single' }),
      plain: await build({ id: 'plan', label: 'Plan', select: 'single' }),
    };
  });

  // Picked, named in the caret, and readable by the app without an event.
  expect(got.persistent.checked).toEqual(['a']);
  expect(got.persistent.caret).toBe('First');
  expect(got.persistent.reported).toEqual({ view: ['a'] });

  // A filter chip holds nothing until someone picks.
  expect(got.plain.checked).toEqual([]);
  expect(got.plain.caret).toBe('');
  expect(got.plain.reported).toEqual({});
});

/**
 * A NUMBER filter is one chip with two shapes — "equals this" and "between these
 * two" — flipped by a Range switch at the top of its menu.
 *
 * Two separate chips would make the user choose the shape before they know which
 * they want, and changing their mind would mean taking one off the bar and adding
 * the other.
 */
test('a NUMBER chip flips between a single field and a two-ended slider', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    /* `range: false` EXPLICITLY. A number chip now opens as a range by default
       (T-a-default-is-not-an-override), and this test is about the FLIP between
       the two shapes — so it declares the side it wants to start on. That the
       declaration wins over the default is half the trap, and this asserts it. */
    el.populate([
      { id: 'spend', label: 'Spend', kind: 'number', min: 0, max: 1000, step: 10,
        range: false, active: true },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    /* THE BODY IS THE MENU'S OWN, in its shadow root — a slotted body is styled
       by whoever handed it over, which is why there were two spellings.
       TRAP T-a-menu-owns-its-own-bodies */
    const menu = el.shadowRoot!.querySelector('.chip[data-id="spend"] sherpa-menu') as
      HTMLElement & { shadowRoot: ShadowRoot };
    const shown = (sel: string): boolean => {
      const node = menu.shadowRoot.querySelector(sel);
      return !!node && getComputedStyle(node).display !== 'none';
    };
    const slider = menu.shadowRoot.querySelector<HTMLElement & { range: [number, number] }>('.body-number-range')!;
    const field = menu.shadowRoot.querySelector<HTMLInputElement>('.body-number-one')!;
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();

    const flip = async (): Promise<void> => {
      const sw = menu.shadowRoot.querySelector('.body-range-switch') as HTMLElement & {
        rendered?: Promise<void>;
        shadowRoot: ShadowRoot;
      };
      await sw.rendered;
      sw.shadowRoot.querySelector<HTMLInputElement>('.input')!.click();
      await settle();
    };

    const snap = (): Record<string, unknown> => ({
      ranged: menu.hasAttribute('data-range'),
      field: shown('.body-number-one'),
      slider: shown('.body-number-range'),
      // One number is TYPED text; a range is its two ends.
      picks: ((r) => {
        const v = r ? (r['text'] ? [r['text'] as string] : r.picked ?? []) : [];
        return v.length ? v : null;
      })(el.readings['spend']),
    });

    const opened = snap();
    // The bounds reach BOTH shapes, so typing 5000 into a 0..1000 filter cannot
    // ask for a row that cannot exist.
    const bounds = {
      slider: [slider.getAttribute('min'), slider.getAttribute('max'), slider.getAttribute('step')],
      field: [field.getAttribute('min'), field.getAttribute('max')],
    };

    field.value = '250';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const typed = snap();

    await flip();
    const ranged = snap();

    slider.range = [200, 600];
    await settle();
    const dragged = snap();

    await flip();
    const back = snap();

    return { opened, bounds, typed, ranged, dragged, back };
  });

  // Opens SINGLE, because the definition said so — the DEFAULT for a number is
  // now a range, and an explicit `range: false` overrules it.
  expect(r.opened).toEqual({ ranged: false, field: true, slider: false, picks: null });
  expect(r.bounds.slider).toEqual(['0', '1000', '10']);
  expect(r.bounds.field).toEqual(['0', '1000']);

  expect(r.typed.picks).toEqual(['250']);

  // Flipped ON, a FULL-SPAN range excludes nothing, so it reports no pick at all
  // — otherwise the chip would paint as an active filter that is not filtering.
  expect(r.ranged).toEqual({ ranged: true, field: false, slider: true, picks: null });

  // Both ends, in order.
  expect(r.dragged.picks).toEqual(['200', '600']);

  // Flipping BACK restores what was typed. Both shapes are in the DOM from the
  // start and CSS reveals one, so a flip is an attribute write, not a rebuild.
  expect(r.back).toEqual({ ranged: false, field: true, slider: false, picks: ['250'] });
});

/** A DATE chip gets the same switch, over its calendar rather than beside it. */
test('a DATE chip carries the Range switch as a full-width row above its calendar', async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate([{ id: 'created', label: 'Created', kind: 'date', active: true }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const menu = el.shadowRoot!.querySelector('.chip[data-id="created"] sherpa-menu') as HTMLElement & {
      show(): void;
      shadowRoot: ShadowRoot;
    };
    menu.show();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

    const cal = menu.querySelector('sherpa-calendar')!;
    const row = menu.shadowRoot.querySelector('.body-range')!.getBoundingClientRect();
    const rows = menu.shadowRoot.querySelector('.rows')!.getBoundingClientRect();
    const calBox = cal.getBoundingClientRect();

    const flip = async (): Promise<void> => {
      const sw = menu.shadowRoot.querySelector('.body-range-switch') as HTMLElement & {
        rendered?: Promise<void>;
        shadowRoot: ShadowRoot;
      };
      await sw.rendered;
      sw.shadowRoot.querySelector<HTMLInputElement>('.input')!.click();
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    };

    const before = (cal as HTMLElement).dataset['type'] ?? null;
    await flip();
    const on = (cal as HTMLElement).dataset['type'];
    await flip();
    const off = (cal as HTMLElement).dataset['type'];

    return {
      // A calendar menu's list region runs ACROSS, so without a full-width rule
      // the switch became a narrow column squeezed against the day grid.
      fullWidth: Math.abs(row.width - rows.width) < 2,
      above: row.bottom <= calBox.top + 1,
      before,
      on,
      off,
    };
  });

  expect(r.fullWidth).toBe(true);
  expect(r.above).toBe(true);

  // The calendar's own two-ended mode, which it already had: a two-click
  // start→end selection with the days between banded.
  expect(r.before).toBeNull();
  expect(r.on).toBe('range');
  expect(r.off).toBe('single');
});

/**
 * A RANGE has two ends, so the pick is not finished on the first one — applying
 * there would filter to a span the user has not named yet. On a REMOTE source
 * the Range switch moves a DATE menu between auto-apply and Apply/Cancel at
 * runtime; LOCALLY nothing waits for Apply (Will, 2026-09-27). A NUMBER is the
 * exception: it is typed, so it always waits for Apply (Will, TODO 94).
 * TRAP T-commit-follows-select-mode · TRAP T-a-number-waits-for-apply
 */
test('the Range switch brings Apply/Cancel on a remote source, and leads its own label', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (def: unknown, id: string, remote = true): Promise<Record<string, unknown>> => {
      const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined,
        remote ? { 'data-remote': '' } : {});
      el.populate([def]);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();

      const menu = el.shadowRoot!.querySelector(`.chip[data-id="${id}"] sherpa-menu`) as HTMLElement & {
        show(): void;
        shadowRoot: ShadowRoot;
      };
      menu.show();
      await (window as unknown as { __settled: () => Promise<void> }).__settled();

      const shown = (sel: string): boolean => {
        const n = menu.shadowRoot.querySelector(sel);
        return !!n && getComputedStyle(n).display !== 'none';
      };
      const row = menu.shadowRoot.querySelector('.body-range')!;
      const sw = row.querySelector('sherpa-switch') as HTMLElement & {
        rendered?: Promise<void>;
        shadowRoot: ShadowRoot;
      };
      await sw.rendered;

      // The CONTROL leads and the label follows, exactly where a value row puts
      // its checkbox and its text — so every control shares one left edge.
      const leads =
        sw.getBoundingClientRect().left < row.querySelector('.body-range-label')!.getBoundingClientRect().left;

      const single = { commits: menu.hasAttribute('data-commit'), apply: shown('.apply'), cancel: shown('.cancel') };
      sw.shadowRoot.querySelector<HTMLInputElement>('.input')!.click();
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const ranged = { commits: menu.hasAttribute('data-commit'), apply: shown('.apply'), cancel: shown('.cancel') };
      // …and back, so the flip is not one-way.
      sw.shadowRoot.querySelector<HTMLInputElement>('.input')!.click();
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const back = { commits: menu.hasAttribute('data-commit'), apply: shown('.apply') };

      return { leads, single, ranged, back };
    };

    return {
      /* `range: false` so both kinds start on the SINGLE side and the sequence
         below (single → ranged → back) reads the same for each. A number now
         defaults to a range — T-a-default-is-not-an-override. */
      number: await read(
        { id: 'spend', label: 'Spend', kind: 'number', min: 0, max: 100, range: false, active: true },
        'spend',
      ),
      date: await read({ id: 'created', label: 'Created', kind: 'date', active: true }, 'created'),
      // A chip whose DEFINITION named `commit` keeps what it asked for — the
      // switch supplies the default a host left out, it does not overrule one.
      pinned: await read(
        { id: 'pinned', label: 'Pinned', kind: 'number', min: 0, max: 100,
          commit: false, range: false, active: true },
        'pinned',
      ),
      // LOCAL: a span applies as it is set — no Apply to wait for.
      local: await read(
        { id: 'local', label: 'Local', kind: 'number', min: 0, max: 100, range: false, active: true },
        'local', false,
      ),
    };
  });

  for (const kind of ['number', 'date'] as const) {
    expect(r[kind].leads, `${kind}: switch leads its label`).toBe(true);
  }
  // A DATE: one day is the whole answer, a span defers.
  expect(r.date.single).toEqual({ commits: false, apply: false, cancel: false });
  expect(r.date.ranged).toEqual({ commits: true, apply: true, cancel: true });
  expect(r.date.back).toEqual({ commits: false, apply: false });
  // A NUMBER waits for Apply on both sides, remote or local.
  for (const one of [r.number.single, r.number.ranged, r.local.single, r.local.ranged]) {
    expect(one).toEqual({ commits: true, apply: true, cancel: true });
  }
  expect(r.number.back).toEqual({ commits: true, apply: true });

  // A definition that NAMED `commit: false` keeps it.
  expect(r.pinned.single).toEqual({ commits: false, apply: false, cancel: false });
  expect(r.pinned.ranged).toEqual({ commits: false, apply: false, cancel: false });
});

/**
 * THE BAR IS ONE LINE. It never wraps: the trailing ACTIONS fold into the ⋮
 * first, and only when they are all folded do chips start folding into an
 * overflow chip at the end of the run.
 *
 * The order is the user's priority, not the layout's — a filter chip is what the
 * bar is FOR, and Save/Refresh stay reachable from the ⋮.
 */
test('the bar folds its actions, then its chips, and never wraps', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    const box = document.createElement('div');
    box.style.inlineSize = '1400px';
    box.appendChild(el);
    document.getElementById('root')!.replaceChildren(box);
    await el.rendered;
    el.populate(
      ['Server', 'Region', 'Customer', 'Date', 'Preset', 'Owner', 'Tier', 'Plan'].map((label) => ({
        id: label.toLowerCase(),
        label,
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
      })),
    );
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const settle = (): Promise<void> =>
      new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));

    const at = async (width: number): Promise<Record<string, unknown>> => {
      box.style.inlineSize = `${width}px`;
      await settle();
      await settle();
      const on = [...sr.querySelectorAll('.chips > .chip')].filter(
        (c) => !c.hasAttribute('data-folded-away'),
      );
      const shown = (sel: string): boolean => {
        const n = sr.querySelector(sel);
        return !!n && getComputedStyle(n).display !== 'none';
      };
      return {
        collapse: el.getAttribute('data-collapse'),
        folded: el.getAttribute('data-folded'),
        chipsOnBar: on.length,
        // ONE LINE, at every width. Wrapping pushed the bar to two rows and the
        // action cluster then sat against a short second line, not the bar's end.
        rows: new Set(on.map((c) => Math.round(c.getBoundingClientRect().y))).size,
        // The Filters button counts what folded into it.
        badge: sr.querySelector('.add-btn')?.getAttribute('data-badge') ?? null,
        ellipsis: shown('.act[data-act="overflow"]'),
        // Filters survives every fold: putting a filter ON the bar, or reaching
        // one that folded, is what a collapsed bar still needs.
        add: shown('.act[data-act="add"]'),
      };
    };

    // 860, not 900: the bar lost its panel switch (the page's now), so it folds later.
    return { wide: await at(1400), mid: await at(860), narrow: await at(620) };
  });

  // WIDE: nothing folded, and the ⋮ is absent — an empty overflow button is one
  // that opens nothing.
  expect(r.wide.collapse).toBeNull();
  expect(r.wide.folded).toBeNull();
  expect(r.wide.ellipsis).toBe(false);
  expect(r.wide.badge).toBeNull();
  expect(r.wide.rows).toBe(1);

  // MID: the ACTIONS have folded and the ⋮ has appeared to hold them.
  expect(r.mid.collapse).not.toBeNull();
  expect(r.mid.ellipsis).toBe(true);
  expect(r.mid.rows).toBe(1);

  // NARROW: chips fold too, into the Filters menu, and its badge counts them.
  expect(Number(r.narrow.folded)).toBeGreaterThan(0);
  expect(Number(r.narrow.badge)).toBe(Number(r.narrow.folded));
  expect(Number(r.narrow.chipsOnBar)).toBeLessThan(Number(r.mid.chipsOnBar));
  expect(r.narrow.rows).toBe(1);

  // Filters is still there at every width.
  for (const step of [r.wide, r.mid, r.narrow]) expect(step.add).toBe(true);
});

/**
 * The overflow chip's menu DRILLS IN PLACE: a row swaps the list for that
 * filter's own rows, and a back arrow plus breadcrumbs swap it home.
 *
 * One card, so there is no second box to position, nothing to close when a
 * pointer crosses a gap, and no way for two cards to disagree about what is
 * ticked — which is exactly what a hover-spawned submenu got wrong.
 */
test('the Filters menu drills into a folded filter and back out', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      readings: Record<string, { picked?: string[] }>;
    };
    const box = document.createElement('div');
    box.style.inlineSize = '560px';
    box.appendChild(el);
    document.getElementById('root')!.replaceChildren(box);
    await el.rendered;
    el.populate(
      ['Server', 'Region', 'Customer', 'Date', 'Preset', 'Owner'].map((label) => ({
        id: label.toLowerCase(),
        label,
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
      })),
    );
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

    const sr = el.shadowRoot!;
    const chip = sr.querySelector('.add-btn') as HTMLElement & { rendered?: Promise<void> };
    await chip.rendered;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & {
      rendered?: Promise<void>;
      shadowRoot: ShadowRoot;
      show(t?: HTMLElement): void;
      values: string[];
    };
    await menu.rendered;
    menu.show(chip);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const settle = (): Promise<void> =>
      new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));

    const snap = (): Record<string, unknown> => ({
      drill: menu.hasAttribute('data-drill'),
      heading: menu.shadowRoot.querySelector('.heading')?.textContent,
      // The rows ARE the Filters list, a folded one opening its child menu —
      // or ARE that filter's values.
      firstDrill: [...menu.children].find((n) => !n.classList.contains('menu-section'))
        ?.hasAttribute('data-drill') ?? false,
      trail: getComputedStyle(menu.shadowRoot.querySelector('.drill-trail')!).display !== 'none',
      open: getComputedStyle(menu.shadowRoot.querySelector('.menu')!).display !== 'none',
    });

    const rows = [...chip.querySelectorAll('.menu-row[data-drill]')] as HTMLElement[];
    const list = {
      ...snap(),
      // The badge counts the FOLDED FILTERS — "three are in here" is what a
      // reader needs before opening it.
      badge: chip.getAttribute('data-badge'),
      rowCount: rows.length,
      // The caret is a composed sherpa-button, not hand-rolled markup.
      caretTag: rows[0]?.querySelector('.menu-row-drill')?.tagName,
    };

    const target = rows[0]!.dataset['value']!;
    rows[0]!.querySelector<HTMLElement>('.menu-row-drill')!.click();
    await settle();
    const drilled = snap();

    // A value ticked while drilled is reported LIVE — the rows are moved, not
    // copied, so this is where the filter's one set of inputs currently lives.
    const box1 = menu.querySelector<HTMLInputElement>('label:not(.qf-all) input')!;
    box1.checked = true;
    box1.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const ticked = el.readings[target]?.picked ?? null;

    // BACK, through the arrow. It lives in the MENU's own shadow root, so its
    // click is re-emitted as a composed `menu-back` to reach the toolbar.
    const back = menu.shadowRoot.querySelector('.drill-back') as HTMLElement & {
      rendered?: Promise<void>;
    };
    await back.rendered;
    back.click();
    await settle();
    const out = snap();

    return { list, drilled, ticked, target, out, kept: el.readings[target]?.picked ?? null };
  });

  // The Filters list: a row with a caret for each folded filter.
  expect(r.list.drill).toBe(false);
  expect(r.list.heading).toBe('Filters');
  expect(r.list.caretTag).toBe('SHERPA-BUTTON');
  expect(Number(r.list.badge)).toBe(r.list.rowCount);
  expect(r.list.trail).toBe(false);

  // DRILLED: the filter's own rows, its name, and the way out.
  expect(r.drilled.drill).toBe(true);
  expect(r.drilled.trail).toBe(true);
  expect(r.drilled.open).toBe(true);
  expect(r.drilled.firstDrill).toBe(false);

  // A pick made while drilled is live, and survives coming back out.
  expect(r.ticked).toEqual(['a']);
  expect(r.kept).toEqual(['a']);

  // BACK: the list is restored and the menu stays open.
  expect(r.out.drill).toBe(false);
  expect(r.out.heading).toBe('Filters');
  expect(r.out.firstDrill).toBe(true);
  expect(r.out.open).toBe(true);
});

/**
 * A DATE chip's value reads IN FULL — "03 to 15 Sep 2026". TRAP T-a-date-reads-one-way
 *
 * Every part of it carries meaning, and unlike a value list there is no count
 * that could stand in for a truncated end: "2" says nothing about which two
 * days. So it is not clipped and it wears no badge.
 */
test('a DATE chip names its whole range, day first, without truncating', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate([{ id: 'when', label: 'When', kind: 'date', range: true, active: true }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const chip = el.shadowRoot!.querySelector('.chip[data-id="when"]') as HTMLElement & {
      shadowRoot: ShadowRoot;
    };
    const cal = chip.querySelector('sherpa-calendar') as HTMLElement & {
      rendered?: Promise<void>;
      dataset: DOMStringMap;
    };
    await cal.rendered;

    const read = async (start: string, end?: string): Promise<Record<string, unknown>> => {
      if (end) {
        cal.dataset['valueStart'] = start;
        cal.dataset['valueEnd'] = end;
        cal.dispatchEvent(
          new CustomEvent('range-select', { bubbles: true, composed: true, detail: { start, end } }),
        );
      } else {
        delete cal.dataset['valueStart'];
        delete cal.dataset['valueEnd'];
        cal.dataset['value'] = start;
        cal.dispatchEvent(
          new CustomEvent('datetime-change', { bubbles: true, composed: true, detail: start }),
        );
      }
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const label = chip.shadowRoot.querySelector('.caret-label') as HTMLElement;
      return {
        text: label.textContent,
        // NOT clipped — the rule every other chip's value follows is overridden
        // for this one by data-full-value.
        truncated: label.scrollWidth > label.clientWidth + 1,
        maxWidth: getComputedStyle(label).maxInlineSize,
        // …and NO badge: the label already says both days outright.
        badge: chip.dataset['count'] ?? null,
      };
    };

    return {
      sameYear: await read('2026-09-03', '2026-09-15'),
      crossYear: await read('2026-12-18', '2027-01-03'),
      single: await read('2026-09-15'),
      fullValue: chip.hasAttribute('data-full-value'),
    };
  });

  // DAY THEN MONTH, always. toLocaleDateString orders the parts by locale, so a
  // US reader got "Sep 03" and the shape the design asks for was lost — the
  // month NAME follows the locale, the ORDER does not.
  // Each part is said ONCE: one month, so the month and year once.
  expect(r.sameYear.text).toBe('03 to 15 Sep 2026');

  // A range crossing new year states the year on each end, because
  // "18 Dec to 03 Jan 2027" would put the wrong year on the first day.
  expect(r.crossYear.text).toBe('18 Dec 2026 to 03 Jan 2027');

  // One day is one date, with its year.
  expect(r.single.text).toBe('15 Sep 2026');

  for (const step of [r.sameYear, r.crossYear, r.single]) {
    expect(step.truncated).toBe(false);
    expect(step.maxWidth).toBe('none');
    expect(step.badge).toBeNull();
  }
  expect(r.fullValue).toBe(true);
});

/**
 * data-reset-on-populate — the filter set is OWNED by the caller.
 *
 * A bar normally carries a chip's live picks across a re-populate, which is what
 * stops adding one filter resetting every other. But a bar whose set belongs to
 * something else — the app header, whose filters come from the VIEW — must not:
 * carrying the last view's choices into the next filters it by decisions made
 * somewhere else, and a saved view or a preset is meant to decide for itself.
 */
test('data-reset-on-populate drops live picks; without it they survive', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();

    const run = async (reset: boolean): Promise<{ before: string[]; after: string[] }> => {
      const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
        rendered?: Promise<void>;
        populate(d: unknown): void;
        readings: Record<string, { picked?: string[] }>;
      };
      if (reset) el.setAttribute('data-reset-on-populate', '');
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;

      const set = (label: string): unknown[] => [
        {
          id: 'region',
          label,
          select: 'multiple',
          options: [
            { value: 'emea', label: 'EMEA' },
            { value: 'apac', label: 'APAC' },
          ],
        },
      ];

      el.populate(set('Region'));
      await settle();

      // The user picks a value.
      const menu = el.shadowRoot!.querySelector('.chip[data-id="region"] sherpa-menu') as HTMLElement & {
        rendered?: Promise<void>;
        shadowRoot: ShadowRoot;
      };
      await menu.rendered;
      const box = menu.querySelector<HTMLInputElement>('label:not(.qf-all) input')!;
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      (menu.shadowRoot.querySelector('.apply') as HTMLElement | null)?.click();
      await settle();
      const before = el.readings['region']?.picked ?? [];

      // …and the caller populates again, as a view change does.
      el.populate(set('Region'));
      await settle();
      return { before, after: el.readings['region']?.picked ?? [] };
    };

    return { resetting: await run(true), keeping: await run(false) };
  });

  // Both picked something to begin with, or the test proves nothing.
  expect(r.resetting.before).toEqual(['emea']);
  expect(r.keeping.before).toEqual(['emea']);

  // WITH the flag the definition is the whole truth.
  expect(r.resetting.after).toEqual([]);
  // WITHOUT it the live state survives — which is what stops adding one filter
  // resetting every other.
  expect(r.keeping.after).toEqual(['emea']);
});

/**
 * An ORGANISE chip's raw event must never reach the host.
 *
 * A chip emits `quick-filter-change` with `{ values: ['name'] }` — a bare array
 * — where a host reading the TOOLBAR's event of the same name expects
 * `{ values: {id: [...]}, active }`. A view that turned the first into a filter
 * matched nothing, and the grid emptied on every sort from the Sort chip.
 *
 * stopImmediatePropagation alone did not do it: that stops only listeners
 * registered AFTER, and a host that wired its handler before the toolbar had
 * rendered still ran first. The toolbar listens in the CAPTURE phase, which runs
 * before every bubble listener whenever it was added.
 */
test('a sort from the organise chip never reaches the host as a filter change', async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      organise(d: unknown): void;
    };

    // The host wires its listener FIRST — before the toolbar has rendered, which
    // is the ordering that broke. A real view does exactly this.
    const filterChanges: unknown[] = [];
    const sortChanges: unknown[] = [];
    el.addEventListener('quick-filter-change', (e) => filterChanges.push((e as CustomEvent).detail));
    el.addEventListener('sort-change', (e) => sortChanges.push((e as CustomEvent).detail));

    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([{ id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro' }] }]);
    el.organise({
      sort: [{ field: 'name', label: 'Name' }, { field: 'spend', label: 'Spend' }],
      group: [{ field: 'status', label: 'Status' }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const menu = el.shadowRoot!.querySelector(
      '.organise-chip[data-id="sort"] sherpa-menu',
    ) as HTMLElement & { rendered?: Promise<void> };
    await menu.rendered;
    const radio = [...menu.querySelectorAll<HTMLInputElement>('label input')].find(
      (i) => i.value === 'spend',
    )!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { filterChanges, sortChanges };
  });

  // The host hears a SORT, and only a sort.
  expect(r.sortChanges).toEqual([{ field: 'spend', direction: 'asc' }]);
  expect(r.filterChanges).toEqual([]);
});

/**
 * A chip with no `options` is on or off. Folded, its row's caret opens a child
 * menu of ONE row, "On" — the same door every folded filter has, Will's pick,
 * 2026-09-25. It once wore a chevron that did NOTHING, because the drill
 * needed a menu a boolean chip has not got: the bar builds one for the drill.
 * TRAP T-a-row-opens-its-child-menu
 */
test('a folded BOOLEAN filter opens "On"; one with options opens its values', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // Narrow, so everything but the first chip folds.
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'data', 'style': 'max-inline-size: 300px' });
    el.populate([
      { id: 'active', label: 'Active', type: 'data' },
      { id: 'trial', label: 'Trial', type: 'data' },
      { id: 'churned', label: 'Churned', type: 'data' },
      { id: 'plan', label: 'Plan', type: 'data',
        options: [{ value: 'pro', label: 'Pro' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const sr = el.shadowRoot!;
    for (let i = 0; i < 25 && !sr.querySelector('.add-btn sherpa-menu .menu-row[data-drill]'); i++) {
      await new Promise((res) => setTimeout(res, 100));
    }
    /* …AND WAIT FOR THE FOLD TO SETTLE. The rows existing is not the same as
       the bar having finished measuring: the ResizeObserver fires more than
       once on first layout, and reading `data-folded` between two passes
       catches a count that is about to change. That is what made this test look
       flaky — `start` captured 3, the bar settled on 4, and the "badge never
       moves" assertion compared the two. */
    let last = '';
    for (let i = 0; i < 25; i++) {
      const now = el.getAttribute('data-folded') ?? '';
      if (now && now === last) break;
      last = now;
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      await new Promise((res) => setTimeout(res, 40));
    }
    const add = sr.querySelector<HTMLElement>('.add-btn')!;
    const menu = add.querySelector('sherpa-menu') as (HTMLElement & { show(t: HTMLElement): void }) | null;
    if (!menu) return { err: 'no Filters menu' };
    menu.show(add);
    await new Promise((res) => setTimeout(res, 100));

    // EVERY folded chip has a row with a caret, in bar order.
    const drills = [...menu.querySelectorAll<HTMLElement>('.menu-row[data-drill]')]
      .map((d) => d.dataset['value']);
    const inputs = () => [...menu.querySelectorAll<HTMLInputElement>('input')]
      .filter((i) => !i.closest('.qf-all')).map((i) => i.value);
    const drillInto = async (id: string) => {
      menu.querySelector<HTMLElement>(`.menu-row[data-value="${id}"] .menu-row-drill`)!.click();
      await new Promise((res) => setTimeout(res, 200));
    };
    const back = async () => {
      (menu.shadowRoot!.querySelector('.drill-back') as HTMLElement).shadowRoot!.querySelector('button')!.click();
      await new Promise((res) => setTimeout(res, 100));
    };

    // A boolean one opens "On", and "On" drives the CHIP, and reports.
    const seen: unknown[] = [];
    el.addEventListener('quick-filter-change', (e) => seen.push((e as CustomEvent).detail));
    const id = drills.find((d) => d !== 'plan')!;
    const chip = sr.querySelector<HTMLElement>(`.chips > .chip[data-id="${id}"]`)!;
    await drillInto(id);
    const onRows = inputs();
    const box = () => menu.querySelector<HTMLInputElement>('input[value="on"]')!;
    box().click();
    await new Promise((res) => setTimeout(res, 200));
    const on = { box: box().checked, chip: chip.hasAttribute('data-current') };
    box().click();
    await new Promise((res) => setTimeout(res, 200));
    const off = { box: box().checked, chip: chip.hasAttribute('data-current') };
    await back();

    // The one with options opens its VALUES.
    await drillInto('plan');
    const planRows = inputs();
    return { drills, id, onRows, on, off, planRows, seen };
  });

  // Which chips fold depends on the measured width, so the test does not name
  // them — what matters is that EVERY folded one has a caret.
  expect(r.err).toBeUndefined();
  expect(r.drills!.length).toBeGreaterThan(1);
  expect(r.drills).toContain('plan');
  expect(r.onRows).toEqual(['on']);
  expect(r.planRows).toEqual(['pro']);

  // "On" drives the CHIP, so the bar and the menu can never disagree.
  expect(r.on).toEqual({ box: true, chip: true });
  expect(r.off).toEqual({ box: false, chip: false });
  // …and the bar reports it, as it reports a toggle on the bar.
  expect(r.seen).toContainEqual(expect.objectContaining({ scope: 'bar', active: [r.id] }));
});

/**
 * Ticking a folded on/off chip must not re-count the Filters button. It is
 * CHROME, not a filter: its badge counts FOLDED FILTERS, and it reads ON while
 * one of them is. TRAP T-the-filters-button-is-a-door-not-a-filter
 */
test('the Filters button follows a folded chip on and off, and its badge never moves', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'data', 'style': 'max-inline-size: 300px' });
    el.populate([
      { id: 'active', label: 'Active', type: 'data' },
      { id: 'trial', label: 'Trial', type: 'data' },
      { id: 'churned', label: 'Churned', type: 'data' },
      { id: 'plan', label: 'Plan', type: 'data', options: [{ value: 'pro', label: 'Pro' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const sr = el.shadowRoot!;
    for (let i = 0; i < 25 && !sr.querySelector('.add-btn sherpa-menu .menu-row[data-drill]'); i++) {
      await new Promise((res) => setTimeout(res, 100));
    }
    /* …AND WAIT FOR THE FOLD TO SETTLE. The rows existing is not the same as
       the bar having finished measuring: the ResizeObserver fires more than
       once on first layout, and reading `data-folded` between two passes
       catches a count that is about to change. That is what made this test look
       flaky — `start` captured 3, the bar settled on 4, and the "badge never
       moves" assertion compared the two. */
    let last = '';
    for (let i = 0; i < 25; i++) {
      const now = el.getAttribute('data-folded') ?? '';
      if (now && now === last) break;
      last = now;
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      await new Promise((res) => setTimeout(res, 40));
    }
    // RE-QUERY every time. A row can be re-stamped when the fold is recomputed,
    // and a handle held across that reports the OLD element's state.
    const more = (): HTMLElement => sr.querySelector<HTMLElement>('.add-btn')!;
    const menu = more().querySelector('sherpa-menu') as HTMLElement & { show(t: HTMLElement): void };
    menu.show(more());
    await new Promise((res) => setTimeout(res, 100));
    // A folded ON/OFF chip — its caret opens "On".
    const id = [...menu.querySelectorAll<HTMLElement>('.menu-row[data-drill]')]
      .map((d) => d.dataset['value']!).find((v) => v !== 'plan')!;
    menu.querySelector<HTMLElement>(`.menu-row[data-value="${id}"] .menu-row-drill`)!.click();
    await new Promise((res) => setTimeout(res, 200));
    const box = (): HTMLInputElement => menu.querySelector<HTMLInputElement>('input[value="on"]')!;
    const chip = (): HTMLElement =>
      sr.querySelector<HTMLElement>(`.chips > .chip[data-id="${id}"]`)!;
    const snap = () => ({
      moreCurrent: more().getAttribute('data-status') === 'active',
      moreCount: more().getAttribute('data-badge'),
      chip: chip().hasAttribute('data-current'),
    });
    const start = snap();
    box().click();
    await new Promise((res) => setTimeout(res, 300));
    const ticked = snap();
    box().click();
    await new Promise((res) => setTimeout(res, 300));
    return { start, ticked, unticked: snap() };
  });

  // It reports whether a folded filter is on, so it follows the row.
  expect(r.start.moreCurrent).toBe(false);
  expect(r.ticked.moreCurrent).toBe(true);
  expect(r.unticked.moreCurrent).toBe(false);
  // The BADGE counts folded filters, not active ones, so it never moves.
  expect(r.ticked.moreCount).toBe(r.start.moreCount);
  expect(r.unticked.moreCount).toBe(r.start.moreCount);
  // …while the chip the row stands for does exactly what was asked of it.
  expect(r.start.chip).toBe(false);
  expect(r.ticked.chip).toBe(true);
  expect(r.unticked.chip).toBe(false);
});

/**
 * `data-group-field` is the GROUP chip's door — the twin of `data-sort-field`.
 *
 * `groupField` was readable and completely unwritable: no setter, no method, no
 * observed attribute. A saved view could restore a SORT and not a GROUPING,
 * which is the same hole that let a view move the data and leave the filter bar
 * blank, one field over. The parity sweep found it.
 *
 * Also guards the READ side. `groupField` used to read the menu's radio alone,
 * ignoring whether the chip was on, so a Group chip switched OFF still reported
 * the column it used to group by — and a host wiring that into a query kept
 * grouping by a chip the reader had just turned off.
 */
test('data-group-field sets the Group chip, and an off chip reports nothing', async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      organise(d: unknown): void;
      groupField: string | null;
    };
    const settled = () => (window as unknown as { __settled: () => Promise<void> }).__settled();

    // A host must hear NOTHING from a write it made itself. Wired before render,
    // the ordering that broke sort.
    const changes: unknown[] = [];
    el.addEventListener('quick-filter-change', (e) => changes.push((e as CustomEvent).detail));

    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([{ id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro' }] }]);
    el.organise({
      sort: [{ field: 'name', label: 'Name' }],
      group: [{ field: 'status', label: 'Status' }, { field: 'region', label: 'Region' }],
    });
    await settled();

    const chip = () => el.shadowRoot!.querySelector('.organise-chip[data-id="group"]')!;
    const ticked = () => [
      ...chip().querySelectorAll<HTMLInputElement>('sherpa-menu label input'),
    ].filter((i) => i.checked).map((i) => i.value);
    const face = () => (chip().shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim();

    const before = { on: chip().hasAttribute('data-current'), field: el.groupField };

    el.setAttribute('data-group-field', 'region');
    await settled();
    const set = {
      on: chip().hasAttribute('data-current'),
      field: el.groupField,
      ticked: ticked(),
      face: face(),
    };

    // Empty means UNGROUPED. Unlike a suspended sort the pick is suspended: a grid
    // is grouped or flat, so a remembered column would report a grouping that is
    // not running.
    el.setAttribute('data-group-field', '');
    await settled();
    const suspended = {
      on: chip().hasAttribute('data-current'),
      field: el.groupField,
      ticked: ticked(),
    };

    return { before, set, suspended, changes };
  });

  expect(r.before).toEqual({ on: false, field: null });

  // THE DOOR WORKS: the attribute ticks the radio and lights the chip.
  expect(r.set.on).toBe(true);
  expect(r.set.field).toBe('region');
  expect(r.set.ticked).toEqual(['region']);
  // And the chip NAMES it. A lit chip reading only "Group" says a grouping
  // exists without saying what it is.
  expect(r.set.face).toContain('Region');

  /* Off means SUSPENDED, not deleted. The chip stops reading active and
     `groupField` reports nothing — but the menu keeps its pick, so one click
     brings the same grouping back. A chip body cycles its states, and off is a
     state. T-a-chip-body-cycles-its-states. */
  expect(r.suspended).toEqual({ on: false, field: null, ticked: ['region'] });

  // No echo. The write came from outside; telling the outside what it just did
  // would bounce the value between a host wired both ways.
  expect(r.changes).toEqual([]);
});

/**
 * THE BAR MUST COME TO REST FITTING.
 *
 * Not "the fold looks right" — the measurable thing: after everything settles,
 * `scrollWidth` must not exceed `clientWidth`. A bar that rests overflowing is
 * clipping a chip nobody can see or reach.
 *
 * It did, about one run in four, and every "flaky fold" symptom traced here.
 * The cause was in `#onResize`: it DROPPED a resize that arrived while a frame
 * was already pending. On first layout the ResizeObserver fires twice — the bar
 * at an intermediate width, then at its real one — so the second was discarded
 * and the fold ran against a `clientWidth` of 92 where the truth was 48. Three
 * chips folded, the loop stopped, and 2px stayed clipped.
 *
 * Guarded HERE rather than left to the tests that tripped over it: those assert
 * a badge does not move, and would pass on a wrong-but-stable count. This
 * asserts the outcome the fold exists to produce.
 */
test('the bar comes to rest fitting, not overflowing', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // Narrow enough that chips MUST fold — the case the measuring exists for.
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'data', 'style': 'max-inline-size: 300px' });
    el.populate([
      { id: 'active', label: 'Active', type: 'data' },
      { id: 'trial', label: 'Trial', type: 'data' },
      { id: 'churned', label: 'Churned', type: 'data' },
      { id: 'plan', label: 'Plan', type: 'data', options: [{ value: 'pro', label: 'Pro' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    /* A PLAIN WAIT, deliberately — NOT a loop that waits for `data-folded` to
       stop changing.

       That loop is right for a test about something else, but it would hide the
       bug this one exists for: it keeps pumping frames until the fold settles,
       which gives a dropped resize a later frame to be corrected in. A reader
       does not pump frames. They look at the bar.

       400ms is far longer than the two reflows need; if the bar is still wrong
       here, it is wrong for good.

       This test caught a REAL one that way, one run in six under load — the
       chips had not stamped their own labels when the fold measured them.
       TRAP T-the-fold-measures-a-chip-that-has-not-drawn-itself */
    await new Promise((res) => setTimeout(res, 400));

    const chips = el.shadowRoot!.querySelector('.chips') as HTMLElement;
    return {
      folded: el.getAttribute('data-folded'),
      scroll: chips.scrollWidth,
      client: chips.clientWidth,
    };
  });

  // The same 1px of slack `#overflowing()` allows for sub-pixel rounding.
  expect(r.scroll, `rests overflowing: ${r.scroll} > ${r.client} (folded ${r.folded})`)
    .toBeLessThanOrEqual(r.client + 1);
  // And it really did fold — a bar that fits because nothing rendered proves
  // nothing about the measuring.
  expect(Number(r.folded)).toBeGreaterThan(0);
});

test('the Group chip BODY toggles grouping, and reports it', async ({ page }) => {
  /* TRAP T-group-chip-body-toggles-grouping.

     `#onChipClick` has a branch for Sort and had none for Group, and everything
     after it looks for `.chip` — which an `.organise-chip` is not. So a click
     on the body flipped the chip's own data-current off, made it LOOK
     ungrouped, and told nobody. */
  const r = await page.evaluate(async () => {
    const settled = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.organise({
      group: [{ field: 'team', label: 'Team' }, { field: 'plan', label: 'Plan' }],
      sort: [{ field: 'name', label: 'Name' }],
    });
    await settled();

    const sr = el.shadowRoot!;
    const chip = sr.querySelector<HTMLElement>('.organise-chip[data-id="group"]')!;
    const fired: Array<string | null> = [];
    el.addEventListener('group-change', (e) => {
      fired.push(((e as CustomEvent).detail as { field: string | null }).field);
    });

    // Pick a column from the menu — the only place a column is chosen.
    const radio = chip.querySelector<HTMLInputElement>('input[value="team"]')!;
    radio.click();
    await settled();
    await new Promise((res) => setTimeout(res, 150));
    const picked = { field: el.groupField, lit: chip.hasAttribute('data-current') };

    /* CLICK THE BODY — the element the chip actually listens on, inside its
       own shadow root. A click on the HOST reaches no listener. */
    const body = () => chip.shadowRoot!.querySelector<HTMLElement>('.body')!;
    body().click();
    await settled();
    await new Promise((res) => setTimeout(res, 150));
    const off = {
      field: el.groupField,
      lit: chip.hasAttribute('data-current'),
      // SUSPENDED, not cleared: the radio keeps the column.
      keptRadio: chip.querySelector<HTMLInputElement>('input[value="team"]')!.checked,
    };

    // Click again: the SAME grouping comes back, with no trip to the menu.
    body().click();
    await settled();
    await new Promise((res) => setTimeout(res, 150));
    const back = { field: el.groupField, lit: chip.hasAttribute('data-current') };

    return { picked, off, back, fired };
  });

  // Picking a column groups, and lights the chip.
  expect(r.picked).toEqual({ field: 'team', lit: true });

  /* The BODY cycles the chip's states, and OFF IS A STATE — not a delete. The
     grouping stops; the column is kept. T-a-chip-body-cycles-its-states. */
  expect(r.off).toEqual({ field: null, lit: false, keptRadio: true });

  // …so one more click restores it, without re-picking from the menu.
  expect(r.back).toEqual({ field: 'team', lit: true });

  // …and every change was REPORTED. The host owns the grouping.
  expect(r.fired).toContain('team');
  expect(r.fired).toContain(null);
});

/**
 * A PERSISTENT CHIP HAS ONE OWNER.
 *
 * "Always on, and its body does not flip it" is exactly what `data-locked`
 * means. Without it the chip flipped itself off and the toolbar wrote it back —
 * TWO writes for one click, the two-owner pattern the convention exists to
 * prevent. TRAP T-locked-chip-relays-and-nothing-else
 */
test('a persistent chip is LOCKED, so one click writes data-current once', async ({ page }) => {
  const box = await page.evaluate(async () => {
    const t = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    t.setAttribute('data-type', 'data');
    document.getElementById('root')!.replaceChildren(t);
    await t.rendered;
    // No `options`, so no menu — the chip CAN reach its own flip.
    t.populate([{ id: 'sel', label: 'Selector', type: 'data', persistent: true }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const chip = t.shadowRoot!.querySelector('.chip') as HTMLElement;
    const w = window as unknown as { __chip: HTMLElement; __writes: boolean[] };
    w.__chip = chip;
    w.__writes = [];
    new MutationObserver(() => w.__writes.push(chip.hasAttribute('data-current')))
      .observe(chip, { attributes: true, attributeFilter: ['data-current'] });
    const r = chip.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  // A REAL click. `.click()` on a shadow node does not reach the handler.
  await page.mouse.click(box.x, box.y);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __chip: HTMLElement; __writes: boolean[] };
    return {
      writes: w.__writes.length,
      locked: w.__chip.hasAttribute('data-locked'),
      current: w.__chip.hasAttribute('data-current'),
    };
  });

  expect(r.locked).toBe(true);
  // ZERO, not one: a locked chip reports the click and writes nothing.
  expect(r.writes).toBe(0);
  expect(r.current).toBe(true);
});

/**
 * The allow-list on the FIELDS axis. A context, a role or a fetch decides what
 * a reader may filter by, and the bar needs no branch for who is looking.
 * No list is the default, so a caller that never sets one sees no change.
 * TRAP T-an-allow-list-is-a-filter-not-an-order
 */
test('allowFields limits the chips AND the Add menu, and null restores both', async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate([
      { id: 'status', label: 'Status', active: true },
      { id: 'plan', label: 'Plan', active: true },
      { id: 'owner', label: 'Owner', active: true },
    ]);
    el.available([
      { id: 'seats', label: 'Seats', kind: 'number' },
      { id: 'spend', label: 'Spend', kind: 'number' },
    ]);
    const settle = async (): Promise<void> => {
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      await new Promise((res) => setTimeout(res, 200));
    };
    await settle();

    const chips = (): string[] =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('.chips > .chip')].map(
        (c) => c.dataset['id'] ?? '',
      );
    // The select-all row is not an offer, so it is dropped.
    const offers = (): string[] => {
      const m = el.shadowRoot!.querySelector('.add-btn sherpa-menu');
      return m
        ? [...m.querySelectorAll<HTMLInputElement>('input')]
            .map((i) => i.value)
            .filter((v) => v !== 'on')
        : [];
    };

    const before = { chips: chips(), offers: offers() };
    // Written BACKWARDS on purpose: the list says which, never in what order.
    el.allowFields(['seats', 'plan', 'status']);
    await settle();
    const limited = { chips: chips(), offers: offers() };
    el.allowFields(null);
    await settle();
    const restored = { chips: chips(), offers: offers() };
    return { before, limited, restored };
  });

  expect(r.before.chips).toEqual(['status', 'plan', 'owner']);
  expect(r.before.offers).toEqual(['seats', 'spend']);

  // `owner` is gone from the bar; `spend` is gone from Add. Order is the BAR's.
  expect(r.limited.chips).toEqual(['status', 'plan']);
  expect(r.limited.offers).toEqual(['seats']);

  // No list allows everything — the default cannot mean "nothing".
  expect(r.restored.chips).toEqual(['status', 'plan', 'owner']);
  expect(r.restored.offers).toEqual(['seats', 'spend']);
});

/**
 * The Filters button is a DOOR to filters, not a filter: it reads ON only while
 * a chip folded into it is. TRAP T-the-filters-button-is-a-door-not-a-filter
 */
test('the Filters button is active only when a folded filter is', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // Narrow, so everything but the first chip folds.
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'data', 'style': 'max-inline-size: 300px' });
    el.populate([
      { id: 'active', label: 'Active', type: 'data' },
      { id: 'trial', label: 'Trial', type: 'data' },
      { id: 'churned', label: 'Churned', type: 'data' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    for (let i = 0; i < 25 && !sr.querySelector('.add-btn sherpa-menu .menu-row[data-drill]'); i++) {
      await new Promise((res) => setTimeout(res, 100));
    }
    // Wait for the fold to SETTLE — the ResizeObserver fires more than once.
    let last = '';
    for (let i = 0; i < 25; i++) {
      const now = el.getAttribute('data-folded') ?? '';
      if (now && now === last) break;
      last = now;
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      await new Promise((res) => setTimeout(res, 40));
    }

    const more = sr.querySelector('.add-btn') as HTMLElement;
    const menu = sr.querySelector('.add-btn sherpa-menu') as (HTMLElement & { show(t: HTMLElement): void }) | null;
    if (!more || !menu) return { err: 'no Filters menu' };

    const settled = async (): Promise<void> => {
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      await new Promise((res) => setTimeout(res, 60));
    };
    const state = (): { more: boolean; activeFolded: string[] } => ({
      more: more.getAttribute('data-status') === 'active',
      activeFolded: [...sr.querySelectorAll<HTMLElement>('.chips > .chip[data-folded-away]')]
        .filter((c) => c.hasAttribute('data-current'))
        .map((c) => c.dataset['id'] ?? ''),
    });

    const closed = state();

    // Turn ONE folded chip on — its caret opens "On".
    menu.show(more);
    await settled();
    menu.querySelector<HTMLElement>('.menu-row[data-drill] .menu-row-drill')?.click();
    await settled();
    const box = menu.querySelector<HTMLInputElement>('input[value="on"]');
    if (!box) return { err: 'no On row' };
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settled();
    const oneOn = state();

    // And back off again.
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settled();
    const backOff = state();

    return { closed, oneOn, backOff };
  });

  expect(r.err).toBeUndefined();
  // NOTHING active behind it — More must not claim a filter is applied.
  expect(r.closed!.activeFolded).toEqual([]);
  expect(r.closed!.more).toBe(false);

  // One folded filter on — now it says so.
  expect(r.oneOn!.activeFolded.length).toBeGreaterThan(0);
  expect(r.oneOn!.more).toBe(true);

  // Off again, and it goes back. "Off" is a state, not a one-way door.
  expect(r.backOff!.activeFolded).toEqual([]);
  expect(r.backOff!.more).toBe(false);
});

/**
 * A chip with no `options` is a TOGGLE — right for "At risk", wrong for a text
 * column nobody ticks. `custom: true` names a field and answers it by
 * TYPING, so it needs a menu; it was falling through to the toggle branch and
 * getting none, which is why a 240-value column could not be filtered at all.
 *
 * TRAP T-a-condition-only-field-still-has-a-menu
 */
test('an ADVANCED field with no options gets a menu, not a toggle', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate([
      // No options, no kind — only the opt-in to conditions.
      { id: 'email', label: 'Email', custom: true },
      // The control: a real toggle, which must stay one.
      { id: 'at-risk', label: 'At risk' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const look = (id: string) => {
      const chip = el.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
      const menu = chip.querySelector('sherpa-menu');
      return {
        menu: !!menu,
        // A filter menu is what carries the two modes.
        type: menu?.getAttribute('data-type') ?? null,
      };
    };
    return { email: look('email'), toggle: look('at-risk') };
  });

  expect(r.email.menu).toBe(true);
  expect(r.email.type).toBe('filter');
  // And a chip that names no field is still a plain toggle.
  expect(r.toggle.menu).toBe(false);
});

/**
 * The Filters menu drills into a folded filter by MOVING its menu's rows. A
 * conditions-only menu has none — its answer is the condition rows in its own
 * shadow DOM — so drilling showed a blank card, the filter could never be
 * answered, never went active, and never filtered.
 *
 * TRAP T-a-conditions-only-menu-cannot-be-drilled
 */
test('a FOLDED advanced-only filter opens its own menu, not a blank drill', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // NARROW, so the filters fold into the Filters menu.
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'style': 'max-inline-size: 260px' });
    el.populate([
      { id: 'status', label: 'Status', select: 'multiple',
        options: [{ value: 'a', label: 'a' }, { value: 'b', label: 'b' }] },
      { id: 'email', label: 'Email', custom: 'only', op: 'contains' },
    ]);
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();
    for (let i = 0; i < 20 && !el.getAttribute('data-folded'); i++) {
      await new Promise((res) => setTimeout(res, 80));
    }

    const sr = el.shadowRoot!;
    const overflow = sr.querySelector<HTMLElement>('.add-btn')!;
    const row = overflow.querySelector<HTMLElement>('.menu-row[data-drill][data-value="email"]');
    const menu = sr.querySelector('.chip[data-id="email"] sherpa-menu') as
      (HTMLElement & { shadowRoot: ShadowRoot }) | null;
    if (!row || !menu) return { folded: el.getAttribute('data-folded'), row: !!row, menu: !!menu };

    (overflow.querySelector('sherpa-menu') as HTMLElement & { show(t: HTMLElement): void }).show(overflow);
    await settle();
    row.querySelector<HTMLElement>('.menu-row-drill')!.click();
    await settle();
    // Wait for the menu to OPEN, not for a fixed time — a busy machine is slower.
    for (let f = 0; f < 60 && !menu.hasAttribute('open'); f++) {
      await new Promise((res) => requestAnimationFrame(res));
    }

    const overflowMenu = overflow.querySelector('sherpa-menu')!;
    return {
      // Its OWN menu opened, in Advanced mode...
      opened: menu.hasAttribute('open'),
      mode: menu.getAttribute('data-mode'),
      // ...with a condition row a reader can actually type into.
      hasConditionRow: !!menu.shadowRoot.querySelector('.condition-row'),
      // ...and the Filters menu was NOT filled with its (empty) light DOM.
      overflowStillListsFilters: overflowMenu.querySelectorAll('.menu-row[data-drill]').length > 0,
    };
  });

  expect(r.opened).toBe(true);
  expect(r.mode).toBe('advanced');
  expect(r.hasConditionRow).toBe(true);
  expect(r.overflowStillListsFilters).toBe(true);
});

/**
 * A RE-FOLD THAT MOVES NOTHING KEEPS THE OPEN MENU — TODO 114. Every resize
 * shut the Filters menu and built a new one, so a menu opened just before a
 * late re-fold was thrown away. A real change still rebuilds it.
 * TRAP T-a-reflow-that-moves-nothing-keeps-its-menus
 */
test('a resize that folds nothing new keeps the open Filters menu; a real unfold rebuilds it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'style': 'max-inline-size: 260px' });
    el.populate([
      { id: 'status', label: 'Status', select: 'multiple', options: [{ value: 'a', label: 'a' }] },
      { id: 'email', label: 'Email', custom: 'only', op: 'contains' },
    ]);
    await window.__settled();
    for (let i = 0; i < 20 && !el.getAttribute('data-folded'); i++) await new Promise((res) => setTimeout(res, 80));
    const frames = async (n: number): Promise<void> => {
      for (let f = 0; f < n; f++) await new Promise((res) => requestAnimationFrame(res));
    };
    await frames(6);
    const add = el.shadowRoot!.querySelector<HTMLElement>('.add-btn')!;
    const menu = add.querySelector('sherpa-menu') as HTMLElement & { open: boolean; show(t: HTMLElement): void };
    menu.show(add);
    await window.__settled();
    const folded = el.getAttribute('data-folded');
    // One pixel wider: the bar resizes, the fold does not change.
    el.style.maxInlineSize = '261px';
    await frames(6);
    const kept = { same: add.querySelector('sherpa-menu') === menu, open: menu.open, folded: el.getAttribute('data-folded') };
    el.style.maxInlineSize = '1000px';
    await frames(6);
    return { folded, kept, unfolded: { same: add.querySelector('sherpa-menu') === menu, folded: el.getAttribute('data-folded') } };
  });
  expect(r.folded).toBe('1');
  expect(r.kept).toEqual({ same: true, open: true, folded: '1' });
  expect(r.unfolded).toEqual({ same: false, folded: null });
});

/**
 * THE ADD MENU IS THE WHOLE LIST — on the bar, as it already was in the panel.
 *
 * It listed only what was LEFT to add, so a tick added a chip and nothing took
 * one off, and the menu said nothing about what the bar was already holding.
 * Will: "Add filter button, in the toolbar, doesn't have the add and remove
 * capability. Menu item selection state should indicate whether the filter is
 * added or removed from the chip row."
 *
 * TRAP T-the-add-menu-is-the-whole-list
 */
test('the Add menu lists held AND offered, and an untick removes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'style': 'inline-size: 1400px' });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();

    el.populate([
      { id: 'status', label: 'Status', removable: true,
        options: [{ value: 'a', label: 'a' }] },
      // NOT removable — a tick that cannot be cleared is a lie, so it is not listed.
      { id: 'view', label: 'View', persistent: true },
    ]);
    el.available([{ id: 'seats', label: 'Seats' }]);
    await settle();

    const menu = () => el.shadowRoot!.querySelector('.add-btn sherpa-menu')!;
    const rows = () => [...menu().children]
      .map((r) => r.querySelector<HTMLInputElement>('input'))
      .filter((i): i is HTMLInputElement => !!i && i.value !== 'on')
      .map((i) => (i.checked ? '+' : '-') + i.value);

    const before = rows();

    // Untick the held one, tick the offered one, apply.
    menu().dispatchEvent(new CustomEvent('menu-change', {
      bubbles: true, composed: true, detail: { values: ['seats'] },
    }));
    await settle();
    await new Promise((res) => setTimeout(res, 120));

    return { before, after: rows(), held: el.heldFields };
  });

  // HELD is ticked, OFFERED is not, and a fixed chip is absent entirely.
  expect(r.before).toEqual(['+status', '-seats']);
  // The untick removed Status; the tick added Seats.
  expect(r.held).toContain('seats');
  expect(r.held).not.toContain('status');
  // And the menu re-reads as the whole list, the other way round.
  expect(r.after.sort()).toEqual(['+seats', '-status']);
});

/**
 * A SILENT STEER STILL REDRAWS ITS CHIP. The panel's Apply sets a chip's rows
 * with `setChipReading`, which fires no menu event — so the chip filtered the
 * rows and kept an empty value and a stale tip. It is told to `refresh()`.
 * TRAP T-a-silent-steer-still-redraws-its-chip
 */
test('a chip steered with conditions redraws its value and tip', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', custom: true,
        options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }] },
      { id: 'email', label: 'Email', custom: 'only', op: 'contains' },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const steer = el as Bar & { setChipReading(id: string, r: unknown): void };
    steer.setChipReading('owner', { picked: [], conditions: [
      { op: 'contains', text: 'Da' }, { op: 'startswith', text: 'R', join: 'or' }] });
    steer.setChipReading('email', { picked: [], conditions: [{ op: 'contains', text: 'zz' }] });
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() =>
      requestAnimationFrame(res))));
    const face = (id: string) => {
      const c = el.shadowRoot!.querySelector<HTMLElement & { valueLabel: string }>(`.chip[data-id="${id}"]`)!;
      return { on: c.hasAttribute('data-current'), condition: c.getAttribute('data-condition'),
        value: c.valueLabel, tip: c.shadowRoot!.querySelector<HTMLElement>('.count-wrap')?.dataset['text'] };
    };
    return { owner: face('owner'), email: face('email') };
  });
  // The VALUES, not the condition labels. Will, TODO 139.
  expect(r.owner).toEqual({ on: true, condition: 'advanced',
    value: 'Da, R', tip: '2 conditions applied' });
  expect(r.email).toEqual({ on: true, condition: 'advanced', value: 'zz', tip: '1 condition applied' });
});

/**
 * ADDING A FILTER KEEPS EVERY ANSWER ALREADY ON THE BAR. Adding a field
 * rebuilds the bar, and a rebuilt condition row reads empty for a tick — the
 * report in that gap said Owner had no answer, so adding Email reset Owner.
 * Will, 2026-09-26. TRAP T-a-rebuilt-row-reads-empty-for-a-tick
 */
test('adding a second Advanced filter keeps the first one\'s rows in every report', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', custom: true,
        options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }] },
    ], { style: 'inline-size: 1200px' });
    el.available([{ id: 'email', label: 'Email', custom: 'only', op: 'contains' }]);
    await window.__settled();
    const bar = el as Bar & { setChipReading(id: string, r: unknown): void;
      readings: Record<string, { conditions?: unknown[] }> };
    bar.setChipReading('owner', { picked: [], conditions: [{ op: 'contains', text: 'Da' }] });
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const heard: unknown[] = [];
    el.addEventListener('quick-filter-change', () => heard.push(bar.readings['owner']?.conditions ?? null));
    bar.addFilters(['email']);
    for (let i = 0; i < 6; i++) await new Promise((res) => requestAnimationFrame(res));
    await window.__settled();
    const chip = el.shadowRoot!.querySelector('.chip[data-id="owner"]')!;
    return { heard, on: chip.hasAttribute('data-current'), now: bar.readings['owner']?.conditions };
  });
  expect(r.heard.length).toBeGreaterThan(0);
  for (const h of r.heard) expect(h).toEqual([{ op: 'contains', text: 'Da' }]);
  expect(r.on).toBe(true);
  expect(r.now).toEqual([{ op: 'contains', text: 'Da' }]);
});

/**
 * Will, TODO 167: "Resetting filters in a component scope clears the elevated
 * to view scope state, and inactive styling, from filter chips." A chip the
 * VIEW holds is not this bar's to reset.
 * TRAP T-a-superseded-chip-suspends-it-is-never-removed
 */
test('a Reset leaves a chip the View holds as it is, and empties the rest', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type Steer = Bar & { supersede(ids: string[], at?: string): void; clearAll(): void };
    const bar = await window.__mount<Steer>('sherpa-quick-filter-toolbar', [
      { id: 'status', label: 'Status', active: true, options: [
        { value: 'active', label: 'active', selected: true }, { value: 'trial', label: 'trial' }] },
      { id: 'plan', label: 'Plan', active: true, options: [
        { value: 'Pro', label: 'Pro', selected: true }, { value: 'Free', label: 'Free' }] },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    bar.supersede(['status'], 'View filters');
    await window.__settled();
    const look = (id: string) => {
      const chip = bar.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
      return {
        held: chip.hasAttribute('data-superseded'), at: chip.getAttribute('data-applied-at'),
        on: chip.hasAttribute('data-current'),
        value: chip.shadowRoot!.querySelector('.caret-label')!.textContent,
        tip: chip.shadowRoot!.querySelector<HTMLElement>('.count-wrap')!.dataset['text'],
        ticked: [...chip.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value),
      };
    };
    const before = look('status');
    bar.clearAll();
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    return { before, status: look('status'), plan: look('plan') };
  });
  expect(r.before).toMatchObject({ held: true, on: true, value: 'active' });
  // Nothing of it moved: its look, its place with the View, the picks it keeps.
  expect(r.status).toEqual(r.before);
  expect(r.status.tip).toBe('Filter moved to View scope. This chip holds active.');
  expect(r.plan).toMatchObject({ held: false, on: false, value: '', ticked: [] });
});
