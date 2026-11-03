/**
 * menu-shell.ts — the menu's card on the native popover: shown at its trigger,
 * and shut by Escape or a press outside it. A module of sherpa-menu, not an
 * element. The browser owns the top layer, focus and the placement: the trigger
 * is the card's anchor BY REFERENCE, `showPopover({ source })`, which crosses a
 * shadow root where an anchor name cannot. Measured only to keep it in a box: a
 * host's `data-bounds`, or the viewport when its trigger is out of it.
 * TRAP T-anchor-cross-root · TRAP T-a-slotted-row-is-outside-its-own-popover
 *
 * Map:
 * - ShellHost — What the shell asks of its menu.
 * - MenuShell — One menu's card: shown at its trigger, and shut.
 * - .open — Is the card open?
 * - .show — Show the card at its trigger; true when this opened it.
 * - .hide — Shut the card.
 * - .listen — What an open card listens to, until it shuts.
 * - .closed — The card shut: its listeners go, and so does its trigger.
 * - .rowsChanged — The rows moved: a card is kept inside its box next frame.
 * - .syncInline — An inline menu is not a popover.
 * - .stop — The menu left the page, or the card shut.
 */

/** What the shell asks of its menu. */
export interface ShellHost {
  /** The menu element. */
  readonly el: HTMLElement;
  /** The card: the popover itself. */
  card(): HTMLElement | null;
  /** Listen on a target this menu does not own, while it is in the page or a shorter lifetime. */
  on(target: EventTarget, type: string, handler: EventListener, options: AddEventListenerOptions & { while?: AbortSignal }): void;
  /** The same, coalesced to one call per frame. */
  onFrame(target: EventTarget, type: string, handler: () => void, options: AddEventListenerOptions & { while?: AbortSignal }): void;
  /** Shut the menu, as its own verb does. */
  hide(): void;
}

/** The gap a bounded card keeps from its box's edge, as it keeps from its trigger. */
const GAP = 4;

/** The first element `selector` names, from the menu's own tree out to the
 *  document: a box in a shadow root is found too. TRAP T-bounds-clamp-to-the-viewport */
function across(from: Node, selector: string): Element | null {
  for (let root: Node | null = from.getRootNode(); root; root = root instanceof ShadowRoot ? root.host.getRootNode() : null) {
    const hit = (root as ParentNode).querySelector(selector);
    if (hit) return hit;
  }
  return null;
}

/** How far `[lo, hi]` moves to lie inside `[min, max]`: its start wins when it cannot. */
const shift = (lo: number, hi: number, min: number, max: number): number => (lo < min ? min - lo : hi > max ? Math.max(min - lo, max - hi) : 0);

/** One menu's card: shown at its trigger, and shut. */
export class MenuShell {
  /** The menu it is part of. */
  readonly #host: ShellHost;
  /** The open card's trigger: its anchor, and a press on it is not outside. */
  #trigger: HTMLElement | null = null;
  /** Aborts when the menu SHUTS — the open card's own listeners' lifetime. */
  #openAc: AbortController | null = null;
  /** Watches a bounded card's box, so a body that grows is kept inside. */
  #cardResize: ResizeObserver | null = null;

  constructor(host: ShellHost) {
    this.#host = host;
  }

  /** Is the card open? */
  get open(): boolean {
    return !!this.#host.card()?.matches(':popover-open');
  }

