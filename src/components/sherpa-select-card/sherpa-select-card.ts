/**
 * sherpa-select-card — a selectable card with header / content / footer slots.
 *
 * TRAP T-select-card-keeps-both-footer-controls — BOTH footer controls exist
 * and stay in sync; radio grouping is by hand, as native grouping cannot cross
 * shadow roots.
 */
import { SHARED_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import '../sherpa-select-radio/sherpa-select-radio.js';
import '../sherpa-select-checkbox/sherpa-select-checkbox.js';

/** The default footer control (a Sherpa select) — the parts JS reads/writes. */
interface FooterControl extends HTMLElement {
  checked: boolean;
  value: string;
}

export class SherpaSelectCard extends SherpaElement {
  static override css = new URL('./sherpa-select-card.css', import.meta.url);
  static override html = new URL('./sherpa-select-card.html', import.meta.url);
  static override props = {
    'data-footer': { type: 'enum', kind: 'style', values: ['none'] },
    'data-orientation': SHARED_PROPS['data-orientation'],
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
  } as const;

  static override observed = [
    'data-selected',
    'data-select-mode',
    'name',
    'value',
    'disabled',
  ];

  #card: HTMLElement | null = null;

  override onRender(): void {
    this.#card = this.$('.card');
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    this.#syncRole();

    this.#syncControl();
    this.#syncAria();

    this.#card?.addEventListener('click', this.#onCardClick);
    this.addEventListener('keydown', this.#onKeydown);
    // A change from the footer control drives the card selection back.
    this.addEventListener('change', this.#onControlChange);
  }

  override onChange(name: string): void {
    // data-label / data-description are declared props — they never reach here.
    if (name === 'data-select-mode') {
      this.#syncRole();
      this.#syncControl();
    } else if (name === 'data-selected') {
      this.#syncControl();
      this.#syncAria();
    } else this.#syncControl();
  }

  /** true in checkbox (multi-select) mode. */
  #isCheckbox(): boolean {
    return this.dataset['selectMode'] === 'checkbox';
  }

  /** Host role follows the select mode: checkbox for multi, radio otherwise. */
  #syncRole(): void {
    this.setAttribute('role', this.#isCheckbox() ? 'checkbox' : 'radio');
  }

  /** Mirror name / value / disabled / selected onto BOTH footer controls. */
  #syncControl(): void {
    const controls = this.$$<FooterControl>('.footer-control');
    for (const c of controls) {
      if (this.hasAttribute('name')) c.setAttribute('name', this.getAttribute('name') ?? '');
      else c.removeAttribute('name');
      c.value = this.getAttribute('value') ?? '';
      c.checked = this.hasAttribute('data-selected');
      if (this.hasAttribute('disabled')) c.setAttribute('disabled', '');
      else c.removeAttribute('disabled');
    }
  }

  /** Keep aria-checked in step with the selected state. */
  #syncAria(): void {
    this.setAttribute('aria-checked', String(this.hasAttribute('data-selected')));
  }

  /* ── Interaction ──────────────────────────────────────────────────── */

  #onCardClick = (event: MouseEvent): void => {
    if (this.hasAttribute('disabled')) return;
    // The control's own change handles it; don't double-toggle from the card.
    const path = event.composedPath();
    for (const control of this.$$('.footer-control')) {
      if (path.includes(control)) return;
    }
    this.#toggle();
  };

  #onKeydown = (event: KeyboardEvent): void => {
    if (this.hasAttribute('disabled')) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.#toggle();
    }
  };

  /** A footer control changed → adopt its checked state. */
  #onControlChange = (event: Event): void => {
    const control = this.$$<FooterControl>('.footer-control').find((c) => c === event.target);
    if (!control) return; // slotted control: consumer owns it
    event.stopPropagation(); // we re-emit our own change below
    this.#setSelected(control.checked);
  };

  /** A radio selects; a checkbox flips. */
  #toggle(): void {
    if (this.#isCheckbox()) this.#setSelected(!this.hasAttribute('data-selected'));
    else this.#setSelected(true);
  }

  /** Apply the selected state, coordinate the radio group, report it. */
  #setSelected(next: boolean): void {
    this.toggleAttribute('data-selected', next);
    if (next && !this.#isCheckbox()) this.#deselectGroup();
    this.emit('change', { selected: next, value: this.value });
  }

  /** Deselect sibling radio cards with this name — document-wide, because
   *  native grouping cannot cross shadow roots. */
  #deselectGroup(): void {
    const name = this.getAttribute('name');
    if (!name) return;
    const group = document.querySelectorAll<SherpaSelectCard>(
      `sherpa-select-card[name="${CSS.escape(name)}"]`
    );
    for (const card of group) {
      if (card !== this) card.selected = false;
    }
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  get selected(): boolean {
    return this.hasAttribute('data-selected');
  }
  set selected(v: boolean) {
    this.toggleAttribute('data-selected', v);
  }

  get value(): string {
    return this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    this.setAttribute('value', v);
  }

  override focus(options?: FocusOptions): void {
    (this.#card ?? this).focus(options);
  }
}

customElements.define('sherpa-select-card', SherpaSelectCard);
