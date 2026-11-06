import { test, expect, type Page } from './harness';

/**
 * The node look, its sockets and its resize handle — Will, TODO 740, from his Figma. A node's kind's
 * category (`data-category`) gives its radius and fill; an input is a D, a many input double height;
 * True is a triangle and False a rounded square. On hover or focus a handle shows at the bottom right:
 * a drag grows the node to at most double each way, non-uniformly, and the primary key (Cmd on a Mac,
 * Ctrl elsewhere) keeps its aspect. Real pointer events; pixels, never computed style alone.
 */
type Canvas = HTMLElement & { rendered: Promise<void>; zoomTo(z: number): void; panTo(x: number, y: number): void };
type Node = HTMLElement & { rendered: Promise<void>; socketRect(side: string): DOMRect | null };
type Rgb = [number, number, number];
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 900px; block-size: 520px';
    const cats = ['sources', 'custom-nodes', 'logic', 'output', 'ai'];
    el.innerHTML = cats.map((c, i) => `<sherpa-node id="${c}" data-resizable data-heading="${c}" data-category="${c}" data-x="${20 + i * 170}" data-y="40" style="inline-size: 10rem"></sherpa-node>`).join('')
      + '<sherpa-node id="big" data-resizable data-heading="Resize" data-x="40" data-y="200" data-input-socket="value" data-input-many data-input-routed></sherpa-node>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await Promise.all([...el.querySelectorAll<Node>('sherpa-node')].map((n) => n.rendered));
    el.scrollIntoView({ block: 'start' });
    await window.__settled();
  });
});

async function paint(page: Page, rect: { x: number; y: number; w: number; h: number }, at: [number, number][]): Promise<Rgb[]> {
  const shot = await page.screenshot({ clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });
  return page.evaluate(async ([b64, pts]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return (pts as [number, number][]).map(([fx, fy]) => [...c.getImageData(Math.min(img.width - 1, Math.floor(fx * img.width)), Math.min(img.height - 1, Math.floor(fy * img.height)), 1, 1).data].slice(0, 3) as Rgb);
  }, [shot.toString('base64'), at] as const);
}
const inkOf = (page: Page, token: string): Promise<Rgb> => page.evaluate((t) => {
  const el = Object.assign(document.createElement('div'), { style: `background: var(${t}); inline-size: 1px; block-size: 1px` });
  document.body.append(el);
  const [r, g, b] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);
  el.remove();
  return [r, g, b] as Rgb;
}, token);
const near = (a: Rgb, b: Rgb, within = 6): boolean => Math.max(...a.map((v, i) => Math.abs(v - b[i]!))) <= within;
const box = (page: Page, id: string) => page.evaluate((i) => { const r = document.getElementById(i)!.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, id);
const handle = (page: Page, id: string) => page.evaluate((i) => {
  const h = document.getElementById(i)!.shadowRoot!.querySelector('.resize')!;
  const r = h.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, visible: getComputedStyle(h).visibility === 'visible' };
}, id);

