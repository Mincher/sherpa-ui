import { test, expect } from './harness';

/**
 * A CALENDAR IS A MENU — the composition, checked where it can actually break.
 *
 * Figma's Menu set (1156:29240) has `Type = List | Calendar` and three slots:
 * header, list, footer. The Calendar variant's header is three Button instances
 * SNAPPED into one stepper (prev at snap-right-edge, month at snap-all-edges,
 * next at snap-left-edge), and BOTH variants' footer holds a Container Footer.
 *
 * Every assertion here guards a boundary that has already failed once:
 *
 *   - the stepper is PROJECTED into the menu's light DOM, so no rule inside
 *     sherpa-calendar's shadow root reaches it. It read back `display: block`,
 *     `gap: normal` and sat 4px apart until sherpa-menu.css styled the slot.
 *   - `[data-snap]` lives in tokens.css, a DOCUMENT sheet, so it never reaches
 *     a button in a shadow root. The corner variables must be written directly.
 *   - a nested calendar used to draw a SECOND header and footer inside the
 *     menu's own.
 */


/** Mount a calendar menu, open it, and hand back the live nodes' measurements. */
async function openCalendarMenu(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML =
      '<button id="t">t</button>' +
      '<sherpa-menu id="m" data-type="calendar" data-heading="Created" data-commit data-clearable>' +
      '<sherpa-calendar data-embedded></sherpa-calendar></sherpa-menu>';
    const menu = document.getElementById('m') as HTMLElement & {
      rendered?: Promise<void>; show: (t: HTMLElement) => void; shadowRoot: ShadowRoot;
    };
    const cal = menu.querySelector('sherpa-calendar') as HTMLElement & { rendered?: Promise<void>; shadowRoot: ShadowRoot };
    await menu.rendered;
    await cal.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    menu.show(document.getElementById('t')!);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const stepper = menu.querySelector(':scope > .cal-header-projected') as HTMLElement | null;
    const btns = stepper ? ([...stepper.children] as HTMLElement[]) : [];
    const box = (e: HTMLElement) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right) };
    };
    const corner = (e: HTMLElement, side: string) =>
      getComputedStyle(e).getPropertyValue(`--sherpa-border-rounding-${side}`).trim();

    const footer = menu.shadowRoot.querySelector('.footer') as HTMLElement;
    const footerRow = footer.shadowRoot?.querySelector('.row') as HTMLElement | null;

    return {
      projected: !!stepper,
      stepperDisplay: stepper ? getComputedStyle(stepper).display : null,
      tags: btns.map((b) => b.localName),
      boxes: btns.map(box),
      corners: btns.map((b) => ({
        tl: corner(b, 'top-left'), tr: corner(b, 'top-right'),
        bl: corner(b, 'bottom-left'), br: corner(b, 'bottom-right'),
      })),
      // The calendar must contribute ONLY its grid when embedded.
      ownHeader: getComputedStyle(cal.shadowRoot.querySelector('.cal-header')!).display,
      ownFooter: getComputedStyle(cal.shadowRoot.querySelector('.cal-footer')!).display,
      footerTag: footer.localName,
      footerRowPadding: footerRow ? getComputedStyle(footerRow).padding : null,
    };
  });
}

test('the calendar menu header is a composed, snapped sherpa-button group', async ({ page }) => {
  const r = await openCalendarMenu(page);

  // Projected into the MENU's light DOM — `slot="header"` only assigns a DIRECT
  // child of the slot's host, which is why this lives beside the calendar and
  // not inside it.
  expect(r.projected).toBe(true);

  // Three COMPOSED buttons, not hand-rolled <button>s. This is the assertion
  // that fails the moment someone re-implements the stepper.
  expect(r.tags).toEqual(['sherpa-button', 'sherpa-button', 'sherpa-button']);

  // The menu's slot rule has to reach them: a `display: block` here means the
  // calendar's own `.cal-header` is being relied on, and it cannot apply.
  expect(r.stepperDisplay).toBe('flex');

  // prev / next hug at 32 (Figma: 32 x 32); the month button FILLS.
  expect(r.boxes[0]!.w).toBe(32);
  expect(r.boxes[2]!.w).toBe(32);
  expect(r.boxes[1]!.w).toBeGreaterThan(60);
  for (const b of r.boxes) expect(b.h).toBe(32);

  // SNAPPED: the borders overlap, so each seam is 0 or the -0.5px overlap
  // rounded to a device pixel. A positive seam means the group came apart.
  expect(r.boxes[1]!.l - r.boxes[0]!.r).toBeLessThanOrEqual(0);
  expect(r.boxes[2]!.l - r.boxes[1]!.r).toBeLessThanOrEqual(0);

  // Only the OUTER corners survive — Figma's snap-right-edge / snap-all-edges /
  // snap-left-edge, read off the corner variables the buttons actually consume.
  expect(r.corners[0]).toEqual({ tl: '4px', tr: '0px', bl: '4px', br: '0px' });
  expect(r.corners[1]).toEqual({ tl: '0px', tr: '0px', bl: '0px', br: '0px' });
  expect(r.corners[2]).toEqual({ tl: '0px', tr: '4px', bl: '0px', br: '4px' });
});

