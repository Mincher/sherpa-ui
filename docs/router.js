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

import { ThemeManager }        from '/components/utilities/theme-manager.js';
import { COMPONENT_CATEGORIES } from '/components/utilities/component-categories.js';

// ── Role taxonomy ────────────────────────────────────────────────────────────
// The 11 roles defined in docs/COMPONENT-CATEGORIES.md. Listed in tier order
// (1 → 4). The role id is also the route id (#/category/<role>) and matches
// the @category value emitted into every schema and COMPONENT_CATEGORIES.

const CATEGORIES = [
  // ─ Tier 1 ─ Page chrome
  {
    id: 'shell',
    label: 'Shell',
    tier: 1,
    icon: 'fa-solid fa-window-maximize',
    description: 'Top-level page scaffolding — product bars, navigation rails, view headers, and the layout grid that frames every view.',
  },
  {
    id: 'nav',
    label: 'Navigation',
    tier: 1,
    icon: 'fa-solid fa-bars',
    description: 'Children of the nav rail — nav items, promos, and section navigators.',
  },

  // ─ Tier 2 ─ Surfaces
  {
    id: 'container',
    label: 'Containers',
    tier: 2,
    icon: 'fa-solid fa-table-columns',
    description: 'Surfaces that hold other components — cards, panels, accordions, content sections.',
  },
  {
    id: 'overlay',
    label: 'Overlays',
    tier: 2,
    icon: 'fa-solid fa-clone',
    description: 'Floating surfaces that appear above the page — dialogs, popovers, tooltips, menus.',
  },

  // ─ Tier 3 ─ Structural sub-elements
  {
    id: 'content',
    label: 'Content',
    tier: 3,
    icon: 'fa-solid fa-layer-group',
    description: 'Structural sub-elements within surfaces — section headers, toolbars, tabs, lists, steppers.',
  },

  // ─ Tier 4 ─ Leaf primitives
  {
    id: 'control',
    label: 'Controls',
    tier: 4,
    icon: 'fa-solid fa-hand-pointer',
    description: 'Actionable controls — buttons, switches, tags, sliders, pagination, breadcrumbs.',
  },
  {
    id: 'input',
    label: 'Inputs',
    tier: 4,
    icon: 'fa-solid fa-keyboard',
    description: 'Form fields that capture user data — text, select, date, checkbox, file upload, and the rest.',
  },
  {
    id: 'display',
    label: 'Displays',
    tier: 4,
    icon: 'fa-solid fa-eye',
    description: 'Read-only presentation primitives — metrics, sparklines, progress bars, gauges.',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    tier: 4,
    icon: 'fa-solid fa-bell',
    description: 'Status, messages, and notifications — callouts, toasts, loaders, empty states.',
  },
  {
    id: 'media',
    label: 'Media',
    tier: 4,
    icon: 'fa-solid fa-chart-bar',
    description: 'Charts, illustrations, and visual media — bar, line, donut, gauge, and chart legends.',
  },
  {
    id: 'data',
    label: 'Data',
    tier: 4,
    icon: 'fa-solid fa-table',
    description: 'Interactive datasets — data grids, transfer lists, schedulers, filter bars.',
  },

  // ─ Tier 5 ─ Docs / developer tooling
  {
    id: 'utility',
    label: 'Utilities',
    tier: 5,
    icon: 'fa-solid fa-screwdriver-wrench',
    description: 'Docs-site and developer tooling components — code blocks, attribute control panels. Not part of the public application UI taxonomy.',
  },
];

/** Look up the role id for a tag. Returns 'uncategorised' if unknown. */
function categoryOf(tag) {
  return COMPONENT_CATEGORIES[tag] || 'uncategorised';
}

/** Look up the display label for a role id. */
function categoryLabel(id) {
  return CATEGORIES.find(c => c.id === id)?.label ?? id;
}

// ── Merged child components ──────────────────────────────────────────────────
// Children whose docs are folded into a parent's page. Children stay routable
// (deep links + MCP keep working) but are hidden from the sidebar and category
// grids; visiting their route redirects to the parent's anchor.
const MERGED_CHILDREN = {
  'sherpa-nav-item':    'sherpa-nav',
  'sherpa-nav-section': 'sherpa-nav',
  'sherpa-node-header': 'sherpa-node',
  'sherpa-node-row':    'sherpa-node',
  'sherpa-node-socket': 'sherpa-node',
  'sherpa-list-item':   'sherpa-list',
};

