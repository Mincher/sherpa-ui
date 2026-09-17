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
 * dialog, keeps `open` in sync, renders data-icon/data-heading, wires the toolbar
 * buttons to events, and re-dispatches the native `close` event as a composed one.
 *
 * @prop {boolean} open — whether the panel is open (delegates to <dialog>)
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// COMPOSED, as Figma instances them (Overlay Panel 1003:33705 = Container Header
// + content + Container Footer). Imported for their side effect: the custom
// elements must be defined before this template stamps them.
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaOverlayPanel extends SherpaElement {
  static override css = new URL('./sherpa-overlay-panel.css', import.meta.url);
  static override html = new URL('./sherpa-overlay-panel.html', import.meta.url);
  // The title and icon are MIRRORED onto the composed header rather than written
  // into this shadow tree — the header owns those elements now, and one component
  // must not reach into another's internals.
  static override observed = ['data-heading', 'data-icon', 'data-collapsed', 'data-collapsible', 'data-dismissible', 'open'];

  #dialog(): HTMLDialogElement | null {
    return this.$<HTMLDialogElement>('.root');
  }

  override onRender(): void {
    const dialog = this.#dialog();
    if (!dialog) return;
    this.#syncHeader();
    if (this.hasAttribute('open')) dialog.show();
    dialog.addEventListener('close', this.#onClose);
    // The composed header owns the collapse toggle and the close button, and
    // announces both with its OWN events. They are re-emitted here under the
    // panel's names, so this component's public API is unchanged by the fact
    // that its internals are now composed.
    this.$('.header')?.addEventListener('header-collapse', this.#onCollapse);
    this.$('.header')?.addEventListener('header-dismiss', this.#onCloseClick);
    // `button-click`, not `click` — a sherpa-button suppresses its own event when
    // disabled, where a raw click listener would still fire on the host.
    this.$('.expand')?.addEventListener('button-click', this.#onExpand);
    this.$('.external')?.addEventListener('button-click', this.#onExternal);
  }

  override onChange(name: string): void {
    if (name !== 'open') this.#syncHeader();
    if (name === 'open') {
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

  /**
   * Mirror the panel's own attributes onto the composed header.
   *
   * The header is a component, not markup this file owns, so it is configured
   * through its public `data-*` API exactly as an app would configure it.
   */
  #syncHeader(): void {
    const header = this.$('.header');
    if (!header) return;
    // A STRAIGHT FORWARD, no translation. The panel used to call this
    // it by another name and rename it to `data-heading` on the way to the header —
    // two names for one thing, with a mapping step to keep them in step.
    // NAMING-STANDARD D9: primary text is `data-heading` everywhere.
    for (const name of ['data-heading', 'data-icon', 'data-collapsed', 'data-collapsible', 'data-dismissible'] as const) {
      const value = this.getAttribute(name);
      if (value == null) header.removeAttribute(name);
      else header.setAttribute(name, value);
    }
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
