import { test, expect } from './harness';

/**
 * ONE BINDING LANGUAGE, IN THE MARKUP — plan 695 P6. A host attribute fills the
 * stamped tree by its directives, both ways, from the first render on; an item
 * fills a prototype by the same directives, once. TRAP T-a-template-binds-by-markup
 */
test('a condition follows its host attribute both ways, from the first render', async ({ page }) => {
  const r = await page.evaluate(async () => {
    await import('/dist/index.js');
    const settle = window.__settled;
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
    const canvas = await make('sherpa-layout-canvas', { 'data-no-minimap': '' });
    const row = () => canvas.shadowRoot!.querySelector('.minimap-toggle')!.textContent;

    const before = {
      toggle: [toggle().getAttribute('aria-label'), toggle().getAttribute('aria-expanded')],
      row: row(),
    };
    header.toggleAttribute('data-collapsed', true);
    canvas.removeAttribute('data-no-minimap');
    await settle();
    const on = {
      toggle: [toggle().getAttribute('aria-label'), toggle().getAttribute('aria-expanded')],
      row: row(),
    };
    header.removeAttribute('data-collapsed');
    await settle();
    const off = {
      toggle: [toggle().getAttribute('aria-label'), toggle().getAttribute('aria-expanded')],
    };
    return { before, on, off };
  });
  // A canvas born with no minimap says Show from its first render.
  expect(r.before).toEqual({ toggle: ['Collapse', 'true'], row: 'Show minimap' });
  expect(r.on).toEqual({ toggle: ['Expand', 'false'], row: 'Hide minimap' });
  expect(r.off).toEqual({ toggle: ['Collapse', 'true'] });
});

test('a value follows its host attribute: text, an attribute and a glyph, and the template’s own comes back', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settle = window.__settled;
    const list = await window.__mount<HTMLElement>('sherpa-transfer-list', undefined, { 'data-source-heading': 'Pool' });
    const heading = () => list.shadowRoot!.querySelector('.source .pane-heading')!.textContent;
    const node = await window.__mount<HTMLElement>('sherpa-node', undefined, { 'data-heading': 'Load' });
    const inner = () => node.shadowRoot!.querySelector('.heading')!.getAttribute('data-heading');
    const tag = await window.__mount<HTMLElement>('sherpa-tag', undefined, { 'data-icon': 'star' });
    const glyph = () => tag.shadowRoot!.querySelector('.glyph')!.querySelector('svg') !== null;

    const set = { heading: heading(), inner: inner(), glyph: glyph() };
    list.removeAttribute('data-source-heading');
    node.removeAttribute('data-heading');
    tag.removeAttribute('data-icon');
    await settle();
    const gone = { heading: heading(), inner: inner(), glyph: glyph() };
    list.setAttribute('data-source-heading', 'Again');
    await settle();
    return { set, gone, again: heading() };
  });
  expect(r.set).toEqual({ heading: 'Pool', inner: 'Load', glyph: true });
  // Absent: the template's own — "Available", the node's "Node", no glyph.
  expect(r.gone).toEqual({ heading: 'Available', inner: 'Node', glyph: false });
  expect(r.again).toBe('Again');
});

test('an item fills its prototype by the same directives, once, and drops them', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const list = await window.__mount<HTMLElement & { populate(d: unknown): Promise<void> }>('sherpa-list');
    await list.populate([{ title: 'One', active: true }, { title: 'Two', interactive: false }]);
    await window.__settled();
    return [...list.shadowRoot!.querySelectorAll('sherpa-list-item')].map((row) => ({
      label: row.getAttribute('data-label'),
      current: row.hasAttribute('data-current'),
      interactive: row.hasAttribute('data-interactive'),
      left: [...row.attributes].map((a) => a.name).filter((n) => /^data-(?:text|attr-|when-)/.test(n)),
    }));
  });
  expect(r).toEqual([
    { label: 'One', current: true, interactive: true, left: [] },
    { label: 'Two', current: false, interactive: false, left: [] },
  ]);
});
