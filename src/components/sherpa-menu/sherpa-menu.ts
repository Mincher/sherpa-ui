/**
 * sherpa-menu — a floating list of choices or actions.
 *
 * Built on the native popover API, so the browser owns the top layer, the
 * Escape key, the outside-click dismiss and focus. PLACEMENT is the one thing
 * it cannot do — TRAP T-anchor-cross-root; `#place()` measures the trigger into
 * --_x / --_y and flips at an edge.
 *
 * TRAP T-menu-rows-stay-native-controls — the rows are real form controls,
 * slotted from the light DOM.
 *
 *   actions  <button type="button" value="…">Label</button>
 *
 * @prop {string[]} values — the checked row values (read/write)
 *
 * @see TRAP T-footer-row-raises-on-any-flag
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { NON_VALUE_ROWS } from '../../core/icons.js';
// TRAP T-menu-composes-real-components — breadcrumbs, input-text, button and
// container-footer are real components, imported here because the page may not
// have.
import '../sherpa-breadcrumbs/sherpa-breadcrumbs.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-container-footer/sherpa-container-footer.js';

export class SherpaMenu extends SherpaElement {
  static override css = new URL('./sherpa-menu.css', import.meta.url);
  static override html = new URL('./sherpa-menu.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.heading' },
  } as const;

  static override observed = [
    'data-heading',
    'data-align',
    'data-search',
    'data-clearable',
    'data-removable',
    'data-type',
    // The breadcrumb's text is written from data-drill-from, so a change to it
    // has to reach #syncCrumb.
    'data-drill-from',
    'open',
  ];

  /** The gap between the trigger and the card (Figma space/2xs). */
  static readonly OFFSET = 4;

  /** The trigger of the currently-open menu — re-measured on scroll / resize. */
  #trigger: HTMLElement | null = null;
  /**
   * The values the menu opened with, for Cancel to restore.
   *
   * TRAP T-cancel-baseline-captured-on-open — on OPEN, not on first change; and
   * Apply rewrites it while Cancel restores it BEFORE reporting.
   */
  #baseline: string[] = [];

  #card(): HTMLElement | null {
    return this.$('.menu');
  }

  override onRender(): void {
    this.#sync();
    const card = this.#card();
    if (!card) return;
    // The browser announces its own open/close, so we just mirror it out.
    card.addEventListener('toggle', this.#onToggle as EventListener);
    // Rows are LIGHT DOM — listen on the host and let events bubble up. TRAP
    // T-menu-rows-stay-native-controls.
    this.addEventListener('change', this.#onChange);
    this.$('.drill-back')?.addEventListener('click', this.#onBack);
    // The PARENT crumb is the same way out as the back arrow — TRAP
    // T-drill-crumbs-carry-no-href.
    this.$('.drill-crumbs')?.addEventListener('breadcrumb-select', this.#onBack);
    // TRAP T-rows-changed-re-places-next-frame — slotchange is the only hook a
    // drill has; show() happens before it.
    this.$('.rows slot')?.addEventListener('slotchange', this.#onRowsChanged);
    this.addEventListener('click', this.#onClick);
    // The footer and header actions are in the SHADOW root.
    this.$('.apply')?.addEventListener('click', this.#onApply);
    this.$('.cancel')?.addEventListener('click', this.#onCancel);
    this.$('.clear')?.addEventListener('click', this.#onClear);
    this.$('.today')?.addEventListener('click', this.#onToday);
    this.$('.remove')?.addEventListener('click', this.#onRemove);
    // The search is a composed <sherpa-input-text> — TRAP
    // T-menu-composes-real-components.
    this.$('.search')?.addEventListener('input', this.#onSearch);
  }

  /**
   * Narrow the rows to those whose text contains what was typed.
   *
   * TRAP T-menu-search-is-a-substring-find — a substring "find" over the rows it
   * already has, so a hidden row keeps its tick; `data-no-matches` only while
   * a query is present.
   */
  #onSearch = (): void => {
    // `value` is a property on sherpa-input-text, mirrored from its control.
    const field = this.$<HTMLElement & { value?: string }>('.search');
    const q = (field?.value ?? '').trim().toLowerCase();
    let shown = 0;
    for (const row of this.#rows()) {
      const hit = !q || (row.textContent ?? '').toLowerCase().includes(q);
      // JS writes the flag; CSS owns the hiding.
      row.toggleAttribute('data-filtered-out', !hit);
      if (hit) shown += 1;
    }
    // TRAP T-menu-search-is-a-substring-find — only WHILE searching.
    this.toggleAttribute('data-no-matches', !!q && shown === 0);
  };

  /** Every slotted row, whatever kind it is (label rows and action buttons). */
  #rows(): HTMLElement[] {
    return [...this.children].filter((n): n is HTMLElement => n instanceof HTMLElement);
  }

  override onChange(): void {
    this.#sync();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /** Open the menu. Pass the trigger to place it under (and to measure against). */
  show(trigger?: HTMLElement): void {
    if (trigger) this.#trigger = trigger;
    // TRAP T-show-then-measure — sync the select-all box before paint, and show
    // BEFORE measuring: a closed popover is `display: none` and measures 0.
    this.#syncSelectAll();
    this.#card()?.showPopover();
    this.#place();
  }

  /** Close the menu. */
  hide(): void {
    this.#card()?.hidePopover();
  }

  /** Flip the menu open or shut. */
  toggle(trigger?: HTMLElement): void {
    if (this.open) this.hide();
    else this.show(trigger);
  }

  get open(): boolean {
    const card = this.#card();
    return !!card?.matches(':popover-open');
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  /**
   * What the menu currently holds.
   *
   * TRAP T-menu-value-is-not-always-rows — usually the checked rows, but a
   * NUMBER or CALENDAR menu has none and reports for itself.
   */
  get values(): string[] {
    const numeric = this.#numericValues();
    if (numeric) return numeric;
    const dates = this.#calendarValues();
    if (dates) return dates;
    return this.#inputs()
      .filter((i) => i.checked)
      .map((i) => i.value);
  }

  /**
   * A NUMBER menu's value, or null when this is not one — TRAP
   * T-menu-value-is-not-always-rows. A range spanning its WHOLE bounds excludes
   * nothing, so it reports no value.
   */
  #numericValues(): string[] | null {
    const field = this.querySelector<HTMLInputElement>('input[type="number"]');
    const slider = this.querySelector<HTMLElement & { range: [number, number] }>('sherpa-slider');
    if (!field && !slider) return null;
    if (this.hasAttribute('data-range')) {
      if (!slider) return [];
      const [lo, hi] = slider.range;
      const min = Number(slider.getAttribute('min') ?? 0);
      const max = Number(slider.getAttribute('max') ?? 100);
      return lo === min && hi === max ? [] : [String(lo), String(hi)];
    }
    const raw = field?.value.trim() ?? '';
    return raw === '' ? [] : [raw];
  }
  /**
   * A CALENDAR menu's value, or null when this is not one — TRAP
   * T-menu-value-is-not-always-rows.
   */
  #calendarValues(): string[] | null {
    const cal = this.querySelector<HTMLElement>('sherpa-calendar');
    if (!cal) return null;
    // A RANGE reports both ends, and only once BOTH are picked.
    const start = cal.dataset['valueStart'];
    const end = cal.dataset['valueEnd'];
    if (start && end) return [start, end];
    const single = cal.dataset['value'];
    return single ? [single] : [];
  }

  set values(next: string[]) {
    const wanted = new Set(next);
    for (const input of this.#inputs()) input.checked = wanted.has(input.value);
  }

  /* ── Private ─────────────────────────────────────────────────────── */

  /**
   * Every value row's control (light DOM — the rows are slotted).
   *
   * TRAP T-select-all-is-not-a-value — the select-all row is a control OVER the
   * set, so it is excluded here and its label never changes.
   */
  #inputs(): HTMLInputElement[] {
    return Array.from(
      this.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'),
    ).filter((i) => !i.closest(NON_VALUE_ROWS));
  }

  /**
   * The breadcrumb trail shown when the list has been drilled into.
   *
   * TRAP T-drill-crumbs-carry-no-href — a real `<sherpa-breadcrumbs>`, two
   * crumbs, and no `href`: one would hash the URL and dismiss the popover.
   */
  #syncCrumb(): void {
    const crumbs = this.$<HTMLElement & { populate(d: unknown): void }>('.drill-crumbs');
    if (!crumbs) return;
    const from = this.dataset['drillFrom'];
    if (!from) {
      crumbs.populate([]);
      return;
    }
    // TRAP T-drill-crumbs-carry-no-href
    crumbs.populate([{ label: from }, { label: this.dataset['heading'] ?? '' }]);
  }

  #sync(): void {
    this.#syncCrumb();
    // TRAP T-calendar-header-has-no-heading — the heading text is a declared
    // prop, but the NAME still has to reach a screen reader, and a single-select
    // menu's radios need a shared name so the browser enforces one at a time.
    const card = this.#card();
    const name = this.dataset['heading'] ?? '';
    if (card && name) card.setAttribute('aria-label', name);
    else card?.removeAttribute('aria-label');

    // Single-select menus are radio rows; give them a shared name so the browser
    // enforces "one at a time" for us.
    if (this.dataset['select'] === 'single') {
      const name = `sherpa-menu-${this.dataset['heading'] ?? 'group'}`;
      for (const input of this.#inputs()) {
        if (input.type === 'radio' && !input.name) input.name = name;
      }
    }

  }

  /**
   * The box the card must stay inside — the viewport, or a host's `data-bounds`.
   *
   * TRAP T-bounds-clamp-to-the-viewport — viewport coordinates throughout, the
   * selector resolves from the DOCUMENT, and a missing or zero-sized box falls
   * back to the viewport.
   */
  #bounds(): { left: number; top: number; right: number; bottom: number } {
    const viewport = {
      left: 0,
      top: 0,
      right: document.documentElement.clientWidth,
      bottom: document.documentElement.clientHeight,
    };
    const sel = this.dataset['bounds'];
    if (!sel) return viewport;
    const box = document.querySelector(sel)?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return viewport;
    // Never WIDER than the viewport: a container that scrolls out of view would
    // otherwise let the card follow it off the screen.
    return {
      left: Math.max(viewport.left, box.left),
      top: Math.max(viewport.top, box.top),
      right: Math.min(viewport.right, box.right),
      bottom: Math.min(viewport.bottom, box.bottom),
    };
  }

  #place(): void {
    const card = this.#card();
    const trigger = this.#trigger;
    if (!card || !trigger?.isConnected) return;

    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const gap = SherpaMenu.OFFSET;
    // TRAP T-card-max-height-follows-the-side — cap `--_max-h` to the room on
    // the side the card landed on, flip to the roomier side, and never run off
    // the top.
    //
    // TRAP T-bounds-clamp-to-the-viewport — the viewport by default, or a
    // host's `data-bounds`.
    const bounds = this.#bounds();
    const vw = bounds.right;
    const vh = bounds.bottom;

    // Below the trigger, unless there is no room and there IS room above.
    const below = vh - t.bottom - gap * 2;
    const above = t.top - gap * 2;
    let y = t.bottom + gap;
    if (y + c.height > vh && t.top - gap - c.height >= 0) y = t.top - gap - c.height;

    // TRAP T-card-max-height-follows-the-side
    const room = Math.max(below, above);
    if (c.height > below && above > below) y = Math.max(gap, t.top - gap - Math.min(c.height, above));
    card.style.setProperty('--_max-h', `${Math.max(120, Math.round(room))}px`);

    // Line up with the trigger's start edge (or its end edge on data-align="end"),
    // then pull back inside the viewport if that overflows.
    let x = this.dataset['align'] === 'end' ? t.right - c.width : t.left;
    if (x + c.width > vw) x = vw - c.width - gap;
    if (x < bounds.left + gap) x = bounds.left + gap;

    // Never off the top — TRAP T-card-max-height-follows-the-side.
    if (y < bounds.top + gap) y = bounds.top + gap;

    card.style.setProperty('--_x', `${Math.round(x)}px`);
    card.style.setProperty('--_y', `${Math.round(y)}px`);
  }

  #onToggle = (event: Event): void => {
    const open = (event as ToggleEvent).newState === 'open';
    this.toggleAttribute('open', open);
    // While open, follow the trigger — a scroll or a resize moves it. `capture`
    // catches scrolls in any ancestor, which do not bubble.
    if (open) {
      // TRAP T-open-menu-resize-closes — SCROLL repositions (capture: ancestor
      // scrolls do not bubble), RESIZE closes, and a ResizeObserver on the CARD
      // re-places a body that grows. Snapshot for Cancel on OPEN.
      this.#baseline = this.values;
      // TRAP T-open-menu-resize-closes
      window.addEventListener('scroll', this.#reposition, { capture: true, passive: true });
      // RESIZE CLOSES — TRAP T-open-menu-resize-closes.
      window.addEventListener('resize', this.#onViewportResize, { passive: true });
      // TRAP T-open-menu-resize-closes — a ResizeObserver on the CARD.
      this.#cardResize ??= new ResizeObserver(() => this.#place());
      const card = this.#card();
      if (card) this.#cardResize.observe(card);
    } else {
      window.removeEventListener('scroll', this.#reposition, { capture: true });
      window.removeEventListener('resize', this.#onViewportResize);
      this.#cardResize?.disconnect();
      this.#trigger = null;
    }
    this.emit(open ? 'menu-open' : 'menu-close', {});
  };

  /** Watches the card's own box — TRAP T-open-menu-resize-closes. */
  #cardResize: ResizeObserver | null = null;

  #reposition = (): void => {
    this.#place();
  };

  #onViewportResize = (): void => {
    this.hide();
  };

  override onDisconnect(): void {
    window.removeEventListener('scroll', this.#reposition, { capture: true });
    window.removeEventListener('resize', this.#onViewportResize);
    this.#cardResize?.disconnect();
  }

  /**
   * The label a select-all row wears.
   *
   * TRAP T-select-all-is-not-a-value — ONE label, always "Select all".
   */
  static readonly ALL_LABEL = 'Select all';

  /** A slotted row marked as the select-all control (class `qf-all`). */
  #allRow(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>('.qf-all input');
  }

  /**
   * Tick or clear every value row, and relabel the select-all row.
   *
   * TRAP T-select-all-ticks-boxes-not-values — handled here because a native
   * `change` is not composed, and it writes the BOXES rather than `values` so a
   * committing menu's draft still works.
   */
  #onSelectAll(input: HTMLInputElement): void {
    // TRAP T-indeterminate-reports-false — read the SET, not the box.
    const boxes = this.#inputs();
    const on = boxes.some((b) => !b.checked);
    for (const box of boxes) box.checked = on;
    input.indeterminate = false;
    this.#syncSelectAll();
    if (!this.#commits) this.emit('menu-change', { values: this.values });
  }

  /**
   * Point the select-all row at the set it describes: ticked for all, INDETERMINATE
   * for some, empty for none — and labelled with what a click would do next.
   *
   * TRAP T-indeterminate-is-a-property — there is no `indeterminate=""`, so it
   * is rewritten every time the set moves.
   */
  #syncSelectAll(): void {
    const all = this.#allRow();
    if (!all) return;
    const boxes = this.#inputs();
    const on = boxes.filter((b) => b.checked).length;
    all.checked = boxes.length > 0 && on === boxes.length;
    all.indeterminate = on > 0 && on < boxes.length;
    const label = all.parentElement?.querySelector('.qf-row-label');
    if (label) label.textContent = SherpaMenu.ALL_LABEL;
  }

  /**
   * The slotted rows changed — re-read the select-all row and re-place the card.
   *
   * TRAP T-rows-changed-re-places-next-frame — `slotchange` is the only hook a
   * drill has, and the card is re-measured next frame.
   */
  #onRowsChanged = (): void => {
    this.#syncSelectAll();
    // TRAP T-rows-changed-re-places-next-frame
    if (this.open) requestAnimationFrame(() => this.#place());
  };

  /**
   * The back arrow was pressed — say so, and let the owner put the list back.
   *
   * TRAP T-menu-back-is-a-report — the menu cannot know what it drilled into,
   * and the button's own click is not composed.
   */
  #onBack = (event: Event): void => {
    event.stopPropagation();
    this.emit('menu-back', {});
  };

  #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    // TRAP T-native-change-stops-at-the-host — a native `change` is not
    // composed, and a NUMBER menu's field and slider are value shapes too.
    const numeric = input.type === 'number' || input.tagName === 'SHERPA-SLIDER';
    if (!numeric && input.type !== 'checkbox' && input.type !== 'radio') return;
    // The SELECT-ALL row drives every other row, so it is handled before the
    // ordinary path and reports for itself.
    if (input.closest('.qf-all')) {
      this.#onSelectAll(input);
      return;
    }
    // A value row moved, so the select-all row's own state has moved with it —
    // ticking the last unticked box makes it "all", not "some".
    this.#syncSelectAll();
    // A COMMITTING menu holds the change as a DRAFT until Apply — TRAP
    // T-cancel-baseline-captured-on-open.
    if (this.#commits) return;
    this.emit('menu-change', { values: this.values });
  };

  /** Whether this menu defers its changes to an Apply button. */
  get #commits(): boolean {
    return this.hasAttribute('data-commit');
  }

  #onApply = (): void => {
    // TRAP T-cancel-baseline-captured-on-open — Apply rewrites the baseline.
    this.#baseline = this.values;
    this.emit('menu-apply', { values: this.values });
    this.emit('menu-change', { values: this.values });
    this.hide();
  };

  #onCancel = (): void => {
    // TRAP T-cancel-baseline-captured-on-open — restore, THEN report.
    this.values = this.#baseline;
    this.emit('menu-cancel', {});
    this.hide();
  };

  /**
   * Empty the selection and report it.
   *
   * TRAP T-clear-empties-both-body-shapes — the checkboxes AND a slotted
   * calendar's date attributes; a committing menu stays open.
   */
  #onClear = (): void => {
    for (const input of this.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
    for (const cal of this.querySelectorAll<HTMLElement>('sherpa-calendar')) {
      for (const a of ['data-value', 'data-value-start', 'data-value-end']) cal.removeAttribute(a);
    }
    this.emit('menu-clear', {});
    // Report the emptied state the same way a tick does.
    if (!this.#commits) this.emit('menu-change', { values: this.values });
  };

  /**
   * Today — drive the slotted calendar to today.
   *
   * TRAP T-today-and-remove-are-menu-chrome — the button is the menu's, the
   * behaviour the calendar's, and it stays OPEN.
   */
  #onToday = (): void => {
    for (const cal of this.querySelectorAll<HTMLElement & { today?: () => void }>('sherpa-calendar')) {
      cal.today?.();
    }
  };

  /**
   * Remove — the header button form of the action ROW, emitting exactly what a
   * `<button value="remove">` row does. TRAP T-today-and-remove-are-menu-chrome.
   */
  #onRemove = (): void => {
    this.emit('menu-select', { value: 'remove', label: 'Remove' });
    this.hide();
  };

  #onClick = (event: Event): void => {
    // Only plain ACTION rows close the menu; value rows stay open.
    const button = (event.target as HTMLElement).closest('button');
    if (!button || button.disabled) return;
    this.emit('menu-select', { value: button.value, label: button.textContent?.trim() ?? '' });
    this.hide();
  };
}

customElements.define('sherpa-menu', SherpaMenu);
