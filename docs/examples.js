/**
 * docs/examples.js — Live example snippets for component documentation pages.
 *
 * Each key is a component tag name. Each value is an array of example objects:
 *
 *   {
 *     label:       string   — Example heading
 *     description: string?  — Optional explanatory sentence
 *     html:        string   — HTML to render (live preview + code block)
 *     layout:      string?  — 'row' (default) | 'col' | 'block'
 *     preview:     boolean? — false to show code only, no live preview
 *   }
 *
 * Components not listed here get an auto-generated "Basic usage" example
 * derived from their schema attributes.
 */

// ── Controls ──────────────────────────────────────────────────────────────────

const buttonExamples = [
  {
    label: 'Variants',
    description: 'Four variants covering the full action hierarchy from primary CTA to ghost.',
    layout: 'row',
    html: `<sherpa-button data-variant="primary"          data-label="Primary"></sherpa-button>
<sherpa-button data-variant="secondary"        data-label="Secondary"></sherpa-button>
<sherpa-button data-variant="tertiary"         data-label="Tertiary"></sherpa-button>
<sherpa-button data-variant="tertiary-on-color" data-label="On Color"></sherpa-button>`,
  },
  {
    label: 'Sizes',
    layout: 'row',
    html: `<sherpa-button data-variant="primary" data-size="large"   data-label="Large"></sherpa-button>
<sherpa-button data-variant="primary" data-size="base"    data-label="Base"></sherpa-button>
<sherpa-button data-variant="primary" data-size="small"   data-label="Small"></sherpa-button>
<sherpa-button data-variant="primary" data-size="x-small" data-label="X-Small"></sherpa-button>
<sherpa-button data-variant="primary" data-size="2x-small" data-label="2X-Small"></sherpa-button>`,
  },
  {
    label: 'With icons',
    layout: 'row',
    html: `<sherpa-button data-variant="primary"   data-label="Add item"  data-icon-start="fa-solid fa-plus"></sherpa-button>
<sherpa-button data-variant="secondary"  data-label="Download"  data-icon-end="fa-solid fa-download"></sherpa-button>
<sherpa-button data-variant="tertiary"   data-type="icon"       data-icon-start="fa-solid fa-ellipsis"></sherpa-button>`,
  },
  {
    label: 'Disabled',
    layout: 'row',
    html: `<sherpa-button data-variant="primary"   data-label="Primary"   disabled></sherpa-button>
<sherpa-button data-variant="secondary"  data-label="Secondary" disabled></sherpa-button>
<sherpa-button data-variant="tertiary"   data-label="Tertiary"  disabled></sherpa-button>`,
  },
  {
    label: 'Status',
    description: 'Apply data-status to drive status colour tokens on the button.',
    layout: 'row',
    html: `<sherpa-button data-variant="primary" data-label="Critical" data-status="critical"></sherpa-button>
<sherpa-button data-variant="primary" data-label="Warning"  data-status="warning"></sherpa-button>
<sherpa-button data-variant="primary" data-label="Success"  data-status="success"></sherpa-button>`,
  },
];

const tagExamples = [
  {
    label: 'Variants',
    layout: 'row',
    html: `<sherpa-tag data-label="Default"></sherpa-tag>
<sherpa-tag data-label="Primary"   data-variant="primary"></sherpa-tag>
<sherpa-tag data-label="Secondary" data-variant="secondary"></sherpa-tag>
<sherpa-tag data-label="Subtle"    data-variant="subtle"></sherpa-tag>`,
  },
  {
    label: 'Status',
    description: 'Status tokens drive the colour scheme automatically.',
    layout: 'row',
    html: `<sherpa-tag data-label="Critical" data-status="critical"></sherpa-tag>
<sherpa-tag data-label="Warning"  data-status="warning"></sherpa-tag>
<sherpa-tag data-label="Success"  data-status="success"></sherpa-tag>
<sherpa-tag data-label="Info"     data-status="info"></sherpa-tag>
<sherpa-tag data-label="Urgent"   data-status="urgent"></sherpa-tag>`,
  },
  {
    label: 'Sizes',
    layout: 'row',
    html: `<sherpa-tag data-label="Small" data-size="small"></sherpa-tag>
<sherpa-tag data-label="Base"  data-size="base"></sherpa-tag>
<sherpa-tag data-label="Large" data-size="large"></sherpa-tag>`,
  },
  {
    label: 'With leading icon',
    layout: 'row',
    html: `<sherpa-tag data-label="Active"  data-icon-start="fa-solid fa-circle-check"       data-status="success"></sherpa-tag>
<sherpa-tag data-label="Pending" data-icon-start="fa-solid fa-clock"               data-status="warning"></sherpa-tag>
<sherpa-tag data-label="Error"   data-icon-start="fa-solid fa-triangle-exclamation" data-status="critical"></sherpa-tag>`,
  },
];

const switchExamples = [
  {
    label: 'On and off',
    layout: 'row',
    html: `<sherpa-switch data-label="Notifications" checked></sherpa-switch>
<sherpa-switch data-label="Dark mode"></sherpa-switch>`,
  },
  {
    label: 'Disabled',
    layout: 'row',
    html: `<sherpa-switch data-label="Enabled (locked)" checked disabled></sherpa-switch>
<sherpa-switch data-label="Off (locked)" disabled></sherpa-switch>`,
  },
];

const progressBarExamples = [
  {
    label: 'Values',
    layout: 'col',
    html: `<sherpa-progress-bar data-label="25%"  value="25"  max="100"></sherpa-progress-bar>
<sherpa-progress-bar data-label="60%"  value="60"  max="100"></sherpa-progress-bar>
<sherpa-progress-bar data-label="100%" value="100" max="100"></sherpa-progress-bar>`,
  },
  {
    label: 'Status',
    layout: 'col',
    html: `<sherpa-progress-bar data-label="Upload complete"   value="100" max="100" data-status="success"></sherpa-progress-bar>
<sherpa-progress-bar data-label="Storage warning"    value="80"  max="100" data-status="warning"></sherpa-progress-bar>
<sherpa-progress-bar data-label="Critical threshold" value="45"  max="100" data-status="critical"></sherpa-progress-bar>`,
  },
];

const paginationExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-pagination data-total="150" data-page="1" data-page-size="20"></sherpa-pagination>`,
  },
];

const loaderExamples = [
  {
    label: 'Sizes',
    description: 'The loader spins continuously. Use data-size to scale it.',
    layout: 'row',
    html: `<sherpa-loader data-size="small"></sherpa-loader>
