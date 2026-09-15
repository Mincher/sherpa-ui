import { test, expect } from '@playwright/test';

/**
 * sherpa-stack — a run of items in one direction, with a token gap.
 *
 * It is the vertical counterpart to sherpa-toolbar. Every assertion here reads a
 * real COMPUTED value or a real measured box, never a class name: the component is
 * pure CSS, so "the rule is in the file" proves nothing about whether it applied.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

/** Build a stack with three 40px boxes and hand back the run + the items. */
async function build(page: import('@playwright/test').Page, attrs: string, itemAttrs = '') {
  return page.evaluate(
    async ([a, ia]) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const el = document.createElement('sherpa-stack') as HTMLElement & { rendered?: Promise<void> };
      for (const pair of a.split(' ').filter(Boolean)) {
        const [k, v] = pair.split('=');
        el.setAttribute(k!, v ?? '');
      }
      // Fixed-size items, so any measurement difference is the STACK's doing.
      el.innerHTML = [0, 1, 2]
        .map((i) => `<div id="i${i}" ${i === 1 ? ia : ''} style="block-size:40px;inline-size:40px"></div>`)
        .join('');
      root.appendChild(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();

      const run = el.shadowRoot!.querySelector('.run') as HTMLElement;
      const cs = getComputedStyle(run);
      const box = (id: string) => {
        const r = document.getElementById(id)!.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      return {
        direction: cs.flexDirection,
        gap: cs.gap,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        flexWrap: cs.flexWrap,
        overflowY: cs.overflowY,
        maxInlineSize: cs.maxInlineSize,
        items: { i0: box('i0'), i1: box('i1'), i2: box('i2') },
      };
    },
    [attrs, itemAttrs] as const,
  );
}

test('defaults to a column with the lg gap (12px)', async ({ page }) => {
  const r = await build(page, '');
  expect(r.direction).toBe('column');
  expect(r.gap).toBe('12px');
  // A column stacks DOWNWARD: same x, increasing y.
  expect(r.items.i1.x).toBe(r.items.i0.x);
  expect(r.items.i1.y).toBeGreaterThan(r.items.i0.y);
  // And the gap is really 12, not just declared as 12.
  expect(r.items.i1.y - (r.items.i0.y + r.items.i0.h)).toBe(12);
});

test('data-direction="inline" lays the run across', async ({ page }) => {
  const r = await build(page, 'data-direction=inline');
  expect(r.direction).toBe('row');
  expect(r.items.i1.y).toBe(r.items.i0.y);
  expect(r.items.i1.x).toBeGreaterThan(r.items.i0.x);
});

test('the gap scale reads the Theme gap/* tokens', async ({ page }) => {
  // sm 4 / md 8 / lg 12 / xl 16 — the Theme gap ramp, plus 2xl 24 past the top of it.
  for (const [step, px] of [['sm', 4], ['md', 8], ['lg', 12], ['xl', 16], ['2xl', 24]] as const) {
    const r = await build(page, `data-gap=${step}`);
    expect(r.gap, `gap=${step}`).toBe(`${px}px`);
    expect(r.items.i1.y - (r.items.i0.y + r.items.i0.h), `measured gap=${step}`).toBe(px);
  }
});

test('data-align="between" spreads items ALONG the run and levels them across', async ({ page }) => {
  const r = await build(page, 'data-direction=inline data-align=between');
  expect(r.justifyContent).toBe('space-between');
  expect(r.alignItems).toBe('center');
  // First item at the start, last item at the end of a full-width run.
  expect(r.items.i0.x).toBeLessThan(r.items.i2.x);
  expect(r.items.i2.x - r.items.i0.x).toBeGreaterThan(100);
});

test('data-fill + data-grow gives ONE child the spare space; siblings keep their size', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    // A fixed-height box the stack must divide up.
    const outer = document.createElement('div');
    outer.style.cssText = 'block-size:300px;inline-size:300px';
    const el = document.createElement('sherpa-stack') as HTMLElement & { rendered?: Promise<void> };
    // data-fill on the STACK (take the parent's height), data-grow on the ITEM
    // (which one gets the spare). Two attributes because a stack cannot see its
    // own children from CSS — see the note in sherpa-stack.css.
    el.setAttribute('data-fill', '');
    el.innerHTML =
      '<div id="a" style="block-size:40px"></div>' +
      '<div id="b" data-grow></div>' +
      '<div id="c" style="block-size:40px"></div>';
    outer.appendChild(el);
    root.appendChild(outer);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const h = (id: string) => Math.round(document.getElementById(id)!.getBoundingClientRect().height);
    return { a: h('a'), b: h('b'), c: h('c') };
  });
  // The MIDDLE item grows — not the last. That is the whole point of the marker.
  expect(r.a).toBe(40);
  expect(r.c).toBe(40);
  expect(r.b).toBeGreaterThan(150);
});

