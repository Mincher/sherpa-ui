/**
 * The saved views the records page ships with — plain `ViewSnapshot` data.
 *
 * A user's saved view and a shared link produce the same shape, so these
 * presets take no code path a saved view would not also take. Picking one in
 * the header's View chip calls `applyViewSnapshot`.
 */

/** @type {Record<string, { label: string, snapshot: import('../../dist/index.js').ViewSnapshot }>} */
export const RECORDS_VIEWS = {
  all: {
    label: 'All customers',
    // Applying a view MERGES, so every field is stated — an omitted sort would
    // leave the previous view's sort in place.
    snapshot: {
      v: 1,
      source: { filter: undefined, sort: [], group: null, search: '', page: 1 },
      elements: { grid: { clearColumnFilter: [undefined], select: [[]] } },
    },
  },

  mine: {
    label: 'My accounts',
    /* A real app reads the signed-in user; the demo picks one owner. It must BE
       an owner the records carry — this named 'Priya Raman', a customer first
       name that is in no `owner` field, so the view matched zero rows and every
       filter applied on top of it read as broken.
       TRAP T-a-chip-filters-the-values-the-data-has */
    snapshot: {
      v: 1,
      source: {
        filter: ['owner', 'eq', 'Ravi Menon'],
        sort: [{ field: 'lastSeen', direction: 'desc' }],
        group: null, search: '', page: 1,
      },
      elements: { grid: { clearColumnFilter: [undefined], select: [[]] } },
    },
  },

  risk: {
    label: 'At risk',
    // Two ANDed clauses plus a column filter — a view reaches both the query
    // and the components.
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
    // The only grouped view — a view sets arrangement as well as membership.
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
