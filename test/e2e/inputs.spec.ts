import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

/* ── sherpa-input-text ─────────────────────────────────────────── */

test('sherpa-input-text renders <input>, shows label, and re-dispatches input/change', async ({ page }) => {
  await mount(page, `<sherpa-input-text data-label="Name" value="Ann"></sherpa-input-text>`, 'sherpa-input-text');
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-input-text') as HTMLElement & { getInputElement: () => HTMLInputElement };
    const sr = el.shadowRoot!;
    const input = sr.querySelector('input.input-field') as HTMLInputElement;
    let inputDetail: any = null;
    let changeDetail: any = null;
    el.addEventListener('input', (e: any) => (inputDetail = e.detail));
    el.addEventListener('change', (e: any) => (changeDetail = e.detail));
    const startValue = input.value;
    const label = sr.querySelector('.input-label-text')!.textContent;
    // Simulate typing
    input.value = 'Bob';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { tag: input.tagName, startValue, label, inputDetail, changeDetail };
  });
  expect(r.tag).toBe('INPUT');
  expect(r.startValue).toBe('Ann');
  expect(r.label).toBe('Name');
  expect(r.inputDetail).toEqual({ value: 'Bob' });
  expect(r.changeDetail).toEqual({ value: 'Bob' });
});

test('sherpa-input-text data-multiline renders a <textarea>', async ({ page }) => {
  await mount(page, `<sherpa-input-text data-multiline data-label="Notes"></sherpa-input-text>`, 'sherpa-input-text');
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-input-text')!;
    const field = el.shadowRoot!.querySelector('.input-field') as HTMLElement;
    return { tag: field.tagName };
  });
  expect(r.tag).toBe('TEXTAREA');
});

/* ── sherpa-input-number ───────────────────────────────────────── */

test('sherpa-input-number renders steppers; stepUp button increments value', async ({ page }) => {
  await mount(page, `<sherpa-input-number value="5" min="0" max="10" step="1"></sherpa-input-number>`, 'sherpa-input-number');
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-input-number') as HTMLElement & { value: string };
    const sr = el.shadowRoot!;
    const input = sr.querySelector('input.input-field') as HTMLInputElement;
    const up = sr.querySelector('.step-up') as HTMLButtonElement;
    const down = sr.querySelector('.step-down') as HTMLButtonElement;
    let changeDetail: any = null;
    el.addEventListener('change', (e: any) => (changeDetail = e.detail));
    const hasSteppers = !!up && !!down;
    up.click();
    const afterUp = input.value;
    down.click();
    down.click();
    const afterDown = input.value;
    return { type: input.type, hasSteppers, afterUp, afterDown, changeDetail };
  });
  expect(r.type).toBe('number');
  expect(r.hasSteppers).toBe(true);
  expect(r.afterUp).toBe('6');
  expect(r.afterDown).toBe('4');
  expect(r.changeDetail).toEqual({ value: '4' });
});

/* ── sherpa-input-search ───────────────────────────────────────── */

test('sherpa-input-search clear button empties value and fires search', async ({ page }) => {
  await mount(page, `<sherpa-input-search value="hello"></sherpa-input-search>`, 'sherpa-input-search');
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-input-search')!;
    const sr = el.shadowRoot!;
    const input = sr.querySelector('input.input-field') as HTMLInputElement;
    const clearBtn = sr.querySelector('.search-clear') as HTMLButtonElement;
    let searchDetail: any = null;
    el.addEventListener('search', (e: any) => (searchDetail = e.detail));
    const before = input.value;
    clearBtn.click();
    return { type: input.type, before, after: input.value, searchDetail };
  });
  expect(r.type).toBe('search');
  expect(r.before).toBe('hello');
  expect(r.after).toBe('');
  expect(r.searchDetail).toEqual({ value: '' });
});

test('sherpa-input-search Enter commits current value via search event', async ({ page }) => {
  await mount(page, `<sherpa-input-search></sherpa-input-search>`, 'sherpa-input-search');
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-input-search')!;
    const input = el.shadowRoot!.querySelector('input.input-field') as HTMLInputElement;
    let searchDetail: any = null;
    el.addEventListener('search', (e: any) => (searchDetail = e.detail));
    input.value = 'query';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return { searchDetail };
  });
  expect(r.searchDetail).toEqual({ value: 'query' });
});

/* ── sherpa-input-select ───────────────────────────────────────── */

test('sherpa-input-select adopts slotted <option>s into a native <select>; change re-dispatches', async ({ page }) => {
  await mount(page, `<sherpa-input-select data-label="Colour">
      <option value="r">Red</option>
      <option value="g">Green</option>
      <option value="b">Blue</option>
    </sherpa-input-select>`, 'sherpa-input-select');
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-input-select')!;
    const select = el.shadowRoot!.querySelector('select.input-field') as HTMLSelectElement;
    let changeDetail: any = null;
    el.addEventListener('change', (e: any) => (changeDetail = e.detail));
    const optionCount = select.querySelectorAll('option').length;
    select.value = 'g';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { tag: select.tagName, optionCount, changeDetail };
  });
  expect(r.tag).toBe('SELECT');
  expect(r.optionCount).toBe(3);
  expect(r.changeDetail).toEqual({ value: 'g' });
});

/* ── sherpa-tabs ───────────────────────────────────────────────── */

test('sherpa-tabs builds a tab per panel and clicking fires tab-change + sets active tab', async ({ page }) => {
  await mount(page, `<sherpa-tabs>
      <section data-tab-label="One">1</section>
      <section data-tab-label="Two">2</section>
      <section data-tab-label="Three">3</section>
    </sherpa-tabs>`, 'sherpa-tabs');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-tabs') as HTMLElement;
    await new Promise((res) => setTimeout(res, 150)); // slot detection → buildTabs
    const sr = el.shadowRoot!;
    const tabs = sr.querySelectorAll('.tab');
    let detail: any = null;
    el.addEventListener('tab-change', (e: any) => (detail = e.detail));
    (tabs[1] as HTMLElement).click();
    return {
      tabCount: tabs.length,
      labels: [...tabs].map((t) => t.querySelector('.tab-label')!.textContent),
      detail,
      activeTab: el.dataset['activeTab'],
      selected: tabs[1]!.getAttribute('aria-selected'),
    };
  });
  expect(r.tabCount).toBe(3);
  expect(r.labels).toEqual(['One', 'Two', 'Three']);
  expect(r.detail).toMatchObject({ index: 1, label: 'Two', previousIndex: 0 });
  expect(r.activeTab).toBe('1');
  expect(r.selected).toBe('true');
});

test('sherpa-tabs ArrowRight moves the active tab', async ({ page }) => {
  await mount(page, `<sherpa-tabs>
      <section data-tab-label="A">a</section>
      <section data-tab-label="B">b</section>
    </sherpa-tabs>`, 'sherpa-tabs');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-tabs') as HTMLElement;
    await new Promise((res) => setTimeout(res, 150));
    const sr = el.shadowRoot!;
    const tabs = sr.querySelectorAll('.tab');
    (tabs[0] as HTMLElement).focus();
    (tabs[0] as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    return { activeTab: el.dataset['activeTab'] };
  });
  expect(r.activeTab).toBe('1');
});
