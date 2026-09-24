// Sherpa-UI Component Sandbox
// Standalone browser ES module. Imports /dist/index.js to register every
// sherpa-* element, then derives each component's public API at runtime by
// parsing the leading `Public API:` HTML comment in its template file.
//
// The parser lives in the shared, dependency-free module
// server/public-api-parser.mjs (also used by the example template server), so the
// sandbox and the server can never drift from each other or from the real
// component templates.

import '/dist/index.js';
import { parseComponentSpec } from '/server/public-api-parser.mjs';

// ── Component manifest (the 53 src/components dirs) ─────────────────────────
const COMPONENTS = [
  'sherpa-accordion', 'sherpa-app-header', 'sherpa-barchart', 'sherpa-breadcrumbs', 'sherpa-button',
  'sherpa-calendar', 'sherpa-callout', 'sherpa-chart-legend', 'sherpa-chat-message',
  'sherpa-chip', 'sherpa-code-block', 'sherpa-container', 'sherpa-container-footer', 'sherpa-container-header',
  'sherpa-data-grid', 'sherpa-dialog', 'sherpa-radial-chart', 'sherpa-empty-state', 'sherpa-file-upload',
  'sherpa-grid-cell',
  'sherpa-gauge-chart', 'sherpa-input-text', 'sherpa-key-value-list',
  'sherpa-line-chart', 'sherpa-list', 'sherpa-list-item', 'sherpa-loader',
  'sherpa-metric', 'sherpa-nav', 'sherpa-nav-item', 'sherpa-nav-section',
  'sherpa-overlay-panel', 'sherpa-panel',
  'sherpa-pagination', 'sherpa-progress-bar', 'sherpa-progress-step-tracker', 'sherpa-prompt-composer',
  'sherpa-quick-filter', 'sherpa-quick-filter-toolbar', 'sherpa-section-header', 'sherpa-select-card',
  'sherpa-select-checkbox', 'sherpa-select-group', 'sherpa-select-radio', 'sherpa-slider',
  'sherpa-sparkline', 'sherpa-switch', 'sherpa-tabs', 'sherpa-tag',
  'sherpa-toast', 'sherpa-toolbar', 'sherpa-tooltip', 'sherpa-transfer-list',
];

// ══ Runtime spec loading ════════════════════════════════════════════════════

const specCache = new Map();

