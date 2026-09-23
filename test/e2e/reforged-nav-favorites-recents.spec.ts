import { test, expect } from '@playwright/test';

/**
 * FAVORITES AND RECENTS ARE PARENT ROWS, AND THEY SURVIVE A RELOAD.
 *
 * Neither is a view. Each is a nav parent whose children are stamped from a
 * stored list — Favorites from the ★, Recents from the last five views opened.
 *
 * NOTHING HERE VISITS `settings`. That view puts the rail into SETTINGS mode,
 * which swaps `sections` for `settingsSections` and drops `quickItems`
 * altogether — so Recent and Favorites are not stamped at all while it is open.
 * That is the nav's own behaviour and not this feature's, but it makes settings
 * useless as a second view to navigate to.
 *
 * The five-entry CAP is not reachable here either: the example has four views.
 * `test/unit/session-list.test.mjs` proves the cap against the list directly.
 *
 * TRAP T-session-list-is-a-view-not-a-copy — the list, and its cap
 */
const APP = 'http://localhost:4200/';

type Page = import('@playwright/test').Page;

/** Every stamped row's id, in rail order. */
const rowIds = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...(document.querySelector('sherpa-nav')?.shadowRoot
      ?.querySelectorAll('.nav-row') ?? [])].map((r) => (r as HTMLElement).dataset['id'] ?? ''));

/** The labels of one parent's child rows, in order. */
const childLabels = (page: Page, parent: string): Promise<string[]> =>
  page.evaluate((p) =>
    [...(document.querySelector('sherpa-nav')?.shadowRoot
      ?.querySelectorAll(`.nav-row[data-parent="${p}"] sherpa-nav-item`) ?? [])]
      .map((i) => (i as HTMLElement).dataset['label'] ?? ''), parent);

/**
 * Open a view the way the router does, and wait for it to LAND.
 *
 * Recents is written last, after the view module's `init` resolves, so waiting
 * for this view at the front of the stored list is what proves the load
 * finished. Waiting on the URL alone races the rest of `loadView`.
 */
async function goto(page: Page, view: string): Promise<void> {
  await page.evaluate((v) => {
    history.pushState({ view: v }, '', `?view=${v}`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, view);
  await page.waitForFunction((v) => {
    const raw = localStorage.getItem('sherpa:session:/nav/recent');
    if (raw == null) return false;
    try {
      return JSON.parse(raw)[0]?.view === v;
    } catch {
      return false;
    }
  }, view, { timeout: 15000 });
}

/** Click the ★. `button-click` is what the bar listens for — a raw DOM click on
 *  the <sherpa-button> HOST reaches nothing, the real control being a shadow
 *  root deeper again. */
async function clickStar(page: Page): Promise<void> {
  await page.evaluate(() => {
    const bar = document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]');
    bar?.shadowRoot?.querySelector('.act[data-act="favourite"]')
      ?.dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
  });
}

const stored = (page: Page, key: string): Promise<unknown> =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

/* Booting on the dashboard ADDS Home to Recents, so every expectation below
   starts from that one entry rather than from nothing. */
test.beforeEach(async ({ page }) => {
  await page.goto(APP);
  await page.evaluate(() => {
    localStorage.removeItem('sherpa:session:/nav/favorites');
    localStorage.removeItem('sherpa:session:/nav/recent');
  });
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('sherpa-nav')?.shadowRoot);
  await page.waitForFunction(() =>
    localStorage.getItem('sherpa:session:/nav/recent') != null, undefined, { timeout: 15000 });
});

test('Recent gathers the views visited, newest FIRST', async ({ page }) => {
  await goto(page, 'records');
  await goto(page, 'chat');

  await expect.poll(() => childLabels(page, 'recent'))
    .toEqual(['Assistant', 'Records', 'Home']);
});

test('Recent keeps at most FIVE, and a re-visit moves up rather than repeats', async ({ page }) => {
  // Four distinct views plus two re-visits: the cap is never the thing under
  // test here, the de-dupe is. VIEWS holds only four, so five is unreachable.
  for (const v of ['records', 'chat', 'dashboard', 'records', 'chat']) {
    await goto(page, v);
  }
  const labels = await childLabels(page, 'recent');
  expect(labels.length).toBeLessThanOrEqual(5);
  // Every entry is distinct — a re-visit moved, it did not double.
  expect(new Set(labels).size).toBe(labels.length);
  expect(labels[0]).toBe('Assistant');
});