<sherpa-loader data-size="base"></sherpa-loader>
<sherpa-loader data-size="large"></sherpa-loader>`,
  },
];

const sliderExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-slider data-label="Volume" min="0" max="100" value="40"></sherpa-slider>`,
  },
  {
    label: 'With step',
    layout: 'block',
    html: `<sherpa-slider data-label="Opacity" min="0" max="1" step="0.1" value="0.7"></sherpa-slider>`,
  },
];

const stepperExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-stepper data-active-step="1" data-steps='[{"label":"Account"},{"label":"Profile"},{"label":"Confirm"}]'></sherpa-stepper>`,
  },
];

// ── Inputs ────────────────────────────────────────────────────────────────────

const inputTextExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-input-text data-label="Full name" placeholder="Enter your name"></sherpa-input-text>`,
  },
  {
    label: 'With helper text',
    layout: 'block',
    html: `<sherpa-input-text data-label="Username" data-helper="3–20 characters, letters and numbers only" placeholder="your_username"></sherpa-input-text>`,
  },
  {
    label: 'Required and disabled',
    layout: 'col',
    html: `<sherpa-input-text data-label="Email address" placeholder="name@company.com" required></sherpa-input-text>
<sherpa-input-text data-label="Account ID"    value="ACC-00124" disabled></sherpa-input-text>`,
  },
  {
    label: 'Validation states',
    layout: 'col',
    html: `<sherpa-input-text data-label="Email"    data-helper="Please enter a valid email address." data-status="critical" value="not-an-email"></sherpa-input-text>
<sherpa-input-text data-label="Password" data-helper="Strong password!"                      data-status="success" value="••••••••••"></sherpa-input-text>`,
  },
];

const inputSelectExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-input-select data-label="Region">
  <option value="">Select a region…</option>
  <option value="eur">Europe</option>
  <option value="nam">North America</option>
  <option value="apac">Asia-Pacific</option>
  <option value="me">Middle East</option>
</sherpa-input-select>`,
  },
  {
    label: 'With helper and required',
    layout: 'block',
    html: `<sherpa-input-select data-label="Timezone" data-helper="Used for scheduled reports" required>
  <option value="">Choose a timezone…</option>
  <option value="utc">UTC</option>
  <option value="gmt1">GMT+1 (London)</option>
  <option value="gmt2">GMT+2 (Paris)</option>
  <option value="et">US Eastern</option>
  <option value="pt">US Pacific</option>
</sherpa-input-select>`,
  },
  {
    label: 'Inline layout',
    description: 'Use data-layout="inline" to place the label and select on one line — ideal for compact toolbars.',
    layout: 'col',
    html: `<sherpa-input-select data-label="Theme" data-layout="inline" data-size="small">
  <option value="apex-2-purple">Apex 2 (Purple)</option>
  <option value="apex-2-teal">Apex 2 (Teal)</option>
  <option value="classic">Classic</option>
</sherpa-input-select>`,
  },
];

const inputCheckboxExamples = [
  {
    label: 'States',
    layout: 'col',
    html: `<sherpa-input-checkbox data-label="Unchecked"></sherpa-input-checkbox>
<sherpa-input-checkbox data-label="Checked"            checked></sherpa-input-checkbox>
<sherpa-input-checkbox data-label="Disabled"           disabled></sherpa-input-checkbox>
<sherpa-input-checkbox data-label="Checked + disabled" checked disabled></sherpa-input-checkbox>`,
  },
];

const inputCheckboxGroupExamples = [
  {
    label: 'Notification channels',
    layout: 'block',
    html: `<sherpa-input-checkbox-group data-label="Notification channels" data-helper="Select all that apply">
  <sherpa-input-checkbox data-label="Email"             value="email" checked></sherpa-input-checkbox>
  <sherpa-input-checkbox data-label="SMS"               value="sms"></sherpa-input-checkbox>
  <sherpa-input-checkbox data-label="Push notification" value="push" checked></sherpa-input-checkbox>
  <sherpa-input-checkbox data-label="Slack"             value="slack"></sherpa-input-checkbox>
</sherpa-input-checkbox-group>`,
  },
];

const inputRadioGroupExamples = [
  {
    label: 'Account type',
    layout: 'block',
    html: `<sherpa-input-radio-group data-label="Account type" name="account-type">
  <sherpa-input-radio data-label="Personal"   value="personal"   checked></sherpa-input-radio>
  <sherpa-input-radio data-label="Business"   value="business"></sherpa-input-radio>
  <sherpa-input-radio data-label="Enterprise" value="enterprise"></sherpa-input-radio>
</sherpa-input-radio-group>`,
  },
];

const inputSearchExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-input-search data-label="Search" placeholder="Search components…"></sherpa-input-search>`,
  },
];

const inputNumberExamples = [
  {
    label: 'With constraints',
    layout: 'col',
    html: `<sherpa-input-number data-label="Quantity"    min="1"  max="99"  value="1"  data-helper="Maximum 99 units"></sherpa-input-number>
<sherpa-input-number data-label="Retry limit" min="0"  max="10"  step="1" value="3"></sherpa-input-number>`,
  },
];

const inputPasswordExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-input-password data-label="Password" placeholder="Enter password" data-helper="Must be at least 8 characters"></sherpa-input-password>`,
  },
];

const inputDateExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-input-date data-label="Date of birth"></sherpa-input-date>`,
  },
];

const fileUploadExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-file-upload data-label="Attachment" data-helper="PDF, DOCX or PNG — max 10 MB"></sherpa-file-upload>`,
  },
];

// ── Feedback & Overlays ───────────────────────────────────────────────────────

const calloutExamples = [
  {
    label: 'Status variants',
    description: 'Callouts communicate persistent contextual messages in-page.',
    layout: 'col',
    html: `<sherpa-callout data-status="info"     data-label="Update available"   data-description="Version 3.4.1 is ready to install. Restart required."></sherpa-callout>
<sherpa-callout data-status="success"  data-label="Changes saved"       data-description="Your configuration has been applied to all regions."></sherpa-callout>
<sherpa-callout data-status="warning"  data-label="Trial expiring soon" data-description="Your trial ends in 3 days. Upgrade to keep access."></sherpa-callout>
<sherpa-callout data-status="critical" data-label="Connection lost"     data-description="Unable to reach the server. Check your network and retry."></sherpa-callout>`,
  },
  {
    label: 'With dismiss button',
    layout: 'col',
    html: `<sherpa-callout data-status="info" data-label="New dashboard available" data-description="Try the redesigned analytics dashboard." data-close-button></sherpa-callout>`,
  },
];

const messageExamples = [
  {
    label: 'Status variants',
    layout: 'col',
    html: `<sherpa-message data-status="info"     data-label="Scheduled maintenance on Sunday 22:00 UTC"></sherpa-message>
