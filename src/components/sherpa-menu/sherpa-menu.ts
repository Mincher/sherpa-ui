/**
 * sherpa-menu — a floating list of choices or actions.
 *
 * Built on the native popover API, so the browser owns the top layer, the Escape
 * key, the outside-click dismiss and focus. That means this file has no positioning
 * code and no document-level listeners.
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
 * @attr {string}  data-anchor   the CSS anchor-name of the trigger
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
  static override observed = ['data-heading', 'data-anchor', 'open'];

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

  /** Open the menu. Pass the trigger to anchor it (and to restore focus to it). */
  show(trigger?: HTMLElement): void {
    if (trigger) this.#anchorTo(trigger);
    this.#card()?.showPopover();
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

    const anchor = this.dataset['anchor'];
    if (anchor) this.#card()?.style.setProperty('--_anchor', anchor);
  }

  /** Point the popover at a trigger using CSS anchor positioning. */
  #anchorTo(trigger: HTMLElement): void {
    // A unique anchor-name per trigger, so several menus can coexist.
    let name = trigger.style.getPropertyValue('anchor-name');
    if (!name) {
      name = `--sherpa-anchor-${Math.random().toString(36).slice(2, 8)}`;
      trigger.style.setProperty('anchor-name', name);
    }
    this.dataset['anchor'] = name;
    this.#card()?.style.setProperty('--_anchor', name);
  }

  #onToggle = (event: Event): void => {
    const open = (event as ToggleEvent).newState === 'open';
    this.toggleAttribute('open', open);
    this.emit(open ? 'menu-open' : 'menu-close', {});
  };

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
