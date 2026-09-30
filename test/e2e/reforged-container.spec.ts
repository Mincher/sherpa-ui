import { test, expect } from './harness';

/**
 * sherpa-container on the reforged base — the composition surface. Exercises the
 * base class's slot-presence reflection (data-has-header/footer), elevation,
 * padding, the populate({state}) → loading overlay data path, and the SLOT-DRIVEN
 * empty / error overlays (ratified D6: no data-state attr — slotting [slot="error"]
 * reflects data-has-error and shows the overlay through CSS).
 */


test('header/footer regions collapse when empty, appear when slotted', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // Bare container — no header/footer content.
    const bare = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    bare.innerHTML = '<p>body only</p>';
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    // Container with a header + footer.
    const full = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    full.innerHTML =
      '<div slot="header">Title</div><p>body</p><div slot="footer">Actions</div>';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const loadingShown = overlayVisible();
    const spinnerShown = getComputedStyle(el.shadowRoot!.querySelector('.state-loading')!).display !== 'none';

    el.populate!({ state: null });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
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
    await (window as unknown as { __settled: () => Promise<void> }).__settled(); // let slotchange reflect data-has-error

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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

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

/**
 * THE DATA'S STATE, IN PLACE OF THE BODY — TODO 58. Empty, no matches and an
 * error each show their own default content; an error says its words and
 * offers Retry (the CTA) and Dismiss; loading wins over the rest.
 * TRAP T-a-container-shows-its-datas-state
 */
test('each data state shows its own default, and its buttons ask or dismiss', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const settle = (window as unknown as { __settled: () => Promise<void> }).__settled;
    const sr = el.shadowRoot!;
    const on = (sel: string) => !!sr.querySelector<HTMLElement>(sel)?.checkVisibility();
    const look = () => ({
      loading: on('.state-loading sherpa-loader'), empty: on('.empty-default'),
      noMatches: on('.no-matches-default'), error: on('.error-default'),
    });
    const heard: string[] = [];
    for (const n of ['data-refresh', 'state-dismiss', 'filters-clear']) el.addEventListener(n, () => heard.push(n));
    const press = (sel: string) => (sr.querySelector(sel) as HTMLElement).shadowRoot!.querySelector<HTMLElement>('button')!.click();
    const out: Record<string, unknown> = {};
    for (const state of ['empty', 'no-matches', 'error', 'loading']) {
      el.populate({ state, message: 'The server did not answer.' });
      await settle();
      out[state] = look();
    }
    el.populate({ state: 'no-matches' });
    await settle();
    press('.clear-filters');
    el.populate({ state: 'error', message: 'The server did not answer.' });
    await settle();
    out['said'] = sr.querySelector('.error-message')?.textContent;
    out['cta'] = sr.querySelector('.retry')?.getAttribute('data-look');
    press('.retry');
    press('.dismiss');
    await settle();
    out['dismissed'] = { state: el.dataset['state'] ?? null, body: on('.state') };
    return { ...out, heard };
  });
  const none = { loading: false, empty: false, noMatches: false, error: false };
  expect(r['empty']).toEqual({ ...none, empty: true });
  expect(r['no-matches']).toEqual({ ...none, noMatches: true });
  expect(r['error']).toEqual({ ...none, error: true });
  expect(r['loading']).toEqual({ ...none, loading: true });
  expect(r['said']).toBe('The server did not answer.');
  expect(r['cta']).toBe('saturated');
  expect(r['dismissed']).toEqual({ state: null, body: false });
  expect(r['heard']).toEqual(['filters-clear', 'data-refresh', 'state-dismiss']);
});
