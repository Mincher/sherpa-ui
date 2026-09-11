import { test, expect } from '@playwright/test';

/**
 * sherpa-pagination on the reforged base — the Figma two-zone control (48:65826):
 * a "Rows per page" select + a first/prev · page-input · "of N" · next/last stepper.
 * Proves the page input + total render, prev/next/first/last move and disable at the
 * boundaries, page-change / page-size-change fire, and the rows-per-page select works.
 */

const HARNESS = '/test/reforged/harness.html';

type PagerEl = HTMLElement & {
  rendered?: Promise<void>;
  page?: number;
  totalPages?: number;
  pageSize?: number;
  goToPage?: (n: number) => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-pagination'));
});

test('renders the page input + "of N" total and the rows-per-page select', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-pagination') as PagerEl;
    el.setAttribute('data-page', '2');
    el.setAttribute('data-total-pages', '10');
    el.setAttribute('data-rows-options', '10,25,50');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.page-input')!;
    const total = el.shadowRoot!.querySelector('.total')!.textContent ?? '';
    const opts = Array.from(el.shadowRoot!.querySelectorAll('.rows option')).map((o) => o.textContent);
    return { value: input.value, max: input.max, total: total.trim(), opts };
  });
  expect(r.value).toBe('2');
  expect(r.max).toBe('10');
  expect(r.total).toContain('10'); // "of 10"
  expect(r.opts).toEqual(['10', '25', '50']);
});

test('first / prev / next / last move the page and fire page-change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-pagination') as PagerEl;
    el.setAttribute('data-page', '5');
    el.setAttribute('data-total-pages', '10');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const pages: number[] = [];
    el.addEventListener('page-change', (e) => pages.push((e as CustomEvent).detail.page));
    const click = (sel: string) => el.shadowRoot!.querySelector<HTMLButtonElement>(sel)!.click();
    click('.btn.prev');
    click('.btn.next');
    click('.btn.first');
    click('.btn.last');
    return { pages, page: el.getAttribute('data-page') };
  });
  expect(r.pages).toEqual([4, 5, 1, 10]);
  expect(r.page).toBe('10');
});

test('prev / first disable at page 1; next / last disable at the last page', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (pageNo: string) => {
      const el = document.createElement('sherpa-pagination') as PagerEl;
      el.setAttribute('data-page', pageNo);
      el.setAttribute('data-total-pages', '10');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      // The controls are composed <sherpa-button>s, which take `disabled` as an
      // ATTRIBUTE (and mirror it onto their own inner <button>) — a `.disabled`
      // PROPERTY on the host is not the native one and reads undefined.
      const dis = (sel: string) => el.shadowRoot!.querySelector(sel)!.hasAttribute('disabled');
      return { prev: dis('.btn.prev'), first: dis('.btn.first'), next: dis('.btn.next'), last: dis('.btn.last') };
    };
    return { atStart: await mk('1'), atEnd: await mk('10') };
  });
  expect(r.atStart.prev).toBe(true);
  expect(r.atStart.first).toBe(true);
  expect(r.atStart.next).toBe(false);
  expect(r.atEnd.next).toBe(true);
  expect(r.atEnd.last).toBe(true);
  expect(r.atEnd.prev).toBe(false);
});

test('changing the rows-per-page select fires page-size-change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-pagination') as PagerEl;
    el.setAttribute('data-page', '1');
    el.setAttribute('data-total-pages', '10');
    el.setAttribute('data-rows-options', '10,25,50');
    el.setAttribute('data-page-size', '10');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    let size: number | null = null;
    el.addEventListener('page-size-change', (e) => (size = (e as CustomEvent).detail.pageSize));
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('.rows')!;
    select.value = '25';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { size };
  });
  expect(r.size).toBe(25);
});

test('the host is border-box, so padding does not push it wider than a sibling', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    // A fixed-width column, with a plain block and the pager as siblings. Both are
    // 100% wide, so any box-model mismatch shows up as a width difference.
    const col = document.createElement('div');
    col.style.cssText = 'inline-size: 600px; display: flex; flex-direction: column;';
    const ruler = document.createElement('div');
    ruler.style.cssText = 'inline-size: 100%; block-size: 8px;';
    const pager = document.createElement('sherpa-pagination') as HTMLElement & {
      rendered?: Promise<void>;
    };
    pager.setAttribute('data-page', '1');
    pager.setAttribute('data-total-pages', '3');
    col.append(ruler, pager);
    root.appendChild(col);
    await pager.rendered;

    const cs = getComputedStyle(pager);
    // The PADDING lives on the inner .pagination row, not the host — the host was
    // carrying it AND the flex rules while the row inside was an unstyled block
    // that hugged its content, so the zones never spread to the full width.
    const row = pager.shadowRoot!.querySelector('.pagination')!;
    const rs = getComputedStyle(row);
    return {
      boxSizing: cs.boxSizing,
      rowBoxSizing: rs.boxSizing,
      padding: rs.paddingLeft,
      rowJustify: rs.justifyContent,
      rulerWidth: Math.round(ruler.getBoundingClientRect().width),
      pagerWidth: Math.round(pager.getBoundingClientRect().width),
      rowWidth: Math.round(row.getBoundingClientRect().width),
    };
  });

  // `*` inside a shadow root does NOT match :host, so the base reset has to set
  // this on :host explicitly. Without it the pager's 12px side padding rendered
  // OUTSIDE its 100% width and it sat 24px wider than the grid above it.
  expect(r.boxSizing).toBe('border-box');
  expect(r.rowBoxSizing).toBe('border-box');
  expect(r.padding).not.toBe('0px'); // the padding that would have overflowed
  expect(r.pagerWidth).toBe(r.rulerWidth);
  expect(r.pagerWidth).toBe(600);
  // The ROW fills the host too — that is what puts rows-per-page hard left and the
  // page controls hard right, rather than bunching them all on the left.
  expect(r.rowWidth).toBe(600);
  expect(r.rowJustify).toBe('space-between');
});
