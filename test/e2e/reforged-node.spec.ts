import { test, expect } from './harness';

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
    return {
      place: [a!.offsetLeft, a!.offsetTop, b!.offsetLeft],
      heading: [heading.getAttribute('data-heading'), heading.getAttribute('data-icon')],
      body: [a, b].map((n) => getComputedStyle(n!.shadowRoot!.querySelector('.body')!).display),
      header: a!.shadowRoot!.querySelector('.header')!.getAttribute('role'),
    };
  }, canvas);
  expect(r).toEqual({ place: [40, 40, 400], heading: ['Start', 'play'], body: ['flex', 'none'], header: 'button' });
});

test('a drag on the header moves it in plane px at any zoom, reports each move, and pans nothing', async ({ page }) => {
  const r = await page.evaluate(([sel, drag]) => {
    const el = eval(sel!) as Canvas;
    el.zoomTo(2);
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

test('the header and each row draw their sockets on the card\'s edges, a value a circle and an object a diamond', async ({ page }) => {
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
    const shape = (host: Element, cls: string) => {
      const s = getComputedStyle(host.shadowRoot!.querySelector(cls)!);
      return s.rotate === '45deg' ? 'diamond' : s.borderRadius === '50%' ? 'circle' : s.borderRadius;
    };
    const control = (row: Element) => {
      const r = row.querySelector('sherpa-input-text')!.shadowRoot!.querySelector('.control-row, .control')!.getBoundingClientRect();
      return Math.round(r.top + r.height / 2);
    };
    const header = mid(c.socketRect('input'))!;
    const value = mid(rows[1]!.socketRect('input'))!;
    const matches = mid(rows[2]!.socketRect('output'))!;
    return {
      none: [rows[0]!.socketRect('input'), rows[0]!.socketRect('output'), rows[1]!.socketRect('output')],
      // Within the card's hairline border and a rounding.
      onEdges: [header[0]! - box.left, value[0]! - box.left, matches[0]! - box.right].map((d) => Math.abs(d) <= 1),
      headerFirst: header[1]! < value[1]!,
      onControl: Math.abs(value[1]! - control(rows[1]!)) <= 1,
      shapes: [shape(c, '.socket-in'), shape(c, '.socket-out'), shape(rows[1]!, '.socket-in'), shape(rows[2]!, '.socket-out')],
    };
  }, canvas);
  expect(r).toEqual({
    none: [null, null, null], onEdges: [true, true, true], headerFirst: true, onControl: true,
    shapes: ['diamond', 'circle', 'circle', 'diamond'],
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