<sherpa-message data-status="success"  data-label="Report generated successfully"></sherpa-message>
<sherpa-message data-status="warning"  data-label="Rate limit approaching — 90% used"></sherpa-message>
<sherpa-message data-status="critical" data-label="Authentication failed — check your API key"></sherpa-message>`,
  },
];

const emptyStateExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-empty-state
  data-label="No results found"
  data-description="Try adjusting your search or filters."
  data-illustration="search">
</sherpa-empty-state>`,
  },
  {
    label: 'With action',
    layout: 'block',
    html: `<sherpa-empty-state
  data-label="No devices configured"
  data-description="Add your first device to get started monitoring your network."
  data-illustration="empty">
  <sherpa-button slot="actions" data-variant="primary" data-label="Add device" data-icon-start="fa-solid fa-plus"></sherpa-button>
</sherpa-empty-state>`,
  },
];

const accordionExamples = [
  {
    label: 'Multiple panels',
    layout: 'col',
    html: `<sherpa-accordion data-label="What is Sherpa UI?" open>
  <p>Sherpa UI is a Web Component design system built on progressive enhancement. HTML owns structure, CSS owns presentation, and JS owns data and events.</p>
</sherpa-accordion>
<sherpa-accordion data-label="How do I install it?">
  <p>Copy the components directory into your project and import the component you need. No build step required.</p>
</sherpa-accordion>
<sherpa-accordion data-label="Does it support dark mode?">
  <p>Yes — set <code>data-mode="dark"</code> on the root element, or <code>data-mode="auto"</code> to follow the system preference.</p>
</sherpa-accordion>`,
  },
  {
    label: 'With icons',
    layout: 'col',
    html: `<sherpa-accordion data-label="Billing"  data-icon="&#xf155;" open>
  <p>Manage your plan, payment methods, and invoices here.</p>
</sherpa-accordion>
<sherpa-accordion data-label="Security" data-icon="&#xf023;">
  <p>Two-factor authentication, API keys, and session management.</p>
</sherpa-accordion>`,
  },
];

const tabsExamples = [
  {
    label: 'Basic',
    description: 'Each direct child with data-tab-label becomes a tab panel.',
    layout: 'block',
    html: `<sherpa-tabs>
  <div data-tab-label="Overview">
    <p>Overview panel. Tabs activate on click or keyboard arrow navigation.</p>
  </div>
  <div data-tab-label="Configuration">
    <p>Configuration panel. Each panel is a standard light-DOM element.</p>
  </div>
  <div data-tab-label="Logs">
    <p>Logs panel. The active tab index is tracked via <code>data-active-tab</code>.</p>
  </div>
  <div data-tab-label="Alerts">
    <p>Alerts panel. Add as many tabs as needed.</p>
  </div>
</sherpa-tabs>`,
  },
];

const listExamples = [
  {
    label: 'Divided list with icons',
    layout: 'block',
    html: `<sherpa-list data-variant="divided">
  <sherpa-list-item data-label="Dashboard" data-icon="fa-solid fa-chart-pie"   data-interactive></sherpa-list-item>
  <sherpa-list-item data-label="Devices"   data-description="24 online" data-icon="fa-solid fa-server"   data-interactive></sherpa-list-item>
  <sherpa-list-item data-label="Alerts"    data-description="3 unread"  data-icon="fa-solid fa-bell"     data-interactive></sherpa-list-item>
  <sherpa-list-item data-label="Reports"   data-icon="fa-solid fa-file-lines" data-interactive></sherpa-list-item>
  <sherpa-list-item data-label="Settings"  data-icon="fa-solid fa-gear"       data-interactive></sherpa-list-item>
</sherpa-list>`,
  },
  {
    label: 'Bordered with status',
    layout: 'block',
    html: `<sherpa-list data-variant="bordered" data-heading="Recent events">
  <sherpa-list-item data-label="Deployment succeeded"     data-description="v2.4.1 — 2 mins ago"    data-status="success"></sherpa-list-item>
  <sherpa-list-item data-label="High CPU usage detected"  data-description="web-01 — 12 mins ago"  data-status="warning"></sherpa-list-item>
  <sherpa-list-item data-label="Database backup complete" data-description="prod-db — 1 hour ago"  data-status="info"></sherpa-list-item>
  <sherpa-list-item data-label="SSL certificate expiring" data-description="api.example.com — 5d" data-status="critical"></sherpa-list-item>
</sherpa-list>`,
  },
];

// ── Layout & Navigation ───────────────────────────────────────────────────────

const breadcrumbsExamples = [
  {
    label: 'Navigation trail',
    layout: 'block',
    html: `<sherpa-breadcrumbs data-items='[{"label":"Home","href":"#/"},{"label":"Settings","href":"#/settings"},{"label":"Notifications"}]'></sherpa-breadcrumbs>`,
  },
];

const sectionHeaderExamples = [
  {
    label: 'Heading levels',
    layout: 'col',
    html: `<sherpa-section-header data-label="Primary heading"   data-heading-level="primary"></sherpa-section-header>
<sherpa-section-header data-label="Secondary heading" data-heading-level="secondary"></sherpa-section-header>
<sherpa-section-header data-label="Tertiary heading"  data-heading-level="tertiary"></sherpa-section-header>`,
  },
  {
    label: 'With divider and description',
    layout: 'col',
    html: `<sherpa-section-header data-label="User management" data-divider>
  <span slot="description">Manage roles, permissions, and team members.</span>
</sherpa-section-header>`,
  },
  {
    label: 'With actions',
    layout: 'col',
    html: `<sherpa-section-header data-label="Connected devices" data-divider>
  <span slot="description">15 devices online</span>
  <sherpa-button slot="actions" data-variant="primary" data-size="small" data-label="Add device" data-icon-start="fa-solid fa-plus"></sherpa-button>
</sherpa-section-header>`,
  },
];

const toolbarExamples = [
  {
    label: 'Basic toolbar',
    layout: 'block',
    html: `<sherpa-toolbar>
  <sherpa-button slot="leading" data-variant="primary"   data-label="Add"    data-icon-start="fa-solid fa-plus"></sherpa-button>
  <sherpa-button slot="leading" data-variant="secondary" data-label="Export" data-icon-start="fa-solid fa-download"></sherpa-button>
  <sherpa-button slot="trailing" data-variant="tertiary" data-type="icon"    data-icon-start="fa-solid fa-gear"></sherpa-button>
</sherpa-toolbar>`,
  },
];

const viewHeaderExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-view-header data-label="Device Management"></sherpa-view-header>`,
  },
];

// ── Content ───────────────────────────────────────────────────────────────────

const cardExamples = [
  {
    label: 'With title and footer action',
    layout: 'block',
    html: `<sherpa-card data-label="System overview" data-description="Last updated 2 mins ago" data-elevation="sm">
  <p>Monitor your infrastructure health at a glance. CPU, memory, and network utilisation across all nodes.</p>
  <sherpa-button slot="footer" data-variant="tertiary" data-label="View details" data-icon-end="fa-solid fa-arrow-right"></sherpa-button>
