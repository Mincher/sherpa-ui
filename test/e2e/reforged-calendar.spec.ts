import { test, expect } from '@playwright/test';

/**
 * sherpa-calendar on the reforged base — a single-date month-grid picker. Exercises
 * the weekday header, the day grid (correct day count for the viewed month), the
 * selected-day highlight from data-value, prev/next month navigation re-rendering the
 * grid, and the datetime-change event on a day click.
 *
 * Not registered by the harness index — the spec imports its module in-page.
 */

const HARNESS = '/test/reforged/harness.html';

type CalEl = HTMLElement & { rendered?: Promise<void>; value?: string };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-calendar/sherpa-calendar.js');
    await customElements.whenDefined('sherpa-calendar');
  });
});

test('renders a 7-column weekday header and the month label', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-13'); // August 2026
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      // VISIBLE captions. A range calendar draws two months in one 15-track
      // grid, so a second set of seven and the divider spacer exist in the
      // template from the start and CSS reveals them — a single calendar still
      // shows the seven it always did.
      weekdays: [...s.querySelectorAll('.cal-weekdays span')].filter(
        (n) => getComputedStyle(n).display !== 'none',
      ).length,
      label: s.querySelector('.cal-label')!.textContent,
    };
  });
  expect(r.weekdays).toBe(7);
  expect(r.label).toBe('August 2026');
});

test('renders one day button per day of the viewed month (August 2026 = 31)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-13');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // Real day cells carry data-iso; blank spacers do not.
    const dayCells = el.shadowRoot!.querySelectorAll('.cal-cell[data-iso]');
    return { count: dayCells.length };
  });
  expect(r.count).toBe(31);
});

test('highlights the selected day from data-value', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-13');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const selected = el.shadowRoot!.querySelectorAll('.cal-cell[data-selected]');
    return {
      count: selected.length,
      iso: selected[0]?.getAttribute('data-iso'),
      // A cell is a composed sherpa-calendar-cell now, so its NUMBER lives in
      // its own shadow root — `data-label` is the API that put it there.
      text: (selected[0] as HTMLElement)?.dataset['label'],
      state: (selected[0] as HTMLElement)?.dataset['state'],
    };
  });
  expect(r.count).toBe(1);
  expect(r.iso).toBe('2026-08-13');
  expect(r.text).toBe('13');
  // …and it carries the cell component's own state, mirroring the node's axis.
  expect(r.state).toBe('selected');
});

test('next-month nav re-renders the grid to the following month', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-13');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    (s.querySelector('.cal-next') as HTMLButtonElement).click();
    return {
      label: s.querySelector('.cal-label')!.textContent,
      // September 2026 has 30 days.
      days: s.querySelectorAll('.cal-cell[data-iso]').length,
    };
  });
  expect(r.label).toBe('September 2026');
  expect(r.days).toBe(30);
});

test('prev-month nav crosses the year boundary (Jan → prior Dec)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-01-15');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    (s.querySelector('.cal-prev') as HTMLButtonElement).click();
    return { label: s.querySelector('.cal-label')!.textContent };
  });
  expect(r.label).toBe('December 2025');
});

test('clicking a day emits datetime-change with the ISO value and updates data-value', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-01');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let emitted: string | null = null;
    el.addEventListener('datetime-change', (e) => { emitted = (e as CustomEvent).detail.value; });

    const target = el.shadowRoot!.querySelector<HTMLButtonElement>('.cal-cell[data-iso="2026-08-20"]')!;
    target.click();

    return { emitted, dataValue: el.getAttribute('data-value'), value: el.value };
  });
  expect(r.emitted).toBe('2026-08-20');
  expect(r.dataValue).toBe('2026-08-20');
  expect(r.value).toBe('2026-08-20');
});

test('days outside data-min / data-max are disabled and do not emit', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-15');
    el.setAttribute('data-min', '2026-08-10');
    el.setAttribute('data-max', '2026-08-20');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let emitted = false;
    el.addEventListener('datetime-change', () => { emitted = true; });

    const s = el.shadowRoot!;
    const before = s.querySelector<HTMLButtonElement>('.cal-cell[data-iso="2026-08-05"]')!;
    const after = s.querySelector<HTMLButtonElement>('.cal-cell[data-iso="2026-08-25"]')!;
    const inRange = s.querySelector<HTMLButtonElement>('.cal-cell[data-iso="2026-08-15"]')!;

    before.click(); // disabled — pointer-events:none, but assert the attr + no emit anyway
    return {
      beforeDisabled: before.hasAttribute('disabled'),
      afterDisabled: after.hasAttribute('disabled'),
      inRangeDisabled: inRange.hasAttribute('disabled'),
      emitted,
    };
  });
  expect(r.beforeDisabled).toBe(true);
  expect(r.afterDisabled).toBe(true);
  expect(r.inRangeDisabled).toBe(false);
  expect(r.emitted).toBe(false);
});

