/**
 * sherpa-quick-filter-toolbar — a row of filter chips above a grid or list.
 *
 * populate([{ id, label, type?, active?, icon?, options? }]) fills it; a chip
 * body toggles on/off and the bar reports every chip that is on.
 *
 * TRAP T-actions-were-a-slot — the action cluster is built in, not slotted.
 * TRAP T-organise-chips-lead-the-bar — Group and Sort, and why they are not
 * filters.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// The sort/group glyphs are SHARED with sherpa-data-grid — see core/icons.
import { NON_VALUE_ROWS, ORGANISE_ICONS } from '../../core/icons.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';
// Chips with `options` stamp a <sherpa-menu>, so it must be defined.
import '../sherpa-menu/sherpa-menu.js';
// The built-in action cluster is made of buttons, so they must be defined.
import '../sherpa-button/sherpa-button.js';
// A `date` chip's menu holds a calendar, so it must be defined.
import '../sherpa-calendar/sherpa-calendar.js';
// A number chip's menu holds a two-ended slider, and both number and date chips
// lead with a Range switch.
import '../sherpa-slider/sherpa-slider.js';
import '../sherpa-switch/sherpa-switch.js';
// The overflow menu's rows are composed list items with a tag as their badge.
import '../sherpa-list-item/sherpa-list-item.js';
import '../sherpa-tag/sherpa-tag.js';

/** One value a filter chip's menu can offer. */
export interface QuickFilterOption {
  value: string;
  label: string;
  selected?: boolean;
  /**
   * Whether this value is reachable under the filters ALREADY applied.
   *
   * TRAP T-unavailable-value-sorts-below-a-divider — `false` still selects.
   */
  available?: boolean;
}

export interface QuickFilterDef {
  id: string;
  label: string;
  type?: string;
  active?: boolean;
  /** A leading Font Awesome icon class list. */
  icon?: string;
  /**
   * Values this chip filters by. Given options, the chip gets a caret and a
   * <sherpa-menu> of rows: checkboxes when `select` is 'multiple' (the default),
   * radios when it is 'single'.
   */
  options?: QuickFilterOption[];
  select?: 'single' | 'multiple';
  /**
   * What the chip's menu holds.
   *
   * TRAP T-number-and-date-lead-with-a-range-switch — the three kinds, and why
   * Range is a switch rather than a second chip.
   */
  kind?: 'values' | 'number' | 'date';
  /**
   * A number filter's bounds — the ends of its slider, and the clamp on its
   * single field. Both default to the slider's own 0..100.
   */
  min?: number;
  max?: number;
  /** The slider's increment. Defaults to 1. */
  step?: number;
  /**
   * The days a DATE chip's calendar may pick — ISO strings; every other day
   * draws inactive. Omit for a free picker. A SET, not a min/max span: a column
   * of dates is a SCATTER, and a span would leave every empty day pickable.
   */
  availableDates?: string[];
  /**
   * A value the user TYPED rather than picked, shown on the chip's caret.
   *
   * A normal chip reads its value back from its ticked rows; a custom one has no
   * list, so the finished phrase ("Contains: ana") arrives already made and the
   * chip opens no menu. Set it via `addCustomFilter()`.
   */
  customValue?: string;
  /**
   * Start a number or date chip in RANGE mode rather than single.
   *
   * The switch is the user's to flip either way; this only says which side it
   * starts on. Off by default: "equals this" is the simpler question and the one
   * a reader can answer without deciding on two numbers first.
   */
  range?: boolean;
  /**
   * A chip that cannot be switched OFF — a SELECTOR rather than a toggle.
   *
   * TRAP T-persistent-chip-is-a-selector — the six rules, and the amber view chip.
   */
  persistent?: boolean;
  /**
   * Offer "Remove" at the foot of this chip's menu.
   *
   * OPT-IN: a filter the user ADDED can be taken off again, a chip the host put
   * there deliberately must not offer a row that deletes it (see `persistent`).
   * `addFilter()` sets it on anything picked from the Add menu.
   */
  removable?: boolean;
  /**
   * Override whether this chip's menu DEFERS its picks behind an Apply/Cancel
   * footer instead of applying each tick as it is made.
   *
   * TRAP T-commit-follows-select-mode — the mode decides; override only against it.
   */
  commit?: boolean;
}

interface ChipEl extends HTMLElement {
  current: boolean;
  /** The chip's picks. Setting them brings its label and badge along. */
  values: readonly string[];
}

/** One column the grid can be grouped or sorted by. */
export interface OrganiseColumn {
  /** The field name reported in group-change / sort-change. */
  field: string;
  label: string;
}

/** The columns the leading Group / Sort chips offer. */
export interface OrganiseDef {
  group?: OrganiseColumn[];
  sort?: OrganiseColumn[];
}

/** Which way a sort runs — matches the standard data-sort-direction values. */
export type SortDirection = 'asc' | 'desc';

export class SherpaQuickFilterToolbar extends SherpaElement {
  static override css = new URL('./sherpa-quick-filter-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-quick-filter-toolbar.html', import.meta.url);

  /**
   * THE SORT, written from outside — by a DataSource, or by a data grid whose
   * own column header was clicked.
   *
   * The bar's Sort chip and a grid's column headers are two views of ONE value,
   * and only one column can be sorted at a time. Without observing these the
   * link ran one way: the chip steered the grid, and sorting from a column
   * header left the chip saying nothing.
   */
  static override observed = ['data-sort-field', 'data-sort-direction', 'data-group-field'];

  #filters: QuickFilterDef[] = [];
  #organise: OrganiseDef = {};
  /**
   * Filters the user MAY add but has not — the Add chip's menu.
   *
   * Separate from #filters because they are the two halves of one idea: what is
   * on the bar, and what else could be. Picking one moves it across.
   */
  #available: QuickFilterDef[] = [];

  /* ── Fitting the bar ─────────────────────────────────────────────── */

  #observer: ResizeObserver | null = null;
  /** The pending reflow frame, so a burst of resizes measures once. */
  #frame: number | null = null;

  /** How far the action cluster has folded — see TRAP T-reflow-resets-before-measuring. */
  static readonly COLLAPSE_STEPS = 3;

  /**
   * Fit the bar to its width — collapse the actions, then fold chips.
   *
   * TRAP T-reflow-resets-before-measuring — un-drill, reset, then re-measure
   * after every fold.
   */
  #reflow(): void {
    const bar = this.$('.bar');
    const chips = this.$('.chips');
    if (!bar || !chips) return;

    this.#closeOverflow();

    this.removeAttribute('data-collapse');
    this.removeAttribute('data-folded');
    this.#showAllChips();

