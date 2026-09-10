import { test, expect } from '@playwright/test';

/** sherpa-barchart — bars from populate(); height = value/max via --_h; bar-click event. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders a bar per datum with height proportional to the max', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { label: 'Q1', value: 50 }, // 50% of max(100)
      { label: 'Q2', value: 100 }, // 100%
      { label: 'Q3', value: 25 }, // 25%
    ]);
    await new Promise((res) => setTimeout(res, 10));
    const bars = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.bar'));
    return {
      count: bars.length,
      heights: bars.map((b) => b.style.getPropertyValue('--_h')),
      labels: Array.from(el.shadowRoot!.querySelectorAll('.bar-label')).map((l) => l.textContent),
    };
  });
  expect(r.count).toBe(3);
  expect(r.heights).toEqual(['50%', '100%', '25%']);
  expect(r.labels).toEqual(['Q1', 'Q2', 'Q3']);
});

test('clicking a bar fires bar-click with the datum', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'A', value: 10 }, { label: 'B', value: 20 }]);
    await new Promise((res) => setTimeout(res, 10));

    let detail: { index: number; label: string; value: number } | null = null;
    el.addEventListener('bar-click', (e) => (detail = (e as CustomEvent).detail));

    const second = el.shadowRoot!.querySelectorAll<HTMLElement>('.bar-col')[1]!;
    second.click();
    return detail;
  });
  expect(r).toEqual({ index: 1, label: 'B', value: 20 });
});

test('bars use the data-viz series ramp: translucent fill, solid 1px stroke', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { label: 'A', value: 5, colorIndex: 1 },
      { label: 'B', value: 3, colorIndex: 2 },
    ]);
    await new Promise((res) => setTimeout(res, 20));

    const bars = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.bar'));
    return bars.map((bar) => {
      const s = getComputedStyle(bar);
      return {
        // The var the TS writes must actually RESOLVE. `--sherpa-categorical-N`
        // never existed, so it resolved to nothing and the fill fell back to the
        // property's initial value — black bars.
        hue: s.getPropertyValue('--_hue').trim(),
        background: s.backgroundColor,
        borderColor: s.borderTopColor,
        borderWidth: s.borderTopWidth,
      };
    });
  });

  expect(r).toHaveLength(2);

  // Figma Data Field: each Bar is the series hue at 60% with a solid 1px stroke in
  // the SAME hue, so overlapping marks stay readable and a thin bar still shows.
  const [a, b] = r as Array<Record<string, string>>;
  expect(a!['hue']).toBe('#7b1ce6'); // data-viz series 1
  expect(b!['hue']).toBe('#c046ff'); // data-viz series 2
  expect(a!['borderColor']).toBe('rgb(123, 28, 230)');
  expect(a!['borderWidth']).toBe('1px');
  // A translucent fill: 60% alpha, and NOT the initial black.
  expect(a!['background']).not.toBe('rgb(0, 0, 0)');
  expect(a!['background']).toMatch(/0\.6\)/);
});
