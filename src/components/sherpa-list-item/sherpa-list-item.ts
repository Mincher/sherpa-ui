/**
 * sherpa-list-item — one row inside a sherpa-list.
 *
 * Each leading affordance is turned on with a data-* flag and shown by CSS.
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
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaListItem extends SherpaElement {
  static override css = new URL('./sherpa-list-item.css', import.meta.url);
  static override html = new URL('./sherpa-list-item.html', import.meta.url);
  static override props = {
    /* No `data-heading` entry: `data-label` below declares it as its
       `fallbackAttr`, which is the back-compat alias. A second entry writing
       the same `.title` would fight it — and without `all: true` it would
       write only the first of the two, leaving the pair disagreeing.
       TRAP T-an-alias-is-declared-by-its-owner */
    'data-draggable': { type: 'boolean', kind: 'style' },
    'data-expandable': { type: 'boolean', kind: 'style' },
    'data-interactive': { type: 'boolean', kind: 'style' },
    'data-selectable': { type: 'boolean', kind: 'style' },
    // `all`: title + description appear twice — in the <button> and the static span.
    'data-label': { type: 'string', kind: 'content', to: '.title', all: true, fallbackAttr: 'data-heading' },
    'data-description': { type: 'string', kind: 'content', to: '.description', all: true },
    'data-icon': { type: 'string', kind: 'content', to: '.icon', as: 'icon' },
  } as const;

  static override observed = ['data-expanded', 'data-selected'];

  /** The event label — the same data-label → data-heading chain the prop declares. */
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
    // Not textContent writes, so the declared props cannot do these.
    if (name === 'data-expanded') this.#syncExpanded();
    else if (name === 'data-selected') this.#syncSelected();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get current(): boolean { return this.hasAttribute('data-current'); }
  set current(v: boolean) { this.toggleAttribute('data-current', v); }

  get selected(): boolean { return this.hasAttribute('data-selected'); }
  set selected(v: boolean) { this.toggleAttribute('data-selected', v); }

  /* ── Sync ─────────────────────────────────────────────────────── */

  /** Mirror data-selected onto the native checkbox. */
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
    // A leading affordance handles its own click; don't also activate the row.
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
