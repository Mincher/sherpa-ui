/**
 * playground-dummy-data.js
 *
 * Per-component sample-content registry used by the playground (index.html)
 * to make every preview render with meaningful content out of the gate.
 *
 * Each entry can supply:
 *
 *   attrs:  { 'data-foo': 'bar', ... }
 *           Attribute overrides. Applied AFTER the generic sample heuristic
 *           so they always win.
 *
 *   html:   '<li>...</li>'
 *           Light-DOM markup injected as innerHTML. Use this for
 *           components that consume slotted children (lists, tabs,
 *           accordions, key-value lists, etc.).
 *
 *   setup({ instance, container, addTrigger }) → optional
 *           Called after the element is connected. Use for programmatic
 *           initialisation (setData, setOptions, .show() etc.) or to add
 *           trigger buttons for overlay components.
 *
 *   note:   'Description string (HTML allowed) shown under the preview.'
 *
 * Trigger helper:
 *   addTrigger({ label, iconStart, onClick }) appends a small button
 *   beneath the preview, used to drive overlays (dialog/menu/toast/etc.).
 */

const FA_PLAY    = '\uf04b';
const FA_BELL    = '\uf0f3';
const FA_CARET   = '\uf0d7';
const FA_ELLIPSIS = '\uf141';

// Reusable bits ─────────────────────────────────────────────────────