test('each category has its own radius and its own painted fill; one with no category keeps the card', async ({ page }) => {
  const radii = await page.evaluate(() => Object.fromEntries(['sources', 'custom-nodes', 'logic', 'output', 'ai', 'big'].map((id) => {
    const s = getComputedStyle(document.getElementById(id)!.shadowRoot!.querySelector('.root')!);
    return [id, [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map(parseFloat)];
  })));
  expect(radii).toEqual({ sources: [16, 4, 4, 16], 'custom-nodes': [4, 4, 4, 4], logic: [4, 4, 4, 4], output: [4, 16, 16, 4], ai: [16, 16, 16, 4], big: [4, 4, 4, 4] });
  const fills: Record<string, string> = { sources: '--sherpa-theme-surface-info-base', 'custom-nodes': '--sherpa-theme-surface-info-base', output: '--sherpa-theme-surface-success-base', ai: '--sherpa-theme-surface-active-base' };
  for (const [id, token] of Object.entries(fills)) {
    const b = await box(page, id);
    const [pixel] = await paint(page, b, [[.5, .96]]);
    expect(near(pixel!, await inkOf(page, token)), `${id} paints ${token}`).toBe(true);
  }
  const [logic] = await paint(page, await box(page, 'logic'), [[.5, .96]]);
  const [info] = await paint(page, await box(page, 'sources'), [[.5, .96]]);
  expect(near(logic!, info!, 2), 'a Logic node is not the info tint').toBe(false);
});

test('a many input is twice the height of a single, a D: round outside, flat on the node side', async ({ page }) => {
  const sizes = await page.evaluate(async () => {
    const el = document.querySelector('#root sherpa-layout-canvas')!;
    el.insertAdjacentHTML('beforeend', '<sherpa-node id="one" data-heading="One" data-x="400" data-y="200" data-input-socket="value" data-input-routed></sherpa-node>');
    const one = document.getElementById('one') as Node;
    await one.rendered;
    await window.__settled();
    return { one: one.socketRect('input')!.height, many: (document.getElementById('big') as Node).socketRect('input')!.height };
  });
  expect(sizes.many).toBeCloseTo(sizes.one * 2, 0);
  // The Figma's socket: 16px, and 32 for a many input. Will, TODO 747
  expect(sizes.one).toBe(16);
  expect(sizes.many).toBe(32);
});

test('807: only the many INPUT is double height: the same row\'s output, and a fork\'s True and False, keep their own, in pixels', async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.querySelector('#root sherpa-layout-canvas')!;
    const row = (id: string, many: boolean) => `<sherpa-node-row id="${id}" data-label="${id}" data-input-socket="value"${many ? ' data-input-many' : ''} data-input-routed data-output-socket="object" data-output-routed></sherpa-node-row>`;
    // A node each, so nothing else paints down the socket's column.
    el.insertAdjacentHTML('beforeend', `<sherpa-node id="a" data-heading="Plain" data-x="300" data-y="200">${row('plain', false)}</sherpa-node>`
      + `<sherpa-node id="b" data-heading="Many" data-x="300" data-y="340">${row('many', true)}</sherpa-node>`
      + '<sherpa-node id="fork" data-heading="Fork" data-x="560" data-y="200" data-input-socket="boolean" data-input-many data-input-routed data-branches data-output-routed data-false-routed></sherpa-node>');
    await Promise.all([...el.querySelectorAll<Node>('#a, #b, #fork, sherpa-node-row')].map((n) => n.rendered));
    await window.__settled();
  });
  const rect = (id: string, side: string) => page.evaluate(([i, s]) => {
    const r = (document.getElementById(i!) as Node).socketRect(s!)!;
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, [id, side] as const);
  const ink = await inkOf(page, '--sherpa-style-active-indicator-accent');
  /** How many pixel rows the socket's ink paints down one column, clear of the card's edge, in a box three times its height round it. */
  const painted = async (r: { x: number; y: number; w: number; h: number }, colour: Rgb): Promise<number> => {
    const clip = { x: Math.round(r.x + r.w * 0.7), y: Math.round(r.y - r.h), w: 1, h: Math.round(r.h * 3) };
    const ys = Array.from({ length: clip.h }, (_, n) => [0.5, (n + 0.5) / clip.h] as [number, number]);
    return (await paint(page, clip, ys)).filter((p) => near(p, colour, 24)).length;
  };
  // Painted: the many row's diamond is as tall as the plain row's.
  const plain = await painted(await rect('plain', 'output'), ink);
  const many = await painted(await rect('many', 'output'), ink);
  expect(plain, 'the diamond paints at 7/10 of its width').toBeGreaterThanOrEqual(6);
  expect(Math.abs(many - plain), `the many row's output paints ${many}px, the plain row's ${plain}px`).toBeLessThanOrEqual(1);
  const sizes = {
    plainIn: (await rect('plain', 'input')).h, plainOut: (await rect('plain', 'output')).h,
    manyIn: (await rect('many', 'input')).h, manyOut: (await rect('many', 'output')).h,
    forkIn: (await rect('fork', 'input')).h, forkOut: (await rect('fork', 'output')).h, forkFalse: (await rect('fork', 'false')).h,
  };
  expect(sizes).toEqual({ plainIn: 16, plainOut: 16, manyIn: 32, manyOut: 16, forkIn: 32, forkOut: 16, forkFalse: 16 });
});

