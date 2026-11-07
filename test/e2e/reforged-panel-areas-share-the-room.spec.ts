import { test, expect } from './harness';

/**
 * The two panel areas SHARE the room, and the content keeps its least width: a panel in each area, however wide it
 * is asked to be, never starves it. The same cases run on the layout itself and on a canvas, which composes it.
 * TRAP T-a-panel-area-is-a-layout
 */
const CONTENT_MIN = 384;

for (const width of [1280, 1700]) {
  for (const host of ['layout', 'canvas'] as const) {
    test(`${host} at ${width}: a start and an end panel, both asked wide, leave the content its least`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const r = await page.evaluate(async ({ host, width }) => {
        const panel = (slot: string, id: string) => `<sherpa-overlay-panel id="${id}" slot="${slot}" open data-heading="${id}" data-padding="none"><p>${id}</p></sherpa-overlay-panel>`;
        const root = document.getElementById('root')!;
        root.innerHTML = host === 'layout'
          ? `<sherpa-layout-panels id="host" style="inline-size: ${width}px; block-size: 600px" data-panel-start-width="700" data-panel-end-width="700">${panel('panel-start', 's')}${panel('panel-end', 'e')}<div id="content">content</div></sherpa-layout-panels>`
          : `<sherpa-layout-canvas id="host" style="inline-size: ${width}px; block-size: 600px" data-panel-start-width="700">${panel('panel', 's')}</sherpa-layout-canvas>`;
        await window.__settled();
        const layout = (host === 'layout' ? document.getElementById('host')! : document.getElementById('host')!.shadowRoot!.querySelector('sherpa-layout-panels')!) as HTMLElement;
        const box = (sel: string) => Math.round(layout.shadowRoot!.querySelector(sel)!.getBoundingClientRect().width);
        return { start: box('.area-start'), end: layout.shadowRoot!.querySelector('.area-end')!.getBoundingClientRect().width > 0 ? box('.area-end') : 0, content: box('.content'), row: Math.round(layout.getBoundingClientRect().width) };
      }, { host, width });
      expect(r.content).toBeGreaterThanOrEqual(CONTENT_MIN);
      // Together they never pass the row less the content's least.
      expect(r.start + r.end + r.content).toBeLessThanOrEqual(r.row + 1);
    });
  }
}
