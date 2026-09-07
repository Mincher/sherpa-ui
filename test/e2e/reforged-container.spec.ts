import { test, expect } from '@playwright/test';

/**
 * sherpa-container on the reforged base — the composition surface. Exercises the
 * base class's slot-presence reflection (data-has-header/footer), elevation,
 * padding, the populate({state}) → loading overlay data path, and the SLOT-DRIVEN
 * empty / error overlays (ratified D6: no data-state attr — slotting [slot="error"]
 * reflects data-has-error and shows the overlay through CSS).
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('header/footer regions collapse when empty, appear when slotted', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // Bare container — no header/footer content.
    const bare = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    bare.innerHTML = '<p>body only</p>';
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await new Promise((res) => setTimeout(res, 0));

    // Container with a header + footer.
    const full = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    full.innerHTML =
      '<div slot="header">Title</div><p>body</p><div slot="footer">Actions</div>';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const vis = (el: HTMLElement, sel: string) =>
      getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';

    return {
      bareHeaderAttr: bare.hasAttribute('data-has-header'),
      bareHeaderVisible: vis(bare, '.header'),
      fullHeaderAttr: full.hasAttribute('data-has-header'),
      fullHeaderVisible: vis(full, '.header'),
      fullFooterVisible: vis(full, '.footer'),
    };
  });
  expect(r.bareHeaderAttr).toBe(false);
  expect(r.bareHeaderVisible).toBe(false); // collapsed
  expect(r.fullHeaderAttr).toBe(true); // base class reflected the slot
  expect(r.fullHeaderVisible).toBe(true);
  expect(r.fullFooterVisible).toBe(true);
});

test('data-elevation applies a box-shadow', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (elev?: string) => {
      const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
      if (elev) el.setAttribute('data-elevation', elev);
      el.innerHTML = '<p>x</p>';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el).boxShadow;
    };
    return { none: await mk(), md: await mk('md') };
  });
  expect(r.none).toBe('none');
  expect(r.md).not.toBe('none'); // shadow present
});

test('populate({state}) toggles the state overlay; clearing removes it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const overlayVisible = () => getComputedStyle(el.shadowRoot!.querySelector('.state')!).display !== 'none';

    el.populate!({ state: 'loading' });
    await new Promise((res) => setTimeout(res, 10));
    const loadingShown = overlayVisible();
    const spinnerShown = getComputedStyle(el.shadowRoot!.querySelector('.state-loading')!).display !== 'none';

    el.populate!({ state: null });
    await new Promise((res) => setTimeout(res, 10));
    const clearedHidden = !overlayVisible();

    return { loadingShown, spinnerShown, clearedHidden };
  });
  expect(r.loadingShown).toBe(true);
  expect(r.spinnerShown).toBe(true);
  expect(r.clearedHidden).toBe(true);
});

test('slotting [slot="error"] shows the error overlay (slot-driven, D6), not loading/empty', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    // No data-state attribute — the overlay is driven purely by slot content.
    el.innerHTML = '<p>body</p><div slot="error">It broke.</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0)); // let slotchange reflect data-has-error

    const shown = (sel: string) => getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';
    return {
      hasErrorAttr: el.hasAttribute('data-has-error'),
      hasStateAttr: el.hasAttribute('data-state'),
      overlay: shown('.state'),
      error: shown('.state-error'),
      loading: shown('.state-loading'),
      empty: shown('.state-empty'),
    };
  });
  expect(r.hasErrorAttr).toBe(true); // base class reflected the error slot
  expect(r.hasStateAttr).toBe(false); // no public data-state API
  expect(r.overlay).toBe(true);
  expect(r.error).toBe(true);
  expect(r.loading).toBe(false);
  expect(r.empty).toBe(false);
});

test('slotting [slot="empty"] shows the empty overlay (slot-driven, D6)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML = '<p>body</p><div slot="empty">No rows.</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const shown = (sel: string) => getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';
    return {
      hasEmptyAttr: el.hasAttribute('data-has-empty'),
      overlay: shown('.state'),
      empty: shown('.state-empty'),
      error: shown('.state-error'),
      loading: shown('.state-loading'),
    };
  });
  expect(r.hasEmptyAttr).toBe(true);
  expect(r.overlay).toBe(true);
  expect(r.empty).toBe(true);
  expect(r.error).toBe(false);
  expect(r.loading).toBe(false);
});

test('data-color-set tints the container surface via the color-sets override', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (set?: string) => {
      const c = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
      if (set) c.setAttribute('data-color-set', set);
      c.innerHTML = '<div slot="body">x</div>';
      document.getElementById('root')!.appendChild(c);
      await c.rendered;
      return getComputedStyle(c).backgroundColor;
    };
    return { neutral: await mk(), violet: await mk('violet'), teal: await mk('teal') };
  });
  expect(r.neutral).toBe('rgb(255, 255, 255)'); // passthrough = white
  expect(r.violet).not.toBe(r.neutral); // hue re-points the surface
  expect(r.teal).not.toBe(r.violet); // each hue distinct
});
