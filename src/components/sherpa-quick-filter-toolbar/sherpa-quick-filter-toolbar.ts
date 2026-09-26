/**
 * sherpa-quick-filter-toolbar — the chip row: folds what does not fit, reports what the reader did.
 *
 * TRAP T-actions-were-a-slot
 *
 * Map:
 * - QuickFilterOption — One value a filter chip's menu can offer.
 * - ExternalFilterSpec — An external filter: its chip, its finished phrase, and the condition behind it.
 * - QuickFilterDef — one filter chip as data: its id, kind, values, and how it answers
 * - OrganiseColumn — One column the grid can be grouped or sorted by.
 * - OrganiseDef — The columns the leading Group / Sort chips offer.
 * - SortDirection — Matches the standard data-sort-direction values.
 */
import { DATA_PROPS, SHARED_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import { NON_VALUE_ROWS, ORGANISE_ICONS } from '../../core/ui/shared-constants.js';
import { sortDirectionFrom } from '../../core/data/cycle.js';
import { allow, type AllowList } from '../../core/data/allow.js';
import { customOf, kindOf, type FilterKind, type OffersCustom } from '../../core/ui/filter-kind.js';
import { menuFor } from '../../core/ui/filter-menu.js';
import {
  FILTERS_LABEL, MenuDrill, addHiddenRows, filtersMenuItems, syncHiddenCounts,
} from '../../core/ui/filters-button.js';
import { report } from '../../core/data/report.js';
import {
  DEFAULT_OP, OP_TAKES,
  type Filter, type FilterOp,
} from '../../core/data/store.js';
import {
  fieldState, savedReading, stateClause,
  type FieldCondition, type FieldReading, type FilterState,
} from '../../core/data/filter-state.js';
import type { SavedFilter } from '../../core/browser/saved-filters.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-calendar/sherpa-calendar.js';
import '../sherpa-slider/sherpa-slider.js';
import '../sherpa-switch/sherpa-switch.js';
import '../sherpa-list-item/sherpa-list-item.js';
import '../sherpa-tag/sherpa-tag.js';

/** One value a filter chip's menu can offer. */
export interface QuickFilterOption {
  value: string;
  label: string;
  selected?: boolean;
  /** Reachable now. TRAP T-unavailable-value-sorts-below-a-divider — `false` still selects. */
  available?: boolean;
  /** A second fact its menu row shows, muted. */
  note?: string;
  /** The section its menu row is in, headed where it changes. */
  section?: string;
}

/** An external filter: its chip, its finished phrase, and the condition behind it. */
export interface ExternalFilterSpec {
  id: string;
  label: string;
  /** The phrase the chip reads. Empty or null removes the chip. */
  value?: string | null;
  op?: FilterOp;
  text?: string;
}

export interface QuickFilterDef extends OffersCustom {
  id: string;
  label: string;
  type?: string;
  active?: boolean;
  icon?: string;
  /** Values this chip filters by — a menu of checkbox or radio rows. */
  options?: QuickFilterOption[];
  select?: 'single' | 'multiple';
  /** WHAT THIS FILTER IS — see `core/ui/filter-kind.ts`. A def that leaves it
   *  out has it worked out from `select`, `custom` and whether there are
   *  options, in ONE place rather than at fifteen.
   *  TRAP T-number-and-date-lead-with-a-range-switch
   *  TRAP T-a-chip-knows-what-kind-it-is */
  kind?: FilterKind | 'values';
  /** A number filter's slider ends and field clamp. Default 0..100. */
  min?: number;
  max?: number;
  step?: number;
  /** ISO days a DATE chip may pick. A SET, not a span; every other day draws inactive. */
  availableDates?: string[];
  /** An EXTERNAL filter's finished phrase ("Contains: ana"). Set via `addExternalFilter()`. */
  externalValue?: string;
  /** @deprecated The old name of `externalValue`, still read. */
  customValue?: string;
  /** Start in RANGE mode. The user may still flip it. */
  range?: boolean;
  /** A chip that cannot be switched OFF. TRAP T-persistent-chip-is-a-selector */
  persistent?: boolean;
  /** Offer "Remove" in this chip's menu. OPT-IN: a host-placed chip must not delete itself. */
  removable?: boolean;
  /** Defer picks behind Apply. TRAP T-commit-follows-select-mode — else the select mode decides. */
  commit?: boolean;
  /** Which condition this chip is on. Defaults to `eq`. */
  op?: FilterOp;
  /** What the reader TYPED, for a condition that takes text rather than a pick. */
  text?: string;
  /** WHAT THE READER ANSWERED — filled by the `held` read-back, never by a
   *  caller. TRAP T-a-panel-builds-its-own-menus */
  state?: FieldReading;
  /** What the ADD menu shows beside it — where it lives now, if somewhere else.
   *  The host's to say: this bar cannot see another scope. */
  note?: string;
  /** A SAVED custom filter: its answer, given field by field. The chip is a
   *  toggle, and a bound source applies it as one part.
   *  TRAP T-a-saved-filter-is-its-readings */
  readings?: Record<string, FieldReading>;
  /** The reader's OWN saved filter: its menu offers Edit filter and Delete filter.
   *  TRAP T-edit-unpacks-a-saved-filter */
  editable?: boolean;
}

interface ChipEl extends HTMLElement {
  current: boolean;
  /** Setting these brings the chip's label and badge along. */
  values: readonly string[];
}

/** One column the grid can be grouped or sorted by. */
export interface OrganiseColumn {
  /** Reported in group-change / sort-change. */
  field: string;
  label: string;
}

/** The columns the leading Group / Sort chips offer. */
export interface OrganiseDef {
  group?: OrganiseColumn[];
  sort?: OrganiseColumn[];
}

/** Matches the standard data-sort-direction values. */
export type SortDirection = 'asc' | 'desc';

export class SherpaQuickFilterToolbar extends SherpaElement {
  static override css = new URL('./sherpa-quick-filter-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-quick-filter-toolbar.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-bounds': SHARED_PROPS['data-bounds'],
    'data-no-actions': { type: 'boolean', kind: 'style' },
    /* A filter PANEL is answering for this bar, so it hides what the panel
       also carries. TRAP T-panel-mode-hides-what-the-panel-answers */
    'data-panel-mode': { type: 'boolean', kind: 'style' },
    /* WHICH SCOPE this bar is. `view` narrows every component on the screen;
       `data` narrows the one component it belongs to. The bar reads it to
       refuse Group and Sort at view scope.
       TRAP T-group-and-sort-are-component-scope */
    'data-type': { type: 'enum', kind: 'style', values: ['view', 'data'] },
    /* The HOST owns this component's state; report, never write. */
    'data-locked': DATA_PROPS['data-locked'],
    /* Clear the chips when a new field set arrives, rather than keeping them. */
    'data-reset-on-populate': { type: 'boolean', kind: 'style' },
  } as const;

  /** Sort and group written from outside — unobserved, a grid header click says nothing here. */
  /** `data-favourite` is observed so a host that owns the favourites list can
   *  paint the star. TRAP T-the-star-reports-it-does-not-decide */
  static override observed = [
    'data-sort-field', 'data-sort-direction', 'data-group-field', 'data-favourite',
    // The host saves filters. TRAP T-save-packs-the-fields-into-one-chip
    'data-saveable',
  ];

  /** The filter defs this bar holds, in order. */
  #filters: QuickFilterDef[] = [];
  /** The columns the Group and Sort chips offer. */
  #organise: OrganiseDef = {};
  /** Filters the user MAY add but has not — the Add chip's menu. */
  #available: QuickFilterDef[] = [];

  /* ── Fitting the bar ─────────────────────────────────────────────── */

  /** Watches the bar, so the chips fold as it narrows. */
  #observer: ResizeObserver | null = null;
  /** The pending reflow frame — a burst of resizes measures once. */
  #frame: number | null = null;

  /** How far the action cluster can fold. */
  static readonly COLLAPSE_STEPS = 3;

  /**
   * Fit the bar — collapse the actions, then fold chips from the end.
   *
   * TRAP T-reflow-resets-before-measuring — reset first, re-measure after each.
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

    const folded: HTMLElement[] = [];
    if (this.#overflowing()) {
      const run = [...chips.children].filter(
        (c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('chip'),
      );
      for (let i = run.length - 1; i >= 0; i--) {
        const chip = run[i]!;
        chip.toggleAttribute('data-folded-away', true);
        folded.unshift(chip);
        this.setAttribute('data-folded', String(folded.length));
        if (!this.#overflowing()) break;
      }
    }
    // The ONE Filters menu lists them. TRAP T-one-filters-button
    this.#folded = folded;
    this.#renderAvailable();
  }

  /** The chips the last fold took off the run, in bar order. */
  #folded: HTMLElement[] = [];

  /**
   * Lead the Filters menu with the chips folded away: a door into each one's
   * own menu, or a tick for an on/off chip. The button's badge counts them.
   * TRAP T-one-filters-button
   */
  #addFoldedRows(menu: HTMLElement, folded: readonly HTMLElement[]): void {
    addHiddenRows(menu, folded.map((source) => {
      const id = source.dataset['id'] ?? '';
      return {
        id, label: source.dataset['label'] ?? id, icon: source.dataset['iconStart'],
        // A boolean chip has no menu to drill into, so it gets a tickable row.
        door: !!source.querySelector('sherpa-menu'),
        on: source.hasAttribute('data-current'),
      };
    }), (selector) => this.clone(selector), this.#onFoldedToggle);
    this.#syncFoldedBadges();
  }

  /** Re-read every folded row's count. Separate from stamping, which rebuilds the open list. */
  #syncFoldedBadges(): void {
    const menu = this.$<HTMLElement>('.add-btn')?.querySelector<HTMLElement>('sherpa-menu');
    if (!menu) return;
    syncHiddenCounts(menu, (id) => {
      const source = this.$<HTMLElement>(`.chips > .chip[data-id="${CSS.escape(id)}"]`);
      return source ? this.#chipPicks(source).length : null;
    });
    this.#syncOverflowActive();
  }

  /**
   * The Filters button is ACTIVE only when a chip folded into it is — a DOOR to
   * filters, not a filter. A visible chip speaks for itself.
   * TRAP T-the-filters-button-is-a-door-not-a-filter
   */
  #syncOverflowActive(): void {
    const add = this.$<HTMLElement>('.add-btn');
    if (!add) return;
    const any = this.#chips().some(
      (c) => c.hasAttribute('data-folded-away') && c.hasAttribute('data-current'),
    );
    if (any) add.dataset['status'] = 'active';
    else add.removeAttribute('data-status');
  }

  /** A folded toggle was ticked — flip the chip it stands for. */
  #onFoldedToggle = (event: Event): void => {
    const box = event.target;
    if (!(box instanceof HTMLInputElement)) return;
    const row = box.closest('.qf-toggle');
    if (!(row instanceof HTMLElement)) return;
    const id = row.dataset['for'];
    const chip = id ? this.$<HTMLElement>(`.chips > .chip[data-id="${CSS.escape(id)}"]`) : null;
    if (!chip) return;
    if (box.checked) chip.setAttribute('data-current', '');
    else chip.removeAttribute('data-current');
    this.emit('quick-filter-change', {
      scope: 'chip', id, active: box.checked, values: [], source: 'overflow',
    });
  };

  /** A folded chip's rows, moved into the Filters menu. TRAP T-drill-moves-not-clones */
  #drill = new MenuDrill();

  /** A folded row was clicked — drill into that filter. */
  #onFoldedClick = (event: Event): void => {
    const path = event.composedPath();

    // A folded TOGGLE ticks in place — stopping the click leaves the box unticked.
    if (path.some((n) => n instanceof HTMLElement && n.classList.contains('qf-toggle'))) return;

    // The path, not `target`: the click starts in the list item's shadow root.
    const row = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('qf-folded'),
    );
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();

    const id = row.dataset['for'];
    const source = id ? this.$<HTMLElement>(`.chips > .chip[data-id="${CSS.escape(id)}"]`) : null;
    const from = source?.querySelector<HTMLElement>('sherpa-menu');
    const chip = this.$<HTMLElement>('.add-btn');
    const into = chip?.querySelector<HTMLElement>('sherpa-menu');
    if (!from || !into || !chip) return;

    /* NOTHING TO DRILL. A custom-only menu answers with its condition
       ROWS, which live in its own shadow DOM — moving its empty light DOM put
       a blank card on screen, so the filter could never be answered, never
       went active, and never filtered. Show the menu ITSELF, anchored to the
       Filters button. TRAP T-a-conditions-only-menu-cannot-be-drilled */
    if (!from.children.length) {
      this.#closeOverflow();
      (from as HTMLElement & { show?: (t?: HTMLElement) => void }).show?.(chip);
      return;
    }

    // Back stays one level deep, never a chain.
    if (this.#drill.home) this.#drillOut();
    this.#drill.into(into, from, row.dataset['label'] ?? '');
  };

  /** A calendar picked a day or range — relabel its chip. */
  #onDatePicked = (event: Event): void => {
    // TRAP T-path-not-target-finds-chip-host — match the TAG, not `.chip`.
    const chip = this.pathFind(event, 'sherpa-quick-filter');
    if (!chip) return;
    this.#syncDateLabel(chip);
    // A date chip turns itself ON by picking — it has no body toggle.
    chip.toggleAttribute('data-current', this.#chipPicks(chip).length > 0);
    this.#emitChange();
  };

  /** A folded chip changed: redraw its badge in the Filters menu. */
  #onFoldedCountsChanged = (): void => {
    this.#syncFoldedBadges();
  };

  /** The drill-in menu's back arrow. */
  #drillOutHandler = (): void => {
    this.#drillOut();
  };

  /** Shut the Filters menu. ORDER MATTERS: drilled rows go back first. */
  #closeOverflow(): void {
    this.#drillOut();
    const menu = this.$<HTMLElement>('.add-btn')
      ?.querySelector<HTMLElement & { hide(): void }>('sherpa-menu');
    menu?.hide();
  }

  /** Put a drilled-in filter's rows back and restore the overflow list. */
  #drillOut(): void {
    // Deferred: the badges are read once the rows are back in place.
    if (this.#drill.out()) queueMicrotask(() => this.#syncFoldedBadges());
  }

  /** Does the chip run want more room than it has? TRAP T-overflowing-needs-1px-slack */
  #overflowing(): boolean {
    const chips = this.$('.chips');
    return !!chips && chips.scrollWidth > chips.clientWidth + 1;
  }

  /** Put every chip back, before a fresh measurement. */
  #showAllChips(): void {
    for (const chip of this.$$<HTMLElement>('.chips > .chip')) {
      chip.removeAttribute('data-folded-away');
    }
  }

  /** The bar resized: fold again on the next frame. */
  #onResize = (): void => {
    /* TRAP T-resize-reschedule-never-drop — cancel and re-queue, never return
       when a frame is already pending. */
    if (this.#frame != null) cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.#reflow();
    });
  };

  override onRender(): void {
    this.addEventListener('quick-filter-click', this.#onChipClick);
    // Delegated: every control fires the same button-click; data-act says which.
    this.$('.actions-zone')?.addEventListener('button-click', this.#onAction);
    // CAPTURE — see #onOrganiseChange.
    this.addEventListener('quick-filter-change', this.#onOrganiseChange, true);
    this.addEventListener('quick-filter-change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-change', this.#onFoldedCountsChanged);
    // A committing menu fires nothing while rows are ticked; their native
    // `change` reaches here, being in the CHIP's light DOM.
    this.addEventListener('change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-select', this.#onMenuSelect);
    // A calendar commits through its own events — it has no Apply button.
    this.addEventListener('datetime-change', this.#onDatePicked);
    this.addEventListener('range-select', this.#onDatePicked);
    /* A menu's CONDITION is part of what a chip filters by, so the bar reports
       it like any other change. TRAP T-an-operator-decides-pick-or-type */
    this.addEventListener('condition-change', this.#onConditionChanged);
    // The Add menu hangs off a sherpa-BUTTON, which never relays quick-filter-change.
    this.addEventListener('menu-change', this.#onAddCommit as EventListener);
    if (this.#filters.length) this.#render();
    if (this.#organise.group?.length || this.#organise.sort?.length) this.#renderOrganise();
    if (this.#available.length) this.#renderAvailable();
    // onChange never fires for an attribute set before the first render.
    this.#syncFavouriteFromAttr();

    // CLICK, not hover: a passing pointer would drill the list out from under it.
    this.addEventListener('click', this.#onFoldedClick, true);
    // The back arrow is two shadow boundaries away; the menu re-emits it composed.
    this.addEventListener('menu-back', this.#drillOutHandler);

    this.#observer = new ResizeObserver(this.#onResize);
    const bar = this.$('.bar');
    if (bar) this.#observer.observe(bar);
  }

  override onDisconnect(): void {
    if (this.#conditionFrame != null) cancelAnimationFrame(this.#conditionFrame);
    this.#conditionFrame = null;
    this.#observer?.disconnect();
    this.#observer = null;
    if (this.#frame != null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }

  /** populate([{ id, label, type?, active?, icon?, options? }]). TRAP T-toggle-chip-has-no-count */
  protected override renderData(data: unknown): void {
    this.#filters = Array.isArray(data) ? (data as QuickFilterDef[]) : [];
    this.#render();
  }

  /** The active TOGGLE chips. TRAP T-toggle-chips-have-no-field — menu chips are in `values`. */
  get active(): string[] {
    return this.#chips()
      .filter((c) => c.current && !c.hasAttribute('data-menu'))
      .map((c) => c.dataset['id'] ?? '');
  }

  /** ON chips' constraints by id. TRAP T-values-reports-on-chips-in-one-shape — always an array. */
  get values(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const chip of this.#chips()) {
      if (!chip.hasAttribute('data-menu')) continue;
      /* The VIEW owns this field now, so the chip must not narrow anything on
         top of it. Its picks SURVIVE in `pickedValues`, which is the whole
         point of suspending rather than removing.
         TRAP T-a-superseded-chip-suspends-it-is-never-removed */
      if (chip.hasAttribute('data-superseded')) continue;
      // OFF = not filtered. The picks survive — see `pickedValues`.
      if (!chip.hasAttribute('data-current')) continue;
      const id = chip.dataset['id'];
      if (!id) continue;
      const picked = this.#chipPicks(chip);
      if (picked.length) out[id] = picked;
    }
    return out;
  }

  /** Set every chip from a view definition. REPLACES the whole set, and is SILENT. */
  set values(next: Record<string, readonly string[]>) {
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'];
      if (!id || !chip.hasAttribute('data-menu')) continue;
      const wanted = next[id];
      // Never switched off, but it still follows a pick.
      if (chip.hasAttribute('data-persistent')) {
        if (wanted?.length) chip.values = wanted;
        continue;
      }

      if (wanted?.length) {
        // The CHIP owns its own face — label, badge, tooltip, on/off.
        chip.values = wanted;
      } else {
        // Not named by the view: off, but its picks survive. Off is not gone.
        chip.current = false;
      }
    }
  }

  /**
   * Set ONE chip's picks, leaving every other chip alone.
   *
   * `values` is a WHOLE-MAP setter: a chip the map does not name is switched
   * off. That is right for a view restoring its entire filter state, and wrong
   * for anything that owns one field — a legend bound to `plan` wrote
   * `{ plan: [...] }` and silently switched off the Status chip beside it.
   *
   * An empty list CLEARS this chip — unticked and off, because "every value
   * selected" and "no filter" are the same state and only one of them should
   * look like a filter. `undefined` leaves it untouched.
   * TRAP T-one-field-does-not-own-the-whole-map
   * TRAP T-everything-on-is-no-filter
   */
  setChipValues(id: string, picks: readonly string[] | undefined): void {
    if (picks === undefined) return;
    for (const chip of this.#chips()) {
      if (chip.dataset['id'] !== id || !chip.hasAttribute('data-menu')) continue;
      /* `values = []` unticks every row and re-derives the face — the badge
         and the value label go with it. `current = false` alone would leave a
         chip reading "3 Plan Enterprise…" while claiming to be off. */
      chip.values = picks;
      if (!picks.length) chip.current = false;
      return;
    }
  }

  /**
   * setChipActive(id, on) — steer one ON/OFF chip: a preset, a saved filter.
   * SILENT, like every steer, so `report()` when it should be heard. A chip
   * answered by its menu takes `setChipValues` or `setChipReading` instead.
   * TRAP T-a-silent-write-still-needs-a-way-to-report
   */
  setChipActive(id: string, on: boolean): void {
    const chip = this.#chips().find((c) => c.dataset['id'] === id);
    if (chip) chip.current = on;
  }

  /**
   * setChipReading(id, reading) — steer ONE chip with a whole reading.
   *
   * The write path for `readings`, and the only one that can carry a CONDITION.
   * `setChipValues` speaks picks alone, so a field answered by rows — an
   * or-chain, a "starts with" — could not be shown anywhere but where it was
   * typed. SILENT, like every other steer: a host writing a chip must not be
   * echoed back into its own handler.
   * TRAP T-a-conditioned-chip-answers-with-its-clause
   */
  setChipReading(id: string, reading: FieldReading): void {
    for (const chip of this.#chips()) {
      if (chip.dataset['id'] !== id || !chip.hasAttribute('data-menu')) continue;
      const menu = (chip as ChipEl & { menu?: HTMLElement }).menu as
        (HTMLElement & { conditions?: readonly FieldCondition[] }) | null;
      if (!menu) return;

      const rows = reading.conditions ?? [];
      if (rows.length) {
        /* The MENU refuses custom mode unless the field opted in, and a
           steer IS that opt-in reaching it. */
        menu.setAttribute('data-custom', '');
        menu.dataset['mode'] = 'custom';
        menu.conditions = rows;
        chip.current = true;
        return;
      }
      /* NO ROWS: set the picks and LEAVE THE MODE ALONE. Which mode a menu is
         in is the reader's choice, and a steer that flipped it back to the
         list emptied the reading the bar reports one tick later — the
         condition then read as gone and the filter cleared itself. */
      this.setChipValues(id, (reading.picked ?? []).map(String));
      return;
    }
  }

  /**
   * supersede([...ids]) — the VIEW now owns these fields.
   *
   * The chips are SUSPENDED, never removed: each keeps its value and its place,
   * and comes back the moment the view lets the field go. Removing them would
   * throw away what the reader picked, which is the bug this avoids.
   *
   * This is the WHOLE set each time — a chip not named here is restored. That
   * makes the call idempotent, so a host can send the view's field list after
   * every change without tracking what it sent last.
   *
   * TRAP T-a-superseded-chip-suspends-it-is-never-removed
   */
  supersede(ids: readonly string[], appliedAt?: string): void {
    const taken = new Set(ids);
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'];
      if (!id) continue;
      const held = taken.has(id);
      chip.toggleAttribute('data-superseded', held);
      /* WHERE it is filtered instead. Only the host knows — this bar cannot
         see the one that took the field. An off chip with no explanation reads
         as "your filter vanished".
         TRAP T-an-inactive-chip-says-where-its-filter-went */
      if (held && appliedAt) chip.setAttribute('data-applied-at', appliedAt);
      else chip.removeAttribute('data-applied-at');
    }
  }

  /** The ids this bar currently has suspended. */
  get superseded(): string[] {
    return this.#chips()
      .filter((c) => c.hasAttribute('data-superseded'))
      .map((c) => c.dataset['id'] ?? '')
      .filter(Boolean);
  }

  /** Every menu chip's picks, on or OFF. The counterpart to `values`. */
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

  /** What one chip's menu holds — values ticked, or a date as one or two entries. */
  #chipPicks(chip: HTMLElement): string[] {
    // A chip drilled into the Filters menu reports from there — its own menu is
    // empty while the rows are away.
    if (this.#drill.home && this.#drill.home === chip.querySelector('sherpa-menu')) {
      const live = this.$<HTMLElement & { values: string[] }>('.add-btn');
      const menu = live?.querySelector<HTMLElement & { values: string[] }>('sherpa-menu');
      if (menu) return menu.values;
    }
    /* A NUMBER or DATE menu reports its OWN value — it knows its body and its
       Range shape. TRAP T-a-menu-owns-its-own-bodies */
    const own = chip.querySelector<HTMLElement & { values: string[] }>('sherpa-menu[data-body]');
    if (own) return own.values;

    // The MENU's rows, through the chip's own getter — never a DOM query here.
    const held = (chip as ChipEl & { menu?: HTMLElement }).menu ?? chip;
    // NON_VALUE_ROWS names the rows that are not picks.
    return Array.from(held.querySelectorAll<HTMLInputElement>('input:checked'))
      .filter((i) => !i.closest(NON_VALUE_ROWS))
      .map((i) => i.value);
  }

  /** TRAP T-date-label-reads-in-full — UTC, day-then-month, in full, no badge. */
  /** A date chip's caret shows its picked day or range, formatted. */
  #syncDateLabel(chip: HTMLElement): void {
    // The calendar is the MENU's, so ask what KIND of body it has.
    if (!chip.querySelector('sherpa-menu[data-body="date"]')) return;
    const picked = this.#chipPicks(chip);
    const target = chip as HTMLElement & { valueLabel?: string };
    if (!picked.length) {
      if ('valueLabel' in target) target.valueLabel = '';
      return;
    }
    // Parsed UTC, so FORMATTED UTC — else a browser west of Greenwich shows
    // the previous day.
    const at = (iso: string): Date | null => {
      const d = new Date(`${iso}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    // formatToParts, because `toLocaleDateString` orders parts by locale and this
    // must always read day then month.
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

    // No badge: the label says both days outright.
    delete chip.dataset['count'];
  }

  /** The filter chips in the run — not Group, Sort or More. */
  #chips(): ChipEl[] {
    return this.$$<ChipEl>('.chips > .chip');
  }

  /** Rebuild the chip run from `#filters`, keeping what the reader did. */
  #render(): void {
    const list = this.$('.chips');
    const tpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!list || !tpl) return;

    // TRAP T-render-captures-live-state — the live DOM is the only record of what
    // the user did since. `data-reset-on-populate` opts out.
    const live = new Map<string, { on: boolean; picked: Set<string> }>();
    /* AND THE REST OF EACH ANSWER — op, typing, rows. A new menu starts from
       its def. TRAP T-a-rebuild-keeps-every-answer */
    const kept = this.hasAttribute('data-reset-on-populate') ? {} : this.readings;
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
    // TRAP T-custom-element-upgrade — `valueLabel` is a PROPERTY; writes are held
    // and replayed once the run is appended.
    const externalLabels: Array<[HTMLElement, string]> = [];
    /* The allow-list applies to the chips already ON the bar, not only to what
       Add offers: a field a reader may not filter by must not appear at all.
       No list → every filter, which is the default. */
    for (const f of allow(this.#filters, this.#allowedFields)) {
      const chip = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const prior = live.get(f.id);
      chip.dataset['id'] = f.id;
      chip.setAttribute('data-label', f.label);
      if (f.type) chip.setAttribute('data-type', f.type);
      // Live state wins; an untouched chip falls back to `active`.
      if (prior ? prior.on : f.active) chip.setAttribute('data-current', '');
      // The toolbar's glyph to decide, not the app's.
      const glyph = f.id === 'view' ? SherpaQuickFilterToolbar.#icons.view : f.icon;
      if (glyph) chip.setAttribute('data-icon-start', glyph);
      /* A selector: always on, and its body does not flip it. LOCKED for that
         reason — `data-locked` is how a chip is told the host owns its state,
         and without it the chip flipped itself off and the toolbar wrote it
         back, two writes for one click. TRAP T-locked-chip-relays-and-nothing-else */
      if (f.persistent) {
        chip.setAttribute('data-persistent', '');
        chip.setAttribute('data-locked', '');
        chip.setAttribute('data-current', '');
      }
      /* THE KIND DECIDES. A boolean has nothing to open; everything else does
         — a date or number carries its own body, and so does a custom one,
         which can only be asked "contains" and never ticked from a list of 240.
         TRAP T-a-condition-only-field-still-has-a-menu
         TRAP T-a-chip-knows-what-kind-it-is */
      const kind = kindOf(f);
      /* A SAVED filter's answer is given, so it has no field menu: it is a
         toggle, told what it is. TRAP T-a-saved-filter-is-its-readings */
      if (f.readings) {
        chip.dataset['kind'] = kind;
        if (f.editable) this.#addSavedMenu(chip, f);
      } else if (kind !== 'boolean' || customOf(f)) this.#addMenu(chip, f, prior?.picked);
      const phrase = f.externalValue ?? f.customValue;
      if (phrase) {
        // `data-external` makes it findable: it is in neither `active` nor `values`.
        chip.setAttribute('data-external', '');
        chip.setAttribute('data-menu', '');
        // In FULL: "Contains: a…" names a condition with no subject.
        chip.setAttribute('data-full-value', '');
        externalLabels.push([chip, phrase]);
      }
      list.appendChild(chip);
      if (kind === 'date') {
        chip.setAttribute('data-full-value', '');
        this.#syncDateLabel(chip);
      }
    }

    // The MENUS, now their chips are in the list.
    this.#flushItems();
    for (const [id, reading] of Object.entries(kept)) this.#keepAnswer(id, reading);

    // These write into the chip's shadow root, so they wait on `el.rendered`.
    for (const [chip, text] of externalLabels) {
      const el = chip as HTMLElement & { valueLabel?: string; rendered?: Promise<void> };
      void Promise.resolve(el.rendered).then(() => { el.valueLabel = text; });
    }

    /* THE ADD MENU LISTS WHAT IS HELD, so it follows the run. `populate()` is
       deferred, so a host calling `available()` first had nothing to tick.
       TRAP T-the-add-menu-is-the-whole-list */
    this.#renderAvailable();
    // "Save filter" follows what the rebuilt menus answer, once they have drawn.
    void this.#settled().then(() => { if (this.isConnected) this.#syncSaveable(); });

    // A ResizeObserver fires only on a SIZE change; populating is not one, and
    // what fits just changed.
    this.#onResize();

    /* AND AGAIN once every chip has drawn ITSELF. A cloned `sherpa-quick-filter`
       stamps its own label and icon on its first render, so a run measured now
       is narrower than the run a reader sees — and the bar came to rest one
       chip short of folded, two pixels over its edge. Measured in Firefox: the
       remaining chip is 50px in a 48px track.

       TWO FRAMES after `rendered`, not one: the upgrade and the first stamp
       land in different turns, and the LAYOUT of that stamp in a third.
       TRAP T-the-fold-measures-a-chip-that-has-not-drawn-itself
       TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    void Promise.all(this.#chips().map(
      (chip) => (chip as HTMLElement & { rendered?: Promise<void> }).rendered,
    )).then(() => new Promise<void>((done) => {
      requestAnimationFrame(() => requestAnimationFrame(() => done()));
    })).then(() => { if (this.isConnected) this.#reflow(); });
  }

  /** Give a chip its value menu — real checkbox/radio rows in the chip's light DOM. */
  #addMenu(chip: HTMLElement, def: QuickFilterDef, picked?: Set<string>): void {
    /* ONE DEF, ONE MENU. The panel and a column heading build theirs the same
       way, so a field cannot open with a different control in each.
       TRAP T-one-field-one-filter-menu */
    const { menu, items } = menuFor(def, { bounds: this.dataset['bounds'] });

    // TRAP T-persistent-chip-is-a-selector — no pick at all falls back to the
    // FIRST option, or the chip paints as an empty warning.
    const options = def.options ?? [];
    const hasPick = picked ? picked.size > 0 : options.some((o) => o.selected);
    const fallback = def.persistent && !hasPick ? options[0]?.value : undefined;

    /* THE MENU draws its own items, from the DATA handed to it: it picks the
       control from `data-select` and sorts the unreachable below a divider.

       `items()`, not `populate()`: this chip is a detached clone, so its menu
       has not upgraded and an awaited populate would never settle.
       TRAP T-custom-element-upgrade */
    if (items.length) {
      this.#pendingItems.push([
        menu,
        items.map((item) => ({
          value: item.value,
          label: item.label,
          selected: picked
            ? picked.has(item.value) || item.value === fallback
            : !!item.selected || item.value === fallback,
          available: item.available,
          ...(item.note ? { note: item.note } : {}),
          ...(item.section ? { section: item.section } : {}),
        })),
      ]);
    }

    this.#addRemove(chip, menu, def);

    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
  }

  /**
   * The condition dropdown, plus the text box its typing conditions use.
   *
   * BOTH bodies are stamped: CSS reveals one off the menu's `data-takes`, so a
   * reader flipping between Equals and Contains keeps their ticks AND their
   * typing. Rebuilding would throw one of them away every flip.
   * TRAP T-an-operator-decides-pick-or-type
   * TRAP T-range-switch-swaps-not-rebuilds
   */
  /** A chip's condition or typed value changed — the bar's filter did too. */
  #onConditionChanged = (): void => {
    this.#emitChange();
    /* AGAIN next frame. A rebuilt condition row's value select is filled
       ASYNCHRONOUSLY, so `states` reads an unanswered row for one tick — and
       the host, told the bar holds no clause, drops the filter the reader
       just applied. TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
    if (this.#conditionFrame != null) return;
    this.#conditionFrame = requestAnimationFrame(() => {
      this.#conditionFrame = null;
      this.#emitChange();
    });
  };

  /** The pending re-report after a condition row rebuilt. */
  #conditionFrame: number | null = null;

  /** Menus whose items wait for their chip to enter the list. */
  #pendingItems: Array<[HTMLElement, unknown[]]> = [];

  /**
   * Hand each waiting menu its items.
   *
   * A cloned `<sherpa-menu>` upgrades only on entering the page, so an
   * `items()` call made while it was detached stamps nothing and is lost. Any
   * caller of `#addMenu` calls this once its host is in the document.
   * TRAP T-custom-element-upgrade
   */
  #flushItems(): void {
    for (const [menu, items] of this.#pendingItems) {
      (menu as HTMLElement & { items?: (i: unknown[]) => void }).items?.(items);
    }
    this.#pendingItems = [];
  }

  /**
   * Carry one chip's op, typing and rows into its REBUILT menu. Until that menu
   * has drawn — a menu that has not drops rows — `readings` reports them from
   * here, so an event sent straight after a rebuild still has them.
   * TRAP T-a-rebuild-keeps-every-answer
   */
  #keepAnswer(id: string, reading: FieldReading): void {
    const menu = this.#filterMenu(id) as (HTMLElement & {
      conditionValue: string; conditions?: readonly FieldCondition[]; rendered?: Promise<void>;
    }) | null;
    if (!menu) return;
    const op = reading.op ?? DEFAULT_OP;
    const text = reading.text ?? '';
    const conditions = reading.conditions ?? [];
    // Nothing its def does not already give it.
    if (!conditions.length && op === (menu.dataset['op'] ?? DEFAULT_OP)
      && text === (menu.dataset['value'] ?? '')) return;
    const held = { op, text, conditions };
    this.#pendingAnswers.set(id, held);
    void Promise.resolve(menu.rendered).then(() => {
      // A later rebuild has taken over.
      if (this.#pendingAnswers.get(id) !== held || !menu.isConnected) return;
      this.#pendingAnswers.delete(id);
      menu.dataset['op'] = op;
      menu.conditionValue = text;
      if (conditions.length) {
        // The menu refuses custom mode unless the field opted in.
        menu.setAttribute('data-custom', '');
        menu.dataset['mode'] = 'custom';
        menu.conditions = conditions;
      }
      // The chip draws its face from the menu it holds now; on or off as it was.
      const chip = menu.closest<ChipEl>('sherpa-quick-filter');
      if (chip) chip.current = !reading.suspended;
    });
  }

  /** Answers a rebuilt menu has not drawn yet, by chip id. TRAP T-a-rebuild-keeps-every-answer */
  #pendingAnswers = new Map<string, { op: FilterOp; text: string; conditions: readonly FieldCondition[] }>();

  /**
   * Settle after a REBUILD: every menu has stamped its rows.
   *
   * `items()` on a freshly cloned menu stamps NOTHING — the element has no
   * shadow template until it upgrades, so it keeps the list and stamps at
   * `onRender`. Reading the bar before that gives `values: {}` on a bar full
   * of ticked rows, and a host that answers such an event clears every filter
   * the reader had. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp
   */
  async #settled(): Promise<void> {
    await Promise.all(this.#chips().map(
      (chip) => (chip as HTMLElement & { rendered?: Promise<void> }).rendered,
    ));
    await Promise.all(this.#chips().flatMap((chip) =>
      [...chip.querySelectorAll('sherpa-menu')].map(
        (menu) => (menu as HTMLElement & { rendered?: Promise<void> }).rendered,
      )));
  }

  /** A reader's own saved chip: Edit filter and Delete filter, and Remove if it may go. */
  #addSavedMenu(chip: HTMLElement, def: QuickFilterDef): void {
    const menu = this.clone('template.qf-saved-menu-tpl');
    if (!menu) return;
    menu.setAttribute('data-heading', def.label);
    this.#addRemove(chip, menu, def);
    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
  }

  /** Give a chip's menu its "Remove" action. TRAP T-remove-is-opt-in-and-a-footer-button */
  #addRemove(chip: HTMLElement, menu: HTMLElement, def: QuickFilterDef): void {
    if (!chip.classList.contains('chip')) return;
    if (!def.removable || def.persistent) return;
    menu.setAttribute('data-removable', '');
  }

  /** A "Remove" row. `menu-select` is for ACTION rows; value rows commit via `menu-change`. */
  #onMenuSelect = (event: Event): void => {
    const value = (event as CustomEvent).detail?.value;
    if (value === 'save') {
      event.stopImmediatePropagation();
      const fromAdd = !!this.pathFind(event, '.add-btn');
      this.#requestSave(this.pathFind(event, 'sherpa-quick-filter'), fromAdd);
      return;
    }
    if (value === 'edit' || value === 'delete') {
      const id = this.pathFind(event, 'sherpa-quick-filter')?.dataset['id'];
      if (!id) return;
      event.stopImmediatePropagation();
      if (value === 'edit') void this.unpackFilter(id);
      else this.deleteFilter(id);
      return;
    }
    if (value !== 'remove') return;
    // TRAP T-remove-matches-the-tag-not-the-class — the PATH, and the TAG.
    const chip = this.pathFind(event, 'sherpa-quick-filter');
    const id = chip?.dataset['id'];
    if (!id) return;
    event.stopImmediatePropagation();
    // Shut it first: a popover destroyed while open leaves the top layer confused.
    (chip.querySelector('sherpa-menu') as HTMLElement & { hide?: () => void })?.hide?.();
    this.#removeFilter(id);
  };

  /** A chip was toggled: report the whole bar. */
  #onChipClick = (event: Event): void => {
    // Composed → find the originating chip on the path.
    const path = event.composedPath();

    /* GROUP and SORT handle their OWN body click and report it themselves —
       the chip knows what kind it is. This bar only stops the click reading as
       a filter change. TRAP T-a-chip-knows-what-kind-it-is */
    if (path.some((n) => n instanceof HTMLElement && n.classList.contains('organise-chip'))) {
      event.stopImmediatePropagation();
      return;
    }

    const chip = path.find(
      (n): n is ChipEl => n instanceof HTMLElement && n.classList.contains('chip'),
    );
    if (!chip) return;

    // A persistent chip has ALREADY flipped itself off by now, so put it back.
    if (chip.hasAttribute('data-persistent')) {
      chip.toggleAttribute('data-current', true);
      return;
    }
    this.#emitChange();
  };

  override onChange(): void {
    this.#syncArrangement('group');
    this.#syncArrangement('sort');
    this.#syncFavouriteFromAttr();
    this.#syncSaveable();
  }

  /**
   * Follow `data-group-field` / `data-sort-field` onto their chip.
   *
   * A GROUP IS A SORT WITH NO DIRECTION. These were two methods four apart, and
   * they drifted: one kept the column when its chip went off and the other
   * blanked it, so Group forgot what Sort remembered.
   * TRAP T-a-chip-body-cycles-its-states — no event; an empty field SUSPENDS.
   */
  #syncArrangement(kind: 'group' | 'sort'): void {
    const chip = this.$<HTMLElement>(`.organise-chip[data-id="${kind}"]`);
    if (!chip) return;

    // No field — OFF, keeping whatever pick it had. Off is not forgotten.
    const field = this.dataset[kind === 'sort' ? 'sortField' : 'groupField'] ?? '';
    if (!field) {
      chip.removeAttribute('data-current');
      return;
    }

    /* NAME THE COLUMN, then tick it. A rebuilt menu has no rows for a frame, so
       the tick can miss — `data-column` is what the chip reads until it lands,
       and its rows are RADIOS, so a later tick can only ever agree.
       TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
    chip.dataset['column'] = field;
    for (const radio of chip.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.checked = radio.value === field;
    }
    if (kind === 'group') {
      chip.toggleAttribute('data-current', true);
      return;
    }

    /* An EMPTY direction is a SUSPENDED sort: the column is still pushed, so
       only the direction says whether it runs — and a resume starts ASCENDING,
       so a suspended chip must not keep its `desc`.
       TRAP T-a-suspended-sort-is-one-owners-job · TRAP T-one-cycle-for-one-value */
    const raw = this.dataset['sortDirection'];
    const suspended = raw === '';
    chip.dataset['direction'] = suspended ? 'asc' : sortDirectionFrom(raw) ?? 'asc';
    chip.toggleAttribute('data-current', !suspended);
  }

  /** Report the whole filter state — the active toggle chips and every menu chip's picks. */
  #emitChange(): void {
    this.emit('quick-filter-change', {
      // TRAP T-values-carries-two-shapes — `scope` says WHICH shape this is.
      scope: 'bar',
      active: this.active,
      // APPLIED: only ON chips. REMEMBERED: including chips toggled off.
      values: this.values,
      picked: this.pickedValues,
      external: this.externalFilters,
      // Ready for a DataSource, for the chips that carry a CONDITION. A view
      // that offers no conditions never sees this and reads `values` as before.
      clauses: this.clauses,
    });
    this.#syncSaveable();
  }

  /**
   * "Save filter" where there is something to save, and only if the host saves:
   * a chip holding a Custom Condition, and the Add menu once any field is on.
   * TRAP T-save-packs-the-fields-into-one-chip
   */
  #syncSaveable(): void {
    const saves = this.hasAttribute('data-saveable');
    let any = false;
    for (const [field, state] of Object.entries(this.states)) {
      const on = state.fieldState === 'active';
      any ||= on;
      this.#filterMenu(field)?.toggleAttribute('data-saveable',
        saves && on && state.condition === 'custom');
    }
    // A drill edits one chip; the whole bar's Save waits outside it.
    if (!this.#drill.home) this.$('.add-btn sherpa-menu')?.toggleAttribute('data-saveable', saves && any);
  }

  /**
   * "Save filter" was pressed: ASK the host, with the readings to keep — one
   * field's from its own chip, every ON field's from the Add menu.
   * TRAP T-save-packs-the-fields-into-one-chip
   */
  #requestSave(chip: HTMLElement | null, fromAdd: boolean): void {
    const states = this.states;
    const fields = fromAdd
      ? Object.keys(states).filter((f) => states[f]!.fieldState === 'active')
      : [chip?.dataset['id'] ?? ''].filter((f) => f in states);
    const readings: Record<string, FieldReading> = {};
    for (const field of fields) {
      const reading = savedReading(states[field]!);
      if (reading) readings[field] = reading;
    }
    // The saved filter an Edit unpacked, so the host can offer its name back.
    const from = this.#unpacked;
    if (Object.keys(readings).length) this.emit('filter-save', { readings, ...(from ?? {}) });
  }

  /** The saved filter an Edit last unpacked — until it is packed or deleted. */
  #unpacked: { id: string; label: string } | null = null;

  /**
   * Put a saved filter's answer back into its fields — UNPACK. A field not on
   * the bar comes onto it from the Add list; each holds its part again, and
   * the saved chip goes OFF. ONE event, and the promise settles after it.
   * TRAP T-edit-unpacks-a-saved-filter
   */
  unpackFilter(id: string): Promise<void> {
    const def = this.#filters.find((f) => f.id === id);
    if (!def?.readings) {
      // TRAP T-a-broken-assumption-reports
      report({
        code: 'unknown-filter',
        message: 'unpackFilter: this bar holds no saved filter by that id.',
        at: { id, held: this.#filters.map((f) => f.id).join(',') },
      });
      return Promise.resolve();
    }
    const readings = def.readings;
    for (const field of Object.keys(readings)) {
      if (this.#filters.some((f) => f.id === field)) continue;
      const i = this.#available.findIndex((f) => f.id === field);
      if (i < 0) {
        report({
          code: 'unknown-filter',
          message: 'unpackFilter: the saved filter names a field this bar cannot hold.',
          at: { id, field },
        });
        continue;
      }
      const [add] = this.#available.splice(i, 1);
      this.#filters = [...this.#filters, { ...add!, active: false, removable: true }];
    }
    this.#unpacked = { id, label: def.label };
    this.#render();
    const chip = this.#chips().find((c) => c.dataset['id'] === id);
    if (chip) chip.current = false;
    // The rebuilt menus take rows only once they have drawn.
    return this.#settled().then(() => {
      for (const [field, reading] of Object.entries(readings)) {
        this.#clearField(field);
        this.setChipReading(field, reading);
      }
      this.#emitChange();
    });
  }

  /**
   * Delete a saved filter: gone from the bar AND the Add list, and
   * `filter-delete` tells the host to forget it. TRAP T-edit-unpacks-a-saved-filter
   */
  deleteFilter(id: string): void {
    this.#filters = this.#filters.filter((f) => f.id !== id);
    this.#available = this.#available.filter((f) => f.id !== id);
    if (this.#unpacked?.id === id) this.#unpacked = null;
    this.#render();
    this.#renderAvailable();
    this.emit('filter-delete', { id });
    void this.#settled().then(() => this.#emitChange());
  }

  /**
   * Show a SAVED filter in place of the fields it was made from — PACK. Its chip
   * comes ON and those fields clear, in ONE event. The host calls it once it
   * has stored the filter. TRAP T-save-packs-the-fields-into-one-chip
   */
  packFilter(saved: SavedFilter & { id: string }): void {
    const { id, label, readings } = saved;
    if (this.#filters.some((f) => f.id === id && !f.readings)) {
      // TRAP T-a-broken-assumption-reports — two chips, one id.
      report({
        code: 'id-taken',
        message: 'packFilter: a field chip already has that id, so the saved filter was not shown.',
        at: { id },
      });
      return;
    }
    // First: the rebuild below carries every answer across, these included.
    for (const field of Object.keys(readings)) this.#clearField(field);
    const def: QuickFilterDef = { id, label, readings, active: true, removable: true, editable: true };
    this.#unpacked = null;
    const i = this.#filters.findIndex((f) => f.id === id);
    if (i >= 0) this.#filters[i] = def;
    else this.#filters = [...this.#filters, def];
    this.#available = this.#available.filter((f) => f.id !== id);
    this.#render();
    // ON, even where it was already on the bar and switched off.
    const chip = this.#chips().find((c) => c.dataset['id'] === id);
    if (chip) chip.current = true;
    this.#emitChange();
  }

  /** Empty one field chip — ticks, op, typing and rows — and switch it off. */
  #clearField(id: string): void {
    const menu = this.#filterMenu(id) as (HTMLElement & {
      conditionValue: string; conditions?: readonly FieldCondition[]; mode?: string;
    }) | null;
    if (!menu) return;
    this.#pendingAnswers.delete(id);
    menu.dataset['op'] = this.#filters.find((f) => f.id === id)?.op ?? DEFAULT_OP;
    menu.conditionValue = '';
    if ((menu.conditions ?? []).length) menu.conditions = [];
    menu.mode = 'default';
    this.setChipValues(id, []);
  }

  /**
   * Every condition chip as a ready FilterClause, by chip id.
   *
   * A chip WITHOUT `custom: true` is absent: its meaning is `values`, and
   * a second shape for the same fact is a second answer. A chip on a typing
   * condition with nothing typed is absent too — an empty value says nothing.
   *
   * This is the shape the column heading's filter menu already reports, so one
   * field filtered from either place reaches the data layer identically.
   * TRAP T-an-operator-decides-pick-or-type
   */
  get clauses(): Record<string, Filter> {
    /* `Filter`, not `FilterClause`: a field the reader gave SEVERAL conditions
       reports a GROUP — `['or', …]` — and a caller ANDs it in exactly as it
       would one clause. TRAP T-many-conditions-are-one-reading */
    const out: Record<string, Filter> = {};
    for (const [field, state] of Object.entries(this.states)) {
      const clause = stateClause(state);
      if (clause) out[field] = clause;
    }
    return out;
  }

  /**
   * What a reader DID to each field — the parameters, not an answer.
   *
   * This is what a host sends to the data layer (`source.apply(bar.readings)`),
   * which turns it into a query. A bar that builds a clause has to know a
   * field's TYPE, and that is how one filtering rule became three.
   * TRAP T-the-field-type-decides-the-clause
   */
  get readings(): Record<string, FieldReading & { label: string; values: string[] }> {
    const out: Record<string, FieldReading & { label: string; values: string[] }> = {};
    for (const chip of this.#chips()) {
      const field = chip.dataset['id'];
      // A SUPERSEDED chip is the view's now; it narrows nothing here.
      if (!field || chip.hasAttribute('data-superseded')) continue;
      /* An EXTERNAL chip's id is NOT a field — it is `col:email`, the host's own
         name for a clause the host already applies. Reporting it here made
         `apply()` select on a field no row has, and the view went to 0 rows.
         External chips are reported by `external`, which is where they belong.
         TRAP T-a-wall-of-values-is-not-a-filter */
      if (chip.hasAttribute('data-external')) continue;

      /* The MENU holds the condition — one field, one filter menu, whether a
         chip or a column heading opened it.
         TRAP T-one-field-one-filter-menu */
      const menu = (chip as ChipEl & { menu?: HTMLElement }).menu as (HTMLElement & {
        conditionValue?: string; conditions?: FieldCondition[]; mode?: string;
      }) | null;
      if (menu?.getAttribute('data-type') !== 'filter') continue;

      const all = [...menu.querySelectorAll<HTMLInputElement>('input')]
        .filter((i) => !i.closest(NON_VALUE_ROWS))
        .map((i) => i.value);
      /* A chip switched OFF keeps its picks and applies none of them — off is
         not gone, and `suspended` below is what says so. Reporting an empty
         list instead DELETED the reading, so one click wiped what the reader
         had chosen and the chip could not switch back on.
         TRAP T-grid-suspend-is-not-clear */
      const picked = this.#chipPicks(chip);

      // A menu a rebuild has not drawn yet answers from what the rebuild kept.
      const held = this.#pendingAnswers.get(field);
      out[field] = {
        label: chip.dataset['label'] ?? field,
        values: all,
        picked,
        op: held?.op ?? (menu.dataset['op'] ?? DEFAULT_OP) as FilterOp,
        text: held?.text ?? menu.conditionValue ?? '',
        /* THE ROWS. Without these `stateClause` saw no conditions and gave
           nothing back, so a chip full of answered rows read as on, wore its
           `fx` badge, and filtered NOTHING.

           TRAP T-a-conditioned-chip-answers-with-its-clause */
        conditions: held ? [...held.conditions]
          : menu.mode === 'custom' ? (menu.conditions ?? []) : [],
        /* An OFF chip SUSPENDS: it keeps every row and applies none of them,
           exactly as it keeps its picks. Reporting none of them instead read
           as "no filter", and the chip could never switch itself back ON —
           it needed a clause to go on, and the clause needed it on.
           TRAP T-grid-suspend-is-not-clear */
        suspended: !chip.hasAttribute('data-current'),
      };
    }
    return out;
  }

  /**
   * Every filter chip's STATE, by field — READ-ONLY. Derived from `readings`,
   * so the two can never disagree. A host that wants to FILTER sends
   * `readings` to the data layer; this is for asking what a bar holds.
   * TRAP T-one-state-per-filtered-field
   */
  get states(): Record<string, FilterState> {
    const out: Record<string, FilterState> = {};
    for (const [field, { label, values, ...reading }] of Object.entries(this.readings)) {
      out[field] = fieldState({ field, label, values }, reading);
    }
    return out;
  }

  /**
   * setClause(id, clause) — set ONE condition chip from a ready FilterClause.
   *
   * The write path for `clauses`, and the door a COLUMN heading's filter menu
   * comes through: `column-filter-change` reports exactly this shape, so one
   * field filtered from the heading shows the same condition and value on its
   * chip. `null` clears the chip back to no condition.
   *
   * SILENT — echoing a change back to whoever set it filters twice.
   * TRAP T-an-operator-decides-pick-or-type
   */
  setClause(id: string, clause: readonly [string, FilterOp, unknown] | null): void {
    const menu = this.#filterMenu(id);
    if (!menu) {
      /* A CONDITION needs a filter menu to live in. A chip that is a toggle,
         a selector or a date has none, so the clause would vanish.
         TRAP T-a-broken-assumption-reports */
      report({
        code: 'no-filter-menu',
        message: 'setClause: that chip has no filter menu, so the clause was dropped.',
        at: { id, held: this.#filters.map((f) => f.id).join(',') },
      });
      return;
    }

    if (!clause) {
      menu.dataset['op'] = DEFAULT_OP;
      menu.conditionValue = '';
      this.setChipValues(id, []);
      return;
    }

    const [, op, value] = clause;
    /* `in`/`notin` are how SEVERAL picks read; the menu's own condition stays
       `eq`/`ne`, because its dropdown offers no "is one of" — the ticked list
       IS the "one of". TRAP T-an-operator-decides-pick-or-type */
    const own = op === 'in' ? 'eq' : op === 'notin' ? 'ne' : op;
    menu.dataset['op'] = own;

    if ((OP_TAKES[own] ?? 'list') === 'text') {
      menu.conditionValue = value == null ? '' : String(value);
    } else {
      const picks = (Array.isArray(value) ? value : [value])
        .filter((v) => v != null)
        .map((v) => String(v));
      this.setChipValues(id, picks);
    }
  }

  /**
   * report() — re-announce the WHOLE bar, as a reader's own change would.
   *
   * `setChipValues` is SILENT so a host writing a chip cannot be echoed back
   * into its own handler. That silence left a hole: a host that writes one chip
   * and expects the view to re-query had no way to say "now read me". The
   * legend binding is the case — it wrote "everything on, so nothing ticked"
   * and the view kept the old three-of-four clause, hiding the row the reader
   * had just switched back on.
   * TRAP T-a-silent-write-still-needs-a-way-to-report
   */
  report(): void {
    this.#emitChange();
  }

  /** One chip's FILTER menu, or null when it has none. */
  #filterMenu(id: string): (HTMLElement & { conditionValue: string }) | null {
    for (const chip of this.#chips()) {
      if (chip.dataset['id'] !== id) continue;
      const menu = chip.querySelector('sherpa-menu');
      return menu?.getAttribute('data-type') === 'filter'
        ? (menu as HTMLElement & { conditionValue: string })
        : null;
    }
    return null;
  }

  /** Is this chip's menu on a typing condition with something typed? */
  #hasTypedAnswer(chip: HTMLElement): boolean {
    const menu = chip.querySelector('sherpa-menu') as
      (HTMLElement & { conditionValue?: string }) | null;
    if (menu?.getAttribute('data-type') !== 'filter') return false;
    const op = (menu.dataset['op'] ?? DEFAULT_OP) as FilterOp;
    if ((OP_TAKES[op] ?? 'list') !== 'text') return false;
    return (menu.conditionValue ?? '').trim() !== '';
  }

  /**
   * Every ON saved filter's readings, by chip id — what a bound source applies,
   * one named part each. TRAP T-a-saved-filter-is-its-readings
   */
  get savedReadings(): Record<string, Record<string, FieldReading>> {
    const on = new Set(this.#chips().filter((c) => c.current).map((c) => c.dataset['id']));
    const out: Record<string, Record<string, FieldReading>> = {};
    for (const f of this.#filters) if (f.readings && on.has(f.id)) out[f.id] = f.readings;
    return out;
  }

  /**
   * Every EXTERNAL chip and whether it is on — `{ 'col:name': true }`.
   *
   * TRAP T-external-chips-are-reported-separately — a typed value has no rows to
   * read back, so on/off is the whole answer.
   */
  get externalFilters(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const chip of this.#chips()) {
      if (!chip.hasAttribute('data-external')) continue;
      out[chip.dataset['id'] ?? ''] = chip.current;
    }
    return out;
  }

  /** available([...]) — the filters the Add chip offers, over the populate() set. */
  available(defs: QuickFilterDef[]): void {
    this.#available = Array.isArray(defs) ? defs : [];
    this.#renderAvailable();
  }

  /**
   * What the Add button is OFFERING — the read-back half of `available()`.
   *
   * A host that set something needs to ask what the bar now holds: a filter
   * panel draws its own Add control per scope and cannot see into this
   * shadow root. TRAP T-a-panel-adds-through-the-bar-that-owns-the-list
   */
  get offering(): QuickFilterDef[] {
    return allow(this.#available, this.#allowedFields);
  }

  /**
   * addFilters([...ids]) — put offered filters on this bar, as the Add button
   * does. The one door, so a panel's Add and the bar's own Add cannot drift.
   * TRAP T-a-panel-adds-through-the-bar-that-owns-the-list
   */
  addFilters(ids: readonly string[]): void {
    this.#addFilters([...ids]);
  }

  /**
   * removeFilter(id) — take one filter off this bar, as its menu's Remove
   * does. The other half of `addFilters`, for the same reason: a filter panel
   * draws its own Remove and cannot reach this shadow root.
   * TRAP T-a-panel-adds-through-the-bar-that-owns-the-list
   */
  removeFilter(id: string): void {
    this.#removeFilter(id);
  }

  /** The ids this bar is holding — the read-back `populate()` never had. */
  get heldIds(): string[] {
    return this.#filters.map((f) => f.id);
  }

  /**
   * The DEFS this bar holds, each carrying what the reader has answered.
   *
   * A SECOND VIEW of the same fields — a filter panel — draws from this. It
   * used to read them out of this shadow root instead, which meant scraping
   * the value rows off a menu that might not be here at all.
   * TRAP T-a-panel-builds-its-own-menus
   */
  get held(): QuickFilterDef[] {
    const readings = this.readings;
    // A chip with no field reading — a toggle, a saved filter — is on or off AS IT IS.
    const on = new Set(this.#chips().filter((c) => c.current).map((c) => c.dataset['id']));
    return this.#filters.map((def) => {
      const reading = readings[def.id];
      if (!reading) return { ...def, active: on.has(def.id) };
      const picked = new Set((reading.picked ?? []).map(String));
      return {
        ...def,
        state: reading,
        ...(def.options
          ? { options: def.options.map((o) => ({ ...o, selected: picked.has(o.value) })) }
          : {}),
      };
    });
  }

  /**
   * allowFields([...]) — the ONLY fields this bar may offer, or `null` for all.
   *
   * A context, a role or a fetch decides what a reader may filter by; this bar
   * does not need a branch for who is looking. No list is the default, so a
   * caller that never sets one sees no change.
   * TRAP T-an-allow-list-is-a-filter-not-an-order
   */
  allowFields(list: AllowList): void {
    this.#allowedFields = list ?? null;
    // RENDER FIRST: it replaces the chip run, and the Add button's menu is
    // stamped into that same DOM. The other two callers order it this way too.
    this.#render();
    this.#renderAvailable();
  }

  /** The fields this bar may offer, or null for all. */
  #allowedFields: AllowList = null;

  /** Stamp the Add button's menu from whatever is left to add. */
  #renderAvailable(): void {
    const add = this.$<HTMLElement>('.add-btn');
    if (!add) return;
    const offer = allow(this.#available, this.#allowedFields);
    /* THE WHOLE LIST, not what is LEFT. Ticked is held: a tick adds a chip and
       an untick removes it, so a reader never hunts for where a filter goes.
       Only a REMOVABLE chip is listed — a tick that cannot be cleared is a lie.
       TRAP T-the-add-menu-is-the-whole-list */
    const held = allow(this.#filters.filter((f) => f.removable), this.#allowedFields);
    // A rebuilt run is folded again before it is shown, so a stale fold lists nothing.
    const folded = this.#folded.filter((c) => c.isConnected);
    const any = offer.length > 0 || held.length > 0 || folded.length > 0;
    this.toggleAttribute('data-can-add', any);
    add.toggleAttribute('disabled', !any);
    if (folded.length) add.dataset['badge'] = String(folded.length);
    else add.removeAttribute('data-badge');
    add.querySelector('sherpa-menu')?.remove();
    if (!any) return;
    this.#addMenu(add, {
      id: 'add',
      label: FILTERS_LABEL,
      select: 'multiple',
      // TRAP T-add-menu-batches — the one menu that KEEPS Apply: each tick stamps
      // a chip, so per-tick apply rebuilds the run mid-selection.
      commit: true,
      options: filtersMenuItems(held, offer, folded.length > 0),
    });
    // Its host is already in the page, so the items can go now.
    this.#flushItems();
    const menu = add.querySelector<HTMLElement>('sherpa-menu');
    menu?.toggleAttribute('data-search', true);
    if (menu) this.#addFoldedRows(menu, folded);
    this.#syncSaveable();
  }

  /** Move the chosen available filters onto the bar. */
  #addFilters(ids: string[]): void {
    const added: QuickFilterDef[] = [];
    for (const id of ids) {
      const i = this.#available.findIndex((f) => f.id === id);
      if (i < 0) {
        // TRAP T-a-broken-assumption-reports — the caller named something the
        // Add list does not hold, so nothing appears and nothing says why.
        report({
          code: 'unknown-filter',
          message: 'addFilters: this bar offers no such filter, so nothing was added.',
          at: { id, offering: this.#available.map((f) => f.id).join(',') },
        });
        continue;
      }
      const [def] = this.#available.splice(i, 1);
      /* OFF, and REMOVABLE. A chip added ON holds no values yet, and "on but
         filtering by nothing" is the amber warning — shown to a reader who has
         done nothing wrong. They add the chip, then answer it.
         TRAP T-a-new-chip-opens-in-default-not-warning
         A SAVED filter is answered already, so it comes ON.
         TRAP T-saved-filters-are-the-custom-section */
      added.push({ ...def!, active: !!def!.readings, removable: true });
    }
    if (!added.length) return;
    this.#filters = [...this.#filters, ...added];
    this.#render();
    this.#renderAvailable();
    // ONE event for the batch — a host re-queries once.
    this.emit('filter-add', { ids: added.map((f) => f.id), filters: added });
    // AFTER the rebuild. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp
    void this.#settled().then(() => this.#emitChange());
  }

  /** Take one filter back OFF the bar. It returns to the Add menu, clean. */
  #removeFilter(id: string): void {
    const i = this.#filters.findIndex((f) => f.id === id);
    if (i < 0) {
      // TRAP T-a-broken-assumption-reports
      report({
        code: 'unknown-filter',
        message: 'removeFilter: this bar is not holding that filter.',
        at: { id, held: this.#filters.map((f) => f.id).join(',') },
      });
      return;
    }
    const [def] = this.#filters.splice(i, 1);
    const { active: _active, ...clean } = def!;
    this.#available = [...this.#available, clean as QuickFilterDef];
    this.#render();
    this.#renderAvailable();
    this.emit('filter-remove', { id, filter: clean });
    /* AFTER the rebuild has settled. Emitting here read `values: {}` from a
       bar whose menus had not stamped, and the host answered by clearing every
       other chip. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    void this.#settled().then(() => this.#emitChange());
  }

  /* ── Action cluster ────────────────────────────────────────────────── */

  /** One listener for the whole cluster — the action is read off `data-act`. */
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
        // RESETS, not announces: a host cannot reach chips it did not stamp.
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
        this.#toggleFavourite();
        break;
      case 'add':
        // sherpa-button opens its own slotted menu; nothing to do here.
        break;
    }
  };

  /** The Add menu committed. `menu-change`: only a CHIP re-emits as quick-filter-change. */
  #onAddCommit = (event: Event): void => {
    const add = this.pathFind(event, '.add-btn');
    if (!add) return;
    event.stopImmediatePropagation();
    // A DRILLED chip's pick is that chip's — never an Add or a Remove.
    if (this.#drill.home) {
      this.#emitChange();
      return;
    }
    /* WHAT CHANGED is the difference between what the menu now says and what
       the bar is holding — an unticked row is a REMOVE, and that is the only
       way to take a chip off from here.
       TRAP T-the-add-menu-is-the-whole-list */
    const want = new Set(((event as CustomEvent).detail?.values ?? []) as string[]);
    const held = new Set(this.#filters.filter((f) => f.removable).map((f) => f.id));
    const added = [...want].filter((id) => !held.has(id));
    const gone = [...held].filter((id) => !want.has(id));
    for (const id of gone) this.#removeFilter(id);
    if (added.length) this.#addFilters(added);
  };

  /**
   * The star REPORTS the intent; `data-favourite` is the answer, IN.
   *
   * Locked, the bar never writes its own attribute — a host that owns the
   * favourites list answers by setting it, and the click is only a request.
   * TRAP T-the-star-reports-it-does-not-decide
   */
  #toggleFavourite(): void {
    const on = !this.hasAttribute('data-favourite');
    if (!this.hasAttribute('data-locked')) {
      this.toggleAttribute('data-favourite', on);
      this.#syncFavouriteFromAttr();
    }
    this.emit('view-favorite', { favourite: on });
  }

  /** Paint the star from the attribute.
   *  TRAP T-favourite-star-swaps-its-glyph — colour alone cannot carry it. */
  #syncFavouriteFromAttr(): void {
    const btn = this.$<HTMLElement>('.act[data-act="favourite"]');
    if (!btn) return;
    const on = this.hasAttribute('data-favourite');
    // `active` is a real Style MODE; the adopted style-modes sheet paints it.
    // TRAP T-tokens-css-never-reaches-shadow
    if (on) btn.setAttribute('data-status', 'active');
    else btn.removeAttribute('data-status');
    /* NAMED, not `fa-solid`/`fa-regular`: the resolver strips the weight token,
       so both FA spellings resolved to the SAME outline drawing and the star
       never filled. TRAP T-favourite-star-swaps-its-glyph */
    btn.setAttribute('data-icon-start', on ? 'star-filled' : 'star');
    btn.setAttribute('aria-pressed', String(on));
  }

  /**
   * Put an EXTERNAL filter on the bar: one the host applies somewhere else.
   * The chip shows its finished phrase.
   *
   * Give it the CONDITION behind the phrase (`op`, `text`) and the chip gets a
   * real filter menu that opens on it. Without one the caret still reads the
   * phrase but opens nothing, which is drawn exactly like every caret that
   * does. TRAP T-an-external-chip-caret-must-open-its-condition
   */
  addExternalFilter(spec: ExternalFilterSpec): void {
    const { id, label, value, op, text } = spec;
    const i = this.#filters.findIndex((f) => f.id === id);

    // No value, no filter — a chip reading "Name:" narrows nothing.
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
      // Theirs to remove.
      removable: true,
      externalValue: value,
      /* THE CONDITION, where the caller named it: the menu then opens in
         custom mode showing what is applied, instead of opening nothing.
         TRAP T-an-external-chip-caret-must-open-its-condition */
      ...(op || text
        ? { custom: true, ...(op ? { op } : {}), ...(text ? { text } : {}) }
        : {}),
    };

    if (i >= 0) this.#filters[i] = def;
    else this.#filters = [...this.#filters, def];

    this.#render();
    this.#emitChange();
  }

  /** The old name of `addExternalFilter()`, still a door.
   *  TRAP T-a-renamed-attribute-keeps-its-old-name */
  addCustomFilter(spec: ExternalFilterSpec): void {
    this.addExternalFilter(spec);
  }

  /** TRAP T-clear-all-resets-organise-too — organise chips included; three events afterwards. */
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
      /* FORGET the way, rather than write one: the chip answers `asc` for a
         chip with none. TRAP T-one-cycle-for-one-value */
      delete chip.dataset['direction'];
    }
    this.emit('filter-clear', {});
    this.#emitChange();
    this.emit('group-change', { field: null });
    this.emit('sort-change', { field: null, direction: 'asc' });
  }

  /* ── Organise: the leading Group / Sort chips ───────────────────────── */

  /** TRAP T-organise-glyphs-are-named-not-inline — `view` stays here, the shared four in core/icons. */
  /** The View chip glyph, plus the shared Group and Sort glyphs. */
  static readonly #icons = {
    view: 'desktop',
    ...ORGANISE_ICONS,
  } as const;

  /**
   * organise({ group, sort }) — how ONE component arranges the rows it draws.
   *
   * REFUSED on a `data-type="view"` bar. Group and Sort are not filters and
   * have no view-level meaning: a view holds a population, and "sorted by
   * name" is a property of a table, not of a population. Two components in one
   * view sort differently and are both right.
   *
   * A filter chip answers "which rows"; an organise chip answers "in what
   * order" — which is why this is a separate call from `populate()`.
   * TRAP T-organise-chips-lead-the-bar
   * TRAP T-group-and-sort-are-component-scope
   */
  organise(def: OrganiseDef): void {
    if (this.dataset['type'] === 'view') {
      this.#organise = {};
      return;
    }
    this.#organise = def ?? {};
    this.#renderOrganise();
  }

  /** The column the grid is grouped by — null when the chip is OFF, radio or no radio. */
  get groupField(): string | null {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="group"]');
    if (!chip || !chip.hasAttribute('data-current')) return null;
    return this.#menuValue('group') ?? null;
  }

  /** The column the grid is sorted by — null while SUSPENDED, though the chip remembers it. */
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

  /** Stamp the Group and Sort chips into the organise zone. Both single-select. */
  #renderOrganise(): void {
    const zone = this.$('.organise-zone');
    const chipTpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!zone || !chipTpl) return;

    const group = this.#organise.group ?? [];
    const sort = this.#organise.sort ?? [];
    zone.replaceChildren();
    // CSS cannot see whether the zone has children, and an empty one would leave
    // its divider rule floating.
    this.toggleAttribute('data-has-organise', group.length > 0 || sort.length > 0);

    /* BORN NAMING ITS COLUMN. The bar may already be grouped or sorted — a
       reload restores both — so the chip is built on that column rather than
       waiting for a second pass to tick it. */
    const on = { group: this.dataset['groupField'] ?? '', sort: this.dataset['sortField'] ?? '' };
    const cols = (list: readonly OrganiseColumn[], field: string): QuickFilterOption[] =>
      list.map((c) => ({ value: c.field, label: c.label, selected: c.field === field }));

    if (group.length) {
      // fa-SOLID: the free set has no regular weight here; `fa-regular` renders
      // the missing-glyph box.
      zone.appendChild(this.#organiseChip('group', 'Group',
        SherpaQuickFilterToolbar.#icons.group, cols(group, on.group), on.group));
    }
    if (sort.length) {
      // The MENU picks the column, the BODY cycles direction. Built OFF, so it
      // opens with the sort-none glyph.
      /* NO `data-direction` here. `chip.direction` answers `asc` for a chip that
         is ON with none set, so writing it is a third place that has to agree.
         TRAP T-one-cycle-for-one-value */
      zone.appendChild(this.#organiseChip('sort', 'Sort',
        SherpaQuickFilterToolbar.#icons.sortNone, cols(sort, on.sort), on.sort));
    }
    // Both chips are in the zone now, so their menus have upgraded.
    this.#flushItems();
  }

  /** One organise chip: a menu chip with single-select rows. */
  #organiseChip(
    id: string,
    label: string,
    icon: string,
    options: QuickFilterOption[],
    column = '',
  ): HTMLElement {
    const chip = this.clone('template.qf-tpl');
    if (!chip) throw new Error('sherpa-quick-filter-toolbar: template.qf-tpl is missing or empty');
    chip.classList.remove('chip');
    chip.classList.add('organise-chip');
    /* THE CHIP KNOWS WHAT IT IS, and owns its own gesture: group toggles,
       sort cycles. This bar only places it and hears what it reports.
       "Organise" is the zone it sits in, not a kind.
       TRAP T-a-chip-knows-what-kind-it-is */
    chip.dataset['kind'] = id;
    chip.dataset['id'] = id;
    if (column) chip.dataset['column'] = column;
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

  /** A Group or Sort pick is an arrangement: stop it reading as a filter change. */
  #onOrganiseChange = (event: Event): void => {
    /* This hears the chips' quick-filter-change AND the toolbar's own, emit()
       being composed. Registered in CAPTURE so it can stop a group/sort pick
       before a host reads it as a filter change.
       TRAP T-capture-beats-registration-order */
    const path = event.composedPath();
    const chip = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('organise-chip'),
    );
    if (!chip) {
      // A FILTER chip committed. Its event reports one chip; swap it for the
      // toolbar-level one, which reports the WHOLE state.
      const filterChip = path.find(
        (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('chip'),
      );
      if (filterChip) {
        event.stopImmediatePropagation();
        /* The chip's OWN answer: `values` reports only chips already ON, so an
           off chip could never commit itself on — every date chip's first pick.
           A TYPED condition is an answer too, so this cannot read ticked rows
           alone: "Contains Ravi" filtered 100 rows down to 22 while its chip
           read OFF. TRAP T-an-operator-decides-pick-or-type */
        filterChip.toggleAttribute(
          'data-current',
          filterChip.hasAttribute('data-persistent')
            || this.#chipPicks(filterChip).length > 0
            || this.#hasTypedAnswer(filterChip),
        );
        this.#syncDateLabel(filterChip);
        this.#emitChange();
      }
      return;
    }
    event.stopImmediatePropagation();

    // ON while it holds a choice — that is what makes a grouping visible.
    const id = chip.dataset['id'];
    const picked = !!this.#menuValue(id ?? '');
    chip.toggleAttribute('data-current', picked);

    if (id === 'group') this.emit('group-change', { field: this.groupField });
    else if (id === 'sort') {
      // Resumes in the remembered direction — the tri-state cycle is body-only.
      this.emit('sort-change', { field: this.sortField, direction: this.sortDirection });
    }
  };
}

customElements.define('sherpa-quick-filter-toolbar', SherpaQuickFilterToolbar);
