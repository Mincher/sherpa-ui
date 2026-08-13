import { test, expect } from '@playwright/test';

/**
 * sherpa-proposal-op on the reforged base — a single proposed operation row.
 * Proves the op-type glyph + colour (create=success, update=warning,
 * delete=critical), the data-label text sync, and the slotted-body override.
 *
 * Not in the harness index, so the spec imports the compiled module to register it.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-proposal-op/sherpa-proposal-op.js');
    await customElements.whenDefined('sherpa-proposal-op');
  });
});

type WithRender = HTMLElement & { rendered?: Promise<void> };

test('data-label writes the label text node', async ({ page }) => {
  const text = await page.evaluate(async () => {
    const el = document.createElement('sherpa-proposal-op') as WithRender;
    el.setAttribute('data-op', 'create');
    el.setAttribute('data-label', 'Add node "Ingest"');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.querySelector('.text')!.textContent;
  });
  expect(text).toBe('Add node "Ingest"');
});

test('op type drives the glyph colour from the status tokens', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const glyphColor = async (op: string) => {
      const el = document.createElement('sherpa-proposal-op') as WithRender;
      el.setAttribute('data-op', op);
      el.setAttribute('data-label', 'x');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el.shadowRoot!.querySelector('.glyph')!).color;
    };
    return {
      create: await glyphColor('create'),
      update: await glyphColor('update'),
      del: await glyphColor('delete'),
    };
  });
  expect(r.create).toBe('rgb(22, 145, 90)'); // content-success-default #16915a
  expect(r.update).toBe('rgb(181, 115, 10)'); // content-warning-default #b5730a
  expect(r.del).toBe('rgb(200, 50, 79)'); // content-critical-default #c8324f
});

test('a slotted body replaces the data-label text node', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-proposal-op') as WithRender;
    el.setAttribute('data-op', 'update');
    el.setAttribute('data-label', 'ignored');
    el.textContent = 'Slotted description';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasContent: el.hasAttribute('data-has-content'),
      textDisplay: getComputedStyle(el.shadowRoot!.querySelector('.text')!).display,
    };
  });
  expect(r.hasContent).toBe(true);
  expect(r.textDisplay).toBe('none');
});
