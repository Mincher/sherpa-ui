#!/usr/bin/env node
/**
 * scripts/generate-nav.js
 *
 * Generates docs/nav.html from the component schema index.
 * Run whenever components are added, removed, or recategorised:
 *
 *   node scripts/generate-nav.js
 *
 * The output is a static HTML file loaded by <sherpa-nav data-src="/docs/nav.html">.
 * No JS template strings, no blob URLs — plain HTML that the component fetches.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');

// ── Data ─────────────────────────────────────────────────────────────────────
// Keep CATEGORY_MAP and CATEGORIES in sync with docs/router.js.

const CATEGORY_MAP = {
  'sherpa-footer':                 'Layout & Navigation',
  'sherpa-nav':                    'Layout & Navigation',
  'sherpa-nav-item':               'Layout & Navigation',
  'sherpa-nav-promo':              'Layout & Navigation',
  'sherpa-view-header':            'Layout & Navigation',
  'sherpa-section-header':         'Layout & Navigation',
  'sherpa-container':              'Layout & Navigation',
  'sherpa-container-header':       'Layout & Navigation',
  'sherpa-container-pdf-exporter': 'Layout & Navigation',
  'sherpa-layout-grid':            'Layout & Navigation',
  'sherpa-layout-view':            'Layout & Navigation',
  'sherpa-toolbar':                'Layout & Navigation',
  'sherpa-breadcrumbs':            'Layout & Navigation',

  'sherpa-data-grid':              'Data Visualization',
  'sherpa-barchart':               'Data Visualization',
  'sherpa-donut-chart':            'Data Visualization',
  'sherpa-gauge-chart':            'Data Visualization',
  'sherpa-line-chart':             'Data Visualization',
  'sherpa-metric':                 'Data Visualization',
  'sherpa-sparkline':              'Data Visualization',
  'sherpa-chart-legend':           'Data Visualization',
  'sherpa-key-value-list':         'Data Visualization',

  'sherpa-button':                 'Controls',
  'sherpa-switch':                 'Controls',
  'sherpa-stepper':                'Controls',
  'sherpa-tag':                    'Controls',
  'sherpa-pagination':             'Controls',
  'sherpa-slider':                 'Controls',
  'sherpa-progress-bar':           'Controls',
  'sherpa-progress-tracker':       'Controls',

  'sherpa-input-text':             'Inputs',
  'sherpa-input-number':           'Inputs',
  'sherpa-input-password':         'Inputs',
  'sherpa-input-search':           'Inputs',
  'sherpa-input-select':           'Inputs',
  'sherpa-input-date':             'Inputs',
  'sherpa-input-date-range':       'Inputs',
  'sherpa-input-time':             'Inputs',
  'sherpa-input-checkbox':         'Inputs',
  'sherpa-input-checkbox-group':   'Inputs',
  'sherpa-input-radio':            'Inputs',
  'sherpa-input-radio-group':      'Inputs',
  'sherpa-input-tag':              'Inputs',
  'sherpa-file-upload':            'Inputs',

  'sherpa-dialog':                 'Feedback & Overlays',
  'sherpa-toast':                  'Feedback & Overlays',
  'sherpa-tooltip':                'Feedback & Overlays',
  'sherpa-message':                'Feedback & Overlays',
  'sherpa-empty-state':            'Feedback & Overlays',
  'sherpa-menu':                   'Feedback & Overlays',
  'sherpa-menu-item':              'Feedback & Overlays',
  'sherpa-popover':                'Feedback & Overlays',
  'sherpa-callout':                'Feedback & Overlays',
  'sherpa-accordion':              'Feedback & Overlays',
  'sherpa-tabs':                   'Feedback & Overlays',
  'sherpa-list':                   'Feedback & Overlays',
  'sherpa-list-item':              'Feedback & Overlays',
  'sherpa-list-panel':             'Feedback & Overlays',
  'sherpa-loader':                 'Feedback & Overlays',

  'sherpa-card':                   'Content',
  'sherpa-icon':                   'Content',
  'sherpa-filter-bar':             'Content',
  'sherpa-section-nav':            'Content',
  'sherpa-transfer-list':          'Content',
  'sherpa-product-bar':            'Content',
  'sherpa-product-bar-v2':         'Content',
  'sherpa-ai-panel':               'Content',
  'sherpa-chat-message':           'Content',
  'sherpa-prompt-composer':        'Content',
  'sherpa-content-section':        'Content',
  'sherpa-node':                   'Content',
  'sherpa-node-canvas':            'Content',
  'sherpa-node-header':            'Content',
  'sherpa-node-row':               'Content',
  'sherpa-node-socket':            'Content',
  'sherpa-scheduler':              'Content',
  'sherpa-panel':                  'Content',
  'sherpa-proposal-op':            'Content',
  'sherpa-proposal-preview':       'Content',
};

const CATEGORIES = [
  { label: 'Layout & Navigation', icon: 'fa-solid fa-table-columns' },
  { label: 'Data Visualization',  icon: 'fa-solid fa-chart-bar'     },
  { label: 'Controls',            icon: 'fa-solid fa-hand-pointer'   },
  { label: 'Inputs',              icon: 'fa-solid fa-keyboard'       },
  { label: 'Feedback & Overlays', icon: 'fa-solid fa-bell'           },
  { label: 'Content',             icon: 'fa-solid fa-layer-group'    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function prettyLabel(tag) {
  return tag
    .replace(/^sherpa-/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Load component index ──────────────────────────────────────────────────────

const tags = JSON.parse(readFileSync(resolve(root, 'schemas/components/index.json'), 'utf8'));

const components = tags
  .map(tag => ({
    tag,
    label:    prettyLabel(tag),
    category: CATEGORY_MAP[tag] || 'Uncategorised',
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

// ── Group by category ─────────────────────────────────────────────────────────

const grouped = new Map(CATEGORIES.map(c => [c.label, []]));
for (const comp of components) {
  const list = grouped.get(comp.category);
  if (list) list.push(comp);
}

// ── Build HTML ────────────────────────────────────────────────────────────────

let html = `<!--
  docs/nav.html — Static navigation template for the Sherpa UI docs shell.
  Loaded by <sherpa-nav data-src="/docs/nav.html"> via fetch().

  Re-generate with:  node scripts/generate-nav.js
  Keep in sync with: docs/router.js  (CATEGORY_MAP, CATEGORIES)
                     schemas/components/index.json
-->
<div class="sherpa-nav-root" data-pinned="false" data-mode="default">

  <header class="nav-header">
    <div class="nav-toolbar">
      <svg class="nav-logo" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0H3.80301L12.9974 9.83439V13.9026H9.19381L4.59663 8.98333V13.9002H0V0ZM8.39098 4.91692H12.9876V0H8.39098V4.91692Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12.9974 9.83439H17.594V4.91689H8.40023L12.9974 9.83439Z" fill="#C046FF"/>
      </svg>
      <span class="nav-product-name text-heading-lg">Sherpa UI</span>
      <div class="nav-toolbar-actions">
        <sherpa-button
          class="nav-pin-btn"
          data-variant="tertiary"
          data-size="small"
          data-icon-start="&#xf08d;"
          title="Pin navigation"
          aria-label="Pin navigation"
        ></sherpa-button>
      </div>
    </div>

    <sherpa-nav-item
      data-nav-target="home"
      data-item-id="/"
      data-icon="fa-solid fa-house"
      data-route="/"
      tabindex="0"
      role="button"
      aria-label="Overview"
    >Overview</sherpa-nav-item>
  </header>

  <div class="nav-sections" role="tree">
`;

let groupIndex = 1;
for (const cat of CATEGORIES) {
  const items = grouped.get(cat.label) ?? [];
  if (!items.length) continue;

  const sectionId = cat.label.toLowerCase().replace(/\s+/g, '-');
  html += `    <div class="nav-group" data-group-index="${groupIndex++}">
      <details class="nav-section" data-section-id="${esc(sectionId)}" open>
        <summary>
          <sherpa-nav-item
            data-variant="section"
            data-icon="${esc(cat.icon)}"
            tabindex="0"
            role="button"
          >${esc(cat.label)}</sherpa-nav-item>
        </summary>
`;

  for (const comp of items) {
    html += `        <sherpa-nav-item
          data-variant="child"
          data-item-id="${esc(comp.tag)}"
          data-route="/components/${esc(comp.tag)}"
          tabindex="0"
          role="button"
        >${esc(comp.label)}</sherpa-nav-item>
`;
  }

  html += `      </details>
    </div>

`;
}

html += `  </div>

  <template class="nav-item-tpl">
    <sherpa-nav-item data-variant="child" tabindex="0" role="button"></sherpa-nav-item>
  </template>
  <template class="badge-tpl">
    <sherpa-tag slot="badge" data-status="success"></sherpa-tag>
  </template>

</div>
`;

// ── Write output ──────────────────────────────────────────────────────────────

const outPath = resolve(root, 'docs/nav.html');
writeFileSync(outPath, html, 'utf8');
console.log(`✓ docs/nav.html written (${components.length} components across ${groupIndex - 1} categories)`);
