import { test, expect, type Bar } from './harness';

/**
 * ONE "FILTERS" BUTTON. Will, 2026-09-25: "We should merge the overflow 'More'
 * button and the 'Add filter' button … into 1 button", in the action group,
 * labelled "Filters" with a plus on the left.
 *
 * Its menu lists the chips the bar HIDES for want of room first — each still a
 * door into its own menu — then every filter, then the saved ones. Its badge
 * counts the hidden chips, and it reads ON when a hidden chip is on, as More did.
 * TRAP T-one-filters-button
 */
const SIX = ['Server', 'Region', 'Customer', 'Date', 'Preset', 'Owner'].map((label) => ({
  id: label.toLowerCase(), label,
  options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
}));

async function mount(page: import('@playwright/test').Page, width: number) {
  await page.evaluate(async ({ SIX, width }) => {
    const box = document.createElement('div');
    box.style.inlineSize = `${width}px`;
    const el = document.createElement('sherpa-quick-filter-toolbar') as unknown as Bar;
    box.appendChild(el);
    document.getElementById('root')!.replaceChildren(box);
    await el.rendered;
    el.populate([...SIX, { id: 'at-risk', label: 'At risk' }]);
    el.available([
      { id: 'tier', label: 'Tier', options: [{ value: 'gold', label: 'Gold' }] },
      { id: 'custom:mine', label: 'Mine', readings: { tier: { picked: ['gold'] } } },
    ]);
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  }, { SIX, width });
}

/** The button, and its menu's rows in order: `§Heading`, a tick's value, `›` for a caret. */
const look = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const sr = document.querySelector('sherpa-quick-filter-toolbar')!.shadowRoot!;
  const btn = sr.querySelector<HTMLElement>('.add-btn')!;
  const menu = btn.querySelector('sherpa-menu')!;
  const rows = [...menu.children].filter((n) => !n.classList.contains('qf-all')).map((n) => {
    if (n.classList.contains('menu-section')) return `§${n.textContent}`;
    const box = n.querySelector('input');
    // A folded chip's row opens its child menu: `›` is its caret.
    const caret = n.hasAttribute('data-drill') ? '›' : '';
    return box ? `${box.value}${caret}` : `${caret}${(n as HTMLElement).dataset['value']}`;
  });
  return {
    more: !!sr.querySelector('.overflow-chip'),
    // Its OWN text: the menu inside it has text too.
    label: [...btn.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent).join('').trim(),
    icon: btn.getAttribute('data-icon-start'),
    badge: btn.getAttribute('data-badge'),
    on: btn.getAttribute('data-status'),
    heading: menu.getAttribute('data-heading'),
    // Adding EVERY filter at once is never the answer. Will, 2026-09-25.
    selectAll: !!menu.querySelector('.qf-all'),
    rows,
  };
});

test('ONE button: "Filters", a plus; hidden chips first, then Added, Available, Custom', async ({ page }) => {
  await mount(page, 1400);
  const wide = await look(page);
  await mount(page, 560);
  const narrow = await look(page);

  expect(wide.more).toBe(false);
  expect(wide.label).toBe('Filters');
  expect(wide.icon).toBe('plus');
  expect(wide.heading).toBe('Filters');
  expect(wide.selectAll).toBe(false);
  // Nothing hidden: no badge, no section of hidden chips.
  expect(wide.badge).toBeNull();
  expect(wide.rows).toEqual(['§Available filters', 'tier', '§Saved filters', 'custom:mine']);

  /* HIDDEN chips are ADDED filters — ONE section, not a second one — and each
     row has a caret into its child menu. None here can be taken off, so none
     has a box. Will, 2026-09-25. TRAP T-a-row-opens-its-child-menu */
  expect(narrow.more).toBe(false);
  expect(narrow.selectAll).toBe(false);
  const hidden = narrow.rows.slice(1, narrow.rows.indexOf('§Available filters'));
  expect(narrow.rows[0]).toBe('§Added filters');
  expect(narrow.rows).not.toContain('§More filters');
  expect(hidden.length).toBeGreaterThan(0);
  expect(Number(narrow.badge)).toBe(hidden.length);
  expect(hidden.at(-1)).toBe('›at-risk');
  expect(hidden.every((r) => r.startsWith('›'))).toBe(true);
  expect(narrow.rows.slice(narrow.rows.indexOf('§Available filters'))).toEqual(
    ['§Available filters', 'tier', '§Saved filters', 'custom:mine']);
});

