import { test, expect, type Page } from '@playwright/test';

/**
 * A CARD SHOWS ITS DATA'S STATE, driven by the data layer — TODO 58. No page
 * writes it: the provider draws each source's loading, no matches and failure
 * on the card of every component it answers. Runs against the EXAMPLES server
 * (:4200); `?remote` makes a load slow and `?fail` makes it fail.
 * TRAP T-a-container-shows-its-datas-state
 */
const gridCard = (page: Page) => page.evaluate(() => {
  const grid = document.querySelector('#context-root sherpa-data-grid')!;
  const card = grid.closest('sherpa-container') as HTMLElement;
  return { state: card.dataset['state'] ?? null, loading: card.hasAttribute('data-loading'), message: card.dataset['errorMessage'] ?? null };
});
const ready = (page: Page) => page.waitForFunction(() => !!document.querySelector('#context-root sherpa-data-grid'));

test('a filter that matches nothing reads "No matches", and Clear filters brings the rows back', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  expect(await gridCard(page)).toMatchObject({ state: null, loading: false });
  // Tickets over 999 — a filter the Records bar holds, so Clear filters clears it.
  await page.evaluate(() => (window as unknown as { sherpa: { source: { setQuery(q: unknown, o: unknown): Promise<void> } } })
    .sherpa.source.setQuery({ v: 1, scopes: { data: { readings: { openTickets: { op: 'gt', text: '999' } } } } }, { holds: 'keep' }));
  await expect.poll(async () => (await gridCard(page)).state).toBe('no-matches');
  await page.evaluate(() => {
    const card = document.querySelector('#context-root sherpa-data-grid')!.closest('sherpa-container')!;
    (card.shadowRoot!.querySelector('.clear-filters') as HTMLElement).shadowRoot!.querySelector<HTMLElement>('button')!.click();
  });
  await expect.poll(async () => (await gridCard(page)).state).toBe(null);
  expect(await page.evaluate(() => (window as unknown as { sherpa: { source: { debugState(): { total: number } } } })
    .sherpa.source.debugState().total)).toBeGreaterThan(0);
});

test('a load that fails shows its error on the card, and Dismiss takes it away', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records&fail=1');
  await ready(page);
  await expect.poll(async () => (await gridCard(page)).state).toBe('error');
  expect((await gridCard(page)).message).toContain('failed');
  await page.evaluate(() => {
    const card = document.querySelector('#context-root sherpa-data-grid')!.closest('sherpa-container')!;
    (card.shadowRoot!.querySelector('.dismiss') as HTMLElement).shadowRoot!.querySelector<HTMLElement>('button')!.click();
  });
  expect((await gridCard(page)).state).toBe(null);
});

test('a slow load shows the card loading, and it goes when the rows come', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records&remote=1');
  await ready(page);
  const seen: boolean[] = [];
  for (let i = 0; i < 40 && !seen.includes(true); i++) {
    seen.push((await gridCard(page)).loading);
    await page.waitForTimeout(50);
  }
  expect(seen).toContain(true);
  await expect.poll(async () => (await gridCard(page)).loading, { timeout: 10000 }).toBe(false);
});

/**
 * KEEP THE CONTENT — Will's own pattern, TODO 59, a trial in Settings ›
 * Experiments. Loading is a bar along the header's bottom edge and the body is
 * locked; a failure is a banner above the body. The overlay never shows.
 */
async function keepContent(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem('sherpa:session:/experiments/keepContent', 'true'));
  await page.reload();
  await ready(page);
}
const kept = (page: Page) => page.evaluate(() => {
  const card = document.querySelector('#context-root sherpa-data-grid')!.closest('sherpa-container')!;
  const shown = (sel: string) => {
    const el = card.shadowRoot!.querySelector<HTMLElement>(sel)!;
    return getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
  };
  return {
    keep: card.hasAttribute('data-keep-content'),
    overlay: shown('.state'),
    bar: shown('.loading-bar'),
    banner: shown('.banner-error'),
    body: shown('.body'),
    said: card.shadowRoot!.querySelector('.banner-error')!.textContent!.replace(/\s+/g, ' ').trim(),
  };
});

test('kept content: a failure is a banner above the body, and its Dismiss takes it away', async ({ page }) => {
  await keepContent(page, 'http://localhost:4200/?context=records&fail=1');
  await expect.poll(async () => (await gridCard(page)).state).toBe('error');
  const r = await kept(page);
  expect(r).toMatchObject({ keep: true, overlay: false, banner: true, body: true });
  expect(r.said).toContain('failed');
  expect(r.said).toContain('The last data is still shown.');
  await page.evaluate(() => {
    const card = document.querySelector('#context-root sherpa-data-grid')!.closest('sherpa-container')!;
    (card.shadowRoot!.querySelector('.banner .dismiss') as HTMLElement).shadowRoot!.querySelector<HTMLElement>('button')!.click();
  });
  expect((await gridCard(page)).state).toBe(null);
  expect((await kept(page)).banner).toBe(false);
});

test('kept content: a slow load is a bar, never the overlay', async ({ page }) => {
  await keepContent(page, 'http://localhost:4200/?context=records&remote=1');
  const seen: { bar: boolean; overlay: boolean }[] = [];
  for (let i = 0; i < 40 && !seen.some((s) => s.bar); i++) {
    const { bar, overlay } = await kept(page);
    seen.push({ bar, overlay });
    await page.waitForTimeout(50);
  }
  expect(seen.some((s) => s.bar)).toBe(true);
  expect(seen.some((s) => s.overlay)).toBe(false);
  await expect.poll(async () => (await gridCard(page)).loading, { timeout: 10000 }).toBe(false);
  expect((await kept(page)).bar).toBe(false);
});
