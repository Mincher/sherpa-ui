/**
 * The saved VIEWS the records page offers — each one a real definition.
 *
 * A view is not a label. It is a `ViewSnapshot`: the query the page should run,
 * and the state every component in it should be in. The same object a user's
 * own saved view produces, a shared link carries, and an agent sends over MCP —
 * which is the whole point of having one shape.
 *
 * Picking one in the header's View chip calls `applyViewSnapshot`, and the
 * screen reconfigures: filter, sort, page and the grid's own column filters.
 *
 * WHY THIS FILE EXISTS separately: these are the PRESETS, shipped with the app.
 * A user's saved views are the same shape but come from storage, and a link's
 * come from a URL. Keeping the presets as plain data makes that obvious — there
 * is no code path here that a saved view would not also take.
 */

/** @type {Record<string, { label: string, snapshot: import('../../dist/index.js').ViewSnapshot }>} */
export const RECORDS_VIEWS = {
  all: {
    label: 'All customers',
    // The BASELINE. Every field is stated rather than omitted, because applying
    // a view is a MERGE — a view that says nothing about the sort would leave
    // the previous view's sort in place, and the reader would see a state
    // nobody defined.
    snapshot: {
      v: 1,
      source: { filter: undefined, sort: [], group: null, search: '', page: 1 },
      elements: { grid: { clearColumnFilter: [undefined], select: [[]] } },
    },
  },

  mine: {
    label: 'My accounts',
    // A real app reads the signed-in user; the demo picks one owner so the view
    // does something visible.
    snapshot: {
      v: 1,
      source: {
        filter: ['owner', 'eq', 'Priya Raman'],
        sort: [{ field: 'lastSeen', direction: 'desc' }],
        group: null, search: '', page: 1,
      },
      elements: { grid: { clearColumnFilter: [undefined], select: [[]] } },
    },
  },

  risk: {
    label: 'At risk',
    // Two clauses ANDed, and a column filter on top — the case that proves a
    // view definition reaches BOTH the query and the components.
    snapshot: {
      v: 1,
      source: {
        filter: ['and', ['health', 'lt', 60], ['openTickets', 'gt', 2]],
        sort: [{ field: 'health', direction: 'asc' }],
        group: null, search: '', page: 1,
      },
      elements: {
        grid: {
          clearColumnFilter: [undefined],
          setColumnFilter: ['status', ['status', 'ne', 'churned']],
          select: [[]],
        },
      },
    },
  },

  renewals: {
    label: 'Renewals this quarter',
    // GROUPED, which nothing else here exercises — a view can set how the rows
    // are arranged as well as which ones there are.
    snapshot: {
      v: 1,
      source: {
        filter: ['created', 'between', ['2024-07-01', '2024-09-30']],
        sort: [{ field: 'spend', direction: 'desc' }],
        group: 'tier', search: '', page: 1,
      },
      elements: { grid: { clearColumnFilter: [undefined], select: [[]] } },
    },
  },
};
