import { test, expect } from './harness';

/**
 * EVERY CHART DATUM IS REACHABLE WITHOUT A POINTER.
 *
 * A tooltip carries the number; if only `:hover` reveals it, the number is
 * pointer-only. The bar and line charts already made each mark a `<button>`.
 * The donut and gauge did not: their tips were lit by `:hover` on an SVG arc
 * with no `tabindex`, so **zero** of their data was reachable — while the
 * gauge's own comment said the accessible name went "on the ARC, which is what
 * a reader reaches".
 *
 * TRAP T-a-chart-datum-is-reachable-without-a-pointer
 */

const CHARTS = [
  {
    tag: 'sherpa-donut-chart',
    data: [
      { label: 'Windows', value: 243, colorIndex: 1 },
      { label: 'macOS', value: 241, colorIndex: 2 },
      { label: 'Linux', value: 240, colorIndex: 3 },
    ],
    mark: '.slice',
    expect: 3,
  },
  {
    tag: 'sherpa-barchart',
    data: [
      { label: 'Disk', value: 403, colorIndex: 1 },
      { label: 'CPU', value: 81, colorIndex: 2 },
    ],
    mark: '.bar-col',
    expect: 2,
  },
];

for (const chart of CHARTS) {
  test(`${chart.tag}: every mark takes focus and names its datum`, async ({ page }) => {
    const r = await page.evaluate(async ({ tag, data, mark }) => {
      const el = document.createElement(tag) as HTMLElement & {
        rendered?: Promise<void>; populate?: (d: unknown) => void;
      };
      document.getElementById('root')!.appendChild(el);
      await customElements.whenDefined(tag);
      await el.rendered;
      el.populate!(data);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();

      const sr = el.shadowRoot!;
      const marks = Array.from(sr.querySelectorAll<HTMLElement>(mark));

      // Focus the first, the way Tab would.
      marks[0]?.focus();
      await new Promise((res) => setTimeout(res, 150));
      const tip = sr.querySelector('.chart-tip[data-index="0"]') ?? sr.querySelector('.chart-tip');

      return {
        marks: marks.length,
        // A mark is reachable when it is a button or carries tabindex.
        reachable: marks.filter(
          (m) => m.tagName === 'BUTTON' || m.getAttribute('tabindex') === '0',
        ).length,
        // …and NAMES what it stands for, or a screen reader announces nothing.
        named: marks.filter(
          (m) => (m.getAttribute('aria-label') ?? m.textContent ?? '').trim().length > 0,
        ).length,
        focused: sr.activeElement === marks[0],
        // The tooltip is the number; focus must reveal it, not only hover.
        tipOnFocus: tip ? getComputedStyle(tip).display : 'no tip',
      };
    }, chart);

    expect(r.marks).toBe(chart.expect);
    expect(r.reachable).toBe(chart.expect);
    expect(r.named).toBe(chart.expect);
    expect(r.focused).toBe(true);
    expect(r.tipOnFocus).not.toBe('none');
  });
}

test('sherpa-gauge-chart: every zone takes focus and names its band', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-gauge-chart') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void;
    };
    // The zones ARE the data here — a gauge shows one value against bands.
    el.setAttribute('data-min', '0');
    el.setAttribute('data-max', '100');
    el.setAttribute('data-zones', '0-60:success,60-85:warning,85-100:critical');
    document.getElementById('root')!.appendChild(el);
    await customElements.whenDefined('sherpa-gauge-chart');
    await el.rendered;
    el.populate!(72);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const zones = Array.from(sr.querySelectorAll<HTMLElement>('.zone'));
    zones[0]?.focus();
    await new Promise((res) => setTimeout(res, 150));
    const tip = sr.querySelector('.chart-tip[data-index="0"]');

    return {
      zones: zones.length,
      reachable: zones.filter((z) => z.getAttribute('tabindex') === '0').length,
      firstLabel: zones[0]?.getAttribute('aria-label') ?? '',
      focused: sr.activeElement === zones[0],
      tipOnFocus: tip ? getComputedStyle(tip).display : 'no tip',
    };
  });

  expect(r.zones).toBe(3);
  expect(r.reachable).toBe(3);
  // The band's own range, not a bare index.
  expect(r.firstLabel).toContain('0');
  expect(r.firstLabel).toContain('60');
  expect(r.focused).toBe(true);
  expect(r.tipOnFocus).not.toBe('none');
});
