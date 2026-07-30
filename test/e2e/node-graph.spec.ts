import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

const settle = () => new Promise((r) => setTimeout(r, 150));

/* ── sherpa-node ───────────────────────────────────────────────── */

test('sherpa-node mirrors data-x/data-y to CSS vars and fires node-pointerdown', async ({ page }) => {
  await mount(page, `<sherpa-node data-kind="source" data-node-id="n1" data-x="120" data-y="60"></sherpa-node>`, 'sherpa-node');
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-node')! as HTMLElement;
    const sr = el.shadowRoot!;
    let detail: any = null;
    el.addEventListener('node-pointerdown', (e: any) => (detail = e.detail));
    const node = sr.querySelector('.node') as HTMLElement;
    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return {
      kind: el.dataset['kind'],
      x: el.style.getPropertyValue('--sherpa-node-x'),
      y: el.style.getPropertyValue('--sherpa-node-y'),
      detailNodeId: detail?.nodeId,
    };
  });
  expect(r.kind).toBe('source');
  expect(r.x).toBe('120px');
  expect(r.y).toBe('60px');
  expect(r.detailNodeId).toBe('n1');
});

/* ── sherpa-node-row ───────────────────────────────────────────── */

test('sherpa-node-row header variant drill button fires node-drilldown with nodeId', async ({ page }) => {
  await mount(page, `
    <sherpa-node data-kind="group" data-node-id="grp1">
      <sherpa-node-row slot="header" data-variant="header" data-drill-down>
        <span slot="title">Group A</span>
      </sherpa-node-row>
    </sherpa-node>
  `, 'sherpa-node');
  await settle();
  const r = await page.evaluate(() => {
    const node = document.querySelector('sherpa-node')!;
    const row = document.querySelector('sherpa-node-row')! as HTMLElement;
    let detail: any = null;
    node.addEventListener('node-drilldown', (e: any) => (detail = e.detail));
    const btn = row.shadowRoot!.querySelector('.drill-down') as HTMLElement;
    return {
      variant: row.dataset['variant'],
      hasBtn: !!btn,
      detail: (() => { btn.click(); return detail; })(),
    };
  });
  expect(r.variant).toBe('header');
  expect(r.hasBtn).toBe(true);
  expect(r.detail).toEqual({ nodeId: 'grp1' });
});

/* ── sherpa-node-socket ────────────────────────────────────────── */

test('sherpa-node-socket in/out variants; pointerdown fires socket-pointerdown', async ({ page }) => {
  await mount(page, `<sherpa-node-socket data-direction="out" data-variant="single" data-port-name="result"></sherpa-node-socket>`, 'sherpa-node-socket');
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-node-socket')! as HTMLElement;
    const sr = el.shadowRoot!;
    let detail: any = null;
    el.addEventListener('socket-pointerdown', (e: any) => (detail = e.detail));
    const btn = sr.querySelector('.socket') as HTMLElement;
    // primary button (button:0) required by the handler
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    return {
      direction: el.dataset['direction'],
      portName: el.dataset['portName'],
      detail,
    };
  });
  expect(r.direction).toBe('out');
  expect(r.portName).toBe('result');
  expect(r.detail).toMatchObject({ direction: 'out', portName: 'result', status: 'default' });
});

test('sherpa-node-socket multiple variant mirrors to legacy data-multi', async ({ page }) => {
  await mount(page, `<sherpa-node-socket data-direction="in" data-variant="multiple" data-port-name="inputs"></sherpa-node-socket>`, 'sherpa-node-socket');
  await settle();
  const hasMulti = await page.evaluate(() => document.querySelector('sherpa-node-socket')!.hasAttribute('data-multi'));
  expect(hasMulti).toBe(true);
});

/* ── sherpa-node-canvas ────────────────────────────────────────── */

test('sherpa-node-canvas renders surface + layers and exposes a working viewport API', async ({ page }) => {
  await mount(page, `<sherpa-node-canvas style="display:block;width:600px;height:400px"></sherpa-node-canvas>`, 'sherpa-node-canvas');
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-node-canvas')! as HTMLElement & {
      getViewport: () => { x: number; y: number; zoom: number };
      setViewport: (v: { x?: number; y?: number; zoom?: number }) => void;
    };
    const sr = el.shadowRoot!;
    const before = el.getViewport();
    el.setViewport({ x: 40, y: 20, zoom: 1.5 });
    const after = el.getViewport();
    return {
      hasSurface: !!sr.querySelector('.surface'),
      hasGrid: !!sr.querySelector('.layer.grid'),
      hasEdges: !!sr.querySelector('.layer.edges'),
      before,
      after,
    };
  });
  expect(r.hasSurface).toBe(true);
  expect(r.hasGrid).toBe(true);
  expect(r.hasEdges).toBe(true);
  expect(r.before).toEqual({ x: 0, y: 0, zoom: 1 });
  expect(r.after).toEqual({ x: 40, y: 20, zoom: 1.5 });
});

test('sherpa-node-canvas selects a slotted node on node-pointerdown, firing node-select', async ({ page }) => {
  await mount(page, `
    <sherpa-node-canvas style="display:block;width:600px;height:400px">
      <sherpa-node data-kind="source" data-node-id="a" data-x="50" data-y="50"></sherpa-node>
    </sherpa-node-canvas>
  `, 'sherpa-node-canvas');
  await settle();
  const r = await page.evaluate(() => {
    const canvas = document.querySelector('sherpa-node-canvas')! as HTMLElement;
    const node = document.querySelector('sherpa-node')! as HTMLElement;
    let detail: any = null;
    canvas.addEventListener('node-select', (e: any) => (detail = e.detail));
    // Clicking the node body emits node-pointerdown → canvas.setSelectedNode.
    const inner = node.shadowRoot!.querySelector('.node') as HTMLElement;
    inner.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    return {
      detail,
      selected: node.hasAttribute('data-selected'),
    };
  });
  expect(r.detail).toEqual({ nodeId: 'a' });
  expect(r.selected).toBe(true);
});
