#!/usr/bin/env node
/**
 * Wave 1 enrichment — overwrite atom / input / feedback components with richer
 * example sets. Each file gets multiple <template> blocks covering variants,
 * sizes, states, status, and common composition patterns.
 *
 * Run:  node scripts/enrich-examples-wave1.js
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'components');

const header = (tag) => `<!--
  ${tag} — Live examples.
  Each <template> renders one example block in the docs site (docs/router.js).
  Attributes:
    data-label       (required) example heading
    data-description (optional) one-line summary
    data-layout      (optional) row (default) | col | block
    data-preview     (optional) "false" → hide live preview, show code only
    data-setup       (optional) name of an exported setup fn from ${tag}.examples.js
-->\n`;

/** @type {Record<string, string>} */
const FILES = {

'sherpa-input-text': `
<template data-label="Default">
  <sherpa-input-text data-label="First name" placeholder="Ada"></sherpa-input-text>
</template>

<template data-label="With description and helper" data-description="data-description sits below the label; data-helper sits below the field.">
  <sherpa-input-text
    data-label="Email"
    data-description="We will only contact you about account changes."
    data-helper="Use the address you signed up with."
    placeholder="you@example.com">
  </sherpa-input-text>
</template>

<template data-label="Layouts" data-description="Stacked is the default; horizontal puts the label on the left.">
  <sherpa-input-text data-label="Stacked"    data-layout="stacked"    placeholder="Stacked layout"></sherpa-input-text>
  <sherpa-input-text data-label="Horizontal" data-layout="horizontal" placeholder="Label on the left"></sherpa-input-text>
</template>

<template data-label="Required and pre-filled">
  <sherpa-input-text data-label="Username" required value="ada-lovelace"></sherpa-input-text>
</template>

<template data-label="Disabled and readonly">
  <sherpa-input-text data-label="Disabled" value="Cannot edit" disabled></sherpa-input-text>
  <sherpa-input-text data-label="Readonly" value="Read only"   readonly></sherpa-input-text>
</template>

<template data-label="Status states" data-description="data-status drives the border and helper-text colour.">
  <sherpa-input-text data-label="Critical" data-status="critical" data-helper="Password is too short."  value="abc"></sherpa-input-text>
  <sherpa-input-text data-label="Warning"  data-status="warning"  data-helper="Check this value."        value="!!"></sherpa-input-text>
  <sherpa-input-text data-label="Success"  data-status="success"  data-helper="Looks good."              value="ada@dev"></sherpa-input-text>
</template>

<template data-label="Multiline" data-description="Renders as a textarea while keeping the same label / helper API.">
  <sherpa-input-text
    data-label="Notes"
    data-multiline
    placeholder="Type a longer note…"
    rows="4">
  </sherpa-input-text>
</template>
`,

'sherpa-input-checkbox': `
<template data-label="States" data-layout="col">
  <sherpa-input-checkbox data-label="Unchecked"></sherpa-input-checkbox>
  <sherpa-input-checkbox data-label="Checked" checked></sherpa-input-checkbox>
  <sherpa-input-checkbox data-label="Indeterminate" indeterminate></sherpa-input-checkbox>
  <sherpa-input-checkbox data-label="Disabled" disabled></sherpa-input-checkbox>
  <sherpa-input-checkbox data-label="Disabled checked" checked disabled></sherpa-input-checkbox>
</template>

<template data-label="With description" data-layout="col">
  <sherpa-input-checkbox
    data-label="Subscribe to product updates"
    data-description="Once a month — no spam, unsubscribe anytime.">
  </sherpa-input-checkbox>
</template>

<template data-label="Required" data-layout="col">
  <sherpa-input-checkbox data-label="I accept the terms" required></sherpa-input-checkbox>
</template>

<template data-label="Status states" data-layout="col">
  <sherpa-input-checkbox data-label="Critical" data-status="critical" data-description="This selection is invalid."></sherpa-input-checkbox>
  <sherpa-input-checkbox data-label="Warning"  data-status="warning"  data-description="Double-check this option." checked></sherpa-input-checkbox>
  <sherpa-input-checkbox data-label="Success"  data-status="success"  data-description="Verified." checked></sherpa-input-checkbox>
</template>
`,

'sherpa-input-radio': `
<template data-label="States" data-layout="col">
  <sherpa-input-radio name="ex-states" data-label="Unselected"></sherpa-input-radio>
  <sherpa-input-radio name="ex-states" data-label="Selected" checked></sherpa-input-radio>
  <sherpa-input-radio name="ex-states" data-label="Disabled" disabled></sherpa-input-radio>
  <sherpa-input-radio name="ex-states" data-label="Disabled selected" checked disabled></sherpa-input-radio>
</template>

<template data-label="With description" data-layout="col">
  <sherpa-input-radio
    name="ex-desc"
    data-label="Free plan"
    data-description="1 user, 1 GB storage, community support."
    checked>
  </sherpa-input-radio>
  <sherpa-input-radio
    name="ex-desc"
    data-label="Pro plan"
    data-description="Unlimited users, 1 TB storage, priority support.">
  </sherpa-input-radio>
</template>

<template data-label="Status" data-layout="col">
  <sherpa-input-radio name="ex-status" data-label="Critical" data-status="critical"></sherpa-input-radio>
  <sherpa-input-radio name="ex-status" data-label="Warning"  data-status="warning"></sherpa-input-radio>
  <sherpa-input-radio name="ex-status" data-label="Success"  data-status="success" checked></sherpa-input-radio>
</template>
`,

'sherpa-switch': `
<template data-label="On and off">
  <sherpa-switch data-label="Enable notifications"></sherpa-switch>
  <sherpa-switch data-label="Enabled" checked></sherpa-switch>
</template>

<template data-label="Disabled">
  <sherpa-switch data-label="Off (disabled)" disabled></sherpa-switch>
  <sherpa-switch data-label="On (disabled)"  checked disabled></sherpa-switch>
</template>

<template data-label="With description" data-layout="col">
  <sherpa-switch
    data-label="Email digest"
    data-description="Weekly summary of activity in your account.">
  </sherpa-switch>
  <sherpa-switch
    data-label="Two-factor auth"
    data-description="Require a code from your authenticator app on sign-in."
    checked>
  </sherpa-switch>
</template>
`,

'sherpa-callout': `
<template data-label="Status variants" data-layout="col">
  <sherpa-callout data-status="info"     data-heading="Heads up"          data-label="A new region is available in the deployment dropdown."></sherpa-callout>
  <sherpa-callout data-status="success"  data-heading="Saved"             data-label="Your changes were saved successfully."></sherpa-callout>
  <sherpa-callout data-status="warning"  data-heading="Approaching limit" data-label="You are using 92% of your monthly quota."></sherpa-callout>
  <sherpa-callout data-status="critical" data-heading="Action required"   data-label="One device has been offline for more than 24 hours."></sherpa-callout>
  <sherpa-callout data-status="neutral"  data-heading="FYI"               data-label="Maintenance window scheduled for Sunday 02:00 UTC."></sherpa-callout>
  <sherpa-callout data-status="tip"      data-heading="Tip"               data-label="Press ⌘K from anywhere to open the command palette."></sherpa-callout>
</template>

<template data-label="Dismissible" data-description="data-dismissible renders a close button that hides the callout.">
  <sherpa-callout data-status="info" data-heading="Welcome to Sherpa UI" data-label="Take the product tour to see what's new." data-dismissible></sherpa-callout>
</template>

<template data-label="Expanded with body content" data-description="Default-slot content sits below the heading / label.">
  <sherpa-callout data-status="warning" data-heading="Deploy paused" data-label="Two devices reported a checksum mismatch." data-expanded>
    <p>The following devices need attention before the deploy can resume:</p>
    <ul>
      <li>acme-device-01 — region EU</li>
      <li>beta-probe-14 — region APAC</li>
    </ul>
  </sherpa-callout>
</template>

<template data-label="Custom icon">
  <sherpa-callout data-status="info" data-icon="fa-solid fa-rocket" data-heading="New release" data-label="v2.4.0 includes 12 bug fixes and 3 new components."></sherpa-callout>
</template>
`,

'sherpa-card': `
<template data-label="Basic">
  <sherpa-card data-label="Standard card" data-description="A card pairs a label and description with optional slotted content."></sherpa-card>
</template>

<template data-label="Elevation" data-description="Elevation controls the drop-shadow depth.">
  <sherpa-card data-label="None" data-description="No shadow."           data-elevation="none"></sherpa-card>
  <sherpa-card data-label="Small" data-description="Subtle shadow."      data-elevation="sm"></sherpa-card>
  <sherpa-card data-label="Medium" data-description="Standard shadow."   data-elevation="md"></sherpa-card>
  <sherpa-card data-label="Large" data-description="Pronounced shadow."  data-elevation="lg"></sherpa-card>
</template>

<template data-label="Interactive" data-description="data-interactive turns the card into a focusable surface with hover / focus states.">
  <sherpa-card data-label="Click me" data-description="Hover and tab to see the states." data-interactive></sherpa-card>
</template>

<template data-label="Selectable" data-description="data-selectable + data-selected drives the selected visual.">
  <sherpa-card data-label="Standard plan" data-description="Single workspace, 5 GB storage." data-selectable></sherpa-card>
  <sherpa-card data-label="Pro plan"      data-description="Unlimited workspaces, 1 TB storage." data-selectable data-selected></sherpa-card>
</template>

<template data-label="Disabled">
  <sherpa-card data-label="Disabled card" data-description="Cannot be interacted with." data-interactive disabled></sherpa-card>
</template>
`,

'sherpa-icon': `
<template data-label="Sizes" data-description="Twelve preset sizes from 3xs to 6xl.">
  <sherpa-icon name="star" data-size="2xs"></sherpa-icon>
  <sherpa-icon name="star" data-size="xs"></sherpa-icon>
  <sherpa-icon name="star" data-size="sm"></sherpa-icon>
  <sherpa-icon name="star" data-size="md"></sherpa-icon>
  <sherpa-icon name="star" data-size="lg"></sherpa-icon>
  <sherpa-icon name="star" data-size="xl"></sherpa-icon>
  <sherpa-icon name="star" data-size="2xl"></sherpa-icon>
  <sherpa-icon name="star" data-size="3xl"></sherpa-icon>
</template>

<template data-label="Status colours">
  <sherpa-icon name="circle-check"          data-size="xl" data-status="success"></sherpa-icon>
  <sherpa-icon name="triangle-exclamation"  data-size="xl" data-status="warning"></sherpa-icon>
  <sherpa-icon name="circle-xmark"          data-size="xl" data-status="critical"></sherpa-icon>
  <sherpa-icon name="circle-info"           data-size="xl" data-status="info"></sherpa-icon>
  <sherpa-icon name="bell"                  data-size="xl" data-status="urgent"></sherpa-icon>
  <sherpa-icon name="sparkles"              data-size="xl" data-status="brand"></sherpa-icon>
</template>

<template data-label="Weights" data-description="Font Awesome weight families.">
  <sherpa-icon name="house" data-size="xl" data-weight="regular"></sherpa-icon>
  <sherpa-icon name="house" data-size="xl" data-weight="light"></sherpa-icon>
  <sherpa-icon name="house" data-size="xl" data-weight="thin"></sherpa-icon>
  <sherpa-icon name="house" data-size="xl" data-weight="duotone"></sherpa-icon>
</template>
`,

'sherpa-loader': `
<template data-label="Sizes">
  <sherpa-loader data-size="small"  data-label="Loading…"></sherpa-loader>
  <sherpa-loader data-size="default" data-label="Loading…"></sherpa-loader>
  <sherpa-loader data-size="large"  data-label="Loading…"></sherpa-loader>
</template>

<template data-label="Orientation">
  <sherpa-loader data-orientation="horizontal" data-label="Fetching data…"></sherpa-loader>
  <sherpa-loader data-orientation="vertical"   data-label="Fetching data…"></sherpa-loader>
</template>

<template data-label="Panel" data-description="data-panel renders the loader inside a bordered surface for use as a full-region loading state." data-layout="block">
  <sherpa-loader data-panel data-label="Loading workspace…" style="height: 160px;"></sherpa-loader>
</template>
`,

'sherpa-tooltip': `
<template data-label="Positions" data-description="data-position controls the side the tooltip is anchored to.">
  <sherpa-tooltip data-position="top"    data-visible>Top tooltip</sherpa-tooltip>
  <sherpa-tooltip data-position="bottom" data-visible>Bottom tooltip</sherpa-tooltip>
  <sherpa-tooltip data-position="left"   data-visible>Left tooltip</sherpa-tooltip>
  <sherpa-tooltip data-position="right"  data-visible>Right tooltip</sherpa-tooltip>
</template>

<template data-label="Imperative API" data-description="Most usage goes through SherpaTooltip.show(target, text)." data-layout="block" data-setup="tooltip-0">
  <sherpa-button data-variant="secondary" data-label="Hover me"></sherpa-button>
</template>
`,

'sherpa-progress-bar': `
<template data-label="Determinate" data-layout="col">
  <sherpa-progress-bar data-label="Upload"   data-value="25"></sherpa-progress-bar>
  <sherpa-progress-bar data-label="Sync"     data-value="60"></sherpa-progress-bar>
  <sherpa-progress-bar data-label="Complete" data-value="100"></sherpa-progress-bar>
</template>

<template data-label="Indeterminate" data-description="Use for operations of unknown duration.">
  <sherpa-progress-bar data-label="Working…" data-variant="indeterminate"></sherpa-progress-bar>
</template>

<template data-label="Status colours" data-layout="col">
  <sherpa-progress-bar data-label="In progress" data-value="40" data-status-text="40% complete"></sherpa-progress-bar>
  <sherpa-progress-bar data-label="Warning"     data-value="80" data-status-text="Approaching limit" data-status="warning"></sherpa-progress-bar>
  <sherpa-progress-bar data-label="Critical"    data-value="95" data-status-text="Almost full"        data-status="critical"></sherpa-progress-bar>
  <sherpa-progress-bar data-label="Success"     data-value="100" data-status-text="Done"              data-status="success"></sherpa-progress-bar>
</template>
`,

'sherpa-pagination': `
<template data-label="Basic" data-layout="block">
  <sherpa-pagination data-total-rows="150" data-page="1" data-page-size="20"></sherpa-pagination>
</template>

<template data-label="Mid-range page" data-layout="block">
  <sherpa-pagination data-total-rows="1240" data-page="12" data-page-size="20"></sherpa-pagination>
</template>

<template data-label="Custom page sizes" data-description="data-allowed-sizes is a comma-separated list shown in the size selector." data-layout="block">
  <sherpa-pagination data-total-rows="500" data-page="1" data-page-size="25" data-allowed-sizes="10,25,50,100"></sherpa-pagination>
</template>

<template data-label="Compact density" data-layout="block">
  <sherpa-pagination data-total-rows="150" data-page="1" data-page-size="20" data-density="compact"></sherpa-pagination>
</template>
`,

'sherpa-accordion': `
<template data-label="Multiple panels" data-layout="col">
  <sherpa-accordion data-label="What is Sherpa UI?" open>
    <p>Sherpa UI is a Web Component design system built on progressive enhancement. HTML owns structure, CSS owns presentation, and JS owns data and events.</p>
  </sherpa-accordion>
  <sherpa-accordion data-label="How do I install it?">
    <p>Copy the components directory into your project and import the component you need. No build step required.</p>
  </sherpa-accordion>
  <sherpa-accordion data-label="Does it support dark mode?">
    <p>Yes — set <code>data-mode="dark"</code> on the root element, or <code>data-mode="auto"</code> to follow the system preference.</p>
  </sherpa-accordion>
</template>

<template data-label="With icons" data-layout="col">
  <sherpa-accordion data-label="Billing"  data-icon="fa-solid fa-credit-card" open>
    <p>Manage your plan, payment methods, and invoices here.</p>
  </sherpa-accordion>
  <sherpa-accordion data-label="Security" data-icon="fa-solid fa-lock">
    <p>Two-factor authentication, API keys, and session management.</p>
  </sherpa-accordion>
  <sherpa-accordion data-label="Notifications" data-icon="fa-solid fa-bell">
    <p>Configure email, push, and in-app notification preferences.</p>
  </sherpa-accordion>
</template>

<template data-label="Disabled" data-layout="col">
  <sherpa-accordion data-label="Locked section" data-icon="fa-solid fa-lock" disabled>
    <p>This content will not be reachable until the disabled attribute is removed.</p>
  </sherpa-accordion>
</template>
`,

'sherpa-tabs': `
<template data-label="Basic" data-description="Each direct child with data-tab-label becomes a tab panel." data-layout="block">
  <sherpa-tabs>
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
  </sherpa-tabs>
</template>

<template data-label="Pre-selected tab" data-description="data-active-tab opens the tabs on a specific panel." data-layout="block">
  <sherpa-tabs data-active-tab="2">
    <div data-tab-label="Step 1"><p>Step 1 content.</p></div>
    <div data-tab-label="Step 2"><p>Step 2 content.</p></div>
    <div data-tab-label="Step 3"><p>Step 3 starts active.</p></div>
  </sherpa-tabs>
</template>

<template data-label="Lazy panel rendering" data-description="data-load-mode=&quot;lazy&quot; defers panel rendering until activated." data-layout="block">
  <sherpa-tabs data-load-mode="lazy">
    <div data-tab-label="Cheap"><p>Always rendered.</p></div>
    <div data-tab-label="Expensive"><p>Only rendered on first activation.</p></div>
  </sherpa-tabs>
</template>
`,

};

let written = 0;
for (const [tag, body] of Object.entries(FILES)) {
  const file = path.join(ROOT, tag, `${tag}.examples.html`);
  await fs.writeFile(file, header(tag) + body.trimStart(), 'utf8');
  console.log(`✓ ${tag}`);
  written++;
}
console.log(`\nWrote ${written} files.`);
