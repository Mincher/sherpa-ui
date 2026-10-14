import { test, expect } from './harness';

/**
 * ON A PHONE — a phone-size screen with touch, run by the `phone` project only.
 * Will, 2026-10-14: *"I'd like Sherpa to work for mobile browsers."* Each check
 * is one thing a reader does with a thumb. TRAP T-the-nav-is-a-menu-on-a-phone
 */
const settled = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __settled: () => Promise<void> }).__settled());

/** Every box inside the screen's width: nothing to scroll sideways to reach. */
const onScreen = (page: import('@playwright/test').Page, sel: string) => page.evaluate((s) => {
  const el = document.querySelector(s)!;
  const target = (el.shadowRoot?.querySelector('[part~="card"], [part~="menu"], dialog') ?? el) as HTMLElement;
  const b = target.getBoundingClientRect();
  return b.width > 0 && b.left >= -0.5 && b.right <= innerWidth + 0.5;
}, sel);

test('the shell: no rail, the header\'s menu button opens the nav over the screen, a row closes it', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<div style="block-size: 100vh"><sherpa-app-shell>'
      + '<sherpa-nav slot="nav" data-current-id="home"></sherpa-nav>'
      + '<sherpa-app-header slot="header" data-heading="Home"></sherpa-app-header><p>The page.</p></sherpa-app-shell></div>';
    const nav = document.querySelector('sherpa-nav') as HTMLElement & { rendered: Promise<void>; populate(d: unknown): Promise<void> };
    await nav.rendered;
    await nav.populate({ product: { name: 'Sherpa' }, sections: [{ label: 'Main', items: [
      { id: 'home', label: 'Home', icon: 'home', href: '?context=home' },
      { id: 'records', label: 'Records', icon: 'table-columns', href: '?context=records' },
    ] }] });
  });
  await settled(page);
  const nav = page.locator('sherpa-nav[slot="nav"]');
  expect(await nav.evaluate((n) => getComputedStyle(n).visibility)).toBe('hidden');
  await page.locator('sherpa-app-header[slot="header"] .nav-menu').tap();
  await expect.poll(() => nav.evaluate((n) => n.matches(':popover-open'))).toBe(true);
  // A Context row closes it as it goes; the harness keeps the page.
  await page.evaluate(() => addEventListener('click', (e) => e.preventDefault(), { capture: true, once: false }));
  await page.locator('sherpa-nav[slot="nav"] .nav-row[data-id="records"] sherpa-nav-item').tap();
  await expect.poll(() => nav.evaluate((n) => n.matches(':popover-open'))).toBe(false);
});

test('a dialog fits the screen, and a tap on its action answers it and shuts it', async ({ page }) => {
  const answer = page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-dialog id="d" data-heading="Delete the record?">'
      + '<p>It cannot be undone. A longer line, so the words must wrap on a narrow screen and never push it wider.</p>'
      + '<sherpa-container-footer slot="footer"><sherpa-button>Cancel</sherpa-button>'
      + '<sherpa-button data-look="saturated">Delete</sherpa-button></sherpa-container-footer></sherpa-dialog>';
    const d = document.getElementById('d') as HTMLElement & { rendered: Promise<void>; confirm(): Promise<boolean> };
    await d.rendered;
    return d.confirm();
  });
  await expect.poll(() => page.evaluate(() => (document.getElementById('d') as HTMLElement & { open: boolean }).open)).toBe(true);
  expect(await onScreen(page, '#d')).toBe(true);
  await page.locator('#d sherpa-button[data-look="saturated"]').tap();
  expect(await answer).toBe(true);
  expect(await page.evaluate(() => (document.getElementById('d') as HTMLElement & { open: boolean }).open)).toBe(false);
});

test('a button\'s menu opens on a tap and stays on the screen', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<div style="display:flex;justify-content:flex-end;padding:8px">'
      + '<sherpa-button id="b">Sort by<sherpa-menu slot="menu" id="m" data-heading="Sort by">'
      + '<button value="name">Name, a long one so the card is wide</button><button value="plan">Plan</button></sherpa-menu>'
      + '</sherpa-button></div>';
    await (document.getElementById('b') as HTMLElement & { rendered: Promise<void> }).rendered;
  });
  await settled(page);
  await page.locator('#b').tap();
  await expect.poll(() => page.evaluate(() => (document.getElementById('m') as HTMLElement & { open: boolean }).open)).toBe(true);
  expect(await onScreen(page, '#m')).toBe(true);
});

test('the filter bar folds into its ⋮, and the ⋮ opens on a tap', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-quick-filter-toolbar id="q"></sherpa-quick-filter-toolbar>';
    const bar = document.getElementById('q') as HTMLElement & { rendered: Promise<void>; populate(d: unknown): Promise<void> };
    await bar.rendered;
    await bar.populate(['plan', 'region', 'owner', 'status', 'tier', 'health'].map((id) => ({
      id, label: id[0]!.toUpperCase() + id.slice(1), removable: true, options: [{ value: 'a', label: 'A' }],
    })));
  });
  await settled(page);
  const bar = page.locator('#q');
  // At this width the actions have folded — by its container query, before any JS.
  await expect(page.locator('#q .act[data-act="overflow"]')).toBeVisible();
  expect(await bar.evaluate((b) => b.getBoundingClientRect().right <= innerWidth + 0.5)).toBe(true);
  await page.locator('#q .act[data-act="overflow"]').tap();
  await expect.poll(() => bar.evaluate((b) => !!b.shadowRoot!.querySelector('.more-menu')
    && (b.shadowRoot!.querySelector('.more-menu') as HTMLElement & { open?: boolean }).open === true)).toBe(true);
});

test('a wide grid scrolls inside itself; the page never scrolls sideways', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-data-grid id="g"></sherpa-data-grid>';
    const g = document.getElementById('g') as HTMLElement & { rendered: Promise<void>; populate(d: unknown): Promise<void> };
    await g.rendered;
    const columns = ['name', 'plan', 'region', 'owner', 'status', 'tier', 'seats', 'renewal'].map((field) => ({ field, header: field }));
    const rows = Array.from({ length: 6 }, (_, i) => Object.fromEntries([['id', i], ...columns.map((c) => [c.field, `${c.field} value ${i}`])]));
    await g.populate({ key: 'id', columns, rows });
  });
  await settled(page);
  const r = await page.evaluate(() => {
    const scroller = document.getElementById('g')!.shadowRoot!.querySelector<HTMLElement>('.scroller')!;
    return { page: document.scrollingElement!.scrollWidth <= innerWidth + 1, grid: scroller.scrollWidth > scroller.clientWidth };
  });
  expect(r).toEqual({ page: true, grid: true });
});
