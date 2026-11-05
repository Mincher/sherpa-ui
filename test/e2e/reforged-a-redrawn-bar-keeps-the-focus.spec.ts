import { test, expect, type Page } from './fixture';
import { gotoHarness } from './harness';

/**
 * A BAR DRAWN AGAIN KEEPS THE FOCUS on the same chip's same button (TODO 801). A View
 * picked by the keys left the focus on <body> in every engine: its bar drew its chips
 * again for the new View, and the caret the menu gave the focus back to had gone.
 * TRAP T-a-redrawn-bar-keeps-the-focus
 */

type Bar = HTMLElement & { populate(d: unknown[]): Promise<void> };

/** The element focused, through each shadow root: its chip's id and its part. */
const focused = (page: Page) => page.evaluate(() => {
  let el: Element | null = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  const host = (el?.getRootNode() as ShadowRoot | undefined)?.host as HTMLElement | undefined;
  return host?.dataset['id'] ? `${host.dataset['id']} ${el?.getAttribute('part')}` : (el?.id ? `#${el.id}` : el?.localName ?? '');
});

const VIEW = 'sherpa-app-header sherpa-quick-filter-toolbar[data-type="view"]';

test('a View picked by the keys leaves the focus on the View chip\'s caret, though its bar draws it anew', async ({ page }) => {
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
  // The chip the keys open, to know it was drawn anew.
  await view.evaluate((c) => {
    (window as unknown as { was: Element }).was = c;
    (c.shadowRoot!.querySelector('.caret') as HTMLElement).focus();
  });

  await page.keyboard.press('Enter');
  await expect(view.locator('sherpa-menu')).toHaveAttribute('open', '');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('view'))).toBe('notes');
  await expect.poll(() => page.evaluate(() => !(window as unknown as { was: Element }).was.isConnected)).toBe(true);
  await expect.poll(() => focused(page)).toBe('view caret');

  // And the keys go on from there: the next pick, Custom Nodes, the same.
  await page.keyboard.press('ArrowDown');
  await expect(view.locator('sherpa-menu')).toHaveAttribute('open', '');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('view'))).toBe('nodes');
  await expect.poll(() => focused(page)).toBe('view caret');
});

/** A bar of two chips with menus, between two buttons. */
async function bar(page: Page): Promise<void> {
  await gotoHarness(page);
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const el = document.createElement('sherpa-quick-filter-toolbar') as Bar;
    el.id = 'bar';
    root.append(Object.assign(document.createElement('button'), { id: 'before', textContent: 'Before' }), el,
      Object.assign(document.createElement('button'), { id: 'after', textContent: 'After' }));
    await (el as Bar & { rendered: Promise<void> }).rendered;
    await el.populate([
      { id: 'region', label: 'Region', options: [{ value: 'north', label: 'North' }, { value: 'south', label: 'South' }] },
      { id: 'tier', label: 'Tier', options: [{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }] },
    ]);
    await (window as unknown as { __settled(): Promise<void> }).__settled();
  });
}

/** The bar's chips drawn again, Tier's def as given. */
const redraw = (page: Page, tier: string, then?: string) => page.evaluate(async ([label, move]) => {
  const el = document.getElementById('bar') as Bar;
  await el.populate([
    { id: 'region', label: 'Region', options: [{ value: 'north', label: 'North' }, { value: 'south', label: 'South' }] },
    { id: 'tier', label, options: [{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }] },
  ]);
  // The reader moves on before the new chip has drawn.
  if (move) document.getElementById(move)!.focus();
  await (window as unknown as { __settled(): Promise<void> }).__settled();
}, [tier, then] as const);

const press = (page: Page, id: string, part: string) => page.locator('#bar').evaluate((b, [chip, p]) =>
  (b.shadowRoot!.querySelector(`.chip[data-id="${chip}"]`)!.shadowRoot!.querySelector(`[part="${p}"]`) as HTMLElement).focus(), [id, part] as const);

test('a bar drawn again keeps the focus on the same chip\'s own button: moved, or built anew', async ({ page }) => {
  await bar(page);
  // Moved: the same def, the same chip.
  await press(page, 'tier', 'body');
  await redraw(page, 'Tier');
  expect(await focused(page)).toBe('tier body');
  // Built anew: a changed def. Its caret, once it has drawn.
  await press(page, 'tier', 'caret');
  await redraw(page, 'Tier level');
  expect(await page.locator('#bar').evaluate((b) => b.shadowRoot!.querySelector('.chip[data-id="tier"]')!.getAttribute('data-label'))).toBe('Tier level');
  expect(await focused(page)).toBe('tier caret');
});

test('a reader who moved on while the chip was drawn keeps where they went', async ({ page }) => {
  await bar(page);
  await press(page, 'tier', 'caret');
  await redraw(page, 'Tier level', 'after');
  expect(await focused(page)).toBe('#after');
  // And a bar without the focus takes none.
  await redraw(page, 'Tier');
  expect(await focused(page)).toBe('#after');
});
