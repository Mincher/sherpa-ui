/**
 * sherpa-quick-filter-toolbar — a row of filter chips above a grid or list.
 *
 * Give it chips with populate([{ id, label, type?, active?, icon?, options? }]). When you
 * click a chip it toggles on or off, and the toolbar fires quick-filter-change
 * with the ids of every chip that's currently on. There's a slot for your own
 * extra buttons — the old add/edit/save-view features are left out on purpose.
 *
 * THE ACTION CLUSTER is built in, following Figma's `Type` axis (Filter Toolbar
 * 150:3688). Both types show:  Add · AI · undo · configure · │ · refresh · ⋮
 * and `data-type="view"` inserts a snapped [★ │ Save │ ▾] group after the
 * divider. This REVERSES an earlier decision to delegate the cluster to an
 * `actions` slot — Figma models it as one component, and every host that
 * mounted a toolbar had to rebuild the same seven buttons. `data-no-actions`
 * hides the cluster for a host that wants the trailing end to itself; the
 * `actions` slot survives for host extras and renders before the cluster.
 *
 * The bar OPENS with a Group and a Sort chip (Figma Filter Toolbar Type=data leads
 * its content slot with two menu chips, then a divider, then the filter chips).
 * Those two change how the grid is ARRANGED rather than which rows survive, so
 * they live in their own zone and fire their own events. Give them columns with
 * organise({ group: [...], sort: [...] }).
 *
 * The Sort chip is TRI-STATE on its body: ascending → descending → suspended.
 * Suspended keeps the chosen column — it turns the sort off temporarily rather
 * than clearing it. The column itself is chosen from the chip's menu.
 *
 * A value-MENU chip is a two-state toggle too: ON filters by the picked values,
 * OFF ignores that field WITHOUT clearing the picks. `values` reports what is
 * applied; `pickedValues` reports what is remembered.
 *
 * @fires quick-filter-change — the active filter set changes. bubbles + composed. detail: { active: string[], values: Record<string, string[]>, picked: Record<string, string[]> }
 * @fires group-change — the group column changed. bubbles + composed. detail: { field: string | null }
 * @fires sort-change — the sort column or direction changed. bubbles + composed. detail: { field: string | null, direction: 'asc' | 'desc' }
 * @fires filter-add — the Add chip's body was clicked. bubbles + composed. detail: {}
 * @fires filter-clear — the undo button reset every chip. bubbles + composed. detail: {}
 * @fires ai-filter-request — the AI button was clicked. bubbles + composed. detail: {}
 * @fires filter-configure — the configure (sliders) button was clicked. bubbles + composed. detail: {}
 * @fires data-refresh — the refresh button was clicked. bubbles + composed. detail: {}
 * @fires filter-overflow — the overflow (⋮) button was clicked. bubbles + composed. detail: {}
 * @fires view-save — Save was clicked (view type). bubbles + composed. detail: {}
 * @fires view-favorite — the star toggled (view type). bubbles + composed. detail: { favourite: boolean }
 * @fires view-menu-open — the Save group's caret was clicked (view type). bubbles + composed. detail: {}
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
   * `false` means the value is still selectable but no row currently carries it,
   * so ticking it changes nothing you can see. Those are sorted BELOW a divider,
   * after the values that would actually narrow the view, so the useful picks
   * come first and the dead ones are still there rather than silently dropped —
   * a value that vanishes reads as a bug, and a user cannot broaden a filter
   * back out through a list that has hidden the way.
   *
   * Absent means available. A host that does not compute reachability gets one
   * flat list, exactly as before.
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
   *   values (default)  checkbox / radio rows built from `options`
   *   number            a value field, or a two-ended slider when Range is on
   *   date              a calendar — one day, or two when Range is on
   *
   * NUMBER and DATE both lead with a Range switch, because each is really one
   * filter with two shapes: "equals this" or "between these two". Two separate
   * chips would make the user choose the shape before they know which they want,
   * and choosing again would mean taking one off the bar and adding the other.
   *
   * `time` will join this list; it is the same calendar with data-has-time, so
   * it is a value here rather than a new template.
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
   * The days a DATE chip's calendar may pick — the ones that exist in the data.
   *
   * ISO strings. Every other day is drawn inactive, so a reader cannot pick a
   * date no record carries and get an empty view back. OMIT IT to leave the
   * calendar unconstrained, which is the override: a host that does not compute
   * availability, or deliberately wants a free picker, simply says nothing.
   *
   * A SET rather than a min/max span, because a column of dates is a scatter —
   * a span would leave every empty day between the first and the last pickable.
   */
  availableDates?: string[];
  /**
   * A value the user TYPED rather than picked, shown on the chip's caret.
   *
   * A normal chip reads its value back from the rows ticked in its menu. A
   * custom one has no list to tick — the data grid's column-heading filter asks
   * for a condition and a value, so the finished phrase ("Contains: ana")
   * arrives already made. Set it and the chip shows it and opens no menu.
   *
   * See `addCustomFilter()`, which is the only way it is meant to be set.
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
   * The view chip is the case this exists for: you are always looking at some
   * view, so "no view" is not a state the page can be in. Its menu changes
   * WHICH one; its body has nothing to turn off.
   *
   * A persistent chip is also never REMOVABLE and never EMPTY — see `removable`
   * and `#addRemoveRow`.
   */
  persistent?: boolean;
  /**
   * Offer "Remove" at the foot of this chip's menu.
   *
   * OPT-IN, because removability is a property of the chip and not of the bar.
   * A filter a user ADDED can be taken off again; a chip the host put there on
   * purpose — above all the view SELECTOR, where "no view" is not a state the
   * page can be in — must not offer a row that would delete it.
   *
   * `addFilter()` sets it on anything picked from the Add menu, so a chip the
   * user added is removable without the host saying so.
   */
  removable?: boolean;
  /**
   * Override whether this chip's menu DEFERS its picks behind an Apply/Cancel
   * footer instead of applying each tick as it is made.
   *
   * It follows the SELECT MODE by default, because the mode is what decides
   * whether a pick is finished. A SINGLE-select menu is done the moment a radio
   * is chosen — there is no second pick coming, so a footer puts two clicks in
   * front of a selection that was free, the view chip worst of all. A MULTI
   * menu is a set the user is still building, and applying each tick fires a
   * query per box on the way to an answer they had not reached.
   *
   * Set it only to go against that: `false` on a multi menu whose query is
   * cheap and whose feedback is worth having live, `true` on a single menu
   * whose query is genuinely expensive.
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

  /**
   * How far the action cluster has folded: 1 the view group, 2 refresh and
   * configure, 3 everything but Add and the ⋮ itself. Each step subsumes the
   * ones before it, and CSS reads it off the host.
   */
  static readonly COLLAPSE_STEPS = 3;

  /**
   * Fit the bar to its width — collapse the actions, then fold chips.
   *
   * ONE LINE, always. A filter toolbar that wraps pushes the bar to two rows and
   * the action cluster then sits against a short second line instead of the
   * bar's end; the answer to "these do not fit" is to collapse, not to reflow.
   *
   * The order is the user's priority, not the layout's: the trailing ACTIONS go
   * first, because a filter chip is what the bar is for and Save/Refresh are
   * reachable from the ⋮. Only when the cluster is fully folded and the chips
   * still overflow do chips start folding too.
   *
   * Chips fold from the END of the run, so what the user put there first stays
   * visible and the unfold order is the exact reverse.
   */
  #reflow(): void {
    const bar = this.$('.bar');
    const chips = this.$('.chips');
    if (!bar || !chips) return;

    // UN-DRILL FIRST. sherpa-menu closes itself on a viewport resize, but this
    // reflow also runs when only the BAR changed — a panel opening, the nav
    // collapsing — and the fold about to happen can take away the very chip
    // whose rows are drilled into the overflow menu. The rows are moved, not
    // copied, so a chip that folds mid-drill would carry another filter's rows
    // off with it.
    this.#closeOverflow();

    // Start from nothing folded and add back only what the measurements demand.
    // Measuring against the CURRENT fold would ratchet: a bar that once narrowed
    // could never widen again, because each pass would see the collapsed layout
    // as the one that fits.
    this.removeAttribute('data-collapse');
    this.removeAttribute('data-folded');
    this.#showAllChips();

    // `scrollWidth > clientWidth` on the clipped run is the overflow test. It is
    // read AFTER the resets above, which force the layout the browser would have
    // drawn with everything visible.
    for (let step = 1; step <= SherpaQuickFilterToolbar.COLLAPSE_STEPS; step++) {
      if (!this.#overflowing()) break;
      this.setAttribute('data-collapse', String(step));
    }

    if (!this.#overflowing()) return;

    // Still too wide with every action folded, so chips start folding — one at a
    // time from the end, re-measuring after each, so exactly as many move as
    // have to. A chip's width is its own; there is no arithmetic that predicts
    // how many will fit.
    const run = [...chips.children].filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('chip'),
    );
    const folded: HTMLElement[] = [];
    for (let i = run.length - 1; i >= 0; i--) {
      const chip = run[i]!;
      chip.toggleAttribute('data-folded-away', true);
      folded.unshift(chip);
      this.setAttribute('data-folded', String(folded.length));
      // The overflow chip is itself a chip: folding the last one and revealing
      // it can be a net LOSS of room, so the loop has to re-measure rather than
      // assume each fold helps.
      if (!this.#overflowing()) break;
    }

    this.#renderFolded(folded);
  }

  /**
   * Fill the overflow chip: its badge, and one menu row per folded filter.
   *
   * Each row names the FILTER'S FIELD and badges how many values it carries, so
   * the bar still says what is inside rather than only how much. Hovering or
   * focusing a row opens that filter's OWN menu beside it — the real one, moved
   * across rather than rebuilt, so every value, its Range switch and its Apply
   * footer come with it and a folded filter stays fully usable.
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

      // A BOOLEAN chip — one with no menu of its own — is on or off, so it has
      // nothing to drill into. It gets a TICKABLE row, the same label+checkbox
      // shape a value row has, rather than a drill row that wears a chevron,
      // reads as a parent and does nothing when clicked.
      if (!source.querySelector('sherpa-menu')) {
        const toggle = this.clone('template.qf-toggle-tpl');
        if (!toggle) continue;
        toggle.dataset['for'] = id;
        const box = toggle.querySelector<HTMLInputElement>('input');
        const text = toggle.querySelector('.qf-toggle-label');
        if (text) text.textContent = label;
        // The tick MIRRORS the chip, so the menu and the bar cannot disagree.
        if (box) box.checked = source.hasAttribute('data-current');
        // Bound to the BOX, not to the toolbar: a native `change` is not
        // composed, so it stops at the menu and never reaches a listener on the
        // host. The row is stamped here and lives as long as the fold does.
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
   * Separate from the row STAMPING, because the counts move without the rows
   * doing: a value ticked while drilled into that filter, or the filter's own
   * menu applied. Stamping again on every change would rebuild the list the
   * reader is looking at.
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
      /* A data-* ON THE ROW, not `hidden` on the badge. CSS owns visibility —
         and the chip already answers this same question with
         `:host([data-count]) .count`, so the bar was the only place in the
         project saying it a second way.

         The attribute goes on the ROW because the badge is not a host: nothing
         can write `:host(...)` for an element inside a menu. Same vocabulary
         (`data-count`), same rule, reachable selector. */
      badge.closest('.qf-folded')?.toggleAttribute('data-count', count > 0);
    }
  }

  /**
   * A folded TOGGLE was ticked — flip the chip it stands for.
   *
   * The chip is the source of truth: setting `data-current` on it and letting it
   * announce the change is what every other path does, so a filter folded into
   * the overflow behaves exactly as it does on the bar. Ticking the row does not
   * set the chip directly — it asks the chip to toggle, the same as clicking it.
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
      id, active: box.checked, values: [], source: 'overflow',
    });
  };

  /**
   * Where a DRILLED-IN menu's rows came from, so Back can put them home.
   *
   * The overflow menu drills IN PLACE rather than opening a second card beside
   * itself: its list is replaced by the chosen filter's rows and the header
   * grows a back arrow and a breadcrumb. One card, so there is no second box to
   * position, nothing to close when the pointer crosses a gap, and no way for
   * the two to disagree about what is ticked.
   */
  #drill: { home: HTMLElement; rows: Element[] } | null = null;

  /**
   * The menu attributes that belong to a FILTER rather than to the card.
   *
   * They travel with the rows on a drill and go home with them, so a filter's
   * mode is never left on the overflow list and the overflow list's never lands
   * on a filter. `data-type` is here because a calendar needs its own layout —
   * without it the grid drew a hairline high.
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
   * Its real rows are MOVED, not copied. A clone would be a second set of
   * inputs over the same filter, and whichever the user touched the other would
   * be stale; moving means the Range switch, the value rows and everything else
   * come across intact, and Back is the same move in reverse.
   */
  #onFoldedClick = (event: Event): void => {
    const path = event.composedPath();

    // A FOLDED TOGGLE ticks in place — it has no menu to drill into. Let the
    // click through so the checkbox flips natively; the chip follows on `change`
    // (see #onFoldedToggle). Stopping it here would leave the box unticked.
    if (path.some((n) => n instanceof HTMLElement && n.classList.contains('qf-toggle'))) return;

    // composedPath, because the click starts on the list item's own inner
    // <button> — inside ITS shadow root — so `target` is the host and `closest`
    // from there would miss the row entirely.
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
    // The drilled filter's own modes travel WITH its rows — a multi-select filter
    // still needs its Apply footer, a number filter its Range switch, and a date
    // filter its calendar LAYOUT. `data-type` was the one left out: a calendar
    // dropped into a list-shaped menu had its grid crushed to a hairline, and
    // the flag then stayed behind on the way home so the filter's own menu was
    // distorted too.
    //
    // Every flag is restored to what the TARGET had, not merged — an attribute
    // the overflow list carried and the filter does not must go, or the filter
    // inherits a mode it never asked for.
    for (const flag of SherpaQuickFilterToolbar.DRILL_FLAGS) {
      const value = from.getAttribute(flag);
      if (value == null) into.removeAttribute(flag);
      else into.setAttribute(flag, value);
    }
  };

  /**
   * A calendar picked a day or completed a range — relabel its chip.
   *
   * The chip is found by composedPath rather than by `event.target`: the event
   * starts inside the calendar's own shadow root and is retargeted at each
   * boundary, so `target` is the toolbar by the time it arrives here.
   */
  #onDatePicked = (event: Event): void => {
    // The CHIP HOST, not the first `.chip` in the path. A sherpa-quick-filter
    // wraps its own inner <div class="chip">, which sits lower in the path and
    // matched first — and #chipPicks on that bare div finds no calendar, so the
    // label was rebuilt from an empty pick list every time.
    const chip = event
      .composedPath()
      .find(
        (n): n is HTMLElement =>
          n instanceof HTMLElement && n.tagName === 'SHERPA-QUICK-FILTER',
      );
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
   * ORDER MATTERS: the rows have to go home before the fold changes, or a chip
   * that folds away this pass takes another filter's rows with it — they are
   * moved, not copied, and there is only one set.
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

    // Back to the filter's own menu, which is where its state has been living
    // all along — the chip is only parked off-screen, not emptied.
    drill.home.replaceChildren(...menu.childNodes);
    menu.replaceChildren(...drill.rows);
    this.#drill = null;

    menu.removeAttribute('data-drill');
    delete menu.dataset['drillFrom'];
    // The rows are home now, so every count reads from its own chip again.
    // Deferred, because the badges are stamped back into the menu on the line
    // below and would otherwise be read before they exist.
    queueMicrotask(() => this.#syncFoldedBadges());
    menu.setAttribute('data-heading', 'More filters');
    // Hand every mode back to the filter's own menu — it is where they belong,
    // and a calendar left without its data-type is a crushed grid.
    for (const flag of SherpaQuickFilterToolbar.DRILL_FLAGS) {
      const value = menu.getAttribute(flag);
      if (value == null) drill.home.removeAttribute(flag);
      else drill.home.setAttribute(flag, value);
      // …and the overflow list is a plain list of doors: no draft to apply, no
      // search, no calendar.
      menu.removeAttribute(flag);
    }
  }

  /**
   * Does the chip run want more room than it has?
   *
   * Reading `scrollWidth` FORCES the pending layout, so an attribute written on
   * the line above is already reflected — which is what lets the collapse loop
   * add one step at a time and stop at the first that fits, rather than applying
   * all three and folding an action cluster that only needed its widest run
   * taken off.
   */
  #overflowing(): boolean {
    const chips = this.$('.chips');
    // 1px of slack: a sub-pixel layout rounds scrollWidth up and a bar that fits
    // exactly would otherwise fold a chip for nothing, every frame.
    return !!chips && chips.scrollWidth > chips.clientWidth + 1;
  }

  /** Put every chip back on the bar, before a fresh measurement. */
  #showAllChips(): void {
    for (const chip of this.$$<HTMLElement>('.chips > .chip')) {
      chip.removeAttribute('data-folded-away');
    }
  }

  #onResize = (): void => {
    // ONE measure per frame. A resize drag fires this per pixel, and each pass
    // reads layout — batching to an animation frame is what keeps a drag from
    // forcing a hundred synchronous reflows.
    if (this.#frame != null) return;
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
    // CAPTURE. An organise chip's raw quick-filter-change must never reach the
    // host — its detail is `{ values: ['name'] }`, a bare array, where a host
    // reading the TOOLBAR's event expects `{ values: {id: [...]}, active }`. A
    // view that turned that into a filter matched nothing and the grid emptied
    // on every sort.
    //
    // stopImmediatePropagation alone was not enough, because it only stops
    // listeners registered AFTER this one: a host that wired its handler before
    // the toolbar had rendered still ran first and saw the raw event. Capture
    // runs before EVERY bubble listener whenever it was added, so the order the
    // host happened to use stops mattering.
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

    // THE MEASURE PASS. CSS's container queries do the first cut — a narrow bar
    // is already collapsed on the first paint, with no JS in the loop — and this
    // refines it: the breakpoints are width guesses, and a bar of eleven long
    // chips has to fold sooner than one of three short ones.
    //
    // ResizeObserver rather than a window listener, because the bar's width
    // changes without the window's: the nav collapsing, a panel opening, a
    // container query elsewhere. It fires once on observe, which is the initial
    // measurement.
    // The overflow chip's rows open their filter's own menu beside them.
    // pointerover, not pointerenter: the rows are stamped after this runs, and
    // pointerenter does not bubble so a delegated listener would never hear it.
    // The overflow menu drills IN PLACE — a row swaps the list for that
    // filter's own rows, and Back swaps it home. Click, not hover: a drill
    // replaces what is on screen, and doing that on a pointer passing over a
    // row would move the list out from under it.
    this.addEventListener('click', this.#onFoldedClick, true);
    // BACK out of a drill. The arrow lives in the MENU's own shadow root, two
    // boundaries away, so its native click never reaches here — the menu
    // re-emits it as a composed `menu-back`, which does.
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
   * There is deliberately no `count`. A badge on a plain TOGGLE chip could only
   * mean "how many rows match", which the host often cannot know up front — a
   * server-side query has not answered yet when the bar is built. The badge is
   * reserved for "how many VALUES are picked", which a menu chip sets itself.
   */
  protected override renderData(data: unknown): void {
    this.#filters = Array.isArray(data) ? (data as QuickFilterDef[]) : [];
    this.#render();
  }

  /**
   * The ids of the currently-active TOGGLE chips, in order.
   *
   * A chip with a value MENU is deliberately left out. Its id ("plan", "owner")
   * names a COLUMN, not a value, so a host filtering `row.status` against this
   * list matched nothing and turning on a Plan chip emptied the grid. A menu
   * chip's picks live in `values` instead.
   */
  get active(): string[] {
    return this.#chips()
      .filter((c) => c.current && !c.hasAttribute('data-menu'))
      .map((c) => c.dataset['id'] ?? '');
  }

  /**
   * The LIVE value constraints, keyed by chip id.
   *
   * A value-menu chip is a two-state toggle: ON means "filter this field by the
   * picked values", OFF means "ignore this field". Turning it off does NOT clear
   * the picks — they are still in the menu, ready to come back — so this getter
   * reports only chips that are ON. A caller can therefore iterate the object and
   * know every entry is something to filter by, with no on/off check of its own.
   *
   * Use `pickedValues` to read a suspended chip's remembered picks.
   *
   * A single-select chip still reports an array — one shape for both, so a caller
   * does not have to branch on the chip's select mode.
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
   * THE HALF THAT WAS MISSING. A saved view could narrow the DATA and leave the
   * bar saying nothing was filtered: pick "EMEA operations" and the charts
   * showed EMEA while the Region chip sat off and blank. The bar then lies
   * about what the reader is looking at, which is worse than not having it —
   * a filter nobody can see is a filter nobody can undo.
   *
   * REPLACES the whole set: a view says what IS filtered, so a chip the
   * definition does not name is turned OFF. Its own picks survive (they are
   * remembered, not applied — see `pickedValues`), so switching away from a
   * view and back does not make the reader choose again.
   *
   * SILENT. The caller is the one who asked, and a host that routes
   * `quick-filter-change` back into its query would apply the same filter
   * twice. A definition sets the CHIPS; the source is set from the same
   * definition, not from the echo.
   *
   * A value naming no option is ignored, like every other restore here: a saved
   * view outlives the options it was made from.
   */
  set values(next: Record<string, readonly string[]>) {
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'];
      if (!id || !chip.hasAttribute('data-menu')) continue;
      const wanted = next[id];
      // A PERSISTENT chip is a selector — the view chip itself — so it is never
      // switched OFF. It still follows a pick: a definition may name the view
      // it is, and the chip must read it. Not naming it leaves it as it is,
      // because "no view" is not a state this chip has.
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
   * A DATE chip reports its calendar's value as a single-entry array, so every
   * consumer of `values` / `pickedValues` sees one shape and never has to
   * branch on the chip's kind. A range will report two entries for the same
   * reason.
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
   * A value chip can say "Plan: Pro" because its picks ARE its labels; a date
   * chip's pick is an ISO string, which is not what a bar should read. It is
   * formatted to the reader's own locale, short form — the chip is a summary,
   * and "12 Sep" is the part that matters at that size.
   *
   * The base label is remembered on the chip, because a second pick would
   * otherwise format a label that already carried the first one.
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

    // IN FULL, never abbreviated: "03 Sep – 18 Oct, 2026". A date range is the
    // one filter whose value cannot be guessed from a count — "2" says nothing
    // about which two days — so it reads out rather than hiding behind a badge
    // and a hover tip.
    //
    // The YEAR is stated once at the end when both ends share it, which is the
    // common case; a range crossing new year states it on each end, because
    // "18 Dec – 03 Jan, 2027" would put the wrong year on the first day.
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

    // CAPTURE WHAT IS ON SCREEN FIRST. A re-render rebuilds every chip from
    // #filters, whose `options` still carry the flags they were POPULATED with
    // — so adding or removing one filter reset every other chip's picks and its
    // on/off state. The live DOM is the only record of what the user has done
    // since; it has to survive the rebuild.
    //
    // …unless the caller is REPLACING the set rather than amending it. A view
    // change hands the bar a whole new filter definition, and carrying the old
    // picks into it would leave the new view filtered by the previous one's
    // choices. `data-reset-on-populate` says the definition is the whole truth,
    // which is what a saved view or a preset hands over.
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
    // `valueLabel` writes into the chip's SHADOW root, which does not exist
    // until the element upgrades — and a chip cloned from a template has not
    // upgraded while it is still out of the document. So the writes are held
    // and replayed after the whole run is appended.
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

    // A custom chip's phrase goes onto its caret through the chip's own setter,
    // which writes into the chip's SHADOW root — so it has to wait for the chip
    // to have rendered one. A freshly cloned chip has not: the element upgrades
    // when it enters the document and renders a tick later, and writing before
    // that put the text nowhere and reported no error.
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
    // COMMIT FOLLOWS THE SELECT MODE, because the mode is what decides whether a
    // pick is finished.
    //
    // A SINGLE menu applies on the tick: one radio IS the answer, there is no
    // second pick coming, and a footer charges two clicks for a selection that
    // was free — the view chip worst of all, where picking a view is the whole
    // interaction.
    //
    // A MULTI menu defers behind Apply/Cancel: the set is still being built, so
    // applying each tick fires a query per box on the way to an answer the user
    // has not reached yet, and Cancel gives them a way back out of a half-built
    // set.
    //
    // A DATE or NUMBER chip counts as single whatever its `select` says — a
    // calendar picks one day and a field holds one number, so the pick is
    // finished the moment it is made. IN RANGE MODE it is not: a span has two
    // ends, and applying on the first would filter to a range the user has not
    // finished naming. So a range defers, and the Range switch moves the menu
    // between the two modes at runtime — see #onRangeToggle.
    //
    // `commit` on the definition overrides it either way. The menu owns both
    // modes already; nothing else here has to change.
    const picksOne = (def.kind === 'date' || def.kind === 'number') && !def.range;
    const defers = def.commit ?? (!single && !picksOne);
    if (defers) menu.setAttribute('data-commit', '');
    // EVERY chip menu gets CLEAR — the icon button in the menu's header.
    //
    // It used not to exist for a value chip at all: the multi-select list led
    // with a "Select all / Clear all" row that relabelled itself once
    // everything was ticked, so a menu's clear was a row that moved under the
    // reader and a single-select menu had none. Clear is one action, so it has
    // one place, and the select-all row is now Select all only.
    //
    // NOT a persistent chip. It always holds exactly one value — the view
    // selector is the case — so "nothing picked" is not a state it can be in,
    // and a clear would leave the page somewhere it has no way to be.
    if (!def.persistent) menu.setAttribute('data-clearable', '');
    // EVERY value menu gets a search. A filter's values are the user's own data
    // — regions, owners, plans — so the list is as long as their data is, and
    // scrolling a hundred owners to find one is the case this exists for.
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
        // A calendar is not a list to search, and the search would filter
        // nothing — so it is not offered here. That leaves the header's second
        // row to the month stepper, which is the control this menu does have.
        //
        // CLEAR stays: `#onClear` unsets a slotted calendar's date attributes,
        // and a date chip was the one kind with no way back to "no date" short
        // of removing the chip, because Clear was a footer button and Today had
        // taken the only footer slot.
        menu.removeAttribute('data-search');
        // The Menu set's own `Type = Calendar` variant: a wider card whose list
        // region runs horizontally, so a day grid and a time picker sit side by
        // side. The calendar is the CONTENT; the menu is the card.
        menu.setAttribute('data-type', 'calendar');
        menu.appendChild(cal);
      }
      this.#addRemove(chip, menu, def);
      chip.setAttribute('data-menu', '');
      chip.appendChild(menu);
      return;
    }

    // A PERSISTENT chip is a SELECTOR: it always holds exactly one value, so
    // "nothing picked" is not a state it can be in. If neither the live picks
    // nor the definition names one, the FIRST option is the default.
    //
    // Without this the view chip could load with no radio checked — on at 0
    // values — which the chip reads as "on but filtering by nothing" and paints
    // WARNING. That is the intermittent amber view chip: whether it appeared
    // depended only on whether the host remembered to mark an option `selected`.
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

    // THE ORDER, and the reason for each part:
    //
    //   Select all / Clear all   a multi menu only — one row that does the whole
    //                            set, at the top where a user reaches first
    //   available values         the picks that would actually narrow the view
    //   ── divider ──
    //   unavailable values       still selectable, but no row carries them now,
    //                            so ticking one changes nothing visible
    //
    // Splitting rather than sorting a flag: two groups with a rule between them
    // says "these are different" in a way a dimmed row scattered through the
    // list does not.
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
   * The switch flips ONE filter between its two shapes — "equals this" and
   * "between these two" — rather than the bar carrying two chips for the same
   * field. Choosing between two chips would make the user pick the shape before
   * they know which they want, and changing their mind would mean taking one off
   * the bar and adding the other.
   *
   * `data-range` on the MENU is what the flip writes; CSS below it swaps the
   * single field for the slider, and the calendar reads it as its own
   * `data-type`. Nothing is rebuilt, so a value typed on one side is still there
   * after a flip back.
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
    // composedPath, not `event.target`. The change starts on the switch's own
    // inner <input> and is RETARGETED at each shadow boundary it crosses — by
    // the time it reaches this listener `target` is the toolbar itself, and
    // `closest` from there finds no switch at all.
    const sw = event
      .composedPath()
      .find(
        (n): n is HTMLElement =>
          n instanceof HTMLElement && n.classList.contains('qf-range-switch'),
      );
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
   * One row, not two. What it does is decided by the set's current state — with
   * everything already on the only useful action is to clear it — so a second
   * button would always be the one you did not want.
   *
   * The toolbar only STAMPS it. The menu owns what it does, because a native
   * `change` is not composed: it stops at the <sherpa-menu> the rows are slotted
   * into and never reaches this component. See SherpaMenu#onSelectAll.
   *
   * A SINGLE menu gets none — you cannot select all of a set of radios.
   */
  #addSelectAll(menu: HTMLElement, options: readonly QuickFilterOption[]): void {
    if (!options.length) return;
    const row = this.clone('template.qf-all-tpl');
    if (row) menu.appendChild(row);
  }

  /**
   * Give a chip's menu its "Remove" action — a FOOTER BUTTON.
   *
   * It was a row at the foot of the list for value chips and a footer button
   * for date chips, because a calendar menu has no list for a row to sit in.
   * One action in two places is one action too many: the button is the shape
   * that works for both, it never scrolls away with a long list, and it sits
   * with the menu's other actions rather than among the values.
   *
   * FILTER chips only, and only those the definition marks `removable`. Not the
   * organise chips (Group and Sort are fixed parts of the bar, not filters a
   * user put there), not the Add chip itself (whose menu IS the list of things
   * to add), and not a chip the host did not say may go.
   *
   * The flag is OPT-IN rather than opt-out because it DELETES the chip: the safe
   * default when a host says nothing is to keep it. The view chip is the case
   * this exists for — it is persistent, so removing it would leave the page in a
   * state it has no way to be in.
   *
   * The menu's own footer button emits the same `menu-select` with
   * value="remove" that the row did, so #onMenuSelect is unchanged.
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
    // composedPath, not `event.target`. menu-select is composed and re-emitted
    // from the menu's own host, so by the time it reaches this listener the
    // target has RETARGETED to the toolbar itself — `target.closest('.chip')`
    // finds nothing. The path still holds the chip (the menu is slotted into it):
    //
    //   sherpa-menu › slot › span › div.chip › #shadow › sherpa-quick-filter.chip › …
    //
    // Matched on the TAG, not on `.chip`: the quick-filter's own shadow root
    // contains a <div class="chip"> too, and it comes FIRST on the path — so
    // matching the class found that inner div, which carries no data-id, and
    // every remove silently bailed.
    const chip = event
      .composedPath()
      .find(
        (n): n is HTMLElement =>
          n instanceof HTMLElement && n.localName === 'sherpa-quick-filter',
      );
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
      // IMMEDIATE: the chip's event and this listener are both on the HOST, so
      // plain stopPropagation would only block ancestors and a host listening on
      // the toolbar itself would still see the raw chip click.
      event.stopImmediatePropagation();
      this.#cycleSort(sortChip);
      return;
    }

    const chip = path.find(
      (n): n is ChipEl => n instanceof HTMLElement && n.classList.contains('chip'),
    );
    if (!chip) return;

    // A PERSISTENT chip is a selector: it has already flipped itself off by the
    // time this fires (a chip is a two-state toggle by default), so put it back.
    // You are always in some view — "no view" is not a state the page can be in,
    // and the menu is what changes which one.
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
   * The chip derives its column from its own menu's ticked radio, so syncing
   * means ticking that radio — not writing a label, which the next
   * #syncSortLabel would overwrite from the menu anyway.
   *
   * No event is emitted. The write came from outside; telling the outside what
   * it just did would be an echo, and a host wiring both directions would
   * bounce the value between them.
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
   * The twin of `#syncSortFromAttrs`, and deliberately built the same way: both
   * organise chips are single-select menus, so setting one means ticking its
   * radio and letting the chip label itself.
   *
   * WHY THIS EXISTS. `groupField` was readable and completely unwritable — no
   * setter, no method, no attribute — so a saved view could restore a SORT and
   * not a GROUPING. The parity sweep found it; this is the door.
   *
   * No event, for the same reason sort emits none: the write came from outside,
   * and echoing it back would bounce the value between a host wired both ways.
   */
  #syncGroupFromAttrs(): void {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="group"]');
    if (!chip) return;

    const field = this.dataset['groupField'] ?? '';

    // NO FIELD means ungrouped. Unlike a suspended sort the pick is CLEARED,
    // because grouping has no third state: a grid is grouped by a column or it
    // is flat, and a chip remembering a column it is not grouping by would
    // report a grouping that is not running.
    if (!field) {
      for (const radio of chip.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
        radio.checked = false;
      }
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
   * `active` alone could not describe a menu chip — its id names a column, so a
   * host matching row values against that list found nothing and a Plan pick
   * emptied the grid.
   */
  #emitChange(): void {
    this.emit('quick-filter-change', {
      active: this.active,
      // What is APPLIED — only the chips that are ON.
      values: this.values,
      // What is REMEMBERED — including chips toggled off, whose picks survive.
      picked: this.pickedValues,
      // CUSTOM chips, whose value was typed rather than picked — the data
      // grid's column filters. They appear in neither list above: `active`
      // skips anything with a menu (so the caret draws), and `values` reads
      // ticked rows, which a custom chip has none of. Without this a host had
      // no way to see one at all, so turning one OFF said nothing and the
      // column it came from stayed filtered and lit.
      custom: this.customFilters,
    });
  }

  /**
   * Every CUSTOM chip and whether it is on — `{ 'col:name': true }`.
   *
   * A custom chip's value was typed, not picked, so it carries no rows to read
   * back; its id and its on/off state are the whole of what it says. A host
   * that put one on the bar reads this to learn it has been switched off, and
   * clears whatever set it.
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
   * The chip stays ON for the two live directions and goes OFF for suspended, so
   * the bar shows at a glance whether the sort is doing anything. `data-direction`
   * keeps the last live direction through the suspended step, which is what lets
   * "off" be temporary rather than a reset.
   */
  #cycleSort(chip: HTMLElement): void {
    // The chip has ALREADY flipped its own data-current by the time
    // quick-filter-click arrives (it is a two-state toggle by default), so undo
    // that first. Without this the flip and the cycle fought each other and the
    // chip never left ascending: every click flipped it off, then the cycle's
    // "suspended → on" branch put it straight back.
    const live = !chip.hasAttribute('data-current');
    const direction = chip.dataset['direction'] === 'desc' ? 'desc' : 'asc';

    if (!live) {
      // Suspended → back on, in the direction it was left in.
      chip.toggleAttribute('data-current', true);
    } else if (direction === 'asc') {
      chip.dataset['direction'] = 'desc';
      chip.toggleAttribute('data-current', true);
    } else {
      // Descending → SUSPENDED, and the direction resets to ascending so the
      // next "on" starts the cycle again.
      //
      // This is what broke after one full cycle: leaving `desc` in place meant
      // click 4 read desc→suspend and click 5 read suspend→on-at-desc, so the
      // chip ping-ponged between descending and off and never returned to
      // ascending. The COLUMN still survives — that is what makes "off"
      // temporary rather than a reset — only the direction rewinds.
      chip.removeAttribute('data-current');
      chip.dataset['direction'] = 'asc';
    }

    this.#syncSortLabel(chip);
    this.emit('sort-change', { field: this.sortField, direction: this.sortDirection });
  }

  /**
   * Show the sort chip's state in its own label and icon.
   *
   * A tri-state control has to say which state it is in — the chip's on/off tint
   * alone cannot tell ascending from descending.
   *
   * The CHIP says "Sort" and never moves; the picked COLUMN reads in the caret
   * button, the same split every other menu chip uses since Figma's State=menu
   * made the caret a Button with its own label (150:3408). This used to fold
   * them together as "Sort: Region", which re-flowed the whole bar on every pick.
   */
  #syncSortLabel(chip: HTMLElement): void {
    const live = chip.hasAttribute('data-current');
    const desc = chip.dataset['direction'] === 'desc';
    const column = this.#organise.sort?.find((c) => c.field === this.#menuValue('sort'));
    chip.setAttribute('data-label', 'Sort');
    const target = chip as HTMLElement & { valueLabel?: string };
    // A SUSPENDED sort keeps its column — it is off temporarily, not reset — so
    // the caret still names it and only the icon says the sort is not running.
    if ('valueLabel' in target) target.valueLabel = column?.label ?? '';
    const { sortNone, sortAsc, sortDesc } = SherpaQuickFilterToolbar.#icons;
    // OFF gets its OWN glyph. It used to wear the ascending arrow, so a
    // suspended sort looked identical to an active ascending one — the whole
    // point of a tri-state icon is that the three states look different.
    chip.setAttribute('data-icon-start', !live ? sortNone : desc ? sortDesc : sortAsc);
  }

  /**
   * available([...]) — the filters the Add chip offers.
   *
   * The Add control is a Filter Chip pinned State=menu in the design: its body
   * is a trigger and its caret opens a list. This is that list — the filters
   * a user can put on the bar OVER AND ABOVE the defaults populate() gave it.
   *
   * Picking one STAMPS it into the chip run and drops it from the menu, because
   * a filter already on the bar is not one you can add again. It arrives ON, so
   * the reason you added it is visible immediately.
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
   * It returns to the Add menu rather than vanishing: a user who removes a chip
   * by mistake, or narrows a view and then widens it again, should find it where
   * they got it. Its picked values are dropped — the chip comes back clean,
   * because "remove" means remove, not "hide and remember".
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
   * `data-act` rather than each button owning a listener. A new button in the
   * template needs one line in this map, not new wiring.
   *
   * The events are the ones Figma's own description names, so a host written
   * against the design finds the event it expects.
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
    const add = event
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('add-btn'));
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
   * The attribute is the state and CSS paints from it; the GLYPH swaps too
   * (outline → solid) so the state survives for anyone who cannot tell the
   * brand purple from the default ink. `aria-pressed` carries it to a screen
   * reader, which is why the star is a toggle button rather than a plain one.
   */
  #toggleFavourite(btn: HTMLElement): void {
    const on = !this.hasAttribute('data-favourite');
    this.toggleAttribute('data-favourite', on);
    // ACTIVE is a real Style MODE in the design, not a colour to invent: the
    // Style collection's `active` mode re-points style-surface/base to
    // surface/active/base, style-border/base to border/active/+2 and
    // style-content/base to content/active/+1.
    //
    // The attribute is set as the honest description of the state — and CSS in
    // THIS component's sheet does the painting, because the [data-status]
    // SELECTOR that would normally supply --_status-* lives in tokens.css,
    // which is loaded into the DOCUMENT and is not in sharedStyles. It reaches
    // a light-DOM element (verified: it resolves #f2dfff there) and never one
    // inside a shadow root, so the button saw nothing at all.
    if (on) btn.setAttribute('data-status', 'active');
    else btn.removeAttribute('data-status');
    btn.setAttribute('data-icon-start', on ? 'fa-solid fa-star' : 'fa-regular fa-star');
    btn.setAttribute('aria-pressed', String(on));
    this.emit('view-favorite', { favourite: on });
  }

  /**
   * Put a CUSTOM filter on the bar — one whose value is typed, not picked.
   *
   * The data grid's column-heading filters are what this is for. A reader sets
   * "Name contains ana" in a column heading, and the bar has to show it beside
   * the chips they picked from the Add menu, or the view is narrowed by
   * something with no presence on the toolbar that says so.
   *
   * It differs from a normal chip in one way that matters: its value is not one
   * of a LIST. A `values` chip's caret opens the field's options and the chip
   * reads back whichever are ticked; here the condition and the value came from
   * a form, so the label is handed in whole and the chip carries no menu.
   *
   *   toolbar.addCustomFilter({ id: 'col:name', label: 'Name',
   *                             value: 'Contains: ana' });
   *
   * Calling it again with the same `id` REPLACES that chip — a reader who
   * changes "contains ana" to "contains bo" has one filter, not two. Passing a
   * null or empty `value` removes it, which is what clearing the column's menu
   * means.
   *
   * The chip is removable: the user put it there, so they may take it off. Doing
   * so fires `filter-remove` like any other, and the grid should clear that
   * column's menu when it sees its own id come back.
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
   * This is what the undo button means: not "undo the last thing" but "back to
   * no filters". The organise chips are included — a grouping and a sort are as
   * much a view state as a filter is, and leaving them behind made the reset
   * look broken.
   *
   * Fires the three change events afterwards, so a host re-queries once per
   * concern rather than once per chip.
   */
  clearAll(): void {
    for (const chip of this.#chips()) {
      // A PERSISTENT chip survives a reset — "no view" is not a state the page
      // can be in, so clearing the filters must not leave the view chip off with
      // nothing to put back. Its PICK survives with it: resetting the filters
      // does not mean leaving the view you are in.
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
   * These are Font Awesome APPROXIMATIONS of the Apex artwork — this branch has
   * no local icon set, every icon is an FA class list. Named here rather than
   * inline so the three places that set a sort glyph cannot drift apart, which
   * is how the off-state ended up wearing the ascending arrow.
   *
   * `wide-short` / `short-wide` over `a-z` / `z-a`: the Figma glyphs are plain
   * bars with an arrow, not letters, and a Sort chip can order a NUMBER column
   * where an A-Z badge reads as wrong.
   */
  static readonly #icons = {
    /**
     * The VIEW selector's icon is fixed, like Group's and Sort's.
     *
     * It reads "you are looking at a saved view", which is the same statement on
     * every screen — so it must not borrow the icon of whatever page it happens
     * to sit on. The examples each passed their own nav glyph (a table for
     * records, a gauge for the dashboard), which made one control look like five.
     *
     * It stays HERE because only this component draws it. The four below are
     * shared, and live in core/icons.
     */
    view: 'fa-solid fa-desktop',
    /**
     * Group and the three sort states come from `core/icons.ts`, NOT from a
     * copy kept here.
     *
     * They used to be written out again in this file, with a comment saying
     * they "must stay in step with sherpa-data-grid's own map" and a spec to
     * guard the pair. Two copies plus a test to check they match is the long
     * way round to having one copy: a sort chip and a column header are two
     * views of ONE sort, so they read one map.
     */
    ...ORGANISE_ICONS,
  } as const;

  /**
   * organise({ group: [...], sort: [...] }) — the columns the leading chips offer.
   *
   * Separate from populate() on purpose: these two chips change how the grid is
   * ARRANGED, not which rows survive, and they are single-choice where a filter
   * chip is a toggle. Mixing them into the filter set would put them in `active`
   * and make quick-filter-change lie about what is being filtered.
   */
  organise(def: OrganiseDef): void {
    this.#organise = def ?? {};
    this.#renderOrganise();
  }

  /**
   * The column the grid is grouped by, or null.
   *
   * Null when the chip is OFF, even if its menu still holds a radio. This used
   * to read the menu alone, so a Group chip switched off still reported the
   * column it used to group by — a host wiring this straight into a query kept
   * grouping by a chip the reader had just turned off. `sortField` already
   * guarded this way; the two now answer the same question the same way.
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
   * Both are `data-menu` chips with SINGLE-select (radio) rows, because a grid is
   * grouped by one column and sorted by one column at a time. Sort offers each
   * column twice — ascending and descending — as `field:asc` / `field:desc`, so
   * one radio row carries the whole answer and the two halves of a sort can never
   * disagree with each other.
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
        // value filter visible in the bar.
        // A persistent chip stays on whatever its menu holds — an empty pick is
        // still a view, where an ordinary value chip with nothing picked is not
        // filtering anything and says so by going off.
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
    // stopIMMEDIATEPropagation, not stopPropagation. The chip's event and this
    // listener are both on the HOST, so plain stopPropagation only blocks
    // ANCESTORS — a host listening on the toolbar itself still received the chip's
    // raw event and saw a group/sort pick as a filter change.
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
