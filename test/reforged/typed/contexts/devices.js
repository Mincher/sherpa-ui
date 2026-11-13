/** A page's module reads another type's rows through the same stores its page reads (plan 960 U3). */
export async function init(root, ctx) {
  window.__typed = { stores: Object.keys(ctx.stores).sort(), teammates: await ctx.stores.teammate?.totalCount() };
}
