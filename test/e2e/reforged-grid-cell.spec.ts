import { test, expect } from '@playwright/test';

/**
 * sherpa-grid-cell — the atomic Data Grid cell (Figma Grid Cell 926:34253).
 * Covers the type roles, opt-in checkbox/actions visibility, the sort toggle +
 * sort-change event, the menu-open event, and the group toggle + group-toggle event.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(() => customElements.whenDefined('sherpa-grid-cell'));
});

test('checkbox + actions are hidden by default, shown by their flags', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bare = document.createElement('sherpa-grid-cell') as HTMLElement & { rendered?: Promise<void> };
    bare.textContent = 'value';
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    const full = document.createElement('sherpa-grid-cell') as HTMLElement & { rendered?: Promise<void> };
    full.setAttribute('data-has-checkbox', '');
    full.setAttribute('data-has-actions', '');
    full.textContent = 'value';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    const disp = (el: HTMLElement, sel: string) => getComputedStyle(el.shadowRoot!.querySelector(sel)!).display;
    return {
      bareCheckbox: disp(bare, '.checkbox'),
      bareActions: disp(bare, '.actions'),
      fullCheckbox: disp(full, '.checkbox'),
      fullActions: disp(full, '.actions'),
    };
  });
  expect(r.bareCheckbox).toBe('none');
  expect(r.bareActions).toBe('none');
  expect(r.fullCheckbox).not.toBe('none');
  expect(r.fullActions).not.toBe('none');
});

test('sort button cycles direction and fires sort-change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-grid-cell') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-type', 'header');
    el.setAttribute('data-has-actions', '');
    el.textContent = 'Name';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const dirs: string[] = [];
    el.addEventListener('sort-change', (e) => dirs.push((e as CustomEvent).detail.direction));
    const sort = el.shadowRoot!.querySelector<HTMLButtonElement>('.sort')!;
    sort.click();
    sort.click();
    return { dirs, attr: el.getAttribute('data-sort-direction') };
  });
  expect(r.dirs).toEqual(['asc', 'desc']);
  expect(r.attr).toBe('desc');
});

test('group toggle flips data-expanded and fires group-toggle', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-grid-cell') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-type', 'group');
    el.textContent = 'Group A';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    let expanded: boolean | null = null;
    // `collapsed`, matching sherpa-data-grid — one event name, one shape.
    el.addEventListener('group-toggle',
      (e) => (expanded = !(e as CustomEvent).detail.collapsed));
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('.toggle')!;
    const toggleShown = getComputedStyle(toggle).display !== 'none';
    toggle.click();
    return { toggleShown, expanded, attr: el.hasAttribute('data-expanded') };
  });
  expect(r.toggleShown).toBe(true);
  expect(r.expanded).toBe(true);
  expect(r.attr).toBe(true);
});

test('menu button fires menu-open', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-grid-cell') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-has-actions', '');
    el.textContent = 'x';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    let fired = false;
    el.addEventListener('menu-open', () => (fired = true));
    el.shadowRoot!.querySelector<HTMLButtonElement>('.menu')!.click();
    return { fired };
  });
  expect(r.fired).toBe(true);
});
