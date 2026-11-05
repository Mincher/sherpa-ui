import { test, expect, type Page } from './harness';

/**
 * A node that cannot use what reaches it reads null there, and draws as a WARNING: the warning Style mode's
 * border, never red, and a tip on its header that says why, from its kind's own words. Hover or keyboard focus
 * shows the tip; a connection made by hand warns at once, Undo takes it back, and Save does not wait. Any
 * route joins any input: one of another type is drawn and warns; a loop is still refused (TODO 770).
 * Will, 2026-11-05 (TODOs 764, 770). Real pointer and keys; the look read back by pixels.
 * TRAP T-a-node-reads-null-from-what-it-cannot-use
 */
type Rgb = [number, number, number];
type Box = { x: number; y: number; w: number; h: number };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1100px; block-size: 640px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
  });
  await page.evaluate(async () => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 2, id: 'warn',
      nodes: [
        { id: 'v', kind: 'value', x: 20, y: 20, values: { value: 'abc' } },
        { id: 'm', kind: 'math', x: 380, y: 20 },
        { id: 'c', kind: 'condition', x: 740, y: 20 },
        { id: 's', kind: 'store', x: 20, y: 340, values: { store: 'users' } },
        { id: 't', kind: 'time', x: 380, y: 340 },
        { id: 'end', kind: 'output', x: 740, y: 340 },
      ],
      routes: [{ from: 'v/value', to: 'm/a' }, { from: 's/rows', to: 't' }, { from: 's', to: 'end' }],
    };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    const w = window as unknown as Record<string, unknown>;
    w['saved'] = [];
    canvas.addEventListener('definition-save', (e) => (w['saved'] as unknown[]).push((e as CustomEvent).detail.definition));
    w['ed'] = bindWorkflow(canvas as never, flow as never, { session: new SessionStore(), inspector: document.getElementById('inspector') as never, stores: ['users'] });
    await window.__settled();
    canvas.zoomTo(1);
    canvas.panTo(0, 0);
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const node = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`);
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const warning = (page: Page, heading: string) => node(page, heading).evaluate((n) => n.getAttribute('data-warning'));
const tip = (page: Page, heading: string) => node(page, heading).evaluate((n) => {
  const t = n.shadowRoot!.querySelector<HTMLElement>('.tip-warning')!;
  const r = t.getBoundingClientRect();
  return { open: t.matches(':popover-open'), text: t.textContent, box: { x: r.x, y: r.y, w: r.width, h: r.height } };
});
const rectOf = (page: Page, heading: string, sel: string): Promise<Box> => node(page, heading).evaluate((n, s) => {
  const r = n.shadowRoot!.querySelector(s)!.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, sel);
const gap = (a: Box, b: Box): number => Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h));
const inkOf = (page: Page, token: string): Promise<Rgb> => page.evaluate((t) => {
  const el = Object.assign(document.createElement('div'), { style: `background: var(${t}); inline-size: 1px; block-size: 1px` });
  document.body.append(el);
  const [r, g, b] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);
  el.remove();
  return [r, g, b] as Rgb;
}, token);
const near = (a: Rgb, b: Rgb, within = 12): boolean => Math.max(...a.map((v, i) => Math.abs(v - b[i]!))) <= within;

/** The pixels across a card's left edge, at a third of its height: its border is among them. */
async function edge(page: Page, heading: string): Promise<Rgb[]> {
  const r = await rectOf(page, heading, '.root');
  const shot = await page.screenshot({ clip: { x: Math.floor(r.x) - 1, y: Math.round(r.y + r.h / 3), width: 4, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return Array.from({ length: img.width }, (_, x) => [...c.getImageData(x, 0, 1, 1).data].slice(0, 3) as Rgb);
  }, shot.toString('base64'));
}

test('a node given what it cannot use draws the warning border, never red; a node that can use it keeps its own', async ({ page }) => {
  expect(await warning(page, 'Math')).toBe('Value A takes a number; it was given "abc"');
  expect(await warning(page, 'Time')).toBe('Time takes a date; it was given rows');
  expect(await warning(page, 'Output')).toBeNull();
  expect(await warning(page, 'Condition')).toBeNull();
  // Value A reads null: its field is empty, read only.
  const a = await page.locator('#cv > sherpa-node[data-heading="Math"] sherpa-input-text[name="a"]').evaluate((f) => [(f as HTMLElement & { value: unknown }).value, f.hasAttribute('readonly')]);
  expect(a).toEqual(['', true]);
  const [warn, critical, plain] = await Promise.all(['--sherpa-style-warning-border-base-1', '--sherpa-style-critical-border-base-1', '--sherpa-style-default-border-base-1'].map((t) => inkOf(page, t))) as [Rgb, Rgb, Rgb];
  for (const heading of ['Math', 'Time']) {
    const px = await edge(page, heading);
    expect(px.some((p) => near(p, warn)), `${heading}'s border is the warning ink: ${JSON.stringify(px)}`).toBe(true);
    expect(px.some((p) => near(p, critical)), `${heading} is not red`).toBe(false);
  }
  const clean = await edge(page, 'Output');
  expect(clean.some((p) => near(p, warn)), 'a node with nothing wrong is no warning').toBe(false);
  expect(clean.some((p) => near(p, plain, 24)), `its own border: ${JSON.stringify(clean)}`).toBe(true);
});

