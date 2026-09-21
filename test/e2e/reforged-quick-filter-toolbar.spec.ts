import { test, expect } from './harness';

/** sherpa-quick-filter-toolbar — chips from populate(); toggling emits the active set (composedPath). */


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
      picked: el.pickedValues,
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
        add: shown('.add-btn'),
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

  // Both types carry the shared run: Add · AI · undo · configure · | · refresh.
  for (const t of [r.data, r.view]) {
    expect(t.add).toBe(true);
    expect(t.ai).toBe(true);
    expect(t.clear).toBe(true);
    expect(t.configure).toBe(true);
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
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    };
    for (const a of ['ai', 'configure', 'refresh', 'overflow', 'save', 'view-menu']) await press(a);

    // ADD is deliberately absent from this list. It is a single button now, and
    // clicking it OPENS THE MENU rather than announcing anything — `filter-add`
    // fires when the menu commits, which its own test covers.
    const add = el.shadowRoot!.querySelector('.add-btn') as HTMLElement;
    return { seen, addIsButton: add.localName, addExpanded: add.getAttribute('aria-expanded') };
  }, MOUNT);

  expect(r.seen).toEqual([
    'ai-filter-request', 'filter-configure', 'data-refresh', 'filter-overflow',
    'view-save', 'view-menu-open',
  ]);
  // A plain button, announcing itself as a menu trigger.
  expect(r.addIsButton).toBe('sherpa-button');
  expect(r.addExpanded).toBe('false');
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
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
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

test('a favourited star takes the ACTIVE Style mode, face ring and ink', async ({ page }) => {
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = await mountToolbar('view');
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
  }, MOUNT);

  // Each resolved to a real colour, so the assertions below mean something — an
  // EMPTY value (the properties never reaching the button) is exactly the bug
  // this test exists for, and would otherwise pass silently.
  expect(r.expected.surface).toMatch(/^#[0-9a-f]{6}$/i);
  expect(r.expected.border).toMatch(/^#[0-9a-f]{6}$/i);
  expect(r.expected.text).toMatch(/^#[0-9a-f]{6}$/i);

  // ACTIVE is a Style MODE in the design, not an invented colour: the Style
  // collection's `active` mode re-points style-surface/base → surface/active/base,
  // style-border/base → border/active/+2 and style-content/base → content/active/+1.
  // The star takes all three, not just tinted ink.
  expect(r.on.status).toBe('active');

  // The three PAINT differently from the default look. Asserted as "changed",
  // not against fixed triples: the exact rgb depends on the browser's own
  // rounding of the token hex (it paints #F2DFFF as 242,224,255, where the
  // arithmetic is 223), which is not what this test is about.
  expect(r.on.bg).not.toBe(r.off.bg);
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
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = (await mountToolbar('view')) as HTMLElement & {
      populate?: (d: unknown) => void;
      values: Record<string, string[]>;
    };
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
  }, MOUNT);

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
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = (await mountToolbar()) as HTMLElement & {
      populate?: (d: unknown) => void;
      available?: (d: unknown) => void;
      active?: string[];
    };
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
    const offered = () =>
      [...add.querySelectorAll('label:not(.qf-all) input')].map((i) => (i as HTMLInputElement).value);

    const before = { chips: chips(), offered: offered() };

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
    };
  }, MOUNT);

  expect(r.before.chips).toEqual(['active']);
  expect(r.before.offered).toEqual(['health', 'seats']);

  // The picked filter MOVES: onto the bar, and out of the menu — a filter already
  // on the bar is not one you can add again.
  expect(r.after.chips).toEqual(['active', 'health']);
  expect(r.after.offered).toEqual(['seats']);

  // It arrives ON, so the reason you added it is visible immediately.
  expect(r.addedIsOn).toBe(true);
});

