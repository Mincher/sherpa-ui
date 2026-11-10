import { test, expect } from './harness';

/**
 * A Context's cards take no gutter at an open panel area: the area's 16px inset is the one gap; shut, the gutter comes back
 * (Will, TODOs 867, 871). Read from the grid's inset and the frame's edge.
 * TRAP T-one-line-between-a-context-and-a-panel-area
 */
test('an open panel area takes the Context\'s gutter on its side; shut, it comes back', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-app-shell data-no-nav style="block-size: 100vh">'
      + '<sherpa-overlay-panel data-side="end" id="p" data-heading="P"><p>Panel</p></sherpa-overlay-panel>'
      + '<sherpa-layout-grid id="g"><sherpa-container data-heading="Card"></sherpa-container></sherpa-layout-grid></sherpa-app-shell>';
    await window.__settled();
    const panel = document.getElementById('p') as HTMLElement & { show(): void; hide(): void };
    const grid = document.getElementById('g')!;
    const edges = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('.context-edges') as HTMLElement;
    const read = () => ({ pad: getComputedStyle(grid).paddingRight, margin: getComputedStyle(edges).marginRight });
    const shut = read();
    panel.show();
    await window.__settled();
    const open = read();
    panel.hide();
    await window.__settled();
    return { shut, open, again: read() };
  });
  expect(r.shut.pad).not.toBe('0px');
  expect(r.shut.margin).toBe('0px');
  expect(r.open).toEqual({ pad: '0px', margin: '0px' });
  expect(r.again.pad).toBe(r.shut.pad);
});

test('a fixed panel\'s top and bottom meet the Context\'s cards: the area\'s block inset is the layout grid\'s', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-app-shell data-no-nav style="block-size: 100vh">'
      + '<sherpa-overlay-panel data-side="end" id="p" data-heading="P"><p>Panel</p></sherpa-overlay-panel>'
      + '<sherpa-layout-grid data-rows="fit" data-row-count="1"><sherpa-container id="c" data-heading="Card" data-col-span="full"></sherpa-container></sherpa-layout-grid></sherpa-app-shell>';
    await window.__settled();
    (document.getElementById('p') as HTMLElement & { show(): void }).show();
    await window.__settled();
    const edges = (el: Element) => { const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
    const panel = document.getElementById('p') as HTMLElement & { dockState: string };
    return { mode: panel.dockState, panel: edges(panel.shadowRoot!.querySelector('.root')!), card: edges(document.getElementById('c')!) };
  });
  expect(r.mode).toBe('fixed');
  expect(r.panel).toEqual(r.card);
});
