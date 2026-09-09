/**
 * sherpa-overlay-panel — a NON-modal floating panel on native <dialog>.
 *
 * Native-first (naming standard D2/D12): opened with dialog.show() (not
 * showModal()), so it floats in the top layer WITHOUT a backdrop, focus-trap or
 * ESC-to-close — the page behind stays interactive. Chosen over the Popover API
 * because it shares sherpa-dialog's exact structure + imperative show()/close()
 * lifecycle (the only difference being show vs showModal).
 *
 * Matches the Figma "Overlay Panel" (node 1003:33705): the panel renders its own
 * rich header chrome — a lead icon + link-style title + a description/metadata
 * row (slot) + a trailing toolbar of collapse / expand / external / close
 * buttons — plus a body slot and a footer slot. This file opens/closes the
 * dialog, keeps `open` in sync, renders data-icon/data-title, wires the toolbar
 * buttons to events, and re-dispatches the native `close` event as a composed one.
 *
 * @element sherpa-overlay-panel
 * @attr {string}  data-icon      — glyph before the title (shows the icon slot area)
 * @attr {string}  data-title     — link-style header title text
 * @attr {boolean} open           — read reflects dialog.open; set → show()/close()
 * @attr {boolean} data-collapsed — collapsed state (body/footer folded; toggle reflects it)
 * @attr {boolean} data-collapsible — show the collapse toggle
 * @attr {boolean} data-expandable  — show the expand button
 * @attr {boolean} data-external    — show the external-link button
 * @attr {boolean} data-dismissible — show the close button
 * @attr {enum}    data-status    — status colour cascade (critical | warning | success | info | urgent)
 *
 * @fires panel-collapse — the collapse toggle was pressed. bubbles + composed. detail: { collapsed: boolean }
 * @fires panel-expand   — the expand button was pressed. bubbles + composed. detail: { }
 * @fires panel-external — the external-link button was pressed. bubbles + composed. detail: { }
 * @fires close          — the panel closed (close()). bubbles + composed. detail: { }
 *
 * @prop {boolean} open — whether the panel is open (delegates to <dialog>)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaOverlayPanel extends SherpaElement {
  static override css = new URL('./sherpa-overlay-panel.css', import.meta.url);
  static override html = new URL('./sherpa-overlay-panel.html', import.meta.url);
  static override observed = ['data-icon', 'data-title', 'data-collapsed', 'open'];

  #dialog(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('.root');
  }

  override onRender(): void {
    const dialog = this.#dialog();
    if (!dialog) return;
    this.#syncTitle();
    this.#syncCollapsed();
    if (this.hasAttribute('open')) dialog.show();
    dialog.addEventListener('close', this.#onClose);
    this.$('.collapse')?.addEventListener('click', this.#onCollapse);
    this.$('.expand')?.addEventListener('click', this.#onExpand);
    this.$('.external')?.addEventListener('click', this.#onExternal);
    this.$('.close')?.addEventListener('click', this.#onCloseClick);
  }

  override onChange(name: string): void {
    if (name === 'data-title') this.#syncTitle();
    else if (name === 'data-collapsed') this.#syncCollapsed();
    else if (name === 'open') {
      if (this.hasAttribute('open')) this.show();
      else this.close();
    }
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get open(): boolean {
    return this.#dialog()?.open ?? this.hasAttribute('open');
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.close();
  }

  /** Open as a non-modal floating panel (no backdrop, no focus trap). */
  show(): void {
    const dialog = this.#dialog();
    if (dialog && !dialog.open) dialog.show();
    this.toggleAttribute('open', true);
  }

  /** Close the panel. */
  close(): void {
    const dialog = this.#dialog();
    if (dialog?.open) dialog.close();
    this.toggleAttribute('open', false);
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #syncTitle(): void {
    const label = this.$('.title');
    if (label) label.textContent = this.dataset.title ?? '';
  }

  #syncCollapsed(): void {
    const collapsed = this.hasAttribute('data-collapsed');
    this.$('.collapse')?.setAttribute('aria-expanded', String(!collapsed));
  }

  #onClose = (): void => {
    this.toggleAttribute('open', false);
    this.emit('close', {});
  };

  #onCloseClick = (): void => {
    this.close();
  };

  #onCollapse = (): void => {
    const collapsed = !this.hasAttribute('data-collapsed');
    this.toggleAttribute('data-collapsed', collapsed);
    this.emit('panel-collapse', { collapsed });
  };

  #onExpand = (): void => {
    this.emit('panel-expand', {});
  };

  #onExternal = (): void => {
    this.emit('panel-external', {});
  };
}

customElements.define('sherpa-overlay-panel', SherpaOverlayPanel);
