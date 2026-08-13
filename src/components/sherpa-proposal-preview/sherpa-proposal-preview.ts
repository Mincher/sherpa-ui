/**
 * sherpa-proposal-preview — a card wrapping a set of proposed operations.
 *
 * Two ways to fill it:
 *   1. Slot sherpa-proposal-op children into the default slot (authored markup).
 *   2. populate([{ op, label?, target? }]) — data-driven rows stamped from the
 *      <template class="op-tpl"> prototype (the only structural DOM it creates).
 *
 * The title + rationale are synced text; the decision footer offers built-in
 * accept-all / reject-all buttons (or custom controls via the decision slot with
 * data-action="accept" | "reject"). A delegated click handler maps either to the
 * canonical proposal-accept / proposal-reject events.
 *
 * @fires proposal-accept — detail: { ops: ProposalOpData[] }
 * @fires proposal-reject — detail: {}
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** A structured proposal op read from (or written to) a sherpa-proposal-op child. */
export interface ProposalOpData {
  op: string;
  label?: string;
  target?: string;
}

export class SherpaProposalPreview extends SherpaElement {
  static override css = new URL('./sherpa-proposal-preview.css', import.meta.url);
  static override html = new URL('./sherpa-proposal-preview.html', import.meta.url);
  static override observed = ['data-title', 'data-rationale'];

  override onRender(): void {
    this.#sync();
    // Decision controls live in the shadow (built-in) or the light-DOM decision
    // slot; both bubble to the host. Match by data-action and emit canonical events.
    this.addEventListener('click', this.#onDecisionClick);
  }

  override onChange(): void {
    this.#sync();
  }

  /** populate([{ op, label?, target? }]) — stamp data-driven op rows. */
  protected override renderData(data: unknown): void {
    const list = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    const container = this.$('.ops');
    const tpl = this.$<HTMLTemplateElement>('template.op-tpl');
    if (!container || !tpl) return;

    // Remove only previously stamped rows; leave authored light-DOM children.
    for (const stamped of this.querySelectorAll(':scope > sherpa-proposal-op[data-stamped]')) {
      stamped.remove();
    }
    for (const raw of list) {
      if (raw == null || typeof raw !== 'object') continue;
      const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      row.dataset['stamped'] = '';
      row.dataset['op'] = String(raw['op'] ?? 'update');
      if (raw['label'] != null) row.dataset['label'] = String(raw['label']);
      if (raw['target'] != null) row.dataset['target'] = String(raw['target']);
      this.appendChild(row);
    }
  }

  /** Read the slotted + stamped sherpa-proposal-op children as structured data. */
  getOps(): ProposalOpData[] {
    return [...this.querySelectorAll<HTMLElement>(':scope > sherpa-proposal-op')].map((el) => {
      const data: ProposalOpData = { op: el.dataset['op'] ?? 'update' };
      const label = el.dataset['label'] ?? (el.textContent ?? '').trim();
      if (label) data.label = label;
      if (el.dataset['target'] != null) data.target = el.dataset['target'];
      return data;
    });
  }

  #sync(): void {
    this.#text('.title', this.dataset['title']);
    this.#text('.rationale', this.dataset['rationale']);
  }

  #text(sel: string, value: string | undefined): void {
    const el = this.$(sel);
    if (el) el.textContent = value ?? '';
  }

  #onDecisionClick = (event: Event): void => {
    // Built-in buttons live in the shadow (retargeted to the host), slotted
    // controls in the light DOM — composedPath() surfaces either as the origin.
    const control = event
      .composedPath()
      .find(
        (n): n is HTMLElement => n instanceof HTMLElement && n.hasAttribute('data-action'),
      );
    const action = control?.dataset['action'];
    if (action === 'accept') this.emit('proposal-accept', { ops: this.getOps() });
    else if (action === 'reject') this.emit('proposal-reject', {});
  };
}

customElements.define('sherpa-proposal-preview', SherpaProposalPreview);
