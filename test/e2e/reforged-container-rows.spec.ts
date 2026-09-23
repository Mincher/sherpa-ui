import { test, expect } from './harness';

/**
 * sherpa-container[data-rows] — a card sized in LAYOUT GRID ROWS.
 *
 * A card with no height is as tall as its content, which is wrong twice over: a
 * chart hugs its own minimum and leaves the card part empty, and a data grid grows
 * with its row count until the pager is off the bottom of the screen.
 *
 * data-rows="N" makes the card exactly N grid rows tall — N row heights plus the
 * (N-1) gutters between them, both projected layout tokens. The example app used
 * to do this in its own <style> block, which every app then had to copy.
 */


test('the height is N row units plus the gutters between them', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const out: Record<string, number> = {};
    for (const n of [4, 6, 8]) {
      const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
      el.setAttribute('data-row-span', String(n));
      el.innerHTML = '<div>x</div>';
      root.appendChild(el);
      await el.rendered;
      out[`r${n}`] = Math.round(el.getBoundingClientRect().height);
    }
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    // Read the tokens the rule consumes, so the test does not hardcode a number
    // that a Figma re-point would silently break.
    const cs = getComputedStyle(document.documentElement);
    out.rowH = parseFloat(cs.getPropertyValue('--sherpa-layout-grid-row-height'));
    out.gap = parseFloat(cs.getPropertyValue('--sherpa-layout-grid-gap-vertical'));
    return out;
  });

  const expected = (n: number) => n * r.rowH + (n - 1) * r.gap;
  expect(r.r4).toBe(Math.round(expected(4)));
  expect(r.r6).toBe(Math.round(expected(6)));
  expect(r.r8).toBe(Math.round(expected(8)));
  // And it really is a ladder, not one fixed number.
  expect(r.r8).toBeGreaterThan(r.r6);
  expect(r.r6).toBeGreaterThan(r.r4);
});

test('an only child FILLS the card', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-row-span', '6');
    el.setAttribute('data-padding', 'none');
    el.innerHTML = '<div id="only"></div>';
    root.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      // clientHeight is the CONTENT box — the card's own 0.5px ring is inside its
      // declared height, so the outer rect is 1px taller at each edge.
      card: el.clientHeight,
      child: Math.round(document.getElementById('only')!.getBoundingClientRect().height),
    };
  });
  // A 0-height div grew into the whole card — which is what stops a chart from
  // drawing 180px of bars inside a 464px card.
  expect(r.child).toBe(r.card);
});

test('data-fill + data-grow picks the grower; the others keep their natural height', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-row-span', '8');
    el.setAttribute('data-padding', 'none');
    // data-fill is the switch: without it EVERY body child grows (the common
    // one-child card), with it only the data-grow child does.
    el.setAttribute('data-fill', '');
    // The shape of a records card: two toolbars, the GRID, then the pager.
    el.innerHTML =
      '<div id="t1" style="block-size:40px"></div>' +
      '<div id="t2" style="block-size:40px"></div>' +
      '<div id="grid" data-grow></div>' +
      '<div id="pager" style="block-size:48px"></div>';
    root.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const h = (id: string) => Math.round(document.getElementById(id)!.getBoundingClientRect().height);
    // clientHeight — the content box, inside the card's own 0.5px ring.
    return { card: el.clientHeight, t1: h('t1'), t2: h('t2'), grid: h('grid'), pager: h('pager') };
  });
  // The MIDDLE item grew, not the last — that is why the marker is on the item.
  expect(r.t1).toBe(40);
  expect(r.t2).toBe(40);
  expect(r.pager).toBe(48);
  expect(r.grid).toBe(r.card - 40 - 40 - 48);
  expect(r.grid).toBeGreaterThan(100);
});

test('without data-rows the card is content-height', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-padding', 'none');
    el.innerHTML = '<div style="block-size:60px"></div>';
    root.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return el.clientHeight;
  });
  // Sizing is opt-in: a plain card must not suddenly claim six grid rows.
  expect(r).toBe(60);
});

test('a body child grows even when a header shares the light DOM', async ({ page }) => {
  // The bug this guards: `:only-child` counts every LIGHT-DOM sibling, and a card
  // almost always has a slot="header" sibling. So a chart beside a header was
  // never an only child, kept its natural height, and a line chart drew itself
  // 1342px tall inside a 464px card.
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-row-span', '6');
    el.setAttribute('data-padding', 'none');
    el.innerHTML = '<div slot="header">Title</div><div id="body"></div>';
    root.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const header = el.shadowRoot!.querySelector('.header')!.getBoundingClientRect();
    return {
      card: el.clientHeight,
      // UNROUNDED. A header of 34.5 and a body of 428.5 each round UP, so
      // rounding first and subtracting after counts the same half-pixel twice
      // and the sum misses by one.
      headerH: header.height,
      body: document.getElementById('body')!.getBoundingClientRect().height,
    };
  });
  // The body child took everything the header did not.
  expect(Math.round(r.body)).toBe(Math.round(r.card - r.headerH));
  expect(r.body).toBeGreaterThan(100);
});

test('data-padding-inline pads the content sideways without restoring the block inset', async ({ page }) => {
  // A card full of full-bleed parts — a toolbar with its own bottom rule, a grid,
  // a pager with its own top rule — wants NO block padding, so each divider still
  // meets both card edges. But the content itself still needs to breathe
  // horizontally. The two axes therefore have to be settable apart.
  const got = await page.evaluate(async () => {
    const read = async (attrs: string) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const el = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
      for (const pair of attrs.split(' ').filter(Boolean)) {
        const [k, v] = pair.split('=');
        el.setAttribute(k!, v ?? '');
      }
      root.appendChild(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const body = el.shadowRoot!.querySelector('.body')!;
      const s = getComputedStyle(body);
      return { block: s.paddingTop, inline: s.paddingLeft };
    };
    return {
      // Both axes flush.
      none: await read('data-padding=none'),
      // Block stays flush; inline breathes.
      split: await read('data-padding=none data-padding-inline=md'),
      // With no override the inline axis still follows the padding scale.
      scale: await read('data-padding=sm'),
    };
  });

  expect(got.none).toEqual({ block: '0px', inline: '0px' });
  expect(got.split).toEqual({ block: '0px', inline: '8px' });
  // Unchanged behaviour for every card that does not use the new attribute.
  expect(got.scale).toEqual({ block: '8px', inline: '8px' });
});
