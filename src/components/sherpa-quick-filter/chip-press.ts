/**
 * chip-press.ts — a chip's two buttons, by its face: a bar chip's body toggles and an
 * empty one opens its menu; a Group or Sort arranges; a cell's icon-only chip is its
 * caret; a legend's key relays; a jump scrolls to a place. Its menu opens and shuts by
 * `data-open`, safe from light-dismiss. A module of sherpa-quick-filter, not an
 * element. Plan 695 P5
 * TRAP T-a-chip-body-cycles-its-states · TRAP T-a-trigger-click-follows-light-dismiss
 *
 * Map:
 * - PressHost — What the press asks of its chip.
 * - ChipPress — One chip's body and caret.
 * - .pressed — Say whether it is on: a toggle does; a jump and a selector do not.
 * - .body — The body was pressed: toggle, or let its face do its own thing.
 * - .caret — The caret was pressed: its menu opens, and the chip stays as it was.
 * - .toggleMenu — Open the value menu, or shut it if it is open.
 * - .refused — Ruled out and OFF: nothing to press.
 * - .menuToggled — Its own menu opened or shut: the caret and the chip say so.
 * - .places — A jump chip's places, as action rows in its menu.
 * - .jumped — A jump row: scroll to its target, then say so.
 */
import type { ChipAnswer } from './chip-answer.js';
import type { ChipArrange } from './chip-arrange.js';
import type { ChipHost } from './chip-host.js';

/** One place a jump chip can scroll to — `value` is the target element's id. */
interface JumpItem {
  value: string;
  label?: string;
}

/** What the press asks of its chip. */
export interface PressHost extends ChipHost {
  /** Its answer. */
  readonly answer: ChipAnswer;
  /** Its Group or Sort. */
  readonly arrange: ChipArrange;
  cloneItem<T extends Element = HTMLElement>(tpl: HTMLTemplateElement, item: unknown): T | null;
  /** Its body was pressed: it says whether it is on. */
  clicked(active: boolean): void;
  /** An empty date's body was pressed: it is on, at its default day. */
  dayPicked(): void;
  /** A jump row was picked, and its target scrolled into view. */
  jumpedTo(value: string, label: string): void;
}

/** One chip's body and caret. */
export class ChipPress {
  /** Its chip. */
  readonly #host: PressHost;

  constructor(host: PressHost) {
    this.#host = host;
  }

  /** A toggle says whether it is on. A jump and a selector are no toggle. */
  pressed(): void {
    const { el } = this.#host;
    const body = this.#host.$('.body');
    if (!body) return;
    if (el.dataset['type'] === 'jump' || el.hasAttribute('data-persistent')) body.removeAttribute('aria-pressed');
    else body.setAttribute('aria-pressed', String(el.current));
    // An icon-only TOGGLE is its caret: the caret takes the chip's name and on-state.
    const caret = this.#host.$('.caret');
    if (!caret || !this.#togglesOnly()) return;
    caret.setAttribute('aria-pressed', String(el.current));
    caret.removeAttribute('aria-haspopup');
    caret.removeAttribute('aria-expanded');
    const name = el.getAttribute('aria-label');
    if (name) caret.setAttribute('aria-label', name);
  }

  /** Icon-only with no menu: a toggle whose whole face is the caret. */
  #togglesOnly(): boolean {
    const { el } = this.#host;
    return el.hasAttribute('data-icon-only') && !el.hasAttribute('data-menu');
  }

