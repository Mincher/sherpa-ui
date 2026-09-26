import { test, expect } from './harness';

/**
 * A HOST'S `aria-label` NAMES ITS INNER CONTROL. The host has no role, so the
 * label named nothing: icon buttons, search boxes and switches all read as
 * unnamed. Asked of the accessibility tree, as a screen reader would.
 * TRAP T-a-host-label-must-reach-its-control
 */
test('a host aria-label names the inner control, and follows it', async ({ page }) => {
  await page.evaluate(async () => {
    await window.__mount('sherpa-button', undefined,
      { 'data-type': 'icon', 'data-icon-start': 'gear', 'aria-label': 'Settings' });
    await window.__mount('sherpa-switch', undefined,
      { 'data-type': 'simple', 'aria-label': 'Conditional', keep: true });
    await window.__mount('sherpa-input-text', undefined,
      { 'aria-label': 'Search every filter', keep: true });
    await window.__mount('sherpa-select-checkbox', undefined,
      { 'aria-label': 'Pick me', keep: true });
    await window.__mount('sherpa-select-radio', undefined,
      { 'aria-label': 'Choose me', keep: true });
  });

  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(1);
  await expect(page.getByRole('switch', { name: 'Conditional', exact: true })).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Search every filter', exact: true })).toHaveCount(1);
  await expect(page.getByRole('checkbox', { name: 'Pick me', exact: true })).toHaveCount(1);
  await expect(page.getByRole('radio', { name: 'Choose me', exact: true })).toHaveCount(1);

  // A CHANGE follows, and a removal takes the inner one away too.
  await page.evaluate(() => {
    document.querySelector('sherpa-button')!.setAttribute('aria-label', 'Close');
    document.querySelector('sherpa-switch')!.removeAttribute('aria-label');
  });
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toHaveCount(1);
  await expect(page.getByRole('switch', { name: 'Conditional', exact: true })).toHaveCount(0);
});
