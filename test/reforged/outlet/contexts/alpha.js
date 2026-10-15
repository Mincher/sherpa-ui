/** The outlet test's one module: it says what it was handed, and when it goes. */
export function init(root, ctx) {
  window.__alpha = { root: root.id, keys: Object.keys(ctx).sort(), label: ctx.label, id: ctx.id, header: !!ctx.header, gone: false };
  ctx.signal.addEventListener('abort', () => { window.__alpha.aborted = true; });
  return () => { window.__alpha.gone = true; };
}
