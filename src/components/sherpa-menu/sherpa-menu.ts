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
 * @attr {boolean} data-commit   show the Apply/Cancel footer and DEFER changes
 *                until Apply (without it, every row tick commits immediately)
 * @attr {boolean} open          reflects/controls the popover
 *
 * @slot (default) — the rows
 *
 * @fires menu-change — the selection was COMMITTED. detail: { values: string[] }
 * @fires menu-apply  — Apply was clicked. detail: { values: string[] }
 * @fires menu-cancel — Cancel was clicked; values already restored. detail: {}
 * @fires menu-clear — Clear was clicked; the selection is already empty. detail: {}
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
  static override observed = [
    'data-heading',
    'data-align',
    'data-search',
    'data-clearable',
    'data-type',
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
    this.addEventListener('click', this.#onClick);
    // The footer is in the SHADOW root, so its clicks are listened for there.
    this.$('.apply')?.addEventListener('click', this.#onApply);
    this.$('.cancel')?.addEventListener('click', this.#onCancel);
    this.$('.clear')?.addEventListener('click', this.#onClear);
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

  /** The checked row values. */
  get values(): string[] {
    return this.#inputs()
      .filter((i) => i.checked)
      .map((i) => i.value);
  }
  set values(next: string[]) {
    const wanted = new Set(next);
    for (const input of this.#inputs()) input.checked = wanted.has(input.value);
  }

  /* ── Private ─────────────────────────────────────────────────────── */

  /** Every value row's control (light DOM — the rows are slotted). */
  #inputs(): HTMLInputElement[] {
    return Array.from(this.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'));
  }

  #sync(): void {
    const heading = this.$('.heading');
    if (heading) heading.textContent = this.dataset['heading'] ?? '';

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
  #place(): void {
    const card = this.#card();
    const trigger = this.#trigger;
    if (!card || !trigger?.isConnected) return;

    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const gap = SherpaMenu.OFFSET;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

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
    if (x < gap) x = gap;

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

  #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    if (!input || (input.type !== 'checkbox' && input.type !== 'radio')) return;
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
