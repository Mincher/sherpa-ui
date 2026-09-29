import { test, expect, type Page } from './harness';

/**
 * A ROW CAN OPEN A CHILD MENU. Will, 2026-09-25: the Filters menu's Added
 * filters "show a child menu caret (and child menu of values of course)" for
 * a filter the view hides — ONE section, not a second one for the hidden.
 *
 * The row reports `menu-drill`; the host drills. It never ticks the row's
 * box, which is a different answer (added or not). A row with no box names
 * what it cannot pick.
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

/**
 * THE WHOLE ROW IS THE DOOR — TODO 48. A click anywhere but its box, a pointer
 * that RESTS on it, or ArrowRight opens its child menu; its box still ticks,
 * and a pointer passing over opens nothing.
 * TRAP T-a-row-opens-its-child-menu
 */
test('a child menu opens from the whole row, a resting pointer or ArrowRight — never a passing one', async ({ page }) => {
  const box = await page.evaluate(async () => {
    const menu = document.createElement('sherpa-menu') as HTMLElement & {
      rendered: Promise<void>; show(t?: HTMLElement): void; items(i: unknown[]): void;
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
      { value: 'tier', label: 'Tier', selected: true, drill: true },
    ]);
    menu.show(anchor);
    await window.__settled();
    const heard: string[] = [];
    (window as unknown as { __heard: string[] }).__heard = heard;
    menu.addEventListener('menu-drill', (e) => heard.push((e as CustomEvent).detail.value));
    const rect = (v: string) => menu.querySelector<HTMLInputElement>(`input[value="${v}"]`)!
      .closest<HTMLElement>('.menu-row')!.getBoundingClientRect();
    const r = (v: string) => { const b = rect(v); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    return { status: r('status'), plan: r('plan'), tier: r('tier') };
  });
  const heard = () => page.evaluate(() => [...(window as unknown as { __heard: string[] }).__heard]);
  const ticked = () => page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement>('sherpa-menu input')].filter((i) => i.checked).map((i) => i.value));

  // A pointer PASSING over Status, on to Plan (no child), opens nothing.
  await page.mouse.move(box.status.x, box.status.y);
  await page.waitForTimeout(150);
  await page.mouse.move(box.plan.x, box.plan.y);
  await page.waitForTimeout(700);
  const passed = await heard();
  // One RESTING on Tier opens it.
  await page.mouse.move(box.tier.x, box.tier.y);
  await page.waitForTimeout(800);
  const rested = await heard();
  // A click on Status's LABEL opens it, and leaves its box ticked.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('sherpa-menu .menu-row[data-value="status"] .menu-row-label')!.click();
  });
  const clicked = { heard: await heard(), ticked: await ticked() };
  // Its BOX ticks, and opens nothing.
  await page.evaluate(() => {
    document.querySelector<HTMLInputElement>('sherpa-menu input[value="status"]')!.click();
  });
  const boxed = { heard: await heard(), ticked: await ticked() };
  // ArrowRight on a row's box opens it.
  await page.evaluate(() => {
    document.querySelector<HTMLInputElement>('sherpa-menu input[value="tier"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  });
  const keyed = await heard();

  expect(passed).toEqual([]);
  expect(rested).toEqual(['tier']);
  expect(clicked).toEqual({ heard: ['tier', 'status'], ticked: ['status', 'plan', 'tier'] });
  expect(boxed).toEqual({ heard: ['tier', 'status'], ticked: ['plan', 'tier'] });
  expect(keyed).toEqual(['tier', 'status', 'tier']);
});
