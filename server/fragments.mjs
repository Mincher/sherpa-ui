/**
 * fragments.mjs — the HTML-over-the-wire renderers (example task app).
 *
 * Demonstrates the framework conventions end to end:
 *   - read views (filter chips, list, detail) — hx-get,
 *   - a WRITE (toggle done, add task) — hx-post, with an out-of-band (hx-swap-oob)
 *     refresh of the sibling regions the mutation affects.
 * hx-* lives on the component that OWNS the interaction; hx-trigger = its noun-verb
 * event; hx-vals reads the retargeted event.target.dataset. See docs/FRAMEWORK.md.
 */
import { html } from './html.mjs';
import { listTasks, getTask, toggleDone, addTask, counts } from './data.mjs';

/** Filter chips (All / Open / Done) with live counts. Clicking a chip reloads the list.
 *  `oob` renders the #filters wrapper with hx-swap-oob so a write can refresh it. */
export function filtersFragment(active = 'all', oob = false) {
  const c = counts();
  const chip = (key, label, count) => html`<sherpa-quick-filter
      data-label="${label}"
      data-count="${String(count)}"
      ${active === key ? html`data-current` : ''}
      data-filter="${key}"
      hx-get="/fragments/tasks?filter=${key}"
      hx-trigger="quick-filter-click"
      hx-target="#list"
      hx-swap="innerHTML"></sherpa-quick-filter>`;
  return html`<div class="filters" id="filters" ${oob ? html`hx-swap-oob="true"` : ''}>
      ${chip('all', 'All', c.all)}
      ${chip('open', 'Open', c.open)}
      ${chip('done', 'Done', c.done)}
    </div>`;
}

/** The task list for a filter — one <sherpa-list-item> per task. */
export function listFragment(filter = 'all') {
  const rows = listTasks({ filter }).map(
    (t) => html`<sherpa-list-item
        data-interactive
        data-label="${t.label}"
        data-description="${t.done ? 'Done' : t.description}"
        ${t.done ? html`data-current` : ''}
        data-item-id="${t.id}"></sherpa-list-item>`,
  );
  return html`<sherpa-list
      data-variant="divided"
      hx-get="/fragments/task"
      hx-trigger="item-click"
      hx-target="#detail"
      hx-swap="innerHTML"
      hx-vals='js:{id: event.target.dataset.itemId}'>
      ${rows.length ? rows : html`<sherpa-list-item data-label="No tasks"></sherpa-list-item>`}
    </sherpa-list>`;
}

/** Detail card for one task, with a done-toggle button (the write). */
export function detailFragment(id) {
  const t = getTask(id);
  if (!t) return html`<sherpa-callout data-heading="Not found">No task “${id}”.</sherpa-callout>`;
  return html`<sherpa-container data-status="${t.status}">
      <sherpa-container-header slot="header" data-heading="${t.label}"></sherpa-container-header>
      <p>${t.description}</p>
      <sherpa-tag data-status="${t.done ? 'success' : t.status}">${t.done ? 'done' : t.status}</sherpa-tag>
      <div class="detail-actions">
        <sherpa-button
            data-variant="primary"
            data-label="${t.done ? 'Mark not done' : 'Mark done'}"
            hx-post="/fragments/toggle?id=${t.id}"
            hx-trigger="button-click"
            hx-target="#detail"
            hx-swap="innerHTML"></sherpa-button>
      </div>
    </sherpa-container>`;
}

/**
 * Toggle response: the fresh detail (targeted swap) PLUS an out-of-band refresh of
 * the list and the filter counts — one request, three regions updated. This is the
 * canonical HTMX write pattern (hx-swap-oob on siblings the mutation touched).
 */
export function toggleResponse(id) {
  toggleDone(id);
  return html`${detailFragment(id)}
    <div id="list" hx-swap-oob="true">${listFragment('all')}</div>
    ${filtersFragment('all', true)}`;
}

/** Add response: refresh list + filters out-of-band; detail shows the new task. */
export function addResponse(label) {
  const t = addTask(label);
  return html`${detailFragment(t.id)}
    <div id="list" hx-swap-oob="true">${listFragment('all')}</div>
    ${filtersFragment('all', true)}`;
}
