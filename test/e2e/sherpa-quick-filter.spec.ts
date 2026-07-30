import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

test('chip renders "Label: Value" when a value is set', async ({ page }) => {
  await mount(page, `<sherpa-quick-filter data-label="Owner"></sherpa-quick-filter>`, 'sherpa-quick-filter');
  const label = await page.evaluate(() => {
    const c = document.querySelector('sherpa-quick-filter') as HTMLElement & { setValue?: (v: string) => void };
    c.setValue!('Me');
    return c.shadowRoot!.querySelector('.chip-label')!.textContent;
  });
  expect(label).toBe('Owner: Me');
});

test('AI chip body click emits quick-filter-ai-accept', async ({ page }) => {
  await mount(page, `<sherpa-quick-filter data-label="AI" data-type="ai"></sherpa-quick-filter>`, 'sherpa-quick-filter');
  const detail = await page.evaluate(() => {
    const c = document.querySelector('sherpa-quick-filter')!;
    let d: any = null;
    c.addEventListener('quick-filter-ai-accept', (e: any) => (d = e.detail));
    (c.shadowRoot!.querySelector('.chip-main') as HTMLElement).click();
    return d;
  });
  expect(detail).not.toBeNull();
});

test('toolbar builds preset chips and getFilters returns FilterSpec after menu select', async ({ page }) => {
  await mount(page, `<sherpa-quick-filter-toolbar></sherpa-quick-filter-toolbar>`, 'sherpa-quick-filter-toolbar');
  const r = await page.evaluate(async () => {
    const t = document.querySelector('sherpa-quick-filter-toolbar') as HTMLElement & {
      setAvailableColumns?: (c: unknown[], r: unknown[]) => void;
      getFilters?: () => unknown[];
    };
    t.setAttribute('data-preset-filters', 'status');
    t.setAvailableColumns!(
      [{ field: 'status', name: 'Status', type: 'string', values: ['Active', 'Inactive', 'Pending'] }],
      [{ status: 'Active' }, { status: 'Pending' }],
    );
    await new Promise((res) => setTimeout(res, 200));
    const chip = t.querySelector('sherpa-quick-filter[data-filter-field="status"]')!;
    (chip.shadowRoot!.querySelector('.chip-menu') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 200));
    const overlay = document.querySelector('sherpa-container-overlay[data-qf-toolbar-menu]')!;
    const items = [...overlay.querySelectorAll('sherpa-overlay-item')];
    const active = items.find((i) => (i.getAttribute('data-value') || i.textContent || '').includes('Active'));
    (active as HTMLElement)?.click();
    await new Promise((res) => setTimeout(res, 150));
    return { chips: t.querySelectorAll('sherpa-quick-filter').length, filters: t.getFilters!() };
  });
  expect(r.chips).toBeGreaterThan(0);
  expect(r.filters).toHaveLength(1);
  expect(r.filters[0]).toMatchObject({ field: 'status', operator: 'in', values: ['Active'] });
});
