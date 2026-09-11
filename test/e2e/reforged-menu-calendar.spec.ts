import { test, expect } from '@playwright/test';

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

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

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
    await new Promise((r) => setTimeout(r, 40));
    menu.show(document.getElementById('t')!);
    await new Promise((r) => setTimeout(r, 40));

    const stepper = menu.querySelector(':scope > .cal-header-projected') as HTMLElement | null;
    const btns = stepper ? ([...stepper.children] as HTMLElement[]) : [];
    const box = (e: HTMLElement) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right) };
    };
    const corner = (e: HTMLElement, side: string) =>
      getComputedStyle(e).getPropertyValue(`--sherpa-structure-rounding-${side}`).trim();

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
  // menu — the 8px-all-round padding is that component's, and proves it.
  expect(r.footerTag).toBe('sherpa-container-footer');
  expect(r.footerRowPadding).toBe('8px');
});

test('a date filter chip opens a calendar menu, picks a day, and clears it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; populate: (d: unknown) => void; shadowRoot: ShadowRoot;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([
      { id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro' }] },
      { id: 'created', label: 'Created', kind: 'date' },
    ]);
    await new Promise((res) => setTimeout(res, 80));

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
    await new Promise((res) => setTimeout(res, 60));

    let picked: unknown = null;
    cal.addEventListener('datetime-change', (e) => { picked = (e as CustomEvent).detail; });

    const cell = [...cal.shadowRoot.querySelectorAll('sherpa-calendar-cell')].find(
      (c) => (c as HTMLElement).dataset['iso'] && !c.hasAttribute('disabled'),
    ) as (HTMLElement & { shadowRoot: ShadowRoot }) | undefined;
    cell?.shadowRoot.querySelector('button')?.click();
    await new Promise((res) => setTimeout(res, 40));
    const afterPick = cal.dataset['value'] ?? null;

    // Clear is in the menu's footer — the menu empties the slotted calendar.
    (menu.shadowRoot.querySelector('.clear') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 40));

    return {
      menuType: menu.getAttribute('data-type'),
      projected: !!menu.querySelector(':scope > .cal-header-projected'),
      picked, afterPick,
      afterClear: cal.dataset['value'] ?? null,
    };
  });

  // A date chip's menu is the Menu set's Calendar variant, not a list.
  expect(r.menuType).toBe('calendar');
  expect(r.projected).toBe(true);

  // A day picks and reports itself as an ISO date.
  expect(r.picked).toMatchObject({ value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  expect(r.afterPick).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  // Clear takes it back to "no date" — a thing a set of value rows cannot say
  // by unticking, which is why a date menu offers the button at all.
  expect(r.afterClear).toBeNull();
});

test('a calendar menu shows no heading; the footer buttons are default size', async ({ page }) => {
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
      await new Promise((res) => setTimeout(res, 40));
      m.show(document.getElementById('t')!);
      await new Promise((res) => setTimeout(res, 40));
      const btn = (c: string) => {
        const b = m.shadowRoot.querySelector('.' + c) as HTMLElement;
        const box = b.getBoundingClientRect();
        return { h: Math.round(box.height), size: b.getAttribute('data-size'), look: b.getAttribute('data-look') };
      };
      const out = {
        heading: getComputedStyle(m.shadowRoot.querySelector('.heading')!).display,
        ariaLabel: (m.shadowRoot.querySelector('.menu') as HTMLElement).getAttribute('aria-label'),
        clear: btn('clear'), cancel: btn('cancel'), apply: btn('apply'),
      };
      m.hide();
      return out;
    };
    return {
      list: await read('<sherpa-menu id="m" data-heading="Actions" data-commit data-clearable><button value="a">A</button></sherpa-menu>'),
      calendar: await read('<sherpa-menu id="m" data-type="calendar" data-heading="Created" data-commit data-clearable><sherpa-calendar data-embedded></sherpa-calendar></sherpa-menu>'),
    };
  });

  // The two variants' headers hold DIFFERENT things and never both: the List
  // header is one TEXT node, the Calendar header is prev · month · next. The
  // month button already names the view, so a heading is a second title.
  expect(r.list.heading).not.toBe('none');
  expect(r.calendar.heading).toBe('none');

  // Hidden, not dropped — the name still has to reach a screen reader, so it
  // moves onto the card itself.
  expect(r.calendar.ariaLabel).toBe('Created');

  // Read off the footer instances (1156:29251 / 1144:28602): all three are the
  // button's DEFAULT size at 32 tall, matching the Container Footer's own
  // 32-tall slots. They used to carry data-size="sm".
  for (const shape of [r.list, r.calendar]) {
    for (const b of [shape.clear, shape.cancel, shape.apply]) {
      expect(b.h).toBe(32);
      expect(b.size).toBeNull();
    }
    // Apply is the only saturated one; Clear is NOT transparent — Figma pins
    // Style=default on it, where the code had a transparent look.
    expect(shape.apply.look).toBe('saturated');
    expect(shape.cancel.look).toBeNull();
    expect(shape.clear.look).toBeNull();
  }
});

test('a cell fills its grid track in every view — nothing clips it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-calendar data-value="2026-08-15"></sherpa-calendar>';
    const cal = root.firstElementChild as HTMLElement & {
      rendered?: Promise<void>; shadowRoot: ShadowRoot; dataset: DOMStringMap;
    };
    await cal.rendered;

    const out: Record<string, unknown> = {};
    for (const [view, sel] of [['day', '.cal-days'], ['month', '.cal-months'], ['year', '.cal-years']] as const) {
      cal.dataset['view'] = view;
      await new Promise((res) => setTimeout(res, 40));
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
    await new Promise((res) => setTimeout(res, 40));
    menu.show(document.getElementById('t')!);
    await new Promise((res) => setTimeout(res, 40));

    const out: Record<string, { gridW: number; cols: number[] }> = {};
    for (const [view, sel] of [['day', '.cal-days'], ['month', '.cal-months'], ['year', '.cal-years']] as const) {
      cal.dataset['view'] = view;
      await new Promise((res) => setTimeout(res, 40));
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

  // 7 day columns at the node's own 32.
  expect(r['day']!.cols).toEqual([32, 32, 32, 32, 32, 32, 32]);

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
