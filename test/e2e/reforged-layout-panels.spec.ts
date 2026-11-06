import { test, expect, type Page } from './harness';

/**
 * ONE panel-area layout, sherpa-layout-panels, which the app shell and the canvas compose (Will,
 * TODO 796). A docked panel is FLUSH to its area's top, side and bottom, with no shadow: the area
 * draws the divider. The content reflows beside it, and takes the width back when the panel shuts
 * or floats. The area's edge resizes it. A panel floats out of its area and docks back into the
 * SAME one. A pressed floating panel comes to the front (787c). Real pointer and keys; read back by
 * boxes and by pixels. TRAP T-a-panel-area-is-a-layout TRAP T-a-pressed-panel-comes-to-the-front
 */

type Box = { x: number; y: number; w: number; h: number };
type Rgb = [number, number, number];
const W = 1600;
const H = 900;

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));

/** The shell, its filter column docked in the start area and the Assistant fixed in the end. */
async function shell(page: Page): Promise<void> {
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-app-shell data-no-nav style="block-size: 100vh">'
      + '<div slot="header" style="block-size: 40px">H</div>'
      + '<sherpa-overlay-panel slot="panel-start" id="col" data-heading="Filters" data-fixed="start" data-floatable open><p>Filters</p></sherpa-overlay-panel>'
      + '<div><div class="page" style="padding: 16px">Context</div></div></sherpa-app-shell>'
      + '<sherpa-overlay-panel id="ask" data-heading="Assistant" data-fixed data-floatable data-poppable data-dismissible><p>Hi</p></sherpa-overlay-panel>';
    await window.__settled();
    (document.getElementById('ask') as HTMLElement & { show(): void }).show();
    const heard: unknown[] = [];
    (window as unknown as { __heard: unknown[] }).__heard = heard;
    const sh = document.querySelector('sherpa-app-shell')!;
    sh.addEventListener('panel-area-resize', (e) => heard.push({ shell: (e as CustomEvent).detail }));
    document.addEventListener('panel-area-resize', (e) => heard.push({ document: (e as CustomEvent).detail }));
  });
  await settle(page);
}

/** A box: by id, or a part of the shell's layout or of a host's shadow root. */
const box = (page: Page, what: string): Promise<Box> => page.evaluate((w) => {
  const layout = document.querySelector('sherpa-app-shell')?.shadowRoot!.querySelector('sherpa-layout-panels');
  const [host, sel] = w.split(' ');
  const el = host === 'layout' ? layout!.shadowRoot!.querySelector(sel!)
    : host === 'shell' ? document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector(sel!)
    : sel ? document.getElementById(host!)!.shadowRoot!.querySelector(sel) : document.getElementById(host!);
  const r = el!.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}, what);

/** The pixels in a row, from a point: what the screen draws there, one per DEVICE px (two a CSS px at 2x). */
async function pixels(page: Page, x: number, y: number, width = 1): Promise<Rgb[]> {
  const shot = await page.screenshot({ clip: { x, y, width, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return Array.from({ length: img.width }, (_, i) => [...c.getImageData(i, 0, 1, 1).data].slice(0, 3) as Rgb);
  }, shot.toString('base64'));
}
const far = (a: Rgb, b: Rgb): number => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

/** A real click on a button in a host's shadow root. */
async function press(page: Page, id: string, sel: string): Promise<void> {
  const b = await box(page, `${id} ${sel}`);
  await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await settle(page);
}

/** A real drag, let go inside the window: Firefox drops a release outside it. */
async function drag(page: Page, from: [number, number], by: [number, number]): Promise<void> {
  const to = [Math.min(W - 2, Math.max(2, from[0] + by[0])), Math.min(H - 2, Math.max(2, from[1] + by[1]))] as const;
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(to[0], to[1], { steps: 4 });
  await page.mouse.up();
  await settle(page);
}

/** A docked panel is a card INSET from its area by 16px on every side. TODO 871 */
const inset = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + 16, y: b.y + 16, w: b.w - 32, h: b.h - 32 });

