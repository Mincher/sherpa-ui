import { test, expect } from './harness';

/**
 * sherpa-layout-grid — the layout grid as an ELEMENT.
 *
 * The tracks are NOT in this component. They are `.sherpa-grid` in the
 * generated tokens.css, projected from Figma, and the host wears that class —
 * copying the rules here would fork the projection, and a document class cannot
 * reach a shadow root anyway. TRAP T-a-document-class-cannot-reach-a-shadow-root
 *
 * What the element adds is the one number CSS cannot work out: `--_fit-rows`.
 * `<div class="sherpa-grid">` still works; it just needs the app to call
 * bindFitGrid by hand, which is what this element exists to stop.
 */

const mount = async (page: import('@playwright/test').Page, html: string, attrs = '') =>
  page.evaluate(
    async ({ html, attrs }) => {
      await import('/dist/index.js');
      const root = document.getElementById('root')!;
      root.style.cssText = 'block-size: 600px';
      root.replaceChildren();
      const g = document.createElement('sherpa-layout-grid') as HTMLElement & { rendered?: Promise<void> };
      for (const pair of attrs.split(' ').filter(Boolean)) {
        const [k, v] = pair.split('=');
        g.setAttribute(k!, v ?? '');
      }
      g.innerHTML = html;
      root.appendChild(g);
      await g.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return null;
    },
    { html, attrs },
  );

const read = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const g = document.querySelector('sherpa-layout-grid') as HTMLElement;
    const cs = getComputedStyle(g);
    return {
      display: cs.display,
      columns: cs.gridTemplateColumns.split(' ').length,
      columnGap: cs.columnGap,
      // The CSS CLASS keeps Figma's name; only the ELEMENT is sherpa-layout-grid.
      wearsClass: g.classList.contains('sherpa-grid'),
      fitRows: g.style.getPropertyValue('--_fit-rows'),
      spans: [...g.children].map((c) => getComputedStyle(c).gridColumn),
    };
  });

test('the host wears the projected class, so the tokens reach it unchanged', async ({ page }) => {
  await mount(page, '<div data-col-span="medium">a</div><div data-col-span="small">b</div>');
  const r = await read(page);

  expect(r.wearsClass).toBe(true);
  expect(r.display).toBe('grid');
  // 12 tracks and a real gap prove the DOCUMENT rule applied to the host.
  expect(r.columns).toBe(12);
  expect(r.columnGap).not.toBe('0px');
  // The children are LIGHT DOM, so `.sherpa-grid > [data-col-span]` matches them.
  expect(r.spans).toEqual(['span 4', 'span 3']);
});

test('a fit grid measures its own row count', async ({ page }) => {
  await mount(
    page,
    '<div data-col-span="full">a</div><div data-col-span="full" data-grow>filler</div>',
    'data-rows=fit',
  );
  // One row sits above the filler. Nothing in the app had to ask for this.
  expect((await read(page)).fitRows).toBe('1');
});

test('the count follows the content', async ({ page }) => {
  await mount(
    page,
    '<div data-col-span="full">a</div><div data-col-span="full" data-grow>filler</div>',
    'data-rows=fit',
  );
  const settle = async (): Promise<void> => {
    await page.evaluate(() => (window as unknown as { __settled: () => Promise<void> }).__settled());
  };

  const added = await page.evaluate(async () => {
    const g = document.querySelector('sherpa-layout-grid')!;
    const extra = document.createElement('div');
    extra.setAttribute('data-col-span', 'full');
    extra.textContent = 'c';
    g.insertBefore(extra, g.lastElementChild);
    return null;
  });
  void added;
  await settle();
  expect((await read(page)).fitRows).toBe('2');

  await page.evaluate(() => {
    document.querySelector('sherpa-layout-grid')!.children[1]!.remove();
  });
  await settle();
  expect((await read(page)).fitRows).toBe('1');
});

/**
 * A router detaches a view and re-attaches it. `signal` is a NEW
 * AbortController each connect, so a bind made in onRender — which fires once —
 * holds one that is already aborted. TRAP T-abort-controller-per-connect
 */
test('it still measures after a detach and re-attach', async ({ page }) => {
  await mount(
    page,
    '<div data-col-span="full">a</div><div data-col-span="full" data-grow>filler</div>',
    'data-rows=fit',
  );

  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const g = document.querySelector('sherpa-layout-grid')!;
    g.remove();
    root.appendChild(g);
    const extra = document.createElement('div');
    extra.setAttribute('data-col-span', 'full');
    extra.textContent = 'c';
    g.insertBefore(extra, g.lastElementChild);
  });
  await page.evaluate(() => (window as unknown as { __settled: () => Promise<void> }).__settled());

  expect((await read(page)).fitRows).toBe('2');
});

test('data-col-count overrides the breakpoint', async ({ page }) => {
  await mount(page, '<div>a</div><div>b</div>', 'data-col-count=4');
  expect((await read(page)).columns).toBe(4);
});