async function loadSpec(name) {
  if (specCache.has(name)) return specCache.get(name);
  let spec = { name, props: {}, events: [], description: '', error: null };
  try {
    const res = await fetch(`/dist/components/${name}/${name}.html`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    spec = parseComponentSpec(name, html);
  } catch (e) {
    spec.error = String(e && e.message || e);
  }
  specCache.set(name, spec);
  return spec;
}

// ══ Preview element construction ════════════════════════════════════════════

// Best-effort default content so components don't render empty.
const DEFAULT_LABEL = {
  'sherpa-button': 'Click me',
  'sherpa-tag': 'Label',
  'sherpa-callout': 'This is a callout message.',
  'sherpa-code-block': 'const x = 42;',
  'sherpa-tooltip': 'Hover target',
  'sherpa-container': 'Card body content',
  'sherpa-chat-message': 'Hello there!',
  'sherpa-empty-state': 'Nothing here yet.',
};

function makePreview(name, spec) {
  const el = document.createElement(name);
  // Give text-bearing components a default slot / label.
  if (DEFAULT_LABEL[name]) el.textContent = DEFAULT_LABEL[name];
  if (spec.props['data-label'] && !el.textContent) el.dataset.label = 'Label';
  if (spec.props['data-title']) el.dataset.title = 'Section title';
  if (spec.props['placeholder']) el.setAttribute('placeholder', 'Type here…');
  // best-effort populate() for list/grid-like components
  try {
    if (typeof el.populate === 'function') {
      if (name === 'sherpa-list') el.populate([{ title: 'Row one', description: 'desc' }, { title: 'Row two' }]);
      else if (name === 'sherpa-tabs') el.populate([{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }]);
    }
  } catch { /* ignore populate failures */ }
  return el;
}

// ══ UI wiring ════════════════════════════════════════════════════════════════

const els = {
  pickerList: document.getElementById('picker-list'),
  pickerSearch: document.getElementById('picker-search'),
  stageInner: document.getElementById('stage-inner'),
  controls: document.getElementById('controls'),
  eventLog: document.getElementById('event-log'),
  previewMeta: document.getElementById('preview-meta'),
  componentDesc: document.getElementById('component-desc'),
  clearLog: document.getElementById('clear-log'),
  modeTabs: document.getElementById('mode-tabs'),
};

let current = { name: null, el: null, spec: null, listeners: [] };

function renderPickerList(filter = '') {
  els.pickerList.innerHTML = '';
  const f = filter.trim().toLowerCase();
  for (const name of COMPONENTS) {
    if (f && !name.includes(f)) continue;
    const btn = document.createElement('button');
    btn.className = 'picker-item';
    btn.textContent = name.replace(/^sherpa-/, '');
    btn.dataset.name = name;
    if (name === current.name) btn.setAttribute('aria-current', 'true');
    btn.addEventListener('click', () => selectComponent(name));
    els.pickerList.appendChild(btn);
  }
}

function logEvent(name, detail) {
  const hint = els.eventLog.querySelector('.empty-hint');
  if (hint) hint.remove();
  const line = document.createElement('div');
  line.className = 'event-line';
  const t = new Date().toLocaleTimeString();
  let detailStr = '';
  try { detailStr = detail ? ' ' + JSON.stringify(detail) : ''; } catch { detailStr = ' [detail]'; }
  line.innerHTML =
    `<span class="event-name"></span> <span class="event-detail"></span> <span class="event-time"></span>`;
  line.querySelector('.event-name').textContent = name;
  line.querySelector('.event-detail').textContent = detailStr.trim();
  line.querySelector('.event-time').textContent = t;
  els.eventLog.prepend(line);
}

function attachEventListeners(el, events) {
  const listeners = [];
  for (const name of events) {
    const fn = (ev) => logEvent(name, ev.detail);
    el.addEventListener(name, fn);
    listeners.push([name, fn]);
  }
  return listeners;
}

function currentValueOf(prop) {
  const el = current.el;
  if (prop.native) {
    if (prop.type === 'boolean') return el.hasAttribute(prop.name);
    return el.getAttribute(prop.name) ?? '';
  }
  if (prop.type === 'boolean') return el.hasAttribute(prop.name);
  return el.getAttribute(prop.name) ?? '';
}

function setAttr(prop, value) {
  const el = current.el;
  if (prop.type === 'boolean') {
    if (value) el.setAttribute(prop.name, prop.native ? '' : (prop.name.startsWith('data-') ? 'true' : ''));
    else el.removeAttribute(prop.name);
  } else {
    if (value === '' || value == null) el.removeAttribute(prop.name);
    else el.setAttribute(prop.name, value);
  }
  updateMeta();
}

function resetProp(prop, rowRefresh) {
  const el = current.el;
  if (prop.type === 'boolean') {
    if (prop.default) el.setAttribute(prop.name, ''); else el.removeAttribute(prop.name);
  } else if (prop.default != null) {
    el.setAttribute(prop.name, prop.default);
  } else {
    el.removeAttribute(prop.name);
  }
  updateMeta();
  rowRefresh();
}

function buildControl(prop) {
  const row = document.createElement('div');
  row.className = 'control-row';

  const head = document.createElement('div');
  head.className = 'control-head';
  const nameEl = document.createElement('span');
  nameEl.className = 'control-name';
  nameEl.textContent = prop.name;
  const badge = document.createElement('span');
  badge.className = 'control-badge';
  badge.textContent = prop.native ? `native ${prop.type}` : prop.type;
  head.append(nameEl, badge);
  row.appendChild(head);

  if (prop.description) {
    const d = document.createElement('div');
    d.className = 'control-desc';
    d.textContent = prop.description;
    row.appendChild(d);
  }

  let refreshFromEl = () => {};

  if (prop.type === 'enum') {
    if (prop.values.length <= 5) {
      // sherpa-tabs segmented control
      const tabs = document.createElement('sherpa-tabs');
      const opts = ['(unset)', ...prop.values];
      customElements.whenDefined('sherpa-tabs').then(() => {
        if (typeof tabs.populate === 'function') {
          tabs.populate(opts.map((v) => ({ id: v, label: v })));
        }
        const cur = currentValueOf(prop);
        tabs.dataset.activeId = cur || '(unset)';
      });
      tabs.addEventListener('tab-change', (e) => {
        const id = e.detail && e.detail.id;
        setAttr(prop, id === '(unset)' ? '' : id);
      });
      refreshFromEl = () => { const cur = currentValueOf(prop); tabs.dataset.activeId = cur || '(unset)'; };
      row.appendChild(tabs);
    } else {
      const sel = document.createElement('select');
      const blank = new Option('(unset)', '');
      sel.add(blank);
      for (const v of prop.values) sel.add(new Option(v, v));
      sel.value = currentValueOf(prop);
      sel.addEventListener('change', () => setAttr(prop, sel.value));
      refreshFromEl = () => { sel.value = currentValueOf(prop); };
      row.appendChild(sel);
    }
  } else if (prop.type === 'boolean') {
    const sw = document.createElement('sherpa-switch');
    customElements.whenDefined('sherpa-switch').then(() => {
      sw.toggleAttribute('checked', !!currentValueOf(prop));
    });
    sw.addEventListener('change', (e) => {
      const on = e.detail && 'checked' in e.detail ? e.detail.checked : sw.checked;
      setAttr(prop, on);
    });
    refreshFromEl = () => { sw.toggleAttribute('checked', !!currentValueOf(prop)); };
    row.appendChild(sw);
  } else {
    // string / native text → sherpa-input-text (debounced)
    const input = document.createElement('sherpa-input-text');
    input.dataset.style = 'minimal';
    customElements.whenDefined('sherpa-input-text').then(() => {
      const cur = currentValueOf(prop);
      if (cur) input.setAttribute('value', cur);
    });
    let t;
    const onInput = (e) => {
      clearTimeout(t);
      const v = (e.target && e.target.value) ?? '';
      t = setTimeout(() => setAttr(prop, v), 120);
    };
    input.addEventListener('input', onInput);
    refreshFromEl = () => { input.setAttribute('value', currentValueOf(prop) || ''); };
    row.appendChild(input);
  }

  const reset = document.createElement('button');
  reset.className = 'control-reset';
  reset.textContent = 'reset';
  reset.addEventListener('click', () => resetProp(prop, refreshFromEl));
  head.appendChild(reset);

  return row;
}

function updateMeta() {
  const el = current.el;
  if (!el) { els.previewMeta.textContent = ''; return; }
  const attrs = [...el.attributes].map((a) => a.value === '' ? a.name : `${a.name}="${a.value}"`).join(' ');
  els.previewMeta.innerHTML = `<code>&lt;${current.name}${attrs ? ' ' + attrs : ''}&gt;</code>`;
}

async function selectComponent(name) {
  // tear down old listeners
  for (const [n, fn] of current.listeners) current.el?.removeEventListener(n, fn);
  current = { name, el: null, spec: null, listeners: [] };

  renderPickerList(els.pickerSearch.value);

  const spec = await loadSpec(name);
  current.spec = spec;

  await definedOrTimeout(name, 3000);
  const el = makePreview(name, spec);
  current.el = el;
  els.stageInner.innerHTML = '';
  els.stageInner.appendChild(el);

  current.listeners = attachEventListeners(el, spec.events);

  // description
  els.componentDesc.textContent = spec.description || '';

  // controls
  els.controls.innerHTML = '';
  const propNames = Object.keys(spec.props);
  if (propNames.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = spec.error ? `No controls (${spec.error}).` : 'This component exposes no data-* / native attributes.';
    els.controls.appendChild(hint);
  } else {
    for (const pn of propNames) els.controls.appendChild(buildControl(spec.props[pn]));
  }

  // events note
  if (spec.events.length) {
    const note = document.createElement('div');
    note.className = 'empty-hint';
    note.textContent = `Listening for: ${spec.events.join(', ')}`;
    els.controls.appendChild(note);
  }

  updateMeta();
}

// ── Static chrome wiring ─────────────────────────────────────────────────────
els.pickerSearch.addEventListener('input', () => renderPickerList(els.pickerSearch.value));
els.clearLog.addEventListener('click', () => {
  els.eventLog.innerHTML = '<div class="empty-hint">No events yet.</div>';
});
customElements.whenDefined('sherpa-tabs').then(() => {
  if (typeof els.modeTabs.populate === 'function') {
    els.modeTabs.populate([{ id: 'auto', label: 'Auto' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]);
  }
  els.modeTabs.addEventListener('tab-change', (e) => {
    document.documentElement.dataset.mode = (e.detail && e.detail.id) || 'auto';
  });
});

// ── Boot ─────────────────────────────────────────────────────────────────────
window.__sandboxReady = false;
// whenDefined never resolves for a name that is never registered (e.g. sherpa-grid-cell
// has a dir but no registration), so race each against a short timeout.
function definedOrTimeout(name, ms = 2000) {
  return Promise.race([
    customElements.whenDefined(name).catch(() => {}),
    new Promise((r) => setTimeout(r, ms)),
  ]);
}
(async function boot() {
  await Promise.all(COMPONENTS.map((n) => definedOrTimeout(n)));
  renderPickerList();
  await selectComponent('sherpa-button');
  window.__sandboxReady = true;
  // expose for automated verification
  window.__sandbox = { loadSpec, selectComponent, get current() { return current; } };
})();
