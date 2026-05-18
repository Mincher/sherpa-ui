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

// ── State ─────────────────────────────────────────────────────────────────────

/** @type {Array<{tag: string, label: string, category: string}>} */
let components = [];
let navBuilt = false;
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

  themeEl.setValue?.(ThemeManager.getTheme());
  modeEl.setValue?.(ThemeManager.getMode());
  densityEl.setValue?.(ThemeManager.getDensity());

  themeEl.addEventListener('select-change', e => ThemeManager.setTheme(e.detail?.value));
  modeEl.addEventListener('select-change', e => {
    const v = e.detail?.value;
    ThemeManager.setMode(v);
    document.documentElement.dataset.mode = v;
  });
  densityEl.addEventListener('select-change', e => {
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

function buildNav() {
  const navPanel = document.getElementById('docs-nav-panel');
  if (!navPanel || navBuilt) return;
  navBuilt = true;

  // Overview item
  const overview = document.createElement('sherpa-list-item');
  overview.dataset.label       = 'Overview';
  overview.dataset.icon        = 'fa-solid fa-house';
  overview.dataset.interactive = '';
  overview.dataset.route       = '/';
  navPanel.appendChild(overview);

  // Group components by category
  const grouped = new Map(CATEGORIES.map(c => [c.label, []]));
  for (const comp of components) {
    const cat = comp.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat).push(comp);
  }

  for (const cat of CATEGORIES) {
    const items = grouped.get(cat.label) ?? [];
    if (!items.length) continue;

    // Category section header
    const header = document.createElement('sherpa-section-header');
    header.dataset.label        = cat.label;
    header.dataset.headingLevel = 'tertiary';
    navPanel.appendChild(header);

    // Individual component links
    for (const comp of items) {
      const item = document.createElement('sherpa-list-item');
      item.dataset.label       = comp.label;
      item.dataset.interactive = '';
      item.dataset.route       = `/components/${comp.tag}`;
      navPanel.appendChild(item);
    }
  }

  // Click handler — delegate from list panel
  navPanel.addEventListener('list-item-click', e => {
    const route = e.detail?.item?.dataset?.route
      ?? e.composedPath().find(n => n instanceof HTMLElement && n.dataset?.route)?.dataset?.route;
    if (route) navigate(route);
  });
}

function setActiveNavItem(path) {
  const navPanel = document.getElementById('docs-nav-panel');
  if (!navPanel) return;

  navPanel.querySelectorAll('sherpa-list-item[data-active]').forEach(el => {
    delete el.dataset.active;
  });

  const normalised = path.startsWith('/') ? path : `/${path}`;
  const target = navPanel.querySelector(`sherpa-list-item[data-route="${CSS.escape(normalised)}"]`);
  if (target) target.dataset.active = '';
}

// ── Routing ───────────────────────────────────────────────────────────────────

const outlet = document.getElementById('docs-outlet');

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
  outlet?.scrollTo?.({ top: 0, behavior: 'instant' });
}

async function renderRoute(route) {
  if (!outlet) return;

  if (route.type === 'home') {
    outlet.innerHTML = buildHomePage();
    bindOutletLinks();
    return;
  }

  if (route.type === 'category') {
    const catDef = CATEGORIES.find(c => c.id === route.id) ?? { id: route.id, label: route.id, icon: 'fa-solid fa-folder', description: '' };
    const items = components.filter(c => slugify(c.category) === route.id);
    outlet.innerHTML = buildCategoryPage(catDef, items);
    bindOutletLinks();
    return;
  }

  if (route.type === 'component') {
    const schema = await loadSchema(route.tag);
    const comp   = components.find(c => c.tag === route.tag);
    outlet.innerHTML = schema
      ? buildComponentPage(route.tag, comp?.label ?? prettyLabel(route.tag), schema)
      : buildNotFound(`<${route.tag}>`);
    bindOutletLinks();
    return;
  }

  outlet.innerHTML = buildNotFound(escapeHtml(route.path ?? ''));
  bindOutletLinks();
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

// ── Page builders ─────────────────────────────────────────────────────────────

function buildHomePage() {
  const categoryCards = CATEGORIES.map(cat => {
    const count = components.filter(c => slugify(c.category) === cat.id).length;
    return `
      <a href="#/category/${cat.id}" class="docs-category-card" aria-label="${escapeHtml(cat.label)} — ${count} components">
        <span class="docs-category-card-icon"><i class="${escapeHtml(cat.icon)}" aria-hidden="true"></i></span>
        <h3 class="docs-category-card-title">${escapeHtml(cat.label)}</h3>
        <p class="docs-category-card-desc">${escapeHtml(cat.description)}</p>
        <span class="docs-category-card-count">${count} component${count !== 1 ? 's' : ''}</span>
      </a>`;
  }).join('');

  return `
    <div class="docs-page docs-home-page">
      <header class="docs-page-header">
        <h1 class="docs-page-title">Design System</h1>
        <p class="docs-page-subtitle">
          Sherpa UI is a component library built on Web Components, design tokens, and a
          progressive-enhancement philosophy. Browse the categories below or search in
          the sidebar to find a component.
        </p>
      </header>
      <section class="docs-category-grid" aria-label="Component categories">
        ${categoryCards}
      </section>
    </div>`;
}

function buildCategoryPage(cat, items) {
  const cards = items.length
    ? items.map(comp => `
        <a href="#/components/${escapeHtml(comp.tag)}" class="docs-component-card" aria-label="${escapeHtml(comp.label)}">
          <code class="docs-component-card-tag">&lt;${escapeHtml(comp.tag)}&gt;</code>
          <h3 class="docs-component-card-title">${escapeHtml(comp.label)}</h3>
        </a>`).join('')
    : `<p class="docs-empty-note">No components in this category.</p>`;

  return `
    <div class="docs-page docs-category-page">
      <header class="docs-page-header">
        <p class="docs-page-eyebrow">
          <a href="#/" class="docs-back-link"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Overview</a>
        </p>
        <h1 class="docs-page-title">
          <i class="${escapeHtml(cat.icon)}" aria-hidden="true"></i>
          ${escapeHtml(cat.label)}
        </h1>
        ${cat.description ? `<p class="docs-page-subtitle">${escapeHtml(cat.description)}</p>` : ''}
        <p class="docs-page-count">${items.length} component${items.length !== 1 ? 's' : ''}</p>
      </header>
      <div class="docs-component-grid" role="list">
        ${cards}
      </div>
    </div>`;
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
      ${attrsHtml}
      ${slotsHtml}
      ${eventsHtml}
      ${methodsHtml}
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

  await loadComponents();
  buildNav();
  initAppearanceSelects();

  // Playground back-link
  const playgroundBtn = document.getElementById('playground-btn');
  playgroundBtn?.addEventListener('button-click', () => {
    window.location.href = '/index.html';
  });

  window.addEventListener('hashchange', handleHashChange);
  await renderCurrentRoute();
}

document.addEventListener('DOMContentLoaded', init);