test('the ★ adds a Favorites CHILD, and clicking it again removes it', async ({ page }) => {
  await goto(page, 'records');
  expect(await childLabels(page, 'favorites')).toEqual([]);

  await clickStar(page);
  await expect.poll(() => childLabels(page, 'favorites')).toEqual(['Records']);

  // The child's id is its own, so it cannot collide with the real Records row.
  const ids = await rowIds(page);
  expect(ids).toContain('favorites:records');
  expect(ids).toContain('view-records');

  await clickStar(page);
  await expect.poll(() => childLabels(page, 'favorites')).toEqual([]);
});

test('the ★ is LOCKED — the app answers, the bar does not self-set', async ({ page }) => {
  await goto(page, 'records');
  await clickStar(page);

  // The attribute is on because the APP wrote it back, having stored the row.
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')
      ?.hasAttribute('data-favourite'))).toBe(true);

  // And the glyph followed the attribute, not a local flip.
  const icon = await page.evaluate(() =>
    document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')?.shadowRoot
      ?.querySelector('.act[data-act="favourite"]')?.getAttribute('data-icon-start'));
  expect(icon).toBe('star-filled');
});

test('the ★ swaps to a FILLED drawing, not just a different name', async ({ page }) => {
  /* The DRAWING, not the attribute. `fa-solid fa-star` and `fa-regular fa-star`
     both resolved to the same outline star, because the resolver strips the
     weight token — so the name changed, the path did not, and the star never
     filled. TRAP T-favourite-star-swaps-its-glyph */
  const path = () => page.evaluate(() =>
    document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')?.shadowRoot
      ?.querySelector('.act[data-act="favourite"]')?.shadowRoot
      ?.querySelector('svg path')?.getAttribute('d') ?? null);

  await goto(page, 'records');
  const outline = await path();
  expect(outline).toBeTruthy();

  await clickStar(page);
  await expect.poll(path).not.toBe(outline);

  await clickStar(page);
  await expect.poll(path).toBe(outline);
});

test('the ★ reflects the view you are ON, not the last one you starred', async ({ page }) => {
  await goto(page, 'records');
  await clickStar(page);
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')
      ?.hasAttribute('data-favourite'))).toBe(true);

  await goto(page, 'chat');
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')
      ?.hasAttribute('data-favourite'))).toBe(false);

  await goto(page, 'records');
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')
      ?.hasAttribute('data-favourite'))).toBe(true);
});

test('a favourite survives a FULL reload — the whole point', async ({ page }) => {
  await goto(page, 'records');
  await clickStar(page);
  await expect.poll(() => childLabels(page, 'favorites')).toEqual(['Records']);

  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('sherpa-nav')?.shadowRoot);

  await expect.poll(() => childLabels(page, 'favorites')).toEqual(['Records']);
});

test('Recents survive a FULL reload too', async ({ page }) => {
  await goto(page, 'records');
  await goto(page, 'chat');

  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('sherpa-nav')?.shadowRoot);

  /* The reload keeps `?view=chat`, so it re-opens the view it was left on.
     That MOVES chat to the front, which it already was — the order is the one
     from before the reload, unchanged. */
  await expect.poll(() => childLabels(page, 'recent'))
    .toEqual(['Assistant', 'Records', 'Home']);
});

test('a stored list this release cannot read is DROPPED, not stamped', async ({ page }) => {
  // What an older release wrote: bare strings, no {view,label}.
  await page.evaluate(() => localStorage.setItem(
    'sherpa:session:/nav/favorites', JSON.stringify(['records', 'chat'])));
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('sherpa-nav')?.shadowRoot);

  expect(await childLabels(page, 'favorites')).toEqual([]);
  /* The KEY is gone, not emptied: readJson forgets what it could not use, so
     the next write starts clean rather than merging onto a bad shape. */
  expect(await stored(page, 'sherpa:session:/nav/favorites')).toBe(null);
});

