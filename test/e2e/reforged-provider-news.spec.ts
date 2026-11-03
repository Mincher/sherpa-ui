import { test, expect } from './harness';

/**
 * A PAGE HOLDS ITS NEWS IN ONE `Updates` — plan 687 U1. An element that listens
 * for a kind shows while news of it waits: heard on the channel, closed by its
 * dismiss until the next notice, taken in by its own Refresh, and shown again on
 * the next page while it still waits.
 * TRAP T-a-notice-is-heard-never-ordered
 */
test('a listening banner shows while its news waits, and a dismiss or its Refresh hides it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settle = () => window.__settled();
    const root = document.getElementById('root')!;
    root.innerHTML = `<sherpa-provider>
      <sherpa-callout id="data" data-type="banner" data-listens="data" data-locked data-dismissible hidden>Newer data is waiting.</sherpa-callout>
      <sherpa-callout id="app" data-type="banner" data-listens="app" data-locked data-dismissible hidden>A new version is ready.</sherpa-callout>
    </sherpa-provider>`;
    const provider = root.querySelector('sherpa-provider') as HTMLElement & {
      updates: { waiting: { data: Map<string, unknown> } };
      provide(o: unknown): Promise<void>;
    };
    await settle();
    const shown = () => ({
      data: !(root.querySelector('#data') as HTMLElement).hidden,
      app: !(root.querySelector('#app') as HTMLElement).hidden,
    });
    const say = async (notice: unknown) => {
      const channel = new BroadcastChannel('sherpa-notices');
      channel.postMessage(notice);
      channel.close();
      await new Promise((res) => setTimeout(res, 100));
      await settle();
    };
    const at: Record<string, unknown> = { start: shown() };
    await say({ kind: 'data', store: 'customers' });
    at['heard'] = shown();
    (root.querySelector('#data') as HTMLElement & { dismiss(): void }).dismiss();
    await settle();
    at['dismissed'] = shown();
    // The next page still waits on it: dismissed, it stays shut.
    await provider.provide({ sources: {} });
    at['next page'] = shown();
    await say({ kind: 'data', store: 'customers' });
    at['again'] = shown();
    // A new page's banner, drawn hidden, shows what still waits.
    const fresh = root.querySelector('#data')!.cloneNode(true) as HTMLElement;
    fresh.hidden = true;
    root.querySelector('#data')!.replaceWith(fresh);
    await provider.provide({ sources: {} });
    at['new page'] = shown();
    // Its own Refresh takes the rows in.
    root.querySelector('#data')!.dispatchEvent(new CustomEvent('data-refresh', { bubbles: true, composed: true, detail: {} }));
    await settle();
    at['refreshed'] = shown();
    at['waiting'] = [...provider.updates.waiting.data.keys()];
    return at;
  });
  expect(r).toEqual({
    start: { data: false, app: false },
    heard: { data: true, app: false },
    dismissed: { data: false, app: false },
    'next page': { data: false, app: false },
    again: { data: true, app: false },
    'new page': { data: true, app: false },
    refreshed: { data: false, app: false },
    waiting: [],
  });
});
