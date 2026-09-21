/**
 * sherpa-menu — a floating list of choices or actions, on the native popover API.
 *
 * The browser owns the top layer, Escape, outside-click and focus. Placement it
 * cannot do — TRAP T-anchor-cross-root; `#place()` measures the trigger.
 * TRAP T-menu-rows-stay-native-controls — rows are slotted native controls.
 *
 * @prop {string[]} values — the checked row values (read/write)
 *
 * @see TRAP T-footer-row-raises-on-any-flag
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { NON_VALUE_ROWS } from '../../core/icons.js';
// TRAP T-menu-composes-real-components — imported here because the page may not have.
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
    // The crumb text is written from this, so a change must reach #syncCrumb.
    'data-drill-from',
    'open',
  ];

  /** The gap between the trigger and the card (Figma space/2xs). */
  static readonly OFFSET = 4;

  /** The trigger of the currently-open menu — re-measured on scroll / resize. */
  #trigger: HTMLElement | null = null;
  /** TRAP T-cancel-baseline-captured-on-open — snapshotted on OPEN, for Cancel. */
  #baseline: string[] = [];

  #card(): HTMLElement | null {
    return this.$('.menu');
  }

  override onRender(): void {
    this.#sync();
    const card = this.#card();
    if (!card) return;
    card.addEventListener('toggle', this.#onToggle as EventListener);
    // Rows are LIGHT DOM — listen on the host. TRAP T-menu-rows-stay-native-controls.
    this.addEventListener('change', this.#onChange);
    this.$('.drill-back')?.addEventListener('click', this.#onBack);
    // The PARENT crumb is the same way out as the back arrow.
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
    this.$('.search')?.addEventListener('input', this.#onSearch);
  }

  /** Narrow rows to a typed substring. TRAP T-menu-search-is-a-substring-find —
   * a hidden row keeps its tick. */
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

  /** Open the menu under `trigger`, which is also what it measures against. */
  show(trigger?: HTMLElement): void {
    if (trigger) this.#trigger = trigger;
    // TRAP T-show-then-measure — a closed popover measures 0, so show first.
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

  /** What the menu holds. TRAP T-menu-value-is-not-always-rows — a NUMBER or
   * CALENDAR menu has no rows. */
  get values(): string[] {
    const numeric = this.#numericValues();
    if (numeric) return numeric;
    const dates = this.#calendarValues();
    if (dates) return dates;
    return this.#inputs()
      .filter((i) => i.checked)
      .map((i) => i.value);
  }

  /** A NUMBER menu's value, or null. A range at its full bounds excludes nothing. */
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
  /** A CALENDAR menu's value, or null when this is not one. */
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

  /** Every value row's control. TRAP T-select-all-is-not-a-value — the
   * select-all row is excluded. */
  #inputs(): HTMLInputElement[] {
    return Array.from(
      this.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'),
    ).filter((i) => !i.closest(NON_VALUE_ROWS));
  }

  /** The drill trail. TRAP T-drill-crumbs-carry-no-href — an `href` would
   * dismiss the popover. */
  #syncCrumb(): void {
    const crumbs = this.$<HTMLElement & { populate(d: unknown): void }>('.drill-crumbs');
    if (!crumbs) return;
    const from = this.dataset['drillFrom'];
    if (!from) {
      crumbs.populate([]);
      return;
    }
    crumbs.populate([{ label: from }, { label: this.dataset['heading'] ?? '' }]);
  }

  #sync(): void {
    this.#syncCrumb();
    // TRAP T-calendar-header-has-no-heading — the name must reach a screen
    // reader even when no heading is drawn.
    const card = this.#card();
    const name = this.dataset['heading'] ?? '';
    if (card && name) card.setAttribute('aria-label', name);
    else card?.removeAttribute('aria-label');

    // Single-select menus are radio rows; a shared name makes the browser
    // enforce "one at a time" for us.
    if (this.dataset['select'] === 'single') {
      const name = `sherpa-menu-${this.dataset['heading'] ?? 'group'}`;
      for (const input of this.#inputs()) {
        if (input.type === 'radio' && !input.name) input.name = name;
      }
    }

  }

  /**
   * The box the card must stay inside — the viewport, or a host's `data-bounds`.
   * TRAP T-bounds-clamp-to-the-viewport — a missing or zero-sized box falls
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
    // Never wider than the viewport, or the card follows a scrolled-away box off-screen.
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
    // TRAP T-card-max-height-follows-the-side — `--_max-h` is the room on the
    // side the card landed on.
    const bounds = this.#bounds();
    const vw = bounds.right;
    const vh = bounds.bottom;

    // Below the trigger, unless there is no room and there IS room above.
    const below = vh - t.bottom - gap * 2;
    const above = t.top - gap * 2;
    let y = t.bottom + gap;
    if (y + c.height > vh && t.top - gap - c.height >= 0) y = t.top - gap - c.height;

    const room = Math.max(below, above);
    if (c.height > below && above > below) y = Math.max(gap, t.top - gap - Math.min(c.height, above));
    card.style.setProperty('--_max-h', `${Math.max(120, Math.round(room))}px`);

    // The trigger's start edge (its end edge on data-align="end"), pulled back
    // inside the viewport.
    let x = this.dataset['align'] === 'end' ? t.right - c.width : t.left;
    if (x + c.width > vw) x = vw - c.width - gap;
    if (x < bounds.left + gap) x = bounds.left + gap;

    if (y < bounds.top + gap) y = bounds.top + gap;

    card.style.setProperty('--_x', `${Math.round(x)}px`);
    card.style.setProperty('--_y', `${Math.round(y)}px`);
  }

  #onToggle = (event: Event): void => {
    const open = (event as ToggleEvent).newState === 'open';
    this.toggleAttribute('open', open);
    if (open) {
      // TRAP T-open-menu-resize-closes — scroll re-places (capture: ancestor
      // scrolls do not bubble), resize closes.
      this.#baseline = this.values;
      window.addEventListener('scroll', this.#reposition, { capture: true, passive: true });
      window.addEventListener('resize', this.#onViewportResize, { passive: true });
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

  /** Watches the card's own box, so a body that grows re-places. */
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

  /** The label a select-all row wears — ONE label, always. */
  static readonly ALL_LABEL = 'Select all';

  /** A slotted row marked as the select-all control (class `qf-all`). */
  #allRow(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>('.qf-all input');
  }

  /**
   * Tick or clear every value row. TRAP T-select-all-ticks-boxes-not-values —
   * writes the BOXES, so a committing menu's draft still works.
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
   * Point the select-all row at the set: all, some (indeterminate) or none.
   * TRAP T-indeterminate-is-a-property — rewritten every time the set moves.
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

  /** The slotted rows changed — re-read the select-all row, re-place next frame. */
  #onRowsChanged = (): void => {
    this.#syncSelectAll();
    if (this.open) requestAnimationFrame(() => this.#place());
  };

  /** Report the back arrow. TRAP T-menu-back-is-a-report — the menu cannot
   * know what it drilled into. */
  #onBack = (event: Event): void => {
    event.stopPropagation();
    this.emit('menu-back', {});
  };

  #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    // TRAP T-native-change-stops-at-the-host — a NUMBER menu's field and
    // slider are value shapes too.
    const numeric = input.type === 'number' || input.tagName === 'SHERPA-SLIDER';
    if (!numeric && input.type !== 'checkbox' && input.type !== 'radio') return;
    // The SELECT-ALL row drives every other row, so it reports for itself.
    if (input.closest('.qf-all')) {
      this.#onSelectAll(input);
      return;
    }
    // Ticking the last unticked box makes the select-all row "all", not "some".
    this.#syncSelectAll();
    // A COMMITTING menu holds the change as a DRAFT until Apply.
    if (this.#commits) return;
    this.emit('menu-change', { values: this.values });
  };

  /** Whether this menu defers its changes to an Apply button. */
  get #commits(): boolean {
    return this.hasAttribute('data-commit');
  }

  #onApply = (): void => {
    // Apply rewrites the baseline Cancel would restore.
    this.#baseline = this.values;
    this.emit('menu-apply', { values: this.values });
    this.emit('menu-change', { values: this.values });
    this.hide();
  };

  #onCancel = (): void => {
    // Restore, THEN report.
    this.values = this.#baseline;
    this.emit('menu-cancel', {});
    this.hide();
  };

  /**
   * Empty the selection and report it. TRAP T-clear-empties-both-body-shapes —
   * the checkboxes AND a slotted calendar's date attributes.
   */
  #onClear = (): void => {
    for (const input of this.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
    for (const cal of this.querySelectorAll<HTMLElement>('sherpa-calendar')) {
      for (const a of ['data-value', 'data-value-start', 'data-value-end']) cal.removeAttribute(a);
    }
    this.emit('menu-clear', {});
    if (!this.#commits) this.emit('menu-change', { values: this.values });
  };

  /** Drive the slotted calendar to today; stays OPEN.
   * TRAP T-today-and-remove-are-menu-chrome */
  #onToday = (): void => {
    for (const cal of this.querySelectorAll<HTMLElement & { today?: () => void }>('sherpa-calendar')) {
      cal.today?.();
    }
  };

  /** Remove — the header-button form of a `<button value="remove">` action row. */
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
