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
 * @attr {boolean} open          reflects/controls the popover
 *
 * @slot (default) — the rows
 *
 * @fires menu-change — a value row changed. detail: { values: string[] }
 * @fires menu-select — an action row was clicked. detail: { value, label }
 * @fires menu-open   — detail: {}
 * @fires menu-close  — detail: {}
 *
 * @prop {string[]} values — the checked row values (read/write)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaMenu extends SherpaElement {
  static override css = new URL('./sherpa-menu.css', import.meta.url);
  static override html = new URL('./sherpa-menu.html', import.meta.url);
  static override observed = ['data-heading', 'data-align', 'open'];

  /** The gap between the trigger and the card (Figma space/2xs). */
  static readonly OFFSET = 4;

  /** The trigger of the currently-open menu — re-measured on scroll / resize. */
  #trigger: HTMLElement | null = null;

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
    let y = t.bottom + gap;
    if (y + c.height > vh && t.top - gap - c.height >= 0) y = t.top - gap - c.height;

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
    this.emit('menu-change', { values: this.values });
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
