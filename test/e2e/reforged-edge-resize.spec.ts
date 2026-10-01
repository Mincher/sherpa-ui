import { test, expect } from './harness';

/**
 * AN EDGE, ON EITHER AXIS — TODO 177. The layout grid's gutters move a height
 * as well as a width, by a step that follows the grid, and say their value in
 * columns or rows rather than px. TRAP T-an-edge-resizes-its-box
 */

type Edge = { size: number; log: string[]; aria: Record<string, string | null> };

const wire = (page: import('@playwright/test').Page, axis: 'x' | 'y', describe: boolean) =>
  page.evaluate(async ([axis, describe]) => {
    const { resizeByEdge } = await import('/dist/core/ui/edge-resize.js') as {
      resizeByEdge(edge: HTMLElement, o: Record<string, unknown>): void;
    };
    const edge = document.createElement('div');
    edge.tabIndex = 0;
    edge.style.cssText = 'position:fixed;left:100px;top:100px;width:20px;height:20px;background:#ccc';
    document.getElementById('root')!.replaceChildren(edge);
    const state = { size: 200, log: [] as string[], pitch: 10 };
    (window as unknown as { __edge: typeof state }).__edge = state;
    resizeByEdge(edge, {
      axis, grows: 1,
      step: () => state.pitch,
      measure: () => state.size,
      apply: (px: number, done: boolean) => { state.size = px; state.log.push(`${Math.round(px)}${done ? '!' : ''}`); },
      min: () => 100, max: () => 400,
      ...(describe ? { describe: () => ({ now: state.size / 100, min: 1, max: 4, text: `${state.size / 100} rows` }) } : {}),
    });
  }, [axis, describe] as const);

const read = (page: import('@playwright/test').Page): Promise<Edge> => page.evaluate(() => {
  const edge = document.getElementById('root')!.firstElementChild!;
  const state = (window as unknown as { __edge: { size: number; log: string[] } }).__edge;
  return {
    size: state.size, log: [...state.log],
    aria: Object.fromEntries(['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-valuetext']
      .map((a) => [a, edge.getAttribute(a)])),
  };
});

test('a y-axis edge drags by clientY and moves on Up and Down, by the step it reads', async ({ page }) => {
  await wire(page, 'y', false);
  await page.mouse.move(110, 110);
  await page.mouse.down();
  await page.mouse.move(110, 150);
  await page.mouse.move(110, 170);
  await page.mouse.up();
  const dragged = await read(page);

  await page.evaluate(() => {
    (window as unknown as { __edge: { pitch: number } }).__edge.pitch = 25;
    (document.getElementById('root')!.firstElementChild as HTMLElement).focus();
  });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  const keyed = await read(page);

  expect(dragged.size).toBe(260);
  expect(dragged.log.at(-1)).toBe('260!');
  // ArrowRight is not this axis's key.
  expect(keyed.size).toBe(285);
});

test('an edge states its values before it is focused — in its own units when it describes them', async ({ page }) => {
  await wire(page, 'y', true);
  const told = await read(page);
  await wire(page, 'x', false);
  const px = await read(page);

  expect(told.aria).toEqual({ 'aria-valuenow': '2', 'aria-valuemin': '1', 'aria-valuemax': '4', 'aria-valuetext': '2 rows' });
  expect(px.aria).toEqual({ 'aria-valuenow': '200', 'aria-valuemin': '100', 'aria-valuemax': '400', 'aria-valuetext': null });
});

test('the x axis is unchanged: a drag by clientX, Left and Right, Home and End', async ({ page }) => {
  await wire(page, 'x', false);
  await page.mouse.move(110, 110);
  await page.mouse.down();
  await page.mouse.move(140, 110);
  await page.mouse.up();
  await page.evaluate(() => (document.getElementById('root')!.firstElementChild as HTMLElement).focus());
  await page.keyboard.press('ArrowLeft');
  const keyed = (await read(page)).size;
  await page.keyboard.press('End');
  const end = (await read(page)).size;
  await page.keyboard.press('Home');
  expect([keyed, end, (await read(page)).size]).toEqual([220, 400, 100]);
});