test('the Add menu is multi-select and searchable; a chip can be removed', async ({ page }) => {
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = (await mountToolbar()) as HTMLElement & {
      populate?: (d: unknown) => void;
      available?: (d: unknown) => void;
    };
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
    const offered = () =>
      [...add.querySelectorAll('label:not(.qf-all) input')].map((i) => (i as HTMLInputElement).value);
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

    // Add TWO in one visit — the point of multi-select.
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
    const removeLabel = removeBtn.getAttribute('aria-label');
    removeBtn.click();
    await new Promise((res) => setTimeout(res, 200));

    return { menuShape, afterAdd, removeLabel, afterRemove: { chips: chips(), offered: offered() } };
  }, MOUNT);

  // MULTI-select: checkbox rows, and a search for a long field list.
  expect(r.menuShape.select).toBe('multiple');
  expect(r.menuShape.inputType).toBe('checkbox');
  expect(r.menuShape.addSearch).toBe(true);
  expect(r.menuShape.chipSearch).toBe(true);

  // Two added in ONE visit, both gone from the menu.
  expect(r.afterAdd.chips).toEqual(['plan', 'health', 'seats']);
  expect(r.afterAdd.offered).toEqual(['tickets']);

  // REMOVE puts it back where it came from: a user who removes a chip by mistake
  // should find it where they got it. Its picks are dropped — "remove" means
  // remove, not "hide and remember".
  expect(r.removeLabel).toBe('Remove');
  expect(r.afterRemove.chips).toEqual(['plan', 'seats']);
  expect(r.afterRemove.offered).toEqual(['tickets', 'health']);
});

