/**
 * The saved VIEWS the dashboard offers. Same `ViewSnapshot` shape as
 * `records-views.js`, so a link, a stored view and an MCP call all say it once.
 *
 * Each view sets BOTH `source.filter` (what the charts summarise) and the
 * header's chips (what the reader sees) — a filter nobody can see is a filter
 * nobody can undo.
 */

/** @type {Record<string, { label: string, snapshot: import('../../dist/index.js').ViewSnapshot }>} */
export const DASHBOARD_VIEWS = {
  fleet: {
    label: 'Fleet overview',
    // The BASELINE. Applying a view is a merge, so every field is stated — a
    // view silent about the filter keeps the last view's one.
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
      // No chip for severity: it is this page's own axis, not a slice of the
      // business.
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
      // Chip and filter are one fact said twice — held together so the case
      // cannot drift. `view` stays lowercase: it is a key into this object, not
      // a record value. TRAP T-a-chip-filters-the-values-the-data-has.
      elements: { header: { values: { view: ['emea'], region: ['EMEA'] } } },
    },
  },

  capacity: {
    label: 'Capacity planning',
    /* The one view that is not the same eight charts over fewer rows: planning
       capacity names the devices that are nearly full, so it wants a table and
       a distribution. */
    /* `content` is the view's own MARKUP — the same HTML an authored template
       holds, parsed through the allow-list in core/view-markup.ts on the way
       in. Its ids are what `snapshot.elements` addresses. */
    content: `
      <div class="sherpa-grid">
        <!-- A histogram, not a donut: storage is continuous. -->
        <sherpa-container data-span="12" data-rows="5">
          <sherpa-container-header slot="header"
            data-heading="Storage used, by band"></sherpa-container-header>
          <sherpa-barchart id="hist"
            data-label="Devices per storage band"></sherpa-barchart>
        </sherpa-container>

        <sherpa-container data-span="12" data-rows="8">
          <sherpa-container-header slot="header"
            data-heading="Fullest devices"></sherpa-container-header>
          <sherpa-data-grid id="fullest"></sherpa-data-grid>
        </sherpa-container>
      </div>
    `,
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

