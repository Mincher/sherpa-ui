import { test, expect } from './harness';

/**
 * sherpa-overlay-panel on the reforged base — a NON-modal floating panel on
 * native <dialog>.show(). Proves show()/close() drive dialog.open + the
 * reflected `open` attribute, that the open dialog is non-modal (no ::backdrop
 * pseudo painted → the page stays interactive), and that closing fires a
 * composed `close`.
 */

type PanelEl = HTMLElement & {
  rendered?: Promise<void>;
  open?: boolean;
  show?: () => void;
  close?: () => void;
};

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
    await window.__settled();
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
    await window.__settled();

    const header = el.shadowRoot!.querySelector('.header') as HTMLElement | null;
    const before = {
      attr: header?.dataset['heading'] ?? null,
      text: (header?.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };

    // CLEARED, not just set: a null value must REMOVE the attribute, or the
    // header keeps showing a title the panel no longer has.
    el.removeAttribute('data-heading');
    await window.__settled();
    const after = { attr: header?.dataset['heading'] ?? null };

    return { before, after };
  });

  expect(r.before.attr).toBe('Panel title here');
  expect(r.before.text).toContain('Panel title here');
  expect(r.after.attr).toBeNull();
});

/**
 * WIDER, AND RESIZABLE FROM ITS LEFT EDGE — TODO 22. 40rem by default, never
 * under 20rem nor past 92vw; the edge drags, and ArrowLeft / ArrowRight move
 * it 16 px. Each resize is reported.
 * TRAP T-an-overlay-panel-resizes-from-its-left-edge
 */
test('the panel opens 640 wide, or a third of the window if that is less; it drags from its left edge within its bounds, and steps by key', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 800 });
  const edge = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-heading', 'Ask');
    el.setAttribute('open', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await window.__settled();
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
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await page.mouse.move(1750, edge.y, { steps: 5 });
  await page.mouse.up();
  const floor = await width();
  await page.evaluate(() => {
    const handle = document.querySelector('sherpa-overlay-panel')!.shadowRoot!.querySelector<HTMLElement>('.resize')!;
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  });
  const keyed = await width();
  const heard = await page.evaluate(() => (window as unknown as { __heard: number[] }).__heard);
  // A third of 1800: the most a docked panel is, whatever it was asked.
  expect(opened).toBe(594);
  expect(dragged).toBe(594);
  expect(floor).toBe(320);
  expect(keyed).toBe(336);
  expect(heard).toEqual([594, 320, 336]);
});

/** NO scrim: the panel is a quick peek, so the page beside it is not dimmed. */
test('an open panel draws nothing over the page beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  const clip = { x: 100, y: 100, width: 4, height: 4 };
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as PanelEl;
    el.setAttribute('data-heading', 'Peek');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
  });
  const before = await page.screenshot({ clip });
  const parts = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-overlay-panel') as PanelEl;
    el.show!();
    await window.__settled();
    return [...el.shadowRoot!.children].map((n) => n.tagName.toLowerCase());
  });
  const after = await page.screenshot({ clip });
  // The dialog, and the minimised tab (drawn only while minimised).
  expect(parts).toEqual(['div', 'dialog']);
  expect(after.equals(before)).toBe(true);
});

/** Figma Container Header `Variant=Panel`: 24px buttons, the view-mode pair
 *  grouped, and a divider only where a control sits on both sides of it. */
