import { test, expect, type Page } from '@playwright/test';

/**
 * A DRAFT PER VIEW — TODO 144. Will: "Filter configurations should survive
 * view swaps during a session, even if not saved as a definition… It would be
 * cool, actually, if they could persist across sessions, too… These should be
 * configurable options for filtering (on by default)."
 *
 * Runs against the EXAMPLES server (:4200): the settings are the app's.
 * TRAP T-a-view-keeps-a-draft
 */
const RECORDS = 'http://localhost:4200/?context=records';

type Source = {
  select(field: string, picked: string[]): void;
  reading(scope: string, field: string): { picked?: unknown[] } | undefined;
};

const open = async (page: Page, url = RECORDS): Promise<void> => {
  await page.goto(url);
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await page.waitForFunction(() => !!(window as unknown as { sherpa?: { source?: unknown } }).sherpa?.source);
};
/** Pick a View as the View chip does. */
const pick = async (page: Page, id: string): Promise<void> => {
  await page.evaluate((v) => {
    const bar = document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar[slot="filters"]') as
      HTMLElement & { setChipValues(id: string, v: string[]): void; report(): void };
    bar.setChipValues('view', [v]);
    bar.report();
  }, id);
  await expect.poll(() => page.evaluate(() => (document.querySelector('sherpa-provider') as HTMLElement & { view?: string }).view)).toBe(id);
  // The pick's own writes are the provider's; the reader is heard two frames on.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
};
const region = (page: Page) => page.evaluate(() =>
  (window as unknown as { sherpa: { source: Source } }).sherpa.source.reading('view', 'region')?.picked ?? []);
/** A reader's own change on the View on screen. */
const setRegion = async (page: Page, picked: string[]): Promise<void> => {
  await page.evaluate((p) => (window as unknown as { sherpa: { source: Source } }).sherpa.source.select('region', p), picked);
  await expect.poll(() => region(page)).toEqual(picked);
};

test('a View keeps the filters a reader left on it, through a swap and back', async ({ page }) => {
  await open(page);
  await pick(page, 'risk');
  expect(await region(page)).toEqual([]);
  await setRegion(page, ['EMEA']);
  // Away: All customers is ITS own — nothing of At risk's comes along.
  await pick(page, 'all');
  expect(await region(page)).toEqual([]);
  // Back: the draft.
  await pick(page, 'risk');
  await expect.poll(() => region(page)).toEqual(['EMEA']);
  // A View never touched keeps no draft of its own.
  await pick(page, 'renewals');
  expect(await region(page)).toEqual([]);

  // Reset all to default: At risk's OWN filters, and its draft is gone.
  await pick(page, 'risk');
  await expect.poll(() => region(page)).toEqual(['EMEA']);
  await page.evaluate(() => (document.querySelector('sherpa-provider') as HTMLElement & { resetView(): Promise<void> }).resetView());
  await expect.poll(() => region(page)).toEqual([]);
  await pick(page, 'all');
  await pick(page, 'risk');
  expect(await region(page)).toEqual([]);
});

test('across sessions: a new tab finds the draft; "for this tab only" does not', async ({ context }) => {
  const first = await context.newPage();
  await open(first);
  await pick(first, 'risk');
  await setRegion(first, ['APAC']);
  await pick(first, 'all');

  // A NEW tab: a new sessionStorage, the same localStorage.
  const again = await context.newPage();
  await open(again, `${RECORDS}&view=risk`);
  await expect.poll(() => region(again)).toEqual(['APAC']);

  // "Keep them across sessions" off: the shared copy goes at the next write.
  await again.evaluate(() => localStorage.setItem('sherpa:session:/filters/draftsAcross', 'false'));
  const third = await context.newPage();
  await open(third);
  await pick(third, 'risk');
  await setRegion(third, ['LATAM']);
  await pick(third, 'all');
  const fourth = await context.newPage();
  await open(fourth, `${RECORDS}&view=risk`);
  expect(await region(fourth)).toEqual([]);
});

test('drafts off: a View opens on its own filters, as it did before', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sherpa:session:/filters/drafts', 'false'));
  await open(page);
  await pick(page, 'risk');
  await setRegion(page, ['EMEA']);
  await pick(page, 'all');
  await pick(page, 'risk');
  expect(await region(page)).toEqual([]);
});

test('Settings › Application has both switches, on by default; the second waits on the first', async ({ page }) => {
  await page.goto(`${RECORDS}&settings=application`);
  await expect(page.locator('#filters-drafts')).toBeAttached();
  const look = () => page.evaluate(() => {
    const a = document.getElementById('filters-drafts') as HTMLElement & { checked: boolean };
    const b = document.getElementById('filters-drafts-across') as HTMLElement & { checked: boolean };
    return { drafts: a.checked, across: b.checked, waits: b.hasAttribute('disabled') };
  });
  await expect.poll(look).toEqual({ drafts: true, across: true, waits: false });
  await page.locator('#filters-drafts').click();
  await expect.poll(look).toEqual({ drafts: false, across: false, waits: true });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sherpa:session:/filters/drafts'))).toBe('false');
});

test('a draft made over another definition of its View is dropped, not applied', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  const r = await page.evaluate(async () => {
    const d = await import('/dist/core/browser/view-drafts.js') as {
      saveDraft(p: string, v: string, q: unknown, sig: string, m: string): void;
      loadDraft(p: string, v: string, sig: string, m: string): unknown;
      clearDraft(p: string, v?: string): void;
      draftSig(view: unknown): string;
    };
    const query = { v: 1, scopes: { view: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } } } };
    const sig = d.draftSig({ query: { v: 1, scopes: {} } });
    d.saveDraft('page', 'risk', query, sig, 'always');
    const same = d.loadDraft('page', 'risk', sig, 'always');
    // The View's own definition changed: the old draft must not hide it.
    const changed = d.loadDraft('page', 'risk', d.draftSig({ query: { v: 1, scopes: { view: { holds: [] } } } }), 'always');
    const after = d.loadDraft('page', 'risk', sig, 'always');
    // Off reads nothing; a write while off forgets the page.
    d.saveDraft('page', 'all', query, sig, 'always');
    const off = d.loadDraft('page', 'all', sig, 'off');
    d.saveDraft('page', 'all', query, sig, 'off');
    return { same, changed, after, off, gone: d.loadDraft('page', 'all', sig, 'always'),
      stored: [sessionStorage.getItem('sherpa:drafts:page'), localStorage.getItem('sherpa:drafts:page')] };
  });
  expect(r.same).toEqual({ v: 1, scopes: { view: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } } } });
  expect(r.changed).toBeUndefined();
  expect(r.after).toBeUndefined();
  expect(r.off).toBeUndefined();
  expect(r.gone).toBeUndefined();
  expect(r.stored).toEqual([null, null]);
});
