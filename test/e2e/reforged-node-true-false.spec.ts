import { test, expect, type Page } from './harness';

/**
 * No node has a True or a False socket (Will, plan 944): a Condition's Pass and Fail are property rows, it has no True (plan
 * 971 §9), and only a test branches, by its Pass and Fail (plan 971 A; §9, no Branch). A Source's Rows leave from the Store row that makes them,
 * not from a Rows line of their own (TODO 830). Read by boxes and pixels, and made by the real pointer: the Store row's
 * socket joins a Field; a Condition's Pass joins a test of one value; that one's Pass and Fail join an Output each.
 * TRAP T-a-socket-says-its-type
 */
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 1400px; block-size: 700px"></sherpa-layout-canvas>');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const canvas = document.getElementById('cv')! as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    // Five columns, none overlapping: a test of one value, "Fixed?", and a second Output join the old set (plans 944, 971 §9).
    (window as unknown as { ed: unknown }).ed = bindWorkflow(canvas as never, {
      v: 3, byHand: true as const, id: 'g',
      nodes: [
        { id: 's', kind: 'source', x: 20, y: 40, values: { store: 'users' } }, { id: 'v', kind: 'value', x: 20, y: 300, values: { value: 'admin' } },
        { id: 'f', kind: 'field', x: 300, y: 40 }, { id: 'm', kind: 'math', x: 300, y: 260 },
        { id: 'c', kind: 'condition', x: 580, y: 40 },
        { id: 'k', kind: 'condition', heading: 'Fixed?', x: 860, y: 40, values: { type: 'gt', b: 0 } }, { id: 't', kind: 'time', x: 860, y: 420 },
        { id: 'o', kind: 'result', x: 1140, y: 40 }, { id: 'o2', kind: 'result', x: 1140, y: 460 },
      ],
      connections: [],
    } as never, { session: new SessionStore(), stores: ['users'], fieldsOf: { users: { role: { label: 'Role' } } } });
    await window.__settled();
    canvas.zoomTo(1);
    // Down from the stage strip.
    canvas.panTo(0, 32);
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const card = (page: Page, heading: string, nth = 0) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).nth(nth);
type Box = { x: number; y: number; w: number; h: number } | null;
/** A socket's box on the screen: a node's (`side`), or one of its rows', by a selector on the row. */
const socket = (page: Page, heading: string, side: string, row?: string, nth = 0): Promise<Box> => card(page, heading, nth).evaluate((el, [s, r]) => {
  const host = (r ? el.querySelector(`sherpa-node-row${r}`) : el) as (HTMLElement & { socketRect(side: string): DOMRect | null }) | null;
  const b = host?.socketRect(s!);
  return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
}, [side, row] as const);
const middle = (b: NonNullable<Box>): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
const connections = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#cv svg.graph-connectors path[data-from]')].map((p) => `${p.getAttribute('data-from')} → ${p.getAttribute('data-to')}`).sort());
async function drag(page: Page, [x1, y1]: [number, number], [x2, y2]: [number, number]): Promise<void> {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await page.mouse.up();
  await settle(page);
}
/** How many pixels in a box are inked, not the canvas's near-white: what the screen draws there. */
async function inked(page: Page, b: NonNullable<Box>): Promise<number> {
  const shot = await page.screenshot({ clip: { x: b.x, y: b.y, width: b.w, height: b.h } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, img.width, img.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.min(d[i]!, d[i + 1]!, d[i + 2]!) < 200) n++;
    return n;
  }, shot.toString('base64'));
}
const STORE = ':has([name="store"])';
/** A row with no field, by the name its socket says. */
const named = (name: string) => `[data-socket-name="${name}"]`;
/** A node's rows as drawn: their label, input, output, whether a property, and the box they stand in. */
const rowsOf = (page: Page, heading: string) => card(page, heading).locator('sherpa-node-row').evaluateAll((els) => els.filter((e) => e.checkVisibility()).map((e) => [
  e.getAttribute('data-socket-name') ?? e.getAttribute('data-label'), e.getAttribute('data-input-socket'), e.getAttribute('data-output-socket'),
  e.hasAttribute('data-property'), e.closest('.section')?.firstElementChild?.getAttribute('data-label') ?? null,
]));

