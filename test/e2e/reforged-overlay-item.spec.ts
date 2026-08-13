import { test, expect } from '@playwright/test';

/**
 * sherpa-overlay-item on the reforged base — a menu option row. Icon / label /
 * shortcut text from data-*, the checkable state (data-checked + check mark),
 * disabled gating, and the overlay-item-select event. Not registered by the
 * harness index, so each test imports its compiled module first.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-overlay-item/sherpa-overlay-item.js');
    await customElements.whenDefined('sherpa-overlay-item');
  });
});

interface OverlayItemEl extends HTMLElement {
  rendered?: Promise<void>;
  checked?: boolean;
}

test('icon, label and shortcut render from data-* attributes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-item') as unknown as OverlayItemEl;
    el.setAttribute('data-icon', '✂');
    el.setAttribute('data-label', 'Cut');
    el.setAttribute('data-shortcut', '⌘X');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      icon: s.querySelector('.icon')!.textContent,
      label: s.querySelector('.label')!.textContent,
      shortcut: s.querySelector('.shortcut')!.textContent,
      shortcutVisible: getComputedStyle(s.querySelector('.shortcut')!).display !== 'none',
      role: el.getAttribute('role'),
    };
  });
  expect(r.icon).toBe('✂');
  expect(r.label).toBe('Cut');
  expect(r.shortcut).toBe('⌘X');
  expect(r.shortcutVisible).toBe(true);
  expect(r.role).toBe('menuitem'); // plain item
});

test('data-checked shows the check mark and sets menuitemcheckbox role', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-item') as unknown as OverlayItemEl;
    el.setAttribute('data-label', 'Show grid');
    el.setAttribute('data-checked', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const check = el.shadowRoot!.querySelector('.check')!;
    return {
      checkVisible: getComputedStyle(check).visibility,
      role: el.getAttribute('role'),
      ariaChecked: el.getAttribute('aria-checked'),
    };
  });
  expect(r.checkVisible).toBe('visible');
  expect(r.role).toBe('menuitemcheckbox');
  expect(r.ariaChecked).toBe('true');
});

test('check mark is hidden on an unchecked item', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-item') as unknown as OverlayItemEl;
    el.setAttribute('data-label', 'Plain');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { visibility: getComputedStyle(el.shadowRoot!.querySelector('.check')!).visibility };
  });
  expect(r.visibility).toBe('hidden');
});

test('click fires overlay-item-select with the label', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-item') as unknown as OverlayItemEl;
    el.setAttribute('data-label', 'Rename');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let detail: unknown = null;
    el.addEventListener('overlay-item-select', (e) => (detail = (e as CustomEvent).detail));
    el.click();
    return { detail };
  });
  expect(r.detail).toEqual({ label: 'Rename', checked: false });
});

test('checkable item toggles data-checked on activation', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-item') as unknown as OverlayItemEl;
    el.setAttribute('data-label', 'Wrap');
    el.setAttribute('data-checkable', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const details: boolean[] = [];
    el.addEventListener('overlay-item-select', (e) => details.push((e as CustomEvent).detail.checked));
    el.click(); // off → on
    el.click(); // on → off
    return { details, finalChecked: el.hasAttribute('data-checked') };
  });
  expect(r.details).toEqual([true, false]);
  expect(r.finalChecked).toBe(false);
});

test('disabled item does not fire on click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-item') as unknown as OverlayItemEl;
    el.setAttribute('data-label', 'Off');
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = false;
    el.addEventListener('overlay-item-select', () => (fired = true));
    el.click();
    return { fired, ariaDisabled: el.getAttribute('aria-disabled') };
  });
  expect(r.fired).toBe(false);
  expect(r.ariaDisabled).toBe('true');
});
