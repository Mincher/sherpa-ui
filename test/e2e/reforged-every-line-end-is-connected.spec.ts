import { test, expect } from './harness';

/**
 * A CONNECTED SOCKET FILLS, by one rule for every socket type (Will, TODO 1016: "Socket filling should be a generic
 * implementation for all socket types."): each line drawn, kept or the Start's, marks its two ends connected, and a
 * connected socket's core shows. The ends are found where the line is drawn, not by its addresses.
 */
test('every drawn line\'s two ends are marked connected and filled, whatever their type (1016)', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = `<sherpa-layout-canvas id="cv" style="inline-size: 1200px; block-size: 640px"></sherpa-layout-canvas>`;
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void>; zoomTo(z: number): void; panTo(x: number, y: number): void };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const at = (id: string, kind: string, x: number, y: number, values?: Record<string, unknown>) => ({ id, kind, x, y, heading: id, ...(values ? { values } : {}) });
    bindWorkflow(canvas as never, { v: 3, id: 'ends', byHand: true, nodes: [
      at('t', 'trigger', 0, 360, { type: 'schedule' }), at('s', 'source', 0, 0, { store: 'users' }), at('f', 'field', 330, 0, { field: 'status' }),
      at('v', 'value', 330, 300, { type: 'text', value: 'active' }), at('c', 'condition', 660, 0, { type: 'eq' }), at('o', 'result', 990, 0),
    ], connections: [{ from: 't', to: '#start' }, { from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'v/value', to: 'c/b' }, { from: 'c/pass', to: 'o' }] } as never,
    { session: new SessionStore(), stores: ['users'], fieldsOf: { users: { status: { label: 'Status' } } } });
    await window.__settled();
    canvas.zoomTo(0.7);
    canvas.panTo(40, 40);
    await window.__settled();
  });
  const ends = await page.evaluate(() => {
    const cv = document.getElementById('cv')!;
    type Holder = HTMLElement & { socketRect?(side: 'input' | 'output'): DOMRect | null };
    const holders = [...cv.querySelectorAll<Holder>(':scope > sherpa-node, :scope > sherpa-node sherpa-node-row')];
    const screen = (path: SVGPathElement, at: number) => {
      const p = path.getPointAtLength(at);
      return new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM()!);
    };
    /** The socket of this side whose middle the line's end stands on, and whether it is marked connected and filled. */
    const at = (side: 'input' | 'output', pt: DOMPoint) => {
      for (const el of holders) {
        const r = el.socketRect?.(side);
        if (!r || !r.width || Math.hypot(r.left + r.width / 2 - pt.x, r.top + r.height / 2 - pt.y) > 2) continue;
        const core = el.shadowRoot!.querySelector(`${el.localName === 'sherpa-node' ? '.header ' : ''}.socket-${side === 'input' ? 'in' : 'out'} .core`)!;
        const type = el.getAttribute(`data-${side}-socket`);
        return `${type}:${el.hasAttribute(`data-${side}-connected`) ? 'marked' : 'NOT MARKED'}:${getComputedStyle(core).display === 'none' ? 'NOT FILLED' : 'filled'}`;
      }
      return 'no socket';
    };
    return [...cv.querySelectorAll<SVGPathElement>('svg.graph-connectors path[data-from], svg.graph-connectors path[data-start]')].map((path) => {
      const name = path.dataset['start'] ? `#start>${path.dataset['start']}` : `${path.dataset['from']}>${path.dataset['to']}`;
      return `${name} ${at('output', screen(path, 0))} ${at('input', screen(path, path.getTotalLength()))}`;
    });
  });
  // Every line is found, of every kind of socket: rows, a value, a boolean header, the Start's own line.
  expect(ends.length).toBe(6);
  expect(new Set(ends.flatMap((e) => e.split(' ').slice(1).map((end) => end.split(':')[0]))).size).toBeGreaterThan(2);
  for (const end of ends) expect(end, end).not.toMatch(/NOT|no socket/);
});
