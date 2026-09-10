import { test, expect } from '@playwright/test';

/**
 * sherpa-menu — a native-popover list of choices, placed against its trigger.
 *
 * The placement tests are the point of this file. CSS anchor positioning was the
 * first attempt and it silently failed: `anchor-name` only resolves inside ONE
 * tree, and the trigger always lives in a different shadow root from the card, so
 * `position-anchor` found nothing and every menu rendered in the viewport corner.
 * These tests assert real measured coordinates so that regression cannot come back
 * unnoticed.
 */

const HARNESS = '/test/reforged/harness.html';
const GAP = 4; // SherpaMenu.OFFSET — Figma space/2xs

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

/**
 * Build a trigger in its OWN shadow root, so the cross-tree case is the one under
 * test, plus a menu beside it. Installed on `window` by the beforeEach below so
 * each test can call it without re-declaring it.
 */
interface MenuEl extends HTMLElement {
  rendered?: Promise<void>;
  show(trigger?: HTMLElement): void;
  toggle(trigger?: HTMLElement): void;
  open: boolean;
  values: string[];
}
interface Built {
  menu: MenuEl;
  trigger: HTMLElement;
  card: HTMLElement;
}
declare global {
  interface Window {
    __buildMenu(pos: string): Promise<Built>;
  }
}

async function installBuilder(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    window.__buildMenu = async (pos: string) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';

      // The trigger lives inside a shadow root of its own — exactly the
      // arrangement that defeats CSS anchor positioning.
      const holder = document.createElement('div');
      const sr = holder.attachShadow({ mode: 'open' });
      const trigger = document.createElement('button');
      trigger.textContent = 'Open';
      trigger.style.cssText = `position:fixed; inline-size:24px; block-size:24px; margin:0; ${pos}`;
      sr.appendChild(trigger);
      root.appendChild(holder);

      const menu = document.createElement('sherpa-menu') as MenuEl;
      for (const v of ['a', 'b', 'c']) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = v;
        label.append(input, document.createTextNode(`Option ${v}`));
        menu.appendChild(label);
      }
      root.appendChild(menu);
      await menu.rendered;
      return { menu, trigger, card: menu.shadowRoot!.querySelector<HTMLElement>('.menu')! };
    };
  });
}

test('the card is placed against its trigger across a shadow boundary', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async () => {
    const { menu, trigger, card } = await window.__buildMenu('top:200px; left:300px;');
    menu.show(trigger);

    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return {
      open: card.matches(':popover-open'),
      // The card must be FIXED — --_x / --_y are viewport coordinates.
      position: getComputedStyle(card).position,
      dx: Math.round(c.left - t.left),
      dy: Math.round(c.top - t.bottom),
      width: Math.round(c.width),
      // The 0.5px default ring the card must carry.
      ringStyle: getComputedStyle(card).borderTopStyle,
      ringWidth: getComputedStyle(card).borderTopWidth,
    };
  });

  expect(r.open).toBe(true);
  expect(r.position).toBe('fixed');
  // Start edges flush, sitting one gap below the trigger.
  expect(r.dx).toBe(0);
  expect(r.dy).toBe(GAP);
  expect(r.width).toBe(240); // Figma Menu card width
  // A card floating over other surfaces needs its own outline.
  expect(r.ringStyle).toBe('solid');
  expect(r.ringWidth).not.toBe('0px');
});

test('the card flips above the trigger when there is no room below', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async () => {
    // Pin the trigger to the very bottom, so below is impossible.
    const { menu, trigger, card } = await window.__buildMenu('bottom:10px; left:300px;');
    menu.show(trigger);
    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return {
      placedAbove: c.bottom <= t.top,
      gap: Math.round(t.top - c.bottom),
      onScreen: c.top >= 0,
    };
  });

  expect(r.placedAbove).toBe(true);
  expect(r.gap).toBe(GAP);
  expect(r.onScreen).toBe(true);
});

test('the card is pulled back inside the viewport at the right edge', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async () => {
    const { menu, trigger, card } = await window.__buildMenu('top:200px; right:10px;');
    menu.show(trigger);
    const c = card.getBoundingClientRect();
    return {
      right: Math.round(c.right),
      left: Math.round(c.left),
      viewport: document.documentElement.clientWidth,
    };
  });

  // Aligning the card's start edge with the trigger would overflow, so it clamps.
  expect(r.right).toBeLessThanOrEqual(r.viewport);
  expect(r.left).toBeGreaterThanOrEqual(0);
});

test('a closed card is not laid out, and toggle flips it', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async () => {
    const { menu, trigger, card } = await window.__buildMenu('top:200px; left:300px;');
    // A popover the UA has not opened must stay display:none — an earlier bug set
    // `display: flex` unconditionally, so every menu was visible on page load.
    const beforeDisplay = getComputedStyle(card).display;

    menu.toggle(trigger);
    const openedDisplay = getComputedStyle(card).display;
    // The `toggle` event the UA fires on a popover is QUEUED, not synchronous, and
    // it is what mirrors the state onto the host — so `open` is not set until the
    // next task. Wait for the event rather than for an arbitrary timeout.
    await new Promise((resolve) => menu.addEventListener('menu-open', resolve, { once: true }));
    const openAttr = menu.hasAttribute('open');

    menu.toggle(trigger);
    await new Promise((resolve) => menu.addEventListener('menu-close', resolve, { once: true }));
    return {
      beforeDisplay,
      openedDisplay,
      openAttr,
      closedAgain: !card.matches(':popover-open'),
    };
  });

  expect(r.beforeDisplay).toBe('none');
  expect(r.openedDisplay).toBe('flex');
  expect(r.openAttr).toBe(true);
  expect(r.closedAgain).toBe(true);
});

