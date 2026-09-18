/**
 * sherpa-progress-step-tracker — a row of steps showing where you are in a flow.
 *
 * Give it steps with populate([{ label, description? }]). Each step is marked
 * done, active, or to-do by comparing it to data-current-step, and CSS draws it
 * to match, with connector lines between the steps. JS only holds the steps and
 * the current position; the rest is CSS.
 *
 */
import { SherpaElement, coerceNum } from '../../core/sherpa-element.js';

export interface Step {
  label: string;
  description?: string;
}

export class SherpaProgressStepTracker extends SherpaElement {
  static override css = new URL('./sherpa-progress-step-tracker.css', import.meta.url);
  static override html = new URL('./sherpa-progress-step-tracker.html', import.meta.url);
  static override observed = ['data-current-step'];

  #steps: Step[] = [];

  override onRender(): void {
    // One delegated listener for the whole track — steps come and go, this stays.
    this.$('.steps')?.addEventListener('click', this.#onClick);
    if (this.#steps.length) this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-current-step') this.#applyStates();
  }

  /** populate([{ label, description? }]) — the step list. */
  protected override renderData(data: unknown): void {
    this.#steps = Array.isArray(data) ? (data as Step[]) : [];
    this.#render();
  }

  /** Set / read the step list programmatically. */
  get steps(): Step[] {
    return [...this.#steps];
  }
  set steps(value: Step[]) {
    this.#steps = Array.isArray(value) ? value : [];
    void this.rendered.then(() => this.#render());
  }

  /** 0-based index of the active step. */
  get currentStep(): number {
    return this.num('data-current-step', 0, { int: true });
  }
  set currentStep(index: number) {
    this.dataset['currentStep'] = String(index);
  }

  #render(): void {
    const track = this.$('.steps');
    const stepTpl = this.$<HTMLTemplateElement>('template.step-tpl');
    const connTpl = this.$<HTMLTemplateElement>('template.connector-tpl');
    if (!track || !stepTpl) return;

    track.replaceChildren();
    this.#steps.forEach((step, i) => {
      // The label, description and index are declared on the prototype. The
      // NUMBER is not a field — it is the position counted from one — and the
      // connector is a second prototype woven BETWEEN the steps, which is
      // structure rather than content.
      const item = this.cloneItem('template.step-tpl', step, i);
      if (!item) return;
      item.querySelector('.number')!.textContent = String(i + 1);
      track.appendChild(item);
      if (i < this.#steps.length - 1 && connTpl) {
        track.appendChild(connTpl.content.firstElementChild!.cloneNode(true));
      }
    });
    this.#applyStates();
  }

  /** Reflect current-step onto each node as data-state (CSS styles it). */
  #applyStates(): void {
    const current = this.currentStep;
    for (const node of this.$$('.step')) {
      const i = coerceNum(node.dataset['index'], -1, { int: true });
      node.dataset['state'] = i < current ? 'done' : i === current ? 'active' : 'todo';
      // Expose the active step to assistive tech (WAI-ARIA current step).
      if (i === current) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    }
  }

  #onClick = (event: Event): void => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('.step');
    if (!node) return;
    // A .step without a data-index used to emit `index: NaN`. -1 is the sentinel,
    // and a step that names no index is not a click worth reporting.
    const index = coerceNum(node.dataset['index'], -1, { int: true });
    if (index < 0 || index >= this.#steps.length) return;
    this.emit('step-click', { index, label: this.#steps[index]?.label ?? '' });
  };
}

customElements.define('sherpa-progress-step-tracker', SherpaProgressStepTracker);