  /** The body was clicked: toggle, or let Group and Sort do their own thing. */
  body = (event: Event): void => {
    const { el, answer, arrange } = this.#host;
    if (el.hasAttribute('disabled') || this.refused()) return;

    /* A GROUP or SORT chip owns its own gesture, because what it does is a
       property of WHAT IT IS, not of which container drew it.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (arrange.on()) {
      event.stopPropagation();
      // No column yet, or one it may never let go — a chart's Primary: it opens its menu. Will, TODO 667
      if (!arrange.column() || el.hasAttribute('data-persistent')) { this.toggleMenu(); return; }
      arrange.press();
      return;
    }

    const menu = el.menu;
    /* AN OPEN DRAFT IS APPLIED. A reader who typed a condition or ticked a
       value, then pressed the chip, meant "filter by that" — and closing the
       menu threw it away. TRAP T-a-chip-press-applies-its-menus-draft */
    if (menu?.dirty && el.hasAttribute('data-open')) {
      event.stopPropagation();
      menu.apply?.();
      return;
    }

    /* AN EMPTY DATE switches ON at its default day, Today — a day with no rows
       too: the view's empty state says so. Will, TODO 394 */
    const day = menu && !el.values.length ? answer.orDefault([]) : [];
    if (menu && day.length) {
      menu.reading = { picked: day };
      if (el.hasAttribute('data-locked')) el.refresh();
      else this.#host.applySelection(menu.values ?? []);
      this.#host.dayPicked();
      return;
    }

    /* TRAP T-an-empty-chip-opens-its-menu — the body cycles a chip's states
     * (TRAP T-a-chip-body-cycles-its-states), and an empty chip has none to cycle.
     * Only when there IS a menu: a toggle-only chip keeps toggling.
     */
    /* A CONDITIONED chip has no ticks and is NOT empty — its rows are its
       answer. Its body toggles, like any other answered chip.
       TRAP T-toggling-a-conditioned-chip-suspends-its-condition */
    // A section's value chip's body is its toggle, its caret its Sites (TODO 425).
    // …unless a preset holds it on: then a press is a toggle off. An icon-only chip has no toggle. TODO 592
    const held = el.hasAttribute('data-by-preset') && !el.hasAttribute('data-icon-only');
    // A BOOLEAN's answer is its on, so its body toggles: its menu holds only its acts. Plan 960 U4.4c
    const toggles = el.dataset['kind'] === 'boolean';
    if (menu && !held && !toggles && el.values.length === 0 && el.dataset['condition'] !== 'advanced' && el.slot !== 'values') {
      // Opening a menu is not a toggle — the bar must not see one.
      event.stopPropagation();
      this.toggleMenu();
      return;
    }

    // TRAP T-locked-chip-relays-and-nothing-else — report the click, do not flip.
    // A soloed chip's body ends the solo: its host asks, and it stays on. TODO 690
    if (!el.hasAttribute('data-locked') && !el.hasAttribute('data-solo')) el.current = !el.current;
    this.#host.clicked(el.current);
  };

  /** The caret opens the menu without toggling the chip. */
  caret = (event: Event): void => {
    const { el } = this.#host;
    if (this.#togglesOnly()) return this.body(event);
    // A chip with a MENU always opens it: its rows say what is left.
    if (el.hasAttribute('disabled') || (this.refused() && !el.hasAttribute('data-menu'))) return;
    event.stopPropagation(); // opening the menu must not toggle the chip
    this.toggleMenu();
  };

  /**
   * Open the value menu, or close it if it is open — anchored to the CHIP's leading
   * edge, by reference. TRAP T-menu-anchors-to-the-chip · TRAP T-anchor-cross-root
   *
   * `data-open` decides, NOT `menu.open`: the native popover light-dismisses on
   * pointerdown, so by the time the click lands an open menu already reads shut
   * and `toggle()` re-opens what the reader just closed. Measured before this:
   * open, open, open. TRAP T-a-trigger-click-follows-light-dismiss
   */
  toggleMenu(anchor?: HTMLElement): void {
    const { el } = this.#host;
    const wasOpen = el.hasAttribute('data-open');
    this.#host.set('data-open', null);
    if (wasOpen) el.menu?.hide?.();
    else el.menu?.show?.(anchor ?? el);
  }

  /** Ruled out and OFF: nothing to press — inactive is not interactive (Will,
   *  2026-10-20). Ruled out and ON, a press lets it go, once (Will, TODO 462).
   *  A chip with a menu still opens it. */
  refused(): boolean {
    const { el } = this.#host;
    return el.hasAttribute('data-unavailable') && !el.hasAttribute('data-current');
  }

  /** Mirror the menu's open state onto the caret for assistive tech. */
  menuToggled = (event: Event): void => {
    const { el } = this.#host;
    // Its OWN menu: not a value chip's Sites, nor its section's ⋮. TODO 425
    if (event.target !== el.menu) return;
    const open = event.type === 'menu-open';
    this.#host.$('.caret')?.setAttribute('aria-expanded', String(open));
    // Focus is inside the menu, so `:focus-visible` is false — CSS rings on this.
    this.#host.set('data-open', open);
  };

  /** populate([{ value, label }]) — a JUMP chip's places, as action rows in its menu. */
  places(data: JumpItem[]): void {
    const menu = this.#host.el.menu;
    const tpl = this.#host.$<HTMLTemplateElement>('template.jump-item-tpl');
    if (!menu || !tpl) return;
    // The menu is slotted, outside this shadow root. TRAP T-clone-item-is-for-two-destinations
    menu.replaceChildren(...data.flatMap((item) => this.#host.cloneItem(tpl, item) ?? []));
  }

  /** A jump row: scroll to its target, then report it. */
  jumped = (event: Event): void => {
    const { el } = this.#host;
    if (el.dataset['type'] !== 'jump') return;
    // Reported as a jump, not as a raw menu row a toolbar might read as its own.
    event.stopPropagation();
    const { value, label } = (event as CustomEvent<{ value: string; label: string }>).detail;
    // No `behavior`: the scroller's own CSS decides, so the motion gate still holds.
    (el.getRootNode() as Document | ShadowRoot).getElementById(value)?.scrollIntoView({ block: 'start' });
    this.#host.jumpedTo(value, label);
  };
}
