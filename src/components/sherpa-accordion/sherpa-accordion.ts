/**
 * sherpa-accordion — a disclosure card backed by native <details> / <summary>.
 *
 * Native-first (naming standard D2/D12): the open/closed state IS the native
 * <details open> attribute — the <summary> gives us the button role, keyboard
 * (Enter / Space) and focus for free, and clicking it toggles with no JS. This
 * file is thin: it renders the `data-heading` label, mirrors the `open` property
 * onto the inner <details>, and re-dispatches the native `toggle` event as a
 * composed `toggle` (the native one bubbles inside the shadow root but is NOT
 * composed, so app code wouldn't otherwise see it).
 *
 * @element sherpa-accordion
 * @attr {string}  data-heading     — the summary title (a slotted [slot=heading] overrides it)
 * @attr {string}  data-description — optional secondary line under the title (a slotted [slot=description] overrides it)
 * @attr {boolean} open             — native disclosure state (read/write; drives [open] visuals)
 * @attr {enum}    data-status      — status colour cascade (critical | warning | success | info | urgent)
 *
 * @fires toggle — every open/close. bubbles + composed. detail: { open: boolean }
 *
 * @prop {boolean} open — whether the disclosure is expanded (delegates to <details>)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

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
    // Adopt any pre-set host state onto the real control.
    if (this.hasAttribute('open')) details.open = true;
    // Re-dispatch the native toggle as a composed component event.
    details.addEventListener('toggle', this.#onToggle);
  }

  override onChange(name: string): void {
    if (name === 'open') {
      const details = this.#details();
      if (details) details.open = this.hasAttribute('open');
    }
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get open(): boolean {
    return this.#details()?.open ?? this.hasAttribute('open');
  }
  set open(value: boolean) {
    const details = this.#details();
    if (details) details.open = value;
    this.toggleAttribute('open', value);
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** Write data-heading into the label span (skipped when a heading slot is used). */

  /** Write data-description into the secondary line (skipped when a description slot is used). */

  #onToggle = (): void => {
    const open = this.#details()?.open ?? false;
    this.toggleAttribute('open', open);
    this.emit('toggle', { open });
  };
}

customElements.define('sherpa-accordion', SherpaAccordion);
