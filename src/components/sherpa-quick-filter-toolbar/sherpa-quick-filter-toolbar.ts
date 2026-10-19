/**
 * sherpa-quick-filter-toolbar — the chip row: folds what does not fit, reports what the reader did.
 *
 * TRAP T-actions-were-a-slot
 *
 * Map:
 * - OrganiseDef — The columns the leading Group / Sort chips offer.
 */
import { DATA_PROPS, SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { NON_VALUE_ROWS, ORGANISE_ICONS, VIEW_CHIP } from '../../core/ui/shared-constants.js';
import { allow, type AllowList } from '../../core/data/allow.js';
import { advancedOf, kindOf } from '../../core/ui/filter-kind.js';
import { menuFor } from '../../core/ui/filter-menu.js';
import type { FilterDef, FilterOption } from '../../core/ui/filter-def.js';
import {
  drawSavedMenu, hangSavedMenu, type SavedMenuHost,
} from '../../core/ui/saved-filter-menu.js';
import {
  MenuDrill, OneRows, SavedSets, drawFiltersButton, reopenFilters, type AddedFilter, type SavedSet,
} from '../../core/ui/filters-button.js';
import {
  askSwitches, extraRows, folded, hidesUnmatched, openMore, pickMore, resetRows, saveRows, syncResets,
  type MoreRow,
} from '../../core/ui/more-menu.js';
import { arrangeFrom, organiseOptions, pendingFields } from '../../core/ui/filter-host.js';
import { report } from '../../core/data/report.js';
import { DEFAULT_OP, type SortDirection } from '../../core/data/store.js';
import { readingAnswered } from '../../core/data/query.js';
import {
  modeOf, readingRows, ruleOut, allSetAside,
  type FieldReading,
} from '../../core/data/filter-state.js';
import type { FilterSet, OrganiseColumn, ScopeDescription } from '../../core/data/data-source.js';
import type { DataAsk } from '../../core/ui/context.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-switch/sherpa-switch.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';
import type { SherpaQuickFilter } from '../sherpa-quick-filter/sherpa-quick-filter.js';
import type { SherpaSwitch } from '../sherpa-switch/sherpa-switch.js';

/** A filter chip, in the run or in a set. TRAP T-a-filter-set-groups-or-chains */
const CHIP = '.chips > .chip';

/** The columns the leading Group / Sort chips offer. */
export interface OrganiseDef {
  group?: OrganiseColumn[];
  sort?: OrganiseColumn[];
}

export type { OrganiseColumn } from '../../core/data/data-source.js';
export type { SortDirection } from '../../core/data/store.js';

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
    /* The host offers "Limit to matching filters", on or off. Will, TODO 178.
       TRAP T-the-more-menu-holds-what-folded */
    'data-limit-options': { type: 'enum', kind: 'style', values: ['on', 'off'] },
    // …and, while it is on, hides what it rules out. Will, TODO 205.
    'data-hide-unmatched': { type: 'enum', kind: 'behaviour', values: ['on', 'off'] },
    /* The host says a Reset to default would change nothing, so it is not
       offered. TODO 231 · TRAP T-reset-to-default-is-the-views-own */
    'data-at-default': { type: 'boolean', kind: 'style' },
    'data-nothing-to-reset': { type: 'boolean', kind: 'style' },
    'data-no-actions': { type: 'boolean', kind: 'style' },
    // Shows Figma's filter Switch, on a data bar. TRAP T-the-filter-switch-keeps-what-it-turned-off
    'data-switchable': { type: 'boolean', kind: 'visibility' },
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
    'data-sort-field': DATA_PROPS['data-sort-field'],
    'data-sort-direction': DATA_PROPS['data-sort-direction'],
    'data-group-field': DATA_PROPS['data-group-field'],
    // A host that owns the favourites paints the star. TRAP T-the-star-reports-it-does-not-decide
    'data-favourite': { type: 'boolean', kind: 'behaviour' },
    // The host saves filters: its ⋮ offers Save filters. TRAP T-saved-filters-are-every-scope
    'data-saveable': { type: 'boolean', kind: 'style' },
    // Written BY the bar: a saved set is on. TRAP T-saved-filters-are-every-scope
    'data-saved': { type: 'boolean', kind: 'style' },
    // Its source fetches from outside: menus wait for Apply. TRAP T-commit-follows-select-mode
    'data-remote': { type: 'boolean', kind: 'behaviour' },
    'data-apply-on': DATA_PROPS['data-apply-on'],
    // The FIELDS its source says are changed and not applied. TRAP T-a-pending-chip-has-no-fill
    'data-pending': { type: 'string', kind: 'behaviour' },
  } as const;

  /** The filter defs this bar holds, in order. */
  #filters: FilterDef[] = [];
  /** A source has drawn this bar's scope. */
  #scoped = false;
  /** A source owns this bar's chips — bound, or drawn by one — so the Switch's
   *  list is the source's, from the first act. */
  get #sourced(): boolean {
    return this.#scoped || this.hasAttribute('data-locked');
  }
  /** With no source: the chips its Switch turned off. TRAP T-the-filter-switch-keeps-what-it-turned-off */
  #switchedOff: string[] | null = null;
  /** The columns the Group and Sort chips offer. */
  #organise: OrganiseDef = {};
  /** Filters the user MAY add but has not — the Add chip's menu. */
  #available: FilterDef[] = [];

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

    // Cumulative: step 2 sets collapse-1 and collapse-2. TRAP T-private-state-is-a-custom-state
    for (let step = 1; step <= SherpaQuickFilterToolbar.COLLAPSE_STEPS; step++) this.toggleState(`collapse-${step}`, false);
    this.#collapse = 0;
    this.set('data-folded', null);
    this.#showAllChips();

    for (let step = 1; step <= SherpaQuickFilterToolbar.COLLAPSE_STEPS; step++) {
      if (!this.#overflowing()) break;
      this.toggleState(`collapse-${step}`, true);
      this.#collapse = step;
    }

    const folded: HTMLElement[] = [];
    if (this.#overflowing()) {
      const run = this.#chips();
      for (let i = run.length - 1; i >= 0; i--) {
        const chip = run[i]!;
        chip.toggleAttribute('data-folded-away', true);
        folded.unshift(chip);
        this.set('data-folded', String(folded.length));
        if (!this.#overflowing()) break;
      }
    }
    // Nothing moved: the open menus stay. TRAP T-a-reflow-that-moves-nothing-keeps-its-menus
    if (this.#collapse === was.collapse
      && folded.length === was.folded.length && folded.every((c, i) => c === was.folded[i])) return;
    this.#closeOverflow();
    // What has folded changed.
    this.$<SherpaMenu>('.more-menu')?.hide?.();
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
      ?.querySelector<SherpaMenu>('sherpa-menu');
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


  /** A folded chip's row asked for its child menu: drill into it. TRAP T-a-row-opens-its-child-menu */
  #onMenuDrill = (event: Event): void => {
    // While the Switch is off, a folded chip is as still as a shown one.
    if (this.filtersSuspended) return;
    const id = String((event as CustomEvent).detail?.value ?? '');
    const add = this.pathFind(event, '.add-btn');
    const into = add?.querySelector<SherpaMenu>('sherpa-menu');
    const chip = id ? this.#chips().find((c) => c.dataset['id'] === id) ?? null : null;
    if (!add || !into || !chip) return;
    event.stopPropagation();
    // Back stays one level deep, never a chain.
    if (this.#drill.home) this.#drillOut();
    const label = this.#filters.find((f) => f.id === id)?.label ?? chip.dataset['label'] ?? id;

    // An on/off chip has no menu: its row's tick answers it. TODO 54
    const from = chip.querySelector<SherpaMenu>('sherpa-menu');
    if (!from) return;

    /* NOTHING TO DRILL. An advanced-only menu answers with its condition
       ROWS, which live in its own shadow DOM — moving its empty light DOM put
       a blank card on screen, so the filter could never be answered, never
       went active, and never filtered. Show the menu ITSELF, anchored to the
       Filters button. A saved filter's card too: its rows are field MENUS.
       TRAP T-a-conditions-only-menu-cannot-be-drilled */
    if (!from.children.length || this.#isSaved(chip)) {
      this.#closeOverflow();
      from.show?.(add);
      return;
    }
    this.#drill.into(into, from, label);
  };

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
      ?.querySelector<SherpaMenu>('sherpa-menu');
    menu?.hide();
  }

  /** Put a drilled-in filter's rows back and restore the Filters list. */
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
    for (const chip of this.#chips()) {
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
    this.$('.more-menu')?.addEventListener('menu-change', this.#onMoreSwitch);
    this.$('.filters-switch')?.addEventListener('change', this.#onSwitch);
    // CAPTURE — see #onOrganiseChange.
    this.addEventListener('quick-filter-change', this.#onOrganiseChange, true);
    this.addEventListener('quick-filter-change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-change', this.#onFoldedCountsChanged);
    // A committing menu fires nothing while rows are ticked; their native
    // `change` reaches here, being in the CHIP's light DOM.
    this.addEventListener('change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-select', this.#onMenuSelect);
    this.$('.saved-chip')?.addEventListener('quick-filter-dismiss', () => this.emit('filters-dismiss', {}));
    this.#saved.draw();
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
    this.addEventListener('menu-row-remove', this.#onRowRemove);
    if (this.#filters.length) this.#render();
    if (this.#organise.group?.length || this.#organise.sort?.length) this.#renderOrganise();
    if (this.#available.length) this.#renderAvailable();
    // onChange never fires for an attribute set before the first render.
    this.#syncFavouriteFromAttr();
    syncResets(this, this.root, '.act[data-act="clear"]');

    // CLICK, not hover: a passing pointer would drill the list out from under it.
    this.addEventListener('menu-drill', this.#onMenuDrill as EventListener);
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
    this.#filters = Array.isArray(data) ? (data as FilterDef[]) : [];
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
    if (!this.#chips().length) return this.#heldValues();
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
    // The WHOLE set, so it replaces every steer held before it.
    if (!this.#chips().length) {
      this.#held = { values: { ...next }, chips: new Map(), ...(this.#held.supersede ? { supersede: this.#held.supersede } : {}) };
      return;
    }
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
    this.#keepOffChips();
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
    if (!this.#chips().length) {
      this.#held.chips.set(id, { picks: [...picks] });
      return;
    }
    for (const chip of this.#chips()) {
      if (chip.dataset['id'] !== id || !chip.hasAttribute('data-menu')) continue;
      /* `values = []` unticks every row and re-derives the face — the badge
         and the value label go with it. `current = false` alone would leave a
         chip reading "3 Plan Enterprise…" while claiming to be off. */
      chip.values = picks;
      if (!picks.length) chip.current = false;
      this.#keepOffChips();
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
    this.#syncOneRows();
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
    if (!this.#chips().length) {
      this.#held.chips.set(id, { reading: { ...reading } });
      return;
    }
    // The CHIP draws it: it knows what answers it. TRAP T-a-chip-says-its-own-answer
    const chip = this.#chips().find((c) => c.dataset['id'] === id && c.hasAttribute('data-menu'));
    if (chip) chip.reading = reading;
    this.#keepOffChips();
  }

  /**
   * PENDING: a chip whose change is not applied yet — a draft in its own open
   * menu, or a field its source says waits (`data-pending`). THIS BAR is the
   * one writer of the chip's flag. Locally a menu never waits, so nothing is
   * ever pending there. Will, 2026-09-26 (TODO 46). TRAP T-a-pending-chip-has-no-fill
   */
  #syncPending(): void {
    const waiting = pendingFields(this);
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'] ?? '';
      const field = this.#filters.find((f) => f.id === id)?.field ?? id;
      const menu = chip.querySelector<SherpaMenu>('sherpa-menu');
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
    this.#results = results;
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

  /** drawOffered(offered) — what each serial-set field OFFERS: its menu
   *  removes the rest, but keeps a pick. TRAP T-a-filter-set-groups-or-chains */
  drawOffered(offered: Readonly<Record<string, readonly string[]>>): void {
    this.#offered = offered;
    for (const chip of this.#chips()) this.#markPresent(chip);
  }
  /** What each chained field offers, as last drawn. */
  #offered: Readonly<Record<string, readonly string[]>> = {};
  /** What each field's other answers leave, as the source last said. */
  #present: Readonly<Record<string, readonly string[]>> = {};
  /** Each chip's results, as the source last said — a rebuilt chip is given them. */
  #results: Readonly<Record<string, number>> = {};

  /**
   * savedSets — the reader's saved sets of filters. The Filters menu's Saved
   * section lists them; the one ON is the Saved chip, in the warning look and
   * with ` *` while `edited`. Drawn, never reported. Will, TODO 105.
   * TRAP T-saved-filters-are-every-scope
   */
  set savedSets(sets: readonly SavedSet[]) {
    this.#saved.set(sets);
    this.#renderAvailable();
  }
  get savedSets(): SavedSet[] {
    return this.#saved.all;
  }
  /** The reader's saved sets, and the Saved chip. */
  #saved = new SavedSets(this, () => this.$<SherpaQuickFilter>('.saved-chip'));

  /** Steers given before `populate()` drew a chip, for `#render()` to replay in
   *  order. TRAP T-a-value-before-the-first-render-is-held */
  #held: {
    values?: Record<string, readonly string[]>;
    chips: Map<string, { picks: readonly string[] } | { reading: FieldReading }>;
    supersede?: { ids: readonly string[]; at?: string };
  } = { chips: new Map() };

  /** What `values` will report once the held steers land. */
  #heldValues(): Record<string, string[]> {
    const out = new Map(Object.entries(this.#held.values ?? {}).map(([id, picks]) => [id, picks.map(String)]));
    for (const [id, steer] of this.#held.chips) {
      const picks = 'picks' in steer ? steer.picks : steer.reading.suspended ? [] : steer.reading.picked ?? [];
      out.set(id, picks.map(String));
    }
    for (const id of this.#held.supersede?.ids ?? []) out.delete(id);
    return Object.fromEntries([...out].filter(([, picks]) => picks.length));
  }

  /** One chip's menu, told what its field's other answers leave — and the
   *  chip itself greyed when every pick it holds is set aside (180). */
  #markPresent(chip: HTMLElement): void {
    const id = chip.dataset['id'] ?? '';
    const field = this.#filters.find((f) => f.id === id)?.field ?? id;
    const menu = chip.querySelector<SherpaMenu>('sherpa-menu');
    if (!menu || this.superseded.includes(id)) return;
    const left = this.#present[field] ?? null;
    const offered = this.#offered[field] ?? null;
    menu.present = left;
    menu.offered = offered;
    // Hiding unmatched, a row Limit rules out goes. Will, TODO 205.
    menu.toggleAttribute('data-hide-unavailable', hidesUnmatched(this));
    chip.toggleAttribute('data-unavailable', allSetAside(menu.values ?? [], ruleOut(left, offered)));
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
    if (!this.#chips().length) {
      this.#held.supersede = { ids: [...ids], ...(appliedAt ? { at: appliedAt } : {}) };
      return;
    }
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
    if (!this.#chips().length) return [...this.#held.supersede?.ids ?? []];
    return this.#chips()
      .filter((c) => c.hasAttribute('data-superseded'))
      .map((c) => c.dataset['id'] ?? '')
      .filter(Boolean);
  }

  /** What one chip's menu holds — values ticked, or a date as one or two entries. */
  #chipPicks(chip: HTMLElement): string[] {
    // A saved filter's card holds field menus, not its picks.
    if (this.#isSaved(chip)) return [];
    // A chip drilled into the Filters menu reports from there — its own menu is
    // empty while the rows are away.
    if (this.#drill.home && this.#drill.home === chip.querySelector('sherpa-menu')) {
      const menu = this.$('.add-btn')?.querySelector<SherpaMenu>('sherpa-menu');
      if (menu) return menu.values;
    }
    /* A NUMBER or DATE menu reports its OWN value — it knows its body and its
       Range shape. TRAP T-a-menu-owns-its-own-bodies */
    const own = chip.querySelector<SherpaMenu>('sherpa-menu[data-body]');
    if (own) return own.values;

    /* THE MENU answers, through the chip's own getter: its rows, or its items
       before they stamp. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    const menu = (chip as SherpaQuickFilter).menu;
    return [...menu?.values ?? []];
  }

  /** The filter chips in the run — not Group, Sort or More — a set's among them. */
  #chips(): SherpaQuickFilter[] {
    return this.$$<SherpaQuickFilter>(CHIP);
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
    for (const f of this.#inSets(allow(this.#filters, this.#allowedFields))) {
      // Not upgraded until it is appended. TRAP T-custom-element-upgrade
      const chip = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const prior = live.get(f.id);
      chip.dataset['id'] = f.id;
      chip.setAttribute('data-label', f.label);
      if (f.type) chip.setAttribute('data-type', f.type);
      // Live state wins; an untouched chip falls back to `active`.
      if (prior ? prior.on : f.active) chip.setAttribute('data-current', '');
      // The toolbar's glyph to decide, not the app's.
      const glyph = f.id === VIEW_CHIP ? SherpaQuickFilterToolbar.#icons.view : f.icon;
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
        (chip as SherpaQuickFilter).refresh();
      }
    }

    for (const [id, reading] of Object.entries(kept)) this.#keepAnswer(id, reading);
    // Then what was steered before there were chips, and the results last drawn.
    const held = this.#held;
    this.#held = { chips: new Map() };
    if (held.values) this.values = held.values;
    for (const [id, steer] of held.chips) {
      if ('picks' in steer) this.setChipValues(id, steer.picks);
      else this.setChipReading(id, steer.reading);
    }
    if (held.supersede) this.supersede(held.supersede.ids, held.supersede.at);
    this.drawResults(this.#results);

    /* THE ADD MENU LISTS WHAT IS HELD, so it follows the run. `populate()` is
       deferred, so a host calling `available()` first had nothing to tick.
       TRAP T-the-add-menu-is-the-whole-list */
    this.#renderAvailable();
    this.#syncPending();

    // A ResizeObserver fires only on a SIZE change; populating is not one, and
    // what fits just changed.
    this.#keepOffChips();
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
      (chip) => chip.rendered,
    )).then(() => new Promise<void>((done) => {
      requestAnimationFrame(() => requestAnimationFrame(() => done()));
    })).then(() => { if (this.isConnected) this.#reflow(); });
  }

  /** Give a chip its value menu — real checkbox/radio rows in the chip's light DOM. */
  #addMenu(chip: HTMLElement, def: FilterDef, picked?: Set<string>): void {
    /* ONE DEF, ONE MENU. The panel and a column heading build theirs the same
       way, so a field cannot open with a different control in each.
       TRAP T-one-field-one-filter-menu */
    const { menu, items } = menuFor(def, {
      bounds: this.dataset['bounds'], remote: this.hasAttribute('data-remote'),
      live: this.dataset['applyOn'] === 'input',
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
      menu.items?.(items.map((item) => ({
        // A Filters row's own flags — a child menu, no box, a count — go too.
        ...item,
        selected: picked
          ? picked.has(item.value) || item.value === fallback
          : !!item.selected || item.value === fallback,
      })));
    }

    this.#addRemove(chip, menu, def);

    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
    this.#markPresent(chip);
  }

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
    const menu = this.#filterMenu(id);
    if (!menu) return;
    const rows = readingRows(reading);
    /* The READER'S answer wins over the def's opening one — a def's typed
       condition must not come back on every rebuild. Picks go in as the menu
       is made, so only the rows, the mode and the mirror are compared.
       TRAP T-a-rebuild-keeps-every-answer */
    const gist = (r: FieldReading): string => {
      const own = readingRows(r);
      return JSON.stringify([own, modeOf(r, own) ?? 'simple', !!r.mirror]);
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
      const chip = menu.closest<SherpaQuickFilter>('sherpa-quick-filter');
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
      (chip) => chip.rendered,
    ));
    await Promise.all(this.#chips().flatMap((chip) =>
      [...chip.querySelectorAll<SherpaMenu>('sherpa-menu')].map((menu) => menu.rendered)));
  }

  /**
   * EVERY saved chip's menu: each field's own menu, read-only, a heading per
   * field — and Remove if it may go. Will, TODO 181. TRAP T-a-saved-chip-lists-its-conditions
   */
  #addSavedMenu(chip: HTMLElement, def: FilterDef): void {
    const menu = this.clone<HTMLElement>('template.qf-saved-menu-tpl');
    if (!menu) return;
    // Nothing to say and nothing to do: the chip stays a plain toggle.
    if (!Object.keys(def.readings ?? {}).length && !(def.removable && !def.persistent)) return;
    this.#addRemove(chip, menu, def);
    hangSavedMenu(chip, menu, def.label, { readings: def.readings ?? {}, says: def.says }, this.#savedHost());
  }

  /** A saved filter's card, drawn in place: an open card stays open. */
  #drawSaved(def: FilterDef, menu = this.#chips().find((c) => c.dataset['id'] === def.id)
    ?.querySelector<HTMLElement>(':scope > sherpa-menu')): void {
    if (!def.readings || !menu) return;
    drawSavedMenu(menu, { readings: def.readings ?? {}, says: def.says }, this.#savedHost());
  }

  /** What a saved filter's card borrows from this bar. */
  #savedHost(): SavedMenuHost {
    return {
      unit: () => this.clone<HTMLElement>('template.qf-saved-field-tpl'),
      defOf: (field) => [...this.#filters, ...this.#available].find((d) => !d.readings && (d.field ?? d.id) === field),
      bounds: this.dataset['bounds'],
    };
  }

  /** A SAVED filter's chip: a toggle, whatever its menu lists. */
  #isSaved(chip: HTMLElement): boolean {
    return !!this.#filters.find((f) => f.id === chip.dataset['id'])?.readings;
  }

  /** Give a chip's menu its "Remove" action. TRAP T-remove-is-opt-in-and-a-footer-button */
  #addRemove(chip: HTMLElement, menu: HTMLElement, def: FilterDef): void {
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
    if (value !== 'remove') return;
    // TRAP T-remove-matches-the-tag-not-the-class — the PATH, and the TAG.
    const chip = this.pathFind(event, 'sherpa-quick-filter');
    const id = chip?.dataset['id'];
    if (!id) return;
    event.stopImmediatePropagation();
    // Shut it first: a popover destroyed while open leaves the top layer confused.
    chip.querySelector<SherpaMenu>('sherpa-menu')?.hide?.();
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
      (n): n is SherpaQuickFilter => n instanceof HTMLElement && n.classList.contains('chip'),
    );
    if (!chip) return;

    // A persistent chip has ALREADY flipped itself off by now, so put it back.
    if (chip.hasAttribute('data-persistent')) {
      chip.toggleAttribute('data-current', true);
      return;
    }
    this.#emitChange();
  };

  /** The Switch flipped: its own act, so the bar's `change` listeners never hear it. */
  #onSwitch = (event: Event): void => {
    event.stopPropagation();
    this.#setSwitch(!(event.target as SherpaSwitch).checked);
    this.#emitChange();
  };

  /** Does this bar show its filter Switch? A data bar only, as Figma draws it. */
  get #switchable(): boolean {
    return this.hasAttribute('data-switchable') && this.dataset['type'] !== 'view';
  }

  /**
   * Every filter in the bar OFF, each keeping its value, or back ON — silent,
   * as `values =` is; `report()` says it. With a source, the source turns them:
   * this bar draws it. TRAP T-the-filter-switch-keeps-what-it-turned-off
   */
  get filtersSuspended(): boolean {
    return !(this.$<SherpaSwitch>('.filters-switch')?.checked ?? true);
  }
  set filtersSuspended(off: boolean) {
    // A source's scope is turned by its Switch, so a bar with none cannot.
    if (this.#sourced && !this.#switchable) {
      report({
        code: 'filter-switch-hidden',
        message: 'filtersSuspended was set on a bar its source draws, and it shows no Switch. Add data-switchable, or call source.suspendScope().',
      });
      return;
    }
    this.#setSwitch(off);
  }

  /** Turn the chips — with no source — and draw it. */
  #setSwitch(off: boolean): void {
    if (!this.#sourced) this.#switchChips(off);
    this.#drawSwitch(off);
  }

  /** With no source: turn the filter chips that are on off, listing them, or the listed ones back on. */
  #switchChips(off: boolean): void {
    if (off && !this.#switchedOff) {
      const on = this.#chips().filter((c) => c.current && !c.hasAttribute('data-persistent') && !c.hasAttribute('data-superseded'));
      this.#switchedOff = on.map((c) => c.dataset['id'] ?? '');
      for (const chip of on) chip.current = false;
    } else if (!off && this.#switchedOff) {
      // Only a chip that still answers: an emptied one would come on as a warning.
      for (const chip of this.#chips()) {
        const answers = chip.reading == null || readingAnswered(chip.reading);
        if (answers && this.#switchedOff.includes(chip.dataset['id'] ?? '')) chip.current = true;
      }
      this.#switchedOff = null;
    }
  }

  /** With no source and the Switch off, a filter that came on goes off and is
   *  listed — the source's keepOff, for a bar that has none. */
  #keepOffChips(): void {
    if (this.#sourced || !this.#switchedOff) return;
    for (const chip of this.#chips()) {
      if (!chip.current || chip.hasAttribute('data-persistent') || chip.hasAttribute('data-superseded')) continue;
      chip.current = false;
      const id = chip.dataset['id'] ?? '';
      if (!this.#switchedOff.includes(id)) this.#switchedOff.push(id);
    }
  }

  /** Draw the Switch; while it is off, the chips are greyed and still. */
  #drawSwitch(off: boolean): void {
    const sw = this.$<SherpaSwitch>('.filters-switch');
    if (sw) sw.checked = !off;
    this.toggleState('filters-off', off);
    this.$('.chips')?.toggleAttribute('inert', off);
  }

  override onChange(name?: string): void {
    // A Switch it no longer shows — hidden, or the panel answering — gives the filters back.
    if ((name === 'data-panel-mode' || name === 'data-switchable' || name === 'data-type') && this.filtersSuspended
      && (!this.#switchable || this.hasAttribute('data-panel-mode'))) {
      this.#setSwitch(false);
      this.#emitChange({ suspended: false });
    }
    // Local or remote decides which menus wait for Apply, so they are rebuilt.
    if ((name === 'data-remote' || name === 'data-apply-on') && this.#filters.length) this.#render();
    if (name === 'data-pending') this.#syncPending();
    if (name === 'data-hide-unmatched' || name === 'data-limit-options') for (const chip of this.#chips()) this.#markPresent(chip);
    this.#syncArrangement();
    this.#syncFavouriteFromAttr();
    if (name === 'data-saveable') this.#saved.draw();
    syncResets(this, this.root, '.act[data-act="clear"]');
  }

  /** Report the whole filter state — the active toggle chips and every menu chip's picks. */
  #emitChange(given: { suspended?: boolean; reset?: boolean } = {}): void {
    this.#keepOffChips();
    // Its Switch only while it shows one, so a hidden Switch never turns a scope off.
    const suspended = given.suspended ?? (this.#switchable ? this.filtersSuspended : undefined);
    this.emit('quick-filter-change', {
      // TRAP T-values-carries-two-shapes — `scope` says WHICH shape this is.
      scope: 'bar',
      // Its WHOLE answer, in the event: a source reads this, never the bar.
      // TRAP T-a-filter-report-is-the-whole-answer
      readings: this.readings,
      presets: this.presets,
      holds: this.heldFields,
      active: this.active,
      // APPLIED: only ON chips — for a host that wants the ticks, the View chip's.
      values: this.values,
      suspended,
      // A Reset: the source forgets what the Switch turned off. TRAP T-the-filter-switch-keeps-what-it-turned-off
      reset: given.reset,
    });
    this.#syncOneRows();
  }

  /**
   * EMPTY one chip, whatever answers it, and switch it off: a list's ticks and
   * rows, a number's two shapes, a date's days. Reset and a redraw both come
   * here — a number chip used to be switched off and left holding its value.
   * TRAP T-empty-is-every-kind-of-answer
   */
  #emptyChip(chip: SherpaQuickFilter): void {
    const id = chip.dataset['id'] ?? '';
    this.#pendingAnswers.delete(id);
    // The CHIP empties itself; the def says which condition a list opens on.
    chip.clear(this.#filters.find((f) => f.id === id)?.op ?? DEFAULT_OP);
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
  #filterMenu(id: string): SherpaMenu | null {
    for (const chip of this.#chips()) {
      if (chip.dataset['id'] !== id) continue;
      const menu = chip.querySelector<SherpaMenu>('sherpa-menu');
      return menu?.getAttribute('data-type') === 'filter' ? menu : null;
    }
    return null;
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
  available(defs: FilterDef[]): void {
    this.#available = Array.isArray(defs) ? defs : [];
    this.#renderAvailable();
    // A saved filter's field this bar can now draw becomes its menu.
    for (const def of this.#filters) this.#drawSaved(def);
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

  /**
   * groupSets([...]) — the scope's filter SETS: each set's chips are drawn
   * together, in its order — plain chips, never grouped (Will, TODO 241).
   * TODO 99 · TRAP T-a-filter-set-groups-or-chains
   */
  groupSets(sets: readonly FilterSet[]): void {
    if (JSON.stringify(sets) === JSON.stringify(this.#sets)) return;
    this.#sets = [...sets];
    if (this.#chips().length) this.#render();
  }
  /** The scope's filter sets, as last given. */
  #sets: FilterSet[] = [];

  /** The chips in bar order — but each set's together, where its first stands, in the set's order. */
  #inSets(shown: readonly FilterDef[]): FilterDef[] {
    const setOf = new Map(this.#sets.flatMap((set) => set.fields.map((field) => [this.#idOf(field), set] as const)));
    const out: FilterDef[] = [];
    const placed = new Set<string>();
    for (const def of shown) {
      const set = setOf.get(def.id);
      const run = set ? set.fields.map((field) => shown.find((d) => d.id === this.#idOf(field))) : [def];
      for (const one of run) {
        if (!one || placed.has(one.id)) continue;
        placed.add(one.id);
        out.push(one);
      }
    }
    return out;
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
   * drawScope(scope) — draw what a scope holds, SILENTLY, from the description
   * the panel is drawn each of: its chips, each field's answer and each saved
   * filter on or off. Nothing is reported — the source already holds all of
   * it. A PERSISTENT chip (the View) is the host's to set, so it is left alone.
   * TRAP T-one-query-one-owner · TRAP T-a-reload-replays-the-readers-answers
   */
  async drawScope(scope: ScopeDescription): Promise<void> {
    this.#scoped = true;
    // A list this bar kept before a source drew it goes to the source, below.
    const handover = this.#switchedOff;
    this.#switchedOff = null;
    /* The Switch FIRST, before the waits, so a report meanwhile says it. An off
       it cannot show — hidden, or the panel answering — goes back on.
       TRAP T-the-filter-switch-keeps-what-it-turned-off */
    const resume = !!scope.suspended && (!this.#switchable || this.hasAttribute('data-panel-mode'));
    if (resume && !this.#switchable) {
      report({
        code: 'filter-switch-hidden',
        message: `Scope "${scope.scope}" is switched off, and its bar shows no Switch, so it is switched back on. Add data-switchable to offer it.`,
        at: { scope: scope.scope },
      });
    }
    this.#drawSwitch(!!scope.suspended && !resume);
    this.groupSets(scope.sets ?? []);
    // Its Group and Sort, where the scope arranges — drawn again only when they change.
    // TRAP T-group-and-sort-are-component-scope
    const organise = { group: scope.group ?? [], sort: scope.sort ?? [] };
    if (scope.group && JSON.stringify(organise) !== JSON.stringify(this.#organise)) this.organise(organise);
    const presets = scope.filters.filter((f) => f.readings);
    const fields = scope.filters.filter((f) => !f.readings);
    // The scope speaks FIELDS; a chip may be named for its question.
    const want = new Set([...fields.map((f) => this.#idOf(f.id)), ...presets.map((f) => f.id)]);
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
    for (const { id: field, state } of fields) {
      if (!state) continue;
      const id = this.#idOf(field);
      answered.add(id);
      if (!persistent.has(id)) this.#drawChip(id, state);
    }
    /* THE WHOLE SCOPE: a chip it does not answer is EMPTY — a View is a clean
       slate. A superseded chip keeps the reader's own picks. TRAP T-a-view-is-json */
    for (const def of this.#filters) {
      const chip = this.#chips().find((c) => c.dataset['id'] === def.id);
      if (!chip || answered.has(def.id) || persistent.has(def.id) || def.readings) continue;
      if (chip.hasAttribute('data-superseded')) continue;
      this.#emptyChip(chip);
    }
    const on = new Set(presets.filter((f) => f.active).map((f) => f.id));
    for (const def of this.#filters) if (def.readings) this.#setChipActive(def.id, on.has(def.id));
    if (resume) this.#emitChange({ suspended: false });
    else if (handover?.length && scope.suspended) {
      // On again in the report, so the source's keepOff lists them as its own.
      for (const chip of this.#chips()) if (handover.includes(chip.dataset['id'] ?? '')) chip.current = true;
      this.#emitChange();
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
          // ONE value: the tick is the chip's on/off. TODO 54
          ...(c.hasAttribute('data-menu') ? {} : { on: c.current }),
          ...(hidden.has(c) ? { count: this.#chipPicks(c).length } : {}),
        };
      }),
      ...held.filter((f) => !inRun.has(f.id))
        .map((f) => ({ id: f.id, label: f.label, removable: true, hidden: false })),
    ];
    this.#oneRows.tell(added);
    const def = drawFiltersButton(add, folded.length, added, offer, this.#saved.listed);
    if (!def) return;
    this.#addMenu(add, def);
    this.#syncOverflowActive();
  }

  /** Move the chosen available filters onto the bar. SILENT for a restore. */
  #addFilters(ids: string[], { silent = false } = {}): void {
    const added: FilterDef[] = [];
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
         TRAP T-saved-filters-are-the-last-section */
      added.push({ ...def!, active: !!def!.readings, removable: true });
    }
    if (!added.length) return;
    this.#filters = [...this.#filters, ...added];
    this.#render();
    this.#renderAvailable();
    if (silent) return;
    // ONE event for the batch — a host re-queries once. TRAP T-add-menu-batches
    this.emit('filter-add', { ids: added.map((f) => f.id), filters: added, holds: this.heldFields });
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
    if (this.#switchedOff) this.#switchedOff = this.#switchedOff.filter((x) => x !== id);
    const { active: _active, ...clean } = def!;
    this.#available = [...this.#available, clean as FilterDef];
    this.#render();
    this.#renderAvailable();
    if (silent) return;
    this.emit('filter-remove', { id, filter: clean, holds: this.heldFields });
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
        this.emit('view-reset', {}, { cancelable: true });
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
      case 'filters-save':
      case 'filters-save-as':
        this.emit(act);
        break;
      case 'filters-delete':
        this.emit('filters-delete', { id: this.#saved.on?.id });
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
    const act = (name: string): HTMLElement | null => this.$(`.act[data-act="${name}"]`);
    const first: MoreRow[] = [];
    if (folded(act('ai'))) first.push(['ai', 'Suggest filters']);
    if (folded(act('clear'))) first.push(...resetRows(this, 'clear'));
    first.push(...extraRows(this));
    const view: MoreRow[] = [];
    if (this.dataset['type'] === 'view' && folded(this.$('.view-group'))) {
      view.push(['favourite', this.hasAttribute('data-favourite') ? 'Remove from Favorites' : 'Favorite']);
      view.push(['save', 'Save view'], ['save-as', 'Save view as']);
      if (this.hasAttribute('data-custom-view')) view.push(['delete-view', 'Delete view']);
    }
    if (folded(act('refresh'))) view.push(['refresh', 'Refresh view']);
    // Save filters, for every scope at once. Will, TODO 105.
    const save = saveRows(this, !!this.#saved.on);
    openMore(this, this.root, trigger, [first, save, view]);
  }

  /** The ⋮ menu's switch: a REQUEST — the host owns whether filters limit each other. */
  #onMoreSwitch = (event: Event): void => askSwitches(this, event, (name, on) => this.emit(name, { on }));

  /** A ⋮ row was chosen: do what its folded button does. */
  #onMore = (event: Event): void => this.#act(pickMore(this, this.root, event));

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
       the bar is holding — an unticked row is a REMOVE. A ONE-value row's tick
       is its chip's on/off instead, and its × removes it.
       TRAP T-the-add-menu-is-the-whole-list */
    const want = new Set(((event as CustomEvent).detail?.values ?? []) as string[]);
    // A saved set's row applies it, or — unticked — dismisses it. TODO 105
    const set = this.#saved.pick(want);
    if (set.apply) this.emit('filters-apply', { id: set.apply });
    else if (set.dismiss) this.emit('filters-dismiss', {});
    // Only a row the reader CHANGED: a stale tick never undoes a chip. TODO 54
    let flipped = false;
    // While the Switch is off, a one-value row turns no chip on: its tick goes back.
    const still = this.filtersSuspended;
    for (const id of this.#oneRows.ids) {
      const on = want.has(id);
      const chip = this.#chips().find((c) => c.dataset['id'] === id);
      // `flip` LAST: it records.
      if (!chip || chip.hasAttribute('data-persistent') || still || !this.#oneRows.flip(id, on)) continue;
      chip.current = on;
      flipped = true;
    }
    if (still) this.#syncOneRows();
    const ones = this.#oneRows;
    const held = new Set(this.#filters.filter((f) => f.removable && !ones.has(f.id)).map((f) => f.id));
    const added = [...want].filter((id) => !held.has(id) && !ones.has(id));
    const gone = [...held].filter((id) => !want.has(id));
    for (const id of gone) this.#removeFilter(id);
    if (added.length) this.#addFilters(added);
    if (!flipped) return;
    this.#syncOverflowActive();
    // A remove or an add reports once it settles; a flip alone reports now.
    if (!gone.length && !added.length) this.#emitChange();
  };

  /** A ONE-value row's × was pressed: take that filter off. TODO 54 */
  #onRowRemove = (event: Event): void => {
    if (!this.pathFind(event, '.add-btn')) return;
    event.stopPropagation();
    const id = String((event as CustomEvent).detail?.value ?? '');
    if (!id) return;
    this.#removeFilter(id);
    void reopenFilters(this.$('.add-btn'));
  };

  /** What each ONE-value row was told. TODO 54 */
  #oneRows = new OneRows();

  /** A chip turned on or off elsewhere: its row is ticked as it is, while the menu is shut. */
  #syncOneRows(): void {
    const menu = this.$('.add-btn')?.querySelector<SherpaMenu>('sherpa-menu');
    this.#oneRows.follow(menu, (id) => !!this.#chips().find((c) => c.dataset['id'] === id)?.current);
  }

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
      this.set('data-favourite', on);
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
    // Two drawings, so the star fills. TRAP T-favourite-star-swaps-its-glyph
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
    // A clean slate: the Switch is on, and what it turned off is forgotten.
    this.#switchedOff = null;
    this.#drawSwitch(false);
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
    this.#emitChange({ reset: true });
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
    if (!zone) return;

    const group = this.#organise.group ?? [];
    const sort = this.#organise.sort ?? [];
    zone.replaceChildren();
    // CSS cannot see whether the zone has children, and an empty one would leave
    // its divider rule floating.
    this.toggleState('has-organise', group.length > 0 || sort.length > 0);

    /* BORN NAMING ITS COLUMN. The bar may already be grouped or sorted — a
       reload restores both — so the chip is built on that column rather than
       waiting for a second pass to tick it. */
    const on = { group: this.dataset['groupField'] ?? '', sort: this.dataset['sortField'] ?? '' };
    if (group.length) {
      zone.appendChild(this.#organiseChip('group',
        SherpaQuickFilterToolbar.#icons.group, organiseOptions(group, on.group), on.group));
    }
    if (sort.length) {
      // The MENU picks the column, the BODY cycles direction. Built OFF, with
      // the sort-none glyph, until the host's arrangement turns it on below.
      /* NO `data-direction` here. `chip.direction` answers `asc` for a chip that
         is ON with none set, so writing it is a third place that has to agree.
         TRAP T-one-cycle-for-one-value */
      zone.appendChild(this.#organiseChip('sort',
        SherpaQuickFilterToolbar.#icons.sortNone, organiseOptions(sort, on.sort), on.sort));
    }
    // Then ON, if the host is: a rebuild changes no attribute, so onChange will not.
    this.#syncArrangement();
  }

  /** Follow the host's arrangement onto the Group and Sort chips. The chip knows how. */
  #syncArrangement(): void {
    for (const kind of ['group', 'sort'] as const) {
      arrangeFrom(this, this.$<SherpaQuickFilter>(`.organise-chip[data-id="${kind}"]`), kind);
    }
  }

  /** One organise chip, from its own prototype: a menu chip with single-select rows. */
  #organiseChip(
    id: 'group' | 'sort',
    icon: string,
    options: FilterOption[],
    column = '',
  ): HTMLElement {
    const chip = this.clone(`template.organise-${id}-tpl`);
    if (!chip) throw new Error(`sherpa-quick-filter-toolbar: template.organise-${id}-tpl is missing or empty`);
    /* THE CHIP KNOWS WHAT IT IS, and owns its own gesture: group toggles,
       sort cycles. This bar only places it and hears what it reports.
       "Organise" is the zone it sits in, not a kind.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (column) chip.dataset['column'] = column;
    chip.setAttribute('data-icon-start', icon);
    this.#addMenu(chip, { id, label: chip.dataset['label'] ?? '', select: 'single', options });
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
        (n): n is SherpaQuickFilter => n instanceof HTMLElement && n.classList.contains('chip'),
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
            || filterChip.answered,
        );
        filterChip.refresh();
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

define('sherpa-quick-filter-toolbar', SherpaQuickFilterToolbar);
