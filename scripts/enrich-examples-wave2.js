#!/usr/bin/env node
/**
 * Wave 2 enrichment — remaining form controls.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'components');

const header = (tag) => `<!--
  ${tag} — Live examples.
  Each <template> renders one example block in the docs site (docs/router.js).
-->\n`;

const FILES = {

'sherpa-input-search': `
<template data-label="Default">
  <sherpa-input-search data-label="Search devices" placeholder="Search by name or ID…"></sherpa-input-search>
</template>

<template data-label="With initial value">
  <sherpa-input-search data-label="Filter" value="acme" placeholder="Type to filter…"></sherpa-input-search>
</template>

<template data-label="Disabled">
  <sherpa-input-search data-label="Disabled" placeholder="Cannot search" disabled></sherpa-input-search>
</template>
`,

'sherpa-input-number': `
<template data-label="Default">
  <sherpa-input-number data-label="Quantity" value="1" min="0" max="100" step="1"></sherpa-input-number>
</template>

<template data-label="Decimal step">
  <sherpa-input-number data-label="Price" value="9.99" min="0" step="0.01"></sherpa-input-number>
</template>

<template data-label="Bounded range">
  <sherpa-input-number data-label="Volume" data-helper="0–11" value="7" min="0" max="11" step="1"></sherpa-input-number>
</template>

<template data-label="Disabled">
  <sherpa-input-number data-label="Locked" value="42" disabled></sherpa-input-number>
</template>
`,

'sherpa-input-password': `
<template data-label="Default">
  <sherpa-input-password data-label="Password" placeholder="At least 12 characters" data-helper="Use a mix of letters, numbers, and symbols."></sherpa-input-password>
</template>

<template data-label="Required" data-description="Browser-native validation kicks in on form submit.">
  <sherpa-input-password data-label="New password" required minlength="12"></sherpa-input-password>
</template>

<template data-label="Status — too short">
  <sherpa-input-password data-label="Password" value="abc" data-status="critical" data-helper="Password must be at least 12 characters."></sherpa-input-password>
</template>
`,

'sherpa-input-date': `
<template data-label="Default">
  <sherpa-input-date data-label="Start date" value="2026-05-18"></sherpa-input-date>
</template>

<template data-label="Bounded range">
  <sherpa-input-date data-label="Delivery date" value="2026-06-01" min="2026-05-18" max="2026-12-31" data-helper="Must be within the next six months."></sherpa-input-date>
</template>

<template data-label="Required">
  <sherpa-input-date data-label="Birth date" required></sherpa-input-date>
</template>
`,

'sherpa-input-date-range': `
<template data-label="Default">
  <sherpa-input-date-range data-label="Reporting period" data-value-start="2026-01-01" data-value-end="2026-03-31"></sherpa-input-date-range>
</template>

<template data-label="With min and max">
  <sherpa-input-date-range data-label="Travel dates" min="2026-05-18" max="2026-12-31" data-helper="Pick a start and end date within the rest of 2026."></sherpa-input-date-range>
</template>
`,

'sherpa-input-time': `
<template data-label="Default">
  <sherpa-input-time data-label="Meeting time" value="14:30"></sherpa-input-time>
</template>

<template data-label="With step">
  <sherpa-input-time data-label="Slot" value="09:00" step="900" data-helper="15-minute increments."></sherpa-input-time>
</template>
`,

'sherpa-input-tag': `
<template data-label="Default">
  <sherpa-input-tag data-label="Topics" placeholder="Type and press Enter…" data-value="design, tokens"></sherpa-input-tag>
</template>

<template data-label="Comma-separated entry">
  <sherpa-input-tag data-label="Recipients" placeholder="email@example.com, …" data-separator="," data-helper="Press Enter or comma to add."></sherpa-input-tag>
</template>

<template data-label="Capped at max tags">
  <sherpa-input-tag data-label="Categories" data-max-tags="3" data-helper="Up to 3 tags." placeholder="Add up to 3…"></sherpa-input-tag>
</template>

<template data-label="Disabled">
  <sherpa-input-tag data-label="Locked" data-value="alpha, beta" disabled></sherpa-input-tag>
</template>
`,

'sherpa-input-checkbox-group': `
<template data-label="Vertical group" data-layout="block">
  <sherpa-input-checkbox-group
    data-label="Notify me when"
    data-options='[
      {"label":"A device goes offline","value":"offline"},
      {"label":"CPU exceeds 80%","value":"cpu"},
      {"label":"A deploy completes","value":"deploy"}
    ]'
    data-value='["offline"]'>
  </sherpa-input-checkbox-group>
</template>

<template data-label="Horizontal group" data-layout="block">
  <sherpa-input-checkbox-group
    data-label="Regions"
    data-orientation="horizontal"
    data-options='[
      {"label":"EU","value":"eu"},
      {"label":"US","value":"us"},
      {"label":"APAC","value":"apac"}
    ]'
    data-value='["eu","us"]'>
  </sherpa-input-checkbox-group>
</template>

<template data-label="Required with status" data-layout="block">
  <sherpa-input-checkbox-group
    data-label="Channels"
    required
    data-status="critical"
    data-helper="Select at least one channel."
    data-options='[
      {"label":"Email","value":"email"},
      {"label":"SMS","value":"sms"},
      {"label":"Push","value":"push"}
    ]'>
  </sherpa-input-checkbox-group>
</template>
`,

'sherpa-input-radio-group': `
<template data-label="Vertical group" data-layout="block">
  <sherpa-input-radio-group
    data-label="Billing cycle"
    data-options='[
      {"label":"Monthly","value":"monthly","description":"Cancel anytime."},
      {"label":"Annual","value":"annual","description":"Two months free."},
      {"label":"Custom","value":"custom","description":"Talk to sales."}
    ]'
    data-value="annual">
  </sherpa-input-radio-group>
</template>

<template data-label="Horizontal group" data-layout="block">
  <sherpa-input-radio-group
    data-label="Size"
    data-orientation="horizontal"
    data-options='[
      {"label":"S","value":"s"},
      {"label":"M","value":"m"},
      {"label":"L","value":"l"},
      {"label":"XL","value":"xl"}
    ]'
    data-value="m">
  </sherpa-input-radio-group>
</template>

<template data-label="Required" data-layout="block">
  <sherpa-input-radio-group
    data-label="Region"
    required
    data-helper="Choose a region for your deployment."
    data-options='[
      {"label":"EU (Frankfurt)","value":"eu"},
      {"label":"US (Virginia)","value":"us"},
      {"label":"APAC (Tokyo)","value":"apac"}
    ]'>
  </sherpa-input-radio-group>
</template>
`,

'sherpa-slider': `
<template data-label="Single value" data-layout="block">
  <sherpa-slider data-label="Volume" data-min="0" data-max="100" data-value="40" data-show-inputs data-show-labels></sherpa-slider>
</template>

<template data-label="Range" data-description="data-type=&quot;range&quot; renders two thumbs." data-layout="block">
  <sherpa-slider data-label="Price range" data-type="range" data-min="0" data-max="500" data-step="10" data-value-low="100" data-value-high="350" data-show-inputs data-show-labels></sherpa-slider>
</template>

<template data-label="Disabled" data-layout="block">
  <sherpa-slider data-label="Locked" data-min="0" data-max="100" data-value="60" disabled></sherpa-slider>
</template>
`,

'sherpa-stepper': `
<template data-label="Default" data-description="data-current-step is 1-indexed." data-layout="block">
  <sherpa-stepper data-current-step="2" data-show-step-numbers="true">
    <div data-step-label="Account"></div>
    <div data-step-label="Workspace"></div>
    <div data-step-label="Billing"></div>
    <div data-step-label="Review"></div>
  </sherpa-stepper>
</template>

<template data-label="Timeline template" data-layout="block">
  <sherpa-stepper data-template="timeline" data-current-step="3">
    <div data-step-label="Requested" data-step-description="May 1, 09:00"></div>
    <div data-step-label="Approved"   data-step-description="May 1, 10:42"></div>
    <div data-step-label="Provisioning" data-step-description="In progress"></div>
    <div data-step-label="Ready"      data-step-description="Pending"></div>
  </sherpa-stepper>
</template>

<template data-label="Linear flow" data-description="data-linear blocks navigation to future steps." data-layout="block">
  <sherpa-stepper data-current-step="1" data-linear="true">
    <div data-step-label="Profile"></div>
    <div data-step-label="Team"></div>
    <div data-step-label="Plan"></div>
  </sherpa-stepper>
</template>
`,

'sherpa-breadcrumbs': `
<template data-label="Default" data-layout="block">
  <sherpa-breadcrumbs data-items='[
    {"label":"Home","href":"#/"},
    {"label":"Devices","href":"#/devices"},
    {"label":"acme-device-01"}
  ]'></sherpa-breadcrumbs>
</template>

<template data-label="Deeper hierarchy" data-layout="block">
  <sherpa-breadcrumbs data-items='[
    {"label":"Home","href":"#/"},
    {"label":"Customers","href":"#/customers"},
    {"label":"Acme Corp","href":"#/customers/acme"},
    {"label":"Devices","href":"#/customers/acme/devices"},
    {"label":"acme-device-01"}
  ]'></sherpa-breadcrumbs>
</template>
`,

'sherpa-file-upload': `
<template data-label="Default" data-layout="block">
  <sherpa-file-upload data-label="Profile photo" data-accept="image/*" data-helper="JPG or PNG, max 5 MB." data-max-size="5242880"></sherpa-file-upload>
</template>

<template data-label="Multiple files" data-layout="block">
  <sherpa-file-upload data-label="Attach files" data-multiple data-max-files="5" data-helper="Up to 5 files, any type."></sherpa-file-upload>
</template>

<template data-label="Disabled" data-layout="block">
  <sherpa-file-upload data-label="Locked uploader" disabled></sherpa-file-upload>
</template>
`,

'sherpa-input-select': `
<template data-label="Default" data-description="Options can be declared as light-DOM <sherpa-option> children." data-layout="block">
  <sherpa-input-select data-label="Region" data-placeholder="Pick a region…">
    <sherpa-option value="eu"   label="EU (Frankfurt)"></sherpa-option>
    <sherpa-option value="us"   label="US (Virginia)"></sherpa-option>
    <sherpa-option value="apac" label="APAC (Tokyo)"></sherpa-option>
  </sherpa-input-select>
</template>

<template data-label="With initial value" data-layout="block">
  <sherpa-input-select data-label="Region" value="eu">
    <sherpa-option value="eu"   label="EU (Frankfurt)"></sherpa-option>
    <sherpa-option value="us"   label="US (Virginia)"></sherpa-option>
    <sherpa-option value="apac" label="APAC (Tokyo)"></sherpa-option>
  </sherpa-input-select>
</template>

<template data-label="Disabled" data-layout="block">
  <sherpa-input-select data-label="Region" disabled>
    <sherpa-option value="eu" label="EU"></sherpa-option>
  </sherpa-input-select>
</template>

<template data-label="Options via setOptions()" data-description="For large or dynamic option lists, set the options programmatically." data-layout="block" data-setup="input-select-3">
  <sherpa-input-select data-label="Fruit" data-placeholder="Pick one…"></sherpa-input-select>
</template>
`,

'sherpa-transfer-list': `
<template data-label="Two-pane transfer" data-description="Items can be moved between the available and selected lists." data-layout="block" data-setup="transfer-list-0">
  <sherpa-transfer-list data-source-heading="Available" data-target-heading="Selected" data-search style="height: 280px;"></sherpa-transfer-list>
</template>
`,

};

for (const [tag, body] of Object.entries(FILES)) {
  await fs.writeFile(path.join(ROOT, tag, `${tag}.examples.html`), header(tag) + body.trimStart(), 'utf8');
  console.log(`✓ ${tag}`);
}