test('data-scroll makes the run scroll instead of pushing the page', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const outer = document.createElement('div');
    outer.style.cssText = 'block-size:200px;inline-size:300px';
    const el = document.createElement('sherpa-stack') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-scroll', '');
    el.setAttribute('data-gap', 'none');
    // 10 x 100px = 1000px of content in a 200px box.
    el.innerHTML = Array.from({ length: 10 }, () => '<div style="block-size:100px"></div>').join('');
    outer.appendChild(el);
    root.appendChild(outer);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const run = el.shadowRoot!.querySelector('.run') as HTMLElement;
    return {
      overflowY: getComputedStyle(run).overflowY,
      scrollH: run.scrollHeight,
      clientH: run.clientHeight,
      // The OUTER box must not have grown — the overflow stayed inside.
      outerH: Math.round(outer.getBoundingClientRect().height),
    };
  });
  expect(r.overflowY).toBe('auto');
  expect(r.scrollH).toBeGreaterThan(r.clientH);
  expect(r.outerH).toBe(200);
});

test('data-wrap shares a row and breaks it when the items no longer fit', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const outer = document.createElement('div');
    outer.style.cssText = 'inline-size:260px';
    const el = document.createElement('sherpa-stack') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-direction', 'inline');
    el.setAttribute('data-wrap', '');
    el.innerHTML = '<div id="a"></div><div id="b"></div><div id="c"></div>';
    outer.appendChild(el);
    root.appendChild(outer);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const y = (id: string) => Math.round(document.getElementById(id)!.getBoundingClientRect().y);
    return { wrap: getComputedStyle(el.shadowRoot!.querySelector('.run')!).flexWrap, a: y('a'), b: y('b'), c: y('c') };
  });
  expect(r.wrap).toBe('wrap');
  // 260px cannot hold three 200px-basis items, so they are on different lines.
  expect(new Set([r.a, r.b, r.c]).size).toBeGreaterThan(1);
});

test('data-measure caps the run at a reading measure and centres it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const outer = document.createElement('div');
    outer.style.cssText = 'inline-size:1400px';
    const el = document.createElement('sherpa-stack') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-measure', '');
    el.innerHTML = '<div id="a">x</div>';
    outer.appendChild(el);
    root.appendChild(outer);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const run = el.shadowRoot!.querySelector('.run') as HTMLElement;
    const rb = run.getBoundingClientRect();
    const ob = outer.getBoundingClientRect();
    return {
      runW: Math.round(rb.width),
      outerW: Math.round(ob.width),
      leftGap: Math.round(rb.x - ob.x),
      rightGap: Math.round(ob.right - rb.right),
    };
  });
  // Capped well below the 1400px it was given …
  expect(r.runW).toBeLessThan(1100);
  expect(r.runW).toBeGreaterThan(500);
  // … and centred: the two gutters match.
  expect(Math.abs(r.leftGap - r.rightGap)).toBeLessThanOrEqual(1);
});

test('it is a bare layout surface — no fill, no border, no padding', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-stack') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML = '<div>x</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const cs = getComputedStyle(el);
    const run = getComputedStyle(el.shadowRoot!.querySelector('.run')!);
    return {
      hostBg: cs.backgroundColor, hostBorder: cs.borderTopWidth, hostPad: cs.paddingTop,
      runBg: run.backgroundColor, runBorder: run.borderTopWidth, runPad: run.paddingTop,
    };
  });
  expect(r.hostBg).toBe('rgba(0, 0, 0, 0)');
  expect(r.runBg).toBe('rgba(0, 0, 0, 0)');
  expect(r.hostBorder).toBe('0px');
  expect(r.runBorder).toBe('0px');
  expect(r.hostPad).toBe('0px');
  expect(r.runPad).toBe('0px');
});

test('without data-fill the stack is content-height — data-grow alone does nothing', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const outer = document.createElement('div');
    outer.style.cssText = 'block-size:300px;inline-size:300px';
    const el = document.createElement('sherpa-stack') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-gap', 'none');
    el.innerHTML = '<div id="a" style="block-size:40px"></div><div id="b" data-grow></div>';
    outer.appendChild(el);
    root.appendChild(outer);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { hostH: Math.round(el.getBoundingClientRect().height) };
  });
  // 40px of content in a 300px box: the stack did NOT take the parent's height,
  // which is what makes data-fill an opt-in rather than a surprise.
  expect(r.hostH).toBe(40);
});
