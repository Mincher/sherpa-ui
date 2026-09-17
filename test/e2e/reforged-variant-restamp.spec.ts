import { test, expect } from './harness';

/**
 * Changing the attribute a component's `templateId` reads must RE-STAMP its
 * shadow tree.
 *
 * It did not. `templateId` was read once, at first render, so a component kept
 * whatever tree it was BORN with and every later write was ignored. The failure
 * was silent and looked partly right: flipping sherpa-button to `data-type="icon"`
 * drew the icon (a declared prop writes it either way) while the label, badge and
 * menu slots the icon variant does not have stayed in the tree.
 *
 * The attribute has to be observed for the re-stamp to fire, which is what
 * `static variantAttrs` declares.
 */

interface El extends HTMLElement {
  rendered?: Promise<void>;
}

const settled = (page: import('@playwright/test').Page): Promise<void> =>
  page.evaluate(() => (window as unknown as { __settled: () => Promise<void> }).__settled());

test('a button flipped to icon matches one BORN as icon', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();
    const make = async (icon: boolean): Promise<El> => {
      const el = document.createElement('sherpa-button') as El;
      el.textContent = 'Go';
      if (icon) el.setAttribute('data-type', 'icon');
      el.setAttribute('data-icon-start', 'fa-solid fa-plus');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return el;
    };

    const born = await make(true);
    const flipped = await make(false);
    const labelBefore = !!flipped.shadowRoot!.querySelector('.label');

    flipped.setAttribute('data-type', 'icon');
    await settle();
    const labelAfter = !!flipped.shadowRoot!.querySelector('.label');
    const matches = born.shadowRoot!.innerHTML === flipped.shadowRoot!.innerHTML;

    // And BACK again — a re-stamp is not one-way.
    flipped.removeAttribute('data-type');
    await settle();
    return { matches, labelBefore, labelAfter, labelBack: !!flipped.shadowRoot!.querySelector('.label') };
  });

  expect(r.labelBefore).toBe(true);
  // The icon template has no label/badge/menu — they must be GONE, not hidden.
  expect(r.labelAfter).toBe(false);
  expect(r.matches).toBe(true);
  expect(r.labelBack).toBe(true);
});

test('data-multiline swaps the input for a textarea, still wired', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();
    const el = document.createElement('sherpa-input-text') as El;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const before = el.shadowRoot!.querySelector('.control')?.tagName;

    el.setAttribute('data-multiline', '');
    await settle();
    const after = el.shadowRoot!.querySelector('.control')?.tagName;

    // onRender ran again, so the NEW control is the one the component listens to
    // and the one it reports its value from.
    let heard = 0;
    el.addEventListener('input', () => heard++);
    const control = el.shadowRoot!.querySelector('.control') as HTMLTextAreaElement;
    control.value = 'hello';
    control.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();

    return { before, after, heard, value: (el as unknown as { value?: string }).value };
  });

  expect(r.before).toBe('INPUT');
  expect(r.after).toBe('TEXTAREA');
  expect(r.heard).toBe(1);
  expect(r.value).toBe('hello');
});

test('a re-stamped nav-item emits its click ONCE', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();
    const make = async (): Promise<El> => {
      const el = document.createElement('sherpa-nav-item') as El;
      el.setAttribute('data-label', 'Home');
      el.setAttribute('data-href', '#x');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return el;
    };

    // Baseline: never re-stamped.
    const plain = await make();
    let plainClicks = 0;
    plain.addEventListener('item-click', () => plainClicks++);
    (plain.shadowRoot!.querySelector('.nav') as HTMLElement).click();
    await settle();

    // Re-stamped default → promo. onRender runs again and re-adds the HOST
    // listener; addEventListener drops the duplicate because the handler is a
    // stable arrow field.
    const restamped = await make();
    restamped.setAttribute('data-type', 'promo');
    await settle();
    let clicks = 0;
    restamped.addEventListener('item-click', () => clicks++);
    (restamped.shadowRoot!.querySelector('.promo') as HTMLElement).click();
    await settle();

    return { plainClicks, clicks };
  });

  expect(r.plainClicks).toBe(1);
  expect(r.clicks).toBe(1);
});

test('a single-template component is never re-stamped', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await settled(page);
  const stable = await page.evaluate(async () => {
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();
    const el = document.createElement('sherpa-toast') as El;
    el.setAttribute('data-heading', 'First');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const node = el.shadowRoot!.querySelector('.toast');
    el.setAttribute('data-heading', 'Second');
    await settle();
    // The SAME node object, so the tree was never replaced — a declared prop
    // rewrote its text in place.
    return el.shadowRoot!.querySelector('.toast') === node;
  });
  expect(stable).toBe(true);
});
