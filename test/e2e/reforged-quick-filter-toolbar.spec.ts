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
