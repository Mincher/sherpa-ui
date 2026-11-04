/**
 * walked.js — what a load's walk counted, said under the load on the one trace
 * stream, as the Node Editor says it while bound (`watchQuery`). One function
 * for both hosts that hear an act: the MCP in Node, and the preview's page,
 * which is served this file. It imports nothing.
 *
 * Map:
 * - walked — each scope, condition and preset a load's walk counted, and the rows it arranged, as steps under the load
 */

/** Each scope, condition and preset a load's walk counted, and the rows it
 *  arranged: `traceQuerySteps` over the source's own results, under the load. */
export async function walked({ traceQuerySteps }, source, load) {
  const applied = source.query.applied;
  const counted = await Promise.all(Object.keys(applied.scopes).map(async (scope) => [scope, await source.results(scope)]));
  const total = load.detail?.total;
  traceQuerySteps(applied, { walk: { results: Object.fromEntries(counted) }, ...(typeof total === 'number' ? { total } : {}) }, load);
}
