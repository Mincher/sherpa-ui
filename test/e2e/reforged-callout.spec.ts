import { test, expect } from '@playwright/test';

/**
 * sherpa-callout on the reforged base — the status-enum surface (data-status
 * drives a soft color-mix tint + accent bar), the title from data-heading, the
 * message slot, and the dismissible close button + callout-dismiss event.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-callout'));
});

test('data-status drives a soft status surface distinct per status', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (status?: string) => {
      const el = document.createElement('sherpa-callout') as HTMLElement & { rendered?: Promise<void> };
      if (status) el.setAttribute('data-status', status);
      el.textContent = 'message';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      const box = el.shadowRoot!.querySelector('.box')!;
      return getComputedStyle(box).backgroundColor;
    };
    return {
      info: await mk('info'),
      success: await mk('success'),
      warning: await mk('warning'),
      critical: await mk('critical'),
    };
  });
  // Each status yields its own tint, and none collapses to transparent-only.
  const values = [r.info, r.success, r.warning, r.critical];
  expect(new Set(values).size).toBe(4);
  for (const v of values) expect(v).not.toBe('rgba(0, 0, 0, 0)');
});

test('status fills the box with the status surface + border (Figma model)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-callout') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-status', 'critical');
    el.textContent = 'boom';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const box = el.shadowRoot!.querySelector('.box')!;
    const cs = getComputedStyle(box);
    return { surface: cs.backgroundColor, border: cs.borderTopColor };
  });
  expect(r.surface).toBe('rgb(255, 218, 209)'); // theme-surface-critical-base (critical-1 #FFDAD1) box tint
  expect(r.border).toBe('rgb(221, 44, 1)'); // theme-border-critical-2 (critical-3 #DD2C01) border
});

test('data-heading renders into the title node; absent title hides it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const withTitle = document.createElement('sherpa-callout') as HTMLElement & { rendered?: Promise<void> };
    withTitle.setAttribute('data-heading', 'Heads up');
    withTitle.textContent = 'body';
    document.getElementById('root')!.appendChild(withTitle);
    await withTitle.rendered;

    const noTitle = document.createElement('sherpa-callout') as HTMLElement & { rendered?: Promise<void> };
    noTitle.textContent = 'body';
    document.getElementById('root')!.appendChild(noTitle);
    await noTitle.rendered;

    const t1 = withTitle.shadowRoot!.querySelector('.title')!;
    const t2 = noTitle.shadowRoot!.querySelector('.title')!;
    return {
      text: t1.textContent,
      shown: getComputedStyle(t1).display,
      hidden: getComputedStyle(t2).display,
    };
  });
  expect(r.text).toBe('Heads up');
  expect(r.shown).not.toBe('none');
  expect(r.hidden).toBe('none');
});

test('data-heading updates reactively after render', async ({ page }) => {
  const text = await page.evaluate(async () => {
    const el = document.createElement('sherpa-callout') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-heading', 'first');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-heading', 'second');
    return el.shadowRoot!.querySelector('.title')!.textContent;
  });
  expect(text).toBe('second');
});

test('slotted message is projected into the callout', async ({ page }) => {
  const assigned = await page.evaluate(async () => {
    const el = document.createElement('sherpa-callout') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'the message body';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    return slot.assignedNodes().map((n) => n.textContent).join('');
  });
  expect(assigned).toContain('the message body');
});

test('close button is hidden unless data-dismissible', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (dismissible: boolean) => {
      const el = document.createElement('sherpa-callout') as HTMLElement & { rendered?: Promise<void> };
      if (dismissible) el.setAttribute('data-dismissible', '');
      el.textContent = 'x';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el.shadowRoot!.querySelector('.close')!).display;
    };
    return { off: await mk(false), on: await mk(true) };
  });
  expect(r.off).toBe('none');
  expect(r.on).not.toBe('none');
});

test('clicking close fires callout-dismiss and removes the element', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-callout') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-dismissible', '');
    el.textContent = 'dismiss me';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = 0;
    el.addEventListener('callout-dismiss', () => fired++);
    el.shadowRoot!.querySelector<HTMLElement>('.close')!.click();

    return { fired, connected: el.isConnected };
  });
  expect(r.fired).toBe(1);
  expect(r.connected).toBe(false);
});