/** Inverse map: parent tag → ordered list of child tags. */
const PARENT_TO_CHILDREN = Object.entries(MERGED_CHILDREN).reduce((acc, [child, parent]) => {
  (acc[parent] ??= []).push(child);
  return acc;
}, {});

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

/**
 * Split a JSDoc-style description into a clean lead sentence and a list of
 * supporting paragraphs. Bullet markers (•, -, *) and parenthetical class-name
 * prefixes (e.g. `sherpa-foo.js — …`) are stripped from the lead so the
 * subtitle reads as prose. Remaining content is broken at sentence boundaries
 * and surfaced behind a collapsible "Implementation notes" disclosure.
 */
function splitDescription(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { lead: '', rest: [] };

  // Drop "sherpa-foo.js —" / "sherpa-foo —" prefixes from JSDoc dumps.
  const cleaned = text.replace(/^sherpa-[a-z0-9-]+(?:\.js)?\s*[—–-]\s*/i, '');

  // Split into sentences on ". " (keeping abbreviations intact is best-effort).
  const sentences = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map(s => s.trim())
    .filter(Boolean);

  if (!sentences.length) return { lead: cleaned, rest: [] };

  return {
    lead: sentences[0].replace(/[.!?]+$/, '') + '.',
    rest: sentences.slice(1),
  };
}

/** Syntax-highlight all <pre><code> blocks inside the outlet. */
function highlightOutlet() {
  if (typeof window.hljs === 'undefined') return;
  outlet?.querySelectorAll('pre code').forEach(el => window.hljs.highlightElement(el));
}

/** Pending setup() callbacks keyed by data-setup-key on preview divs. */
const pendingSetups = new Map();
let setupCounter = 0;

/** Build a single example block (preview + code). */
function buildExampleBlock(ex) {
  const html     = ex.html.trim();
  const layout   = ex.layout ?? 'row';
  const showPrev = ex.preview !== false;

  let setupAttr = '';
  if (showPrev && typeof ex.setup === 'function') {
    const key = `setup-${++setupCounter}`;
    pendingSetups.set(key, ex.setup);
    setupAttr = ` data-setup-key="${key}"`;
  }

  return `
    <div class="docs-example">
      <sherpa-section-header
        data-label="${escapeHtml(ex.label)}"
        data-heading-level="tertiary"
      >
        ${ex.description ? `<p slot="description">${escapeHtml(ex.description)}</p>` : ''}
      </sherpa-section-header>
      ${showPrev ? `<div class="docs-example-preview" data-layout="${escapeHtml(layout)}"${setupAttr}>${html}</div>` : ''}
      <div class="docs-code-block">
        <div class="docs-code-header">
          <span class="docs-code-lang">HTML</span>
          <sherpa-button
            class="docs-copy-btn"
            data-variant="tertiary"
            data-size="small"
            data-icon-start="&#xf0c5;"
            data-label="Copy"
            aria-label="Copy code"
          ></sherpa-button>
        </div>
        <pre><code class="language-html">${escapeHtml(dedentHtml(html))}</code></pre>
      </div>
    </div>`;
}

/**
 * Run any pending setup() callbacks for examples just mounted in the outlet.
 * Waits one microtask + custom-element upgrade so child components have
 * called connectedCallback / onRender before setData/setOptions/etc fire.
 */
