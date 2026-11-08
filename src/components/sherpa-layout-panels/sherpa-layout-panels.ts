/**
 * sherpa-layout-panels — a panel area each side of the content: the app shell's body and the
 * canvas compose it. Its CSS owns the width and the divider; this file follows each area's
 * panel, open and floating, and resizes an area by its inner edge. An area with more than one open panel
 * draws a tab down its inner edge, one per panel; a tab swaps to that panel. TRAP T-a-panel-area-is-a-layout
 * TRAP T-an-area-with-two-panels-is-tabbed
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

  /** Watches each area's panels: whether each is open, and whether it floats. */
  #watch: Partial<Record<PanelSide, MutationObserver>> = {};
  /** The open panels of each area, in tab order. */
  #tabbed: Record<PanelSide, HTMLElement[]> = { start: [], end: [] };
  /** The panel of each area that is in front. */
  #shown: Record<PanelSide, HTMLElement | undefined> = { start: undefined, end: undefined };

  override onRender(): void {
    for (const side of SIDES) {
      this.$(`slot[name="panel-${side}"]`)?.addEventListener('slotchange', () => this.#follow(side));
      this.#resizable(side);
      this.#askWidth(side);
      this.on(this.$(`.tabs-${side}`)!, 'click', (event) => this.#onTab(side, event));
    }
    // A panel asks to come to the front (the panel keys).
    this.on(this, 'panel-front', this.#onFront);
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

  /** The narrowest an area may be drawn, in px: its least, never over its own max. */
  areaMin(side: PanelSide = 'start'): number {
    return Math.min(this.#least(), this.#areaMax(side));
  }

  /** The narrowest its CSS asks, in px. */
  #least(): number {
    const said = getComputedStyle(this).getPropertyValue('--sherpa-panel-area-min-width').trim();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return (said.endsWith('rem') ? parseFloat(said) * rem : parseFloat(said)) || 16 * rem;
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

  /** The panels in an area, through any slot a host forwards into it. */
  #panels(side: PanelSide): HTMLElement[] {
    return (this.$<HTMLSlotElement>(`slot[name="panel-${side}"]`)?.assignedElements({ flatten: true }) ?? []).filter((e): e is HTMLElement => e instanceof HTMLElement);
  }

  /** Follow an area's panels: it shows while one is open; its room while they all float. */
  #follow(side: PanelSide): void {
    this.#watch[side]?.disconnect();
    const panels = this.#panels(side);
    this.#askWidth(side);
    this.#sync(side);
    if (!panels.length) return;
    const watch = new MutationObserver(() => this.#sync(side));
    for (const panel of panels) {
      watch.observe(panel, { attributes: true, attributeFilter: ['open', 'hidden', 'style', 'data-floating', 'data-minimised', 'data-overlay', 'data-heading'] });
      // Not yet upgraded, it has no `open` to say it can shut.
      if (panel.localName.includes('-') && !customElements.get(panel.localName)) {
        void customElements.whenDefined(panel.localName).then(() => this.#sync(side));
      }
    }
    this.#watch[side] = watch;
  }

  /** What an area shows: open while a panel is; tabbed while two are; the one opened last (or picked) in front. */
  #sync(side: PanelSide): void {
    const panels = this.#panels(side);
    // A minimised panel is a tab on the edge, not a tab of the area's row: the row and the front panel are the live ones.
    const shut = panels.filter((p) => isOpen(p) && p.hasAttribute('data-minimised'));
    const open = panels.filter((p) => isOpen(p) && !p.hasAttribute('data-minimised'));
    const fresh = open.filter((p) => !this.#tabbed[side].includes(p));
    const was = this.#shown[side];
    const shown = fresh.at(-1) ?? (was && open.includes(was) ? was : open[0]);
    this.#shown[side] = shown;
    this.#tabbed[side] = open;
    for (const panel of panels) panel.toggleAttribute('data-current', panel === shown);
    this.toggleState(`${side}-open`, open.length + shut.length > 0);
    this.toggleState(`${side}-tabs`, open.length > 1);
    // A minimised panel is a tab on the layout's edge: its area gives its room back, as floating does. TRAP T-a-minimised-panel-is-a-tab
    this.toggleState(`${side}-floating`, panels.length > 0 && panels.every((p) => p.hasAttribute('data-floating') || p.hasAttribute('data-minimised') || p.hasAttribute('data-overlay')));
    // Only tabs left: the area is as wide as the tabs, so the content sits beside them, not under them.
    this.toggleState(`${side}-strip`, open.length === 0 && shut.length > 0);
    void this.renderItems(`.tabs-${side}`, 'template.tab-tpl', open.map((p, id) => ({ id: String(id), label: p.getAttribute('data-heading') || p.id })), {
      after: (tab, item) => {
        const on = open[Number(item.id)] === shown;
        tab.toggleAttribute('data-current', on);
        tab.setAttribute('aria-selected', String(on));
      },
    });
  }

  /** A panel said `panel-front`: it is in front of the others in its area. */
  #onFront = (event: Event): void => {
    const panel = event.composedPath()[0];
    for (const side of SIDES) {
      if (!(panel instanceof HTMLElement) || !this.#panels(side).includes(panel)) continue;
      this.#shown[side] = panel;
      this.#sync(side);
    }
  };

  /** A tab was pressed: its panel comes to the front. */
  #onTab(side: PanelSide, event: Event): void {
    const tab = (event.target as HTMLElement).closest<HTMLElement>('.tab');
    const panel = this.#tabbed[side][Number(tab?.dataset['id'])];
    if (!panel) return;
    this.#shown[side] = panel;
    this.#sync(side);
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
        this.#setPanelWidth(side, px);
        // What the clamp DREW is the width: a key moves from there.
        const width = Math.round(drawn());
        this.#setPanelWidth(side, width);
        if (done) this.emit('panel-area-resize', { side, width });
      },
    });
  }

  /** A width asked of an area (a reader's drag, or the host's): the area holds it, and its panels take it less the two insets, so a
   *  panel moved out keeps it. Nothing asked, the area follows its panels. TODO 858 */
  #setPanelWidth(side: PanelSide, px: number): void {
    this.style.setProperty(`--_asked-${side}`, `${Math.round(px)}px`);
    const pad = parseFloat(getComputedStyle(this.#area(side) ?? this).paddingInlineStart) || 0;
    for (const panel of this.#panels(side)) panel.style.setProperty('--_width', `${Math.max(0, Math.round(px - 2 * pad))}px`);
  }

  /** The host's width for an area, in: none is the area's own. */
  #askWidth(side: PanelSide): void {
    const px = this.num(`data-panel-${side}-width`, 0);
    if (px > 0) this.#setPanelWidth(side, px);
    else this.style.removeProperty(`--_asked-${side}`);
  }
}

define('sherpa-layout-panels', SherpaLayoutPanels);
