/**
 * sherpa-icon.ts
 * SherpaIcon — Atomic icon primitive.
 *
 * Renders either a Font Awesome glyph (default template) or a registered
 * inline SVG (svg template). Replaces the ad-hoc `<i class="fa-... sherpa-icon">`
 * pattern used elsewhere in the library and gives consumers a single,
 * declarative way to reference icons by name.
 *
 * @element sherpa-icon
 * @category media
 *
 * @attr {string} name        — Icon identifier. If `SherpaIcon.register(name, svg)`
 *                              has been called, the registered SVG is rendered;
 *                              otherwise the value is treated as a Font Awesome
 *                              short name (e.g. `plus` → `fa-plus`).
 * @attr {enum}   data-weight — solid (default) | regular | light | thin | duotone | brands
 * @attr {enum}   data-size   — 3xs | 2xs | xs | sm | md | lg | xl | 2xl | 3xl | 4xl | 5xl | 6xl
 * @attr {enum}   data-status — critical | warning | success | info | urgent | brand
 *
 * @prop {string} name   — Mirrors the `name` attribute (read/write)
 * @prop {string} weight — Mirrors `data-weight` (read/write)
 *
 * @method static register(name, svgString) — Register a custom inline SVG icon.
 * @method static has(name)                  — Check whether a name is registered.
 * @method static unregister(name)            — Remove a registered icon.
 *
 * @example
 *   <sherpa-icon name="plus" data-size="lg"></sherpa-icon>
 *   <sherpa-icon name="cove-logo" data-size="xl"></sherpa-icon>
 *
 * @example
 *   import { SherpaIcon } from 'sherpa-ui/components/sherpa-icon/sherpa-icon.js';
 *   SherpaIcon.register('cove-logo', '<svg viewBox="0 0 24 24">...</svg>');
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';
import type { ComponentSize, Status } from '../utilities/types.js';

/* ── Type Definitions ─────────────────────────────────────────────── */

/** Font Awesome icon weights */
type IconWeight = 'solid' | 'regular' | 'light' | 'thin' | 'duotone' | 'brands';

/** Icon size scale */
type IconSize = '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';

interface SherpaIconDataset extends DOMStringMap {
  weight?: IconWeight;
  size?: IconSize | ComponentSize;
  status?: Status;
}

/* ── Registry ─────────────────────────────────────────────────────── */

const _registry = new Map<string, string>();

/* ── Component ────────────────────────────────────────────────────── */

export class SherpaIcon extends StatusMixin(SherpaElement) {

  static override get cssUrl(): string {
    return new URL('./sherpa-icon.css', import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL('./sherpa-icon.html', import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'name', 'data-weight'];
  }

  override get dataset(): SherpaIconDataset {
    return super.dataset as SherpaIconDataset;
  }

  /* ── Registry API ──────────────────────────────────────────────── */

  /**
   * Register an inline SVG under a name. The SVG string should contain
   * a single root `<svg>` element. Calling this with an existing name
   * replaces the entry.
   */
  static register(name: string, svgString: string): void {
    if (typeof name !== 'string' || !name) return;
    _registry.set(name, String(svgString || ''));
  }

  static has(name: string): boolean {
    return _registry.has(name);
  }

  static unregister(name: string): void {
    _registry.delete(name);
  }

  /* ── Template selection ────────────────────────────────────────── */

  override get templateId(): string {
    const name = this.getAttribute('name');
    return name && _registry.has(name) ? 'svg' : 'default';
  }

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  override onRender(): void {
    this.#syncIcon();
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === 'name') {
      // Switching between glyph and registered SVG requires a template swap.
      const wasSvg = oldValue && _registry.has(oldValue);
      const isSvg = newValue && _registry.has(newValue);
      if (wasSvg !== isSvg) {
        this.renderTemplate(this.templateId).then(() => this.#syncIcon());
        return;
      }
      this.#syncIcon();
    } else if (name === 'data-weight') {
      this.#syncIcon();
    }
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get name(): string {
    return this.getAttribute('name') || '';
  }
  set name(v: string) {
    v ? this.setAttribute('name', v) : this.removeAttribute('name');
  }

  get weight(): IconWeight {
    return (this.dataset.weight as IconWeight) || 'solid';
  }
  set weight(v: IconWeight) {
    v ? (this.dataset.weight = v) : delete this.dataset.weight;
  }

  /* ── Private ───────────────────────────────────────────────────── */

  #syncIcon(): void {
    const name = this.name;
    if (!name) return;

    if (_registry.has(name)) {
      const host = this.$<HTMLElement>('.icon-svg');
      const svg = _registry.get(name);
      if (host && svg) host.innerHTML = svg;
      return;
    }

    const glyph = this.$<HTMLElement>('.icon-glyph');
    if (!glyph) return;

    const weight = this.weight;
    const weightClass = `fa-${weight}`;
    const iconClass = `fa-${name}`;
    glyph.className = `sherpa-icon icon-glyph ${weightClass} ${iconClass}`;
  }
}

customElements.define('sherpa-icon', SherpaIcon);
