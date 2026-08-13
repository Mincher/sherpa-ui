/**
 * sherpa-proposal-op — a single proposed operation row inside a proposal preview.
 *
 * Nearly attribute-only: the glyph and its colour are pure CSS off data-op
 * (create | update | delete). JS only syncs the data-label text into its shadow
 * node — a slotted body overrides it via CSS. Not used standalone.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaProposalOp extends SherpaElement {
  static override css = new URL('./sherpa-proposal-op.css', import.meta.url);
  static override html = new URL('./sherpa-proposal-op.html', import.meta.url);
  static override observed = ['data-label'];

  override onRender(): void {
    this.#syncLabel();
  }

  override onChange(): void {
    this.#syncLabel();
  }

  #syncLabel(): void {
    const el = this.$('.text');
    if (el) el.textContent = this.dataset['label'] ?? '';
  }
}

customElements.define('sherpa-proposal-op', SherpaProposalOp);