    for (let step = 1; step <= SherpaQuickFilterToolbar.COLLAPSE_STEPS; step++) {
      if (!this.#overflowing()) break;
      this.setAttribute('data-collapse', String(step));
    }

    if (!this.#overflowing()) return;

    // Chips fold one at a time from the end, re-measuring after each.
    const run = [...chips.children].filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('chip'),
    );
    const folded: HTMLElement[] = [];
    for (let i = run.length - 1; i >= 0; i--) {
      const chip = run[i]!;
      chip.toggleAttribute('data-folded-away', true);
      folded.unshift(chip);
      this.setAttribute('data-folded', String(folded.length));
      if (!this.#overflowing()) break;
    }

    this.#renderFolded(folded);
  }

  /**
   * Fill the overflow chip: its badge, and one menu row per folded filter.
   *
   * Each row names the FILTER'S FIELD and badges its value count, so the bar
   * says what is inside, not only how much. See TRAP T-drill-moves-not-clones.
   */
  #renderFolded(folded: readonly HTMLElement[]): void {
    const chip = this.$<HTMLElement>('.overflow-chip');
    if (!chip) return;

    // The badge is the COUNT OF FOLDED FILTERS, not of values — "three filters
    // are in here" is what a reader needs before they open it.
    chip.dataset['count'] = String(folded.length);

    let menu = chip.querySelector('sherpa-menu');
    if (!menu) {
      menu = this.clone('template.qf-menu-tpl') as HTMLElement | null;
      if (!menu) return;
      menu.setAttribute('slot', 'menu');
      menu.setAttribute('data-heading', 'More filters');
      chip.setAttribute('data-menu', '');
      chip.appendChild(menu);
    }
    menu.replaceChildren();

    for (const source of folded) {
      const id = source.dataset['id'] ?? '';
      const label = source.dataset['label'] ?? id;

      // A BOOLEAN chip — no menu of its own — has nothing to drill into, so it
      // gets a TICKABLE row rather than a chevron that does nothing.
      if (!source.querySelector('sherpa-menu')) {
        const toggle = this.clone('template.qf-toggle-tpl');
        if (!toggle) continue;
        toggle.dataset['for'] = id;
        const box = toggle.querySelector<HTMLInputElement>('input');
        const text = toggle.querySelector('.qf-toggle-label');
        if (text) text.textContent = label;
        // The tick MIRRORS the chip, so the menu and the bar cannot disagree.
        if (box) box.checked = source.hasAttribute('data-current');
        // Bound to the BOX: a native `change` is not composed, so it stops at
        // the menu and never reaches the host.
        box?.addEventListener('change', this.#onFoldedToggle);
        menu.appendChild(toggle);
        continue;
      }

      const row = this.clone('template.qf-folded-tpl');
      if (!row) continue;
      row.dataset['for'] = id;
      // The list item names itself from data-label — the component's own API,
      // so there is no inner element for this to reach into.
      row.dataset['label'] = label;
      const glyph = source.dataset['iconStart'];
      if (glyph) row.dataset['icon'] = glyph;

      menu.appendChild(row);
    }

    this.#syncFoldedBadges();
  }

  /**
   * Re-read every folded row's value count.
   *
   * Separate from row STAMPING: the counts move without the rows doing, and
   * re-stamping would rebuild the list the reader is looking at.
   */
  #syncFoldedBadges(): void {
    const chip = this.$<HTMLElement>('.overflow-chip');
    const menu = chip?.querySelector('sherpa-menu');
    if (!menu) return;
    for (const row of menu.querySelectorAll<HTMLElement>('.qf-folded')) {
      const id = row.dataset['for'];
      const source = id ? this.$<HTMLElement>(`.chips > .chip[data-id="${CSS.escape(id)}"]`) : null;
      const badge = row.querySelector<HTMLElement>('.qf-folded-count');
      if (!source || !badge) continue;
      // The same figure the filter's own chip wears, read from the same place,
      // so the two can never disagree.
      const count = this.#chipPicks(source).length;
      badge.textContent = String(count);
      /* A data-* ON THE ROW, not `hidden` on the badge: CSS owns visibility, and
         the badge is not a host — nothing can write `:host(...)` for an element
         inside a menu. Same vocabulary as the chip's `:host([data-count])`. */
      badge.closest('.qf-folded')?.toggleAttribute('data-count', count > 0);
    }
  }

