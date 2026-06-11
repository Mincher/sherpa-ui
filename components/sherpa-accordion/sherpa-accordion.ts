/**
 * sherpa-accordion.js
 * SherpaAccordion — Collapsible content panel using native <details>/<summary>.
 *
 * The browser handles expand/collapse natively. JS only syncs the
 * data-label and data-icon attributes into the shadow DOM.
 *
 * @element sherpa-accordion
 * @category container
 * @description Collapsible content section using the native <details>/<summary> element. Use to
 *   progressively reveal secondary content without navigating away or opening a dialog. Multiple
 *   stacked accordions form a standard disclosure list (FAQ, settings groups). The browser
 *   handles expand/collapse natively; JS only syncs the heading text and icon into the shadow DOM.
 *
 * @attr {string}  data-label  — Heading text for the summary row
 * @attr {string}  data-icon   — FontAwesome unicode for optional leading icon
 * @attr {boolean} open        — Native details open/expanded state
 * @attr {boolean} disabled    — Prevents interaction
 *
 * @slot          — Default slot for panel content revealed when expanded
 * @slot actions  — Trailing action buttons in the summary row
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaAccordion extends SherpaElement {

  static override get cssUrl(): string  { return new URL('./sherpa-accordion.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-accordion.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-label', 'data-icon', 'disabled'];
  }

  public els = this.cacheElements({
    label: '.trigger-label',
    icon: { selector: '.trigger-icon', type: HTMLElement },
    chevronBtn: '.chevron-btn',
    details: { selector: 'details', type: HTMLDetailsElement }
  });

  #bound = false;

  override onRender(): void {
    if (!this.#bound) {
      this.els.details?.addEventListener('toggle', this.#onToggle);
      this.#bound = true;
    }

    this.#syncLabel();
    this.#syncIcon();
    this.#syncOpen();
    this.#syncDisabled();
  }

  override onAttributeChanged(name: string): void {
    switch (name) {
      case 'data-label': this.#syncLabel(); break;
      case 'data-icon':  this.#syncIcon(); break;
      case 'disabled':   this.#syncDisabled(); break;
    }
  }

  /* ── Sync ─────────────────────────────────────────────────────── */

  #syncLabel(): void {
    if (this.els.label) this.els.label.textContent = this.dataset["label"] || '';
  }

  #syncDisabled(): void {
    if (!this.els.chevronBtn) return;
    this.els.chevronBtn.toggleAttribute('disabled', this.hasAttribute('disabled'));
  }

  #syncIcon(): void {
    if (!this.els.icon) return;
    // data-icon accepts either a Font Awesome class string
    // (e.g. "fa-solid fa-star") or a single FA unicode codepoint.
    const v = this.dataset["icon"] || '';
    if (/\bfa-/.test(v)) {
      this.els.icon.className = `trigger-icon ${v}`.trim();
      this.els.icon.textContent = '';
      this.els.icon.style.fontFamily = '';
    } else {
      this.els.icon.className = 'trigger-icon';
      this.els.icon.textContent = v;
      this.els.icon.style.fontFamily = v ? '"Font Awesome 6 Free"' : '';
      this.els.icon.style.fontWeight = v ? '900' : '';
    }
  }

  /** Mirror the host `open` attribute to the inner <details>. */
  #syncOpen(): void {
    if (this.els.details) this.els.details.open = this.hasAttribute('open');
  }

  /* ── Events ───────────────────────────────────────────────────── */

  /** Keep the host `open` attribute in sync with the native toggle. */
  #onToggle = (): void => {
    if (this.els.details) this.toggleAttribute('open', this.els.details.open);
  };
}

customElements.define('sherpa-accordion', SherpaAccordion);
