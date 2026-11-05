import { test, expect } from './harness';

/**
 * The Query editor's toolbar, Undo and Redo — Will, TODO 734. The editor keeps a journal of the
 * Query's draft copies, whoever made the change (the graph, or a chip outside it); a step is put
 * back through the Query's own whole restore, so every reader redraws. Where a scope waits for Apply a
 * step moves the draft only. Real pointer and key. TRAP T-an-edit-is-a-step
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    const { bindQueryEditor } = await import('/dist/app.js');
    const { QueryContext, VIEW } = await import('/dist/data.js');
    const query = new QueryContext();
    query.ask({ scope: VIEW, hold: ['region'] });
    query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EMEA'] } });
    const canvas = document.getElementById('cv') as HTMLElement;
    const toolbar = canvas.querySelector('sherpa-node-toolbar') as HTMLElement;
    const w = window as unknown as Record<string, unknown>;
    w['q'] = query;
    w['ed'] = bindQueryEditor(canvas as never, { query } as never, { definition: { v: 1, id: 'records', source: { store: 'customers' } }, toolbar });
    await window.__settled();
  });
});

const picked = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const q = (window as unknown as { q: { draft: { scopes: Record<string, { readings: Record<string, { picked?: string[] }> }> } } }).q;
  return q.draft.scopes['view']?.readings['region']?.picked ?? null;
});
const can = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const t = document.querySelector('sherpa-node-toolbar')!;
  const off = (n: string) => t.shadowRoot!.querySelector(`sherpa-button.${n}`)!.hasAttribute('disabled');
  return { undo: t.hasAttribute('data-can-undo'), redo: t.hasAttribute('data-can-redo'), buttons: [off('undo'), off('redo')] };
});
const ask = (page: import('@playwright/test').Page, picks: string[] | null) => page.evaluate(async (p) => {
  (window as unknown as { q: { ask(r: unknown): void } }).q.ask({ scope: 'view', field: 'region', reading: p ? { picked: p } : null });
  await window.__settled();
}, picks);

test('nothing to step: both off; a change made OUTSIDE the editor (a chip) is a step, and Undo and Redo restore it', async ({ page }) => {
  expect(await can(page)).toEqual({ undo: false, redo: false, buttons: [true, true] });
  await ask(page, ['EMEA', 'APAC']);
  expect(await can(page)).toEqual({ undo: true, redo: false, buttons: [false, true] });
  await page.locator('sherpa-node-toolbar sherpa-button.undo').click();
  await expect.poll(() => picked(page)).toEqual(['EMEA']);
  expect(await can(page)).toEqual({ undo: false, redo: true, buttons: [true, false] });
  await page.locator('sherpa-node-toolbar sherpa-button.redo').click();
  await expect.poll(() => picked(page)).toEqual(['EMEA', 'APAC']);
});

const primary = (page: import('@playwright/test').Page) => page.evaluate(() => /mac|iphone|ipad/i.test((navigator as never as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform) ? 'Meta' : 'Control');

test('the primary key (Cmd on a Mac) + Z undo, Shift+Z redoes; the graph redraws with the restored Query', async ({ page }) => {
  await ask(page, ['AMER']);
  await page.locator('sherpa-layout-canvas .viewport').focus();
  await page.keyboard.press(`${await primary(page)}+z`);
  await expect.poll(() => picked(page)).toEqual(['EMEA']);
  await expect.poll(() => page.locator('sherpa-layout-canvas sherpa-node-row sherpa-input-text[name="value"]').first().evaluate((e) => (e as HTMLElement & { value: string }).value)).toBe('EMEA');
  await page.keyboard.press(`${await primary(page)}+Shift+z`);
  await expect.poll(() => picked(page)).toEqual(['AMER']);
});

test('an edit in the graph is a step too; a new edit after an Undo drops the redo tail; the journal is capped', async ({ page }) => {
  await page.locator('#cv sherpa-node-row:has(sherpa-input-text[name="op"]) select').selectOption('notin');
  await page.evaluate(() => window.__settled());
  expect((await can(page)).undo).toBe(true);
  await page.locator('sherpa-node-toolbar sherpa-button.undo').click();
  await expect.poll(() => can(page).then((c) => c.undo)).toBe(false);
  expect((await can(page)).redo).toBe(true);
  await ask(page, ['APAC']);
  expect(await can(page)).toEqual({ undo: true, redo: false, buttons: [false, true] });
  for (let i = 0; i < 110; i++) await ask(page, [`R${i}`]);
  let steps = 0;
  while ((await can(page)).undo) {
    await page.evaluate(() => (window as unknown as { ed: { undo(): boolean } }).ed.undo());
    await page.waitForTimeout(0);
    await page.evaluate(() => window.__settled());
    steps++;
    if (steps > 120) break;
  }
  expect(steps).toBe(100);
});

test('where a scope waits for Apply a step moves the DRAFT only: what is applied stays, and Apply is no step', async ({ page }) => {
  await page.evaluate(() => (window as unknown as { q: { wait(s: string): void } }).q.wait('view'));
  const applied = () => page.evaluate(() => (window as unknown as { q: { applied: { scopes: Record<string, { readings: Record<string, { picked?: string[] }> }> } } }).q.applied.scopes['view']?.readings['region']?.picked);
  await ask(page, ['APAC']);
  expect({ draft: await picked(page), applied: await applied(), undo: (await can(page)).undo }).toEqual({ draft: ['APAC'], applied: ['EMEA'], undo: true });
  await page.locator('sherpa-node-toolbar sherpa-button.undo').click();
  await expect.poll(() => picked(page)).toEqual(['EMEA']);
  expect(await applied()).toEqual(['EMEA']);
  await page.locator('sherpa-node-toolbar sherpa-button.redo').click();
  await expect.poll(() => picked(page)).toEqual(['APAC']);
  expect(await applied()).toEqual(['EMEA']);
  // An Apply is no step: it changes what is applied and leaves the journal as it was.
  await page.evaluate(() => (window as unknown as { q: { ask(r: unknown): void } }).q.ask({ scope: 'view', commit: true }));
  expect(await applied()).toEqual(['APAC']);
  expect((await can(page)).undo).toBe(true);
});
