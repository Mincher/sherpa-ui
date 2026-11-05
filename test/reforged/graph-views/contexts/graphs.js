/** The graph Views test's module: it says the graph it was handed, and each one it is told of. */
export function init(root, ctx) {
  window.__graphs = { start: ctx.graph ?? null, told: [] };
  root.addEventListener('graph-change', (e) => window.__graphs.told.push(e.detail.graph?.id ?? null), { signal: ctx.signal });
}
