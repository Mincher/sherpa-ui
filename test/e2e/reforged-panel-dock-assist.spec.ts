import { test, expect, type Page } from './harness';

/**
 * Dragging a FLOATING panel by its header lights up the area it would dock in, within a distance of the layout's
 * left or right edge: an empty side, a card at its edge; a side with one panel, the new half of the split (above or
 * below, by the pointer's height); a side with two, nothing. A drop on it docks the panel in the area's mode; a drop
 * elsewhere leaves it floating; Escape cancels. A real pointer; boxes read. In the shell and in a canvas.
 * TRAP T-a-dragged-panel-docks-where-the-area-lights-up
 */

type PanelEl = HTMLElement & { show?(): void; rendered: Promise<void> };
const W = 1400;
const H = 900;
const NEAR = 64;

/** A host (the app shell, or a canvas) holding the panels given; `data-mode` as said, each open. */
async function stage(page: Page, host: 'shell' | 'canvas', panels: Array<{ id: string; side?: 'start' | 'end'; mode?: string }>): Promise<void> {
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(async ({ host, list }) => {
    const el = document.createElement(host === 'shell' ? 'sherpa-app-shell' : 'sherpa-layout-canvas');
    el.style.cssText = host === 'shell' ? `block-size: ${innerHeight}px` : 'inline-size: 1200px; block-size: 700px; display: block';
    const made = list.map(({ id, side, mode }) => {
      const panel = document.createElement('sherpa-overlay-panel') as PanelEl;
      panel.id = id;
      panel.setAttribute('data-heading', id);
      panel.setAttribute('data-floatable', '');
      panel.setAttribute('data-minimisable', '');
      if (side) panel.setAttribute('data-side', side);
      if (mode) panel.setAttribute('data-mode', mode);
      panel.innerHTML = `<p>${id}</p>`;
      el.append(panel);
      return panel;
    });
    document.getElementById('root')!.replaceChildren(el);
    for (const panel of made) { await panel.rendered; await window.__settled(); panel.show!(); await window.__settled(); }
  }, { host, list: panels });
}

/** The layout that holds the areas: the shell's body, or the canvas's. */
const LAYOUT = "document.querySelector('sherpa-app-shell, sherpa-layout-canvas').shadowRoot.querySelector('sherpa-layout-panels')";

