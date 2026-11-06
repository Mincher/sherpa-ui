import { test, expect, type Bar } from './harness';

/**
 * ONE "FILTERS" BUTTON. Will, 2026-09-25: "We should merge the overflow 'More'
 * button and the 'Add filter' button … into 1 button", in the action group.
 * It reads "Filters", with a pencil (TODOs 445, 681); its menu is headed "Filters".
 *
 * Its menu lists the chips the bar HIDES for want of room first — each still a
 * door into its own menu — then every filter, then the saved sets. No badge
 * (TODO 447); it reads ON when a hidden chip is on, as More did.
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
  // The filter actions lead it (TODO 383); these are its filters.
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

test('ONE button: "Filters", a pencil; hidden chips first, then Added, Available, Custom', async ({ page }) => {
  await mount(page, 1400);
  const wide = await look(page);
  await mount(page, 560);
  const narrow = await look(page);

  expect(wide.more).toBe(false);
  expect(wide.label).toBe('Filters');
  expect(wide.icon).toBe('pencil');
  expect(wide.heading).toBe('Filters');
  expect(wide.selectAll).toBe(false);
  // Nothing hidden: no badge, no section of hidden chips.
  expect(wide.badge).toBeNull();
  expect(wide.rows).toEqual(['§Available filters', 'tier']);

  /* HIDDEN chips are ADDED filters — ONE section, not a second one — and each
     row has a caret into its child menu. None here can be taken off, so none
     has a box. Will, 2026-09-25. TRAP T-a-row-opens-its-child-menu
     An ON/OFF chip is one value: no caret, and its box is its on/off. TODO 54 */
  expect(narrow.more).toBe(false);
  expect(narrow.selectAll).toBe(false);
  const hidden = narrow.rows.slice(1, narrow.rows.indexOf('§Available filters'));
  expect(narrow.rows[0]).toBe('§Added filters');
  expect(narrow.rows).not.toContain('§More filters');
  expect(hidden.length).toBeGreaterThan(0);
  // No badge, folded or not. TODO 447
  expect(narrow.badge).toBeNull();
  expect(hidden.at(-1)).toBe('at-risk');
  expect(hidden.slice(0, -1).every((r) => r.startsWith('›'))).toBe(true);
  expect(narrow.rows.slice(narrow.rows.indexOf('§Available filters'))).toEqual(['§Available filters', 'tier']);
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
    menu.show(btn);
    await window.__settled();

    // The hidden ON/OFF chip: no caret, and its tick turns it on. TODO 54
    const row = menu.querySelector<HTMLInputElement>('input[value="at-risk"]')!.closest<HTMLElement>('.menu-row')!;
    const shape = { drill: row.hasAttribute('data-drill'), buttons: row.querySelectorAll('sherpa-button').length };
    const toggle = row.querySelector<HTMLInputElement>('input')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    (menu.shadowRoot.querySelector('.apply') as HTMLElement).shadowRoot!.querySelector('button')!.click();
    await settle();
    const on = btn.getAttribute('data-status');
    menu.show(btn);
    await window.__settled();

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
      on, shape, drilled, ticked, target,
      back: { heading: menu.getAttribute('data-heading'), commit: menu.hasAttribute('data-commit'),
        // The first row of the menu.
        first: menu.children[0]?.classList.contains('menu-section') ?? false },
      // A pick inside a drill is that chip's, never an Add or a Remove.
      held: el.heldFields.join(',') === held.join(','),
      kept: el.readings[target]?.picked ?? null,
    };
  });

  expect(r.on).toBe('active');
  // Not one the reader can take off, so no ×.
  expect(r.shape).toEqual({ drill: false, buttons: 0 });
  expect(r.drilled.drill).toBe(true);
  expect(r.drilled.heading).not.toBe('Filters');
  expect(r.ticked).toEqual(['a']);
  expect(r.held).toBe(true);
  expect(r.kept).toEqual(['a']);
  expect(r.back).toEqual({ heading: 'Filters', commit: true, first: true });
});

/* An ADDED on/off filter is one value: its tick is its on/off. Its row has no
   ×: its chip takes it off. Will, TODOs 54, 380. */
