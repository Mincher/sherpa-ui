import { test, expect } from '@playwright/test';

/**
 * sherpa-nav-item on the reforged base — a standalone nav row. Label / icon /
 * badge text from data-*, the current state, an optional promo variant, and the
 * item-click event (gated on disabled). The component isn't registered by
 * the harness index, so each test imports its compiled module first.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-nav-item/sherpa-nav-item.js');
    await customElements.whenDefined('sherpa-nav-item');
  });
});

interface NavItemEl extends HTMLElement {
  rendered?: Promise<void>;
  current?: boolean;
}

test('label, icon and badge render from data-* attributes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-icon', '⌂');
    el.setAttribute('data-label', 'Home');
    el.setAttribute('data-badge', '3');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      icon: s.querySelector('.icon')!.textContent,
      label: s.querySelector('.label')!.textContent,
      badge: s.querySelector('.badge')!.textContent,
      badgeVisible: getComputedStyle(s.querySelector('.badge')!).display !== 'none',
    };
  });
  expect(r.icon).toBe('⌂');
  expect(r.label).toBe('Home');
  expect(r.badge).toBe('3');
  expect(r.badgeVisible).toBe(true);
});

test('badge stays hidden with no data-badge', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Plain');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { display: getComputedStyle(el.shadowRoot!.querySelector('.badge')!).display };
  });
  expect(r.display).toBe('none');
});

test('data-href renders the row as a link', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Docs');
    el.setAttribute('data-href', '/docs');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { href: el.shadowRoot!.querySelector('.row')!.getAttribute('href') };
  });
  expect(r.href).toBe('/docs');
});

test('current setter reflects to data-current and styles the row', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Reports');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.current = true;
    const on = el.hasAttribute('data-current');
    const weight = getComputedStyle(el.shadowRoot!.querySelector('.row')!).fontWeight;
    el.current = false;
    return { on, off: el.hasAttribute('data-current'), weight };
  });
  expect(r.on).toBe(true);
  expect(r.off).toBe(false);
  expect(['600', '700']).toContain(r.weight); // current → heavier label
});

test('click fires item-click with the label and href', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Reports');
    el.setAttribute('data-href', '/reports');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let detail: unknown = null;
    el.addEventListener('item-click', (e) => (detail = (e as CustomEvent).detail));
    el.click();
    return { detail };
  });
  expect(r.detail).toEqual({ label: 'Reports', href: '/reports' });
});

test('disabled item does not fire on click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Off');
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = false;
    el.addEventListener('item-click', () => (fired = true));
    el.click();
    return { fired };
  });
  expect(r.fired).toBe(false);
});

test('promo variant renders heading + description', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-variant', 'promo');
    el.setAttribute('data-label', 'Upgrade');
    el.setAttribute('data-description', 'Unlock more');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      heading: s.querySelector('.promo-heading')?.textContent,
      description: s.querySelector('.promo-description')?.textContent,
      hasDefaultRow: !!s.querySelector('.row'),
    };
  });
  expect(r.heading).toBe('Upgrade');
  expect(r.description).toBe('Unlock more');
  expect(r.hasDefaultRow).toBe(false); // promo template, not the default row
});