const SAMPLE_OPTIONS = [
  { value: 'apple',  label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date',   label: 'Date' },
];

const SAMPLE_ROWS = [
  { id: 1, name: 'Acme device 01',   status: 'online',  cpu: 12, region: 'EU' },
  { id: 2, name: 'Acme device 02',   status: 'offline', cpu: 0,  region: 'US' },
  { id: 3, name: 'Beta probe 14',    status: 'online',  cpu: 47, region: 'EU' },
  { id: 4, name: 'Gamma sensor 09',  status: 'warning', cpu: 81, region: 'APAC' },
  { id: 5, name: 'Delta gateway 03', status: 'online',  cpu: 23, region: 'US' },
  { id: 6, name: 'Epsilon hub 21',   status: 'online',  cpu: 35, region: 'EU' },
];

const SAMPLE_COLUMNS = [
  { field: 'name',   label: 'Name',   width: 'auto' },
  { field: 'status', label: 'Status' },
  { field: 'cpu',    label: 'CPU %', type: 'number' },
  { field: 'region', label: 'Region' },
];

const TIME_SERIES = Array.from({ length: 12 }, (_, i) => ({
  date:  new Date(2026, 0, i + 1).toISOString(),
  value: Math.round(40 + Math.sin(i / 2) * 25 + i * 2),
}));

const CATEGORICAL_DATA = [
  { category: 'Email',  value: 42 },
  { category: 'Direct', value: 28 },
  { category: 'Social', value: 19 },
  { category: 'Search', value: 11 },
];

// Helpers ──────────────────────────────────────────────────────────

const PATTERN_LINK = (href, label) =>
  `Heavy-fixture component — see the <a href="${href}" target="_blank" rel="noopener">${label}</a> pattern for a full demo.`;

// Registry ─────────────────────────────────────────────────────────

export const DUMMY_DATA = {

  // ── Inputs ────────────────────────────────────────────────────────

  'sherpa-input-select': {
    attrs: { 'data-label': 'Choose a fruit', 'data-placeholder': 'Pick one…' },
    setup({ instance }) {
      instance.setOptions?.(SAMPLE_OPTIONS);
    },
  },

  'sherpa-input-checkbox-group': {
    attrs: { 'data-label': 'Select toppings' },
    html: `
      <label><input type="checkbox" value="cheese" checked /> Cheese</label>
      <label><input type="checkbox" value="ham" /> Ham</label>
      <label><input type="checkbox" value="mushroom" /> Mushroom</label>
    `,
  },

  'sherpa-input-radio-group': {
    attrs: { 'data-label': 'Delivery speed' },
    html: `
      <label><input type="radio" name="rg-demo" value="standard" checked /> Standard</label>
      <label><input type="radio" name="rg-demo" value="express" /> Express</label>
      <label><input type="radio" name="rg-demo" value="overnight" /> Overnight</label>
    `,
  },

  'sherpa-input-tag': {
    attrs: { 'data-label': 'Tags', 'data-value': 'design,system,ui' },
  },

  'sherpa-input-checkbox': {
    attrs: { 'data-label': 'Subscribe to updates', 'data-checked': 'true' },
  },

  'sherpa-input-radio': {
    attrs: { 'data-label': 'Enable feature', 'data-name': 'demo', 'data-value': 'yes' },
  },

  'sherpa-input-text': {
    attrs: { 'data-label': 'Name', 'data-placeholder': 'Jane Doe', 'data-helper': 'Up to 80 characters.' },
  },

  'sherpa-input-number': {
    attrs: { 'data-label': 'Quantity', 'data-value': '5', 'data-min': '0', 'data-max': '99' },
  },

  'sherpa-input-search': {
    attrs: { 'data-label': 'Search', 'data-placeholder': 'Search devices…' },
  },

  'sherpa-input-password': {
    attrs: { 'data-label': 'Password', 'data-placeholder': '••••••••' },
  },

  'sherpa-input-date': {
    attrs: { 'data-label': 'Start date', 'data-value': '2026-05-06' },
  },

  'sherpa-input-date-range': {
    attrs: { 'data-label': 'Reporting window', 'data-value': '2026-05-01..2026-05-31' },
  },

  'sherpa-input-time': {
    attrs: { 'data-label': 'Meeting time', 'data-value': '09:30' },
  },

  'sherpa-file-upload': {
    attrs: { 'data-label': 'Upload report', 'data-helper': 'PDF or CSV, up to 10 MB.' },
  },

  // ── Lists / nav / structural ─────────────────────────────────────

  'sherpa-list': {
    attrs: { 'data-variant': 'divided' },
    html: `
      <sherpa-list-item data-label="Acme device 01" data-description="online · EU"></sherpa-list-item>
      <sherpa-list-item data-label="Beta probe 14" data-description="online · EU"></sherpa-list-item>
      <sherpa-list-item data-label="Gamma sensor 09" data-description="warning · APAC"></sherpa-list-item>
      <sherpa-list-item data-label="Delta gateway 03" data-description="online · US"></sherpa-list-item>
    `,
  },

  'sherpa-list-item': {
    attrs: {
      'data-label': 'Acme device 01',
      'data-description': 'Last seen just now',
      'data-icon': 'fa-solid fa-server',
      'data-interactive': '',
    },
  },

  'sherpa-list-panel': {
    attrs: { 'data-match': 'sherpa-list-item', 'data-empty': 'No matches' },
    html: `
      <sherpa-list data-variant="divided">
        <sherpa-list-item data-label="Alpha" data-description="Region: EU" data-interactive></sherpa-list-item>
        <sherpa-list-item data-label="Beta"  data-description="Region: US" data-interactive></sherpa-list-item>
        <sherpa-list-item data-label="Gamma" data-description="Region: APAC" data-interactive></sherpa-list-item>
      </sherpa-list>
    `,
  },

  'sherpa-tabs': {
    html: `
      <div data-tab-label="Overview">Overview content goes here.</div>
      <div data-tab-label="Activity">Activity content goes here.</div>
      <div data-tab-label="Settings">Settings content goes here.</div>
    `,
  },

  'sherpa-accordion': {
    attrs: { 'data-label': 'How does this work?' },
    html: `<p>An accordion progressively discloses content. Click the header to expand or collapse.</p>`,
  },

  'sherpa-stepper': {
    html: `
      <sherpa-list-item data-label="Account"   data-description="Completed" data-status="complete"></sherpa-list-item>
      <sherpa-list-item data-label="Workspace" data-description="In progress" data-status="active"></sherpa-list-item>
      <sherpa-list-item data-label="Billing"   data-description="Up next"     data-status="pending"></sherpa-list-item>
      <sherpa-list-item data-label="Review"    data-description="Pending"     data-status="pending"></sherpa-list-item>
    `,
  },

  'sherpa-progress-tracker': {
    html: `
      <sherpa-list-item data-label="Submitted" data-status="complete"></sherpa-list-item>
      <sherpa-list-item data-label="Review"    data-status="active"></sherpa-list-item>
      <sherpa-list-item data-label="Approved"  data-status="pending"></sherpa-list-item>
      <sherpa-list-item data-label="Deployed"  data-status="pending"></sherpa-list-item>
    `,
  },

  'sherpa-breadcrumbs': {
    html: `
      <a href="#">Home</a>
      <a href="#">Devices</a>
      <a href="#">Acme device 01</a>
    `,
  },

  'sherpa-pagination': {
    attrs: { 'data-page': '2', 'data-page-size': '20', 'data-total-rows': '143' },
  },

  'sherpa-progress-bar': {
    attrs: { 'data-value': '64', 'data-max': '100', 'data-label': 'Uploading…' },
  },

  'sherpa-slider': {
    attrs: { 'data-label': 'Volume', 'data-value': '40', 'data-min': '0', 'data-max': '100' },
  },

  'sherpa-switch': {
    attrs: { 'data-state': 'on', 'data-label': 'Enable feature' },
  },

  'sherpa-tag': {
    attrs: { 'data-label': 'Production', 'data-status': 'success' },
  },

  'sherpa-button': {
    attrs: { 'data-label': 'Save changes', 'data-variant': 'primary', 'data-icon-start': '\uf0c7' },
  },

  'sherpa-icon': {
    attrs: { 'data-icon': 'fa-solid fa-bolt', 'data-size': 'lg' },
  },

  'sherpa-loader': {
    attrs: { 'data-label': 'Loading data…' },
  },

  // ── Cards / content ──────────────────────────────────────────────

  'sherpa-card': {
    attrs: {
      'data-label':       'Acme device 01',
      'data-description': 'Healthy. Last sync: 2 min ago.',
      'data-elevation':   'sm',
    },
    html: `<p>Click to see device details, recent telemetry and configuration.</p>`,
  },

  'sherpa-callout': {
    attrs: {
      'data-status': 'warning',
      'data-label':  'Heads up',
    },
    html: `<p>This action cannot be undone. Please confirm before continuing.</p>`,
  },

  'sherpa-message': {
    attrs: {
      'data-status': 'info',
      'data-label':  'Backup completed successfully.',
    },
  },

  'sherpa-empty-state': {
    attrs: {
      'data-label':        'No devices yet',
      'data-description':  'Add your first device to begin monitoring.',
      'data-illustration': 'empty',
    },
  },

  'sherpa-panel': {
    attrs: { 'data-heading': 'Recent activity' },
    html: `<p>Sample panel body content.</p>`,
  },

  'sherpa-content-section': {
    attrs: { 'data-heading': 'Filters', 'data-position': 'left', 'data-restore-label': 'Filters' },
    html: `<p>Section body content.</p>`,
  },

  'sherpa-container': {
    attrs: { 'data-heading': 'Devices' },
    html: `<p>Container body content.</p>`,
  },

  'sherpa-container-header': {
    attrs: { 'data-label': 'Devices', 'data-description': '6 active' },
  },

  'sherpa-section-header': {
    attrs: { 'data-label': 'Recent activity', 'data-divider': '' },
  },

  'sherpa-view-header': {
    attrs: { 'data-label': 'Dashboard', 'data-export-title': 'Dashboard export' },
  },

  'sherpa-toolbar': {
    html: `
      <sherpa-button data-label="New" data-variant="primary" data-icon-start="\uf067"></sherpa-button>
      <sherpa-button data-label="Filter" data-variant="tertiary"></sherpa-button>
      <sherpa-button data-label="Export" data-variant="tertiary"></sherpa-button>
    `,
  },

  'sherpa-filter-bar': {
    attrs: { 'data-density': 'base' },
    html: `
      <sherpa-button data-type="default" data-variant="tertiary" data-label="Status: online" data-dismissable></sherpa-button>
      <sherpa-button data-type="default" data-variant="tertiary" data-label="Region: EU"     data-dismissable></sherpa-button>
    `,
  },

  'sherpa-key-value-list': {
    attrs: { 'data-layout': 'horizontal' },
    html: `
      <dt>Status</dt>          <dd>Online</dd>
      <dt>Region</dt>          <dd>EU-West</dd>
      <dt>Uptime</dt>          <dd>23d 14h</dd>
      <dt>Last heartbeat</dt>  <dd>just now</dd>
    `,
  },

  'sherpa-section-nav': {
    html: `
      <sherpa-list-item data-label="Overview"  data-active data-interactive></sherpa-list-item>
      <sherpa-list-item data-label="Devices"   data-interactive></sherpa-list-item>
      <sherpa-list-item data-label="Alerts"    data-interactive></sherpa-list-item>
      <sherpa-list-item data-label="Settings"  data-interactive></sherpa-list-item>
    `,
  },

  'sherpa-nav': {
    html: `
      <sherpa-nav-item data-label="Dashboard"  data-icon="fa-solid fa-gauge"        data-active></sherpa-nav-item>
      <sherpa-nav-item data-label="Devices"    data-icon="fa-solid fa-server"></sherpa-nav-item>
      <sherpa-nav-item data-label="Reports"    data-icon="fa-solid fa-chart-line"></sherpa-nav-item>
      <sherpa-nav-item data-label="Settings"   data-icon="fa-solid fa-gear"></sherpa-nav-item>
    `,
  },

  'sherpa-nav-item': {
    attrs: { 'data-label': 'Dashboard', 'data-icon': 'fa-solid fa-gauge', 'data-active': '' },
  },

  'sherpa-nav-promo': {
    attrs: {
      'data-label':       'Upgrade to Pro',
      'data-description': 'Unlock advanced analytics and reporting.',
    },
  },

  'sherpa-product-bar': {
    attrs: { 'data-label': 'Acme Console' },
  },

  'sherpa-product-bar-v2': {
    attrs: { 'data-label': 'Acme Console' },
  },

  'sherpa-footer': {
    html: `
      <sherpa-button data-label="Cancel"  data-variant="tertiary"></sherpa-button>
      <sherpa-button data-label="Save"    data-variant="primary"></sherpa-button>
    `,
  },

  'sherpa-layout-grid': {
    attrs: { 'data-columns': '3', 'data-gap': 'md' },
    html: `
      <sherpa-card data-label="Card A" data-elevation="sm"><p>Body A</p></sherpa-card>
      <sherpa-card data-label="Card B" data-elevation="sm"><p>Body B</p></sherpa-card>
      <sherpa-card data-label="Card C" data-elevation="sm"><p>Body C</p></sherpa-card>
    `,
  },

  // ── Data viz ─────────────────────────────────────────────────────

  'sherpa-data-grid': {
    attrs: { 'data-density': 'base' },
    setup({ instance }) {
      return instance.setData?.({ rows: SAMPLE_ROWS, columns: SAMPLE_COLUMNS });
    },
  },

  'sherpa-barchart': {
    attrs: {
      'data-category':    'category',
      'data-value-field': 'value',
      'data-orientation': 'vertical',
    },
    setup({ instance }) {
      return instance.setData?.({ rows: CATEGORICAL_DATA });
    },
  },

  'sherpa-line-chart': {
    attrs: {
      'data-category':    'date',
      'data-value-field': 'value',
    },
    setup({ instance }) {
      return instance.setData?.({ rows: TIME_SERIES });
    },
  },

  'sherpa-donut-chart': {
    attrs: {
      'data-category':    'category',
      'data-value-field': 'value',
    },
    setup({ instance }) {
      return instance.setData?.({ rows: CATEGORICAL_DATA });
    },
  },

  'sherpa-gauge-chart': {
    attrs: {
      'data-value-field': 'value',
      'data-min':         '0',
      'data-max':         '100',
    },
    setup({ instance }) {
      return instance.setData?.({ rows: [{ value: 72 }] });
    },
  },

  'sherpa-sparkline': {
    attrs: { 'data-value-field': 'value' },
    setup({ instance }) {
      return instance.setData?.({ rows: TIME_SERIES });
    },
  },

  'sherpa-chart-legend': {
    html: `
      <span data-color="#0066cc">Email</span>
      <span data-color="#7c3aed">Direct</span>
      <span data-color="#16a34a">Social</span>
      <span data-color="#ea580c">Search</span>
    `,
  },

  'sherpa-metric': {
    attrs: {
      'data-label':       'Total devices',
      'data-value':       '1,284',
      'data-trend':       'up',
      'data-trend-value': '+12%',
    },
  },

  // ── Overlays — provide trigger buttons ───────────────────────────

  'sherpa-dialog': {
    attrs: {
      'data-label':    'Confirm action',
      'data-subtitle': 'Are you sure you want to continue?',
      'data-size':     'medium',
    },
    html: `
      <p>This will deploy your configuration to all devices in the selected region.</p>
      <sherpa-callout slot="footer" data-status="warning" data-label="Once started, this action cannot be cancelled."></sherpa-callout>
    `,
    setup({ instance, addTrigger }) {
      addTrigger({
        label:     'Open dialog',
        iconStart: FA_PLAY,
        onClick:   () => instance.show?.(),
      });
    },
  },

  'sherpa-toast': {
    // No preview rendered — toast pops itself from a static factory.
    attrs: {},
    setup({ container, addTrigger }) {
      // Hide the empty toast instance; the triggers below show real toasts.
      const empty = container.querySelector('sherpa-toast');
      if (empty) empty.remove();

      const fire = async (variant) => {
        const mod = await import('../components/sherpa-toast/sherpa-toast.js');
        const SherpaToast = mod.SherpaToast || mod.default;
        SherpaToast?.[variant]?.(`This is a ${variant} toast.`);
      };
      addTrigger({ label: 'Success toast',  iconStart: FA_BELL, onClick: () => fire('success') });
      addTrigger({ label: 'Warning toast',  iconStart: FA_BELL, onClick: () => fire('warning') });
      addTrigger({ label: 'Critical toast', iconStart: FA_BELL, onClick: () => fire('critical') });
      addTrigger({ label: 'Info toast',     iconStart: FA_BELL, onClick: () => fire('info') });
    },
  },

  'sherpa-tooltip': {
    attrs: {},
    setup({ container, addTrigger }) {
      const empty = container.querySelector('sherpa-tooltip');
      if (empty) empty.remove();

      addTrigger({
        label:     'Hover/click for tooltip',
        onClick:   async (e) => {
          const mod = await import('../components/sherpa-tooltip/sherpa-tooltip.js');
          const SherpaTooltip = mod.SherpaTooltip || mod.default;
          SherpaTooltip?.show?.(
            e.target,
            'Hello from sherpa-tooltip — singleton API.',
            { position: 'top' },
          );
        },
      });
    },
  },

  'sherpa-popover': {
    attrs: { 'data-label': 'Popover heading' },
    html: `<p>Popover body content. Use a trigger to position it next to an element.</p>`,
    setup({ instance, addTrigger }) {
      addTrigger({
        label:   'Toggle popover',
        onClick: () => instance.toggleAttribute('data-open'),
      });
    },
  },

  'sherpa-menu': {
    attrs: {},
    html: `
      <sherpa-menu-item data-label="Edit"      data-icon="fa-solid fa-pen"></sherpa-menu-item>
      <sherpa-menu-item data-label="Duplicate" data-icon="fa-solid fa-copy"></sherpa-menu-item>
      <sherpa-menu-item data-label="Delete"    data-icon="fa-solid fa-trash" data-status="critical"></sherpa-menu-item>
    `,
    setup({ instance, addTrigger }) {
      const trigger = addTrigger({
        label:     'Open menu',
        iconStart: FA_CARET,
        onClick:   () => instance.show?.(trigger),
      });
    },
  },

  'sherpa-menu-item': {
    attrs: { 'data-label': 'Edit', 'data-icon': 'fa-solid fa-pen' },
  },

  // ── AI / chat ────────────────────────────────────────────────────

  'sherpa-chat-message': {
    attrs: { 'data-author': 'Assistant', 'data-timestamp': 'just now' },
    html: `<p>Hi! I'm a sample assistant message. Ask me anything.</p>`,
  },

  'sherpa-prompt-composer': {
    attrs: { 'data-placeholder': 'Ask anything…' },
  },

  'sherpa-ai-panel': {
    note: PATTERN_LINK('patterns/layouts/dashboard-grid.html', 'AI panel'),
  },

  // ── Heavy fixtures — link to existing patterns ───────────────────

  'sherpa-node-canvas': {
    note: PATTERN_LINK('patterns/layouts/dashboard-grid.html', 'node-canvas'),
  },

  'sherpa-scheduler': {
    note: PATTERN_LINK('patterns/layouts/dashboard-grid.html', 'scheduler'),
  },

  'sherpa-proposal-preview': {
    note: PATTERN_LINK('patterns/layouts/detail-view.html', 'proposal-preview'),
  },

  'sherpa-proposal-op': {
    attrs: { 'data-label': 'Sample operation' },
  },

  'sherpa-node': {
    attrs: { 'data-label': 'Sample node', 'data-x': '40', 'data-y': '40' },
  },

  'sherpa-node-header': {
    attrs: { 'data-label': 'Header' },
  },

  'sherpa-node-row': {
    attrs: { 'data-label': 'Row' },
  },

  'sherpa-node-socket': {
    attrs: { 'data-label': 'Socket', 'data-direction': 'in' },
  },

  'sherpa-transfer-list': {
    setup({ instance }) {
      instance.setOptions?.([
        { value: 'a', label: 'Alpha',  selected: true },
        { value: 'b', label: 'Beta' },
        { value: 'c', label: 'Gamma',  selected: true },
        { value: 'd', label: 'Delta' },
        { value: 'e', label: 'Epsilon' },
      ]);
    },
  },

  'sherpa-container-pdf-exporter': {
    attrs: { 'data-label': 'Export to PDF' },
  },
};
