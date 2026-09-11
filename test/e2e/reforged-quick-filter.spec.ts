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

    // Ticking ONE row sets the on-state. No count badge at one pick — the label
    // names the value instead.
    menu.querySelector<HTMLInputElement>('input')!.click();
    const count = el.dataset['count'];
    const currentAfterPick = el.hasAttribute('data-current');

    return { opened, currentAfterOpen, expanded, count, currentAfterPick, changes };
  });
  expect(r.opened).toBe(true);
  expect(r.currentAfterOpen).toBe(false);
  expect(r.expanded).toBe('true');
  expect(r.count).toBeUndefined();
  expect(r.currentAfterPick).toBe(true);
  expect(r.changes).toEqual([['emea']]);
});

test('exactly one picked value reads "Field: Value"; two or more fall back to the field name', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-label', 'Region');
    el.setAttribute('data-menu', '');
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-select', 'multiple');
    // Raw value vs visible text differ on purpose — the chip must show the TEXT.
    for (const [value, text] of [['emea', 'EMEA'], ['apac', 'APAC']]) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = value!;
      label.append(input, document.createTextNode(text!));
      menu.appendChild(label);
    }
    el.appendChild(menu);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await menu.rendered;

    const rows = menu.querySelectorAll<HTMLInputElement>('input');
    const shown = (): string => el.shadowRoot!.querySelector('.label')!.textContent!.trim();

    rows[0]!.click();
    const one = { label: el.dataset['label'], shown: shown(), count: el.dataset['count'] };

    rows[1]!.click();
    const two = { label: el.dataset['label'], shown: shown(), count: el.dataset['count'] };

    // Back down to one: the label must re-form, not stay stuck on the field name.
    rows[0]!.click();
    const backToOne = { label: el.dataset['label'], shown: shown(), count: el.dataset['count'] };

    // Back to none: the bare field name returns.
    rows[1]!.click();
    const none = { label: el.dataset['label'], shown: shown(), count: el.dataset['count'] };

    return { one, two, backToOne, none };
  });

  // One pick: the label carries the value, so the badge stays away.
  expect(r.one).toEqual({ label: 'Region: EMEA', shown: 'Region: EMEA', count: undefined });
  expect(r.two).toEqual({ label: 'Region', shown: 'Region', count: '2' });
  expect(r.backToOne).toEqual({ label: 'Region: APAC', shown: 'Region: APAC', count: undefined });
  expect(r.none).toEqual({ label: 'Region', shown: 'Region', count: undefined });
});

test('a single-select chip reads "Field: Value" with no count badge', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-label', 'Group');
    el.setAttribute('data-menu', '');
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-select', 'single');
    for (const [value, text] of [['site', 'Site'], ['os', 'Operating System']]) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'group';
      input.value = value!;
      label.append(input, document.createTextNode(text!));
      menu.appendChild(label);
    }
    el.appendChild(menu);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await menu.rendered;

    const rows = menu.querySelectorAll<HTMLInputElement>('input');
    rows[0]!.click();
    const first = { label: el.dataset['label'], count: el.dataset['count'] };
    // A radio swap replaces the value, so the label must follow the NEW pick.
    rows[1]!.click();
    const second = { label: el.dataset['label'], count: el.dataset['count'] };
    return { first, second };
  });

  expect(r.first).toEqual({ label: 'Group: Site', count: undefined });
  expect(r.second).toEqual({ label: 'Group: Operating System', count: undefined });
});

test('hovering the count badge reveals a bubble ABOVE it listing the chosen values', async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
    el.id = 'qf';
    el.setAttribute('data-label', 'Region');
    el.setAttribute('data-menu', '');
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-select', 'multiple');
    for (const [value, text] of [['emea', 'EMEA'], ['apac', 'APAC'], ['amer', 'Americas']]) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = value!;
      label.append(input, document.createTextNode(text!));
      menu.appendChild(label);
    }
    el.appendChild(menu);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await menu.rendered;
    // Two picks — enough for the badge to appear.
    const rows = menu.querySelectorAll<HTMLInputElement>('input');
    rows[0]!.click();
    rows[2]!.click();
  });

  const badge = page.locator('#qf').locator('.count');
  const tip = page.locator('#qf').locator('.count-tip');

  // The bubble carries the value TEXT, not the raw values.
  await expect(tip).toHaveText('EMEA, Americas');
  // ...and the same list reaches AT, because the bubble itself is aria-hidden.
  await expect(badge).toHaveAttribute('aria-label', '2 selected: EMEA, Americas');
  await expect(tip).toHaveAttribute('aria-hidden', 'true');

  // Hidden until hovered — and hidden by CSS visibility, not by JS.
  await expect(tip).toBeHidden();

  await badge.hover();
  await expect(tip).toBeVisible();

  // It sits ABOVE the badge: the bubble's bottom edge is at or above the badge's top.
  const t = (await tip.boundingBox())!;
  const b = (await badge.boundingBox())!;
  expect(t.y + t.height).toBeLessThanOrEqual(b.y + 1);

  // Moving away hides it again.
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
});

