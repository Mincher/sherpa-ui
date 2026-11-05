/**
 * menu-shell.ts — the menu's card on the native popover: shown at its trigger,
 * and shut by Escape or a press outside it. A module of sherpa-menu, not an
 * element. The browser owns the top layer, focus and the placement: the trigger
 * is the card's anchor BY REFERENCE, `showPopover({ source })`, which crosses a
 * shadow root where an anchor name cannot. Measured only to keep it in a box: a
 * host's `data-bounds`, or the viewport when its trigger is out of it. The keys
 * reach it from its trigger in every engine, and the focus comes back.
 * TRAP T-anchor-cross-root · TRAP T-a-slotted-row-is-outside-its-own-popover
 * TRAP T-a-menu-is-reached-by-keys-from-its-trigger
 *
 * Map:
 * - ShellHost — What the shell asks of its menu.
 * - MenuShell — One menu's card: shown at its trigger, and shut.
 * - .open — Is the card open?
 * - .connected — The menu is in the page: an arrow on its shut trigger's button opens it.
 * - .show — Show the card at its trigger; true when this opened it.
 * - .hide — Shut the card.
 * - .listen — What an open card listens to, until it shuts.
 * - .closed — The card shut: its listeners go, and so does its trigger.
 * - .rowsChanged — The rows moved: a card is kept inside its box next frame.
 * - .syncInline — An inline menu is not a popover.
 * - .stop — The menu left the page, or the card shut.
 */
import { tabStops } from '../../core/ui/tab-stops.js';

/** What the shell asks of its menu. */
export interface ShellHost {
  /** The menu element. */
  readonly el: HTMLElement;
  /** The card: the popover itself. */
  card(): HTMLElement | null;
  /** Each row's own control that can take the focus, in order. */
  stops(): HTMLElement[];
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

/** The row a key opens the card on. */
type End = 'first' | 'last';

/** The element that has the focus, through every shadow root. */
function focused(): Element | null {
  let at = document.activeElement;
  while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
  return at;
}

/** Is `node` inside `box`, across shadow roots? */
function within(box: Node, node: Node | null): boolean {
  for (let at = node; at; at = at.parentNode ?? (at instanceof ShadowRoot ? at.host : null)) if (at === box) return true;
  return false;
}

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
  /** The control in the trigger that last had the focus: the way in, and where the focus goes back to. */
  #opener: HTMLElement | null = null;
  /** The row an arrow on the shut trigger asked for, while its press opens the card. */
  #want: End | null = null;
  /** A Tab is moving the focus. */
  #tabbing = false;

  constructor(host: ShellHost) {
    this.#host = host;
  }

  /** Is the card open? */
  get open(): boolean {
    return !!this.#host.card()?.matches(':popover-open');
  }

  /** The menu is in the page: an arrow on its shut trigger's own button opens it. */
  connected(): void {
    const parent = this.#host.el.parentElement;
    if (parent) this.#host.on(parent, 'keydown', this.#onShutKey, {});
  }

  /** ArrowDown or ArrowUp on the button of the trigger it is slotted into, one that
   *  says it opens a popup — a chip's caret, not its body: pressed, as a click
   *  would, and the focus lands on that end's row. TRAP T-a-menu-is-reached-by-keys-from-its-trigger */
  #onShutKey = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (this.open || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const trigger = this.#host.el.parentElement;
    const button = e.composedPath()[0];
    if (!trigger?.shadowRoot || this.#host.el.assignedSlot?.getRootNode() !== trigger.shadowRoot) return;
    if (!(button instanceof HTMLButtonElement) || button.getRootNode() !== trigger.shadowRoot) return;
    if (!button.hasAttribute('aria-haspopup') && !trigger.hasAttribute('aria-haspopup')) return;
    e.preventDefault();
    this.#want = e.key === 'ArrowUp' ? 'last' : 'first';
    button.click();
    this.#want = null;
  };

