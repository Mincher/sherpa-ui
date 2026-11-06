import { test, expect } from './harness';

/**
 * A panel area needs the area's min (464px) plus a Context in the grid's tablet band (728px): 1192px of body.
 * A laptop's 1280px with the wider rail (a 1200px body) has room (Will, 869 follow-up to 31c1b1cef).
 * TRAP T-the-panel-is-desktop-only
 */
test('the shell has room for a panel area from a 1192px body, and none under it', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const read = async (w: number): Promise<boolean> => {
      root.innerHTML = `<sherpa-app-shell data-no-nav style="inline-size: ${w}px; block-size: 600px"><p>Context</p></sherpa-app-shell>`;
      await window.__settled();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return !document.querySelector('sherpa-app-shell')!.hasAttribute('data-no-room');
    };
    return { w1200: await read(1200), w1192: await read(1192), w1180: await read(1180) };
  });
  expect(r).toEqual({ w1200: true, w1192: true, w1180: false });
});
