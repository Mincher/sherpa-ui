import { test, expect } from './harness';

/**
 * A SWAP IS MARKUP — TODO 344. A toggle's name, icon and pressed state follow a
 * host attribute from `data-swap-*` in the template, both ways, from the first
 * render on. TRAP T-a-swapped-label-is-in-the-markup
 */
test('a swap follows its host attribute both ways, from the first render', async ({ page }) => {
  const r = await page.evaluate(async () => {
    await import('/dist/index.js');
    const settle = (window as unknown as { __settled: () => Promise<void> }).__settled;
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const make = async (tag: string, attrs: Record<string, string> = {}) => {
      const el = document.createElement(tag) as HTMLElement & { rendered?: Promise<void> };
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      root.appendChild(el);
      await el.rendered;
      return el;
    };
    const header = await make('sherpa-container-header', { 'data-collapsible': '' });
    const toggle = () => header.shadowRoot!.querySelector('.toggle')!;
    const chip = await make('sherpa-quick-filter', { 'data-label': 'Status' });
    const caret = () => chip.shadowRoot!.querySelector('.caret')!;
    const canvas = await make('sherpa-layout-canvas', { 'data-no-minimap': '' });
    const row = () => canvas.shadowRoot!.querySelector('.minimap-toggle')!.textContent;

    const before = {
      toggle: [toggle().getAttribute('aria-label'), toggle().getAttribute('aria-expanded')],
      caret: [caret().getAttribute('aria-label'), caret().getAttribute('aria-haspopup')],
      row: row(),
    };
    header.toggleAttribute('data-collapsed', true);
    chip.toggleAttribute('data-dismiss', true);
    canvas.removeAttribute('data-no-minimap');
    await settle();
    const on = {
      toggle: [toggle().getAttribute('aria-label'), toggle().getAttribute('aria-expanded')],
      caret: [caret().getAttribute('aria-label'), caret().getAttribute('aria-haspopup')],
      row: row(),
    };
    header.removeAttribute('data-collapsed');
    chip.removeAttribute('data-dismiss');
    await settle();
    const off = {
      toggle: [toggle().getAttribute('aria-label'), toggle().getAttribute('aria-expanded')],
      caret: [caret().getAttribute('aria-label'), caret().getAttribute('aria-haspopup')],
    };
    return { before, on, off };
  });
  // A canvas born with no minimap says Show from its first render.
  expect(r.before).toEqual({ toggle: ['Collapse', 'true'], caret: ['Choose values', 'dialog'], row: 'Show minimap' });
  expect(r.on).toEqual({ toggle: ['Expand', 'false'], caret: ['Dismiss', 'false'], row: 'Hide minimap' });
  expect(r.off).toEqual({ toggle: ['Collapse', 'true'], caret: ['Choose values', 'dialog'] });
});
