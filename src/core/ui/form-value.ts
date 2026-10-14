/**
 * form-value.ts — a helper a form control IMPORTS to take part in a <form>:
 * what it submits, and whether it is acceptable. Never a base class — a
 * component extends SherpaElement alone.
 *
 * Map:
 * - FormValue — A form-associated control's link to its form.
 * - .form — The form it is in, if any.
 * - .value — What it submits under the host's `name`: one value, several — a range, files — or null for nothing.
 * - .validity — Acceptable — or not, with the platform's flags and a message, pointed at `anchor`.
 * - .follow — Acceptable exactly when the wrapped control is.
 * - .checkValidity — Is it acceptable, as its form sees it?
 * - .reportValidity — Check, and show the browser's message on the control.
 */

/** A native control a component wraps. */
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * A form-associated control's link to its form. The component declares
 * `static formAssociated = true` and makes this in a field initialiser, with
 * its own `this.internals`.
 * TRAP T-shadow-input-needs-element-internals
 */
export class FormValue {
  /** The platform's link between the host and its form. */
  readonly #internals: ElementInternals;

  /** `internals` is the host's own, from `SherpaElement`: attached once. TRAP T-private-state-is-a-custom-state */
  constructor(host: HTMLElement, internals: ElementInternals) {
    this.#host = host;
    this.#internals = internals;
  }

  /** The control it speaks for. */
  readonly #host: HTMLElement;

  /** The form it is in, if any. */
  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  /** What it submits under the host's `name`: one value, several — a range, files — or null for nothing. */
  value(value: string | readonly (string | File)[] | null): void {
    if (value === null || typeof value === 'string') {
      this.#internals.setFormValue(value);
      return;
    }
    const name = this.#host.getAttribute('name');
    if (!name || !value.length) {
      this.#internals.setFormValue(null);
      return;
    }
    const data = new FormData();
    for (const one of value) data.append(name, one);
    this.#internals.setFormValue(data);
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