</sherpa-card>`,
  },
  {
    label: 'Elevation levels',
    layout: 'row',
    html: `<sherpa-card data-label="Flat"   data-elevation="none"><p>No shadow</p></sherpa-card>
<sherpa-card data-label="Small"  data-elevation="sm"><p>Subtle lift</p></sherpa-card>
<sherpa-card data-label="Medium" data-elevation="md"><p>Card lift</p></sherpa-card>
<sherpa-card data-label="Large"  data-elevation="lg"><p>Floating</p></sherpa-card>`,
  },
  {
    label: 'Interactive and selectable',
    layout: 'row',
    html: `<sherpa-card data-label="Option A" data-interactive data-selected><p>Selected state</p></sherpa-card>
<sherpa-card data-label="Option B" data-interactive><p>Click to select</p></sherpa-card>`,
  },
];

const metricExamples = [
  {
    label: 'KPI cards',
    layout: 'row',
    html: `<sherpa-metric data-label="Total devices" data-value="1,284" data-trend="up"   data-trend-value="+12%"></sherpa-metric>
<sherpa-metric data-label="Uptime"         data-value="99.97%" data-trend="flat" data-status="success"></sherpa-metric>
<sherpa-metric data-label="Open alerts"    data-value="7"       data-trend="up"   data-status="warning"></sherpa-metric>`,
  },
];

const keyValueListExamples = [
  {
    label: 'Device details',
    layout: 'block',
    html: `<sherpa-key-value-list>
  <dt>Hostname</dt>   <dd>web-srv-01</dd>
  <dt>IP address</dt> <dd>10.0.1.42</dd>
  <dt>Status</dt>     <dd>Online</dd>
  <dt>Last seen</dt>  <dd>Just now</dd>
  <dt>Region</dt>     <dd>EU West</dd>
</sherpa-key-value-list>`,
  },
  {
    label: 'Vertical layout',
    layout: 'block',
    html: `<sherpa-key-value-list data-layout="vertical">
  <dt>Hostname</dt>   <dd>web-srv-01</dd>
  <dt>IP address</dt> <dd>10.0.1.42</dd>
  <dt>Status</dt>     <dd>Online</dd>
</sherpa-key-value-list>`,
  },
];

// ── Shared sample data ───────────────────────────────────────────────────────

const SAMPLE_ROWS = [
  { id: 1, name: 'Acme device 01',   status: 'online',  cpu: 12, region: 'EU'   },
  { id: 2, name: 'Acme device 02',   status: 'offline', cpu: 0,  region: 'US'   },
  { id: 3, name: 'Beta probe 14',    status: 'online',  cpu: 47, region: 'EU'   },
  { id: 4, name: 'Gamma sensor 09',  status: 'warning', cpu: 81, region: 'APAC' },
  { id: 5, name: 'Delta gateway 03', status: 'online',  cpu: 23, region: 'US'   },
  { id: 6, name: 'Epsilon hub 21',   status: 'online',  cpu: 35, region: 'EU'   },
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

const SAMPLE_SELECT_OPTIONS = [
  { value: 'apple',  label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date',   label: 'Date' },
];

const TRANSFER_OPTIONS = [
  { value: 'a', label: 'Alpha',   selected: true  },
  { value: 'b', label: 'Beta',    selected: false },
  { value: 'c', label: 'Gamma',   selected: true  },
  { value: 'd', label: 'Delta',   selected: false },
  { value: 'e', label: 'Epsilon', selected: false },
];

/** Find the first element matching `selector` inside the preview node. */
const find = (root, selector) => root.querySelector(selector);

// ── Compound / data-driven examples ───────────────────────────────────────────

const iconExamples = [
  {
    label: 'Sizes',
    layout: 'row',
    html: `<sherpa-icon name="bolt" data-size="xs"></sherpa-icon>
<sherpa-icon name="bolt" data-size="sm"></sherpa-icon>
<sherpa-icon name="bolt" data-size="md"></sherpa-icon>
<sherpa-icon name="bolt" data-size="lg"></sherpa-icon>
<sherpa-icon name="bolt" data-size="xl"></sherpa-icon>
<sherpa-icon name="bolt" data-size="2xl"></sherpa-icon>`,
  },
  {
    label: 'Status colours',
    layout: 'row',
    html: `<sherpa-icon name="circle-check"       data-status="success"  data-size="lg"></sherpa-icon>
<sherpa-icon name="triangle-exclamation" data-status="warning"  data-size="lg"></sherpa-icon>
<sherpa-icon name="circle-xmark"         data-status="critical" data-size="lg"></sherpa-icon>
<sherpa-icon name="circle-info"          data-status="info"     data-size="lg"></sherpa-icon>`,
  },
];

const inputRadioExamples = [
  {
    label: 'States',
    layout: 'col',
    html: `<sherpa-input-radio data-label="Standard"  name="ex-radio" value="standard" checked></sherpa-input-radio>
<sherpa-input-radio data-label="Express"   name="ex-radio" value="express"></sherpa-input-radio>
<sherpa-input-radio data-label="Overnight" name="ex-radio" value="overnight" disabled></sherpa-input-radio>`,
  },
];

const inputTagExamples = [
  {
    label: 'Pre-populated tags',
    layout: 'block',
    html: `<sherpa-input-tag data-label="Topics" data-value="design,system,ui" data-helper="Press Enter to add a tag."></sherpa-input-tag>`,
  },
];

const inputTimeExamples = [
  {
    label: 'Basic',
    layout: 'block',
    html: `<sherpa-input-time data-label="Meeting time" value="09:30"></sherpa-input-time>`,
  },
];

const inputDateRangeExamples = [
  {
    label: 'Reporting window',
    layout: 'block',
    html: `<sherpa-input-date-range data-label="Reporting window" data-helper="Inclusive of both dates."></sherpa-input-date-range>`,
  },
];

const listItemExamples = [
  {
    label: 'Variants',
    layout: 'col',
    html: `<sherpa-list-item data-label="Plain item"></sherpa-list-item>
<sherpa-list-item data-label="With description" data-description="Last updated 2 mins ago"></sherpa-list-item>
<sherpa-list-item data-label="With icon"        data-description="online · EU" data-icon="fa-solid fa-server"></sherpa-list-item>
<sherpa-list-item data-label="Interactive"      data-icon="fa-solid fa-gauge"  data-interactive></sherpa-list-item>
<sherpa-list-item data-label="Active"           data-icon="fa-solid fa-star"   data-interactive data-active></sherpa-list-item>`,
  },
  {
    label: 'Status',
    layout: 'col',
    html: `<sherpa-list-item data-label="Build succeeded"      data-description="2 mins ago"   data-status="success"></sherpa-list-item>
