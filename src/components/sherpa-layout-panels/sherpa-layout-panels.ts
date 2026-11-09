/**
 * sherpa-layout-panels — a panel area each side of the content: the app shell's body and the
 * canvas compose it. Its CSS owns the width and the divider; this file follows each area's
 * panels and resizes an area by its inner edge. An area holds two panels at most, stacked top and bottom, and OWNS
 * how they present: a panel asks for a mode (`panel-mode-change`) and the area writes it on every panel in it, floating
 * apart. A floating panel is in the host's float layer, off its area. TRAP T-a-panel-area-is-a-layout
 * TRAP T-an-area-holds-two-panels-stacked
 * TRAP T-a-panel-has-four-modes
 *
 * Map:
 * - PanelSide — An area: before the content, or after it.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { resizeByEdge } from '../../core/ui/edge-resize.js';

/** An area: before the content, or after it. */
export type PanelSide = 'start' | 'end';

const SIDES: readonly PanelSide[] = ['start', 'end'];

/** How many panels an area holds, for now. */
const MAX_PANELS = 2;

/** A panel's mode: its attribute, or fixed. */
const modeOf = (panel: HTMLElement): string => panel.getAttribute('data-mode') ?? 'fixed';

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
  /** The panels already warned of for being a third. */
  #warned = new WeakSet<HTMLElement>();

  override onRender(): void {
    for (const side of SIDES) {
      this.$(`slot[name="panel-${side}"]`)?.addEventListener('slotchange', () => this.#follow(side));
      this.#resizable(side);
      this.#askWidth(side);
    }
    // A panel asks for a mode: the area writes it on the panels in it.
    this.on(this, 'panel-mode-change', this.#onMode);
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
      watch.observe(panel, { attributes: true, attributeFilter: ['open', 'hidden', 'style', 'data-mode', 'data-heading'] });
      // Not yet upgraded, it has no `open` to say it can shut.
      if (panel.localName.includes('-') && !customElements.get(panel.localName)) {
        void customElements.whenDefined(panel.localName).then(() => this.#sync(side));
      }
    }
    this.#watch[side] = watch;
  }

  /** What an area shows: open while a panel is; stacked while two are fixed; the strip while they are all tabs; its room
   *  given back while none is fixed. A third panel is not shown. */
  #sync(side: PanelSide): void {
    const live = this.#panels(side).filter(isOpen);
    // At most two: a third is hidden, and said so once.
    live.forEach((panel, i) => {
      panel.toggleAttribute('hidden', i >= MAX_PANELS);
      if (i >= MAX_PANELS && !this.#warned.has(panel)) {
        this.#warned.add(panel);
        console.warn(`sherpa-layout-panels: the ${side} area holds ${MAX_PANELS} panels; "${panel.id || panel.getAttribute('data-heading') || panel.localName}" is not shown`);
      }
    });
    const shown = live.slice(0, MAX_PANELS);
    const fixed = shown.filter((p) => modeOf(p) === 'fixed');
    this.toggleState(`${side}-open`, shown.length > 0);
    this.toggleState(`${side}-stack`, fixed.length === MAX_PANELS);
    // No fixed panel: the area gives its room back, as a floating panel does. TRAP T-a-minimised-panel-is-a-tab
    this.toggleState(`${side}-floating`, shown.length > 0 && fixed.length === 0);
    // Only tabs: the area is as wide as the tabs, so the content sits beside them, not under them.
    this.toggleState(`${side}-strip`, shown.length > 0 && shown.every((p) => modeOf(p) === 'tab'));
  }

  /** The panels docked in an area now: its slot's, open, not hidden as a third. */
  docked(side: PanelSide): HTMLElement[] {
    return this.#panels(side).filter((p) => isOpen(p) && !p.hidden);
  }

  /** The area's current mode: what its panels share. None, fixed. */
  modeOf(side: PanelSide): string {
    const first = this.docked(side)[0];
    return first ? modeOf(first) : 'fixed';
  }

  /** Dock a floating panel into an area, as the second panel where one is there. `place` says above or below the one there.
   *  False where the area is full. It joins in the area's current mode. */
  dock(panel: HTMLElement, side: PanelSide, place: 'top' | 'bottom' = 'bottom'): boolean {
    const peers = this.docked(side).filter((p) => p !== panel);
    if (peers.length >= MAX_PANELS) return false;
    const mode = peers[0] ? modeOf(peers[0]) : 'fixed';
    panel.setAttribute('data-side', side);
    const [peer] = peers;
    if (peer && place === 'top') peer.before(panel);
    else if (peer) peer.after(panel);
    panel.setAttribute('data-mode', mode);
    return true;
  }

  /** A panel asked for a mode: the area it is in writes it on every panel in it. Floating is the panel's own; a floating
   *  panel asking to dock joins the area in the area's mode, if there is room. Not a panel of ours, it is not ours to answer. */
  #onMode = (event: Event): void => {
    const panel = event.composedPath()[0];
    const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
    if (!(panel instanceof HTMLElement) || !mode) return;
    const side = SIDES.find((s) => this.#panels(s).includes(panel));
    const floater = this.$<HTMLSlotElement>('slot[name="panel-float"]')?.assignedElements({ flatten: true }).includes(panel);
    if (!side && !floater) return;
    event.preventDefault();
    if (mode === 'floating') {
      panel.setAttribute('data-mode', 'floating');
      return;
    }
    const at: PanelSide = panel.getAttribute('data-side') === 'start' ? 'start' : 'end';
    if (floater && mode === 'tab') {
      // A floating panel shrunk to a tab is a tab of its own: it is not in the area.
      panel.setAttribute('data-mode', 'tab');
      return;
    }
    const peers = this.docked(side ?? at).filter((p) => p !== panel);
    // Joining an area, it takes the area's mode, if there is one; and not at all where the area is full.
    if (floater && peers.length >= MAX_PANELS) return;
    const next = floater && peers[0] ? modeOf(peers[0]) : mode;
    for (const p of [panel, ...peers]) p.setAttribute('data-mode', next);
  };

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
