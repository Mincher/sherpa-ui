import { test, expect } from '@playwright/test';

/**
 * sherpa-code-block on the reforged base — a monospace code display with a copy
 * button. Proves the code renders verbatim in <pre>, the language label mirrors
 * data-language, and the copy button writes to the clipboard + fires code-copy.
 *
 * The component isn't registered by the harness index, so the spec imports the
 * compiled module to trigger its customElements.define().
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  // Stub the clipboard so writeText resolves in the test browser context. Set
  // before navigation so it's installed on the harness page.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        _text: '',
        writeText(t: string) {
          (this as unknown as { _text: string })._text = t;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-code-block/sherpa-code-block.js');
    await customElements.whenDefined('sherpa-code-block');
  });
});

type WithRender = HTMLElement & { rendered?: Promise<void> };

test('renders data-code verbatim inside the <pre><code>', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-code-block') as WithRender;
    el.setAttribute('data-code', 'const a = 1;\n  const b = 2;');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const code = el.shadowRoot!.querySelector('.code')!;
    return {
      text: code.textContent,
      whiteSpace: getComputedStyle(el.shadowRoot!.querySelector('.pre')!).whiteSpace,
      codeWhiteSpace: getComputedStyle(code).whiteSpace,
    };
  });
  expect(r.text).toBe('const a = 1;\n  const b = 2;');
  expect(r.codeWhiteSpace).toBe('pre'); // line breaks + indentation preserved
});

test('data-language shows a language label', async ({ page }) => {
  const label = await page.evaluate(async () => {
    const el = document.createElement('sherpa-code-block') as WithRender;
    el.setAttribute('data-code', 'x');
    el.setAttribute('data-language', 'ts');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.querySelector('.language')!.textContent;
  });
  expect(label).toBe('ts');
});

test('the copy button fires code-copy with the code and flips data-copied', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-code-block') as WithRender;
    el.setAttribute('data-code', 'copy me');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let detail: { code?: string } | null = null;
    el.addEventListener('code-copy', (e) => {
      detail = (e as CustomEvent).detail;
    });

    (el.shadowRoot!.querySelector('.copy') as HTMLButtonElement).click();
    await new Promise((res) => setTimeout(res, 10));

    return {
      code: (detail as { code?: string } | null)?.code,
      copiedAttr: el.hasAttribute('data-copied'),
      clipboard: (navigator.clipboard as unknown as { _text: string })._text,
    };
  });
  expect(r.code).toBe('copy me');
  expect(r.copiedAttr).toBe(true);
  expect(r.clipboard).toBe('copy me');
});