test('no node has a True or a False socket: a Condition has no True row; a test has two ways, Pass and Fail (plans 944, 971 §9)', async ({ page }) => {
  // No fork anywhere: no data-branches, no footer, no False socket.
  expect(await page.locator('#cv > sherpa-node[data-branches]').count()).toBe(0);
  expect(await page.locator('#cv > sherpa-node').evaluateAll((els) => els.filter((e) => e.shadowRoot!.querySelector('.footer, .socket-false, .socket-tab-false')).length)).toBe(0);
  // A Condition sends nothing from its header: its Pass and Fail are rows of its Properties box, output only; no True.
  expect(await socket(page, 'Condition', 'output')).toBeNull();
  const tests = await rowsOf(page, 'Condition');
  expect(tests.filter((r) => r[3])).toEqual([['Pass', null, 'object', true, 'Properties'], ['Fail', null, 'object', true, 'Properties']]);
  // A test: its data on its header, the value it tests when that is not the data on Value A, Pass and Fail as properties; with
  // nothing in, each an object (TODO 994).
  expect(await card(page, 'Fixed?').getAttribute('data-input-socket')).toBe('any');
  expect(await socket(page, 'Fixed?', 'output')).toBeNull();
  const fixed = await rowsOf(page, 'Fixed?');
  expect(fixed.filter((r) => r[0] === 'Value A (Optional)' || r[3])).toEqual([
    ['Value A (Optional)', 'any', null, false, 'Parameters'], ['Pass', null, 'object', true, 'Properties'], ['Fail', null, 'object', true, 'Properties'],
  ]);
  // The others: a Field, a Math and a Value send from a row; none has a header output.
  for (const heading of ['Source', 'Field', 'Value', 'Math', 'Run result']) {
    expect(await socket(page, heading, 'output'), `${heading}: no header output`).toBeNull();
  }
  // A Time still sends one boolean from its header.
  expect(await socket(page, 'Time', 'output')).not.toBeNull();
  expect(await card(page, 'Time').getAttribute('data-output-socket')).toBe('boolean');
  // Pixels: Pass and Fail are drawn, inked inside their boxes.
  expect(await inked(page, (await socket(page, 'Condition', 'output', named('Pass')))!), 'the Condition\'s Pass socket is drawn').toBeGreaterThan(8);
  expect(await inked(page, (await socket(page, 'Fixed?', 'output', named('Pass')))!), 'the Pass socket is drawn').toBeGreaterThan(8);
  expect(await inked(page, (await socket(page, 'Fixed?', 'output', named('Fail')))!), 'the Fail socket is drawn').toBeGreaterThan(8);
});

test('a Source\'s Rows leave from its Store row, beside its input socket: no Rows line, the pointer joins a Field there', async ({ page }) => {
  const rows = await card(page, 'Source').locator('sherpa-node-row').evaluateAll((els) => els.filter((e) => e.checkVisibility()).map((e) => [e.getAttribute('data-label'), e.getAttribute('data-input-socket'), e.getAttribute('data-output-socket')]));
  // The Store row under "Parameters", and no Properties box: its Count is gone (plan 944), and its Rows are the Store row's.
  // Then its Fields pick, no socket (TODO 969). Soft, so the rest is still measured.
  expect.soft(rows).toEqual([['Parameters', null, null], [null, 'value', 'object'], [null, null, null]]);
  const [out, inn] = [(await socket(page, 'Source', 'output', STORE))!, (await socket(page, 'Source', 'input', STORE))!];
  // One row: both sockets on its line, the Rows on its right.
  expect([Math.abs(out.y - inn.y) <= 1, out.x > inn.x]).toEqual([true, true]);
  const row = await card(page, 'Source').locator('sherpa-node-row[data-input-socket]').boundingBox();
  expect(out.y).toBeGreaterThanOrEqual(row!.y);
  expect(out.y + out.h).toBeLessThanOrEqual(row!.y + row!.height + 1);
  expect(await inked(page, out), 'the Rows socket is drawn on the Store row').toBeGreaterThan(8);
  // The pointer: from that socket to the Field's header, then the Field's column on to the Condition.
  await drag(page, middle(out), middle((await socket(page, 'Field', 'input'))!));
  expect(await connections(page)).toEqual(['s/rows → f']);
  // The line starts on the Store row, where the socket is.
  const start = await page.evaluate(() => { const d = document.querySelector('#cv svg.graph-connectors path[data-from="s/rows"]')!.getAttribute('d')!; return d.match(/M\s*([-\d.]+)[ ,]+([-\d.]+)/)!.slice(1).map(Number); });
  const box = (await page.locator('#cv').boundingBox())!;
  const panned = await page.locator('#cv').evaluate((c) => (c as unknown as { view: { y: number } }).view.y);
  expect(Math.abs(start[1]! + box.y + panned - middle(out)[1])).toBeLessThan(12);
});

test('only a test branches: a Condition\'s Pass joins a test of one value, and that one\'s Pass and Fail an Output each, by the real pointer (plan 971 §9)', async ({ page }) => {
  await drag(page, middle((await socket(page, 'Condition', 'output', named('Pass')))!), middle((await socket(page, 'Fixed?', 'input'))!));
  expect(await connections(page)).toEqual(['c/pass → k']);
  await drag(page, middle((await socket(page, 'Fixed?', 'output', named('Pass')))!), middle((await socket(page, 'Run result', 'input'))!));
  await drag(page, middle((await socket(page, 'Fixed?', 'output', named('Fail')))!), middle((await socket(page, 'Run result', 'input', undefined, 1))!));
  expect(await connections(page)).toEqual(['c/pass → k', 'k/fail → o2', 'k/pass → o']);
  // A value into its Value A: it tests the value, and Pass and Fail send what came into its header, the rows (TODO 994).
  await drag(page, middle((await socket(page, 'Value', 'output', named('Value')))!), middle((await socket(page, 'Fixed?', 'input', named('Value A (Optional)')))!));
  expect(await connections(page)).toEqual(['c/pass → k', 'k/fail → o2', 'k/pass → o', 'v/value → k/a']);
  expect((await rowsOf(page, 'Fixed?')).filter((r) => r[0] === 'Pass' || r[0] === 'Fail').map((r) => [r[0], r[2]])).toEqual([['Pass', 'object'], ['Fail', 'object']]);
});
