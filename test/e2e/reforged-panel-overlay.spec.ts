import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * A panel is FIXED (flat, in its area's room) or an OVERLAY docked on the content (over the view, with a shadow and
 * rounding): Pop toggles them in every panel, and a tab may open its panel as an overlay while the pointer is on it.
 * TRAP T-a-panel-peeks-from-its-tab
 */
type PanelEl = HTMLElement & { rendered?: Promise<void>; show(): void };

async function stage(page: Page, attrs = ''): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.evaluate(async (a) => {
    const root = document.getElementById('root')!;
    root.innerHTML = `<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 600px">
      <sherpa-overlay-panel data-side="start" id="p" data-heading="Nodes" data-minimisable data-poppable data-floatable ${a}><p>body</p></sherpa-overlay-panel>
    </sherpa-layout-canvas>`;
    const panel = document.getElementById('p') as PanelEl;
    await panel.rendered;
    await window.__settled();
    panel.show();
    await window.__settled();
  }, attrs);
}
/** The width the content has: all of the layout's, but what a fixed panel takes. */
const area = (page: Page) => page.evaluate(() => 1000 - Math.round(document.getElementById('cv')!.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!.querySelector('.content')!.getBoundingClientRect().width));
const look = (page: Page) => page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('p')!.shadowRoot!.querySelector('.root')!);
  return { shadow: cs.boxShadow !== 'none', radius: cs.borderTopLeftRadius !== '0px' || cs.borderTopRightRadius !== '0px', display: cs.display };
});
const press = async (page: Page, sel: string): Promise<void> => {
  const r = await page.evaluate((s) => { const b = document.getElementById('p')!.shadowRoot!.querySelector(s)!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
  await page.mouse.click(r.x, r.y);
  await page.evaluate(() => window.__settled());
};

test('fixed is a card with no shadow and takes its area\'s room; Pop makes it an overlay over the view, with a shadow, and gives the room back', async ({ page }) => {
  await stage(page);
  expect(await area(page)).toBeGreaterThan(200);
  expect(await look(page)).toMatchObject({ shadow: false, radius: true });
  await press(page, '.dock-overlay:not([disabled]), .dock-fixed:not([disabled])');
  expect(await area(page)).toBe(0);
  expect(await look(page)).toMatchObject({ shadow: true, radius: true, display: 'flex' });
  expect(await page.evaluate(() => document.getElementById('p')!.hasAttribute('data-overlay'))).toBe(true);
  // Pop again: fixed, flat, its room back.
  await press(page, '.dock-overlay:not([disabled]), .dock-fixed:not([disabled])');
  expect(await area(page)).toBeGreaterThan(200);
  expect(await look(page)).toMatchObject({ shadow: false, radius: true });
});

test('the docking button says what it will do: Dock as overlay from fixed, Dock as fixed from an overlay', async ({ page }) => {
  await stage(page);
  const label = () => page.evaluate(() => document.getElementById('p')!.shadowRoot!.querySelector('.dock-overlay:not([disabled]), .dock-fixed:not([disabled])')!.getAttribute('aria-label'));
  expect(await label()).toBe('Dock as overlay');
  await press(page, '.dock-overlay:not([disabled]), .dock-fixed:not([disabled])');
  expect(await label()).toBe('Dock as fixed');
});

test('with hover-open, the pointer on a tab shows its panel as a docked overlay and hides the tab; leaving the panel brings the tab back at once', async ({ page }) => {
  await stage(page, 'data-hover-open data-minimised');
  const shown = () => page.evaluate(() => {
    const sr = document.getElementById('p')!.shadowRoot!;
    return { panel: getComputedStyle(sr.querySelector('.root')!).display !== 'none', tab: getComputedStyle(sr.querySelector('.tab')!).display !== 'none' };
  });
  expect(await shown()).toEqual({ panel: false, tab: true });
  const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(tab.x, tab.y);
  await expect.poll(shown).toEqual({ panel: true, tab: false });
  expect(await look(page)).toMatchObject({ shadow: true });
  // The room stays the view's: it is an overlay, not a fixed panel.
  expect(await area(page)).toBe(0);
  // The pointer in the panel keeps it open.
  const inside = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.body')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(inside.x, inside.y);
  await page.waitForTimeout(500);
  expect((await shown()).panel).toBe(true);
  // Out of it: the tab, at once.
  await page.mouse.move(1300, 780);
  await expect.poll(shown, { timeout: 1000 }).toEqual({ panel: false, tab: true });
});

test('without hover-open, the pointer on a tab opens nothing', async ({ page }) => {
  await stage(page, 'data-minimised');
  const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(tab.x, tab.y);
  await page.waitForTimeout(400);
  expect((await look(page)).display).toBe('none');
});

/** The four ways a panel is docked, each with what it is called and how to read it. */
const KINDS = [
  { name: 'fixed in the shell\'s area', slotted: false, attrs: 'data-fixed', flat: true },
  { name: 'an overlay on the window\'s edge', slotted: false, attrs: '', flat: false },
  { name: 'fixed in a canvas\'s area', slotted: true, attrs: '', flat: true },
  { name: 'an overlay on a canvas', slotted: true, attrs: 'data-overlay', flat: false },
] as const;

for (const kind of KINDS) {
  test(`${kind.name}: Pop swaps it, Float lifts it off, and Dock puts it back as it was`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.evaluate(async ({ slotted, attrs }) => {
      const root = document.getElementById('root')!;
      const panel = `<sherpa-overlay-panel id="p" ${slotted ? 'data-side="start"' : ''} data-heading="P" data-floatable data-poppable data-minimisable ${attrs}><p>body</p></sherpa-overlay-panel>`;
      root.innerHTML = slotted
        ? `<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 600px">${panel}</sherpa-layout-canvas>`
        : `<sherpa-app-shell></sherpa-app-shell>${panel}`;
      const p = document.getElementById('p') as PanelEl;
      await p.rendered;
      await window.__settled();
      p.show();
      await window.__settled();
    }, { slotted: kind.slotted, attrs: kind.attrs });
    const read = () => page.evaluate(() => {
      const p = document.getElementById('p')!;
      const cs = getComputedStyle(p.shadowRoot!.querySelector('.root')!);
      return { flat: cs.boxShadow === 'none', floating: p.hasAttribute('data-floating'), fixedAttr: p.hasAttribute('data-fixed'), overlayAttr: p.hasAttribute('data-overlay') };
    });
    const before = await read();
    expect(before).toMatchObject({ flat: kind.flat, floating: false });

    // Float, and dock: the same state as before.
    await press(page, '.float');
    expect((await read()).floating).toBe(true);
    await press(page, '.float');
    expect(await read()).toEqual(before);

    // Pop: the other docked state; and float and dock from there returns to THAT one.
    await press(page, '.dock-overlay:not([disabled]), .dock-fixed:not([disabled])');
    const swapped = await read();
    expect(swapped.flat).toBe(!kind.flat);
    await press(page, '.float');
    expect((await read()).floating).toBe(true);
    await press(page, '.float');
    expect(await read()).toEqual(swapped);

    // And Pop again: back where it began.
    await press(page, '.dock-overlay:not([disabled]), .dock-fixed:not([disabled])');
    expect(await read()).toEqual(before);
  });
}

for (const kind of KINDS) {
  test(`${kind.name}: as a tab, hover shows it as a docked overlay for now; a press opens it as it was`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.evaluate(async ({ slotted, attrs }) => {
      const root = document.getElementById('root')!;
      const panel = `<sherpa-overlay-panel id="p" ${slotted ? 'data-side="start"' : ''} data-heading="P" data-floatable data-poppable data-minimisable data-hover-open ${attrs}><p>body</p></sherpa-overlay-panel>`;
      root.innerHTML = slotted
        ? `<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 600px">${panel}</sherpa-layout-canvas>`
        : `<sherpa-app-shell></sherpa-app-shell>${panel}`;
      const p = document.getElementById('p') as PanelEl & { minimise(on: boolean): void };
      await p.rendered;
      await window.__settled();
      p.show();
      await window.__settled();
      p.minimise(true);
      await window.__settled();
    }, { slotted: kind.slotted, attrs: kind.attrs });
    const root = () => page.evaluate(() => { const cs = getComputedStyle(document.getElementById('p')!.shadowRoot!.querySelector('.root')!); return { shown: cs.display !== 'none', shadow: cs.boxShadow !== 'none' }; });
    expect((await root()).shown).toBe(false);
    const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.move(tab.x, tab.y);
    await expect.poll(async () => (await root()).shown).toBe(true);
    // A docked OVERLAY, whatever it was docked as: over the view, with a shadow. A temporary state: the tab is still a tab.
    expect((await root()).shadow).toBe(true);
    expect(await page.evaluate(() => document.getElementById('p')!.hasAttribute('data-minimised'))).toBe(true);
    // The tab is hidden while it shows (leaving the panel brings it back: the test above).
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('p')!.shadowRoot!.querySelector('.tab')!).display)).toBe('none');
    // WebKit ends a hover on pointer events of its own accord under load: the press is checked in the other two.
    test.skip(browserName === 'webkit', 'a WebKit hover is ended by its own synthetic pointer events');
    // The ONE docking button says so while it peeks: dock it as an overlay, and it stays open as one, whatever it was.
    expect(await page.evaluate(() => document.getElementById('p')!.shadowRoot!.querySelector('.dock-overlay:not([disabled]), .dock-fixed:not([disabled])')!.getAttribute('aria-label'))).toBe('Dock as overlay');
    // The button's own press (WebKit drops a pointer that crosses the hidden tab to reach it).
    await page.evaluate(() => (document.getElementById('p')!.shadowRoot!.querySelector('.dock-overlay:not([disabled]), .dock-fixed:not([disabled])')!.shadowRoot!.querySelector('button') as HTMLElement).click());
    await page.evaluate(() => window.__settled());
    expect(await page.evaluate(() => document.getElementById('p')!.hasAttribute('data-minimised'))).toBe(false);
    expect(await page.evaluate(() => (document.getElementById('p') as HTMLElement & { dockState: string }).dockState)).toBe('overlay');
    expect((await root()).shadow).toBe(true);
  });
}

