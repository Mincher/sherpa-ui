import { test, expect } from '@playwright/test';

/**
 * sherpa-scheduler on the reforged base — a recurrence / frequency picker.
 * Exercises the default weekly layout, CSS-driven conditional field visibility
 * per frequency, the frequency select (composed change → read via composedPath),
 * and the schedule-change event carrying the assembled payload.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-scheduler'));
});

interface SchedulerEl extends HTMLElement {
  rendered?: Promise<void>;
  value?: { frequency: string; weekdays?: string[]; interval?: number; time?: string };
}

test('defaults to weekly and shows the weekday + time rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-scheduler') as unknown as SchedulerEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 10));
    const s = el.shadowRoot!;
    return {
      frequency: el.getAttribute('data-frequency'),
      weeklyVisible: getComputedStyle(s.querySelector('.row-weekly')!).display !== 'none',
      timeVisible: getComputedStyle(s.querySelector('.row-time')!).display !== 'none',
      hourlyHidden: getComputedStyle(s.querySelector('.row-hourly')!).display === 'none',
    };
  });
  expect(r.frequency).toBe('weekly');
  expect(r.weeklyVisible).toBe(true);
  expect(r.timeVisible).toBe(true);
  expect(r.hourlyHidden).toBe(true);
});

test('changing frequency reveals the frequency-specific fields (CSS-driven)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-scheduler') as unknown as SchedulerEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-frequency', 'hourly');
    await new Promise((res) => setTimeout(res, 10));
    const s = el.shadowRoot!;
    return {
      hourlyVisible: getComputedStyle(s.querySelector('.row-hourly')!).display !== 'none',
      weeklyHidden: getComputedStyle(s.querySelector('.row-weekly')!).display === 'none',
    };
  });
  expect(r.hourlyVisible).toBe(true);
  expect(r.weeklyHidden).toBe(true);
});

test('selecting a weekday fires schedule-change with the payload', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-scheduler') as unknown as SchedulerEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 10));
    const s = el.shadowRoot!;

    type Payload = { frequency: string; weekdays?: string[] };
    const captured: Payload[] = [];
    el.addEventListener('schedule-change', (e) => captured.push((e as CustomEvent).detail.value));

    // Tick Monday (value "2") in the weekday row.
    const mon = Array.from(s.querySelectorAll<HTMLInputElement>('.weekday-input')).find(
      (i) => i.value === '2',
    )!;
    mon.click();
    await new Promise((res) => setTimeout(res, 10));
    return { detail: captured.at(-1) ?? null, value: el.value };
  });
  expect(r.detail).not.toBeNull();
  expect(r.detail!.frequency).toBe('weekly');
  expect(r.detail!.weekdays).toEqual(['2']);
  expect(r.value!.weekdays).toEqual(['2']);
});

test('the frequency select change (composed) updates data-frequency', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-scheduler') as unknown as SchedulerEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 20));
    const s = el.shadowRoot!;

    const select = s.querySelector('.freq-select') as HTMLElement & {
      rendered?: Promise<void>;
      value?: string;
    };
    await select.rendered;
    // Drive the inner native <select> and dispatch change, as a user would.
    const native = select.shadowRoot!.querySelector<HTMLSelectElement>('.control')!;
    native.value = 'daily';
    native.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 10));
    return {
      frequency: el.getAttribute('data-frequency'),
      dailyTimeVisible: getComputedStyle(s.querySelector('.row-time')!).display !== 'none',
    };
  });
  expect(r.frequency).toBe('daily');
  expect(r.dailyTimeVisible).toBe(true);
});
