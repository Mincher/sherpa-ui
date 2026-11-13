import { test, expect, type Page } from './harness';

/**
 * sherpa-node — Will, TODO 78: a node on the canvas. A drag on its header moves
 * it, at any zoom; it MOVES ITSELF and reports each move, unless the host owns
 * the place. A press only asks to select it: the host writes data-current.
 * TRAP T-a-node-moves-itself-and-reports
 */
type Canvas = HTMLElement & { rendered: Promise<void>; view: { x: number; y: number; zoom: number }; zoomTo(zoom: number): void };
type Node = HTMLElement & { rendered: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 800px; block-size: 500px';
    el.innerHTML = '<sherpa-node id="a" data-heading="Start" data-icon="play" data-x="40" data-y="40">Body</sherpa-node>'
      + '<sherpa-node id="b" data-heading="End" data-x="400" data-y="40"></sherpa-node>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await Promise.all([...el.querySelectorAll<Node>('sherpa-node')].map((n) => n.rendered));
    await window.__settled();
  });
});

const canvas = 'document.querySelector("#root sherpa-layout-canvas")';

/** Drag a node's header by (dx, dy) screen px, and what it reported. */
const DRAG = `(node, dx, dy) => {
  const header = node.shadowRoot.querySelector('.header');
  const r = header.getBoundingClientRect();
  const at = (type, x, y) => header.dispatchEvent(new PointerEvent(type,
    { pointerId: 9, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, composed: true }));
  const heard = [];
  node.addEventListener('node-move', (e) => heard.push(e.detail));
  at('pointerdown', r.left + 10, r.top + 10);
  at('pointermove', r.left + 10 + dx / 2, r.top + 10 + dy / 2);
  at('pointermove', r.left + 10 + dx, r.top + 10 + dy);
  at('pointerup', r.left + 10 + dx, r.top + 10 + dy);
  return heard;
}`;

test('it sits where data-x and data-y say, with its name, icon and body', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const el = eval(sel) as Canvas;
    const [a, b] = [...el.querySelectorAll<Node>('sherpa-node')];
    const heading = a!.shadowRoot!.querySelector('.heading')!;
    // Where it is SEEN on the plane: drawn into a canvas, a node lays out in flow, so its offset reads 0.
    const plane = el.shadowRoot!.querySelector('.plane')!.getBoundingClientRect();
    const [ra, rb] = [a!.getBoundingClientRect(), b!.getBoundingClientRect()];
    return {
      place: [ra.left - plane.left, ra.top - plane.top, rb.left - plane.left].map(Math.round),
      heading: [heading.getAttribute('data-heading'), heading.getAttribute('data-icon')],
      body: [a, b].map((n) => getComputedStyle(n!.shadowRoot!.querySelector('.body')!).display),
      header: a!.shadowRoot!.querySelector('.header')!.getAttribute('role'),
    };
  }, canvas);
  expect(r).toEqual({ place: [40, 40, 400], heading: ['Start', 'play'], body: ['flex', 'none'], header: 'button' });
});

test('a drag on the header moves it in plane px at any zoom, reports each move, and pans nothing', async ({ page }) => {
  const r = await page.evaluate(async ([sel, drag]) => {
    const el = eval(sel!) as Canvas;
    el.zoomTo(2);
    // A node's scale is the one it is DRAWN at; a canvas draws the new zoom at its next paint.
    await window.__settled();
    const view = { ...el.view };
    const a = el.querySelector<Node>('#a')!;
    const heard = eval(drag!)(a, 40, 20);
    return {
      at: [a.dataset['x'], a.dataset['y']], css: a.style.getPropertyValue('--x'),
      heard, panned: JSON.stringify(el.view) !== JSON.stringify(view), dragging: a.matches(':state(dragging)'),
    };
  }, [canvas, DRAG]);
  expect(r).toEqual({
    at: ['60', '50'], css: '60px',
    heard: [{ x: 50, y: 45 }, { x: 60, y: 50 }], panned: false, dragging: false,
  });
});

