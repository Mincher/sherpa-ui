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
