import { test, expect } from './harness';

/**
 * sherpa-swatch-picker (TODO 904): a button wearing the colour now opens a grid of the ten data-viz colours, native radios in
 * a popover. A pick sets the value (the token), fires change, shuts the grid and gives the button the focus; the arrows move
 * the pick; a form submits it; a colour not in the palette shows on the button as Custom, nothing ticked.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend',
      '<form id="f"><sherpa-swatch-picker id="p" name="colour" data-label="Colour" value="var(--sherpa-data-viz-series-border-3)"></sherpa-swatch-picker></form>');
    await (document.getElementById('p') as HTMLElement & { rendered: Promise<void> }).rendered;
    await window.__settled();
  });
});

const picker = '#p';

test('the button wears the colour now and names it; the grid holds the ten, the one now ticked', async ({ page }) => {
  await expect(page.locator(`${picker} .name`)).toHaveText('Teal');
  await page.locator(`${picker} .trigger`).click();
  await expect(page.locator(`${picker} .swatches`)).toBeVisible();
  expect(await page.locator(`${picker} .swatch`).count()).toBe(10);
  expect(await page.locator(`${picker} .swatch input:checked`).getAttribute('value')).toBe('var(--sherpa-data-viz-series-border-3)');
});

test('a pick sets the value, fires change, shuts the grid and gives the button the focus; a form submits it', async ({ page }) => {
  await page.evaluate(() => document.getElementById('p')!.addEventListener('change', (e) => { (window as never as { said: unknown }).said = (e as CustomEvent).detail; }));
  await page.locator(`${picker} .trigger`).click();
  await page.locator(`${picker} .swatch[title="Raspberry"]`).click();
  await expect(page.locator(picker)).toHaveAttribute('value', 'var(--sherpa-data-viz-series-border-8)');
  await expect(page.locator(`${picker} .swatches`)).toBeHidden();
  expect(await page.evaluate(() => (window as never as { said: unknown }).said)).toEqual({ value: 'var(--sherpa-data-viz-series-border-8)' });
  expect(await page.evaluate(() => document.getElementById('p')!.shadowRoot!.activeElement?.className)).toContain('trigger');
  expect(await page.evaluate(() => new FormData(document.getElementById('f') as HTMLFormElement).get('colour'))).toBe('var(--sherpa-data-viz-series-border-8)');
});

test('the arrows move the pick in the grid', async ({ page }) => {
  await page.locator(`${picker} .trigger`).click();
  await page.locator(`${picker} .swatch input:checked`).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(picker)).toHaveAttribute('value', 'var(--sherpa-data-viz-series-border-4)');
});

test('a colour not in the palette shows on the button as Custom, and no swatch is ticked', async ({ page }) => {
  await page.evaluate(() => document.getElementById('p')!.setAttribute('value', '#2e9e6b'));
  await expect(page.locator(`${picker} .name`)).toHaveText('Custom');
  expect(await page.locator(`${picker} .swatch input:checked`).count()).toBe(0);
  expect(await page.locator(`${picker} .current`).evaluate((c) => getComputedStyle(c).backgroundColor)).toBe('rgb(46, 158, 107)');
});
