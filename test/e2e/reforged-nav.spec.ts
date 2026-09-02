import { test, expect } from '@playwright/test';

/**
 * sherpa-nav on the reforged base — the primary navigation rail rebuilt to the
 * Figma "Primary Navigation": brand header + search + quick items over grouped
 * sections, composing <sherpa-nav-item> rows. Covers legacy-array and rich-config
 * populate, active reflection, nav-select delegation, nav-search, and collapse.
 * (The view frame is the light-DOM `.sherpa-view` grid — see reforged-view.spec.ts.)
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('legacy array populate() renders items and marks the active one', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    nav.setAttribute('data-active-id', 'reports');
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!([
      { id: 'home', label: 'Home' },
      { id: 'reports', label: 'Reports' },
      { id: 'settings', label: 'Settings' },
    ]);
    await new Promise((res) => setTimeout(res, 10));
    const rows = nav.shadowRoot!.querySelectorAll('.nav-row sherpa-nav-item');
    const activeRow = nav.shadowRoot!.querySelector('.nav-row sherpa-nav-item[data-current]') as HTMLElement | null;
    return { count: rows.length, activeLabel: activeRow?.dataset['label'] };
  });
  expect(r.count).toBe(3); // legacy array → one unlabelled section of 3
  expect(r.activeLabel).toBe('Reports'); // data-active-id → the matching item
});

test('rich config renders brand, sections with labels, and quick items', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({
      product: { name: 'Sherpa', icon: '⛰' },
      quickItems: [{ id: 'search', label: 'Search' }],
      sections: [
        { label: 'Main', items: [{ id: 'home', label: 'Home' }, { id: 'reports', label: 'Reports' }] },
        { label: 'Admin', items: [{ id: 'settings', label: 'Settings' }] },
      ],
    });
    await new Promise((res) => setTimeout(res, 10));
    const s = nav.shadowRoot!;
    return {
      product: s.querySelector('.product')?.textContent,
      searchable: nav.hasAttribute('data-searchable'),
      sectionLabels: Array.from(s.querySelectorAll('.section-label')).map((el) => el.textContent),
      quickCount: s.querySelectorAll('.quick sherpa-nav-item').length,
      sectionItemCount: s.querySelectorAll('.section-items sherpa-nav-item').length,
    };
  });
  expect(r.product).toBe('Sherpa');
  expect(r.searchable).toBe(true); // a product nav auto-shows search
  expect(r.sectionLabels).toEqual(['Main', 'Admin']);
  expect(r.quickCount).toBe(1);
  expect(r.sectionItemCount).toBe(3); // 2 + 1 across sections
});

test('clicking an item fires nav-select and updates the active id', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!([
      { id: 'home', label: 'Home' },
      { id: 'reports', label: 'Reports' },
    ]);
    await new Promise((res) => setTimeout(res, 20));

    let selected: string | null = null;
    nav.addEventListener('nav-select', (e) => (selected = (e as CustomEvent).detail.id));

    const reports = Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')).find(
      (r) => r.dataset['id'] === 'reports'
    )!;
    // Click the composed nav-item's inner row (event bubbles as item-click).
    const item = reports.querySelector('sherpa-nav-item') as HTMLElement & { rendered?: Promise<void> };
    await item.rendered;
    (item.shadowRoot!.querySelector('.row') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 10));

    return { selected, activeId: nav.getAttribute('data-active-id') };
  });
  expect(r.selected).toBe('reports');
  expect(r.activeId).toBe('reports'); // click reflected the active id
});

test('typing in search fires nav-search with the query', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({ product: { name: 'Sherpa' }, sections: [{ items: [{ id: 'a', label: 'A' }] }] });
    await new Promise((res) => setTimeout(res, 10));

    let query: string | null = null;
    nav.addEventListener('nav-search', (e) => (query = (e as CustomEvent).detail.query));

    const input = nav.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
    input.value = 'rep';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 10));
    return { query };
  });
  expect(r.query).toBe('rep');
});

test('data-collapsed hides the product name, search and section labels', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    nav.setAttribute('data-collapsed', '');
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({ product: { name: 'Sherpa' }, sections: [{ label: 'Main', items: [{ id: 'home', label: 'Home', icon: '⌂' }] }] });
    await new Promise((res) => setTimeout(res, 10));
    const s = nav.shadowRoot!;
    return {
      product: getComputedStyle(s.querySelector('.product')!).display,
      search: getComputedStyle(s.querySelector('.search')!).display,
      sectionLabel: getComputedStyle(s.querySelector('.section-label')!).display,
    };
  });
  expect(r.product).toBe('none');
  expect(r.search).toBe('none');
  expect(r.sectionLabel).toBe('none');
});
