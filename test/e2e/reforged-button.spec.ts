import { test, expect } from '@playwright/test';

/**
 * Foundation proof — the reforged SherpaElement, exercised end-to-end through
 * sherpa-button (the first component on the new base). Verifies the full base
 * class surface in a real browser: template fetch + stamp, adopted CSS, guarded
 * lifecycle, data-* defaults, multi-template selection, slot presence, events.
 *
 * Runs against /dist (compiled from src/), not the legacy /dist.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true, {
    timeout: 15_000,
  });
});

test('renders the template into a shadow root and applies default attrs', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'Save';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return {
      hasTrigger: !!el.shadowRoot?.querySelector('.trigger'),
      variant: el.getAttribute('data-variant'),
      size: el.getAttribute('data-size'),
      adopted: (el.shadowRoot?.adoptedStyleSheets?.length ?? 0) > 0,
    };
  });
  expect(r.hasTrigger).toBe(true);
  expect(r.variant).toBe('primary'); // default applied in onRender
  expect(r.size).toBe('md');
  expect(r.adopted).toBe(true); // stylesheets adopted into the shadow root
});

test('CSS owns the look: data-variant drives the rendered background', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (variant?: string) => {
      const el = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
      if (variant) el.setAttribute('data-variant', variant);
      el.textContent = 'X';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      const trigger = el.shadowRoot!.querySelector('.trigger')!;
      return getComputedStyle(trigger).backgroundColor;
    };
    return { primary: await mk(), secondary: await mk('secondary'), tertiary: await mk('tertiary') };
  });
  // Primary is a solid accent fill; secondary is a pale surface; tertiary is transparent.
  expect(r.primary).not.toBe(r.secondary);
  expect(r.tertiary).toBe('rgba(0, 0, 0, 0)'); // transparent
});

test('emits button-click; suppresses it when disabled', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'Go';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let clicks = 0;
    el.addEventListener('button-click', () => clicks++);

    const trigger = el.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
    trigger.click();
    const afterEnabled = clicks;

    el.setAttribute('disabled', '');
    await new Promise((res) => setTimeout(res, 0));
    trigger.click();
    const afterDisabled = clicks;

    return { afterEnabled, afterDisabled };
  });
  expect(r.afterEnabled).toBe(1);
  expect(r.afterDisabled).toBe(1); // no further clicks while disabled
});

test('multi-template: data-type="icon" stamps the icon template (no label)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-type', 'icon');
    el.setAttribute('data-icon-start', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return {
      hasLabel: !!el.shadowRoot?.querySelector('.label'),
      hasIconStart: !!el.shadowRoot?.querySelector('.icon-start'),
    };
  });
  expect(r.hasLabel).toBe(false); // icon template omits the label
  expect(r.hasIconStart).toBe(true);
});

test('slot presence reflects to data-has-content on the host', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const withText = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    withText.textContent = 'Labelled';
    document.getElementById('root')!.appendChild(withText);
    await withText.rendered;

    const empty = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    empty.setAttribute('data-label', 'via-attr');
    document.getElementById('root')!.appendChild(empty);
    await empty.rendered;
    await new Promise((res) => setTimeout(res, 0));

    return {
      withText: withText.hasAttribute('data-has-content'),
      empty: empty.hasAttribute('data-has-content'),
    };
  });
  expect(r.withText).toBe(true);
  expect(r.empty).toBe(false);
});

test('data-snap joins buttons into a seamless group (per-corner radius)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (snap: string) => {
      const b = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
      b.setAttribute('data-snap', snap);
      b.textContent = 'x';
      document.getElementById('root')!.appendChild(b);
      await b.rendered;
      const cs = getComputedStyle(b);
      return { tl: cs.borderStartStartRadius, tr: cs.borderStartEndRadius };
    };
    return { left: await mk('left'), middle: await mk('middle') };
  });
  // left keeps its top-left rounded; middle squares all corners (seamless join)
  expect(parseFloat(r.left.tl)).toBeGreaterThan(0);
  expect(parseFloat(r.middle.tl)).toBe(0);
  expect(parseFloat(r.middle.tr)).toBe(0);
});