test('locked, a drag reports and moves nothing: the host owns the place', async ({ page }) => {
  const r = await page.evaluate(([sel, drag]) => {
    const el = eval(sel!) as Canvas;
    const a = el.querySelector<Node>('#a')!;
    a.toggleAttribute('data-locked', true);
    const heard = eval(drag!)(a, 30, 10);
    return { at: [a.dataset['x'], a.dataset['y']], last: heard.at(-1) };
  }, [canvas, DRAG]);
  expect(r).toEqual({ at: ['40', '40'], last: { x: 70, y: 50 } });
});

test('the arrows move it; Enter and a click ask to select it; the host\'s data-current pins it active', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const el = eval(sel) as Canvas;
    const a = el.querySelector<Node>('#a')!;
    const header = a.shadowRoot!.querySelector<HTMLElement>('.header')!;
    const key = (k: string, shiftKey = false) => header.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, composed: true, cancelable: true }));
    const view = { ...el.view };
    key('ArrowRight');
    key('ArrowDown', true);
    let selects = 0;
    a.addEventListener('node-select', () => { selects += 1; });
    key('Enter');
    a.click();
    // The card is its `.root`: a state pin never reaches the host.
    const card = a.shadowRoot!.querySelector('.root')!;
    const plain = getComputedStyle(card).backgroundColor;
    const current = { attr: a.hasAttribute('data-current'), aria: header.getAttribute('aria-current') };
    a.toggleAttribute('data-current', true);
    return {
      at: [a.dataset['x'], a.dataset['y']], panned: JSON.stringify(el.view) !== JSON.stringify(view),
      selects, current, aria: header.getAttribute('aria-current'), tinted: getComputedStyle(card).backgroundColor !== plain,
    };
  }, canvas);
  expect(r).toEqual({
    at: ['48', '72'], panned: false, selects: 2,
    current: { attr: false, aria: null }, aria: 'true', tinted: true,
  });
});

test('a drag is no press: the click it ends with selects nothing, and the next click does', async ({ page }) => {
  const r = await page.evaluate(([sel, drag]) => {
    const el = eval(sel!) as Canvas;
    const a = el.querySelector<Node>('#a')!;
    let selects = 0;
    a.addEventListener('node-select', () => { selects += 1; });
    eval(drag!)(a, 30, 10);
    a.click();
    const afterDrag = selects;
    a.click();
    return { afterDrag, after: selects };
  }, [canvas, DRAG]);
  expect(r).toEqual({ afterDrag: 0, after: 1 });
});

