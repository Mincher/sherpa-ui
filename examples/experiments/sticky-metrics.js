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

const CSS = `
[data-sticky-metrics] { position: sticky; inset-block-start: 0; z-index: 3; block-size: 0; }
[data-sticky-metrics] > .row { display: none; position: absolute; inset-inline: 0; inset-block-start: 0; }
[data-metrics-stuck] [data-sticky-metrics] > .row { display: flex; }
[data-metrics-stuck] sherpa-metric[data-stuck] { visibility: hidden; }
[data-sticky-metrics] sherpa-metric { flex: 1 1 0; min-inline-size: 0; border-radius: 0; }
[data-sticky-metrics] sherpa-metric::part(value) { font-size: var(--sherpa-theme-content-size-small, 12px); }
[data-sticky-metrics] sherpa-metric::part(spark) { display: none; }
`;

let sheet;

/**
 * Start the experiment on one Context's root. The first row is the metrics
 * with the smallest top; the content area's top is the sticky anchor's own.
 */
export function stickyMetrics(root) {
  const metrics = [...root.querySelectorAll('sherpa-metric')];
  if (!metrics.length || typeof IntersectionObserver !== 'function') return () => {};
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
  const firstRow = () => {
    const least = Math.min(...metrics.map(top));
    return metrics.filter((m) => top(m) - least < 1);
  };
  /** Copy each tile's words onto its compact copy. */
  const copy = (from, to) => {
    for (const name of SHOWN) {
      const v = from.getAttribute(name);
      if (v == null) to.removeAttribute(name);
      else to.setAttribute(name, v);
    }
  };
  const copies = new Map();
  const watch = new MutationObserver((records) => {
    for (const { target } of records) if (copies.has(target)) copy(target, copies.get(target));
  });

  const stick = (on) => {
    if (on === root.hasAttribute('data-metrics-stuck')) return;
    if (on) {
      const first = firstRow();
      row.replaceChildren(...first.map((m) => {
        const c = document.createElement('sherpa-metric');
        copy(m, c);
        copies.set(m, c);
        m.dataset.stuck = '';
        watch.observe(m, { attributes: true, attributeFilter: SHOWN });
        return c;
      }));
    } else {
      watch.disconnect();
      copies.clear();
      row.replaceChildren();
      for (const m of metrics) delete m.dataset.stuck;
    }
    root.toggleAttribute('data-metrics-stuck', on);
  };

  // Past the top: any first-row tile above the anchor. Back: all of them below it.
  const check = () => stick(firstRow().some((m) => top(m) < top(anchor) - 0.5));
  const seen = new IntersectionObserver(check, { threshold: [0, 1] });
  for (const m of metrics) seen.observe(m);

  return () => {
    seen.disconnect();
    stick(false);
    anchor.remove();
  };
}
