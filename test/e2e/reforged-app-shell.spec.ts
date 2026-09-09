import { test, expect } from '@playwright/test';

/** sherpa-app-shell — a nav | header / nav | content grid wrapper with 3 named slots. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('lays out the three grid regions with nav / header / content slots', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML =
      '<div slot="nav">N</div><div slot="header">H</div><div>Content</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    const q = (s: string) => el.shadowRoot!.querySelector(s);
    return {
      shell: !!q('.shell'),
      navSlot: !!q('.nav slot[name="nav"]'),
      headerSlot: !!q('.header slot[name="header"]'),
      contentSlot: !!q('.content slot:not([name])'),
      display: getComputedStyle(q('.shell') as HTMLElement).display,
      // grid-template-columns resolves the nav-width track then 1fr → two tracks
      cols: getComputedStyle(q('.shell') as HTMLElement).gridTemplateColumns.split(' ').length,
    };
  });
  expect(r.shell).toBe(true);
  expect(r.navSlot).toBe(true);
  expect(r.headerSlot).toBe(true);
  expect(r.contentSlot).toBe(true);
  expect(r.display).toBe('grid');
  expect(r.cols).toBe(2);
});

test('data-nav-collapsed narrows the nav rail', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const shell = () => el.shadowRoot!.querySelector('.shell') as HTMLElement;
    const width = () => parseFloat(getComputedStyle(shell()).gridTemplateColumns.split(' ')[0]!);
    const expanded = width();
    el.setAttribute('data-nav-collapsed', '');
    await el.rendered;
    const collapsed = width();
    return { expanded, collapsed };
  });
  expect(r.expanded).toBe(240);
  expect(r.collapsed).toBe(56);
});

test('data-no-header hides the header region', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML = '<div slot="header">H</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const header = () => el.shadowRoot!.querySelector('.header') as HTMLElement;
    const shown = getComputedStyle(header()).display;
    el.setAttribute('data-no-header', '');
    await el.rendered;
    const hidden = getComputedStyle(header()).display;
    return { shown, hidden };
  });
  expect(r.shown).not.toBe('none');
  expect(r.hidden).toBe('none');
});
