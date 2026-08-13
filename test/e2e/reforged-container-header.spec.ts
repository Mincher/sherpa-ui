import { test, expect } from '@playwright/test';

/**
 * sherpa-container-header on the reforged base — the header bar for a container's
 * header slot. Exercises the title sync (data-title → .title), the description
 * sync + its data-description visibility, the heading-slot override, and the
 * data-has-actions reflection for the trailing actions slot.
 *
 * Not registered by the harness index — the spec imports its module in-page.
 */

const HARNESS = '/test/reforged/harness.html';

type HeaderEl = HTMLElement & { rendered?: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-container-header/sherpa-container-header.js');
    await customElements.whenDefined('sherpa-container-header');
  });
});

test('renders data-title into the title node', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-title', 'Overview');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { title: el.shadowRoot!.querySelector('.title')!.textContent };
  });
  expect(r.title).toBe('Overview');
});

test('data-title and data-description update reactively after render', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-title', 'First');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-title', 'Second');
    el.setAttribute('data-description', 'A subtitle');
    return {
      title: el.shadowRoot!.querySelector('.title')!.textContent,
      description: el.shadowRoot!.querySelector('.description')!.textContent,
      descVisible: getComputedStyle(el.shadowRoot!.querySelector('.description')!).display !== 'none',
    };
  });
  expect(r.title).toBe('Second');
  expect(r.description).toBe('A subtitle');
  expect(r.descVisible).toBe(true);
});

test('description is hidden when data-description is absent', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-title', 'No sub');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { descVisible: getComputedStyle(el.shadowRoot!.querySelector('.description')!).display !== 'none' };
  });
  expect(r.descVisible).toBe(false);
});

test('the heading slot overrides data-title', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-title', 'fallback');
    el.innerHTML = '<h2 slot="heading">Slotted</h2>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    return {
      hasHeadingAttr: el.hasAttribute('data-has-heading'),
      textHidden: getComputedStyle(el.shadowRoot!.querySelector('.title')!).display === 'none',
    };
  });
  expect(r.hasHeadingAttr).toBe(true);
  expect(r.textHidden).toBe(true);
});

test('the actions region reflects data-has-actions and appears when slotted', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bare = document.createElement('sherpa-container-header') as HeaderEl;
    bare.setAttribute('data-title', 'Bare');
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const full = document.createElement('sherpa-container-header') as HeaderEl;
    full.setAttribute('data-title', 'Full');
    full.innerHTML = '<button slot="actions">Act</button>';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const vis = (el: HTMLElement) =>
      getComputedStyle(el.shadowRoot!.querySelector('.actions')!).display !== 'none';

    return {
      bareActionsAttr: bare.hasAttribute('data-has-actions'),
      bareActionsVisible: vis(bare),
      fullActionsAttr: full.hasAttribute('data-has-actions'),
      fullActionsVisible: vis(full),
    };
  });
  expect(r.bareActionsAttr).toBe(false);
  expect(r.bareActionsVisible).toBe(false);
  expect(r.fullActionsAttr).toBe(true);
  expect(r.fullActionsVisible).toBe(true);
});