test('adding or removing a filter never disturbs the others', async ({ page }) => {
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = (await mountToolbar()) as HTMLElement & {
      populate?: (d: unknown) => void;
      available?: (d: unknown) => void;
      values?: Record<string, string[]>;
    };
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

    // ADD one…
    const add = sr.querySelector('.add-btn')!;
    (add.querySelector('input') as HTMLInputElement).click();
    await apply(add);
    const afterAdd = snap();

    // …and REMOVE a different one.
    const regionMenu = sr.querySelector('.chip[data-id="region"] sherpa-menu')!;
    await (regionMenu as unknown as { rendered: Promise<void> }).rendered;
    (regionMenu.shadowRoot!.querySelector('.remove') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 200));
    const afterRemove = snap();

    return { before, afterAdd, afterRemove };
  }, MOUNT);

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
  const r = await page.evaluate(async (mount) => {
    // eslint-disable-next-line no-new-func
    const mountToolbar = new Function(`${mount}; return mountToolbar;`)() as (t?: string) => Promise<HTMLElement>;
    const el = (await mountToolbar()) as HTMLElement & {
      populate?: (d: unknown) => void;
      values?: Record<string, string[]>;
    };
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
    const cal = menu.querySelector('sherpa-calendar') as HTMLElement & {
      rendered?: Promise<void>;
      shadowRoot: ShadowRoot;
    };
    // BOTH, not just the calendar. This awaited only the calendar and then read
    // getComputedStyle off the MENU's own shadow root — which under parallel
    // load had not rendered yet, so `display` came back as "" rather than
    // "none". It passed alone and failed in a full run, which is the shape of
    // every flake: the thing being measured was never waited for.
    await menu.rendered;
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
  }, MOUNT);

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
      const bar = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
        rendered?: Promise<void>;
        populate: (d: unknown) => void;
      };
      root.appendChild(bar);
      await bar.rendered;
      bar.populate([
        { id: 'view', label: 'View', persistent: true, active: true, select: 'single',
          ...(icon ? { icon } : {}),
          options: [{ value: 'all', label: 'All', selected: true }] },
        // A normal chip beside it still takes the icon it was given.
        { id: 'plan', label: 'Plan', icon: 'fa-solid fa-tag', options: [{ value: 'pro', label: 'Pro' }] },
      ]);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const chips = [...bar.shadowRoot!.querySelectorAll('sherpa-quick-filter')];
      return chips.map((c) => c.getAttribute('data-icon-start'));
    };
    return {
      // An app passing its own page icon must NOT override the view glyph…
      overridden: await read('fa-solid fa-gauge-high'),
      // …and passing none gets it anyway.
      absent: await read(),
    };
  });

  for (const pair of [got.overridden, got.absent]) {
    expect(pair[0]).toBe('fa-solid fa-desktop');
    // The neighbouring chip is untouched.
    expect(pair[1]).toBe('fa-solid fa-tag');
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
      const bar = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
        rendered?: Promise<void>;
        populate: (d: unknown) => void;
        values: Record<string, string[]>;
      };
      root.appendChild(bar);
      await bar.rendered;
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
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      pickedValues: Record<string, string[]>;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { id: 'spend', label: 'Spend', kind: 'number', min: 0, max: 1000, step: 10, active: true },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const menu = el.shadowRoot!.querySelector('.chip[data-id="spend"] sherpa-menu')!;
    const shown = (sel: string): boolean => {
      const node = menu.querySelector(sel);
      return !!node && getComputedStyle(node).display !== 'none';
    };
    const slider = menu.querySelector<HTMLElement & { range: [number, number] }>('sherpa-slider')!;
    const field = menu.querySelector<HTMLInputElement>('.qf-number-one')!;
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();

    const flip = async (): Promise<void> => {
      const sw = menu.querySelector('.qf-range-switch') as HTMLElement & {
        rendered?: Promise<void>;
        shadowRoot: ShadowRoot;
      };
      await sw.rendered;
      sw.shadowRoot.querySelector<HTMLInputElement>('.input')!.click();
      await settle();
    };

    const snap = (): Record<string, unknown> => ({
      ranged: menu.hasAttribute('data-range'),
      field: shown('.qf-number-one'),
      slider: shown('sherpa-slider'),
      picks: el.pickedValues['spend'] ?? null,
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

  // Opens SINGLE: the simpler question, and the one a reader can answer without
  // deciding on two numbers first.
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
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
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
    const row = menu.querySelector('.qf-range-row')!.getBoundingClientRect();
    const rows = menu.shadowRoot.querySelector('.rows')!.getBoundingClientRect();
    const calBox = cal.getBoundingClientRect();

    const flip = async (): Promise<void> => {
      const sw = menu.querySelector('.qf-range-switch') as HTMLElement & {
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
 * there would filter to a span the user has not named yet. The Range switch
 * moves the menu between auto-apply and Apply/Cancel at runtime.
 */
test('the Range switch brings Apply/Cancel, and leads its own label', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (def: unknown, id: string): Promise<Record<string, unknown>> => {
      const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
        rendered?: Promise<void>;
        populate(d: unknown): void;
      };
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
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
      const row = menu.querySelector('.qf-range-row')!;
      const sw = row.querySelector('sherpa-switch') as HTMLElement & {
        rendered?: Promise<void>;
        shadowRoot: ShadowRoot;
      };
      await sw.rendered;

      // The CONTROL leads and the label follows, exactly where a value row puts
      // its checkbox and its text — so every control shares one left edge.
      const leads =
        sw.getBoundingClientRect().left < row.querySelector('.qf-row-label')!.getBoundingClientRect().left;

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
      number: await read({ id: 'spend', label: 'Spend', kind: 'number', min: 0, max: 100, active: true }, 'spend'),
      date: await read({ id: 'created', label: 'Created', kind: 'date', active: true }, 'created'),
      // A chip whose DEFINITION named `commit` keeps what it asked for — the
      // switch supplies the default a host left out, it does not overrule one.
      pinned: await read(
        { id: 'pinned', label: 'Pinned', kind: 'number', min: 0, max: 100, commit: false, active: true },
        'pinned',
      ),
    };
  });

  for (const kind of ['number', 'date'] as const) {
    expect(r[kind].leads, `${kind}: switch leads its label`).toBe(true);
    // SINGLE applies on the tick: one value is the whole answer.
    expect(r[kind].single, `${kind} single`).toEqual({ commits: false, apply: false, cancel: false });
    // RANGE defers: a span is not named until both ends are.
    expect(r[kind].ranged, `${kind} ranged`).toEqual({ commits: true, apply: true, cancel: true });
    expect(r[kind].back, `${kind} back`).toEqual({ commits: false, apply: false });
  }

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
        overflowChip: shown('.overflow-chip'),
        ellipsis: shown('.act[data-act="overflow"]'),
        // Add survives every fold: putting a filter ON the bar is the one action
        // a collapsed bar still needs.
        add: shown('.act[data-act="add"]'),
      };
    };

    return { wide: await at(1400), mid: await at(900), narrow: await at(620) };
  });

  // WIDE: nothing folded, and the ⋮ is absent — an empty overflow button is one
  // that opens nothing.
  expect(r.wide.collapse).toBeNull();
  expect(r.wide.folded).toBeNull();
  expect(r.wide.ellipsis).toBe(false);
  expect(r.wide.overflowChip).toBe(false);
  expect(r.wide.rows).toBe(1);

  // MID: the ACTIONS have folded and the ⋮ has appeared to hold them.
  expect(r.mid.collapse).not.toBeNull();
  expect(r.mid.ellipsis).toBe(true);
  expect(r.mid.rows).toBe(1);

  // NARROW: chips fold too, and the overflow chip appears to hold them.
  expect(Number(r.narrow.folded)).toBeGreaterThan(0);
  expect(r.narrow.overflowChip).toBe(true);
  expect(Number(r.narrow.chipsOnBar)).toBeLessThan(Number(r.mid.chipsOnBar));
  expect(r.narrow.rows).toBe(1);

  // Add is still there at every width.
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
test('the overflow menu drills into a folded filter and back out', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      pickedValues: Record<string, string[]>;
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
    const chip = sr.querySelector('.overflow-chip') as HTMLElement & { rendered?: Promise<void> };
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
      // The rows ARE the folded filters, or ARE that filter's values.
      firstRow: menu.firstElementChild?.className ?? menu.firstElementChild?.tagName,
      trail: getComputedStyle(menu.shadowRoot.querySelector('.drill-trail')!).display !== 'none',
      open: getComputedStyle(menu.shadowRoot.querySelector('.menu')!).display !== 'none',
    });

    const rows = [...chip.querySelectorAll('.qf-folded')] as HTMLElement[];
    const list = {
      ...snap(),
      // The badge counts the FOLDED FILTERS — "three are in here" is what a
      // reader needs before opening it.
      badge: chip.dataset['count'],
      rowCount: rows.length,
      // Composed components, not hand-rolled markup.
      rowTag: rows[0]?.tagName,
    };

    const target = rows[0]!.dataset['for']!;
    rows[0]!.click();
    await settle();
    const drilled = snap();

    // A value ticked while drilled is reported LIVE — the rows are moved, not
    // copied, so this is where the filter's one set of inputs currently lives.
    const box1 = menu.querySelector<HTMLInputElement>('label:not(.qf-all) input')!;
    box1.checked = true;
    box1.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const ticked = el.pickedValues[target] ?? null;

    // BACK, through the arrow. It lives in the MENU's own shadow root, so its
    // click is re-emitted as a composed `menu-back` to reach the toolbar.
    const back = menu.shadowRoot.querySelector('.drill-back') as HTMLElement & {
      rendered?: Promise<void>;
    };
    await back.rendered;
    back.click();
    await settle();
    const out = snap();

    return { list, drilled, ticked, target, out, kept: el.pickedValues[target] ?? null };
  });

  // The overflow list: composed list items, one per folded filter.
  expect(r.list.drill).toBe(false);
  expect(r.list.heading).toBe('More filters');
  expect(r.list.rowTag).toBe('SHERPA-LIST-ITEM');
  expect(Number(r.list.badge)).toBe(r.list.rowCount);
  expect(r.list.trail).toBe(false);

  // DRILLED: the filter's own rows, its name, and the way out.
  expect(r.drilled.drill).toBe(true);
  expect(r.drilled.trail).toBe(true);
  expect(r.drilled.open).toBe(true);
  expect(r.drilled.firstRow).not.toBe('qf-folded');

  // A pick made while drilled is live, and survives coming back out.
  expect(r.ticked).toEqual(['a']);
  expect(r.kept).toEqual(['a']);

  // BACK: the list is restored and the menu stays open.
  expect(r.out.drill).toBe(false);
  expect(r.out.heading).toBe('More filters');
  expect(r.out.firstRow).toBe('qf-folded');
  expect(r.out.open).toBe(true);
});

