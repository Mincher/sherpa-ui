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
  // Risk is `filterable: false`: its heading has no filter, and says its type's label all the same.
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

test('a page\'s module reads another type\'s rows through ctx.stores, the stores its page reads', async ({ page }) => {
  await page.goto('/test/reforged/outlet.html?context=devices');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  const r = await page.evaluate(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet') as unknown as { start(o: unknown): Promise<void> };
    const base = new URL('/test/reforged/typed/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({ alerts: { load: () => null } }) });
    const seen = () => (window as unknown as { __typed?: { stores: string[]; teammates?: number } }).__typed;
    for (let i = 0; i < 100 && !seen(); i++) await new Promise((done) => setTimeout(done, 50));
    // Each app.json type's own acts are registered: the chat works with any of them (plan 964 N2).
    const { actsOf } = await import('/dist/index.js');
    return { ...seen(), acts: actsOf({ type: 'device' }).map((a: { id: string }) => a.id) };
  });
  expect(r).toEqual({ stores: ['alerts', 'device', 'teammate'], teammates: 2, acts: ['device.find', 'device.read', 'device.add', 'device.change', 'device.remove'] });
});

test('a press that names an act runs it through the one door, says it in a toast, and its Undo puts it back', async ({ page }) => {
  await page.goto('/test/reforged/outlet.html?context=devices');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  const rows = () => page.evaluate(() => (document.querySelector('#grid') as HTMLElement & { shadowRoot: ShadowRoot } | null)?.shadowRoot?.querySelectorAll('.row').length ?? 0);
  await page.evaluate(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet') as unknown as { start(o: unknown): Promise<void> };
    const base = new URL('/test/reforged/typed/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
    // A page hears each answer, and each Undo, so it draws a change no store tells it.
    (window as unknown as { __acts: unknown[] }).__acts = [];
    document.querySelector('sherpa-outlet')!.addEventListener('act-run', (e) => (window as unknown as { __acts: unknown[] }).__acts.push((e as CustomEvent).detail));
  });
  const heard = () => page.evaluate(() => (window as unknown as { __acts: unknown[] }).__acts);
  await expect.poll(rows).toBe(3);
  // The button says its act and its row in markup: command="--device.remove" value="d2", commandfor the outlet.
  await page.locator('#remove-bravo').click();
  await expect.poll(rows).toBe(2);
  const toast = page.locator('sherpa-toast').filter({ hasText: 'Removed Device "Bravo".' });
  await expect(toast).toHaveCount(1);
  await expect.poll(heard).toEqual([{ id: 'device.remove', keys: ['d2'], done: 'Removed Device "Bravo".' }]);
  await toast.locator('[part="action"], .action').first().click();
  await expect.poll(rows).toBe(3);
  await expect.poll(heard).toEqual([{ id: 'device.remove', keys: ['d2'], done: 'Removed Device "Bravo".' }, { id: 'device.remove', keys: ['d2'], undone: true }]);
});

test('outlet.act runs an act with its input through the same door as a press, fires act-run, and toasts nothing', async ({ page }) => {
  await page.goto('/test/reforged/outlet.html?context=devices');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  const r = await page.evaluate(async () => {
    type Answer = { done?: string; refused?: string; undo?: () => Promise<void> };
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet') as unknown as HTMLElement & {
      start(o: unknown): Promise<void>; act(id: string, call?: unknown): Promise<Answer>;
    };
    const early = (await outlet.act('device.change', { keys: ['d1'], input: { status: 'offline' } })).refused;
    const heard: unknown[] = [];
    outlet.addEventListener('act-run', (e) => heard.push((e as CustomEvent).detail));
    const base = new URL('/test/reforged/typed/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
    const refused = (await outlet.act('device.change', { keys: ['d1'], input: { status: 'gone' } })).refused;
    const changed = await outlet.act('device.change', { keys: ['d1'], input: { status: 'offline' } });
    const status = async () => ((await outlet.act('device.read', { keys: ['d1'] })) as { result?: { status?: string } }).result?.status;
    const after = await status();
    await changed.undo?.();
    const undone = await status();
    return { early, refused, done: changed.done, after, undone, heard, toasts: document.querySelectorAll('sherpa-toast').length };
  });
  expect(r.early).toBe('The app has not started, so it cannot do that yet.');
  expect(r.refused).toMatch(/Status: Must be one of/);
  expect(r.done).toBe('Changed Device "Alpha".');
  expect([r.after, r.undone]).toEqual(['offline', 'online']);
  expect(r.toasts).toBe(0);
  expect(r.heard).toEqual([
    { id: 'device.change', keys: ['d1'], refused: r.refused },
    { id: 'device.change', keys: ['d1'], done: 'Changed Device "Alpha".' },
    { id: 'device.read', keys: ['d1'], done: 'Read Device "Alpha".' },
    { id: 'device.change', keys: ['d1'], undone: true },
    { id: 'device.read', keys: ['d1'], done: 'Read Device "Alpha".' },
  ]);
});

