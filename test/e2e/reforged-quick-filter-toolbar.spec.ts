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