<sherpa-list-item data-label="High CPU usage"        data-description="12 mins ago"  data-status="warning"></sherpa-list-item>
<sherpa-list-item data-label="SSL certificate expiring" data-description="5 days"    data-status="critical"></sherpa-list-item>`,
  },
];

const listPanelExamples = [
  {
    label: 'Filterable list panel',
    description: 'List panel adds search filtering across slotted sherpa-list-items.',
    layout: 'block',
    html: `<sherpa-list-panel data-heading="Devices" data-match="sherpa-list-item" data-empty="No devices match your search.">
  <sherpa-list data-variant="divided">
    <sherpa-list-item data-label="Acme device 01"   data-description="online · EU"  data-interactive></sherpa-list-item>
    <sherpa-list-item data-label="Acme device 02"   data-description="offline · US" data-interactive></sherpa-list-item>
    <sherpa-list-item data-label="Beta probe 14"    data-description="online · EU"  data-interactive></sherpa-list-item>
    <sherpa-list-item data-label="Gamma sensor 09"  data-description="warning · APAC" data-interactive></sherpa-list-item>
    <sherpa-list-item data-label="Delta gateway 03" data-description="online · US"  data-interactive></sherpa-list-item>
  </sherpa-list>
</sherpa-list-panel>`,
  },
];

const navSectionExamples = [
  {
    label: 'Section navigation',
    layout: 'block',
    html: `<sherpa-nav-section>
  <sherpa-list-item data-label="Overview" data-icon="fa-solid fa-house"    data-interactive data-active></sherpa-list-item>
  <sherpa-list-item data-label="Devices"  data-icon="fa-solid fa-server"   data-interactive></sherpa-list-item>
  <sherpa-list-item data-label="Alerts"   data-icon="fa-solid fa-bell"     data-interactive></sherpa-list-item>
  <sherpa-list-item data-label="Settings" data-icon="fa-solid fa-gear"     data-interactive></sherpa-list-item>
</sherpa-nav-section>`,
  },
];

const progressTrackerExamples = [
  {
    label: 'Multi-step progress',
    layout: 'block',
    html: `<sherpa-progress-tracker>
  <sherpa-list-item data-label="Submitted" data-status="complete"></sherpa-list-item>
  <sherpa-list-item data-label="Review"    data-status="active"></sherpa-list-item>
  <sherpa-list-item data-label="Approved"  data-status="pending"></sherpa-list-item>
  <sherpa-list-item data-label="Deployed"  data-status="pending"></sherpa-list-item>
</sherpa-progress-tracker>`,
  },
];

const navExamples = [
  {
    label: 'Primary sidebar nav',
    layout: 'block',
    html: `<sherpa-nav style="height: 360px;">
  <sherpa-nav-item data-label="Dashboard" data-icon="fa-solid fa-gauge"       data-active></sherpa-nav-item>
  <sherpa-nav-item data-label="Devices"   data-icon="fa-solid fa-server"></sherpa-nav-item>
  <sherpa-nav-item data-label="Reports"   data-icon="fa-solid fa-chart-line"></sherpa-nav-item>
  <sherpa-nav-item data-label="Alerts"    data-icon="fa-solid fa-bell"></sherpa-nav-item>
  <sherpa-nav-item data-label="Settings"  data-icon="fa-solid fa-gear"></sherpa-nav-item>
</sherpa-nav>`,
  },
  {
    label: 'With footer promo',
    layout: 'block',
    html: `<sherpa-nav style="height: 360px;"
  data-promo-title="Upgrade to Pro"
  data-promo-message="Unlock advanced analytics and reporting."
  data-promo-link-text="Learn more"
  data-promo-link-url="#"
></sherpa-nav>`,
  },
];

const navItemExamples = [
  {
    label: 'States',
    layout: 'col',
    html: `<sherpa-nav-item data-label="Dashboard" data-icon="fa-solid fa-gauge"></sherpa-nav-item>
<sherpa-nav-item data-label="Devices"   data-icon="fa-solid fa-server"  data-active></sherpa-nav-item>
<sherpa-nav-item data-label="Reports"   data-icon="fa-solid fa-chart-line" disabled></sherpa-nav-item>`,
  },
];

const containerExamples = [
  {
    label: 'Basic container',
    layout: 'block',
    html: `<sherpa-container data-heading="Devices">
  <p>Container body content. Containers compose a header and a content region.</p>
</sherpa-container>`,
  },
];

const containerHeaderExamples = [
  {
    label: 'Header with actions',
    layout: 'block',
    html: `<sherpa-container-header data-label="Devices" data-description="6 active">
  <sherpa-button slot="actions" data-variant="primary" data-size="small" data-label="Add device" data-icon-start="fa-solid fa-plus"></sherpa-button>
</sherpa-container-header>`,
  },
];

const contentSectionExamples = [
  {
    label: 'Side panel section',
    layout: 'block',
    html: `<sherpa-content-section data-heading="Filters" data-position="left" data-restore-label="Filters">
  <sherpa-input-search data-label="Search" placeholder="Filter…"></sherpa-input-search>
  <p>Side-panel sections can be collapsed and restored from the host layout.</p>
</sherpa-content-section>`,
  },
];

const panelExamples = [
  {
    label: 'Basic panel',
    layout: 'block',
    html: `<sherpa-panel data-heading="Recent activity">
  <p>Panels wrap related content with a heading and optional actions.</p>
</sherpa-panel>`,
  },
];

const layoutGridExamples = [
  {
    label: '3-column grid',
    description: 'sherpa-layout-grid is a 12/6/3 dashboard grid for resizable containers.',
    layout: 'block',
    html: `<sherpa-layout-grid data-columns="3" data-gap="md">
  <sherpa-card data-label="Card A" data-elevation="sm"><p>Body A</p></sherpa-card>
  <sherpa-card data-label="Card B" data-elevation="sm"><p>Body B</p></sherpa-card>
  <sherpa-card data-label="Card C" data-elevation="sm"><p>Body C</p></sherpa-card>
</sherpa-layout-grid>`,
  },
];

const layoutViewExamples = [
  {
    label: 'View shell',
    layout: 'block',
    html: `<sherpa-layout-view data-heading="Dashboard" style="height: 360px;">
  <sherpa-button slot="header-actions" data-variant="primary" data-size="small" data-label="Add device" data-icon-start="fa-solid fa-plus"></sherpa-button>
  <p>Layout view provides a scrollable content column with header actions slotted in.</p>
