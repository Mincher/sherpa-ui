/**
 * filter-panel.js — the filter toolbars, shown as a column instead of a row.
 *
 * TWO accordions, one per SCOPE. Inside each, a field is a secondary header row
 * plus a wrapping row of boolean chips — one chip per value. The panel owns ONE
 * search and ONE footer, so a reader answers every field and applies once.
 * TRAP T-the-panel-is-the-toolbar-in-a-column
 */

/**
 * The scopes, in the order the panel shows them.
 *
 * A component scope is NAMED after the content it filters — "Customer grid",
 * not "This context". A reader with two grids on one page has to know which
 * one a section answers for, and "this context" answers for neither.
 * The caller passes the name with the bar. TRAP T-a-scope-is-named-for-its-content
 */
const SCOPES = [
  { key: 'view', heading: 'View filters' },
  { key: 'data', heading: 'Filters' },
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
export function mountFilterPanel(panel, bars, { signal, names = {} } = {}) {
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

  /** A chip with NO MENU is a PRESET: one question the data answers yes or no,
   *  with no field behind it and no values to pick.
   *  TRAP T-a-chip-with-no-field-is-a-preset */
  const isPreset = (chip) => !chip.querySelector('sherpa-menu');

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
    const menu = chip.querySelector('sherpa-menu');

    /* CONDITION MODE is a field-level switch, beside Clear and Remove — and it
       REPLACES the value chips with the field's own condition rows. Opt-in, so
       a closed set of three never offers it.
       TRAP T-conditions-are-opt-in-per-field */
    if (menu?.hasAttribute('data-conditional')) {
      head.append(el('sherpa-button', {
        slot: 'actions', class: 'panel-conditional', 'data-type': 'icon',
        'data-size': 'xs', 'data-look': 'transparent',
        'data-icon-start': 'sliders-up', 'aria-pressed': 'false',
        'aria-label': `Use a condition for ${label}`,
      }));
    }

    head.append(el('sherpa-button', {
      slot: 'actions', class: 'panel-clear', 'data-type': 'icon', 'data-size': 'xs',
      'data-look': 'transparent', 'data-icon-start': 'arrow-rotate-left',
      'aria-label': `Clear ${label}`,
    }));
    // REMOVE is opt-in, exactly as it is on the chip's own menu.
    if (menu?.hasAttribute('data-removable')) {
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

  /**
   * The PRESETS of one scope — the toggles with no field behind them.
   *
   * One section, not one per chip: they are not a field's values, they are
   * separate questions that happen to share a shape.
   * TRAP T-a-chip-with-no-field-is-a-preset
   */
  function drawPresets(chips, key) {
    if (!chips.length) return null;
    const box = el('sherpa-stack', {
      class: 'panel-field panel-presets', 'data-field': `presets:${key}`,
      'data-gap': 'sm',
    });
    box.append(el('sherpa-section-header', {
      'data-heading': 'Presets', 'data-size': 'sm', 'data-divider': 'none',
    }));

    const row = el('sherpa-stack', {
      class: 'panel-values', 'data-direction': 'inline', 'data-gap': 'sm',
      'data-wrap': true, 'data-min-item': 'hug', 'data-align': 'start',
    });
    for (const chip of chips) {
      const one = el('sherpa-quick-filter', {
        class: 'panel-value panel-preset', 'data-id': `preset:${chip.dataset['id']}`,
        'data-label': chip.dataset['label'] ?? chip.dataset['id'],
        'data-value': chip.dataset['id'],
        'data-current': chip.hasAttribute('data-current') || undefined,
      });
      presets.set(chip.dataset['id'] ?? '', { chip, one });
      row.append(one);
    }
    box.append(row);
    return box;
  }

  /** Every preset the panel is drawing, by chip id. */
  const presets = new Map();

  /**
   * The ADD control for one scope.
   *
   * A `sherpa-button` with a `sherpa-menu` of whatever that bar is still
   * offering — the same shape the bar's own Add button uses. The add goes
   * THROUGH the bar (`addFilters`), which owns the list, so the two cannot
   * drift. TRAP T-a-panel-adds-through-the-bar-that-owns-the-list
   */
  function drawAdd(bar, key) {
    const offer = bar?.offering ?? [];
    if (!offer.length) return null;

    /* In the ACCORDION's own header, beside its chevron — the scope's own
       action, not a row at the end of its list. */
    const btn = el('sherpa-button', {
      slot: 'actions', class: 'panel-add', 'data-scope': key, 'data-size': 'xs',
      'data-look': 'transparent', 'data-icon-start': 'plus',
    });
    btn.append(document.createTextNode('Add filter'));

    const menu = el('sherpa-menu', {
      slot: 'menu', 'data-heading': 'Add filter', 'data-select': 'multiple',
      'data-search': true, 'data-commit': true,
    });
    btn.append(menu);
    // `items()`, not populate(): this menu has not upgraded yet.
    pendingAdds.push([menu, offer.map((f) => ({ value: f.id, label: f.label }))]);
    return btn;
  }

  /** Menus waiting for their button to enter the page. */
  let pendingAdds = [];

  function fill() {
    fields.clear();
    presets.clear();
    pendingAdds = [];
    const body = document.createDocumentFragment();

    /* ONE FIELD, ONE SCOPE. A field held by BOTH bars would draw twice, and a
       reader cannot tell which of the two is in force — the same reason the
       records bar has no Region chip. VIEW leads, because its filters set the
       population the Context bar narrows within.
       TRAP T-a-panel-adds-through-the-bar-that-owns-the-list */
    const taken = new Set();

    for (const { key, heading: fallback } of SCOPES) {
      const bar = bars[key];
      // The CONTENT's own name, where the caller gave one.
      const heading = names[key] ?? fallback;
      const mine = chipsOf(bar).filter((chip) => {
        const id = chip.dataset['id'] ?? '';
        if (taken.has(id)) return false;
        taken.add(id);
        return true;
      });

      const presets = drawPresets(mine.filter(isPreset), key);
      const drawn = mine.filter((c) => !isPreset(c)).map(drawField).filter(Boolean);
      const add = drawAdd(bar, key);
      if (!presets && !drawn.length && !add) continue;

      const box = el('sherpa-accordion', { 'data-heading': heading, open: true });
      // PRESETS lead: they are one tap, and the fields below them are the work.
      if (presets) box.append(presets);
      box.append(...drawn);
      if (add) box.append(add);
      /* A scope with nothing to draw says SO. Empty, it reads as broken — and
         View is legitimately empty here: its three chips are the ones that
         stay on the header. TRAP T-the-view-chip-stays-on-the-header */
      if (!presets && !drawn.length) {
        box.append(el('sherpa-section-header', {
          'data-heading': 'No filters here yet', 'data-size': 'sm',
          'data-divider': 'none',
        }));
      }
      body.append(box);
    }

    panel.append(body);
    // The menus, now their buttons are in the page. TRAP T-custom-element-upgrade
    for (const [menu, items] of pendingAdds) menu.items?.(items);
    pendingAdds = [];
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
    /* A PRESET is a plain toggle: the bar's own chip carries the state, and
       clicking it is what reports. TRAP T-a-chip-with-no-field-is-a-preset */
    for (const [, { chip, one }] of presets) {
      const want = one.hasAttribute('data-current');
      if (chip.hasAttribute('data-current') !== want) chip.click();
    }
    snapshot();
  }

  /** What the chips hold now, so Discard can put it back. */
  function snapshot() {
    baseline = new Map([
      ...[...fields].map(([id, { row }]) => [
        id, [...row.querySelectorAll('sherpa-quick-filter[data-current]')]
          .map((c) => c.dataset['value']),
      ]),
      ...[...presets].map(([id, { one }]) => [
        `preset:${id}`, one.hasAttribute('data-current') ? [id] : [],
      ]),
    ]);
  }

  /** Put every chip back to the last applied state. */
  function discard() {
    for (const [id, { one }] of presets) {
      one.toggleAttribute('data-current', (baseline.get(`preset:${id}`) ?? []).length > 0);
    }
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
    // A PRESET is its own question; it has no siblings to untick.
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

    /* CONDITION MODE replaces this field's value chips with its own condition
       rows. The rows are the MENU's — the panel borrows them rather than
       building a second set. TRAP T-conditions-are-opt-in-per-field */
    const cond = hit('.panel-conditional');
    if (cond) {
      const entry = [...fields].find(([, f]) => f.box.contains(cond));
      if (!entry) return;
      const [, held] = entry;
      const on = held.box.hasAttribute('data-conditional-open');
      const menu = held.chip.querySelector('sherpa-menu');
      if (!menu) return;

      if (on) {
        // BACK to the chips. The menu's rows go home with it.
        held.rows?.remove();
        held.rows = null;
        held.box.removeAttribute('data-conditional-open');
        cond.setAttribute('aria-pressed', 'false');
        menu.dataset['mode'] = 'select';
        return;
      }

      /* The MENU owns the rows, so it draws them; the panel only moves the
         region into its own box. `data-mode` is the one door. */
      menu.dataset['mode'] = 'condition';
      const region = menu.shadowRoot?.querySelector('.condition-rows');
      if (!region) return;
      held.rows = region;
      held.box.append(region);
      held.box.setAttribute('data-conditional-open', '');
      cond.setAttribute('aria-pressed', 'true');
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
    /* EVERY drawn field, presets included — a preset has a label a reader can
       search for just as a value does. TRAP T-a-chip-with-no-field-is-a-preset */
    const boxes = [...panel.querySelectorAll('.panel-field')]
      .map((box) => ({ box, row: box.querySelector('.panel-values') }))
      .filter((b) => b.row);
    for (const { box, row } of boxes) {
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

  /* An ADD menu committed. The BAR owns the list, so it does the adding and
     the panel re-reads it. TRAP T-a-panel-adds-through-the-bar-that-owns-the-list */
  panel.addEventListener('menu-change', (event) => {
    const btn = event.target.closest?.('.panel-add')
      ?? event.composedPath().find((n) => n.matches?.('.panel-add'));
    if (!btn) return;
    const ids = event.detail?.values ?? [];
    if (!ids.length) return;
    bars[btn.dataset['scope']]?.addFilters?.(ids);
    // The bar rebuilt its chips, so the panel must re-read them.
    setTimeout(redraw, 0);
  }, { signal });

  /** Draw the panel again from the bars as they are now. */
  function redraw() {
    if (!isOpen()) return;
    for (const [, { chip }] of fields) chip.removeAttribute('data-panelled');
    for (const node of [...panel.children]) {
      if (!node.getAttribute?.('slot')) node.remove();
    }
    fill();
  }

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
