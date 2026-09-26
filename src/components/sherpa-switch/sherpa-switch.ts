/**
 * sherpa-switch — an on/off toggle. A native checkbox in a label does the work.
 *
 * @prop {boolean} checked  — whether the switch is on (delegates to the inner input)
 * @prop {boolean} disabled — disabled state (reflects host attr + inner input)
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaSwitch extends SherpaElement {
  static override css = new URL('./sherpa-switch.css', import.meta.url);
  static override html = new URL('./sherpa-switch.html', import.meta.url);

  // A host label names this. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.input';
  static override observed = [
    'checked',
    'disabled',
    // CSS-only; declared for the typed door.
    'data-type',
  ];

  /** The native checkbox the switch wraps. */
  #input(): HTMLInputElement | null {
    return this.$<HTMLInputElement>('.input');
  }

  override onRender(): void {
    this.#syncState();
    // The native change bubbles inside the shadow root but is not composed.
    this.#input()?.addEventListener('change', this.#onChange);
  }

  override onChange(): void {
    this.#syncState();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get checked(): boolean {
    return this.#input()?.checked ?? this.hasAttribute('checked');
  }
  set checked(value: boolean) {
    const input = this.#input();
    if (input) input.checked = value;
    this.toggleAttribute('checked', value);
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(value: boolean) {
    this.toggleAttribute('disabled', value);
    const input = this.#input();
    if (input) input.disabled = value;
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** Mirror checked + disabled host → inner control. */
  #syncState(): void {
    const input = this.#input();
    if (!input) return;
    input.checked = this.hasAttribute('checked');
    input.disabled = this.hasAttribute('disabled');
  }

  /** Mirror the checkbox onto `checked` and report it. */
  #onChange = (): void => {
    const checked = this.#input()?.checked ?? false;
    this.toggleAttribute('checked', checked);
    this.emit('change', { checked });
  };
}

customElements.define('sherpa-switch', SherpaSwitch);
