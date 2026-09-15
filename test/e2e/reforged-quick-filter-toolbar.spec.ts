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
    const boxes = Array.from(menu.querySelectorAll<HTMLInputElement>('input'));

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
      ticked: Array.from(chip.querySelectorAll<HTMLInputElement>('input:checked')).map((i) => i.value),
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
      remove: {
        view: !!view.querySelector('.qf-remove'),
        plan: !!chip('plan').querySelector('.qf-remove'),
        region: !!chip('region').querySelector('.qf-remove'),
      },
    };
  }, MOUNT);

  // ONE value, the first, without the host having said so.
  expect(r.checked).toEqual(['fleet']);
  expect(r.viewOn).toBe(true);

  // The amber state is a contradiction a selector cannot be in.
  expect(r.viewEmpty).toBe(false);

  expect(r.values).toEqual({ view: ['fleet'] });

  // "Remove filter" is OPT-IN. The selector never offers it; a chip that asked
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
    const offered = () => [...add.querySelectorAll('input')].map((i) => (i as HTMLInputElement).value);

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
    const offered = () => [...add.querySelectorAll('input')].map((i) => (i as HTMLInputElement).value);
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

    // …then take one back off through its own menu's "Remove filter" row.
    const health = sr.querySelector('.chip[data-id="health"]') as HTMLElement;
    const removeRow = health.querySelector('.qf-remove') as HTMLElement;
    const removeLabel = removeRow.textContent!.trim();
    removeRow.click();
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
  expect(r.removeLabel).toBe('Remove filter');
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
    // `removable: true` — the opt-in that puts "Remove filter" in the menu.
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
    (sr.querySelector('.chip[data-id="region"] .qf-remove') as HTMLElement).click();
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

  // TODAY is the left footer button on a calendar menu, and Clear is not —
  // Figma's Calendar footer puts Today in that slot and holds ONE control
  // there. It jumps the calendar to today rather than emptying it.
  expect(r.before.todayShown).not.toBe('none');
  expect(r.before.clearShown).toBe('none');
  expect(r.afterToday).toBe(r.todayIso);

  // The way back OFF the bar is a footer button, AFTER Today. A date chip had
  // neither before: no remove row (the branch returned past it) and, once Clear
  // moved aside for Today, no way out at all.
  expect(r.before.removable).toBe(true);
  expect(r.before.removeShown).not.toBe('none');
});
