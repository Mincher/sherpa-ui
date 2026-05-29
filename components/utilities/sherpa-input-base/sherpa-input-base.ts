/**
 * SherpaInputBase — Abstract base class for all form input components.
 *
 * Extends SherpaElement to provide shared behaviour for inputs:
 *   • Label + description rendering via <dl>/<dt>/<dd> semantic pattern
 *   • Status icon display alongside description text
 *   • Horizontal / vertical layout via `layout` attribute
 *   • Disabled / readonly / required attribute mirroring to native control
 *   • Value bridging between host attribute and internal <input>/<select>
 *   • Change / input event re-dispatching (bubbles, composed)
 *
 * Subclasses MUST:
 *   • Set static cssUrl / htmlUrl pointing to their own files
 *   • Include a .input-field element in their template
 *   • Call customElements.define() with their tag name
 *
 * Subclasses MAY override:
 *   • onInputRender() — called after base onRender, for type-specific wiring
 *   • onInputConnect() — called after base onConnect, for type-specific setup
 *   • getInputElement() — if the primary native control isn't .input-field
 *
 * Template contract — subclass HTML should provide a <template id="default">
 * whose content is injected INSIDE the base wrapper:
 *
 *   <dl class="input-wrapper">
 *     <div class="input-header">           ← label + description
 *       <dt class="input-label">…</dt>
 *       <dd class="input-description">…</dd>
 *     </div>
 *     <div class="input-content">          ← control + helper
 *       <div class="input-body">           ← border + overflow:hidden
 *         <dd class="input-control">…</dd>
 *         <dd class="input-validation-message">…</dd>
 *       </div>
 *       <dd class="input-helper">…</dd>
 *     </div>
 *   </dl>
 *
 * The base class builds this wrapper in onRender() and injects the template
 * content into .input-control.
 *
 * CSS:
 *   Each subclass CSS file imports sherpa-input-base.css via @import.
 *   The browser handles loading and cascade natively — no JS involvement.
 */

import { SherpaElement } from "../sherpa-element/sherpa-element.js";
import { StatusMixin } from "../status-mixin.js";
import type { Orientation, ChangeEventDetail } from "../types.js";

/* ── Type Definitions ─────────────────────────────────────────────── */

/** Input-specific dataset interface */
interface SherpaInputDataset extends DOMStringMap {
  label?: string;
  description?: string;
  helper?: string;
  layout?: Orientation;
}

/** Native input element types */
type NativeInputElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Input change event detail */
interface InputChangeEventDetail extends ChangeEventDetail<string> {
  value: string;
}

/* ── Wrapper template (loaded once from sherpa-input-base.html) ──── */

const WRAPPER_HTML_URL = new URL("./sherpa-input-base.html", import.meta.url)
  .href;

let wrapperTplPromise: Promise<HTMLTemplateElement> | null = null;

/**
 * Fetch and parse the wrapper template on first call; cache the promise
 * so subsequent instantiations reuse the same parsed <template> node.
 */
function loadWrapperTemplate(): Promise<HTMLTemplateElement> {
  if (!wrapperTplPromise) {
    wrapperTplPromise = fetch(WRAPPER_HTML_URL)
      .then((r) => {
        if (!r.ok) {
          throw new Error(
            `[sherpa-input-base] Failed to load wrapper template: ${r.status}`,
          );
        }
        return r.text();
      })
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const tpl = doc.querySelector<HTMLTemplateElement>('template[id="wrapper"]');
        if (!tpl) {
          throw new Error(
            "[sherpa-input-base] sherpa-input-base.html missing <template id=\"wrapper\">",
          );
        }
        return tpl;
      });
  }
  return wrapperTplPromise!;
}

/* ── Component ──────────────────────────────────────────────────── */

