import { test, expect, type Page } from './harness';

/** The colour a READER sees at one point of the page — never what CSS says. */
async function pixelAt(page: Page, x: number, y: number): Promise<number[]> {
  const shot = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 2, height: 2 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, shot.toString('base64'));
}

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
  expect(Math.max(...await pixelAt(page, up.left + 6, up.y - 1))).toBeLessThan(80);

  // Un-hovered, it leaves the top layer again.
  await page.mouse.move(0, 0);
  await expect.poll(async () => (await tipOf()).open).toBe(false);

  // FOCUS lifts it too, and a chart's tip is lifted the same way.
  await page.locator('#clipped .trigger').focus();
  await expect.poll(async () => (await tipOf()).open).toBe(true);
  await page.locator('#bars .bar-col').first().hover();
  await expect.poll(() => page.evaluate(() =>
    document.getElementById('bars')!.shadowRoot!.querySelector('.bar-col .sherpa-tip')!.matches(':popover-open'))).toBe(true);
});

/* A move from one segment to the next never reaches the document: both ends are
   in the chart's root. Its root hears it. TODO 381 · TRAP T-a-tip-lives-in-the-top-layer */
test('moving from one donut slice to the next shows the next slice\'s tip, and drops the first', async ({ page }) => {
  await page.evaluate(async () => {
    const chart = document.createElement('sherpa-radial-chart') as HTMLElement & { rendered: Promise<void>; populate(d: unknown): void };
    chart.id = 'donut';
    chart.style.cssText = 'inline-size: 320px; block-size: 320px';
    document.getElementById('root')!.replaceChildren(chart);
    await chart.rendered;
    chart.populate([{ label: 'Free', value: 3 }, { label: 'Pro', value: 3 }, { label: 'Team', value: 3 }]);
    await window.__settled();
  });
  // A point well inside each slice.
  const inside = await page.evaluate(() => {
    const sr = document.getElementById('donut')!.shadowRoot!;
    return [...sr.querySelectorAll<SVGPathElement>('path.chart-segment')].map((path) => {
      const r = path.getBoundingClientRect();
      for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
        const x = r.x + (r.width * i) / 10, y = r.y + (r.height * j) / 10;
        if ([[0, 0], [3, 3], [-3, -3]].every(([dx, dy]) => sr.elementFromPoint(x + dx!, y + dy!) === path)) return { x, y };
      }
      return null;
    });
  });
  const open = () => page.evaluate(() => [...document.getElementById('donut')!.shadowRoot!.querySelectorAll('.sherpa-tip')]
    .map((t) => t.matches(':popover-open')));
  await page.mouse.move(inside[0]!.x, inside[0]!.y);
  await expect.poll(open).toEqual([true, false, false]);
  await page.mouse.move(inside[1]!.x, inside[1]!.y);
  await expect.poll(open).toEqual([false, true, false]);
});

/* The pointer can land FIRST on a part in another tree: the button's badge, or
   a slotted label. Its tip still opens in the top layer, and CSS shows a tip
   only while it is open, so it never shows where its card clips it. TODO 364
   TRAP T-a-tip-lives-in-the-top-layer */
