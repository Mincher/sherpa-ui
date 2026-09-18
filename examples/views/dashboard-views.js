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
    /* THE ONE THAT LOOKS DIFFERENT.
       Every other view here is the same eight charts over fewer rows. This one
       is not a summary at all: planning capacity means naming the devices that
       are nearly full, so it wants a TABLE and a distribution, and none of the
       donut, gauge or line series say anything useful about it.

       `content` is the view's own MARKUP — the same HTML an authored template
       holds — so the components, their nesting and their spans sit beside the
       query that fills them. `snapshot.elements` then configures them through
       their own APIs, addressing the ids in the markup. */
    /* MARKUP, not an object. Every authored screen in examples/templates is
       HTML dropped into the app shell, and a saved view is the same thing a
       USER made instead of an author — so it is the same format. This used to
       be a 40-line ViewDefinition describing the twelve lines below.

       Parsed through the allow-list in core/view-markup.ts on the way in, and
       the ids are what `snapshot.elements` addresses. */
    content: `
      <div class="sherpa-grid">
        <!-- A HISTOGRAM, not a donut: storage is a continuous quantity, and
             slicing a continuum into wedges says the bands are categories. -->
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

