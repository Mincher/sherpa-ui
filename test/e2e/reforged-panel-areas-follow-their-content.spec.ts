import { test, expect } from './harness';

/**
 * A panel area has no width of its own: it is as wide as its widest open panel plus the 16px inset each side, nothing when it
 * is empty, shut or every panel is a tab; a reader's drag still asks for another. The same cases on the layout and a canvas.
 * TRAP T-a-panel-area-is-a-layout
 */
type Panel = HTMLElement & { rendered?: Promise<void>; minimise(on: boolean): void };

for (const host of ['layout', 'canvas'] as const) {
  test(`${host}: the area follows its panel's width, the widest of two, and gives it back as a tab`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const r = await page.evaluate(async (host) => {
      const slot = host === 'layout' ? 'panel-start' : 'panel';
      const panel = (id: string, width: string) => `<sherpa-overlay-panel id="${id}" slot="${slot}" open data-heading="${id}" data-minimisable style="--_width: ${width}"><p>${id}</p></sherpa-overlay-panel>`;
      const root = document.getElementById('root')!;
      root.innerHTML = host === 'layout'
        ? `<sherpa-layout-panels id="h" style="inline-size: 1500px; block-size: 600px">${panel('a', '20rem')}<div>content</div></sherpa-layout-panels>`
        : `<sherpa-layout-canvas id="h" style="inline-size: 1500px; block-size: 600px">${panel('a', '20rem')}</sherpa-layout-canvas>`;
      await window.__settled();
      const layout = (host === 'layout' ? document.getElementById('h')! : document.getElementById('h')!.shadowRoot!.querySelector('sherpa-layout-panels')!) as HTMLElement;
      const area = () => {
        const row = layout.getBoundingClientRect().width;
        // Every panel a tab: the area covers the layout and the content keeps it all.
        return Math.round(layout.shadowRoot!.querySelector('.content')!.getBoundingClientRect().width) === Math.round(row) ? 0 : Math.round(layout.shadowRoot!.querySelector('.area-start')!.getBoundingClientRect().width);
      };
      const out: Record<string, number> = { one: area() };
      document.getElementById('h')!.insertAdjacentHTML('beforeend', panel('b', '26rem'));
      await window.__settled();
      out.two = area();
      out.tabsRow = Math.round(layout.shadowRoot!.querySelector('.tabs-start')!.getBoundingClientRect().width);
      (document.getElementById('a') as Panel).minimise(true);
      (document.getElementById('b') as Panel).minimise(true);
      await window.__settled();
      out.tabs = area();
      return out;
    }, host);
    expect(r.one).toBe(20 * 16 + 32);
    // Two panels: the widest, and the tab row beside it.
    expect(r.two).toBe(26 * 16 + 32 + (r.tabsRow ?? 0));
    expect(r.tabs).toBe(0);
  });
}
