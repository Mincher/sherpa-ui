import { test, expect } from '@playwright/test';

/** sherpa-quick-filter — a chip that toggles active on click; ai type uses brand purple. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('clicking toggles data-current and fires quick-filter-click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-label', 'Status');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const fired: boolean[] = [];
    el.addEventListener('quick-filter-click', (e) => fired.push((e as CustomEvent).detail.active));

    // .chip is a bare snap wrapper; .body is BOTH the box and the toggle target, so
    // the snapped caret button can sit beside it without toggling the filter.
    const body = el.shadowRoot!.querySelector<HTMLElement>('.body')!;
    body.click(); // on
    const afterOn = el.hasAttribute('data-current');
    body.click(); // off
    const afterOff = el.hasAttribute('data-current');

    return { fired, afterOn, afterOff, label: el.shadowRoot!.querySelector('.label')!.textContent };
  });
  expect(r.label).toBe('Status');
  expect(r.afterOn).toBe(true);
  expect(r.afterOff).toBe(false);
  expect(r.fired).toEqual([true, false]);
});

test('ai type paints the chip with the brand-purple accent', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const paint = async (type?: string) => {
      const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
      if (type) el.setAttribute('data-type', type);
      el.setAttribute('data-label', 'X');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      // The face, the ring and the ink all live on .body now — .chip is only the
      // snap wrapper, so it has no colour of its own to read.
      return getComputedStyle(el.shadowRoot!.querySelector('.body')!).color;
    };
    return { def: await paint(), ai: await paint('ai') };
  });
  expect(r.ai).toBe('rgb(192, 70, 255)'); // border-interactive-active #C046FF (brand)
  expect(r.ai).not.toBe(r.def);
});

/* ── State=menu — the snapped two-box variant (Figma 154:3904) ────────────── */

test('data-menu snaps a bordered caret button onto the chip, flattening the joint', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const build = async (menu: boolean) => {
      const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
      el.setAttribute('data-label', 'Region');
      if (menu) el.setAttribute('data-menu', '');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      const body = el.shadowRoot!.querySelector<HTMLElement>('.body')!;
      const caret = el.shadowRoot!.querySelector<HTMLElement>('.caret')!;
      const bs = getComputedStyle(body);
      const cs = getComputedStyle(caret);
      const br = body.getBoundingClientRect();
      const cr = caret.getBoundingClientRect();
      return {
        hostHeight: Math.round(el.getBoundingClientRect().height),
        caretShown: cs.display !== 'none',
        // Figma: chip corners 4/0/0/4, button corners 0/4/4/0.
        bodyCorners: [bs.borderTopLeftRadius, bs.borderTopRightRadius,
                      bs.borderBottomRightRadius, bs.borderBottomLeftRadius].join('/'),
        caretCorners: [cs.borderTopLeftRadius, cs.borderTopRightRadius,
                       cs.borderBottomRightRadius, cs.borderBottomLeftRadius].join('/'),
        // Both halves carry their OWN ring — the wrapper has none.
        wrapperBorder: getComputedStyle(el.shadowRoot!.querySelector('.chip')!).borderTopWidth,
        bodyHasRing: bs.borderTopStyle === 'solid',
        caretHasRing: cs.borderTopStyle === 'solid',
        // The caret is a white Style=default button, not a transparent affordance.
        caretBg: cs.backgroundColor,
        caretBox: [Math.round(cr.width), Math.round(cr.height)].join('x'),
        // space/snapped is a NEGATIVE gap, so the two rings must overlap.
        overlap: menu ? +(br.right - cr.left).toFixed(2) : null,
      };
    };
    return { simple: await build(false), menu: await build(true) };
  });

  // State=simple — one box, all four corners rounded, no caret.
  expect(r.simple.caretShown).toBe(false);
  expect(r.simple.bodyCorners).toBe('4px/4px/4px/4px');
  expect(r.simple.hostHeight).toBe(24);

  // State=menu — two boxes, corners flattened where they meet.
  expect(r.menu.caretShown).toBe(true);
  expect(r.menu.bodyCorners).toBe('4px/0px/0px/4px');
  expect(r.menu.caretCorners).toBe('0px/4px/4px/0px');
  expect(r.menu.hostHeight).toBe(24);
  expect(r.menu.caretBox).toBe('24x24');

  // The wrapper is bare; each half rings itself.
  expect(r.menu.wrapperBorder).toBe('0px');
  expect(r.menu.bodyHasRing).toBe(true);
  expect(r.menu.caretHasRing).toBe(true);
  expect(r.menu.caretBg).toBe('rgb(255, 255, 255)');

  // The joint is a single hairline, not a double line. CSS `gap` cannot go
  // negative (Chromium computes it back to `normal`), so the snap is a negative
  // margin — this assertion is what proves it actually applied.
  expect(r.menu.overlap).toBeCloseTo(0.5, 2);
});

test('the caret opens the slotted menu without toggling the chip', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-label', 'Region');
    el.setAttribute('data-menu', '');
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
    menu.setAttribute('slot', 'menu');
    for (const v of ['emea', 'apac']) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = v;
      label.append(input, document.createTextNode(v));
      menu.appendChild(label);
    }
    el.appendChild(menu);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await menu.rendered;

    const changes: string[][] = [];
    el.addEventListener('quick-filter-change', (e) => changes.push((e as CustomEvent).detail.values));

    const caret = el.shadowRoot!.querySelector<HTMLElement>('.caret')!;
    const card = menu.shadowRoot!.querySelector<HTMLElement>('.menu')!;

    caret.click();
    const opened = card.matches(':popover-open');
    // Opening the menu must NOT flip the filter on.
    const currentAfterOpen = el.hasAttribute('data-current');
    // aria-expanded is mirrored from the popover's `toggle` event, which the UA
    // QUEUES rather than firing synchronously — so wait for it, do not sleep.
    await new Promise((resolve) => el.addEventListener('menu-open', resolve, { once: true }));
    const expanded = caret.getAttribute('aria-expanded');

    // Ticking a row sets the count chip and the on-state.
    menu.querySelector<HTMLInputElement>('input')!.click();
    const count = el.dataset['count'];
    const currentAfterPick = el.hasAttribute('data-current');

    return { opened, currentAfterOpen, expanded, count, currentAfterPick, changes };
  });
  expect(r.opened).toBe(true);
  expect(r.currentAfterOpen).toBe(false);
  expect(r.expanded).toBe('true');
  expect(r.count).toBe('1');
  expect(r.currentAfterPick).toBe(true);
  expect(r.changes).toEqual([['emea']]);
});