test('the button is ON while a hidden chip is, and a drill inside it adds nothing', async ({ page }) => {
  await mount(page, 560);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-quick-filter-toolbar') as unknown as Bar;
    const sr = el.shadowRoot!;
    const btn = sr.querySelector<HTMLElement>('.add-btn')!;
    const menu = btn.querySelector('sherpa-menu') as HTMLElement & { shadowRoot: ShadowRoot; show(t: HTMLElement): void };
    const settle = () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const held = [...el.heldFields];

    const wait = () => new Promise((res) => setTimeout(res, 200));
    const back = async () => {
      (menu.shadowRoot.querySelector('.drill-back') as HTMLElement).shadowRoot!.querySelector('button')!.click();
      await settle();
    };
    menu.show(btn);
    await window.__settled();

    // The hidden ON/OFF chip: its caret opens "On", and "On" turns it on.
    menu.querySelector<HTMLElement>('.menu-row[data-value="at-risk"] .menu-row-drill')!.click();
    await wait();
    const toggle = menu.querySelector<HTMLInputElement>('input[value="on"]')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const on = btn.getAttribute('data-status');
    await back();

    // DRILL into a hidden chip's own menu, and tick one of its values.
    const door = [...menu.querySelectorAll<HTMLElement>('.menu-row[data-drill]')]
      .find((r) => r.dataset['value'] !== 'at-risk')!;
    const target = door.dataset['value']!;
    door.querySelector<HTMLElement>('.menu-row-drill')!.click();
    await wait();
    const drilled = { heading: menu.getAttribute('data-heading'), drill: menu.hasAttribute('data-drill') };
    const box = menu.querySelector<HTMLInputElement>('label:not(.qf-all) input')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    menu.dispatchEvent(new CustomEvent('menu-change', { bubbles: true, composed: true, detail: { values: ['a'] } }));
    await settle();
    const ticked = el.readings[target]?.picked ?? null;

    // BACK: the button's own menu again, with its own Apply.
    menu.shadowRoot.querySelector<HTMLElement>('.drill-back')!.click();
    await settle();
    return {
      on, drilled, ticked, target,
      back: { heading: menu.getAttribute('data-heading'), commit: menu.hasAttribute('data-commit'),
        first: menu.firstElementChild?.classList.contains('menu-section') ?? false },
      // A pick inside a drill is that chip's, never an Add or a Remove.
      held: el.heldFields.join(',') === held.join(','),
      kept: el.readings[target]?.picked ?? null,
    };
  });

  expect(r.on).toBe('active');
  expect(r.drilled.drill).toBe(true);
  expect(r.drilled.heading).not.toBe('Filters');
  expect(r.ticked).toEqual(['a']);
  expect(r.held).toBe(true);
  expect(r.kept).toEqual(['a']);
  expect(r.back).toEqual({ heading: 'Filters', commit: true, first: true });
});

test('its badge is a sherpa-badge, drawn exactly as a chip draws its count', async ({ page }) => {
  await mount(page, 560);
  const r = await page.evaluate(async () => {
    const sr = document.querySelector('sherpa-quick-filter-toolbar')!.shadowRoot!;
    const btn = sr.querySelector<HTMLElement>('.add-btn')!;
    // ON, so the button's own tint is there to leak in if the pin were missing.
    const menu = btn.querySelector('sherpa-menu') as HTMLElement & { show(t: HTMLElement): void; hide(): void };
    menu.show(btn);
    await window.__settled();
    menu.querySelector<HTMLElement>('.menu-row[data-value="at-risk"] .menu-row-drill')!.click();
    await new Promise((res) => setTimeout(res, 200));
    const toggle = menu.querySelector<HTMLInputElement>('input[value="on"]')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    menu.hide();

    const chip = document.createElement('sherpa-quick-filter');
    chip.setAttribute('data-label', 'Region');
    chip.setAttribute('data-count', '2');
    document.getElementById('root')!.append(chip);
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

    const draw = (el: Element) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopStyle, edge: s.borderTopColor, fill: s.backgroundColor, ink: s.color,
        size: s.fontSize, weight: s.fontWeight, height: s.height, radius: s.borderTopLeftRadius };
    };
    const badge = btn.shadowRoot!.querySelector('.badge-value')!;
    return {
      on: btn.getAttribute('data-status'),
      tag: badge.tagName.toLowerCase(),
      text: badge.textContent,
      count: btn.getAttribute('data-badge'),
      badge: draw(badge.shadowRoot!.querySelector('.box')!),
      chip: draw(chip.shadowRoot!.querySelector('.count')!),
      tint: getComputedStyle(btn.shadowRoot!.querySelector('.trigger')!).backgroundColor,
    };
  });

  expect(r.on).toBe('active');
  expect(r.tag).toBe('sherpa-badge');
  expect(r.text).toBe(r.count);
  expect(r.badge.border).toBe('solid');
  expect(r.badge).toEqual(r.chip);
  expect(r.badge.fill).not.toBe(r.tint);
});
