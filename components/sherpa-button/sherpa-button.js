/**
 * sherpa-button.js
 * Multi-template button web component.
 *
 * Four templates (selected via data-type → get templateId()):
 *   default       — Standard button: icon(s) + label + badge
 *   icon          — Icon-only square button
 *   button-select — Button + native <select> side by side (control group)
 *   icon-select   — Icon-only <select> (action picker / menu trigger)
 *
 * The button is self-managing for its own visual state and broadcasts
 * events so parent components (filter-bar, container) can orchestrate.
 *
 * Events dispatched:
 *   buttonclick  — Trigger button clicked. detail: { }
 *   selectchange — Select value changed.  detail: { value, values }
 *   chipremove   — Close button clicked.   detail: { }
 *   change       — Re-dispatched native change (bubbles, does not compose)
 *
 * Attributes:
 *   data-type, data-label, data-variant, data-size, data-active,
 *   data-status, data-icon-start, data-icon-end, data-icon-weight,
 *   data-closeable, data-count, disabled
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/* ── Component ─────────────────────────────────────────────────── */

export class SherpaButton extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-button.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-button.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-variant",
      "data-size",
      "data-active",
      "disabled",
      "data-icon-start",
      "data-icon-end",
      "data-closeable",
      "data-count",
    ];
  }

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    return this.dataset.type || "default";
  }

  /* ── Private refs ─────────────────────────────────────────────── */

  #triggerEl = null;
  #labelEl = null;
  #iconStartEl = null;
  #iconEndEl = null;
  #badgeEl = null;
  #selectEl = null;
  #closeEl = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#triggerEl = this.$(".trigger");
    this.#labelEl = this.$(".label");
    this.#iconStartEl = this.$(".icon-start");
    this.#iconEndEl = this.$(".icon-end");
    this.#badgeEl = this.$(".badge");
    this.#selectEl = this.$(".select");
    this.#closeEl = this.$(".close");

    // Default variant for standard buttons (not button-select / icon-select)
    const type = this.dataset.type;
    if (!type && !this.dataset.variant) {
      this.dataset.variant = "primary";
    }

    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
    }

    this.#syncLabel();
    this.#syncIcons();
    this.#syncBadge();
    this.#initLightDomOptions();
  }

  onConnect() {
    this.#triggerEl?.addEventListener("click", this.#onTriggerClick);
    this.#selectEl?.addEventListener("change", this.#onSelectChange);
    this.#closeEl?.addEventListener("click", this.#onCloseClick);
  }

  onDisconnect() {
    this.#triggerEl?.removeEventListener("click", this.#onTriggerClick);
    this.#selectEl?.removeEventListener("change", this.#onSelectChange);
    this.#closeEl?.removeEventListener("click", this.#onCloseClick);
  }

  onAttributeChanged(name, _old, newValue) {
    switch (name) {
      case "disabled":
        this.setAttribute("aria-disabled", newValue !== null ? "true" : "false");
        if (this.#selectEl) this.#selectEl.disabled = newValue !== null;
        break;

      case "data-label":
        this.#syncLabel();
        break;

      case "data-icon-start":
      case "data-icon-end":
        this.#syncIcons();
        break;

      case "data-count":
        this.#syncBadge();
        break;
    }
  }

  /* ── Label sync ───────────────────────────────────────────────── */

  #syncLabel() {
    if (!this.#labelEl) return;
    this.#labelEl.textContent = this.dataset.label ?? "";
  }

  /* ── Icons sync ───────────────────────────────────────────────── */

  #syncIcons() {
    if (this.#iconStartEl) {
      this.#iconStartEl.textContent = this.dataset.iconStart ?? "";
    }
    if (this.#iconEndEl) {
      this.#iconEndEl.textContent = this.dataset.iconEnd ?? "";
    }
  }

  /* ── Badge sync ───────────────────────────────────────────────── */

  #syncBadge() {
    if (!this.#badgeEl) return;
    this.#badgeEl.textContent = this.dataset.count ?? "";
  }

  /* ── Light DOM options import (icon-select) ───────────────────── */

  /**
   * For icon-select: import <option>, <optgroup>, <hr> from
   * light DOM into the shadow <select>. Consumers declare options
   * declaratively as children of the host element.
   */
  #initLightDomOptions() {
    if (this.dataset.type !== "icon-select" || !this.#selectEl) return;
    for (const el of this.querySelectorAll(
      ":scope > option, :scope > optgroup, :scope > hr",
    )) {
      this.#selectEl.appendChild(el.cloneNode(true));
    }
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #onTriggerClick = (_e) => {
    if (this.disabled) return;
    this.dispatchEvent(
      new CustomEvent("buttonclick", {
        bubbles: true,
        composed: true,
        detail: {},
      }),
    );
  };

  #onSelectChange = (_e) => {
    if (this.disabled) return;
    const values = Array.from(
      this.#selectEl.selectedOptions,
      (o) => o.value,
    );
    this.dispatchEvent(
      new CustomEvent("selectchange", {
        bubbles: true,
        composed: true,
        detail: {
          value: this.#selectEl.value,
          values,
        },
      }),
    );
    // Re-dispatch change on host (native change doesn't cross shadow boundary)
    this.dispatchEvent(new Event("change", { bubbles: true }));
  };

  #onCloseClick = (e) => {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("chipremove", {
        bubbles: true,
        composed: true,
        detail: {},
      }),
    );
  };

  /* ── Public API ──────────────────────────────────────────────── */

  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(v) {
    v ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  get active() {
    return this.hasAttribute("data-active");
  }
  set active(val) {
    this.toggleAttribute("data-active", !!val);
  }

  get label() {
    return this.dataset.label ?? "";
  }
  set label(val) {
    this.dataset.label = val;
  }

  /** The native <select> element in shadow DOM (button-select / icon-select). */
  get selectElement() {
    return this.#selectEl;
  }

  /** Current select value (single-select). */
  get value() {
    return this.#selectEl?.value ?? "";
  }
  set value(v) {
    if (this.#selectEl) this.#selectEl.value = v;
  }

  /**
   * Programmatically set options on the select.
   * @param {Array<{value, text, selected?, disabled?}>} options
   */
  setOptions(options) {
    if (!this.#selectEl) return;
    this.#selectEl.replaceChildren();
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o.value ?? "";
      opt.textContent = o.text ?? o.value ?? "";
      if (o.selected) opt.selected = true;
      if (o.disabled) opt.disabled = true;
      this.#selectEl.appendChild(opt);
    }
  }

  /**
   * Programmatically set option groups on the select.
   * @param {Array<{label, options: Array<{value, text}>}>} groups
   */
  setOptionGroups(groups) {
    if (!this.#selectEl) return;
    this.#selectEl.replaceChildren();
    for (const g of groups) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = g.label ?? "";
      for (const o of g.options || []) {
        const opt = document.createElement("option");
        opt.value = o.value ?? "";
        opt.textContent = o.text ?? o.value ?? "";
        if (o.selected) opt.selected = true;
        optgroup.appendChild(opt);
      }
      this.#selectEl.appendChild(optgroup);
    }
  }
}

customElements.define("sherpa-button", SherpaButton);