  /** Focus a row at `end` or, with no row, the card's first stop. */
  #enter(end: End): boolean {
    const rows = this.#host.stops();
    const card = this.#host.card();
    const to = (end === 'last' ? rows.at(-1) : rows[0]) ?? (card ? tabStops(card)[0] : undefined);
    to?.focus();
    return !!to;
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
    if (!was) {
      const at = focused();
      this.#opener = at instanceof HTMLElement && this.#trigger && within(this.#trigger, at) && !within(this.#host.el, at) ? at : null;
      this.#host.card()?.showPopover(this.#trigger ? { source: this.#trigger } : {});
    }
    const opened = !was && this.open;
    if (opened) this.listen();
    this.#keepInBounds();
    /* Opened from the keys — a button's press that shows its ring, or an arrow:
       the focus goes in. A text field that opens a menu keeps it.
       TRAP T-a-menu-is-reached-by-keys-from-its-trigger */
    const end = this.#want ?? (opened && this.#opener instanceof HTMLButtonElement && this.#opener.matches(':focus-visible') ? 'first' : null);
    if (end && this.open) this.#enter(end);
    return opened;
  }

  /** Shut the card. Focus in it, or nowhere, goes back to the control that opened
   *  it: the platform restores only into a popover's own tree, and the rows are slotted. */
  hide(): void {
    const at = focused();
    const back = this.open && this.#opener?.isConnected && (!at || at === document.body || within(this.#host.el, at)) ? this.#opener : null;
    this.#host.card()?.hidePopover();
    back?.focus({ preventScroll: true });
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
    // The press takes the focus where it lands: nothing to give back.
    this.#opener = null;
    this.#host.hide();
  };

  /** Is this event's path inside the menu: its rows or its card? */
  #inside(path: EventTarget[]): boolean {
    const card = this.#host.card();
    return path.includes(this.#host.el) || (!!card && path.includes(card));
  }

  /** An open card's keys. Escape shuts this menu, not whatever is under it. From
   *  its opener, Tab goes in to the card's first stop — Chromium's own move, so
   *  taken once — and the arrows to a row; Shift+Tab from that stop comes back.
   *  TRAP T-a-menu-is-reached-by-keys-from-its-trigger */
  #onKey = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.key === 'Escape') {
      event.stopPropagation();
      this.#host.hide();
      return;
    }
    const tab = e.key === 'Tab';
    // The focus a Tab moves lands before the next task.
    if (tab) {
      this.#tabbing = true;
      setTimeout(() => { this.#tabbing = false; });
    }
    const card = this.#host.card();
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || !card || !this.#opener) return;
    const path = e.composedPath();
    if (path[0] === this.#opener) {
      const to = tab && !e.shiftKey ? tabStops(card)[0] : undefined;
      const end = e.shiftKey || e.altKey ? null : e.key === 'ArrowDown' ? 'first' : e.key === 'ArrowUp' ? 'last' : null;
      if (to) to.focus();
      else if (!end || !this.#enter(end)) return;
      e.preventDefault();
      return;
    }
    const first = tab && e.shiftKey && this.#inside(path) ? tabStops(card)[0] : undefined;
    if (first && path.includes(first)) {
      e.preventDefault();
      this.#opener.focus();
    }
  };

  /** Focus moved: to a control in its trigger, that is the way in now; TABBED out
   *  of the card and its trigger, the card shuts. Only a Tab: WebKit's press in the
   *  card can focus a box outside it. */
  #onFocusIn = (event: Event): void => {
    const path = event.composedPath();
    if (this.#inside(path)) return;
    if (this.#trigger && path.includes(this.#trigger)) {
      this.#opener = path[0] instanceof HTMLElement ? path[0] : null;
      return;
    }
    if (!this.#tabbing) return;
    this.#opener = null;
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
    // Not passive: Tab and the arrows are taken.
    this.#host.on(document, 'keydown', this.#onKey, { ...whileOpen, passive: false });
    // Tab out of the card and its trigger shuts it. TRAP T-a-menu-is-reached-by-keys-from-its-trigger
    this.#host.on(document, 'focusin', this.#onFocusIn, whileOpen);
  }

  /** The card shut: its listeners go, and so does its trigger. */
  closed(): void {
    this.stop();
    this.#trigger = null;
    this.#opener = null;
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
