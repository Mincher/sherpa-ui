/** The outlet test's Settings module: it says it ran, and when it goes. */
export function init(root, ctx) {
  window.__prefs = { root: root.id, label: ctx.label, id: ctx.id, gone: false };
  return () => { window.__prefs.gone = true; };
}
