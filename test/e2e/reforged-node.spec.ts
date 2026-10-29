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
  expect(r).toEqual({ place: [40, 40, 400], heading: ['Start', 'play'], body: ['block', 'none'], header: 'button' });
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
    const plain = getComputedStyle(a).backgroundColor;
    const current = { attr: a.hasAttribute('data-current'), aria: header.getAttribute('aria-current') };
    a.toggleAttribute('data-current', true);
    return {
      at: [a.dataset['x'], a.dataset['y']], panned: JSON.stringify(el.view) !== JSON.stringify(view),
      selects, current, aria: header.getAttribute('aria-current'), tinted: getComputedStyle(a).backgroundColor !== plain,
    };
  }, canvas);
  expect(r).toEqual({
    at: ['48', '72'], panned: false, selects: 2,
    current: { attr: false, aria: null }, aria: 'true', tinted: true,
  });
});
