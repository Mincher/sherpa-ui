/**
 * sherpa-quick-filter-toolbar — a row of filter chips above a grid or list.
 *
 * populate([{ id, label, type?, active?, icon?, options? }]) fills it.
 *
 * TRAP T-actions-were-a-slot
 * TRAP T-organise-chips-lead-the-bar
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { NON_VALUE_ROWS, ORGANISE_ICONS } from '../../core/icons.js';
import { nextSort, sortDirectionFrom } from '../../core/cycle.js';
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
  /** Values this chip filters by — a caret and a menu of checkbox or radio rows. */
  options?: QuickFilterOption[];
  select?: 'single' | 'multiple';
  /**
   * What the chip's menu holds.
   *
   * TRAP T-number-and-date-lead-with-a-range-switch
   */
  kind?: 'values' | 'number' | 'date';
  /** A number filter's slider ends and field clamp. Default 0..100. */
  min?: number;
  max?: number;
  /** The slider's increment. Defaults to 1. */
  step?: number;
  /**
   * The days a DATE chip's calendar may pick — ISO strings; every other day
   * draws inactive. A SET, not a span: a column of dates is a scatter.
   */
  availableDates?: string[];
  /**
   * A value the user TYPED rather than picked, shown on the chip's caret.
   *
   * The finished phrase ("Contains: ana") arrives already made and the chip
   * opens no menu. Set it via `addCustomFilter()`.
   */
  customValue?: string;
  /** Start a number or date chip in RANGE mode. The user may still flip it. */
  range?: boolean;
  /**
   * A chip that cannot be switched OFF — a SELECTOR rather than a toggle.
   *
   * TRAP T-persistent-chip-is-a-selector
   */
  persistent?: boolean;
  /**
   * Offer "Remove" at the foot of this chip's menu. OPT-IN: a chip the host put
   * there must not offer a row that deletes it.
   */
  removable?: boolean;
  /**
   * Override whether this chip's menu defers its picks behind Apply/Cancel.
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
   * THE SORT and GROUP, written from outside — by a DataSource, or by a grid
   * whose own column header was clicked. Without observing these the link runs
   * one way and a header click leaves the chip saying nothing.
   */
  static override observed = ['data-sort-field', 'data-sort-direction', 'data-group-field'];

  #filters: QuickFilterDef[] = [];
  #organise: OrganiseDef = {};
  /** Filters the user MAY add but has not — the Add chip's menu. */
  #available: QuickFilterDef[] = [];

  /* ── Fitting the bar ─────────────────────────────────────────────── */

  #observer: ResizeObserver | null = null;
  /** The pending reflow frame, so a burst of resizes measures once. */
  #frame: number | null = null;

  /** How far the action cluster has folded. */
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
   * TRAP T-drill-moves-not-clones
   */
  #renderFolded(folded: readonly HTMLElement[]): void {
    const chip = this.$<HTMLElement>('.overflow-chip');
    if (!chip) return;

    // The count of folded FILTERS, not of values.
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

      // A BOOLEAN chip has no menu to drill into, so it gets a tickable row.
      if (!source.querySelector('sherpa-menu')) {
        const toggle = this.clone('template.qf-toggle-tpl');
        if (!toggle) continue;
        toggle.dataset['for'] = id;
        const box = toggle.querySelector<HTMLInputElement>('input');
        const text = toggle.querySelector('.qf-toggle-label');
        if (text) text.textContent = label;
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
      // The list item names itself from data-label — its own API.
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
   * Separate from row STAMPING: re-stamping would rebuild the list the reader
   * is looking at.
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
      const count = this.#chipPicks(source).length;
      badge.textContent = String(count);
      /* A data-* ON THE ROW, not `hidden` on the badge: CSS owns visibility, and
         nothing can write `:host(...)` for an element inside a menu. */
      badge.closest('.qf-folded')?.toggleAttribute('data-count', count > 0);
    }
  }

  /** A folded TOGGLE was ticked — flip the chip it stands for, and let IT report. */
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

  /**
   * Where a DRILLED-IN menu's rows came from, so Back can put them home.
   *
   * TRAP T-drill-moves-not-clones — one card, one set of inputs, moved not copied.
   */
  #drill: { home: HTMLElement; rows: Element[] } | null = null;

  /**
   * The menu attributes that belong to a FILTER rather than to the card.
   *
   * TRAP T-drill-flags-travel-and-replace — replaced, never merged.
   */
  static readonly DRILL_FLAGS = [
    'data-commit',
    'data-range',
    'data-select',
    'data-search',
    'data-type',
  ] as const;

  /** A folded filter's row was clicked — drill into that filter. */
  #onFoldedClick = (event: Event): void => {
    const path = event.composedPath();

    // A FOLDED TOGGLE ticks in place — stopping the click leaves the box unticked.
    if (path.some((n) => n instanceof HTMLElement && n.classList.contains('qf-toggle'))) return;

    // The path, not `target`: the click starts in the list item's own shadow root.
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

    // Put the last drill back first, so Back is one level deep, never a chain.
    if (this.#drill) this.#drillOut();

    // Park the overflow list, then MOVE the filter's own rows across.
    this.#drill = { home: from, rows: [...into.children] };
    into.replaceChildren(...from.childNodes);

    into.setAttribute('data-drill', '');
    into.dataset['drillFrom'] = chip.dataset['label'] ?? 'More';
    into.setAttribute('data-heading', row.dataset['label'] ?? '');
    // TRAP T-drill-flags-travel-and-replace — restored to what the TARGET had.
    for (const flag of SherpaQuickFilterToolbar.DRILL_FLAGS) {
      const value = from.getAttribute(flag);
      if (value == null) into.removeAttribute(flag);
      else into.setAttribute(flag, value);
    }
  };

  /** A calendar picked a day or completed a range — relabel its chip. */
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

  /**
   * Shut the overflow menu, putting any drilled rows back first.
   *
   * ORDER MATTERS — TRAP T-drill-moves-not-clones.
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
   * TRAP T-overflowing-needs-1px-slack — the +1 matters.
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
    /* ONE measure per frame — a resize drag fires this per pixel.
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
    // Delegated from the zone: every control is a sherpa-button firing the same
    // button-click, so one listener reads data-act off whichever was pressed.
    this.$('.actions-zone')?.addEventListener('button-click', this.#onAction);
    // CAPTURE — TRAP T-capture-beats-registration-order.
    this.addEventListener('quick-filter-change', this.#onOrganiseChange, true);
    this.addEventListener('quick-filter-change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-change', this.#onFoldedCountsChanged);
    // A COMMITTING menu fires nothing while its rows are ticked, so a value
    // picked inside a drill reaches no listener. The native `change` from the
    // row does bubble this far: the rows are in the CHIP's light DOM.
    this.addEventListener('change', this.#onFoldedCountsChanged);
    // Action rows (the "Remove" button) report separately from value rows.
    this.addEventListener('menu-select', this.#onMenuSelect);
    // A CALENDAR commits through its own events, not the menu's; an auto-applying
    // date chip has no Apply button.
    this.addEventListener('datetime-change', this.#onDatePicked);
    this.addEventListener('range-select', this.#onDatePicked);
    // sherpa-switch re-dispatches its native change as a COMPOSED one, so this
    // reaches here where a bare checkbox's would not.
    this.addEventListener('change', this.#onRangeToggle);
    // The ADD menu hangs off a sherpa-BUTTON, which does not relay menu-change
    // as quick-filter-change, so its commit is heard directly.
    this.addEventListener('menu-change', this.#onAddCommit as EventListener);
    if (this.#filters.length) this.#render();
    if (this.#organise.group?.length || this.#organise.sort?.length) this.#renderOrganise();
    if (this.#available.length) this.#renderAvailable();

    // CLICK, not hover: a drill replaces what is on screen, and a passing
    // pointer would move the list out from under it.
    this.addEventListener('click', this.#onFoldedClick, true);
    // The back arrow is two shadow boundaries away, so the menu re-emits its
    // click as a composed `menu-back`.
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
   * TRAP T-toggle-chip-has-no-count
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
      // OFF = this field is not being filtered. The picks survive.
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
      // Persistent: never switched off, but it still FOLLOWS a pick.
      if (chip.hasAttribute('data-persistent')) {
        if (wanted?.length) chip.values = wanted;
        continue;
      }

      if (wanted?.length) {
        // The CHIP owns its own face — label, badge, tooltip, on/off.
        chip.values = wanted;
      } else {
        // NOT named by the view: off, but its picks survive. "Off" and "gone"
        // are different states.
        chip.current = false;
      }
    }
  }

  /**
   * Every menu chip's picks, on or OFF — what the chips REMEMBER.
   *
   * The counterpart to `values`, which is what is being applied.
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
   * a single-entry array, and a range two.
   */
  #chipPicks(chip: HTMLElement): string[] {
    // A chip DRILLED INTO the overflow menu reports from there: the rows are
    // moved, not copied, so its own menu is empty right now.
    if (this.#drill && this.#drill.home === chip.querySelector('sherpa-menu')) {
      const live = this.$<HTMLElement & { values: string[] }>('.overflow-chip');
      const menu = live?.querySelector<HTMLElement & { values: string[] }>('sherpa-menu');
      if (menu) return menu.values;
    }
    // A NUMBER chip's menu reports its own value — it knows which shape its
    // Range switch has it in.
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
    // NON_VALUE_ROWS — see that constant for what counts as a pick.
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
    // Parsed as UTC, so FORMATTED as UTC — otherwise a browser west of
    // Greenwich renders the previous day.
    const at = (iso: string): Date | null => {
      const d = new Date(`${iso}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    // DAY THEN MONTH, always. `toLocaleDateString` orders parts by locale, so
    // formatToParts gives the localised month NAME while this keeps the order.
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

    // No count badge: the label says both days outright.
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
      // LIVE state wins over the definition; an untouched chip falls back to `active`.
      if (prior ? prior.on : f.active) chip.setAttribute('data-current', '');
      // The view selector's glyph is the toolbar's to decide, not the app's.
      const glyph = f.id === 'view' ? SherpaQuickFilterToolbar.#icons.view : f.icon;
      if (glyph) chip.setAttribute('data-icon-start', glyph);
      // A selector, not a toggle: always on, and its body does not flip it.
      if (f.persistent) {
        chip.setAttribute('data-persistent', '');
        chip.setAttribute('data-current', '');
      }
      // A date or number chip carries no `options`, so the menu is stamped on
      // kind as well as on having values to list.
      const hasOwnContent = f.kind === 'date' || f.kind === 'number';
      if (f.options?.length || hasOwnContent) this.#addMenu(chip, f, prior?.picked);
      if (f.customValue) {
        // `data-custom` is what makes it findable: it is in neither `active` nor
        // `values`.
        chip.setAttribute('data-custom', '');
        chip.setAttribute('data-menu', '');
        // It reads in FULL: "Contains: a…" names a condition with no subject.
        chip.setAttribute('data-full-value', '');
        // The caret is still DRAWN — that is where the value reads — but no menu
        // is slotted, so clicking it is already a no-op.
        customLabels.push([chip, f.customValue]);
      }
      list.appendChild(chip);
      if (f.kind === 'date') {
        // A date range reads in full — see #syncDateLabel.
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

    // The run changed, so what fits changed with it. A ResizeObserver only fires
    // on a size change, and populating an already-final-width bar is not one.
    this.#onResize();
  }

  /**
   * Give a chip its value menu: a <sherpa-menu> of real checkbox/radio rows in the
   * chip's light DOM, cloned from the template's menu prototypes.
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
    // TRAP T-commit-follows-select-mode. A NUMBER defaults to a range, the same
    // default `#addRangeSwitch` applies.
    const asRange = def.range ?? def.kind === 'number';
    const picksOne = (def.kind === 'date' || def.kind === 'number') && !asRange;
    const defers = def.commit ?? (!single && !picksOne);
    if (defers) menu.setAttribute('data-commit', '');
    // TRAP T-every-chip-menu-gets-clear-and-search — Clear is a HEADER button,
    // and a persistent chip gets none.
    if (!def.persistent) menu.setAttribute('data-clearable', '');
    menu.setAttribute('data-search', '');
    // The card stays inside the region the HOST names. Without a `data-bounds`
    // the menu falls back to the viewport.
    const bounds = this.dataset['bounds'];
    if (bounds) menu.setAttribute('data-bounds', bounds);

    // A NUMBER chip's menu holds a Range switch over one field or a two-ended
    // slider. Both exist from the start and CSS reveals one, so a flip back
    // keeps whatever was typed on the other side.
    if (def.kind === 'number') {
      // Nothing to search: there is no list, only a value to type or drag.
      menu.removeAttribute('data-search');
      this.#addRangeSwitch(menu, def);
      const box = this.clone('template.qf-number-tpl');
      if (box) {
        const slider = box.querySelector('sherpa-slider');
        const field = box.querySelector('input');
        // The bounds are the slider's ends and the field's clamp, so typing 500
        // into a 0..100 filter cannot ask for a row that cannot exist.
        const min = def.min ?? 0;
        const max = def.max ?? 100;
        for (const el of [slider, field]) {
          if (!el) continue;
          el.setAttribute('min', String(min));
          el.setAttribute('max', String(max));
          if (def.step != null) el.setAttribute('step', String(def.step));
        }
        // A fresh range spans the WHOLE span, so it starts by excluding nothing.
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
      // The RANGE switch comes FIRST: it decides what the calendar below it is.
      this.#addRangeSwitch(menu, def);
      const calTpl = this.$<HTMLTemplateElement>('template.qf-calendar-tpl');
      if (calTpl) {
        const cal = calTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        // The calendar's own two-click start→end mode.
        if (def.range) cal.setAttribute('data-type', 'range');
        // Absent leaves every day pickable — see `availableDates`.
        if (def.availableDates) {
          cal.setAttribute('data-available', def.availableDates.join(','));
        }
        // TRAP T-calendar-header-has-no-heading — a calendar is not a list to
        // search; CLEAR stays, as a date chip had no other way back to "no date".
        menu.removeAttribute('data-search');
        // The Menu set's own `Type = Calendar` variant: a wider card.
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
      // A LIVE pick beats the definition's `selected`; the fallback is the last
      // word only where there is no pick at all.
      input.checked = isOn(option);
      // CSS dims it; the row stays selectable, because a user broadening a
      // filter back out needs the way through.
      if (option.available === false) row.setAttribute('data-unavailable', '');
      row.querySelector('.qf-row-label')!.textContent = option.label;
      menu.appendChild(row);
    };

    // THE ORDER: Select all/Clear all (multi only) · available · divider ·
    // unavailable. SPLIT, not sorted by a flag.
    if (!single) this.#addSelectAll(menu, options);

    const reachable = options.filter((o) => o.available !== false);
    const unreachable = options.filter((o) => o.available === false);
    for (const option of reachable) addRow(option);
    // The divider only earns its place with something on BOTH sides.
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
   * A host that named `commit` meant it either way, so the Range switch must
   * not move it.
   */
  #chipDefers(sw: HTMLElement): boolean {
    const id = sw.closest<HTMLElement>('.chip')?.dataset['id'];
    if (!id) return false;
    return this.#filters.some((f) => f.id === id && f.commit != null);
  }

  /**
   * Put the RANGE switch at the top of a number or date menu.
   *
   * TRAP T-range-switch-swaps-not-rebuilds — one filter, two shapes.
   */
  #addRangeSwitch(menu: HTMLElement, def: QuickFilterDef): void {
    const row = this.clone('template.qf-range-tpl');
    if (!row) return;
    const sw = row.querySelector('sherpa-switch');
    /* A NUMBER opens as a RANGE, a DATE keeps what it declared. An explicit
       `range: false` still wins — this is a DEFAULT, not an override.
       TRAP T-a-default-is-not-an-override. */
    if (def.range ?? def.kind === 'number') {
      sw?.setAttribute('checked', '');
      menu.setAttribute('data-range', '');
    }
    menu.appendChild(row);
  }

  /**
   * The Range switch was flipped — swap the menu between its two shapes.
   *
   * sherpa-switch re-dispatches its native change as a COMPOSED one, so unlike
   * the value rows this crosses the shadow boundary and can be heard here.
   */
  #onRangeToggle = (event: Event): void => {
    // The change starts on the switch's own inner <input>.
    const sw = this.pathFind(event, '.qf-range-switch');
    if (!sw) return;
    const on = (sw as HTMLElement & { checked: boolean }).checked;
    const menu = sw.closest('sherpa-menu');
    if (!menu) return;
    menu.toggleAttribute('data-range', on);
    // A RANGE defers: the pick is not finished on its first end. A chip whose
    // definition named `commit` keeps what it asked for.
    if (!this.#chipDefers(sw)) menu.toggleAttribute('data-commit', on);
    // The calendar reads the mode as its own type. Its previous single pick is
    // left alone — re-picking is how a range is started anyway.
    menu.querySelector('sherpa-calendar')?.setAttribute('data-type', on ? 'range' : 'single');
    // The filter's SHAPE changed, so what it means changed with it.
    this.#emitChange();
  };

  /**
   * Put a "Select all / Clear all" row at the top of a MULTI-select menu.
   *
   * TRAP T-select-all-is-not-a-value — one row, not two.
   * TRAP T-native-change-stops-at-the-host — stamped here, owned by the menu.
   */
  #addSelectAll(menu: HTMLElement, options: readonly QuickFilterOption[]): void {
    if (!options.length) return;
    const row = this.clone('template.qf-all-tpl');
    if (row) menu.appendChild(row);
  }

  /**
   * Give a chip's menu its "Remove" action — a FOOTER BUTTON.
   *
   * TRAP T-remove-is-opt-in-and-a-footer-button
   */
  #addRemove(chip: HTMLElement, menu: HTMLElement, def: QuickFilterDef): void {
    if (!chip.classList.contains('chip')) return;
    if (!def.removable || def.persistent) return;
    menu.setAttribute('data-removable', '');
  }

  /**
   * A "Remove" row was clicked — take that chip off the bar.
   *
   * The menu fires `menu-select` for ACTION rows, separately from the
   * `menu-change` its value rows commit on Apply.
   */
  #onMenuSelect = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== 'remove') return;
    // TRAP T-remove-matches-the-tag-not-the-class — the PATH, and the TAG.
    const chip = this.pathFind(event, 'sherpa-quick-filter');
    const id = chip?.dataset['id'];
    if (!id) return;
    event.stopImmediatePropagation();
    // Shut the menu first: a popover destroyed while open leaves the top layer
    // confused, and the chip is about to go.
    (chip.querySelector('sherpa-menu') as HTMLElement & { hide?: () => void })?.hide?.();
    this.#removeFilter(id);
  };

  #onChipClick = (event: Event): void => {
    // quick-filter-click is composed → find the originating chip on the path.
    const path = event.composedPath();

    // The SORT chip's body is a TRI-STATE toggle: asc → desc → off. "Off"
    // suspends rather than clears; the column only changes from the menu.
    const sortChip = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.dataset['id'] === 'sort',
    );
    if (sortChip?.classList.contains('organise-chip')) {
      // IMMEDIATE, for the reason given on the capture listener in onRender.
      event.stopImmediatePropagation();
      this.#cycleSort(sortChip);
      return;
    }

    /* THE GROUP CHIP'S BODY IS A TWO-STATE TOGGLE, and needs its own branch
       because the loop below looks for `.chip` and an organise chip is a
       `.organise-chip`. Without this the Group chip flipped itself off and told
       nobody, so the grid stayed grouped.
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

    // A persistent chip has ALREADY flipped itself off by the time this fires,
    // so put it back.
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
    const raw = this.dataset['sortDirection'];
    const direction = raw === 'desc' ? 'desc' : 'asc';
    /* AN EMPTY DIRECTION IS A SUSPENDED SORT — the source keeps pushing the
       remembered column, so only the direction says whether it runs.
       TRAP T-a-suspended-sort-is-one-owners-job. */
    const suspended = raw === '';

    // NO FIELD means no sort at all — off, keeping whatever pick it had.
    if (!field) {
      chip.removeAttribute('data-current');
      this.#syncSortLabel(chip);
      return;
    }

    // The RADIO follows the field either way: a suspended sort still shows
    // which column it would resume on.
    for (const radio of chip.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.checked = radio.value === field;
    }
    // A resume starts ASCENDING, so a suspended chip must not keep pointing at
    // the `desc` it was left at.
    chip.dataset['direction'] = suspended ? 'asc' : direction;
    chip.toggleAttribute('data-current', !suspended);
    this.#syncSortLabel(chip);
  }

  /**
   * Point the Group chip at whatever `data-group-field` says. The twin of
   * `#syncSortFromAttrs`; both SUSPEND on empty rather than clearing.
   *
   * TRAP T-a-chip-body-cycles-its-states — why this door emits no event.
   */
  #syncGroupFromAttrs(): void {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="group"]');
    if (!chip) return;

    const field = this.dataset['groupField'] ?? '';

    // NO FIELD means ungrouped — SUSPENDED, and the pick is KEPT, so one more
    // click brings the same grouping back without re-picking it.
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
   * TRAP T-toggle-chips-have-no-field
   */
  #emitChange(): void {
    this.emit('quick-filter-change', {
      // TRAP T-values-carries-two-shapes — the marker says outright WHICH shape
      // this is, instead of leaving a host to guess.
      scope: 'bar',
      active: this.active,
      // What is APPLIED — only the chips that are ON.
      values: this.values,
      // What is REMEMBERED — including chips toggled off.
      picked: this.pickedValues,
      // TRAP T-custom-chips-are-reported-separately — in neither list above.
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
   * TRAP T-sort-is-tri-state
   */
  /**
   * Flip grouping on or off from the chip's body.
   *
   * SUSPEND, NEVER CLEAR — the radio keeps its column, so one more click brings
   * the same grouping back. The chip has ALREADY flipped its own
   * `data-current`, so this reads the new state rather than setting it.
   *
   * TRAP T-group-chip-body-toggles-grouping.
   */
  #toggleGroup(chip: HTMLElement): void {
    /* Turning it ON with nothing ever picked would light a chip that groups
       nothing, and the host would write `data-group-field=""` straight back —
       a flicker. That is a chip with NO pick, not a suspended one. */
    if (chip.hasAttribute('data-current') && !this.#menuValue('group')) {
      chip.removeAttribute('data-current');
    }
    this.#syncGroupLabel(chip);
    // REPORTS, as every chip does — the host owns the grouping and writes
    // `data-group-field` back.
    this.emit('group-change', { field: this.groupField });
  }

  #cycleSort(chip: HTMLElement): void {
    /* ONE CYCLE, stated in `core/cycle.ts` — the same function the data grid's
       column header runs. Written separately the two DRIFTED over what their
       shared third state keeps.
       TRAP T-a-chip-body-cycles-its-states, TRAP T-one-cycle-for-one-value.

       The chip has ALREADY flipped its own `data-current`, so the live state is
       the INVERSE of what it now says. */
    const wasLive = !chip.hasAttribute('data-current');
    const column = this.#menuValue('sort') ?? '';
    /* SUSPENDED is a NULL direction, whatever `data-direction` says — that
       attribute REMEMBERS the direction, not whether it runs. */
    const held = wasLive ? (sortDirectionFrom(chip.dataset['direction']) ?? 'asc') : null;
    const next = nextSort(column, column, held);

    chip.toggleAttribute('data-current', next.direction !== null);
    // A suspended chip rewinds to `asc`, because that is where a resume starts.
    chip.dataset['direction'] = next.direction ?? 'asc';

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
   * available([...]) — the filters the Add chip offers, over the populate() set.
   *
   * TRAP T-add-menu-batches
   */
  available(defs: QuickFilterDef[]): void {
    this.#available = Array.isArray(defs) ? defs : [];
    this.#renderAvailable();
  }

  /** Stamp the Add button's menu from whatever is left to add. */
  #renderAvailable(): void {
    const add = this.$<HTMLElement>('.add-btn');
    if (!add) return;
    // Nothing left to add — disabled rather than opening an empty list.
    const any = this.#available.length > 0;
    this.toggleAttribute('data-can-add', any);
    add.toggleAttribute('disabled', !any);
    add.querySelector('sherpa-menu')?.remove();
    if (!any) return;
    this.#addMenu(add, {
      id: 'add',
      label: 'Add filter',
      // MULTI-select: adding filters is a batch job.
      select: 'multiple',
      // …and the one menu that KEEPS its Apply footer. Each tick STAMPS A CHIP,
      // so applying per tick would rebuild the run mid-selection and close the
      // list out from under the user.
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
      // ON on arrival, and REMOVABLE: a chip the user put on the bar is one
      // they may take off again.
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
   * `data-act` — a new button needs one map line, not new wiring.
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
        // RESETS rather than merely announcing: a host should not have to reach
        // into the shadow root to clear chips it did not stamp.
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
        // The button IS the trigger — there is no caret to open the list.
        this.#openAddMenu(btn);
        break;
    }
  };

  /**
   * The Add menu committed — put the chosen filters on the bar.
   *
   * Heard as `menu-change`, not `quick-filter-change`: only a CHIP re-emits its
   * menu's commit under the quick-filter name.
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
   * `aria-expanded` tracks it, which is what makes a plain <button> an
   * acceptable trigger for a popover.
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
    // TRAP T-tokens-css-never-reaches-shadow — `active` is a real Style MODE,
    // which is why THIS sheet paints it.
    if (on) btn.setAttribute('data-status', 'active');
    else btn.removeAttribute('data-status');
    btn.setAttribute('data-icon-start', on ? 'fa-solid fa-star' : 'fa-regular fa-star');
    btn.setAttribute('aria-pressed', String(on));
    this.emit('view-favorite', { favourite: on });
  }

  /**
   * Put a CUSTOM filter on the bar — one whose value is TYPED, not picked.
   *
   * TRAP T-custom-chips-are-reported-separately
   */
  addCustomFilter(spec: { id: string; label: string; value?: string | null }): void {
    const { id, label, value } = spec;
    const i = this.#filters.findIndex((f) => f.id === id);

    // No value means no filter — removed, rather than a chip reading "Name:"
    // that narrows nothing.
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
      // `customValue` is what the chip's caret reads. No `options`, so no menu.
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
   * Glyphs for the organise chips, mirroring the Figma icons page.
   *
   * TRAP T-organise-glyphs-are-named-not-inline — why `view` stays here while
   * the four shared ones live in core/icons.
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
   * The column the grid is sorted by, or null — including while the chip is
   * SUSPENDED, though it still remembers the column.
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
   * TRAP T-organise-chips-lead-the-bar — both single-select.
   */
  #renderOrganise(): void {
    const zone = this.$('.organise-zone');
    const chipTpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!zone || !chipTpl) return;

    const group = this.#organise.group ?? [];
    const sort = this.#organise.sort ?? [];
    zone.replaceChildren();
    // Written by the JS: CSS cannot see whether the zone has children, and an
    // empty zone would leave its divider rule floating.
    this.toggleAttribute('data-has-organise', group.length > 0 || sort.length > 0);

    if (group.length) {
      zone.appendChild(
        // fa-SOLID: the free Font Awesome set has no regular weight for these
        // two glyphs, so `fa-regular` rendered the missing-glyph box.
        this.#organiseChip('group', 'Group', SherpaQuickFilterToolbar.#icons.group,
          group.map((c) => ({ value: c.field, label: c.label }))),
      );
    }
    if (sort.length) {
      // The MENU picks the column; the chip BODY cycles the direction. Built in
      // the OFF state, so it opens with the sort-none glyph.
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
    // This hears the chips' quick-filter-change AND the toolbar's own (emit() is
    // composed, so it re-enters here). Act only on an organise chip's, and stop
    // it there so a host never sees a group/sort pick as a filter change.
    const path = event.composedPath();
    const chip = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('organise-chip'),
    );
    if (!chip) {
      // A FILTER menu chip committed (Apply). Its own event reports one chip's
      // values; the toolbar must re-report the WHOLE state, so swap it for the
      // toolbar-level one.
      const filterChip = path.find(
        (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('chip'),
      );
      if (filterChip) {
        event.stopImmediatePropagation();
        // Read the chip's OWN picks, not `values`: `values` reports only chips
        // already ON, so a chip currently off could never turn itself on by
        // committing — which is every date chip's first pick.
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

    // The chip shows itself as ON while it holds a choice, which is what makes
    // an applied grouping visible in the bar.
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
