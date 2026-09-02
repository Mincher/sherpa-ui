/**
 * sherpa-select-card — a selectable card with header / content / footer slots.
 *
 * The whole card is one big option. Clicking it toggles [data-selected]; CSS
 * draws the selected ring. The footer carries a default select control — a
 * sherpa-select-radio, or a sherpa-select-checkbox when data-multiple is set —
 * kept in sync with the card's selected state so either target flips both. When
 * a consumer slots their own footer, that control is theirs to wire; the card
 * still reports selection through the change event.
 *
 * Radios sharing a `name` group up: selecting one card deselects its siblings
 * (mirroring sherpa-select-radio, which native grouping can't do across shadow
 * roots). Everything visual lives in CSS off data-* — JS only sets attributes.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
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
  static override observed = [
    'data-label',
    'data-description',
    'data-selected',
    'data-multiple',
    'name',
    'value',
    'disabled',
  ];

  #card: HTMLElement | null = null;

  override onRender(): void {
    this.#card = this.$('.card');
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    this.setAttribute('role', this.hasAttribute('data-multiple') ? 'checkbox' : 'radio');

    this.#syncText();
    this.#syncControl();
    this.#syncAria();

    this.#card?.addEventListener('click', this.#onCardClick);
    this.addEventListener('keydown', this.#onKeydown);
    // A change bubbling from the default footer control (user clicked the radio
    // directly) drives the card selection back the other way.
    this.addEventListener('change', this.#onControlChange);
  }

  override onChange(name: string): void {
    if (name === 'data-label' || name === 'data-description') this.#syncText();
    else if (name === 'data-multiple') {
      this.setAttribute('role', this.hasAttribute('data-multiple') ? 'checkbox' : 'radio');
      this.#syncControl();
    } else if (name === 'data-selected') {
      this.#syncControl();
      this.#syncAria();
    } else this.#syncControl();
  }

  /** Header title + description into the shadow (CSS collapses empties). */
  #syncText(): void {
    const label = this.$('.label');
    if (label) label.textContent = this.dataset['label'] ?? '';
    const description = this.$('.description');
    if (description) description.textContent = this.dataset['description'] ?? '';
  }

  /** The default footer control, if the footer slot is using its fallback. */
  #footerControl(): FooterControl | null {
    return this.$<FooterControl>('.footer-control');
  }

  /**
   * Swap the default footer control to match data-multiple (radio ↔ checkbox)
   * and mirror the card's name / value / disabled / selected onto it. A slotted
   * footer overrides the default, so this is a no-op then.
   */
  #syncControl(): void {
    const control = this.#footerControl();
    if (!control) return;

    const wantCheckbox = this.hasAttribute('data-multiple');
    const isCheckbox = control.tagName.toLowerCase() === 'sherpa-select-checkbox';
    if (wantCheckbox !== isCheckbox) {
      // Replace the control element in place, keeping its class + part hooks.
      const tag = wantCheckbox ? 'sherpa-select-checkbox' : 'sherpa-select-radio';
      const next = document.createElement(tag);
      next.className = control.className;
      next.setAttribute('part', control.getAttribute('part') ?? 'footer-control');
      control.replaceWith(next);
    }

    const c = this.#footerControl();
    if (!c) return;
    if (this.hasAttribute('name')) c.setAttribute('name', this.getAttribute('name') ?? '');
    else c.removeAttribute('name');
    c.value = this.getAttribute('value') ?? '';
    c.checked = this.hasAttribute('data-selected');
    if (this.hasAttribute('disabled')) c.setAttribute('disabled', '');
    else c.removeAttribute('disabled');
  }

  /** Keep aria-checked in step with the visual selected state. */
  #syncAria(): void {
    this.setAttribute('aria-checked', String(this.hasAttribute('data-selected')));
  }

  /* ── Interaction ──────────────────────────────────────────────────── */

  #onCardClick = (event: MouseEvent): void => {
    if (this.hasAttribute('disabled')) return;
    // A click that lands on the footer control itself already fires its own
    // change (→ #onControlChange); don't double-toggle from the card too.
    const control = this.#footerControl();
    if (control && event.composedPath().includes(control)) return;
    this.#toggle();
  };

  #onKeydown = (event: KeyboardEvent): void => {
    if (this.hasAttribute('disabled')) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.#toggle();
    }
  };

  /** The default footer control changed → adopt its checked state. */
  #onControlChange = (event: Event): void => {
    const control = this.#footerControl();
    if (!control || event.target !== control) return; // slotted control: consumer owns it
    event.stopPropagation(); // we re-emit our own change below
    this.#setSelected(control.checked);
  };

  /** Toggle for radios means "select" (can't unselect by re-click); checkboxes flip. */
  #toggle(): void {
    if (this.hasAttribute('data-multiple')) this.#setSelected(!this.hasAttribute('data-selected'));
    else this.#setSelected(true);
  }

  /** Apply a selected state, coordinate the radio group, and report it. */
  #setSelected(next: boolean): void {
    this.toggleAttribute('data-selected', next);
    if (next && !this.hasAttribute('data-multiple')) this.#deselectGroup();
    this.emit('change', { selected: next, value: this.value });
  }

  /** Deselect sibling radio cards sharing this card's name (document-wide). */
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