test('a value chip that is ON with no values picked paints WARNING, not active', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const make = async (withMenu: boolean) => {
      const el = document.createElement('sherpa-quick-filter') as HTMLElement & {
        rendered?: Promise<void>;
        current?: boolean;
      };
      el.setAttribute('data-label', withMenu ? 'Region' : 'Starred');
      if (withMenu) {
        el.setAttribute('data-menu', '');
        const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
        menu.setAttribute('slot', 'menu');
        menu.setAttribute('data-select', 'multiple');
        for (const [value, text] of [['emea', 'EMEA'], ['apac', 'APAC']]) {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = value!;
          label.append(input, document.createTextNode(text!));
          menu.appendChild(label);
        }
        el.appendChild(menu);
        document.getElementById('root')!.appendChild(el);
        await el.rendered;
        await menu.rendered;
      } else {
        document.getElementById('root')!.appendChild(el);
        await el.rendered;
      }
      return el;
    };

    // The chip TRANSITIONS background-color and border-color over 100ms, so a
    // read taken right after the attribute write returns a blend part-way
    // between the two looks, not either end state. Wait for the animations to
    // finish, then read — this is a paint assertion, not a timing one.
    const paint = async (el: HTMLElement) => {
      const body = el.shadowRoot!.querySelector('.body') as HTMLElement;
      await Promise.all(body.getAnimations().map((a) => a.finished.catch(() => undefined)));
      const cs = getComputedStyle(body);
      return { bg: cs.backgroundColor, border: cs.borderTopColor };
    };

    const value = await make(true);
    const toggle = await make(false);

    // Switch the value chip on with nothing picked — the contradiction.
    value.current = true;
    const emptyOn = { empty: value.hasAttribute('data-empty'), ...(await paint(value)) };

    // Pick something — it becomes a real applied filter, so back to the active look.
    const input = value.querySelector<HTMLInputElement>('input')!;
    input.click();
    const withValue = { empty: value.hasAttribute('data-empty'), ...(await paint(value)) };

    // Untick the last value: the chip switches itself OFF (existing behaviour —
    // no picks means nothing applied), so it is plain off, not on-and-empty.
    input.click();
    const unticked = {
      current: value.hasAttribute('data-current'),
      empty: value.hasAttribute('data-empty'),
    };

    // Re-arm the contradiction the way a host does: on, with nothing picked.
    value.current = true;
    const emptyAgain = { empty: value.hasAttribute('data-empty'), ...(await paint(value)) };

    // A plain TOGGLE chip has no values to hold, so "on" is never empty.
    toggle.current = true;
    const toggleOn = { empty: toggle.hasAttribute('data-empty'), ...(await paint(toggle)) };

    return { emptyOn, withValue, unticked, emptyAgain, toggleOn };
  });

  // Warning: surface-warning-base #FFF4E1 face, border-warning-2 #FFC44C ring.
  expect(r.emptyOn.empty).toBe(true);
  expect(r.emptyOn.bg).toBe('rgb(255, 244, 225)');
  expect(r.emptyOn.border).toBe('rgb(255, 196, 76)');

  // Active: the brand-purple tint and ring.
  expect(r.withValue.empty).toBe(false);
  expect(r.withValue.bg).toBe('rgb(242, 223, 255)');
  expect(r.withValue.border).toBe('rgb(192, 70, 255)');

  // Unticking the last value turns the chip off rather than leaving it on-and-empty.
  expect(r.unticked).toEqual({ current: false, empty: false });

  // Switched back on with nothing picked → the warning look returns.
  expect(r.emptyAgain.empty).toBe(true);
  expect(r.emptyAgain.bg).toBe('rgb(255, 244, 225)');

  // The toggle chip keeps the plain active look.
  expect(r.toggleOn.empty).toBe(false);
  expect(r.toggleOn.bg).toBe('rgb(242, 223, 255)');
});
