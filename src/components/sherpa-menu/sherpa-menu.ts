/**
 * sherpa-menu — a floating list of choices or actions.
 *
 * Built on the native popover API, so the browser owns the top layer, the Escape
 * key, the outside-click dismiss and focus.
 *
 * Placement is the one thing the browser cannot do for us. CSS anchor positioning
 * only resolves an `anchor-name` inside a single tree, and the trigger always lives
 * in a DIFFERENT shadow root from this card, so `position-anchor` finds nothing and
 * the card drops to the viewport corner. Instead `#place()` measures the trigger and
 * writes viewport coordinates into --_x / --_y, which the card consumes as
 * `position: fixed` offsets. It flips when the card would fall off an edge.
 *
 * Rows stay real form controls, slotted from the light DOM:
 *   values   <label><input type="checkbox|radio" value="…" /> Label</label>
 *   actions  <button type="button" value="…">Label</button>
 * A multi-select field is checkbox rows; a single-select field is radio rows; an
 * action menu is buttons. Keyboard and screen-reader behaviour come for free.
 *
 * @element sherpa-menu
 * @attr {string}  data-heading  optional heading (upper-case 10/16)
 * @attr {enum}    data-select   multiple (default) | single
 * @attr {enum}    data-align    start (default) | end — which trigger edge to line up with
 * @attr {string}  data-bounds   a CSS selector for the region the card must stay
 *                inside (the app's content area, say). Resolved from the
 *                document. Defaults to the viewport.
 * @attr {boolean} data-removable show a "Remove filter" footer button (after Today)
 * @attr {boolean} data-commit   show the Cancel/Apply pair and DEFER changes
 *                until Apply (without it, every row tick commits immediately).
 *                It does NOT alone decide whether the footer ROW appears —
 *                Today, Clear and Remove filter share that row and each raises
 *                it on its own flag, so an auto-applying calendar menu still has
 *                a footer holding Today and Remove.
 * @attr {boolean} open          reflects/controls the popover
 *
 * @slot (default) — the rows
 *
 * @fires menu-change — the selection was COMMITTED. detail: { values: string[] }
 * @fires menu-apply  — Apply was clicked. detail: { values: string[] }
 * @fires menu-cancel — Cancel was clicked; values already restored. detail: {}
 * @fires menu-clear — Clear was clicked; the selection is already empty. detail: {}
 * @fires menu-back   — the back arrow of a DRILLED menu was pressed. detail: {}
 *
 * @attr {enum} data-type — list (default) | calendar. The Menu set's own `Type`
 *   axis: `calendar` widens the card and runs the list region horizontally.
 * @fires menu-select — an action row was clicked. detail: { value, label }
 * @fires menu-open   — detail: {}
 * @fires menu-close  — detail: {}
 *
 * @prop {string[]} values — the checked row values (read/write)
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// The drill trail composes the real breadcrumbs component, as sherpa-app-header
// does — a second hand-rolled trail would drift from it.
import '../sherpa-breadcrumbs/sherpa-breadcrumbs.js';
// The search field is the composed Input Field (atom), as the Menu node
// instances it — not a hand-rolled input.
import '../sherpa-input-text/sherpa-input-text.js';
// The Apply/Cancel footer composes real buttons, so the menu must register them —
// it cannot rely on the page having imported them.
import '../sherpa-button/sherpa-button.js';
// The footer IS Figma's Container Footer instance, so the menu composes that
// component rather than drawing an action row of its own.
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
   * Captured on OPEN rather than on first change: a user who ticks, unticks and
   * then cancels must land back where they started, not at the state after the
   * first edit.
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
    // Rows live in the light DOM, so listen on the host and let events bubble up.
    this.addEventListener('change', this.#onChange);
    this.$('.drill-back')?.addEventListener('click', this.#onBack);
    // The PARENT crumb is the same way out as the back arrow — a trail whose
    // links did nothing would be decoration. Only the first crumb is a link
    // (the last is where you are), so any select here means "go back".
    this.$('.drill-crumbs')?.addEventListener('breadcrumb-select', this.#onBack);
    // The ROWS can be replaced wholesale — the overflow menu drills in by
    // swapping its list for another filter's — so the select-all row's state
    // and label have to follow them. slotchange fires exactly when they move in
    // or out, which show() alone does not cover: a drill happens after it.
    this.$('.rows slot')?.addEventListener('slotchange', this.#onRowsChanged);
    this.addEventListener('click', this.#onClick);
    // The footer is in the SHADOW root, so its clicks are listened for there.
    this.$('.apply')?.addEventListener('click', this.#onApply);
    this.$('.cancel')?.addEventListener('click', this.#onCancel);
    this.$('.clear')?.addEventListener('click', this.#onClear);
    this.$('.today')?.addEventListener('click', this.#onToday);
    this.$('.remove')?.addEventListener('click', this.#onRemove);
    // The search is a composed <sherpa-input-text>, which re-dispatches the
    // inner control's `input`. Listening on the component rather than reaching
    // into its shadow root for the raw <input>.
    this.$('.search')?.addEventListener('input', this.#onSearch);
  }

  /**
   * Narrow the rows to those whose text contains what was typed.
   *
   * SUBSTRING, case-insensitively, on the row's own text — a menu search is a
   * "find", so typing "ows" should still reach "Windows". Matching from the
   * start would make a long label unreachable by its distinctive part.
   *
   * It filters the rows it ALREADY HAS: no re-query, and a row hidden by a
   * search keeps whatever is ticked on it and comes back with it. That is what
   * makes searching safe inside a committing menu — you can narrow, tick,
   * clear the search, tick again, and Apply once.
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
    // Only while SEARCHING: an empty menu with no query is empty because the
    // caller passed no rows, which is a different thing from "nothing found".
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
    // Point the select-all row at the set BEFORE the card is painted, so a menu
    // opens reading "Select all" or "Clear all" rather than blank. The rows are
    // slotted light DOM that a host stamps, so there is no render pass of ours
    // to hang this on — opening is the moment the set is known.
    this.#syncSelectAll();
    // Show FIRST, then measure. A closed popover is `display: none`, so its own
    // size reads as 0 and a pre-show measurement cannot flip correctly.
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
   * Usually the checked rows. A NUMBER menu has no rows — its content is one
   * field, or a two-ended slider when its Range switch is on — so it reports
   * that instead: one value, or the two ends. Both are strings, like every row
   * value, so a consumer reads one array whatever the menu is.
   */
  get values(): string[] {
    const numeric = this.#numericValues();
    if (numeric) return numeric;
    return this.#inputs()
      .filter((i) => i.checked)
      .map((i) => i.value);
  }

  /**
   * A NUMBER menu's value, or null when this is not one.
   *
   * A range spanning the WHOLE of its bounds excludes nothing, so it reports no
   * value at all — otherwise a filter that is not filtering would read as active.
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
  set values(next: string[]) {
    const wanted = new Set(next);
    for (const input of this.#inputs()) input.checked = wanted.has(input.value);
  }

  /* ── Private ─────────────────────────────────────────────────────── */

  /**
   * Every value row's control (light DOM — the rows are slotted).
   *
   * The SELECT-ALL row is excluded. It is a control OVER the set, not a member
   * of it: counted in, `values` would carry a phantom "qf-all" entry, Apply
   * would commit it as a picked value, and the count badge would be one too
   * high with everything ticked.
   */
  #inputs(): HTMLInputElement[] {
    return Array.from(
      this.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'),
    ).filter((i) => !i.closest('.qf-all'));
  }

  /**
   * The breadcrumb trail shown when the list has been drilled into.
   *
   * Two crumbs: where it came from, then where it is. The trail is a real
   * <sherpa-breadcrumbs>, which draws the separator and the current-crumb
   * treatment itself, so there is nothing to compose here beyond the data.
   */
  #syncCrumb(): void {
    const crumbs = this.$<HTMLElement & { populate(d: unknown): void }>('.drill-crumbs');
    if (!crumbs) return;
    const from = this.dataset['drillFrom'];
    if (!from) {
      crumbs.populate([]);
      return;
    }
    // NO href on either. The trail here navigates nothing — it goes back a level
    // inside a menu that must stay open — and an <a href="#"> both appended a
    // hash to the URL and dismissed the popover on the way out. sherpa-breadcrumbs
    // fires `breadcrumb-select` for an href-less crumb just the same, which is
    // the whole signal needed.
    crumbs.populate([{ label: from }, { label: this.dataset['heading'] ?? '' }]);
  }

  #sync(): void {
    this.#syncCrumb();
    // The heading TEXT is a declared prop. data-heading stays observed because it
    // also names the card for a screen reader and the radio group below.
    // A CALENDAR shows no heading — its header holds the month stepper and
    // nothing else (Figma 1156:29240: the two variants' headers are exclusive).
    // The name still has to reach a screen reader, so it moves to the card's
    // own label rather than being silently dropped with the text.
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
   * Put the card under its trigger.
   *
   * Everything here is in VIEWPORT coordinates, because the card is
   * `position: fixed` in the top layer — no scroll offset and no containing block
   * can move it. `getBoundingClientRect()` on the trigger gives exactly that, and
   * it works across shadow boundaries where a CSS anchor name does not.
   */
  /**
   * The box the card must stay inside — the viewport, or the region a host
   * names with `data-bounds`.
   *
   * The selector is resolved from the DOCUMENT, so it can name a box in the
   * app's own tree rather than one inside this component. A selector that
   * matches nothing falls back to the viewport rather than trapping the card in
   * a zero-sized box.
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
    // THE BOUNDS the card must stay inside.
    //
    // The viewport by default, but a host can name a narrower box with
    // `data-bounds` — a CSS selector for the region the menu belongs to, such as
    // an app's content area. A menu that hangs over the nav or out of a panel
    // reads as belonging to neither, and the window's edges say nothing about
    // where the content actually stops.
    //
    // NOT CSS anchor positioning, whose `position-try` would do exactly this
    // clamping for free: `anchor-name` resolves inside ONE tree, and every
    // Sherpa trigger is in the caller's shadow root while the card is in this
    // one. Re-probed on Chromium 153 — supported, and it silently drops the card
    // at the viewport's far corner.
    const bounds = this.#bounds();
    const vw = bounds.right;
    const vh = bounds.bottom;

    // Below the trigger, unless there is no room and there IS room above.
    const below = vh - t.bottom - gap * 2;
    const above = t.top - gap * 2;
    let y = t.bottom + gap;
    if (y + c.height > vh && t.top - gap - c.height >= 0) y = t.top - gap - c.height;

    // Cap the card to the room it actually has on the side it landed on, and let
    // `.rows` scroll inside that. Without this a long list (a Sort menu offers two
    // rows per column) ran off the bottom of the screen and took the Apply/Cancel
    // footer with it — the CSS cap was a flat 60vh, which knows nothing about where
    // the trigger sits. Flip to the roomier side when neither fits comfortably.
    const room = Math.max(below, above);
    if (c.height > below && above > below) y = Math.max(gap, t.top - gap - Math.min(c.height, above));
    card.style.setProperty('--_max-h', `${Math.max(120, Math.round(room))}px`);

    // Line up with the trigger's start edge (or its end edge on data-align="end"),
    // then pull back inside the viewport if that overflows.
    let x = this.dataset['align'] === 'end' ? t.right - c.width : t.left;
    if (x + c.width > vw) x = vw - c.width - gap;
    if (x < bounds.left + gap) x = bounds.left + gap;

    // Never off the top either. The vertical flip above can put a tall card
    // above the trigger and past the start edge, which is where a drilled
    // calendar landed — taller than the list it replaced, with the same y it was
    // placed at.
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
      // Snapshot for Cancel. On OPEN, so a tick-untick-cancel round trip lands
      // back at the original selection rather than at the first edit.
      this.#baseline = this.values;
      window.addEventListener('scroll', this.#reposition, { capture: true, passive: true });
      window.addEventListener('resize', this.#reposition, { passive: true });
    } else {
      window.removeEventListener('scroll', this.#reposition, { capture: true });
      window.removeEventListener('resize', this.#reposition);
      this.#trigger = null;
    }
    this.emit(open ? 'menu-open' : 'menu-close', {});
  };

  #reposition = (): void => {
    this.#place();
  };

  override onDisconnect(): void {
    window.removeEventListener('scroll', this.#reposition, { capture: true });
    window.removeEventListener('resize', this.#reposition);
  }

  /** The label a select-all row wears, given whether everything is already on. */
  static readonly ALL_LABELS = { select: 'Select all', clear: 'Clear all' } as const;

  /** A slotted row marked as the select-all control (class `qf-all`). */
  #allRow(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>('.qf-all input');
  }

  /**
   * Tick or clear every value row, and relabel the select-all row.
   *
   * Handled HERE rather than in the toolbar that stamps the row, because a
   * native `change` is not composed: it stops at this element, which is the
   * shadow host the rows are slotted into, and never reaches the toolbar.
   *
   * It writes the other rows' checked state and lets the ordinary change path
   * carry it, rather than setting `values` directly: a committing menu holds a
   * DRAFT, and writing the set here would commit a selection the user has not
   * applied. Ticking the boxes is what the user would have done by hand, so the
   * draft, the count and Cancel all behave as they always did.
   */
  #onSelectAll(input: HTMLInputElement): void {
    // Read the SET, not the box.
    //
    // A native checkbox that is indeterminate reports `checked === false` after
    // a click, so trusting the box turned "some are picked" into "clear them" —
    // and the row then stuck at NONE, because clearing an already-empty set is a
    // no-op the next click repeats. The set is the truth: anything short of all
    // means the useful action is to select the rest.
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
   * `indeterminate` is a PROPERTY, not an attribute: there is no
   * `indeterminate=""` in HTML, so it has to be written on the element every
   * time the set moves.
   */
  #syncSelectAll(): void {
    const all = this.#allRow();
    if (!all) return;
    const boxes = this.#inputs();
    const on = boxes.filter((b) => b.checked).length;
    all.checked = boxes.length > 0 && on === boxes.length;
    all.indeterminate = on > 0 && on < boxes.length;
    const label = all.parentElement?.querySelector('.qf-row-label');
    if (label) {
      label.textContent = all.checked
        ? SherpaMenu.ALL_LABELS.clear
        : SherpaMenu.ALL_LABELS.select;
    }
  }

  /**
   * The back arrow was pressed — say so, and let the owner put the list back.
   *
   * The menu does not know what it drilled INTO, only that it did: the rows came
   * from somewhere else and only that somewhere can take them home. So this is a
   * report, not an action. `menu-back` is composed, which the button's own click
   * is not — it starts inside this shadow root and would never reach the
   * component that filled the menu.
   */
  #onRowsChanged = (): void => {
    this.#syncSelectAll();
    // RE-PLACE. A drill swaps a 240px list for content of its own size — a
    // calendar is half as wide again — and the card was positioned while it was
    // still the list. Left alone it kept the old x and ran off the side of the
    // screen. Measured on the next frame, so the new rows have been laid out.
    if (this.open) requestAnimationFrame(() => this.#place());
  };

  #onBack = (event: Event): void => {
    event.stopPropagation();
    this.emit('menu-back', {});
  };

  #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    // A menu's content is not always a list of boxes. A NUMBER filter slots a
    // plain <input type="number"> and a range slider, and their native change is
    // not composed either — it stops at this element just as a checkbox's does.
    // Without this, typing a value moved nothing downstream at all.
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
    // A COMMITTING menu holds the change as a draft — the row is ticked in the UI,
    // but nothing downstream hears about it until Apply. Otherwise every tick is a
    // commit, which is the behaviour a menu without a footer has always had.
    if (this.#commits) return;
    this.emit('menu-change', { values: this.values });
  };

  /** Whether this menu defers its changes to an Apply button. */
  get #commits(): boolean {
    return this.hasAttribute('data-commit');
  }

  #onApply = (): void => {
    // The draft becomes the committed state, so a later Cancel cannot undo it.
    this.#baseline = this.values;
    this.emit('menu-apply', { values: this.values });
    this.emit('menu-change', { values: this.values });
    this.hide();
  };

  #onCancel = (): void => {
    // Restore what the menu opened with, THEN report — a listener reading
    // `values` in the handler must see the restored set, not the discarded one.
    this.values = this.#baseline;
    this.emit('menu-cancel', {});
    this.hide();
  };

  /**
   * Empty the selection and report it.
   *
   * Clears BOTH kinds of content a menu can hold: the value rows' checkboxes,
   * and a slotted calendar's date attributes. A committing menu stays OPEN —
   * clearing is a change to the draft, not a decision, so the reader can pick
   * again or Cancel out of it. Without data-commit there is no draft, so it
   * commits immediately like any other tick.
   */
  #onClear = (): void => {
    for (const input of this.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
    for (const cal of this.querySelectorAll<HTMLElement>('sherpa-calendar')) {
      for (const a of ['data-value', 'data-value-start', 'data-value-end']) cal.removeAttribute(a);
    }
    this.emit('menu-clear', {});
    // Report the emptied state the same way a tick does, so a host that is not
    // committing sees the change at once.
    if (!this.#commits) this.emit('menu-change', { values: this.values });
  };

  /**
   * Today — drive the slotted calendar to today.
   *
   * The BUTTON is the menu's (Figma puts Today in the Calendar footer's `left`
   * slot) while the BEHAVIOUR is the calendar's, so this calls the calendar's
   * public `today()` rather than reaching into it. Stays OPEN, like a day
   * click: Today picks a date, it does not commit one — Apply still does that.
   */
  #onToday = (): void => {
    for (const cal of this.querySelectorAll<HTMLElement & { today?: () => void }>('sherpa-calendar')) {
      cal.today?.();
    }
  };

  /**
   * Remove filter — the footer button form of the action ROW.
   *
   * Emits exactly what a `<button value="remove">` row emits, so a host listens
   * for one event whichever shape its menu is. A calendar menu has no rows, and
   * this is how it still offers the action.
   */
  #onRemove = (): void => {
    this.emit('menu-select', { value: 'remove', label: 'Remove filter' });
    this.hide();
  };

  #onClick = (event: Event): void => {
    // Only plain action rows close the menu; value rows stay open so several can
    // be picked in one visit.
    const button = (event.target as HTMLElement).closest('button');
    if (!button || button.disabled) return;
    this.emit('menu-select', { value: button.value, label: button.textContent?.trim() ?? '' });
    this.hide();
  };
}

customElements.define('sherpa-menu', SherpaMenu);
