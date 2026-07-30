import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

const settle = () => new Promise((r) => setTimeout(r, 150));

/* ── sherpa-transfer-list ──────────────────────────────────────── */

test('sherpa-transfer-list setOptions renders panes; adding an item updates selection + fires transfer-change', async ({ page }) => {
  await mount(page, `<sherpa-transfer-list></sherpa-transfer-list>`, 'sherpa-transfer-list');
  await settle();
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-transfer-list') as HTMLElement & {
      rendered: Promise<void>;
      setOptions: (o: unknown) => void;
      getSelectedValues: () => string[];
    };
    await el.rendered;
    let detail: any = null;
    el.addEventListener('transfer-change', (e: any) => (detail = e.detail));
    el.setOptions([
      { value: 'a', label: 'Apple' },
      { value: 'b', label: 'Banana' },
      { value: 'c', label: 'Cherry', selected: true },
    ]);
    const sr = el.shadowRoot!;
    const sourceItemsBefore = sr.querySelectorAll('.source-list sherpa-list-item').length;
    const targetItemsBefore = sr.querySelectorAll('.target-list sherpa-list-item').length;

    // Check the "Apple" option in the source pane, then click Add-selected.
    const appleCheck = sr.querySelector('.source-list sherpa-list-item[data-value="a"] .option-check') as HTMLElement;
    appleCheck.setAttribute('data-checked', ''); // put it in a checked state
    appleCheck.dispatchEvent(new Event('change', { bubbles: true }));
    (sr.querySelector('.ctrl-add') as HTMLElement).dispatchEvent(new CustomEvent('button-click', { bubbles: true }));

    return {
      sourceItemsBefore,
      targetItemsBefore,
      selected: el.getSelectedValues().slice().sort(),
      targetItemsAfter: sr.querySelectorAll('.target-list sherpa-list-item').length,
      detail,
    };
  });
  expect(r.sourceItemsBefore).toBe(2); // a, b unselected
  expect(r.targetItemsBefore).toBe(1); // c pre-selected
  expect(r.selected).toEqual(['a', 'c']);
  expect(r.targetItemsAfter).toBe(2);
  expect(r.detail).toMatchObject({ direction: 'add', moved: ['a'] });
  expect(r.detail.values.slice().sort()).toEqual(['a', 'c']);
});

/* ── sherpa-key-value-list ─────────────────────────────────────── */
// The default template renders its dt/dd pairs directly into the shadow <dl>.

test('sherpa-key-value-list renders dt/dd pairs into the shadow definition list', async ({ page }) => {
  await mount(page, `<sherpa-key-value-list data-layout="horizontal"></sherpa-key-value-list>`, 'sherpa-key-value-list');
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-key-value-list')!;
    const sr = el.shadowRoot!;
    return {
      hasList: !!sr.querySelector('dl[part="list"]'),
      terms: sr.querySelectorAll('dl dt').length,
      defs: sr.querySelectorAll('dl dd').length,
      firstTerm: sr.querySelector('dl dt')!.textContent,
      layout: (el as HTMLElement).dataset['layout'],
    };
  });
  expect(r.hasList).toBe(true);
  expect(r.terms).toBe(7);
  expect(r.defs).toBe(7);
  expect(r.firstTerm).toBe('Name');
  expect(r.layout).toBe('horizontal');
});

/* ── sherpa-progress-step-tracker ──────────────────────────────── */

test('sherpa-progress-step-tracker setSteps renders steps; data-current-step marks active', async ({ page }) => {
  await mount(page, `<sherpa-progress-step-tracker data-current-step="2"></sherpa-progress-step-tracker>`, 'sherpa-progress-step-tracker');
  await settle();
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-progress-step-tracker') as HTMLElement & {
      rendered: Promise<void>;
      setSteps: (s: unknown) => void;
    };
    await el.rendered;
    let changeDetail: any = null;
    el.addEventListener('step-change', (e: any) => (changeDetail = e.detail));
    el.setSteps([
      { label: 'Account' },
      { label: 'Profile' },
      { label: 'Review' },
    ]);
    const sr = el.shadowRoot!;
    const items = sr.querySelectorAll('.tracker-steps .step-item');
    const activeStatus = items[1]?.getAttribute('data-status');
    const completedStatus = items[0]?.getAttribute('data-status');
    // Click step 3 to drive navigation → step-change.
    (items[2] as HTMLElement).click();
    return {
      count: items.length,
      firstLabel: sr.querySelector('.step-label')!.textContent,
      completedStatus,
      activeStatus,
      changeDetail,
    };
  });
  expect(r.count).toBe(3);
  expect(r.firstLabel).toBe('Account');
  expect(r.completedStatus).toBe('completed'); // step 1 is before current
  expect(r.activeStatus).toBe('active');       // step 2 is current
  expect(r.changeDetail).toMatchObject({ currentStep: 3, previousStep: 2, label: 'Review' });
});