test('the handle shows on hover at the bottom right, hides without it, and shows on focus', async ({ page }) => {
  await page.mouse.move(2, 2);
  expect((await handle(page, 'big')).visible).toBe(false);
  const b = await box(page, 'big');
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  const h = await handle(page, 'big');
  expect(h.visible).toBe(true);
  expect(Math.abs(h.x - (b.x + b.w))).toBeLessThanOrEqual(16);
  expect(Math.abs(h.y - (b.y + b.h))).toBeLessThanOrEqual(16);
  await page.mouse.move(2, 2);
  expect((await handle(page, 'big')).visible).toBe(false);
  await page.evaluate(() => (document.getElementById('big')!.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  expect((await handle(page, 'big')).visible).toBe(true);
});

async function dragHandle(page: Page, dx: number, dy: number, key?: string): Promise<void> {
  const b = await box(page, 'big');
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  const h = await handle(page, 'big');
  if (key) await page.keyboard.down(key);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + dx / 2, h.y + dy / 2, { steps: 3 });
  await page.mouse.move(h.x + dx, h.y + dy, { steps: 3 });
  await page.mouse.up();
  if (key) await page.keyboard.up(key);
  await page.evaluate(() => window.__settled());
}

test('a drag resizes non-uniformly, the primary key keeps the aspect, and each way stops at 100% and 200%', async ({ page }) => {
  const nat = await box(page, 'big');
  const heard = await page.evaluate(() => { const h: unknown[] = []; document.getElementById('big')!.addEventListener('node-resize', (e) => h.push((e as CustomEvent).detail)); (window as never as { heard: unknown[] }).heard = h; return h.length; });
  expect(heard).toBe(0);
  await dragHandle(page, 60, 20);
  const a = await box(page, 'big');
  expect(a.w).toBeCloseTo(nat.w + 60, 0);
  expect(a.h).toBeCloseTo(nat.h + 20, 0);
  expect(await page.evaluate(() => (window as never as { heard: unknown[] }).heard.length)).toBeGreaterThan(0);
  // The aspect kept: the shape (w / h) stays what it was after the first drag.
  await dragHandle(page, 40, 5, mod);
  const c = await box(page, 'big');
  expect(c.w / c.h).toBeCloseTo(a.w / a.h, 1);
  expect(c.w).toBeGreaterThan(a.w);
  // Stops at double, each way.
  await dragHandle(page, 400, 100);
  const max = await box(page, 'big');
  expect(max.w).toBeCloseTo(nat.w * 2, 0);
  expect(max.h).toBeCloseTo(nat.h * 2, 0);
  // And at its natural size.
  await dragHandle(page, -600, -90);
  const min = await box(page, 'big');
  expect(min.w).toBeCloseTo(nat.w, 0);
  expect(min.h).toBeCloseTo(nat.h, 0);
});

test('Alt and an arrow on the header grows it a tenth, held to the limits', async ({ page }) => {
  const nat = await box(page, 'big');
  await page.evaluate(() => (document.getElementById('big')!.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  await page.keyboard.press('Alt+ArrowRight');
  expect((await box(page, 'big')).w).toBeCloseTo(nat.w * 1.1, 0);
  await page.keyboard.press('Alt+ArrowLeft');
  await page.keyboard.press('Alt+ArrowLeft');
  expect((await box(page, 'big')).w).toBeCloseTo(nat.w, 0);
});

/* ── In the editor: routes follow, the size is saved, Undo gives it back ── */
const BIND = `async () => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const flow = { v: 2, id: 'g', nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
    { id: 'sort', kind: 'sort', x: 360, y: 0, values: { field: 'status', direction: 'asc' } },
    { id: 'end', kind: 'output', x: 700, y: 0 },
  ], routes: [{ from: 'start/rows', to: 'sort' }] };
  const canvas = document.getElementById('cv');
  window.ed = bindWorkflow(canvas, flow, { session: new SessionStore(), toolbar: canvas.querySelector('sherpa-node-toolbar'),
    fieldsOf: { users: { status: { label: 'Status', values: ['active'] } } }, stores: ['users'] });
  await window.__settled();
  canvas.zoomTo(0.8);
  canvas.panTo(40, 60);
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}`;

test('in the editor a resize is one step, saved as size beside x and y, with the routes still on their sockets; Undo gives it back', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('#root sherpa-layout-canvas')!.remove(); });
  await page.evaluate(() => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 520px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>');
    return customElements.whenDefined('sherpa-node-toolbar');
  });
  await page.evaluate(`(${BIND})()`);
  // The setting "Allow resizing nodes", as the provider hands it on.
  await page.evaluate(() => document.querySelectorAll('#cv > sherpa-node').forEach((n) => n.setAttribute('data-resizable', '')));
  await page.evaluate(() => document.getElementById('cv')!.scrollIntoView({ block: 'start' }));
  const wf = () => page.evaluate(() => JSON.stringify((window as never as { ed: { workflow(): { nodes: unknown[] } } }).ed.workflow().nodes));
  const was = await wf();
  const node = '#cv > sherpa-node[data-heading="Source"]';
  const b = await page.locator(node).boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
  const h = await page.locator(node).evaluate((el) => { const r = el.shadowRoot!.querySelector('.resize')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + 30, h.y + 20, { steps: 4 });
  await page.mouse.move(h.x + 60, h.y + 40, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => window.__settled().then(() => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)))));
  const now = JSON.parse(await wf());
  expect(now[0].size.w).toBeGreaterThan(1);
  expect(now[0].size.h).toBeGreaterThan(1);
  expect(now[0].x).toBe(0);
  // The route leaves from the socket: its start is on the socket's box, within 2px.
  const gap = await page.evaluate(() => {
    const path = document.querySelector<SVGPathElement>('#cv svg.graph-routes path[data-from]')!;
    const p = path.getPointAtLength(0).matrixTransform(path.getScreenCTM()!);
    const row = document.querySelector('#cv > sherpa-node[data-heading="Source"] sherpa-node-row') as Node;
    const s = row.socketRect('output')!;
    return Math.hypot(p.x - (s.left + s.width / 2), p.y - (s.top + s.height / 2));
  });
  expect(gap).toBeLessThanOrEqual(2);
  // Undo: ONE step puts the size back.
  await page.keyboard.press(`${mod}+z`);
  await page.evaluate(() => window.__settled());
  expect(await wf()).toBe(was);
  expect(await page.locator(node).evaluate((el) => el.hasAttribute('data-scale-w'))).toBe(false);
});

