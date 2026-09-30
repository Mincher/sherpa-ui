import { test, expect } from '@playwright/test';

/**
 * sherpa-overlay-panel on the reforged base — a NON-modal floating panel on
 * native <dialog>.show(). Proves show()/close() drive dialog.open + the
 * reflected `open` attribute, that the open dialog is non-modal (no ::backdrop
 * pseudo painted → the page stays interactive), and that closing fires a
 * composed `close`.
 */

const HARNESS = '/test/reforged/harness.html';

type PanelEl = HTMLElement & {
  rendered?: Promise<void>;
  open?: boolean;
  show?: () => void;
  close?: () => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('show() opens non-modally and reflects open; close() closes it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as PanelEl;
    el.innerHTML = '<div slot="header">Filters</div><p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const dialog = el.shadowRoot!.querySelector<HTMLDialogElement>('.root')!;

    el.show!();
    // Non-modal: the dialog is open but NOT the top-layer modal, so
    // matches(':modal') is false (showModal would make it true).
    const opened = {
      prop: el.open,
      native: dialog.open,
      attr: el.hasAttribute('open'),
      modal: dialog.matches(':modal'),
    };
    el.close!();
    const closed = { prop: el.open, native: dialog.open, attr: el.hasAttribute('open') };
    return { opened, closed };
  });
  expect(r.opened.prop).toBe(true);
  expect(r.opened.native).toBe(true);
  expect(r.opened.attr).toBe(true);
  expect(r.opened.modal).toBe(false); // non-modal floating panel
  expect(r.closed).toEqual({ prop: false, native: false, attr: false });
});

test('closing the panel fires a composed close event', async ({ page }) => {
  const fired = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as PanelEl;
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let count = 0;
    el.addEventListener('panel-close', () => count++);
    el.show!();
    el.close!();
    // The native <dialog> close event is dispatched on a task — let it flush.
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return count;
  });
  expect(fired).toBe(1);
});

/**
 * `data-heading` reaches the slotted header — the forward, not a translation.
 *
 * The panel used to call this `data-title` and rename it to `data-heading` on
 * the way to its header: two names for one thing, with a mapping step to keep
 * them in step. NAMING-STANDARD D9 says primary text is `data-heading`
 * everywhere, so the rename deleted the translation.
 *
 * Guarded because the panel had only two tests and neither read the heading —
 * the rename could have silently stopped forwarding and nothing would have
 * said so. That exact failure happened one component over (the donut's
 * `dataset['variant']`), caught only because a test read the rendered output.
 */
test('data-heading forwards to the header and renders', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-heading', 'Panel title here');
    el.setAttribute('open', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const header = el.shadowRoot!.querySelector('.header') as HTMLElement | null;
    const before = {
      attr: header?.dataset['heading'] ?? null,
      text: (header?.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };

    // CLEARED, not just set: a null value must REMOVE the attribute, or the
    // header keeps showing a title the panel no longer has.
    el.removeAttribute('data-heading');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const after = { attr: header?.dataset['heading'] ?? null };

    return { before, after };
  });

  expect(r.before.attr).toBe('Panel title here');
  expect(r.before.text).toContain('Panel title here');
  expect(r.after.attr).toBeNull();
});

/**
 * THE APP's Assistant panel names itself — TODO 100. It set `data-title`, which
 * a container does not read, so the panel had no heading. Runs against the
 * EXAMPLES server (:4200).
 */
test('the Assistant panel in the example app shows its heading', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  const heading = await page.evaluate(async () => {
    const panel = document.querySelector('#assistant') as HTMLElement & { rendered?: Promise<void> };
    await panel.rendered;
    const header = panel.shadowRoot!.querySelector('.header') as HTMLElement;
    await (header as HTMLElement & { rendered?: Promise<void> }).rendered;
    return header.shadowRoot!.querySelector('.title')?.textContent?.trim() ?? '';
  });
  expect(heading).toBe('Assistant');
});

/**
 * WIDER, AND RESIZABLE FROM ITS LEFT EDGE — TODO 22. 40rem by default, never
 * under 20rem nor past 92vw; the edge drags, and ArrowLeft / ArrowRight move
 * it 16 px. Each resize is reported.
 * TRAP T-an-overlay-panel-resizes-from-its-left-edge
 */
test('the panel opens 640 wide, drags from its left edge within its bounds, and steps by key', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  const edge = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-heading', 'Ask');
    el.setAttribute('open', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const heard: number[] = [];
    (window as unknown as { __heard: number[] }).__heard = heard;
    el.addEventListener('panel-resize', (e) => heard.push((e as CustomEvent).detail.width));
    const b = el.shadowRoot!.querySelector('.resize')!.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  const width = () => page.evaluate(() => Math.round(document.querySelector('sherpa-overlay-panel')!
    .shadowRoot!.querySelector('.root')!.getBoundingClientRect().width));
  const opened = await width();
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await page.mouse.move(edge.x - 100, edge.y, { steps: 5 });
  await page.mouse.up();
  const dragged = await width();
  // Far to the right: the 20rem floor holds.
  await page.mouse.move(edge.x - 100, edge.y);
  await page.mouse.down();
  await page.mouse.move(1150, edge.y, { steps: 5 });
  await page.mouse.up();
  const floor = await width();
  await page.evaluate(() => {
    const handle = document.querySelector('sherpa-overlay-panel')!.shadowRoot!.querySelector<HTMLElement>('.resize')!;
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  });
  const keyed = await width();
  const heard = await page.evaluate(() => (window as unknown as { __heard: number[] }).__heard);
  expect(opened).toBe(640);
  expect(dragged).toBe(740);
  expect(floor).toBe(320);
  expect(keyed).toBe(336);
  expect(heard).toEqual([740, 320, 336]);
});
