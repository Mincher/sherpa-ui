/**
 * filter-panel.js — the filter toolbars, shown as a column instead of a row.
 *
 * TWO accordions, one per SCOPE. Inside each, a field is a secondary header row
 * plus a wrapping row of boolean chips — one chip per value. The panel owns ONE
 * search and ONE footer, so a reader answers every field and applies once.
 * TRAP T-the-panel-is-the-toolbar-in-a-column
 */

/** The scopes, in the order the panel shows them. */
const SCOPES = [
  { key: 'view', heading: 'View filters' },
  { key: 'data', heading: 'This context' },
];

const el = (tag, attrs = {}, text) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) node.setAttribute(k, '');
    else if (v != null && v !== false) node.setAttribute(k, String(v));
  }
  if (text != null) node.textContent = text;
  return node;
};

/**
 * Wire a panel to one or more quick-filter toolbars.
 *
 * `bars` is `{ view, data }` — either may be absent. Returns
 * `{ toggle, open, close, destroy }`.
 */
export function mountFilterPanel(panel, bars, { signal } = {}) {
  if (!panel) return { toggle() {}, open() {}, close() {}, destroy() {} };

  /** Every chip the panel is drawing, by field id. */
  const fields = new Map();
  /** What the values were at the last apply, so Discard can restore them. */
  let baseline = new Map();

  /* ── Reading the bars ─────────────────────────────────────────────── */

  /**
   * Chips the panel never draws. They stay on the app header.
   *
   * `view` is not a filter at all — it is what the filters apply WITHIN.
   * `customer` and `region` are GLOBAL: one organisation and one region are
   * the population every Context works in, so a reader sets them once and
   * they follow them from page to page. Burying them in a per-Context panel
   * makes a global answer look like a local one.
   * TRAP T-the-view-chip-stays-on-the-header
   */
  const STAYS = new Set(['view', 'customer', 'region']);

  const chipsOf = (bar) =>
    [...(bar?.shadowRoot?.querySelectorAll('.chips > .chip') ?? [])]
      .filter((chip) => !STAYS.has(chip.dataset['id'] ?? ''));

  /** The VALUES a chip offers, read from its own menu's rows. */
  const valuesOf = (chip) => {
    const menu = chip.querySelector('sherpa-menu');
    if (!menu) return [];
    return [...menu.querySelectorAll('label')]
      .filter((row) => !row.matches('.qf-all, .qf-toggle'))
      .map((row) => ({
        value: row.querySelector('input')?.value ?? '',
        label: (row.textContent ?? '').trim(),
        on: !!row.querySelector('input')?.checked,
      }))
      .filter((v) => v.value !== '');
  };

  /* ── Drawing one field ────────────────────────────────────────────── */

  function drawField(chip) {
    const id = chip.dataset['id'] ?? '';
    const label = chip.dataset['label'] ?? id;
    const values = valuesOf(chip);
    /* A field with no VALUE ROWS — a date, a number range — is not a set of
       chips, and there is nothing honest to draw for it here. It keeps its
       chip on the toolbar. TRAP T-the-panel-is-the-toolbar-in-a-column */
    if (!values.length) return null;

    const single = chip.querySelector('sherpa-menu')?.dataset?.['select'] === 'single';

    /* THE FIELD is a sherpa-stack: its header, then its values. Composed, not
       drawn — the gap, the flow and the wrap are the stack's job.
       TRAP T-compose-never-reimplement */
    const box = el('sherpa-stack', {
      class: 'panel-field', 'data-field': id, 'data-gap': 'sm',
    });

    /* THE SECONDARY HEADER is sherpa-section-header, which already owns a
       heading and a trailing `actions` slot. `sm`, and no divider: it sits
       INSIDE an accordion that has its own edges. */
    const head = el('sherpa-section-header', {
      'data-heading': label, 'data-size': 'sm', 'data-divider': 'none',
    });
    head.append(el('sherpa-button', {
      slot: 'actions', class: 'panel-clear', 'data-type': 'icon', 'data-size': 'xs',
      'data-look': 'transparent', 'data-icon-start': 'arrow-rotate-left',
      'aria-label': `Clear ${label}`,
    }));
    // REMOVE is opt-in, exactly as it is on the chip's own menu.
    if (chip.querySelector('sherpa-menu')?.hasAttribute('data-removable')) {
      head.append(el('sherpa-button', {
        slot: 'actions', class: 'panel-remove', 'data-type': 'icon', 'data-size': 'xs',
        'data-look': 'transparent', 'data-icon-start': 'trash',
        'data-status': 'critical', 'aria-label': `Remove ${label}`,
      }));
    }

    /* THE VALUES — one boolean chip each, in a WRAPPING inline stack. */
    const row = el('sherpa-stack', {
      class: 'panel-values', 'data-direction': 'inline',
      'data-gap': 'sm', 'data-wrap': true, 'data-min-item': 'hug',
      'data-align': 'start',
    });
    for (const v of values) {
      row.append(el('sherpa-quick-filter', {
        class: 'panel-value', 'data-id': `${id}:${v.value}`,
        'data-label': v.label, 'data-value': v.value,
        'data-current': v.on || undefined,
      }));
    }

    box.append(head, row);
    fields.set(id, { chip, box, row, single, values });
    return box;
  }

  /* ── Drawing the panel ────────────────────────────────────────────── */

  function fill() {
    fields.clear();
    const body = document.createDocumentFragment();

    for (const { key, heading } of SCOPES) {
      const drawn = chipsOf(bars[key]).map(drawField).filter(Boolean);
      if (!drawn.length) continue;
      const box = el('sherpa-accordion', { 'data-heading': heading, open: true });
      box.append(...drawn);
      body.append(box);
    }

    panel.append(body);
    snapshot();
    /* A field the panel draws is HIDDEN on its bar — two controls over one
       field make a reader guess which is in force. The View chip is the
       exception and is never drawn here.
       TRAP T-the-view-chip-stays-on-the-header */
    for (const [, { chip }] of fields) chip.toggleAttribute('data-panelled', true);
  }

  /**
   * Push every field's ticks back onto its chip, and REPORT.
   *
   * `chip.values =` is a silent write — it ticks the menu rows and nothing
   * downstream hears. The chip only reports on `menu-change`, which is what a
   * reader clicking Apply in the menu's own footer would fire, so the panel
   * fires the same event. TRAP T-the-panel-is-the-toolbar-in-a-column
   */
  function apply() {
    for (const [, { chip, row }] of fields) {
      const picked = [...row.querySelectorAll('sherpa-quick-filter[data-current]')]
        .map((c) => c.dataset['value']);
      chip.values = picked;
      // A chip with nothing picked is OFF; `values` alone leaves it lit.
      if (!picked.length) chip.current = false;
      chip.querySelector('sherpa-menu')?.dispatchEvent(new CustomEvent('menu-change', {
        bubbles: true, composed: true, detail: { values: picked },
      }));
    }
    snapshot();
  }

  /** What the chips hold now, so Discard can put it back. */
  function snapshot() {
    baseline = new Map([...fields].map(([id, { row }]) => [
      id, [...row.querySelectorAll('sherpa-quick-filter[data-current]')]
        .map((c) => c.dataset['value']),
    ]));
  }

  /** Put every chip back to the last applied state. */
  function discard() {
    for (const [id, { row }] of fields) {
      const want = new Set(baseline.get(id) ?? []);
      for (const one of row.querySelectorAll('sherpa-quick-filter')) {
        one.toggleAttribute('data-current', want.has(one.dataset['value']));
      }
    }
  }

  /* ── Events ───────────────────────────────────────────────────────── */

  /** A value chip was clicked: single-select unticks its siblings. */
  panel.addEventListener('quick-filter-click', (event) => {
    const one = event.target.closest?.('.panel-value');
    if (!one) return;
    const held = [...fields.values()].find((f) => f.row.contains(one));
    if (!held?.single) return;
    for (const other of held.row.querySelectorAll('sherpa-quick-filter')) {
      if (other !== one) other.removeAttribute('data-current');
    }
  }, { signal });

  /** Clear one field, or remove it from its bar. */
  panel.addEventListener('click', (event) => {
    const path = event.composedPath();
    const hit = (sel) => path.find((n) => n.matches?.(sel));

    const clear = hit('.panel-clear');
    if (clear) {
      const held = [...fields.values()].find((f) => f.box.contains(clear));
      for (const one of held?.row.querySelectorAll('sherpa-quick-filter') ?? []) {
        one.removeAttribute('data-current');
      }
      return;
    }

    const remove = hit('.panel-remove');
    if (remove) {
      const entry = [...fields].find(([, f]) => f.box.contains(remove));
      if (!entry) return;
      /* The BAR owns the list of fields, so the removal goes through the
         chip's own menu — the one door, and the one that tells the host. */
      entry[1].chip.querySelector('sherpa-menu')?.dispatchEvent(new CustomEvent('menu-select', {
        bubbles: true, composed: true, detail: { value: 'remove', label: 'Remove' },
      }));
      entry[1].box.remove();
      fields.delete(entry[0]);
    }
  }, { signal });

  /** ONE search, across every value chip in the panel. Field labels stay. */
  function search(query) {
    const q = query.trim().toLowerCase();
    for (const [, { box, row }] of fields) {
      let shown = 0;
      for (const one of row.querySelectorAll('sherpa-quick-filter')) {
        const hit = !q || (one.dataset['label'] ?? '').toLowerCase().includes(q);
        one.toggleAttribute('data-filtered-out', !hit);
        if (hit) shown += 1;
      }
      // The FIELD stays whatever the search finds — a label is an answer too.
      box.toggleAttribute('data-no-matches', shown === 0);
    }
  }

  /* ── Open and close ───────────────────────────────────────────────── */

  const isOpen = () => !panel.hasAttribute('hidden');

  function open() {
    if (isOpen()) return;
    // TRAP T-the-panel-is-desktop-only
    if (!matchMedia('(min-width: 1280px)').matches) return;
    panel.removeAttribute('hidden');
    fill();
    panel.dispatchEvent(new CustomEvent('filter-panel-open', { bubbles: true }));
  }

  function close() {
    if (!isOpen()) return;
    // Give every hidden chip back to its bar.
    for (const [, { chip }] of fields) chip.removeAttribute('data-panelled');
    for (const node of [...panel.children]) {
      if (!node.getAttribute?.('slot')) node.remove();
    }
    fields.clear();
    panel.setAttribute('hidden', '');
    panel.dispatchEvent(new CustomEvent('filter-panel-close', { bubbles: true }));
  }

  const toggle = () => (isOpen() ? close() : open());

  panel.addEventListener('header-dismiss', close, { signal });
  panel.addEventListener('input', (event) => {
    if (event.target.closest?.('.panel-search')) search(event.target.value ?? '');
  }, { signal });
  panel.addEventListener('button-click', (event) => {
    const path = event.composedPath();
    if (path.some((n) => n.matches?.('.panel-apply'))) apply();
    else if (path.some((n) => n.matches?.('.panel-discard'))) discard();
  }, { signal });

  for (const bar of Object.values(bars)) {
    bar?.addEventListener('filter-configure', toggle, { signal });
  }

  /* BELOW DESKTOP, filtering goes back to the toolbars. A media QUERY, not a
     resize listener: the browser owns the measuring.
     TRAP T-the-panel-is-desktop-only */
  const desktop = matchMedia('(min-width: 1280px)');
  const follow = () => { if (!desktop.matches) close(); };
  desktop.addEventListener('change', follow, { signal });
  follow();

  return { toggle, open, close, apply, discard, destroy: close };
}
