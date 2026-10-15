import { test, expect } from './harness';

/**
 * Every iOS browser is WebKit inside, and has no `Temporal` yet. The calendar
 * then draws from the stand-in — and must draw the SAME days, months and
 * years as `Temporal` does. Will, TODO 255. TRAP T-temporal-is-the-date-model
 */
test('with Temporal taken away, the calendar draws exactly what it drew with it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const draw = async (): Promise<Record<string, unknown>> => {
      const el = document.createElement('sherpa-calendar') as HTMLElement & { rendered: Promise<void> };
      el.setAttribute('data-embedded', '');
      el.setAttribute('value', '2024-02-10');
      root.replaceChildren(el);
      await el.rendered;
      await window.__settled();
      const sr = el.shadowRoot!;
      const click = async (sel: string): Promise<void> => {
        sr.querySelector<HTMLElement>(sel)!.click();
        await window.__settled();
      };
      const month = () => ({
        label: sr.querySelector('.cal-label')?.textContent?.trim(),
        days: [...sr.querySelectorAll<HTMLElement>('[data-iso], [data-blank]')]
          .map((c) => c.dataset['iso'] ?? `blank@${c.style.gridColumn}`),
      });
      const cells = (sel: string) => [...sr.querySelectorAll<HTMLElement>(`${sel} .cal-cell`)]
        .map((c) => [c.textContent?.trim(), c.hasAttribute('data-selected')]);
      const feb = month();
      await click('.cal-prev');
      const jan = month();
      await click('.cal-label');
      const months = cells('.cal-months');
      await click('.cal-label');
      return { feb, jan, months, years: cells('.cal-years') };
    };
    const withIt = await draw();
    const saved = (globalThis as { Temporal?: unknown }).Temporal;
    Reflect.deleteProperty(globalThis, 'Temporal');
    try {
      const without = await draw();
      return { withIt, without, gone: typeof (globalThis as { Temporal?: unknown }).Temporal };
    } finally {
      (globalThis as { Temporal?: unknown }).Temporal = saved;
    }
  });
  expect(r.gone).toBe('undefined');
  const feb = r.withIt['feb'] as { label: string; days: string[] };
  // 1 February 2024 is a Thursday: three blanks, Monday to Wednesday, then 29 days.
  expect(feb.days.slice(0, 4)).toEqual(['blank@1', 'blank@2', 'blank@3', '2024-02-01']);
  expect(feb.days.at(-1)).toBe('2024-02-29');
  expect(feb.label).toMatch(/2024/);
  expect((r.withIt['months'] as unknown[]).length).toBe(12);
  expect((r.withIt['years'] as unknown[]).length).toBe(12);
  expect(r.without).toEqual(r.withIt);
});