test('in forced colours the handle keeps its shape and the shapes stay', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  const b = await box(page, 'big');
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  const r = await page.evaluate(() => getComputedStyle(document.getElementById('big')!.shadowRoot!.querySelector('.resize')!).visibility);
  expect(r).toBe('visible');
});

test('resizing is a setting: off, a node has no handle and Alt+Arrow does nothing, yet a saved size still draws; on, the handle works', async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.querySelector('#root sherpa-layout-canvas')!;
    el.insertAdjacentHTML('beforeend', '<sherpa-node id="plain" data-heading="Plain" data-x="400" data-y="300"></sherpa-node><sherpa-node id="kept" data-heading="Kept" data-scale-w="1.5" data-x="650" data-y="300"></sherpa-node>');
    await (document.getElementById('plain') as Node).rendered;
    await (document.getElementById('kept') as Node).rendered;
    await window.__settled();
  });
  const b = await box(page, 'plain');
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  const off = await page.evaluate(() => {
    const h = document.getElementById('plain')!.shadowRoot!.querySelector('.resize') as HTMLElement;
    return { shown: h.checkVisibility({ checkVisibilityCSS: true }), w: document.getElementById('plain')!.offsetWidth };
  });
  expect(off.shown).toBe(false);
  await page.locator('#plain').evaluate((n) => (n.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  await page.keyboard.press('Alt+ArrowRight');
  await page.evaluate(() => window.__settled());
  expect(await page.evaluate(() => document.getElementById('plain')!.offsetWidth)).toBe(off.w);
  expect(await page.evaluate(() => document.getElementById('plain')!.hasAttribute('data-scale-w'))).toBe(false);
  // A saved size is data: it draws.
  const kept = await page.evaluate(() => [document.getElementById('kept')!.offsetWidth, document.getElementById('plain')!.offsetWidth]);
  expect(kept[0]).toBeGreaterThan(kept[1]! * 1.4);
  // On: Alt+Arrow grows it.
  await page.evaluate(() => document.getElementById('plain')!.setAttribute('data-resizable', ''));
  await page.locator('#plain').evaluate((n) => (n.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  await page.keyboard.press('Alt+ArrowRight');
  await page.evaluate(() => window.__settled());
  expect(await page.evaluate(() => document.getElementById('plain')!.offsetWidth)).toBeGreaterThan(off.w);
});

// — 756: every category, picked, takes the SAME active fill and border; the panel's node adds the same ring.
const CATS = { Sources: 'source', Variables: 'value', Logic: 'condition', Organise: 'sort', Output: 'output', 'Custom Nodes': 'mine', AI: 'agent' } as const;
async function bindCategories(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.evaluate(async (cats) => {
    document.querySelector('#root sherpa-layout-canvas')!.remove();
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1200px; block-size: 720px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    const canvas = document.getElementById('cv') as Canvas;
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { useOf } = await import('/dist/data.js');
    const body = { v: 1, inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'out', label: 'Out', type: 'object' }], nodes: [], routes: [{ from: '#in/rows', to: '#out/out' }] };
    const library = { v: 1, nodes: { mine: { ...body, label: 'Mine' }, agent: { ...body, label: 'Agent', category: 'AI' } } };
    const nodes = Object.entries(cats).map(([heading, kind], i) => {
      // The second row below the first's tallest, a Condition with its Operation row.
      const at = { id: kind, x: (i % 4) * 290, y: i < 4 ? 0 : 460, heading };
      return kind in library.nodes ? { ...useOf(library as never, kind, at), heading } : { kind, ...at };
    });
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, { v: 2, id: 'cats', nodes } as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, library: library as never, stores: ['users'],
    });
    await window.__settled();
    // At zoom 1 a border is one whole pixel, so its ink reads true.
    canvas.zoomTo(1);
    canvas.panTo(20, 20);
    canvas.scrollIntoView({ block: 'start' });
    await new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
  }, CATS);
}
/** A card's fill, inside its bottom padding; its top edge's middle, the pixel there least like the fill (no socket
 *  and no corner is there); and just inside that edge, where a ring is. */
