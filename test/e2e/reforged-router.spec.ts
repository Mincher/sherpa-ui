import { test, expect, type Page } from '@playwright/test';

/**
 * sherpa-router — the ONE owner of the URL, on the Navigation API. TODO 67.
 *
 * A link, `go()` and Back all request a navigation; the router intercepts it,
 * so the page never reloads, and reports what changed.
 *
 * TRAP T-the-router-owns-the-url
 */
const HARNESS = '/test/reforged/harness.html';

type Router = HTMLElement & {
  rendered?: Promise<void>;
  route: Record<string, string | null>;
  href(route: Record<string, string | null>): string;
  go(changes: Record<string, string | null>, options?: { replace?: boolean }): Promise<void>;
};
type Seen = { changed: string[]; type: string; route: Record<string, string | null> };

/** Mount a router, and keep every `route-change` on `window.__seen`. */
async function mount(page: Page): Promise<void> {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(async () => {
    const w = window as unknown as { __seen: Seen[]; __booted: number };
    w.__seen = [];
    w.__booted = 1;
    const router = document.createElement('sherpa-router') as Router;
    router.setAttribute('data-params', 'context=dashboard view');
    router.setAttribute('data-overlay', 'settings');
    document.addEventListener('route-change', (e) => {
      const { changed, type, route } = (e as CustomEvent).detail;
      w.__seen.push({ changed, type, route });
    });
    document.getElementById('root')!.appendChild(router);
    await router.rendered;
  });
}

const seen = (page: Page): Promise<Seen[]> => page.evaluate(() => (window as unknown as { __seen: Seen[] }).__seen);
const booted = (page: Page): Promise<number | undefined> => page.evaluate(() => (window as unknown as { __booted?: number }).__booted);
const search = (page: Page): string => new URL(page.url()).search;

test('a link inside a shadow root navigates with no reload, and the route is reported', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = '<a href="?context=records&view=risk">Records</a>';
    document.getElementById('root')!.appendChild(host);
  });
  await page.getByRole('link', { name: 'Records' }).click();
  await expect.poll(() => search(page)).toBe('?context=records&view=risk');
  // The SAME document: a reload would have dropped this.
  expect(await booted(page)).toBe(1);
  expect(await seen(page)).toEqual([
    { changed: ['context', 'view'], type: 'push', route: { context: 'records', view: 'risk', settings: null } },
  ]);
});

test('go() changes the route it is given and keeps the rest; replace adds no entry; Back reports a traverse', async ({ page }) => {
  await mount(page);
  const r = await page.evaluate(async () => {
    const router = document.querySelector('sherpa-router') as Router;
    const start = { route: router.route, entries: navigation.entries().length };
    await router.go({ context: 'records' });
    await router.go({ view: 'risk' }, { replace: true });
    const after = { route: router.route, entries: navigation.entries().length, search: location.search };
    // The same route again is no navigation.
    await router.go({ view: 'risk' });
    return { start, after, again: navigation.entries().length, href: router.href({ context: 'chat', view: null, settings: null }) };
  });
  expect(r.start.route).toEqual({ context: 'dashboard', view: null, settings: null });
  expect(r.after.route).toEqual({ context: 'records', view: 'risk', settings: null });
  expect(r.after.search).toBe('?context=records&view=risk');
  expect(r.after.entries).toBe(r.start.entries + 1);
  expect(r.again).toBe(r.after.entries);
  expect(new URL(r.href).search).toBe('?context=chat');

  await page.goBack();
  await expect.poll(() => search(page)).toBe('');
  expect(await booted(page)).toBe(1);
  expect((await seen(page)).map((s) => [s.type, s.changed])).toEqual([
    ['push', ['context']],
    ['replace', ['view']],
    ['traverse', ['context', 'view']],
  ]);
});

test('an OVERLAY link keeps the page it opens over, and the URL says the whole route', async ({ page }) => {
  await mount(page);
  await page.evaluate(async () => {
    await (document.querySelector('sherpa-router') as Router).go({ context: 'records', view: 'risk' });
    const link = document.createElement('a');
    link.href = '?settings=profile';
    link.textContent = 'Profile';
    document.getElementById('root')!.appendChild(link);
  });
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect.poll(() => search(page)).toBe('?context=records&view=risk&settings=profile');
  expect(await booted(page)).toBe(1);
  // ONE change, to the overlay alone: the page under it is not told to reload.
  expect((await seen(page)).at(-1)).toEqual({
    changed: ['settings'], type: 'push', route: { context: 'records', view: 'risk', settings: 'profile' },
  });
});

test('a parameter it does not own is kept, and go() waits for the page', async ({ page }) => {
  await mount(page);
  const r = await page.evaluate(async () => {
    const router = document.querySelector('sherpa-router') as Router;
    history.replaceState(null, '', '?live=1');
    let loaded = false;
    document.addEventListener('route-change', (e) => {
      (e as CustomEvent).detail.waitUntil(new Promise<void>((done) => setTimeout(() => { loaded = true; done(); }, 50)));
    }, { once: true });
    await router.go({ context: 'records' });
    return { loaded, search: location.search };
  });
  expect(r).toEqual({ loaded: true, search: '?live=1&context=records' });
});
