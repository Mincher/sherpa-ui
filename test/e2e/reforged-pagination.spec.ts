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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    // A Sherpa number field: its value is the host's, its `max` reaches the inner control.
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.page-input')!;
    const total = el.shadowRoot!.querySelector('.total')!.textContent ?? '';
    const opts = Array.from(el.shadowRoot!.querySelectorAll('.rows option')).map((o) => o.textContent);
    return { value: input.value, max: input.shadowRoot!.querySelector<HTMLInputElement>('.control')!.max, total: total.trim(), opts };
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

/**
 * The two fields follow the same design as every other Sherpa control. They
 * were the only ones in the system drawn SQUARE — same height, same border,
 * same fill as an input, but no rounding at all.
 */
test('the row-count select and page field are shaped like a Sherpa input', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const pager = document.createElement('sherpa-pagination') as HTMLElement & {
      rendered?: Promise<void>;
    };
    pager.setAttribute('data-rows-options', '10,25,50');
    pager.setAttribute('data-page', '1');
    pager.setAttribute('data-total-pages', '4');
    const input = document.createElement('sherpa-input-text') as HTMLElement & {
      rendered?: Promise<void>;
    };
    input.setAttribute('placeholder', 'x');
    document.getElementById('root')!.replaceChildren(pager, input);
    await pager.rendered;
    await input.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const shape = (el: Element | null | undefined): Record<string, string> | null => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        radius: cs.borderTopLeftRadius,
        // All four corners, so a shorthand cannot hide a missing one.
        corners: [cs.borderTopLeftRadius, cs.borderTopRightRadius,
                  cs.borderBottomRightRadius, cs.borderBottomLeftRadius].join(' '),
        borderColor: cs.borderTopColor,
      };
    };
    const sr = pager.shadowRoot!;
    return {
      rows: shape(sr.querySelector('.rows')),
      // The page box is a composed field: its BOX is that field's control row.
      pageInput: shape(sr.querySelector('.page-input')!.shadowRoot!.querySelector('.control-row')),
      // The control every field is measured against.
      reference: shape(input.shadowRoot!.querySelector('.control-row')),
    };
  });

  /* ROUNDED, not square — that is the whole fix, and the exact figure is not
     the contract. An input's control row reads 5px here, one more than the 4px
     token: an inset control rounds 1px outside the box it sits in, so the two
     read concentric. Asserting a number would pin that idiom by accident. */
  for (const field of [r.rows!, r.pageInput!]) {
    expect(parseFloat(field.radius)).toBeGreaterThan(0);
    // Every corner, so a shorthand cannot hide a missing one.
    expect(new Set(field.corners.split(' ')).size).toBe(1);
  }
  // The two pager fields agree with EACH OTHER — they sit side by side.
  expect(r.rows!.corners).toBe(r.pageInput!.corners);
  /* The page field takes the same border as every other field. The SELECT is
     not asserted here: WebKit reports `currentcolor` for a native <select>'s
     border on a first read and the declared value only after a forced style
     recalc — an inline write to the same property flips it. The paint is
     correct; the read-back is not, so asserting it tests the engine.
     TRAP T-a-native-select-keeps-its-own-shape */
  expect(r.pageInput!.borderColor).toBe(r.reference!.borderColor);
});

test('the page box is a Sherpa number field: its stepper moves the page, and only page-change leaves', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-pagination') as PagerEl;
    el.setAttribute('data-page', '2');
    el.setAttribute('data-total-pages', '3');
    document.getElementById('root')!.appendChild(el);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const box = el.shadowRoot!.querySelector<HTMLElement>('.page-input')!;
    const leaked: string[] = [];
    for (const type of ['change', 'input']) document.addEventListener(type, (e) => { if (e instanceof CustomEvent) leaked.push(type); });
    const pages: number[] = [];
    el.addEventListener('page-change', (e) => pages.push((e as CustomEvent).detail.page));
    const up = box.shadowRoot!.querySelector('.steppers sherpa-button')!.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
    up.click();
    // At the last page the stepper stops, as the field's `max` says.
    up.click();
    return {
      box: `${box.localName}[${box.getAttribute('data-type')}]`,
      bare: el.shadowRoot!.querySelectorAll('input[type="number"]').length,
      pages, page: el.getAttribute('data-page'), leaked,
    };
  });
  expect(r).toEqual({ box: 'sherpa-input-text[number]', bare: 0, pages: [3], page: '3', leaked: [] });
});
