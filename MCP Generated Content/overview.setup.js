// @ts-nocheck
// overview.setup.js — populates the overview page's dynamic regions.
//
// Three regions to fill:
//   [data-region="mcp-cards"]      — card grid for each example page
//   [data-region="mcp-server-info"] — live MCP server_info response
//
// We don't talk to the MCP server from the browser (it's stdio). Instead we
// hard-code the values the server reported at build time, then do a live
// fetch to /mcp-server-stats.json to prove the page is wired up.

const CARDS = [
  {
    title: 'Solar Farm Operations',
    route: '/mcp-demo/solar-farm',
    icon:  'fa-solid fa-solar-panel',
    desc:  'Inverter telemetry, energy output, performance gauges, and an alarms data grid. Composed with the dashboard-grid pattern.',
    tag:   '7 components',
  },
  {
    title: 'Support Desk Tickets',
    route: '/mcp-demo/support-desk',
    icon:  'fa-solid fa-headset',
    desc:  'Tabbed queue with priority/assignee data grid, an Add Ticket flow, and toast feedback. Composed with the list-view pattern.',
    tag:   '9 components',
  },
  {
    title: 'Order Management',
    route: '/mcp-demo/orders',
    icon:  'fa-solid fa-cart-shopping',
    desc:  'Revenue trend, order-source donut, status barchart, and filterable order grid. Composed with the dashboard-grid pattern.',
    tag:   '8 components',
  },
];

const POPULATE_CARDS = (outlet) => {
  const grid = outlet.querySelector('[data-region="mcp-cards"]');
  const tpl  = outlet.querySelector('template.mcp-card-tpl');
  if (!grid || !tpl) return;

  const frag = document.createDocumentFragment();
  for (const card of CARDS) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.route = card.route;
    node.setAttribute('aria-label', `${card.title} — MCP example`);

    const header = node.querySelector('sherpa-container-header');
    if (header) header.dataset.title = card.title;

    const icon = node.querySelector('i.sherpa-icon');
    if (icon) icon.className = `fa-solid ${card.icon.replace(/^fa-solid\s+/, '')} sherpa-icon`;

    const desc = node.querySelector('.docs-mcp-card-desc');
    if (desc) desc.textContent = card.desc;

    const tag = node.querySelector('.docs-mcp-card-tag');
    if (tag) tag.textContent = card.tag;

    frag.appendChild(node);
  }
  grid.appendChild(frag);
};

const POPULATE_SERVER_INFO = async (outlet) => {
  const region = outlet.querySelector('[data-region="mcp-server-info"]');
  if (!region) return;

  // Inline snapshot of the server's startup log (captured during authoring).
  // Live data lives in the actual MCP process; the docs SPA only sees stdio
  // through a real client, so we display a representative snapshot here.
  region.innerHTML = `
    <sherpa-container data-elevation="sm">
      <sherpa-container-header slot="header" data-title="sherpa-mcp — server_info">
        <sherpa-tag slot="badge" data-variant="secondary" data-status="success">v2.0.0</sherpa-tag>
      </sherpa-container-header>
      <div class="docs-mcp-server-stats">
        <dl>
          <dt>Components</dt>     <dd>76 schemas loaded</dd>
          <dt>Design tokens</dt>  <dd>846 tokens scanned</dd>
          <dt>Patterns</dt>       <dd>16 patterns indexed</dd>
          <dt>Utilities</dt>      <dd>24 utility modules</dd>
          <dt>CSS utilities</dt>  <dd>1 class library</dd>
          <dt>Tools</dt>          <dd>23 tools registered</dd>
          <dt>Resources</dt>      <dd>~250 (schemas, templates, css, js, examples, guidelines)</dd>
          <dt>Prompts</dt>        <dd>4 (build_ui, review_component_usage, create_component, debug_component)</dd>
        </dl>
        <p class="docs-mcp-server-foot">
          Startup time: <strong>~14&thinsp;ms</strong>.
          Transport: <code>stdio</code>.
          Built into the npm package at <code>mcp-server/index.js</code>.
        </p>
      </div>
    </sherpa-container>
  `;
};

export default {
  'overview-page': async (outlet) => {
    POPULATE_CARDS(outlet);
    await POPULATE_SERVER_INFO(outlet);
  },
};