test('the docking cycle: fixed to overlay to fixed, at the same width; dockState says which; Minimise ends a hover', async ({ page }) => {
  await stage(page);
  const state = () => page.evaluate(() => (document.getElementById('p') as HTMLElement & { dockState: string }).dockState);
  const width = () => page.evaluate(() => Math.round(document.getElementById('p')!.shadowRoot!.querySelector('.root')!.getBoundingClientRect().width));
  expect(await state()).toBe('fixed');
  const fixed = await width();
  await press(page, '.dock-overlay:not([disabled]), .dock-fixed:not([disabled])');
  expect(await state()).toBe('overlay');
  // The overlay is as wide as the fixed panel was; dragged wider, the fixed one takes that width back.
  expect(Math.abs((await width()) - fixed)).toBeLessThanOrEqual(2);
  await page.evaluate(() => document.getElementById('p')!.style.setProperty('--_width', '400px'));
  const wider = await width();
  await press(page, '.dock-overlay:not([disabled]), .dock-fixed:not([disabled])');
  expect(await state()).toBe('fixed');
  // The area holds the card and its two insets, and is never over a third of the room: at that cap the card is 32px under.
  expect(Math.abs((await width()) - wider)).toBeLessThanOrEqual(34);
  // Float and dock: back to fixed.
  await press(page, '.float');
  expect(await state()).toBe('floating');
  await press(page, '.float');
  expect(await state()).toBe('fixed');
});

