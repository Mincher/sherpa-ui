import { test, expect } from '@playwright/test';

/**
 * `rendered` MUST SETTLE, even when the template does not arrive.
 *
 * 557 sites in this repo `await el.rendered`. Before the guard, a rejected
 * markup fetch skipped `#resolveRendered()` and every one of them hung — no
 * error, no timeout, no warning.
 *
 * TRAP T-rendered-settles-even-when-the-markup-does-not
 */
const MODES = [
  // fetch REJECTS — this was the hang.
  ['a dropped connection', 'abort'],
  // fetch RESOLVES: a 404 is a successful response with an error body, which
  // is why loadHtml has to check r.ok rather than trust the promise.
  ['a 404', 'notfound'],
] as const;

for (const [name, how] of MODES) {
  test(name + ' still settles rendered', async ({ page }) => {
    await page.goto('/test/reforged/harness.html');
    const tag = 'sherpa-boot-' + how;
    await page.route('**/' + tag + '.html', (route) =>
      how === 'abort'
        ? route.abort('failed')
        : route.fulfill({ status: 404, body: '<p>not found</p>' }));

    const settled = await page.evaluate(async (tag) => {
      const { SherpaElement } = await import('/dist/index.js') as {
        SherpaElement: typeof HTMLElement & { html?: URL };
      };
      class Probe extends (SherpaElement as unknown as typeof HTMLElement) {
        static html = new URL('./' + tag + '.html', location.href);
      }
      customElements.define(tag, Probe);
      const el = document.createElement(tag) as HTMLElement & { rendered: Promise<void> };
      document.getElementById('root')!.appendChild(el);
      return Promise.race([
        el.rendered.then(() => 'settled'),
        new Promise((r) => setTimeout(() => r('HUNG'), 1500)),
      ]);
    }, tag);

    expect(settled).toBe('settled');
  });
}

test('a 404 does not stamp the server error page as the template', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await page.route('**/sherpa-boot-body.html', (route) =>
    route.fulfill({ status: 404, body: '<p id="server-error">not found</p>' }));

  const html = await page.evaluate(async () => {
    const { SherpaElement } = await import('/dist/index.js') as {
      SherpaElement: typeof HTMLElement & { html?: URL };
    };
    class Probe extends (SherpaElement as unknown as typeof HTMLElement) {
      static html = new URL('./sherpa-boot-body.html', location.href);
    }
    customElements.define('sherpa-boot-body', Probe);
    const el = document.createElement('sherpa-boot-body') as HTMLElement & {
      rendered: Promise<void>;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.innerHTML;
  });

  expect(html).not.toContain('server-error');
});
