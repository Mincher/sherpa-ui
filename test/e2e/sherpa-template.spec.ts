import { test, expect } from '@playwright/test';
import { openHarness } from './support';

/**
 * Unit coverage for the SherpaTemplate binder (data → HTML) exercised through a
 * real component (breadcrumbs) — both the data-object and precompiled-HTML paths,
 * plus the individual data-bind* markers.
 */

test.beforeEach(async ({ page }) => openHarness(page));

test('binder: data path expands per-item flags (link/current/separator)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-breadcrumbs id="bc"></sherpa-breadcrumbs>';
    const bc = document.getElementById('bc') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (s: unknown) => void;
    };
    await bc.rendered;
    bc.populate!([{ label: 'Home', href: '/h' }, { label: 'Sub', href: '/s' }, { label: 'Now' }]);
    await new Promise((res) => setTimeout(res, 30));
    const sr = bc.shadowRoot!;
    const crumbs = [...sr.querySelectorAll('.crumb-text')].map((c) => ({
      tag: c.tagName,
      text: c.textContent,
      href: c.getAttribute('href'),
      current: c.getAttribute('aria-current'),
    }));
    return { crumbs, separators: sr.querySelectorAll('.separator').length };
  });
  expect(r.crumbs).toHaveLength(3);
  // Historic crumbs render as <a href>, the last as <span aria-current="page">.
  expect(r.crumbs[0]).toMatchObject({ tag: 'A', text: 'Home', href: '/h', current: null });
  expect(r.crumbs[2]).toMatchObject({ tag: 'SPAN', text: 'Now', href: null, current: 'page' });
  // One separator between each pair (not after the last).
  expect(r.separators).toBe(2);
});

test('binder: precompiled HTML path injects markup as-is', async ({ page }) => {
  const count = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-breadcrumbs id="bc"></sherpa-breadcrumbs>';
    const bc = document.getElementById('bc') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (s: unknown) => void;
    };
    await bc.rendered;
    bc.populate!(
      '<a class="crumb-text" href="/x">X</a><span class="separator">/</span><span class="crumb-text" aria-current="page">Y</span>',
    );
    await new Promise((res) => setTimeout(res, 30));
    return bc.shadowRoot!.querySelectorAll('.crumb-text').length;
  });
  expect(count).toBe(2);
});

test('binder: data-bind-if removes falsy branches and keeps truthy ones', async ({ page }) => {
  // A single-item trail: only the current <span> survives; no link, no separator.
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-breadcrumbs id="bc"></sherpa-breadcrumbs>';
    const bc = document.getElementById('bc') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (s: unknown) => void;
    };
    await bc.rendered;
    bc.populate!([{ label: 'Only' }]);
    await new Promise((res) => setTimeout(res, 30));
    const sr = bc.shadowRoot!;
    return {
      links: sr.querySelectorAll('a.crumb-text').length,
      current: sr.querySelectorAll('span[aria-current="page"]').length,
      separators: sr.querySelectorAll('.separator').length,
    };
  });
  expect(r.links).toBe(0);
  expect(r.current).toBe(1);
  expect(r.separators).toBe(0);
});