test('a pressed act that needs input opens its flow: a field per step that holds, each answer checked, then it runs as a press does', async ({ page }) => {
  await page.goto('/test/reforged/outlet.html?context=devices');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const { registerAct, registerFlow, storeOfType } = await import('/dist/data.js');
    // Tag: its Status asked, its Reason only for Offline, a yes or no; the app orders them in a flow.
    registerAct({
      id: 'device.tag', label: 'Tag', type: 'device', changes: true,
      input: {
        status: { label: 'Status', required: true, values: ['online', 'offline'], labels: { online: 'Online', offline: 'Offline' } },
        reason: { label: 'Reason', min: 3 },
        urgent: { type: 'boolean', label: 'Urgent' },
      },
      async run(call, ctx) {
        const store = storeOfType(ctx.stores, 'device')!;
        const key = call.keys?.[0];
        const was = (await store.byKey(key))!;
        await store.update(key, { status: call.input?.['status'] });
        return { done: `Tagged ${String(was['name'])} ${String(call.input?.['status'])}.`, undo: async () => { await store.update(key, { status: was['status'] }); } };
      },
    });
    registerFlow({ v: 1, act: 'device.tag', steps: [{ field: 'status' }, { field: 'reason', when: { status: { eq: 'offline' } } }, { field: 'urgent' }] });
    const outlet = document.querySelector('sherpa-outlet') as unknown as { start(o: unknown): Promise<void> };
    const base = new URL('/test/reforged/typed/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
  });
  const status = () => page.evaluate(async () => {
    const { storeOfType } = await import('/dist/data.js');
    const outlet = document.querySelector('sherpa-outlet') as unknown as { actContext(): Parameters<typeof storeOfType>[0] extends infer S ? { stores: S } : never };
    return (await storeOfType(outlet.actContext().stores, 'device')?.byKey('d1'))?.['status'];
  });
  const dialog = page.locator('sherpa-outlet .flow');
  const open = () => dialog.evaluate((d) => (d as HTMLElement & { open: boolean }).open);
  const field = (name: string) => page.locator(`sherpa-outlet .flow-step[data-field="${name}"]`);
  const shown = () => page.locator('sherpa-outlet .flow-step:not([data-off])').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['field']));
  const run = page.locator('sherpa-outlet .flow-run');
  await expect.poll(status).toBe('online');

  // A page that asks it itself prevents act-input: nothing opens.
  await page.evaluate(() => document.querySelector('sherpa-outlet')!.addEventListener('act-input', (e) => {
    e.preventDefault();
    (window as unknown as { __asked: unknown }).__asked = (e as CustomEvent).detail;
  }, { once: true }));
  await page.locator('#tag-alpha').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __asked?: unknown }).__asked)).toEqual({ id: 'device.tag', keys: ['d1'] });
  expect(await open()).toBe(false);

  await page.locator('#tag-alpha').click();
  await expect.poll(open).toBe(true);
  await expect(dialog).toHaveAttribute('data-heading', 'Tag');
  await expect.poll(shown).toEqual(['status', 'urgent']);
  await expect(run).toHaveAttribute('disabled', '');
  await field('status').locator('select').selectOption('offline');
  await expect.poll(shown).toEqual(['status', 'reason', 'urgent']);
  // Every field is in view: the optional Reason left as it is counts as skipped, so the act can run already.
  await expect(page.locator('sherpa-outlet .flow-said')).toHaveText('Tag: Device "Alpha", Status Offline, Urgent No.');
  await expect(run).not.toHaveAttribute('disabled');
  // A short Reason is refused under its own field once it is left, and holds the button back; a longer one clears it.
  await field('reason').locator('input').fill('ab');
  await field('reason').locator('input').press('Tab');
  await expect(field('reason')).toHaveAttribute('data-error', /at least 3/);
  await expect(run).toHaveAttribute('disabled', '');
  await field('reason').locator('input').fill('Broken');
  await expect(field('reason')).not.toHaveAttribute('data-error');
  await expect(page.locator('sherpa-outlet .flow-said')).toHaveText('Tag: Device "Alpha", Status Offline, Reason Broken, Urgent No.');
  await expect(run).not.toHaveAttribute('disabled');
  await run.click();
  await expect.poll(open).toBe(false);
  await expect.poll(status).toBe('offline');
  const toast = page.locator('sherpa-toast').filter({ hasText: 'Tagged Alpha offline.' });
  await expect(toast).toHaveCount(1);
  await toast.locator('[part="action"], .action').first().click();
  await expect.poll(status).toBe('online');
});
