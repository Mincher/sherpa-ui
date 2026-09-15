/**
 * sherpa-container-header — the header strip inside a container.
 *
 * From left to right: an optional drag handle and icon, then a title and
 * optional description, then a row of actions on the right with an optional
 * collapse toggle and a close button. It's meant to slot into a sherpa-container
 * as the header, but it works anywhere.
 *
 * CSS handles the look. JS writes the heading, description, and icon text, keeps
 * the collapse toggle in sync, and fires the header's events.
 *
 * A `panel` variant (data-variant) presents the same skeleton as a link-style
 * title with a right-aligned actions group and a bottom metadata strip; the
 * default variant is today's single-row header. The look is entirely CSS —
 * data-variant only selects it.
 *
 * Figma's third variant, `accordion`, is intentionally NOT a data-variant value.
 * It is the default skeleton with a disclosure chevron in place of the close X —
 * which is precisely `data-collapsible` here (shows the .toggle button, fires
 * header-collapse, rotates on data-collapsed). Reproduce Figma's accordion header
 * with data-collapsible (omit data-dismissible). A self-contained disclosure card
 * with its own <details>/<summary> chevron is the separate `sherpa-accordion`
 * component, so this header needs no `accordion` variant of its own.
 *
 * @element sherpa-container-header
 * @tier sub-component — renders inside sherpa-container; excluded from the public catalog.
 * @attr {string}  data-variant      — default | panel (default: default)
 * @attr {string}  data-heading      — heading text (or use the `heading` slot)
 * @attr {string}  data-description  — secondary text below the heading
 * @attr {string}  data-icon         — a glyph before the title
 * @attr {boolean} data-draggable    — show the drag handle
 * @attr {boolean} data-dismissible  — show the close button
 * @attr {boolean} data-collapsible  — show the collapse toggle
 * @attr {boolean} data-collapsed    — collapsed state (opt-in; absent = expanded default)
 *
 * @slot heading  — custom heading element (replaces the default .title)
 * @slot icon     — custom icon element
 * @slot actions  — extra trailing action controls
 * @slot metadata — bottom metadata strip (Panel) / secondary content (Default)
 *
 * @fires header-dismiss  — the close button is clicked. bubbles + composed. detail: {}
 * @fires header-collapse — the collapse toggle fires. bubbles + composed. detail: { collapsed: boolean }
 * @fires header-drag     — the drag handle is pressed. bubbles + composed. detail: {}
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// The drag / collapse / close controls are composed sherpa-buttons.
import '../sherpa-button/sherpa-button.js';

export class SherpaContainerHeader extends SherpaElement {
  static override tier = 'sub-component' as const;
  static override css = new URL('./sherpa-container-header.css', import.meta.url);
  static override html = new URL('./sherpa-container-header.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    // `skipWhen`: a SLOTTED icon wins over the data-icon glyph, so the write is
    // skipped when the consumer has projected something into the icon span.
    'data-icon': { type: 'string', kind: 'content', to: '.icon', skipWhen: '[slot]', as: 'icon' },
  } as const;

  static override observed = ['data-collapsed'];

  override onRender(): void {
    this.#syncCollapsed();
    // `button-click`, not `click` — a sherpa-button suppresses its own event when
    // disabled, where a raw click listener would still fire on the host element.
    this.$('.close')?.addEventListener('button-click', this.#onDismiss);
    this.$('.toggle')?.addEventListener('button-click', this.#onToggle);
    this.$('.drag')?.addEventListener('pointerdown', this.#onDrag);
  }

  override onChange(name: string): void {
    // Text is written by the declared props; this mirrors STATE onto aria-expanded.
    if (name === 'data-collapsed') this.#syncCollapsed();
  }

  /** Reflect collapsed onto the toggle's aria-expanded / label. */
  #syncCollapsed(): void {
    const collapsed = this.hasAttribute('data-collapsed');
    const toggle = this.$('.toggle');
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    toggle?.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
  }

  /* ── Events ─────────────────────────────────────────────────────── */

  #onDismiss = (): void => { this.emit('header-dismiss', {}); };

  #onToggle = (): void => {
    const collapsed = !this.hasAttribute('data-collapsed');
    this.toggleAttribute('data-collapsed', collapsed);
    this.emit('header-collapse', { collapsed });
  };

  #onDrag = (): void => { this.emit('header-drag', {}); };
}

customElements.define('sherpa-container-header', SherpaContainerHeader);
