import { test, expect, type Page } from './fixture';
import { gotoHarness } from './harness';

/**
 * A MENU IS REACHED BY THE KEYS FROM ITS TRIGGER, in every engine (TODO 795). Only Chromium moves
 * Tab from a popover's invoker into it; Firefox and WebKit skipped the card. Enter, Space or
 * ArrowDown on the trigger opens it on its first row, ArrowUp on its last; the arrows move between
 * the rows; Tab from the trigger goes in and Shift+Tab comes back; Escape shuts it and the focus is
 * back on the trigger; Tab past the last row shuts it. Real keys only.
 * TRAP T-a-menu-is-reached-by-keys-from-its-trigger
 */

/** WebKit's Tab skips a button unless Alt is held. */
const tab = (shift = false): string => `${test.info().project.name === 'webkit' ? 'Alt+' : ''}${shift ? 'Shift+' : ''}Tab`;

/** The element focused, through each shadow root: its class, value or id, and its host's. */
const focused = (page: Page) => page.evaluate(() => {
  let el: Element | null = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  const host = (el?.getRootNode() as ShadowRoot | undefined)?.host;
  const name = (e: Element | null | undefined): string => (!e ? '' : e.id ? `#${e.id}` : (e as HTMLInputElement).value || e.className.split(' ')[0] || e.tagName.toLowerCase());
  return host ? `${name(host)} ${name(el)}` : name(el);
});

/** A chip with a menu of three values, between two buttons. */
async function chip(page: Page, type?: string): Promise<void> {
  await gotoHarness(page);
  await page.evaluate(async (kind) => {
    const before = Object.assign(document.createElement('button'), { id: 'before', textContent: 'Before' });
    const after = Object.assign(document.createElement('button'), { id: 'after', textContent: 'After' });
    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): Promise<void> };
    el.id = 'chip';
    el.dataset['label'] = 'Region';
    if (kind) el.dataset['type'] = kind;
    el.toggleAttribute('data-menu', true);
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void>; items(i: unknown[]): void };
    menu.slot = 'menu';
    menu.dataset['select'] = 'multiple';
    el.append(menu);
    document.getElementById('root')!.append(before, el, after);
    await el.rendered;
    await menu.rendered;
    const places = [{ value: 'north', label: 'North' }, { value: 'south', label: 'South' }, { value: 'east', label: 'East' }];
    if (kind === 'jump') {
      for (const { value } of places) document.getElementById('root')!.append(Object.assign(document.createElement('div'), { id: value, textContent: value }));
      await el.populate(places);
    } else menu.items(places);
  }, type);
}

const menu = (page: Page) => page.locator('#chip sherpa-menu');
/** Shut, as its trigger reads it: the next press opens it again. */
const shut = (page: Page) => expect(page.locator('#chip')).not.toHaveAttribute('data-open');

test('the bug: Enter on the caret, then Tab, and the focus is on a row, in every engine', async ({ page }) => {
  await chip(page);
  await page.locator('#chip').evaluate((c) => (c.shadowRoot!.querySelector('.caret') as HTMLElement).focus());
  await page.keyboard.press('Enter');
  await expect(menu(page)).toHaveAttribute('open', '');
  await page.keyboard.press(tab());
  // Firefox and WebKit went past the card, to the next button.
  expect(['on', 'north', 'south', 'east']).toContain(await focused(page));
  await expect(menu(page)).toHaveAttribute('open', '');
});

test('a chip\'s menu: Enter on its caret opens it on its first row, the arrows move, Space ticks, Escape is back on the caret', async ({ page }) => {
  await chip(page);
  await page.locator('#before').focus();
  await page.keyboard.press(tab());
  await page.keyboard.press(tab());
  expect(await focused(page)).toBe('#chip caret');

  await page.keyboard.press('Enter');
  await expect(menu(page)).toHaveAttribute('open', '');
  expect(await focused(page)).toBe('on');
  const walk: string[] = [];
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'End', 'Home', 'ArrowUp', 'ArrowDown']) {
    await page.keyboard.press(key);
    walk.push(await focused(page));
  }
  // Each row once, wrapping at both ends; a key ticks nothing.
  expect(walk).toEqual(['north', 'south', 'north', 'east', 'on', 'east', 'on']);
  expect(await menu(page).evaluate((m) => (m as HTMLElement & { values: string[] }).values)).toEqual([]);

  await page.keyboard.press('End');
  await page.keyboard.press('Space');
  expect(await menu(page).evaluate((m) => (m as HTMLElement & { values: string[] }).values)).toEqual(['east']);
  await page.keyboard.press('Escape');
  await expect(menu(page)).not.toHaveAttribute('open', '');
  expect(await focused(page)).toBe('#chip caret');
  await shut(page);

  // Space opens it too.
  await page.keyboard.press('Space');
  await expect(menu(page)).toHaveAttribute('open', '');
  expect(await focused(page)).toBe('on');
});