test('a tip shows only from the top layer, wherever on its button the pointer lands', async ({ page }) => {
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.style.cssText = 'padding: 120px 160px; background: rgb(255, 255, 255); display: flex; gap: 200px; align-items: start';
    // A CARD: it clips, and it is a container — so it holds a fixed child.
    const card = 'inline-size: 120px; overflow: hidden; container-type: inline-size; padding: 4px';
    root.innerHTML = `<div id="card-badge" style="${card}"><sherpa-button id="badged" data-badge="3"`
      + ' data-tip="Open every message sent to the team">Inbox</sherpa-button></div>'
      + `<div id="card-slot" style="${card}"><sherpa-button id="slotted"`
      + ' data-tip="Apply every change to every row"><b id="word">Apply</b></sherpa-button></div>';
    await window.__settled();
  });
  const where = (id: string, part: string) => page.evaluate(([one, sel]) => {
    const host = document.getElementById(one)!;
    const el = sel === 'badge' ? host.shadowRoot!.querySelector('sherpa-badge')! : document.querySelector(sel)!;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, [id, part] as const);
  const tipOf = (id: string, card: string) => page.evaluate(([one, box]) => {
    const tip = document.getElementById(one)!.shadowRoot!.querySelector<HTMLElement>('.tip')!;
    const r = tip.getBoundingClientRect();
    return { open: tip.matches(':popover-open'), shown: getComputedStyle(tip).display !== 'none',
      // In its PADDING, clear of the text.
      x: r.x + 3, y: r.y + r.height / 2, cardTop: document.getElementById(box)!.getBoundingClientRect().top };
  }, [id, card] as const);

  for (const [id, part, card] of [['badged', 'badge', 'card-badge'], ['slotted', '#word', 'card-slot']] as const) {
    const at = await where(id, part);
    await page.mouse.move(at.x, at.y);
    await expect.poll(async () => (await tipOf(id, card)).open, `${id}: open`).toBe(true);
    const up = await tipOf(id, card);
    expect(up.shown).toBe(true);
    // ABOVE its card, where the card would clip it: the reader sees the tip's dark fill.
    expect(up.y).toBeLessThan(up.cardTop);
    expect(Math.max(...await pixelAt(page, up.x, up.y)), `${id}: drawn`).toBeLessThan(80);
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await tipOf(id, card)).shown, `${id}: gone`).toBe(false);
  }
});

/* ONE tip at a time: a hover shuts the tip keyboard focus opened. A tip its
   host hides (data-no-tip) is never held open. TODO 364 · TRAP T-a-tip-lives-in-the-top-layer */
test('one tip is open at a time, and a tip turned off is never held open', async ({ page }) => {
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.style.cssText = 'padding: 80px; display: flex; gap: 120px';
    root.innerHTML = '<sherpa-button id="one" data-type="icon" data-icon-start="gear" aria-label="First"></sherpa-button>'
      + '<sherpa-button id="two" data-type="icon" data-icon-start="gear" aria-label="Second"></sherpa-button>'
      + '<sherpa-button id="off" data-type="icon" data-icon-start="gear" aria-label="Off" data-no-tip></sherpa-button>';
    await window.__settled();
  });
  const open = () => page.evaluate(() => ['one', 'two', 'off'].map((id) =>
    document.getElementById(id)!.shadowRoot!.querySelector('.tip')!.matches(':popover-open')));
  await page.locator('#one .trigger').focus();
  await expect.poll(open).toEqual([true, false, false]);
  await page.locator('#two .trigger').hover();
  await expect.poll(open).toEqual([false, true, false]);
  await page.locator('#off .trigger').hover();
  await expect.poll(open).toEqual([false, false, false]);
});

/* Read a frame after the hover, never in it (plan 695 P6): a tip its host hides
   still shuts no other — the one keyboard focus holds stays — and only a root
   that holds an anchor listens. TRAP T-a-tip-lives-in-the-top-layer */
test('a tip turned off shuts no other, and a root with no anchor never lifts one', async ({ page }) => {
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.style.cssText = 'padding: 80px; display: flex; gap: 120px';
    root.innerHTML = '<sherpa-button id="one" data-type="icon" data-icon-start="gear" aria-label="First"></sherpa-button>'
      + '<sherpa-button id="off" data-type="icon" data-icon-start="gear" aria-label="Off" data-no-tip></sherpa-button>'
      + '<sherpa-badge id="badge">3</sherpa-badge>';
    await window.__settled();
  });
  const open = () => page.evaluate(() => ['one', 'off'].map((id) =>
    document.getElementById(id)!.shadowRoot!.querySelector('.tip')!.matches(':popover-open')));
  await page.locator('#one .trigger').focus();
  await expect.poll(open).toEqual([true, false]);
  await page.mouse.move(1, 1);
  await page.locator('#off .trigger').hover();
  await expect.poll(open).toEqual([true, false]);
  await page.locator('#badge').hover();
  await expect.poll(open).toEqual([true, false]);
});