</sherpa-layout-view>`,
  },
];

const footerExamples = [
  {
    label: 'Dialog footer',
    layout: 'block',
    html: `<sherpa-footer>
  <sherpa-button data-variant="tertiary" data-label="Cancel"></sherpa-button>
  <sherpa-button data-variant="primary"  data-label="Save"></sherpa-button>
</sherpa-footer>`,
  },
];

const productBarExamples = [
  {
    label: 'Brand bar',
    layout: 'block',
    html: `<sherpa-product-bar data-label="Acme Console"></sherpa-product-bar>`,
  },
];

const productBarV2Examples = [
  {
    label: 'Brand bar v2',
    layout: 'block',
    html: `<sherpa-product-bar-v2 data-label="Acme Console"></sherpa-product-bar-v2>`,
  },
];

const filterBarExamples = [
  {
    label: 'Filter chips',
    layout: 'block',
    html: `<sherpa-filter-bar>
  <sherpa-button data-variant="tertiary" data-label="Status: online" data-icon-end="fa-solid fa-xmark"></sherpa-button>
  <sherpa-button data-variant="tertiary" data-label="Region: EU"     data-icon-end="fa-solid fa-xmark"></sherpa-button>
  <sherpa-button data-variant="tertiary" data-label="Type: probe"    data-icon-end="fa-solid fa-xmark"></sherpa-button>
  <sherpa-button data-variant="tertiary" data-label="Clear all"></sherpa-button>
</sherpa-filter-bar>`,
  },
];

// ── Data viz ────────────────────────────────────────────────────────────────

const dataGridExamples = [
  {
    label: 'Devices grid',
    description: 'sherpa-data-grid is populated programmatically via setData({ rows, columns }).',
    layout: 'block',
    html: `<sherpa-data-grid data-density="base" style="height: 320px;"></sherpa-data-grid>`,
    setup(root) {
      const grid = find(root, 'sherpa-data-grid');
      grid?.setData?.({ rows: SAMPLE_ROWS, columns: SAMPLE_COLUMNS });
    },
  },
];

const barchartExamples = [
  {
    label: 'Categorical bars',
    layout: 'block',
    html: `<sherpa-barchart data-category="category" data-value-field="value" data-orientation="vertical" style="height: 240px;"></sherpa-barchart>`,
    setup(root) {
      const el = find(root, 'sherpa-barchart');
      el?.setData?.({ rows: CATEGORICAL_DATA });
    },
  },
];

const lineChartExamples = [
  {
    label: 'Time series',
    layout: 'block',
    html: `<sherpa-line-chart data-category="date" data-value-field="value" style="height: 240px;"></sherpa-line-chart>`,
    setup(root) {
      const el = find(root, 'sherpa-line-chart');
      el?.setData?.({ rows: TIME_SERIES });
    },
  },
];

const donutChartExamples = [
  {
    label: 'Categorical donut',
    layout: 'block',
    html: `<sherpa-donut-chart data-category="category" data-value-field="value" style="height: 240px;"></sherpa-donut-chart>`,
    setup(root) {
      const el = find(root, 'sherpa-donut-chart');
      el?.setData?.({ rows: CATEGORICAL_DATA });
    },
  },
];

const gaugeChartExamples = [
  {
    label: 'Single value gauge',
    layout: 'block',
    html: `<sherpa-gauge-chart data-value-field="value" data-min="0" data-max="100" style="height: 200px;"></sherpa-gauge-chart>`,
    setup(root) {
      const el = find(root, 'sherpa-gauge-chart');
      el?.setData?.({ rows: [{ value: 72 }] });
    },
  },
];

const sparklineExamples = [
  {
    label: 'Inline sparkline',
    layout: 'block',
    html: `<sherpa-sparkline data-value-field="value" style="width: 200px; height: 48px;"></sherpa-sparkline>`,
    setup(root) {
      const el = find(root, 'sherpa-sparkline');
      el?.setData?.({ rows: TIME_SERIES });
    },
  },
];

const chartLegendExamples = [
  {
    label: 'Series legend',
    layout: 'block',
    html: `<sherpa-chart-legend>
  <span data-color="#0066cc">Email</span>
  <span data-color="#7c3aed">Direct</span>
  <span data-color="#16a34a">Social</span>
  <span data-color="#ea580c">Search</span>
</sherpa-chart-legend>`,
  },
];

// Replace the simple inputSelect with one that uses setOptions (more realistic)
const inputSelectWithSetupExamples = [
  ...inputSelectExamples,
  {
    label: 'Options via setOptions()',
    description: 'For large or dynamic option lists, set the options programmatically.',
    layout: 'block',
    html: `<sherpa-input-select data-label="Fruit" data-placeholder="Pick one…"></sherpa-input-select>`,
    setup(root) {
      const el = find(root, 'sherpa-input-select');
      el?.setOptions?.(SAMPLE_SELECT_OPTIONS);
    },
  },
];

const transferListExamples = [
  {
    label: 'Two-pane transfer',
    description: 'Items can be moved between the available and selected lists.',
    layout: 'block',
    html: `<sherpa-transfer-list data-label-source="Available" data-label-target="Selected" style="height: 280px;"></sherpa-transfer-list>`,
    setup(root) {
      const el = find(root, 'sherpa-transfer-list');
      el?.setOptions?.(TRANSFER_OPTIONS);
    },
  },
];

// ── Overlays ────────────────────────────────────────────────────────────────

const dialogExamples = [
  {
    label: 'Confirmation dialog',
    description: 'Use .show() to open the dialog modally.',
    layout: 'block',
    html: `<sherpa-button data-variant="primary" data-label="Open dialog" data-icon-start="fa-solid fa-play"></sherpa-button>

<sherpa-dialog data-label="Confirm action" data-description="Deploy configuration to all devices?" data-size="medium">
  <p>This will deploy your configuration to all devices in the selected region.</p>
  <sherpa-callout slot="footer" data-status="warning" data-label="Once started, this action cannot be cancelled."></sherpa-callout>
</sherpa-dialog>`,
    setup(root) {
      const dialog = find(root, 'sherpa-dialog');
      const btn    = find(root, 'sherpa-button');
      btn?.addEventListener('button-click', () => dialog?.show?.());
    },
  },
];

const popoverExamples = [
  {
    label: 'Toggle popover',
    layout: 'block',
    html: `<sherpa-button data-variant="secondary" data-label="Toggle popover"></sherpa-button>

<sherpa-popover data-label="Popover heading">
  <p>Popover body content. Anchor it to any trigger element.</p>
