import { test, expect } from './harness';

/**
 * A SCROLL SHADOW — Will, TODO 401. With `data-scroll-shadow`, a scroll box
 * shows an inner shadow on each edge its content is hidden past: two sticky
 * edges over the content, each following the box's own scroll. They take no
 * room, gap or not. Firefox has no scroll timeline, and shows none.
 * TRAP T-a-scroll-shadow-is-drawn-over-the-content
 */
test('a scrolling stack shows each edge only while content is hidden past it, and the edges take no room', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const items = Array.from({ length: 12 }, (_, i) => `<div style="block-size: 40px">Item ${i}</div>`).join('');
    root.innerHTML = `<sherpa-stack data-scroll data-gap="md" style="block-size: 200px">${items}</sherpa-stack>`;
    await window.__settled();
    const stack = root.querySelector('sherpa-stack')!;
    const run = stack.shadowRoot!.querySelector<HTMLElement>('.run')!;
    const tops = (): number[] => [...stack.children].map((c) => Math.round(c.getBoundingClientRect().top));
    const edges = (): { top: string; bottom: string } => ({
      top: getComputedStyle(run, '::before').opacity, bottom: getComputedStyle(run, '::after').opacity,
    });
    const frames = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const off = { tops: tops(), content: getComputedStyle(run, '::before').content };
    stack.toggleAttribute('data-scroll-shadow', true);
    await frames();
    const on = { tops: tops(), at: edges() };
    run.scrollTop = 100;
    await frames();
    const mid = edges();
    run.scrollTop = run.scrollHeight;
    await frames();
    return { off, on, mid, end: edges(), driven: CSS.supports('animation-timeline: scroll()') };
  });
  // Off by default: no edge at all.
  expect(r.off.content).toBe('none');
  // No room taken: every item where it was.
  expect(r.on.tops).toEqual(r.off.tops);
  test.skip(!r.driven, 'no scroll timeline: no shadow');
  expect(r.on.at).toEqual({ top: '0', bottom: '1' });
  expect(r.mid).toEqual({ top: '1', bottom: '1' });
  expect(r.end).toEqual({ top: '1', bottom: '0' });
});

test('an outer box\'s gap never reaches an inner box\'s edges', async ({ page }) => {
  const margin = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    // A container in a scrolling stack with a gap: the stack's gap is the stack's own.
    root.innerHTML = '<sherpa-stack data-scroll data-gap="xl"><sherpa-container data-scroll-shadow>Body</sherpa-container></sherpa-stack>';
    await window.__settled();
    const body = root.querySelector('sherpa-container')!.shadowRoot!.querySelector('.body')!;
    return CSS.supports('animation-timeline: scroll()') ? getComputedStyle(body, '::before').marginBlockEnd : 'none';
  });
  test.skip(margin === 'none', 'no scroll timeline: no shadow');
  expect(margin).toBe('-12px');
});

// TODO 421. TRAP T-a-stuck-header-casts-a-shadow
test('a grid\'s header casts a shadow only once rows scroll under it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
    el.style.blockSize = '200px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ columns: [{ field: 'name', header: 'Name' }], rows: Array.from({ length: 30 }, (_, i) => ({ name: `Row ${i}` })) });
    await window.__settled();
    const sr = el.shadowRoot!;
    const scroller = sr.querySelector<HTMLElement>('.scroller')!;
    const edge = (): string => getComputedStyle(sr.querySelector('.head-row > .head-cell')!, '::after').opacity;
    const frames = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const at = edge();
    scroller.scrollTop = 100;
    await frames();
    return { at, scrolled: edge(), driven: CSS.supports('animation-timeline: scroll()') };
  });
  test.skip(!r.driven, 'no scroll timeline: no shadow');
  expect(r).toEqual({ at: '0', scrolled: '1', driven: true });
});

