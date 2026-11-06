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
    await window.__settled();
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
      panelsInScroller: !!q('.context-frame sherpa-layout-panels'),
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
    await window.__settled();
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

test('only the Context scrolls: the header and a panel stay put, and the frame shows its scroll shadow', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<div style="block-size: 400px"><sherpa-app-shell data-scroll-shadow style="min-block-size: 0">'
      + '<div slot="nav">N</div><div slot="header" class="head" style="block-size: 40px">H</div>'
      + '<div slot="panel-start" class="side" open style="block-size: 100%">Filters</div>'
      // A Context taller than its frame, as a page is: its CONTENT overflows.
      + '<div><div class="page" style="block-size: 1200px">Context</div></div></sherpa-app-shell></div>';
    await window.__settled();
    const shell = root.querySelector('sherpa-app-shell')!;
    (shell.shadowRoot!.querySelector('.shell') as HTMLElement).style.minBlockSize = '0';
    const frame = shell.shadowRoot!.querySelector<HTMLElement>('.context-frame')!;
    const top = (sel: string): number => Math.round(root.querySelector(sel)!.getBoundingClientRect().top);
    const frames = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    // The edges, and where the bottom one is against the frame's bottom.
    const edges = (): { top: string; bottom: string; low: number } => ({
      top: getComputedStyle(frame, '::before').opacity,
      bottom: getComputedStyle(frame, '::after').opacity,
      low: Math.round(frame.getBoundingClientRect().bottom),
    });
    await frames();
    const at = { head: top('.head'), side: top('.side'), page: top('.page'), edges: edges() };
    frame.scrollTop = 200;
    await frames();
    const scrolled = { head: top('.head'), side: top('.side'), page: top('.page'), edges: edges() };
    frame.scrollTop = frame.scrollHeight;
    await frames();
    return {
      at, scrolled, end: edges(),
      headShadow: getComputedStyle(root.querySelector('.head')!).boxShadow,
      panelShown: getComputedStyle(shell.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!.querySelector('.area-start')!).display,
      // Chromium and WebKit; Firefox has no scroll timeline, and shows none.
      driven: CSS.supports('animation-timeline: scroll()'),
    };
  });
  expect(r.panelShown).toBe('grid');
  // The page moved by the scroll; the header and the panel did not move at all.
  expect(r.scrolled.page).toBe(r.at.page - 200);
  expect(r.scrolled.head).toBe(r.at.head);
  expect(r.scrolled.side).toBe(r.at.side);
  // The header casts none: the frame's own edges say what is scrolled past. TODO 401
  expect(r.headShadow).toBe('none');
  test.skip(!r.driven, 'no scroll timeline: no shadow');
  expect([r.at.edges.top, r.at.edges.bottom]).toEqual(['0', '1']);
  expect([r.scrolled.edges.top, r.scrolled.edges.bottom]).toEqual(['1', '1']);
  expect([r.end.top, r.end.bottom]).toEqual(['1', '0']);
});

/* A CONTEXT'S FIXED REGION is first in the scroller, pinned: filling it never
   moves the scroller (a moved scroll box is a layout shift), and what scrolls
   passes under it. TRAP T-a-context-has-a-fixed-region */
test('a context-header region fills without moving the scroller, and stays put while the Context scrolls', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<div style="block-size: 400px"><sherpa-app-shell data-scroll-shadow style="min-block-size: 0">'
      + '<div slot="nav">N</div><div slot="header" style="block-size: 40px">H</div>'
      + '<div><div class="page" style="block-size: 1200px">Context</div></div></sherpa-app-shell></div>';
    await window.__settled();
    const shell = root.querySelector('sherpa-app-shell')!;
    (shell.shadowRoot!.querySelector('.shell') as HTMLElement).style.minBlockSize = '0';
    const frame = shell.shadowRoot!.querySelector<HTMLElement>('.context-frame')!;
    const box = (): string => { const b = frame.getBoundingClientRect(); return [b.top, b.height].map(Math.round).join(','); };
    const frames = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    await frames();
    const before = box();
    const region = document.createElement('div');
    region.slot = 'context-header';
    region.className = 'region';
    region.style.blockSize = '60px';
    shell.append(region);
    await frames();
    const top = (sel: string): number => Math.round(root.querySelector(sel)!.getBoundingClientRect().top);
    const at = { region: top('.region'), page: top('.page') };
    frame.scrollTop = 200;
    await frames();
    return { before, after: box(), at, scrolled: { region: top('.region'), page: top('.page') } };
  });
  expect(r.after).toBe(r.before);
  // The page starts under the region…
  expect(r.at.page).toBe(r.at.region + 60);
  // …and scrolls under it, while the region stays.
  expect(r.scrolled.region).toBe(r.at.region);
  expect(r.scrolled.page).toBe(r.at.page - 200);
});

