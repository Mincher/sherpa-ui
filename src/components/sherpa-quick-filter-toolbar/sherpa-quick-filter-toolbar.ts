/**
 * sherpa-quick-filter-toolbar — a row of filter chips above a grid or list.
 *
 * TRAP T-actions-were-a-slot
 */
import { SHARED_PROPS, SherpaElement } from '../../core/sherpa-element.js';
import { NON_VALUE_ROWS, ORGANISE_ICONS } from '../../core/icons.js';
import { nextSort, sortDirectionFrom } from '../../core/cycle.js';
import {
  DEFAULT_OP, OPS_FOR_TYPE, OP_LABELS, OP_TAKES, type FilterOp,
} from '../../core/store.js';
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
}

export interface QuickFilterDef {
  id: string;
  label: string;
  type?: string;
  active?: boolean;
  icon?: string;
  /** Values this chip filters by — a menu of checkbox or radio rows. */
  options?: QuickFilterOption[];
  select?: 'single' | 'multiple';
  /** TRAP T-number-and-date-lead-with-a-range-switch */
  kind?: 'values' | 'number' | 'date';
  /** A number filter's slider ends and field clamp. Default 0..100. */
  min?: number;
  max?: number;
  step?: number;
  /** ISO days a DATE chip may pick. A SET, not a span; every other day draws inactive. */
  availableDates?: string[];
  /** A finished phrase the user TYPED ("Contains: ana"). Set via `addCustomFilter()`. */
  customValue?: string;
  /** Start in RANGE mode. The user may still flip it. */
  range?: boolean;
  /** A chip that cannot be switched OFF. TRAP T-persistent-chip-is-a-selector */
  persistent?: boolean;
  /** Offer "Remove" in this chip's menu. OPT-IN: a host-placed chip must not delete itself. */
  removable?: boolean;
  /** Defer picks behind Apply. TRAP T-commit-follows-select-mode — else the select mode decides. */
  commit?: boolean;
  /**
   * Offer a CONDITION dropdown above the rows: Equals, Contains, Starts with…
   *
   * The same conditions the column heading's filter menu offers, from the one
   * vocabulary in store.ts. `eq` is the default, and shows the value rows; a
   * typing condition shows a text box instead.
   * TRAP T-an-operator-decides-pick-or-type
   */
  conditions?: boolean;
  /** Which condition this chip is on. Defaults to `eq`. */
  op?: FilterOp;
  /** What the reader TYPED, for a condition that takes text rather than a pick. */
  text?: string;
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
    /* WHICH SCOPE this bar is. `view` narrows every component on the screen;
       `data` narrows the one component it belongs to. The bar reads it to
       refuse Group and Sort at view scope.
       TRAP T-group-and-sort-are-component-scope */
    'data-type': { type: 'enum', kind: 'style', values: ['view', 'data'] },
  } as const;

  /** Sort and group written from outside — unobserved, a grid header click says nothing here. */
  static override observed = ['data-sort-field', 'data-sort-direction', 'data-group-field'];

  #filters: QuickFilterDef[] = [];
  #organise: OrganiseDef = {};
  /** Filters the user MAY add but has not — the Add chip's menu. */
  #available: QuickFilterDef[] = [];

  /* ── Fitting the bar ─────────────────────────────────────────────── */

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

    if (!this.#overflowing()) return;

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

  /** Fill the overflow chip: its badge, and one menu row per folded filter. */
  #renderFolded(folded: readonly HTMLElement[]): void {
    const chip = this.$<HTMLElement>('.overflow-chip');
    if (!chip) return;

    // Folded FILTERS, not values.
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

      // A boolean chip has no menu to drill into, so it gets a tickable row.
      if (!source.querySelector('sherpa-menu')) {
        const toggle = this.clone('template.qf-toggle-tpl');
        if (!toggle) continue;
        toggle.dataset['for'] = id;
        const box = toggle.querySelector<HTMLInputElement>('input');
        const text = toggle.querySelector('.qf-toggle-label');
        if (text) text.textContent = label;
        if (box) box.checked = source.hasAttribute('data-current');
        // Bound to the BOX: a native `change` is not composed and stops at the menu.
        box?.addEventListener('change', this.#onFoldedToggle);
        menu.appendChild(toggle);
        continue;
      }

      const row = this.clone('template.qf-folded-tpl');
      if (!row) continue;
      row.dataset['for'] = id;
      row.dataset['label'] = label;
      const glyph = source.dataset['iconStart'];
      if (glyph) row.dataset['icon'] = glyph;

      menu.appendChild(row);
    }

    this.#syncFoldedBadges();
  }

  /** Re-read every folded row's count. Separate from stamping, which rebuilds the open list. */
  #syncFoldedBadges(): void {
    const chip = this.$<HTMLElement>('.overflow-chip');
    const menu = chip?.querySelector('sherpa-menu');
    if (!menu) return;
    for (const row of menu.querySelectorAll<HTMLElement>('.qf-folded')) {
      const id = row.dataset['for'];
      const source = id ? this.$<HTMLElement>(`.chips > .chip[data-id="${CSS.escape(id)}"]`) : null;
      const badge = row.querySelector<HTMLElement>('.qf-folded-count');
      if (!source || !badge) continue;
      const count = this.#chipPicks(source).length;
      badge.textContent = String(count);
      // A data-* ON THE ROW: nothing can write `:host(...)` for an element inside a menu.
      badge.closest('.qf-folded')?.toggleAttribute('data-count', count > 0);
    }
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

  /** Where a drilled-in menu's rows came from. TRAP T-drill-moves-not-clones — moved, not copied. */
  #drill: { home: HTMLElement; rows: Element[] } | null = null;

  /** Menu attributes owned by the FILTER. TRAP T-drill-flags-travel-and-replace — never merged. */
  static readonly DRILL_FLAGS = [
    'data-commit',
    'data-range',
    'data-select',
    'data-search',
  ] as const;

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
    const chip = this.$<HTMLElement>('.overflow-chip');
    const into = chip?.querySelector<HTMLElement>('sherpa-menu');
    if (!from || !into || !chip) return;

    // Back stays one level deep, never a chain.
    if (this.#drill) this.#drillOut();

    this.#drill = { home: from, rows: [...into.children] };
    into.replaceChildren(...from.childNodes);

    into.setAttribute('data-drill', '');
    into.dataset['drillFrom'] = chip.dataset['label'] ?? 'More';
    into.setAttribute('data-heading', row.dataset['label'] ?? '');
    for (const flag of SherpaQuickFilterToolbar.DRILL_FLAGS) {
      const value = from.getAttribute(flag);
      if (value == null) into.removeAttribute(flag);
      else into.setAttribute(flag, value);
    }
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

  #onFoldedCountsChanged = (): void => {
    this.#syncFoldedBadges();
  };

  #drillOutHandler = (): void => {
    this.#drillOut();
  };

  /** Shut the overflow menu. ORDER MATTERS: drilled rows go back first. */
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

    drill.home.replaceChildren(...menu.childNodes);
    menu.replaceChildren(...drill.rows);
    this.#drill = null;

    menu.removeAttribute('data-drill');
    delete menu.dataset['drillFrom'];
    // Deferred: the rows are stamped back below and would be read too early.
    queueMicrotask(() => this.#syncFoldedBadges());
    menu.setAttribute('data-heading', 'More filters');
    for (const flag of SherpaQuickFilterToolbar.DRILL_FLAGS) {
      const value = menu.getAttribute(flag);
      if (value == null) drill.home.removeAttribute(flag);
      else drill.home.setAttribute(flag, value);
      menu.removeAttribute(flag);
    }
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
    // sherpa-switch re-dispatches its native change COMPOSED; a bare checkbox does not.
    this.addEventListener('change', this.#onRangeToggle);
    /* On the SHADOW ROOT, not the host. A native `change` from a bare <select>
       or <input> BUBBLES but is not COMPOSED, so it stops at this component's
       shadow boundary and never reaches `this`. The switch handlers above work
       only because sherpa-switch re-dispatches its change composed.
       TRAP T-native-change-stops-at-the-host */
    this.shadowRoot?.addEventListener('change', this.#onConditionPicked);
    this.shadowRoot?.addEventListener('input', this.#onConditionText);
    // The Add menu hangs off a sherpa-BUTTON, which never relays quick-filter-change.
    this.addEventListener('menu-change', this.#onAddCommit as EventListener);
    if (this.#filters.length) this.#render();
    if (this.#organise.group?.length || this.#organise.sort?.length) this.#renderOrganise();
    if (this.#available.length) this.#renderAvailable();

    // CLICK, not hover: a passing pointer would drill the list out from under it.
    this.addEventListener('click', this.#onFoldedClick, true);
    // The back arrow is two shadow boundaries away; the menu re-emits it composed.
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
  supersede(ids: readonly string[]): void {
    const taken = new Set(ids);
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'];
      if (!id) continue;
      chip.toggleAttribute('data-superseded', taken.has(id));
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
    // A chip drilled into the overflow menu reports from there — its own menu is
    // empty while the rows are away.
    if (this.#drill && this.#drill.home === chip.querySelector('sherpa-menu')) {
      const live = this.$<HTMLElement & { values: string[] }>('.overflow-chip');
      const menu = live?.querySelector<HTMLElement & { values: string[] }>('sherpa-menu');
      if (menu) return menu.values;
    }
    // A NUMBER chip's menu reports its own value — it knows its Range shape.
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
    // NON_VALUE_ROWS names the rows that are not picks.
    return Array.from(chip.querySelectorAll<HTMLInputElement>('input:checked'))
      .filter((i) => !i.closest(NON_VALUE_ROWS))
      .map((i) => i.value);
  }

  /** TRAP T-date-label-reads-in-full — UTC, day-then-month, in full, no badge. */
  #syncDateLabel(chip: HTMLElement): void {
    const cal = chip.querySelector<HTMLElement>('sherpa-calendar');
    if (!cal) return;
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

  #chips(): ChipEl[] {
    return this.$$<ChipEl>('.chips > .chip');
  }

  #render(): void {
    const list = this.$('.chips');
    const tpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!list || !tpl) return;

    // TRAP T-render-captures-live-state — the live DOM is the only record of what
    // the user did since. `data-reset-on-populate` opts out.
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
    // TRAP T-custom-element-upgrade — `valueLabel` is a PROPERTY; writes are held
    // and replayed once the run is appended.
    const customLabels: Array<[HTMLElement, string]> = [];
    for (const f of this.#filters) {
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
      // A selector: always on, and its body does not flip it.
      if (f.persistent) {
        chip.setAttribute('data-persistent', '');
        chip.setAttribute('data-current', '');
      }
      // A date or number chip carries no `options`, so kind stamps the menu too.
      const hasOwnContent = f.kind === 'date' || f.kind === 'number';
      if (f.options?.length || hasOwnContent) this.#addMenu(chip, f, prior?.picked);
      if (f.customValue) {
        // `data-custom` makes it findable: it is in neither `active` nor `values`.
        chip.setAttribute('data-custom', '');
        chip.setAttribute('data-menu', '');
        // In FULL: "Contains: a…" names a condition with no subject.
        chip.setAttribute('data-full-value', '');
        customLabels.push([chip, f.customValue]);
      }
      list.appendChild(chip);
      if (f.kind === 'date') {
        chip.setAttribute('data-full-value', '');
        this.#syncDateLabel(chip);
      }
    }

    // These write into the chip's shadow root, so they wait on `el.rendered`.
    for (const [chip, text] of customLabels) {
      const el = chip as HTMLElement & { valueLabel?: string; rendered?: Promise<void> };
      void Promise.resolve(el.rendered).then(() => { el.valueLabel = text; });
    }

    // A ResizeObserver fires only on a SIZE change; populating is not one, and
    // what fits just changed.
    this.#onResize();
  }

  /** Give a chip its value menu — real checkbox/radio rows in the chip's light DOM. */
  #addMenu(chip: HTMLElement, def: QuickFilterDef, picked?: Set<string>): void {
    const rowTpl = this.$<HTMLTemplateElement>('template.qf-row-tpl');
    const menu = this.clone('template.qf-menu-tpl');
    if (!rowTpl || !menu) return;

    const single = def.select === 'single';
    menu.setAttribute('data-heading', def.label);
    // One prototype serves both: a sherpa-button names the same slot as a chip.
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-select', single ? 'single' : 'multiple');
    // TRAP T-commit-follows-select-mode. A NUMBER defaults to a range — the same
    // default `#addRangeSwitch` applies.
    const asRange = def.range ?? def.kind === 'number';
    const picksOne = (def.kind === 'date' || def.kind === 'number') && !asRange;
    const defers = def.commit ?? (!single && !picksOne);
    if (defers) menu.setAttribute('data-commit', '');
    // TRAP T-every-chip-menu-gets-clear-and-search — a persistent chip gets no Clear.
    if (!def.persistent) menu.setAttribute('data-clearable', '');
    menu.setAttribute('data-search', '');
    // Without `data-bounds` the card falls back to the viewport.
    const bounds = this.dataset['bounds'];
    if (bounds) menu.setAttribute('data-bounds', bounds);

    // Field and two-ended slider both exist from the start, CSS reveals one, so
    // flipping back keeps what was typed on the other side.
    if (def.kind === 'number') {
      // No list to search, only a value to type or drag.
      menu.removeAttribute('data-search');
      this.#addRangeSwitch(menu, def);
      const box = this.clone('template.qf-number-tpl');
      if (box) {
        const slider = box.querySelector('sherpa-slider');
        const field = box.querySelector('input');
        // Slider ends and field clamp: typing 500 into a 0..100 filter cannot
        // ask for a row that cannot exist.
        const min = def.min ?? 0;
        const max = def.max ?? 100;
        for (const el of [slider, field]) {
          if (!el) continue;
          el.setAttribute('min', String(min));
          el.setAttribute('max', String(max));
          if (def.step != null) el.setAttribute('step', String(def.step));
        }
        // A fresh range excludes nothing.
        slider?.setAttribute('value-start', String(min));
        slider?.setAttribute('value-end', String(max));
        menu.appendChild(box);
      }
      this.#addRemove(chip, menu, def);
      chip.setAttribute('data-menu', '');
      chip.appendChild(menu);
      return;
    }

    // A DATE chip's menu holds a CALENDAR instead of value rows.
    if (def.kind === 'date') {
      // FIRST: the switch decides what the calendar below it is.
      this.#addRangeSwitch(menu, def);
      const calTpl = this.$<HTMLTemplateElement>('template.qf-calendar-tpl');
      if (calTpl) {
        const cal = calTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        if (def.range) cal.setAttribute('data-type', 'range');
        if (def.availableDates) {
          cal.setAttribute('data-available', def.availableDates.join(','));
        }
        // TRAP T-calendar-header-has-no-heading — no search; CLEAR stays, as a
        // date chip has no other way back to "no date".
        menu.removeAttribute('data-search');
        // The Menu set's `Type = Calendar` variant: a wider card.
        menu.setAttribute('data-type', 'calendar');
        menu.appendChild(cal);
      }
      this.#addRemove(chip, menu, def);
      chip.setAttribute('data-menu', '');
      chip.appendChild(menu);
      return;
    }

    /* THE CONDITION ROW leads the value menu, above the search box. What it
       is set to decides whether the rows below it, or a text box, is what the
       reader answers with. TRAP T-an-operator-decides-pick-or-type */
    if (def.conditions) this.#addConditionRow(menu, def);

    /* A VALUE menu is a FILTER menu: the condition row above the search says
       what its rows mean. A PERSISTENT chip is a selector, not a field
       question — "which saved view" has no Contains.
       TRAP T-an-operator-decides-pick-or-type */
    if (!def.persistent) {
      menu.setAttribute('data-type', 'filter');
      if (def.op) menu.setAttribute('data-op', def.op);
    }

    // TRAP T-persistent-chip-is-a-selector — no pick at all falls back to the
    // FIRST option, or the chip paints as an empty warning.
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
      input.checked = isOn(option);
      // Dimmed but still selectable: broadening a filter back out needs the way through.
      if (option.available === false) row.setAttribute('data-unavailable', '');
      row.querySelector('.qf-row-label')!.textContent = option.label;
      menu.appendChild(row);
    };

    // Select all (multi only) · available · divider · unavailable. SPLIT, not sorted.
    if (!single) this.#addSelectAll(menu, options);

    const reachable = options.filter((o) => o.available !== false);
    const unreachable = options.filter((o) => o.available === false);
    for (const option of reachable) addRow(option);
    // Only with something on BOTH sides.
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
   * The condition dropdown, plus the text box its typing conditions use.
   *
   * BOTH bodies are stamped: CSS reveals one off the menu's `data-takes`, so a
   * reader flipping between Equals and Contains keeps their ticks AND their
   * typing. Rebuilding would throw one of them away every flip.
   * TRAP T-an-operator-decides-pick-or-type
   * TRAP T-range-switch-swaps-not-rebuilds
   */
  #addConditionRow(menu: HTMLElement, def: QuickFilterDef): void {
    const row = this.clone('template.qf-op-tpl');
    const select = row?.querySelector('select');
    const proto = select?.querySelector('option');
    if (!row || !select || !proto) return;

    // The ops a TEXT field can answer — the one vocabulary, in store.ts.
    const ops = OPS_FOR_TYPE[def.kind === 'number' ? 'number' : 'text'] ?? [];
    select.replaceChildren(
      ...ops.map((op) => {
        const option = proto.cloneNode(false) as HTMLOptionElement;
        option.value = op;
        option.textContent = OP_LABELS[op];
        return option;
      }),
    );

    const op = def.op ?? DEFAULT_OP;
    select.value = ops.includes(op) ? op : (ops[0] ?? DEFAULT_OP);
    menu.setAttribute('data-takes', OP_TAKES[select.value as FilterOp] ?? 'list');
    menu.appendChild(row);

    // The typed half, stamped whether or not it shows. CSS decides.
    const box = this.clone('template.qf-text-tpl');
    const input = box?.querySelector('input');
    if (box && input) {
      input.value = def.text ?? '';
      menu.appendChild(box);
    }
  }

  /** Was this chip's commit mode PINNED by its definition? The Range switch must not move it. */
  #chipDefers(sw: HTMLElement): boolean {
    const id = sw.closest<HTMLElement>('.chip')?.dataset['id'];
    if (!id) return false;
    return this.#filters.some((f) => f.id === id && f.commit != null);
  }

  /** TRAP T-range-switch-swaps-not-rebuilds — one filter, two shapes, one switch. */
  #addRangeSwitch(menu: HTMLElement, def: QuickFilterDef): void {
    const row = this.clone('template.qf-range-tpl');
    if (!row) return;
    const sw = row.querySelector('sherpa-switch');
    /* A NUMBER opens as a RANGE, a DATE keeps what it declared; an explicit
       `range: false` still wins. TRAP T-a-default-is-not-an-override */
    if (def.range ?? def.kind === 'number') {
      sw?.setAttribute('checked', '');
      menu.setAttribute('data-range', '');
    }
    menu.appendChild(row);
  }

  /** The Range switch was flipped — swap the menu between its two shapes. */
  #onRangeToggle = (event: Event): void => {
    // The change starts on the switch's inner <input>.
    const sw = this.pathFind(event, '.qf-range-switch');
    if (!sw) return;
    const on = (sw as HTMLElement & { checked: boolean }).checked;
    const menu = sw.closest('sherpa-menu');
    if (!menu) return;
    menu.toggleAttribute('data-range', on);
    // A range defers — the pick is not finished on its first end.
    if (!this.#chipDefers(sw)) menu.toggleAttribute('data-commit', on);
    // Any previous single pick is left alone — re-picking starts a range anyway.
    menu.querySelector('sherpa-calendar')?.setAttribute('data-type', on ? 'range' : 'single');
    // The filter's shape changed, so its meaning did.
    this.#emitChange();
  };

  /**
   * A CONDITION was picked — swap the menu between its two bodies.
   *
   * Nothing is rebuilt: `data-takes` is what CSS reads, so the ticked rows and
   * the typed box both survive the flip.
   * TRAP T-an-operator-decides-pick-or-type
   */
  #onConditionPicked = (event: Event): void => {
    const select = this.pathFind(event, '.qf-op') as HTMLSelectElement | null;
    if (!select) return;
    const menu = select.closest('sherpa-menu');
    const chip = select.closest<HTMLElement>('.chip');
    const id = chip?.dataset['id'];
    if (!menu || !id) return;

    const op = select.value as FilterOp;
    menu.setAttribute('data-takes', OP_TAKES[op] ?? 'list');

    // The DEFINITION is where the chip's state lives, so a re-render keeps it.
    const def = this.#filters.find((f) => f.id === id);
    if (def) def.op = op;

    // The filter's shape changed, so its meaning did.
    this.#emitChange();
  };

  /** The reader typed into a condition that takes text. Kept on the definition. */
  #onConditionText = (event: Event): void => {
    const input = this.pathFind(event, '.qf-text') as HTMLInputElement | null;
    if (!input) return;
    const id = input.closest<HTMLElement>('.chip')?.dataset['id'];
    if (!id) return;
    const def = this.#filters.find((f) => f.id === id);
    if (def) def.text = input.value;
    this.#emitChange();
  };

  /**
   * "Select all / Clear all" at the top of a MULTI-select menu.
   *
   * TRAP T-select-all-is-not-a-value — one row, not two.
   * TRAP T-native-change-stops-at-the-host — stamped here, owned by the menu.
   */
  #addSelectAll(menu: HTMLElement, options: readonly QuickFilterOption[]): void {
    if (!options.length) return;
    const row = this.clone('template.qf-all-tpl');
    if (row) menu.appendChild(row);
  }

  /** Give a chip's menu its "Remove" action. TRAP T-remove-is-opt-in-and-a-footer-button */
  #addRemove(chip: HTMLElement, menu: HTMLElement, def: QuickFilterDef): void {
    if (!chip.classList.contains('chip')) return;
    if (!def.removable || def.persistent) return;
    menu.setAttribute('data-removable', '');
  }

  /** A "Remove" row. `menu-select` is for ACTION rows; value rows commit via `menu-change`. */
  #onMenuSelect = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== 'remove') return;
    // TRAP T-remove-matches-the-tag-not-the-class — the PATH, and the TAG.
    const chip = this.pathFind(event, 'sherpa-quick-filter');
    const id = chip?.dataset['id'];
    if (!id) return;
    event.stopImmediatePropagation();
    // Shut it first: a popover destroyed while open leaves the top layer confused.
    (chip.querySelector('sherpa-menu') as HTMLElement & { hide?: () => void })?.hide?.();
    this.#removeFilter(id);
  };

  #onChipClick = (event: Event): void => {
    // Composed → find the originating chip on the path.
    const path = event.composedPath();

    // The SORT chip's body is a TRI-STATE toggle; the column only changes from
    // the menu. TRAP T-sort-is-tri-state
    const sortChip = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.dataset['id'] === 'sort',
    );
    if (sortChip?.classList.contains('organise-chip')) {
      // IMMEDIATE — see #onOrganiseChange.
      event.stopImmediatePropagation();
      this.#cycleSort(sortChip);
      return;
    }

    /* Its own branch, because the lookup below wants `.chip` and an organise chip
       is a `.organise-chip`. TRAP T-group-chip-body-toggles-grouping */
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

    // A persistent chip has ALREADY flipped itself off by now, so put it back.
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

  /** Follow `data-sort-field`. TRAP T-a-chip-body-cycles-its-states — no event; empty SUSPENDS. */
  #syncSortFromAttrs(): void {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    if (!chip) return;

    const field = this.dataset['sortField'] ?? '';
    const raw = this.dataset['sortDirection'];
    // The shared reader — TRAP T-one-cycle-for-one-value.
    const direction = sortDirectionFrom(raw) ?? 'asc';
    /* An EMPTY direction is a suspended sort: the column is still pushed, so only
       the direction says whether it runs. TRAP T-a-suspended-sort-is-one-owners-job */
    const suspended = raw === '';

    // No field, no sort — off, keeping whatever pick it had.
    if (!field) {
      chip.removeAttribute('data-current');
      this.#syncSortLabel(chip);
      return;
    }

    // Either way: a suspended sort still shows which column it would resume on.
    for (const radio of chip.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.checked = radio.value === field;
    }
    // A resume starts ASCENDING, so a suspended chip must not keep its `desc`.
    chip.dataset['direction'] = suspended ? 'asc' : direction;
    chip.toggleAttribute('data-current', !suspended);
    this.#syncSortLabel(chip);
  }

  /** Follow `data-group-field`. The twin of `#syncSortFromAttrs`: empty suspends, no event. */
  #syncGroupFromAttrs(): void {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="group"]');
    if (!chip) return;

    const field = this.dataset['groupField'] ?? '';

    // No field means ungrouped — SUSPENDED, and the pick is kept.
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

  /** Report the whole filter state — the active toggle chips and every menu chip's picks. */
  #emitChange(): void {
    this.emit('quick-filter-change', {
      // TRAP T-values-carries-two-shapes — `scope` says WHICH shape this is.
      scope: 'bar',
      active: this.active,
      // APPLIED: only ON chips. REMEMBERED: including chips toggled off.
      values: this.values,
      picked: this.pickedValues,
      custom: this.customFilters,
      // Ready for a DataSource, for the chips that carry a CONDITION. A view
      // that offers no conditions never sees this and reads `values` as before.
      clauses: this.clauses,
    });
  }

  /**
   * Every condition chip as a ready FilterClause, by chip id.
   *
   * A chip WITHOUT `conditions: true` is absent: its meaning is `values`, and
   * a second shape for the same fact is a second answer. A chip on a typing
   * condition with nothing typed is absent too — an empty value says nothing.
   *
   * This is the shape the column heading's filter menu already reports, so one
   * field filtered from either place reaches the data layer identically.
   * TRAP T-an-operator-decides-pick-or-type
   */
  get clauses(): Record<string, [string, FilterOp, unknown]> {
    const out: Record<string, [string, FilterOp, unknown]> = {};
    for (const def of this.#filters) {
      if (!def.conditions) continue;
      const op = def.op ?? DEFAULT_OP;
      const field = def.id;

      if ((OP_TAKES[op] ?? 'list') === 'text') {
        const typed = (def.text ?? '').trim();
        if (typed) out[field] = [field, op, typed];
        continue;
      }

      const picks = this.#chipPicksById(field);
      if (!picks.length) continue;
      /* ONE pick is `eq`; SEVERAL is `in`, because `eq` against a list can
         never match. `ne` inverts the same way. */
      if (picks.length === 1) out[field] = [field, op, picks[0]];
      else out[field] = [field, op === 'ne' ? 'notin' : 'in', picks];
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
    const def = this.#filters.find((f) => f.id === id);
    if (!def?.conditions) return;

    if (!clause) {
      def.op = DEFAULT_OP;
      def.text = '';
      this.setChipValues(id, []);
      this.#syncCondition(id, def);
      return;
    }

    const [, op, value] = clause;
    /* `in`/`notin` are how SEVERAL picks read; the chip's own condition stays
       `eq`/`ne`, because the dropdown offers no "is one of" — the list IS the
       "one of". TRAP T-an-operator-decides-pick-or-type */
    def.op = op === 'in' ? 'eq' : op === 'notin' ? 'ne' : op;

    if ((OP_TAKES[def.op] ?? 'list') === 'text') {
      def.text = value == null ? '' : String(value);
    } else {
      const picks = (Array.isArray(value) ? value : [value])
        .filter((v) => v != null)
        .map((v) => String(v));
      this.setChipValues(id, picks);
    }
    this.#syncCondition(id, def);
  }

  /** Write a chip's condition back into its live menu. */
  #syncCondition(id: string, def: QuickFilterDef): void {
    for (const chip of this.#chips()) {
      if (chip.dataset['id'] !== id) continue;
      const menu = chip.querySelector('sherpa-menu');
      const select = chip.querySelector<HTMLSelectElement>('.qf-op');
      const box = chip.querySelector<HTMLInputElement>('.qf-text');
      const op = def.op ?? DEFAULT_OP;
      if (select) select.value = op;
      if (box) box.value = def.text ?? '';
      menu?.setAttribute('data-takes', OP_TAKES[op] ?? 'list');
      return;
    }
  }

  /** One chip's ticked values, by id. */
  #chipPicksById(id: string): string[] {
    for (const chip of this.#chips()) {
      if (chip.dataset['id'] === id) return this.#chipPicks(chip);
    }
    return [];
  }

  /**
   * Every CUSTOM chip and whether it is on — `{ 'col:name': true }`.
   *
   * TRAP T-custom-chips-are-reported-separately — a typed value has no rows to
   * read back, so on/off is the whole answer.
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
   * Flip grouping from the chip's body. SUSPEND, NEVER CLEAR — the radio keeps
   * its column, and the chip has ALREADY flipped its own `data-current`.
   */
  #toggleGroup(chip: HTMLElement): void {
    /* On with nothing ever picked lights a chip that groups nothing, and the host
       writes `data-group-field=""` straight back — a flicker. No pick is not a
       suspended pick. */
    if (chip.hasAttribute('data-current') && !this.#menuValue('group')) {
      chip.removeAttribute('data-current');
    }
    this.#syncGroupLabel(chip);
    // REPORTS — the host owns the grouping and writes `data-group-field` back.
    this.emit('group-change', { field: this.groupField });
  }

  /** Advance the sort chip: asc → desc → suspended → asc. */
  #cycleSort(chip: HTMLElement): void {
    /* ONE CYCLE, in `core/cycle.ts` — the same function the grid's column header
       runs; written separately the two drifted. TRAP T-one-cycle-for-one-value

       The chip has ALREADY flipped its own `data-current`, so the live state is
       the INVERSE of what it now says. */
    const wasLive = !chip.hasAttribute('data-current');
    const column = this.#menuValue('sort') ?? '';
    /* SUSPENDED is a NULL direction — `data-direction` REMEMBERS the direction,
       not whether it runs. */
    const held = wasLive ? (sortDirectionFrom(chip.dataset['direction']) ?? 'asc') : null;
    const next = nextSort(column, column, held);

    chip.toggleAttribute('data-current', next.direction !== null);
    // A suspended chip rewinds to `asc` — that is where a resume starts.
    chip.dataset['direction'] = next.direction ?? 'asc';

    this.#syncSortLabel(chip);
    this.emit('sort-change', { field: this.sortField, direction: this.sortDirection });
  }

  /** Show the sort chip's state: the CHIP says "Sort", the COLUMN reads in the caret. */
  #syncSortLabel(chip: HTMLElement): void {
    const live = chip.hasAttribute('data-current');
    const desc = chip.dataset['direction'] === 'desc';
    const column = this.#organise.sort?.find((c) => c.field === this.#menuValue('sort'));
    chip.setAttribute('data-label', 'Sort');
    const target = chip as HTMLElement & { valueLabel?: string };
    // A suspended sort keeps its column, so the caret still names it.
    if ('valueLabel' in target) target.valueLabel = column?.label ?? '';
    const { sortNone, sortAsc, sortDesc } = SherpaQuickFilterToolbar.#icons;
    chip.setAttribute('data-icon-start', !live ? sortNone : desc ? sortDesc : sortAsc);
  }

  /** available([...]) — the filters the Add chip offers, over the populate() set. */
  available(defs: QuickFilterDef[]): void {
    this.#available = Array.isArray(defs) ? defs : [];
    this.#renderAvailable();
  }

  /** Stamp the Add button's menu from whatever is left to add. */
  #renderAvailable(): void {
    const add = this.$<HTMLElement>('.add-btn');
    if (!add) return;
    // Nothing left to add — disabled, not an empty list.
    const any = this.#available.length > 0;
    this.toggleAttribute('data-can-add', any);
    add.toggleAttribute('disabled', !any);
    add.querySelector('sherpa-menu')?.remove();
    if (!any) return;
    this.#addMenu(add, {
      id: 'add',
      label: 'Add filter',
      select: 'multiple',
      // TRAP T-add-menu-batches — the one menu that KEEPS Apply: each tick stamps
      // a chip, so per-tick apply rebuilds the run mid-selection.
      commit: true,
      options: this.#available.map((f) => ({ value: f.id, label: f.label })),
    });
    add.querySelector('sherpa-menu')?.toggleAttribute('data-search', true);
  }

  /** Move the chosen available filters onto the bar. */
  #addFilters(ids: string[]): void {
    const added: QuickFilterDef[] = [];
    for (const id of ids) {
      const i = this.#available.findIndex((f) => f.id === id);
      if (i < 0) continue;
      const [def] = this.#available.splice(i, 1);
      // ON and REMOVABLE: the user added it, so they may take it off.
      added.push({ ...def!, active: true, removable: true });
    }
    if (!added.length) return;
    this.#filters = [...this.#filters, ...added];
    this.#render();
    this.#renderAvailable();
    // ONE event for the batch — a host re-queries once.
    this.emit('filter-add', { ids: added.map((f) => f.id), filters: added });
    this.#emitChange();
  }

  /** Take one filter back OFF the bar. It returns to the Add menu, clean. */
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
        this.#toggleFavourite(btn);
        break;
      case 'add':
        // The button IS the trigger — there is no caret.
        this.#openAddMenu(btn);
        break;
    }
  };

  /** The Add menu committed. `menu-change`: only a CHIP re-emits as quick-filter-change. */
  #onAddCommit = (event: Event): void => {
    const add = this.pathFind(event, '.add-btn');
    if (!add) return;
    event.stopImmediatePropagation();
    const picked = (event as CustomEvent).detail?.values as string[] | undefined;
    if (picked?.length) this.#addFilters(picked);
  };

  /** Open the Add button's menu. `aria-expanded` is what makes a plain button a valid trigger. */
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

  /** Flip the star. TRAP T-favourite-star-swaps-its-glyph — colour alone cannot carry it. */
  #toggleFavourite(btn: HTMLElement): void {
    const on = !this.hasAttribute('data-favourite');
    this.toggleAttribute('data-favourite', on);
    // TRAP T-tokens-css-never-reaches-shadow — `active` is a real Style MODE,
    // which is why THIS sheet paints it.
    if (on) btn.setAttribute('data-status', 'active');
    else btn.removeAttribute('data-status');
    btn.setAttribute('data-icon-start', on ? 'fa-solid fa-star' : 'fa-regular fa-star');
    btn.setAttribute('aria-pressed', String(on));
    this.emit('view-favorite', { favourite: on });
  }

  /** Put a CUSTOM filter on the bar — one whose value is TYPED, not picked. */
  addCustomFilter(spec: { id: string; label: string; value?: string | null }): void {
    const { id, label, value } = spec;
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
      // Theirs to remove, and no `options`, so no menu — just a caret reading this.
      removable: true,
      customValue: value,
    };

    if (i >= 0) this.#filters[i] = def;
    else this.#filters = [...this.#filters, def];

    this.#render();
    this.#emitChange();
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

  /** TRAP T-organise-glyphs-are-named-not-inline — `view` stays here, the shared four in core/icons. */
  static readonly #icons = {
    view: 'fa-solid fa-desktop',
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

    if (group.length) {
      zone.appendChild(
        // fa-SOLID: the free set has no regular weight here; `fa-regular` renders
        // the missing-glyph box.
        this.#organiseChip('group', 'Group', SherpaQuickFilterToolbar.#icons.group,
          group.map((c) => ({ value: c.field, label: c.label }))),
      );
    }
    if (sort.length) {
      // The MENU picks the column, the BODY cycles direction. Built OFF, so it
      // opens with the sort-none glyph.
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
        // The chip's OWN picks: `values` reports only chips already ON, so an off
        // chip could never commit itself on — every date chip's first pick.
        filterChip.toggleAttribute(
          'data-current',
          filterChip.hasAttribute('data-persistent') || this.#chipPicks(filterChip).length > 0,
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
      this.#syncSortLabel(chip);
      this.emit('sort-change', { field: this.sortField, direction: this.sortDirection });
    }
  };
}

customElements.define('sherpa-quick-filter-toolbar', SherpaQuickFilterToolbar);