test('an embedded calendar contributes only its grid — the menu owns the chrome', async ({ page }) => {
  const r = await openCalendarMenu(page);

  // One header and one footer, both the menu's. A nested calendar used to draw
  // its own inside them, stacking two Apply/Cancel pairs.
  expect(r.ownHeader).toBe('none');
  expect(r.ownFooter).toBe('none');

  // The footer IS Figma's Container Footer instance, not a row drawn by the
  // menu — that 8-block / 0-inline padding is the node's, and proves it.
  expect(r.footerTag).toBe('sherpa-container-footer');
  expect(r.footerRowPadding).toBe('8px 0px');
});

test('a date filter chip opens a calendar menu, picks a day, and jumps to today', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate: (d: unknown) => void; shadowRoot: ShadowRoot;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // `removable: true` is the OPT-IN for the "Remove" affordance —
    // without it a chip offers no way off the bar, which is what the view
    // SELECTOR wants and what a data filter does not.
    el.populate([
      { id: 'plan', label: 'Plan', removable: true, options: [{ value: 'pro', label: 'Pro' }] },
      { id: 'created', label: 'Created', kind: 'date', removable: true },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const chip = el.shadowRoot.querySelector('.chip[data-id="created"]') as HTMLElement;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & {
      rendered?: Promise<void>; show: (t: HTMLElement) => void; shadowRoot: ShadowRoot;
    };
    const cal = menu.querySelector('sherpa-calendar') as HTMLElement & {
      rendered?: Promise<void>; shadowRoot: ShadowRoot; dataset: DOMStringMap;
    };
    await menu.rendered;
    await cal.rendered;
    menu.show(chip);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    let picked: unknown = null;
    cal.addEventListener('datetime-change', (e) => { picked = (e as CustomEvent).detail; });

    const cell = [...cal.shadowRoot.querySelectorAll('sherpa-calendar-cell')].find(
      (c) => (c as HTMLElement).dataset['iso'] && !c.hasAttribute('disabled'),
    ) as (HTMLElement & { shadowRoot: ShadowRoot }) | undefined;
    cell?.shadowRoot.querySelector('button')?.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const afterPick = cal.dataset['value'] ?? null;

    // TODAY is the left footer button on a calendar (Figma puts it in that
    // slot), and it re-picks rather than empties — so the date after it is
    // today's, not null. Clicked through the DOM the way a reader would, which
    // also proves the button is actually reachable: it is hidden on this
    // variant's Clear, and a click on a hidden button silently does nothing.
    const today = menu.shadowRoot.querySelector('.today') as HTMLElement;
    const todayReachable = getComputedStyle(today).display !== 'none';
    today.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const now = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    return {
      menuType: menu.getAttribute('data-type'),
      projected: !!menu.querySelector(':scope > .cal-header-projected'),
      picked, afterPick, todayReachable,
      afterToday: cal.dataset['value'] ?? null,
      todayIso: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`,
    };
  });

  // A date chip's menu is the Menu set's Calendar variant, not a list.
  expect(r.menuType).toBe('calendar');
  expect(r.projected).toBe(true);

  // A day picks and reports itself as an ISO date.
  expect(r.picked).toMatchObject({ value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  expect(r.afterPick).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  // The left footer button on a calendar is Today, and it is really there —
  // this whole flow would pass against a hidden button otherwise.
  expect(r.todayReachable).toBe(true);
  expect(r.afterToday).toBe(r.todayIso);
});

test('a calendar heads its own two-row header; the footer buttons are default size', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const read = async (html: string) => {
      root.innerHTML = '<button id="t">t</button>' + html;
      const m = document.getElementById('m') as HTMLElement & {
        rendered?: Promise<void>; show: (t: HTMLElement) => void; hide: () => void; shadowRoot: ShadowRoot;
      };
      await m.rendered;
      const cal = m.querySelector('sherpa-calendar') as (HTMLElement & { rendered?: Promise<void> }) | null;
      if (cal) await cal.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      m.show(document.getElementById('t')!);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const btn = (c: string) => {
        const b = m.shadowRoot.querySelector('.' + c) as HTMLElement;
        const box = b.getBoundingClientRect();
        return { h: Math.round(box.height), size: b.getAttribute('data-size'),
                 look: b.getAttribute('data-look'),
                 shown: getComputedStyle(b).display !== 'none' };
      };
      const rowOf = (c: string) => {
        const e = m.shadowRoot.querySelector('.' + c) as HTMLElement | null;
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return Math.round(b.top + b.height / 2);
      };
      const stepper = m.querySelector('.cal-header') as HTMLElement | null;
      const out = {
        heading: getComputedStyle(m.shadowRoot.querySelector('.heading')!).display,
        headingY: rowOf('heading'),
        row1Bottom: Math.round(
          (m.shadowRoot.querySelector('.heading') as HTMLElement).getBoundingClientRect().bottom),
        headerW: Math.round((m.shadowRoot.querySelector('.header') as HTMLElement).getBoundingClientRect().width),
        stepper: stepper
          ? { y: Math.round(stepper.getBoundingClientRect().top),
              w: Math.round(stepper.getBoundingClientRect().width) }
          : null,
        ariaLabel: (m.shadowRoot.querySelector('.menu') as HTMLElement).getAttribute('aria-label'),
        // The footer's LEFT position. Today is the calendar's; Clear leads the
        // row on any menu that has it.
        today: btn('today'),
        cancel: btn('cancel'), apply: btn('apply'),
        clear: btn('clear'),
        // Clear leads, Apply trails — the spacer splits them.
        clearX: Math.round((m.shadowRoot.querySelector('.clear') as HTMLElement).getBoundingClientRect().left),
        applyX: Math.round((m.shadowRoot.querySelector('.apply') as HTMLElement).getBoundingClientRect().left),
      };
      m.hide();
      return out;
    };
    return {
      list: await read('<sherpa-menu id="m" data-heading="Actions" data-commit data-clearable><button value="a">A</button></sherpa-menu>'),
      calendar: await read('<sherpa-menu id="m" data-type="calendar" data-heading="Created" data-commit data-clearable><sherpa-calendar data-embedded></sherpa-calendar></sherpa-menu>'),
    };
  });

  // BOTH variants head their card. A calendar used to hide its heading on the
  // reasoning that the month button already names the view — but the month
  // names the MONTH, while the heading names the FIELD ("Created").
  expect(r.list.heading).not.toBe('none');
  expect(r.calendar.heading).not.toBe('none');

  // The name still reaches a screen reader from the card itself too.
  expect(r.calendar.ariaLabel).toBe('Created');

  // A CALENDAR HEADER IS TWO ROWS: the heading, then the slotted stepper. A
  // list header is one row with nothing slotted into it.
  expect(r.calendar.stepper!.y).toBeGreaterThan(r.calendar.headingY!);
  // …with a row gap of the header's own 12.
  expect(r.calendar.stepper!.y - r.calendar.row1Bottom!).toBe(12);
  // …spanning the header's full width, so the month button stretches between
  // the two hugging arrows rather than the trio bunching at the start.
  expect(r.calendar.stepper!.w).toBe(r.calendar.headerW);
  expect(r.list.stepper).toBeNull();

  // Read off the footer instances (1156:29251 / 1144:28602): the decision pair is
  // the button's DEFAULT size at 32 tall, matching the Container Footer's own
  // 32-tall slots. They used to carry data-size="sm".
  for (const shape of [r.list, r.calendar]) {
    for (const b of [shape.cancel, shape.apply]) {
      expect(b.h).toBe(32);
      expect(b.size).toBeNull();
    }
    // Apply is the only saturated one.
    expect(shape.apply.look).toBe('saturated');
    expect(shape.cancel.look).toBeNull();
  }

  // Only a calendar fills the footer's left slot, and Today is a default-size
  // labelled button like the pair beside it.
  expect(r.calendar.today.shown).toBe(true);
  expect(r.list.today.shown).toBe(false);
  expect(r.calendar.today.h).toBe(32);
  expect(r.calendar.today.size).toBeNull();
  expect(r.calendar.today.look).toBeNull();

  // CLEAR IS A FOOTER BUTTON — a labelled control in the action bar, so it is
  // the DEFAULT look and size, not the transparent icon it was in the header.
  // It LEADS the row; the commit pair trails behind the spacer.
  for (const shape of [r.list, r.calendar]) {
    expect(shape.clear.shown).toBe(true);
    expect(shape.clear.h).toBe(32);
    expect(shape.clear.size).toBeNull();
    expect(shape.clear.look).toBeNull();
    expect(shape.clearX).toBeLessThan(shape.applyX);
  }
});

test('a cell fills its grid track in every view — nothing clips it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    // Sized so the seven tracks land on the node's own 32: 224 of tracks plus
    // the grid's 8px side padding. The grid FILLS its container now, flooring
    // at that figure rather than being fixed to it — in a wider box the seven
    // 1fr tracks share the extra instead.
    root.innerHTML =
      '<div style="inline-size:240px"><sherpa-calendar data-value="2026-08-15"></sherpa-calendar></div>';
    const cal = root.querySelector('sherpa-calendar') as HTMLElement & {
      rendered?: Promise<void>; shadowRoot: ShadowRoot; dataset: DOMStringMap;
    };
    await cal.rendered;

    const out: Record<string, unknown> = {};
    for (const [view, sel] of [['day', '.cal-days'], ['month', '.cal-months'], ['year', '.cal-years']] as const) {
      cal.dataset['view'] = view;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const grid = cal.shadowRoot.querySelector(sel) as HTMLElement;
      const cells = [...grid.querySelectorAll('sherpa-calendar-cell')] as (HTMLElement & { shadowRoot: ShadowRoot })[];
      const c = cells[Math.floor(cells.length / 2)]!;
      const host = c.getBoundingClientRect();
      const btn = (c.shadowRoot.querySelector('.cell') as HTMLElement).getBoundingClientRect();
      const content = (c.shadowRoot.querySelector('.content') as HTMLElement).getBoundingClientRect();
      const track = getComputedStyle(grid).gridTemplateColumns.split(' ')[0]!;
      out[view] = {
        trackW: Math.round(parseFloat(track) * 10) / 10,
        hostW: Math.round(host.width * 10) / 10, hostH: Math.round(host.height * 10) / 10,
        btnW: Math.round(btn.width * 10) / 10, btnH: Math.round(btn.height * 10) / 10,
        contentW: Math.round(content.width * 10) / 10, contentH: Math.round(content.height * 10) / 10,
      };
    }
    return out as Record<string, {
      trackW: number; hostW: number; hostH: number;
      btnW: number; btnH: number; contentW: number; contentH: number;
    }>;
  });

  for (const [view, m] of Object.entries(r)) {
    // The cell FILLS its track. The calendar used to redraw the cell on the
    // host with a `border: 0.5px solid transparent`, which took 1px off each
    // side — every cell painted 2px narrower than its track, and the content
    // box sat clipped inside it.
    expect(m.hostW, `${view}: host fills its track`).toBe(m.trackW);
    expect(m.btnW, `${view}: button fills its host`).toBe(m.hostW);
    expect(m.contentW, `${view}: content fills its button`).toBe(m.hostW);

    // …and vertically. Figma's Grid frame (962:6062) is 7 x 7 tracks ALL at
    // FLEX 1, so a cell is exactly its row. The month and year cells were
    // pinned to a hardcoded 40px block-size — a number in no token and in no
    // node — inside a 40px row holding a 32px cell: 4px dead above and below.
    expect(m.hostH, `${view}: row height`).toBe(32);
    expect(m.btnH, `${view}: button fills its row`).toBe(32);
    expect(m.contentH, `${view}: content fills its row`).toBe(32);
  }

  // A day is the node's own 32 wide; a month/year cell is wider because three
  // columns share the same width seven days do.
  expect(r['day']!.trackW).toBe(32);
  expect(r['month']!.trackW).toBeGreaterThan(32);
});

test('the grid keeps one width across day / month / year, INSIDE a hugging menu', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    // IN A MENU, which is where this breaks. The calendar menu's card is
    // `inline-size: max-content` — it hugs what it holds — so a grid that does
    // not state its own width collapses to the widest label in it.
    root.innerHTML =
      '<button id="t">t</button>' +
      '<sherpa-menu id="m" data-type="calendar" data-commit data-clearable>' +
      '<sherpa-calendar data-embedded></sherpa-calendar></sherpa-menu>';
    const menu = document.getElementById('m') as HTMLElement & {
      rendered?: Promise<void>; show: (t: HTMLElement) => void;
    };
    const cal = menu.querySelector('sherpa-calendar') as HTMLElement & {
      rendered?: Promise<void>; shadowRoot: ShadowRoot; dataset: DOMStringMap;
    };
    await menu.rendered;
    await cal.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    menu.show(document.getElementById('t')!);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const out: Record<string, { gridW: number; cols: number[] }> = {};
    for (const [view, sel] of [['day', '.cal-days'], ['month', '.cal-months'], ['year', '.cal-years']] as const) {
      cal.dataset['view'] = view;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const grid = cal.shadowRoot.querySelector(sel) as HTMLElement;
      out[view] = {
        gridW: Math.round(grid.getBoundingClientRect().width),
        cols: getComputedStyle(grid).gridTemplateColumns.split(' ').map((c) => Math.round(parseFloat(c) * 10) / 10),
      };
    }
    return out;
  });

  // ONE width for all three views. Figma's Grid frame (962:6062) is 224 wide
  // with both axes FIXED, in a `content` slot whose own description says it
  // holds "day grid, month grid, or year grid" — one box, three contents. So
  // switching view must not resize the calendar.
  expect(r['month']!.gridW).toBe(r['day']!.gridW);
  expect(r['year']!.gridW).toBe(r['day']!.gridW);

  // 7 EQUAL day columns, flooring at the node's own 32. The grid FILLS the
  // card, so a wider footer row widens the tracks rather than leaving a gap.
  expect(r['day']!.cols).toHaveLength(7);
  for (const c of r['day']!.cols) {
    expect(c).toBeGreaterThanOrEqual(32);
    expect(Math.abs(c - r['day']!.cols[0]!)).toBeLessThanOrEqual(0.1);
  }

  // …and 3 EQUAL month/year columns, each a third of that same width. This is
  // the regression: with no stated width, 1fr collapsed to the widest label —
  // 25.2px in the month view ("Sep"), 33.6px in the year view ("2022") —
  // squishing three columns together while the day view still looked right.
  const [m1, m2, m3] = r['month']!.cols as [number, number, number];
  expect(r['month']!.cols).toHaveLength(3);
  expect(Math.abs(m1 - m2)).toBeLessThanOrEqual(0.1);
  expect(Math.abs(m2 - m3)).toBeLessThanOrEqual(0.1);
  // A third of seven day-columns is wider than two of them.
  expect(m1).toBeGreaterThan(64);
});

test('the calendar footer holds Today on the left, and it drives the calendar', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const open = async (html: string) => {
      root.innerHTML = '<button id="t">t</button>' + html;
      const m = document.getElementById('m') as HTMLElement & {
        rendered?: Promise<void>; show: (t: HTMLElement) => void; hide: () => void; shadowRoot: ShadowRoot;
      };
      await m.rendered;
      const cal = m.querySelector('sherpa-calendar') as (HTMLElement & {
        rendered?: Promise<void>; dataset: DOMStringMap;
      }) | null;
      if (cal) await cal.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      m.show(document.getElementById('t')!);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return { m, cal };
    };
    const box = (m: HTMLElement & { shadowRoot: ShadowRoot }, c: string) => {
      const el = m.shadowRoot.querySelector('.' + c) as HTMLElement;
      const b = el.getBoundingClientRect();
      return { shown: getComputedStyle(el).display !== 'none', x: Math.round(b.left),
               y: Math.round(b.top), w: Math.round(b.width) };
    };

    const cal = await open('<sherpa-menu id="m" data-type="calendar" data-commit data-clearable>' +
      '<sherpa-calendar data-embedded></sherpa-calendar></sherpa-menu>');
    const calendar = {
      today: box(cal.m, 'today'), clear: box(cal.m, 'clear'),
      cancel: box(cal.m, 'cancel'), apply: box(cal.m, 'apply'),
    };

    // Drive it from somewhere far away — a year view with no date picked.
    cal.cal!.dataset['view'] = 'year';
    delete cal.cal!.dataset['value'];
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const before = { view: cal.cal!.dataset['view'], value: cal.cal!.dataset['value'] ?? null };
    (cal.m.shadowRoot.querySelector('.today') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const after = { view: cal.cal!.dataset['view'], value: cal.cal!.dataset['value'] ?? null };
    const stillOpen = !!cal.m.shadowRoot.querySelector('.menu:popover-open');
    cal.m.hide();

    const list = await open('<sherpa-menu id="m" data-heading="Plan" data-commit data-clearable>' +
      '<label><input type="checkbox" value="p"/>Pro</label></sherpa-menu>');
    const listFooter = { today: box(list.m, 'today'), clear: box(list.m, 'clear') };

    const iso = (() => {
      const d = new Date();
      const p2 = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    })();
    return { calendar, before, after, stillOpen, listFooter, iso };
  });

  // Figma's two footers differ in exactly one position: the Calendar's `left`
  // slot holds "Today", the List's is empty. Clear leads the same row, after
  // Today, so a calendar shows both.
  expect(r.calendar.today.shown).toBe(true);
  expect(r.calendar.clear.shown).toBe(true);
  // …on ONE row now, Today first.
  expect(r.calendar.clear.y).toBe(r.calendar.today.y);
  expect(r.calendar.today.x).toBeLessThan(r.calendar.clear.x);

  // Today is on the LEFT, away from the pair a thumb reaches for.
  expect(r.calendar.today.x).toBeLessThan(r.calendar.cancel.x);
  expect(r.calendar.cancel.x).toBeLessThan(r.calendar.apply.x);

  // The node's own widths: Today 57, Cancel 62, Apply 54 (±1 for text metrics).
  expect(Math.abs(r.calendar.today.w - 57)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.calendar.cancel.w - 62)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.calendar.apply.w - 54)).toBeLessThanOrEqual(1);

  // The BUTTON is the menu's; the BEHAVIOUR is the calendar's. Clicking it from
  // a year view with nothing picked lands on today's DAY view with today set.
  expect(r.before).toEqual({ view: 'year', value: null });
  expect(r.after).toEqual({ view: 'day', value: r.iso });

  // It stays OPEN — Today picks a date, it does not commit one. Apply does that.
  expect(r.stillOpen).toBe(true);

  // A LIST menu leaves the footer's Today slot empty, as Figma has it, and a
  // clearable one leads the same row with Clear.
  expect(r.listFooter.today.shown).toBe(false);
  expect(r.listFooter.clear.shown).toBe(true);
});

test('the footer holds all five: Today, Clear, Remove, then the committing pair', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate: (d: unknown) => void; shadowRoot: ShadowRoot;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // `removable: true` is the OPT-IN for the "Remove" affordance —
    // without it a chip offers no way off the bar, which is what the view
    // SELECTOR wants and what a data filter does not.
    // `commit: true` so every control is up at once — the header pair AND the
    // three footer buttons. This test is about which region each one lands in,
    // their order inside it, and the card width that has to hold the footer.
    el.populate([
      { id: 'plan', label: 'Plan', removable: true, options: [{ value: 'pro', label: 'Pro' }] },
      { id: 'created', label: 'Created', kind: 'date', removable: true, commit: true },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const chip = el.shadowRoot.querySelector('.chip[data-id="created"]') as HTMLElement;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & {
      rendered?: Promise<void>; show: (t: HTMLElement) => void; shadowRoot: ShadowRoot;
    };
    const cal = menu.querySelector('sherpa-calendar') as HTMLElement & { rendered?: Promise<void>; shadowRoot: ShadowRoot };
    await menu.rendered;
    await cal.rendered;
    menu.show(chip);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const rect = (el2: Element) => {
      const b = el2.getBoundingClientRect();
      return { x: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) };
    };
    const card = menu.shadowRoot.querySelector('.menu') as HTMLElement;
    const footerRow = (menu.shadowRoot.querySelector('.footer') as HTMLElement)
      .shadowRoot!.querySelector('.row') as HTMLElement;
    const grid = cal.shadowRoot.querySelector('.cal-days') as HTMLElement;

    const header = menu.shadowRoot.querySelector('.header') as HTMLElement;
    const box = (c: string) => {
      const b = menu.shadowRoot.querySelector('.' + c) as HTMLElement;
      const r2 = b.getBoundingClientRect();
      return {
        x: Math.round(r2.left), y: Math.round(r2.top),
        shown: getComputedStyle(b).display !== 'none',
        inHeader: header.contains(b),
        size: b.getAttribute('data-size'),
        look: b.getAttribute('data-look'),
        label: (b.textContent ?? '').trim(),
      };
    };
    const before = {
      clear: box('clear'), remove: box('remove'),
      today: box('today'), cancel: box('cancel'), apply: box('apply'),
      card: rect(card), footer: rect(footerRow), grid: rect(grid),
      chips: [...el.shadowRoot.querySelectorAll('.chips > .chip')].map((c) => (c as HTMLElement).dataset['id']),
    };

    // Clicking it takes the chip off the bar — the same menu-select value the
    // action ROW emits, so the toolbar's one handler catches both shapes.
    const rm = menu.shadowRoot.querySelector('.remove') as HTMLElement & { shadowRoot: ShadowRoot };
    (rm.shadowRoot.querySelector('button') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 120));

    return {
      before,
      chipsAfter: [...el.shadowRoot.querySelectorAll('.chips > .chip')].map((c) => (c as HTMLElement).dataset['id']),
    };
  });

  // All five are present on a COMMITTING, removable date chip's menu.
  for (const b of [r.before.clear, r.before.remove, r.before.today, r.before.cancel, r.before.apply]) {
    expect(b.shown).toBe(true);
  }

  // ALL FIVE ARE THE FOOTER'S — the header holds the heading and the stepper
  // and nothing else.
  for (const b of [r.before.clear, r.before.remove, r.before.today,
                   r.before.cancel, r.before.apply]) {
    expect(b.inHeader).toBe(false);
  }

  // ONE row, in order: Today, Clear, Remove — the reversible action before the
  // destructive one — then the committing pair behind the spacer.
  for (const b of [r.before.clear, r.before.remove, r.before.cancel, r.before.apply]) {
    expect(b.y).toBe(r.before.today.y);
  }
  expect(r.before.today.x).toBeLessThan(r.before.clear.x);
  expect(r.before.clear.x).toBeLessThan(r.before.remove.x);
  expect(r.before.remove.x).toBeLessThan(r.before.cancel.x);
  expect(r.before.cancel.x).toBeLessThan(r.before.apply.x);

  // Labelled, default size and DEFAULT look — an action-bar control, not the
  // transparent icon each was while it lived in the header.
  for (const b of [r.before.clear, r.before.remove]) {
    expect(b.size).toBeNull();
    expect(b.look).toBeNull();
  }
  expect(r.before.clear.label).toBe('Clear');
  expect(r.before.remove.label).toBe('Remove');

  // THE CARD STILL HOLDS ITS FOOTER. A calendar card hugs its content, and
  // under `max-content` it once sized to the day GRID alone, letting the footer
  // run off its edge.
  expect(r.before.card.w).toBeGreaterThanOrEqual(r.before.grid.w);
  expect(r.before.footer.r).toBeLessThanOrEqual(r.before.card.r);

  // And it removes the filter.
  expect(r.before.chips).toEqual(['plan', 'created']);
  expect(r.chipsAfter).toEqual(['plan']);
});

/**
 * The footer is NOT the Apply/Cancel pair alone.
 *
 * Chips auto-apply by default, so `data-commit` is usually absent — and the row
 * used to be gated on that one attribute. A date chip therefore lost Today and
 * Remove along with the Apply button, and a calendar has no list for an
 * action ROW to sit in instead, so the chip became one a reader could add and
 * never take away.
 *
 * Each control hides on its OWN flag; the row shows when any of them is in it.
 */
test('an auto-applying date chip keeps Today and Remove, and drops only Cancel/Apply', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate: (d: unknown) => void; shadowRoot: ShadowRoot;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // NO `commit`, so each chip falls to the default for its own select mode.
    // A DATE chip picks one day, so it applies on the tick; the plain chip is
    // SINGLE-select for the same reason, and rides along so the case with
    // nothing to put in the row is covered too. (A MULTI chip defers behind
    // Apply/Cancel — that is a different test.)
    el.populate([
      { id: 'created', label: 'Created', kind: 'date', removable: true },
      { id: 'plain', label: 'Plain', select: 'single', options: [{ value: 'a', label: 'A' }] },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const menuOf = (id: string) =>
      el.shadowRoot.querySelector(`.chip[data-id="${id}"] sherpa-menu`) as HTMLElement & {
        rendered?: Promise<void>; shadowRoot: ShadowRoot;
      };
    const date = menuOf('created');
    const plain = menuOf('plain');
    await date.rendered;
    await plain.rendered;

    const shown = (menu: { shadowRoot: ShadowRoot }, sel: string) =>
      getComputedStyle(menu.shadowRoot.querySelector(sel)!).display !== 'none';

    return {
      date: {
        commits: date.hasAttribute('data-commit'),
        footer: shown(date, '.footer'),
        today: shown(date, '.today'),
        remove: shown(date, '.remove'),
        cancel: shown(date, '.cancel'),
        apply: shown(date, '.apply'),
      },
      plain: {
        commits: plain.hasAttribute('data-commit'),
        clearable: plain.hasAttribute('data-clearable'),
        footer: shown(plain, '.footer'),
        clear: shown(plain, '.clear'),
        today: shown(plain, '.today'),
        remove: shown(plain, '.remove'),
        cancel: shown(plain, '.cancel'),
        apply: shown(plain, '.apply'),
      },
    };
  });

  // Auto-apply: no data-commit anywhere.
  expect(r.date.commits).toBe(false);
  expect(r.plain.commits).toBe(false);

  // The date chip KEEPS its row, because Today and Remove still live in it.
  expect(r.date.footer).toBe(true);
  expect(r.date.today).toBe(true);
  expect(r.date.remove).toBe(true);

  // …and loses exactly the commit pair, which would otherwise offer to apply a
  // selection that has already applied.
  expect(r.date.cancel).toBe(false);
  expect(r.date.apply).toBe(false);

  // A non-persistent chip is CLEARABLE, and Clear lives in the row now, so the
  // row is up holding Clear alone — nothing else in it.
  expect(r.plain.clearable).toBe(true);
  expect(r.plain.footer).toBe(true);
  expect(r.plain.clear).toBe(true);
  for (const s of [r.plain.today, r.plain.remove, r.plain.cancel, r.plain.apply]) {
    expect(s).toBe(false);
  }
});

/**
 * A DATE menu's value is its CALENDAR's pick, not a ticked row.
 *
 * `menu.values` read checked inputs only, so a date menu reported nothing — and
 * every chip fed by one read as "on but filtering nothing": the amber warning
 * state, painted over a filter that was working perfectly.
 */
test('a calendar menu reports its picked day as the menu value', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.replaceChildren();
    const menu = document.createElement('sherpa-menu') as HTMLElement & {
      rendered?: Promise<void>;
      values: string[];
    };
    const cal = document.createElement('sherpa-calendar');
    cal.setAttribute('data-embedded', '');
    menu.appendChild(cal);
    root.appendChild(menu);
    await menu.rendered;
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const empty = menu.values;

    // ONE DAY.
    cal.dataset['value'] = '2026-03-04';
    await settle();
    const single = menu.values;

    // A RANGE reports BOTH ends — and only once both are picked. Half a span is
    // not a span, and reporting one end alone would read as a single-day filter.
    delete cal.dataset['value'];
    cal.dataset['valueStart'] = '2026-03-01';
    await settle();
    const halfRange = menu.values;
    cal.dataset['valueEnd'] = '2026-03-31';
    await settle();
    const fullRange = menu.values;

    return { empty, single, halfRange, fullRange };
  });

  expect(r.empty).toEqual([]);
  expect(r.single).toEqual(['2026-03-04']);
  expect(r.halfRange).toEqual([]);
  expect(r.fullRange).toEqual(['2026-03-01', '2026-03-31']);
});

/**
 * An unpicked calendar opens where the DATA is.
 *
 * `data-available` says which days exist. Opening on today when today's month
 * holds none of them shows a grid of entirely disabled cells — nothing to
 * click, and no hint the days are two years away.
 */
test('an unpicked calendar anchors to its available days, not to today', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.replaceChildren();
    const make = (available?: string) => {
      const cal = document.createElement('sherpa-calendar') as HTMLElement & {
        rendered?: Promise<void>;
      };
      if (available != null) cal.setAttribute('data-available', available);
      root.appendChild(cal);
      return cal;
    };
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();

    // Days in a month that is NOT this one.
    const withData = make('2024-12-02,2024-12-06,2024-12-19');
    await withData.rendered;
    // No availability at all — today, as before.
    const plain = make();
    await plain.rendered;
    await settle();

    const label = (el: HTMLElement): string =>
      el.shadowRoot!.querySelector('.cal-label')?.textContent?.trim() ?? '';
    const pickable = (el: HTMLElement): number =>
      Array.from(el.shadowRoot!.querySelectorAll('sherpa-calendar-cell'))
        .filter((c) => !c.hasAttribute('disabled')).length;

    const now = new Date();
    return {
      dataLabel: label(withData),
      dataPickable: pickable(withData),
      plainLabel: label(plain),
      thisMonth: `${['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'][now.getMonth()]} ${now.getFullYear()}`,
    };
  });

  // It opens on the LATEST available day's month — the most recent data, and
  // the end a reader usually wants. Stepping back is one click.
  expect(r.dataLabel).toBe('December 2024');
  // …and the three days really are pickable there.
  expect(r.dataPickable).toBe(3);

  // Without availability nothing changes: today, as it always was.
  expect(r.plainLabel).toBe(r.thisMonth);
});
