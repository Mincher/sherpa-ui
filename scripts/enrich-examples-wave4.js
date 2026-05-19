#!/usr/bin/env node
/**
 * Wave 4 enrichment — data-viz, overlays, AI/chat, node graph, domain.
 *
 * Two modes:
 *   REPLACE — overwrite file (used for components without existing setups)
 *   APPEND  — keep existing setup-dependent template, append code-only variants
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'components');

const header = (tag) => `<!--
  ${tag} — Live examples.
-->\n`;

/** Components whose existing examples.html only has variant markup — safe to overwrite. */
const REPLACE = {

'sherpa-metric': `
<template data-label="KPI cards">
  <sherpa-metric data-label="Total devices" data-value="1,284" data-trend="up"   data-trend-value="+12%"></sherpa-metric>
  <sherpa-metric data-label="Uptime"        data-value="99.97%" data-trend="flat" data-status="success"></sherpa-metric>
  <sherpa-metric data-label="Open alerts"   data-value="7"      data-trend="up"   data-status="warning"></sherpa-metric>
</template>

<template data-label="Trend directions">
  <sherpa-metric data-label="Revenue"  data-value="$48.2k" data-trend="up"   data-trend-value="+8.4%"></sherpa-metric>
  <sherpa-metric data-label="Churn"    data-value="2.1%"   data-trend="down" data-trend-value="-0.3 pp"></sherpa-metric>
  <sherpa-metric data-label="Sessions" data-value="12,400" data-trend="flat" data-trend-value="0%"></sherpa-metric>
</template>

<template data-label="Status variants">
  <sherpa-metric data-label="Healthy"   data-value="312" data-status="success"></sherpa-metric>
  <sherpa-metric data-label="At risk"   data-value="14"  data-status="warning"></sherpa-metric>
  <sherpa-metric data-label="Failing"   data-value="3"   data-status="critical"></sherpa-metric>
  <sherpa-metric data-label="Urgent"    data-value="1"   data-status="urgent"></sherpa-metric>
</template>

<template data-label="Inside containers" data-layout="block">
  <sherpa-container data-col-span="4" style="max-width: 320px;">
    <sherpa-container-header data-title="Devices online"></sherpa-container-header>
    <sherpa-metric data-label="Devices online" data-value="1,284" data-trend="up" data-trend-value="+12 since yesterday"></sherpa-metric>
  </sherpa-container>
</template>
`,

'sherpa-chart-legend': `
<template data-label="Series legend" data-layout="block">
  <sherpa-chart-legend>
    <span data-color="#0066cc">Email</span>
    <span data-color="#7c3aed">Direct</span>
    <span data-color="#16a34a">Social</span>
    <span data-color="#ea580c">Search</span>
  </sherpa-chart-legend>
</template>

<template data-label="Vertical orientation" data-layout="block">
  <sherpa-chart-legend data-orientation="vertical">
    <span data-color="var(--sherpa-data-viz-1)">North</span>
    <span data-color="var(--sherpa-data-viz-2)">South</span>
    <span data-color="var(--sherpa-data-viz-3)">East</span>
    <span data-color="var(--sherpa-data-viz-4)">West</span>
  </sherpa-chart-legend>
</template>

<template data-label="Loading" data-layout="block">
  <sherpa-chart-legend data-loading></sherpa-chart-legend>
</template>
`,

'sherpa-chat-message': `
<template data-label="Assistant + user" data-layout="col">
  <sherpa-chat-message data-author="Assistant" data-timestamp="just now">
    <p>Hi! How can I help you today?</p>
  </sherpa-chat-message>
  <sherpa-chat-message data-author="You" data-author-variant="user" data-timestamp="now">
    <p>Summarise yesterday's alerts.</p>
  </sherpa-chat-message>
</template>

<template data-label="Multi-turn conversation" data-layout="col">
  <sherpa-chat-message data-author="Assistant" data-timestamp="10:42">
    <p>Yesterday there were 12 alerts. 9 resolved automatically, 3 still need attention:</p>
    <ul>
      <li>acme-device-01 — high CPU at 23:14</li>
      <li>beta-probe-14 — offline since 18:02</li>
      <li>edge-router-9  — checksum mismatch on deploy</li>
    </ul>
  </sherpa-chat-message>
  <sherpa-chat-message data-author="You" data-author-variant="user" data-timestamp="10:43">
    <p>Open a ticket for beta-probe-14.</p>
  </sherpa-chat-message>
  <sherpa-chat-message data-author="Assistant" data-timestamp="10:43">
    <p>Ticket <strong>SUP-2841</strong> created and assigned to the Networking team.</p>
  </sherpa-chat-message>
</template>

<template data-label="With custom avatar icon" data-layout="col">
  <sherpa-chat-message data-author="Sherpa AI" data-avatar-icon="fa-solid fa-sparkles" data-timestamp="now">
    <p>Here is a summary of today's activity.</p>
  </sherpa-chat-message>
</template>
`,

'sherpa-prompt-composer': `
<template data-label="Default" data-layout="block">
  <sherpa-prompt-composer data-placeholder="Ask anything…"></sherpa-prompt-composer>
</template>

<template data-label="With pre-filled prompt" data-layout="block">
  <sherpa-prompt-composer data-placeholder="Ask anything…" value="Summarise yesterday's alerts"></sherpa-prompt-composer>
</template>

<template data-label="Disabled" data-layout="block">
  <sherpa-prompt-composer data-placeholder="Sending…" data-disabled></sherpa-prompt-composer>
</template>

<template data-label="Tall composer" data-description="data-max-height caps how tall the textarea can grow." data-layout="block">
  <sherpa-prompt-composer data-placeholder="Write a long prompt…" data-max-height="240"></sherpa-prompt-composer>
</template>
`,

'sherpa-ai-panel': `
<template data-label="Inline panel" data-layout="block">
  <sherpa-ai-panel data-heading="Sherpa Assistant" style="height: 360px;">
    <sherpa-chat-message data-author="Assistant" data-timestamp="just now">
      <p>Hi! Ask me about your devices, alerts, or deploys.</p>
    </sherpa-chat-message>
    <sherpa-prompt-composer slot="composer" data-placeholder="Ask anything…"></sherpa-prompt-composer>
  </sherpa-ai-panel>
</template>

<template data-label="Busy state" data-description="data-busy shows a loader while a response is being generated." data-layout="block">
  <sherpa-ai-panel data-heading="Sherpa Assistant" data-busy style="height: 320px;">
    <sherpa-chat-message data-author="You" data-author-variant="user" data-timestamp="now">
      <p>Generate this week's status report.</p>
    </sherpa-chat-message>
    <sherpa-prompt-composer slot="composer" data-placeholder="Working…" data-disabled></sherpa-prompt-composer>
  </sherpa-ai-panel>
</template>

<template data-label="Expanded with archive" data-layout="block">
  <sherpa-ai-panel data-heading="Sherpa Assistant" data-can-archive data-expanded style="height: 360px;">
    <sherpa-chat-message data-author="Assistant" data-timestamp="just now">
      <p>Ready when you are.</p>
    </sherpa-chat-message>
    <sherpa-prompt-composer slot="composer" data-placeholder="Ask anything…"></sherpa-prompt-composer>
  </sherpa-ai-panel>
</template>
`,

'sherpa-nav': `
<template data-label="Primary sidebar nav" data-layout="block">
  <sherpa-nav style="height: 360px;">
    <sherpa-nav-item data-label="Dashboard" data-icon="fa-solid fa-gauge"        data-state="active"></sherpa-nav-item>
    <sherpa-nav-item data-label="Devices"   data-icon="fa-solid fa-server"></sherpa-nav-item>
    <sherpa-nav-item data-label="Reports"   data-icon="fa-solid fa-chart-line"></sherpa-nav-item>
    <sherpa-nav-item data-label="Alerts"    data-icon="fa-solid fa-bell" data-badge="7" data-badge-status="critical"></sherpa-nav-item>
    <sherpa-nav-item data-label="Settings"  data-icon="fa-solid fa-gear"></sherpa-nav-item>
  </sherpa-nav>
</template>

<template data-label="Grouped sections" data-layout="block">
  <sherpa-nav style="height: 420px;">
    <sherpa-nav-item data-label="Overview" data-icon="fa-solid fa-house" data-state="active"></sherpa-nav-item>
    <sherpa-nav-section data-heading="Monitor"
      data-sections='[
        {"id":"devices","label":"Devices","icon":"fa-solid fa-server"},
        {"id":"alerts","label":"Alerts","icon":"fa-solid fa-bell","badge":"7","badgeStatus":"critical"},
        {"id":"logs","label":"Logs","icon":"fa-solid fa-file-lines"}
      ]'>
    </sherpa-nav-section>
    <sherpa-nav-section data-heading="Admin"
      data-sections='[
        {"id":"users","label":"Users","icon":"fa-solid fa-users"},
        {"id":"billing","label":"Billing","icon":"fa-solid fa-credit-card"},
        {"id":"settings","label":"Settings","icon":"fa-solid fa-gear"}
      ]'>
    </sherpa-nav-section>
  </sherpa-nav>
</template>

<template data-label="With footer promo" data-layout="block">
  <sherpa-nav style="height: 360px;"
    data-promo-title="Upgrade to Pro"
    data-promo-message="Unlock advanced analytics and reporting."
    data-promo-link-text="Learn more"
    data-promo-link-url="#">
    <sherpa-nav-item data-label="Dashboard" data-icon="fa-solid fa-gauge" data-state="active"></sherpa-nav-item>
    <sherpa-nav-item data-label="Devices"   data-icon="fa-solid fa-server"></sherpa-nav-item>
    <sherpa-nav-item data-label="Settings"  data-icon="fa-solid fa-gear"></sherpa-nav-item>
  </sherpa-nav>
</template>
`,

'sherpa-scheduler': `
<template data-label="Default" data-layout="block">
  <sherpa-scheduler data-frequency="daily"></sherpa-scheduler>
</template>

<template data-label="All frequencies" data-layout="col">
  <sherpa-scheduler data-frequency="once"></sherpa-scheduler>
  <sherpa-scheduler data-frequency="hourly"></sherpa-scheduler>
  <sherpa-scheduler data-frequency="weekly"></sherpa-scheduler>
  <sherpa-scheduler data-frequency="monthly"></sherpa-scheduler>
</template>
`,

'sherpa-proposal-op': `
<template data-label="Operation types" data-layout="col">
  <sherpa-proposal-op data-op="add"        data-label="Add device acme-edge-09"></sherpa-proposal-op>
  <sherpa-proposal-op data-op="update"     data-label="Update region for acme-device-01 to EU"></sherpa-proposal-op>
  <sherpa-proposal-op data-op="remove"     data-label="Remove device beta-probe-14"></sherpa-proposal-op>
  <sherpa-proposal-op data-op="add-edge"    data-label="Connect acme-edge-09 → core-router-1"></sherpa-proposal-op>
  <sherpa-proposal-op data-op="remove-edge" data-label="Disconnect beta-probe-14 → core-router-2"></sherpa-proposal-op>
</template>
`,

'sherpa-proposal-preview': `
<template data-label="Default" data-layout="block">
  <sherpa-proposal-preview data-rationale="Suggested changes to bring your network into the desired baseline.">
    <sherpa-proposal-op data-op="add"    data-label="Add device acme-edge-09"></sherpa-proposal-op>
    <sherpa-proposal-op data-op="update" data-label="Update region for acme-device-01 to EU"></sherpa-proposal-op>
    <sherpa-proposal-op data-op="remove" data-label="Remove device beta-probe-14"></sherpa-proposal-op>
  </sherpa-proposal-preview>
</template>

<template data-label="With graph operations" data-layout="block">
  <sherpa-proposal-preview data-rationale="Rebalance edge traffic to reduce cross-region hops.">
    <sherpa-proposal-op data-op="add-edge"    data-label="Connect acme-edge-09 → core-router-1"></sherpa-proposal-op>
    <sherpa-proposal-op data-op="remove-edge" data-label="Disconnect beta-probe-14 → core-router-2"></sherpa-proposal-op>
  </sherpa-proposal-preview>
</template>
`,

'sherpa-node-row': `
<template data-label="Default" data-layout="col">
  <sherpa-node-row>
    <span>Input value</span>
  </sherpa-node-row>
  <sherpa-node-row data-multi>
    <span>Multi-connection row</span>
  </sherpa-node-row>
</template>
`,

'sherpa-node-header': `
<template data-label="Default" data-layout="col">
  <sherpa-node-header data-icon="fa-solid fa-database">Source node</sherpa-node-header>
  <sherpa-node-header data-icon="fa-solid fa-calculator" data-drill-down>Math op</sherpa-node-header>
</template>
`,

'sherpa-node-socket': `
<template data-label="Directions" data-layout="col">
  <sherpa-node-socket data-direction="input"  data-port-name="value-in"></sherpa-node-socket>
  <sherpa-node-socket data-direction="output" data-port-name="value-out"></sherpa-node-socket>
</template>

<template data-label="Connection states" data-layout="col">
  <sherpa-node-socket data-direction="input"  data-port-name="connected"   data-connected data-connection-count="1"></sherpa-node-socket>
  <sherpa-node-socket data-direction="output" data-port-name="multi"       data-multi data-connected data-connection-count="3"></sherpa-node-socket>
  <sherpa-node-socket data-direction="output" data-port-name="flow-active" data-connected data-flow-active></sherpa-node-socket>
</template>
`,

'sherpa-node': `
<template data-label="Source node" data-layout="block">
  <sherpa-node data-kind="source" data-node-id="src-01" data-x="40" data-y="40">
    <sherpa-node-header data-icon="fa-solid fa-database">Devices</sherpa-node-header>
    <sherpa-node-row><span>id</span></sherpa-node-row>
    <sherpa-node-row><span>region</span></sherpa-node-row>
    <sherpa-node-row><span>status</span></sherpa-node-row>
  </sherpa-node>
</template>

<template data-label="Math node with subtype" data-layout="block">
  <sherpa-node data-kind="math" data-node-id="math-01" data-x="40" data-y="40"
    data-subtypes='[{"value":"sum","label":"Sum"},{"value":"avg","label":"Average"},{"value":"min","label":"Min"},{"value":"max","label":"Max"}]'
    data-subtype="avg" data-subtype-label="Average">
    <sherpa-node-header data-icon="fa-solid fa-calculator">Aggregate</sherpa-node-header>
    <sherpa-node-row><sherpa-node-socket data-direction="input"  data-port-name="value"></sherpa-node-socket><span>value</span></sherpa-node-row>
    <sherpa-node-row><sherpa-node-socket data-direction="output" data-port-name="result"></sherpa-node-socket><span>result</span></sherpa-node-row>
  </sherpa-node>
</template>

<template data-label="Selected" data-layout="block">
  <sherpa-node data-kind="variable" data-node-id="var-01" data-x="40" data-y="40" data-selected>
    <sherpa-node-header data-icon="fa-solid fa-square-root-variable">Threshold</sherpa-node-header>
    <sherpa-node-row><span>80</span></sherpa-node-row>
  </sherpa-node>
</template>
`,

'sherpa-node-canvas': `
<template data-label="Node canvas" data-description="Composes node primitives into a graph editor." data-layout="block">
  <sherpa-node-canvas data-heading="Pipeline" data-show-header data-grid style="height: 360px;">
    <sherpa-node data-kind="source" data-node-id="src" data-x="40" data-y="60">
      <sherpa-node-header data-icon="fa-solid fa-database">Devices</sherpa-node-header>
      <sherpa-node-row><sherpa-node-socket data-direction="output" data-port-name="rows"></sherpa-node-socket><span>rows</span></sherpa-node-row>
    </sherpa-node>
    <sherpa-node data-kind="math" data-node-id="agg" data-x="280" data-y="60" data-subtype="avg" data-subtype-label="Average">
      <sherpa-node-header data-icon="fa-solid fa-calculator">Aggregate</sherpa-node-header>
      <sherpa-node-row><sherpa-node-socket data-direction="input"  data-port-name="value"></sherpa-node-socket><span>value</span></sherpa-node-row>
      <sherpa-node-row><sherpa-node-socket data-direction="output" data-port-name="result"></sherpa-node-socket><span>result</span></sherpa-node-row>
    </sherpa-node>
  </sherpa-node-canvas>
</template>
`,

'sherpa-container-pdf-exporter': `
<template data-label="Print-ready wrapper" data-description="Wrap any container or layout in this element to enable PDF/print export." data-layout="block">
  <sherpa-container-pdf-exporter data-title="Weekly device report">
    <sherpa-container>
      <sherpa-container-header data-title="Devices online" data-description="Snapshot exported for the print/PDF pipeline."></sherpa-container-header>
      <sherpa-metric data-label="Online" data-value="1,284" data-status="success"></sherpa-metric>
    </sherpa-container>
  </sherpa-container-pdf-exporter>
</template>
`,

};

