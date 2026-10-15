/**
 * sherpa-select-card — a selectable card with header / content / footer slots.
 *
 * TRAP T-select-card-keeps-both-footer-controls — BOTH footer controls exist
 * and stay in sync; radio grouping is by hand, as native grouping cannot cross
 * shadow roots.
 */
import { SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
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
  static override delegatesFocus = true;
  static override props = {
    'data-footer': { type: 'enum', kind: 'style', values: ['none'] },
    'data-orientation': SHARED_PROPS['data-orientation'],
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    'checked': { type: 'boolean', kind: 'style', accessor: 'checked' },
    'data-select-mode': { type: 'enum', kind: 'style', values: ['radio', 'checkbox'] },
  } as const;

  /** Installed by `define()` from the props' `accessor`. */
  declare checked: boolean;

  static override observed = [
    'name',
    'value',
    'disabled',
  ];

  /** Checked, it submits its value in a form: its footer controls are parts and
   *  join none. TODO 214 */
  static readonly formAssociated = true;
  /** Its first `checked`: what a form reset puts back. */
  #resetTo = false;

  /** The card face a click on anywhere toggles. */
  #card: HTMLElement | null = null;

  override onRender(): void {
    this.#resetTo = this.hasAttribute('checked');
    this.#card = this.$('.card');
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    this.#syncRole();

    this.#syncControl();
    this.#syncAria();

    this.#card?.addEventListener('click', this.#onCardClick);
    this.addEventListener('keydown', this.#onKeydown);
  }

  override onChange(name: string): void {
    // data-label / data-description are declared props — they never reach here.
    if (name === 'data-select-mode') {
      this.#syncRole();
      this.#syncControl();
    } else if (name === 'checked') {
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

  /** Mirror name / value / disabled / checked onto BOTH footer controls. */
  #syncControl(): void {
    const controls = this.$$<FooterControl>('.footer-control');
    for (const c of controls) {
      if (this.hasAttribute('name')) c.setAttribute('name', this.getAttribute('name') ?? '');
      else c.removeAttribute('name');
      c.value = this.getAttribute('value') ?? 'on';
      c.checked = this.hasAttribute('checked');
      // The EFFECTIVE state: its own `disabled`, or a disabled fieldset's.
      c.toggleAttribute('disabled', this.matches(':disabled'));
    }
    this.formLink.value(this.checked ? this.value : null);
  }

  /* Form lifecycle — called by the browser. */

  /** Inside a disabled `<fieldset>`, as by its own `disabled`. TRAP T-a-form-control-follows-its-fieldset */
  formDisabledCallback(): void {
    this.#syncControl();
  }

  /** A form reset puts back its first `checked`. */
  formResetCallback(): void {
    this.checked = this.#resetTo;
  }

  /** Keep aria-checked in step with the checked state. */
  #syncAria(): void {
    this.setAttribute('aria-checked', String(this.hasAttribute('checked')));
  }

  /* ── Interaction ──────────────────────────────────────────────────── */

  /** A click anywhere on the card toggles it. */
  #onCardClick = (): void => {
    if (this.matches(':disabled')) return;
    this.#toggle();
  };

  /** Space and Enter toggle it, as they would a checkbox. */
  #onKeydown = (event: KeyboardEvent): void => {
    if (this.matches(':disabled')) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.#toggle();
    }
  };

  /** A radio selects; a checkbox flips. */
  #toggle(): void {
    if (this.#isCheckbox()) this.#setChecked(!this.hasAttribute('checked'));
    else this.#setChecked(true);
  }

  /** Apply the checked state, coordinate the radio group, report it. */
  #setChecked(next: boolean): void {
    this.set('checked', next);
    if (next && !this.#isCheckbox()) this.#deselectGroup();
    this.emit('change', { checked: next, value: this.value });
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
      if (card !== this) card.checked = false;
    }
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  get value(): string {
    return this.getAttribute('value') ?? 'on';
  }
  set value(v: string) {
    this.setAttribute('value', v);
  }

}

define('sherpa-select-card', SherpaSelectCard);
