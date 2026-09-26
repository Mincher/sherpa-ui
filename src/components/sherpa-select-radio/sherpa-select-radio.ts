/**
 * sherpa-select-radio — a labelled wrapper around a native radio input.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { MIRRORED_CONTROL_ATTRS as MIRRORED } from '../../core/ui/shared-constants.js';

export class SherpaSelectRadio extends SherpaElement {
  static override css = new URL('./sherpa-select-radio.css', import.meta.url);
  static override html = new URL('./sherpa-select-radio.html', import.meta.url);
  static override props = {
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
  } as const;

  // A host label names this. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.control';
  static override observed = ['checked', ...MIRRORED];

  /** The native radio. */
  #control: HTMLInputElement | null = null;

  override onRender(): void {
    this.#control = this.$<HTMLInputElement>('.control');
    this.#syncState();
    this.#control?.addEventListener('change', this.#onChange);
  }

  override onChange(): void {
    this.#syncState();
  }

  /** Mirror native attributes + checked from host onto the inner control. */
  #syncState(): void {
    const c = this.#control;
    if (!c) return;
    // The shared loop; `value` is a property, set below.
    // TRAP T-mirroring-skips-value
    this.mirrorAttrs(c, MIRRORED);
    c.value = this.getAttribute('value') ?? '';
    c.checked = this.hasAttribute('checked');
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  get checked(): boolean {
    return this.#control?.checked ?? this.hasAttribute('checked');
  }
  set checked(v: boolean) {
    this.toggleAttribute('checked', v);
    if (this.#control) this.#control.checked = v;
  }

  get value(): string {
    return this.#control?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    this.setAttribute('value', v);
    if (this.#control) this.#control.value = v;
  }

  checkValidity(): boolean {
    return this.#control?.checkValidity() ?? true;
  }

  override focus(options?: FocusOptions): void {
    this.#control?.focus(options);
  }

  /** Native radio grouping does NOT cross shadow roots — deselect siblings here. */
  #onChange = (): void => {
    const c = this.#control;
    if (!c) return;
    this.toggleAttribute('checked', c.checked);
    if (c.checked) this.#deselectGroup();
    this.emit('change', { checked: c.checked, value: this.value });
  };

  /** Uncheck sibling radios sharing this `name`, document-wide. */
  #deselectGroup(): void {
    const name = this.getAttribute('name');
    if (!name) return;
    const group = document.querySelectorAll<SherpaSelectRadio>(
      `sherpa-select-radio[name="${CSS.escape(name)}"]`
    );
    for (const radio of group) {
      if (radio !== this) radio.checked = false;
    }
  }
}

customElements.define('sherpa-select-radio', SherpaSelectRadio);
