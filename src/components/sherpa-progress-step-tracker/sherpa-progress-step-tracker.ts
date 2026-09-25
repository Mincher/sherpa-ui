/**
 * sherpa-progress-step-tracker — a row of steps showing where you are in a flow.
 *
 * JS holds the steps and the current index; CSS draws done / active / to-do.
 *
 * Map:
 * - Step — one step: a label and an optional description
 */
import { SherpaElement, coerceNum } from '../../core/ui/sherpa-element.js';

export interface Step {
  label: string;
  description?: string;
}

export class SherpaProgressStepTracker extends SherpaElement {
  static override css = new URL('./sherpa-progress-step-tracker.css', import.meta.url);
  static override html = new URL('./sherpa-progress-step-tracker.html', import.meta.url);
  static override observed = ['data-current-step'];

  /** The steps, as populated. */
  #steps: Step[] = [];

  override onRender(): void {
    // Delegated, because the steps are replaced on every render.
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

  /** Draw each step and the connector between them. */
  #render(): void {
    const track = this.$('.steps');
    const stepTpl = this.$<HTMLTemplateElement>('template.step-tpl');
    const connTpl = this.$<HTMLTemplateElement>('template.connector-tpl');
    if (!track || !stepTpl) return;

    track.replaceChildren();
    this.#steps.forEach((step, i) => {
      // The number is position, not a field, so the prototype cannot declare it.
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

  /** Reflect current-step onto each node as data-state; CSS styles it. */
  #applyStates(): void {
    const current = this.currentStep;
    for (const node of this.$$('.step')) {
      const i = coerceNum(node.dataset['index'], -1, { int: true });
      node.dataset['state'] = i < current ? 'done' : i === current ? 'active' : 'todo';
      if (i === current) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    }
  }

  /** A step was clicked: report its index. */
  #onClick = (event: Event): void => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('.step');
    if (!node) return;
    // -1 sentinel: a .step with no data-index must not emit `index: NaN`.
    const index = coerceNum(node.dataset['index'], -1, { int: true });
    if (index < 0 || index >= this.#steps.length) return;
    this.emit('step-click', { index, label: this.#steps[index]?.label ?? '' });
  };
}

customElements.define('sherpa-progress-step-tracker', SherpaProgressStepTracker);