test('clicking the label zooms out to the month picker, then the year picker', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-13');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    const label = () => s.querySelector('.cal-label')!.textContent;
    const daysVisible = () => getComputedStyle(s.querySelector('.cal-days')!).display !== 'none';
    const monthsVisible = () => getComputedStyle(s.querySelector('.cal-months')!).display !== 'none';
    const yearsVisible = () => getComputedStyle(s.querySelector('.cal-years')!).display !== 'none';

    const dayLabel = label();
    (s.querySelector('.cal-label') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const monthLayout = { label: label(), monthsVisible: monthsVisible(), daysVisible: daysVisible(), cells: s.querySelectorAll('.cal-months .cal-cell').length };

    (s.querySelector('.cal-label') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const yearLayout = { yearsVisible: yearsVisible(), cells: s.querySelectorAll('.cal-years .cal-cell').length };

    return { dayLabel, monthLayout, yearLayout };
  });
  expect(r.dayLabel).toBe('August 2026');
  expect(r.monthLayout.label).toBe('2026');       // month picker shows the year
  expect(r.monthLayout.monthsVisible).toBe(true);
  expect(r.monthLayout.daysVisible).toBe(false);
  expect(r.monthLayout.cells).toBe(12);           // Jan–Dec
  expect(r.yearLayout.yearsVisible).toBe(true);
  expect(r.yearLayout.cells).toBe(12);            // a 12-year block
});

test('picking a month zooms back into that month\'s days', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-13');
    el.setAttribute('data-view', 'month');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    // Click "Feb" (month index 1).
    const feb = Array.from(s.querySelectorAll<HTMLElement>('.cal-months .cal-cell')).find((c) => c.dataset['month'] === '1')!;
    feb.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      layout: el.getAttribute('data-view'),
      label: s.querySelector('.cal-label')!.textContent,
      daysVisible: getComputedStyle(s.querySelector('.cal-days')!).display !== 'none',
    };
  });
  expect(r.layout).toBe('day');
  expect(r.label).toBe('February 2026');
  expect(r.daysVisible).toBe(true);
});

test('picking a year zooms into that year\'s months', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-13');
    el.setAttribute('data-view', 'year');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    const y2024 = Array.from(s.querySelectorAll<HTMLElement>('.cal-years .cal-cell')).find((c) => c.dataset['year'] === '2024')!;
    y2024.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { layout: el.getAttribute('data-view'), label: s.querySelector('.cal-label')!.textContent };
  });
  expect(r.layout).toBe('month');
  expect(r.label).toBe('2024');
});

/* ── Type = range (two-click start→end) ─────────────────────────────────── */

test('range: two-click sets start then end, bands the days between, emits range-select', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-type', 'range');
    el.setAttribute('data-value', '2026-08-01'); // anchors the view to August 2026 (no range yet)
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;

    let detail: { start: string; end: string } | null = null;
    el.addEventListener('range-select', (e) => { detail = (e as CustomEvent).detail; });

    const day = (iso: string) => s.querySelector<HTMLButtonElement>(`.cal-cell[data-iso="${iso}"]`)!;

    // 1st click → start (no range-select yet)
    day('2026-08-10').click();
    const afterFirst = {
      start: el.getAttribute('data-value-start'),
      end: el.getAttribute('data-value-end'),
      emitted: detail,
      bandCount: s.querySelectorAll('.cal-cell[data-in-range]').length,
    };

    // 2nd click → end (range completes)
    day('2026-08-14').click();
    const afterSecond = {
      start: el.getAttribute('data-value-start'),
      end: el.getAttribute('data-value-end'),
      emitted: detail as { start: string; end: string } | null,
      band: Array.from(s.querySelectorAll<HTMLElement>('.cal-cell[data-in-range]')).map((c) => c.dataset['iso']),
      ends: Array.from(s.querySelectorAll<HTMLElement>('.cal-cell[data-range-end]')).map((c) => c.dataset['iso']),
    };
    return { afterFirst, afterSecond };
  });
  expect(r.afterFirst.start).toBe('2026-08-10');
  expect(r.afterFirst.end).toBe(null);
  expect(r.afterFirst.emitted).toBe(null);
  expect(r.afterFirst.bandCount).toBe(0);

  expect(r.afterSecond.start).toBe('2026-08-10');
  expect(r.afterSecond.end).toBe('2026-08-14');
  expect(r.afterSecond.emitted).toEqual({ start: '2026-08-10', end: '2026-08-14' });
  // Days strictly between the ends are banded (11,12,13); ends are NOT banded.
  expect(r.afterSecond.band).toEqual(['2026-08-11', '2026-08-12', '2026-08-13']);
  expect(r.afterSecond.ends.sort()).toEqual(['2026-08-10', '2026-08-14']);
});

