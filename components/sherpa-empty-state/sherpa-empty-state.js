/**
 * @element sherpa-empty-state
 * @description Empty-state placeholder with illustration, heading, description,
 *   and action slots.
 *
 * @attr {string}  [data-label]        — Heading text
 * @attr {string}  [data-description]  — Description text
 * @attr {string}  [data-illustration]  — Built-in illustration name
 * @attr {string}  [data-small-print]   — Footer small-print text
 *
 * @slot illustration — Custom illustration content
 * @slot heading      — Custom heading
 * @slot description  — Custom description
 * @slot (default)    — Arbitrary content between description and actions
 * @slot actions      — CTA buttons
 * @slot footer       — Footer content / small print
 *
 * @prop {string} heading      — Getter/setter for data-label
 * @prop {string} description  — Getter/setter for data-description
 * @prop {string} illustration — Getter/setter for data-illustration
 * @prop {string} smallPrint   — Getter/setter for data-small-print
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/* ── Built-in illustration SVGs ──────────────────────────────── */

const ILLUSTRATIONS = {
  empty: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="50" stroke="currentColor" stroke-width="2" stroke-dasharray="8 4" opacity="0.3"/>
    <rect x="35" y="40" width="50" height="40" rx="4" stroke="currentColor" stroke-width="2" opacity="0.5"/>
    <line x1="45" y1="55" x2="75" y2="55" stroke="currentColor" stroke-width="2" opacity="0.3"/>
    <line x1="45" y1="65" x2="65" y2="65" stroke="currentColor" stroke-width="2" opacity="0.3"/>
  </svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="50" cy="50" r="30" stroke="currentColor" stroke-width="3" opacity="0.5"/>
    <line x1="72" y1="72" x2="95" y2="95" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
    <path d="M40 50 L45 55 L60 40" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
  </svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <path d="M20 35 L20 85 L100 85 L100 45 L55 45 L45 35 Z" stroke="currentColor" stroke-width="2" fill="none" opacity="0.5"/>
    <line x1="40" y1="60" x2="80" y2="60" stroke="currentColor" stroke-width="2" opacity="0.3"/>
    <line x1="40" y1="70" x2="70" y2="70" stroke="currentColor" stroke-width="2" opacity="0.3"/>
  </svg>`,
  data: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <ellipse cx="60" cy="40" rx="40" ry="15" stroke="currentColor" stroke-width="2" opacity="0.5"/>
    <path d="M20 40 L20 80 Q60 100 100 80 L100 40" stroke="currentColor" stroke-width="2" fill="none" opacity="0.5"/>
    <ellipse cx="60" cy="60" rx="40" ry="15" stroke="currentColor" stroke-width="2" opacity="0.3"/>
  </svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="2" opacity="0.5"/>
    <line x1="45" y1="45" x2="75" y2="75" stroke="currentColor" stroke-width="3" opacity="0.5"/>
    <line x1="75" y1="45" x2="45" y2="75" stroke="currentColor" stroke-width="3" opacity="0.5"/>
  </svg>`,
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="2" opacity="0.5"/>
    <path d="M40 60 L55 75 L85 45" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
  </svg>`,
};

/* ── Component ─────────────────────────────────────────────────── */

export class SherpaEmptyState extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-empty-state.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-empty-state.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-description",
      "data-illustration",
      "data-small-print",
    ];
  }

  /* ── Cached element refs ──────────────────────────────────────── */

  #titleEl = null;
  #descriptionEl = null;
  #illustrationDefault = null;
  #smallPrintText = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#titleEl = this.$(".sherpa-empty-state__title");
    this.#descriptionEl = this.$(".sherpa-empty-state__description");
    this.#illustrationDefault = this.$(
      ".sherpa-empty-state__illustration-default",
    );
    this.#smallPrintText = this.$(".sherpa-empty-state__small-print-text");

    this.#syncAll();
  }

  onConnect() {
    // Slot listeners are auto-wired by SherpaElement.
    // Visibility is handled entirely by CSS using data-has-* and data-* selectors.
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-label":
        this.#updateHeading();
        break;
      case "data-description":
        this.#updateDescription();
        break;
      case "data-illustration":
        this.#updateIllustration();
        break;
      case "data-small-print":
        this.#updateSmallPrint();
        break;
    }
  }

  /* ── Public getters / setters ─────────────────────────────────── */

  get heading() {
    return this.dataset.label || "";
  }
  set heading(v) {
    v ? (this.dataset.label = v) : delete this.dataset.label;
  }

  get description() {
    return this.dataset.description || "";
  }
  set description(v) {
    v ? (this.dataset.description = v) : delete this.dataset.description;
  }

  get illustration() {
    return this.dataset.illustration || "";
  }
  set illustration(v) {
    v ? (this.dataset.illustration = v) : delete this.dataset.illustration;
  }

  get smallPrint() {
    return this.dataset.smallPrint || "";
  }
  set smallPrint(v) {
    v ? (this.dataset.smallPrint = v) : delete this.dataset.smallPrint;
  }

  /* ── Sync helpers ─────────────────────────────────────────────── */

  #syncAll() {
    this.#updateHeading();
    this.#updateDescription();
    this.#updateIllustration();
    this.#updateSmallPrint();
  }

  #updateHeading() {
    if (this.#titleEl) this.#titleEl.textContent = this.heading;
  }

  #updateDescription() {
    if (this.#descriptionEl) this.#descriptionEl.textContent = this.description;
  }

  #updateIllustration() {
    if (this.#illustrationDefault) {
      this.#illustrationDefault.innerHTML =
        ILLUSTRATIONS[this.illustration] || "";
    }
  }

  #updateSmallPrint() {
    if (this.#smallPrintText)
      this.#smallPrintText.textContent = this.smallPrint;
  }
}

customElements.define("sherpa-empty-state", SherpaEmptyState);
