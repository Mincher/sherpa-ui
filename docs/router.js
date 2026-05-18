/**
 * docs/router.js — Fragment-based router for the Sherpa UI docs shell.
 *
 * Routes:
 *   #/                        → Home page (category grid)
 *   #/category/:id            → Category overview (component grid)
 *   #/components/:tag         → Component detail page
 *
 * Navigation is built dynamically from /schemas/components/index.json
 * so it stays in sync with the MCP server's source of truth.
 */

import { ThemeManager } from '/components/utilities/theme-manager.js';
import { EXAMPLES }     from './examples.js';

// ── Category definitions ─────────────────────────────────────────────────────
// Mirrors the CATEGORY_MAP in demo/playground.js — keep in sync.
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
  {
    id: 'layout-navigation',
    label: 'Layout & Navigation',
    icon: 'fa-solid fa-table-columns',
    description: 'Structural layout, navigation rails, headers, and view composition components.',
  },
  {
    id: 'data-visualization',
    label: 'Data Visualization',
    icon: 'fa-solid fa-chart-bar',
    description: 'Charts, grids, metrics, and data display components.',
  },
  {
    id: 'controls',
    label: 'Controls',
    icon: 'fa-solid fa-hand-pointer',
    description: 'Buttons, switches, steppers, and other interactive controls.',
  },
  {
    id: 'inputs',
    label: 'Inputs',
    icon: 'fa-solid fa-keyboard',
    description: 'Form inputs, selects, checkboxes, date pickers, and more.',
  },
  {
    id: 'feedback-overlays',
    label: 'Feedback & Overlays',
    icon: 'fa-solid fa-bell',
    description: 'Toasts, dialogs, tooltips, menus, and other overlay patterns.',
  },
  {
    id: 'content',
    label: 'Content',
    icon: 'fa-solid fa-layer-group',
    description: 'Cards, panels, AI panel, scheduler, and rich content containers.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function prettyLabel(tag) {
  return tag
    .replace(/^sherpa-/, '')
    .split('-')
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join(' ');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Strip common leading indentation from a template-literal HTML string. */
function dedentHtml(str) {
  const lines = str.split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (!nonEmpty.length) return str.trim();
  const indent = Math.min(...nonEmpty.map(l => l.match(/^(\s*)/)[1].length));
  return lines.map(l => l.slice(indent)).join('\n').trim();
}

/** Syntax-highlight all <pre><code> blocks inside the outlet. */
function highlightOutlet() {
  if (typeof window.hljs === 'undefined') return;
  outlet?.querySelectorAll('pre code').forEach(el => window.hljs.highlightElement(el));
}

/** Build a single example block (preview + code). */
function buildExampleBlock(ex) {
  const html     = ex.html.trim();
  const layout   = ex.layout ?? 'row';
  const showPrev = ex.preview !== false;

  return `
    <div class="docs-example">
      <div class="docs-example-header">
        <h3 class="docs-example-label">${escapeHtml(ex.label)}</h3>
        ${ex.description ? `<p class="docs-example-desc">${escapeHtml(ex.description)}</p>` : ''}
      </div>
      ${showPrev ? `<div class="docs-example-preview" data-layout="${escapeHtml(layout)}">${html}</div>` : ''}
      <div class="docs-code-block">
        <div class="docs-code-header">
          <span class="docs-code-lang">HTML</span>
          <button class="docs-copy-btn" type="button" aria-label="Copy code">
            <i class="fa-regular fa-copy" aria-hidden="true"></i> Copy
          </button>
        </div>
        <pre><code class="language-html">${escapeHtml(dedentHtml(html))}</code></pre>
      </div>
    </div>`;
}

/** Generate a minimal auto-example from a component schema. */
function buildAutoExample(tag, schema) {
  const attrs = schema.attributes ?? [];
  const parts = [];

  const labelAttr = attrs.find(a => a.name === 'data-label');
  if (labelAttr) parts.push(`data-label="${prettyLabel(tag)}"`);

  const variantAttr = attrs.find(a => a.name === 'data-variant' && a.enumValues?.length);
  if (variantAttr) parts.push(`data-variant="${variantAttr.enumValues[0]}"`);

  const attrStr = parts.length ? ' ' + parts.join(' ') : '';
  const hasDefaultSlot = (schema.slots ?? []).some(s => s.name === '');
  const inner = hasDefaultSlot ? `\n  <!-- slotted content -->\n` : '';

  return {
    label: 'Basic usage',
    layout: 'row',
    html: `<${tag}${attrStr}>${inner}</${tag}>`,
  };
}

/** Build the full examples section HTML for a component page. */
function buildExamplesSection(tag, schema) {
  const examples = EXAMPLES[tag] ?? [buildAutoExample(tag, schema)];
  if (!examples.length) return '';

  return `
    <section class="docs-examples-section">
      <h2 class="docs-section-heading">Examples</h2>
      ${examples.map(buildExampleBlock).join('')}
    </section>`;
}

// ── State ─────────────────────────────────────────────────────────────────────

/** @type {Array<{tag: string, label: string, category: string}>} */
let components = [];
const schemaCache = new Map();

// ── Theme management ──────────────────────────────────────────────────────────

const THEMES = [
  { value: 'apex-2-purple', label: 'Apex 2 (Purple)' },
  { value: 'apex-2-teal',   label: 'Apex 2 (Teal)' },
  { value: 'apex-2-blue',   label: 'Apex 2 (Blue)' },
  { value: 'classic',       label: 'Classic' },
];
const MODES = [
  { value: 'auto',  label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark',  label: 'Dark' },
  { value: 'hc',    label: 'High Contrast' },
];
const DENSITIES = [
  { value: 'compact',     label: 'Compact' },
  { value: 'base',        label: 'Base' },
  { value: 'comfortable', label: 'Comfortable' },
];

function initTheme() {
  ThemeManager.init();

  const allowed = new Set(THEMES.map(t => t.value));
  const persisted = localStorage.getItem('sherpa-theme');
  if (persisted && !allowed.has(persisted)) localStorage.removeItem('sherpa-theme');

  ThemeManager.restore();
  document.documentElement.dataset.density = ThemeManager.getDensity();
  document.documentElement.dataset.mode    = ThemeManager.getMode();
}

async function initAppearanceSelects() {
  const themeEl   = document.getElementById('theme-select');
  const modeEl    = document.getElementById('mode-select');
  const densityEl = document.getElementById('density-select');

  if (!themeEl || !modeEl || !densityEl) return;

  await Promise.all([themeEl.rendered, modeEl.rendered, densityEl.rendered]);

  themeEl.setOptions?.(THEMES);
  modeEl.setOptions?.(MODES);
  densityEl.setOptions?.(DENSITIES);

  themeEl.value   = ThemeManager.getTheme();
  modeEl.value    = ThemeManager.getMode();
  densityEl.value = ThemeManager.getDensity();

  themeEl.addEventListener('change', e => ThemeManager.setTheme(e.detail?.value));
  modeEl.addEventListener('change', e => {
    const v = e.detail?.value;
    ThemeManager.setMode(v);
    document.documentElement.dataset.mode = v;
  });
  densityEl.addEventListener('change', e => {
    const v = e.detail?.value;
    ThemeManager.setDensity(v);
    document.documentElement.dataset.density = v;
  });
}

// ── Schema loading ────────────────────────────────────────────────────────────

async function loadComponents() {
  try {
    const res = await fetch('/schemas/components/index.json');
    if (!res.ok) throw new Error('Failed to load component index');
    const tags = await res.json();
    components = tags
      .map(tag => ({
        tag,
        label: prettyLabel(tag),
        category: CATEGORY_MAP[tag] || 'Uncategorised',
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    console.warn('[docs] Could not load component list:', err);
  }
}

async function loadSchema(tag) {
  if (schemaCache.has(tag)) return schemaCache.get(tag);
  try {
    const res = await fetch(`/schemas/components/${tag}.json`);
    if (!res.ok) return null;
    const schema = await res.json();
    schemaCache.set(tag, schema);
    return schema;
  } catch {
    return null;
  }
}

// ── Sidebar navigation ────────────────────────────────────────────────────────
// Nav HTML lives in docs/nav.html (loaded via data-src in index.html).
// Re-generate with: node scripts/generate-nav.js

function initNav() {
  const nav = document.getElementById('docs-nav-panel');
  if (!nav) return;

  // Listen for navigation clicks
  nav.addEventListener('navitemclick', e => {
    const route = e.detail?.route;
    if (route) navigate(route);
  });

  // Home shortcut — nav fires 'navhome' for data-nav-target="home" items
  nav.addEventListener('navhome', () => navigate('/'));
}

function setActiveNavItem(path) {
  const nav = document.getElementById('docs-nav-panel');
  if (!nav) return;

  const normalised = path.startsWith('/') ? path : `/${path}`;
  // Derive itemId: '/' → home item, '/components/:tag' → tag
  const itemId = normalised === '/' ? '/' : normalised.replace(/^\/components\//, '');
  nav.setActiveItem?.(itemId);
}

function setViewHeading(heading) {
  const view = document.getElementById('docs-view');
  if (view) view.dataset.heading = heading;
}

// ── Routing ───────────────────────────────────────────────────────────────────

const outlet = document.getElementById('docs-outlet');

// Delegated card-click → route navigation. Each navigable card carries
// a data-route attribute set when populated from its cloning prototype.
outlet?.addEventListener('card-click', e => {
  const card = e.composedPath().find(n => n instanceof HTMLElement && n.tagName === 'SHERPA-CARD');
  const route = card?.dataset?.route;
  if (route) navigate(route);
});

function parseHash(hash) {
  const path = (hash || '').replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return { type: 'home' };
  if (parts[0] === 'category'   && parts[1]) return { type: 'category',   id:  parts[1] };
  if (parts[0] === 'components' && parts[1]) return { type: 'component',  tag: parts[1] };
  return { type: 'not-found', path };
}

function navigate(path) {
  const hash = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash !== hash) {
    window.location.hash = hash;
    // hashchange event fires → handleHashChange → renderRoute
  } else {
    // Same route — re-render without pushing history
    renderCurrentRoute();
  }
}

function handleHashChange() {
  renderCurrentRoute();
}

async function renderCurrentRoute() {
  const route = parseHash(window.location.hash);
  await renderRoute(route);

  const path = (window.location.hash || '#/').replace(/^#/, '') || '/';
  setActiveNavItem(path);
  // Reset scroll on the layout-view's internal content column
  const viewContent = document.getElementById('docs-view')?.shadowRoot?.querySelector('[part="content"]');
  viewContent?.scrollTo?.({ top: 0, behavior: 'instant' });
}

async function renderRoute(route) {
  if (!outlet) return;

  if (route.type === 'home') {
    setViewHeading('Sherpa UI');
    await renderHomePage();
    bindOutletLinks();
    highlightOutlet();
    return;
  }

  if (route.type === 'category') {
    const catDef = CATEGORIES.find(c => c.id === route.id) ?? { id: route.id, label: route.id, icon: 'fa-solid fa-folder', description: '' };
    const items = components.filter(c => slugify(c.category) === route.id);
    setViewHeading(catDef.label);
    await renderCategoryPage(catDef, items);
    bindOutletLinks();
    highlightOutlet();
    return;
  }

  if (route.type === 'component') {
    const schema = await loadSchema(route.tag);
    const comp   = components.find(c => c.tag === route.tag);
    setViewHeading(comp?.label ?? prettyLabel(route.tag));
    outlet.innerHTML = schema
      ? buildComponentPage(route.tag, comp?.label ?? prettyLabel(route.tag), schema)
      : buildNotFound(`<${route.tag}>`);
    bindOutletLinks();
    highlightOutlet();
    return;
  }

  setViewHeading('Not found');
  outlet.innerHTML = buildNotFound(escapeHtml(route.path ?? ''));
  bindOutletLinks();
  highlightOutlet();
}

/** Intercept all anchor clicks inside the outlet that use hash-based routes. */
function bindOutletLinks() {
  if (!outlet) return;
  outlet.querySelectorAll('a[href^="#/"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.getAttribute('href'));
    });
  });
}

// ── Page partials (HTML-first) ────────────────────────────────────────────────
// Page chrome lives in docs/pages/*.html. JS only fetches the partial,
// clones it into the outlet, then populates dynamic regions and clones
// cloning-prototype templates per data row.

const partialCache = new Map();

async function loadPagePartial(name) {
  if (partialCache.has(name)) return partialCache.get(name);
  const res = await fetch(`/docs/pages/${name}.html`);
  if (!res.ok) throw new Error(`Failed to load partial: ${name}`);
  const html = await res.text();
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  partialCache.set(name, tpl);
  return tpl;
}

async function mountPartial(name) {
  const tpl  = await loadPagePartial(name);
  outlet.replaceChildren(tpl.content.cloneNode(true));
  return outlet;
}

/** Convert a Font Awesome class string ('fa-solid fa-house') to a sherpa-icon name ('house'). */
function faToIconName(faClass) {
  if (!faClass) return '';
  const tokens = faClass.split(/\s+/);
  const glyph  = tokens.find(t => t.startsWith('fa-') && !/^fa-(solid|regular|light|thin|duotone|brands)$/.test(t));
  return glyph ? glyph.replace(/^fa-/, '') : '';
}

// ── Page builders ─────────────────────────────────────────────────────────────

async function renderHomePage() {
  await mountPartial('home');

  const grid = outlet.querySelector('[data-region="category-cards"]');
  const tpl  = outlet.querySelector('template.category-card-tpl');
  if (!grid || !tpl) return;

  const frag = document.createDocumentFragment();
  for (const cat of CATEGORIES) {
    const count = components.filter(c => slugify(c.category) === cat.id).length;
    const node  = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.label       = cat.label;
    node.dataset.description = cat.description ?? '';
    node.dataset.route       = `/category/${cat.id}`;
    node.setAttribute('aria-label', `${cat.label} — ${count} components`);

    const icon = node.querySelector('sherpa-icon');
    if (icon) icon.setAttribute('name', faToIconName(cat.icon));

    const count$ = document.createElement('span');
    count$.slot = 'footer';
    count$.textContent = `${count} component${count !== 1 ? 's' : ''}`;
    node.appendChild(count$);

    frag.appendChild(node);
  }
  grid.appendChild(frag);
}

async function renderCategoryPage(cat, items) {
  await mountPartial('category');

  const header = outlet.querySelector('sherpa-section-header[data-region="header"]');
  if (header) {
    header.dataset.label = cat.label;
    const icon = header.querySelector('sherpa-icon[data-region="header-icon"]');
    if (icon) icon.setAttribute('name', faToIconName(cat.icon));
    const desc = header.querySelector('[data-region="header-description"]');
    if (desc) desc.textContent = cat.description ?? '';
  }

  const grid  = outlet.querySelector('[data-region="component-cards"]');
  const empty = outlet.querySelector('[data-region="empty"]');
  const tpl   = outlet.querySelector('template.component-card-tpl');

  if (!items.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  if (!grid || !tpl) return;
  const frag = document.createDocumentFragment();
  for (const comp of items) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.label       = comp.label;
    node.dataset.description = `<${comp.tag}>`;
    node.dataset.route       = `/components/${comp.tag}`;
    node.setAttribute('aria-label', comp.label);
    frag.appendChild(node);
  }
  grid.appendChild(frag);
}

function buildComponentPage(tag, label, schema) {
  const description = schema.description ?? '';
  const attrs       = schema.attributes ?? [];
  const slots       = schema.slots ?? [];
  const events      = schema.events ?? [];
  const methods     = schema.methods ?? [];

  const catLabel = CATEGORY_MAP[tag] ?? 'Uncategorised';
  const catId    = slugify(catLabel);

  const breadcrumb = `
    <p class="docs-page-eyebrow">
      <a href="#/" class="docs-back-link"><i class="fa-solid fa-house" aria-hidden="true"></i> Overview</a>
      <span aria-hidden="true">›</span>
      <a href="#/category/${escapeHtml(catId)}" class="docs-back-link">${escapeHtml(catLabel)}</a>
    </p>`;

  const attrsHtml = attrs.length ? `
    <section class="docs-api-section">
      <h2 class="docs-api-heading">Attributes</h2>
      <div class="docs-table-wrap" role="region" aria-label="Attributes table" tabindex="0">
        <table class="docs-table">
          <thead>
            <tr>
              <th scope="col">Attribute</th>
              <th scope="col">Type</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            ${attrs.map(a => `
              <tr>
                <td><code class="docs-attr-name">${escapeHtml(a.name)}</code></td>
                <td><span class="docs-type-badge">${escapeHtml(a.type ?? '')}</span>${a.enumValues?.length ? `<br><span class="docs-enum-values">${a.enumValues.map(v => `<code>${escapeHtml(v)}</code>`).join(' | ')}</span>` : ''}</td>
                <td>${escapeHtml(a.description ?? '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>` : '';

  const slotsHtml = slots.length ? `
    <section class="docs-api-section">
      <h2 class="docs-api-heading">Slots</h2>
      <div class="docs-table-wrap" role="region" aria-label="Slots table" tabindex="0">
        <table class="docs-table">
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            ${slots.map(s => `
              <tr>
                <td><code class="docs-attr-name">${s.name ? escapeHtml(s.name) : '(default)'}</code></td>
                <td>${escapeHtml(s.description ?? '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>` : '';

  const eventsHtml = events.length ? `
    <section class="docs-api-section">
      <h2 class="docs-api-heading">Events</h2>
      <div class="docs-table-wrap" role="region" aria-label="Events table" tabindex="0">
        <table class="docs-table">
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            ${events.map(ev => `
              <tr>
                <td><code class="docs-attr-name">${escapeHtml(ev.name)}</code></td>
                <td>${escapeHtml(ev.description ?? '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>` : '';

  const methodsHtml = methods.length ? `
    <section class="docs-api-section">
      <h2 class="docs-api-heading">Methods</h2>
      <div class="docs-table-wrap" role="region" aria-label="Methods table" tabindex="0">
        <table class="docs-table">
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            ${methods.map(m => `
              <tr>
                <td><code class="docs-attr-name">${escapeHtml(typeof m === 'string' ? m : m.name ?? '')}</code></td>
                <td>${escapeHtml(typeof m === 'string' ? '' : m.description ?? '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>` : '';

  return `
    <div class="docs-page docs-component-page">
      <header class="docs-page-header">
        ${breadcrumb}
        <h1 class="docs-page-title">${escapeHtml(label)}</h1>
        <code class="docs-component-tag-display">&lt;${escapeHtml(tag)}&gt;</code>
        ${description ? `<p class="docs-page-subtitle">${escapeHtml(description)}</p>` : ''}
      </header>
      ${buildExamplesSection(tag, schema)}
      ${(attrsHtml || slotsHtml || eventsHtml || methodsHtml) ? `
      <details class="docs-api-details" open>
        <summary class="docs-api-summary">API Reference</summary>
        ${attrsHtml}
        ${slotsHtml}
        ${eventsHtml}
        ${methodsHtml}
      </details>` : ''}
    </div>`;
}

function buildNotFound(what) {
  return `
    <div class="docs-page docs-not-found-page">
      <header class="docs-page-header">
        <p class="docs-page-eyebrow">
          <a href="#/" class="docs-back-link"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Overview</a>
        </p>
        <h1 class="docs-page-title">Not Found</h1>
        <p class="docs-page-subtitle">No documentation found for <code>${what}</code>.</p>
      </header>
    </div>`;
}

// ── Initialisation ────────────────────────────────────────────────────────────

async function init() {
  initTheme();

  initNav();
  await loadComponents();
  initAppearanceSelects();

  // Copy button delegation — one handler for the whole outlet lifetime
  outlet?.addEventListener('click', e => {
    const btn = e.composedPath().find(n => n instanceof HTMLElement && n.classList?.contains('docs-copy-btn'));
    if (!btn) return;
    const code = btn.closest('.docs-code-block')?.querySelector('code')?.textContent ?? '';
    navigator.clipboard.writeText(code).catch(() => {});
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Copied';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });

  window.addEventListener('hashchange', handleHashChange);
  await renderCurrentRoute();
}

document.addEventListener('DOMContentLoaded', init);
