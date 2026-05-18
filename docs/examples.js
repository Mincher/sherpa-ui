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
  'sherpa-input-select':         inputSelectExamples,
  'sherpa-input-checkbox':       inputCheckboxExamples,
  'sherpa-input-checkbox-group': inputCheckboxGroupExamples,
  'sherpa-input-radio-group':    inputRadioGroupExamples,
  'sherpa-input-search':         inputSearchExamples,
  'sherpa-input-number':         inputNumberExamples,
  'sherpa-input-password':       inputPasswordExamples,
  'sherpa-input-date':           inputDateExamples,
  'sherpa-file-upload':          fileUploadExamples,

  // Feedback & Overlays
  'sherpa-callout':    calloutExamples,
  'sherpa-message':    messageExamples,
  'sherpa-empty-state': emptyStateExamples,
  'sherpa-accordion':  accordionExamples,
  'sherpa-tabs':       tabsExamples,
  'sherpa-list':       listExamples,

  // Layout & Navigation
  'sherpa-breadcrumbs':    breadcrumbsExamples,
  'sherpa-section-header': sectionHeaderExamples,
  'sherpa-toolbar':        toolbarExamples,
  'sherpa-view-header':    viewHeaderExamples,

  // Content
  'sherpa-card':          cardExamples,
  'sherpa-metric':        metricExamples,
  'sherpa-key-value-list': keyValueListExamples,
};
