import { test, expect } from '@playwright/test';

/**
 * sherpa-accordion on the reforged base — a disclosure card backed by native
 * <details> / <summary>. Proves the native [open] state toggles the body,
 * clicking the summary fires the composed `toggle` with { open }, the `open`
 * property reflects both ways, and data-heading renders the summary label.
 */

const HARNESS = '/test/reforged/harness.html';

type AccordionEl = HTMLElement & { rendered?: Promise<void>; open?: boolean };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('defaults closed; the body is hidden until [open]', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-accordion') as AccordionEl;
    el.setAttribute('data-heading', 'Details');
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const details = el.shadowRoot!.querySelector<HTMLDetailsElement>('.root')!;
    const bodyVisible = () =>
      getComputedStyle(el.shadowRoot!.querySelector('.body')!).display !== 'none';
    const closed = { open: el.open, native: details.open, bodyVisible: bodyVisible() };
    el.open = true;
    const opened = { open: el.open, native: details.open, bodyVisible: bodyVisible() };
    return { closed, opened, heading: el.shadowRoot!.querySelector('.heading-text')!.textContent };
  });
  expect(r.closed.open).toBe(false);
  expect(r.closed.native).toBe(false);
  expect(r.opened.open).toBe(true);
  expect(r.opened.native).toBe(true);
  expect(r.opened.bodyVisible).toBe(true);
  expect(r.heading).toBe('Details');
});

test('toggling the summary fires a composed toggle with { open }', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-accordion') as AccordionEl;
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const events: boolean[] = [];
    el.addEventListener('toggle', (e) => events.push((e as CustomEvent).detail.open));

    const summary = el.shadowRoot!.querySelector<HTMLElement>('.header')!;
    // The native <details> toggle event fires on a queued task and COALESCES
    // multiple state changes in one task into a single event — so flush between
    // the two clicks to observe both the open and the close toggle.
    summary.click(); // open
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    summary.click(); // close
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { events, open: el.open };
  });
  expect(r.events).toEqual([true, false]);
  expect(r.open).toBe(false);
});
