/**
 * @element sherpa-stepper
 * @category content
 * @description Horizontal/vertical step progress indicator.
 *   Steps populated from data; CSS handles all visual states.
 *
 * @attr {number}  [data-current-step=1]      — Active step (1-based)
 * @attr {enum}    [data-linear]               — true | false — steps must complete in order
 * @attr {enum}    [data-show-step-numbers]     — true | false (default: true)
 * @attr {string}  [data-src-json]                  — URL to load steps JSON
 * @attr {enum}    [data-template]             — default | timeline (vertical timeline layout)
 *
 * @fires step-change
 *   bubbles: true, composed: true
 *   detail: { currentStep: number, previousStep: number, label: string }
 * @fires step-click
 *   bubbles: true, composed: true
 *   detail: { step: number, label: string }
 *
 * @method setSteps(steps)         — Set steps array: [{ label, description? }]
 * @method nextStep()              — Advance to next step
 * @method previousStep()          — Go back to previous step
 * @method goToStep(num)           — Jump to specific step number
 * @method completeStep(num)       — Mark a step as completed
 * @method setStepError(num, bool) — Mark/unmark a step as errored
 *
 * @prop {number}  currentStep     — Getter/setter for data-current-step
 * @prop {boolean} linear          — Getter/setter for data-linear
 * @prop {boolean} showStepNumbers — Getter/setter for data-show-step-numbers
 * @prop {string}  dataSrcJson     — Getter/setter for data-src-json
 * @prop {Array}   steps           — Current steps array (getter-only)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/** A single step descriptor. */
interface StepData {
  label?: string;
  sublabel?: string;
  timestamp?: string;
  completed?: boolean;
  error?: boolean;
  disabled?: boolean;
}

