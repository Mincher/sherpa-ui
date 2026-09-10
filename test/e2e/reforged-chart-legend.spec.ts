import { test, expect } from '@playwright/test';

/** sherpa-chart-legend — rows from populate(); swatch colour by categorical index; click event. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders a row per item with label + value and categorical swatches', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { label: 'Revenue', value: '48k', colorIndex: 1 },
      { label: 'Cost', value: '12k', colorIndex: 5 },
    ]);
    await new Promise((res) => setTimeout(res, 10));
    const rows = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.item'));
    return {
      count: rows.length,
      firstLabel: rows[0]!.querySelector('.label')!.textContent,
      firstValue: rows[0]!.querySelector('.value')!.textContent,
      // Figma Legend Item swatch: the series hue as a SOLID 1px ring, with a 60%
      // tint of the same hue as the fill.
      ring1: getComputedStyle(rows[0]!.querySelector('.swatch')!).borderTopColor,
      ring5: getComputedStyle(rows[1]!.querySelector('.swatch')!).borderTopColor,
      fill1: getComputedStyle(rows[0]!.querySelector('.swatch')!).backgroundColor,
    };
  });
  expect(r.count).toBe(2);
  expect(r.firstLabel).toBe('Revenue');
  expect(r.firstValue).toBe('48k');
  expect(r.ring1).toBe('rgb(123, 28, 230)'); // categorical-1 #7b1ce6
  expect(r.ring5).toBe('rgb(65, 65, 239)'); // categorical-5 #4141ef
  expect(r.fill1).toContain('0.6'); // the 60% tint (color-mix → color(srgb … / 0.6))
});

test('clicking an entry fires legend-item-click and toggles aria-pressed', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'A' }, { label: 'B' }]);
    await new Promise((res) => setTimeout(res, 10));

    const detail: Array<{ index: number; active: boolean }> = [];
    el.addEventListener('legend-item-click', (e) =>
      detail.push((e as CustomEvent).detail as { index: number; active: boolean }),
    );

    // The entry IS the button now — the rebuilt Figma legend is a grid of
    // three-track entries, not an <li> wrapping a row.
    const entryB = el.shadowRoot!.querySelectorAll<HTMLElement>('.item')[1]!;
    const before = entryB.getAttribute('aria-pressed');
    entryB.click();
    // `.item` transitions colour over 100ms, so reading it in the same task
    // catches the START of the animation, not the target. Wait for the
    // transition rather than sleeping an arbitrary amount.
    await new Promise<void>((resolve) => {
      const done = (): void => resolve();
      entryB.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 300);
    });
    const off = {
      pressed: entryB.getAttribute('aria-pressed'),
      // Dimmed via the inactive content ink, never opacity.
      colour: getComputedStyle(entryB).color,
      swatchBg: getComputedStyle(entryB.querySelector('.swatch')!).backgroundColor,
    };
    entryB.click();
    await new Promise((res) => setTimeout(res, 5));
    return { before, off, backOn: entryB.getAttribute('aria-pressed'), detail };
  });

  // aria-pressed is BOTH the accessible state and the CSS hook, so they cannot
  // disagree — it replaced a data-current attribute that duplicated it.
  expect(r.before).toBe('true');
  expect(r.off.pressed).toBe('false');
  expect(r.backOn).toBe('true');

  // Toggled off dims the ink and empties the swatch, rather than using opacity.
  expect(r.off.colour).toBe('rgb(179, 179, 195)');
  expect(r.off.swatchBg).toBe('rgba(0, 0, 0, 0)');

  // The event carries the index AND the new state, which is what the page needs
  // to call the chart's setSeriesHidden / setSliceHidden.
  //
  // `indices` joined it when the legend gained its six-row cap: past six entries
  // the tail rolls into one "Other" row, so a single row can stand for SEVERAL
  // series and an index alone cannot describe what to hide. For an uncapped row it
  // is just [index].
  expect(r.detail).toEqual([
    { index: 1, indices: [1], label: 'B', active: false },
    { index: 1, indices: [1], label: 'B', active: true },
  ]);
});

test('a legend caps at six rows, rolling the tail into an Other total', async ({ page }) => {
  // Past six rows a legend stops being a key — nobody matches the eleventh shade
  // of purple to its label, and beside a chart it outgrows the chart.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;

    const read = () => ({
      rows: el.shadowRoot!.querySelectorAll('.item').length,
      labels: Array.from(el.shadowRoot!.querySelectorAll('.label')).map((l) => l.textContent),
      values: Array.from(el.shadowRoot!.querySelectorAll('.value')).map((v) => v.textContent),
    });

    // EXACTLY six: nothing is rolled up, because "Other" would name one category.
    el.populate(Array.from({ length: 6 }, (_, i) => ({ label: `C${i}`, value: i + 1 })));
    await new Promise((res) => setTimeout(res, 20));
    const exact = read();

    // NINE: five named + Other = 6 + 7 + 8 + 9 = 30.
    el.populate(Array.from({ length: 9 }, (_, i) => ({ label: `C${i}`, value: i + 1 })));
    await new Promise((res) => setTimeout(res, 20));
    const capped = read();

    let detail: { index: number; indices: number[] } | null = null;
    el.addEventListener('legend-item-click', (e) => {
      detail = (e as CustomEvent).detail;
    });
    el.shadowRoot!.querySelectorAll<HTMLElement>('.item')[5]!.click();

    // No numeric values at all → an "Other" row with NO value, rather than a
    // meaningless 0.
    el.populate(Array.from({ length: 9 }, (_, i) => ({ label: `C${i}` })));
    await new Promise((res) => setTimeout(res, 20));
    const noValues = read();

    return { exact, capped, detail, noValues };
  });

  // Six is not capped — the roll-up must BUY something.
  expect(r.exact.rows).toBe(6);
  expect(r.exact.labels).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'C5']);

  // Nine becomes five named plus a total, and the numbers still add to the whole.
  expect(r.capped.rows).toBe(6);
  expect(r.capped.labels).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'Other']);
  expect(r.capped.values).toEqual(['1', '2', '3', '4', '5', '30']);

  // The Other row stands for EVERY rolled-up series, so toggling it hides them all.
  expect(r.detail?.index).toBe(5);
  expect(r.detail?.indices).toEqual([5, 6, 7, 8]);

  // Nothing to sum → no value, not a zero.
  expect(r.noValues.labels).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'Other']);
  expect(r.noValues.values).toEqual(['', '', '', '', '', '']);
});

test('entries share three grid tracks, so labels and values align', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // Deliberately RAGGED label lengths — with one flex row per entry the values
    // would each sit wherever their own label ended.
    el.populate!([
      { label: 'A', value: '1.5K' },
      { label: 'A much longer category name', value: '22' },
      { label: 'Mid length', value: '333' },
    ]);
    await new Promise((res) => setTimeout(res, 10));

    const sr = el.shadowRoot!;
    const legend = getComputedStyle(sr.querySelector('.legend')!);
    const entries = Array.from(sr.querySelectorAll<HTMLElement>('.item'));
    const cells = (sel: string): number[] =>
      entries.map((e) => Math.round(e.querySelector(sel)!.getBoundingClientRect().left));
    return {
      display: legend.display,
      columnGap: legend.columnGap,
      rowGap: legend.rowGap,
      padding: legend.paddingTop,
      // Figma: content/size/xs 10 on line-height/xs 16.
      fontSize: getComputedStyle(entries[0]!).fontSize,
      lineHeight: getComputedStyle(entries[0]!).lineHeight,
      swatchLefts: cells('.swatch'),
      labelLefts: cells('.label'),
      valueRights: entries.map((e) =>
        Math.round(e.querySelector('.value')!.getBoundingClientRect().right),
      ),
      swatchBox: (() => {
        const b = entries[0]!.querySelector('.swatch')!.getBoundingClientRect();
        return `${Math.round(b.width)}x${Math.round(b.height)}`;
      })(),
    };
  });

  expect(r.display).toBe('grid');
  // Figma: column gap space/xs 8, row gap space/2xs 4, padding space/xs 8.
  expect(r.columnGap).toBe('8px');
  expect(r.rowGap).toBe('4px');
  expect(r.padding).toBe('8px');
  expect(r.fontSize).toBe('10px');
  expect(r.lineHeight).toBe('16px');
  // Figma "Legend Swatch": 12×12.
  expect(r.swatchBox).toBe('12x12');

  // THE POINT OF THE GRID: one shared set of tracks, so every column lines up
  // despite the ragged labels.
  expect(new Set(r.swatchLefts).size).toBe(1);
  expect(new Set(r.labelLefts).size).toBe(1);
  expect(new Set(r.valueRights).size).toBe(1);
});
