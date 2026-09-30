/**
 * fixtures.mjs — one realistic instance of every component, for the accessibility gate.
 *
 * Each is how a page WRITES it: a label where the component takes one, real
 * words, its data through `populate()`. TRAP T-the-a11y-gate-reads-shadow-roots
 *
 * Map:
 * - FIXTURES — component → `{ html, fill?, show? }`: its markup, the data each part is populated with, and the part to open
 */

const ROWS = [
  { id: 'a', name: 'Ada Lovelace', plan: 'Pro', seats: 12 },
  { id: 'b', name: 'Grace Hopper', plan: 'Free', seats: 3 },
  { id: 'c', name: 'Alan Turing', plan: 'Team', seats: 8 },
];
const SLICES = [
  { label: 'Pro', value: 12, colorIndex: 1 },
  { label: 'Team', value: 8, colorIndex: 2 },
  { label: 'Free', value: 3, colorIndex: 3 },
];
const OPTIONS = [
  { value: 'emea', label: 'EMEA' },
  { value: 'apac', label: 'APAC' },
  { value: 'amer', label: 'Americas' },
];

export const FIXTURES = {
  'sherpa-accordion': { html: '<sherpa-accordion data-heading="Details"><p>More about this record.</p></sherpa-accordion>' },
  'sherpa-app-header': {
    html: '<sherpa-app-header data-heading="Records" data-icon="table-columns" data-ai data-theme-toggle data-notifications data-account data-help></sherpa-app-header>',
    fill: [{ at: 'sherpa-app-header', data: { breadcrumb: [{ label: 'Home', href: '?context=home' }, { label: 'Records' }] } }],
  },
  'sherpa-app-shell': {
    html: '<div style="block-size: 480px"><sherpa-app-shell><sherpa-nav slot="nav" data-current-id="home"></sherpa-nav>'
      + '<sherpa-app-header slot="header" data-heading="Home"></sherpa-app-header><p>The page.</p></sherpa-app-shell></div>',
    fill: [{ at: 'sherpa-nav', data: { product: { name: 'Sherpa' }, sections: [{ label: 'Main', items: [{ id: 'home', label: 'Home', icon: 'home', href: '?context=home' }] }] } }],
  },
  'sherpa-badge': { html: '<sherpa-badge aria-label="3 unread">3</sherpa-badge>' },
  'sherpa-barchart': {
    html: '<sherpa-container><sherpa-data-viz-header slot="header" data-heading="Customers by plan"></sherpa-data-viz-header><sherpa-barchart></sherpa-barchart></sherpa-container>',
    fill: [{ at: 'sherpa-barchart', data: SLICES }],
  },
  'sherpa-breadcrumbs': {
    html: '<sherpa-breadcrumbs></sherpa-breadcrumbs>',
    fill: [{ at: 'sherpa-breadcrumbs', data: [{ label: 'Records', href: '?context=records' }, { label: 'Ada Lovelace' }] }],
  },
  'sherpa-button': {
    html: '<sherpa-button>Save</sherpa-button> <sherpa-button data-look="saturated" data-icon-start="plus">Add customer</sherpa-button> '
      + '<sherpa-button data-type="icon" data-icon-start="cross" aria-label="Close"></sherpa-button> <sherpa-button disabled>Delete</sherpa-button>',
  },
  'sherpa-calendar': { html: '<sherpa-calendar data-value="2026-08-13"></sherpa-calendar>' },
  'sherpa-calendar-cell': { html: '<div role="grid" aria-label="August 2026"><div role="row"><sherpa-calendar-cell role="gridcell" data-label="15" data-value="2026-08-15"></sherpa-calendar-cell></div></div>' },
  'sherpa-callout': { html: '<sherpa-callout data-status="warning" data-heading="Heads up">Your trial ends in 3 days.</sherpa-callout>' },
  'sherpa-chart-legend': {
    html: '<sherpa-chart-legend data-orientation="horizontal"></sherpa-chart-legend>',
    fill: [{ at: 'sherpa-chart-legend', data: SLICES }],
  },
  'sherpa-chat-message': {
    html: '<sherpa-chat-message data-type="assistant" data-name="Sherpa" data-timestamp="10:30" data-message="The answer is 42."></sherpa-chat-message>'
      + '<sherpa-chat-message data-type="person" data-name="You" data-timestamp="10:31" data-message="Thanks."></sherpa-chat-message>',
  },
  'sherpa-chip': { html: '<sherpa-chip>EMEA</sherpa-chip> <sherpa-chip data-status="success" data-dismissible>Active</sherpa-chip>' },
  'sherpa-code-block': { html: '<sherpa-code-block data-language="javascript" data-line-numbers data-code="const answer = 42;"></sherpa-code-block>' },
  'sherpa-container': {
    html: '<sherpa-container><sherpa-container-header slot="header" data-heading="Overview"></sherpa-container-header><p>Card body.</p>'
      + '<sherpa-container-footer slot="footer"><sherpa-button>Cancel</sherpa-button><sherpa-button data-look="saturated">Save</sherpa-button></sherpa-container-footer></sherpa-container>',
  },
  'sherpa-container-footer': { html: '<sherpa-container-footer><sherpa-button>Cancel</sherpa-button><sherpa-button data-look="saturated">Save</sherpa-button></sherpa-container-footer>' },
  'sherpa-container-header': { html: '<sherpa-container-header data-heading="Overview" data-description="This quarter" data-collapsible data-dismissible></sherpa-container-header>' },
  'sherpa-data-grid': {
    html: '<div style="block-size: 320px"><sherpa-data-grid data-selectable data-column-filters data-filterable></sherpa-data-grid></div>',
    fill: [{
      at: 'sherpa-data-grid',
      data: {
        key: 'id',
        columns: [
          { field: 'name', header: 'Name', sortable: true },
          { field: 'plan', header: 'Plan', sortable: true },
          { field: 'seats', header: 'Seats', type: 'number', sortable: true },
        ],
        rows: ROWS,
        actions: [{ id: 'edit', label: 'Edit', icon: 'pencil' }, { id: 'delete', label: 'Delete', icon: 'trash', danger: true, multi: true }],
      },
    }],
  },
  'sherpa-data-viz-header': { html: '<sherpa-data-viz-header data-heading="Alerts by category" data-description="Last 30 days"></sherpa-data-viz-header>' },
  'sherpa-dialog': {
    html: '<sherpa-dialog data-heading="Delete customer?"><p>Ada Lovelace will be permanently deleted.</p>'
      + '<sherpa-container-footer slot="footer"><sherpa-button>Cancel</sherpa-button><sherpa-button data-look="saturated" data-status="critical">Delete</sherpa-button></sherpa-container-footer></sherpa-dialog>',
    show: 'sherpa-dialog',
  },
  'sherpa-empty-state': { html: '<sherpa-empty-state data-heading="No results" data-description="Try a different search."><sherpa-button>Clear filters</sherpa-button></sherpa-empty-state>' },
  'sherpa-file-upload': { html: '<sherpa-file-upload data-label="Attach a contract" data-helper="PDF only" data-accept="application/pdf" data-max-size="5MB"></sherpa-file-upload>' },
  'sherpa-filter-panel': {
    html: '<div style="block-size: 480px"><sherpa-filter-panel data-heading="Filters" open></sherpa-filter-panel></div>',
    fill: [{
      at: 'sherpa-filter-panel',
      data: [{
        scope: 'data', label: 'Customer records',
        filters: [{ id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }] }],
        available: [{ id: 'region', label: 'Region' }],
      }],
    }],
  },
  'sherpa-gauge-chart': {
    html: '<sherpa-gauge-chart data-label="Mean risk" data-unit="%" data-caption="of 100"></sherpa-gauge-chart>',
    fill: [{ at: 'sherpa-gauge-chart', data: 42 }],
  },
  'sherpa-grid-cell': {
    html: '<table><thead><tr><th scope="col"><sherpa-grid-cell data-type="header">Name</sherpa-grid-cell></th></tr></thead>'
      + '<tbody><tr><td><sherpa-grid-cell>Ada Lovelace</sherpa-grid-cell></td></tr></tbody></table>',
  },
  'sherpa-group': { html: '<sherpa-group><sherpa-button>Day</sherpa-button><sherpa-button>Week</sherpa-button><sherpa-button>Month</sherpa-button></sherpa-group>' },
  'sherpa-input-text': {
    html: '<sherpa-input-text data-label="Name" name="name" placeholder="Jane Doe" required></sherpa-input-text>'
      + '<sherpa-input-text data-label="Notes" name="notes" data-multiline data-description="Optional."></sherpa-input-text>'
      + '<sherpa-input-text data-label="Email" name="email" type="email" data-error="Enter an email address."></sherpa-input-text>'
      + '<sherpa-input-text class="pick" data-label="Region" name="region" data-type="select"></sherpa-input-text>',
    fill: [{ at: '.pick', data: OPTIONS }],
  },
  'sherpa-key-value-list': {
    html: '<sherpa-key-value-list data-orientation="vertical"></sherpa-key-value-list>',
    fill: [{ at: 'sherpa-key-value-list', data: [{ key: 'Plan', value: 'Pro' }, { key: 'Seats', value: '12' }] }],
  },
  'sherpa-layout-grid': { html: '<sherpa-layout-grid><div data-col-span="medium">One</div><div data-col-span="medium">Two</div></sherpa-layout-grid>' },
  'sherpa-line-chart': {
    html: '<sherpa-container><sherpa-data-viz-header slot="header" data-heading="Alerts over time"></sherpa-data-viz-header><sherpa-line-chart data-type="area"></sherpa-line-chart></sherpa-container>',
    fill: [{ at: 'sherpa-line-chart', data: { labels: ['Mon', 'Tue', 'Wed', 'Thu'], series: [{ name: 'Critical', values: [3, 5, 2, 6] }, { name: 'Warning', values: [8, 6, 9, 4] }] } }],
  },
  'sherpa-list': {
    html: '<sherpa-list><sherpa-list-item data-label="Increase contrast" data-description="Stronger borders and text.">'
      + '<sherpa-switch slot="trailing" name="contrast" aria-label="Increase contrast"></sherpa-switch></sherpa-list-item>'
      + '<sherpa-list-item data-label="Reduce motion"></sherpa-list-item></sherpa-list>',
  },
  'sherpa-list-item': { html: '<sherpa-list><sherpa-list-item data-label="Project Alpha" data-description="Owned by design"></sherpa-list-item></sherpa-list>' },
  'sherpa-loader': { html: '<sherpa-loader data-size="sm"><span slot="label">Loading customers…</span></sherpa-loader>' },
  'sherpa-menu': {
    html: '<sherpa-button class="opener">Region</sherpa-button><sherpa-menu data-heading="Region" data-select="multiple">'
      + '<label><input type="checkbox" value="emea" /> EMEA</label><label><input type="checkbox" value="apac" checked /> APAC</label></sherpa-menu>',
    show: 'sherpa-menu',
    anchor: '.opener',
  },
  'sherpa-metric': {
    html: '<sherpa-metric data-label="Revenue"></sherpa-metric>',
    fill: [{ at: 'sherpa-metric', data: { name: 'Revenue', value: '$1.2M', deltaPercent: 12.5 } }],
  },
  'sherpa-nav': {
    html: '<div style="block-size: 480px"><sherpa-nav data-current-id="home"></sherpa-nav></div>',
    fill: [{
      at: 'sherpa-nav',
      data: {
        product: { name: 'Sherpa' },
        sections: [
          { label: 'Main', items: [{ id: 'home', label: 'Home', icon: 'home', href: '?context=home' }, { id: 'records', label: 'Records', icon: 'table-columns', href: '?context=records' }] },
          { label: 'Admin', items: [{ id: 'team', label: 'Team', icon: 'person', children: [{ id: 'roles', label: 'Roles', href: '?context=roles' }] }] },
        ],
      },
    }],
  },
  'sherpa-nav-item': { html: '<sherpa-nav-item data-icon="home" data-label="Home" data-href="?context=home" data-badge="3"></sherpa-nav-item>' },
  'sherpa-nav-section': { html: '<sherpa-nav-section data-label="Workspace"><sherpa-nav-item data-icon="home" data-label="Home" data-href="?context=home"></sherpa-nav-item></sherpa-nav-section>' },
  'sherpa-notifications': {
    html: '<sherpa-button class="opener" data-type="icon" data-icon-start="notifications" aria-label="Notifications"></sherpa-button><sherpa-notifications></sherpa-notifications>',
    fill: [{ at: 'sherpa-notifications', data: [{ id: 'a', title: 'Renewed', description: 'Enterprise', time: '2m ago', unread: true }, { id: 'b', title: 'Report ready', time: '2d ago' }] }],
    show: 'sherpa-notifications',
    anchor: '.opener',
  },
  'sherpa-overlay-panel': {
    html: '<sherpa-overlay-panel data-heading="Ada Lovelace" data-icon="person" data-dismissible data-collapsible data-expandable><p>Pro plan, 12 seats.</p>'
      + '<sherpa-button slot="footer">Edit</sherpa-button></sherpa-overlay-panel>',
    show: 'sherpa-overlay-panel',
  },
  'sherpa-pagination': { html: '<sherpa-pagination data-page="2" data-total-pages="10" data-page-size="25" data-rows-options="10,25,50"></sherpa-pagination>' },
  'sherpa-panel': { html: '<sherpa-panel data-heading="Overview"><p>Panel body.</p><sherpa-button slot="footer">Apply</sherpa-button></sherpa-panel>' },
  'sherpa-progress-bar': { html: '<sherpa-progress-bar data-label="Upload" value="40"></sherpa-progress-bar>' },
  'sherpa-progress-step-tracker': {
    html: '<sherpa-progress-step-tracker data-current-step="2"></sherpa-progress-step-tracker>',
    fill: [{ at: 'sherpa-progress-step-tracker', data: [{ label: 'Account' }, { label: 'Plan', description: 'Pick one' }, { label: 'Confirm' }] }],
  },
  'sherpa-prompt-composer': { html: '<sherpa-prompt-composer data-placeholder="Message the assistant…"></sherpa-prompt-composer>' },
  'sherpa-provider': { html: '<sherpa-provider><p>What it provides for.</p></sherpa-provider>' },
  'sherpa-quick-filter': {
    html: '<sherpa-quick-filter data-label="Unassigned"></sherpa-quick-filter> '
      + '<sherpa-quick-filter data-label="Region" data-menu><sherpa-menu slot="menu" data-heading="Region" data-select="multiple">'
      + '<label><input type="checkbox" value="emea" /> EMEA</label><label><input type="checkbox" value="apac" /> APAC</label></sherpa-menu></sherpa-quick-filter>',
  },
  'sherpa-quick-filter-toolbar': {
    html: '<sherpa-quick-filter-toolbar></sherpa-quick-filter-toolbar>',
    fill: [{
      at: 'sherpa-quick-filter-toolbar',
      data: [
        { id: 'region', label: 'Region', options: OPTIONS },
        { id: 'trial', label: 'On trial', type: 'toggle' },
      ],
    }],
  },
  'sherpa-radial-chart': {
    html: '<sherpa-container><sherpa-data-viz-header slot="header" data-heading="Customers by plan"></sherpa-data-viz-header><sherpa-radial-chart data-sublabel="customers"></sherpa-radial-chart></sherpa-container>',
    fill: [{ at: 'sherpa-radial-chart', data: SLICES }],
  },
  'sherpa-router': { html: '<sherpa-router data-params="context=home view" data-overlay="settings"></sherpa-router><a href="?context=records">Records</a>' },
  'sherpa-section-header': { html: '<sherpa-section-header data-heading="Details"><span slot="description">How you appear to your team.</span></sherpa-section-header>' },
  'sherpa-select-card': {
    html: '<sherpa-select-card data-label="Pro" data-description="For growing teams" name="plan" value="pro" data-selected>12 seats</sherpa-select-card>'
      + '<sherpa-select-card data-label="Free" data-description="To try it" name="plan" value="free">3 seats</sherpa-select-card>',
  },
  'sherpa-select-checkbox': { html: '<sherpa-select-checkbox data-label="Accept terms" data-description="Required to continue." name="terms"></sherpa-select-checkbox>' },
  'sherpa-select-group': {
    html: '<sherpa-select-group data-label="Plan" name="plan"></sherpa-select-group>',
    fill: [{ at: 'sherpa-select-group', data: [{ value: 'pro', label: 'Pro' }, { value: 'free', label: 'Free' }] }],
  },
  'sherpa-select-radio': {
    html: '<sherpa-select-radio data-label="Standard shipping" data-description="3–5 business days." name="ship" value="standard"></sherpa-select-radio>'
      + '<sherpa-select-radio data-label="Express" name="ship" value="express"></sherpa-select-radio>',
  },
  'sherpa-slider': { html: '<sherpa-slider data-label="Volume" min="0" max="100" step="5" value="40" data-show-value></sherpa-slider>' },
  'sherpa-sparkline': {
    html: '<sherpa-sparkline aria-label="Revenue, last 7 days"></sherpa-sparkline>',
    fill: [{ at: 'sherpa-sparkline', data: [3, 5, 2, 6, 8, 4, 7] }],
  },
  'sherpa-stack': { html: '<sherpa-stack data-gap="md"><p>One</p><p>Two</p></sherpa-stack>' },
  'sherpa-switch': { html: '<sherpa-switch name="contrast" aria-label="Increase contrast"></sherpa-switch> <sherpa-switch data-type="simple" name="motion" aria-label="Reduce motion" checked></sherpa-switch>' },
  'sherpa-tabs': {
    html: '<sherpa-tabs><section data-tab="a">Panel A</section><section data-tab="b">Panel B</section></sherpa-tabs>',
    fill: [{ at: 'sherpa-tabs', data: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }] }],
  },
  'sherpa-tag': { html: '<sherpa-tag>Draft</sherpa-tag> <sherpa-tag data-status="critical" data-dismissible>Overdue</sherpa-tag>' },
  'sherpa-toast': { html: '<sherpa-toast data-status="success" data-heading="Saved" data-value="The record was saved." data-duration="0"></sherpa-toast>' },
  'sherpa-toolbar': { html: '<sherpa-toolbar><sherpa-button slot="leading" data-icon-start="plus">Add customer</sherpa-button><sherpa-button slot="trailing">Export</sherpa-button></sherpa-toolbar>' },
  'sherpa-tooltip': { html: '<sherpa-tooltip data-text="Delete this item"><sherpa-button data-type="icon" data-icon-start="trash" aria-label="Delete"></sherpa-button></sherpa-tooltip>' },
  'sherpa-transfer-list': {
    html: '<sherpa-transfer-list data-source-heading="Available columns" data-target-heading="Shown columns"></sherpa-transfer-list>',
    fill: [{ at: 'sherpa-transfer-list', data: [{ value: 'name', label: 'Name', selected: true }, { value: 'plan', label: 'Plan' }, { value: 'seats', label: 'Seats' }] }],
  },
};