test('the header buttons are 24px; the pair is one object; a divider needs both neighbours', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (attrs: string[], action: boolean) => {
      const el = document.createElement('sherpa-overlay-panel') as PanelEl;
      el.setAttribute('data-heading', 'Peek');
      for (const a of attrs) el.setAttribute(a, '');
      if (action) {
        el.innerHTML = '<sherpa-button slot="actions" data-size="sm">Go</sherpa-button>'
          + '<span slot="description">Pro plan</span>';
      }
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      el.show!();
      await window.__settled();
      const sr = el.shadowRoot!;
      const header = sr.querySelector('.header')!.shadowRoot!;
      const size = (n: Element | null) => {
        const b = n!.getBoundingClientRect();
        return [Math.round(b.width), Math.round(b.height)];
      };
      const shown = (sel: string) => getComputedStyle(sr.querySelector(sel)!).display !== 'none';
      const corner = (sel: string) => getComputedStyle(sr.querySelector(sel)!)
        .getPropertyValue('--sherpa-border-rounding-top-right').trim();
      return {
        header: size(sr.querySelector('.header')),
        metadata: sr.querySelector('.header')!.matches(':state(has-metadata)'),
        close: size(header.querySelector('.close')),
        expand: size(sr.querySelector('.expand')),
        afterActions: shown('.after-custom'),
        beforeClose: shown('.after-modes') || shown('.after-overflow'),
        expandEnd: corner('.expand'),
      };
    };
    return {
      full: await read(['data-dismissible', 'data-expandable', 'data-external'], true),
      lone: await read(['data-dismissible', 'data-expandable'], false),
      bare: await read(['data-dismissible'], false),
    };
  });
  expect(r.full.close).toEqual([24, 24]);
  expect(r.full.expand).toEqual([24, 24]);
  expect(r.full.afterActions).toBe(true);
  expect(r.full.beforeClose).toBe(true);
  // Grouped: expand's trailing corners are square against pop-out.
  expect(r.full.expandEnd).toBe('0px');
  // Alone, it is a whole button — and nothing sits before it to divide from.
  expect(r.lone.expandEnd).toBe('4px');
  expect(r.lone.afterActions).toBe(false);
  expect(r.lone.beforeClose).toBe(true);
  expect(r.bare).toMatchObject({ afterActions: false, beforeClose: false });
  // An EMPTY forwarded description is no metadata row: the header is one 40px row.
  expect(r.full.metadata).toBe(true);
  expect(r.bare.metadata).toBe(false);
  expect(r.bare.header[1]).toBeLessThanOrEqual(41);
});

test('maximise fills the window and shows the trail; minimise brings the panel back', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as PanelEl;
    el.setAttribute('data-expandable', '');
    el.innerHTML = '<sherpa-breadcrumbs slot="breadcrumbs"><a href="#a">Records</a><a>Ada</a></sherpa-breadcrumbs><p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.show!();
    // Its composed buttons render after it: wait, then press.
    await window.__settled();
    const sr = el.shadowRoot!;
    const read = () => ({
      width: Math.round(sr.querySelector('.root')!.getBoundingClientRect().width),
      trail: getComputedStyle(sr.querySelector('.trail')!).display !== 'none',
      label: sr.querySelector('.expand')!.getAttribute('aria-label'),
    });
    const before = read();
    const told: unknown[] = [];
    el.addEventListener('panel-expand', (e) => told.push((e as CustomEvent).detail));
    const press = () => sr.querySelector('.expand')!.shadowRoot!.querySelector('button')!.click();
    press();
    const maximised = { ...read(), attr: el.hasAttribute('data-maximised') };
    press();
    return { before, maximised, after: read(), told, window: innerWidth };
  });
  expect(r.before.trail).toBe(false);
  expect(r.before.label).toBe('Maximise');
  expect(r.maximised).toEqual({ width: r.window, trail: true, label: 'Minimise', attr: true });
  expect(r.after).toEqual(r.before);
  expect(r.told).toEqual([{ maximised: true }, { maximised: false }]);
});

