import { test, expect } from './harness';

/**
 * A Context's cards end FLUSH at an open panel area, and the frame reaches 1px under it, so the last card's border IS
 * the area's one line; shut, the gutter comes back (Will, TODO 867). Read from the grid's inset and the frame's edge.
 * TRAP T-one-line-between-a-context-and-a-panel-area
 */
test('an open panel area takes the Context\'s gutter on its side; shut, it comes back', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-app-shell data-no-nav style="block-size: 100vh">'
      + '<sherpa-overlay-panel slot="panel-end" id="p" data-heading="P" data-fixed><p>Panel</p></sherpa-overlay-panel>'
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
  expect(r.open).toEqual({ pad: '0px', margin: '-1px' });
  expect(r.again.pad).toBe(r.shut.pad);
});
