import { test, expect, type Bar } from './harness';
import type { Page } from '@playwright/test';

/**
 * RESET, AND RESET ALL TO DEFAULT — TODO 109 and 129. Reset has its label, and
 * a ▾ beside it, in one group; its menu's "Reset all to default" asks for the
 * View's OWN filters, which only the provider knows. The ask is CANCELABLE, so
 * an app can ask the reader first — and keep what is on screen under a name.
 * TRAP T-reset-to-default-is-the-views-own
 */
// Folded away, the ⋮ lists both: "the ⋮ menu lists every folded action".
test('the bar and the panel: Reset is labelled, and its menu asks for the View\'s own filters', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const heard: string[] = [];
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });
    const panel = await window.__mount<HTMLElement>('sherpa-filter-panel', undefined, {});
    await window.__settled();
    for (const el of [bar, panel]) {
      el.addEventListener('view-reset', (e) => heard.push(`${el.localName}${e.cancelable ? ', cancelable' : ''}`));
    }
    const pick = async (host: HTMLElement): Promise<{ label: string; row: string; grouped: boolean }> => {
      const more = host.shadowRoot!.querySelector<HTMLElement>('.reset-more')!;
      more.shadowRoot!.querySelector<HTMLElement>('button')!.click();
      await window.__settled();
      const row = more.querySelector<HTMLElement>('button[value="reset-default"]')!;
      row.click();
      await window.__settled();
      const reset = more.previousElementSibling as HTMLElement;
      return { label: reset.textContent!.trim(), row: row.textContent!.trim(),
        grouped: more.parentElement!.classList.contains('sherpa-group') };
    };
    const onBar = await pick(bar);
    const onPanel = await pick(panel);
    return { heard, onBar, onPanel };
  });
  expect(r.onBar).toEqual({ label: 'Reset', row: 'Reset all to default', grouped: true });
  expect(r.onPanel).toEqual({ label: 'Reset', row: 'Reset all to default', grouped: true });
  // A host that asks the reader first can take it over.
  expect(r.heard).toEqual(['sherpa-quick-filter-toolbar, cancelable', 'sherpa-filter-panel, cancelable']);
});

type Source = {
  query: { applied: unknown }; debugState(): { total: number };
  scope(s: string): string[]; hold(s: string, f: string[]): void;
};
const open = async (page: Page): Promise<void> => {
  await page.goto('http://localhost:4200/?context=records&view=risk');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await page.waitForFunction(() => !!(window as unknown as { sherpa?: { source?: unknown } }).sherpa?.source);
};
/** What the page filters by now, and what the dialog shows. */
const snap = (page: Page) => page.evaluate(() => {
  const source = (window as unknown as { sherpa: { source: Source } }).sherpa.source;
  const dialog = document.querySelector('#reset-confirm')!;
  const provider = document.querySelector('sherpa-provider') as HTMLElement & { view?: string };
  const menu = document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')!
    .shadowRoot!.querySelector('.chip[data-id="view"] sherpa-menu')!;
  return {
    total: source.debugState().total, query: JSON.stringify(source.query.applied),
    holdsSeats: source.scope('data').includes('seats'),
    asking: dialog.hasAttribute('open'),
    error: dialog.querySelector('sherpa-input-text')!.getAttribute('data-error'),
    view: provider.view,
    views: [...menu.querySelectorAll<HTMLElement>('.menu-row:not(.menu-section)')].map((n) => n.textContent?.trim() ?? ''),
  };
});
/** Reset, then a filter added: no longer the View's own. Then ask to Reset all to default. */
const changeAndAsk = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const bar = document.querySelector('#qft')!;
    bar.shadowRoot!.querySelector<HTMLElement>('.act[data-act="clear"]')!.shadowRoot!.querySelector<HTMLElement>('button')!.click();
  });
  await expect.poll(async () => (await snap(page)).total).toBe(100);
  await page.evaluate(() => {
    const source = (window as unknown as { sherpa: { source: Source } }).sherpa.source;
    source.hold('data', [...source.scope('data'), 'seats']);
  });
  await expect.poll(async () => (await snap(page)).holdsSeats).toBe(true);
  await page.evaluate(async () => {
    const more = document.querySelector('#qft')!.shadowRoot!.querySelector<HTMLElement>('.reset-more')!;
    more.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    more.querySelector<HTMLElement>('button[value="reset-default"]')!.click();
  });
  await expect.poll(async () => (await snap(page)).asking).toBe(true);
};
/** Press the dialog's Cancel (0) or Reset all (1), with the switch and a name as asked. */
const answer = (page: Page, button: 0 | 1, save?: { name: string }) => page.evaluate(async ({ button, save }) => {
  const dialog = document.querySelector('#reset-confirm')!;
  if (save) {
    dialog.querySelector('sherpa-switch')!.shadowRoot!.querySelector<HTMLElement>('input')!.click();
    (dialog.querySelector('sherpa-input-text') as HTMLElement & { value: string }).value = save.name;
  }
  const pressed = dialog.querySelectorAll('sherpa-container-footer sherpa-button')[button] as HTMLElement;
  pressed.shadowRoot!.querySelector<HTMLElement>('button')!.click();
}, { button, save });

