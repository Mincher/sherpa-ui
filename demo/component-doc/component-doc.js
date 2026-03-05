import "/components/index.js";

/* ── Constants ──────────────────────────────────────────── */

const TEMPLATE_PATHS = {
  container: "/components/sherpa-container/sherpa-container.html",
  containerMenu: "/components/sherpa-container/sherpa-container-menu.html",
  metric: "/components/sherpa-metric/sherpa-metric.html",
  table: "/components/sherpa-base-table/sherpa-base-table.html"
};
const METADATA_PATH = "/demo/component-doc/component-docs.json";

/* ── Metadata resolution ────────────────────────────────── */

let metadataIndexPromise = null;

async function loadMetadataIndex() {
  if (!metadataIndexPromise) {
    metadataIndexPromise = fetch(METADATA_PATH)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
  }
  return metadataIndexPromise;
}

function normalizeDocId(doc) {
  if (!doc) return null;
  if (doc.endsWith("component-doc.html"))
    return doc.replace(/^\//, "").replace(/^components\//, "").replace(/\/component-doc\.html$/, "");
  return doc.replace(/^\//, "");
}

function deriveDocIdFromLocation() {
  try {
    const url = new URL(window.location.href);
    const p = normalizeDocId(url.searchParams.get("doc"));
    if (p) return p;
    const m = url.pathname.match(/\/components\/(.+)\/component-doc\.html$/);
    if (m) return m[1];
  } catch { /* ignore */ }
  return null;
}

async function resolveMetadata(root) {
  if (root.__docMetadata) return root.__docMetadata;
  const docId = normalizeDocId(root.dataset?.docId) || deriveDocIdFromLocation();
  const component = root.dataset?.component || null;
  const index = await loadMetadataIndex();
  if (!index?.components) return null;

  let meta = docId ? index.components[docId] : null;
  if (!meta && component)
    meta = Object.values(index.components).find(e => e.component === component) || null;

  if (meta) {
    root.__docMetadata = meta;
    if (!root.dataset.docId && docId) root.dataset.docId = docId;
    if (!root.dataset.docPath && meta.path) root.dataset.docPath = meta.path;
    if (!root.dataset.component && meta.component) root.dataset.component = meta.component;
  }
  return meta;
}

/* ── Bootstrap ──────────────────────────────────────────── */

const root = document.querySelector("[data-doc-root][data-component]")
  || document.querySelector("[data-doc-root]")
  || document.querySelector("body[data-component]");

const $ = sel => root?.querySelector(sel) || document.querySelector(sel);

let config, componentName, state;
let componentEl, wrapperInit = false, lastAttrs = new Set(), demoInit = false;
let templatesCache;

function initAttrState(a) {
  if (!a?.name) return null;
  const type = a.type || "string";
  return {
    name: a.name,
    type,
    value: type === "boolean" ? (a.default === true || a.default === "true") : (a.default ?? "")
  };
}

(async () => {
  if (!root) return;
  config = (await resolveMetadata(root)) || {};
  componentName = config.component || root.dataset?.component || "";
  const label = componentName ? (config.label || formatLabel(componentName)) : "Component";

  state = {
    attrs: (config.attributes || []).map(initAttrState).filter(Boolean),
    defaultContent: config.defaultContent || config.defaultHtml || "",
    defaultContentIsHtml: Boolean(config.defaultHtml || config.defaultContentIsHtml),
    slots: (config.slots || []).map(s => ({ name: s.name, html: s.html || "" }))
  };

  // Bind header data
  const title = $("[data-doc-title]");
  const desc = $("[data-doc-description]");
  if (title) title.textContent = label;
  if (desc) desc.textContent = config.description || "Interactive documentation for the component.";
  const tag = $("[data-doc-tag]");
  if (tag) tag.textContent = `<${componentName}>`;
  const path = $("[data-doc-path]");
  if (path) path.textContent = root.dataset.docPath || window.location.pathname.replace(/^\//, "");
  document.title = `${label} - Component Docs`;

  // Nested components
  const nested = $("[data-nested-components]");
  if (nested && config.nestedComponents?.length) {
    nested.innerHTML = config.nestedComponents
      .map(c => `<code class="doc-inline-code">&lt;${c}&gt;</code>`).join(" ");
  }

  // Theme
  const themeSel = $("[data-theme-select]");
  if (themeSel) {
    const stored = localStorage.getItem("apx-theme") || "system";
    themeSel.value = stored;
    applyTheme(stored);
    themeSel.addEventListener("change", e => {
      localStorage.setItem("apx-theme", e.target.value);
      applyTheme(e.target.value);
    });
  }

  // Control visibility
  const ctrl = config.controls || {};
  if (ctrl.attributes === false) $("[data-control-attrs]")?.setAttribute("hidden", "");
  if (ctrl.defaultSlot === false) $("[data-control-default-slot]")?.setAttribute("hidden", "");
  if (ctrl.namedSlots === false) $("[data-control-named-slots]")?.setAttribute("hidden", "");

  // Wire static controls
  const ta = $("[data-default-content]");
  if (ta) {
    ta.value = state.defaultContent;
    ta.addEventListener("input", e => { state.defaultContent = e.target.value; scheduleApply(); });
  }
  const htmlToggle = $("[data-default-html]");
  if (htmlToggle) {
    htmlToggle.checked = state.defaultContentIsHtml;
    htmlToggle.addEventListener("change", e => { state.defaultContentIsHtml = e.target.checked; scheduleApply(); });
  }
  $("[data-reset]")?.addEventListener("click", resetState);

  // Render dynamic controls
  renderAttrList();
  renderSlotList();
  renderDemoActions();
  applyState();
})();

/* ── Theme ──────────────────────────────────────────────── */

function applyTheme(v) {
  if (v === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", v);
}

/* ── Reset ──────────────────────────────────────────────── */

function resetState() {
  state.attrs = (config.attributes || []).map(initAttrState).filter(Boolean);
  state.defaultContent = config.defaultContent || config.defaultHtml || "";
  state.defaultContentIsHtml = Boolean(config.defaultHtml || config.defaultContentIsHtml);
  state.slots = (config.slots || []).map(s => ({ name: s.name, html: s.html || "" }));

  const ta = $("[data-default-content]");
  if (ta) ta.value = state.defaultContent;
  const toggle = $("[data-default-html]");
  if (toggle) toggle.checked = state.defaultContentIsHtml;

  renderAttrList();
  renderSlotList();
  scheduleApply(true);
}

/* ── Attribute controls ─────────────────────────────────── */

function renderAttrList() {
  const list = $("[data-attr-list]");
  if (!list) return;
  list.innerHTML = "";

  for (const def of config.attributes || []) {
    const sa = state.attrs.find(a => a.name === def.name);
    const val = sa?.value ?? (def.type === "boolean" ? def.default === true || def.default === "true" : def.default ?? "");

    const row = document.createElement("div");
    row.className = "doc-control-row doc-control-row--attr";
    row.innerHTML = `<label class="doc-attr-label">${def.name}</label>`;

    const ctrl = makeControl(def, val);
    ctrl.className = "doc-attr-value";
    ctrl.addEventListener("change", e => {
      const v = def.type === "boolean" ? e.target.value === "true" : e.target.value;
      const i = state.attrs.findIndex(a => a.name === def.name);
      if (i >= 0) Object.assign(state.attrs[i], { value: v, type: def.type || "string" });
      else state.attrs.push({ name: def.name, value: v, type: def.type || "string" });
      scheduleApply();
    });

    row.appendChild(ctrl);
    list.appendChild(row);
  }
}

function makeControl(def, value) {
  if (def.type === "boolean") {
    const s = document.createElement("select");
    s.innerHTML = `<option value="false">false</option><option value="true">true</option>`;
    s.value = value ? "true" : "false";
    return s;
  }
  if (def.type === "enum" && def.options) {
    const s = document.createElement("select");
    s.innerHTML = def.options.map(o => `<option value="${o}">${o || "(none)"}</option>`).join("");
    s.value = value ?? "";
    return s;
  }
  const inp = document.createElement("input");
  inp.type = def.type === "number" ? "number" : "text";
  inp.value = value ?? "";
  return inp;
}

/* ── Slot controls ──────────────────────────────────────── */

function renderSlotList() {
  const list = $("[data-slot-list]");
  if (!list) return;
  list.innerHTML = "";

  for (const def of config.slots || []) {
    const ss = state.slots.find(s => s.name === def.name);
    const row = document.createElement("div");
    row.className = "doc-control-row doc-control-row--slot";
    row.innerHTML = `<label class="doc-slot-label">${def.name || "(default)"}</label>`;

    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "doc-slot-html";
    inp.placeholder = "Slot HTML";
    inp.value = ss?.html ?? def.html ?? "";
    inp.addEventListener("input", e => {
      const i = state.slots.findIndex(s => s.name === def.name);
      if (i >= 0) state.slots[i].html = e.target.value;
      else state.slots.push({ name: def.name, html: e.target.value });
      scheduleApply();
    });

    row.appendChild(inp);
    list.appendChild(row);
  }
}

/* ── Demo actions ───────────────────────────────────────── */

function renderDemoActions() {
  const area = $("[data-demo-actions]");
  if (!area) return;
  if (!config.demoActions?.length) { area.hidden = true; return; }

  area.innerHTML = "";
  for (const a of config.demoActions) {
    const btn = document.createElement("sherpa-button");
    btn.setAttribute("data-variant", "secondary");
    btn.setAttribute("data-size", "small");
    btn.setAttribute("data-label", a.label);
    btn.addEventListener("click", () => handleDemoAction(a.action));
    area.appendChild(btn);
  }
}

function handleDemoAction(action) {
  if (!componentEl) return;
  if (action === "show") componentEl.show?.();
  else if (action === "hide") componentEl.hide?.();
  else if (action === "toggle") componentEl.toggle?.();
  else if (action === "load-pdf") loadContainerPdfDemo(componentEl, config.containerPdfDemo?.source);
}

/* ── State → preview ────────────────────────────────────── */

let applyQueued = false;

function scheduleApply(rebuild = false) {
  if (applyQueued) return;
  applyQueued = true;
  requestAnimationFrame(() => { applyQueued = false; applyState(rebuild); });
}

function applyState(rebuild = false) {
  const t = ensureComponent(rebuild);
  if (!t) return;
  applyAttributes(t);
  applySlots(t);
  renderCode();
  if (componentName === "sherpa-tooltip") setupTooltipDemo();
  if (!demoInit) { demoInit = true; runPostInit(t); }
}

function ensureComponent(rebuild) {
  const stage = $("[data-preview-stage]");
  if (!stage) return null;

  if (!wrapperInit || rebuild) {
    stage.innerHTML = "";
    if (config.wrapperHtml) {
      stage.innerHTML = config.wrapperHtml;
      componentEl = stage.querySelector(config.componentSelector || componentName);
    } else {
      componentEl = document.createElement(componentName);
      stage.appendChild(componentEl);
    }
    wrapperInit = true;
    demoInit = false;
  }
  if (!componentEl) componentEl = stage.querySelector(componentName);
  return componentEl;
}

function applyAttributes(t) {
  lastAttrs.forEach(n => t.removeAttribute(n));
  lastAttrs = new Set();

  for (const a of state.attrs) {
    if (!a?.name) continue;
    if (a.type === "boolean") {
      if (a.value) { t.setAttribute(a.name, ""); lastAttrs.add(a.name); }
      else t.removeAttribute(a.name);
    } else if (a.value !== "" && a.value != null) {
      t.setAttribute(a.name, a.value);
      lastAttrs.add(a.name);
    } else {
      t.removeAttribute(a.name);
    }
  }
}

function applySlots(t) {
  const c = config.controls || {};
  if (c.defaultSlot === false && c.namedSlots === false) return;
  if (config.containerDemo || config.containerPdfDemo || config.contentAreaDemo || config.navDemo) return;

  t.querySelectorAll("[data-doc-slot]").forEach(n => n.remove());

  if (c.defaultSlot !== false && state.defaultContent)
    injectSlot(t, state.defaultContent, state.defaultContentIsHtml, null);

  if (c.namedSlots !== false)
    for (const s of state.slots) { if (s.name && s.html) injectSlot(t, s.html, true, s.name); }
}

function injectSlot(target, html, isHtml, slotName) {
  const tag = slotName || "default";
  if (!isHtml) {
    const span = Object.assign(document.createElement("span"), { textContent: html });
    span.dataset.docSlot = tag;
    if (slotName) span.slot = slotName;
    target.appendChild(span);
    return;
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  for (const node of Array.from(tpl.content.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) continue;
    const el = node.nodeType === Node.TEXT_NODE
      ? Object.assign(document.createElement("span"), { textContent: node.textContent })
      : node;
    el.dataset.docSlot = tag;
    if (slotName) el.slot = slotName;
    target.appendChild(el);
  }
}

/* ── Code generation ────────────────────────────────────── */

function renderCode() {
  const block = $("[data-code-block]");
  if (block) block.textContent = buildMarkup();
}

function buildMarkup() {
  const attrStr = state.attrs.filter(a => a?.name).map(a => {
    if (a.type === "boolean") return a.value ? a.name : "";
    return (a.value !== "" && a.value != null) ? `${a.name}="${a.value}"` : "";
  }).filter(Boolean).join(" ");

  const open = attrStr ? `<${componentName} ${attrStr}>` : `<${componentName}>`;
  const c = config.controls || {};
  const lines = [];

  if (c.defaultSlot !== false && state.defaultContent) lines.push(state.defaultContent);

  if (c.namedSlots !== false) {
    for (const s of state.slots) {
      if (!s.name || !s.html) continue;
      const tpl = document.createElement("template");
      tpl.innerHTML = s.html.trim();
      const kids = Array.from(tpl.content.children);
      if (!kids.length) { lines.push(`<span slot="${s.name}">${s.html}</span>`); continue; }
      kids.forEach(el => { el.setAttribute("slot", s.name); lines.push(el.outerHTML); });
    }
  }

  const indent = t => t.split("\n").map(l => `  ${l}`).join("\n");
  const body = lines.length
    ? `${open}\n${indent(lines.join("\n"))}\n</${componentName}>`
    : `${open}</${componentName}>`;

  if (!config.codeWrapper) return body;
  return config.codeWrapper
    .replace("{{tooltipText}}", state.defaultContent || config.tooltipText || "Tooltip")
    .replace("{{component}}", indent(body));
}

/* ── Post-init (component-specific) ─────────────────────── */

function runPostInit(t) {
  switch (componentName) {
    case "sherpa-filter-chip":
      t.setAvailableColumns?.([
        { field: "revenue", name: "Revenue", type: "currency" },
        { field: "orders", name: "Orders", type: "number" },
        { field: "region", name: "Region", type: "string" }
      ]);
      return;
  }

  // Steps (stepper)
  if (config.sampleSteps?.length) {
    t.setSteps?.(config.sampleSteps);
  }

  // Sample dataset (barchart, base-table, metric)
  if (config.sampleData) {
    loadSampleData(t, config.sampleData);
    return;
  }

  if (config.navDemo) { setupNavDemo(t, config.navDemo); return; }
  if (config.containerDemo) { loadContainerDemo(t, config.containerDemo.source); return; }
  if (config.contentAreaDemo) {
    const viewId = config.contentAreaDemo.viewId || "default-view";
    loadContentAreaDemo(t, viewId);
    return;
  }
  if (config.containerPdfDemo) loadContainerPdfDemo(t, config.containerPdfDemo.source);
  if (componentName === "sherpa-tooltip") setupTooltipDemo();
}

/* ── Demo loaders ───────────────────────────────────────── */

async function loadSampleData(t, sampleCfg) {
  try {
    const res = await fetch(sampleCfg.source);
    if (!res.ok) return;
    const index = await res.json();
    const query = index[sampleCfg.key];
    if (!query) return;
    await t.setData?.(query);
  } catch (e) { console.warn("Sample data load failed", e); }
}

async function loadContentAreaDemo(t, viewId) {
  try {
    const res = await fetch(`/html/templates/views/${viewId}.html`);
    if (!res.ok) return;
    const html = await res.text();
    // The template wraps containers in <div class="sherpa-content-area">. Extract inner containers.
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const area = tmp.querySelector(".sherpa-content-area");
    if (area) {
      // Move containers into the demo element
      while (area.firstElementChild) t.appendChild(area.firstElementChild);
      t.setAttribute("data-view-id", viewId);
    }
  } catch (e) { console.warn("Content area demo load failed", e); }
}

async function loadContainerDemo(t, source) {
  try {
    // Derive content template id from the source path:
    // "/data/queries/sales-demo.json" → "sales-demo"
    const contentId = source.replace(/^.*\//, "").replace(/\.json$/, "");
    t.setAttribute("data-content", contentId);
    t.setAttribute("data-col-span", "6");
    t.setAttribute("data-row-span", "2");
  } catch (e) { console.warn("Container demo load failed", e); }
}

async function loadContainerPdfDemo(t, source) {
  try {
    const c = document.createElement("sherpa-container");
    c.classList.add("doc-hidden");
    $("[data-preview-stage]").appendChild(c);
    await loadContainerDemo(c, source);
    for (let w = 0; w < 3000; w += 150) {
      const el = c.querySelector("sherpa-base-table, sherpa-barchart, sherpa-sparkline");
      if (el?.getData?.()) break;
      await new Promise(r => setTimeout(r, 150));
    }
    await t.setData?.(c);
  } catch (e) { console.warn("Container PDF demo load failed", e); }
}

async function loadTemplates() {
  if (templatesCache) return templatesCache;
  const entries = await Promise.all(
    Object.entries(TEMPLATE_PATHS).map(async ([k, p]) => [k, await fetch(p).then(r => r.text())])
  );
  return templatesCache = Object.fromEntries(entries);
}

function setupTooltipDemo() {
  const a = $("[data-preview-stage]")?.querySelector("[data-tooltip-anchor]");
  if (!a) return;
  a.setAttribute("data-tooltip", state.defaultContent || config.tooltipText || "Tooltip");
  a.setAttribute("data-tooltip-position", state.attrs.find(x => x.name === "position")?.value || "top");
}

function setupNavDemo(t, navCfg) {
  const configs = navCfg.configs || [];
  const src = configs[0]?.src || "/components/sherpa-nav/config.json";
  t.setAttribute("data-src", src);

  if (configs.length > 1) {
    const area = $("[data-demo-actions]");
    if (!area) return;
    area.hidden = false;
    const row = document.createElement("div");
    row.className = "doc-control-row doc-control-row--attr";
    row.innerHTML = `<label class="doc-attr-label">Config source</label>`;
    const sel = document.createElement("select");
    sel.className = "doc-attr-value";
    sel.innerHTML = configs.map(c => `<option value="${c.src}">${c.label}</option>`).join("");
    sel.value = src;
    sel.addEventListener("change", e => t.setAttribute("data-src", e.target.value));
    row.appendChild(sel);
    area.appendChild(row);
  }
}

/* ── Helpers ────────────────────────────────────────────── */

function formatLabel(name) {
  return name.replace("sherpa-", "").split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
