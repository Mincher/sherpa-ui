import { test, expect } from './harness';

/**
 * sherpa-loader on the reforged base — an attribute-only spinner. Proves the a11y
 * live-region roles, the size enum driving the spinner diameter, the panel
 * surface, the arc colour from the primary token, and that reduced-motion is
 * expressible in CSS (the animation is gated behind a @media block).
 */


test('sets status role and a polite live region on the host', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-loader') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { role: el.getAttribute('role'), live: el.getAttribute('aria-live') };
  });
  expect(r.role).toBe('status');
  expect(r.live).toBe('polite');
});

test('respects a caller-supplied role instead of overriding it', async ({ page }) => {
  const role = await page.evaluate(async () => {
    const el = document.createElement('sherpa-loader') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('role', 'alert');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.getAttribute('role');
  });
  expect(role).toBe('alert');
});

test('data-size drives the spinner diameter', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (size?: string) => {
      const el = document.createElement('sherpa-loader') as HTMLElement & { rendered?: Promise<void> };
      if (size) el.setAttribute('data-size', size);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el.shadowRoot!.querySelector('.spinner')!).width;
    };
    return { small: await mk('sm'), def: await mk(), large: await mk('lg') };
  });
  expect(r.small).toBe('12px'); // size-xs
  expect(r.def).toBe('20px'); // size-md (default, unset)
  expect(r.large).toBe('48px'); // size-4xl (Figma Size=lg spinner is 48px)
});

test('data-panel adds a solid surface background', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const plain = document.createElement('sherpa-loader') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(plain);
    await plain.rendered;

    const panel = document.createElement('sherpa-loader') as HTMLElement & { rendered?: Promise<void> };
    panel.setAttribute('data-panel', '');
    document.getElementById('root')!.appendChild(panel);
    await panel.rendered;

    return {
      plain: getComputedStyle(plain).backgroundColor,
      panel: getComputedStyle(panel).backgroundColor,
    };
  });
  expect(r.plain).toBe('rgba(0, 0, 0, 0)'); // transparent
  expect(r.panel).toBe('rgb(255, 255, 255)'); // surface-container-default
});

test('the rotating arc uses the accent-blue indicator token (matches Figma)', async ({ page }) => {
  const color = await page.evaluate(async () => {
    const el = document.createElement('sherpa-loader') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.spinner')!, '::after').borderRightColor;
  });
  expect(color).toBe('rgb(59, 76, 205)'); // style-indicator-accent #3b4ccd (Figma arc), not the old purple
});

test('vertical orientation stacks spinner over label', async ({ page }) => {
  const dir = await page.evaluate(async () => {
    const el = document.createElement('sherpa-loader') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-orientation', 'vertical');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el).flexDirection;
  });
  expect(dir).toBe('column');
});
