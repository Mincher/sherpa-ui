/**
 * sherpa-list-item — one row inside a sherpa-list.
 *
 * Left to right: a leading area (drag handle, expand toggle, checkbox or radio,
 * icon), then a label and description, then a trailing slot. Each leading bit is
 * turned on with a data-* flag and shown by CSS. data-interactive makes the row
 * clickable — it then marks itself current and fires item-click.
 *
 * Public API:
 *   data-label / data-description   text (data-heading is a back-compat alias for data-label)
 *   data-icon                       leading icon glyph
 *   data-current                    current-row visual state
 *   data-interactive                enable hover + click behaviour
 *   data-draggable / data-expandable / data-expanded
 *   data-selectable / data-selected
 *   disabled                        disabled state
 *
 * @tier sub-component
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaListItem extends SherpaElement {
  static override css = new URL('./sherpa-list-item.css', import.meta.url);
  static override html = new URL('./sherpa-list-item.html', import.meta.url);
  static override tier = 'sub-component' as const;
  static override props = {
    // `all`: title + description appear TWICE (inside the <button> and in the
    // static content span). `fallbackAttr`: data-heading is the legacy alias.
    'data-label': { type: 'string', kind: 'content', to: '.title', all: true, fallbackAttr: 'data-heading' },
    'data-description': { type: 'string', kind: 'content', to: '.description', all: true },
    'data-icon': { type: 'string', kind: 'content', to: '.icon', as: 'icon' },
  } as const;

  static override observed = ['data-expanded', 'data-selected'];

  /** The label the EVENT carries — the declared prop's own data-label → data-heading chain. */
  #labelText(): string { return this.dataset['label'] ?? this.dataset['heading'] ?? ''; }

  override onRender(): void {
    this.#syncSelected();
    this.#syncExpanded();
    this.addEventListener('click', this.#onClick);
    this.$('.expand')?.addEventListener('click', this.#onExpand);
    this.$('.checkbox')?.addEventListener('change', this.#onSelect);
    this.$('.drag')?.addEventListener('pointerdown', this.#onDrag);
  }

  override onChange(name: string): void {
    // The declared props write the text; these two mirror STATE onto a native
    // control and an aria value, which is not a textContent write.
    if (name === 'data-expanded') this.#syncExpanded();
    else if (name === 'data-selected') this.#syncSelected();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get current(): boolean { return this.hasAttribute('data-current'); }
  set current(v: boolean) { this.toggleAttribute('data-current', v); }

  get selected(): boolean { return this.hasAttribute('data-selected'); }
  set selected(v: boolean) { this.toggleAttribute('data-selected', v); }

  /* ── Sync ─────────────────────────────────────────────────────── */

  /** Keep the native checkbox checked-state in sync with data-selected. */
  #syncSelected(): void {
    const box = this.$<HTMLInputElement>('.checkbox');
    if (box) box.checked = this.hasAttribute('data-selected');
  }

  #syncExpanded(): void {
    this.$('.expand')?.setAttribute('aria-expanded', String(this.hasAttribute('data-expanded')));
  }

  /* ── Interaction ──────────────────────────────────────────────── */

  #activate(): void {
    if (this.dataset['interactive'] === undefined || this.hasAttribute('disabled')) return;
    this.current = true;
    this.emit('item-click', { label: this.#labelText() });
  }

  #onClick = (event: Event): void => {
    // A click on a leading affordance handles itself; don't also activate the row.
    const path = event.composedPath();
    if (path.some((n) => n instanceof HTMLElement && (n.classList.contains('expand') || n.classList.contains('control') || n.classList.contains('drag')))) {
      return;
    }
    this.#activate();
  };

  #onExpand = (event: Event): void => {
    event.stopPropagation();
    const expanded = !this.hasAttribute('data-expanded');
    this.toggleAttribute('data-expanded', expanded);
    this.emit('item-expand', { expanded });
  };

  // Native <input type="checkbox"> "change" — mirror its state onto data-selected.
  #onSelect = (event: Event): void => {
    event.stopPropagation();
    if (this.hasAttribute('disabled')) return;
    const selected = (event.target as HTMLInputElement).checked;
    this.selected = selected;
    this.emit('item-select', { selected });
  };

  #onDrag = (): void => { this.emit('item-drag', {}); };
}

customElements.define('sherpa-list-item', SherpaListItem);
