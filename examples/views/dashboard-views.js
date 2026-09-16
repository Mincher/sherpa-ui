/**
 * The saved VIEWS the dashboard offers — each one a real definition.
 *
 * Identical in shape to `records-views.js`, deliberately. Two pages with two
 * shapes for "a saved view" would be two things to learn, two things to
 * serialise, and two things for an agent to get wrong. A view is a
 * `ViewSnapshot` everywhere: the query to run, and the state every component
 * should be in.
 *
 * The dashboard used to carry its own `{ label, filter, chips }` object and a
 * hand-written apply step. It said the same things this does, in a vocabulary
 * only this page knew — so a link, a stored view and an MCP call could not have
 * expressed one.
 *
 * FILTERING IS THE POINT. Each view sets BOTH `source.filter` (what the charts
 * summarise) and the header's chips (what the reader sees). A view that moved
 * only the data left the bar claiming nothing was filtered while eight charts
 * disagreed — and a filter nobody can see is a filter nobody can undo.
 */

/** @type {Record<string, { label: string, snapshot: import('../../dist/index.js').ViewSnapshot }>} */
export const DASHBOARD_VIEWS = {
  fleet: {
    label: 'Fleet overview',
    // The BASELINE. Every field is STATED, never omitted: applying a view is a
    // merge, so a view silent about the filter would keep the last view's one
    // and show the reader a state nobody defined.
    snapshot: {
      v: 1,
      source: { filter: undefined, sort: [], group: null, search: '', page: 1 },
      elements: { header: { values: { view: ['fleet'] } } },
    },
  },

  critical: {
    label: 'Critical only',
    snapshot: {
      v: 1,
      source: {
        filter: ['severity', 'eq', 'critical'],
        sort: [], group: null, search: '', page: 1,
      },
      // NO header chip names severity — it is this page's own axis, not a slice
      // of the business — so the bar says only which view is on, which is true.
      elements: { header: { values: { view: ['critical'] } } },
    },
  },

  emea: {
    label: 'EMEA operations',
    snapshot: {
      v: 1,
      source: {
        filter: ['region', 'eq', 'EMEA'],
        sort: [], group: null, search: '', page: 1,
      },
      // The chip and the filter are ONE FACT said twice — once to the data,
      // once to the reader. Held together here so they cannot drift.
      elements: { header: { values: { view: ['emea'], region: ['emea'] } } },
    },
  },

  capacity: {
    label: 'Capacity planning',
    snapshot: {
      v: 1,
      source: {
        filter: ['storage', 'gt', 70],
        sort: [{ field: 'storage', direction: 'desc' }],
        group: null, search: '', page: 1,
      },
      elements: { header: { values: { view: ['capacity'] } } },
    },
  },
};

/** The View chip's options, derived so the labels cannot drift from the views. */
export const DASHBOARD_VIEW_OPTIONS = Object.entries(DASHBOARD_VIEWS).map(
  ([value, { label }], i) => (i === 0 ? { value, label, selected: true } : { value, label }),
);