/* ── sherpa-scheduler ──────────────────────────────────────────── */

test('sherpa-scheduler renders frequency; an input change fires schedule-change with the payload', async ({ page }) => {
  await mount(page, `<sherpa-scheduler data-frequency="weekly"></sherpa-scheduler>`, 'sherpa-scheduler');
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-scheduler') as HTMLElement & { value: { frequency: string } };
    const sr = el.shadowRoot!;
    let detail: any = null;
    el.addEventListener('schedule-change', (e: any) => (detail = e.detail));
    // A change on a frequency-specific input triggers #readFromInputs + emit.
    (sr.querySelector('.time-of-day') as HTMLElement).dispatchEvent(new Event('change', { bubbles: true }));
    return {
      frequency: el.dataset['frequency'],
      hasFreqSelect: !!sr.querySelector('.freq-select'),
      detailFreq: detail?.value?.frequency,
      hasWeekdays: Array.isArray(detail?.value?.weekdays),
    };
  });
  expect(r.frequency).toBe('weekly');
  expect(r.hasFreqSelect).toBe(true);
  expect(r.detailFreq).toBe('weekly');
  expect(r.hasWeekdays).toBe(true); // weekly payload carries a weekdays array
});

/* ── sherpa-calendar ───────────────────────────────────────────── */

test('sherpa-calendar date mode: selecting a day fires datetime-change with an ISO value', async ({ page }) => {
  await mount(page, `<sherpa-calendar data-mode="date"></sherpa-calendar>`, 'sherpa-calendar');
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-calendar')!;
    const sr = el.shadowRoot!;
    let detail: any = null;
    el.addEventListener('datetime-change', (e: any) => (detail = e.detail));
    const days = sr.querySelectorAll('.cal-days .cal-day:not([data-other-month]):not([disabled])');
    const dayCount = days.length;
    (days[0] as HTMLElement).click();
    return {
      dayCount,
      detail,
      value: (el as HTMLElement).getAttribute ? detail?.value : null,
    };
  });
  expect(r.dayCount).toBeGreaterThan(0);
  expect(r.detail?.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

/* ── sherpa-data-grid ──────────────────────────────────────────── */
// setData({ columns:[{field,name,type}], rows:[{field:value}] }) renders tr.grid-row.

test('sherpa-data-grid setData renders a table row per data record', async ({ page }) => {
  await mount(page, `<sherpa-data-grid></sherpa-data-grid>`, 'sherpa-data-grid');
  await page.evaluate(async () => {
    const el = document.querySelector('sherpa-data-grid') as HTMLElement & {
      rendered: Promise<void>;
      setData: (c: unknown) => Promise<void>;
      getColumns?: () => unknown[];
    };
    await el.rendered;
    await el.setData({
      columns: [
        { field: 'name', name: 'Name', type: 'string' },
        { field: 'count', name: 'Count', type: 'number' },
      ],
      rows: [
        { name: 'Alpha', count: 3 },
        { name: 'Beta', count: 7 },
        { name: 'Gamma', count: 1 },
      ],
    });
  });
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-data-grid') as HTMLElement & { getColumns?: () => unknown[] };
    const sr = el.shadowRoot!;
    return {
      hasTable: !!sr.querySelector('table[role="grid"]'),
      dataRows: sr.querySelectorAll('.grid-body tr.grid-row').length,
      columnCount: typeof el.getColumns === 'function' ? el.getColumns().length : -1,
    };
  });
  expect(r.hasTable).toBe(true);
  expect(r.dataRows).toBe(3);
  expect(r.columnCount).toBe(2);
});
