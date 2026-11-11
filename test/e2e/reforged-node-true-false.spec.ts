import { test, expect, type Page } from './harness';

/**
 * No node has a True or a False socket (Will, plan 944): a Condition's True is a property row, 1 or 0, and only a Check
 * branches, by its Yes and No. A Source's Rows leave from the Store row that makes them, not from a Rows line of their own
 * (TODO 830). Read by boxes and pixels, and made by the real pointer: the Store row's socket joins a Field; a Condition's
 * True joins a Check; the Check's Yes and No join an Output each.
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
    // Five columns, none overlapping: a Check and a second Output join the old set (plan 944).
    (window as unknown as { ed: unknown }).ed = bindWorkflow(canvas as never, {
      v: 3, id: 'g',
      nodes: [
        { id: 's', kind: 'source', x: 20, y: 40, values: { store: 'users' } }, { id: 'v', kind: 'value', x: 20, y: 300, values: { value: 'admin' } },
        { id: 'f', kind: 'field', x: 300, y: 40 }, { id: 'm', kind: 'math', x: 300, y: 260 },
        { id: 'c', kind: 'condition', x: 580, y: 40 },
        { id: 'k', kind: 'check', x: 860, y: 40 }, { id: 't', kind: 'time', x: 860, y: 320 },
        { id: 'o', kind: 'output', x: 1140, y: 40 }, { id: 'o2', kind: 'output', x: 1140, y: 460 },
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

test('no node has a True or a False socket: a Condition\'s True is a property row; only a Check has two ways, Yes and No (plan 944)', async ({ page }) => {
  // No fork anywhere: no data-branches, no footer, no False socket.
  expect(await page.locator('#cv > sherpa-node[data-branches]').count()).toBe(0);
  expect(await page.locator('#cv > sherpa-node').evaluateAll((els) => els.filter((e) => e.shadowRoot!.querySelector('.footer, .socket-false, .socket-tab-false')).length)).toBe(0);
  // A Condition sends nothing from its header: its Results and its True are rows of its Properties box, output only.
  expect(await socket(page, 'Condition', 'output')).toBeNull();
  const tests = await rowsOf(page, 'Condition');
  expect(tests.filter((r) => r[3])).toEqual([['Results', null, 'object', true, 'Properties'], ['True', null, 'value', true, 'Properties']]);
  // A Check: its test on its header, its Data on a row, and Yes and No as properties; with no Data, each an object.
  expect(await card(page, 'Check').getAttribute('data-input-socket')).toBe('any');
  expect(await socket(page, 'Check', 'output')).toBeNull();
  expect(await rowsOf(page, 'Check')).toEqual([
    ['Parameters', null, null, false, 'Parameters'], ['Data', 'any', null, false, 'Parameters'],
    ['Properties', null, null, false, 'Properties'], ['Yes', null, 'object', true, 'Properties'], ['No', null, 'object', true, 'Properties'],
  ]);
  // The others: a Field, a Math and a Value send from a row; none has a header output.
  for (const heading of ['Source', 'Field', 'Value', 'Math', 'Output']) {
    expect(await socket(page, heading, 'output'), `${heading}: no header output`).toBeNull();
  }
  // A Time still sends one boolean from its header.
  expect(await socket(page, 'Time', 'output')).not.toBeNull();
  expect(await card(page, 'Time').getAttribute('data-output-socket')).toBe('boolean');
  // Pixels: True, Yes and No are drawn, inked inside their boxes.
  expect(await inked(page, (await socket(page, 'Condition', 'output', named('True')))!), 'the True socket is drawn').toBeGreaterThan(8);
  expect(await inked(page, (await socket(page, 'Check', 'output', named('Yes')))!), 'the Yes socket is drawn').toBeGreaterThan(8);
  expect(await inked(page, (await socket(page, 'Check', 'output', named('No')))!), 'the No socket is drawn').toBeGreaterThan(8);
});

test('a Source\'s Rows leave from its Store row, beside its input socket: no Rows line, the pointer joins a Field there', async ({ page }) => {
  const rows = await card(page, 'Source').locator('sherpa-node-row').evaluateAll((els) => els.filter((e) => e.checkVisibility()).map((e) => [e.getAttribute('data-label'), e.getAttribute('data-input-socket'), e.getAttribute('data-output-socket')]));
  // The Store row under "Parameters", and no Properties box: its Count is gone (plan 944), and its Rows are the Store row's.
  // Soft, so the rest is still measured.
  expect.soft(rows).toEqual([['Parameters', null, null], [null, 'value', 'object']]);
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

test('only a Check branches: a Condition\'s True joins its test, and its Yes and No an Output each, by the real pointer (plan 944)', async ({ page }) => {
  await drag(page, middle((await socket(page, 'Condition', 'output', named('True')))!), middle((await socket(page, 'Check', 'input'))!));
  expect(await connections(page)).toEqual(['c/true → k']);
  await drag(page, middle((await socket(page, 'Check', 'output', named('Yes')))!), middle((await socket(page, 'Output', 'input'))!));
  await drag(page, middle((await socket(page, 'Check', 'output', named('No')))!), middle((await socket(page, 'Output', 'input', undefined, 1))!));
  expect(await connections(page)).toEqual(['c/true → k', 'k/no → o2', 'k/yes → o']);
  // A value into its Data: Yes and No are drawn as what they send, a value each. An empty Value sends nothing (D2).
  await drag(page, middle((await socket(page, 'Value', 'output', named('Value')))!), middle((await socket(page, 'Check', 'input', named('Data')))!));
  expect(await connections(page)).toEqual(['c/true → k', 'k/no → o2', 'k/yes → o', 'v/value → k/data']);
  expect((await rowsOf(page, 'Check')).filter((r) => r[3]).map((r) => [r[0], r[2]])).toEqual([['Yes', 'value'], ['No', 'value']]);
});
