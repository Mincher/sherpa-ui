import { test, expect } from '@playwright/test';

/**
 * renderElement + renderView on the reforged base — the JSON→view path. Proves the
 * reforged components compose declaratively from data: an element node builds an
 * element (props/slots/children/data), and a view-definition composes an id-addressed
 * tree with reactive $state binding, `writes` wiring, and the light-DOM view frame.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renderElement builds an element with props, slots and children', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderElement } = await import('/dist/index.js');
    const el = renderElement({
      type: 'sherpa-container',
      props: { 'data-elevation': 'md' },
      slots: { header: { type: 'sherpa-tag', props: {}, children: [] } },
      children: [{ type: 'sherpa-button', props: { 'data-label': 'Go' } }],
    }) as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await (el as { rendered?: Promise<void> }).rendered;
    await new Promise((res) => setTimeout(res, 10));
    return {
      elevation: el.getAttribute('data-elevation'),
      headerTag: el.querySelector('[slot="header"]')?.tagName.toLowerCase() ?? null,
      childButton: !!el.querySelector('sherpa-button'),
    };
  });
  expect(r.elevation).toBe('md');
  expect(r.headerTag).toBe('sherpa-tag');
  expect(r.childButton).toBe(true);
});

test('renderView composes an id-addressed tree into the view frame', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist/index.js');
    const { el } = renderView({
      root: 'body',
      shell: { nav: 'nav', header: 'hdr' },
      elements: {
        body: { type: 'sherpa-container', children: ['tag'] },
        tag: { type: 'sherpa-tag', props: {} },
        nav: { type: 'sherpa-nav' },
        hdr: { type: 'sherpa-container' },
      },
    }) as { el: HTMLElement };
    document.getElementById('root')!.appendChild(el);
    await new Promise((res) => setTimeout(res, 10));
    return {
      frame: el.className,
      navRegion: el.querySelector('[data-region="nav"]')?.tagName.toLowerCase() ?? null,
      headerRegion: el.querySelector('[data-region="header"]')?.tagName.toLowerCase() ?? null,
      bodyRegion: el.querySelector('[data-region="body"]')?.tagName.toLowerCase() ?? null,
      bodyTag: !!el.querySelector('sherpa-container sherpa-tag'),
    };
  });
  expect(r.frame).toBe('sherpa-view'); // light-DOM view frame, not a custom element
  expect(r.navRegion).toBe('sherpa-nav');
  expect(r.headerRegion).toBe('sherpa-container');
  expect(r.bodyRegion).toBe('sherpa-container');
  expect(r.bodyTag).toBe(true);
});

test('$state data binding populates from state and re-populates on write', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist/index.js');
    const { el, state } = renderView({
      root: 'nav',
      state: { items: [{ id: 'a', label: 'Alpha' }] },
      elements: {
        nav: { type: 'sherpa-nav', data: { $state: '/items' } },
      },
    }) as { el: HTMLElement & { rendered?: Promise<void> }; state: { set: (p: string, v: unknown) => void } };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 20));
    const before = el.shadowRoot!.querySelectorAll('.nav-row').length;

    state.set('/items', [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ]);
    await new Promise((res) => setTimeout(res, 20));
    const after = el.shadowRoot!.querySelectorAll('.nav-row').length;
    return { before, after };
  });
  expect(r.before).toBe(1);
  expect(r.after).toBe(3); // the bound consumer re-populated from the state write
});

test('writes wiring: one element writes state, a bound consumer reacts', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist/index.js');
    const { el, state } = renderView({
      root: 'wrap',
      state: { picked: null },
      elements: {
        wrap: { type: 'sherpa-container', children: ['nav', 'echo'] },
        nav: {
          type: 'sherpa-nav',
          data: [
            { id: 'x', label: 'X' },
            { id: 'y', label: 'Y' },
          ],
          writes: [{ on: 'nav-select', to: '/picked', value: '$detail.id' }],
        },
        echo: { type: 'sherpa-tag', props: { 'data-label': { $state: '/picked' } } },
      },
    }) as { el: HTMLElement; state: { get: (p: string) => unknown } };
    document.getElementById('root')!.appendChild(el);

    // Wait deterministically for the nav to render + populate its rows.
    const nav = el.querySelector('sherpa-nav') as HTMLElement & { rendered?: Promise<void> };
    await nav.rendered;
    await new Promise((res) => setTimeout(res, 20));
    const yRow = Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')).find(
      (r) => r.dataset['id'] === 'y'
    )!;
    const yItem = yRow.querySelector('sherpa-nav-item') as HTMLElement & { rendered?: Promise<void> };
    await yItem.rendered;
    (yItem.shadowRoot!.querySelector('.row') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 20));

    const echo = el.querySelector('sherpa-tag')!;
    return { stateVal: state.get('/picked'), echoLabel: echo.getAttribute('data-label') };
  });
  expect(r.stateVal).toBe('y'); // nav-select wrote /picked
  expect(r.echoLabel).toBe('y'); // the $state-bound consumer updated
});
