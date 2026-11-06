import { test, expect, type Page } from './harness';

/**
 * Node polish — Will, TODO 743. A fork's footer keeps its False SOCKET and loses the word; a socket's tip hangs
 * beside its socket, panned and zoomed; Backspace and Delete remove
 * the picked nodes and their routes as ONE step; the Pan tool's icon is four arrows. Real pointer and key; pixels.
 */
const ORG = {
  v: 1, label: 'Org permissions', category: 'Logic',
  inputs: [{ name: 'users', label: 'Users', type: 'object' }, { name: 'role', label: 'Role', type: 'value', control: 'text', default: 'admin' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'role', kind: 'field', x: 0, y: 0, values: { field: 'role' } }, { id: 'has-role', kind: 'condition', x: 360, y: 0, values: { type: 'eq' } }],
  routes: [
    { from: '#in/users', to: 'role' }, { from: 'role/field', to: 'has-role' }, { from: '#in/role', to: 'has-role/b' },
    { from: 'has-role/rows', to: '#out/allowed' }, { from: 'has-role', to: '#out' },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (org) => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-app-header id="trail"><sherpa-breadcrumbs slot="breadcrumbs"></sherpa-breadcrumbs></sherpa-app-header>
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px"><sherpa-overlay-panel slot="panel" open data-heading="Nodes" data-padding="none" style="display: none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>
      <sherpa-dialog id="confirm" data-status="critical" data-heading="Update">
        <p style="margin: 0"></p>
        <sherpa-container-footer slot="footer"><sherpa-button>Cancel</sherpa-button><sherpa-button data-look="saturated">Update</sherpa-button></sherpa-container-footer>
      </sherpa-dialog>`);
    await customElements.whenDefined('sherpa-node-list');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    (window as unknown as { ORG: unknown }).ORG = org;
  }, ORG);
});

/** Bind a workflow with two uses of Org permissions and a preset; `saved` collects what Save hands over. */
const bind = (page: Page) => page.evaluate(async () => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const { useOf } = await import('/dist/data.js');
  const org = (window as unknown as { ORG: Record<string, unknown> }).ORG;
  const library = {
    v: 1,
    nodes: {
      'org-permissions': structuredClone(org),
      'owner-check': { ...structuredClone(org), label: 'Owner check', preset: true },
    },
  };
  const at = (id: string, kind: string, x: number, y: number) => useOf(library as never, kind, { id, x, y });
  const flow = {
    v: 2, id: 'g',
    nodes: [
      { id: 'start', kind: 'source', x: 420, y: 40, values: { store: 'users' } },
      at('perm', 'org-permissions', 800, 40), at('perm2', 'org-permissions', 800, 360), at('own', 'owner-check', 420, 360),
      { id: 'end', kind: 'output', x: 1200, y: 40 },
    ],
    routes: [{ from: 'start/rows', to: 'perm/users' }, { from: 'start/rows', to: 'perm2/users' }, { from: 'perm', to: 'end' }],
  };
  const w = window as unknown as Record<string, unknown>;
  w['saved'] = [];
  w['savedNodes'] = [];
  document.addEventListener('definition-save', (e) => (w['saved'] as unknown[]).push((e as CustomEvent).detail.definition));
  const canvas = document.getElementById('cv')!;
  w['ed'] = bindWorkflow(canvas as never, flow as never, {
    session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
    header: document.getElementById('trail') as never, confirm: document.getElementById('confirm') as never, library: library as never,
    onSaveNode: (id: string, d: unknown) => (w['savedNodes'] as unknown[]).push([id, d]),
    fieldsOf: { users: { status: { label: 'Status', values: ['active', 'trial'] }, role: { label: 'Role' } } }, stores: ['users'],
  });
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
});
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
/** A node's header, by its heading. */
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);


const primary = (page: Page) => page.evaluate(() => /mac|iphone|ipad/i.test(navigator.platform) ? 'Meta' : 'Control');
const rectOf = (page: Page, sel: string, inner?: string) => page.evaluate(([s, i]) => {
  const el = document.querySelector(s!)!;
  const r = (i ? el.shadowRoot!.querySelector(i)! : el).getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, [sel, inner]);
const gapBetween = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h));
const flow = (page: Page) => page.evaluate(() => (window as never as { ed: { workflow(): { nodes: { id: string }[]; routes?: unknown[] } } }).ed.workflow());

test('a fork shows no False word, and keeps its False socket', async ({ page }) => {
  await bind(page);
  await page.evaluate(() => (window as never as { ed: { open(id: string): void } }).ed.open('perm'));
  await settle(page);
  const cond = await page.locator('#cv > sherpa-node[data-heading="Condition"]').evaluate((n) => {
    const f = n.shadowRoot!.querySelector('.footer') as HTMLElement;
    return { text: (n as HTMLElement).innerText + f.innerText, sock: n.shadowRoot!.querySelector('.socket-false')!.getBoundingClientRect().width };
  });
  expect(cond.text).not.toMatch(/False/);
  expect(cond.sock).toBeGreaterThan(8);
});

test('a socket tip sits beside its socket on hover, after a pan and a zoom, never at the viewport corner', async ({ page }) => {
  await bind(page);
  for (const [zoom, px, py] of [[0.6, 0, 0], [0.5, 40, 150], [0.7, -100, 20]] as const) {
    await page.evaluate(([z, x, y]) => {
      const cv = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
      cv.zoomTo(z!);
      cv.panTo(x!, y!);
    }, [zoom, px, py]);
    await settle(page);
    let tested = 0;
    for (const side of ['out', 'in']) {
      const node = side === 'out' ? '#cv > sherpa-node[data-heading="Source"]' : '#cv > sherpa-node[data-heading="Output"]';
      const sock = await rectOf(page, node, `.header .socket-${side}`);
      if (sock.x < 0 || sock.y < 90 || sock.x > 880 || sock.y > 680) continue;
      tested++;
      await page.mouse.move(sock.x + sock.w / 2, sock.y + sock.h / 2);
      const tip = `.header .tip-${side}`;
      await expect.poll(() => page.evaluate(([n, t]) => document.querySelector(n!)!.shadowRoot!.querySelector(t!)!.matches(':popover-open'), [node, tip])).toBe(true);
      const t = await rectOf(page, node, tip);
      expect(gapBetween(sock, t), `${side} at zoom ${zoom}`).toBeLessThanOrEqual(12);
      expect(t.x > 40 || t.y > 20, 'not at the viewport corner').toBe(true);
      await page.mouse.move(-1, -1);
    }
    expect(tested, `zoom ${zoom}`).toBeGreaterThan(0);
  }
});

test('Delete and Backspace remove the picked nodes and their routes as ONE step; Undo restores; not in a text field', async ({ page }) => {
  await bind(page);
  await page.evaluate(() => (document.getElementById('cv') as HTMLElement & { fit(): void }).fit());
  await settle(page);
  const before = await flow(page);
  await header(page, 'Output').click();
  await page.keyboard.down('Shift');
  await header(page, 'Source').click();
  await page.keyboard.up('Shift');
  await page.keyboard.press('Delete');
  await settle(page);
  const after = await flow(page);
  expect(after.nodes.map((n) => n.id)).not.toContain('start');
  expect(after.nodes.map((n) => n.id)).not.toContain('end');
  expect(after.routes ?? []).toHaveLength(0);
  await page.keyboard.press(`${await primary(page)}+z`);
  await settle(page);
  expect(await flow(page)).toEqual(before);
  // With no pointer: Enter picks the node the keys are on, and Backspace removes it.
  await header(page, 'Output').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Backspace');
  await settle(page);
  expect((await flow(page)).nodes.map((n) => n.id)).not.toContain('end');
  await page.keyboard.press(`${await primary(page)}+z`);
  await settle(page);
  // A text field keeps its Backspace.
  await header(page, 'Source').focus();
  await page.keyboard.press('Enter');
  // The inspector's own Name field: a real text input.
  const name = page.locator('#inspector sherpa-input-text[name="#heading"] input');
  await name.click();
  await page.keyboard.press('Backspace');
  await settle(page);
  expect((await flow(page)).nodes.map((n) => n.id)).toContain('start');
});

test('a Group Input cannot be removed, and says so', async ({ page }) => {
  await bind(page);
  await page.evaluate(async () => {
    const { onReport } = await import('/dist/data.js');
    const heard: string[] = [];
    (window as never as { heard: string[] }).heard = heard;
    onReport((r) => heard.push(r.code));
    (window as never as { ed: { open(id: string): void } }).ed.open('perm');
  });
  await settle(page);
  await header(page, 'Group Input').click();
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await page.evaluate(() => (window as never as { heard: string[] }).heard)).toContain('node-remove');
  expect(await page.locator('#cv > sherpa-node[data-heading="Group Input"]').count()).toBe(1);
});

test('the Query editor refuses to remove a node, in words, once', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('cv')!.remove();
    document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="q" style="inline-size: 1100px; block-size: 700px"></sherpa-layout-canvas>');
    const q = document.getElementById('q') as HTMLElement & { rendered: Promise<void> };
    await q.rendered;
    const { bindQueryEditor } = await import('/dist/app.js');
    const { readingsOf, onReport } = await import('/dist/data.js');
    const heard: string[] = [];
    (window as never as { heard: string[] }).heard = heard;
    onReport((r) => heard.push(r.code));
    const query = Object.assign(new EventTarget(), {
      draft: { v: 1, scopes: { view: { holds: ['region'], readings: readingsOf({ region: { in: ['EMEA'] } }) } } },
      ask: () => undefined, presets: () => [], applied: { v: 1, scopes: {} },
    });
    bindQueryEditor(q as never, { query } as never, { definition: { v: 1, id: 'records', source: { store: 'customers' } } });
    await window.__settled();
  });
  await settle(page);
  await page.locator('#q > sherpa-node .header[role="button"]').first().click();
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await page.evaluate(() => (window as never as { heard: string[] }).heard.filter((c) => c === 'query-remove'))).toEqual(['query-remove']);
  expect(await page.locator('#q > sherpa-node').count()).toBeGreaterThan(0);
});

test('the Pan tool draws four arrows', async ({ page }) => {
  await bind(page);
  const name = await page.locator('#cv').evaluate((cv) => cv.shadowRoot!.querySelector('.pan')!.getAttribute('data-icon-start'));
  expect(name).toBe('arrows-up-down-left-right');
  const drawn = await page.locator('#cv').evaluate(async (cv) => {
    await window.__settled();
    const b = cv.shadowRoot!.querySelector('.pan') as HTMLElement;
    return !!b.shadowRoot!.querySelector('svg path');
  });
  expect(drawn).toBe(true);
  expect(await page.locator('#cv').evaluate((cv) => cv.shadowRoot!.querySelector('.pan')!.getAttribute('aria-pressed'))).toBe('false');
});

const socketAt = (page: Page, node: string, side: 'in' | 'out', row?: string) => page.evaluate(([n, s, r]) => {
  const el = document.querySelector(n!)!;
  const host = r ? el.querySelector(r.startsWith('[') ? `sherpa-node-row:has(${r})` : `sherpa-node-row[data-label="${r}"], sherpa-node-row:nth-of-type(${r})`)! : el;
  const q = (host as HTMLElement & { socketRect(side: string): DOMRect | null }).socketRect(s === 'in' ? 'input' : 'output')!;
  return [q.left + q.width / 2, q.top + q.height / 2, q.width, q.height] as [number, number, number, number];
}, [node, side, row]);
const STORE = '#cv > sherpa-node[data-heading="Source"]';
/** Its Rows leave from the Store row. */
const STORE_ROW = '[name="store"]';

test('a press just outside the drawn socket starts a connector; a drop 10px off an input connects', async ({ page }) => {
  await bind(page);
  await page.evaluate(() => (document.getElementById('cv') as HTMLElement & { fit(): void }).fit());
  await settle(page);
  const [ox, oy, w] = await socketAt(page, STORE, 'out', STORE_ROW);
  // 16px drawn, at the canvas's zoom.
  const zoom = await page.evaluate(() => (document.getElementById('cv') as HTMLElement & { view: { zoom: number } }).view.zoom);
  expect(w).toBeCloseTo(16 * zoom, 0);
  // 5px past the drawn edge, inside the 28px hit area.
  await page.mouse.move(ox + (8 + 5) * zoom, oy);
  await page.mouse.down();
  await page.mouse.move(ox + 40, oy + 40, { steps: 3 });
  expect(await page.evaluate(() => !!document.querySelector('#cv svg .graph-draft'))).toBe(true);
  await page.mouse.up();
  await settle(page);
  // Source's rows -> Sort's input, dropped 10px left of the input's centre.
  const sortIn = await page.evaluate(() => {
    const n = document.querySelector('#cv > sherpa-node[data-heading="Org permissions"]') as HTMLElement & { socketRect(s: string): DOMRect };
    const r = n.socketRect('input');
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  const before = (await flow(page)).routes!.length;
  await page.mouse.move(ox, oy);
  await page.mouse.down();
  await page.mouse.move(sortIn[0]! - 30, sortIn[1]!, { steps: 4 });
  await page.mouse.move(sortIn[0]! - 10, sortIn[1]!, { steps: 3 });
  await page.mouse.up();
  await settle(page);
  expect((await flow(page)).routes!.length).toBe(before + 1);
});

test('a taller node spreads its rows evenly, and its routes still end on their sockets', async ({ page }) => {
  await bind(page);
  await page.evaluate(() => (window as never as { ed: { open(id: string): void } }).ed.open('perm'));
  await settle(page);
  const node = '#cv > sherpa-node[data-heading="Condition"]';
  const tops = () => page.locator(`${node} sherpa-node-row`).evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect().top));
  const was = await tops();
  await page.locator(node).evaluate((n) => n.setAttribute('data-scale-h', '1.6'));
  await settle(page);
  const now = await tops();
  const moved = now.map((t, i) => t - was[i]!);
  expect(moved[0]).toBeCloseTo(0, 0);
  const step = moved[1]!;
  expect(step).toBeGreaterThan(2);
  moved.forEach((m, i) => expect(Math.abs(m - i * step), `row ${i}`).toBeLessThanOrEqual(1));
  // A route's end is on its socket.
  const gap = await page.evaluate(() => {
    const path = [...document.querySelectorAll<SVGPathElement>('#cv svg.graph-routes path[data-from]')].find((p) => p.dataset['to']?.startsWith('has-role/b'))!;
    const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM()!);
    const row = document.querySelector('#cv > sherpa-node[data-heading="Condition"] sherpa-node-row:has([name="b"])') as HTMLElement & { socketRect(s: string): DOMRect };
    const s = row.socketRect('input');
    return Math.hypot(end.x - (s.left + s.width / 2), end.y - (s.top + s.height / 2));
  });
  expect(gap).toBeLessThanOrEqual(2);
});

test('a row the graph feeds reads read only, not inactive: the same fill as an editable field, and not the disabled one', async ({ page }) => {
  await bind(page);
  await page.evaluate(() => (window as never as { ed: { open(id: string): void } }).ed.open('perm'));
  await settle(page);
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#cv > sherpa-node[data-heading="Condition"] sherpa-node-row')];
    const fed = rows.find((x) => x.hasAttribute('data-input-routed') && x.querySelector('sherpa-input-text'))!.querySelector('sherpa-input-text') as HTMLElement;
    const free = rows.find((x) => !x.hasAttribute('data-input-routed') && x.querySelector('sherpa-input-text'))!.querySelector('sherpa-input-text') as HTMLElement;
    const fill = (el: HTMLElement) => getComputedStyle(el.shadowRoot!.querySelector('.control-row, .control')!).backgroundColor;
    return { fedReadonly: fed.hasAttribute('readonly'), fedDisabled: fed.matches(':disabled') || fed.hasAttribute('disabled'), fedFill: fill(fed), freeFill: fill(free) };
  });
  expect(r.fedReadonly).toBe(true);
  expect(r.fedDisabled).toBe(false);
  expect(r.fedFill).toBe(r.freeFill);
});