  /**
   * A folded TOGGLE was ticked — flip the chip it stands for.
   *
   * The chip is the source of truth, so a folded filter behaves exactly as it
   * does on the bar: the row asks the chip to toggle, same as a click.
   */
  #onFoldedToggle = (event: Event): void => {
    const box = event.target;
    if (!(box instanceof HTMLInputElement)) return;
    const row = box.closest('.qf-toggle');
    if (!(row instanceof HTMLElement)) return;
    const id = row.dataset['for'];
    const chip = id ? this.$<HTMLElement>(`.chips > .chip[data-id="${CSS.escape(id)}"]`) : null;
    if (!chip) return;
    // Mirror onto the chip and let IT tell the host, so a folded toggle and a
    // bar toggle are the same event to a listener.
    if (box.checked) chip.setAttribute('data-current', '');
    else chip.removeAttribute('data-current');
    this.emit('quick-filter-change', {
      scope: 'chip', id, active: box.checked, values: [], source: 'overflow',
    });
  };

  /**
   * Where a DRILLED-IN menu's rows came from, so Back can put them home.
   *
   * TRAP T-drill-moves-not-clones — one card, one set of inputs, moved not copied.
   */
  #drill: { home: HTMLElement; rows: Element[] } | null = null;

  /**
   * The menu attributes that belong to a FILTER rather than to the card.
   *
   * TRAP T-drill-flags-travel-and-replace — replaced, never merged; `data-type`
   * is the crushed calendar.
   */
  static readonly DRILL_FLAGS = [
    'data-commit',
    'data-range',
    'data-select',
    'data-search',
    'data-type',
  ] as const;

  /**
   * A folded filter's row was clicked — drill into that filter.
   *
   * TRAP T-drill-moves-not-clones — its real rows are MOVED, not copied.
   */
  #onFoldedClick = (event: Event): void => {
    const path = event.composedPath();

    // A FOLDED TOGGLE ticks in place — let the click through so the checkbox
    // flips natively; stopping it here would leave the box unticked.
    if (path.some((n) => n instanceof HTMLElement && n.classList.contains('qf-toggle'))) return;

    // The path, not `target`: the click starts in the list item's own shadow
    // root (see `pathFind`).
    const row = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('qf-folded'),
    );
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();

    const id = row.dataset['for'];
    const source = id ? this.$<HTMLElement>(`.chips > .chip[data-id="${CSS.escape(id)}"]`) : null;
    const from = source?.querySelector<HTMLElement>('sherpa-menu');
    const chip = this.$<HTMLElement>('.overflow-chip');
    const into = chip?.querySelector<HTMLElement>('sherpa-menu');
    if (!from || !into || !chip) return;

    // Already drilled? Put the last one back first, so Back is one level deep
    // and never a chain of them.
    if (this.#drill) this.#drillOut();

    // Park the overflow list so it can come back exactly as it was, then move
    // the filter's own rows across.
    this.#drill = { home: from, rows: [...into.children] };
    into.replaceChildren(...from.childNodes);

    // The HEADER says where you are and how to get out. `data-drill` is what
    // CSS reveals the back arrow off; the heading carries the breadcrumb.
    into.setAttribute('data-drill', '');
    into.dataset['drillFrom'] = chip.dataset['label'] ?? 'More';
    into.setAttribute('data-heading', row.dataset['label'] ?? '');
    // TRAP T-drill-flags-travel-and-replace — restored to what the TARGET had,
    // never merged.
    for (const flag of SherpaQuickFilterToolbar.DRILL_FLAGS) {
      const value = from.getAttribute(flag);
      if (value == null) into.removeAttribute(flag);
      else into.setAttribute(flag, value);
    }
  };

  /**
   * A calendar picked a day or completed a range — relabel its chip.
   *
   * The chip is found by path, not `target` — see `pathFind`.
   */
  #onDatePicked = (event: Event): void => {
    // TRAP T-path-not-target-finds-chip-host — match the TAG, not `.chip`.
    const chip = this.pathFind(event, 'sherpa-quick-filter');
    if (!chip) return;
    this.#syncDateLabel(chip);
    // A date chip turns itself ON by picking — it has no body toggle to switch
    // it on beforehand, unlike a value chip.
    chip.toggleAttribute('data-current', this.#chipPicks(chip).length > 0);
    this.#emitChange();
  };

  #onFoldedCountsChanged = (): void => {
    this.#syncFoldedBadges();
  };

  #drillOutHandler = (): void => {
    this.#drillOut();
  };

  /**
   * Shut the overflow menu, putting any drilled rows back first.
   *
   * ORDER MATTERS — see TRAP T-drill-moves-not-clones.
   */
  #closeOverflow(): void {
    this.#drillOut();
    const menu = this.$<HTMLElement>('.overflow-chip')
      ?.querySelector<HTMLElement & { hide(): void }>('sherpa-menu');
    menu?.hide();
  }

  /** Put a drilled-in filter's rows back and restore the overflow list. */
  #drillOut(): void {
    const chip = this.$<HTMLElement>('.overflow-chip');
    const menu = chip?.querySelector<HTMLElement>('sherpa-menu');
    const drill = this.#drill;
    if (!menu || !drill) return;

    // Back to the filter's own menu — the chip was parked off-screen, not emptied.
    drill.home.replaceChildren(...menu.childNodes);
    menu.replaceChildren(...drill.rows);
    this.#drill = null;

    menu.removeAttribute('data-drill');
    delete menu.dataset['drillFrom'];
    // Deferred: the badges are stamped back in below and would be read too early.
    queueMicrotask(() => this.#syncFoldedBadges());
    menu.setAttribute('data-heading', 'More filters');
    // TRAP T-drill-flags-travel-and-replace — hand every mode back, strip the list.
    for (const flag of SherpaQuickFilterToolbar.DRILL_FLAGS) {
      const value = menu.getAttribute(flag);
      if (value == null) drill.home.removeAttribute(flag);
      else drill.home.setAttribute(flag, value);
      menu.removeAttribute(flag);
    }
  }

  /**
   * Does the chip run want more room than it has?
   *
   * TRAP T-overflowing-needs-1px-slack — the +1 and the forced layout both matter.
   */
  #overflowing(): boolean {
    const chips = this.$('.chips');
    return !!chips && chips.scrollWidth > chips.clientWidth + 1;
  }

  /** Put every chip back on the bar, before a fresh measurement. */
  #showAllChips(): void {
    for (const chip of this.$$<HTMLElement>('.chips > .chip')) {
      chip.removeAttribute('data-folded-away');
    }
  }

  #onResize = (): void => {
    /* ONE measure per frame — a resize drag fires this per pixel and each pass
       reads layout.

       TRAP T-resize-reschedule-never-drop — cancel and re-queue, never return
       when a frame is already pending. */
    if (this.#frame != null) cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.#reflow();
    });
  };

  override onRender(): void {
    this.addEventListener('quick-filter-click', this.#onChipClick);
    // The cluster is delegated from its own zone, not per button: every control
    // is a sherpa-button firing the same button-click, so one listener reads
    // data-act off whichever one was pressed.
    this.$('.actions-zone')?.addEventListener('button-click', this.#onAction);
    // The organise chips carry MENUS, so their selection arrives as the chip's
    // own quick-filter-change (relayed from <sherpa-menu>), not as a body click.
    // CAPTURE, and the reason is TRAP T-capture-beats-registration-order.
    this.addEventListener('quick-filter-change', this.#onOrganiseChange, true);
    // A folded filter's badge counts what it holds, and that moves without the
    // rows doing — a value ticked while drilled, or the filter's own menu
    // applied. Re-read on every change rather than re-stamping the list, which
    // would rebuild what the reader is looking at.
    this.addEventListener('quick-filter-change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-change', this.#onFoldedCountsChanged);
    // A COMMITTING menu fires nothing while its rows are being ticked — the set
    // is a draft until Apply — so a value picked inside a drill reaches no
    // listener at all. `change` is the native one from the row itself, which
    // does bubble this far: the rows are in the CHIP's light DOM, not behind a
    // second shadow boundary.
    this.addEventListener('change', this.#onFoldedCountsChanged);
    // Action rows (the "Remove" button) report separately from value rows.
    this.addEventListener('menu-select', this.#onMenuSelect);
    // A CALENDAR commits through its own events, not through the menu's. An
    // auto-applying date chip has no Apply button, so without these its label
    // only ever caught up when something else happened to re-render the bar.
    this.addEventListener('datetime-change', this.#onDatePicked);
    this.addEventListener('range-select', this.#onDatePicked);
    // The RANGE switch on a number or date menu. sherpa-switch re-dispatches its
    // native change as a COMPOSED one, so this reaches here where a bare
    // checkbox's would not.
    this.addEventListener('change', this.#onRangeToggle);
    // The ADD menu hangs off a sherpa-BUTTON, which — unlike a chip — does not
    // relay menu-change as quick-filter-change. So its commit is heard directly.
    this.addEventListener('menu-change', this.#onAddCommit as EventListener);
    if (this.#filters.length) this.#render();
    if (this.#organise.group?.length || this.#organise.sort?.length) this.#renderOrganise();
    if (this.#available.length) this.#renderAvailable();

    // CLICK, not hover (TRAP T-drill-moves-not-clones): a drill replaces what is
    // on screen, and a pointer passing over a row would move the list out from
    // under it.
    this.addEventListener('click', this.#onFoldedClick, true);
    // BACK out of a drill. The arrow is two shadow boundaries away, so the menu
    // re-emits its click as a composed `menu-back`.
    this.addEventListener('menu-back', this.#drillOutHandler);

    this.#observer = new ResizeObserver(this.#onResize);
    const bar = this.$('.bar');
    if (bar) this.#observer.observe(bar);
  }

  override onDisconnect(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    if (this.#frame != null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }

  /**
   * populate([{ id, label, type?, active?, icon?, options? }]) — the filter chips.
   *
   * TRAP T-toggle-chip-has-no-count — why there is no `count`.
   */
  protected override renderData(data: unknown): void {
    this.#filters = Array.isArray(data) ? (data as QuickFilterDef[]) : [];
    this.#render();
  }

  /**
   * The ids of the currently-active TOGGLE chips, in order.
   *
   * TRAP T-toggle-chips-have-no-field — a MENU chip is deliberately left out;
   * its picks live in `values`.
   */
  get active(): string[] {
    return this.#chips()
      .filter((c) => c.current && !c.hasAttribute('data-menu'))
      .map((c) => c.dataset['id'] ?? '');
  }

  /**
   * The LIVE value constraints, keyed by chip id.
   *
   * TRAP T-values-reports-on-chips-in-one-shape — ON chips only, always an
   * array; `pickedValues` reads a suspended chip's remembered picks.
   */
  get values(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const chip of this.#chips()) {
      if (!chip.hasAttribute('data-menu')) continue;
      // OFF = this field is not being filtered. The picks survive; they are just
      // not applied.
      if (!chip.hasAttribute('data-current')) continue;
      const id = chip.dataset['id'];
      if (!id) continue;
      const picked = this.#chipPicks(chip);
      if (picked.length) out[id] = picked;
    }
    return out;
  }

  /**
   * Set every chip from a view definition — `{ region: ['EMEA'], plan: ['Pro'] }`.
   *
   * TRAP T-values-reports-on-chips-in-one-shape — REPLACES the whole set, and is
   * SILENT.
   */
  set values(next: Record<string, readonly string[]>) {
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'];
      if (!id || !chip.hasAttribute('data-menu')) continue;
      const wanted = next[id];
      // Persistent (see `persistent`): never switched off, but it still FOLLOWS
      // a pick. Not naming one leaves it as it is.
      if (chip.hasAttribute('data-persistent')) {
        if (wanted?.length) chip.values = wanted;
        continue;
      }

      if (wanted?.length) {
        // The CHIP owns its own face — label, badge, tooltip, on/off — so it
        // sets them, not this bar. Writing them from here was two places
        // deriving one thing, which is the bug this whole model exists to stop.
        chip.values = wanted;
      } else {
        // NOT named by the view: off, but its picks survive. "Off" and "gone"
        // are different states, and collapsing them makes a reader re-choose
        // every time they look at another view.
        chip.current = false;
      }
    }
  }

  /**
   * Every menu chip's picks, on or OFF.
   *
   * The counterpart to `values`: this is what the chip REMEMBERS, which is what a
   * "restore my view" feature needs, whereas `values` is what is being applied.
   */
  get pickedValues(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const chip of this.#chips()) {
      if (!chip.hasAttribute('data-menu')) continue;
      const id = chip.dataset['id'];
      if (!id) continue;
      const picked = this.#chipPicks(chip);
      if (picked.length) out[id] = picked;
    }
    return out;
  }

  /**
   * What one chip's menu holds — the values ticked, or the day picked.
   *
   * TRAP T-values-reports-on-chips-in-one-shape — a DATE chip reports its day as
   * a single-entry array, and a range two, for the one-shape rule.
   */
  #chipPicks(chip: HTMLElement): string[] {
    // A chip whose rows are currently DRILLED INTO the overflow menu reports
    // from there. The rows are moved, not copied — there is one set of inputs
    // and this is where they are right now — so reading the chip's own empty
    // menu would say "nothing picked" for a filter the user is editing.
    if (this.#drill && this.#drill.home === chip.querySelector('sherpa-menu')) {
      const live = this.$<HTMLElement & { values: string[] }>('.overflow-chip');
      const menu = live?.querySelector<HTMLElement & { values: string[] }>('sherpa-menu');
      if (menu) return menu.values;
    }
    // A NUMBER chip's menu reports its own value — one number, or the two ends
    // of its range — because the menu is what knows which shape its Range switch
    // has it in. Reading it here as well would be the same rule written twice.
    if (chip.querySelector('.qf-number')) {
      const menu = chip.querySelector<HTMLElement & { values: string[] }>('sherpa-menu');
      return menu?.values ?? [];
    }

    const cal = chip.querySelector<HTMLElement>('sherpa-calendar');
    if (cal) {
      const start = cal.dataset['valueStart'];
      const end = cal.dataset['valueEnd'];
      if (start && end) return [start, end];
      const value = cal.dataset['value'];
      return value ? [value] : [];
    }
    // NON_VALUE_ROWS, not a local `.qf-all` — see that constant for what a row
    // has to be to count as a pick.
    return Array.from(chip.querySelectorAll<HTMLInputElement>('input:checked'))
      .filter((i) => !i.closest(NON_VALUE_ROWS))
      .map((i) => i.value);
  }

  /**
   * Show a date chip's chosen day in its own label.
   *
   * TRAP T-date-label-reads-in-full — UTC, day-then-month, in full, no badge.
   */
  #syncDateLabel(chip: HTMLElement): void {
    const cal = chip.querySelector<HTMLElement>('sherpa-calendar');
    if (!cal) return;
    const picked = this.#chipPicks(chip);
    const target = chip as HTMLElement & { valueLabel?: string };
    if (!picked.length) {
      if ('valueLabel' in target) target.valueLabel = '';
      return;
    }
    // The ISO string is parsed as UTC, so it is FORMATTED as UTC too — otherwise
    // a browser west of Greenwich renders the previous day.
    const at = (iso: string): Date | null => {
      const d = new Date(`${iso}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    // DAY THEN MONTH, always — "03 Sep", never "Sep 03". `toLocaleDateString`
    // orders the parts by locale, so a US reader got the month first and the
    // shape the design asks for was lost. formatToParts gives the localised
    // MONTH NAME (which should follow the reader's locale) while this code keeps
    // the order (which should not).
    const dayMonth = (d: Date): string => {
      const parts = new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
      }).formatToParts(d);
      const day = parts.find((x) => x.type === 'day')?.value ?? '';
      const month = parts.find((x) => x.type === 'month')?.value ?? '';
      return `${day} ${month}`;
    };
    const year = (d: Date): string =>
      d.toLocaleDateString(undefined, { year: 'numeric', timeZone: 'UTC' });

    // TRAP T-date-label-reads-in-full — in full, never abbreviated, and the
    // year is stated once at the end when both ends share it.
    const start = at(picked[0]!);
    const end = picked.length > 1 ? at(picked[1]!) : null;

    let label: string;
    if (!start) label = picked[0]!;
    else if (!end) label = `${dayMonth(start)}, ${year(start)}`;
    else if (year(start) === year(end)) {
      label = `${dayMonth(start)} - ${dayMonth(end)}, ${year(start)}`;
    } else {
      label = `${dayMonth(start)}, ${year(start)} - ${dayMonth(end)}, ${year(end)}`;
    }
    if ('valueLabel' in target) target.valueLabel = label;

    // NO COUNT BADGE. The label says both days outright, so a "2" beside it
    // would only repeat how many are in the sentence already read.
    delete chip.dataset['count'];
  }

  #chips(): ChipEl[] {
    return this.$$<ChipEl>('.chips > .chip');
  }

  #render(): void {
    const list = this.$('.chips');
    const tpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!list || !tpl) return;

    // TRAP T-render-captures-live-state — the live DOM is the only record of what
    // the user did since; `data-reset-on-populate` opts out.
    const live = new Map<string, { on: boolean; picked: Set<string> }>();
    if (!this.hasAttribute('data-reset-on-populate')) {
      for (const chip of this.#chips()) {
        const id = chip.dataset['id'];
        if (!id) continue;
        live.set(id, {
          on: chip.hasAttribute('data-current'),
          picked: new Set(this.#chipPicks(chip)),
        });
      }
    }

    list.replaceChildren();
    // TRAP T-custom-element-upgrade — `valueLabel` is a PROPERTY, so its writes
    // are held and replayed after the whole run is appended.
    const customLabels: Array<[HTMLElement, string]> = [];
    for (const f of this.#filters) {
      const chip = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const prior = live.get(f.id);
      chip.dataset['id'] = f.id;
      chip.setAttribute('data-label', f.label);
      if (f.type) chip.setAttribute('data-type', f.type);
      // The chip's LIVE state wins over its definition's; a chip the user has
      // never touched has no live entry and falls back to `active`.
      if (prior ? prior.on : f.active) chip.setAttribute('data-current', '');
      // The view selector's glyph is the toolbar's to decide, not the app's —
      // see #icons.view. Any other chip takes whatever icon it was given.
      const glyph = f.id === 'view' ? SherpaQuickFilterToolbar.#icons.view : f.icon;
      if (glyph) chip.setAttribute('data-icon-start', glyph);
      // A selector, not a toggle: always on, and its body does not flip it.
      if (f.persistent) {
        chip.setAttribute('data-persistent', '');
        chip.setAttribute('data-current', '');
      }
      // A DATE chip's menu is a calendar and a NUMBER chip's is a field or a
      // slider, so neither carries `options` — the menu is stamped on kind as
      // well as on having values to list.
      const hasOwnContent = f.kind === 'date' || f.kind === 'number';
      if (f.options?.length || hasOwnContent) this.#addMenu(chip, f, prior?.picked);
      // A CUSTOM chip's value was typed, not picked, so there is no list to open
      // and no menu to build. The finished phrase goes onto the caret through
      // the chip's own `valueLabel` setter — the same door a date chip's
      // formatted day uses, and for the same reason: the value is not the
      // chip's to derive, only to show.
      if (f.customValue) {
        // `data-custom` is what makes it findable: it is in neither `active`
        // (which skips menu chips) nor `values` (which reads ticked rows).
        chip.setAttribute('data-custom', '');
        chip.setAttribute('data-menu', '');
        // It reads in FULL: "Contains: ana" truncated to "Contains: a…" names a
        // condition whose subject the reader cannot see.
        chip.setAttribute('data-full-value', '');
        // No menu is slotted, so the caret click is already a no-op (it calls
        // `this.menu?.toggle?.()`). The caret is still DRAWN, because that is
        // where the value reads — it just opens nothing.
        customLabels.push([chip, f.customValue]);
      }
      list.appendChild(chip);
      // A date chip's label carries its chosen day, so it has to be re-derived
      // after a rebuild like everything else.
      if (f.kind === 'date') {
        // A date range reads in full — see #syncDateLabel. Every part of
        // "03 Sep - 18 Oct, 2026" carries meaning, and there is no count that
        // could stand in for a truncated end.
        chip.setAttribute('data-full-value', '');
        this.#syncDateLabel(chip);
      }
    }

    // TRAP T-custom-element-upgrade — `valueLabel` writes into the chip's shadow
    // root, so they wait on `el.rendered`.
    for (const [chip, text] of customLabels) {
      const el = chip as HTMLElement & { valueLabel?: string; rendered?: Promise<void> };
      void Promise.resolve(el.rendered).then(() => { el.valueLabel = text; });
    }

    // The run just changed, so what fits has changed with it. The ResizeObserver
    // only fires on a size change, and populating a bar that was already its
    // final width is not one — without this, a bar loaded with eleven chips
    // stayed overflowing until the window happened to be resized.
    this.#onResize();
  }

  /**
   * Give a chip its value menu: a <sherpa-menu> of real checkbox/radio rows in the
   * chip's light DOM. Cloned from the menu prototypes in the template, so no
   * structural innerHTML is written.
   */
  #addMenu(chip: HTMLElement, def: QuickFilterDef, picked?: Set<string>): void {
    const rowTpl = this.$<HTMLTemplateElement>('template.qf-row-tpl');
    const menu = this.clone('template.qf-menu-tpl');
    if (!rowTpl || !menu) return;

    const single = def.select === 'single';
    menu.setAttribute('data-heading', def.label);
    // The prototype carries slot="menu" for a CHIP; a sherpa-button names the
    // same slot, so the one prototype serves both.
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-select', single ? 'single' : 'multiple');
    // TRAP T-commit-follows-select-mode — including why a DATE or NUMBER chip
    // counts as single, and why RANGE mode defers (see #onRangeToggle).
    const picksOne = (def.kind === 'date' || def.kind === 'number') && !def.range;
    const defers = def.commit ?? (!single && !picksOne);
    if (defers) menu.setAttribute('data-commit', '');
    // TRAP T-every-chip-menu-gets-clear-and-search — Clear is a HEADER button,
    // a persistent chip gets none, and every value menu gets a search.
    if (!def.persistent) menu.setAttribute('data-clearable', '');
    menu.setAttribute('data-search', '');
    // The card stays inside the region the HOST names, not merely the window —
    // a menu hanging over the nav or out of a panel belongs to neither. The
    // toolbar passes its own `data-bounds` straight through; without one the
    // menu falls back to the viewport, which is what it always used.
    const bounds = this.dataset['bounds'];
    if (bounds) menu.setAttribute('data-bounds', bounds);

    // A NUMBER chip's menu holds a Range switch over either one field or a
    // two-ended slider. Both exist from the start and CSS reveals one, so the
    // switch is an attribute write rather than a rebuild — and whatever was
    // typed on the other side survives a flip back.
    if (def.kind === 'number') {
      // Nothing to search: there is no list, only a value to type or drag.
      menu.removeAttribute('data-search');
      this.#addRangeSwitch(menu, def);
      const box = this.clone('template.qf-number-tpl');
      if (box) {
        const slider = box.querySelector('sherpa-slider');
        const field = box.querySelector('input');
        // The bounds are the SLIDER's ends and the field's clamp, so typing 500
        // into a 0..100 filter cannot ask for a row that cannot exist.
        const min = def.min ?? 0;
        const max = def.max ?? 100;
        for (const el of [slider, field]) {
          if (!el) continue;
          el.setAttribute('min', String(min));
          el.setAttribute('max', String(max));
          if (def.step != null) el.setAttribute('step', String(def.step));
        }
        // A fresh range spans the WHOLE span, so the filter starts by excluding
        // nothing — a slider that opened at 0..0 would empty the view before the
        // user had asked it anything.
        slider?.setAttribute('value-start', String(min));
        slider?.setAttribute('value-end', String(max));
        menu.appendChild(box);
      }
      this.#addRemove(chip, menu, def);
      chip.setAttribute('data-menu', '');
      chip.appendChild(menu);
      return;
    }

    // A DATE chip's menu holds a CALENDAR instead of value rows. Everything
    // above — the heading, the commit mode — is the same, so a date filter
    // applies exactly like any other chip.
    if (def.kind === 'date') {
      // The RANGE switch comes FIRST, above the calendar — it decides what the
      // calendar below it is, so reading it after the grid would be backwards.
      this.#addRangeSwitch(menu, def);
      const calTpl = this.$<HTMLTemplateElement>('template.qf-calendar-tpl');
      if (calTpl) {
        const cal = calTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        // The calendar's own two-ended mode, which it already has: `range` is a
        // two-click start→end selection with the days between banded.
        if (def.range) cal.setAttribute('data-type', 'range');
        // The days that exist in the data. Absent leaves every day pickable —
        // see `availableDates`.
        if (def.availableDates) {
          cal.setAttribute('data-available', def.availableDates.join(','));
        }
        // TRAP T-calendar-header-has-no-heading — a calendar is not a list to
        // search, so the header's second row is the month stepper; CLEAR stays,
        // because a date chip had no other way back to "no date".
        menu.removeAttribute('data-search');
        // The Menu set's own `Type = Calendar` variant: a wider card whose list
        // region runs horizontally. The calendar is the CONTENT, the menu the card.
        menu.setAttribute('data-type', 'calendar');
        menu.appendChild(cal);
      }
      this.#addRemove(chip, menu, def);
      chip.setAttribute('data-menu', '');
      chip.appendChild(menu);
      return;
    }

    // TRAP T-persistent-chip-is-a-selector — no pick at all falls back to the
    // FIRST option; without it the view chip painted WARNING.
    const options = def.options ?? [];
    const hasPick = picked ? picked.size > 0 : options.some((o) => o.selected);
    const fallback = def.persistent && !hasPick ? options[0]?.value : undefined;

    const isOn = (option: QuickFilterOption): boolean =>
      picked
        ? picked.has(option.value) || option.value === fallback
        : !!option.selected || option.value === fallback;

    const addRow = (option: QuickFilterOption): void => {
      const row = rowTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const input = row.querySelector('input')!;
      input.type = single ? 'radio' : 'checkbox';
      input.value = option.value;
      if (single) input.name = `qf-${def.id}`;
      // A LIVE pick beats the definition's `selected`: the set is what the user
      // has ticked since, and is absent only for a chip being built for the
      // first time.
      // The fallback is the LAST word only where there is no pick at all — a
      // live set that the user has emptied is still an answer for an ordinary
      // chip, and `fallback` is undefined there because it is persistent-only.
      input.checked = isOn(option);
      // Marks the row as one the current filters cannot reach. CSS dims it; the
      // row stays selectable, because a user broadening a filter back out needs
      // the way through.
      if (option.available === false) row.setAttribute('data-unavailable', '');
      row.querySelector('.qf-row-label')!.textContent = option.label;
      menu.appendChild(row);
    };

    // THE ORDER: Select all/Clear all (multi only) · available · divider ·
    // unavailable. SPLIT, not sorted by a flag — two groups with a rule between
    // them say "these are different" where a scattered dimmed row does not.
    if (!single) this.#addSelectAll(menu, options);

    const reachable = options.filter((o) => o.available !== false);
    const unreachable = options.filter((o) => o.available === false);
    for (const option of reachable) addRow(option);
    // The divider only earns its place when there is something on BOTH sides —
    // a rule above an empty group, or below one, is a line to nowhere.
    if (reachable.length && unreachable.length) {
      const hr = this.clone('template.qf-divider-tpl');
      if (hr) menu.appendChild(hr);
    }
    for (const option of unreachable) addRow(option);

    this.#addRemove(chip, menu, def);

    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
  }

  /**
   * Whether this chip's commit mode was PINNED by its definition.
   *
   * A host that named `commit` meant it either way, so the Range switch must not
   * move it — the switch only supplies the default the definition left out.
   */
  #chipDefers(sw: HTMLElement): boolean {
    const id = sw.closest<HTMLElement>('.chip')?.dataset['id'];
    if (!id) return false;
    return this.#filters.some((f) => f.id === id && f.commit != null);
  }

  /**
   * Put the RANGE switch at the top of a number or date menu.
   *
   * TRAP T-range-switch-swaps-not-rebuilds — one filter, two shapes, nothing rebuilt.
   */
  #addRangeSwitch(menu: HTMLElement, def: QuickFilterDef): void {
    const row = this.clone('template.qf-range-tpl');
    if (!row) return;
    const sw = row.querySelector('sherpa-switch');
    if (def.range) {
      sw?.setAttribute('checked', '');
      menu.setAttribute('data-range', '');
    }
    menu.appendChild(row);
  }

  /**
   * The Range switch was flipped — swap the menu between its two shapes.
   *
   * sherpa-switch re-dispatches its native change as a COMPOSED one, so unlike
   * the value rows this does cross the shadow boundary and can be heard here.
   */
  #onRangeToggle = (event: Event): void => {
    // The change starts on the switch's own inner <input> — see `pathFind`.
    const sw = this.pathFind(event, '.qf-range-switch');
    if (!sw) return;
    const on = (sw as HTMLElement & { checked: boolean }).checked;
    const menu = sw.closest('sherpa-menu');
    if (!menu) return;
    menu.toggleAttribute('data-range', on);
    // A RANGE has two ends, so the pick is not finished on the first one —
    // applying there would filter to a span the user has not named yet. Single
    // mode holds one value and applies on the tick, as it always did. A chip
    // whose definition named `commit` keeps what it asked for.
    if (!this.#chipDefers(sw)) menu.toggleAttribute('data-commit', on);
    // A CALENDAR reads the mode as its own type: `range` is a two-click
    // start→end selection with the days between banded. Its previous single
    // pick is left alone — re-picking is how a range is started anyway.
    menu.querySelector('sherpa-calendar')?.setAttribute('data-type', on ? 'range' : 'single');
    // The filter's SHAPE changed, so what it means changed with it — a host
    // reading `values` needs to hear that even though no value moved.
    this.#emitChange();
  };

  /**
   * Put a "Select all / Clear all" row at the top of a MULTI-select menu.
   *
   * TRAP T-select-all-is-not-a-value — one row, not two, and its label.
   * TRAP T-native-change-stops-at-the-host — stamped here, owned by the menu. A
   * SINGLE menu gets none: you cannot select all of a set of radios.
   */
  #addSelectAll(menu: HTMLElement, options: readonly QuickFilterOption[]): void {
    if (!options.length) return;
    const row = this.clone('template.qf-all-tpl');
    if (row) menu.appendChild(row);
  }

  /**
   * Give a chip's menu its "Remove" action — a FOOTER BUTTON.
   *
   * TRAP T-remove-is-opt-in-and-a-footer-button — why a footer button, why
   * opt-in, and what it emits.
   */
  #addRemove(chip: HTMLElement, menu: HTMLElement, def: QuickFilterDef): void {
    if (!chip.classList.contains('chip')) return;
    if (!def.removable || def.persistent) return;
    menu.setAttribute('data-removable', '');
  }

  /**
   * A "Remove" row was clicked — take that chip off the bar.
   *
   * The menu fires `menu-select` for ACTION rows (buttons), separately from the
   * `menu-change` its value rows commit on Apply, so a remove never has to be
   * told apart from a value pick.
   */
  #onMenuSelect = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== 'remove') return;
    // TRAP T-remove-matches-the-tag-not-the-class — the PATH, and the TAG.
    const chip = this.pathFind(event, 'sherpa-quick-filter');
    const id = chip?.dataset['id'];
    if (!id) return;
    event.stopImmediatePropagation();
    // Shut the menu first: it is about to be removed from the DOM with its chip,
    // and a popover destroyed while open leaves the top layer confused.
    (chip.querySelector('sherpa-menu') as HTMLElement & { hide?: () => void })?.hide?.();
    this.#removeFilter(id);
  };

  #onChipClick = (event: Event): void => {
    // quick-filter-click is composed → find the originating chip on the path.
    const path = event.composedPath();

    // The SORT chip's body is a TRI-STATE toggle: asc → desc → off. "Off" does
    // NOT clear the chosen column — it suspends the sort, so one more click
    // brings the same column back ascending. The column itself only changes from
    // the menu.
    const sortChip = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.dataset['id'] === 'sort',
    );
    if (sortChip?.classList.contains('organise-chip')) {
      // IMMEDIATE, for the reason given on the capture listener in onRender.
      event.stopImmediatePropagation();
      this.#cycleSort(sortChip);
      return;
    }

    /* THE GROUP CHIP'S BODY IS A TWO-STATE TOGGLE, and it needs its own branch
       for the same reason Sort does: the loop below looks for `.chip`, and an
       organise chip is a `.organise-chip`. Without this the Group chip flipped
       its own `data-current` off, looked ungrouped, and told nobody — the grid
       stayed grouped while the chip said it was not.

       Unlike Sort there is no third state: grouping is on or off, and turning
       it off CLEARS the pick, because a chip remembering a column it is not
       grouping by would report a grouping that is not running.
       TRAP T-group-chip-body-toggles-grouping. */
    const groupChip = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.dataset['id'] === 'group',
    );
    if (groupChip?.classList.contains('organise-chip')) {
      event.stopImmediatePropagation();
      this.#toggleGroup(groupChip);
      return;
    }

    const chip = path.find(
      (n): n is ChipEl => n instanceof HTMLElement && n.classList.contains('chip'),
    );
    if (!chip) return;

    // A persistent chip has ALREADY flipped itself off by the time this fires —
    // a chip is a two-state toggle by default — so put it back. See `persistent`.
    if (chip.hasAttribute('data-persistent')) {
      chip.toggleAttribute('data-current', true);
      return;
    }
    this.#emitChange();
  };

  override onChange(): void {
    this.#syncSortFromAttrs();
    this.#syncGroupFromAttrs();
  }

  /**
   * Point the Sort chip at whatever `data-sort-field` says.
   *
   * TRAP T-a-chip-body-cycles-its-states — no event, and empty SUSPENDS.
   */
  #syncSortFromAttrs(): void {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    if (!chip) return;

    const field = this.dataset['sortField'] ?? '';
    const direction = this.dataset['sortDirection'] === 'desc' ? 'desc' : 'asc';

    // NO FIELD means no sort — the chip goes off but keeps its pick, the same
    // suspended state its own third click produces.
    if (!field) {
      chip.removeAttribute('data-current');
      this.#syncSortLabel(chip);
      return;
    }

    for (const radio of chip.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.checked = radio.value === field;
    }
    chip.dataset['direction'] = direction;
    chip.toggleAttribute('data-current', true);
    this.#syncSortLabel(chip);
  }

  /**
   * Point the Group chip at whatever `data-group-field` says.
   *
   * The twin of `#syncSortFromAttrs` — both organise chips are single-select,
   * and both SUSPEND on empty rather than clearing.
   * TRAP T-a-chip-body-cycles-its-states — why this door exists, and why it
   * emits no event.
   */
  #syncGroupFromAttrs(): void {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="group"]');
    if (!chip) return;

    const field = this.dataset['groupField'] ?? '';

    /* NO FIELD means ungrouped — SUSPENDED, exactly as a sort is, and the pick
       is KEPT. A chip's body cycles its states; off is one of those states,
       not a delete. Group has two and Sort has three, and neither throws the
       column away: one more click brings the same grouping back without
       re-picking it. T-grid-suspend-is-not-clear. */
    if (!field) {
      chip.removeAttribute('data-current');
      this.#syncGroupLabel(chip);
      return;
    }

    for (const radio of chip.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.checked = radio.value === field;
    }
    chip.toggleAttribute('data-current', true);
    this.#syncGroupLabel(chip);
  }

  /** Name the grouped column in the Group chip's caret, or leave it blank. */
  #syncGroupLabel(chip: HTMLElement): void {
    const column = this.#organise.group?.find((c) => c.field === this.#menuValue('group'));
    const target = chip as HTMLElement & { valueLabel?: string };
    if ('valueLabel' in target) {
      target.valueLabel = chip.hasAttribute('data-current') ? column?.label ?? '' : '';
    }
  }

  /**
   * Report the whole filter state: the active toggle chips AND every menu chip's
   * picks.
   *
   * TRAP T-toggle-chips-have-no-field — why `active` alone could not describe a
   * menu chip.
   */
  #emitChange(): void {
    this.emit('quick-filter-change', {
      // TRAP T-values-carries-two-shapes — the marker says outright WHICH shape
      // this is, instead of leaving a host to guess (and empty the grid).
      scope: 'bar',
      active: this.active,
      // What is APPLIED — only the chips that are ON.
      values: this.values,
      // What is REMEMBERED — including chips toggled off, whose picks survive.
      picked: this.pickedValues,
      // TRAP T-custom-chips-are-reported-separately — a custom chip is in
      // neither list above, so it needs its own.
      custom: this.customFilters,
    });
  }

  /**
   * Every CUSTOM chip and whether it is on — `{ 'col:name': true }`.
   *
   * TRAP T-custom-chips-are-reported-separately — a typed value has no rows to
   * read back, so its on/off state is the whole answer.
   */
  get customFilters(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const chip of this.#chips()) {
      if (!chip.hasAttribute('data-custom')) continue;
      out[chip.dataset['id'] ?? ''] = chip.current;
    }
    return out;
  }

  /**
   * Advance the sort chip: ascending → descending → suspended → ascending …
   *
   * TRAP T-sort-is-tri-state — undo the chip's own flip, rewind the direction,
   * and give OFF its own glyph.
   */
  /**
   * Flip grouping on or off from the chip's body.
   *
   * SUSPEND, NEVER CLEAR — the rule every other chip follows
   * (`T-grid-suspend-is-not-clear`). Off means "stop applying this", not
   * "delete it": the radio keeps its column, so one more click brings the same
   * grouping back without re-picking it from the menu.
   *
   * The chip has ALREADY flipped its own `data-current`, so this reads the new
   * state rather than setting it.
   *
   * TRAP T-group-chip-body-toggles-grouping.
   */
  #toggleGroup(chip: HTMLElement): void {
    /* Turning it ON with nothing ever picked would light a chip that groups
       nothing — the host writes `data-group-field=""` straight back and the
       chip corrects itself a tick later, which reads as a flicker. That is a
       chip with NO pick, not a suspended one, and it stays off. */
    if (chip.hasAttribute('data-current') && !this.#menuValue('group')) {
      chip.removeAttribute('data-current');
    }
    this.#syncGroupLabel(chip);
    // REPORTS, as every chip does — the host owns the grouping and writes
    // `data-group-field` back, which `#syncGroupFromAttrs` then reflects.
    this.emit('group-change', { field: this.groupField });
  }

  #cycleSort(chip: HTMLElement): void {
    // The chip has ALREADY flipped its own data-current, so undo that first.
    const live = !chip.hasAttribute('data-current');
    const direction = chip.dataset['direction'] === 'desc' ? 'desc' : 'asc';

    if (!live) {
      // Suspended → back on, in the direction it was left in.
      chip.toggleAttribute('data-current', true);
    } else if (direction === 'asc') {
      chip.dataset['direction'] = 'desc';
      chip.toggleAttribute('data-current', true);
    } else {
      // Descending → SUSPENDED. The column survives; only the direction rewinds.
      chip.removeAttribute('data-current');
      chip.dataset['direction'] = 'asc';
    }

    this.#syncSortLabel(chip);
    this.emit('sort-change', { field: this.sortField, direction: this.sortDirection });
  }

  /**
   * Show the sort chip's state in its own label and icon.
   *
   * TRAP T-sort-is-tri-state — the CHIP says "Sort"; the COLUMN reads in the caret.
   */
  #syncSortLabel(chip: HTMLElement): void {
    const live = chip.hasAttribute('data-current');
    const desc = chip.dataset['direction'] === 'desc';
    const column = this.#organise.sort?.find((c) => c.field === this.#menuValue('sort'));
    chip.setAttribute('data-label', 'Sort');
    const target = chip as HTMLElement & { valueLabel?: string };
    // A SUSPENDED sort keeps its column, so the caret still names it.
    if ('valueLabel' in target) target.valueLabel = column?.label ?? '';
    const { sortNone, sortAsc, sortDesc } = SherpaQuickFilterToolbar.#icons;
    chip.setAttribute('data-icon-start', !live ? sortNone : desc ? sortDesc : sortAsc);
  }

  /**
   * available([...]) — the filters the Add chip offers.
   *
   * The filters a user may add OVER the populate() defaults.
   * TRAP T-add-menu-batches — the Add control's shape, and what picking one does.
   */
  available(defs: QuickFilterDef[]): void {
    this.#available = Array.isArray(defs) ? defs : [];
    this.#renderAvailable();
  }

  /** Stamp the Add button's menu from whatever is left to add. */
  #renderAvailable(): void {
    const add = this.$<HTMLElement>('.add-btn');
    if (!add) return;
    // Nothing left to add — the button would open an empty list, so it is
    // disabled rather than lying about what it can do.
    const any = this.#available.length > 0;
    this.toggleAttribute('data-can-add', any);
    add.toggleAttribute('disabled', !any);
    add.querySelector('sherpa-menu')?.remove();
    if (!any) return;
    this.#addMenu(add, {
      id: 'add',
      label: 'Add filter',
      // MULTI-select: adding filters is a batch job — a user setting up a view
      // wants three of them, and a single-select menu made that three separate
      // open-pick-apply rounds.
      select: 'multiple',
      // …and the one menu that KEEPS its Apply footer now that chips auto-apply.
      // Each tick here STAMPS A CHIP onto the bar, so applying per tick would
      // rebuild the run three times mid-selection and close the list out from
      // under the user. Batching is the whole point of the control.
      commit: true,
      options: this.#available.map((f) => ({ value: f.id, label: f.label })),
    });
    // A long field list is what a search is for.
    add.querySelector('sherpa-menu')?.toggleAttribute('data-search', true);
  }

  /** Move the chosen available filters onto the bar. */
  #addFilters(ids: string[]): void {
    const added: QuickFilterDef[] = [];
    for (const id of ids) {
      const i = this.#available.findIndex((f) => f.id === id);
      if (i < 0) continue;
      const [def] = this.#available.splice(i, 1);
      // ON on arrival: a filter you just chose should be doing something. And
      // REMOVABLE: a chip the user put on the bar is one they may take off
      // again, so the Add path grants the opt-in the host did not have to.
      added.push({ ...def!, active: true, removable: true });
    }
    if (!added.length) return;
    this.#filters = [...this.#filters, ...added];
    this.#render();
    this.#renderAvailable();
    // ONE event for the batch, not one per filter — a host re-queries once.
    this.emit('filter-add', { ids: added.map((f) => f.id), filters: added });
    this.#emitChange();
  }

  /**
   * Take one filter back OFF the bar.
   *
   * TRAP T-add-menu-batches — it goes back to the Add menu, clean.
   */
  #removeFilter(id: string): void {
    const i = this.#filters.findIndex((f) => f.id === id);
    if (i < 0) return;
    const [def] = this.#filters.splice(i, 1);
    const { active: _active, ...clean } = def!;
    this.#available = [...this.#available, clean as QuickFilterDef];
    this.#render();
    this.#renderAvailable();
    this.emit('filter-remove', { id, filter: clean });
    this.#emitChange();
  }

  /* ── Action cluster ────────────────────────────────────────────────── */

  /**
   * One listener for the whole cluster.
   *
   * Every control fires the same `button-click`, so the ACTION is read off
   * `data-act` — a new button needs one map line, not new wiring. The event
   * names are Figma's own.
   */
  #onAction = (event: Event): void => {
    const path = event.composedPath();
    const btn = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && !!n.dataset['act'],
    );
    if (!btn) return;

    switch (btn.dataset['act']) {
      case 'ai':
        this.emit('ai-filter-request', {});
        break;
      case 'clear':
        // The undo button RESETS rather than merely announcing: a host should not
        // have to reach into the shadow root to clear chips it did not stamp.
        this.clearAll();
        break;
      case 'configure':
        this.emit('filter-configure', {});
        break;
      case 'refresh':
        this.emit('data-refresh', {});
        break;
      case 'overflow':
        this.emit('filter-overflow', {});
        break;
      case 'save':
        this.emit('view-save', {});
        break;
      case 'view-menu':
        this.emit('view-menu-open', {});
        break;
      case 'favourite':
        this.#toggleFavourite(btn);
        break;
      case 'add':
        // The button IS the trigger now — there is no caret to open the list.
        // Adding a filter always meant "show me the options", so a body/caret
        // split was two controls doing one job.
        this.#openAddMenu(btn);
        break;
    }
  };

  /**
   * The Add menu committed — put the chosen filters on the bar.
   *
   * Heard as `menu-change` rather than `quick-filter-change`: the menu hangs off
   * a sherpa-button, and only a CHIP re-emits its menu's commit under the
   * quick-filter name. A menu on a plain button reports for itself.
   */
  #onAddCommit = (event: Event): void => {
    const add = this.pathFind(event, '.add-btn');
    if (!add) return;
    event.stopImmediatePropagation();
    const picked = (event as CustomEvent).detail?.values as string[] | undefined;
    if (picked?.length) this.#addFilters(picked);
  };

  /**
   * Open the Add button's menu, anchored to the button.
   *
   * `aria-expanded` tracks it so the control announces itself as a menu button,
   * which is what makes a plain <button> an acceptable trigger for a popover.
   */
  #openAddMenu(btn: HTMLElement): void {
    const menu = btn.querySelector<HTMLElement & { show?: (t: HTMLElement) => void }>(
      'sherpa-menu',
    );
    if (!menu) return;
    btn.setAttribute('aria-expanded', 'true');
    menu.addEventListener('menu-close', () => btn.setAttribute('aria-expanded', 'false'), {
      once: true,
    });
    menu.show?.(btn);
  }

  /**
   * Flip the star.
   *
   * TRAP T-favourite-star-swaps-its-glyph — colour alone cannot carry the state.
   */
  #toggleFavourite(btn: HTMLElement): void {
    const on = !this.hasAttribute('data-favourite');
    this.toggleAttribute('data-favourite', on);
    // TRAP T-tokens-css-never-reaches-shadow — `active` is a real Style MODE
    // (see the CSS), which is why THIS sheet paints it.
    if (on) btn.setAttribute('data-status', 'active');
    else btn.removeAttribute('data-status');
    btn.setAttribute('data-icon-start', on ? 'fa-solid fa-star' : 'fa-regular fa-star');
    btn.setAttribute('aria-pressed', String(on));
    this.emit('view-favorite', { favourite: on });
  }

  /**
   * Put a CUSTOM filter on the bar — one whose value is TYPED, not picked.
   *
   * TRAP T-custom-chips-are-reported-separately — why this door exists, what
   * REPLACES, what removes, and what `filter-remove` carries back.
   */
  addCustomFilter(spec: { id: string; label: string; value?: string | null }): void {
    const { id, label, value } = spec;
    const i = this.#filters.findIndex((f) => f.id === id);

    // No value means no filter. Removing rather than leaving a chip that reads
    // "Name:" and narrows nothing.
    if (value == null || value === '') {
      if (i >= 0) {
        this.#filters.splice(i, 1);
        this.#render();
        this.#emitChange();
      }
      return;
    }

    const def: QuickFilterDef = {
      id,
      label,
      active: true,
      // The user typed this one, so it is theirs to remove.
      removable: true,
      // `customValue` is what the chip's caret reads. No `options`, so the chip
      // gets no value menu — there is no list to open, and a caret that opened
      // an empty card would be worse than none.
      customValue: value,
    };

    if (i >= 0) this.#filters[i] = def;
    else this.#filters = [...this.#filters, def];

    this.#render();
    this.#emitChange();
  }

  /**
   * Turn every chip off and drop every picked value.
   *
   * TRAP T-clear-all-resets-organise-too — organise chips included, and the
   * three events fire afterwards.
   */
  clearAll(): void {
    for (const chip of this.#chips()) {
      // TRAP T-persistent-chip-is-a-selector — survives a reset, PICK included.
      if (chip.hasAttribute('data-persistent')) continue;
      chip.removeAttribute('data-current');
      for (const input of chip.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
    }
    for (const chip of this.$$<HTMLElement>('.organise-chip')) {
      chip.removeAttribute('data-current');
      for (const input of chip.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
      if (chip.dataset['id'] === 'sort') {
        chip.dataset['direction'] = 'asc';
        this.#syncSortLabel(chip);
      }
    }
    this.emit('filter-clear', {});
    this.#emitChange();
    this.emit('group-change', { field: null });
    this.emit('sort-change', { field: null, direction: 'asc' });
  }

  /* ── Organise: the leading Group / Sort chips ───────────────────────── */

  /**
   * Glyphs for the organise chips, mirroring the Figma icons page (`group`,
   * `sort-none`, `sort-ascending`, `sort-descending`).
   *
   * TRAP T-organise-glyphs-are-named-not-inline — why they are named, why the
   * four shared ones live in core/icons, and why `view` stays here.
   */
  static readonly #icons = {
    view: 'fa-solid fa-desktop',
    ...ORGANISE_ICONS,
  } as const;

  /**
   * organise({ group: [...], sort: [...] }) — the columns the leading chips offer.
   *
   * TRAP T-organise-chips-lead-the-bar — why this is separate from populate().
   */
  organise(def: OrganiseDef): void {
    this.#organise = def ?? {};
    this.#renderOrganise();
  }

  /**
   * The column the grid is grouped by, or null.
   *
   * TRAP T-a-chip-body-cycles-its-states — null when the chip is OFF, even if
   * its menu still holds a radio.
   */
  get groupField(): string | null {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="group"]');
    if (!chip || !chip.hasAttribute('data-current')) return null;
    return this.#menuValue('group') ?? null;
  }

  /**
   * The column the grid is sorted by, or null.
   *
   * Null while the chip is SUSPENDED (its third state), even though the chip
   * still remembers the column — a suspended sort must not order anything, and a
   * host reading this should see "no sort", not a sort it is expected to ignore.
   */
  get sortField(): string | null {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    if (!chip || !chip.hasAttribute('data-current')) return null;
    return this.#menuValue('sort') ?? null;
  }

  /** Which way that sort runs. Defaults to ascending. */
  get sortDirection(): SortDirection {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    return chip?.dataset['direction'] === 'desc' ? 'desc' : 'asc';
  }

  /** Whether the sort is suspended — a column is picked but not being applied. */
  get sortSuspended(): boolean {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    return !!chip && !chip.hasAttribute('data-current') && !!this.#menuValue('sort');
  }

  /**
   * Stamp the Group and Sort chips into the organise zone.
   *
   * TRAP T-organise-chips-lead-the-bar — both single-select, and why Sort offers
   * each column twice as `field:asc` / `field:desc`.
   */
  #renderOrganise(): void {
    const zone = this.$('.organise-zone');
    const chipTpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!zone || !chipTpl) return;

    const group = this.#organise.group ?? [];
    const sort = this.#organise.sort ?? [];
    zone.replaceChildren();
    // Written by the JS, not inferred: CSS cannot see whether the zone has
    // children, and an empty zone would leave its divider rule floating.
    this.toggleAttribute('data-has-organise', group.length > 0 || sort.length > 0);

    if (group.length) {
      zone.appendChild(
        // fa-SOLID: the free Font Awesome set the examples load has no regular
        // weight for these two glyphs, so `fa-regular` rendered the missing-glyph
        // box. The other toolbar chips (tag, user) are solid for the same reason.
        this.#organiseChip('group', 'Group', SherpaQuickFilterToolbar.#icons.group,
          group.map((c) => ({ value: c.field, label: c.label }))),
      );
    }
    if (sort.length) {
      // The MENU picks the column; the chip BODY cycles the direction. Listing
      // each column twice (A-Z and Z-A) doubled a long menu and made "turn the
      // sort off but keep the column" impossible to express.
      // Built in the OFF state, so it opens with the sort-none glyph.
      const chip = this.#organiseChip('sort', 'Sort', SherpaQuickFilterToolbar.#icons.sortNone,
        sort.map((c) => ({ value: c.field, label: c.label })));
      chip.dataset['direction'] = 'asc';
      zone.appendChild(chip);
    }
  }

  /** One organise chip: a menu chip with single-select rows. */
  #organiseChip(
    id: string,
    label: string,
    icon: string,
    options: QuickFilterOption[],
  ): HTMLElement {
    const chip = this.clone('template.qf-tpl');
    if (!chip) throw new Error('sherpa-quick-filter-toolbar: template.qf-tpl is missing or empty');
    chip.classList.remove('chip');
    chip.classList.add('organise-chip');
    chip.dataset['id'] = id;
    chip.setAttribute('data-label', label);
    chip.setAttribute('data-icon-start', icon);
    this.#addMenu(chip, { id, label, select: 'single', options });
    return chip;
  }

  /** The committed value of one organise chip's menu. */
  #menuValue(id: string): string | undefined {
    const chip = this.$(`.organise-chip[data-id="${id}"]`);
    const checked = chip?.querySelector<HTMLInputElement>('input:checked');
    return checked?.value;
  }

  #onOrganiseChange = (event: Event): void => {
    // This listener hears the chips' quick-filter-change AND the toolbar's own
    // (emit() is composed, so it re-enters here). Only act on an event that came
    // from an organise chip, and stop it there so a host listening for
    // quick-filter-change never sees a group/sort pick as a filter change.
    const path = event.composedPath();
    const chip = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('organise-chip'),
    );
    if (!chip) {
      // The ADD chip's menu committed — the user picked a filter to put on the
      // bar. That is not a change to the filter SET's values, it is a change to
      // which chips exist, so it is handled here and never reaches #emitChange
      // as a value edit.
      // A FILTER menu chip committed its selection (Apply). The chip's own event
      // reports one chip's values; the toolbar must re-report the WHOLE state, so
      // swap it for the toolbar-level one.
      const filterChip = path.find(
        (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('chip'),
      );
      if (filterChip) {
        event.stopImmediatePropagation();
        // A menu chip is ON while it holds picks — that is what makes an applied
        // value filter visible in the bar. A persistent one is on even when the
        // pick is empty, because an empty pick is still a view (see `persistent`).
        // Read the chip's OWN picks, not `values`. `values` reports only chips
        // that are already ON, so a chip currently off could never turn itself
        // on by committing — which is every date chip's first pick, since a
        // calendar has no body toggle to switch it on beforehand.
        filterChip.toggleAttribute(
          'data-current',
          filterChip.hasAttribute('data-persistent') || this.#chipPicks(filterChip).length > 0,
        );
        // A date chip carries its chosen day in its label.
        this.#syncDateLabel(filterChip);
        this.#emitChange();
      }
      return;
    }
    // IMMEDIATE (see onRender): without it a host listening on the toolbar
    // itself read a group/sort pick as a filter change.
    event.stopImmediatePropagation();

    // The chip shows itself as ON while it holds a choice, which is what makes an
    // applied grouping visible in the bar (Figma's populated chip treatment).
    const id = chip.dataset['id'];
    const picked = !!this.#menuValue(id ?? '');
    chip.toggleAttribute('data-current', picked);

    if (id === 'group') this.emit('group-change', { field: this.groupField });
    else if (id === 'sort') {
      // Choosing a column from the menu resumes the sort in its remembered
      // direction — the tri-state cycle only runs off the chip BODY.
      this.#syncSortLabel(chip);
      this.emit('sort-change', { field: this.sortField, direction: this.sortDirection });
    }
  };
}

customElements.define('sherpa-quick-filter-toolbar', SherpaQuickFilterToolbar);
