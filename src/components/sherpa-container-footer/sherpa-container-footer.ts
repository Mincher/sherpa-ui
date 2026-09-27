/**
 * sherpa-container-footer — the footer strip inside a container.
 *
 * CSS owns the alignment and hides the footer when nothing is slotted. Its one
 * job in JS: a host that reports `data-dirty` gets its commit and revert pair
 * turned off while nothing has changed. TRAP T-the-footer-owns-nothing-to-save
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaContainerFooter extends SherpaElement {
  static override css = new URL('./sherpa-container-footer.css', import.meta.url);
  static override html = new URL('./sherpa-container-footer.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-align': { type: 'enum', kind: 'style', values: ['between', 'end', 'start', 'stretch'] },
    /* The HOST reports whether anything changed. Absent, the pair is left alone. */
    'data-dirty': { type: 'enum', kind: 'style', values: ['true', 'false'] },
  } as const;

  override onRender(): void {
    this.$('slot')?.addEventListener('slotchange', () => this.#syncPair());
  }

  override onChange(name: string): void {
    if (name === 'data-dirty') this.#syncPair();
  }

  /** Turn the DECLARED pair — `data-footer="commit"` and `"revert"` — off while
   *  the host says nothing changed. Never guessed from a label. Once the host
   *  stops reporting, only what THIS footer turned off comes back on. */
  #syncPair(): void {
    const dirty = this.dataset['dirty'];
    const slot = this.$<HTMLSlotElement>('slot');
    for (const el of slot?.assignedElements({ flatten: true }) ?? []) {
      if (!el.matches('[data-footer="commit"], [data-footer="revert"]')) continue;
      const off = dirty === 'false';
      if (off) this.#turnedOff.add(el);
      else if (!this.#turnedOff.delete(el)) continue;
      el.toggleAttribute('disabled', off);
    }
  }

  /** The pair this footer turned off itself. */
  #turnedOff = new Set<Element>();
}

customElements.define('sherpa-container-footer', SherpaContainerFooter);
