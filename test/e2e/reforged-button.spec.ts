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
    const trigger = el.shadowRoot!.querySelector('.trigger')!;
    const cs = getComputedStyle(trigger);
    return {
      hasTrigger: !!trigger,
      look: el.getAttribute('data-look'),
      size: el.getAttribute('data-size'),
      bg: cs.backgroundColor,
      border: cs.borderTopColor,
      adopted: (el.shadowRoot?.adoptedStyleSheets?.length ?? 0) > 0,
    };
  });
  expect(r.hasTrigger).toBe(true);
  // DEFAULT appearance ("secondary", matches Figma): no data-look, white surface, grey border.
  expect(r.look).toBe(null);
  expect(r.bg).toBe('rgb(255, 255, 255)');
  expect(r.border).not.toBe(r.bg); // a visible grey border
  expect(r.size).toBe(null); // no default size — bare button uses the base :host token block
  expect(r.adopted).toBe(true);
});

test('CSS owns the look: data-look drives the rendered background', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (look?: string) => {
      const el = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
      if (look) el.setAttribute('data-look', look);
      el.textContent = 'X';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      const trigger = el.shadowRoot!.querySelector('.trigger')!;
      return getComputedStyle(trigger).backgroundColor;
    };
    return { def: await mk(), saturated: await mk('saturated'), transparent: await mk('transparent') };
  });
  // default = white surface; saturated = solid accent fill; transparent = ghost.
  expect(r.def).toBe('rgb(255, 255, 255)');
  expect(r.saturated).not.toBe(r.def); // a distinct filled emphasis
  expect(r.transparent).toMatch(/, 0\)$/); // fully transparent (alpha 0), any base channel
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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

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
    return { left: await mk('left'), all: await mk('all') };
  });
  // Figma snap semantics: data-snap="<edge>" = snapped AGAINST that edge, so THAT
  // edge's corners go flat. "left" squares the left (top-left) corner but keeps the
  // right (top-right) rounded; "all" squares every corner (fully seamless join).
  expect(parseFloat(r.left.tl)).toBe(0);
  expect(parseFloat(r.left.tr)).toBeGreaterThan(0);
  expect(parseFloat(r.all.tl)).toBe(0);
  expect(parseFloat(r.all.tr)).toBe(0);
});

test('a disabled TRANSPARENT button dims its ink instead of growing a grey box', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (look: string | null) => {
      const b = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
      if (look) b.setAttribute('data-look', look);
      b.setAttribute('disabled', '');
      b.textContent = 'x';
      document.getElementById('root')!.appendChild(b);
      await b.rendered;
      const t = getComputedStyle(b.shadowRoot!.querySelector('.trigger')!);
      return { bg: t.backgroundColor, border: t.borderTopColor, ink: t.color };
    };
    return { transparent: await mk('transparent'), plain: await mk(null) };
  });

  // A tertiary button has no box to grey out — its look tier sets --_surface to
  // transparent (Figma's Style: Transparent extension resolves style-surface/base
  // to #ffffff at 0% alpha). Filling it on disable made a borderless control
  // suddenly grow a slab: the disabled pagination arrows painted one.
  expect(r.transparent.bg).toBe('rgba(0, 0, 0, 0)');
  expect(r.transparent.border).toBe('rgba(0, 0, 0, 0)');
  // It still says "off" — by dimming the ink, which is all it has.
  expect(r.transparent.ink).toBe('rgb(179, 179, 195)');

  // The DEFAULT look keeps Figma's inactive treatment: dark ink on grey.
  expect(r.plain.bg).toBe('rgb(179, 179, 195)');
});