test('a Favorites child OPENS its view, and the real row stays the active one',
  async ({ page }) => {
    await goto(page, 'records');
    await clickStar(page);
    await expect.poll(() => childLabels(page, 'favorites')).toEqual(['Records']);

    await goto(page, 'chat');

    // Click the Favorites child for Records.
    await page.evaluate(() => {
      const row = document.querySelector('sherpa-nav')?.shadowRoot
        ?.querySelector('.nav-row[data-id="favorites:records"] sherpa-nav-item');
      (row?.shadowRoot?.querySelector('a, button') as HTMLElement)?.click();
    });

    await page.waitForFunction(() =>
      new URL(location.href).searchParams.get('view') === 'records', undefined, { timeout: 15000 });

    // The REAL Records row is current, not the favourite copy.
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('sherpa-nav')?.getAttribute('data-current-id')))
      .toBe('view-records');
  });

test('an open Favorites parent stays open when a row is added', async ({ page }) => {
  await goto(page, 'records');
  await clickStar(page);
  await expect.poll(() => childLabels(page, 'favorites')).toEqual(['Records']);

  /* Open the parent through the rail's OWN event. Reaching for an expander
     element by guessed class is what makes this kind of test skip itself and
     prove nothing; `item-expand` is the contract the nav actually listens on. */
  const setOpen = (open: boolean) => page.evaluate((o) => {
    document.querySelector('sherpa-nav')?.shadowRoot
      ?.querySelector('.nav-row[data-id="favorites"] sherpa-nav-item')
      ?.dispatchEvent(new CustomEvent('item-expand',
        { bubbles: true, composed: true, detail: { expanded: o } }));
  }, open);

  const openNow = () => page.evaluate(() =>
    document.querySelector('sherpa-nav')?.shadowRoot
      ?.querySelector('.nav-row[data-id="favorites"]')?.getAttribute('data-expanded'));

  await setOpen(true);
  expect(await openNow()).toBe('true');

  // Adding a second favourite RE-STAMPS every row, which is where an open
  // branch is lost if the state is not read back first.
  await goto(page, 'chat');
  await clickStar(page);
  await expect.poll(() => childLabels(page, 'favorites'))
    .toEqual(['Records', 'Assistant']);

  expect(await openNow()).toBe('true');
});

/* ── A parent is not a destination ─────────────────────────────────── */

test('an expandable parent TOGGLES on a body click and opens nothing', async ({ page }) => {
  await goto(page, 'records');
  await clickStar(page);
  await expect.poll(() => childLabels(page, 'favorites')).toEqual(['Records']);

  const before = await page.evaluate(() => location.search);

  // The row BODY, not the chevron.
  await page.evaluate(() => {
    const item = document.querySelector('sherpa-nav')?.shadowRoot
      ?.querySelector('.nav-row[data-id="favorites"] sherpa-nav-item');
    (item?.shadowRoot?.querySelector('.label') as HTMLElement)?.click();
  });

  await expect.poll(() => page.evaluate(() =>
    document.querySelector('sherpa-nav')?.shadowRoot
      ?.querySelector('.nav-row[data-id="favorites"] sherpa-nav-item')
      ?.hasAttribute('data-expanded'))).toBe(true);

  expect(await page.evaluate(() => location.search)).toBe(before);
});

test('an expandable parent carries NO href, so it cannot be opened in a tab',
  async ({ page }) => {
    await goto(page, 'records');
    await clickStar(page);
    await expect.poll(() => childLabels(page, 'favorites')).toEqual(['Records']);

    const hrefs = await page.evaluate(() => {
      const nav = document.querySelector('sherpa-nav')?.shadowRoot;
      const read = (id: string) => nav?.querySelector(`.nav-row[data-id="${id}"] sherpa-nav-item`)
        ?.shadowRoot?.querySelector('.nav-link')?.getAttribute('href') ?? null;
      return { parent: read('favorites'), child: read('favorites:records'), home: read('home') };
    });

    expect(hrefs.parent).toBe(null);
    // A CHILD is the destination, and a plain row is unaffected.
    expect(hrefs.child).toBe('?view=records');
    expect(hrefs.home).toBe('?view=dashboard');
  });

test('a parent that LOSES its last child becomes a plain row again', async ({ page }) => {
  await goto(page, 'records');
  await clickStar(page);
  await expect.poll(() => childLabels(page, 'favorites')).toEqual(['Records']);

  await clickStar(page);
  await expect.poll(() => childLabels(page, 'favorites')).toEqual([]);

  const expandable = await page.evaluate(() =>
    document.querySelector('sherpa-nav')?.shadowRoot
      ?.querySelector('.nav-row[data-id="favorites"] sherpa-nav-item')
      ?.hasAttribute('data-expandable'));
  expect(expandable).toBe(false);
});
