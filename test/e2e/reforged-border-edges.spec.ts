import { test, expect } from './harness';

/**
 * Every bordered site keeps a resolved per-edge width.
 *
 * The four Figma Border weights were written out 26 times across 20 stylesheets;
 * `.sherpa-border-edges` in sherpa-base.css now owns 19 of them and 7 stay
 * inline (a bare `:host`, a host-attribute-gated rule, a bare tag in a cloned
 * prototype — none can wear a class).
 *
 * THIS TEST EXISTS BECAUSE THE FIRST ATTEMPT BROKE EIGHT OF THEM SILENTLY:
 * the declarations were removed from all 26 rules and the class added to only
 * 18 elements. Nothing failed — not lint:css, not spec:check, not the 550-test
 * suite — because no test measured a border. A component simply lost its edge.
 */
const CASES: [string, string, Record<string, string>][] = [
  ['sherpa-accordion', ':host', {}],
  ['sherpa-container', ':host', {}],
  ['sherpa-data-grid', ':host', {}],
  ['sherpa-dialog', '.root', {}],
  ['sherpa-grid-cell', '.cell', {}],
  ['sherpa-input-text', '.control-row', {}],
  ['sherpa-list', '.body', {}],
  ['sherpa-menu', '.menu', {}],
  ['sherpa-nav-item', '.promo', { 'data-type': 'promo' }],
  ['sherpa-nav', '.hdr-btn', {}],
  // A COLLAPSED rail reduces the search to a bare glyph — border, padding and
  // input all go (see sherpa-nav.css). `data-nav-state` opens it.
  ['sherpa-nav', '.search', { 'data-searchable': '', 'data-nav-state': 'pinned' }],
  ['sherpa-overlay-panel', '.root', {}],
  ['sherpa-pagination', '.page-input', {}],
  ['sherpa-quick-filter', '.count', { 'data-count': '3' }],
  ['sherpa-slider', '.value-input', {}],
  ['sherpa-switch', '.track', {}],
  ['sherpa-tag', '.pill', {}],
  ['sherpa-toast', '.toast', {}],
];

test('every bordered site still resolves a width', async ({ page }) => {
  const rows = await page.evaluate(async (cases) => {
    const out: string[] = [];
    for (const [tag, sel, attrs] of cases) {
      const el = document.createElement(tag) as HTMLElement & { rendered?: Promise<void> };
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      const t = sel === ':host' ? el : el.shadowRoot!.querySelector(sel);
      if (!t) { out.push(`${tag} ${sel} :: NO ELEMENT`); continue; }
      const cs = getComputedStyle(t);
      out.push(`${tag} ${sel} :: ${cs.borderTopWidth}/${cs.borderRightWidth}/${cs.borderBottomWidth}/${cs.borderLeftWidth} ${cs.borderTopStyle}`);
    }
    return out;
  }, CASES);
  for (const r of rows) console.log(`  ${r}`);
  // EVERY site resolves to the token's own 1px on all four edges, solid.
  //
  // Asserted as an exact value, not merely "not zero": removing the class from
  // sherpa-tag left `.pill` at 3px — the browser's `medium` default for a
  // `border-style` with no width — which a not-zero check waves through. The
  // regression is a WRONG width just as much as a missing one.
  const bad = rows.filter((r) => !r.endsWith(':: 1px/1px/1px/1px solid'));
  expect(bad).toEqual([]);
});
