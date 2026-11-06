/** The graph Views test's module: it says the graph it was handed, and each one it is told of — and, on a
 *  `query` View, the page it shows. */
export function init(root, ctx) {
  window.__graphs = { start: ctx.graph ?? null, told: [], page: ctx.page ?? null, pages: [] };
  root.addEventListener('graph-change', (e) => {
    window.__graphs.told.push(e.detail.graph?.id ?? null);
    window.__graphs.page = e.detail.page ?? null;
    window.__graphs.pages.push(e.detail.page?.id ?? null);
  }, { signal: ctx.signal });
}
