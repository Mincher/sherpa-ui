import { test, expect } from './harness';

/**
 * The content region the nav, the header and the panel areas frame sits in a recess: an INSIDE shadow on its edges,
 * the same for a grid view and a canvas view; the nav and the header cast no drop shadow onto it. TODO 875
 */
for (const view of ['grid', 'canvas'] as const) {
  test(`${view}: the shell draws one inside shadow over its content region, and the header and nav cast none`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    const r = await page.evaluate(async (view) => {
      const inner = view === 'grid'
        ? '<sherpa-layout-grid><sherpa-container data-heading="Card"></sherpa-container></sherpa-layout-grid>'
        : '<sherpa-layout-canvas style="inline-size: 100%; block-size: 100%"></sherpa-layout-canvas>';
      document.getElementById('root')!.innerHTML = `<sherpa-app-shell style="block-size: 100vh"><sherpa-app-header slot="header" data-heading="H"></sherpa-app-header>${inner}</sherpa-app-shell>`;
      await window.__settled();
      const shell = document.querySelector('sherpa-app-shell')!;
      const body = shell.shadowRoot!.querySelector('.body')!;
      const after = getComputedStyle(body, '::after');
      const header = document.querySelector('sherpa-app-header')!;
      return { shadow: after.boxShadow, pointer: after.pointerEvents, header: getComputedStyle(header).boxShadow, nav: getComputedStyle(shell.shadowRoot!.querySelector('sherpa-nav') ?? shell).boxShadow };
    }, view);
    expect(r.shadow).toContain('inset');
    expect(r.pointer).toBe('none');
    expect(r.header).toBe('none');
  });
}
