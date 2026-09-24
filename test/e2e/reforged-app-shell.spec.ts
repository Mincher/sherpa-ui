import { test, expect } from './harness';

/**
 * sherpa-app-shell — the app frame: the nav rail OVERLAID down the left edge at full
 * height, with the header + content wrapper inset past it. The inset is the COLLAPSED
 * rail width while the rail is collapsed or hovered (so hovering reveals the rail over
 * the content instead of reflowing the page) and grows only when it is latched open.
 */


test('the nav rail is a full-height overlay; the header is sticky inside the scroller', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML =
      '<div slot="nav">N</div><div slot="header">H</div><div>Content</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
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
      frameDisplay: getComputedStyle(q('.frame')).display,
      // ONE row: the header lives INSIDE the scrolling content now, so there is no
      // header row to reserve. It had to move there to be sticky at all — as a
      // grid row ABOVE the scroller it never moved, so `scroll-state(stuck: top)`
      // could never fire and it never got its drop shadow.
      frameRows: getComputedStyle(q('.frame')).gridTemplateRows.split(' ').length,
      headerInsideScroller: !!q('.content .header'),
      headerSticky: getComputedStyle(q('.header')).position,
      // The header is its own scroll-state container: such a container styles its
      // DESCENDANTS, so it must BE the sticky element rather than the scroller.
      headerIsScrollState: getComputedStyle(q('.header')).containerType,
      // CHROMIUM ONLY. Firefox and WebKit drop the property and report
      // "normal"; the header still sticks, it just never gains the stuck
      // shadow. TRAP T-scroll-state-is-chromium-only
      supportsScrollState: CSS.supports('container-type', 'scroll-state'),
      // The view's inset moved off .content, so the sticky header bleeds full
      // width while the content below it stays on the layout grid.
      contentPadding: getComputedStyle(q('.content')).paddingTop,
      viewPadding: getComputedStyle(q('.context-frame')).paddingTop,
    };
  });
  expect(r.shell).toBe(true);
  expect(r.frame).toBe(true);
  expect(r.navSlot).toBe(true);
  expect(r.headerSlot).toBe(true);
  expect(r.contentSlot).toBe(true);
  expect(r.navPosition).toBe('absolute'); // an overlay, not a grid column
  expect(r.atLeftEdge).toBe(true);
  expect(r.headerInsideScroller).toBe(true);
  expect(r.headerSticky).toBe('sticky');
  // The guard and the engine must AGREE — that is the whole safety of it.
  expect(r.headerIsScrollState.includes('scroll-state')).toBe(r.supportsScrollState);
  // NEITHER region pads. The LAYOUT GRID owns the view's inset — `.sherpa-grid`
  // already applies --sherpa-layout-grid-padding, and the shell applying it too
  // inset the content TWICE, so a card sat 32px off the rail instead of 16.
  expect(r.contentPadding).toBe('0px');
  expect(r.viewPadding).toBe('0px');
  expect(r.fullHeight).toBe(true);
  expect(r.frameDisplay).toBe('grid');
  // ONE row, not two. The header moved INSIDE the scrolling content, so the frame
  // no longer reserves a row for it.
  expect(r.frameRows).toBe(1);
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

test('data-no-nav hides the rail and drops the content inset', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const nav = () => el.shadowRoot!.querySelector('.nav') as HTMLElement;
    const shown = getComputedStyle(nav()).display;
    el.setAttribute('data-no-nav', '');
    // Latched open would inset 320px; with no rail it must still be 0.
    el.setAttribute('data-nav-state', 'pinned');
    await el.rendered;
    // `.frame` transitions its margin, so the computed value is mid-animation
    // for 160ms. The custom property settles immediately — read that.
    const inset = getComputedStyle(el).getPropertyValue('--_content-inset').trim();
    return { shown, hidden: getComputedStyle(nav()).display, inset };
  });
  expect(r.shown).not.toBe('none');
  expect(r.hidden).toBe('none');
  expect(r.inset).toBe('0px');
});
