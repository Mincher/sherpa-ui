/**
 * The saved VIEWS the dashboard offers — plain JSON, the same shape as
 * `records-views.js`, so a link, a stored view and another service all say it
 * once. TRAP T-a-view-is-json
 *
 * A view is its QUERY. The header's chips are the View scope, so a Region a
 * view sets is ON its chip — a filter nobody can see is a filter nobody can
 * undo. This page's own axes — severity, storage — have no chip, so they sit
 * in a `page` scope that no bar answers, and no bar's report can clear them.
 *
 * Map:
 * - DASHBOARD_VIEWS — the dashboard's saved views, keyed by the id its View chip carries
 */

/** @type {import('../../dist/index.js').ViewLibrary} */
export const DASHBOARD_VIEWS = {
  fleet: {
    label: 'Fleet overview',
    // The BASELINE: every answer clear, nothing arranged.
    query: { v: 1, scopes: { view: { sort: [], group: null, search: '' } } },
  },

  critical: {
    label: 'Critical only',
    query: {
      v: 1,
      scopes: {
        page: { readings: { severity: { picked: ['critical'] } } },
        view: { sort: [], group: null, search: '' },
      },
    },
  },

  emea: {
    label: 'EMEA operations',
    // ON the Region chip, as the reader would pick it. TRAP T-a-chip-filters-the-values-the-data-has.
    query: {
      v: 1,
      scopes: { view: { readings: { region: { picked: ['EMEA'] } }, sort: [], group: null, search: '' } },
    },
  },

  capacity: {
    label: 'Capacity planning',
    /* The one view that is not the same eight charts over fewer rows: planning
       capacity names the devices that are nearly full, so it wants a table and
       a distribution. */
    /* `content` is the view's own MARKUP until the Templater (68) builds a view
       from JSON — parsed through the allow-list in core/view-markup.ts on the
       way in. Its ids are what this page binds. */
    content: `
      <div class="sherpa-grid">
        <!-- A histogram, not a donut: storage is continuous. -->
        <sherpa-container data-col-span="full" data-row-span="4">
          <sherpa-container-header slot="header"
            data-heading="Storage used, by band"></sherpa-container-header>
          <sherpa-barchart id="hist"
            data-label="Devices per storage band"></sherpa-barchart>
        </sherpa-container>

        <sherpa-container data-col-span="full" data-row-span="6">
          <sherpa-container-header slot="header"
            data-heading="Fullest devices"></sherpa-container-header>
          <sherpa-data-grid id="fullest"></sherpa-data-grid>
        </sherpa-container>
      </div>
    `,
    query: {
      v: 1,
      scopes: {
        page: { readings: { storage: { op: 'gt', text: '70' } } },
        view: { sort: [{ field: 'storage', direction: 'desc' }], group: null, search: '' },
      },
    },
  },
};
