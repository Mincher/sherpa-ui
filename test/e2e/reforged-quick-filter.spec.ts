import { test, expect } from './harness';

/** sherpa-quick-filter — a chip that toggles active on click; ai type uses brand purple. */


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

  // The joint is flush: Structure `structure-space/snapped` is 0, so the two
  // halves BUTT rather than overlap. This assertion is what proves the snap
  // margin resolved to the token rather than to some stray default.
  expect(r.menu.overlap).toBeCloseTo(0, 2);
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

test('the chip keeps the FIELD name; the caret button carries the picked VALUE', async ({ page }) => {
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
    const read = () => ({
      // The chip's own label — must NOT move.
      chip: el.shadowRoot!.querySelector('.label')!.textContent!.trim(),
      // The caret button's label — the picked value lives here now.
      caret: el.shadowRoot!.querySelector('.caret-label')!.textContent!.trim(),
      count: el.dataset['count'],
    });

    rows[0]!.click();
    const one = read();

    rows[1]!.click();
    const two = read();

    // Back down to one: the caret must re-form, not stay stuck on the ellipsis.
    rows[0]!.click();
    const backToOne = read();

    // Back to none: the caret empties and the chip is unchanged throughout.
    rows[1]!.click();
    const none = read();

    return { one, two, backToOne, none };
  });

  // One pick: the caret names the value, so the badge stays away.
  expect(r.one).toEqual({ chip: 'Region', caret: 'EMEA', count: undefined });
  // Two or more: the caret shows the FIRST plus an ellipsis, the badge the number.
  expect(r.two).toEqual({ chip: 'Region', caret: 'EMEA…', count: '2' });
  expect(r.backToOne).toEqual({ chip: 'Region', caret: 'APAC', count: undefined });
  // Nothing picked: an EMPTY caret label, which CSS collapses to a bare caret.
  expect(r.none).toEqual({ chip: 'Region', caret: '', count: undefined });
});

test('a single-select chip names its one value in the caret, with no count badge', async ({ page }) => {
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
    const read = () => ({
      chip: el.dataset['label'],
      caret: el.shadowRoot!.querySelector('.caret-label')!.textContent!.trim(),
      count: el.dataset['count'],
    });
    rows[0]!.click();
    const first = read();
    // A radio swap REPLACES the value, so the caret must follow the new pick.
    rows[1]!.click();
    const second = read();
    return { first, second };
  });

  // Single-select can never reach two, so the badge can never say anything.
  expect(r.first).toEqual({ chip: 'Group', caret: 'Site', count: undefined });
  expect(r.second).toEqual({ chip: 'Group', caret: 'Operating System', count: undefined });
});

