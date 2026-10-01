/**
 * sticky-metrics.js — EXPERIMENT (TODO 143): scrolled-past metrics become a small sticky header.
 * Settings › Experiments switches it; deleting this file and its call sites
 * removes it whole.
 *
 * Map:
 * - stickyMetrics — start it on a Context's root; returns the stop
 */

/** What a compact copy shows: the tile's words, never its data request. */
const SHOWN = ['data-label', 'data-icon', 'data-value', 'data-delta', 'data-trend', 'data-status'];

/* CSS DECIDES WHEN (TODO 175): the anchor is a scroll-state container, sticky
   at minus the first row's bottom — grid padding plus one row — so it is
   STUCK once that row has scrolled fully under the top. Chromium only: where
   scroll-state queries are missing the row never shows. */
const CSS = `
[data-sticky-metrics] {
  --_under: calc(var(--sherpa-layout-grid-padding, 16px) + var(--sherpa-layout-grid-row-height, 88px));
  container-type: scroll-state;
  position: sticky;
  inset-block-start: calc(-1 * var(--_under));
  z-index: 3;
  block-size: 0;
}
[data-sticky-metrics] > .row {
  display: none;
  position: absolute;
  inset-inline: 0;
  inset-block-start: var(--_under);
}
@container scroll-state(stuck: top) {
  [data-sticky-metrics] > .row { display: flex; }
}
/* Smaller, through the tokens the tile is drawn with: a 14px value, 2px gaps. */
[data-sticky-metrics] sherpa-metric {
  flex: 1 1 0;
  min-inline-size: 0;
  border-radius: 0;
  --sherpa-theme-content-size-h1: var(--sherpa-theme-content-size-base, 14px);
  --sherpa-theme-content-line-height-h1: var(--sherpa-theme-content-line-height-base, 20px);
  --sherpa-structure-space-gap: var(--sherpa-display-mode-space-3xs, 2px);
  --sherpa-display-mode-space-2xs: var(--sherpa-display-mode-space-3xs, 2px);
}
`;

let sheet;

/** Start the experiment on one Context's root: a copy of each first-row metric. */
export function stickyMetrics(root) {
  const metrics = [...root.querySelectorAll('sherpa-metric')];
  if (!metrics.length) return () => {};
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
  }
  if (!document.adoptedStyleSheets.includes(sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  const anchor = document.createElement('div');
  anchor.dataset.stickyMetrics = '';
  const row = document.createElement('div');
  row.className = 'row';
  anchor.append(row);
  // A copy shows what it is TOLD: its request stops here, so no provider binds it.
  anchor.addEventListener('context-request', (e) => e.stopPropagation());
  root.prepend(anchor);

  const top = (el) => el.getBoundingClientRect().top;
  const least = Math.min(...metrics.map(top));
  const first = metrics.filter((m) => top(m) - least < 1);

  /** The tile's series, then its words — the series would otherwise re-derive them. */
  const refresh = (from, to) => {
    const words = () => {
      for (const name of SHOWN) {
        const v = from.getAttribute(name);
        if (v == null) to.removeAttribute(name);
        else to.setAttribute(name, v);
      }
    };
    words();
    if (from.series?.length) void to.populate({ values: [...from.series] }).then(words);
  };
  const copies = new Map(first.map((m) => [m, document.createElement('sherpa-metric')]));
  row.replaceChildren(...copies.values());
  for (const [m, c] of copies) refresh(m, c);
  const watch = new MutationObserver((records) => {
    for (const target of new Set(records.map((r) => r.target))) refresh(target, copies.get(target));
  });
  // A new series comes with a new value, or with the sparkline's first draw.
  for (const m of first) watch.observe(m, { attributes: true, attributeFilter: [...SHOWN, 'data-has-values'] });

  return () => {
    watch.disconnect();
    anchor.remove();
  };
}
