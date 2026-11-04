/**
 * sherpa-accordion — a disclosure card over native <details> / <summary>.
 *
 * The native `toggle` is not composed, so app code cannot see it — this
 * reports it as `accordion-open` or `accordion-close`.
 *
 * @prop {boolean} open — whether the disclosure is expanded (delegates to <details>)
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

export class SherpaAccordion extends SherpaElement {
  static override css = new URL('./sherpa-accordion.css', import.meta.url);
  static override html = new URL('./sherpa-accordion.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-icon': { type: 'string', kind: 'content' },
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

  override onConnect(): void {
    // The titles leave the actions their room: they are laid over the row. TRAP T-an-accordion-action-is-not-a-toggle
    const actions = this.$('.actions');
    if (!actions) return;
    this.#room?.disconnect();
    this.#room = new ResizeObserver(() => this.$('.header')?.style.setProperty('--_actions', `${actions.offsetWidth}px`));
    this.#room.observe(actions);
  }

  override onDisconnect(): void {
    this.#room?.disconnect();
    this.#room = null;
  }

  /** Watches the actions' width, for the room the titles leave them. */
  #room: ResizeObserver | null = null;

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
    this.emit(open ? 'accordion-open' : 'accordion-close');
  };
}

define('sherpa-accordion', SherpaAccordion);
