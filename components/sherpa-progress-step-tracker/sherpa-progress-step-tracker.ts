/**
 * @element sherpa-progress-step-tracker
 * @category content
 * @description Unified step progress indicator for both wizard flows and status
 *   timelines. Horizontal by default; add data-orientation="vertical" for a
 *   vertical timeline. Drive navigation with nextStep(), previousStep(), and
 *   goToStep(). Mark steps with explicit status values for passive tracking
 *   (in-progress, warning, error) alongside positionally-derived active and
 *   completed states.
 *
 * @attr {number}  data-current-step=1       — Active step (1-based); 0 = no active step
 * @attr {enum}    data-orientation           — horizontal (default) | vertical
 * @attr {enum}    data-linear                — true | false — enforce sequential navigation
 * @attr {enum}    data-show-step-numbers     — true | false (default: true)
 * @attr {enum}    data-density               — compact | comfortable
 * @attr {enum}    data-labels                — none (hides all step labels)
 * @attr {string}  data-heading               — Header text (shows header when present)
 * @attr {string}  data-percentage            — Completion text, e.g. "60% Complete"
 * @attr {string}  data-src-json              — URL to load steps JSON: { steps: [...] }
 *
 * @fires step-change
 *   bubbles: true, composed: true
 *   detail: { currentStep: number, previousStep: number, label: string }
 * @fires step-click
 *   bubbles: true, composed: true
 *   detail: { step: number, label: string }
 *
 * @method setSteps(steps)         — Set steps: [{ label, sublabel?, timestamp?, status?,
 *                                     completed?, error?, disabled? }]
 * @method nextStep()              — Advance to the next step
 * @method previousStep()          — Go back one step
 * @method goToStep(n)             — Jump to step n (1-based)
 * @method completeStep(n)         — Mark step n as completed
 * @method setStepError(n, bool)   — Mark/clear an error on step n
 *
 * @prop {number}  currentStep     — Getter/setter for data-current-step
 * @prop {boolean} linear          — Getter/setter for data-linear
 * @prop {boolean} showStepNumbers — Getter/setter for data-show-step-numbers
 * @prop {string}  heading         — Getter/setter for data-heading
 * @prop {string}  percentage      — Getter/setter for data-percentage
 * @prop {Array}   steps           — Current steps array (getter only)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

/** Valid explicit step statuses. Positional states (active, completed) are
 *  derived automatically from currentStep unless overridden here. */
export type StepStatus = 'default' | 'in-progress' | 'success' | 'warning' | 'critical';

/** A single step descriptor. */
export interface StepData {
  label?: string;
  sublabel?: string;
  timestamp?: string;
  /** Explicit status. Takes precedence over positional active/completed logic
   *  for all values except "default". "success" maps to the completed visual;
   *  "critical" maps to the error visual. */
  status?: StepStatus;
  /** Shorthand for status="success". */
  completed?: boolean;
  /** Shorthand for status="critical". */
  error?: boolean;
  disabled?: boolean;
}

export class SherpaProgressStepTracker extends SherpaElement {

  static override get cssUrl(): string  { return new URL('./sherpa-progress-step-tracker.css',  import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-progress-step-tracker.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-current-step',
      'data-linear',
      'data-show-step-numbers',
      'data-heading',
      'data-percentage',
    ];
  }

  /* ── State ────────────────────────────────────────────────── */

  #steps: StepData[] = [];
  #currentStep = 1;
  #ready = false;
  #visited = new Set<number>();
  #srcLoaded = '';

  public els = this.cacheElements({
    header:     '.tracker-header',
    headingEl:  '.heading-text',
    percentEl:  '.percentage-text',
    stepsEl:    '.tracker-steps',
  });

  /* ── Lifecycle ────────────────────────────────────────────── */

