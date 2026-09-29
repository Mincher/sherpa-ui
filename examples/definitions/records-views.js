/**
 * The saved views the records page ships with — plain JSON, as a saved view,
 * a shared link or another service sends it.
 *
 * A view is its QUERY: what each scope holds, each field's default answer, the
 * saved filters that are on, and how the rows are arranged. Picking one puts
 * it onto a clean slate, and its defaults SHOW on the chips — a filter no chip
 * shows is a filter nobody can undo. Will, 2026-09-27. TRAP T-a-view-is-json
 *
 * Map:
 * - RECORDS_VIEWS — the Records Context's saved views — All, Mine, At risk, Renewals
 */

/** @type {import('../../dist/index.js').ViewLibrary} */
export const RECORDS_VIEWS = {
  all: {
    label: 'All customers',
    query: { v: 1, scopes: { data: { sort: [], group: null, search: '' } } },
    ui: { grid: { select: [[]] } },
  },

  mine: {
    label: 'My accounts',
    /* A real app reads the signed-in user; the demo picks one owner. It must BE
       an owner the records carry. TRAP T-a-chip-filters-the-values-the-data-has */
    query: {
      v: 1,
      scopes: {
        data: {
          readings: { owner: { picked: ['Ravi Menon'] } },
          sort: [{ field: 'lastSeen', direction: 'desc' }], group: null, search: '',
        },
      },
    },
    ui: { grid: { select: [[]] } },
  },

  risk: {
    label: 'At risk',
    // A saved filter ON, and two answers of the view's own — each on its chip.
    query: {
      v: 1,
      scopes: {
        data: {
          presets: { 'at-risk': true },
          readings: {
            openTickets: { op: 'gt', text: '2' },
            status: { op: 'ne', picked: ['churned'] },
          },
          sort: [{ field: 'health', direction: 'asc' }], group: null, search: '',
        },
      },
    },
    ui: { grid: { select: [[]] } },
  },

  renewals: {
    label: 'Renewals this quarter',
    // The record's TIME, on the header's Date chip — and the only grouped view.
    query: {
      v: 1,
      scopes: {
        view: { readings: { created: { picked: ['2024-07-01', '2024-09-30'], range: true } } },
        data: { sort: [{ field: 'spend', direction: 'desc' }], group: 'tier', search: '' },
      },
    },
    ui: { grid: { select: [[]] } },
  },
};
