import { test, expect } from '@playwright/test';

/** sherpa-input-date-range — two date controls, value {start,end}, cross-binding, change event. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders two date controls with the label, value is {start,end}', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-date-range') as HTMLElement & {
      rendered?: Promise<void>;
      value?: { start: string; end: string };
    };
    el.setAttribute('data-label', 'Reporting period');
    el.setAttribute('data-start', '2026-01-01');
    el.setAttribute('data-end', '2026-03-31');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const controls = el.shadowRoot!.querySelectorAll<HTMLInputElement>('.control');
    return {
      label: el.shadowRoot!.querySelector('.label')!.textContent,
      count: controls.length,
      type: controls[0]!.type,
      value: el.value,
    };
  });
  expect(r.label).toBe('Reporting period');
  expect(r.count).toBe(2);
  expect(r.type).toBe('date');
  expect(r.value).toEqual({ start: '2026-01-01', end: '2026-03-31' });
});

test('cross-binds the controls and fires change with the range', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-date-range') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired: { start: string; end: string } | null = null;
    el.addEventListener('change', (e) => (fired = (e as CustomEvent).detail));

    const start = el.shadowRoot!.querySelector<HTMLInputElement>('.control.start')!;
    const end = el.shadowRoot!.querySelector<HTMLInputElement>('.control.end')!;
    start.value = '2026-05-10';
    start.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 5));

    return { fired, endMin: end.min }; // start's value becomes end's min
  });
  expect(r.fired).toEqual({ start: '2026-05-10', end: '' });
  expect(r.endMin).toBe('2026-05-10'); // cross-bind: end can't precede start
});