async function look(page: Page, heading: string): Promise<{ fill: Rgb; edge: Rgb; ring: Rgb }> {
  const b = await page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).evaluate((n) => {
    const r = n.shadowRoot!.querySelector('.root')!.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const shot = await page.screenshot({ clip: { x: b.x - 3, y: b.y - 3, width: b.width + 6, height: b.height + 6 } });
  return page.evaluate(async ([b64, w, h]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    const k = img.width / (w + 6);
    const at = (x: number, y: number): [number, number, number] => [...c.getImageData(Math.round((x + 3) * k), Math.round((y + 3) * k), 1, 1).data].slice(0, 3) as [number, number, number];
    const fill = at(w / 2, h - 7);
    const far = (p: number[]): number => Math.max(...p.map((v, i) => Math.abs(v - fill[i]!)));
    const strip = Array.from({ length: Math.round(5 * k) }, (_, i) => at(w / 2, -2 + i / k));
    const edge = strip.reduce((best, p) => (far(p) > far(best) ? p : best));
    return { fill, edge, ring: at(w / 2, 1) };
  }, [shot.toString('base64'), b.width, b.height] as const);
}

test('756: picked by the pointer, every category takes the same active fill and border; at rest, its own; the panel\'s node, the same ring', async ({ page }) => {
  await bindCategories(page);
  const names = Object.keys(CATS);
  await page.mouse.move(2, 2);
  const rest = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await look(page, n)] as const)));
  // Each picked with Shift, by its header: all of them picked, the first in the panel.
  await page.keyboard.down('Shift');
  for (const n of names) {
    const b = (await page.locator(`#cv > sherpa-node[data-heading="${n}"]`).boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + 6);
  }
  await page.keyboard.up('Shift');
  await page.mouse.move(2, 2);
  await page.evaluate(() => window.__settled());
  await expect(page.locator('#cv > sherpa-node[data-current]')).toHaveCount(names.length);
  const active = await inkOf(page, '--sherpa-style-active-surface-base');
  const shown = await page.locator('#cv > sherpa-node[data-active]').getAttribute('data-heading');
  const picked = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await look(page, n)] as const)));
  for (const n of names) {
    // The ringed one's fill is read inside its ring, so every node's is the active pin's fill.
    expect(near(picked[n]!.fill, active), `${n}: fill ${picked[n]!.fill} is the active ${active}`).toBe(true);
    if (n === shown) continue;
    expect(near(picked[n]!.edge, picked['Logic']!.edge, 12), `${n}: edge ${picked[n]!.edge} as a Logic node's ${picked['Logic']!.edge}`).toBe(true);
    expect(near(picked[n]!.edge, rest[n]!.edge, 30), `${n}: picked edge differs from its rest ${rest[n]!.edge}`).toBe(false);
  }
  // At rest each keeps its own: Sources and Output are not the active fill.
  for (const n of ['Sources', 'Custom Nodes', 'Output', 'Logic']) expect(near(rest[n]!.fill, active), `${n} at rest`).toBe(false);
  // The panel's node, by its tab: the same accent ring, whichever category.
  const ring = await inkOf(page, '--sherpa-theme-border-accent-2');
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  for (const [i, n] of names.entries()) {
    const tab = await page.locator('#inspector sherpa-tabs').evaluate((el, k) => { const r = el.shadowRoot!.querySelectorAll('.tab')[k]!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, i);
    await page.mouse.click(tab.x, tab.y);
    await page.mouse.move(2, 2);
    await page.evaluate(() => window.__settled());
    await expect(page.locator('#cv > sherpa-node[data-active]')).toHaveAttribute('data-heading', n);
    const got = await look(page, n);
    expect(near(got.ring, ring, 24), `${n}: ringed ${got.ring}, the accent ${ring}`).toBe(true);
  }
  // The first, out of the panel now, has the same edge as the rest.
  const first = await look(page, shown!);
  expect(near(first.edge, picked['Logic']!.edge, 12), `${shown}: edge ${first.edge} as a Logic node's ${picked['Logic']!.edge}`).toBe(true);
});

