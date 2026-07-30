import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

test('renders title and data-driven breadcrumbs (cloning prototype)', async ({ page }) => {
  await mount(page, `<sherpa-app-header data-label="Dashboard"></sherpa-app-header>`, 'sherpa-app-header');
  const r = await page.evaluate(() => {
    const h = document.querySelector('sherpa-app-header') as HTMLElement & { setBreadcrumbs?: (b: unknown[]) => void };
    h.setBreadcrumbs!([{ label: 'Home', href: '#' }, { label: 'Analytics', href: '#' }, { label: 'Dashboard' }]);
    const sr = h.shadowRoot!;
    return {
      title: sr.querySelector('.view-title')!.textContent,
      crumbs: sr.querySelectorAll('.crumb').length,
      lastIsCurrent: sr.querySelectorAll('.crumb')[2]!.getAttribute('aria-current'),
      width: Math.round(h.getBoundingClientRect().width),
    };
  });
  expect(r.title).toBe('Dashboard');
  expect(r.crumbs).toBe(3);
  expect(r.lastIsCurrent).toBe('page');
  expect(r.width).toBeGreaterThan(0);
});

test('favourite toggle flips state and emits favorite-toggle', async ({ page }) => {
  await mount(page, `<sherpa-app-header data-label="X" data-show-favorite></sherpa-app-header>`, 'sherpa-app-header');
  const r = await page.evaluate(() => {
    const h = document.querySelector('sherpa-app-header')!;
    let detail: any = null;
    h.addEventListener('favorite-toggle', (e: any) => (detail = e.detail));
    (h.shadowRoot!.querySelector('.favorite-button') as HTMLElement).click();
    return { favorite: h.hasAttribute('data-favorite'), detail };
  });
  expect(r.favorite).toBe(true);
  expect(r.detail).toMatchObject({ favorite: true });
});

test('back button emits view-header-back', async ({ page }) => {
  await mount(page, `<sherpa-app-header data-label="X" data-back-button></sherpa-app-header>`, 'sherpa-app-header');
  const fired = await page.evaluate(() => {
    const h = document.querySelector('sherpa-app-header')!;
    let f = false;
    h.addEventListener('view-header-back', () => (f = true));
    (h.shadowRoot!.querySelector('.back-button') as HTMLElement).click();
    return f;
  });
  expect(fired).toBe(true);
});

test('composes inside app-shell filters slot', async ({ page }) => {
  await mount(page, `
    <sherpa-app-shell style="height:300px">
      <sherpa-app-header slot="app-header" data-label="Reports"></sherpa-app-header>
      <div>content</div>
    </sherpa-app-shell>`, 'sherpa-app-shell');
  const r = await page.evaluate(async () => {
    const shell = document.querySelector('sherpa-app-shell')!;
    await new Promise((res) => setTimeout(res, 150)); // slot detection
    const row = shell.shadowRoot!.querySelector('.app-header-row')!;
    return { hasAttr: shell.hasAttribute('data-has-app-header'), rowVisible: getComputedStyle(row).display !== 'none' };
  });
  expect(r.hasAttr).toBe(true);
  expect(r.rowVisible).toBe(true);
});
