import { expect, test } from '@playwright/test';

/**
 * live-stores.ts — records the SERVER pushes.
 *
 * Every other store PULLS: something asks, the store answers. These two are the
 * other direction, and a notification count that is right without anybody
 * refreshing is the case they exist for.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
});

test('a push applies as a whole set OR as one change, and the message decides', async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const { SocketStore } = (await import('/dist/index.js')) as unknown as {
      SocketStore: new (o: unknown) => {
        load(): Promise<{ rows: unknown[]; total: number }>;
        // `receive` is protected; reached here through a cast because the test
        // is about what a MESSAGE does, not about the socket that carried it.
      } & { [k: string]: unknown };
    };

    const store = new SocketStore({ url: 'wss://example.invalid/never', key: 'id' });
    const push = (message: unknown): void =>
      (store as unknown as { receive(m: unknown): void }).receive(message);

    const seen: string[] = [];
    (store as unknown as EventTarget).addEventListener('change', (e) =>
      seen.push((e as CustomEvent).detail.type),
    );

    // A whole ARRAY replaces the set.
    push([
      { id: 1, title: 'One' },
      { id: 2, title: 'Two' },
    ]);
    await new Promise((res) => setTimeout(res, 20));
    const afterArray = (await store.load()).total;

    // …and the StoreChangeDetail shape applies ONE change, which is what stops a
    // 500-row push for a single new notification.
    push({ type: 'insert', row: { id: 3, title: 'Three' } });
    await new Promise((res) => setTimeout(res, 20));
    const afterInsert = (await store.load()).total;

    // The key may be INSIDE the row — a server sending the whole record should
    // not also have to name its id.
    push({ type: 'update', row: { id: 1, title: 'One (edited)' } });
    await new Promise((res) => setTimeout(res, 20));
    const edited = (await store.load()).rows.find((x) => (x as { id: number }).id === 1);

    push({ type: 'remove', key: 2 });
    await new Promise((res) => setTimeout(res, 20));
    const afterRemove = (await store.load()).total;

    return {
      afterArray,
      afterInsert,
      editedTitle: (edited as { title: string }).title,
      afterRemove,
      seen,
    };
  });

  expect(r.afterArray).toBe(2);
  expect(r.afterInsert).toBe(3);
  expect(r.editedTitle).toBe('One (edited)');
  expect(r.afterRemove).toBe(2);

  // Every push ANNOUNCED, so a bound DataSource reloads — the whole point.
  expect(r.seen).toEqual(['update', 'insert', 'update', 'remove']);
});

test('a bad message REPORTS rather than throwing, and the feed carries on', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { SocketStore } = (await import('/dist/index.js')) as unknown as {
      SocketStore: new (o: unknown) => { load(): Promise<{ total: number }> } & Record<
        string,
        unknown
      >;
    };

    const store = new SocketStore({
      url: 'wss://example.invalid/never',
      key: 'id',
      parse: (data: unknown) => {
        if ((data as { kind?: string }).kind === 'other') return undefined; // not mine
        if ((data as { kind?: string }).kind === 'boom') throw new Error('bad payload');
        return data as never;
      },
    });
    const push = (m: unknown): void => (store as unknown as { receive(m: unknown): void }).receive(m);

    const errors: string[] = [];
    (store as unknown as EventTarget).addEventListener('error', (e) =>
      errors.push((e as CustomEvent).detail.stage),
    );

    // A parse that THROWS must not kill the handler — a throw inside a socket
    // callback takes the listener with it and the page goes quiet with no sign.
    push({ kind: 'boom' });
    // …and `undefined` is how parse() says "not mine", which is how one store
    // ignores another's messages on a shared channel.
    push({ kind: 'other' });
    // The feed still works afterwards.
    push({ type: 'insert', row: { id: 1 } });
    await new Promise((res) => setTimeout(res, 30));

    return { errors, total: (await store.load()).total };
  });

  expect(r.errors).toEqual(['parse']);
  expect(r.total).toBe(1);
});

test('a pushed row the SCHEMA refuses never lands', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { SocketStore, rules, required } = (await import('/dist/index.js')) as unknown as {
      SocketStore: new (o: unknown) => { load(): Promise<{ total: number }> } & Record<
        string,
        unknown
      >;
      rules: (m: unknown) => unknown;
      required: () => unknown;
    };

    const store = new SocketStore({
      url: 'wss://example.invalid/never',
      key: 'id',
      schema: rules({ title: required() }),
    });
    const push = (m: unknown): void => (store as unknown as { receive(m: unknown): void }).receive(m);

    const errors: string[] = [];
    (store as unknown as EventTarget).addEventListener('error', (e) =>
      errors.push((e as CustomEvent).detail.stage),
    );

    push({ type: 'insert', row: { id: 1, title: '' } });
    push({ type: 'insert', row: { id: 2, title: 'Real' } });
    await new Promise((res) => setTimeout(res, 30));

    return { errors, total: (await store.load()).total };
  });

  // This is the point of putting the guard on the STORE: a bad record from a
  // server is stopped exactly where a bad record from a form is.
  expect(r.errors).toEqual(['apply']);
  expect(r.total).toBe(1);
});
