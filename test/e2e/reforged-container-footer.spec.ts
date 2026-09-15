import { test, expect } from '@playwright/test';

/**
 * sherpa-container-footer on the reforged base — the footer bar for a container's
 * footer slot. A pure surface: exercises the data-has-content reflection (collapse
 * when empty, appear when filled) and data-align controlling the slotted controls'
 * horizontal distribution.
 *
 * Not registered by the harness index — the spec imports its module in-page.
 */

const HARNESS = '/test/reforged/harness.html';

type FooterEl = HTMLElement & { rendered?: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-container-footer/sherpa-container-footer.js');
    await customElements.whenDefined('sherpa-container-footer');
  });
});

test('collapses when empty, appears when the slot has content', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bare = document.createElement('sherpa-container-footer') as FooterEl;
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const full = document.createElement('sherpa-container-footer') as FooterEl;
    full.innerHTML = '<button>Save</button>';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return {
      bareContentAttr: bare.hasAttribute('data-has-content'),
      bareHostVisible: getComputedStyle(bare).display !== 'none',
      fullContentAttr: full.hasAttribute('data-has-content'),
      fullHostVisible: getComputedStyle(full).display !== 'none',
    };
  });
  expect(r.bareContentAttr).toBe(false);
  expect(r.bareHostVisible).toBe(false);
  expect(r.fullContentAttr).toBe(true);
  expect(r.fullHostVisible).toBe(true);
});

test('data-align controls the row justification', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (align?: string) => {
      const el = document.createElement('sherpa-container-footer') as FooterEl;
      if (align) el.setAttribute('data-align', align);
      el.innerHTML = '<button>A</button><button>B</button>';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return getComputedStyle(el.shadowRoot!.querySelector('.row')!).justifyContent;
    };
    return {
      defaultJustify: await mk(),
      start: await mk('start'),
      between: await mk('between'),
    };
  });
  expect(r.defaultJustify).toBe('flex-end'); // end-aligned by default
  expect(r.start).toBe('flex-start');
  expect(r.between).toBe('space-between');
});

test('data-align="stretch" lets ONE wide control fill the row', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const box = document.createElement('div');
    box.style.cssText = 'inline-size:600px';
    const el = document.createElement('sherpa-container-footer') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-align', 'stretch');
    el.innerHTML = '<div id="wide">x</div>';
    box.appendChild(el);
    root.appendChild(box);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      row: Math.round(el.shadowRoot!.querySelector('.row')!.getBoundingClientRect().width),
      child: Math.round(document.getElementById('wide')!.getBoundingClientRect().width),
    };
  });
  // A chat composer or a search field takes the whole row rather than hugging
  // its content at one end the way a button cluster does.
  expect(r.child).toBe(r.row);
});

test('the default still hugs its content at the end', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const box = document.createElement('div');
    box.style.cssText = 'inline-size:600px';
    const el = document.createElement('sherpa-container-footer') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML = '<div id="btn">x</div>';
    box.appendChild(el);
    root.appendChild(box);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const row = el.shadowRoot!.querySelector('.row')!.getBoundingClientRect();
    const child = document.getElementById('btn')!.getBoundingClientRect();
    return { rowW: Math.round(row.width), childW: Math.round(child.width),
             flushRight: Math.abs(row.right - child.right) < 2 };
  });
  // stretch is opt-in: without it a control keeps its own width, at the end.
  expect(r.childW).toBeLessThan(r.rowW / 2);
  expect(r.flushRight).toBe(true);
});
