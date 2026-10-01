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

test('toggling the summary fires accordion-open, then accordion-close', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-accordion') as AccordionEl;
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const events: boolean[] = [];
    el.addEventListener('accordion-open', () => events.push(true));
    el.addEventListener('accordion-close', () => events.push(false));

    const summary = el.shadowRoot!.querySelector<HTMLElement>('.header')!;
    // The native <details> toggle event fires on a queued task and COALESCES
    // multiple state changes in one task into a single event — so wait for each
    // event before the next click. A settle alone lost one in Firefox, 3 in 25.
    const heard = (type: string): Promise<unknown> =>
      new Promise((res) => el.addEventListener(type, res, { once: true }));
    let next = heard('accordion-open');
    summary.click(); // open
    await next;
    next = heard('accordion-close');
    summary.click(); // close
    await next;
    return { events, open: el.open };
  });
  expect(r.events).toEqual([true, false]);
  expect(r.open).toBe(false);
});

// Figma's chevron-down in a 14px box, drawn at its Figma size — not a CSS box.
test('the chevron is the Figma icon at its drawn size, and turns on [open]', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-accordion') as AccordionEl;
    el.setAttribute('data-heading', 'Details');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const chevron = el.shadowRoot!.querySelector<HTMLElement>('.chevron')!;
    const measure = () => {
      chevron.getAnimations().forEach((a) => a.finish());
      const box = chevron.getBoundingClientRect();
      const ink = chevron.querySelector('path')!.getBoundingClientRect();
      return { box: [box.width, box.height], ink: [ink.width, ink.height] };
    };
    const closed = measure();
    el.open = true;
    const opened = measure();
    return { icon: chevron.dataset.icon, closed, opened };
  });
  expect(r.icon).toBe('chevron-down');
  // The box does not change when the chevron turns.
  expect(r.opened.box).toEqual([14, 14]);
  // Open: points down. Figma draws it about 10.4 x 5.4 of its 14 frame.
  expect(r.opened.ink[0]).toBeGreaterThan(10);
  expect(r.opened.ink[0]).toBeLessThan(11);
  expect(r.opened.ink[1]).toBeLessThan(6);
  // Shut: the same drawing, turned to point right.
  expect(r.closed.ink[0]).toBeLessThan(6);
  expect(r.closed.ink[1]).toBeGreaterThan(10);
});

// Shut, the section fills with the Style DOWN step (base +2); open keeps the card's fill. TODO 64.
test('a shut section fills with the Style +2 surface; an open one keeps base', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-accordion') as AccordionEl;
    el.setAttribute('data-heading', 'Details');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const root = el.shadowRoot!.querySelector<HTMLElement>('.root')!;
    const probe = (name: string): string => {
      const p = document.createElement('span');
      p.style.background = `var(${name})`;
      root.appendChild(p);
      const bg = getComputedStyle(p).backgroundColor;
      p.remove();
      return bg;
    };
    const shut = getComputedStyle(root).backgroundColor;
    el.open = true;
    const opened = getComputedStyle(root).backgroundColor;
    return { shut, opened, down: probe('--sherpa-style-surface-base-2'), host: getComputedStyle(el).backgroundColor };
  });
  expect(r.shut).toBe(r.down);
  expect(r.shut).not.toBe(r.host);
  // Open, the root paints nothing: the card's own fill shows.
  expect(r.opened).toBe('rgba(0, 0, 0, 0)');
});
