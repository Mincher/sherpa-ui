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

test('chip matches Figma Type×State matrix (24px, state-dependent border/weight, anatomy)', async ({ page }) => {
  await mount(page, `
    <sherpa-quick-filter data-label="Region" id="neutral"></sherpa-quick-filter>
    <sherpa-quick-filter data-label="Owner" data-active id="active"></sherpa-quick-filter>
    <sherpa-quick-filter data-type="ai" data-label="Suggested" id="ai"></sherpa-quick-filter>
    <sherpa-quick-filter data-type="populated" data-label="Field" data-value="V" data-active id="pop"></sherpa-quick-filter>`,
    'sherpa-quick-filter');
  const r = await page.evaluate(() => {
    const read = (id: string) => {
      const el = document.getElementById(id)!;
      const chip = el.shadowRoot!.querySelector('.chip')!;
      const label = el.shadowRoot!.querySelector('.chip-label')!;
      const menu = el.shadowRoot!.querySelector('.chip-menu')!;
      return {
        h: getComputedStyle(chip).height,
        radius: getComputedStyle(chip).borderTopLeftRadius,
        border: getComputedStyle(chip).borderTopWidth + ' ' + getComputedStyle(chip).borderTopColor,
        bg: getComputedStyle(chip).backgroundColor,
        weight: getComputedStyle(label).fontWeight,
        color: getComputedStyle(label).color,
        menuW: getComputedStyle(menu).width,
      };
    };
    return { neutral: read('neutral'), active: read('active'), ai: read('ai'), pop: read('pop') };
  });
  // Anatomy: 24px chip, 4px radius, 20px menu button.
  expect(r.neutral.h).toBe('24px');
  expect(r.neutral.radius).toBe('4px');
  expect(r.neutral.menuW).toBe('20px');
  // Default/Neutral: white, GREY border, body text, Regular.
  expect(r.neutral.border).toBe('1px rgb(213, 213, 213)');
  expect(r.neutral.bg).toBe('rgb(255, 255, 255)');
  expect(r.neutral.weight).toBe('400');
  expect(r.neutral.color).toBe('rgb(46, 46, 51)');
  // Default/Active: light-purple fill + purple border, body text, Regular.
  expect(r.active.border).toBe('1px rgb(192, 70, 255)');
  expect(r.active.bg).toBe('rgb(248, 235, 255)');
  expect(r.active.weight).toBe('400');
  // AI: NO border, purple text.
  expect(r.ai.border.startsWith('0px')).toBe(true);
  expect(r.ai.color).toBe('rgb(133, 0, 204)');
  // Populated/Active-On: purple fill + purple border + purple SEMIBOLD text.
  expect(r.pop.border).toBe('1px rgb(192, 70, 255)');
  expect(r.pop.weight).toBe('600');
  expect(r.pop.color).toBe('rgb(133, 0, 204)');
});

test('AI chip body click emits quick-filter-ai-accept', async ({ page }) => {
  await mount(page, `<sherpa-quick-filter data-label="AI" data-type="ai"></sherpa-quick-filter>`, 'sherpa-quick-filter');
  const detail = await page.evaluate(() => {
    const c = document.querySelector('sherpa-quick-filter')!;
    let d: any = null;
    c.addEventListener('quick-filter-ai-accept', (e: any) => (d = e.detail));
    (c.shadowRoot!.querySelector('.chip-left') as HTMLElement).click();
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
    const overlay = document.querySelector('sherpa-container[data-qf-toolbar-menu]')!;
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

test('view-scope toolbar: leading view chip + common-actions cluster (Figma Type=View)', async ({ page }) => {
  await openHarness(page);
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-quick-filter-toolbar data-type="view"></sherpa-quick-filter-toolbar>';
    const t = document.querySelector('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>;
      setViews?: (v: unknown[], id?: string) => void;
      setActiveView?: (id: string) => void;
    };
    await t.rendered;
    t.setViews!([{ id: 'v1', label: 'My view', badge: 3 }, { id: 'v2', label: 'Other' }]);
    await new Promise((res) => setTimeout(res, 40));
    const sr = t.shadowRoot!;

    // Leading view chip reflects the active view.
    const chip = sr.querySelector('.view-chip');
    const viewChip = {
      label: chip?.getAttribute('data-label'),
      count: chip?.getAttribute('data-count'),
      active: chip?.hasAttribute('data-active'),
    };

    // The full right-actions cluster is present.
    const actions = [...sr.querySelectorAll('.actions-zone .action-btn')].map(
      (b) => (b as HTMLElement).dataset['action'],
    );
    const hasSave = !!sr.querySelector('.save-fave .save-btn');

    // Actions emit their events.
    const fired: string[] = [];
    ['filter-reset', 'ai-filter-request', 'data-refresh', 'view-save', 'view-menu-open', 'view-favorite'].forEach(
      (ev) => t.addEventListener(ev, () => fired.push(ev)),
    );
    (sr.querySelector('[data-action="reset"]') as HTMLElement)?.click();
    (sr.querySelector('[data-action="ai"]') as HTMLElement)?.click();
    (sr.querySelector('[data-action="refresh"]') as HTMLElement)?.click();
    (sr.querySelector('[data-action="save"]') as HTMLElement)?.click();
    (sr.querySelector('[data-action="favorite"]') as HTMLElement)?.click();

    // Switching the active view updates the chip + fires view-change.
    let viewChanged: string | null = null;
    t.addEventListener('view-change', (e) => { viewChanged = (e as CustomEvent).detail?.viewId; });
    t.setActiveView!('v2');
    await new Promise((res) => setTimeout(res, 20));

    return { viewChip, actions, hasSave, fired, chipAfter: chip?.getAttribute('data-label'), viewChanged };
  });

  expect(r.viewChip).toMatchObject({ label: 'My view', count: '3', active: true });
  expect(r.actions).toEqual(['ai', 'reset', 'settings', 'favorite', 'save-menu', 'refresh', 'overflow']);
  expect(r.hasSave).toBe(true);
  expect(r.fired).toEqual(
    expect.arrayContaining(['filter-reset', 'ai-filter-request', 'data-refresh', 'view-save', 'view-favorite']),
  );
  expect(r.chipAfter).toBe('Other');
  expect(r.viewChanged).toBe('v2');
});