  override async onRender(): Promise<void> {
    const src = this.dataset['srcJson'];
    if (src) {
      try {
        const data = await fetch(src).then(r => r.json()) as unknown;
        this.#steps = (data as { steps?: StepData[] }).steps ?? [];
        this.#srcLoaded = src;
      } catch (e) {
        console.warn('sherpa-progress-step-tracker: failed to load data-src-json', e);
      }
    }
    this.#currentStep = parseInt(this.dataset['currentStep'] ?? '') || 1;
    if (this.#currentStep > 0) this.#visited.add(this.#currentStep);
    this.#syncHeader();
    this.#renderSteps();
    this.#ready = true;
  }

  override onAttributeChanged(name: string, _old: string | null, newValue: string | null): void {
    if (!this.#ready) return;
    switch (name) {
      case 'data-current-step': {
        const n = parseInt(newValue ?? '') || 1;
        if (n !== this.#currentStep) { this.#currentStep = n; this.#renderSteps(); }
        break;
      }
      case 'data-heading':
      case 'data-percentage':
        this.#syncHeader();
        break;
      case 'data-src-json':
        // Base class fetches the URL; onJsonData() re-renders.
        break;
      default:
        this.#renderSteps();
    }
  }

  override onJsonData(data: unknown): void {
    const current = this.dataset['srcJson'];
    if (current && current === this.#srcLoaded) { this.#srcLoaded = ''; return; }
    this.#steps = (data as { steps?: StepData[] }).steps ?? [];
    if (this.#ready) this.#renderSteps();
  }

  /* ── Private: sync ────────────────────────────────────────── */

  #syncHeader(): void {
    if (this.els.headingEl)  this.els.headingEl.textContent  = this.dataset['heading']    ?? '';
    if (this.els.percentEl)  this.els.percentEl.textContent  = this.dataset['percentage'] ?? '';
  }

  /* ── Private: render ──────────────────────────────────────── */

  #renderSteps(): void {
    const container = this.els.stepsEl;
    if (!container) return;
    container.replaceChildren();

    const showNumbers = this.dataset['showStepNumbers'] !== 'false';
    const itemTpl  = this.$<HTMLTemplateElement>('template.step-item-tpl');
    const connTpl  = this.$<HTMLTemplateElement>('template.step-connector-tpl');
    if (!itemTpl) return;

    this.#steps.forEach((step, i) => {
      const num = i + 1;

      const frag = itemTpl.content.cloneNode(true) as DocumentFragment;
      const item = frag.querySelector<HTMLElement>('.step-item');
      if (!item) return;

      // Effective status
      const status = this.#effectiveStatus(step, num);
      item.dataset['status'] = status;
      item.dataset['step']   = String(num);

      if (this.#visited.has(num)) item.dataset['visited'] = '';
      if (step.disabled) {
        item.setAttribute('disabled', '');
        item.setAttribute('aria-disabled', 'true');
      } else {
        item.setAttribute('aria-disabled', 'false');
      }
      item.setAttribute('aria-selected', status === 'active' ? 'true' : 'false');

      // Step number
      const numberEl = frag.querySelector('.step-number');
      if (showNumbers && numberEl) numberEl.textContent = String(num);

      // Labels
      const labelEl = frag.querySelector('.step-label');
      if (labelEl) labelEl.textContent = step.label ?? `Step ${num}`;

      const sublabelEl = frag.querySelector('.step-sublabel');
      if (sublabelEl) sublabelEl.textContent = step.sublabel ?? '';

      const tsEl = frag.querySelector('.step-timestamp');
      if (tsEl) tsEl.textContent = step.timestamp ?? '';

      if (!step.disabled) {
        item.addEventListener('click', () => { this.#onStepClick(num); });
      }

      container.appendChild(frag);

      // Connector between steps
      if (i < this.#steps.length - 1 && connTpl) {
        const connFrag = connTpl.content.cloneNode(true) as DocumentFragment;
        const conn = connFrag.querySelector<HTMLElement>('.step-connector');
        if (conn && num < this.#currentStep) conn.dataset['completed'] = '';
        container.appendChild(connFrag);
      }
    });
  }

  /** Compute the display status for a step, giving explicit step.status
   *  precedence over positional active/completed logic. */
  #effectiveStatus(step: StepData, num: number): string {
    if (step.error   || step.status === 'critical')    return 'error';
    if (step.status  === 'warning')                    return 'warning';
    if (step.status  === 'in-progress')                return 'in-progress';
    if (step.completed || step.status === 'success')   return 'completed';
    // Positional (only when no explicit override and currentStep is set)
    if ((!step.status || step.status === 'default') && this.#currentStep > 0) {
      if (num === this.#currentStep) return 'active';
      if (num < this.#currentStep)   return 'completed';
    }
    return 'default';
  }

  #onStepClick(num: number): void {
    const step = this.#steps[num - 1];
    this.dispatchEvent(new CustomEvent('step-click', {
      bubbles: true, composed: true,
      detail: { step: num, label: step?.label },
    }));
    if (this.dataset['linear'] === 'true') {
      const canNav =
        num <= this.#currentStep ||
        (num === this.#currentStep + 1 && this.#steps[this.#currentStep - 1]?.completed);
      if (!canNav) return;
    }
    this.goToStep(num);
  }

  /* ── Public properties ────────────────────────────────────── */

  get currentStep(): number { return this.#currentStep; }
  set currentStep(v: number) { this.dataset['currentStep'] = String(v); }

  get linear(): boolean { return this.dataset['linear'] === 'true'; }
  set linear(v: boolean) { this.dataset['linear'] = v ? 'true' : 'false'; }

  get showStepNumbers(): boolean { return this.dataset['showStepNumbers'] !== 'false'; }
  set showStepNumbers(v: boolean) { this.dataset['showStepNumbers'] = v ? 'true' : 'false'; }

  get heading(): string { return this.dataset['heading'] ?? ''; }
  set heading(v: string) {
    if (v) { this.dataset['heading'] = v; } else { delete this.dataset['heading']; }
  }

  get percentage(): string { return this.dataset['percentage'] ?? ''; }
  set percentage(v: string) {
    if (v) { this.dataset['percentage'] = v; } else { delete this.dataset['percentage']; }
  }

  get steps(): StepData[] { return [...this.#steps]; }

  /* ── Public methods ───────────────────────────────────────── */

  setSteps(steps: StepData[]): void {
    this.#steps = steps.map(s => ({
      label:     s.label,
      sublabel:  s.sublabel ?? '',
      timestamp: s.timestamp ?? '',
      status:    s.status,
      completed: s.completed ?? false,
      error:     s.error ?? false,
      disabled:  s.disabled ?? false,
    }));
    if (this.#ready) this.#renderSteps();
  }

  nextStep(): void {
    if (this.#currentStep < this.#steps.length) this.goToStep(this.#currentStep + 1);
  }

  previousStep(): void {
    if (this.#currentStep > 1) this.goToStep(this.#currentStep - 1);
  }

  goToStep(num: number): void {
    if (num < 1 || num > this.#steps.length) return;
    const prev = this.#currentStep;
    this.#currentStep = num;
    this.#visited.add(num);
    this.dataset['currentStep'] = String(num);
    this.#renderSteps();
    this.dispatchEvent(new CustomEvent('step-change', {
      bubbles: true, composed: true,
      detail: { currentStep: num, previousStep: prev, label: this.#steps[num - 1]?.label },
    }));
  }

  completeStep(num: number): void {
    const step = this.#steps[num - 1];
    if (!step) return;
    step.completed = true;
    step.error = false;
    if (this.#ready) this.#renderSteps();
  }

  setStepError(num: number, hasError = true): void {
    const step = this.#steps[num - 1];
    if (!step) return;
    step.error = hasError;
    if (hasError) step.completed = false;
    if (this.#ready) this.#renderSteps();
  }
}

customElements.define('sherpa-progress-step-tracker', SherpaProgressStepTracker);