test('the header and each row draw their sockets on the card\'s edges', async ({ page }) => {
  const r = await page.evaluate(async (sel) => {
    const el = eval(sel) as Canvas;
    el.insertAdjacentHTML('beforeend', '<sherpa-node id="c" data-heading="Filter" data-x="40" data-y="240" data-input-socket="object" data-output-socket="value">'
      + '<sherpa-node-row id="key"><sherpa-input-text data-label="Key" name="key"></sherpa-input-text></sherpa-node-row>'
      + '<sherpa-node-row id="value" data-input-socket="value"><sherpa-input-text data-label="Value" name="value"></sherpa-input-text></sherpa-node-row>'
      + '<sherpa-node-row id="matches" data-label="Matches" data-output-socket="object"></sherpa-node-row></sherpa-node>');
    const c = el.querySelector<Node & { socketRect(side: string): DOMRect | null }>('#c')!;
    await c.rendered;
    const rows = ['key', 'value', 'matches'].map((id) => el.querySelector<Node & { socketRect(side: string): DOMRect | null }>(`#${id}`)!);
    await Promise.all(rows.map((row) => row.rendered));
    await window.__settled();
    const box = c.getBoundingClientRect();
    const mid = (rect: DOMRect | null) => rect && [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
    const control = (row: Element) => {
      const r = row.querySelector('sherpa-input-text')!.shadowRoot!.querySelector('.control-row, .control')!.getBoundingClientRect();
      return Math.round(r.top + r.height / 2);
    };
    const header = mid(c.socketRect('input'))!;
    const value = mid(rows[1]!.socketRect('input'))!;
    const matches = mid(rows[2]!.socketRect('output'))!;
    return {
      none: [rows[0]!.socketRect('input'), rows[0]!.socketRect('output'), rows[1]!.socketRect('output')],
      // Each socket stands in its tab outside the card, its middle 11px past the edge: the header's, a row's input and a row's
      // output alike (the node's three columns, TODO 887; the tabs 24px wide).
      onEdges: [header[0]! - box.left + 11, value[0]! - box.left + 11, matches[0]! - box.right - 11].map((d) => Math.abs(d) <= 1),
      headerFirst: header[1]! < value[1]!,
      onControl: Math.abs(value[1]! - control(rows[1]!)) <= 1,
    };
  }, canvas);
  expect(r).toEqual({
    none: [null, null, null], onEdges: [true, true, true], headerFirst: true, onControl: true,
  });
});

test('a node being dragged is lifted — a shadow, a stronger edge, over the others — and lands plain', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const el = eval(sel) as Canvas;
    const a = el.querySelector<Node>('#a')!;
    const header = a.shadowRoot!.querySelector<HTMLElement>('.header')!;
    const at = (type: string, x: number, y: number) => header.dispatchEvent(new PointerEvent(type,
      { pointerId: 4, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, composed: true }));
    // The ring outside its border, and the lift, on the card; the host rises.
    const card = a.shadowRoot!.querySelector('.root')!;
    const look = () => { const s = getComputedStyle(card); return [s.boxShadow.includes('0px 0px 0px 1px'), s.boxShadow.includes('8px 8px 16px -4px'), getComputedStyle(a).zIndex]; };
    const before = getComputedStyle(card).boxShadow;
    at('pointerdown', 100, 100);
    at('pointermove', 140, 120);
    const during = look();
    at('pointerup', 140, 120);
    return { before, during, after: getComputedStyle(card).boxShadow };
  }, canvas);
  expect(r).toEqual({ before: 'none', during: [true, true, '1'], after: 'none' });
});

/* ── Sockets drawn by type: PIXELS, never computed style. Will, TODO 713 M2
   TRAP T-a-socket-is-drawn-by-its-type ── */
type Sock = HTMLElement & { rendered: Promise<void>; socketRect(side: string): DOMRect | null };
type Rgb = [number, number, number];

/** The pixels at points (fractions of a box) in a screenshot of it: the colour a reader sees. */
async function paint(page: Page, rect: { x: number; y: number; w: number; h: number }, at: [number, number][]): Promise<Rgb[]> {
  const shot = await page.screenshot({ clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });
  return page.evaluate(async ([b64, pts]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    const [w, h] = [img.width, img.height];
    return (pts as [number, number][]).map(([fx, fy]) => [...c.getImageData(Math.min(w - 1, Math.floor(fx * w)), Math.min(h - 1, Math.floor(fy * h)), 1, 1).data].slice(0, 3) as Rgb);
  }, [shot.toString('base64'), at] as const);
}

/** A colour a token resolves to, as the page paints it. */
const inkOf = (page: Page, token: string): Promise<Rgb> => page.evaluate((t) => {
  const el = Object.assign(document.createElement('div'), { style: `background: var(${t}); inline-size: 1px; block-size: 1px` });
  document.body.append(el);
  const [r, g, b] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);
  el.remove();
  return [r, g, b] as Rgb;
}, token);

const near = (a: Rgb, b: Rgb, within = 40): boolean => Math.max(...a.map((v, i) => Math.abs(v - b[i]!))) <= within;

/** Where, as fractions of the box, each shape is or is not ink: the centre, the four corners, the top middle, and (.2, .2). */
const PROBES: [number, number][] = [[.5, .5], [.1, .1], [.9, .1], [.1, .9], [.9, .9], [.5, .08], [.2, .2]];
const SHAPES: Record<string, number[]> = {
  value: [1, 0, 0, 0, 0, 1, 1],
  object: [1, 0, 0, 0, 0, 1, 0],
  boolean: [1, 0, 0, 0, 0, 1, 1],
  any: [1, 1, 1, 1, 1, 1, 1],
  // An INPUT is round, whatever its type (TODOs 740, 807); the dock behind it is grey, not ink.
  input: [1, 0, 0, 0, 0, 1, 1],
};