</sherpa-popover>`,
    setup(root) {
      const pop = find(root, 'sherpa-popover');
      const btn = find(root, 'sherpa-button');
      btn?.addEventListener('button-click', () => pop?.toggleAttribute('data-open'));
    },
  },
];

const menuExamples = [
  {
    label: 'Action menu',
    layout: 'block',
    html: `<sherpa-button data-variant="tertiary" data-label="More" data-icon-end="fa-solid fa-caret-down"></sherpa-button>

<sherpa-menu>
  <sherpa-menu-item data-label="Edit"      data-icon="fa-solid fa-pen"></sherpa-menu-item>
  <sherpa-menu-item data-label="Duplicate" data-icon="fa-solid fa-copy"></sherpa-menu-item>
  <sherpa-menu-item data-label="Delete"    data-icon="fa-solid fa-trash" data-status="critical"></sherpa-menu-item>
</sherpa-menu>`,
    setup(root) {
      const menu = find(root, 'sherpa-menu');
      const btn  = find(root, 'sherpa-button');
      btn?.addEventListener('button-click', () => menu?.show?.(btn));
    },
  },
];

const menuItemExamples = [
  {
    label: 'Variants',
    layout: 'col',
    html: `<sherpa-menu-item data-label="Edit"        data-icon="fa-solid fa-pen"></sherpa-menu-item>
<sherpa-menu-item data-label="Duplicate"   data-icon="fa-solid fa-copy"></sherpa-menu-item>
<sherpa-menu-item data-label="Delete"      data-icon="fa-solid fa-trash" data-status="critical"></sherpa-menu-item>
<sherpa-menu-item data-label="Disabled"    data-icon="fa-solid fa-ban" disabled></sherpa-menu-item>`,
  },
];

const toastExamples = [
  {
    label: 'Fire toasts',
    description: 'Toasts are dispatched from the SherpaToast static API.',
    layout: 'row',
    html: `<sherpa-button data-variant="secondary" data-status="success"  data-label="Success"></sherpa-button>
<sherpa-button data-variant="secondary" data-status="warning"  data-label="Warning"></sherpa-button>
<sherpa-button data-variant="secondary" data-status="critical" data-label="Critical"></sherpa-button>
<sherpa-button data-variant="secondary" data-status="info"     data-label="Info"></sherpa-button>`,
    async setup(root) {
      const mod = await import('../components/sherpa-toast/sherpa-toast.js');
      const SherpaToast = mod.SherpaToast || mod.default;
      const variants = ['success', 'warning', 'critical', 'info'];
      root.querySelectorAll('sherpa-button').forEach((btn, i) => {
        btn.addEventListener('button-click', () => {
          SherpaToast?.[variants[i]]?.(`This is a ${variants[i]} toast.`);
        });
      });
    },
  },
];

const tooltipExamples = [
  {
    label: 'Hover for tooltip',
    layout: 'block',
    html: `<sherpa-button data-variant="secondary" data-label="Hover me"></sherpa-button>`,
    async setup(root) {
      const mod = await import('../components/sherpa-tooltip/sherpa-tooltip.js');
      const SherpaTooltip = mod.SherpaTooltip || mod.default;
      const btn = find(root, 'sherpa-button');
      btn?.addEventListener('mouseenter', () => {
        SherpaTooltip?.show?.(btn, 'Hello from sherpa-tooltip.', { position: 'top' });
      });
      btn?.addEventListener('mouseleave', () => SherpaTooltip?.hide?.());
    },
  },
];

// ── AI / chat ───────────────────────────────────────────────────────────────

const chatMessageExamples = [
  {
    label: 'Assistant + user',
    layout: 'col',
    html: `<sherpa-chat-message data-author="Assistant" data-timestamp="just now">
  <p>Hi! How can I help you today?</p>
</sherpa-chat-message>
<sherpa-chat-message data-author="You" data-author-variant="user" data-timestamp="now">
  <p>Summarise yesterday's alerts.</p>
</sherpa-chat-message>`,
  },
];

const promptComposerExamples = [
  {
    label: 'Prompt input',
    layout: 'block',
    html: `<sherpa-prompt-composer data-placeholder="Ask anything…"></sherpa-prompt-composer>`,
  },
];

const aiPanelExamples = [
  {
    label: 'AI panel',
    layout: 'block',
    html: `<sherpa-ai-panel data-heading="Sherpa Assistant" style="height: 360px;">
  <sherpa-chat-message data-author="Assistant" data-timestamp="just now">
    <p>Hi! Ask me about your devices or alerts.</p>
  </sherpa-chat-message>
  <sherpa-prompt-composer slot="composer" data-placeholder="Ask anything…"></sherpa-prompt-composer>
</sherpa-ai-panel>`,
  },
];

// ── Node graph ──────────────────────────────────────────────────────────────

const nodeExamples = [
  {
    label: 'Single node',
    layout: 'block',
    html: `<sherpa-node data-label="Filter rows" data-x="20" data-y="20" style="position: relative; height: 180px; display:block;">
  <sherpa-node-header slot="header" data-label="Filter rows" data-icon="fa-solid fa-filter"></sherpa-node-header>
  <sherpa-node-row data-label="input">
    <sherpa-node-socket slot="left" data-direction="in"></sherpa-node-socket>
  </sherpa-node-row>
  <sherpa-node-row data-label="output">
    <sherpa-node-socket slot="right" data-direction="out"></sherpa-node-socket>
  </sherpa-node-row>
</sherpa-node>`,
  },
];

const nodeHeaderExamples = [
  {
    label: 'Header',
    layout: 'block',
    html: `<sherpa-node-header data-label="Filter rows" data-icon="fa-solid fa-filter"></sherpa-node-header>`,
  },
];

const nodeRowExamples = [
  {
    label: 'Row with sockets',
    layout: 'block',
    html: `<sherpa-node-row data-label="input → output">
  <sherpa-node-socket slot="left"  data-direction="in"></sherpa-node-socket>
  <sherpa-node-socket slot="right" data-direction="out"></sherpa-node-socket>
</sherpa-node-row>`,
  },
];

const nodeSocketExamples = [
  {
    label: 'Directions',
    layout: 'row',
    html: `<sherpa-node-socket data-direction="in"></sherpa-node-socket>
<sherpa-node-socket data-direction="out"></sherpa-node-socket>`,
  },
];

const nodeCanvasExamples = [
  {
    label: 'Two connected nodes',
    layout: 'block',
    html: `<sherpa-node-canvas style="height: 360px;">
  <sherpa-node data-label="Source" data-x="40"  data-y="40">
    <sherpa-node-header slot="header" data-label="Source" data-icon="fa-solid fa-database"></sherpa-node-header>
    <sherpa-node-row data-label="rows">
      <sherpa-node-socket slot="right" data-direction="out" id="src-out"></sherpa-node-socket>
    </sherpa-node-row>
  </sherpa-node>
  <sherpa-node data-label="Sink" data-x="280" data-y="80">
    <sherpa-node-header slot="header" data-label="Sink" data-icon="fa-solid fa-flag-checkered"></sherpa-node-header>
    <sherpa-node-row data-label="input">
      <sherpa-node-socket slot="left" data-direction="in" id="sink-in"></sherpa-node-socket>
    </sherpa-node-row>
  </sherpa-node>