test('docked, a panel is FLUSH to its area\'s top, side and bottom, with no shadow: the area draws the divider', async ({ page }) => {
  await shell(page);
  const [body, start, end] = [await box(page, 'shell .body'), await box(page, 'layout .area-start'), await box(page, 'layout .area-end')];
  const [column, ask] = [await box(page, 'col .root'), await box(page, 'ask .root')];
  // A card: the column sits in the start area, the Assistant in the end, each inset by 16px.
  expect(column).toEqual(inset(start));
  expect(ask).toEqual(inset(end));
  expect([start.x, start.y, start.h]).toEqual([body.x, body.y, body.h]);
  expect([end.x + end.w, end.y, end.h]).toEqual([body.x + body.w, body.y, body.h]);
  // A card of its own: no shadow, four rounded corners, an edge.
  const look = await page.evaluate(() => ['col', 'ask'].map((id) => {
    const el = document.getElementById(id)!.shadowRoot!.querySelector('.root')!;
    const s = getComputedStyle(el);
    return [s.boxShadow, s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomLeftRadius, s.borderBottomRightRadius];
  }));
  expect(look).toEqual([['none', '4px', '4px', '4px', '4px'], ['none', '4px', '4px', '4px', '4px']]);
  // No line of the area's is drawn: the card's own border is the edge, and no shadow falls on the content.
  const y = start.y + 400;
  const surface = (await pixels(page, start.x + start.w + 200, y))[0]!;
  for (const p of await pixels(page, start.x + start.w, y, 23)) expect(far(p, surface)).toBeLessThanOrEqual(2);
  const before = await pixels(page, end.x - 23, y, 23);
  for (const p of before) expect(far(p, surface)).toBeLessThanOrEqual(2);
});

test('the content reflows beside its panels, and takes the width back when one shuts or floats', async ({ page }) => {
  await shell(page);
  const body = await box(page, 'shell .body');
  const frame = () => box(page, 'shell .context-edges');
  const [start, end] = [await box(page, 'layout .area-start'), await box(page, 'layout .area-end')];
  // The frame starts where each open area ends: the area's inset is the gap. TRAP T-one-line-between-a-context-and-a-panel-area
  expect(await frame()).toMatchObject({ x: start.x + start.w, w: end.x - (start.x + start.w) });
  // Shut, the Assistant gives the content its width back.
  await page.evaluate(() => (document.getElementById('ask') as HTMLElement & { hide(): void }).hide());
  await settle(page);
  expect(await frame()).toMatchObject({ x: start.x + start.w, w: body.x + body.w - (start.x + start.w) });
  // Floating, the column does too: its area takes no width.
  await press(page, 'col', '.float');
  expect(await frame()).toMatchObject({ x: body.x, w: body.w });
});

test('a panel opened LATE shows its area, shut it gives it back; a card hidden by its own style takes none', async ({ page }) => {
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-app-shell data-no-nav style="block-size: 100vh">'
      + '<div slot="header" style="block-size: 40px">H</div>'
      + '<sherpa-overlay-panel slot="panel-start" id="col" data-heading="Filters" data-fixed="start" data-floatable><p>Filters</p></sherpa-overlay-panel>'
      + '<div slot="panel-end" id="side" style="display: none">Side</div><div>C</div></sherpa-app-shell>';
    await window.__settled();
    const shut = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!.querySelector('.area-start')!.getBoundingClientRect().width;
    // Opened once it is drawn shut, as a provider opens it: WebKit kept it `display: none` under the
    // shut area, and an area that read its computed style waited for ever.
    document.getElementById('col')!.setAttribute('open', '');
    return shut;
  }).then((shut) => expect(shut).toBe(0));
  await settle(page);
  expect(await box(page, 'col .root')).toEqual(inset(await box(page, 'layout .area-start')));
  expect((await box(page, 'layout .area-start')).w).toBe(464);
  await page.evaluate(() => document.getElementById('col')!.removeAttribute('open'));
  await settle(page);
  expect((await box(page, 'layout .area-start')).w).toBe(0);
  // A panel with no `open`, shown by its style: its area follows it.
  await page.evaluate(() => document.getElementById('side')!.style.removeProperty('display'));
  await settle(page);
  expect((await box(page, 'layout .area-end')).w).toBe(464);
});

test('an area resizes by its edge, by a real drag and by the keys; the shell reports each, once', async ({ page }) => {
  await shell(page);
  const area = () => box(page, 'layout .area-start');
  const edge = await box(page, 'layout .edge-start');
  const before = await area();
  // Astride the divider, half each side.
  expect(Math.abs(edge.x + edge.w / 2 - (before.x + before.w))).toBeLessThanOrEqual(1);
  await drag(page, [edge.x + edge.w / 2, edge.y + 300], [60, 0]);
  const wider = await area();
  expect(wider.w).toBe(before.w + 60);
  // The column is still its card in it.
  expect(await box(page, 'col .root')).toEqual(inset(wider));
  // The keys, from the edge, as a reader with no pointer does it.
  await page.evaluate(() => (document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!.querySelector('.edge-start') as HTMLElement).focus());
  await page.keyboard.press('ArrowLeft');
  expect((await area()).w).toBe(wider.w - 16);
  await page.keyboard.press('Home');
  expect((await area()).w).toBe(464);
  // The line shows on focus.
  const line = await page.evaluate(() => getComputedStyle(document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!.querySelector('.edge-start')!, '::before').borderInlineStartColor);
  expect(line).not.toBe('rgba(0, 0, 0, 0)');
  // The shell's own report, once each, and the layout's goes no further than the shell.
  expect(await page.evaluate(() => (window as unknown as { __heard: unknown[] }).__heard)).toEqual([
    { shell: { side: 'start', width: wider.w } }, { document: { side: 'start', width: wider.w } },
    { shell: { side: 'start', width: wider.w - 16 } }, { document: { side: 'start', width: wider.w - 16 } },
    { shell: { side: 'start', width: 464 } }, { document: { side: 'start', width: 464 } },
  ]);
});