/** A node of one input socket, big, connected or not, on the canvas at a place of its own. */
async function socketNode(page: Page, id: string, attrs: string): Promise<{ x: number; y: number; w: number; h: number }> {
  return page.evaluate(async ([nodeId, a]) => {
    const el = document.querySelector('#root sherpa-layout-canvas')!;
    el.querySelector(`#${nodeId}`)?.remove();
    el.insertAdjacentHTML('beforeend', `<sherpa-node id="${nodeId}" data-heading="N" data-x="200" data-y="200" style="--_socket: 40px" ${a}></sherpa-node>`);
    const n = el.querySelector<Sock>(`#${nodeId}`)!;
    await n.rendered;
    await window.__settled();
    return n.getBoundingClientRect().toJSON();
  }, [id, attrs]).then(async (box) => {
    const r = await page.evaluate((nodeId) => {
      const n = document.querySelector<Sock>(`#${nodeId}`)!;
      n.scrollIntoView({ block: 'center' });
      return { in: n.socketRect('input')?.toJSON() ?? null, out: n.socketRect('output')?.toJSON() ?? null };
    }, id);
    return { ...box, ...r } as never;
  });
}

const boxOf = (r: { x: number; y: number; width: number; height: number }) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });

/** A socket's rect on the screen NOW, after any scroll. */
const rectOf = (page: Page, id: string, side: string) => page.evaluate(([nodeId, s]) => {
  document.querySelector(`#${nodeId}`)!.scrollIntoView({ block: 'center' });
  return document.querySelector<Sock>(`#${nodeId}`)!.socketRect(s!)?.toJSON() ?? null;
}, [id, side] as const);

for (const type of ['value', 'object', 'boolean', 'any']) {
  test(`an input socket of type ${type} draws its shape, filled when connected and hollow when not`, async ({ page }) => {
    const ink = type === 'any' ? await inkOf(page, '--sherpa-style-default-content-secondary')
      : await inkOf(page, `--sherpa-socket-ink-${type}`);
    await socketNode(page, 'sock', `data-input-socket="${type}" data-input-connected`);
    const filled = boxOf((await rectOf(page, 'sock', 'input'))!);
    const mask = (await paint(page, filled, PROBES)).map((p) => (near(p, ink) ? 1 : 0));
    expect(mask, `${type} filled: a D`).toEqual(SHAPES['input']);

    await socketNode(page, 'sock', `data-input-socket="${type}"`);
    const hollow = boxOf((await rectOf(page, 'sock', 'input'))!);
    const [centre] = await paint(page, hollow, [[.5, .5]]);
    expect(near(centre!, ink), `${type} hollow centre is the face, not the ink`).toBe(false);
    // The ring is still there: a point on the edge of the shape.
    const edge = await paint(page, hollow, [[.03, .5]]);
    expect(near(edge[0]!, ink), `${type} ring`).toBe(true);
  });
}

test('an output socket takes its own type\'s ink, whatever its node is', async ({ page }) => {
  const seen: Record<string, boolean> = {};
  for (const type of ['value', 'object', 'boolean'] as const) {
    const ink = await inkOf(page, `--sherpa-socket-ink-${type}`);
    // A picked node does not change a socket's own type.
    await socketNode(page, 'sock', `data-output-socket="${type}" data-output-connected data-current`);
    const [centre] = await paint(page, boxOf((await rectOf(page, 'sock', 'output'))!), [[.5, .5]]);
    seen[type] = near(centre!, ink);
  }
  expect(seen).toEqual({ value: true, object: true, boolean: true });
});