test('a hover on the header shows the words in a tip beside it; off the header it shuts; a node with no warning shows none', async ({ page }) => {
  const h = await rectOf(page, 'Math', '.header');
  await page.mouse.move(h.x + h.w / 2, h.y + h.h / 2);
  await expect.poll(async () => (await tip(page, 'Math')).open).toBe(true);
  const t = await tip(page, 'Math');
  expect(t.text).toBe('Value A takes a number; it was given "abc"');
  expect(gap(h, t.box), 'beside the header').toBeLessThanOrEqual(12);
  await page.mouse.move(2, 2);
  await expect.poll(async () => (await tip(page, 'Math')).open).toBe(false);
  // A node with nothing wrong: its header opens no tip.
  const o = await rectOf(page, 'Output', '.header');
  await page.mouse.move(o.x + o.w / 2, o.y + o.h / 2);
  await settle(page);
  expect((await tip(page, 'Output')).open).toBe(false);
  // A socket's own tip is still its own.
  const sock = await rectOf(page, 'Time', '.header .socket-in');
  await page.mouse.move(sock.x + sock.w / 2, sock.y + sock.h / 2);
  await expect.poll(() => node(page, 'Time').evaluate((n) => n.shadowRoot!.querySelector('.tip-in')!.matches(':popover-open'))).toBe(true);
  expect((await tip(page, 'Time')).open).toBe(false);
});

test('keyboard focus on the header shows the tip, and the header is described by it', async ({ page }) => {
  await header(page, 'Time').focus();
  await expect.poll(async () => (await tip(page, 'Time')).open).toBe(true);
  expect((await tip(page, 'Time')).text).toBe('Time takes a date; it was given rows');
  const described = await node(page, 'Time').evaluate((n) => {
    const head = n.shadowRoot!.querySelector('.header')!;
    return n.shadowRoot!.getElementById(head.getAttribute('aria-describedby')!)?.textContent;
  });
  expect(described).toBe('Time takes a date; it was given rows');
});

test('a connection made by hand warns at once; Undo takes the warning away, Redo gives it back, and Save does not wait', async ({ page }) => {
  const socket = (heading: string, row: string | null, side: string) => page.evaluate(([hd, r, s]) => {
    const n = document.querySelector(`#cv > sherpa-node[data-heading="${hd}"]`)!;
    const host = (r ? [...n.querySelectorAll('sherpa-node-row')].find((x) => x.querySelector(`[name="${r}"]`)) : n) as HTMLElement & { socketRect(side: string): DOMRect };
    const b = host.socketRect(s!);
    return [b.left + b.width / 2, b.top + b.height / 2] as [number, number];
  }, [heading, row, side] as const);
  const from = await socket('Value', 'value', 'output');
  const to = await socket('Condition', null, 'input');
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  expect(await warning(page, 'Condition')).toBe('Condition takes rows; it was given "abc"');
  const mod = await page.evaluate(() => (/mac|iphone|ipad/i.test(navigator.platform) ? 'Meta' : 'Control'));
  await page.locator('#cv').evaluate((el) => (el.shadowRoot!.querySelector('.viewport') as HTMLElement).focus());
  await page.keyboard.press(`${mod}+z`);
  await settle(page);
  expect(await warning(page, 'Condition')).toBeNull();
  await page.keyboard.press(`Shift+${mod}+z`);
  await settle(page);
  expect(await warning(page, 'Condition')).toBe('Condition takes rows; it was given "abc"');
  // No fault, no block: Save hands the graph over, its route in it.
  const handed = await page.evaluate(() => {
    const w = window as unknown as { ed: { save(): boolean }; saved: { routes: { from: string; to: string }[] }[] };
    return [w.ed.save(), w.saved.at(-1)?.routes.some((r) => r.from === 'v/value' && r.to === 'c')];
  });
  expect(handed).toEqual([true, true]);
});

