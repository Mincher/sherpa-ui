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
