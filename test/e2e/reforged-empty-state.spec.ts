import { test, expect } from '@playwright/test';

/**
 * sherpa-empty-state on the reforged base — title / description text sync, the
 * pure-CSS illustration glyph driven by data-illustration, the data-size scale,
 * and the data-has-{slot} reflection for a custom icon, a custom body, and the
 * action region.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('data-title and data-description write the text nodes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-empty-state') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'No results');
    el.setAttribute('data-description', 'Try a different search.');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return {
      title: el.shadowRoot!.querySelector('.title')!.textContent,
      message: el.shadowRoot!.querySelector('.message-text')!.textContent,
    };
  });
  expect(r.title).toBe('No results');
  expect(r.message).toBe('Try a different search.');
});

test('title hidden until data-title is set', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bare = document.createElement('sherpa-empty-state') as HTMLElement & {
      rendered?: Promise<void>;
    };
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;

    const titled = document.createElement('sherpa-empty-state') as HTMLElement & {
      rendered?: Promise<void>;
    };
    titled.setAttribute('data-title', 'Empty');
    document.getElementById('root')!.appendChild(titled);
    await titled.rendered;

    return {
      bare: getComputedStyle(bare.shadowRoot!.querySelector('.title')!).display,
      titled: getComputedStyle(titled.shadowRoot!.querySelector('.title')!).display,
    };
  });
  expect(r.bare).toBe('none');
  expect(r.titled).not.toBe('none');
});

test('data-illustration selects a different glyph per name', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const glyph = async (name?: string) => {
      const el = document.createElement('sherpa-empty-state') as HTMLElement & {
        rendered?: Promise<void>;
      };
      if (name) el.setAttribute('data-illustration', name);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      const g = el.shadowRoot!.querySelector('.glyph')!;
      return getComputedStyle(g, '::before').content;
    };
    return {
      def: await glyph(),
      search: await glyph('search'),
      success: await glyph('success'),
    };
  });
  // Each resolves a non-empty ::before content, and the named ones differ from default.
  expect(r.def).not.toBe('none');
  expect(r.search).not.toBe(r.def);
  expect(r.success).not.toBe(r.def);
});

test('data-size scales the icon disc (sm < base < lg)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const size = async (s?: string) => {
      const el = document.createElement('sherpa-empty-state') as HTMLElement & {
        rendered?: Promise<void>;
      };
      el.setAttribute('data-title', 'x');
      if (s) el.setAttribute('data-size', s);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return parseFloat(getComputedStyle(el.shadowRoot!.querySelector('.icon')!).width);
    };
    return { sm: await size('sm'), base: await size(), lg: await size('lg') };
  });
  expect(r.sm).toBeLessThan(r.base);
  expect(r.base).toBeLessThan(r.lg);
});

test('action slot presence reflects to data-has-action and shows the row', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-empty-state') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'x');
    const btn = document.createElement('button');
    btn.setAttribute('slot', 'action');
    btn.textContent = 'Add item';
    el.appendChild(btn);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasAttr: el.hasAttribute('data-has-action'),
      display: getComputedStyle(el.shadowRoot!.querySelector('.actions')!).display,
    };
  });
  expect(r.hasAttr).toBe(true);
  expect(r.display).toBe('flex');
});

test('a slotted body replaces the default message text', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-empty-state') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'x');
    el.setAttribute('data-description', 'ignored');
    const p = document.createElement('p');
    p.textContent = 'Custom body';
    el.appendChild(p);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasContent: el.hasAttribute('data-has-content'),
      msgTextDisplay: getComputedStyle(el.shadowRoot!.querySelector('.message-text')!).display,
    };
  });
  expect(r.hasContent).toBe(true);
  expect(r.msgTextDisplay).toBe('none');
});

test('a slotted icon hides the default glyph', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-empty-state') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'x');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('slot', 'icon');
    el.appendChild(svg);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasIcon: el.hasAttribute('data-has-icon'),
      glyphDisplay: getComputedStyle(el.shadowRoot!.querySelector('.glyph')!).display,
    };
  });
  expect(r.hasIcon).toBe(true);
  expect(r.glyphDisplay).toBe('none');
});