test('a docked panel is never over a third of its room: an overlay on the window, an overlay on a canvas, and a fixed canvas area', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  // On the window's edge, however wide it was asked to be.
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-overlay-panel id="w" data-heading="W" style="--_width: 1000px"><p>x</p></sherpa-overlay-panel>';
    const p = document.getElementById('w') as PanelEl;
    await p.rendered;
    p.show();
    await window.__settled();
  });
  const wide = await page.evaluate(() => Math.round(document.getElementById('w')!.shadowRoot!.querySelector('.root')!.getBoundingClientRect().width));
  expect(wide).toBeLessThanOrEqual(Math.round(1400 / 3) + 1);
  // On a canvas: overlay and fixed.
  await stage(page, 'data-overlay style="--_width: 900px"');
  const over = await page.evaluate(() => Math.round(document.getElementById('p')!.shadowRoot!.querySelector('.root')!.getBoundingClientRect().width));
  expect(over).toBeLessThanOrEqual(Math.round(1000 / 3) + 1);
  await press(page, '.dock-overlay:not([disabled]), .dock-fixed:not([disabled])');
  const fixed = await page.evaluate(() => Math.round(document.getElementById('p')!.shadowRoot!.querySelector('.root')!.getBoundingClientRect().width));
  expect(fixed).toBeLessThanOrEqual(Math.round(1000 / 3) + 1);
});

