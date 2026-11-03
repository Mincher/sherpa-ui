/**
 * menu-shell.ts — the menu's card on the native popover: shown at its trigger,
 * placed, and shut by Escape or a press outside it. A module of sherpa-menu,
 * not an element. The browser owns the top layer and focus; `#place()` measures
 * the trigger, as CSS anchoring cannot cross a shadow root.
 * TRAP T-anchor-cross-root · TRAP T-a-slotted-row-is-outside-its-own-popover
 *
 * Map:
 * - ShellHost — What the shell asks of its menu.
 * - MenuShell — One menu's card: shown, placed and shut.
 * - .open — Is the card open?
 * - .show — Show the card at its trigger; true when this opened it.
 * - .hide — Shut the card.
 * - .listen — What an open card listens to, until it shuts.
 * - .closed — The card shut: its listeners go, and so does its trigger.
 * - .rowsChanged — The rows moved: an open card is placed again next frame.
 * - .syncInline — An inline menu is not a popover.
 * - .stop — The menu left the page.
 */

/** Gap between trigger and card. */
const GAP = 4;

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

/** One menu's card: shown, placed and shut. */
export class MenuShell {
  /** The menu it is part of. */
  readonly #host: ShellHost;
  /** The open menu's trigger — re-measured on scroll / resize. */
  #trigger: HTMLElement | null = null;
  /** Watches the card's box, so a body that grows re-places. */
  #cardResize: ResizeObserver | null = null;
  /** Aborts when the menu SHUTS — the viewport listeners' own lifetime. */
  #openAc: AbortController | null = null;

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

  /** Show the card under `trigger`, which is also what it measures against;
   *  true when this call opened it. */
  show(trigger?: HTMLElement): boolean {
    if (trigger) this.#trigger = trigger;
    // No trigger — `open` was set, or a caller forgot one. Without this the
    // card has nothing to measure and sits at 0,0.
    // TRAP T-a-menu-with-no-trigger-lands-at-the-origin
    this.#trigger ??= this.#fallbackTrigger();
    const was = this.open;
    // A closed popover measures 0, so show first. TRAP T-show-then-measure
    this.#host.card()?.showPopover();
    const opened = !was && this.open;
    if (opened) this.listen();
    this.#place();
    return opened;
  }

  /** Shut the card. */
  hide(): void {
    this.#host.card()?.hidePopover();
  }

  /** The box the card stays inside — viewport, or a host's `data-bounds`.
   * A missing or zero-sized box falls back to the viewport.
   * TRAP T-bounds-clamp-to-the-viewport */
  #bounds(): { left: number; top: number; right: number; bottom: number } {
    const viewport = {
      left: 0,
      top: 0,
      right: document.documentElement.clientWidth,
      bottom: document.documentElement.clientHeight,
    };
    const sel = this.#host.el.dataset['bounds'];
    if (!sel) return viewport;
    const box = document.querySelector(sel)?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return viewport;
    // Never wider than the viewport, or the card follows a scrolled-away box off-screen.
    return {
      left: Math.max(viewport.left, box.left),
      top: Math.max(viewport.top, box.top),
      right: Math.min(viewport.right, box.right),
      bottom: Math.min(viewport.bottom, box.bottom),
    };
  }

  /** Place the card against its trigger, inside the bounds. */
  #place(): void {
    const card = this.#host.card();
    const trigger = this.#trigger;
    if (!card || !trigger?.isConnected) return;
    const el = this.#host.el;

    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const gap = GAP;
    // `--_max-h` is the room on the side the card landed on.
    // TRAP T-card-max-height-follows-the-side
    const bounds = this.#bounds();
    const vw = bounds.right;
    const vh = bounds.bottom;

    // Beside the trigger, level with it, and up from the foot if it must.
    if (el.dataset['placement'] === 'right') {
      card.style.setProperty('--_max-h', `${Math.max(120, Math.round(vh - bounds.top - gap * 2))}px`);
      card.style.setProperty('--_x', `${Math.round(Math.min(t.right + gap, vw - c.width - gap))}px`);
      card.style.setProperty('--_y', `${Math.round(Math.max(bounds.top + gap, Math.min(t.top, vh - c.height - gap)))}px`);
      return;
    }

    // Below the trigger, unless there is no room and there IS room above.
    const below = vh - t.bottom - gap * 2;
    const above = t.top - gap * 2;
    let y = t.bottom + gap;
    if (y + c.height > vh && t.top - gap - c.height >= 0) y = t.top - gap - c.height;

    const room = Math.max(below, above);
    if (c.height > below && above > below) y = Math.max(gap, t.top - gap - Math.min(c.height, above));
    card.style.setProperty('--_max-h', `${Math.max(120, Math.round(room))}px`);

    // The trigger's start edge (end edge on data-align="end"), clamped inside.
    let x = el.dataset['align'] === 'end' ? t.right - c.width : t.left;
    if (x + c.width > vw) x = vw - c.width - gap;
    if (x < bounds.left + gap) x = bounds.left + gap;

    if (y < bounds.top + gap) y = bounds.top + gap;

    card.style.setProperty('--_x', `${Math.round(x)}px`);
    card.style.setProperty('--_y', `${Math.round(y)}px`);
  }

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
       with its own disconnect signal.

       `onFrame`, not `on`: #place() reads two boxes, and a scroll listener
       runs per EVENT. Measured before this, 50 scroll events produced 100
       getBoundingClientRect() calls.
       capture: an ancestor's scroll does not bubble.
       TRAP T-a-layout-read-belongs-in-a-frame
       TRAP T-open-menu-resize-closes */
    this.#openAc = new AbortController();
    const whileOpen = { while: this.#openAc.signal, passive: true } as const;
    this.#host.onFrame(window, 'scroll', this.#reposition, { ...whileOpen, capture: true });
    this.#host.on(window, 'resize', this.#onViewportResize, whileOpen);
    this.#cardResize ??= new ResizeObserver(() => this.#place());
    const card = this.#host.card();
    if (card) this.#cardResize.observe(card);

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
    this.#openAc?.abort();
    this.#openAc = null;
    this.#cardResize?.disconnect();
    this.#trigger = null;
  }

  /** Scrolled or resized while open: place the card again. */
  #reposition = (): void => {
    this.#place();
  };

  /** The window resized: close rather than float somewhere wrong. */
  #onViewportResize = (): void => {
    this.#host.hide();
  };

  /** The rows moved: an open card is placed again next frame, once they are laid out.
   *  TRAP T-rows-changed-re-places-next-frame */
  rowsChanged(): void {
    if (this.open) requestAnimationFrame(() => this.#place());
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

  /** The menu left the page. The viewport listeners carry their own signals; only the observer is manual. */
  stop(): void {
    this.#openAc?.abort();
    this.#openAc = null;
    this.#cardResize?.disconnect();
  }
}
