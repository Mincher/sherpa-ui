/** A page with data: it says its source, for the test to ask and read. */
export function init(root, ctx) {
  window.__page = { id: ctx.id, source: ctx.source };
}
