import { test, expect } from '@playwright/test';

/**
 * sherpa-tag on the reforged base — the Figma Tag: a NEUTRAL pill by default
 * (white surface, grey border, dark text), coloured via the [data-status] cascade.
 * Covers the neutral default, status colouring, the dismissible close button + event,
 * and the dot-type indicator.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('default is a neutral pill: white surface, grey border, dark text', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'tag';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const pill = el.shadowRoot!.querySelector('.pill')!;
    const cs = getComputedStyle(pill);
    return { bg: cs.backgroundColor, border: cs.borderTopColor, text: cs.color };
  });
  expect(r.bg).toBe('rgb(255, 255, 255)'); // control-surface-default (neutral)
  expect(r.border).toBe('rgb(179, 179, 195)'); // style-border-base → theme-border-default-2 (#b3b3c3 grey)
  expect(r.border).not.toBe(r.bg); // a visible grey border
  expect(r.text).toBe('rgb(53, 53, 61)'); // style-content-base → content-body-1 (#35353d) dark ink
});

test('an ancestor [data-status] colours the pill via the cascade', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (status?: string) => {
      const host = document.createElement('div');
      if (status) host.setAttribute('data-status', status);
      const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
      el.textContent = 'x';
      host.appendChild(el);
      document.getElementById('root')!.appendChild(host);
      await el.rendered;
      const cs = getComputedStyle(el.shadowRoot!.querySelector('.pill')!);
      return { bg: cs.backgroundColor, text: cs.color };
    };
    return { neutral: await mk(), critical: await mk('critical') };
  });
  // Subtle-status model: the plain pill SURFACE (and border) stay neutral under a
  // status — the status hue is carried by --_status-text (and, on the dot,
  // --_status-surface-strong), not the base surface.
  expect(r.neutral.bg).toBe('rgb(255, 255, 255)'); // no status = neutral white
  expect(r.critical.bg).toBe('rgb(255, 255, 255)'); // status: surface stays neutral white
  expect(r.critical.text).not.toBe(r.neutral.text); // the text carries the status hue (--_status-text)
});

test('dismissible template adds a close button that fires tag-remove', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-dismissible', '');
    el.textContent = 'dismissible';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let removed = 0;
    el.addEventListener('tag-remove', () => removed++);
    const close = el.shadowRoot!.querySelector<HTMLElement>('.close');
    close?.click();

    return { hasClose: !!close, removed };
  });
  expect(r.hasClose).toBe(true);
  expect(r.removed).toBe(1);
});

test('default template has no close button', async ({ page }) => {
  const hasClose = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'plain';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return !!el.shadowRoot?.querySelector('.close');
  });
  expect(hasClose).toBe(false);
});

test('dot type renders a small square indicator (no text metrics)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-type', 'dot');

    el.textContent = 'hidden';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const pill = el.shadowRoot!.querySelector('.pill')!;
    const cs = getComputedStyle(pill);
    return { fontSize: cs.fontSize, width: cs.width };
  });
  expect(r.fontSize).toBe('0px'); // label hidden
  expect(parseFloat(r.width)).toBeLessThan(16); // small indicator
});
