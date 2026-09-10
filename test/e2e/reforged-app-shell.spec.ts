import { test, expect } from '@playwright/test';

/**
 * sherpa-app-shell — the app frame: the nav rail OVERLAID down the left edge at full
 * height, with the header + content wrapper inset past it. The inset is the COLLAPSED
 * rail width while the rail is collapsed or hovered (so hovering reveals the rail over
 * the content instead of reflowing the page) and grows only when it is latched open.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('the nav rail is a full-height overlay; header + content are its siblings', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML =
      '<div slot="nav">N</div><div slot="header">H</div><div>Content</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    const q = (s: string) => el.shadowRoot!.querySelector(s) as HTMLElement;
    const nav = getComputedStyle(q('.nav'));
    const shellBox = q('.shell').getBoundingClientRect();
    const navBox = q('.nav').getBoundingClientRect();
    return {
      shell: !!q('.shell'),
      frame: !!q('.frame'),
      navSlot: !!q('.nav slot[name="nav"]'),
      headerSlot: !!q('.header slot[name="header"]'),
      contentSlot: !!q('.content slot:not([name])'),
      navPosition: nav.position,
      // Pinned to the left edge and the full height of the shell.
      atLeftEdge: Math.abs(navBox.left - shellBox.left) < 1,
      fullHeight: Math.abs(navBox.height - shellBox.height) < 1,
      // The header/content wrapper is a two-row grid (header over content).
      frameDisplay: getComputedStyle(q('.frame')).display,
      frameRows: getComputedStyle(q('.frame')).gridTemplateRows.split(' ').length,
    };
  });
  expect(r.shell).toBe(true);
  expect(r.frame).toBe(true);
  expect(r.navSlot).toBe(true);
  expect(r.headerSlot).toBe(true);
  expect(r.contentSlot).toBe(true);
  expect(r.navPosition).toBe('absolute'); // an overlay, not a grid column
  expect(r.atLeftEdge).toBe(true);
  expect(r.fullHeight).toBe(true);
  expect(r.frameDisplay).toBe('grid');
  expect(r.frameRows).toBe(2);
});

test('the content inset holds at the collapsed width until the rail is latched open', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const frame = () => el.shadowRoot!.querySelector('.frame') as HTMLElement;
    const inset = (): string => getComputedStyle(frame()).marginInlineStart;

    // The margin ANIMATES, so read it after the transition rather than mid-flight.
    const setState = async (state: string): Promise<string> => {
      el.dataset['navState'] = state;
      await new Promise((res) => setTimeout(res, 250));
      return inset();
    };
    return {
      collapsed: await setState('collapsed'),
      // Hover must NOT move the content — that is the whole point of the overlay.
      hover: await setState('hover'),
      pinned: await setState('pinned'),
      settings: await setState('settings'),
    };
  });
  // Figma nav-layout/width: 40 collapsed, 320 open.
  expect(r.collapsed).toBe('40px');
  expect(r.hover).toBe('40px');
  expect(r.pinned).toBe('320px');
  expect(r.settings).toBe('320px');
});

test('the shell adopts the rail state from a bubbling nav-state-change', async ({ page }) => {
  const state = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // The rail's own event bubbles + is composed, so the shell picks it up.
    el.shadowRoot!.querySelector('.nav')!.dispatchEvent(
      new CustomEvent('nav-state-change', { detail: { state: 'pinned' }, bubbles: true, composed: true }),
    );
    return el.dataset['navState'];
  });
  expect(state).toBe('pinned');
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
