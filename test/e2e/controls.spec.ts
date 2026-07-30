import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

/* ── sherpa-button ─────────────────────────────────────────────── */

test('sherpa-button renders a <button> and reflects data-label', async ({ page }) => {
  await mount(page, `<sherpa-button data-label="Save"></sherpa-button>`, 'sherpa-button');
  const r = await page.evaluate(() => {
    const b = document.querySelector('sherpa-button')!;
    const sr = b.shadowRoot!;
    return {
      hasButton: !!sr.querySelector('button.trigger'),
      label: sr.querySelector('.label')!.textContent,
      variant: (b as HTMLElement).dataset['variant'],
    };
  });
  expect(r.hasButton).toBe(true);
  expect(r.label).toBe('Save');
  expect(r.variant).toBe('primary'); // default applied in onRender
});

test('sherpa-button click fires button-click (bubbles + composed)', async ({ page }) => {
  await mount(page, `<sherpa-button data-label="Go"></sherpa-button>`, 'sherpa-button');
  const fired = await page.evaluate(() => {
    const b = document.querySelector('sherpa-button')!;
    let f = false;
    b.addEventListener('button-click', () => (f = true));
    (b.shadowRoot!.querySelector('button.trigger') as HTMLElement).click();
    return f;
  });
  expect(fired).toBe(true);
});

/* ── sherpa-switch ─────────────────────────────────────────────── */

test('sherpa-switch toggles state + aria-checked and fires change with {checked,state}', async ({ page }) => {
  await mount(page, `<sherpa-switch></sherpa-switch>`, 'sherpa-switch');
  const r = await page.evaluate(() => {
    const s = document.querySelector('sherpa-switch') as HTMLElement;
    const sr = s.shadowRoot!;
    const track = sr.querySelector('.switch-track[role="switch"]') as HTMLElement;
    let detail: any = null;
    s.addEventListener('change', (e: any) => (detail = e.detail));
    const startState = s.dataset['state'];
    const startAria = track.getAttribute('aria-checked');
    track.click();
    return {
      startState,
      startAria,
      afterState: s.dataset['state'],
      afterAria: track.getAttribute('aria-checked'),
      detail,
    };
  });
  expect(r.startState).toBe('off');
  expect(r.startAria).toBe('false');
  expect(r.afterState).toBe('on');
  expect(r.afterAria).toBe('true');
  expect(r.detail).toEqual({ checked: true, state: 'on' });
});

/* ── sherpa-select-checkbox ────────────────────────────────────── */

test('sherpa-select-checkbox click fires change with {checked,value,indeterminate}', async ({ page }) => {
  await mount(page, `<sherpa-select-checkbox value="terms" data-label="Accept"></sherpa-select-checkbox>`, 'sherpa-select-checkbox');
  const r = await page.evaluate(() => {
    const c = document.querySelector('sherpa-select-checkbox')!;
    const input = c.shadowRoot!.querySelector('.check-input') as HTMLInputElement;
    let detail: any = null;
    c.addEventListener('change', (e: any) => (detail = e.detail));
    input.click(); // native click toggles + fires change
    return { detail, hostChecked: c.hasAttribute('checked') };
  });
  expect(r.detail).toMatchObject({ checked: true, value: 'terms', indeterminate: false });
  expect(r.hostChecked).toBe(true);
});

test('sherpa-select-checkbox indeterminate attr mirrors onto native input', async ({ page }) => {
  await mount(page, `<sherpa-select-checkbox indeterminate data-label="All"></sherpa-select-checkbox>`, 'sherpa-select-checkbox');
  const r = await page.evaluate(() => {
    const c = document.querySelector('sherpa-select-checkbox')!;
    const input = c.shadowRoot!.querySelector('.check-input') as HTMLInputElement;
    return { indeterminate: input.indeterminate };
  });
  expect(r.indeterminate).toBe(true);
});

/* ── sherpa-select-radio ───────────────────────────────────────── */

test('sherpa-select-radio selecting fires change with {checked,value}', async ({ page }) => {
  await mount(page, `<sherpa-select-radio name="g" value="a" data-label="A"></sherpa-select-radio>`, 'sherpa-select-radio');
  const r = await page.evaluate(() => {
    const radio = document.querySelector('sherpa-select-radio')!;
    const input = radio.shadowRoot!.querySelector('.check-input') as HTMLInputElement;
    let detail: any = null;
    radio.addEventListener('change', (e: any) => (detail = e.detail));
    input.click();
    return { detail, hostChecked: radio.hasAttribute('checked') };
  });
  expect(r.detail).toEqual({ checked: true, value: 'a' });
  expect(r.hostChecked).toBe(true);
});

/* ── sherpa-slider ─────────────────────────────────────────────── */

test('sherpa-slider single: defaults + keyboard ArrowRight fires input/change', async ({ page }) => {
  await mount(page, `<sherpa-slider data-min="0" data-max="10" data-step="1" data-value="5"></sherpa-slider>`, 'sherpa-slider');
  const r = await page.evaluate(() => {
    const s = document.querySelector('sherpa-slider') as HTMLElement;
    const sr = s.shadowRoot!;
    const handle = sr.querySelector('.handle-high') as HTMLElement;
    let inputDetail: any = null;
    let changeDetail: any = null;
    s.addEventListener('input', (e: any) => (inputDetail = e.detail));
    s.addEventListener('change', (e: any) => (changeDetail = e.detail));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    return {
      type: s.dataset['type'],
      afterValue: s.dataset['value'],
      inputDetail,
      changeDetail,
    };
  });
  expect(r.type).toBe('single');
  expect(r.afterValue).toBe('6');
  expect(r.inputDetail).toEqual({ value: 6 });
  expect(r.changeDetail).toEqual({ value: 6 });
});

test('sherpa-slider range: exposes low/high values in detail', async ({ page }) => {
  await mount(page, `<sherpa-slider data-type="range" data-min="0" data-max="100" data-value-low="20" data-value-high="80"></sherpa-slider>`, 'sherpa-slider');
  const r = await page.evaluate(() => {
    const s = document.querySelector('sherpa-slider') as HTMLElement;
    const sr = s.shadowRoot!;
    const low = sr.querySelector('.handle-low') as HTMLElement;
    let detail: any = null;
    s.addEventListener('input', (e: any) => (detail = e.detail));
    low.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    return { detail };
  });
  // low started at 20, ArrowLeft steps down by 1
  expect(r.detail).toEqual({ low: 19, high: 80 });
});

/* ── sherpa-tag ────────────────────────────────────────────────── */

test('sherpa-tag renders variant/status and shows slotted label', async ({ page }) => {
  await mount(page, `<sherpa-tag data-variant="secondary" data-status="success">Active</sherpa-tag>`, 'sherpa-tag');
  const r = await page.evaluate(() => {
    const t = document.querySelector('sherpa-tag') as HTMLElement;
    const sr = t.shadowRoot!;
    const slot = sr.querySelector('slot') as HTMLSlotElement;
    return {
      variant: t.dataset['variant'],
      status: t.dataset['status'],
      hasWrapper: !!sr.querySelector('.tag-wrapper[part="tag"]'),
      assigned: slot.assignedNodes().map((n) => n.textContent).join(''),
    };
  });
  expect(r.variant).toBe('secondary');
  expect(r.status).toBe('success');
  expect(r.hasWrapper).toBe(true);
  expect(r.assigned).toContain('Active');
});