/** The four modes: an area holds two panels, owns how they present, and a floating panel is its own. TRAP T-a-panel-has-four-modes */
test.describe('The four modes in an area', () => {
  /** An app shell holding the panels given, each open. `sides` and `ids`: one panel each. */
  const stage = async (page: import('@playwright/test').Page, panels: Array<{ id: string; side?: string }> = [{ id: 'one' }]) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.evaluate(async (list) => {
      const shell = document.createElement('sherpa-app-shell');
      shell.style.blockSize = '900px';
      const made = list.map(({ id, side }) => {
        const panel = document.createElement('sherpa-overlay-panel') as PanelEl;
        panel.id = id;
        if (side) panel.setAttribute('data-side', side);
        panel.setAttribute('data-floatable', '');
        panel.setAttribute('data-minimisable', '');
        panel.setAttribute('data-dismissible', '');
        shell.append(panel);
        return panel;
      });
      document.getElementById('root')!.replaceChildren(shell);
      for (const panel of made) { await panel.rendered; await window.__settled(); panel.show!(); await window.__settled(); }
    }, panels);
  };
  /** Where a panel is, and what it draws. */
  const read = (page: import('@playwright/test').Page, id = 'one') => page.evaluate((i) => {
    const panel = document.getElementById(i) as PanelEl;
    const sr = panel.shadowRoot!;
    const shell = document.querySelector('sherpa-app-shell')!;
    const box = (n: Element) => { const b = n.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const areas = shell.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!;
    return {
      parent: panel.parentElement!.localName,
      slot: panel.slot,
      mode: panel.getAttribute('data-mode'),
      position: getComputedStyle(sr.querySelector('.root')!).position,
      shadow: getComputedStyle(sr.querySelector('.root')!).boxShadow !== 'none',
      root: box(sr.querySelector('.root')!),
      end: box(areas.querySelector('.area-end')!),
      start: box(areas.querySelector('.area-start')!),
      content: box(areas.querySelector('.content')!),
      resize: getComputedStyle(sr.querySelector('.resize')!).display !== 'none',
    };
  }, id);
  /** Press one of a panel's header buttons, as a reader does. */
  const press = (page: import('@playwright/test').Page, button: string, id = 'one') => page.evaluate(async ([b, i]) => {
    document.getElementById(i!)!.shadowRoot!.querySelector(`.${b}`)!.shadowRoot!.querySelector('button')!.click();
    await window.__settled();
  }, [button, id]);

  test('a panel in the shell is fixed in its end area; Overlay asks, the area writes it, and Fixed asks it back', async ({ page }) => {
    await stage(page);
    const fixed = await read(page);
    expect(fixed).toMatchObject({ parent: 'sherpa-app-shell', slot: 'panel-end', position: 'static', shadow: false, resize: false });
    // A card, inset 8px in the area, which owns its width. TODO 871
    expect(fixed.end.w).toBeGreaterThanOrEqual(400);
    expect(fixed.root).toMatchObject({ x: fixed.end.x + 8, w: fixed.end.w - 16 });
    await press(page, 'dock-overlay');
    const over = await read(page);
    expect(over).toMatchObject({ mode: 'overlay', slot: 'panel-end', shadow: true });
    // An overlay gives the area's room back: the content is as wide as the layout.
    expect(over.content.w).toBeGreaterThan(fixed.content.w + 300);
    await press(page, 'dock-fixed');
    expect(await read(page)).toMatchObject({ mode: 'fixed', position: 'static', shadow: false });
  });

  test('data-side="start" docks it in the START area', async ({ page }) => {
    await stage(page, [{ id: 'one', side: 'start' }]);
    const fixed = await read(page);
    expect(fixed).toMatchObject({ parent: 'sherpa-app-shell', slot: 'panel-start' });
    expect(fixed.start.w).toBeGreaterThanOrEqual(400);
    expect(fixed.end.w).toBe(0);
    expect(fixed.root).toMatchObject({ x: fixed.start.x + 8, w: fixed.start.w - 16 });
  });

  test('two panels stack top and bottom; a mode asked of one is written on both; floating takes only that one out', async ({ page }) => {
    await stage(page, [{ id: 'one' }, { id: 'two' }]);
    const [one, two] = [await read(page, 'one'), await read(page, 'two')];
    // Each a half of the area's height, one above the other.
    expect(one.root.h).toBe(two.root.h);
    expect(two.root.y).toBeGreaterThan(one.root.y + one.root.h - 1);
    expect(one.root.x).toBe(two.root.x);
    await press(page, 'dock-overlay', 'two');
    expect([(await read(page, 'one')).mode, (await read(page, 'two')).mode]).toEqual(['overlay', 'overlay']);
    await press(page, 'dock-fixed', 'one');
    expect([(await read(page, 'one')).mode, (await read(page, 'two')).mode]).toEqual(['fixed', 'fixed']);
    // Floating: that panel alone leaves for the float layer, and the other has the area to itself.
    await press(page, 'float', 'two');
    expect(await read(page, 'two')).toMatchObject({ mode: 'floating', slot: 'panel-float' });
    const left = await read(page, 'one');
    expect(left).toMatchObject({ mode: 'fixed', slot: 'panel-end' });
    expect(left.root.h).toBeGreaterThan(one.root.h);
    // Docked back, it joins in the area's own mode.
    await press(page, 'dock-overlay', 'one');
    await press(page, 'float', 'two');
    expect(await read(page, 'two')).toMatchObject({ mode: 'overlay', slot: 'panel-end' });
  });

  test('a third panel is not shown, and a panel asking to dock into a full area stays floating', async ({ page }) => {
    const warned: string[] = [];
    page.on('console', (m) => { if (m.type() === 'warning') warned.push(m.text()); });
    await stage(page, [{ id: 'one' }, { id: 'two' }, { id: 'three' }]);
    expect(await page.evaluate(() => document.getElementById('three')!.hidden)).toBe(true);
    expect(warned.filter((w) => w.includes('holds 2 panels'))).toHaveLength(1);
  });

  test('the press keeps its focus on the button', async ({ page }) => {
    await stage(page);
    const focused = await page.evaluate(async () => {
      const button = document.getElementById('one')!.shadowRoot!.querySelector('.dock-overlay:not([disabled]), .dock-fixed:not([disabled])')!.shadowRoot!.querySelector('button')!;
      button.focus();
      button.click();
      await window.__settled();
      return button.matches(':focus');
    });
    expect(focused).toBe(true);
  });

  test('shut, it gives the area back; opened again, it is still fixed', async ({ page }) => {
    await stage(page);
    const before = await read(page);
    await page.evaluate(async () => { ((document.getElementById('one') as PanelEl) as PanelEl & { hide(): void }).hide(); await window.__settled(); });
    expect((await read(page)).content.w).toBeGreaterThan(before.content.w + 300);
    await page.evaluate(async () => { (document.getElementById('one') as PanelEl).show!(); await window.__settled(); });
    expect(await read(page)).toEqual(before);
  });

  test('with no host a panel is an overlay on the window\'s edge, with no Fixed or Overlay button, and asks only itself', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.evaluate(async () => {
      const panel = document.createElement('sherpa-overlay-panel') as PanelEl;
      panel.id = 'one';
      panel.setAttribute('data-floatable', '');
      panel.setAttribute('data-minimisable', '');
      document.getElementById('root')!.replaceChildren(panel);
      await panel.rendered;
      await window.__settled();
      panel.show!();
      await window.__settled();
    });
    const edge = await page.evaluate(() => {
      const sr = document.getElementById('one')!.shadowRoot!;
      const shown = (sel: string) => getComputedStyle(sr.querySelector(sel)!).display !== 'none';
      const r = sr.querySelector('.root')!.getBoundingClientRect();
      return { overlay: shown('.dock-overlay'), fixed: shown('.dock-fixed'), float: shown('.float'), right: Math.round(innerWidth - r.right), mode: document.getElementById('one')!.getAttribute('data-mode') };
    });
    expect(edge).toEqual({ overlay: false, fixed: false, float: true, right: 0, mode: null });
    await press(page, 'float');
    expect(await page.evaluate(() => document.getElementById('one')!.getAttribute('data-mode'))).toBe('floating');
  });
});

test('a panel opened INSIDE a panel leaves its holder open, and one beside them leaves both open', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const make = (): PanelEl & { show(): void; open: boolean } => document.createElement('sherpa-overlay-panel') as PanelEl & { show(): void; open: boolean };
    const outer = make();
    const inner = make();
    const beside = make();
    outer.append(inner);
    document.getElementById('root')!.append(outer, beside);
    await window.__settled();
    outer.show();
    inner.show();
    const nested = [outer.open, inner.open];
    beside.show();
    await window.__settled();
    return { nested, after: [outer.open, inner.open, beside.open] };
  });
  // The Node Editor's inspector sits inside the editor. TODO 555
  expect(r).toEqual({ nested: [true, true], after: [true, true, true] });
});
