import { test, expect } from '@playwright/test';

/**
 * sherpa-tag on the reforged base — the color-enum pattern (data-color drives a
 * categorical hue), solid/soft variants, the removable close button + event, and
 * the collapsed indicator. Proves the token-growth model (categorical tokens
 * added on demand) resolves correctly.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('data-color drives the pill fill from the categorical tokens', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (color?: string) => {
      const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
      if (color) el.setAttribute('data-color', color);
      el.textContent = 'tag';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el.shadowRoot!.querySelector('.pill')!).backgroundColor;
    };
    return { c1: await mk(), c5: await mk('5'), c10: await mk('10') };
  });
  expect(r.c1).toBe('rgb(123, 28, 230)'); // categorical-1 #7b1ce6 (default)
  expect(r.c5).toBe('rgb(65, 65, 239)'); // categorical-5 #4141ef
  expect(r.c10).toBe('rgb(32, 193, 115)'); // categorical-10 #20c173
  expect(r.c1).not.toBe(r.c5);
});

test('secondary variant is a soft tint, not the solid fill', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const solid = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    solid.setAttribute('data-color', '5');
    solid.textContent = 'x';
    document.getElementById('root')!.appendChild(solid);
    await solid.rendered;

    const soft = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    soft.setAttribute('data-color', '5');
    soft.setAttribute('data-variant', 'secondary');
    soft.textContent = 'x';
    document.getElementById('root')!.appendChild(soft);
    await soft.rendered;

    return {
      solid: getComputedStyle(solid.shadowRoot!.querySelector('.pill')!).backgroundColor,
      soft: getComputedStyle(soft.shadowRoot!.querySelector('.pill')!).backgroundColor,
    };
  });
  expect(r.solid).toBe('rgb(65, 65, 239)'); // full categorical-5
  expect(r.soft).not.toBe(r.solid); // a mixed/transparent tint
});

test('removable template adds a close button that fires tag-remove', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-removable', '');
    el.textContent = 'removable';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let removed = 0;
    el.addEventListener('tag-remove', () => removed++);
    const close = el.shadowRoot!.querySelector<HTMLElement>('.close');
    close?.click();

    return { hasClose: !!close, removed };
  });
  expect(r.hasClose).toBe(true);
  expect(r.removed).toBe(1);
});

test('default template has no close button', async ({ page }) => {
  const hasClose = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'plain';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return !!el.shadowRoot?.querySelector('.close');
  });
  expect(hasClose).toBe(false);
});

test('collapsed renders a small square indicator (no text metrics)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-collapsed', '');
    el.setAttribute('data-color', '3');
    el.textContent = 'hidden';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const pill = el.shadowRoot!.querySelector('.pill')!;
    const cs = getComputedStyle(pill);
    return { fontSize: cs.fontSize, width: cs.width };
  });
  expect(r.fontSize).toBe('0px'); // label hidden
  expect(parseFloat(r.width)).toBeLessThan(16); // small indicator
});
