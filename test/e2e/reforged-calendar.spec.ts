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
      weekdays: s.querySelectorAll('.cal-weekdays span').length,
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
      text: selected[0]?.textContent,
    };
  });
  expect(r.count).toBe(1);
  expect(r.iso).toBe('2026-08-13');
  expect(r.text).toBe('13');
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
    await new Promise((res) => setTimeout(res, 0));
    const monthLayout = { label: label(), monthsVisible: monthsVisible(), daysVisible: daysVisible(), cells: s.querySelectorAll('.cal-months .cal-cell').length };

    (s.querySelector('.cal-label') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 0));
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
    await new Promise((res) => setTimeout(res, 0));
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
    await new Promise((res) => setTimeout(res, 0));
    return { layout: el.getAttribute('data-view'), label: s.querySelector('.cal-label')!.textContent };
  });
  expect(r.layout).toBe('month');
  expect(r.label).toBe('2024');
});