export class SherpaInputBase extends StatusMixin(SherpaElement) {
  /* ── Observed attributes ────────────────────────────────────── */

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-description",
      "data-helper",
      "data-layout",
      "disabled",
      "readonly",
      "required",
      "name",
      "value",
      "placeholder",
      "pattern",
      "minlength",
      "maxlength",
      "novalidate",
    ];
  }

  /* ── Typed dataset ────────────────────────────────────────────── */

  override get dataset(): SherpaInputDataset {
    return super.dataset as SherpaInputDataset;
  }

  /* ── Internal refs ──────────────────────────────────────────── */

  #labelEl: HTMLElement | null = null;
  #descriptionEl: HTMLElement | null = null;
  #helperEl: HTMLElement | null = null;
  #statusIndicatorIconEl: HTMLElement | null = null;
  #inputEl: NativeInputElement | null = null;
  #validationEl: HTMLElement | null = null;

  /* ── Lifecycle hooks ────────────────────────────────────────── */

  override async onRender(): Promise<void> {
    // The subclass template provides the raw control markup.
    // Wrap it in the standard label/description structure.
    await this.#buildWrapper();

    // Cache refs
    this.#labelEl = this.$<HTMLElement>(".input-label-text");
    this.#descriptionEl = this.$<HTMLElement>(".input-description-text");
    this.#helperEl = this.$<HTMLElement>(".input-helper-text");
    this.#statusIndicatorIconEl = this.$<HTMLElement>(".status-indicator-icon");
    this.#validationEl = this.$(".input-validation-message");
    this.#inputEl = this.getInputElement();

    // Apply initial attribute values
    this.#syncLabel();
    this.#syncDescription();
    this.#syncHelper();
    this.#syncStatusIndicator();
    this.#syncNativeAttrs();
    this.#syncValue();

    // Let subclass do its own post-render work
    await this.onInputRender();
  }

  override onConnect(): void {
    // Wire events on the native input
    this.#inputEl = this.getInputElement();
    if (this.#inputEl) {
      this.#inputEl.addEventListener("input", this.#onInput);
      this.#inputEl.addEventListener("change", this.#onChange);
      this.#inputEl.addEventListener("blur", this.#onBlur);
      this.#inputEl.addEventListener("invalid", this.#onInvalid);
    }
    this.onInputConnect();
  }

  override onDisconnect(): void {
    if (this.#inputEl) {
      this.#inputEl.removeEventListener("input", this.#onInput);
      this.#inputEl.removeEventListener("change", this.#onChange);
      this.#inputEl.removeEventListener("blur", this.#onBlur);
      this.#inputEl.removeEventListener("invalid", this.#onInvalid);
    }
    this.onInputDisconnect();
  }

  override onAttributeChanged(name: string, _oldValue: string | null, _newValue: string | null): void {
    switch (name) {
      case "data-label":
        this.#syncLabel();
        break;
      case "data-description":
        this.#syncDescription();
        break;
      case "data-helper":
        this.#syncHelper();
        break;
      case "data-status":
        this.#syncStatusIndicator();
        break;
      case "disabled":
      case "readonly":
      case "required":
      case "name":
      case "placeholder":
      case "pattern":
      case "minlength":
      case "maxlength":
        this.#syncNativeAttrs();
        if (name === "required") this.#syncLabel();
        break;
      case "value":
        this.#syncValue();
        break;
    }
  }

  /* ── Subclass hooks (override these, NOT onRender/onConnect) ── */

  /** Called after base onRender(). Override for type-specific element wiring. */
  async onInputRender(): Promise<void> {}

  /** Called after base onConnect(). Override for type-specific event wiring. */
  onInputConnect(): void {}

  /** Called on disconnect. Override for cleanup. */
  onInputDisconnect(): void {}

  /** Return the primary native <input> or <select> element. */
  getInputElement(): NativeInputElement | null {
    return this.$<NativeInputElement>('.input-field');
  }

  /* ── Public API ─────────────────────────────────────────────── */

  get label(): string {
    return this.dataset.label || "";
  }
  set label(v: string) {
    if (v) {
      this.dataset.label = v;
    } else {
      delete this.dataset.label;
    }
  }

  get description(): string {
    return this.dataset.description || "";
  }
  set description(v: string) {
    if (v) {
      this.dataset.description = v;
    } else {
      delete this.dataset.description;
    }
  }

  get helper(): string {
    return this.dataset.helper || "";
  }
  set helper(v: string) {
    if (v) {
      this.dataset.helper = v;
    } else {
      delete this.dataset.helper;
    }
  }

  get layout(): Orientation {
    return (this.dataset.layout as Orientation) || "vertical";
  }
  set layout(v: Orientation) {
    this.dataset.layout = v;
  }

  get value(): string {
    const el = this.getInputElement();
    return el ? el.value : this.getAttribute("value") || "";
  }
  set value(v: string) {
    const el = this.getInputElement();
    if (el) el.value = v ?? "";
    this.setAttribute("value", v ?? "");
  }

  get name(): string {
    return this.getAttribute("name") || "";
  }
  set name(v: string) {
    this.setAttribute("name", v);
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(v: boolean) {
    v ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  get readOnly(): boolean {
    return this.hasAttribute("readonly");
  }
  set readOnly(v: boolean) {
    v ? this.setAttribute("readonly", "") : this.removeAttribute("readonly");
  }

  get required(): boolean {
    return this.hasAttribute("required");
  }
  set required(v: boolean) {
    v ? this.setAttribute("required", "") : this.removeAttribute("required");
  }

  /** Focus the internal native control. */
  override focus(opts?: FocusOptions): void {
    const el = this.getInputElement();
    el ? el.focus(opts) : super.focus(opts);
  }

  /* ── Constraint Validation API (delegates to native input) ──── */

  /** Returns the native ValidityState of the inner control. */
  get validity(): ValidityState | undefined {
    return this.getInputElement()?.validity;
  }

  /** The native validation message string. */
  get validationMessage(): string {
    return this.getInputElement()?.validationMessage || "";
  }

  /** Returns true if the native control satisfies its constraints. */
  checkValidity(): boolean {
    return this.getInputElement()?.checkValidity() ?? true;
  }

  /** Like checkValidity but also updates the validation message UI. */
  reportValidity(): boolean {
    const el = this.getInputElement();
    if (!el) return true;
    // Run custom hook first (subclasses use setCustomValidity here)
    this.validate(el);
    const valid = el.checkValidity();
    this.#updateValidationMessage(el);
    return valid;
  }

  /**
   * Override in subclasses for custom constraint validation.
   * Call el.setCustomValidity(msg) to mark invalid, or '' to clear.
   * This is invoked on every blur before the native validity check.
   */
  validate(_el: NativeInputElement): void {
    // Default: no custom validation — native constraints are used.
  }

  /* ── Wrapper construction ───────────────────────────────────── */

  async #buildWrapper(): Promise<void> {
    // Collect existing control content from the subclass template
    // (everything that isn't <link> or <style>)
    const controlContent = document.createDocumentFragment();
    const children = [...this.shadow.childNodes].filter(
      (n) =>
        !(n instanceof HTMLLinkElement) && !(n instanceof HTMLStyleElement),
    );
    for (const child of children) controlContent.appendChild(child);

    // Clone the wrapper template (loaded once, cached for all instances)
    // and inject subclass content into .input-control before the indicator.
    const tpl = await loadWrapperTemplate();
    const wrapper = tpl.content.cloneNode(true) as DocumentFragment;
    const control = wrapper.querySelector(".input-control");
    const indicator = control?.querySelector(".status-indicator");
    if (control && indicator) {
      control.insertBefore(controlContent, indicator);
    }

    this.shadow.appendChild(wrapper);
  }

  /* ── Sync helpers ───────────────────────────────────────────── */

  #syncLabel(): void {
    if (!this.#labelEl) return;
    this.#labelEl.textContent = this.dataset.label || "";
    // Required asterisk visibility is handled by CSS:
    //   .input-required { display: none; }
    //   :host([required]) .input-required { display: inline; }
  }

  #syncDescription(): void {
    if (!this.#descriptionEl) return;
    this.#descriptionEl.textContent = this.dataset.description || "";
  }

  #syncHelper(): void {
    if (!this.#helperEl) return;
    this.#helperEl.textContent = this.dataset.helper || "";
  }

  /**
   * Update the status indicator icon in the input-control area.
   * The icon class is determined by the host's status attribute.
   */
  #syncStatusIndicator(): void {
    if (!this.#statusIndicatorIconEl) return;
    const status = this.status;
    const iconCls = status ? (this.constructor as any).statusIcons?.[status] || "" : "";
    if (iconCls) {
      this.#statusIndicatorIconEl.className = `status-indicator-icon ${iconCls}`;
    } else {
      this.#statusIndicatorIconEl.className = "status-indicator-icon";
    }
  }

  #syncNativeAttrs(): void {
    const el = this.getInputElement();
    if (!el) return;

    // Boolean attributes
    for (const attr of ["disabled", "readonly", "required"]) {
      this.hasAttribute(attr)
        ? el.setAttribute(attr, "")
        : el.removeAttribute(attr);
    }
    // Value attributes
    for (const attr of [
      "name",
      "placeholder",
      "pattern",
      "minlength",
      "maxlength",
    ]) {
      const val = this.getAttribute(attr);
      val !== null ? el.setAttribute(attr, val) : el.removeAttribute(attr);
    }
  }

  #syncValue(): void {
    const el = this.getInputElement();
    if (!el) return;
    const v = this.getAttribute("value") ?? "";
    if (el.value !== v) el.value = v;
  }

  /* ── Event forwarding ───────────────────────────────────────── */

  #onInput = (e: Event): void => {
    const target = e.target as NativeInputElement;
    this.dispatchEvent(
      new CustomEvent<InputChangeEventDetail>("input", {
        bubbles: true,
        composed: true,
        detail: { value: target.value },
      }),
    );
  };

  #onChange = (e: Event): void => {
    const target = e.target as NativeInputElement;
    this.dispatchEvent(
      new CustomEvent<InputChangeEventDetail>("change", {
        bubbles: true,
        composed: true,
        detail: { value: target.value },
      }),
    );
  };

  /* ── Validation ─────────────────────────────────────────────── */

  /**
   * Blur handler — run the subclass validate() hook, then populate
   * the validation message text from the native validationMessage.
   * The border colour change is handled entirely by CSS :user-invalid.
   * Also updates the status indicator icon for native validation errors.
   */
  #onBlur = (): void => {
    if (this.hasAttribute("novalidate")) return;
    const el = this.getInputElement();
    if (!el) return;

    // Let subclasses set custom validity (e.g. range checks)
    this.validate(el);
    this.#updateValidationMessage(el);

    // For native validation (no explicit status), show/hide the critical icon
    if (!this.dataset['status'] && this.#statusIndicatorIconEl) {
      const errorIconCls =
        (this.constructor as any).statusIcons?.critical ||
        (this.constructor as any).statusIcons?.error ||
        "fa-solid fa-circle-exclamation";
      if (!el.validity.valid) {
        this.#statusIndicatorIconEl.className = `status-indicator-icon ${errorIconCls}`;
      } else {
        this.#statusIndicatorIconEl.className = "status-indicator-icon";
      }
    }
  };

  /**
   * Suppress the browser's built-in validation tooltip so only
   * our custom message element is displayed.
   */
  #onInvalid = (e: Event): void => {
    e.preventDefault();
  };

  /**
   * Copy the browser's validationMessage into our shadow DOM element.
   * CSS shows/hides the element based on :user-invalid.
   */
  #updateValidationMessage(el: NativeInputElement): void {
    if (this.#validationEl) {
      this.#validationEl.textContent = el.validationMessage || "";
    }
  }
}
