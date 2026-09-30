import { test, expect } from './harness';

/**
 * sherpa-app-shell — the app frame: the nav rail OVERLAID down the left edge at full
 * height, with the header + content wrapper inset past it. The inset is the COLLAPSED
 * rail width while the rail is collapsed or hovered (so hovering reveals the rail over
 * the content instead of reflowing the page) and grows only when it is latched open.
 */


test('the nav rail is a full-height overlay; the header is a row above the scroller', async ({ page }) => {
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
      // ONE row in the frame: the header is a row of `.content`, above the body.
      frameRows: getComputedStyle(q('.frame')).gridTemplateRows.split(' ').length,
      /* ONLY THE CONTEXT SCROLLS: the header and both panel areas are outside
         the scroller, so nothing scrolls them away. TRAP T-only-the-context-scrolls */
      scrolls: ['.content', '.body', '.context-frame'].map((sel) => getComputedStyle(q(sel)).overflowY),
      headerInScroller: !!q('.context-frame .header'),
      panelsInScroller: !!q('.context-frame .panel-start, .context-frame .panel-end'),
      headerPosition: getComputedStyle(q('.header')).position,
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
  expect(r.scrolls).toEqual(['hidden', 'visible', 'auto']);
  expect(r.headerInScroller).toBe(false);
  expect(r.panelsInScroller).toBe(false);
  // A row that nothing scrolls needs no `sticky`.
  expect(r.headerPosition).toBe('relative');
  // NEITHER region pads. The LAYOUT GRID owns the view's inset — `.sherpa-grid`
  // already applies --sherpa-layout-grid-padding, and the shell applying it too
  // inset the content TWICE, so a card sat 32px off the rail instead of 16.
  expect(r.contentPadding).toBe('0px');
  expect(r.viewPadding).toBe('0px');
  expect(r.fullHeight).toBe(true);
  expect(r.frameDisplay).toBe('grid');
  expect(r.frameRows).toBe(1);
});

/* A SHORT Context still fills its frame — or a fit grid inside it "fits" its
   own content, and a card changes height with its row count. Will, TODO 153.
   TRAP T-a-fit-grid-needs-a-sized-parent */
test('a Context fills its frame however little it holds, so `100%` inside it measures the area', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<div style="block-size: 400px"><sherpa-app-shell style="min-block-size: 0">'
      + '<div slot="header" style="block-size: 40px">H</div>'
      + '<div class="ctx" style="min-block-size: 0"><div class="fit" style="block-size: 100%"><div style="block-size: 50px">little</div></div></div>'
      + '</sherpa-app-shell></div>';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const shell = root.querySelector('sherpa-app-shell')!;
    (shell.shadowRoot!.querySelector('.shell') as HTMLElement).style.minBlockSize = '0';
    await new Promise<void>((res) => requestAnimationFrame(() => res()));
    const frame = shell.shadowRoot!.querySelector<HTMLElement>('.context-frame')!;
    const h = (sel: string): number => Math.round(root.querySelector(sel)!.getBoundingClientRect().height);
    return { frame: frame.clientHeight, ctx: h('.ctx'), fit: h('.fit'), scrolls: frame.scrollHeight > frame.clientHeight };
  });
  expect(r.frame).toBe(360);
  expect(r.ctx).toBe(r.frame);
  // `100%` inside it is the AREA, not the 50px it holds.
  expect(r.fit).toBe(r.frame);
  expect(r.scrolls).toBe(false);
});