/** What is lit now: the layout's own dock states, and the box the lit overlay draws. */
const lit = (page: Page) => page.evaluate((src) => {
  const layout = eval(src) as HTMLElement;
  const sr = layout.shadowRoot!;
  const states = ['start', 'end'].flatMap((side) => ['solo', 'top', 'bottom'].map((kind) => `${side}-dock-${kind}`)).filter((name) => layout.matches(`:state(${name})`));
  const shown = [...sr.querySelectorAll<HTMLElement>('.lit')].filter((z) => getComputedStyle(z).display !== 'none');
  const box = (n: Element) => { const b = n.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { zones: states, boxes: shown.map(box), layout: box(layout) };
}, LAYOUT);

const modeOf = (page: Page, id: string) => page.evaluate((i) => {
  const p = document.getElementById(i)!;
  return { mode: p.getAttribute('data-mode') ?? 'fixed', side: p.getAttribute('data-side'), slot: p.slot, order: [...p.parentElement!.children].filter((c) => c.localName === 'sherpa-overlay-panel').map((c) => c.id) };
}, id);

/** Float a panel and leave it in the middle of the layout. */
async function float(page: Page, id: string): Promise<void> {
  await page.evaluate(async (i) => { (document.getElementById(i) as PanelEl & { requestMode(m: string): void }).requestMode('floating'); await window.__settled(); }, id);
}

/** The float panel's header bar, to hold. */
const barOf = (page: Page, id: string) => page.evaluate((i) => {
  const b = document.getElementById(i)!.shadowRoot!.querySelector('.header')!.getBoundingClientRect();
  return { x: b.x + 20, y: b.y + b.height / 2 };
}, id);

/** Take hold of the bar and move to (x, y) in steps; leave the button down. */
async function dragTo(page: Page, id: string, to: { x: number; y: number }): Promise<void> {
  const from = await barOf(page, id);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.evaluate(() => window.__settled());
}
const drop = async (page: Page): Promise<void> => {
  await page.mouse.up();
  await page.evaluate(() => window.__settled());
};

for (const host of ['shell', 'canvas'] as const) {
  test.describe(`in ${host === 'shell' ? 'the app shell' : 'a canvas'}`, () => {
    const at = (page: Page, side: 'start' | 'end', dy = 0.5) => page.evaluate(([src, s, f]) => {
      const b = (eval(src as string) as HTMLElement).getBoundingClientRect();
      return { x: s === 'start' ? b.left + 20 : b.right - 20, y: b.top + b.height * (f as number) };
    }, [LAYOUT, side, dy] as const);

    test('an empty side lights ONE card at its edge, within the threshold only, and only for a dragged floating panel', async ({ page }) => {
      await stage(page, host, [{ id: 'one' }]);
      await float(page, 'one');
      // Nothing is lit until it is dragged.
      expect((await lit(page)).zones).toEqual([]);
      const room = (await lit(page)).layout;
      // Dragged to the middle: still nothing.
      await dragTo(page, 'one', { x: room.x + room.w / 2, y: room.y + room.h / 2 });
      expect((await lit(page)).zones).toEqual([]);
      // Just outside the threshold of the end edge: nothing; just inside: one card.
      await page.mouse.move(room.x + room.w - NEAR - 4, room.y + room.h / 2, { steps: 3 });
      expect((await lit(page)).zones).toEqual([]);
      await page.mouse.move(room.x + room.w - NEAR + 4, room.y + room.h / 2, { steps: 3 });
      const near = await lit(page);
      expect(near.zones).toEqual(['end-dock-solo']);
      // A card at the edge, as a docked card is: 8px in, the area's default width less its insets.
      expect(near.boxes[0]!.x + near.boxes[0]!.w).toBe(room.x + room.w - 8);
      expect(near.boxes[0]!.y).toBe(room.y + 8);
      expect(near.boxes[0]!.h).toBe(room.h - 16);
      // Back out: it goes.
      await page.mouse.move(room.x + room.w / 2, room.y + room.h / 2, { steps: 3 });
      expect((await lit(page)).zones).toEqual([]);
      await drop(page);
      expect((await modeOf(page, 'one')).mode).toBe('floating');
    });

    test('a drop on a lit empty side docks the panel there in fixed mode, on the side it was dropped', async ({ page }) => {
      await stage(page, host, [{ id: 'one', side: 'end' }]);
      await float(page, 'one');
      await page.evaluate(() => { (window as unknown as { __docked: unknown[] }).__docked = []; document.querySelector('sherpa-app-shell, sherpa-layout-canvas')!.addEventListener('panel-dock', (e) => (window as unknown as { __docked: unknown[] }).__docked.push((e as CustomEvent).detail)); });
      await dragTo(page, 'one', await at(page, 'start'));
      expect((await lit(page)).zones).toEqual(['start-dock-solo']);
      await drop(page);
      expect(await modeOf(page, 'one')).toMatchObject({ mode: 'fixed', side: 'start', slot: 'panel-start' });
      expect(await page.evaluate(() => (window as unknown as { __docked: unknown[] }).__docked)).toEqual([{ side: 'start', place: 'only' }]);
      expect((await lit(page)).zones).toEqual([]);
    });

    test('a side with one panel splits: the new half is lit by the pointer\'s height; the drop stacks it there', async ({ page }) => {
      await stage(page, host, [{ id: 'one', side: 'start' }, { id: 'two', side: 'end' }]);
      await float(page, 'two');
      const room = (await lit(page)).layout;
      await dragTo(page, 'two', await at(page, 'start', 0.2));
      const top = await lit(page);
      expect(top.zones).toEqual(['start-dock-top']);
      // The upper half: the new panel goes above the one there; the lit box is that half, not the whole area.
      expect(top.boxes[0]!.y).toBeLessThan(room.y + room.h / 2 - 100);
      expect(top.boxes[0]!.h).toBeLessThan(room.h * 0.6);
      await page.mouse.move((await at(page, 'start', 0.8)).x, (await at(page, 'start', 0.8)).y, { steps: 4 });
      const bottom = await lit(page);
      expect(bottom.zones).toEqual(['start-dock-bottom']);
      expect(bottom.boxes[0]!.y).toBeGreaterThan(room.y + room.h / 2 - 100);
      await drop(page);
      expect(await modeOf(page, 'two')).toMatchObject({ mode: 'fixed', side: 'start', slot: 'panel-start', order: ['one', 'two'] });
      expect(await modeOf(page, 'one')).toMatchObject({ mode: 'fixed' });
    });

    test('dropped on the upper half it stacks ABOVE the panel there', async ({ page }) => {
      await stage(page, host, [{ id: 'one', side: 'start' }, { id: 'two', side: 'end' }]);
      await float(page, 'two');
      await dragTo(page, 'two', await at(page, 'start', 0.15));
      await drop(page);
      expect((await modeOf(page, 'two')).order).toEqual(['two', 'one']);
    });

    test('a side with two panels lights nothing, and the drop leaves it floating', async ({ page }) => {
      await stage(page, host, [{ id: 'one', side: 'start' }, { id: 'two', side: 'start' }, { id: 'three', side: 'end' }]);
      await float(page, 'three');
      await dragTo(page, 'three', await at(page, 'start'));
      expect((await lit(page)).zones).toEqual([]);
      await drop(page);
      expect((await modeOf(page, 'three')).mode).toBe('floating');
    });

    test('Escape cancels: nothing is lit, and the drop lands nowhere', async ({ page }) => {
      await stage(page, host, [{ id: 'one', side: 'end' }]);
      await float(page, 'one');
      await dragTo(page, 'one', await at(page, 'start'));
      expect((await lit(page)).zones.length).toBe(1);
      await page.keyboard.press('Escape');
      expect((await lit(page)).zones).toEqual([]);
      await page.mouse.move((await at(page, 'start')).x + 2, (await at(page, 'start')).y, { steps: 2 });
      expect((await lit(page)).zones).toEqual([]);
      await drop(page);
      expect((await modeOf(page, 'one')).mode).toBe('floating');
    });

    test('a drop beside the edge leaves a floating panel floating, and a panel not floating lights nothing', async ({ page }) => {
      await stage(page, host, [{ id: 'one', side: 'end' }]);
      // A docked panel's header does not move it: no zone.
      const bar = await barOf(page, 'one');
      await page.mouse.move(bar.x, bar.y);
      await page.mouse.down();
      await page.mouse.move((await at(page, 'start')).x, (await at(page, 'start')).y, { steps: 5 });
      expect((await lit(page)).zones).toEqual([]);
      await page.mouse.up();
      expect(await modeOf(page, 'one')).toMatchObject({ mode: 'fixed', side: 'end' });
    });

    test('a side whose panel is an overlay lights a card at the edge, and the drop docks in the same mode', async ({ page }) => {
      await stage(page, host, [{ id: 'one', side: 'start', mode: 'overlay' }, { id: 'two', side: 'end' }]);
      await float(page, 'two');
      await dragTo(page, 'two', await at(page, 'start', 0.3));
      expect((await lit(page)).zones).toEqual(['start-dock-solo']);
      await drop(page);
      expect(await modeOf(page, 'two')).toMatchObject({ mode: 'overlay', side: 'start', slot: 'panel-start' });
    });

    test('with no pointer: asking a floating panel for fixed docks it in the area its side names, beside the panel there', async ({ page }) => {
      await stage(page, host, [{ id: 'one', side: 'start' }, { id: 'two', side: 'start' }]);
      await float(page, 'two');
      expect((await modeOf(page, 'two')).mode).toBe('floating');
      await page.evaluate(async () => { (document.getElementById('two') as PanelEl & { requestMode(m: string): void }).requestMode('fixed'); await window.__settled(); });
      expect(await modeOf(page, 'two')).toMatchObject({ mode: 'fixed', side: 'start', slot: 'panel-start' });
    });
  });
}