/** Append code-only variants (no setup, preview-only is fine because dialog/popover need triggers). */
const APPEND = {

'sherpa-toast': `
<template data-label="Positions" data-description="Set data-position on the SherpaToast singleton or per call." data-preview="false">
  <sherpa-toast data-status="info" data-label="Top right (default)" data-position="top-right"></sherpa-toast>
  <sherpa-toast data-status="info" data-label="Top center"          data-position="top-center"></sherpa-toast>
  <sherpa-toast data-status="info" data-label="Bottom right"        data-position="bottom-right"></sherpa-toast>
</template>

<template data-label="With value and timer" data-preview="false">
  <sherpa-toast data-status="success" data-label="Uploaded" data-value="report.pdf" data-duration="5000" data-timer-dismiss></sherpa-toast>
</template>
`,

'sherpa-dialog': `
<template data-label="Size variants — markup only" data-preview="false">
  <sherpa-dialog data-label="Small dialog"  data-size="small"  data-dismissible></sherpa-dialog>
  <sherpa-dialog data-label="Medium dialog" data-size="medium" data-dismissible></sherpa-dialog>
  <sherpa-dialog data-label="Large dialog"  data-size="large"  data-dismissible></sherpa-dialog>
  <sherpa-dialog data-label="Full screen"   data-size="full"   data-dismissible></sherpa-dialog>
</template>

<template data-label="Status header" data-preview="false">
  <sherpa-dialog data-label="Delete device?" data-subtitle="acme-device-01" data-size="small" data-status="critical" data-dismissible>
    <p>This will permanently remove the device and its configuration. This action cannot be undone.</p>
    <sherpa-button slot="footer" data-variant="secondary" data-label="Cancel"></sherpa-button>
    <sherpa-button slot="footer" data-variant="primary"   data-status="critical" data-label="Delete"></sherpa-button>
  </sherpa-dialog>
</template>

<template data-label="Wizard template" data-preview="false">
  <sherpa-dialog data-label="Connect a new device" data-template="wizard" data-page="1" data-pages="3" data-finish-label="Connect" data-dismissible>
    <p>Step 1 — Choose the device type.</p>
  </sherpa-dialog>
</template>
`,

'sherpa-popover': `
<template data-label="Positions" data-preview="false">
  <sherpa-popover data-heading="Top"    data-position="top">    <p>Anchored to the top of the trigger.</p></sherpa-popover>
  <sherpa-popover data-heading="Bottom" data-position="bottom"> <p>Anchored to the bottom of the trigger.</p></sherpa-popover>
  <sherpa-popover data-heading="Left"   data-position="left">   <p>Anchored to the left of the trigger.</p></sherpa-popover>
  <sherpa-popover data-heading="Right"  data-position="right">  <p>Anchored to the right of the trigger.</p></sherpa-popover>
</template>

<template data-label="Paged template" data-preview="false">
  <sherpa-popover data-heading="Onboarding" data-template="paged" data-page="1" data-pages="3">
    <p>Page 1 of a multi-step popover walkthrough.</p>
  </sherpa-popover>
</template>
`,

'sherpa-data-grid': `
<template data-label="Compact density" data-description="Use data-density=&quot;compact&quot; to fit more rows per screen." data-preview="false">
  <sherpa-data-grid data-density="compact" style="height: 320px;"></sherpa-data-grid>
</template>

<template data-label="Comfortable density" data-preview="false">
  <sherpa-data-grid data-density="comfortable" style="height: 320px;"></sherpa-data-grid>
</template>
`,

'sherpa-barchart': `
<template data-label="Horizontal orientation" data-preview="false">
  <sherpa-barchart data-category="category" data-value-field="value" data-orientation="horizontal" style="height: 240px;"></sherpa-barchart>
</template>

<template data-label="Stacked series" data-preview="false">
  <sherpa-barchart data-category="month" data-value-field="value" data-series="region" data-stack style="height: 240px;"></sherpa-barchart>
</template>
`,

'sherpa-line-chart': `
<template data-label="Multi-series" data-preview="false">
  <sherpa-line-chart data-category="date" data-value-field="value" data-series="region" style="height: 240px;"></sherpa-line-chart>
</template>

<template data-label="With area fill" data-preview="false">
  <sherpa-line-chart data-category="date" data-value-field="value" data-area style="height: 240px;"></sherpa-line-chart>
</template>
`,

'sherpa-donut-chart': `
<template data-label="With center label" data-preview="false">
  <sherpa-donut-chart data-category="category" data-value-field="value" data-center-label="Total" style="height: 240px;"></sherpa-donut-chart>
</template>
`,

'sherpa-gauge-chart': `
<template data-label="With thresholds" data-preview="false">
  <sherpa-gauge-chart data-value-field="value" data-min="0" data-max="100" data-thresholds="60,85" style="height: 200px;"></sherpa-gauge-chart>
</template>
`,

'sherpa-sparkline': `
<template data-label="With trend tint" data-preview="false">
  <sherpa-sparkline data-value-field="value" data-status="success" style="width: 200px; height: 48px;"></sherpa-sparkline>
  <sherpa-sparkline data-value-field="value" data-status="critical" style="width: 200px; height: 48px;"></sherpa-sparkline>
</template>
`,

};

let n = 0;
for (const [tag, body] of Object.entries(REPLACE)) {
  await fs.writeFile(path.join(ROOT, tag, `${tag}.examples.html`), header(tag) + body.trimStart(), 'utf8');
  console.log(`✓ replaced ${tag}`);
  n++;
}
for (const [tag, body] of Object.entries(APPEND)) {
  const file = path.join(ROOT, tag, `${tag}.examples.html`);
  const existing = await fs.readFile(file, 'utf8');
  await fs.writeFile(file, existing.trimEnd() + '\n\n' + body.trimStart(), 'utf8');
  console.log(`✓ appended ${tag}`);
  n++;
}
console.log(`\nWrote/updated ${n} files.`);
