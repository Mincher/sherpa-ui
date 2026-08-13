import { test, expect } from '@playwright/test';

/**
 * renderElement + renderView on the reforged base — the JSON→view path. Proves the
 * reforged components compose declaratively from data: an element node builds an
 * element (props/slots/children/data), and a view-definition composes an id-addressed
 * tree with reactive $state binding, `writes` wiring, and the app-shell frame.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renderElement builds an element with props, slots and children', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderElement } = await import('/dist-reforged/index.js');
    const el = renderElement({
      type: 'sherpa-container',
      props: { 'data-elevation': 'md' },
      slots: { header: { type: 'sherpa-tag', props: { 'data-color': '5' }, children: [] } },
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

test('renderView composes an id-addressed tree into a shell', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist-reforged/index.js');
    const { el } = renderView({
      root: 'body',
      shell: { nav: 'nav', header: 'hdr' },
      elements: {
        body: { type: 'sherpa-container', children: ['tag'] },
        tag: { type: 'sherpa-tag', props: { 'data-color': '9' } },
        nav: { type: 'sherpa-nav' },
        hdr: { type: 'sherpa-container' },
      },
    }) as { el: HTMLElement };
    document.getElementById('root')!.appendChild(el);
    await new Promise((res) => setTimeout(res, 10));
    return {
      shell: el.tagName.toLowerCase(),
      navSlot: el.querySelector('[slot="nav"]')?.tagName.toLowerCase() ?? null,
      headerSlot: el.querySelector('[slot="header"]')?.tagName.toLowerCase() ?? null,
      bodyTag: !!el.querySelector('sherpa-container sherpa-tag'),
    };
  });
  expect(r.shell).toBe('sherpa-app-shell');
  expect(r.navSlot).toBe('sherpa-nav');
  expect(r.headerSlot).toBe('sherpa-container');
  expect(r.bodyTag).toBe(true);
});

test('$state data binding populates from state and re-populates on write', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist-reforged/index.js');
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
    const before = el.shadowRoot!.querySelectorAll('.item').length;

    state.set('/items', [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ]);
    await new Promise((res) => setTimeout(res, 20));
    const after = el.shadowRoot!.querySelectorAll('.item').length;
    return { before, after };
  });
  expect(r.before).toBe(1);
  expect(r.after).toBe(3); // the bound consumer re-populated from the state write
});

test('writes wiring: one element writes state, a bound consumer reacts', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist-reforged/index.js');
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
    const yRow = Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.item')).find(
      (r) => r.dataset['id'] === 'y'
    )!;
    yRow.querySelector<HTMLElement>('.link')!.click();
    await new Promise((res) => setTimeout(res, 20));

    const echo = el.querySelector('sherpa-tag')!;
    return { stateVal: state.get('/picked'), echoLabel: echo.getAttribute('data-label') };
  });
  expect(r.stateVal).toBe('y'); // nav-select wrote /picked
  expect(r.echoLabel).toBe('y'); // the $state-bound consumer updated
});
