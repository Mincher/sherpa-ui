import { test, expect, type Page } from './harness';

/**
 * A CONNECTED socket is three layers: a 1px BORDER in the socket's ink, a 1px WHITE inset (the card's
 * face) inside it, then the FILL in the socket's own shape in the ink again. A boolean is a square (TODO 998).
 * Read as pixels at 4x, from the edge inward. Will, TODO 874.
 */
test.use({ deviceScaleFactor: 4 });

const SOCKETS = [
  { id: 'v', attrs: 'data-output-socket="value" data-output-connected', side: 'out', along: 'row' },
  { id: 'b', attrs: 'data-output-socket="boolean" data-output-connected', side: 'out', along: 'row' },
  { id: 'o', attrs: 'data-output-socket="object" data-output-connected', side: 'out', along: 'diagonal' },
  { id: 'i', attrs: 'data-input-socket="value" data-input-connected', side: 'in', along: 'row' },
];

/** Luminance of the pixel at each (x, y) of the socket's 16px box, in device pixels. */
async function lights(page: Page, id: string, side: string, at: number[][]): Promise<number[]> {
  const box = await page.evaluate(([i, s]) => {
    const el = document.getElementById(i!)!.shadowRoot!.querySelector(`.socket-${s}`)!;
    const b = el.getBoundingClientRect();
    return { x: b.x + 6, y: b.y + 6 };
  }, [id, side]);
  const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: 16, height: 16 } });
  return page.evaluate(async ([b64, pts]) => {
    const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bm.width, bm.height).getContext('2d')!;
    c.drawImage(bm, 0, 0);
    return (pts as number[][]).map(([x, y]) => { const d = c.getImageData(x!, y!, 1, 1).data; return Math.round(0.3 * d[0]! + 0.59 * d[1]! + 0.11 * d[2]!); });
  }, [png.toString('base64'), at] as const);
}

test('a connected socket: border and fill in the ink, a white inset between, in the socket\'s shape', async ({ page }) => {
  await page.evaluate(async (list) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `<div style="position:relative;inline-size:600px;block-size:200px;background:#fff">${
      list.map((s, n) => `<sherpa-node-row id="${s.id}" data-label="${s.id}" ${s.attrs} style="position:absolute;left:${40 + n * 120}px;top:60px;inline-size:80px"></sherpa-node-row>`).join('')}</div>`);
    await new Promise((r) => setTimeout(r, 400));
  }, SOCKETS);
  for (const s of SOCKETS) {
    // Device pixels in a 64 box: a row through the middle, or the diamond's up-left side along the diagonal. Each layer is
    // read over a few pixels: WebKit turns the diamond a device pixel further in than Chromium and Firefox (TODO 1007).
    const row = (xs: number[]) => xs.map((x) => s.along === 'row' ? [x, 32] : [x, x]);
    const spans = s.along === 'row' ? [[1], [6], [20], [32]] : [[15, 16, 17], [17, 18, 19, 20], [24, 25, 26], [32]];
    const read = await Promise.all(spans.map((xs) => lights(page, s.id, s.side, row(xs))));
    const [border, inset, fill, centre] = [Math.min(...read[0]!), Math.max(...read[1]!), Math.max(...read[2]!), Math.max(...read[3]!)];
    expect(inset, `${s.id} inset is the white face`).toBeGreaterThan(215);
    expect(border, `${s.id} border is ink`).toBeLessThan(150);
    expect(fill, `${s.id} fill is ink inside the white`).toBeLessThan(150);
    expect(centre, `${s.id} centre is ink`).toBeLessThan(150);
  }
});
