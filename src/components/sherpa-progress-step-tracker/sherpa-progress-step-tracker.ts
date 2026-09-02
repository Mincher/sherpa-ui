/**
 * sherpa-progress-step-tracker — a row of steps showing where you are in a flow.
 *
 * Give it steps with populate([{ label, description? }]). Each step is marked
 * done, active, or to-do by comparing it to data-current-step, and CSS draws it
 * to match, with connector lines between the steps. JS only holds the steps and
 * the current position; the rest is CSS.
 *
 * @fires step-click  detail: { index: number, label: string }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

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
    return Number(this.dataset['currentStep'] ?? '0') || 0;
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
      const node = stepTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      node.dataset['index'] = String(i);
      node.querySelector('.number')!.textContent = String(i + 1);
      node.querySelector('.label')!.textContent = step.label;
      node.querySelector('.description')!.textContent = step.description ?? '';
      track.appendChild(node);
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
      const i = Number(node.dataset['index']);
      node.dataset['state'] = i < current ? 'done' : i === current ? 'active' : 'todo';
    }
  }

  #onClick = (event: Event): void => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('.step');
    if (!node) return;
    const index = Number(node.dataset['index']);
    this.emit('step-click', { index, label: this.#steps[index]?.label ?? '' });
  };
}

customElements.define('sherpa-progress-step-tracker', SherpaProgressStepTracker);