test('756: in forced colours a picked node of every category is edged in Highlight', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit cannot emulate forced colours');
  await page.emulateMedia({ forcedColors: 'active' });
  await bindCategories(page);
  // Highlight as the page paints it: a square of it, read as pixels.
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div id="hl" style="position: fixed; inset: 0 auto auto 0; inline-size: 8px; block-size: 8px; background: Highlight"></div>'));
  const [highlight] = await paint(page, { x: 0, y: 0, w: 8, h: 8 }, [[.5, .5]]);
  await page.mouse.move(2, 2);
  const rest = await look(page, 'Sources');
  expect(near(rest.edge, highlight!, 60)).toBe(false);
  await page.keyboard.down('Shift');
  for (const n of Object.keys(CATS)) {
    const b = (await page.locator(`#cv > sherpa-node[data-heading="${n}"]`).boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + 6);
  }
  await page.keyboard.up('Shift');
  await page.mouse.move(2, 2);
  await page.evaluate(() => window.__settled());
  const shown = await page.locator('#cv > sherpa-node[data-active]').getAttribute('data-heading');
  for (const n of Object.keys(CATS)) {
    const { edge } = await look(page, n);
    // The panel's node is ringed in its forced colour instead.
    if (n !== shown) expect(near(edge, highlight!, 60), `${n} edged ${edge} in Highlight ${highlight}`).toBe(true);
  }
});