export class SherpaStepper extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("./sherpa-stepper.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-stepper.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-current-step",
      "data-linear",
      "data-show-step-numbers",
      "data-template",
    ];
  }

  override get templateId(): string {
    return this.dataset["template"] === 'timeline' ? 'timeline' : 'default';
  }

  /* ── State ───────────────────────────────────────────── */

  #steps: StepData[] = [];
  #currentStep = 1;
  #ready = false;
  #visited = new Set<number>();
  /** URL last loaded synchronously in onRender() — used to skip the base
   *  class's post-connect #fetchJson so the same URL isn't fetched twice. */
  #srcLoaded = "";

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override async onRender(): Promise<void> {
    const src = this.dataset["srcJson"];
    if (src) {
      try {
        const data = await fetch(src).then((r) => r.json());
        this.#steps = data.steps || [];
        this.#srcLoaded = src; // Prevent base class post-connect trigger from double-loading
      } catch (e) {
        console.warn("sherpa-stepper: failed to load data-src-json:", e);
      }
    }
    this.#currentStep = parseInt(this.dataset["currentStep"] || "") || 1;
    this.#visited.add(this.#currentStep);
    this.#render();
    this.#ready = true;
  }

  override onAttributeChanged(name: string, _old: string | null, newValue: string | null): void {
    if (!this.#ready) return;
    if (name === "data-current-step") {
      const n = parseInt(newValue || "") || 1;
      if (n !== this.#currentStep) {
        this.#currentStep = n;
        this.#render();
      }
    } else if (name === "data-src-json") {
      // Base class handles the fetch; onJsonData() will re-render.
      // Don't call #render() here — steps haven't arrived yet.
    } else if (name === "data-template") {
      this.renderTemplate(this.templateId).then(() => this.#render());
    } else {
      this.#render();
    }
  }

  /* ── Data loading ─────────────────────────────────────────────── */

  /**
   * Called by the base class after `data-src-json` is fetched.
   * Skips if `onRender()` already loaded this URL (initial bootstrap path)
   * to prevent a double fetch.
   * @param {{ steps: object[] }} data
   */
  override onJsonData(data: any) {
    const current = this.dataset["srcJson"];
    if (current && current === this.#srcLoaded) {
      this.#srcLoaded = ""; // Reset so future attribute changes are processed
      return;
    }
    this.#steps = data.steps || [];
    if (this.#ready) this.#render();
  }

  /* ── DOM rendering ────────────────────────────────────────────── */

  #render() {
    const header = this.$(".stepper-header");
    if (!header) return;
    header.replaceChildren();

    const showNumbers = this.dataset["showStepNumbers"] !== "false";
    const itemTpl = this.$<HTMLTemplateElement>("template.step-item-tpl");
    const connTpl = this.$<HTMLTemplateElement>("template.step-connector-tpl");
    if (!itemTpl) return;

    this.#steps.forEach((step, i) => {
      const num = i + 1;
      const isActive = num === this.#currentStep;
      const isCompleted = step.completed || num < this.#currentStep;
      const hasError = step.error;
      const isDisabled = step.disabled;
      const isVisited = this.#visited.has(num);

      const frag = itemTpl.content.cloneNode(true) as DocumentFragment;
      const item = frag.querySelector<HTMLElement>(".step-item");
      if (!item) return;
      if (isActive) item.dataset["active"] = "";
      if (isCompleted) item.dataset["completed"] = "";
      if (hasError) item.dataset["error"] = "";
      if (isVisited) item.dataset["visited"] = "";
      if (isDisabled) item.setAttribute("disabled", "");
      item.setAttribute("aria-selected", isActive ? "true" : "false");
      item.setAttribute("aria-disabled", isDisabled ? "true" : "false");
      item.dataset["step"] = String(num);

      // Step number — visible when neither completed nor error (CSS handles hiding)
      const numberEl = frag.querySelector(".step-number");
      if (showNumbers && numberEl) numberEl.textContent = String(num);

      const label = frag.querySelector(".step-label");
      if (label) label.textContent = step.label || `Step ${num}`;

      // Sublabel — CSS hides via :empty when blank
      const sublabelEl = frag.querySelector(".step-sublabel");
      if (sublabelEl) sublabelEl.textContent = step.sublabel || "";

      // Optional timestamp (timeline template). The element is present in
      // both templates but hidden by default in the default template via CSS.
      const tsEl = frag.querySelector(".step-timestamp");
      if (tsEl) tsEl.textContent = step.timestamp || "";

      if (!isDisabled) {
        item.addEventListener("click", () => this.#onStepClick(num));
      }

      header.appendChild(frag);

      if (i < this.#steps.length - 1 && connTpl) {
        const connFrag = connTpl.content.cloneNode(true) as DocumentFragment;
        const conn = connFrag.querySelector<HTMLElement>(".step-connector");
        if (conn && num < this.#currentStep) conn.dataset["completed"] = "";
        header.appendChild(connFrag);
      }
    });
  }

  #onStepClick(num: number) {
    const step = this.#steps[num - 1];
    this.dispatchEvent(
      new CustomEvent("step-click", {
        bubbles: true,
        composed: true,
        detail: { step: num, label: step?.label },
      }),
    );

    if (this.dataset["linear"] === "true") {
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
  set currentStep(v: number) {
    this.dataset["currentStep"] = String(v);
  }

  get linear() {
    return this.dataset["linear"] === "true";
  }
  set linear(v) {
    this.dataset["linear"] = v ? "true" : "false";
  }

  get showStepNumbers() {
    return this.dataset["showStepNumbers"] !== "false";
  }
  set showStepNumbers(v) {
    this.dataset["showStepNumbers"] = v ? "true" : "false";
  }

  get dataSrcJson() {
    return this.dataset["srcJson"] || "";
  }
  set dataSrcJson(v) {
    this.dataset["srcJson"] = v;
  }

  get steps() {
    return [...this.#steps];
  }

  /* ── Public methods ───────────────────────────────────────────── */

  setSteps(steps: StepData[]) {
    this.#steps = steps.map((s) => ({
      label: s.label,
      sublabel: s.sublabel || "",
      timestamp: s.timestamp || "",
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

  goToStep(num: number) {
    if (num < 1 || num > this.#steps.length) return;
    const prev = this.#currentStep;
    this.#currentStep = num;
    this.#visited.add(num);
    this.dataset["currentStep"] = String(num);
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

  completeStep(num: number) {
    const step = this.#steps[num - 1];
    if (!step) return;
    step.completed = true;
    step.error = false;
    if (this.#ready) this.#render();
  }

  setStepError(num: number, hasError = true) {
    const step = this.#steps[num - 1];
    if (!step) return;
    step.error = hasError;
    if (hasError) step.completed = false;
    if (this.#ready) this.#render();
  }
}

customElements.define("sherpa-stepper", SherpaStepper);