// TODO 478. TRAP T-a-sideways-scroll-shadow-is-its-frames
test('a grid scrolled sideways shows each side edge only while content is hidden past it, past its pinned columns', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
    el.style.cssText = 'block-size: 200px; inline-size: 400px';
    el.toggleAttribute('data-scroll-shadow', true);
    el.toggleAttribute('data-selectable', true);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const columns = Array.from({ length: 8 }, (_, i) => ({ field: `c${i}`, header: `Column ${i}`, width: 120 }));
    el.populate!({ columns, rows: Array.from({ length: 5 }, (_, r) => Object.fromEntries(columns.map((c) => [c.field, `${c.field}-${r}`]))) });
    await window.__settled();
    const sr = el.shadowRoot!;
    const frame = sr.querySelector<HTMLElement>('.scroll-frame')!;
    const scroller = sr.querySelector<HTMLElement>('.scroller')!;
    const frames = (): Promise<void> => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const edge = (side: string): HTMLElement => frame.querySelector<HTMLElement>(`:scope > .sherpa-scroll-edge-${side}`)!;
    const edges = (): { start: string; end: string } => ({
      start: getComputedStyle(edge('start')).opacity, end: getComputedStyle(edge('end')).opacity,
    });
    await frames();
    const at = edges();
    scroller.scrollLeft = 100;
    await frames();
    const mid = edges();
    scroller.scrollLeft = scroller.scrollWidth;
    await frames();
    const end = edges();
    // The start edge stands at the pinned first column's trailing edge.
    const pinned = sr.querySelector('.head-row > [data-pin-last]')!.getBoundingClientRect().right;
    const start = edge('start').getBoundingClientRect().left;
    return { at, mid, end, gap: Math.round(start - pinned), driven: CSS.supports('animation-timeline: scroll()') };
  });
  test.skip(!r.driven, 'no scroll timeline: no shadow');
  expect(r.at).toEqual({ start: '0', end: '1' });
  expect(r.mid).toEqual({ start: '1', end: '1' });
  expect(r.end).toEqual({ start: '1', end: '0' });
  expect(Math.abs(r.gap)).toBeLessThanOrEqual(1);
});

test('a grid that fits across shows no side edge', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
    el.style.cssText = 'block-size: 200px; inline-size: 600px';
    el.toggleAttribute('data-scroll-shadow', true);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ columns: [{ field: 'name', header: 'Name' }], rows: [{ name: 'Ada' }] });
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const frame = el.shadowRoot!.querySelector('.scroll-frame')!;
    return { edges: ['start', 'end'].map((s) => getComputedStyle(frame.querySelector(`:scope > .sherpa-scroll-edge-${s}`)!).opacity),
      driven: CSS.supports('animation-timeline: scroll()') };
  });
  test.skip(!r.driven, 'no scroll timeline: no shadow');
  expect(r.edges).toEqual(['0', '0']);
});

/* ONE header shadow: under a pinned column it is no darker than under a scrolled
   one, however far the columns have scrolled under it. TODO 481.
   TRAP T-a-stuck-header-casts-a-shadow */
test('the header\'s shadow does not stack under a pinned column as columns scroll under it', async ({ page }) => {
  const at = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
    el.id = 'wide';
    el.style.cssText = 'block-size: 240px; inline-size: 480px';
    el.toggleAttribute('data-selectable', true);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const columns = Array.from({ length: 10 }, (_, i) => ({ field: `c${i}`, header: `Column ${i}`, width: 120 }));
    el.populate!({ columns, rows: Array.from({ length: 30 }, (_, r) => Object.fromEntries(columns.map((c) => [c.field, `${c.field}-${r}`]))) });
    await window.__settled();
    const sr = el.shadowRoot!;
    const scroller = sr.querySelector<HTMLElement>('.scroller')!;
    scroller.scrollTop = 120;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const head = sr.querySelector('.head')!.getBoundingClientRect();
    const pin = sr.querySelector('.head-row > [data-pin-last]')!.getBoundingClientRect();
    return { y: head.bottom + 2, pinned: pin.left + pin.width / 2, scrolled: pin.right + 60, driven: CSS.supports('animation-timeline: scroll()') };
  });
  test.skip(!at.driven, 'no scroll timeline: no shadow');
  const pixel = async (x: number): Promise<number> => {
    const shot = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(at.y), width: 1, height: 1 } });
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')!;
      c.drawImage(img, 0, 0);
      return c.getImageData(0, 0, 1, 1).data[0]!;
    }, shot.toString('base64'));
  };
  const read = async () => ({ pinned: await pixel(at.pinned), scrolled: await pixel(at.scrolled) });
  const rest = await read();
  await page.evaluate(() => {
    document.getElementById('wide')!.shadowRoot!.querySelector<HTMLElement>('.scroller')!.scrollLeft = 600;
  });
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  const across = await read();
  // Shaded at all; no darker under the pinned column; and no darker there once columns pass under it.
  expect(rest.scrolled).toBeLessThan(250);
  expect(rest.pinned).toBeGreaterThanOrEqual(rest.scrolled - 6);
  expect(Math.abs(across.pinned - rest.pinned)).toBeLessThanOrEqual(3);
});