test('an added on/off filter: its tick is its on/off, and its row has no ×', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { style: 'inline-size: 1200px' });
    el.populate([{ id: 'region', label: 'Region', options: [{ value: 'a', label: 'A' }] }]);
    el.available([{ id: 'vip', label: 'VIP' }]);
    await window.__settled();
    const sr = el.shadowRoot!;
    const add = sr.querySelector<HTMLElement>('.add-btn')!;
    const menu = () => add.querySelector('sherpa-menu') as HTMLElement & { show(t: HTMLElement): void; open: boolean };
    // The reader's ticks, then Apply.
    const commit = async (values: string[]) => {
      for (const box of menu().querySelectorAll<HTMLInputElement>('input')) box.checked = values.includes(box.value);
      menu().dispatchEvent(new CustomEvent('menu-change', { bubbles: true, composed: true, detail: { values } }));
      await window.__settled();
    };
    const row = () => menu().querySelector<HTMLInputElement>('input[value="vip"]')?.closest<HTMLElement>('.menu-row') ?? null;
    const chip = () => sr.querySelector<HTMLElement>('.chips > .chip[data-id="vip"]');
    const look = () => ({
      on: !!chip()?.hasAttribute('data-current'), box: !!row()?.querySelector('input')?.checked,
      buttons: row()?.querySelectorAll('sherpa-button').length ?? null,
    });
    await commit(['vip']);
    const added = look();
    await commit(['vip']);
    const ticked = look();
    // Pressed on the bar: the shut menu's row follows it.
    chip()!.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await window.__settled();
    const pressed = look();
    // An Apply that leaves its row alone leaves the chip alone.
    chip()!.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await window.__settled();
    await commit(['vip']);
    const kept = look();
    return { added, ticked, pressed, kept };
  });

  expect(r.added).toEqual({ on: false, box: false, buttons: 0 });
  expect(r.ticked).toEqual({ on: true, box: true, buttons: 0 });
  expect(r.pressed).toEqual({ on: false, box: false, buttons: 0 });
  expect(r.kept).toEqual({ on: true, box: true, buttons: 0 });
});

/* 349: a field the filters before it leave no value for is SPENT — greyed in the
   list, and gone while Hide unmatching is on. A held chip is never greyed.
   TRAP T-the-add-menu-is-the-whole-list */
test('a spent field is greyed in the Filters list, and hidden with Hide unmatching', async ({ page }) => {
  await mount(page, 2000);
  const tier = () => page.evaluate(() => {
    const bar = document.querySelector('sherpa-quick-filter-toolbar')!;
    const row = [...bar.shadowRoot!.querySelectorAll<HTMLElement>('.add-btn sherpa-menu .menu-row')]
      .find((r) => r.querySelector('input')?.value === 'tier');
    return row ? { greyed: row.hasAttribute('data-unavailable'), shown: getComputedStyle(row).display !== 'none' } : null;
  });
  expect(await tier()).toEqual({ greyed: false, shown: true });
  await page.evaluate(async () => {
    const bar = document.querySelector('sherpa-quick-filter-toolbar') as HTMLElement & { drawPresent(p: unknown): void };
    bar.drawPresent({ tier: [], region: ['a'] });
    await window.__settled();
  });
  expect(await tier()).toEqual({ greyed: true, shown: true });
  await page.evaluate(async () => {
    const bar = document.querySelector('sherpa-quick-filter-toolbar') as HTMLElement;
    bar.dataset['limitOptions'] = 'on';
    bar.dataset['hideUnmatched'] = 'on';
    await window.__settled();
  });
  expect((await tier())?.shown).toBe(false);
});

