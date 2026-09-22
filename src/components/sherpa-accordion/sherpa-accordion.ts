/**
 * sherpa-accordion — a disclosure card over native <details> / <summary>.
 *
 * The native `toggle` is not composed, so app code cannot see it — this
 * re-dispatches it as a composed component event.
 *
 * @prop {boolean} open — whether the disclosure is expanded (delegates to <details>)
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaAccordion extends SherpaElement {
  static override css = new URL('./sherpa-accordion.css', import.meta.url);
  static override html = new URL('./sherpa-accordion.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.heading-text' },
    'data-description': { type: 'string', kind: 'content', to: '.description-text' },
  } as const;

  static override observed = ['open'];

  #details(): HTMLDetailsElement | null {
    return this.$<HTMLDetailsElement>('.root');
  }

  override onRender(): void {
    const details = this.#details();
    if (!details) return;
    if (this.hasAttribute('open')) details.open = true;
    details.addEventListener('toggle', this.#onToggle);
  }

  override onChange(name: string): void {
    if (name === 'open') {
      const details = this.#details();
      if (details) details.open = this.hasAttribute('open');
    }
  }

  /** Mirrors `<details open>`. */
  get open(): boolean {
    return this.#details()?.open ?? this.hasAttribute('open');
  }
  set open(value: boolean) {
    const details = this.#details();
    if (details) details.open = value;
    this.toggleAttribute('open', value);
  }

  #onToggle = (): void => {
    const open = this.#details()?.open ?? false;
    this.toggleAttribute('open', open);
    this.emit('toggle', { open });
  };
}

customElements.define('sherpa-accordion', SherpaAccordion);
