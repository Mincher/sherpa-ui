import { test, expect } from './harness';

/**
 * A graph, as it opens, frames all its nodes, centred in the view (Will, TODO 932): also one bound after another on the
 * same canvas, whose view the last one left. A host that sets the view itself keeps it.
 */
test('a second graph bound on the same canvas opens framed, not where the first left the view', async ({ page }) => {
  const r = await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px"></sherpa-layout-canvas>');
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void>; view: { x: number; y: number; zoom: number }; zoomTo(z: number): void; panTo(x: number, y: number): void; fit(): void };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js' as string);
    const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const first = bindWorkflow(canvas, { v: 3, id: 'a', nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }], connections: [] }, { session: new SessionStore(), stores: ['users'] });
    await window.__settled();
    await frame();
    // The reader zooms in and pans away.
    canvas.zoomTo(2);
    canvas.panTo(-900, -700);
    first.stop();
    // Another graph, wide, on the same canvas.
    bindWorkflow(canvas, { v: 3, id: 'b', nodes: [
      { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'v', kind: 'value', x: 1600, y: 0 }, { id: 'o', kind: 'result', x: 3200, y: 400 },
    ], connections: [] }, { session: new SessionStore(), stores: ['users'] });
    await window.__settled();
    await frame();
    await frame();
    const opened = { ...canvas.view };
    canvas.fit();
    await frame();
    return { opened, fit: { ...canvas.view } };
  });
  expect(r.opened.zoom).toBeLessThan(1);
  expect(Math.abs(r.opened.zoom - r.fit.zoom)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(r.opened.x - r.fit.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(r.opened.y - r.fit.y)).toBeLessThanOrEqual(4);
});