async function runPendingSetups() {
  if (!pendingSetups.size || !outlet) return;
  const nodes = outlet.querySelectorAll('[data-setup-key]');
  // Wait for any sherpa components inside to finish rendering.
  const renderPromises = [];
  nodes.forEach(node => {
    node.querySelectorAll('*').forEach(el => {
      if (el.tagName?.startsWith('SHERPA-') && el.rendered) renderPromises.push(el.rendered);
    });
  });
  if (renderPromises.length) {
    try { await Promise.all(renderPromises); } catch { /* ignore */ }
  }
  for (const node of nodes) {
    const key = node.dataset.setupKey;
    const fn  = pendingSetups.get(key);
    if (!fn) continue;
    pendingSetups.delete(key);
    try { await fn(node); } catch (err) {
      console.warn('[docs] example setup failed:', err);
    }
  }
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

/* ── Per-component examples (HTML-template loader) ──────────────────────────
 * Each component owns its examples in /components/<tag>/<tag>.examples.html.
 * The file contains one <template> per example, with metadata on the template:
 *
 *   <template
 *     data-label="Variants"
 *     data-description="Optional one-line description"
 *     data-layout="row"            // row (default) | col | block
 *     data-preview="false"         // omit live preview, code only
 *     data-setup="with-data">      // dynamic-import sibling *.examples.js
 *     <sherpa-…>…</sherpa-…>
 *   </template>
 *
 * Setup callbacks (rare — only chart setData / select setOptions) live in a
 * sibling /components/<tag>/<tag>.examples.js whose default export is an
 * object keyed by data-setup name: { 'with-data': (root) => {…} }.
 */
const examplesHtmlCache  = new Map();
const examplesSetupCache = new Map();

async function loadExamplesHtml(tag) {
  if (examplesHtmlCache.has(tag)) return examplesHtmlCache.get(tag);
  const promise = fetch(`/components/${tag}/${tag}.examples.html`)
    .then(r => (r.ok ? r.text() : null))
    .catch(() => null);
  examplesHtmlCache.set(tag, promise);
  return promise;
}

async function loadExamplesSetup(tag) {
  if (examplesSetupCache.has(tag)) return examplesSetupCache.get(tag);
  const promise = import(`/components/${tag}/${tag}.examples.js`)
    .then(m => (m.default && typeof m.default === 'object' ? m.default : null))
    .catch(() => null);
  examplesSetupCache.set(tag, promise);
  return promise;
}

async function parseExamplesFromHtml(tag, html) {
  if (!html) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tpls = [...doc.querySelectorAll('template')];
  if (!tpls.length) return null;

  // Lazily load setup module only when at least one template needs it.
  const needsSetup = tpls.some(t => t.dataset.setup);
  const setupMap = needsSetup ? await loadExamplesSetup(tag) : null;

  return tpls.map(t => {
    const tmp = document.createElement('div');
    tmp.appendChild(t.content.cloneNode(true));
    const innerHtml = tmp.innerHTML;
    return {
      label:       t.dataset.label || 'Example',
      description: t.dataset.description || '',
      layout:      t.dataset.layout || 'row',
      preview:     t.dataset.preview !== 'false',
      html:        innerHtml,
      setup:       setupMap?.[t.dataset.setup] || null,
    };
  });
}

async function getExamples(tag, schema) {
  const html = await loadExamplesHtml(tag);
  const fromHtml = await parseExamplesFromHtml(tag, html);
  if (fromHtml?.length) return fromHtml;
  return [buildAutoExample(tag, schema)];
}

/** Build the full examples section HTML for a component page. */
function buildExamplesSection(tag, examples) {
  if (!examples?.length) return '';
  return `
    <section class="docs-examples-section">
      <sherpa-section-header
        data-label="Examples"
        data-heading-level="secondary"
        data-divider="true"
      ></sherpa-section-header>
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
        category: categoryOf(tag),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    console.warn('[docs] Could not load component list:', err);
  }
}

/** Components visible in the sidebar / category grids (merged children removed). */
function visibleComponents() {
  return components.filter(c => !MERGED_CHILDREN[c.tag]);
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

function setViewHeading(heading, breadcrumbs = null) {
  const view = document.getElementById('docs-view');
  if (!view) return;
  view.dataset.heading = heading;
  if (breadcrumbs && breadcrumbs.length) {
    view.setAttribute('data-breadcrumbs', JSON.stringify(breadcrumbs));
  } else {
    view.removeAttribute('data-breadcrumbs');
  }
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

/** When a merged-child route is redirected, the child anchor is parked here
 * so the post-render flush can scroll the parent page to the right section. */
let pendingScrollAnchor = null;

async function renderCurrentRoute() {
  const route = parseHash(window.location.hash);
  await renderRoute(route);

  const path = (window.location.hash || '#/').replace(/^#/, '') || '/';
  setActiveNavItem(path);

  // Scroll: either reset to top, or jump to a pending child-section anchor.
  const viewContent = document.getElementById('docs-view')?.shadowRoot?.querySelector('[part="content"]');
  if (pendingScrollAnchor && outlet) {
    const id = pendingScrollAnchor;
    pendingScrollAnchor = null;
    requestAnimationFrame(() => {
      const target = outlet.querySelector(`#${CSS.escape(id)}`);
      if (target && viewContent) {
        const top = target.offsetTop;
        viewContent.scrollTo({ top, behavior: 'instant' });
      } else {
        target?.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });
  } else {
    viewContent?.scrollTo?.({ top: 0, behavior: 'instant' });
  }
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
    const items = visibleComponents().filter(c => c.category === route.id);
    setViewHeading(catDef.label, [
      { label: 'Home', href: '#/' },
    ]);
    await renderCategoryPage(catDef, items);
    bindOutletLinks();
    highlightOutlet();
    return;
  }

  if (route.type === 'component') {
    // Redirect merged child routes → parent page, anchored at the child section.
    const mergedParent = MERGED_CHILDREN[route.tag];
    if (mergedParent) {
      pendingScrollAnchor = `child-${route.tag}`;
      navigate(`/components/${mergedParent}`);
      return;
    }

    const schema = await loadSchema(route.tag);
    const comp   = components.find(c => c.tag === route.tag);
    const label  = comp?.label ?? prettyLabel(route.tag);
    const catId    = categoryOf(route.tag);
    const catLabel = categoryLabel(catId);
    setViewHeading(label, [
      { label: 'Home', href: '#/' },
      { label: catLabel,   href: `#/category/${catId}` },
    ]);
    const examples = schema ? await getExamples(route.tag, schema) : [];

    // Pre-fetch any merged children's schema + examples in parallel so we can
    // render them as sub-sections under the parent's API.
    const childTags = PARENT_TO_CHILDREN[route.tag] ?? [];
    const children = childTags.length
      ? await Promise.all(childTags.map(async (childTag) => {
          const childSchema = await loadSchema(childTag);
          if (!childSchema) return null;
          const childExamples = await getExamples(childTag, childSchema);
          return { tag: childTag, label: prettyLabel(childTag), schema: childSchema, examples: childExamples };
        })).then(list => list.filter(Boolean))
      : [];

    outlet.innerHTML = schema
      ? buildComponentPage(route.tag, label, schema, examples, children)
      : buildNotFound(`<${route.tag}>`);
    bindOutletLinks();
    highlightOutlet();
    runPendingSetups();
    return;
  }

  setViewHeading('Not found', [{ label: 'Home', href: '#/' }]);
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
    const count = visibleComponents().filter(c => c.category === cat.id).length;
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

  const desc = outlet.querySelector('[data-region="header-description"]');
  if (desc) {
    if (cat.description) {
      desc.textContent = cat.description;
      desc.hidden = false;
    } else {
      desc.hidden = true;
    }
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

/** Build the four API tables (attributes / slots / events / methods) for a
 * given schema. Returns an HTML string of `<section>`s; empty string when the
 * schema has none of them. */
function buildApiSections(schema) {
  const attrs   = schema.attributes ?? [];
  const slots   = schema.slots ?? [];
  const events  = schema.events ?? [];
  const methods = schema.methods ?? [];

  const attrsHtml = attrs.length ? `
    <section class="docs-api-section">
      <sherpa-section-header
        data-label="Attributes"
        data-heading-level="tertiary"
        data-divider="true"
      ></sherpa-section-header>
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
                <td><sherpa-tag data-variant="secondary" data-status="info">${escapeHtml(a.type ?? '')}</sherpa-tag>${a.enumValues?.length ? `<div class="docs-enum-values">${a.enumValues.map(v => `<code>${escapeHtml(v)}</code>`).join(' ')}</div>` : ''}</td>
                <td>${escapeHtml(a.description ?? '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>` : '';

  const slotsHtml = slots.length ? `
    <section class="docs-api-section">
      <sherpa-section-header
        data-label="Slots"
        data-heading-level="tertiary"
        data-divider="true"
      ></sherpa-section-header>
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
      <sherpa-section-header
        data-label="Events"
        data-heading-level="tertiary"
        data-divider="true"
      ></sherpa-section-header>
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
      <sherpa-section-header
        data-label="Methods"
        data-heading-level="tertiary"
        data-divider="true"
      ></sherpa-section-header>
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

  return { attrsHtml, slotsHtml, eventsHtml, methodsHtml };
}

/** Wrap the four API sections in the collapsible "API Reference" accordion. */
function buildApiAccordion(schema, label = 'API Reference') {
  const { attrsHtml, slotsHtml, eventsHtml, methodsHtml } = buildApiSections(schema);
  if (!attrsHtml && !slotsHtml && !eventsHtml && !methodsHtml) return '';
  return `
    <sherpa-accordion class="docs-api-accordion" data-label="${escapeHtml(label)}" open>
      ${attrsHtml}
      ${slotsHtml}
      ${eventsHtml}
      ${methodsHtml}
    </sherpa-accordion>`;
}

/** Render one merged-child sub-section: heading + description + examples + API. */
function buildChildSection(child) {
  const { lead, rest } = splitDescription(child.schema.description);
  return `
    <section id="child-${escapeHtml(child.tag)}" class="docs-child-section">
      <sherpa-section-header
        data-label="${escapeHtml(child.label)}"
        data-heading-level="secondary"
        data-divider="true"
      >
        <sherpa-tag slot="badge" data-variant="secondary">&lt;${escapeHtml(child.tag)}&gt;</sherpa-tag>
        ${lead ? `<p slot="description">${escapeHtml(lead)}</p>` : ''}
      </sherpa-section-header>

      ${rest.length ? `
      <sherpa-accordion class="docs-impl-notes" data-label="Implementation notes">
        ${rest.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
      </sherpa-accordion>` : ''}

      ${buildExamplesSection(child.tag, child.examples)}
      ${buildApiAccordion(child.schema, `${child.label} API`)}
    </section>`;
}

function buildComponentPage(tag, label, schema, examples, children = []) {
  const { lead, rest } = splitDescription(schema.description);
  const apiHtml = buildApiAccordion(schema);

  const childrenHtml = children.length ? `
    <section class="docs-children-group">
      <sherpa-section-header
        data-label="Sub-components"
        data-heading-level="secondary"
        data-divider="true"
      >
        <p slot="description">Child components scoped to <code>&lt;${escapeHtml(tag)}&gt;</code>. Each is also reachable directly via its own tag.</p>
      </sherpa-section-header>
      ${children.map(buildChildSection).join('')}
    </section>` : '';

  return `
    <div class="docs-page docs-component-page">
      <sherpa-section-header
        data-label="${escapeHtml(label)}"
        data-heading-level="primary"
        data-divider="true"
      >
        <sherpa-tag slot="badge" data-variant="secondary">&lt;${escapeHtml(tag)}&gt;</sherpa-tag>
        ${lead ? `<p slot="description">${escapeHtml(lead)}</p>` : ''}
      </sherpa-section-header>

      ${rest.length ? `
      <sherpa-accordion class="docs-impl-notes" data-label="Implementation notes">
        ${rest.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
      </sherpa-accordion>` : ''}

      ${buildExamplesSection(tag, examples)}
      ${apiHtml}
      ${childrenHtml}
    </div>`;
}

function buildNotFound(what) {
  return `
    <div class="docs-page docs-not-found-page">
      <sherpa-section-header
        data-label="Not found"
        data-heading-level="primary"
        data-divider="true"
      >
        <p slot="description">No documentation found for <code>${what}</code>.</p>
      </sherpa-section-header>
    </div>`;
}

// ── Initialisation ────────────────────────────────────────────────────────────

async function init() {
  initTheme();

  initNav();
  await loadComponents();
  initAppearanceSelects();

  // Copy button delegation — one handler for the whole outlet lifetime.
  // sherpa-button emits button-click; toggle the icon/label via data-* only.
  outlet?.addEventListener('button-click', e => {
    const btn = e.composedPath().find(
      n => n instanceof HTMLElement && n.tagName === 'SHERPA-BUTTON' && n.classList?.contains('docs-copy-btn')
    );
    if (!btn) return;
    const code = btn.closest('.docs-code-block')?.querySelector('code')?.textContent ?? '';
    navigator.clipboard.writeText(code).catch(() => {});
    const origIcon  = btn.dataset.iconStart;
    const origLabel = btn.dataset.label;
    btn.dataset.iconStart = '\uf00c'; // fa-check
    btn.dataset.label     = 'Copied';
    setTimeout(() => {
      btn.dataset.iconStart = origIcon;
      btn.dataset.label     = origLabel;
    }, 2000);
  });

  window.addEventListener('hashchange', handleHashChange);
  await renderCurrentRoute();
}

document.addEventListener('DOMContentLoaded', init);
