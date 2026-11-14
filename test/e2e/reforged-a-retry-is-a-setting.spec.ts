import { test, expect, type Page } from './harness';

/**
 * A RETRY IS A SETTING — plan 992 O7 A (Will, 2026-11-14): a step that can fail has Retries, a setting of how it runs. The
 * canvas never draws it as a row; the node's Details has a Settings tab, after Details (and an Output's Output tab), that
 * holds it.
 * TRAP T-a-retry-is-a-setting
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 640px"></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js' as string);
    (window as unknown as Record<string, unknown>)['ed'] = bindWorkflow(document.getElementById('cv') as never, {
      v: 3, id: 'retry',
      nodes: [
        { id: 'm', kind: 'model', x: 20, y: 260, values: { provider: 'anthropic', model: 'sonnet' } },
        { id: 'r', kind: 'runbook', x: 380, y: 20, heading: 'Install patches', values: { type: 'text', instructions: 'Install the patches.', retries: 2, 'retry-wait': 10 } },
      ],
      connections: [{ from: 'm/model', to: 'r/model' }],
    } as never, { session: new SessionStore(), inspector: document.getElementById('inspector') as never });
    await window.__settled();
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const tabs = (page: Page) => page.locator('#inspector sherpa-tabs.content-tabs').evaluate((el) => [...el.children].map((c) => (c as HTMLElement).dataset['tab']));

test('the canvas draws no Retries row; the Details panel has a Settings tab after Details, holding Retries', async ({ page }) => {
  const card = page.locator('#cv > sherpa-node[data-heading="Install patches"]');
  await expect(card).toHaveCount(1);
  await expect(card.locator('[name="retries"]')).toHaveCount(0);
  expect(await card.locator('sherpa-node-row').count()).toBeGreaterThan(0);
  await card.locator('.header[role="button"]').click({ position: { x: 40, y: 12 } });
  await settle(page);
  expect((await tabs(page)).slice(0, 2)).toEqual(['details', 'settings']);
  // The field: a Sherpa control named Retries, holding 2.
  const field = (tab: string) => page.locator(`#inspector [data-tab="${tab}"] [name="retries"]`).evaluateAll((els) => els.filter((e) => e.localName.startsWith('sherpa-')).map((e) => String((e as HTMLElement & { value: unknown }).value)));
  expect(await field('settings')).toEqual(['2']);
  const wait = await page.locator('#inspector [data-tab="settings"] [name="retry-wait"]').evaluateAll((els) => els.filter((e) => e.localName.startsWith('sherpa-')).map((e) => String((e as HTMLElement & { value: unknown }).value)));
  expect(wait).toEqual(['10']);
  // Details holds what the step does, not its Retries.
  expect(await field('details')).toEqual([]);
});