test('a panel floats out of its area and docks back into the SAME one: a panel fixed at the start', async ({ page }) => {
  await shell(page);
  // (The filter column's own Float is the overlay panel's now: reforged-overlay-panel-float and the Demos float spec read it.)
  await page.evaluate(() => document.getElementById('col')!.remove());
  // A panel fixed in the START area: Pop takes it out, Float lifts it, and both put it back there.
  await page.evaluate(() => document.getElementById('ask')!.setAttribute('data-fixed', 'start'));
  await settle(page);
  const inStart = await box(page, 'layout .area-start');
  expect(await box(page, 'ask .root')).toEqual(inset(inStart));
  expect((await box(page, 'layout .area-end')).w).toBe(0);
  await press(page, 'ask', '.float');
  expect((await box(page, 'layout .area-start')).w).toBe(0);
  await press(page, 'ask', '.float');
  expect(await box(page, 'ask .root')).toEqual(inset(inStart));
  await press(page, 'ask', '.dock-overlay');
  expect((await box(page, 'layout .area-start')).w).toBe(0);
  await press(page, 'ask', '.dock-fixed');
  expect(await box(page, 'ask .root')).toEqual(inset(inStart));
  expect(await page.evaluate(() => document.getElementById('ask')!.getAttribute('data-fixed'))).toBe('start');
});

test('a pressed floating panel comes to the FRONT, by the pointer or a focus; docking takes it out of the order', async ({ page }) => {
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = `
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px">
        <sherpa-overlay-panel id="nodes" slot="panel" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none" data-floatable data-floating data-x="40" data-y="40" data-width="320" data-height="400"><p>The list</p></sherpa-overlay-panel>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="a" data-heading="A" data-floatable data-floating data-x="200" data-y="100" data-width="400" data-height="300"><p>A</p></sherpa-overlay-panel>
      <sherpa-overlay-panel id="b" data-heading="B" data-floatable data-floating data-x="300" data-y="200" data-width="400" data-height="300"><p>B</p></sherpa-overlay-panel>`;
    await window.__settled();
    for (const id of ['a', 'b']) (document.getElementById(id) as HTMLElement & { show(): void }).show();
  });
  await settle(page);
  const cv = await box(page, 'cv');
  expect(await box(page, 'nodes .root')).toMatchObject({ x: cv.x + 40, y: cv.y + 40 });
  /** Which panel is drawn at a point: the topmost. */
  const top = (x: number, y: number) => page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.closest('[id]')?.id, [x, y]);
  // B opened last: in front where they overlap.
  expect(await top(350, 250)).toBe('b');
  // A press on A's body, where it is uncovered, brings it to the front.
  await page.mouse.click(250, 150);
  await settle(page);
  expect(await top(350, 250)).toBe('a');
  // The Nodes card, floating in its canvas, shares their order: pressed on its header, it is in front of A.
  await page.mouse.click(cv.x + 60, cv.y + 56);
  await settle(page);
  expect(await top(cv.x + 300, Math.max(cv.y + 200, 200))).toBe('nodes');
  // A FOCUS brings one forward too: the keys reach it.
  await page.evaluate(() => (document.getElementById('b')!.shadowRoot!.querySelector('.grip') as HTMLElement).focus());
  await settle(page);
  expect(await top(350, 250)).toBe('b');
  // By pixels: B's surface where it overlaps A.
  const [overlap] = await pixels(page, 650, 350);
  const [own] = await pixels(page, 680, 480);
  expect(far(overlap!, own!)).toBeLessThanOrEqual(4);
  // Docked, A leaves the order: B stays in front, and A goes back to the right edge, under it.
  await page.evaluate(() => document.getElementById('a')!.removeAttribute('data-floating'));
  await settle(page);
  const order = await page.evaluate(() => ['nodes', 'a', 'b'].map((id) => {
    const el = document.getElementById(id)!.shadowRoot!.querySelector('.root')!;
    return getComputedStyle(el).zIndex;
  }));
  expect(order[1]).toBe('101');
  expect(Number(order[2])).toBeGreaterThan(Number(order[0]));
  // Floated again, it comes to the front.
  await page.evaluate(() => document.getElementById('a')!.setAttribute('data-floating', ''));
  await settle(page);
  expect(await top(350, 250)).toBe('a');
});

