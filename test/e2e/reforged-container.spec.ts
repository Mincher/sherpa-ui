import { test, expect } from '@playwright/test';

/**
 * sherpa-container on the reforged base — the composition surface. Exercises the
 * base class's slot-presence reflection (data-has-header/footer), elevation,
 * padding, and the populate({state}) → overlay data path.
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

test('error state shows the error slot, not loading/empty', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-state', 'error');
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const shown = (sel: string) => getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';
    return { error: shown('.state-error'), loading: shown('.state-loading'), empty: shown('.state-empty') };
  });
  expect(r.error).toBe(true);
  expect(r.loading).toBe(false);
  expect(r.empty).toBe(false);
});
