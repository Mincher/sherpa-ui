import { test, expect } from './harness';

/**
 * A BUTTON WITH NO VISIBLE LABEL SAYS ITS ACTION IN A TIP — its name, or
 * `data-tip`. A labelled one already says it, so only `data-tip` gives it one,
 * and a composing host can turn it off. Will, 2026-09-26.
 * TRAP T-every-button-says-its-action
 */
test('a button tip says its action, follows data-tip, and can be turned off', async ({ page }) => {
  await page.evaluate(async () => {
    const mk = (id: string, attrs: Record<string, string | boolean>, text = '') =>
      window.__mount('sherpa-button', undefined, { id, keep: true, ...attrs }).then((b) => {
        if (text) (b as HTMLElement).textContent = text;
      });
    // ROOM ABOVE each button, so the tip takes its first place, not a fallback.
    const root = document.getElementById('root')!;
    root.replaceChildren();
    root.style.cssText = 'display: flex; flex-direction: column; align-items: start; gap: 48px; padding: 64px;';
    await mk('icon', { 'data-type': 'icon', 'data-icon-start': 'gear', 'aria-label': 'Settings' });
    await mk('own', { 'data-type': 'icon', 'data-icon-start': 'gear', 'aria-label': 'Settings', 'data-tip': 'Open the settings' });
    await mk('text', {}, 'Apply');
    await mk('told', { 'data-tip': 'Apply every change' }, 'Apply');
    await mk('off', { 'data-type': 'icon', 'data-icon-start': 'gear', 'aria-label': 'Settings', 'data-no-tip': true });
    await mk('bold', { 'data-type': 'icon', 'data-icon-start': 'gear', 'aria-label': 'Save', 'data-look': 'saturated' });
    await mk('bare', { 'data-type': 'icon', 'data-icon-start': 'gear' });
    await window.__settled();
  });

  const read = async (id: string) => {
    await page.locator(`#${id}`).locator('.trigger').hover();
    return page.evaluate((one) => {
      const host = document.getElementById(one)!;
      const tip = host.shadowRoot!.querySelector<HTMLElement>('.tip')!;
      const trigger = host.shadowRoot!.querySelector('.trigger')!.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      const cs = getComputedStyle(tip);
      return {
        shown: cs.display !== 'none',
        text: tip.textContent,
        bg: cs.backgroundColor,
        // Anchored to its OWN button, above it.
        above: box.bottom <= trigger.top + 1 && Math.abs((box.left + box.right) / 2
          - (trigger.left + trigger.right) / 2) < trigger.width,
      };
    }, id);
  };

  const icon = await read('icon');
  expect(icon).toMatchObject({ shown: true, text: 'Settings', above: true });
  expect(await read('own')).toMatchObject({ shown: true, text: 'Open the settings' });
  // The LABEL already says it — a tip would repeat it.
  expect((await read('text')).shown).toBe(false);
  expect(await read('told')).toMatchObject({ shown: true, text: 'Apply every change' });
  expect((await read('off')).shown).toBe(false);
  // A SATURATED button's ink is white; its tip keeps its own colours.
  expect((await read('bold')).bg).toBe(icon.bg);
  expect((await read('bare')).shown).toBe(false);
});

/**
 * A TIP LIVES IN THE TOP LAYER — Will, TODO 157: "Tooltip are getting clipped
 * by other elements. Tooltips should be at the top level in CSS so that they
 * sit above everything else." A `position: fixed` tip is still held, and cut,
 * by any box with layout containment — every card is one. A READER'S view is
 * the proof: the pixels where the tip hangs out of its box are the tip's.
 * TRAP T-a-tip-lives-in-the-top-layer
 */
test('a tip is lifted to the top layer, so a box that clips its button does not clip it', async ({ page }) => {
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.replaceChildren();
    root.style.cssText = 'padding: 80px 200px; background: rgb(255, 255, 255);';
    // A CARD: it clips, and it is a container — so it holds a fixed child.
    root.innerHTML = '<div id="box" style="inline-size: 40px; overflow: hidden; container-type: inline-size; padding: 4px">'
      + '<sherpa-button id="clipped" data-type="icon" data-icon-start="gear" aria-label="Send Region to Customer records"></sherpa-button></div>'
      + '<sherpa-barchart id="bars" style="inline-size: 240px; block-size: 160px; margin-block-start: 80px"></sherpa-barchart>';
    await window.__settled();
    await (document.getElementById('bars') as HTMLElement & { populate(d: unknown): Promise<void> | void })
      .populate([{ label: 'One', value: 4 }, { label: 'Two', value: 9 }]);
    await window.__settled();
  });
  const tipOf = (): Promise<{ open: boolean; shown: boolean; left: number; right: number; y: number; boxLeft: number; boxRight: number }> =>
    page.evaluate(() => {
      const tip = document.getElementById('clipped')!.shadowRoot!.querySelector<HTMLElement>('.tip')!;
      const r = tip.getBoundingClientRect();
      const box = document.getElementById('box')!.getBoundingClientRect();
      return { open: tip.matches(':popover-open'), shown: getComputedStyle(tip).display !== 'none',
        left: r.left, right: r.right, y: r.top + r.height / 2, boxLeft: box.left, boxRight: box.right };
    });
  expect((await tipOf()).open).toBe(false);

  await page.locator('#clipped .trigger').hover();
  await expect.poll(async () => (await tipOf()).open).toBe(true);
  const up = await tipOf();
  expect(up.shown).toBe(true);
  // Wider than the box that holds its button, on both sides.
  expect(up.left).toBeLessThan(up.boxLeft);
  expect(up.right).toBeGreaterThan(up.boxRight);
  // …and DRAWN there: outside the box the pixels are the tip's dark fill, not the page's white.
  const shot = await page.screenshot({ clip: { x: Math.round(up.left) + 6, y: Math.round(up.y) - 1, width: 2, height: 2 } });
  const pixel = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, shot.toString('base64'));
  expect(Math.max(...pixel)).toBeLessThan(80);

  // Un-hovered, it leaves the top layer again.
  await page.mouse.move(0, 0);
  await expect.poll(async () => (await tipOf()).open).toBe(false);

  // FOCUS lifts it too, and a chart's tip is lifted the same way.
  await page.locator('#clipped .trigger').focus();
  await expect.poll(async () => (await tipOf()).open).toBe(true);
  await page.locator('#bars .bar-col').first().hover();
  await expect.poll(() => page.evaluate(() =>
    document.getElementById('bars')!.shadowRoot!.querySelector('.bar-col .chart-tip')!.matches(':popover-open'))).toBe(true);
});
