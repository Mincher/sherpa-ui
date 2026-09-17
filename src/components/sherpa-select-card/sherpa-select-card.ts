/**
 * sherpa-select-card — a selectable card with header / content / footer slots.
 *
 * The whole card is one big option. Clicking it toggles [data-selected]; CSS
 * draws the selected ring. Everything visual lives in CSS off data-* — JS only
 * sets attributes.
 *
 * TRAP T-select-card-keeps-both-footer-controls — BOTH footer controls exist and
 * are kept in sync, and radio grouping is done by hand because native grouping
 * cannot cross shadow roots.
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
  /** Header title + description into the shadow (CSS collapses empties). */
  static override props = {
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
    // A change bubbling from the default footer control (user clicked the radio
    // directly) drives the card selection back the other way.
    this.addEventListener('change', this.#onControlChange);
  }

  override onChange(name: string): void {
    // data-label / data-description are declared props and no longer reach here,
    // so the trailing `else` cannot catch them.
    if (name === 'data-select-mode') {
      this.#syncRole();
      this.#syncControl();
    } else if (name === 'data-selected') {
      this.#syncControl();
      this.#syncAria();
    } else this.#syncControl();
  }

  /** true when the card is in checkbox (multi-select) mode. */
  #isCheckbox(): boolean {
    return this.dataset['selectMode'] === 'checkbox';
  }

  /** Host role follows the select mode: checkbox for multi, radio otherwise. */
  #syncRole(): void {
    this.setAttribute('role', this.#isCheckbox() ? 'checkbox' : 'radio');
  }

  /**
   * Mirror the card's name / value / disabled / selected onto BOTH pre-placed
   * footer controls (radio + checkbox).
   *
   * TRAP T-select-card-keeps-both-footer-controls
   */
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

  /** Keep aria-checked in step with the visual selected state. */
  #syncAria(): void {
    this.setAttribute('aria-checked', String(this.hasAttribute('data-selected')));
  }

  /* ── Interaction ──────────────────────────────────────────────────── */

  #onCardClick = (event: MouseEvent): void => {
    if (this.hasAttribute('disabled')) return;
    // TRAP T-select-card-keeps-both-footer-controls — a control's own change
    // already handles it; don't double-toggle from the card too.
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

  /** A default footer control changed → adopt its checked state. */
  #onControlChange = (event: Event): void => {
    const control = this.$$<FooterControl>('.footer-control').find((c) => c === event.target);
    if (!control) return; // slotted control: consumer owns it
    event.stopPropagation(); // we re-emit our own change below
    this.#setSelected(control.checked);
  };

  /** TRAP T-select-card-keeps-both-footer-controls — a radio selects, a checkbox flips. */
  #toggle(): void {
    if (this.#isCheckbox()) this.#setSelected(!this.hasAttribute('data-selected'));
    else this.#setSelected(true);
  }

  /** Apply a selected state, coordinate the radio group, and report it. */
  #setSelected(next: boolean): void {
    this.toggleAttribute('data-selected', next);
    if (next && !this.#isCheckbox()) this.#deselectGroup();
    this.emit('change', { selected: next, value: this.value });
  }

  /** Deselect sibling radio cards sharing this name — document-wide, since
   *  native grouping cannot cross shadow roots.
   *  TRAP T-select-card-keeps-both-footer-controls */
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
