/**
 * sherpa-quick-filter-toolbar — the chip row: folds what does not fit, reports what the reader did.
 *
 * TRAP T-actions-were-a-slot
 *
 * Map:
 * - QuickFilterOption — One value a filter chip's menu can offer.
 * - QuickFilterDef — one filter chip as data: its id, kind, values, and how it answers
 * - OrganiseColumn — One column the grid can be grouped or sorted by.
 * - OrganiseDef — The columns the leading Group / Sort chips offer.
 * - SortDirection — Matches the standard data-sort-direction values.
 */
import { DATA_PROPS, SHARED_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import { NON_VALUE_ROWS, ORGANISE_ICONS } from '../../core/ui/shared-constants.js';
import { allow, type AllowList } from '../../core/data/allow.js';
import { advancedOf, kindOf, type FilterKind, type OffersAdvanced } from '../../core/ui/filter-kind.js';
import {
  EDITOR_EVENTS, editorFor, lineField, menuFor, saidItems, withAnswer, type FilterMenuItem,
} from '../../core/ui/filter-menu.js';
import type { SaidField } from '../../core/data/filter-face.js';
import {
  FILTERS_LABEL, MenuDrill, ON, filtersMenuItems, onOffMenu, type AddedFilter,
} from '../../core/ui/filters-button.js';
import { report } from '../../core/data/report.js';
import { DEFAULT_OP, type FilterOp } from '../../core/data/store.js';
import {
  fieldState, readingRows, savedReading,
  type FieldReading, type FilterState,
} from '../../core/data/filter-state.js';
import type { SavedFilter } from '../../core/browser/saved-filters.js';
import type { ScopeQuery } from '../../core/data/query.js';
import type { DataAsk } from '../../core/ui/context.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-calendar/sherpa-calendar.js';
import '../sherpa-slider/sherpa-slider.js';
import '../sherpa-switch/sherpa-switch.js';

/** One value a filter chip's menu can offer. */
export interface QuickFilterOption {
  value: string;
  label: string;
  selected?: boolean;
  /** `false`: ruled out — listed, greyed and refused unless picked. TRAP T-a-ruled-out-value-is-greyed */
  available?: boolean;
  /** A second fact its menu row shows, muted. */
  note?: string;
  /** The section its menu row is in, headed where it changes. */
  section?: string;
}

export interface QuickFilterDef extends OffersAdvanced {
  id: string;
  label: string;
  /** Its answer survives a View change. TRAP T-a-field-can-carry-over-views */
  carryOver?: boolean;
  /** The FIELD this chip answers, when its id is not that field — the header's
   *  Date chip answers the record's time. A source draws the chip by it.
   *  `null`: it answers no field HERE, so it reports nothing. */
  field?: string | null;
  type?: string;
  active?: boolean;
  icon?: string;
  /** Values this chip filters by — a menu of checkbox or radio rows. */
  options?: QuickFilterOption[];
  select?: 'single' | 'multiple';
  /** WHAT THIS FILTER IS — see `core/ui/filter-kind.ts`. A def that leaves it
   *  out has it worked out from `select`, `advanced` and whether there are
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
  /** Start in RANGE mode. The user may still flip it. */
  range?: boolean;
  /** A chip that cannot be switched OFF. TRAP T-persistent-chip-is-a-selector */
  persistent?: boolean;
  /** `false`: its menu has no Select all row. */
  selectAll?: boolean;
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
  /** A SAVED Advanced filter: its answer, given field by field. The chip is a
   *  toggle, and a bound source applies it as one part.
   *  TRAP T-a-saved-filter-is-its-readings */
  readings?: Record<string, FieldReading>;
  /** The reader's OWN saved filter: its menu offers Edit filter and Delete filter.
   *  TRAP T-edit-unpacks-a-saved-filter */
  editable?: boolean;
  /** A saved filter's conditions in WORDS, as its source says them; without
   *  one the bar words its readings. TRAP T-a-saved-chip-lists-its-conditions */
  says?: SaidField[];
  /** A saved filter the reader CHANGED and has not saved, from its source:
   *  what it applies now. TRAP T-a-saved-filter-keeps-its-edit */
  edited?: Record<string, FieldReading>;
}

/** The menu a saved filter's field is changed in. */
interface EditorMenu extends HTMLElement {
  reading: FieldReading;
  readonly rendered: Promise<void>;
  items(next: readonly FilterMenuItem[]): void;
  show(trigger?: HTMLElement): void;
  hide(): void;
}

interface ChipEl extends HTMLElement {
  current: boolean;
  /** Setting these brings the chip's label and badge along. */
  values: readonly string[];
  /** Its whole answer, read and drawn; null where it answers no field.
   *  TRAP T-a-chip-says-its-own-answer */
  reading: FieldReading | null;
  /** Does it hold an answer of any kind. */
  readonly answered: boolean;
  /** Empty it and switch it off. A property type, as `refresh` is. */
  readonly clear: (op?: FilterOp) => void;
  readonly menu: HTMLElement | null;
  /** Redraw the face after a silent steer. A property type, so the spec does
   *  not read it as one of the TOOLBAR's methods. */
  readonly refresh: () => void;
  /** The rows its own answer matches. TRAP T-a-chip-counts-its-own-results */
  results: number | null;
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
  /* It ASKS for its `data-scope`: the source draws it and hears its reports.
     TRAP T-a-component-asks-its-provider */
  static override asks: DataAsk = { shape: 'scope' };

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
    /* The View on screen is the READER's own, so it can be deleted. Written by
       the provider. TRAP T-a-saved-view-is-the-readers-own */
    'data-custom-view': { type: 'boolean', kind: 'visibility' },
  } as const;

  /** Sort and group written from outside — unobserved, a grid header click says nothing here. */
  /** `data-favourite` is observed so a host that owns the favourites list can
   *  paint the star. TRAP T-the-star-reports-it-does-not-decide */
  static override observed = [
    'data-sort-field', 'data-sort-direction', 'data-group-field', 'data-favourite',
    // The host saves filters. TRAP T-save-packs-the-fields-into-one-chip
    'data-saveable',
    // Its source fetches from outside: menus wait for Apply. TRAP T-commit-follows-select-mode
    'data-remote',
    // The FIELDS its source says are changed and not applied. TRAP T-a-pending-chip-has-no-fill
    'data-pending',
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
    const was = { collapse: this.#collapse, folded: this.#folded };

    this.removeAttribute('data-collapse');
    this.#collapse = 0;
    this.removeAttribute('data-folded');
    this.#showAllChips();

    for (let step = 1; step <= SherpaQuickFilterToolbar.COLLAPSE_STEPS; step++) {
      if (!this.#overflowing()) break;
      this.setAttribute('data-collapse', String(step));
      this.#collapse = step;
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
    // Nothing moved: the open menus stay. TRAP T-a-reflow-that-moves-nothing-keeps-its-menus
    if (this.#collapse === was.collapse
      && folded.length === was.folded.length && folded.every((c, i) => c === was.folded[i])) return;
    this.#closeOverflow();
    // What has folded changed.
    this.$<HTMLElement & { hide?: () => void }>('.more-menu')?.hide?.();
    // The ONE Filters menu lists them. TRAP T-one-filters-button
    this.#folded = folded;
    this.#renderAvailable();
  }

  /** The chips the last fold took off the run, in bar order. */
  #folded: HTMLElement[] = [];
  /** The step the last fold collapsed the actions to. */
  #collapse = 0;

  /** Re-read every folded chip's pick count on its row. Separate from stamping, which rebuilds the open list. */
  #syncFoldedBadges(): void {
    const menu = this.$<HTMLElement>('.add-btn')
      ?.querySelector<HTMLElement & { setCount?(value: string, count: number): void }>('sherpa-menu');
    for (const chip of this.#folded) {
      if (chip.isConnected) menu?.setCount?.(chip.dataset['id'] ?? '', this.#chipPicks(chip).length);
    }
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

  /** A folded chip's rows, moved into the Filters menu. TRAP T-drill-moves-not-clones */
  #drill = new MenuDrill();

  /** The menu built for an on/off chip's drill, and that chip. */
  #built: { menu: HTMLElement; chip: HTMLElement } | null = null;

  /**
   * A folded chip's row asked for its child menu: drill into it. An on/off
   * chip has no menu of its own, so its child menu is one row, "On".
   * TRAP T-a-row-opens-its-child-menu
   */
  #onMenuDrill = async (event: Event): Promise<void> => {
    const id = String((event as CustomEvent).detail?.value ?? '');
    // A saved filter's line, `field:n`, opens that field. TRAP T-a-saved-filter-keeps-its-edit
    const saved = this.#savedChipOf(event);
    if (saved) {
      event.stopPropagation();
      await this.#editSaved(saved, lineField(id));
      return;
    }
    const add = this.pathFind(event, '.add-btn');
    const into = add?.querySelector<HTMLElement & { open?: boolean }>('sherpa-menu');
    const chip = id ? this.$<HTMLElement>(`.chips > .chip[data-id="${CSS.escape(id)}"]`) : null;
    if (!add || !into || !chip) return;
    event.stopPropagation();
    // Back stays one level deep, never a chain.
    if (this.#drill.home) this.#drillOut();
    const label = this.#filters.find((f) => f.id === id)?.label ?? chip.dataset['label'] ?? id;

    let from = chip.querySelector<HTMLElement>('sherpa-menu');
    if (!from) {
      const { menu, items } = onOffMenu(label, (chip as ChipEl).current);
      this.$('.qf-built')?.append(menu);
      this.#built = { menu, chip };
      await (menu as HTMLElement & { rendered?: Promise<void> }).rendered;
      (menu as HTMLElement & { items?: (i: unknown[]) => void }).items?.(items);
      // It may have shut, or another row taken the drill, while it drew.
      if (!into.open || this.#built?.menu !== menu) {
        if (this.#built?.menu === menu) this.#dropBuilt();
        return;
      }
      from = menu;
    }

    /* NOTHING TO DRILL. An advanced-only menu answers with its condition
       ROWS, which live in its own shadow DOM — moving its empty light DOM put
       a blank card on screen, so the filter could never be answered, never
       went active, and never filtered. Show the menu ITSELF, anchored to the
       Filters button. TRAP T-a-conditions-only-menu-cannot-be-drilled */
    if (!from.children.length) {
      this.#closeOverflow();
      (from as HTMLElement & { show?: (t?: HTMLElement) => void }).show?.(add);
      return;
    }
    this.#drill.into(into, from, label);
  };

  /** Remove the menu built for an on/off chip's drill. */
  #dropBuilt(): void {
    this.#built?.menu.remove();
    this.#built = null;
  }

  /** A calendar picked a day or range. The chip relabels itself. */
  #onDatePicked = (event: Event): void => {
    // TRAP T-path-not-target-finds-chip-host — match the TAG, not `.chip`.
    const chip = this.pathFind(event, 'sherpa-quick-filter');
    if (!chip) return;
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

  /** Put a drilled-in filter's rows back and restore the Filters list. */
  #drillOut(): void {
    // Deferred: the badges are read once the rows are back in place.
    if (this.#drill.out()) queueMicrotask(() => this.#syncFoldedBadges());
    this.#dropBuilt();
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
    this.$('.more-menu')?.addEventListener('menu-select', this.#onMore);
    // CAPTURE — see #onOrganiseChange.
    this.addEventListener('quick-filter-change', this.#onOrganiseChange, true);
    this.addEventListener('quick-filter-change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-change', this.#onFoldedCountsChanged);
    // A committing menu fires nothing while rows are ticked; their native
    // `change` reaches here, being in the CHIP's light DOM.
    this.addEventListener('change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-select', this.#onMenuSelect);
    // A draft in an open menu, and its Apply or Cancel. TRAP T-a-pending-chip-has-no-fill
    for (const type of ['input', 'change', 'condition-change', 'menu-open', 'menu-close', 'menu-change']) {
      this.addEventListener(type, this.#queuePending);
    }
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
    this.addEventListener('menu-drill', this.#onMenuDrill as EventListener);
    // The back arrow is two shadow boundaries away; the menu re-emits it composed.
    this.addEventListener('menu-back', this.#drillOutHandler);
    const editor = this.$('.qf-editor');
    for (const type of EDITOR_EVENTS) editor?.addEventListener(type, this.#onEditorEvent);

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
      .filter((c) => c.current && (!c.hasAttribute('data-menu') || this.#isSaved(c)))
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
      // A saved filter is a toggle: its menu holds no picks to set.
      if (!id || !chip.hasAttribute('data-menu') || this.#isSaved(chip)) continue;
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
  #setChipActive(id: string, on: boolean): void {
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
    // The CHIP draws it: it knows what answers it. TRAP T-a-chip-says-its-own-answer
    const chip = this.#chips().find((c) => c.dataset['id'] === id && c.hasAttribute('data-menu'));
    if (chip) chip.reading = reading;
  }

  /**
   * PENDING: a chip whose change is not applied yet — a draft in its own open
   * menu, or a field its source says waits (`data-pending`). THIS BAR is the
   * one writer of the chip's flag. Locally a menu never waits, so nothing is
   * ever pending there. Will, 2026-09-26 (TODO 46). TRAP T-a-pending-chip-has-no-fill
   */
  #syncPending(): void {
    const waiting = new Set((this.dataset['pending'] ?? '').split(' ').filter(Boolean));
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'] ?? '';
      const field = this.#filters.find((f) => f.id === id)?.field ?? id;
      const menu = chip.querySelector<HTMLElement & { dirty?: boolean }>('sherpa-menu');
      chip.toggleAttribute('data-pending', !!menu?.dirty || waiting.has(field));
    }
  }

  /** Re-read the pending flags once the event that moved a draft has landed. */
  #queuePending = (): void => {
    queueMicrotask(() => this.#syncPending());
  };

  /**
   * drawResults(results) — each answered chip's results, from its source: the
   * rows its own answer matches, by field or saved-filter id. SILENT. A chip
   * with none shows no number. Will, TODO 60. TRAP T-a-chip-counts-its-own-results
   */
  drawResults(results: Readonly<Record<string, number>>): void {
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'] ?? '';
      const field = this.#filters.find((f) => f.id === id)?.field ?? id;
      chip.results = results[field] ?? results[id] ?? null;
    }
  }

  /**
   * drawPresent(present) — a bound source says what each field's other
   * answers leave; a chip's menu greys the rest. SILENT. A field not named is
   * not limited. TRAP T-a-ruled-out-value-is-greyed
   */
  drawPresent(present: Readonly<Record<string, readonly string[]>>): void {
    this.#present = present;
    for (const chip of this.#chips()) this.#markPresent(chip);
  }
  /** What each field's other answers leave, as the source last said. */
  #present: Readonly<Record<string, readonly string[]>> = {};

  /** One chip's menu, told what its field's other answers leave. */
  #markPresent(chip: HTMLElement): void {
    const id = chip.dataset['id'] ?? '';
    const field = this.#filters.find((f) => f.id === id)?.field ?? id;
    const menu = chip.querySelector<HTMLElement & { present?: readonly string[] | null }>('sherpa-menu');
    if (menu && !this.superseded.includes(id)) menu.present = this.#present[field] ?? null;
  }

  /**
   * drawReading(field, reading) — a bound source tells this bar one field's
   * answer, whoever set it. SILENT, as every steer is. A SUPERSEDED chip keeps
   * the reader's own picks for when the view lets go.
   * TRAP T-a-superseded-chip-suspends-it-is-never-removed
   */
  drawReading(field: string, reading: FieldReading): void {
    const id = this.#idOf(field);
    if (this.superseded.includes(id)) return;
    /* A chip just ADDED — a raised field's — stamps its menu a moment later,
       and an answer drawn before that is lost. It waits for the SAME settle
       the add's own report waits for, and is queued first — so that report
       carries the answer instead of clearing it.
       TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    const chip = this.#chips().find((c) => c.dataset['id'] === id);
    const menu = chip?.querySelector('sherpa-menu');
    if (chip && (!chip.shadowRoot?.childElementCount || (menu && !menu.shadowRoot?.childElementCount))) {
      void this.#settled().then(() => { if (!this.superseded.includes(id)) this.#drawChip(id, reading); });
      return;
    }
    this.#drawChip(id, reading);
  }

  /** One chip's answer, and whether it is ON. OFF keeps the answer and applies
   *  none of it. TRAP T-grid-suspend-is-not-clear */
  #drawChip(id: string, reading: FieldReading): void {
    this.setChipReading(id, reading);
    // A chip with no field menu — a saved filter — is only on or off.
    if (reading.suspended) this.#setChipActive(id, false);
  }

  /** The chip that answers a field: its def's `field`, else its id. */
  #idOf(field: string): string {
    return [...this.#filters, ...this.#available].find((f) => (f.field ?? f.id) === field)?.id ?? field;
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
    // By field or by id: a chip named for its question answers its def's field.
    const taken = new Set(ids.map((f) => this.#idOf(f)));
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
    const kept = this.hasAttribute('data-reset-on-populate') ? {} : this.#answers();
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
         — a date or number carries its own body, and so does an Advanced one,
         which can only be asked "contains" and never ticked from a list of 240.
         TRAP T-a-condition-only-field-still-has-a-menu
         TRAP T-a-chip-knows-what-kind-it-is */
      const kind = kindOf(f);
      /* A SAVED filter's answer is given, so it has no field menu: it is a
         toggle, told what it is. TRAP T-a-saved-filter-is-its-readings */
      if (f.readings) {
        chip.dataset['kind'] = kind;
        this.#addSavedMenu(chip, f);
      } else if (kind !== 'boolean' || advancedOf(f)) this.#addMenu(chip, f, prior?.picked);
      list.appendChild(chip);
      if (kind === 'date') {
        chip.setAttribute('data-full-value', '');
        // The chip says its own days. TRAP T-a-chip-says-its-own-answer
        (chip as ChipEl).refresh();
      }
    }

    for (const [id, reading] of Object.entries(kept)) this.#keepAnswer(id, reading);

    /* THE ADD MENU LISTS WHAT IS HELD, so it follows the run. `populate()` is
       deferred, so a host calling `available()` first had nothing to tick.
       TRAP T-the-add-menu-is-the-whole-list */
    this.#renderAvailable();
    this.#syncPending();
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
    const { menu, items } = menuFor(def, {
      bounds: this.dataset['bounds'], remote: this.hasAttribute('data-remote'),
    });

    // TRAP T-persistent-chip-is-a-selector — no pick at all falls back to the
    // FIRST option, or the chip paints as an empty warning.
    const options = def.options ?? [];
    const hasPick = picked ? picked.size > 0 : options.some((o) => o.selected);
    const fallback = def.persistent && !hasPick ? options[0]?.value : undefined;

    /* THE MENU draws its own items, from the DATA handed to it: it picks the
       control from `data-select`.
       `menuFor` MADE it, so it has upgraded and takes them now; it stamps
       them when it renders. TRAP T-custom-element-upgrade */
    if (items.length) {
      (menu as HTMLElement & { items?: (i: unknown[]) => void }).items?.(
        items.map((item) => ({
          // A Filters row's own flags — a child menu, no box, a count — go too.
          ...item,
          value: item.value,
          label: item.label,
          selected: picked
            ? picked.has(item.value) || item.value === fallback
            : !!item.selected || item.value === fallback,
          available: item.available,
          ...(item.note ? { note: item.note } : {}),
          ...(item.section ? { section: item.section } : {}),
        })),
      );
    }

    this.#addRemove(chip, menu, def);

    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
    this.#markPresent(chip);
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


  /**
   * Carry one chip's op, typing and rows into its REBUILT menu. Until that menu
   * has drawn — a menu that has not drops rows — `readings` reports them from
   * here, so an event sent straight after a rebuild still has them.
   * TRAP T-a-rebuild-keeps-every-answer
   */
  #keepAnswer(id: string, reading: FieldReading): void {
    const menu = this.#filterMenu(id) as (HTMLElement & {
      reading: FieldReading; rendered?: Promise<void>;
    }) | null;
    if (!menu) return;
    const rows = readingRows(reading);
    /* The READER'S answer wins over the def's opening one — a def's typed
       condition must not come back on every rebuild. Picks go in as the menu
       is made, so only the rows, the mode and the mirror are compared.
       TRAP T-a-rebuild-keeps-every-answer */
    const gist = (r: FieldReading): string => {
      const own = readingRows(r);
      return JSON.stringify([own, r.mode ?? (own.length ? 'advanced' : 'simple'), !!r.mirror]);
    };
    if (gist(menu.reading) === gist(reading)) return;
    const held: FieldReading = { ...reading };
    this.#pendingAnswers.set(id, held);
    void Promise.resolve(menu.rendered).then(() => {
      // A later rebuild has taken over.
      if (this.#pendingAnswers.get(id) !== held || !menu.isConnected) return;
      /* HELD two frames MORE: a rebuilt row fills a frame late, and a report in
         that gap read Owner as unanswered — the source dropped it, and the
         mirror switched the chip off. Adding Email reset Owner.
         TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (this.#pendingAnswers.get(id) === held) this.#pendingAnswers.delete(id);
      }));
      // The menu refuses Advanced mode unless the field opted in.
      if (rows.length) menu.setAttribute('data-advanced', '');
      menu.reading = held;
      // The chip draws its face from the menu it holds now; on or off as it was.
      const chip = menu.closest<ChipEl>('sherpa-quick-filter');
      if (chip) chip.current = !reading.suspended;
      // TRAP T-a-silent-steer-still-redraws-its-chip
      chip?.refresh();
    });
  }

  /** Answers a rebuilt menu has not drawn yet, by chip id. TRAP T-a-rebuild-keeps-every-answer */
  #pendingAnswers = new Map<string, FieldReading>();

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

  /**
   * EVERY saved chip's menu: its conditions, read-only, a heading per field —
   * and, for a reader's own, Edit filter and Delete filter; Remove if it may go.
   * Will, TODO 49. TRAP T-a-saved-chip-lists-its-conditions
   */
  #addSavedMenu(chip: HTMLElement, def: QuickFilterDef): void {
    // It wears its change, not yet saved, as a pending chip does. TRAP T-a-saved-filter-keeps-its-edit
    chip.toggleAttribute('data-edited', !!def.edited);
    const menu = this.clone<HTMLElement & { items?(next: readonly FilterMenuItem[]): void }>(
      'template.qf-saved-menu-tpl');
    if (!menu) return;
    // Its lines say what it applies now; the reader's own opens a line's field.
    const lines = saidItems({ ...def, readings: def.edited ?? def.readings ?? {} }, [...this.#filters, ...this.#available])
      .map((line) => (def.editable ? { ...line, inert: false, drill: true, pickable: false } : line));
    if (!def.editable) for (const own of menu.querySelectorAll('.qf-saved-own')) own.remove();
    if (!def.edited) for (const row of menu.querySelectorAll('.qf-saved-edit')) row.remove();
    // Nothing to say and nothing to do: the chip stays a plain toggle.
    if (!lines.length && !def.editable && !(def.removable && !def.persistent)) return;
    menu.setAttribute('data-heading', def.label);
    menu.items?.(lines);
    this.#addRemove(chip, menu, def);
    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
  }

  /** A SAVED filter's chip: a toggle, whatever its menu lists. */
  #isSaved(chip: HTMLElement): boolean {
    return !!this.#filters.find((f) => f.id === chip.dataset['id'])?.readings;
  }

  /** A saved filter's menu, drawn again for a change its source holds now. */
  #redrawSaved(def: QuickFilterDef): void {
    const chip = this.#chips().find((c) => c.dataset['id'] === def.id);
    if (!chip) return;
    const old = chip.querySelector<HTMLElement & { hide?(): void }>('sherpa-menu');
    // Shut first: a popover taken away while open leaves the top layer confused.
    old?.hide?.();
    old?.remove();
    chip.removeAttribute('data-menu');
    this.#addSavedMenu(chip, def);
  }

  /** The saved chip an event came from — its own menu, or its rows drilled
   *  into the Filters menu from where it folded. */
  #savedChipOf(event: Event): ChipEl | null {
    const menu = this.pathFind(event, '.add-btn')
      ? this.#drill.home
      : this.pathFind(event, 'sherpa-quick-filter')?.querySelector('sherpa-menu');
    const chip = menu?.closest<ChipEl>('sherpa-quick-filter') ?? null;
    return chip && this.#isSaved(chip) ? chip : null;
  }

  /** The saved filter's field open to change it, in the field's OWN menu. */
  #editor: { menu: EditorMenu; id: string; field: string; of: QuickFilterDef } | null = null;

  /**
   * A saved filter's LINE opens its field in that field's own menu, holding
   * the answer the filter applies now. Apply is the change: an EDIT, and the
   * saved filter stays as it was. Will, TODO 50. TRAP T-a-saved-filter-keeps-its-edit
   */
  async #editSaved(chip: ChipEl, field: string): Promise<void> {
    const def = this.#filters.find((f) => f.id === chip.dataset['id']);
    const of = [...this.#filters, ...this.#available].find((f) => !f.readings && (f.field ?? f.id) === field);
    if (!def?.readings || !of) {
      // TRAP T-a-broken-assumption-reports
      report({
        code: 'unknown-filter',
        message: 'A saved filter names a field this bar cannot draw, so it cannot be changed here.',
        at: { id: def?.id ?? '', field },
      });
      return;
    }
    this.#closeOverflow();
    (chip.querySelector('sherpa-menu') as EditorMenu | null)?.hide();
    this.#dropEditor();
    // ONE DEF, ONE MENU — the field's own. TRAP T-one-field-one-filter-menu
    const answer = (def.edited ?? def.readings)[field] ?? {};
    const built = editorFor(of, answer, { bounds: this.dataset['bounds'] });
    const editor = { menu: built.menu as EditorMenu, id: def.id, field, of };
    this.#editor = editor;
    this.$('.qf-editor')?.append(editor.menu);
    await editor.menu.rendered;
    if (this.#editor !== editor) return;
    if (built.items.length) editor.menu.items(built.items);
    editor.menu.reading = answer;
    editor.menu.show(chip);
  }

  /** The editor's events are its own; none reaches this bar as a chip's. */
  #onEditorEvent = (event: Event): void => {
    event.stopPropagation();
    if (event.type === 'menu-change') this.#applyEdit();
    else if (event.type === 'menu-close') this.#dropEditor();
  };

  /** Apply or Clear in the editor: the saved filter's EDIT, sent to its source. */
  #applyEdit(): void {
    const at = this.#editor;
    const def = at && this.#filters.find((f) => f.id === at.id);
    if (!at || !def?.readings) return;
    const next = withAnswer(def.edited ?? def.readings, at.field, at.of, at.menu.reading);
    /* ON FIRST: the source draws this bar the scope as the edit leaves it,
       and a scope drawn with the filter off switched it off. */
    const chip = this.#chips().find((c) => c.dataset['id'] === at.id);
    if (chip && !chip.current) {
      chip.current = true;
      this.#emitChange();
    }
    this.emit('preset-edit', { id: at.id, readings: next });
  }

  /** Take the editor away. */
  #dropEditor(): void {
    const menu = this.#editor?.menu;
    this.#editor = null;
    menu?.hide();
    menu?.remove();
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
    if ((value === 'save-as' || value === 'delete') && this.pathFind(event, '.view-more')) {
      event.stopImmediatePropagation();
      this.#act(value === 'delete' ? 'delete-view' : value);
      return;
    }
    if (value === 'reset-default' && this.pathFind(event, '.reset-more')) {
      event.stopImmediatePropagation();
      this.#act(value);
      return;
    }
    if (value === 'save') {
      event.stopImmediatePropagation();
      const fromAdd = !!this.pathFind(event, '.add-btn');
      this.#requestSave(this.pathFind(event, 'sherpa-quick-filter'), fromAdd);
      return;
    }
    // A saved filter's change: saved, or put back. TRAP T-a-saved-filter-keeps-its-edit
    if (value === 'save-edit' || value === 'discard-edit') {
      const chip = this.#savedChipOf(event);
      const def = chip && this.#filters.find((f) => f.id === chip.dataset['id']);
      if (!def?.edited) return;
      event.stopImmediatePropagation();
      if (value === 'save-edit') this.emit('filter-save', { readings: def.edited, id: def.id, label: def.label });
      else this.emit('preset-edit', { id: def.id, readings: null });
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

  override onChange(name?: string): void {
    // Local or remote decides which menus wait for Apply, so they are rebuilt.
    if (name === 'data-remote' && this.#filters.length) this.#render();
    if (name === 'data-pending') this.#syncPending();
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
    const chip = this.$<HTMLElement & { arrangeBy(field: string, direction?: string | null): void }>(
      `.organise-chip[data-id="${kind}"]`);
    // The chip knows how: a bar and a panel follow the same attributes the same way.
    chip?.arrangeBy(this.dataset[kind === 'sort' ? 'sortField' : 'groupField'] ?? '', this.dataset['sortDirection']);
  }

  /** Report the whole filter state — the active toggle chips and every menu chip's picks. */
  #emitChange(): void {
    this.emit('quick-filter-change', {
      // TRAP T-values-carries-two-shapes — `scope` says WHICH shape this is.
      scope: 'bar',
      active: this.active,
      // APPLIED: only ON chips. A source reads `readings` and `presets` off the
      // bar; `values` is for a host that wants the ticks — the View chip's.
      values: this.values,
    });
    this.#syncSaveable();
  }

  /**
   * "Save filter" where there is something to save, and only if the host saves:
   * a chip holding an Advanced filter, and the Add menu once any field is on.
   * TRAP T-save-packs-the-fields-into-one-chip
   */
  #syncSaveable(): void {
    const saves = this.hasAttribute('data-saveable');
    let any = false;
    for (const [field, state] of Object.entries(this.#states)) {
      const on = state.fieldState === 'active';
      any ||= on;
      this.#filterMenu(field)?.toggleAttribute('data-saveable',
        saves && on && state.condition === 'advanced');
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
    const states = this.#states;
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
        this.#emptyField(field);
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
    for (const field of Object.keys(readings)) this.#emptyField(field);
    /* A CHANGE, once saved, is spent — its own filter's, or one saved under a
       new name, whose filter goes back to what it saved, and off.
       TRAP T-a-saved-filter-keeps-its-edit */
    const spent = this.#filters.filter((f) => f.edited
      && (f.id === id || JSON.stringify(f.edited) === JSON.stringify(readings))).map((f) => f.id);
    const def: QuickFilterDef = { id, label, readings, active: true, removable: true, editable: true };
    this.#unpacked = null;
    const i = this.#filters.findIndex((f) => f.id === id);
    if (i >= 0) this.#filters[i] = def;
    else this.#filters = [...this.#filters, def];
    this.#available = this.#available.filter((f) => f.id !== id);
    this.#render();
    // ON, even where it was already on the bar and switched off.
    for (const c of this.#chips()) {
      if (c.dataset['id'] === id) c.current = true;
      else if (spent.includes(c.dataset['id'] ?? '')) c.current = false;
    }
    this.#emitChange();
    for (const was of spent) this.emit('preset-edit', { id: was, readings: null });
  }

  /**
   * EMPTY one chip, whatever answers it, and switch it off: a list's ticks and
   * rows, a number's two shapes, a date's days. Reset and a redraw both come
   * here — a number chip used to be switched off and left holding its value.
   * TRAP T-empty-is-every-kind-of-answer
   */
  #emptyChip(chip: ChipEl): void {
    const id = chip.dataset['id'] ?? '';
    this.#pendingAnswers.delete(id);
    // The CHIP empties itself; the def says which condition a list opens on.
    chip.clear(this.#filters.find((f) => f.id === id)?.op ?? DEFAULT_OP);
  }

  /** Empty the chip that has this id, where the bar holds one. */
  #emptyField(id: string): void {
    const chip = this.#chips().find((c) => c.dataset['id'] === id);
    if (chip) this.#emptyChip(chip);
  }

  /**
   * What a reader DID to each field — the parameters, not an answer.
   *
   * This is what a host sends to the data layer (`source.apply(bar.readings)`),
   * which turns it into a query. A bar that builds a clause has to know a
   * field's TYPE, and that is how one filtering rule became three.
   *
   * By FIELD — a chip named for its question (the header's Date chip) answers
   * the field its def names. A PERSISTENT chip is a selector, never a filter.
   * TRAP T-the-field-type-decides-the-clause · TRAP T-persistent-chip-is-a-selector
   * TRAP T-the-header-chips-must-reach-the-query
   */
  get readings(): Record<string, FieldReading & { label: string; values: string[] }> {
    const out: Record<string, FieldReading & { label: string; values: string[] }> = {};
    for (const [id, reading] of Object.entries(this.#answers())) {
      const def = this.#filters.find((f) => f.id === id);
      if (!def?.persistent && def?.field !== null) out[def?.field ?? id] = reading;
    }
    return out;
  }

  /** Each chip's answer, by CHIP id — what this bar keeps across a rebuild. */
  #answers(): Record<string, FieldReading & { label: string; values: string[] }> {
    const out: Record<string, FieldReading & { label: string; values: string[] }> = {};
    for (const chip of this.#chips()) {
      const field = chip.dataset['id'];
      // A SUPERSEDED chip is the view's now; it narrows nothing here.
      if (!field || chip.hasAttribute('data-superseded')) continue;

      /* The CHIP says its own answer, and whether it is OFF: off keeps the
         answer and applies none of it. Null: a toggle or a selector.
         TRAP T-a-chip-says-its-own-answer · TRAP T-grid-suspend-is-not-clear */
      const reading = chip.reading;
      if (!reading) continue;
      const listed = !chip.menu?.dataset['body'];
      /* A LIST: a menu a rebuild has not drawn yet answers from what the
         rebuild kept, and a drilled chip's rows are in the Filters menu.
         TRAP T-a-rebuild-keeps-every-answer */
      const all = listed
        ? [...chip.menu!.querySelectorAll<HTMLInputElement>('input')]
          .filter((i) => !i.closest(NON_VALUE_ROWS)).map((i) => i.value)
        : [];
      out[field] = {
        label: chip.dataset['label'] ?? field,
        values: all,
        ...((listed ? this.#pendingAnswers.get(field) : undefined) ?? reading),
        ...(listed ? { picked: this.#chipPicks(chip) } : {}),
        suspended: !!reading.suspended,
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
  get #states(): Record<string, FilterState> {
    const out: Record<string, FilterState> = {};
    for (const [field, { label, values, ...reading }] of Object.entries(this.#answers())) {
      out[field] = fieldState({ field, label, values }, reading);
    }
    return out;
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
   * Every saved filter this bar holds, ON OR OFF, with its readings — what a
   * scoped source keeps as presets. TRAP T-a-saved-filter-is-its-readings
   */
  get presets(): Record<string, { on: boolean; readings: Record<string, FieldReading> }> {
    const on = new Set(this.#chips().filter((c) => c.current).map((c) => c.dataset['id']));
    const out: Record<string, { on: boolean; readings: Record<string, FieldReading> }> = {};
    for (const f of this.#filters) if (f.readings) out[f.id] = { on: on.has(f.id), readings: f.readings };
    return out;
  }

  /** available([...]) — the filters the Add chip offers, over the populate() set. */
  available(defs: QuickFilterDef[]): void {
    this.#available = Array.isArray(defs) ? defs : [];
    this.#renderAvailable();
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
  get #heldIds(): string[] {
    return this.#filters.map((f) => f.id);
  }

  /** The FIELDS its chips hold — not a selector, a saved filter, or a chip that
   *  answers no field here. What its scope holds. TRAP T-a-bar-reports-its-holds */
  get heldFields(): string[] {
    return this.#filters.filter((f) => !f.persistent && !f.readings && f.field !== null)
      .map((f) => f.field ?? f.id);
  }

  /**
   * drawScope(slice) — draw what a scope holds, SILENTLY: its chips, each
   * field's answer and each saved filter on or off. A reload, a trip away and
   * back. Nothing is reported — the source already holds all of it. A
   * PERSISTENT chip (the View) is the host's to set, so it is left alone.
   * TRAP T-one-query-one-owner · TRAP T-a-reload-replays-the-readers-answers
   */
  async drawScope(slice: ScopeQuery): Promise<void> {
    const presets = slice.presets ?? {};
    // The slice speaks FIELDS; a chip may be named for its question.
    const want = new Set([...slice.holds.map((f) => this.#idOf(f)), ...Object.keys(presets)]);
    // A chip that answers no field here is no scope's to hold, so none takes it off.
    for (const def of [...this.#filters]) {
      if (!want.has(def.id) && def.removable && def.field !== null) this.#removeFilter(def.id, { silent: true });
    }
    const add = [...want].filter((id) => !this.#heldIds.includes(id)
      && this.#available.some((f) => f.id === id));
    if (add.length) this.#addFilters(add, { silent: true });
    // A rebuilt bar reads empty until its menus stamp. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp
    await this.#settled();
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const persistent = new Set(this.#chips()
      .filter((c) => c.hasAttribute('data-persistent')).map((c) => c.dataset['id']));
    const answered = new Set<string>();
    for (const [field, reading] of Object.entries(slice.readings)) {
      const id = this.#idOf(field);
      answered.add(id);
      if (persistent.has(id)) continue;
      this.#drawChip(id, reading);
    }
    /* THE WHOLE SCOPE: a chip it does not answer is EMPTY — a View is a clean
       slate. A superseded chip keeps the reader's own picks. TRAP T-a-view-is-json */
    for (const def of this.#filters) {
      const chip = this.#chips().find((c) => c.dataset['id'] === def.id);
      if (!chip || answered.has(def.id) || persistent.has(def.id) || def.readings) continue;
      if (chip.hasAttribute('data-superseded')) continue;
      this.#emptyChip(chip);
    }
    for (const def of this.#filters) if (def.readings) this.#setChipActive(def.id, !!presets[def.id]);
    // Each saved filter's CHANGE, drawn again only where it moved. TRAP T-a-saved-filter-keeps-its-edit
    for (const [i, def] of this.#filters.entries()) {
      const edited = slice.edits?.[def.id];
      if (!def.readings || JSON.stringify(edited) === JSON.stringify(def.edited)) continue;
      // Its words were for the answer it had; the bar words the new one.
      const { edited: _was, says: _said, ...rest } = def;
      const next: QuickFilterDef = { ...rest, ...(edited ? { edited: structuredClone(edited) } : {}) };
      this.#filters[i] = next;
      this.#redrawSaved(next);
    }
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
    /* IN BAR ORDER: every chip a reader can take off, and every chip folded
       away — a folded one's row opens its child menu. ONE section, not a
       second one for the folded. Will, 2026-09-25. TRAP T-one-filters-button */
    const heldIds = new Set(held.map((f) => f.id));
    const hidden = new Set(folded);
    const run = this.#chips();
    const inRun = new Set(run.map((c) => c.dataset['id'] ?? ''));
    const added: AddedFilter[] = [
      ...run.filter((c) => heldIds.has(c.dataset['id'] ?? '') || hidden.has(c)).map((c) => {
        const id = c.dataset['id'] ?? '';
        return {
          id, label: this.#filters.find((f) => f.id === id)?.label ?? c.dataset['label'] ?? id,
          removable: heldIds.has(id), hidden: hidden.has(c),
          ...(hidden.has(c) ? { count: this.#chipPicks(c).length } : {}),
        };
      }),
      ...held.filter((f) => !inRun.has(f.id))
        .map((f) => ({ id: f.id, label: f.label, removable: true, hidden: false })),
    ];
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
      // Adding EVERY filter at once is never the answer. Will, 2026-09-25.
      selectAll: false,
      // TRAP T-add-menu-batches — the one menu that KEEPS Apply: each tick stamps
      // a chip, so per-tick apply rebuilds the run mid-selection.
      commit: true,
      options: filtersMenuItems(added, offer),
    });
    add.querySelector<HTMLElement>('sherpa-menu')?.toggleAttribute('data-search', true);
    this.#syncOverflowActive();
    this.#syncSaveable();
  }

  /** Move the chosen available filters onto the bar. SILENT for a restore. */
  #addFilters(ids: string[], { silent = false } = {}): void {
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
    if (silent) return;
    // ONE event for the batch — a host re-queries once.
    this.emit('filter-add', { ids: added.map((f) => f.id), filters: added });
    // AFTER the rebuild. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp
    void this.#settled().then(() => this.#emitChange());
  }

  /** Take one filter back OFF the bar. It returns to the Add menu, clean. */
  #removeFilter(id: string, { silent = false } = {}): void {
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
    if (silent) return;
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
    if (btn.dataset['act'] === 'overflow') this.#openMore(btn);
    else this.#act(btn.dataset['act'] ?? '');
  };

  /** One action, whichever button or row asked for it. */
  #act(act: string): void {
    switch (act) {
      case 'ai':
        this.emit('ai-filter-request');
        break;
      case 'clear':
        // RESETS, not announces: a host cannot reach chips it did not stamp.
        this.clearAll();
        break;
      case 'reset-default':
        /* The View's OWN filters — only its provider knows them. CANCELABLE: a
           host that asks the reader first takes it over.
           TRAP T-reset-to-default-is-the-views-own */
        this.dispatchEvent(new CustomEvent('view-reset', { bubbles: true, composed: true, cancelable: true, detail: {} }));
        break;
      case 'refresh':
        this.emit('data-refresh');
        break;
      case 'save':
        this.emit('view-save');
        break;
      case 'save-as':
        this.emit('view-save-as');
        break;
      case 'delete-view':
        this.emit('view-delete');
        break;
      case 'favourite':
        this.#toggleFavourite();
        break;
      case 'add':
        // sherpa-button opens its own slotted menu; nothing to do here.
        break;
    }
  }

  /**
   * THE ⋮ MENU holds what has FOLDED away at this width, in Will's order: the
   * filter actions, the page's own buttons, then the view's. A row does what
   * its button does. TRAP T-the-more-menu-holds-what-folded
   */
  #openMore(trigger: HTMLElement): void {
    const menu = this.$<HTMLElement & { show?: (t?: HTMLElement) => void }>('.more-menu');
    const item = this.$<HTMLTemplateElement>('template.more-item-tpl');
    const divider = this.$<HTMLTemplateElement>('template.more-divider-tpl');
    if (!menu || !item || !divider) return;
    const folded = (el: Element | null): boolean => !!el && getComputedStyle(el).display === 'none';
    const act = (name: string): HTMLElement | null => this.$(`.act[data-act="${name}"]`);
    const row = (value: string, label: string): HTMLElement => {
      const one = item.content.firstElementChild!.cloneNode(true) as HTMLElement;
      one.setAttribute('value', value);
      one.querySelector('.more-label')!.textContent = label;
      return one;
    };

    const first: HTMLElement[] = [];
    if (folded(act('ai'))) first.push(row('ai', 'Suggest filters'));
    if (folded(act('clear'))) first.push(row('clear', 'Reset filters'), row('reset-default', 'Reset all to default'));
    // The PAGE's buttons in the `actions` slot — the panel switch is one.
    [...this.querySelectorAll<HTMLElement>(':scope > [slot="actions"]')].forEach((extra, i) => {
      if (folded(extra)) first.push(row(`extra:${i}`, extra.getAttribute('aria-label') ?? extra.textContent?.trim() ?? ''));
    });
    const view: HTMLElement[] = [];
    if (this.dataset['type'] === 'view' && folded(this.$('.view-group'))) {
      view.push(row('favourite', this.hasAttribute('data-favourite') ? 'Remove from Favorites' : 'Favorite'));
      view.push(row('save', 'Save view'), row('save-as', 'Save view as'));
      if (this.hasAttribute('data-custom-view')) view.push(row('delete-view', 'Delete view'));
    }
    if (folded(act('refresh'))) view.push(row('refresh', 'Refresh view'));

    const rows = first.length && view.length
      ? [...first, divider.content.firstElementChild!.cloneNode(true) as HTMLElement, ...view]
      : [...first, ...view];
    menu.replaceChildren(...rows);
    menu.show?.(trigger);
  }

  /** A ⋮ row was chosen: do what its folded button does. */
  #onMore = (event: Event): void => {
    const value = String((event as CustomEvent).detail?.value ?? '');
    this.$<HTMLElement & { hide?: () => void }>('.more-menu')?.hide?.();
    if (!value.startsWith('extra:')) return this.#act(value);
    const extra = [...this.querySelectorAll<HTMLElement>(':scope > [slot="actions"]')][Number(value.slice(6))];
    extra?.dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
  };

  /** The Add menu committed. `menu-change`: only a CHIP re-emits as quick-filter-change. */
  #onAddCommit = (event: Event): void => {
    const add = this.pathFind(event, '.add-btn');
    if (!add) return;
    event.stopImmediatePropagation();
    // A DRILLED chip's pick is that chip's — never an Add or a Remove.
    if (this.#drill.home) {
      // An on/off chip's "On" row turns it on or off, at once.
      if (this.#built && this.#drill.home === this.#built.menu) {
        const values = ((event as CustomEvent).detail?.values ?? []) as string[];
        (this.#built.chip as ChipEl).current = values.includes(ON);
        this.#syncOverflowActive();
      }
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
    // The name and its tip say what a press DOES. Will, 2026-09-26.
    btn.setAttribute('aria-label', on ? 'Remove from Favorites' : 'Add to Favorites');
  }

  /**
   * TRAP T-clear-all-resets-organise-too — organise chips included; three events
   * afterwards. `{ organise: false }` keeps Group and Sort, which a VIEW sets
   * itself; `{ carry: true }` keeps a carry-over chip, as a View change does.
   * A field chip is EMPTIED — ticks, op, typing and rows — and redrawn,
   * so an off chip never still names what it held.
   */
  clearAll(options: { organise?: boolean; carry?: boolean } = {}): void {
    const organise = options.organise ?? true;
    for (const chip of this.#chips()) {
      // TRAP T-persistent-chip-is-a-selector — survives a reset, PICK included.
      if (chip.hasAttribute('data-persistent')) continue;
      const id = chip.dataset['id'] ?? '';
      // A View change leaves a carry-over chip; Reset does not. TRAP T-a-field-can-carry-over-views
      if (options.carry && this.#filters.find((f) => f.id === id)?.carryOver) continue;
      /* A chip the VIEW holds is not this bar's to reset: it keeps what it
         shows, and its own picks for when the View lets go.
         TRAP T-a-superseded-chip-suspends-it-is-never-removed */
      if (chip.hasAttribute('data-superseded')) continue;
      this.#emptyChip(chip);
    }
    if (organise) this.#clearOrganise();
    this.emit('filter-clear');
    this.#emitChange();
    if (!organise) return;
    this.emit('group-change', { field: null });
    this.emit('sort-change', { field: null, direction: 'asc' });
  }

  /** Group and Sort off, and the Sort's way forgotten. */
  #clearOrganise(): void {
    for (const chip of this.$$<HTMLElement>('.organise-chip')) {
      chip.removeAttribute('data-current');
      for (const input of chip.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
      /* FORGET the way, rather than write one: the chip answers `asc` for a
         chip with none. TRAP T-one-cycle-for-one-value */
      delete chip.dataset['direction'];
    }
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
            || (filterChip as ChipEl).answered,
        );
        (filterChip as ChipEl).refresh();
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