test('the canvas: its card docks flush with no shadow, its edge resizes it and the canvas reports it; the plane holds still', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.style.cssText = 'position: absolute; left: 160px; top: 120px';
    root.innerHTML = `
      <sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 600px">
        <div id="thing" style="--x: 520px; --y: 60px; inline-size: 120px; block-size: 80px; background: #c046ff">A</div>
        <sherpa-overlay-panel id="nodes" slot="panel" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none" data-floatable><p>The list</p></sherpa-overlay-panel>
      </sherpa-layout-canvas>`;
    await window.__settled();
    const heard: unknown[] = [];
    (window as unknown as { __heard: unknown[] }).__heard = heard;
    document.addEventListener('panel-area-resize', (e) => heard.push([(e.target as Element).id, (e as CustomEvent).detail]));
  });
  await settle(page);
  const cv = await box(page, 'cv');
  const card = () => box(page, 'nodes .root');
  expect(await card()).toEqual({ x: cv.x + 16, y: cv.y + 16, w: 288 - 32, h: cv.h - 32 });
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('nodes')!.shadowRoot!.querySelector('.root')!).boxShadow)).toBe('none');
  // By pixels, on a row between the grid's crosses: past the area, the canvas, no shadow.
  const y = await page.evaluate(([top]) => {
    const view = (document.getElementById('cv') as HTMLElement & { view: { y: number } }).view;
    return top! + 300 + 12 - (((300 - view.y) % 24) + 24) % 24;
  }, [cv.y]);
  const row = await pixels(page, cv.x + 288, y, 24);
  const canvasInk = (await pixels(page, cv.x + 700, y))[0]!;
  for (const p of row) expect(far(p, canvasInk)).toBeLessThanOrEqual(2);
  // What the view shows is beside the card: the stage.
  const stage = await box(page, 'cv .stage');
  expect(stage).toEqual({ x: cv.x + 288, y: cv.y, w: cv.w - 288, h: cv.h });
  // Focused, the view's ring is drawn on the stage, so its start shows beside the card.
  await page.evaluate(() => (document.getElementById('cv')!.shadowRoot!.querySelector('.viewport') as HTMLElement).focus());
  const ring = (await pixels(page, stage.x + 2, stage.y + 300))[0]!;
  expect(far(ring, canvasInk), `the ring beside the card: ${JSON.stringify(ring)}`).toBeGreaterThan(60);
  await page.evaluate(() => (document.getElementById('cv')!.shadowRoot!.activeElement as HTMLElement | null)?.blur());

  // Its edge, dragged: wider, and the CANVAS reports it; the plane does not move.
  const thing = await box(page, 'thing');
  const edge = await page.evaluate(() => {
    const r = document.getElementById('cv')!.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!.querySelector('.edge-start')!.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + 300];
  });
  await drag(page, edge as [number, number], [40, 0]);
  expect((await card()).w).toBe(328 - 32);
  expect(await box(page, 'thing')).toEqual(thing);
  expect(await page.evaluate(() => (window as unknown as { __heard: unknown[] }).__heard)).toEqual([['cv', { side: 'start', width: 328 }]]);
  // The host hands it back.
  await page.evaluate(() => document.getElementById('cv')!.setAttribute('data-panel-width', '300'));
  await settle(page);
  expect((await card()).w).toBe(268);
  // Floating, the card gives the width back; the plane holds still.
  await press(page, 'nodes', '.float');
  expect(await box(page, 'cv .stage')).toEqual(cv);
  expect(await box(page, 'thing')).toEqual(thing);
});

test('forced colours: the divider and the edge\'s line are system colours', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'forced colours are emulated in Chromium only');
  await page.emulateMedia({ forcedColors: 'active' });
  await shell(page);
  const r = await page.evaluate(() => {
    const lr = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!;
    const system = (name: string): string => {
      const probe = document.createElement('span');
      probe.style.color = name;
      document.body.append(probe);
      const ink = getComputedStyle(probe).color;
      probe.remove();
      return ink;
    };
    const edge = lr.querySelector<HTMLElement>('.edge-start')!;
    edge.focus();
    return {
      divider: getComputedStyle(lr.querySelector('.area-start')!, '::after').borderInlineStartColor,
      line: getComputedStyle(edge, '::before').borderInlineStartColor,
      ink: system('CanvasText'), highlight: system('Highlight'),
    };
  });
  expect(r.divider).toBe(r.ink);
  expect(r.line).toBe(r.highlight);
});
