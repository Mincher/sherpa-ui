import { test, expect } from '@playwright/test';
import { openHarness } from './support';

/**
 * Coverage for renderView() — building a live view from a normalised
 * view-definition: id-registry composition (children / named slots by id),
 * reactive $state binding (props + data), state-mediated `writes` wiring, and the
 * implicit App-Shell region assignment.
 *
 * Imported dynamically inside the page so it runs against the compiled module in
 * /dist, exactly as an app would consume it.
 */

const MODULE = '/dist/components/utilities/render-view.js';

test.beforeEach(async ({ page }) => openHarness(page));

test('composition: children + named slots are resolved by id', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderView } = await import(mod);
    const { el } = renderView({
      root: 'card',
      elements: {
        card: {
          type: 'sherpa-container',
          slots: { header: 'hdr' },
          children: ['kv'],
        },
        hdr: { type: 'sherpa-container-header', props: { 'data-title': 'Details' } },
        kv: {
          type: 'sherpa-key-value-list',
          data: [{ key: 'Region', value: 'EMEA' }],
        },
      },
    }) as { el: HTMLElement };
    document.getElementById('root')!.appendChild(el);
    return {
      tag: el.tagName.toLowerCase(),
      headerSlotted: el.querySelector('[slot="header"]')?.tagName.toLowerCase() ?? null,
      childInDefault: el.querySelector('sherpa-key-value-list') != null,
    };
  }, MODULE);

  expect(r.tag).toBe('sherpa-container');
  expect(r.headerSlotted).toBe('sherpa-container-header');
  expect(r.childInDefault).toBe(true);
});

test('$state: a data binding populates from state, then re-populates on write', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderView } = await import(mod);
    const { el, state } = renderView({
      root: 'kv',
      state: { rows: [{ key: 'Env', value: 'Staging' }] },
      elements: {
        kv: { type: 'sherpa-key-value-list', data: { $state: '/rows' } },
      },
    }) as {
      el: HTMLElement & { rendered?: Promise<void> };
      state: { set: (p: string, v: unknown) => void };
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 40));
    const before = el.shadowRoot!.querySelector('dd')?.textContent;

    // Write new state → the bound consumer must re-populate.
    state.set('/rows', [{ key: 'Env', value: 'Production' }]);
    await new Promise((res) => setTimeout(res, 40));
    const after = el.shadowRoot!.querySelector('dd')?.textContent;

    return { before, after };
  }, MODULE);

  expect(r.before).toBe('Staging');
  expect(r.after).toBe('Production');
});

test('$state: a prop binding sets the attribute and updates on write', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderView } = await import(mod);
    const { el, state } = renderView({
      root: 'btn',
      state: { variant: 'primary' },
      elements: {
        btn: { type: 'sherpa-button', props: { 'data-variant': { $state: '/variant' } } },
      },
    }) as { el: HTMLElement; state: { set: (p: string, v: unknown) => void } };
    document.getElementById('root')!.appendChild(el);
    const before = el.getAttribute('data-variant');
    state.set('/variant', 'secondary');
    const after = el.getAttribute('data-variant');
    return { before, after };
  }, MODULE);

  expect(r.before).toBe('primary');
  expect(r.after).toBe('secondary');
});

test('wiring: an element writes to state on its event; a bound consumer reacts', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderView } = await import(mod);
    const { el, state } = renderView({
      root: 'wrap',
      state: { picked: null },
      elements: {
        wrap: { type: 'sherpa-container', children: ['src', 'sink'] },
        src: {
          type: 'sherpa-button',
          writes: [{ on: 'demo-pick', to: '/picked', value: '$detail.id' }],
        },
        sink: { type: 'sherpa-button', props: { 'data-label': { $state: '/picked' } } },
      },
    }) as { el: HTMLElement; state: { get: (p: string) => unknown } };
    document.getElementById('root')!.appendChild(el);

    const src = el.querySelector('sherpa-button')!;
    src.dispatchEvent(new CustomEvent('demo-pick', { detail: { id: 'X-42' }, bubbles: true }));

    const sink = el.querySelectorAll('sherpa-button')[1] as HTMLElement;
    return { stateVal: state.get('/picked'), sinkLabel: sink.getAttribute('data-label') };
  }, MODULE);

  expect(r.stateVal).toBe('X-42');
  expect(r.sinkLabel).toBe('X-42');
});

test('shell: regions are slotted into an implicit sherpa-app-shell; body defaults to root', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderView } = await import(mod);
    const { el } = renderView({
      root: 'body',
      shell: { nav: 'nav', header: 'hdr' },
      elements: {
        body: { type: 'sherpa-container' },
        nav: { type: 'sherpa-nav' },
        hdr: { type: 'sherpa-app-header' },
      },
    }) as { el: HTMLElement };
    document.getElementById('root')!.appendChild(el);
    return {
      shellTag: el.tagName.toLowerCase(),
      navSlot: el.querySelector('[slot="nav"]')?.tagName.toLowerCase() ?? null,
      headerSlot: el.querySelector('[slot="app-header"]')?.tagName.toLowerCase() ?? null,
      bodyInDefault: el.querySelector('sherpa-container') != null,
    };
  }, MODULE);

  expect(r.shellTag).toBe('sherpa-app-shell');
  expect(r.navSlot).toBe('sherpa-nav');
  expect(r.headerSlot).toBe('sherpa-app-header');
  expect(r.bodyInDefault).toBe(true);
});