/**
 * A DATE chip's value reads IN FULL — "03 Sep - 15 Sep, 2026".
 *
 * Every part of it carries meaning, and unlike a value list there is no count
 * that could stand in for a truncated end: "2" says nothing about which two
 * days. So it is not clipped and it wears no badge.
 */
test('a DATE chip names its whole range, day first, without truncating', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
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
  expect(r.sameYear.text).toBe('03 Sep - 15 Sep, 2026');

  // The YEAR is stated once when both ends share it. A range crossing new year
  // states it on each end, because "18 Dec - 03 Jan, 2027" would put the wrong
  // year on the first day.
  expect(r.crossYear.text).toBe('18 Dec, 2026 - 03 Jan, 2027');

  // One day is one date, with its year.
  expect(r.single.text).toBe('15 Sep, 2026');

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
        pickedValues: Record<string, string[]>;
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
      const before = el.pickedValues['region'] ?? [];

      // …and the caller populates again, as a view change does.
      el.populate(set('Region'));
      await settle();
      return { before, after: el.pickedValues['region'] ?? [] };
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
 * A BOOLEAN filter folded into the overflow is a TICKABLE row, not a drill row.
 *
 * A chip with no `options` is on or off — there is nothing inside it to open.
 * It used to get the same drill row every other folded filter does, so it wore
 * a chevron, read as a parent, and did NOTHING when clicked: the drill handler
 * needs the chip's own menu, and a boolean chip has none.
 */
test('a folded BOOLEAN filter ticks in place; one with options still drills', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(defs: unknown): void;
    };
    el.setAttribute('data-type', 'data');
    // Narrow, so everything but the first chip folds.
    el.style.cssText = 'max-inline-size: 300px';
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { id: 'active', label: 'Active', type: 'data' },
      { id: 'trial', label: 'Trial', type: 'data' },
      { id: 'churned', label: 'Churned', type: 'data' },
      { id: 'plan', label: 'Plan', type: 'data',
        options: [{ value: 'pro', label: 'Pro' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const sr = el.shadowRoot!;
    for (let i = 0; i < 25 && !sr.querySelector('.overflow-chip sherpa-menu .qf-toggle'); i++) {
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
    const menu = sr.querySelector('.overflow-chip sherpa-menu');
    if (!menu) return { err: 'no overflow menu' };

    const toggles = [...menu.querySelectorAll<HTMLElement>('.qf-toggle')]
      .map((t) => t.dataset['for']);
    const drills = [...menu.querySelectorAll<HTMLElement>('.qf-folded')]
      .map((d) => d.dataset['for']);

    // Ticking the row must flip the CHIP it stands for, and report it.
    const seen: unknown[] = [];
    el.addEventListener('quick-filter-change', (e) => seen.push((e as CustomEvent).detail));
    const row = menu.querySelector<HTMLElement>('.qf-toggle')!;
    const box = row.querySelector<HTMLInputElement>('input')!;
    const chip = sr.querySelector<HTMLElement>(
      `.chips > .chip[data-id="${row.dataset['for']}"]`,
    )!;
    box.click();
    await new Promise((res) => setTimeout(res, 200));
    const on = { box: box.checked, chip: chip.hasAttribute('data-current') };
    box.click();
    await new Promise((res) => setTimeout(res, 200));
    const off = { box: box.checked, chip: chip.hasAttribute('data-current') };
    return { toggles, drills, on, off, seen, id: row.dataset['for'] };
  });

  // Which chips fold depends on the measured width, so the test does not name
  // them — what matters is that EVERY folded boolean ticks and the one with
  // options drills, whichever of them ended up in the menu.
  expect(r.toggles!.length).toBeGreaterThan(0);
  expect(r.drills).toEqual(['plan']);
  // Neither list may hold the other's rows.
  expect(r.toggles).not.toContain('plan');

  // The tick drives the CHIP, so the bar and the menu can never disagree.
  expect(r.on).toEqual({ box: true, chip: true });
  expect(r.off).toEqual({ box: false, chip: false });
  // …and it reports, so a host hears a folded toggle exactly as it hears a
  // toggle on the bar.
  expect(r.seen).toContainEqual(
    expect.objectContaining({ id: r.id, active: true, source: 'overflow' }),
  );
});

/**
 * Ticking a folded boolean must not re-point the MORE chip.
 *
 * "More" is CHROME, not a filter: it stands for "these filters are folded in
 * here", its badge counts FOLDED FILTERS, and the rows in its menu belong to
 * other chips. A chip normally derives `data-current` and `data-count` from its
 * own menu — so without `data-locked` the first tick turned More OFF and wiped
 * its badge.
 */
test('a locked chip keeps its own state when its menu changes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate(defs: unknown): void;
    };
    el.setAttribute('data-type', 'data');
    el.style.cssText = 'max-inline-size: 300px';
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { id: 'active', label: 'Active', type: 'data' },
      { id: 'trial', label: 'Trial', type: 'data' },
      { id: 'churned', label: 'Churned', type: 'data' },
      { id: 'plan', label: 'Plan', type: 'data', options: [{ value: 'pro', label: 'Pro' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const sr = el.shadowRoot!;
    for (let i = 0; i < 25 && !sr.querySelector('.overflow-chip sherpa-menu .qf-toggle'); i++) {
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
    const more = (): HTMLElement => sr.querySelector<HTMLElement>('.overflow-chip')!;
    const id = sr.querySelector<HTMLElement>('.qf-toggle')!.dataset['for']!;
    const box = (): HTMLInputElement =>
      sr.querySelector<HTMLInputElement>(`.qf-toggle[data-for="${id}"] input`)!;
    const chip = (): HTMLElement =>
      sr.querySelector<HTMLElement>(`.chips > .chip[data-id="${id}"]`)!;
    const snap = () => ({
      locked: more().hasAttribute('data-locked'),
      moreCurrent: more().hasAttribute('data-current'),
      moreCount: more().dataset['count'] ?? null,
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

  expect(r.start.locked).toBe(true);
  // The MORE chip never moves: on throughout, badge unchanged.
  expect(r.start.moreCurrent).toBe(true);
  expect(r.ticked.moreCurrent).toBe(true);
  expect(r.unticked.moreCurrent).toBe(true);
  expect(r.ticked.moreCount).toBe(r.start.moreCount);
  expect(r.unticked.moreCount).toBe(r.start.moreCount);
  // …while the chip the row stands for does exactly what was asked of it.
  expect(r.start.chip).toBe(false);
  expect(r.ticked.chip).toBe(true);
  expect(r.unticked.chip).toBe(false);
});

/**
 * A CUSTOM chip — one whose value was typed, not picked from a list.
 *
 * The data grid's column-heading filters are what this exists for. A reader
 * sets "Name starts with Ad" in a column heading, and the bar has to show it
 * beside the chips they picked from the Add menu, or the view is narrowed by
 * something with no presence on the toolbar that says so.
 */
test('addCustomFilter puts a typed-value chip on the bar, replaces it, and removes it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
      addCustomFilter(spec: { id: string; label: string; value?: string | null }): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate?.([{ id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro' }] }]);
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const bar = () =>
      Array.from(sr.querySelectorAll<HTMLElement>('.chip')).map((c) => ({
        id: c.dataset['id'] ?? null,
        label: c.getAttribute('data-label'),
        value: c.shadowRoot?.querySelector('.caret-label')?.textContent ?? null,
        on: c.hasAttribute('data-current'),
        // No list to open, so no menu is slotted — the caret shows the value
        // and opens nothing.
        hasMenu: !!c.querySelector('sherpa-menu'),
        // The phrase must read in FULL: "Starts with: Ad" truncated names a
        // condition whose subject the reader cannot see.
        full: c.hasAttribute('data-full-value'),
      }));

    el.addCustomFilter({ id: 'col:name', label: 'Name', value: 'Starts with: Ad' });
    await settle();
    const added = bar();

    // Changing the condition is the SAME filter, not a second one.
    el.addCustomFilter({ id: 'col:name', label: 'Name', value: 'Contains: bo' });
    await settle();
    const replaced = bar();

    // A null value means the column's menu was cleared — the chip goes.
    el.addCustomFilter({ id: 'col:name', label: 'Name', value: null });
    await settle();
    const removed = bar();

    return { added, replaced, removed };
  });

  // It lands beside the picked chips, on, reading its phrase.
  expect(r.added).toHaveLength(2);
  expect(r.added[1]).toEqual({
    id: 'col:name',
    label: 'Name',
    value: 'Starts with: Ad',
    on: true,
    hasMenu: false,
    full: true,
  });

  // Same id, so it is REPLACED — one filter, not two.
  expect(r.replaced).toHaveLength(2);
  expect(r.replaced[1]!.value).toBe('Contains: bo');

  // Cleared: the chip goes, and the picked chip is untouched.
  expect(r.removed).toHaveLength(1);
  expect(r.removed[0]!.id).toBe('plan');
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

    // Empty means UNGROUPED. Unlike a suspended sort the pick is cleared: a grid
    // is grouped or flat, so a remembered column would report a grouping that is
    // not running.
    el.setAttribute('data-group-field', '');
    await settled();
    const cleared = {
      on: chip().hasAttribute('data-current'),
      field: el.groupField,
      ticked: ticked(),
    };

    return { before, set, cleared, changes };
  });

  expect(r.before).toEqual({ on: false, field: null });

  // THE DOOR WORKS: the attribute ticks the radio and lights the chip.
  expect(r.set.on).toBe(true);
  expect(r.set.field).toBe('region');
  expect(r.set.ticked).toEqual(['region']);
  // And the chip NAMES it. A lit chip reading only "Group" says a grouping
  // exists without saying what it is.
  expect(r.set.face).toContain('Region');

  // Off means off, in the menu AND in the read-back.
  expect(r.cleared).toEqual({ on: false, field: null, ticked: [] });

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
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    el.setAttribute('data-type', 'data');
    // Narrow enough that chips MUST fold — the case the measuring exists for.
    el.style.cssText = 'max-inline-size: 300px';
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
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
       here, it is wrong for good. */
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
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      organise(d: unknown): void;
      groupField: string | null;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
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
      anyRadio: [...chip.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
        .some((x) => x.checked),
    };

    // Click again: nothing is picked, so it must NOT light.
    body().click();
    await settled();
    await new Promise((res) => setTimeout(res, 150));
    const back = { field: el.groupField, lit: chip.hasAttribute('data-current') };

    return { picked, off, back, fired };
  });

  // Picking a column groups, and lights the chip.
  expect(r.picked).toEqual({ field: 'team', lit: true });

  // The BODY turns it off — and clears the pick, because a chip remembering a
  // column it is not grouping by would report a grouping that is not running.
  expect(r.off).toEqual({ field: null, lit: false, anyRadio: false });

  // With nothing picked it stays off rather than flickering on and correcting.
  expect(r.back).toEqual({ field: null, lit: false });

  // …and every change was REPORTED. The host owns the grouping.
  expect(r.fired).toContain('team');
  expect(r.fired).toContain(null);
});
