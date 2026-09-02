import { test, expect } from '@playwright/test';

/**
 * sherpa-app-header on the reforged base — rebuilt to the Figma "App Header":
 * two rows (history+actions, then view details with an embedded quick-filter
 * toolbar) over a loading bar. Covers title/icon mirror, the notification count
 * badge, the back / favourite / export events, breadcrumb re-dispatch, the
 * loading bar, and populate() composing breadcrumbs + filters.
 *
 * The component isn't registered by the harness index, so the spec imports the
 * compiled module (and the composed children) to trigger customElements.define().
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-app-header/sherpa-app-header.js');
    await customElements.whenDefined('sherpa-app-header');
  });
});

type WithRender = HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };

test('data-heading / data-icon mirror into the view row', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    el.setAttribute('data-heading', 'Dashboards');
    el.setAttribute('data-icon', '📊');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      title: s.querySelector('.title')!.textContent,
      icon: s.querySelector('.view-icon')!.textContent,
      iconVisible: getComputedStyle(s.querySelector('.view-icon')!).display !== 'none',
    };
  });
  expect(r.title).toBe('Dashboards');
  expect(r.icon).toBe('📊');
  expect(r.iconVisible).toBe(true);
});

test('data-notifications shows a count badge; 0/unset hides it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const badge = el.shadowRoot!.querySelector('.notif-badge')!;
    const hidden = getComputedStyle(badge).display === 'none';

    el.setAttribute('data-notifications', '5');
    await new Promise((res) => setTimeout(res, 0));
    const shownText = badge.textContent;
    const shown = getComputedStyle(badge).display !== 'none';

    el.setAttribute('data-notifications', '0');
    await new Promise((res) => setTimeout(res, 0));
    const clearedAttr = el.hasAttribute('data-notifications');

    return { hidden, shownText, shown, clearedAttr };
  });
  expect(r.hidden).toBe(true); // unset → no badge
  expect(r.shown).toBe(true);
  expect(r.shownText).toBe('5');
  expect(r.clearedAttr).toBe(false); // 0 removes the attribute → hidden again
});

test('back / export fire their events; favourite toggles and fires', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;

    const seen: Record<string, unknown> = {};
    el.addEventListener('back', () => (seen['back'] = true));
    el.addEventListener('view-export', () => (seen['export'] = true));
    el.addEventListener('favorite-toggle', (e) => (seen['fav'] = (e as CustomEvent).detail.favorite));

    (s.querySelector('.back') as HTMLElement).click();
    (s.querySelector('.export') as HTMLElement).click();
    (s.querySelector('.favorite') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 0));

    return { seen, favAttr: el.hasAttribute('data-favorite') };
  });
  expect(r.seen['back']).toBe(true);
  expect(r.seen['export']).toBe(true);
  expect(r.seen['fav']).toBe(true); // first click favourites
  expect(r.favAttr).toBe(true);
});

test('data-loading reveals the loading bar', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const bar = el.shadowRoot!.querySelector('.loading-bar') as HTMLElement;
    const before = getComputedStyle(bar).visibility;
    el.setAttribute('data-loading', '');
    await new Promise((res) => setTimeout(res, 0));
    const after = getComputedStyle(bar).visibility;
    return { before, after };
  });
  expect(r.before).toBe('hidden');
  expect(r.after).toBe('visible');
});

test('populate() composes breadcrumbs + a quick-filter toolbar and re-dispatches breadcrumb-click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    await import('/dist/components/sherpa-breadcrumbs/sherpa-breadcrumbs.js');
    await import('/dist/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.js');
    const el = document.createElement('sherpa-app-header') as WithRender;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({
      breadcrumb: [{ label: 'Home' }, { label: 'Reports' }],
      filters: [{ id: 'all', label: 'All', active: true }, { id: 'mine', label: 'Mine' }],
    });
    await new Promise((res) => setTimeout(res, 30));

    const crumbs = el.querySelector('sherpa-breadcrumbs[slot="breadcrumb"]') as WithRender;
    const qft = el.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
    await crumbs.rendered;
    await new Promise((res) => setTimeout(res, 20));

    // Re-dispatch: a breadcrumbs' own event surfaces as breadcrumb-click on the header.
    let clicked = false;
    el.addEventListener('breadcrumb-click', () => (clicked = true));
    crumbs.dispatchEvent(new CustomEvent('breadcrumb-select', {
      bubbles: true, composed: true, detail: { index: 0, label: 'Home' },
    }));
    await new Promise((res) => setTimeout(res, 10));

    return {
      hasCrumbs: !!crumbs,
      hasFilters: !!qft,
      clicked,
    };
  });
  expect(r.hasCrumbs).toBe(true);
  expect(r.hasFilters).toBe(true);
  expect(r.clicked).toBe(true); // breadcrumb-select re-dispatched as breadcrumb-click
});
