import { test, expect } from '@playwright/test';

/**
 * sherpa-toast on the reforged base — a transient notification. Exercises the
 * message + status render, the manual close path (toast-dismiss + removal), the
 * auto-dismiss timer, and the static factory helpers.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(() => customElements.whenDefined('sherpa-toast'));
});

test('renders the message and reflects the status', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-status', 'success');
    el.setAttribute('data-message', 'Saved.');
    el.setAttribute('data-duration', '0'); // no auto-dismiss during the assert
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return {
      message: el.shadowRoot!.querySelector('.heading')!.textContent,
      status: el.getAttribute('data-status'),
    };
  });
  expect(r.message).toBe('Saved.');
  expect(r.status).toBe('success');
});

test('the card fills the PALE status tint; the icon glyph carries the strong hue (Figma model)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-status', 'critical');
    el.setAttribute('data-heading', 'Boom');
    el.setAttribute('data-duration', '0');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const card = getComputedStyle(el.shadowRoot!.querySelector('.toast')!);
    const badge = getComputedStyle(el.shadowRoot!.querySelector('.icon')!);
    const heading = getComputedStyle(el.shadowRoot!.querySelector('.heading')!);
    return { card: card.backgroundColor, badge: badge.color, heading: heading.color };
  });
  // Figma Toast 27:750: fill = style-surface/base +1 (critical → #ffdad1) via the
  // --_status-surface-subtle cascade; heading = style-content/secondary (#35353d,
  // status-independent); the 14px glyph carries the strong status hue.
  expect(r.card).toBe('rgb(255, 218, 209)');
  expect(r.heading).toBe('rgb(53, 53, 61)');
  expect(r.badge).not.toBe('rgb(255, 255, 255)');
  expect(r.badge).not.toBe('rgb(53, 53, 61)');
});

test('data-value and data-action reveal the detail line and action link', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-heading', 'Saved');
    el.setAttribute('data-value', '3 items updated');
    el.setAttribute('data-action', 'Undo');
    el.setAttribute('data-duration', '0');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    let acted = false;
    el.addEventListener('toast-action', () => (acted = true));
    const value = el.shadowRoot!.querySelector('.value')!;
    const action = el.shadowRoot!.querySelector<HTMLButtonElement>('.action')!;
    const valueShown = getComputedStyle(value).display !== 'none';
    const actionShown = getComputedStyle(action).display !== 'none';
    action.click();
    return { value: value.textContent, action: action.textContent, valueShown, actionShown, acted };
  });
  expect(r.value).toBe('3 items updated');
  expect(r.action).toBe('Undo');
  expect(r.valueShown).toBe(true);
  expect(r.actionShown).toBe(true);
  expect(r.acted).toBe(true);
});

test('the close button fires toast-dismiss and removes the toast', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-message', 'Close me');
    el.setAttribute('data-duration', '0');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let dismissed = 0;
    el.addEventListener('toast-dismiss', () => dismissed++);
    // A composed sherpa-button: its own render to await, and the click target
    // is the inner trigger, not the host.
    const close = el.shadowRoot!.querySelector('.close') as HTMLElement & {
      shadowRoot: ShadowRoot; rendered: Promise<void> };
    await close.rendered;
    (close.shadowRoot.querySelector('button') as HTMLElement).click();
    // The event fires straight away; the node leaves after the slide-out animation.
    const leavingImmediately = el.hasAttribute('data-leaving');
    await new Promise((res) => setTimeout(res, 300));

    return { dismissed, leavingImmediately, connected: el.isConnected };
  });
  expect(r.dismissed).toBe(1);
  expect(r.leavingImmediately).toBe(true); // animates out rather than vanishing
  expect(r.connected).toBe(false);
});

test('auto-dismisses after data-duration and fires toast-dismiss', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-message', 'Bye');
    el.setAttribute('data-duration', '60');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const dismissed = await new Promise<boolean>((resolve) => {
      el.addEventListener('toast-dismiss', () => resolve(true));
      setTimeout(() => resolve(false), 1000);
    });
    // Give the slide-out animation time to finish before checking it is gone.
    await new Promise((res) => setTimeout(res, 300));
    return { dismissed, connected: el.isConnected };
  });
  expect(r.dismissed).toBe(true);
  expect(r.connected).toBe(false);
});

test('the default life is five seconds', async ({ page }) => {
  const duration = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-message', 'Default');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // Not yet dismissed a moment after appearing — the 5s timer is running.
    await new Promise((res) => setTimeout(res, 120));
    const stillHere = el.isConnected && !el.hasAttribute('data-leaving');
    el.remove();
    return stillHere;
  });
  expect(duration).toBe(true);
});

test('the static helpers stack toasts in the top-right corner', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mod = await import('/dist/components/sherpa-toast/sherpa-toast.js');
    const SherpaToast = (mod as {
      SherpaToast: { info(m: string, o?: { duration?: number }): HTMLElement };
    }).SherpaToast;
    const first = SherpaToast.info('One', { duration: 0 }) as HTMLElement & { rendered?: Promise<void> };
    const second = SherpaToast.info('Two', { duration: 0 }) as HTMLElement & { rendered?: Promise<void> };
    await first.rendered;
    await second.rendered;
    const stack = first.parentElement!;
    const box = stack.getBoundingClientRect();
    return {
      sameStack: second.parentElement === stack,
      stackClass: stack.className,
      count: stack.children.length,
      // Top-right: near the top, and its right edge near the viewport's.
      nearTop: box.top < 40,
      nearRight: window.innerWidth - box.right < 40,
      // The pair stacks vertically rather than overlapping.
      stacksDown: second.getBoundingClientRect().top > first.getBoundingClientRect().top,
    };
  });
  expect(r.stackClass).toBe('sherpa-toast-stack');
  expect(r.sameStack).toBe(true);
  expect(r.count).toBe(2);
  expect(r.nearTop).toBe(true);
  expect(r.nearRight).toBe(true);
  expect(r.stacksDown).toBe(true);
});

test('static helper creates, appends, and returns a toast', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mod = await import('/dist/components/sherpa-toast/sherpa-toast.js');
    const SherpaToast = (mod as { SherpaToast: { critical(m: string, o?: { duration?: number }): HTMLElement } }).SherpaToast;
    const toast = SherpaToast.critical('Boom', { duration: 0 }) as HTMLElement & { rendered?: Promise<void> };
    await toast.rendered;
    return {
      // The helpers drop toasts into the shared top-right stack, which itself lives
      // on <body> — so the toast is in the document, one level deeper than before.
      inStack: toast.parentElement?.classList.contains('sherpa-toast-stack') === true,
      stackOnBody: toast.parentElement?.parentElement === document.body,
      status: toast.getAttribute('data-status'),
      message: toast.shadowRoot!.querySelector('.heading')!.textContent,
    };
  });
  expect(r.inStack).toBe(true);
  expect(r.stackOnBody).toBe(true);
  expect(r.status).toBe('critical');
  expect(r.message).toBe('Boom');
});

test('the factory passes the detail line and the action through', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { SherpaToast } = await import('/dist/index.js') as {
      SherpaToast: { success: (m: string, o?: Record<string, unknown>) => HTMLElement & { rendered?: Promise<void> } };
    };
    const toast = SherpaToast.success('Jane saved', {
      value: 'The customer record was created.',
      action: 'Undo',
      duration: 0,
    });
    await toast.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const sr = toast.shadowRoot!;
    return {
      heading: sr.querySelector('.heading')?.textContent,
      value: sr.querySelector('.value')?.textContent,
      action: sr.querySelector('.action')?.textContent,
      stacked: toast.hasAttribute('data-stacked'),
      inSharedStack: toast.parentElement?.classList.contains('sherpa-toast-stack'),
    };
  });
  // Before this the factory could only set the heading, so an app wanting both
  // lines had to build the element by hand — and lost the shared stack with it.
  expect(r.heading).toBe('Jane saved');
  expect(r.value).toBe('The customer record was created.');
  expect(r.action).toBe('Undo');
  expect(r.inSharedStack).toBe(true);
  expect(r.stacked).toBe(true);
});