test('a panel at the start side has its resize edge on the RIGHT, facing the content; at the end, on the left', async ({ page }) => {
  const edgeSide = (id: string) => page.evaluate((i) => {
    const sr = document.getElementById(i)!.shadowRoot!;
    const root = sr.querySelector('.root')!.getBoundingClientRect();
    const edge = sr.querySelector('.resize')!.getBoundingClientRect();
    return { atLeft: Math.abs(edge.left - root.left) <= 1, atRight: Math.abs(edge.right - root.right) <= 1 };
  }, id);
  // A canvas's card at the start, as an overlay: the right edge.
  await stage(page, 'data-overlay');
  expect(await edgeSide('p')).toEqual({ atLeft: false, atRight: true });
  // A panel at the end of the window: the left edge.
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-overlay-panel id="w" data-heading="W"><p>x</p></sherpa-overlay-panel>';
    const p = document.getElementById('w') as PanelEl;
    await p.rendered;
    p.show();
    await window.__settled();
  });
  expect(await edgeSide('w')).toEqual({ atLeft: true, atRight: false });
});

test('floated from a panel shown on hover, it stays floating when the pointer leaves, a press lands outside, or Escape is pressed', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'a WebKit hover is ended by its own synthetic pointer events');
  await stage(page, 'data-hover-open data-minimised');
  const read = () => page.evaluate(() => {
    const p = document.getElementById('p') as HTMLElement & { dockState: string };
    return { state: p.dockState, shown: getComputedStyle(p.shadowRoot!.querySelector('.root')!).display !== 'none' };
  });
  const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(tab.x, tab.y);
  await expect.poll(async () => (await read()).state).toBe('hover');
  // Float it from there (the button's own press: the pointer stays over the panel).
  await page.evaluate(() => (document.getElementById('p')!.shadowRoot!.querySelector('.float')!.shadowRoot!.querySelector('button') as HTMLElement).click());
  await page.evaluate(() => window.__settled());
  expect(await read()).toEqual({ state: 'floating', shown: true });
  // Away from it, a press outside, and Escape: none of them shuts a floating panel.
  await page.mouse.move(1350, 780);
  await page.mouse.click(1350, 780);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await read()).toEqual({ state: 'floating', shown: true });
});

/** A tab peeks as an OVERLAY, never as the mode it was last open in: floating is kept, and the hover does not use it. TODO 872 */
for (const kind of [
  { name: 'a floating panel', slotted: false, attrs: 'data-floating' },
  { name: 'a floating panel in a canvas', slotted: true, attrs: 'data-floating' },
]) {
  test(`${kind.name}, then a tab: hover shows an overlay, not the floating box`, async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'a WebKit hover is ended by its own synthetic pointer events');
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.evaluate(async ({ slotted, attrs }) => {
      const root = document.getElementById('root')!;
      const panel = `<sherpa-overlay-panel id="p" ${slotted ? 'data-side="start"' : ''} data-heading="P" data-floatable data-poppable data-minimisable data-hover-open ${attrs}><p>body</p></sherpa-overlay-panel>`;
      root.innerHTML = slotted
        ? `<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 600px">${panel}</sherpa-layout-canvas>`
        : `<sherpa-app-shell></sherpa-app-shell>${panel}`;
      const p = document.getElementById('p') as PanelEl & { minimise(on: boolean): void };
      await p.rendered;
      await window.__settled();
      p.show();
      await window.__settled();
      p.minimise(true);
      await window.__settled();
    }, { slotted: kind.slotted, attrs: kind.attrs });
    const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.move(tab.x, tab.y);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('p')!.shadowRoot!.querySelector('.root')!).display !== 'none')).toBe(true);
    const peek = await page.evaluate(() => {
      const p = document.getElementById('p') as HTMLElement & { dockState: string };
      const r = p.shadowRoot!.querySelector('.root')!.getBoundingClientRect();
      return { dock: p.dockState, kept: p.hasAttribute('data-floating'), full: Math.round(r.height), edge: Math.round(innerWidth - r.right) };
    });
    // The kept state is still floating; what is drawn is the overlay: the full height, on the edge.
    expect(peek.kept).toBe(true);
    expect(peek.dock).toBe('hover');
    if (!kind.slotted) expect(peek.edge).toBeLessThanOrEqual(1);
    expect(peek.full).toBeGreaterThanOrEqual(580);
  });
}