test('only the Context scrolls: the header and a panel stay put, and the header takes a shadow', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<div style="block-size: 400px"><sherpa-app-shell style="min-block-size: 0">'
      + '<div slot="nav">N</div><div slot="header" class="head" style="block-size: 40px">H</div>'
      + '<div slot="panel-start" class="side" open style="block-size: 100%">Filters</div>'
      // A Context taller than its frame, as a page is: its CONTENT overflows.
      + '<div><div class="page" style="block-size: 1200px">Context</div></div></sherpa-app-shell></div>';
    const settle = (window as unknown as { __settled: () => Promise<void> }).__settled;
    await settle();
    const shell = root.querySelector('sherpa-app-shell')!;
    (shell.shadowRoot!.querySelector('.shell') as HTMLElement).style.minBlockSize = '0';
    const frame = shell.shadowRoot!.querySelector<HTMLElement>('.context-frame')!;
    const top = (sel: string): number => Math.round(root.querySelector(sel)!.getBoundingClientRect().top);
    const shadow = (): string => getComputedStyle(root.querySelector('.head')!).boxShadow;
    const frames = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const at = { head: top('.head'), side: top('.side'), page: top('.page'), shadow: shadow() };
    frame.scrollTop = 200;
    await frames();
    const scrolled = { head: top('.head'), side: top('.side'), page: top('.page'), shadow: shadow() };
    frame.scrollTop = 0;
    await frames();
    return {
      at, scrolled, back: shadow(),
      panelShown: getComputedStyle(shell.shadowRoot!.querySelector('.panel-start')!).display,
      // Chromium and WebKit; Firefox has no scroll-driven animation, and draws no shadow.
      driven: CSS.supports('timeline-scope: --x') && CSS.supports('animation-timeline: --x'),
    };
  });
  expect(r.panelShown).toBe('block');
  // The page moved by the scroll; the header and the panel did not move at all.
  expect(r.scrolled.page).toBe(r.at.page - 200);
  expect(r.scrolled.head).toBe(r.at.head);
  expect(r.scrolled.side).toBe(r.at.side);
  /* The shadow is there only while something is scrolled under the header. At
     the top an engine reports `none`, or the animation's start: a shadow of no
     size and no colour. */
  const drawn = (shadow: string): boolean => shadow !== 'none' && !/\/ 0\) 0px 0px 0px/.test(shadow);
  expect(drawn(r.at.shadow)).toBe(false);
  expect(drawn(r.scrolled.shadow)).toBe(r.driven);
  expect(drawn(r.back)).toBe(false);
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

test('the overlay slot covers the header and content exactly, and the rail stays on top', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-nav-state', 'pinned');
    el.innerHTML =
      '<div slot="nav" style="inline-size: 320px">N</div><div slot="header">H</div><div>Content</div>' +
      '<div slot="overlay">Settings</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    await new Promise((res) => setTimeout(res, 250)); // the inset animates
    const frame = el.shadowRoot!.querySelector('.frame')!.getBoundingClientRect();
    const overlay = el.querySelector('[slot="overlay"]')!.getBoundingClientRect();
    const nav = el.shadowRoot!.querySelector('.nav') as HTMLElement;
    return {
      frame: `${frame.x},${frame.y} ${frame.width}x${frame.height}`,
      overlay: `${overlay.x},${overlay.y} ${overlay.width}x${overlay.height}`,
      navZ: Number(getComputedStyle(nav).zIndex),
      overlayZ: Number(getComputedStyle(el.querySelector('[slot="overlay"]')!).zIndex),
    };
  });
  expect(r.overlay).toBe(r.frame);
  expect(r.navZ).toBeGreaterThan(r.overlayZ);
});

for (const [density, px] of [['compact', 36], ['default', 40], ['comfortable', 48]] as const) {
  test(`in ${density} density the closed rail, its brand tile and the content inset are all ${px}px`, async ({ page }) => {
    const r = await page.evaluate(async (d) => {
      if (d !== 'default') document.documentElement.dataset['density'] = d;
      const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
      el.innerHTML = '<div>Content</div>';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      await new Promise((res) => setTimeout(res, 250)); // width and inset animate
      const nav = el.shadowRoot!.querySelector('sherpa-nav')!;
      const tile = nav.shadowRoot!.querySelector('.brand-icon')!.getBoundingClientRect();
      const frame = el.shadowRoot!.querySelector('.frame')!;
      return {
        rail: nav.getBoundingClientRect().width,
        tile: `${tile.width}x${tile.height}`,
        inset: getComputedStyle(frame).marginInlineStart,
      };
    }, density);
    expect(r).toEqual({ rail: px, tile: `${px}x${px}`, inset: `${px}px` });
  });
}
