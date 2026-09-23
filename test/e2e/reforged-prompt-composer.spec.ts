import { test, expect } from '@playwright/test';

/**
 * sherpa-prompt-composer on the reforged base — the AI prompt input. Proves the
 * send button and Enter both fire prompt-submit with the trimmed { text } and
 * clear the field, that an empty value is a no-op, and that Shift+Enter does not
 * submit.
 *
 * The component isn't registered by the harness index, so the spec imports the
 * compiled module to trigger its customElements.define().
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-prompt-composer/sherpa-prompt-composer.js');
    await customElements.whenDefined('sherpa-prompt-composer');
  });
});

type Composer = HTMLElement & { rendered?: Promise<void>; value: string };

test('the send button fires prompt-submit with the text and clears the field', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-prompt-composer') as Composer;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let detail: { text?: string } | null = null;
    el.addEventListener('prompt-submit', (e) => {
      detail = (e as CustomEvent).detail;
    });

    const input = el.shadowRoot!.querySelector('.input') as HTMLTextAreaElement;
    input.value = '  hello world  ';
    // A composed sherpa-button: its own render to await, and the click target
    // is its inner trigger, not the host.
    const send = el.shadowRoot!.querySelector('.send') as HTMLElement & {
      shadowRoot: ShadowRoot; rendered: Promise<void> };
    await send.rendered;
    (send.shadowRoot.querySelector('button') as HTMLElement).click();

    return { text: (detail as { text?: string } | null)?.text, cleared: el.value };
  });
  expect(r.text).toBe('hello world'); // trimmed
  expect(r.cleared).toBe(''); // cleared on submit
});

test('Enter submits; Shift+Enter does not', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-prompt-composer') as Composer;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let count = 0;
    let lastText = '';
    el.addEventListener('prompt-submit', (e) => {
      count += 1;
      lastText = (e as CustomEvent).detail.text;
    });

    const input = el.shadowRoot!.querySelector('.input') as HTMLTextAreaElement;

    // Shift+Enter — should NOT submit.
    input.value = 'line one';
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }),
    );
    const afterShift = count;

    // Plain Enter — should submit.
    input.value = 'send this';
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    return { afterShift, count, lastText, cleared: el.value };
  });
  expect(r.afterShift).toBe(0); // Shift+Enter didn't submit
  expect(r.count).toBe(1); // plain Enter submitted once
  expect(r.lastText).toBe('send this');
  expect(r.cleared).toBe('');
});

test('an empty (whitespace-only) submit is a no-op', async ({ page }) => {
  const count = await page.evaluate(async () => {
    const el = document.createElement('sherpa-prompt-composer') as Composer;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let n = 0;
    el.addEventListener('prompt-submit', () => (n += 1));

    const input = el.shadowRoot!.querySelector('.input') as HTMLTextAreaElement;
    input.value = '   ';
    // A composed sherpa-button: its own render to await, and the click target
    // is its inner trigger, not the host.
    const send = el.shadowRoot!.querySelector('.send') as HTMLElement & {
      shadowRoot: ShadowRoot; rendered: Promise<void> };
    await send.rendered;
    (send.shadowRoot.querySelector('button') as HTMLElement).click();
    return n;
  });
  expect(count).toBe(0);
});
