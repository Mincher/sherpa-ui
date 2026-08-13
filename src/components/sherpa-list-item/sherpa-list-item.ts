/**
 * sherpa-list-item — a single row inside a sherpa-list.
 *
 * Three regions: a leading slot (icon / avatar), a content column (a title from
 * data-title + a description from data-description), and a trailing slot
 * (actions / badges). All visibility is CSS off data-* and slot-presence; JS
 * only writes the two text fields and handles interaction.
 *
 * When data-interactive is set the row is focusable and clicking (or Enter /
 * Space) marks it active and emits `list-item-click`.
 *
 * Public API:
 *   data-title        primary text
 *   data-description  secondary text
 *   data-active       active/selected visual state
 *   data-interactive  enable hover + click behaviour
 *   disabled          disabled state
 *
 * @fires list-item-click — detail: { title }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaListItem extends SherpaElement {
  static override css = new URL('./sherpa-list-item.css', import.meta.url);
  static override html = new URL('./sherpa-list-item.html', import.meta.url);
  static override observed = ['data-title', 'data-description', 'data-interactive'];

  override onRender(): void {
    this.#syncTitle();
    this.#syncDescription();
    this.#syncInteractive();
    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeyDown);
  }

  override onChange(name: string): void {
    if (name === 'data-title') this.#syncTitle();
    else if (name === 'data-description') this.#syncDescription();
    else if (name === 'data-interactive') this.#syncInteractive();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get active(): boolean {
    return this.hasAttribute('data-active');
  }
  set active(v: boolean) {
    this.toggleAttribute('data-active', v);
  }

  /* ── Sync ─────────────────────────────────────────────────────── */

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['title'] ?? '';
  }

  #syncDescription(): void {
    const el = this.$('.description');
    if (el) el.textContent = this.dataset['description'] ?? '';
  }

  /** Interactive rows are keyboard-reachable; non-interactive ones are not. */
  #syncInteractive(): void {
    if (this.dataset['interactive'] !== undefined) {
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    } else {
      this.removeAttribute('tabindex');
    }
  }

  /* ── Interaction ──────────────────────────────────────────────── */

  #activate(): void {
    if (this.dataset['interactive'] === undefined || this.hasAttribute('disabled')) return;
    this.active = true;
    this.emit('list-item-click', { title: this.dataset['title'] ?? '' });
  }

  #onClick = (): void => {
    this.#activate();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (this.dataset['interactive'] === undefined || this.hasAttribute('disabled')) return;
      event.preventDefault();
      this.#activate();
    }
  };
}

customElements.define('sherpa-list-item', SherpaListItem);