test('no node has a footer or a False, data-branches or not; a boolean output is one circle on the header, in its ink (plan 944)', async ({ page }) => {
  const boolean = await inkOf(page, '--sherpa-socket-ink-boolean');
  // The old fork's attributes say nothing now: no footer, no False socket, no False tip.
  await socketNode(page, 'fork', 'data-branches data-output-socket="boolean" data-output-connected data-false-connected');
  expect(await page.evaluate(() => document.querySelector('#fork')!.shadowRoot!.querySelector('.footer, .socket-false, .tip-false'))).toBeNull();
  const circle = await paint(page, boxOf((await rectOf(page, 'fork', 'output'))!), PROBES);
  expect(circle.map((p) => (near(p, boolean) ? 1 : 0))).toEqual(SHAPES['boolean']);
});

test('a socket\'s tip says its type in words, on its socket\'s side: an input\'s to the left, an output\'s to the right', async ({ page }) => {
  await socketNode(page, 'tip', 'data-input-socket="any" data-output-socket="boolean"');
  const words: string[] = [];
  const sides: string[] = [];
  for (const side of ['input', 'output']) {
    const r = (await rectOf(page, 'tip', side))!;
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    const text = await page.waitForFunction((cls) => {
      const tip = document.querySelector('#tip')!.shadowRoot!.querySelector<HTMLElement>(cls);
      return tip?.matches(':popover-open') ? tip.innerText.replace(/\s+/g, ' ').trim() : false;
    }, side === 'input' ? '.tip-in' : '.tip-out');
    words.push(await text.jsonValue() as string);
    // Where the tip stands against its socket (TODO 895): wholly left of it, or wholly right.
    sides.push(await page.evaluate(([cls, at]) => {
      const t = document.querySelector('#tip')!.shadowRoot!.querySelector<HTMLElement>(cls)!.getBoundingClientRect();
      return t.right <= at.x + 1 ? 'left' : t.left >= at.x + at.width - 1 ? 'right' : `over ${Math.round(t.left)}–${Math.round(t.right)}`;
    }, [side === 'input' ? '.tip-in' : '.tip-out', { x: r.x, width: r.width }] as const));
    await page.mouse.move(-1, -1);
  }
  // A boolean output is an Output, not a True: no node has a True or a False socket (plan 944).
  expect(words).toEqual(['Input: any type', 'Output: a boolean']);
  expect(sides).toEqual(['left', 'right']);
});

test('a connection takes the ink of its FROM socket\'s type', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const canvas = document.querySelector('#root sherpa-layout-canvas')!;
    canvas.insertAdjacentHTML('beforeend', '<sherpa-node id="r" data-heading="R" data-x="0" data-y="0"></sherpa-node>'
      + '<svg class="graph-connectors" style="stroke: rgb(1, 2, 3)">'
      + ['value', 'object', 'boolean', 'false', ''].map((t) => `<path data-type="${t}" d="M0 0L1 1"/>`).join('') + '</svg>');
    await (canvas.querySelector('#r') as Sock).rendered;
    return [...canvas.querySelectorAll('svg.graph-connectors path')].map((p) => getComputedStyle(p).stroke);
  });
  const inks = await Promise.all(['value', 'object', 'boolean'].map((t) => inkOf(page, `--sherpa-socket-ink-${t}`)));
  expect(r.slice(0, 3).map((c) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number))).toEqual(inks);
  // A 'false' line has no ink of its own now (plan 944): it is drawn as a line of no type.
  expect(r.slice(3)).toEqual(['rgb(1, 2, 3)', 'rgb(1, 2, 3)']);
});

test('in forced colours the shapes stay and the colours go', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit cannot emulate forced colours');
  await page.emulateMedia({ forcedColors: 'active' });
  await socketNode(page, 'fc', 'data-output-socket="object" data-output-connected');
  const box = boxOf((await rectOf(page, 'fc', 'output'))!);
  const around = await paint(page, { x: box.x - 30, y: box.y, w: 20, h: 20 }, [[.5, .5]]);
  const mask = (await paint(page, box, PROBES)).map((p) => (near(p, around[0]!, 60) ? 0 : 1));
  // The probes on the box's end side lie by its socket tab's round end, whose line (CanvasText here) may cross a corner:
  // the middle and the start side tell a diamond from a circle. TODO 887
  const inner = [0, 1, 3, 5, 6];
  expect(inner.map((i) => mask[i])).toEqual(inner.map((i) => SHAPES['object']![i]));
});