test('hovering the chip reveals a bubble ABOVE it listing the chosen values', async ({ page }) => {
  await page.evaluate(async () => {
    // Pushed down the page, so there is room ABOVE for the bubble. At the very
    // top it correctly flips below, which is a different assertion.
    document.getElementById('root')!.style.paddingBlockStart = '120px';
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
  // The bubble belongs to a composed <sherpa-tooltip> wrapping the WHOLE CHIP,
  // so hovering any part of it shows the list — a 16px badge is a small target
  // to demand. It runs in FLOATING mode: the bar's chip run clips, and a
  // tooltip stands outside the box it belongs to by definition, so an absolute
  // bubble was cut off entirely.
  const chip = page.locator('#qf').locator('.chip');
  const tip = page.locator('#qf').locator('.count-wrap').locator('.bubble');

  // The bubble carries the value TEXT, not the raw values.
  await expect(tip).toHaveText('EMEA, Americas');
  // ...and the same list reaches AT through the badge's own label.
  await expect(badge).toHaveAttribute('aria-label', '2 selected: EMEA, Americas');

  // Hidden until hovered.
  await expect(tip).toBeHidden();

  // ANY part of the chip triggers it — this hovers the label, well away from
  // the badge. `force`, because Playwright's actionability check reads the
  // element's own hit target and the label is a zero-margin span inside a
  // button; the pointer lands on it either way, which is what the tooltip
  // listens for.
  await page.locator('#qf').locator('.chip > .body > .label').hover({ force: true });
  await expect(tip).toBeVisible();

  // TOP LAYER, so no ancestor's overflow can cut it off.
  expect(await tip.evaluate((n) => n.matches(':popover-open'))).toBe(true);

  // ABOVE the chip, and CENTRED on it.
  const t = (await tip.boundingBox())!;
  const c = (await chip.boundingBox())!;
  expect(t.y + t.height).toBeLessThanOrEqual(c.y + 1);
  expect(Math.abs(t.x + t.width / 2 - (c.x + c.width / 2))).toBeLessThan(3);

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

test('the caret label sits on the SAME text line as the chip label', async ({ page }) => {
  // Two causes of a vertical mismatch, both silent because the element BOXES
  // line up perfectly either way — only the text inside them drifts:
  //
  //   1. a different line-height (14 vs 20) puts the baselines in different
  //      places inside boxes that share a midpoint;
  //   2. a <button> does NOT inherit the page font, so the caret's label
  //      rendered in the browser's own UI face (Arial) while the chip's rendered
  //      in Inter — same size, same line-height, different typeface.
  //
  // So this measures the TEXT with a Range, not the element box.
  const got = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-label', 'Region');
    el.setAttribute('data-menu', '');
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-select', 'multiple');
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = 'emea';
    label.append(input, document.createTextNode('EMEA'));
    menu.appendChild(label);
    el.appendChild(menu);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await menu.rendered;
    await document.fonts.ready;

    input.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const textTop = (node: Element): number => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().top;
    };
    const chipLabel = el.shadowRoot!.querySelector('.label')!;
    const caretLabel = el.shadowRoot!.querySelector('.caret-label')!;
    const family = (n: Element): string => getComputedStyle(n).fontFamily.split(',')[0]!.trim();
    return {
      delta: Math.abs(textTop(caretLabel) - textTop(chipLabel)),
      sameFont: family(caretLabel) === family(chipLabel),
      sameLineHeight:
        getComputedStyle(caretLabel).lineHeight === getComputedStyle(chipLabel).lineHeight,
    };
  });

  expect(got.sameFont).toBe(true);
  expect(got.sameLineHeight).toBe(true);
  // Exact, not approximate — both labels are 14 on 20 in Figma (150:3408).
  expect(got.delta).toBeLessThan(0.5);
});

/**
 * AN EMPTY CHIP'S BODY OPENS ITS MENU.
 *
 * With nothing picked there is nothing to cycle, so toggling did nothing at
 * all. TRAP T-an-empty-chip-opens-its-menu — and the boundary that matters is
 * the second case: a chip HOLDING a value keeps cycling, because "off" is a
 * state and not a delete.
 */
test('an EMPTY chip opens its menu; one holding a value still toggles', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();

    const host = document.getElementById('root')!;
    host.replaceChildren();

    // A VALUE chip: a body, a caret, and a menu of rows.
    const chip = document.createElement('sherpa-quick-filter') as HTMLElement & {
      rendered?: Promise<void>;
      values: string[];
      menu: (HTMLElement & { open?: boolean }) | null;
    };
    chip.dataset['label'] = 'Plan';
    chip.setAttribute('data-menu', '');
    chip.innerHTML = `
      <sherpa-menu slot="menu" data-select="multiple">
        <label><input type="checkbox" value="free" /> Free</label>
        <label><input type="checkbox" value="pro" /> Pro</label>
      </sherpa-menu>`;
    host.appendChild(chip);
    await chip.rendered;
    await settle();

    const body = (): HTMLElement => chip.shadowRoot!.querySelector<HTMLElement>('.body')!;
    const snap = (): Record<string, unknown> => ({
      values: [...chip.values],
      current: chip.hasAttribute('data-current'),
      menuOpen: chip.menu?.open ?? false,
    });

    // EMPTY → the body opens the menu and does not toggle.
    body().click();
    await settle();
    const empty = snap();

    // Pick one, so the chip now HOLDS a value.
    chip.values = ['pro'];
    await settle();
    chip.menu?.hide?.();
    await settle();
    const picked = snap();

    // HOLDING a value → the body cycles. Off keeps the pick.
    body().click();
    await settle();
    const off = snap();
    body().click();
    await settle();
    const backOn = snap();

    /* A TOGGLE-ONLY chip — no menu at all — must be untouched by this rule. */
    const toggle = document.createElement('sherpa-quick-filter') as HTMLElement & {
      rendered?: Promise<void>;
    };
    toggle.dataset['label'] = 'Active';
    host.appendChild(toggle);
    await toggle.rendered;
    await settle();
    toggle.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await settle();
    const toggled = toggle.hasAttribute('data-current');

    return { empty, picked, off, backOn, toggled };
  });

  // EMPTY: the menu opened, and the chip did NOT turn itself on.
  expect(r.empty.menuOpen, 'an empty body opens the menu').toBe(true);
  expect(r.empty.current, 'and does not toggle').toBe(false);

  expect(r.picked.values).toEqual(['pro']);

  // HOLDING a value: the body cycles, and OFF KEEPS THE PICK.
  expect(r.off.current, 'a value chip turns off').toBe(false);
  expect(r.off.values, 'and keeps what it holds').toEqual(['pro']);
  expect(r.off.menuOpen, 'without reopening the menu').toBe(false);
  expect(r.backOn.current, 'one more click brings it back').toBe(true);
  expect(r.backOn.values).toEqual(['pro']);

  // A chip with no menu is unaffected.
  expect(r.toggled, 'a toggle-only chip still toggles').toBe(true);
});
