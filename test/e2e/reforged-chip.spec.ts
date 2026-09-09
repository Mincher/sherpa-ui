import { test, expect } from '@playwright/test';

/**
 * sherpa-chip on the reforged base — the Figma Chip (62:1732): a near-square
 * neutral token (radius 2) by default, coloured via the [data-status] cascade.
 * Covers the neutral default, the leading icon glyph, and the dismissible close
 * button + chip-remove event.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(() => customElements.whenDefined('sherpa-chip'));
});

test('default is a neutral near-square chip: white surface, grey border, dark text', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chip') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'chip';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const chip = el.shadowRoot!.querySelector('.chip')!;
    const cs = getComputedStyle(chip);
    return { bg: cs.backgroundColor, border: cs.borderTopColor, text: cs.color, radius: cs.borderTopLeftRadius };
  });
  expect(r.bg).toBe('rgb(255, 255, 255)'); // style-surface-base (neutral)
  expect(r.border).not.toBe(r.bg); // a visible grey border
  expect(r.text).toBe('rgb(53, 53, 61)'); // style-content-base → content-body-1 (#35353d) dark ink
  expect(r.radius).not.toBe('999px'); // near-square, NOT the full-radius pill
});

test('data-icon mirrors a leading glyph and reveals the icon slot', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chip') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-icon', '★');
    el.textContent = 'starred';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const glyph = el.shadowRoot!.querySelector('.glyph')!;
    const icon = el.shadowRoot!.querySelector('.icon')!;
    return { glyph: glyph.textContent, iconShown: getComputedStyle(icon).display !== 'none' };
  });
  expect(r.glyph).toBe('★');
  expect(r.iconShown).toBe(true);
});

test('dismissible shows a close button that fires chip-remove', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chip') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-dismissible', '');
    el.textContent = 'removable';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    let fired = false;
    el.addEventListener('chip-remove', () => (fired = true));
    const close = el.shadowRoot!.querySelector<HTMLButtonElement>('.close')!;
    close.click();
    return { hasClose: !!close, fired };
  });
  expect(r.hasClose).toBe(true);
  expect(r.fired).toBe(true);
});