  /** The nearest drawn box to hang an untriggered card on: the element this
   * menu is slotted into, else its own parent.
   * TRAP T-a-menu-with-no-trigger-lands-at-the-origin */
  #fallbackTrigger(): HTMLElement | null {
    const el = this.#host.el;
    const slotted = el.assignedSlot?.getRootNode();
    const host = slotted instanceof ShadowRoot ? slotted.host : null;
    const near = host ?? el.parentElement;
    return near instanceof HTMLElement ? near : null;
  }

  /** Show the card at `trigger`, its anchor; true when this call opened it. */
  show(trigger?: HTMLElement): boolean {
    if (trigger) this.#trigger = trigger;
    // No trigger — `open` was set, or a caller forgot one. TRAP T-a-menu-with-no-trigger-lands-at-the-origin
    this.#trigger ??= this.#fallbackTrigger();
    const was = this.open;
    if (!was) this.#host.card()?.showPopover(this.#trigger ? { source: this.#trigger } : {});
    const opened = !was && this.open;
    if (opened) this.listen();
    this.#keepInBounds();
    return opened;
  }

  /** Shut the card. */
  hide(): void {
    this.#host.card()?.hidePopover();
  }

  /** The box the card stays in: a host's `data-bounds`, else the viewport.
   *  TRAP T-bounds-clamp-to-the-viewport */
  #bounds(): { left: number; top: number; right: number; bottom: number } {
    const sel = this.#host.el.dataset['bounds'];
    const box = sel ? across(this.#host.el, sel)?.getBoundingClientRect() : undefined;
    return box && box.width > 0 && box.height > 0 ? box : { left: 0, top: 0, right: Infinity, bottom: Infinity };
  }

  /** Keep the card inside its box: the platform keeps it in the viewport, but not
   *  when its trigger is out of it — a folded chip, measured off-screen — and never
   *  in a host's `data-bounds`, as a top-layer card's containing block is the viewport. */
  #keepInBounds = (): void => {
    const card = this.#host.card();
    if (!card) return;
    if (!this.open) {
      card.style.removeProperty('--_nudge-x');
      card.style.removeProperty('--_nudge-y');
      return;
    }
    const box = this.#bounds();
    // Where the platform put it, without the last nudge.
    const was = (axis: string): number => Number.parseFloat(card.style.getPropertyValue(`--_nudge-${axis}`)) || 0;
    const c = card.getBoundingClientRect();
    const left = c.left - was('x');
    const top = c.top - was('y');
    // Never wider than the viewport, or the card follows a scrolled-away box off-screen.
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const dx = shift(left, left + c.width, Math.max(0, box.left) + GAP, Math.min(vw, box.right) - GAP);
    const dy = shift(top, top + c.height, Math.max(0, box.top) + GAP, Math.min(vh, box.bottom) - GAP);
    // Nothing to move — the common case — writes nothing.
    for (const [axis, d] of [['x', Math.round(dx)], ['y', Math.round(dy)]] as const) {
      if (d) card.style.setProperty(`--_nudge-${axis}`, `${d}px`);
      else card.style.removeProperty(`--_nudge-${axis}`);
    }
  };

  /** A pointerdown anywhere this menu does not own closes it. */
  #onOutsidePointer = (event: Event): void => {
    const path = event.composedPath();
    // Its own card, its own rows, and the trigger that opened it.
    if (path.includes(this.#host.el)) return;
    const card = this.#host.card();
    if (card && path.includes(card)) return;
    if (this.#trigger && path.includes(this.#trigger)) return;
    this.#host.hide();
  };

  /** Escape closes this menu, not whatever is under it. */
  #onEscape = (event: Event): void => {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    event.stopPropagation();
    this.#host.hide();
  };

  /** What an OPEN menu listens to. show() calls it too: `toggle` fires a task later, and an Escape in that gap was lost. */
  listen(): void {
    if (this.#openAc) return;
    /* These live while the menu is OPEN, which is shorter than the element's
       life — `while` is that shorter lifetime, and the base class ANDs it
       with its own disconnect signal. TRAP T-open-menu-resize-closes */
    this.#openAc = new AbortController();
    const whileOpen = { while: this.#openAc.signal, passive: true } as const;
    this.#host.on(window, 'resize', this.#onViewportResize, whileOpen);
    /* A BOUNDED card is measured: on a scroll — capture, as an ancestor's does
       not bubble — once a frame, and as its box grows.
       TRAP T-a-layout-read-belongs-in-a-frame */
    const card = this.#host.card();
    if (this.#host.el.dataset['bounds'] && card) {
      this.#host.onFrame(window, 'scroll', this.#keepInBounds, { ...whileOpen, capture: true });
      this.#cardResize ??= new ResizeObserver(() => this.#keepInBounds());
      this.#cardResize.observe(card);
    }

    /* THE MENU OWNS ITS OWN DISMISS. `popover="manual"` because the rows are
       SLOTTED: the browser reads the DOM tree for light-dismiss, where they
       are children of THIS element and outside the card, so ticking one shut
       the menu with nothing chosen. The composed path says what is really
       inside. TRAP T-a-slotted-row-is-outside-its-own-popover */
    this.#host.on(document, 'pointerdown', this.#onOutsidePointer, {
      ...whileOpen, capture: true,
    });
    this.#host.on(document, 'keydown', this.#onEscape, whileOpen);
  }

  /** The card shut: its listeners go, and so does its trigger. */
  closed(): void {
    this.stop();
    this.#trigger = null;
  }

  /** The window resized: close, as what is under the card may have been rebuilt. */
  #onViewportResize = (): void => {
    this.#host.hide();
  };

  /** The rows moved: a bounded card is kept inside its box next frame, once they
   *  are laid out. TRAP T-rows-changed-re-places-next-frame */
  rowsChanged(): void {
    if (this.open && this.#host.el.dataset['bounds']) requestAnimationFrame(this.#keepInBounds);
  }

  /**
   * An INLINE menu is not a popover.
   *
   * The attribute is in the TEMPLATE, so it is removed rather than never
   * written — and putting it back restores the floating card, which is how one
   * element serves a chip and a panel. TRAP T-an-inline-menu-is-the-same-menu
   */
  syncInline(): void {
    const card = this.#host.card();
    if (!card) return;
    const inline = this.#host.el.hasAttribute('data-inline');
    if (inline && card.hasAttribute('popover')) card.removeAttribute('popover');
    else if (!inline && !card.hasAttribute('popover')) card.setAttribute('popover', 'manual');
  }

  /** The menu left the page, or the card shut. Only the observer is manual: the
   *  listeners carry their own signals. */
  stop(): void {
    this.#openAc?.abort();
    this.#openAc = null;
    this.#cardResize?.disconnect();
  }
}
