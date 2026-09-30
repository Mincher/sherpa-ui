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
