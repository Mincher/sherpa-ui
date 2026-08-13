import { test, expect } from '@playwright/test';

/**
 * sherpa-tooltip on the reforged base — a CSS-driven hover/focus tooltip. Show/hide
 * is pure CSS (:hover / :focus-within); JS only mirrors data-text into the bubble
 * and wires aria-describedby. Proves the bubble is hidden by default, revealed on
 * hover, carries the text, and sets the a11y association.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('mirrors data-text into the bubble and sets aria-describedby', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tooltip') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-text', 'Delete this item');
    el.innerHTML = '<button>Trash</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const bubble = el.shadowRoot!.querySelector('.bubble')!;
    return {
      text: el.shadowRoot!.querySelector('.tip-text')!.textContent,
      describedby: el.getAttribute('aria-describedby'),
      bubbleId: bubble.id,
    };
  });
  expect(r.text).toBe('Delete this item');
  expect(r.describedby).toBeTruthy();
  expect(r.describedby).toBe(r.bubbleId); // association points at the bubble
});

test('bubble is hidden by default and revealed on hover (CSS-driven)', async ({ page }) => {
  const el = page.locator('sherpa-tooltip');
  await page.evaluate(async () => {
    const t = document.createElement('sherpa-tooltip') as HTMLElement & { rendered?: Promise<void> };
    t.setAttribute('data-text', 'Hi there');
    t.innerHTML = '<button id="trig">Hover me</button>';
    document.getElementById('root')!.appendChild(t);
    await t.rendered;
  });

  const hiddenBefore = await el.evaluate(
    (t) => getComputedStyle((t as HTMLElement).shadowRoot!.querySelector('.bubble')!).visibility,
  );
  expect(hiddenBefore).toBe('hidden');

  // Real hover over the trigger → :host(:hover) reveals the bubble.
  await page.locator('#trig').hover();
  await expect
    .poll(() =>
      el.evaluate(
        (t) => getComputedStyle((t as HTMLElement).shadowRoot!.querySelector('.bubble')!).visibility,
      ),
    )
    .toBe('visible');
});

test('data-placement defaults to top', async ({ page }) => {
  const placement = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tooltip') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML = '<button>x</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.getAttribute('data-placement');
  });
  expect(placement).toBe('top');
});

test('text property reflects to data-text and the bubble', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tooltip') as HTMLElement & {
      rendered?: Promise<void>;
      text?: string;
    };
    el.innerHTML = '<button>x</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.text = 'Set via property';
    await new Promise((res) => setTimeout(res, 0));
    return {
      attr: el.getAttribute('data-text'),
      bubble: el.shadowRoot!.querySelector('.tip-text')!.textContent,
    };
  });
  expect(r.attr).toBe('Set via property');
  expect(r.bubble).toBe('Set via property');
});
