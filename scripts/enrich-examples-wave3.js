#!/usr/bin/env node
/** Wave 3 enrichment — containers, chrome, content, list/menu/nav. */
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'components');

const header = (tag) => `<!--
  ${tag} — Live examples.
-->\n`;

const FILES = {

'sherpa-container': `
<template data-label="Default (fit)" data-description="Wraps any block of content with the standard surface, border and padding." data-layout="block">
  <sherpa-container>
    <sherpa-container-header data-title="Devices" data-description="Overview of recent activity"></sherpa-container-header>
    <p style="padding: 16px;">Container body content.</p>
  </sherpa-container>
</template>

<template data-label="State — loading" data-layout="block">
  <sherpa-container data-state="loading">
    <sherpa-container-header data-title="Loading…"></sherpa-container-header>
    <div style="height: 120px;"></div>
  </sherpa-container>
</template>

<template data-label="State — empty" data-layout="block">
  <sherpa-container data-state="empty">
    <sherpa-container-header data-title="Devices"></sherpa-container-header>
    <sherpa-empty-state data-label="No devices yet" data-description="Add your first device to get started."></sherpa-empty-state>
  </sherpa-container>
</template>

<template data-label="State — error" data-layout="block">
  <sherpa-container data-state="error">
    <sherpa-container-header data-title="Devices"></sherpa-container-header>
    <sherpa-empty-state data-label="Something went wrong" data-description="We could not load the device list." data-illustration="error"></sherpa-empty-state>
  </sherpa-container>
</template>

<template data-label="Editable + menu" data-layout="block">
  <sherpa-container data-editable>
    <sherpa-container-header data-title="Editable card" data-description="Drag, menu, and resize affordances appear" data-menu-button data-drag-handle></sherpa-container-header>
    <p style="padding: 16px;">Editable container body.</p>
  </sherpa-container>
</template>
`,

'sherpa-container-header': `
<template data-label="Title only" data-layout="block">
  <sherpa-container-header data-title="Devices"></sherpa-container-header>
</template>

<template data-label="Title and description" data-layout="block">
  <sherpa-container-header data-title="Devices" data-description="All devices reporting in the last 24 hours."></sherpa-container-header>
</template>

<template data-label="With actions slot" data-layout="block">
  <sherpa-container-header data-title="Devices" data-description="All devices in your account.">
    <sherpa-button slot="actions" data-variant="secondary" data-size="small" data-label="Filter" data-icon-start="fa-solid fa-filter"></sherpa-button>
    <sherpa-button slot="actions" data-variant="primary"   data-size="small" data-label="Add device" data-icon-start="fa-solid fa-plus"></sherpa-button>
  </sherpa-container-header>
</template>

<template data-label="With external link + menu" data-layout="block">
  <sherpa-container-header data-title="API usage" data-description="Last 30 days" data-open-external data-menu-button></sherpa-container-header>
</template>
`,

'sherpa-panel': `
<template data-label="Inline panel" data-layout="block">
  <sherpa-panel data-variant="inline" data-position="right" data-heading="Filters" data-expanded data-width="320">
    <p style="padding: 16px;">An inline panel pushes adjacent content aside.</p>
  </sherpa-panel>
</template>

<template data-label="Overlay panel" data-description="Overlay panels float above content without reflowing the layout." data-layout="block">
  <sherpa-panel data-variant="overlay" data-position="right" data-heading="Details" data-width="360">
    <p style="padding: 16px;">Click the trigger in the host page to open.</p>
  </sherpa-panel>
</template>
`,

'sherpa-layout-grid': `
<template data-label="Basic grid" data-description="A responsive grid that arranges sherpa-container children." data-layout="block">
  <sherpa-layout-grid data-heading="Dashboard" data-row-height="120">
    <sherpa-container data-col-span="6">
      <sherpa-container-header data-title="Devices online"></sherpa-container-header>
      <sherpa-metric data-label="Devices online" data-value="1,284" data-delta="+12"></sherpa-metric>
    </sherpa-container>
    <sherpa-container data-col-span="6">
      <sherpa-container-header data-title="Alerts"></sherpa-container-header>
      <sherpa-metric data-label="Active alerts" data-value="7" data-status="critical"></sherpa-metric>
    </sherpa-container>
    <sherpa-container data-col-span="12">
      <sherpa-container-header data-title="Traffic"></sherpa-container-header>
      <p style="padding: 16px;">Chart goes here.</p>
    </sherpa-container>
  </sherpa-layout-grid>
</template>

<template data-label="Editable" data-description="data-editable enables drag-and-resize from each container's header." data-layout="block">
  <sherpa-layout-grid data-heading="Editable dashboard" data-editable data-row-height="120">
    <sherpa-container data-col-span="4" data-editable>
      <sherpa-container-header data-title="Tile A" data-drag-handle></sherpa-container-header>
    </sherpa-container>
    <sherpa-container data-col-span="4" data-editable>
      <sherpa-container-header data-title="Tile B" data-drag-handle></sherpa-container-header>
    </sherpa-container>
    <sherpa-container data-col-span="4" data-editable>
      <sherpa-container-header data-title="Tile C" data-drag-handle></sherpa-container-header>
    </sherpa-container>
  </sherpa-layout-grid>
</template>
`,

'sherpa-layout-view': `
<template data-label="Default" data-description="A wrapper that gives a view its heading, padding and gap rhythm." data-layout="block">
  <sherpa-layout-view data-heading="Settings" data-pad data-gap="base">
    <sherpa-panel data-bordered data-heading="Profile" data-expanded>
      <p>Profile section content.</p>
    </sherpa-panel>
    <sherpa-panel data-bordered data-heading="Security" data-expanded>
      <p>Security section content.</p>
    </sherpa-panel>
  </sherpa-layout-view>
</template>

<template data-label="Gap sizes" data-layout="block">
  <sherpa-layout-view data-pad data-gap="lg">
    <sherpa-panel data-bordered data-heading="Section 1" data-expanded><p>Larger gap between sections.</p></sherpa-panel>
    <sherpa-panel data-bordered data-heading="Section 2" data-expanded><p>Useful for spacious dashboards.</p></sherpa-panel>
  </sherpa-layout-view>
</template>
`,

'sherpa-footer': `
<template data-label="Action bar — default" data-layout="block">
  <sherpa-footer data-type="action-bar" data-show-cancel data-show-apply data-apply-label="Save changes"></sherpa-footer>
</template>

<template data-label="Action bar — destructive" data-layout="block">
  <sherpa-footer data-type="action-bar" data-show-cancel data-show-apply data-apply-label="Delete" data-cancel-label="Keep"></sherpa-footer>
</template>

<template data-label="Slot template" data-layout="block">
  <sherpa-footer data-type="slot">
    <sherpa-button slot="start" data-variant="tertiary" data-label="Learn more" data-icon-end="fa-solid fa-arrow-up-right"></sherpa-button>
    <sherpa-button slot="end"   data-variant="secondary" data-label="Cancel"></sherpa-button>
    <sherpa-button slot="end"   data-variant="primary"   data-label="Confirm"></sherpa-button>
  </sherpa-footer>
</template>
`,

'sherpa-product-bar': `
<template data-label="Default" data-layout="block">
  <sherpa-product-bar data-product-name="Sherpa Platform" data-product-icon="fa-solid fa-mountain-sun"></sherpa-product-bar>
</template>

<template data-label="Custom product" data-layout="block">
  <sherpa-product-bar data-product-name="Acme Cloud" data-product-icon="fa-solid fa-cloud"></sherpa-product-bar>
</template>
`,

'sherpa-filter-bar': `
<template data-label="Default" data-layout="block">
  <sherpa-filter-bar
    data-active='[{"field":"status","operator":"equals","value":"online"}]'
    data-available-fields='[
      {"name":"status","label":"Status","type":"enum","values":["online","offline","error"]},
      {"name":"region","label":"Region","type":"enum","values":["EU","US","APAC"]},
      {"name":"last_seen","label":"Last seen","type":"date"}
    ]'>
  </sherpa-filter-bar>
</template>

<template data-label="With preset filters" data-layout="block">
  <sherpa-filter-bar
    data-preset-filters='[{"label":"Online","filters":[{"field":"status","operator":"equals","value":"online"}]},{"label":"Errors","filters":[{"field":"status","operator":"equals","value":"error"}]}]'
    data-available-fields='[
      {"name":"status","label":"Status","type":"enum","values":["online","offline","error"]},
      {"name":"region","label":"Region","type":"enum","values":["EU","US","APAC"]}
    ]'>
  </sherpa-filter-bar>
</template>

<template data-label="Compact density" data-layout="block">
  <sherpa-filter-bar
    data-density="compact"
    data-active='[{"field":"region","operator":"equals","value":"EU"}]'
    data-available-fields='[{"name":"region","label":"Region","type":"enum","values":["EU","US","APAC"]}]'>
  </sherpa-filter-bar>
</template>
`,

'sherpa-empty-state': `
<template data-label="Default" data-layout="block">
  <sherpa-empty-state data-label="No devices yet" data-description="Add your first device to start monitoring."></sherpa-empty-state>
</template>

<template data-label="With illustration + action" data-layout="block">
  <sherpa-empty-state data-label="No results" data-description="Try adjusting your filters or search query." data-illustration="search" data-small-print="Search is case-insensitive.">
    <sherpa-button slot="actions" data-variant="primary" data-label="Clear filters" data-icon-start="fa-solid fa-filter-circle-xmark"></sherpa-button>
  </sherpa-empty-state>
</template>

<template data-label="Error variant" data-layout="block">
  <sherpa-empty-state data-label="Could not load data" data-description="There was a network error. Please try again." data-illustration="error">
    <sherpa-button slot="actions" data-variant="secondary" data-label="Retry" data-icon-start="fa-solid fa-rotate"></sherpa-button>
  </sherpa-empty-state>
</template>
`,

'sherpa-section-header': `
<template data-label="Primary" data-layout="block">
  <sherpa-section-header data-label="Account" data-heading-level="primary"></sherpa-section-header>
</template>

<template data-label="Secondary with divider" data-layout="block">
  <sherpa-section-header data-label="Security" data-heading-level="secondary" data-divider></sherpa-section-header>
</template>

<template data-label="Tertiary with actions" data-layout="block">
  <sherpa-section-header data-label="API tokens" data-heading-level="tertiary">
    <sherpa-button slot="actions" data-variant="primary" data-size="small" data-label="New token" data-icon-start="fa-solid fa-plus"></sherpa-button>
  </sherpa-section-header>
</template>
`,

'sherpa-view-header': `
<template data-label="Default" data-layout="block">
  <sherpa-view-header data-label="Devices"></sherpa-view-header>
</template>

<template data-label="With breadcrumbs and actions" data-layout="block">
  <sherpa-view-header
    data-label="acme-device-01"
    data-breadcrumbs='[{"label":"Home","href":"#/"},{"label":"Devices","href":"#/devices"},{"label":"acme-device-01"}]'
    data-back-button
    data-favorite>
    <sherpa-button slot="actions" data-variant="secondary" data-label="Export"></sherpa-button>
    <sherpa-button slot="actions" data-variant="primary"   data-label="Edit"></sherpa-button>
  </sherpa-view-header>
</template>

<template data-label="Edit mode" data-layout="block">
  <sherpa-view-header data-label="Dashboard" data-edit-mode></sherpa-view-header>
</template>
`,

'sherpa-toolbar': `
<template data-label="Default" data-layout="block">
  <sherpa-toolbar>
    <sherpa-button data-variant="secondary" data-size="small" data-type="icon" data-icon-start="fa-solid fa-bold"></sherpa-button>
    <sherpa-button data-variant="secondary" data-size="small" data-type="icon" data-icon-start="fa-solid fa-italic"></sherpa-button>
    <sherpa-button data-variant="secondary" data-size="small" data-type="icon" data-icon-start="fa-solid fa-underline"></sherpa-button>
    <sherpa-button data-variant="secondary" data-size="small" data-type="icon" data-icon-start="fa-solid fa-link"></sherpa-button>
  </sherpa-toolbar>
</template>

<template data-label="Actions template" data-layout="block">
  <sherpa-toolbar data-template="actions">
    <sherpa-button data-variant="secondary" data-size="small" data-label="Export" data-icon-start="fa-solid fa-download"></sherpa-button>
    <sherpa-button data-variant="secondary" data-size="small" data-label="Filter" data-icon-start="fa-solid fa-filter"></sherpa-button>
    <sherpa-button data-variant="primary"   data-size="small" data-label="Add"    data-icon-start="fa-solid fa-plus"></sherpa-button>
  </sherpa-toolbar>
</template>

<template data-label="Compact density" data-layout="block">
  <sherpa-toolbar data-density="compact">
    <sherpa-button data-variant="secondary" data-size="small" data-type="icon" data-icon-start="fa-solid fa-bold"></sherpa-button>
    <sherpa-button data-variant="secondary" data-size="small" data-type="icon" data-icon-start="fa-solid fa-italic"></sherpa-button>
  </sherpa-toolbar>
</template>
`,

'sherpa-menu': `
<template data-label="Default" data-layout="block">
  <sherpa-menu>
    <sherpa-menu-item data-action="rename" data-icon="fa-solid fa-pen-to-square">Rename</sherpa-menu-item>
    <sherpa-menu-item data-action="duplicate" data-icon="fa-solid fa-copy">Duplicate</sherpa-menu-item>
    <sherpa-menu-item data-action="delete" data-icon="fa-solid fa-trash" data-variant="critical">Delete</sherpa-menu-item>
  </sherpa-menu>
</template>

<template data-label="With heading and checkboxes" data-layout="block">
  <sherpa-menu>
    <sherpa-menu-item data-type="heading">Display</sherpa-menu-item>
    <sherpa-menu-item data-type="checkbox" data-action="show-online" checked>Show online</sherpa-menu-item>
    <sherpa-menu-item data-type="checkbox" data-action="show-offline">Show offline</sherpa-menu-item>
    <sherpa-menu-item data-type="checkbox" data-action="show-errors">Show errors</sherpa-menu-item>
  </sherpa-menu>
</template>

<template data-label="Radio group" data-layout="block">
  <sherpa-menu>
    <sherpa-menu-item data-type="heading">Sort by</sherpa-menu-item>
    <sherpa-menu-item data-type="radio" name="sort" value="name" checked>Name</sherpa-menu-item>
    <sherpa-menu-item data-type="radio" name="sort" value="updated">Last updated</sherpa-menu-item>
    <sherpa-menu-item data-type="radio" name="sort" value="status">Status</sherpa-menu-item>
  </sherpa-menu>
</template>

<template data-label="Loading" data-layout="block">
  <sherpa-menu data-loading data-loading-text="Fetching options…" style="min-width: 240px;"></sherpa-menu>
</template>
`,

'sherpa-menu-item': `
<template data-label="Default" data-layout="col">
  <sherpa-menu-item data-icon="fa-solid fa-pen-to-square" data-action="rename">Rename</sherpa-menu-item>
  <sherpa-menu-item data-icon="fa-solid fa-copy"          data-action="duplicate" data-description="Make a copy in the same workspace">Duplicate</sherpa-menu-item>
  <sherpa-menu-item data-icon="fa-solid fa-trash"         data-action="delete" data-variant="critical">Delete</sherpa-menu-item>
</template>

<template data-label="Types" data-layout="col">
  <sherpa-menu-item data-type="checkbox" checked>Checkbox</sherpa-menu-item>
  <sherpa-menu-item data-type="radio" name="ex" value="a" checked>Radio</sherpa-menu-item>
  <sherpa-menu-item data-type="toggle" checked>Toggle</sherpa-menu-item>
  <sherpa-menu-item data-type="heading">Heading</sherpa-menu-item>
</template>

<template data-label="With submenu indicator" data-layout="col">
  <sherpa-menu-item data-icon="fa-solid fa-share" data-has-submenu>Share</sherpa-menu-item>
</template>

<template data-label="Disabled" data-layout="col">
  <sherpa-menu-item data-icon="fa-solid fa-trash" disabled>Delete (no permission)</sherpa-menu-item>
</template>
`,

'sherpa-nav-item': `
<template data-label="Default" data-layout="col">
  <sherpa-nav-item data-icon="fa-solid fa-house"   data-label="Home"></sherpa-nav-item>
  <sherpa-nav-item data-icon="fa-solid fa-gauge"   data-label="Dashboard"></sherpa-nav-item>
  <sherpa-nav-item data-icon="fa-solid fa-gear"    data-label="Settings"></sherpa-nav-item>
</template>

<template data-label="Active state" data-layout="col">
  <sherpa-nav-item data-icon="fa-solid fa-gauge"  data-label="Dashboard" data-state="active"></sherpa-nav-item>
  <sherpa-nav-item data-icon="fa-solid fa-bell"   data-label="Alerts"></sherpa-nav-item>
</template>

<template data-label="With badge" data-layout="col">
  <sherpa-nav-item data-icon="fa-solid fa-bell"     data-label="Alerts"  data-badge="7" data-badge-status="critical"></sherpa-nav-item>
  <sherpa-nav-item data-icon="fa-solid fa-envelope" data-label="Inbox"   data-badge="12" data-badge-status="info"></sherpa-nav-item>
</template>

<template data-label="Variants" data-layout="col">
  <sherpa-nav-item data-icon="fa-solid fa-folder"     data-label="Section item"     data-variant="section"></sherpa-nav-item>
  <sherpa-nav-item data-icon="fa-solid fa-file"       data-label="Subsection item"  data-variant="subsection"></sherpa-nav-item>
  <sherpa-nav-item                                    data-label="Child item"       data-variant="child"></sherpa-nav-item>
</template>
`,

'sherpa-nav-section': `
<template data-label="Default" data-description="A nav-section groups a heading and a list of nav items." data-layout="block">
  <sherpa-nav-section data-heading="Workspaces" data-active-id="prod"
    data-sections='[
      {"id":"prod","label":"Production","icon":"fa-solid fa-server"},
      {"id":"staging","label":"Staging","icon":"fa-solid fa-flask"},
      {"id":"dev","label":"Development","icon":"fa-solid fa-code"}
    ]'>
  </sherpa-nav-section>
</template>

<template data-label="With back button" data-layout="block">
  <sherpa-nav-section data-heading="Acme Corp" data-show-back data-active-id="devices"
    data-sections='[
      {"id":"overview","label":"Overview","icon":"fa-solid fa-house"},
      {"id":"devices","label":"Devices","icon":"fa-solid fa-microchip","badge":"284"},
      {"id":"users","label":"Users","icon":"fa-solid fa-users"}
    ]'>
  </sherpa-nav-section>
</template>
`,

'sherpa-message': `
<template data-label="Status variants" data-layout="col">
  <sherpa-message data-status="info"     data-label="A new region is available."></sherpa-message>
  <sherpa-message data-status="success"  data-label="Settings saved."></sherpa-message>
  <sherpa-message data-status="warning"  data-label="You are approaching your quota."></sherpa-message>
  <sherpa-message data-status="critical" data-label="Two devices are offline."></sherpa-message>
  <sherpa-message data-status="urgent"   data-label="Action required: security update."></sherpa-message>
</template>

<template data-label="With action link" data-layout="col">
  <sherpa-message data-status="info" data-label="Beta features are now available." data-action-label="View" data-action-href="#/" data-action-icon="fa-solid fa-arrow-right"></sherpa-message>
</template>

<template data-label="Dismissible" data-layout="col">
  <sherpa-message data-status="success" data-label="Backup completed." data-dismissible></sherpa-message>
</template>
`,

'sherpa-key-value-list': `
<template data-label="Horizontal (default)" data-layout="block">
  <sherpa-key-value-list>
    <dt>Status</dt><dd>Online</dd>
    <dt>Region</dt><dd>EU (Frankfurt)</dd>
    <dt>Last seen</dt><dd>2 minutes ago</dd>
    <dt>IP address</dt><dd>192.0.2.42</dd>
  </sherpa-key-value-list>
</template>

<template data-label="Vertical layout" data-layout="block">
  <sherpa-key-value-list data-layout="vertical">
    <dt>Account ID</dt><dd>acc_01HZX7Y8…</dd>
    <dt>Plan</dt><dd>Pro</dd>
    <dt>Created</dt><dd>2024-03-12</dd>
  </sherpa-key-value-list>
</template>

<template data-label="Striped + bordered" data-layout="block">
  <sherpa-key-value-list data-striped data-bordered>
    <dt>CPU</dt><dd>42%</dd>
    <dt>Memory</dt><dd>3.2 GB / 8 GB</dd>
    <dt>Disk</dt><dd>112 GB / 500 GB</dd>
    <dt>Network</dt><dd>1.2 MB/s</dd>
  </sherpa-key-value-list>
</template>

<template data-label="Compact density" data-layout="block">
  <sherpa-key-value-list data-density="compact" data-striped>
    <dt>Build</dt><dd>v2.4.0</dd>
    <dt>Commit</dt><dd>83fcb2e</dd>
    <dt>Deployed</dt><dd>2 hours ago</dd>
  </sherpa-key-value-list>
</template>
`,

'sherpa-progress-tracker': `
<template data-label="Determinate" data-layout="block">
  <sherpa-progress-tracker data-heading="Deploy in progress" data-percentage="62"></sherpa-progress-tracker>
</template>

<template data-label="Near complete" data-layout="block">
  <sherpa-progress-tracker data-heading="Indexing files" data-percentage="94"></sherpa-progress-tracker>
</template>

<template data-label="Just started" data-layout="block">
  <sherpa-progress-tracker data-heading="Uploading…" data-percentage="8"></sherpa-progress-tracker>
</template>
`,

};

for (const [tag, body] of Object.entries(FILES)) {
  await fs.writeFile(path.join(ROOT, tag, `${tag}.examples.html`), header(tag) + body.trimStart(), 'utf8');
  console.log(`✓ ${tag}`);
}
