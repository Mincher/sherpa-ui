import { test, expect } from '@playwright/test';

/**
 * sherpa-list-item on the reforged base — title / description text from data-*,
 * slot-presence reflection (data-has-leading / data-has-trailing), the active
 * state, and the list-item-click event gated on data-interactive.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-list-item'));
});

interface ItemEl extends HTMLElement {
  rendered?: Promise<void>;
  active?: boolean;
}

test('title and description render from data-* attributes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-title', 'Project Alpha');
    el.setAttribute('data-description', 'Owned by design');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      title: s.querySelector('.title')!.textContent,
      description: s.querySelector('.description')!.textContent,
    };
  });
  expect(r.title).toBe('Project Alpha');
  expect(r.description).toBe('Owned by design');
});

test('description hides when data-description is absent', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-title', 'Only a title');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const desc = el.shadowRoot!.querySelector('.description')!;
    return { display: getComputedStyle(desc).display };
  });
  expect(r.display).toBe('none');
});

test('slotted leading and trailing content reflect to data-has-* on the host', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-title', 'With slots');
    el.innerHTML = '<span slot="leading">L</span><button slot="trailing">Go</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    const s = el.shadowRoot!;
    return {
      hasLeading: el.hasAttribute('data-has-leading'),
      hasTrailing: el.hasAttribute('data-has-trailing'),
      leadingVisible: getComputedStyle(s.querySelector('.leading')!).display !== 'none',
      trailingVisible: getComputedStyle(s.querySelector('.trailing')!).display !== 'none',
    };
  });
  expect(r.hasLeading).toBe(true);
  expect(r.hasTrailing).toBe(true);
  expect(r.leadingVisible).toBe(true);
  expect(r.trailingVisible).toBe(true);
});

test('trailing region stays hidden with no slotted content', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-title', 'Bare');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return {
      hasTrailing: el.hasAttribute('data-has-trailing'),
      trailingDisplay: getComputedStyle(el.shadowRoot!.querySelector('.trailing')!).display,
    };
  });
  expect(r.hasTrailing).toBe(false);
  expect(r.trailingDisplay).toBe('none');
});

test('interactive item is focusable and fires list-item-click on click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-title', 'Clickable');
    el.setAttribute('data-interactive', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let detail: unknown = null;
    el.addEventListener('list-item-click', (e) => (detail = (e as CustomEvent).detail));
    el.click();
    return {
      tabindex: el.getAttribute('tabindex'),
      active: el.hasAttribute('data-active'),
      detail,
    };
  });
  expect(r.tabindex).toBe('0'); // interactive → keyboard reachable
  expect(r.active).toBe(true); // click marks it active
  expect(r.detail).toEqual({ title: 'Clickable' });
});

test('non-interactive item does not fire or become active on click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-title', 'Static');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = false;
    el.addEventListener('list-item-click', () => (fired = true));
    el.click();
    return { fired, active: el.hasAttribute('data-active'), tabindex: el.getAttribute('tabindex') };
  });
  expect(r.fired).toBe(false);
  expect(r.active).toBe(false);
  expect(r.tabindex).toBeNull();
});

test('disabled interactive item does not fire on click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-title', 'Off');
    el.setAttribute('data-interactive', '');
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = false;
    el.addEventListener('list-item-click', () => (fired = true));
    el.click();
    return { fired, active: el.hasAttribute('data-active') };
  });
  expect(r.fired).toBe(false);
  expect(r.active).toBe(false);
});

test('the active setter reflects to data-active', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-title', 'Prop');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.active = true;
    const on = el.hasAttribute('data-active');
    el.active = false;
    const off = el.hasAttribute('data-active');
    return { on, off };
  });
  expect(r.on).toBe(true);
  expect(r.off).toBe(false);
});