test('the content inset holds at the collapsed width until the rail is latched open', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const frame = () => el.shadowRoot!.querySelector('.frame') as HTMLElement;
    const inset = (): string => getComputedStyle(frame()).marginInlineStart;

    // The margin ANIMATES, so read it once its transition has ended — not after a guess.
    const setState = async (state: string): Promise<string> => {
      el.dataset['navState'] = state;
      await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
      await Promise.all(frame().getAnimations().map((a) => a.finished));
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
    await window.__settled();
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
      await window.__settled();
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

/* Will, TODO 146: "Allow the side of the panel areas, in the app shell to be
   dragged to resize like we can do with the overlay panel… Obviously only the
   right side of the left panel area is draggable. The inverse for the right
   panel area. The drag indicator should show on the edge of the panel area
   (not panel) on hover & drag." TRAP T-an-edge-resizes-its-box */
test('a panel area resizes by its INNER edge — dragged or by the keys — within its min and 33% of the row', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<div style="block-size: 600px"><sherpa-app-shell style="min-block-size: 0" data-no-nav>'
      + '<div slot="header" style="block-size: 40px">H</div>'
      + '<div slot="panel-start" class="start" open style="block-size: 100%">Filters</div>'
      + '<div slot="panel-end" class="end" open style="block-size: 100%">Details</div>'
      + '<div>Context</div></sherpa-app-shell></div>';
    await window.__settled();
    const shell = root.querySelector('sherpa-app-shell')!;
    const sr = shell.shadowRoot!;
    // The areas are the body's: sherpa-layout-panels. TRAP T-a-panel-area-is-a-layout
    const lr = sr.querySelector('sherpa-layout-panels')!.shadowRoot!;
    const area = (side: string) => lr.querySelector<HTMLElement>(`.area-${side}`)!;
    const edge = (side: string) => lr.querySelector<HTMLElement>(`.edge-${side}`)!;
    const width = (side: string) => Math.round(area(side).getBoundingClientRect().width);
    const row = Math.round(sr.querySelector('.body')!.getBoundingClientRect().width);
    const heard: unknown[] = [];
    shell.addEventListener('panel-area-resize', (e) => heard.push((e as CustomEvent).detail));
    const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const drag = async (side: string, by: number): Promise<void> => {
      const e = edge(side);
      const b = e.getBoundingClientRect();
      const at = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      const opts = (x: number) => ({ bubbles: true, composed: true, clientX: x, clientY: at.y, pointerId: 1, button: 0 });
      e.dispatchEvent(new PointerEvent('pointerdown', opts(at.x)));
      e.dispatchEvent(new PointerEvent('pointermove', opts(at.x + by / 2)));
      const mid = e.hasAttribute('data-dragging');
      e.dispatchEvent(new PointerEvent('pointerup', opts(at.x + by)));
      await frames();
      held.push(mid);
    };
    const held: boolean[] = [];
    const key = async (side: string, k: string) => {
      edge(side).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      await frames();
    };

    const before = { start: width('start'), end: width('end') };
    // The START area's edge is its right: pulling right widens.
    await drag('start', 60);
    const wider = width('start');
    // The END area's edge is its left: pulling LEFT widens.
    await drag('end', -40);
    const endWider = width('end');
    // Keys: the edge moves the way the key points.
    await key('start', 'ArrowLeft');
    const keyed = width('start');
    // Past the ends: the clamp holds.
    await drag('start', 2000);
    const most = width('start');
    await drag('start', -2000);
    const least = width('start');
    await key('start', 'End');
    const end = width('start');
    // The handle is astride the AREA's edge, which is the docked panel's own, inset 16px.
    const e = edge('start').getBoundingClientRect();
    const a = area('start').getBoundingClientRect();
    const panel = root.querySelector('.start')!.getBoundingClientRect();
    // The host's width, IN.
    shell.setAttribute('data-panel-start-width', '500');
    await frames();
    const given = width('start');
    shell.removeAttribute('data-panel-start-width');
    await frames();
    return {
      row, before, wider, endWider, keyed, most, least, end, given, back: width('start'), heard, held,
      edge: { astride: Math.abs((e.left + e.right) / 2 - a.right) <= 1, flush: [panel.left, panel.right, panel.top, panel.bottom].map(Math.round).join() === [a.left + 16, a.right - 16, a.top + 16, a.bottom - 16].map(Math.round).join() },
      aria: { role: edge('start').getAttribute('role'), now: edge('start').getAttribute('aria-valuenow'),
        min: edge('start').getAttribute('aria-valuemin'), max: edge('start').getAttribute('aria-valuemax') },
    };
  });

  expect(r.wider).toBe(r.before.start + 60);
  expect(r.endWider).toBe(r.before.end + 40);
  expect(r.keyed).toBe(r.wider - 16);
  // Never over 33% of the row, never under the area's min.
  expect(Math.abs(r.most - r.row * 0.33)).toBeLessThanOrEqual(1);
  expect(r.least).toBe(256);
  expect(r.end).toBe(r.most);
  expect(r.given).toBe(500);
  expect(r.back).toBe(r.before.start);
  // Reported on release and on each key, never on every pixel.
  expect(r.heard).toEqual([
    { side: 'start', width: r.wider }, { side: 'end', width: r.endWider }, { side: 'start', width: r.keyed },
    { side: 'start', width: r.most }, { side: 'start', width: r.least }, { side: 'start', width: r.end },
  ]);
  expect(r.held.every(Boolean)).toBe(true);
  expect(r.edge).toEqual({ astride: true, flush: true });
  expect(r.aria).toEqual({ role: 'separator', now: String(r.end), min: '256', max: String(Math.round(r.row * 0.33)) });
});