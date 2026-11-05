/**
 * sherpa-layout-panels — a panel area each side of the content: the app shell's body and the
 * canvas compose it. Its CSS owns the width and the divider; this file follows each area's
 * panel, open and floating, and resizes an area by its inner edge. TRAP T-a-panel-area-is-a-layout
 *
 * Map:
 * - PanelSide — An area: before the content, or after it.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { resizeByEdge } from '../../core/ui/edge-resize.js';

/** An area: before the content, or after it. */
export type PanelSide = 'start' | 'end';

const SIDES: readonly PanelSide[] = ['start', 'end'];

/** Open: an element with an `open` (a dialog-like panel) by that attribute alone; any other unless
 *  `hidden`, or `display: none` in its own style. Never its computed style: in WebKit it stays `none`
 *  under the shut area. TRAP T-a-panel-area-is-a-layout */
function isOpen(panel: HTMLElement): boolean {
  if ('open' in panel) return panel.hasAttribute('open');
  return !panel.hidden && panel.style.display !== 'none';
}

export class SherpaLayoutPanels extends SherpaElement {
  static override css = new URL('./sherpa-layout-panels.css', import.meta.url);
  static override html = new URL('./sherpa-layout-panels.html', import.meta.url);

  static override props = {
    'data-panel-start-width': { type: 'number', kind: 'behaviour' },
    'data-panel-end-width': { type: 'number', kind: 'behaviour' },
    // The host's room rule leaves the content none for an area. TRAP T-the-panel-is-desktop-only
    'data-no-room': { type: 'boolean', kind: 'visibility' },
  } as const;
  static override observed = ['data-panel-start-width', 'data-panel-end-width'];

  /** Watches each area's panel: whether it is open, and whether it floats. */
  #watch: Partial<Record<PanelSide, MutationObserver>> = {};

  override onRender(): void {
    for (const side of SIDES) {
      this.$(`slot[name="panel-${side}"]`)?.addEventListener('slotchange', () => this.#follow(side));
      this.#resizable(side);
      this.#askWidth(side);
    }
  }

  // Each connect: a moved layout watches its panels again.
  override onConnect(): void {
    for (const side of SIDES) this.#follow(side);
  }

  override onDisconnect(): void {
    for (const side of SIDES) this.#watch[side]?.disconnect();
  }

  override onChange(name: string): void {
    for (const side of SIDES) if (name === `data-panel-${side}-width`) this.#askWidth(side);
  }

  /** The narrowest an area may be, in px, as its CSS has it: what a host's room rule needs. */
  areaMin(side: PanelSide = 'start'): number {
    return parseFloat(getComputedStyle(this.#area(side) ?? this).minInlineSize) || 0;
  }

  /** The widest, in px: its max is a share of the row, or a length. */
  #areaMax(side: PanelSide): number {
    const max = getComputedStyle(this.#area(side) ?? this).maxInlineSize;
    const row = this.getBoundingClientRect().width;
    return max.endsWith('%') ? (row * parseFloat(max)) / 100 : parseFloat(max) || row;
  }

  /** An area's box. */
  #area(side: PanelSide): HTMLElement | null {
    return this.$<HTMLElement>(`.area-${side}`);
  }

  /** The panel in an area, through any slot a host forwards into it. */
  #panel(side: PanelSide): Element | undefined {
    return this.$<HTMLSlotElement>(`slot[name="panel-${side}"]`)?.assignedElements({ flatten: true })[0];
  }

  /** Follow an area's panel: shown while it is open; its room while it floats. */
  #follow(side: PanelSide): void {
    this.#watch[side]?.disconnect();
    const panel = this.#panel(side);
    const sync = (): void => {
      if (this.#panel(side) !== panel) return;
      this.toggleState(`${side}-open`, panel instanceof HTMLElement && isOpen(panel));
      this.toggleState(`${side}-floating`, !!panel?.hasAttribute('data-floating'));
    };
    sync();
    if (!panel) return;
    const watch = new MutationObserver(sync);
    watch.observe(panel, { attributes: true, attributeFilter: ['open', 'hidden', 'style', 'data-floating'] });
    this.#watch[side] = watch;
    // Not yet upgraded, it has no `open` to say it can shut.
    if (panel.localName.includes('-') && !customElements.get(panel.localName)) {
      void customElements.whenDefined(panel.localName).then(sync);
    }
  }

  /**
   * An area's INNER edge resizes it: drag it, or the arrow keys, Home and End. Drawn live,
   * REPORTED on release; the host keeps it and hands it back in `data-panel-<side>-width`.
   * The CSS owns the clamp. Will, TODO 146. TRAP T-an-edge-resizes-its-box
   */
  #resizable(side: PanelSide): void {
    const edge = this.$<HTMLElement>(`.edge-${side}`);
    if (!edge) return;
    const drawn = (): number => this.#area(side)?.getBoundingClientRect().width ?? 0;
    resizeByEdge(edge, {
      grows: side === 'start' ? 1 : -1,
      measure: drawn,
      min: () => this.areaMin(side),
      max: () => this.#areaMax(side),
      apply: (px, done) => {
        this.style.setProperty(`--_asked-${side}`, `${Math.round(px)}px`);
        // What the clamp DREW is the width: a key moves from there.
        const width = Math.round(drawn());
        this.style.setProperty(`--_asked-${side}`, `${width}px`);
        if (done) this.emit('panel-area-resize', { side, width });
      },
    });
  }

  /** The host's width for an area, in: none is the area's own. */
  #askWidth(side: PanelSide): void {
    const px = this.num(`data-panel-${side}-width`, 0);
    if (px > 0) this.style.setProperty(`--_asked-${side}`, `${px}px`);
    else this.style.removeProperty(`--_asked-${side}`);
  }
}

define('sherpa-layout-panels', SherpaLayoutPanels);
