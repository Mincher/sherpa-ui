import { test, expect, type Page } from './harness';

/**
 * A ROW CAN OPEN A CHILD MENU. Will, 2026-09-25: the Filters menu's Added
 * filters "show a child menu caret (and child menu of values of course)" for
 * a filter the view hides — ONE section, not a second one for the hidden.
 *
 * The caret reports `menu-drill`; the host drills. It never ticks the row's
 * box, which is a different answer (added or not). A row with no box names
 * what it cannot pick, and the whole of it opens its child menu.
 * TRAP T-a-row-opens-its-child-menu
 */
async function mount(page: Page) {
  return page.evaluate(async () => {
    const menu = document.createElement('sherpa-menu') as HTMLElement & {
      rendered: Promise<void>; show(t?: HTMLElement): void; values: string[];
      items(i: unknown[]): void; setCount(v: string, n: number): void;
    };
    menu.setAttribute('data-select', 'multiple');
    menu.setAttribute('data-no-select-all', '');
    const anchor = document.createElement('button');
    anchor.textContent = 'Filters';
    document.getElementById('root')!.replaceChildren(anchor, menu);
    await menu.rendered;
    menu.items([
      { value: 'status', label: 'Status', selected: true, drill: true, count: 2 },
      { value: 'plan', label: 'Plan', selected: true },
      { value: 'sort', label: 'Sort by', pickable: false, drill: true },
    ]);
    menu.show(anchor);
    await window.__settled();
    const heard: string[] = [];
    menu.addEventListener('menu-drill', (e) => heard.push((e as CustomEvent).detail.value));
    const row = (v: string) => menu.querySelector<HTMLElement>(`.menu-row[data-value="${v}"]`)
      ?? menu.querySelector<HTMLInputElement>(`input[value="${v}"]`)!.closest<HTMLElement>('.menu-row')!;
    const shown = (n: Element | null) => !!n && getComputedStyle(n).display !== 'none';

    const status = row('status');
    const badge = status.querySelector('.menu-row-count')!;
    const before = {
      box: status.querySelector('input')!.checked,
      badge: badge.textContent, badgeShown: shown(badge),
      caret: status.querySelector('.menu-row-drill')?.tagName ?? null,
      plainCaret: !!row('plan').querySelector('.menu-row-drill'),
      bareBox: !!row('sort').querySelector('input'),
    };

    // THE CARET opens it, and leaves the box alone.
    (status.querySelector('.menu-row-drill') as HTMLElement).shadowRoot!.querySelector('button')!.click();
    // A BARE row opens it from anywhere on it.
    row('sort').querySelector<HTMLElement>('.menu-row-label')!.click();
    await window.__settled();
    menu.setCount('status', 0);
    await window.__settled();

    return {
      before, heard,
      boxAfter: status.querySelector('input')!.checked,
      values: menu.values,
      emptyBadge: { text: badge.textContent, shown: shown(badge) },
      // The SEARCH reads the name, not the name plus its count.
      label: status.dataset['label'],
    };
  });
}

test('a row opens its child menu from its caret, and never ticks its box doing it', async ({ page }) => {
  const r = await mount(page);
  expect(r.before).toEqual({
    box: true, badge: '2', badgeShown: true, caret: 'SHERPA-BUTTON', plainCaret: false, bareBox: false,
  });
  expect(r.heard).toEqual(['status', 'sort']);
  expect(r.boxAfter).toBe(true);
  // A row with no box is no value.
  expect(r.values).toEqual(['status', 'plan']);
  // No picks, no badge.
  expect(r.emptyBadge).toEqual({ text: '', shown: false });
  expect(r.label).toBe('Status');
});
