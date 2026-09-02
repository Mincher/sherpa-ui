import { test, expect } from '@playwright/test';

/**
 * sherpa-list-item on the reforged base — heading / description text from data-*,
 * slot-presence reflection (data-has-leading / data-has-trailing), the current
 * state, and the item-click event gated on data-interactive.
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
  current?: boolean;
}

test('title and description render from data-* attributes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-heading', 'Project Alpha');
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
    el.setAttribute('data-heading', 'Only a title');
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
    el.setAttribute('data-heading', 'With slots');
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
    el.setAttribute('data-heading', 'Bare');
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

test('interactive item is focusable and fires item-click on click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-heading', 'Clickable');
    el.setAttribute('data-interactive', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let detail: unknown = null;
    el.addEventListener('item-click', (e) => (detail = (e as CustomEvent).detail));
    el.click();
    return {
      tabindex: el.getAttribute('tabindex'),
      current: el.hasAttribute('data-current'),
      detail,
    };
  });
  expect(r.tabindex).toBe('0'); // interactive → keyboard reachable
  expect(r.current).toBe(true); // click marks it the current row
  expect(r.detail).toEqual({ heading: 'Clickable' });
});

test('non-interactive item does not fire or become active on click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-heading', 'Static');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = false;
    el.addEventListener('item-click', () => (fired = true));
    el.click();
    return { fired, current: el.hasAttribute('data-current'), tabindex: el.getAttribute('tabindex') };
  });
  expect(r.fired).toBe(false);
  expect(r.current).toBe(false);
  expect(r.tabindex).toBeNull();
});

test('disabled interactive item does not fire on click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-heading', 'Off');
    el.setAttribute('data-interactive', '');
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = false;
    el.addEventListener('item-click', () => (fired = true));
    el.click();
    return { fired, current: el.hasAttribute('data-current') };
  });
  expect(r.fired).toBe(false);
  expect(r.current).toBe(false);
});

test('the current setter reflects to data-current', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-heading', 'Prop');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.current = true;
    const on = el.hasAttribute('data-current');
    el.current = false;
    const off = el.hasAttribute('data-current');
    return { on, off };
  });
  expect(r.on).toBe(true);
  expect(r.off).toBe(false);
});

test('data-icon renders the leading glyph and reveals the leading region', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-heading', 'Files');
    el.setAttribute('data-icon', '📁');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      iconText: s.querySelector('.icon')!.textContent,
      leadingVisible: getComputedStyle(s.querySelector('.leading')!).display !== 'none',
    };
  });
  expect(r.iconText).toBe('📁');
  expect(r.leadingVisible).toBe(true);
});

test('data-draggable reveals the drag handle and fires item-drag', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-heading', 'Row');
    el.setAttribute('data-draggable', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const drag = el.shadowRoot!.querySelector('.drag') as HTMLElement;
    const visible = getComputedStyle(drag).display !== 'none';
    let dragged = false;
    el.addEventListener('item-drag', () => (dragged = true));
    drag.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 0));
    return { visible, dragged };
  });
  expect(r.visible).toBe(true);
  expect(r.dragged).toBe(true);
});

test('data-expandable toggle flips data-expanded and fires item-expand', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-heading', 'Group');
    el.setAttribute('data-expandable', '');
    el.setAttribute('data-interactive', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const expand = el.shadowRoot!.querySelector('.expand') as HTMLElement;
    let detail: unknown = null;
    let rowClicked = false;
    el.addEventListener('item-expand', (e) => (detail = (e as CustomEvent).detail));
    el.addEventListener('item-click', () => (rowClicked = true));
    expand.click();
    await new Promise((res) => setTimeout(res, 0));
    return { expandedAfter: el.hasAttribute('data-expanded'), detail, rowClicked };
  });
  expect(r.expandedAfter).toBe(true);
  expect(r.detail).toEqual({ expanded: true });
  expect(r.rowClicked).toBe(false); // expand click doesn't also activate the row
});

test('data-selectable control toggles selection and fires item-select', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list-item') as unknown as ItemEl;
    el.setAttribute('data-heading', 'Pick me');
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector('.control') as HTMLElement;
    const visible = getComputedStyle(control).display !== 'none';
    let detail: unknown = null;
    el.addEventListener('item-select', (e) => (detail = (e as CustomEvent).detail));
    control.click();
    await new Promise((res) => setTimeout(res, 0));
    return { visible, selectedAfter: el.hasAttribute('data-selected'), detail };
  });
  expect(r.visible).toBe(true);
  expect(r.selectedAfter).toBe(true);
  expect(r.detail).toEqual({ selected: true });
});