test('range: end before start swaps the two ends', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-type', 'range');
    el.setAttribute('data-value', '2026-08-01');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    const day = (iso: string) => s.querySelector<HTMLButtonElement>(`.cal-cell[data-iso="${iso}"]`)!;

    let detail: { start: string; end: string } | null = null;
    el.addEventListener('range-select', (e) => { detail = (e as CustomEvent).detail; });

    day('2026-08-20').click(); // start later
    day('2026-08-05').click(); // end earlier → should swap
    return { start: el.getAttribute('data-value-start'), end: el.getAttribute('data-value-end'), detail: detail as { start: string; end: string } | null };
  });
  expect(r.start).toBe('2026-08-05');
  expect(r.end).toBe('2026-08-20');
  expect(r.detail).toEqual({ start: '2026-08-05', end: '2026-08-20' });
});

test('range: a third click starts a fresh range (clears the old end)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-type', 'range');
    el.setAttribute('data-value', '2026-08-01');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    const day = (iso: string) => s.querySelector<HTMLButtonElement>(`.cal-cell[data-iso="${iso}"]`)!;
    day('2026-08-05').click();
    day('2026-08-10').click(); // completes 5→10
    day('2026-08-20').click(); // 3rd → new start, end cleared
    return { start: el.getAttribute('data-value-start'), end: el.getAttribute('data-value-end') };
  });
  expect(r.start).toBe('2026-08-20');
  expect(r.end).toBe(null);
});

/* ── hasTime (native <input type=time>) ─────────────────────────────────── */

test('hasTime: the time input shows only when data-has-time is set', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const withTime = document.createElement('sherpa-calendar') as CalEl;
    withTime.setAttribute('data-value', '2026-08-13');
    withTime.setAttribute('data-has-time', '');
    const without = document.createElement('sherpa-calendar') as CalEl;
    without.setAttribute('data-value', '2026-08-13');
    document.getElementById('root')!.append(withTime, without);
    await withTime.rendered; await without.rendered;
    const rowDisplay = (el: CalEl) => getComputedStyle(el.shadowRoot!.querySelector('.cal-time-row')!).display;
    return {
      shownDisplay: rowDisplay(withTime),
      hiddenDisplay: rowDisplay(without),
      inputType: withTime.shadowRoot!.querySelector<HTMLInputElement>('.cal-time')!.type,
    };
  });
  expect(r.shownDisplay).not.toBe('none');
  expect(r.hiddenDisplay).toBe('none');
  expect(r.inputType).toBe('time');
});

test('hasTime: picking a day folds the time into data-value (YYYY-MM-DDThh:mm) and emits it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-01');
    el.setAttribute('data-has-time', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    const input = s.querySelector<HTMLInputElement>('.cal-time')!;

    // set a time first, then pick a day — day-pick should combine them
    input.value = '09:30';

    let emitted: string | null = null;
    el.addEventListener('datetime-change', (e) => { emitted = (e as CustomEvent).detail.value; });

    s.querySelector<HTMLButtonElement>('.cal-cell[data-iso="2026-08-20"]')!.click();
    const afterDay = { value: el.getAttribute('data-value'), emitted };

    // now change the time — it should re-combine with the chosen date and re-emit
    input.value = '14:45';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const afterTime = { value: el.getAttribute('data-value'), emitted };
    return { afterDay, afterTime };
  });
  expect(r.afterDay.value).toBe('2026-08-20T09:30');
  expect(r.afterDay.emitted).toBe('2026-08-20T09:30');
  expect(r.afterTime.value).toBe('2026-08-20T14:45');
  expect(r.afterTime.emitted).toBe('2026-08-20T14:45');
});