/** A drawn socket's middle on the screen: a node's header's, or a row's by its field's name. */
const socketAt = (page: Page, heading: string, row: string | null, side: string) => page.evaluate(([hd, r, sd]) => {
  const n = document.querySelector(`#cv > sherpa-node[data-heading="${hd}"]`)!;
  const host = (r ? [...n.querySelectorAll('sherpa-node-row')].find((x) => x.querySelector(`[name="${r}"]`) || x.getAttribute('data-label') === r) : n) as HTMLElement & { socketRect(side: string): DOMRect };
  const b = host.socketRect(sd!);
  return [b.left + b.width / 2, b.top + b.height / 2] as [number, number];
}, [heading, row, side] as const);
const drag = async (page: Page, from: [number, number], to: [number, number]) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
  await settle(page);
};
const lines = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#cv svg.graph-routes path[data-to]')].map((p) => `${(p as SVGElement).dataset['from']}>${(p as SVGElement).dataset['to']}`).sort());

test('rows dropped on Math › Value B join, drawn, and Math says so; a loop is still refused, in words (770)', async ({ page }) => {
  const heard: string[] = [];
  page.on('console', (m) => { if (/bindWorkflow/.test(m.text())) heard.push(m.text()); });
  await drag(page, await socketAt(page, 'Store', 'Rows', 'output'), await socketAt(page, 'Math', 'b', 'input'));
  expect(await lines(page)).toContain('s/rows>m/b');
  expect(await warning(page, 'Math')).toBe('Value A takes a number; it was given "abc"\nValue B takes a number; it was given rows');
  expect(heard, 'no refusal').toEqual([]);
  // Its tip says both, a line each.
  const h = await rectOf(page, 'Math', '.header');
  await page.mouse.move(h.x + h.w / 2, h.y + h.h / 2);
  await expect.poll(async () => (await tip(page, 'Math')).open).toBe(true);
  const box = await tip(page, 'Math');
  expect(box.text).toBe('Value A takes a number; it was given "abc"\nValue B takes a number; it was given rows');
  expect(box.box.h, 'two lines').toBeGreaterThan(24);
  await page.mouse.move(2, 2);
  // Time's True into the Condition's header joins and warns; the Condition's rows back into Time would make a loop: refused.
  await drag(page, await socketAt(page, 'Time', null, 'output'), await socketAt(page, 'Condition', null, 'input'));
  expect(await warning(page, 'Condition')).toBe('Condition takes rows; it was given a boolean');
  const before = await lines(page);
  await drag(page, await socketAt(page, 'Condition', 'Rows', 'output'), await socketAt(page, 'Time', null, 'input'));
  expect(await lines(page)).toEqual(before);
  await expect.poll(() => heard.some((m) => m.includes('its routes run in a loop'))).toBe(true);
});

test('a Value made True/false and "true" reads 1 in Math › Value A, and Math no longer warns (TODO 781)', async ({ page }) => {
  expect(await warning(page, 'Math')).toBe('Value A takes a number; it was given "abc"');
  await page.locator('#cv > sherpa-node[data-heading="Value"] sherpa-input-text[name="type"] select').selectOption('boolean');
  await settle(page);
  const field = page.locator('#cv > sherpa-node[data-heading="Value"] sherpa-input-text[name="value"] input');
  await field.fill('true');
  await field.press('Enter');
  await field.blur();
  await settle(page);
  const a = await page.locator('#cv > sherpa-node[data-heading="Math"] sherpa-input-text[name="a"]').evaluate((f) => (f as HTMLElement & { value: unknown }).value);
  expect(String(a)).toBe('1');
  expect(await warning(page, 'Math')).toBeNull();
});