test('ArrowDown on the shut caret opens on the first row, ArrowUp on the last; the body\'s arrows open nothing', async ({ page }) => {
  await chip(page);
  await page.locator('#chip').evaluate((c) => (c.shadowRoot!.querySelector('.caret') as HTMLElement).focus());
  await page.keyboard.press('ArrowDown');
  await expect(menu(page)).toHaveAttribute('open', '');
  expect(await focused(page)).toBe('on');
  await page.keyboard.press('Escape');
  expect(await focused(page)).toBe('#chip caret');
  await shut(page);

  await page.keyboard.press('ArrowUp');
  await expect(menu(page)).toHaveAttribute('open', '');
  expect(await focused(page)).toBe('east');
  await page.keyboard.press('Escape');
  await shut(page);

  // The body toggles the filter: its arrows are not the caret's.
  await page.keyboard.press(tab(true));
  expect(await focused(page)).toBe('#chip body');
  await page.keyboard.press('ArrowDown');
  await expect(menu(page)).not.toHaveAttribute('open', '');
  expect(await focused(page)).toBe('#chip body');
});

test('Tab from the caret goes into the card and Shift+Tab comes back; Tab past the last row shuts it', async ({ page }) => {
  await chip(page);
  await page.locator('#chip').evaluate((c) => (c.shadowRoot!.querySelector('.caret') as HTMLElement).focus());
  await page.keyboard.press('Enter');
  await expect(menu(page)).toHaveAttribute('open', '');
  await page.keyboard.press(tab(true));
  expect(await focused(page)).toBe('#chip caret');
  await expect(menu(page)).toHaveAttribute('open', '');

  const walk: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press(tab());
    walk.push(await focused(page));
  }
  expect(walk).toEqual(['on', 'north', 'south', 'east']);
  await page.keyboard.press(tab());
  expect(await focused(page)).toBe('#after');
  await expect(menu(page)).not.toHaveAttribute('open', '');
});

test('a pointer\'s press opens the menu and leaves the focus out of it', async ({ page }) => {
  await chip(page);
  await page.locator('#chip .caret').click();
  await expect(menu(page)).toHaveAttribute('open', '');
  // Chromium and Firefox focus the pressed caret; WebKit focuses no button on a press.
  expect(['#chip caret', 'body']).toContain(await focused(page));
});

test('Jump to: Enter on its body opens it on its first place; ArrowDown, Enter jumps, and the focus is back on the chip', async ({ page }) => {
  await chip(page, 'jump');
  const jumped: unknown[] = [];
  await page.exposeFunction('jumped', (detail: unknown) => jumped.push(detail));
  await page.locator('#chip').evaluate((c) => {
    c.addEventListener('jump-select', (e) => (window as unknown as { jumped(d: unknown): void }).jumped((e as CustomEvent).detail));
    (c.shadowRoot!.querySelector('.body') as HTMLElement).focus();
  });
  await page.keyboard.press('Enter');
  await expect(menu(page)).toHaveAttribute('open', '');
  expect(await focused(page)).toBe('north');
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('south');
  await page.keyboard.press('Enter');
  await expect(menu(page)).not.toHaveAttribute('open', '');
  await expect.poll(() => jumped).toEqual([{ value: 'south', label: 'South' }]);
  expect(await focused(page)).toBe('#chip body');
  await shut(page);

  // Its caret opens by the arrows, and Escape comes back to it.
  await page.keyboard.press(tab());
  await page.keyboard.press('ArrowUp');
  await expect(menu(page)).toHaveAttribute('open', '');
  expect(await focused(page)).toBe('east');
  await page.keyboard.press('Escape');
  await expect(menu(page)).not.toHaveAttribute('open', '');
  expect(await focused(page)).toBe('#chip caret');
});

const VIEW = 'sherpa-app-header sherpa-quick-filter-toolbar[data-type="view"]';

test('the View chip: ArrowDown on its caret opens it on its first View, Escape is back on the caret, and Space picks a View', async ({ page }) => {
  await page.goto('/test/reforged/graph-views.html?view=filters');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(`(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet');
    const base = new URL('/test/reforged/graph-views/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
  })()`);
  await page.waitForFunction(() => !!(window as unknown as { __graphs?: unknown }).__graphs);
  const view = page.locator(`${VIEW} .chip[data-id="view"]`);
  await expect(view.locator('sherpa-menu .menu-row').first()).toBeAttached();
  const rows = view.locator('sherpa-menu .menu-row:visible');
  const menu = view.locator('sherpa-menu');
  const caret = async (): Promise<boolean> => view.evaluate((c) => c.shadowRoot!.activeElement?.classList.contains('caret') ?? false);
  /** The words of the row that has the focus. */
  const row = () => page.evaluate(() => {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return el?.closest('.menu-row')?.textContent?.trim() ?? '';
  });

  await view.evaluate((c) => (c.shadowRoot!.querySelector('.caret') as HTMLElement).focus());
  await page.keyboard.press('ArrowDown');
  await expect(menu).toHaveAttribute('open', '');
  expect((await rows.allTextContents()).map((t) => t.trim())).toEqual(['Preset Filters', 'Custom Nodes', 'Notes']);
  expect(await row()).toBe('Preset Filters');
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  expect(await caret()).toBe(true);
  await expect(view).not.toHaveAttribute('data-open');

  // A View by the keys: up to Notes, the last — the arrows wrap — and Space.
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('open', '');
  await page.keyboard.press('ArrowUp');
  expect(await row()).toBe('Notes');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('view'))).toBe('notes');
  // The pick shuts it. The bar draws its chips again for the new View.
  await expect(page.locator(`${VIEW} .chip[data-id="view"] sherpa-menu`)).not.toHaveAttribute('open', '');
});