test('single mode (default) selection is unchanged by the new features', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-value', '2026-08-13');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      type: el.getAttribute('data-type'), // unset → single default
      selected: s.querySelectorAll('.cal-cell[data-selected]').length,
      band: s.querySelectorAll('.cal-cell[data-in-range]').length,
      timeHidden: getComputedStyle(s.querySelector('.cal-time-row')!).display,
    };
  });
  expect(r.type).toBe(null);
  expect(r.selected).toBe(1);
  expect(r.band).toBe(0);
  expect(r.timeHidden).toBe('none');
});

/**
 * A RANGE calendar draws TWO months side by side.
 *
 * Figma's Type=range (268:13874) is a 15-track grid — seven day columns, a
 * divider, seven more. A range is a span between two dates, and picking one
 * whose ends fall in different months through a single month that has to be
 * stepped is the case the second month exists for.
 */
test('data-type="range" draws two months in one 15-track grid', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const box = document.createElement('div');
    box.style.inlineSize = '480px';
    document.getElementById('root')!.replaceChildren(box);

    const el = document.createElement('sherpa-calendar') as CalEl;
    el.setAttribute('data-type', 'range');
    el.setAttribute('data-value-start', '2026-09-10');
    el.setAttribute('data-value-end', '2026-10-05');
    box.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const s = el.shadowRoot!;
    const grid = s.querySelector('.cal-days') as HTMLElement;
    const gb = grid.getBoundingClientRect();
    const cells = [...grid.querySelectorAll('sherpa-calendar-cell')] as HTMLElement[];
    const days = cells.filter((c) => !c.hasAttribute('data-blank'));
    const track = gb.width / 15;
    const colOf = (iso: string): number | null => {
      const c = days.find((x) => x.dataset['iso'] === iso);
      return c ? Math.round((c.getBoundingClientRect().x - gb.x) / track) + 1 : null;
    };

    // Both months must share the SAME rows. Left to auto-flow they stacked —
    // September's five rows then October's five, nine deep instead of five
    // across — so each cell states its row as well as its column.
    const rows = new Set(cells.map((c) => Math.round(c.getBoundingClientRect().y)));

    // …and nothing may overlap, which is what a wrong column would cause.
    const boxes = cells.map((c) => c.getBoundingClientRect());
    let overlaps = 0;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) {
          overlaps++;
        }
      }
    }

    return {
      label: s.querySelector('.cal-label')!.textContent,
      tracks: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      weekdays: [...s.querySelectorAll('.cal-weekdays span')].filter(
        (n) => getComputedStyle(n).display !== 'none',
      ).length,
      september: days.filter((c) => c.dataset['iso']?.startsWith('2026-09')).length,
      october: days.filter((c) => c.dataset['iso']?.startsWith('2026-10')).length,
      // September occupies tracks 1..7 and October 9..15, leaving 8 as the rule.
      sep1Col: colOf('2026-09-01'),
      oct1Col: colOf('2026-10-01'),
      rowCount: rows.size,
      overlaps,
      // The range bands ACROSS the two months, which is the whole point.
      startState: days.find((c) => c.dataset['iso'] === '2026-09-10')?.getAttribute('data-state'),
      endState: days.find((c) => c.dataset['iso'] === '2026-10-05')?.getAttribute('data-state'),
      banded: days.filter((c) => c.getAttribute('data-state') === 'range-mid').length,
    };
  });

  // The stepper names BOTH months — it moves the pair, so a header reading only
  // the left one would say the wrong thing about half of what is on screen. The
  // year is stated once when the two share it.
  expect(r.label).toBe('September – October 2026');

  expect(r.tracks).toBe(15);
  expect(r.weekdays).toBe(15);

  expect(r.september).toBe(30);
  expect(r.october).toBe(31);

  // Each month in its own seven tracks, track 8 the divider between them.
  expect(r.sep1Col).toBeLessThanOrEqual(7);
  expect(r.oct1Col).toBeGreaterThanOrEqual(9);

  expect(r.rowCount).toBe(5);
  expect(r.overlaps).toBe(0);

  expect(r.startState).toBe('range-start');
  expect(r.endState).toBe('range-end');
  // 10 Sep → 5 Oct: 20 remaining days of September plus 4 of October.
  expect(r.banded).toBe(24);
});
