import { test, expect } from '@playwright/test';
import { openHarness } from './support';

/**
 * Coverage for renderElement() — building a live Sherpa element from an element
 * JSON node: attributes (incl. boolean/omit rules), data → populate() across
 * array / keyed / HTML kinds, named-slot fills, and nested default-slot children.
 *
 * The renderer is imported dynamically inside the page so it runs against the
 * compiled module in /dist, exactly as an app would consume it.
 */

const MODULE = '/dist/components/utilities/render-element.js';

test.beforeEach(async ({ page }) => openHarness(page));

test('props: strings/numbers set attrs; true → boolean; false/null → omitted', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderElement } = await import(mod);
    const el = renderElement({
      type: 'sherpa-button',
      props: {
        'data-variant': 'primary',
        'data-size': 'small',
        disabled: true,
        hidden: false,
        'data-omit': null,
      },
    });
    document.getElementById('root')!.appendChild(el);
    return {
      variant: el.getAttribute('data-variant'),
      size: el.getAttribute('data-size'),
      hasDisabled: el.hasAttribute('disabled'),
      disabledValue: el.getAttribute('disabled'),
      hasHidden: el.hasAttribute('hidden'),
      hasOmit: el.hasAttribute('data-omit'),
      tag: el.tagName.toLowerCase(),
    };
  }, MODULE);

  expect(r.tag).toBe('sherpa-button');
  expect(r.variant).toBe('primary');
  expect(r.size).toBe('small');
  expect(r.hasDisabled).toBe(true);
  expect(r.disabledValue).toBe(''); // boolean attribute
  expect(r.hasHidden).toBe(false);
  expect(r.hasOmit).toBe(false);
});

test('data: array payload flows to populate() (key-value list)', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderElement } = await import(mod);
    const el = renderElement({
      type: 'sherpa-key-value-list',
      data: [
        { key: 'Environment', value: 'Production' },
        { key: 'Region', value: 'EMEA' },
      ],
    }) as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 40));
    const dd = el.shadowRoot!.querySelectorAll('dd');
    return { count: dd.length, first: dd[0]?.textContent, second: dd[1]?.textContent };
  }, MODULE);

  expect(r.count).toBe(2);
  expect(r.first).toBe('Production');
  expect(r.second).toBe('EMEA');
});

test('data: keyed collection ({steps}) flows to populate() (step tracker)', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderElement } = await import(mod);
    const el = renderElement({
      type: 'sherpa-progress-step-tracker',
      props: { 'data-current-step': 2 },
      data: { steps: [{ label: 'One' }, { label: 'Two' }, { label: 'Three' }] },
    }) as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 40));
    return { steps: el.shadowRoot!.querySelectorAll('.step-item').length };
  }, MODULE);

  expect(r.steps).toBe(3);
});

test('data: precompiled HTML string flows to populate() template branch', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderElement } = await import(mod);
    const el = renderElement({
      type: 'sherpa-key-value-list',
      data: '<dt>A</dt><dd>1</dd><dt>B</dt><dd>2</dd>',
    }) as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 40));
    return { dd: el.shadowRoot!.querySelectorAll('dd').length };
  }, MODULE);

  expect(r.dd).toBe(2);
});

test('slots + children: named-slot fills get slot set; children land in default slot', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderElement } = await import(mod);
    const el = renderElement({
      type: 'sherpa-container',
      props: { 'data-col-span': 6 },
      slots: {
        header: { type: 'sherpa-container-header', props: { 'data-title': 'Tile' } },
      },
      children: [
        { type: 'sherpa-key-value-list', data: [{ key: 'K', value: 'V' }] },
        { type: 'sherpa-button', props: { 'data-label': 'Go' } },
      ],
    });
    document.getElementById('root')!.appendChild(el);

    const header = el.querySelector('sherpa-container-header');
    const kids = [...el.children];
    return {
      colSpan: el.getAttribute('data-col-span'),
      headerSlot: header?.getAttribute('slot'),
      headerTitle: header?.getAttribute('data-title'),
      // default-slot children have NO slot attribute
      defaultKids: kids
        .filter((k) => !k.hasAttribute('slot'))
        .map((k) => k.tagName.toLowerCase()),
    };
  }, MODULE);

  expect(r.colSpan).toBe('6');
  expect(r.headerSlot).toBe('header');
  expect(r.headerTitle).toBe('Tile');
  expect(r.defaultKids).toEqual(['sherpa-key-value-list', 'sherpa-button']);
});

test('slots: array fill places multiple nodes into the same named slot', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderElement } = await import(mod);
    const el = renderElement({
      type: 'sherpa-container',
      slots: {
        footer: [
          { type: 'sherpa-button', props: { 'data-label': 'Cancel' } },
          { type: 'sherpa-button', props: { 'data-label': 'Confirm' } },
        ],
      },
    });
    document.getElementById('root')!.appendChild(el);
    const footerBtns = [...el.querySelectorAll('sherpa-button')].filter(
      (b) => b.getAttribute('slot') === 'footer',
    );
    return { count: footerBtns.length, labels: footerBtns.map((b) => b.getAttribute('data-label')) };
  }, MODULE);

  expect(r.count).toBe(2);
  expect(r.labels).toEqual(['Cancel', 'Confirm']);
});

test('nested composition: a tile tree builds recursively', async ({ page }) => {
  const r = await page.evaluate(async (mod) => {
    const { renderElement } = await import(mod);
    const el = renderElement({
      type: 'sherpa-layout-grid',
      children: [
        {
          type: 'sherpa-container',
          props: { 'data-col-span': 12 },
          slots: { header: { type: 'sherpa-container-header', props: { 'data-title': 'Grid tile' } } },
          children: [{ type: 'sherpa-key-value-list', data: [{ key: 'Owner', value: 'team' }] }],
        },
      ],
    }) as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    const kv = el.querySelector('sherpa-key-value-list') as (HTMLElement & { rendered?: Promise<void> }) | null;
    await kv?.rendered;
    await new Promise((res) => setTimeout(res, 40));
    return {
      hasContainer: !!el.querySelector('sherpa-container'),
      headerTitle: el.querySelector('sherpa-container-header')?.getAttribute('data-title'),
      kvValue: kv?.shadowRoot!.querySelector('dd')?.textContent,
    };
  }, MODULE);

  expect(r.hasContainer).toBe(true);
  expect(r.headerTitle).toBe('Grid tile');
  expect(r.kvValue).toBe('team');
});

test('throws when type is missing', async ({ page }) => {
  const threw = await page.evaluate(async (mod) => {
    const { renderElement } = await import(mod);
    try {
      renderElement({} as never);
      return false;
    } catch {
      return true;
    }
  }, MODULE);
  expect(threw).toBe(true);
});