</sherpa-node-canvas>`,
  },
];

// ── Scheduler / proposal / pdf-exporter ────────────────────────────────────

const schedulerExamples = [
  {
    label: 'Week scheduler',
    layout: 'block',
    html: `<sherpa-scheduler data-view="week" data-date="2026-05-18" style="height: 420px;"></sherpa-scheduler>`,
  },
];

const proposalOpExamples = [
  {
    label: 'Single operation',
    layout: 'block',
    html: `<sherpa-proposal-op data-label="Add rate limit on /api/login" data-status="warning" data-description="Throttle to 5 req/min/IP."></sherpa-proposal-op>`,
  },
];

const proposalPreviewExamples = [
  {
    label: 'Proposal summary',
    layout: 'block',
    html: `<sherpa-proposal-preview data-label="Security hardening" data-description="3 proposed changes">
  <sherpa-proposal-op data-label="Add rate limit on /api/login" data-status="warning"></sherpa-proposal-op>
  <sherpa-proposal-op data-label="Rotate API keys"              data-status="info"></sherpa-proposal-op>
  <sherpa-proposal-op data-label="Disable legacy TLS"           data-status="critical"></sherpa-proposal-op>
</sherpa-proposal-preview>`,
  },
];

const pdfExporterExamples = [
  {
    label: 'Export trigger',
    description: 'Wraps a printable region and provides a button to export it.',
    layout: 'block',
    html: `<sherpa-container-pdf-exporter data-label="Export to PDF">
  <sherpa-container data-heading="Devices">
    <sherpa-metric data-label="Total devices" data-value="1,284" data-trend="up" data-trend-value="+12%"></sherpa-metric>
  </sherpa-container>
</sherpa-container-pdf-exporter>`,
  },
];

// ── Exports ───────────────────────────────────────────────────────────────────

export const EXAMPLES = {
  // Controls
  'sherpa-button':        buttonExamples,
  'sherpa-tag':           tagExamples,
  'sherpa-switch':        switchExamples,
  'sherpa-progress-bar':  progressBarExamples,
  'sherpa-pagination':    paginationExamples,
  'sherpa-loader':        loaderExamples,
  'sherpa-slider':        sliderExamples,
  'sherpa-stepper':       stepperExamples,

  // Inputs
  'sherpa-input-text':           inputTextExamples,
  'sherpa-input-select':         inputSelectWithSetupExamples,
  'sherpa-input-checkbox':       inputCheckboxExamples,
  'sherpa-input-checkbox-group': inputCheckboxGroupExamples,
  'sherpa-input-radio':          inputRadioExamples,
  'sherpa-input-radio-group':    inputRadioGroupExamples,
  'sherpa-input-search':         inputSearchExamples,
  'sherpa-input-number':         inputNumberExamples,
  'sherpa-input-password':       inputPasswordExamples,
  'sherpa-input-date':           inputDateExamples,
  'sherpa-input-date-range':     inputDateRangeExamples,
  'sherpa-input-time':           inputTimeExamples,
  'sherpa-input-tag':            inputTagExamples,
  'sherpa-file-upload':          fileUploadExamples,
  'sherpa-transfer-list':        transferListExamples,

  // Feedback & Overlays
  'sherpa-callout':    calloutExamples,
  'sherpa-message':    messageExamples,
  'sherpa-empty-state': emptyStateExamples,
  'sherpa-accordion':  accordionExamples,
  'sherpa-tabs':       tabsExamples,
  'sherpa-list':       listExamples,
  'sherpa-list-item':  listItemExamples,
  'sherpa-list-panel': listPanelExamples,
  'sherpa-dialog':     dialogExamples,
  'sherpa-popover':    popoverExamples,
  'sherpa-menu':       menuExamples,
  'sherpa-menu-item':  menuItemExamples,
  'sherpa-toast':      toastExamples,
  'sherpa-tooltip':    tooltipExamples,
  'sherpa-progress-tracker': progressTrackerExamples,

  // Layout & Navigation
  'sherpa-breadcrumbs':       breadcrumbsExamples,
  'sherpa-section-header':    sectionHeaderExamples,
  'sherpa-nav-section':       navSectionExamples,
  'sherpa-toolbar':           toolbarExamples,
  'sherpa-view-header':       viewHeaderExamples,
  'sherpa-nav':               navExamples,
  'sherpa-nav-item':          navItemExamples,
  'sherpa-container':         containerExamples,
  'sherpa-container-header':  containerHeaderExamples,
  'sherpa-content-section':   contentSectionExamples,
  'sherpa-panel':             panelExamples,
  'sherpa-layout-grid':       layoutGridExamples,
  'sherpa-layout-view':       layoutViewExamples,
  'sherpa-footer':            footerExamples,
  'sherpa-product-bar':       productBarExamples,
  'sherpa-product-bar-v2':    productBarV2Examples,
  'sherpa-filter-bar':        filterBarExamples,
  'sherpa-container-pdf-exporter': pdfExporterExamples,

  // Content
  'sherpa-card':          cardExamples,
  'sherpa-metric':        metricExamples,
  'sherpa-key-value-list': keyValueListExamples,
  'sherpa-icon':          iconExamples,

  // Data viz
  'sherpa-data-grid':    dataGridExamples,
  'sherpa-barchart':     barchartExamples,
  'sherpa-line-chart':   lineChartExamples,
  'sherpa-donut-chart':  donutChartExamples,
  'sherpa-gauge-chart':  gaugeChartExamples,
  'sherpa-sparkline':    sparklineExamples,
  'sherpa-chart-legend': chartLegendExamples,

  // AI / chat
  'sherpa-chat-message':    chatMessageExamples,
  'sherpa-prompt-composer': promptComposerExamples,
  'sherpa-ai-panel':        aiPanelExamples,

  // Node graph
  'sherpa-node':         nodeExamples,
  'sherpa-node-header':  nodeHeaderExamples,
  'sherpa-node-row':     nodeRowExamples,
  'sherpa-node-socket':  nodeSocketExamples,
  'sherpa-node-canvas':  nodeCanvasExamples,

  // Domain
  'sherpa-scheduler':         schedulerExamples,
  'sherpa-proposal-op':       proposalOpExamples,
  'sherpa-proposal-preview':  proposalPreviewExamples,
};