/**
 * ON THE RECORDS PAGE: the At risk View, then a Reset and a filter added. Reset
 * all to default ASKS first (TODO 129); confirmed, it puts back At risk's own
 * filters — and takes the added one off. Runs against the EXAMPLES server
 * (:4200): the provider and the dialog are the app's.
 */
test('Reset all to default asks first; confirmed, it puts back the View\'s own filters', async ({ page }) => {
  await open(page);
  await expect.poll(async () => (await snap(page)).total).toBeLessThan(100);
  const risk = await snap(page);
  await changeAndAsk(page);
  const asked = await snap(page);
  // Asked, and nothing has gone yet.
  expect(asked.total).toBe(100);
  expect(asked.holdsSeats).toBe(true);

  // CANCEL: nothing is reset.
  await answer(page, 0);
  await expect.poll(async () => (await snap(page)).asking).toBe(false);
  expect((await snap(page)).holdsSeats).toBe(true);

  await page.evaluate(async () => {
    const more = document.querySelector('#qft')!.shadowRoot!.querySelector<HTMLElement>('.reset-more')!;
    more.querySelector<HTMLElement>('button[value="reset-default"]')!.click();
  });
  await expect.poll(async () => (await snap(page)).asking).toBe(true);
  await answer(page, 1);
  // The reset is two writes — the page's first Query, then the View's — so wait for the last.
  await expect.poll(async () => (await snap(page)).query).toBe(risk.query);
  await expect.poll(async () => (await snap(page)).total).toBe(risk.total);
  const back = await snap(page);
  expect(back.holdsSeats).toBe(false);
  // Nothing was saved: the switch was off.
  expect(back.views).toEqual(risk.views);
});

/* Will, TODO 129: "Include a simple switch to 'Save filters before reset' that
   will reveal a text input… and a valid name entered, on confirming reset
   then the current filter configuration should be saved, using the provided
   name, before all filters are reset." */
test('"Save filters before reset" needs a name, keeps what is on screen under it, then resets', async ({ page }) => {
  await open(page);
  await expect.poll(async () => (await snap(page)).total).toBeLessThan(100);
  const risk = await snap(page);
  await changeAndAsk(page);
  const changed = await snap(page);
  const field = () => page.evaluate(() => (document.querySelector('#reset-confirm sherpa-input-text') as HTMLElement).hidden);
  expect(await field()).toBe(true);

  // The switch on, and NO name: it stays open, says why, and resets nothing.
  await answer(page, 1, { name: '  ' });
  expect(await field()).toBe(false);
  await expect.poll(async () => (await snap(page)).error).toBeTruthy();
  const refused = await snap(page);
  expect(refused).toMatchObject({ asking: true, holdsSeats: true, total: 100 });

  // A name: saved under it, the page stays on its own View, and the filters reset.
  await page.evaluate(() => {
    const dialog = document.querySelector('#reset-confirm')!;
    const name = dialog.querySelector('sherpa-input-text') as HTMLElement & { value: string };
    name.value = 'Kept for later';
    name.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await answer(page, 1);
  await expect.poll(async () => (await snap(page)).query).toBe(risk.query);
  await expect.poll(async () => (await snap(page)).total).toBe(risk.total);
  const done = await snap(page);
  expect(done).toMatchObject({ asking: false, view: risk.view, holdsSeats: false });
  expect(done.views).toEqual([...risk.views, 'Kept for later']);

  // The saved View holds what was on screen before the reset.
  await page.evaluate(() => {
    const menu = document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')!
      .shadowRoot!.querySelector('.chip[data-id="view"] sherpa-menu')!;
    const row = [...menu.querySelectorAll<HTMLElement>('.menu-row')].find((n) => n.textContent?.trim() === 'Kept for later')!;
    row.querySelector('input')!.click();
  });
  await expect.poll(async () => (await snap(page)).holdsSeats).toBe(true);
  await expect.poll(async () => (await snap(page)).total).toBe(changed.total);
});