test('single-select rows share a radio name so only one can win', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const menu = document.createElement('sherpa-menu') as MenuEl;
    menu.setAttribute('data-select', 'single');
    menu.setAttribute('data-heading', 'Owner');
    for (const v of ['me', 'anyone']) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.value = v;
      label.append(input, document.createTextNode(v));
      menu.appendChild(label);
    }
    root.appendChild(menu);
    await menu.rendered;

    const inputs = Array.from(menu.querySelectorAll<HTMLInputElement>('input'));
    const names = inputs.map((i) => i.name);
    inputs[0]!.click();
    inputs[1]!.click();
    // The browser enforces the exclusivity for us — that is the whole point of
    // giving the rows a shared name rather than writing JS to police it.
    return { names, sameName: names[0] === names[1], values: menu.values };
  });

  expect(r.sameName).toBe(true);
  expect(r.names[0]).not.toBe('');
  expect(r.values).toEqual(['anyone']);
});

test('a committing menu defers changes to Apply, and Cancel discards them', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const menu = document.createElement('sherpa-menu') as MenuEl & {
      hide(): void;
    };
    // data-commit is what adds the footer AND withholds menu-change until Apply.
    menu.setAttribute('data-commit', '');
    for (const v of ['a', 'b', 'c']) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = v;
      label.append(input, document.createTextNode(v));
      menu.appendChild(label);
    }
    root.appendChild(menu);
    await menu.rendered;

    const events: Array<[string, unknown]> = [];
    for (const name of ['menu-change', 'menu-apply', 'menu-cancel']) {
      menu.addEventListener(name, (e) => events.push([name, (e as CustomEvent).detail]));
    }
    const sr = menu.shadowRoot!;
    const inputs = Array.from(menu.querySelectorAll<HTMLInputElement>('input'));
    const footer = sr.querySelector('.footer')!;
    const press = (sel: string): void => {
      // The footer buttons are sherpa-buttons, so click their inner control.
      const btn = sr.querySelector(sel)!;
      (btn.shadowRoot?.querySelector('button') ?? (btn as HTMLElement)).click();
    };

    const footerShown = getComputedStyle(footer).display !== 'none';

    // Open, tick one, and confirm NOTHING has been reported yet.
    menu.show();
    await new Promise((res) => setTimeout(res, 40));
    inputs[0]!.click();
    await new Promise((res) => setTimeout(res, 40));
    const draft = { events: events.length, ticked: inputs[0]!.checked, values: menu.values };

    // Cancel restores the values the menu OPENED with.
    press('.cancel');
    await new Promise((res) => setTimeout(res, 60));
    const cancelled = {
      names: events.map(([n]) => n),
      ticked: inputs[0]!.checked,
      values: menu.values,
    };

    // Reopen, tick a different row, Apply.
    menu.show();
    await new Promise((res) => setTimeout(res, 40));
    inputs[1]!.click();
    await new Promise((res) => setTimeout(res, 40));
    press('.apply');
    await new Promise((res) => setTimeout(res, 60));
    const applied = {
      names: events.map(([n]) => n),
      values: menu.values,
      lastChange: events.filter(([n]) => n === 'menu-change').pop()?.[1],
    };
    return { footerShown, draft, cancelled, applied };
  });

  expect(r.footerShown).toBe(true);

  // The row IS ticked in the UI, but nothing downstream has heard about it —
  // filtering a table on a half-built selection is rarely the query anyone wants.
  expect(r.draft.ticked).toBe(true);
  expect(r.draft.values).toEqual(['a']);
  expect(r.draft.events).toBe(0);

  // Cancel un-ticks it and reports only menu-cancel — never a menu-change.
  expect(r.cancelled.ticked).toBe(false);
  expect(r.cancelled.values).toEqual([]);
  expect(r.cancelled.names).toEqual(['menu-cancel']);

  // Apply reports BOTH: menu-apply for callers that care about the interaction,
  // and menu-change for the ones that just want the committed selection.
  expect(r.applied.names).toEqual(['menu-cancel', 'menu-apply', 'menu-change']);
  expect(r.applied.values).toEqual(['b']);
  expect(r.applied.lastChange).toEqual({ values: ['b'] });
});

test('a menu WITHOUT data-commit still commits on every tick', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const menu = document.createElement('sherpa-menu') as MenuEl;
    for (const v of ['x', 'y']) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = v;
      label.append(input, document.createTextNode(v));
      menu.appendChild(label);
    }
    root.appendChild(menu);
    await menu.rendered;

    const changes: string[][] = [];
    menu.addEventListener('menu-change', (e) => changes.push((e as CustomEvent).detail.values));
    const footerShown =
      getComputedStyle(menu.shadowRoot!.querySelector('.footer')!).display !== 'none';
    menu.querySelector<HTMLInputElement>('input')!.click();
    await new Promise((res) => setTimeout(res, 40));
    return { footerShown, changes };
  });

  // No footer, and the tick commits straight away — the behaviour every menu had
  // before, kept for action menus and anything that is cheap to react to.
  expect(r.footerShown).toBe(false);
  expect(r.changes).toEqual([['x']]);
});
