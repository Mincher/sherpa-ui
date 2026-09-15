import { expect, test } from '@playwright/test';

/**
 * sherpa-notifications — the bell's list, as a menu.
 *
 * Composed throughout: sherpa-menu for the card, sherpa-list-item for each row,
 * sherpa-button for the action. The component owns only WHICH notifications
 * there are and what happens when one is clicked.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
});

const ITEMS = [
  { id: 'a', title: 'Renewed', description: 'Enterprise', time: '2m ago', unread: true },
  { id: 'b', title: 'Payment failed', description: 'Declined', time: '1h ago', unread: true },
  { id: 'c', title: 'Report ready', time: '2d ago' },
];

test('it composes real components, and marks unread rows', async ({ page }) => {
  const r = await page.evaluate(async (items) => {
    const el = document.createElement('sherpa-notifications') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      unreadCount: number;
      shadowRoot: ShadowRoot;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate(items);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const menu = el.shadowRoot.querySelector('.menu')!;
    const rows = [...menu.querySelectorAll('.notification')] as HTMLElement[];

    return {
      menuTag: menu.tagName,
      rowTags: [...new Set(rows.map((n) => n.tagName))],
      labels: rows.map((n) => n.dataset['label']),
      unreadFlags: rows.map((n) => n.hasAttribute('data-unread')),
      unreadCount: el.unreadCount,
      // NOT swallowed by the row render. The header slot holding "Mark all read"
      // is a fixed part of the template and lives in the SAME light DOM the rows
      // are stamped into — `replaceChildren` took it with them.
      hasReadAll: !!menu.querySelector('.read-all'),
      // Zero raw markup: every part is a composed component.
      rawInRows: rows
        .flatMap((n) => [...n.querySelectorAll('*')])
        .filter((n) => !n.tagName.startsWith('SHERPA-') && n.tagName !== 'I' && n.tagName !== 'SPAN')
        .map((n) => n.tagName),
    };
  }, ITEMS);

  expect(r.menuTag).toBe('SHERPA-MENU');
  expect(r.rowTags).toEqual(['SHERPA-LIST-ITEM']);
  expect(r.labels).toEqual(['Renewed', 'Payment failed', 'Report ready']);
  expect(r.unreadFlags).toEqual([true, true, false]);
  expect(r.unreadCount).toBe(2);
  expect(r.hasReadAll).toBe(true);
  expect(r.rawInRows).toEqual([]);
});

test('mark all read clears the pips at once and reports the ids', async ({ page }) => {
  const r = await page.evaluate(async (items) => {
    const el = document.createElement('sherpa-notifications') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      unreadCount: number;
      shadowRoot: ShadowRoot;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate(items);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    let reported: string[] = [];
    el.addEventListener('notification-read', (e) => {
      reported = (e as CustomEvent).detail.ids;
    });

    const button = el.shadowRoot.querySelector('.menu')!.querySelector('.read-all') as HTMLElement & {
      rendered?: Promise<void>;
      shadowRoot: ShadowRoot;
    };
    await button.rendered;
    button.shadowRoot.querySelector('button')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const rows = [...el.shadowRoot.querySelector('.menu')!.querySelectorAll('.notification')];
    return {
      reported,
      stillUnread: rows.filter((n) => n.hasAttribute('data-unread')).length,
      unreadCount: el.unreadCount,
    };
  }, ITEMS);

  expect(r.reported).toEqual(['a', 'b']);
  // Marked LOCALLY as well as reported. A host that persists this pushes the
  // same change back, and a list that waited for that round trip would sit
  // unread-looking for as long as the network took.
  expect(r.stillUnread).toBe(0);
  expect(r.unreadCount).toBe(0);
});

test('an empty list says so rather than showing an empty card', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-notifications') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      shadowRoot: ShadowRoot;
    };
    el.setAttribute('data-empty-text', 'All caught up');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const menu = el.shadowRoot.querySelector('.menu')!;
    const readAll = menu.querySelector('.read-all')!;
    return {
      empty: el.hasAttribute('data-empty'),
      text: menu.querySelector('.empty')?.textContent,
      rows: menu.querySelectorAll('.notification').length,
      // Nothing to mark when there is nothing there.
      readAllShown: getComputedStyle(readAll).display !== 'none',
    };
  });

  expect(r.empty).toBe(true);
  expect(r.text).toBe('All caught up');
  expect(r.rows).toBe(0);
  expect(r.readAllShown).toBe(false);
});
