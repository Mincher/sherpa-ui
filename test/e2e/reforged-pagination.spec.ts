import { test, expect } from '@playwright/test';

/**
 * sherpa-pagination on the reforged base — page navigation. Proves the numbered
 * buttons render from data-total-pages, the current page is highlighted +
 * non-interactive, clicking a page / prev / next fires page-change and moves
 * data-current-page, prev/next disable at the boundaries, and large ranges window
 * with ellipsis gaps.
 */

const HARNESS = '/test/reforged/harness.html';

type PagerEl = HTMLElement & {
  rendered?: Promise<void>;
  page?: number;
  totalPages?: number;
  goToPage?: (n: number) => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-pagination'));
});

test('renders a numbered button per page and highlights the current one', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-pagination') as PagerEl;
    el.setAttribute('data-total-pages', '5');
    el.setAttribute('data-current-page', '2');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const nums = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.num')).map(
      (b) => b.textContent,
    );
    const current = el.shadowRoot!.querySelector('.num[data-current]')?.textContent;
    const currentAria = el.shadowRoot!.querySelector('.num[data-current]')?.getAttribute('aria-current');
    return { nums, current, currentAria };
  });
  expect(r.nums).toEqual(['1', '2', '3', '4', '5']); // small range → no gaps
  expect(r.current).toBe('2'); // current-page highlighted
  expect(r.currentAria).toBe('page');
});

test('clicking a page fires page-change and moves data-current-page', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-pagination') as PagerEl;
    el.setAttribute('data-total-pages', '5');
    el.setAttribute('data-current-page', '1');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired: number | null = null;
    el.addEventListener('page-change', (e) => (fired = (e as CustomEvent).detail.page));

    // Page 2 is always in the window adjacent to current=1 (page 3 would be
    // ellipsised at this current page).
    const two = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.num')).find(
      (b) => b.dataset['page'] === '2',
    )!;
    two.click();
    await new Promise((res) => setTimeout(res, 10));

    const current = el.shadowRoot!.querySelector('.num[data-current]')?.textContent;
    return { fired, page: el.getAttribute('data-current-page'), current };
  });
  expect(r.fired).toBe(2);
  expect(r.page).toBe('2');
  expect(r.current).toBe('2'); // re-render highlighted the new page
});

test('prev / next move by one and disable at the boundaries', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-pagination') as PagerEl;
    el.setAttribute('data-total-pages', '3');
    el.setAttribute('data-current-page', '1');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const prev = el.shadowRoot!.querySelector<HTMLButtonElement>('.prev')!;
    const next = el.shadowRoot!.querySelector<HTMLButtonElement>('.next')!;

    const prevDisabledAtStart = prev.disabled;

    let last: number | null = null;
    el.addEventListener('page-change', (e) => (last = (e as CustomEvent).detail.page));

    next.click(); // 1 → 2
    await new Promise((res) => setTimeout(res, 10));
    const afterNext = el.getAttribute('data-current-page');

    next.click(); // 2 → 3 (now at last)
    await new Promise((res) => setTimeout(res, 10));
    const nextDisabledAtEnd = el.shadowRoot!.querySelector<HTMLButtonElement>('.next')!.disabled;

    return { prevDisabledAtStart, afterNext, nextDisabledAtEnd, last };
  });
  expect(r.prevDisabledAtStart).toBe(true); // page 1 → prev disabled
  expect(r.afterNext).toBe('2');
  expect(r.nextDisabledAtEnd).toBe(true); // last page → next disabled
  expect(r.last).toBe(3);
});

test('large ranges window with ellipsis gaps around the current page', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-pagination') as PagerEl;
    el.setAttribute('data-total-pages', '20');
    el.setAttribute('data-current-page', '10');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const nums = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.num')).map(
      (b) => b.textContent,
    );
    const gaps = el.shadowRoot!.querySelectorAll('.gap').length;
    return { nums, gaps };
  });
  // 1 … 9 10 11 … 20  → the numbers present, two ellipsis gaps
  expect(r.nums).toEqual(['1', '9', '10', '11', '20']);
  expect(r.gaps).toBe(2);
});
