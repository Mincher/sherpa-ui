/**
 * sherpa-accordion — a disclosure card over native <details> / <summary>.
 *
 * The native `toggle` is not composed, so app code cannot see it — this
 * reports it as `accordion-open` or `accordion-close`.
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
    'data-icon': { type: 'string', kind: 'content', to: '.icon', as: 'icon' },
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
    /* An ACTION in the summary row is a control, not a handle. Without this a
       click on it opens or shuts the disclosure as well as doing its own job.
       TRAP T-an-accordion-action-is-not-a-toggle */
    this.$('.actions')?.addEventListener('click', this.#onActionClick);
  }

  #onActionClick = (event: Event): void => {
    /* ONLY for a click that really is on the summary row. A control here may
       open a POPOVER, whose card is in the top layer and outside this element
       — but the click on a row inside it still passes through this listener,
       and `preventDefault()` then ate the checkbox's own tick and let the
       popover light-dismiss with nothing chosen.
       TRAP T-an-accordion-action-is-not-a-toggle */
    const path = event.composedPath();
    /* A control here may open a POPOVER whose card is in the top layer. Its
       rows still pass through this listener, and `preventDefault()` ate the
       checkbox's own tick — the Add menu opened and nothing could be picked.
       A popover is not the summary row, whatever the path says. */
    if (path.some((n) => n instanceof HTMLElement && n.matches?.('[popover]'))) return;
    const summary = this.$('.header');
    if (!path.some((n) => n === summary)) return;
    event.preventDefault();
  };

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

customElements.define('sherpa-accordion', SherpaAccordion);
