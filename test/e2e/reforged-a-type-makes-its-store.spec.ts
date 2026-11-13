import { test, expect } from './harness';

/**
 * A TYPE MAKES ITS STORE — Will, plan 960 U3: an app lists a type in app.json `types`, the type names its rows, and a
 * page over it opens with no store the app made: the outlet makes the type's store, seeded, and a page that names the
 * type shows its words. TRAP T-local-records-seed-themselves
 */
test('a page over a type\'s store opens with the type\'s rows and words, and no store the app made', async ({ page }) => {
  await page.goto('/test/reforged/outlet.html?context=devices');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  const r = await page.evaluate(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet') as unknown as { start(o: unknown): Promise<void> };
    const base = new URL('/test/reforged/typed/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
    const grid = () => document.querySelector('#grid') as HTMLElement & { shadowRoot: ShadowRoot };
    // outlet.html has no __settled: wait for the rows, then a frame for the bar.
    for (let i = 0; i < 100 && !grid()?.shadowRoot?.querySelectorAll('.row').length; i++) await new Promise((done) => setTimeout(done, 50));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const heads = [...grid().shadowRoot.querySelectorAll('.head-cell .head-label')].map((l) => l.textContent);
    const bar = document.querySelector('#bar') as HTMLElement & { shadowRoot: ShadowRoot };
    return {
      rows: grid().shadowRoot.querySelectorAll('.row').length,
      heads,
      chips: [...bar.shadowRoot.querySelectorAll('.chips > .chip')].map((c) => (c as HTMLElement).dataset['id']),
    };
  });
  expect(r.rows).toBe(3);
  expect(r.heads).toEqual(['Device name', 'Status', 'Risk']);
  expect(r.chips).toContain('status');
});

test('a graph type\'s entities are rows of its type: its data file\'s entities seeded as the reader\'s own, each a row', async ({ page }) => {
  await page.goto('/test/reforged/outlet.html?context=teammates');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  const r = await page.evaluate(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet') as unknown as { start(o: unknown): Promise<void> };
    const base = new URL('/test/reforged/typed/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
    const grid = () => document.querySelector('#grid') as HTMLElement & { shadowRoot: ShadowRoot };
    for (let i = 0; i < 100 && grid()?.shadowRoot?.querySelectorAll('.row').length !== 2; i++) await new Promise((done) => setTimeout(done, 50));
    const shelf = (document.querySelector('sherpa-provider') as unknown as { keeper: { entities: { get(id: string): { origin?: string } | undefined } } }).keeper.entities;
    return {
      rows: [...grid().shadowRoot.querySelectorAll('.row')].map((row) => (row as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
      origin: shelf.get('ana')?.origin,
    };
  });
  expect(r.rows.length).toBe(2);
  expect(r.rows.join(' | ')).toMatch(/Ana.*active.*week/);
  expect(r.rows.join(' | ')).toMatch(/Bo.*active.*day/);
  expect(r.origin).toBe('mine');
});

test('a Context that names a type and no template is the type\'s own page: its toolbar, a grid of its fields, a pager', async ({ page }) => {
  for (const [context, heads, rows] of [['all-devices', ['Device name', 'Status', 'Risk'], 3], ['all-teammates', ['Name', 'Status', 'Runs'], 2]] as const) {
    await page.goto(`/test/reforged/outlet.html?context=${context}`);
    await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
    const r = await page.evaluate(async (want) => {
      const { SessionStore } = await import('/dist/index.js');
      const outlet = document.querySelector('sherpa-outlet') as unknown as { start(o: unknown): Promise<void> };
      const base = new URL('/test/reforged/typed/app.json', location.href);
      await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
      const grid = () => document.querySelector('sherpa-outlet sherpa-data-grid') as HTMLElement & { shadowRoot: ShadowRoot } | null;
      for (let i = 0; i < 100 && grid()?.shadowRoot?.querySelectorAll('.row').length !== want; i++) await new Promise((done) => setTimeout(done, 50));
      return {
        rows: grid()?.shadowRoot.querySelectorAll('.row').length ?? 0,
        heads: [...grid()?.shadowRoot.querySelectorAll('.head-cell .head-label') ?? []].map((l) => l.textContent),
        toolbar: !!document.querySelector('sherpa-outlet sherpa-quick-filter-toolbar'),
        pager: !!document.querySelector('sherpa-outlet sherpa-pagination'),
      };
    }, rows);
    expect(r, context).toEqual({ rows, heads: [...heads], toolbar: true, pager: true });
  }
});
