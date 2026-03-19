/**
 * sherpa-stepper.js
 * SherpaStepper — Horizontal/vertical step progress indicator extending SherpaElement.
 *
 * HTML template defines wrapper structure and cloning prototypes.
 * JS populates steps from data; CSS handles all visual states.
 *
 * @element sherpa-stepper
 *
 * @attr {number}  data-current-step       - Active step (1-based, default 1)
 * @attr {string}  data-linear             - "true" | "false" — steps must complete in order
 * @attr {string}  data-show-step-numbers  - "true" | "false" — show step numbers (default "true")
 * @attr {string}  data-src                - URL to load steps JSON
 *
 * @method setSteps(steps)  / nextStep() / previousStep() / goToStep(n) / completeStep(n) / setStepError(n, bool)
 * @fires step-change — current step changed
 * @fires step-click  — a step header was clicked
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaStepper extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-stepper.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-stepper.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-current-step",
      "data-linear",
      "data-show-step-numbers",
      "data-src",
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #steps = [];
  #currentStep = 1;
  #ready = false;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  async onRender() {
    await this.#loadInitialData();
    this.#currentStep = parseInt(this.dataset.currentStep) || 1;
    this.#render();
    this.#ready = true;
  }

  onAttributeChanged(name, _old, newValue) {
    if (!this.#ready) return;
    if (name === "data-current-step") {
      const n = parseInt(newValue) || 1;
      if (n !== this.#currentStep) {
        this.#currentStep = n;
        this.#render();
      }
    } else if (name === "data-src") {
      this.#loadDataFromSrc(newValue);
    } else {
      this.#render();
    }
  }

  /* ── Data loading ─────────────────────────────────────────────── */

  async #loadInitialData() {
    if (this.#steps.length > 0) return;
    const src = this.dataset.src;
    if (src) {
      try {
        const data = await fetch(src).then((r) => r.json());
        this.#steps = data.steps || [];
      } catch (e) {
        console.warn("sherpa-stepper: failed to load data-src:", e);
      }
    }
  }

  async #loadDataFromSrc(src) {
    if (!src) return;
    try {
      const data = await fetch(src).then((r) => r.json());
      this.#steps = data.steps || [];
      this.#render();
    } catch (e) {
      console.warn("sherpa-stepper: failed to load data-src:", e);
    }
  }

  /* ── DOM rendering ────────────────────────────────────────────── */

  #render() {
    const header = this.$(".stepper-header");
    if (!header) return;
    header.replaceChildren();

    const showNumbers = this.dataset.showStepNumbers !== "false";
    const itemTpl = this.$("template.step-item-tpl");
    const connTpl = this.$("template.step-connector-tpl");

    this.#steps.forEach((step, i) => {
      const num = i + 1;
      const isActive = num === this.#currentStep;
      const isCompleted = step.completed || num < this.#currentStep;
      const hasError = step.error;
      const isDisabled = step.disabled;

      const frag = itemTpl.content.cloneNode(true);
      const item = frag.querySelector(".step-item");
      if (isActive) item.dataset.active = "";
      if (isCompleted) item.dataset.completed = "";
      if (hasError) item.dataset.error = "";
      if (isDisabled) item.setAttribute("disabled", "");
      item.setAttribute("aria-selected", isActive ? "true" : "false");
      item.setAttribute("aria-disabled", isDisabled ? "true" : "false");
      item.dataset.step = num;

      // Step number — visible when neither completed nor error (CSS handles hiding)
      const numberEl = frag.querySelector(".step-number");
      if (showNumbers) numberEl.textContent = num;

      const label = frag.querySelector(".step-label");
      label.textContent = step.label || `Step ${num}`;

      // Sublabel — CSS hides via :empty when blank
      frag.querySelector(".step-sublabel").textContent = step.sublabel || "";

      if (!isDisabled) {
        item.addEventListener("click", () => this.#onStepClick(num));
      }

      header.appendChild(frag);

      if (i < this.#steps.length - 1) {
        const connFrag = connTpl.content.cloneNode(true);
        const conn = connFrag.querySelector(".step-connector");
        if (num < this.#currentStep) conn.dataset.completed = "";
        header.appendChild(connFrag);
      }
    });
  }

  #onStepClick(num) {
    const step = this.#steps[num - 1];
    this.dispatchEvent(
      new CustomEvent("step-click", {
        bubbles: true,
        composed: true,
        detail: { step: num, label: step?.label },
      }),
    );

    if (this.dataset.linear === "true") {
      const canNav =
        num <= this.#currentStep ||
        (num === this.#currentStep + 1 &&
          this.#steps[this.#currentStep - 1]?.completed);
      if (!canNav) return;
    }
    this.goToStep(num);
  }

  /* ── Public properties ────────────────────────────────────────── */

  get currentStep() {
    return this.#currentStep;
  }
  set currentStep(v) {
    this.dataset.currentStep = v;
  }

  get linear() {
    return this.dataset.linear === "true";
  }
  set linear(v) {
    this.dataset.linear = v ? "true" : "false";
  }

  get showStepNumbers() {
    return this.dataset.showStepNumbers !== "false";
  }
  set showStepNumbers(v) {
    this.dataset.showStepNumbers = v ? "true" : "false";
  }

  get dataSrc() {
    return this.dataset.src || "";
  }
  set dataSrc(v) {
    this.dataset.src = v;
  }

  get steps() {
    return [...this.#steps];
  }

  /* ── Public methods ───────────────────────────────────────────── */

  setSteps(steps) {
    this.#steps = steps.map((s) => ({
      label: s.label,
      sublabel: s.sublabel || "",
      completed: s.completed || false,
      error: s.error || false,
      disabled: s.disabled || false,
    }));
    if (this.#ready) this.#render();
  }

  nextStep() {
    if (this.#currentStep < this.#steps.length)
      this.goToStep(this.#currentStep + 1);
  }
  previousStep() {
    if (this.#currentStep > 1) this.goToStep(this.#currentStep - 1);
  }

  goToStep(num) {
    if (num < 1 || num > this.#steps.length) return;
    const prev = this.#currentStep;
    this.#currentStep = num;
    this.dataset.currentStep = num;
    this.#render();
    this.dispatchEvent(
      new CustomEvent("step-change", {
        bubbles: true,
        composed: true,
        detail: {
          currentStep: num,
          previousStep: prev,
          label: this.#steps[num - 1]?.label,
        },
      }),
    );
  }

  completeStep(num) {
    if (num < 1 || num > this.#steps.length) return;
    this.#steps[num - 1].completed = true;
    this.#steps[num - 1].error = false;
    if (this.#ready) this.#render();
  }

  setStepError(num, hasError = true) {
    if (num < 1 || num > this.#steps.length) return;
    this.#steps[num - 1].error = hasError;
    if (hasError) this.#steps[num - 1].completed = false;
    if (this.#ready) this.#render();
  }
}

customElements.define("sherpa-stepper", SherpaStepper);
