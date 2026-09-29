/**
 * form-value.ts — a helper a form control IMPORTS to take part in a <form>:
 * what it submits, and whether it is acceptable. Never a base class — a
 * component extends SherpaElement alone.
 *
 * Map:
 * - FormValue — A form-associated control's link to its form.
 * - .form — The form it is in, if any.
 * - .value — What it submits, under the host's `name`; null submits nothing.
 * - .validity — Acceptable — or not, with the platform's flags and a message, pointed at `anchor`.
 * - .follow — Acceptable exactly when the wrapped control is.
 * - .checkValidity — Is it acceptable, as its form sees it?
 * - .reportValidity — Check, and show the browser's message on the control.
 */

/** A native control a component wraps. */
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * A form-associated control's link to its form. The component declares
 * `static formAssociated = true` and makes this in a field initialiser, so
 * `attachInternals()` runs in its constructor.
 * TRAP T-shadow-input-needs-element-internals
 */
export class FormValue {
  /** The platform's link between the host and its form. */
  readonly #internals: ElementInternals;

  constructor(host: HTMLElement) {
    this.#internals = host.attachInternals();
  }

  /** The form it is in, if any. */
  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  /** What it submits, under the host's `name`; null submits nothing. */
  value(value: string | null): void {
    this.#internals.setFormValue(value);
  }

  /** Acceptable — or not, with the platform's flags and a message, pointed at `anchor`. */
  validity(flags: ValidityStateFlags = {}, message = '', anchor?: HTMLElement): void {
    this.#internals.setValidity(flags, message, anchor);
  }

  /** Acceptable exactly when the wrapped control is. */
  follow(control: Control): void {
    if (control.validity.valid) this.#internals.setValidity({});
    else this.#internals.setValidity(control.validity, control.validationMessage, control);
  }

  /** Is it acceptable, as its form sees it? */
  checkValidity(): boolean {
    return this.#internals.checkValidity();
  }

  /** Check, and show the browser's message on the control. */
  reportValidity(): boolean {
    return this.#internals.reportValidity();
  }
}