test('Manage Saved Filters is a ⋮ row of a saveable bar with sets of the reader\'s, and asks its host', async ({ page }) => {
  await mount(page, 1400);
  const saved = (own: boolean, saveable: boolean) => page.evaluate(async ({ own, saveable }) => {
    const el = document.querySelector('sherpa-quick-filter-toolbar') as unknown as Bar & { savedSets: unknown };
    el.toggleAttribute('data-saveable', saveable);
    el.savedSets = [{ id: 'page', label: 'Page set' }, ...own ? [{ id: 'mine', label: 'Mine', own: true }] : []];
    await window.__settled();
    const menu = el.shadowRoot!.querySelector('.add-btn sherpa-menu')!;
    const head = [...menu.querySelectorAll(':scope > .menu-section')].find((h) => h.textContent === 'Saved filters');
    const rows: string[] = [];
    for (let n = head?.nextElementSibling; n && !n.classList.contains('menu-section'); n = n.nextElementSibling) {
      rows.push(n.querySelector('input')?.value ?? `${(n as HTMLButtonElement).value}: ${n.textContent?.trim()}`);
    }
    // Manage is the ⋮'s, never the Filters menu's.
    if ((await window.__moreRow(el, 'filters-manage'))) rows.unshift('more: filters-manage');
    return rows;
  }, { own, saveable });
  expect(await saved(true, true)).toEqual(['more: filters-manage', 'set:page', 'set:mine']);
  // None of the reader's to manage, or a bar that saves nothing (it lists none of theirs): no row.
  expect(await saved(false, true)).toEqual(['set:page']);
  expect(await saved(true, false)).toEqual(['set:page']);

  await saved(true, true);
  const asked = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-quick-filter-toolbar')!;
    const heard: string[] = [];
    el.addEventListener('filters-manage', (e) => heard.push(e.type));
    (await window.__moreRow(el, 'filters-manage'))!.click();
    await window.__settled();
    return heard;
  });
  expect(asked).toEqual(['filters-manage']);
});

test('a folded chip\'s row wears its chip\'s icon before its label and its count badge at its end (Will, TODO 677)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const box = document.createElement('div');
    box.style.inlineSize = '420px';
    const el = document.createElement('sherpa-quick-filter-toolbar') as unknown as Bar & { drawResults(r: Record<string, number>): void };
    box.appendChild(el);
    document.getElementById('root')!.replaceChildren(box);
    await el.rendered;
    const opts = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    el.populate([
      { id: 'plan', label: 'Plan', removable: true, options: opts },
      { id: 'tier', label: 'Tier', options: opts },
      { id: 'site', label: 'Site', options: opts },
      { id: 'region', label: 'Region', icon: 'globe', options: opts },
    ]);
    await window.__settled();
    el.drawResults({ region: 12 });
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const sr = el.shadowRoot!;
    const chip = sr.querySelector<HTMLElement>('.chips > .chip[data-id="region"]')!;
    const row = sr.querySelector('.add-btn sherpa-menu')!.querySelector<HTMLElement>('.menu-row[data-value="region"]')!;
    return {
      folded: chip.hasAttribute('data-folded-away'),
      chipCount: chip.getAttribute('data-count'),
      icon: row.querySelector('.menu-row-label > .menu-row-icon')?.querySelector('svg') ? 'drawn' : 'none',
      badge: row.querySelector('.menu-row-count')?.textContent ?? null,
    };
  });
  expect(r).toEqual({ folded: true, chipCount: '12', icon: 'drawn', badge: '12' });
});

test('with ONE field folded and nothing else to list, Edit opens that field\'s own menu — one level, not two (Will, TODO 678)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const box = document.createElement('div');
    box.style.inlineSize = '200px';
    const el = document.createElement('sherpa-quick-filter-toolbar') as unknown as Bar;
    box.appendChild(el);
    document.getElementById('root')!.replaceChildren(box);
    await el.rendered;
    el.populate([{ id: 'status', label: 'Status', options: [{ value: 'a', label: 'Active' }, { value: 'b', label: 'Trial' }] }]);
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const sr = el.shadowRoot!;
    const chip = sr.querySelector<HTMLElement & { menu: HTMLElement & { open: boolean } }>('.chips > .chip[data-id="status"]')!;
    const add = sr.querySelector<HTMLElement>('.add-btn')!;
    add.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await window.__settled();
    return {
      folded: chip.hasAttribute('data-folded-away'),
      own: chip.menu.open,
      filters: (add.querySelector(':scope > sherpa-menu') as HTMLElement & { open: boolean }).open,
      values: [...chip.menu.querySelectorAll('input')].map((i) => (i as HTMLInputElement).value).filter((v) => v && v !== 'on'),
    };
  });
  expect(r).toEqual({ folded: true, own: true, filters: false, values: ['a', 'b'] });
});
