/**
 * sherpa-filter-panel — the filter toolbars as a column; builds its own menus.
 *
 * A SIBLING of sherpa-quick-filter-toolbar over the same DataSource: it takes
 * the same filter definitions and emits the same `quick-filter-change`.
 * TRAP T-the-panel-is-the-toolbar-in-a-column
 *
 * Map:
 * - PanelValue — One value a field offers.
 * - PanelFilter — One field the panel draws.
 * - PanelColumn — A column Group or Sort may arrange by.
 * - PanelScope — One scope: a named group of fields, plus what its Add button offers.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { APPLIED_ABOVE, ORGANISE_ICONS } from '../../core/ui/shared-constants.js';
import type { DataAsk } from '../../core/ui/context.js';
import type { FieldFilter, HeldFilter, ScopeDescription } from '../../core/data/data-source.js';
import {
  arranges, customOf, hasOwnBody, kindOf, picksOne, type FilterKind, type OffersCustom,
} from '../../core/ui/filter-kind.js';
import { menuFor, type FilterMenuDef, type FilterMenuItem } from '../../core/ui/filter-menu.js';
import {
  FILTERS_LABEL, MenuDrill, ON, filtersMenuItems, onOffMenu, type AddedFilter,
} from '../../core/ui/filters-button.js';
import { report } from '../../core/data/report.js';
import {
  fieldState, savedReading, type FieldCondition, type FieldReading,
} from '../../core/data/filter-state.js';
// TRAP T-menu-composes-real-components — the page may not have imported these.
import '../sherpa-container/sherpa-container.js';
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-accordion/sherpa-accordion.js';
import '../sherpa-section-header/sherpa-section-header.js';
import '../sherpa-stack/sherpa-stack.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';

/** One value a field offers. */
export interface PanelValue {
  value: string;
  label?: string;
  selected?: boolean;
  /** What the value's own chip IS — a preset that carries its answer is `custom`. */
  kind?: FilterKind;
  /** A reader's OWN saved filter: its chip opens Edit filter and Delete filter. */
  editable?: boolean;
}

/** One field the panel draws. The shape a quick-filter toolbar takes. */
export interface PanelFilter extends OffersCustom {
  id: string;
  label: string;
  /** The FIELD it answers, when its id is not that field — the header's Date. */
  field?: string;
  options?: PanelValue[];
  select?: 'single' | 'multiple';
  /** The chip's leading glyph. Group and Sort carry the toolbar's own. */
  icon?: string;
  /** Offer Remove in this field's header. */
  removable?: boolean;
  /** WHAT THIS FILTER IS — see `core/ui/filter-kind.ts`. */
  kind?: FilterKind | 'values';
  /** A number filter's slider ends and field clamp. */
  min?: number;
  max?: number;
  step?: number;
  /** ISO days a DATE field may pick. */
  availableDates?: string[];
  /** Start in RANGE mode. */
  range?: boolean;
  /** WHAT IS IN FORCE now, from the data layer — the conditions and the text a
   *  reader last applied. The panel seeds its own menu from this, so it shows
   *  the answer the rows are under without asking another view.
   *  TRAP T-a-panel-builds-its-own-menus */
  state?: FieldReading;
  /** A chip with no field behind it — one question, answered yes or no.
   *  TRAP T-a-chip-with-no-field-is-a-preset */
  preset?: boolean;
  /** Draw as ONE chip with its menu, not a run. A date is the case: its menu
   *  IS a calendar, and a calendar in a 360px column is the whole panel.
   *  TRAP T-only-group-and-sort-stay-one-chip */
  asChip?: boolean;
  /** ON, with nothing picked — a preset's whole state. */
  active?: boolean;
  /** A SAVED filter's answer, given — drawn as a preset. TRAP T-a-saved-filter-is-its-readings */
  readings?: Readonly<Record<string, unknown>>;
  /** The reader's OWN saved filter. TRAP T-the-panel-saves-a-whole-scope */
  editable?: boolean;
  /** A scope ABOVE holds it now: it keeps its place here — its heading, and
   *  one line saying so — and draws no values. TRAP T-a-panel-asks-for-its-scopes */
  appliedAt?: string;
}

/** A column Group or Sort may arrange by. */
export interface PanelColumn {
  field: string;
  label: string;
}

/** One scope: a named group of fields, plus what its Add button offers. */
export interface PanelScope {
  scope: string;
  /** The CONTENT's own name. TRAP T-a-scope-is-named-for-its-content */
  label: string;
  filters?: PanelFilter[];
  /** Fields this scope may still add. */
  available?: PanelFilter[];
  /**
   * How this component ARRANGES its rows — not which rows it shows.
   *
   * They lead the scope, above the presets, and only a component scope has
   * them: "sorted by name" is a property of a table, not of a population.
   * TRAP T-organise-chips-lead-the-bar
   * TRAP T-group-and-sort-are-component-scope
   */
  group?: PanelColumn[];
  sort?: PanelColumn[];
  /** Which column each is on now, and which way the sort runs. */
  groupField?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

/** What one drawn field holds. */
interface Held {
  def: PanelFilter;
  scope: string;
  box: HTMLElement;
  values: HTMLElement;
  /** The menu the panel BUILT for this field, where it needs one. */
  menu?: HTMLElement;
}

/** One filter a scope draws, in its order: a field, Group or Sort, or a preset. */
interface ScopeFilter {
  id: string;
  label: string;
  on: boolean;
}

/** What the panel asks of a `<sherpa-menu>`. */
type MenuApi = HTMLElement & {
  rendered?: Promise<void>;
  open?: boolean;
  values?: string[];
  items?: (i: readonly FilterMenuItem[]) => void;
  hide?: () => void;
};

export class SherpaFilterPanel extends SherpaElement {
  static override css = new URL('./sherpa-filter-panel.css', import.meta.url);
  static override html = new URL('./sherpa-filter-panel.html', import.meta.url);

  /* It ASKS for its scopes (`data-scope="view data"`), and the source draws
     each whole. TRAP T-a-panel-asks-for-its-scopes */
  static override asks: DataAsk = { shape: 'scope' };

  static override props = {
    /* NOT `kind: content`. The header is a COMPOSED component with its own
       children — a slotted search among them — and writing text into it
       replaces every one. `#syncHeading` passes the attribute along instead.
       TRAP T-a-composed-child-takes-an-attribute-not-text */
    'data-heading': { type: 'string', kind: 'style' },
    'data-locked': { type: 'boolean', kind: 'style' },
    'data-min-width': { type: 'string', kind: 'style' },
    /* Set by a bound source: a change waits for its field's Apply, and which
       FIELDS have one waiting. TRAP T-apply-and-discard-wait-for-a-change */
    'data-remote': { type: 'boolean', kind: 'style' },
    'data-pending': { type: 'string', kind: 'style' },
  } as const;

  static override observed = [
    'data-heading', 'open',
    // The host saves filters. TRAP T-the-panel-saves-a-whole-scope
    'data-saveable',
  ];

  /** Every drawn field, by `${scope}:${id}`. */
  #held = new Map<string, Held>();
  /** What each field last said to — or was told by — the source, as JSON, so an
   *  echo is not reported again. */
  #said = new Map<string, string>();
  /** The scopes as last given. */
  #scopes: PanelScope[] = [];
  /** Each scope's Filters list: the removable fields it holds, then what it may add. */
  #lists = new Map<string, { held: PanelFilter[]; offers: PanelFilter[] }>();
  /** The scopes a reader SHUT, kept across a redraw. TRAP T-a-shut-scope-folds-like-a-bar */
  #shut = new Set<string>();
  /** A hidden filter's rows, moved into its scope's Filters menu. TRAP T-drill-moves-not-clones */
  #drill = new MenuDrill();
  /** The menu the panel built for a drill, and the field it answers. */
  #built: { menu: HTMLElement; held: Held; chip?: HTMLElement } | null = null;

  override onRender(): void {
    this.$('.to-toolbars')?.addEventListener('button-click', this.#onClose);
    this.$('.reset-all')?.addEventListener('button-click', this.#onResetAll);
    this.$('.search')?.addEventListener('input', this.#onSearch);
    // ONE listener for every drawn control — a field added later needs no wiring.
    this.$('.scopes')?.addEventListener('button-click', this.#onAction);
    this.$('.scopes')?.addEventListener('change', this.#onConditionalSwitch);
    this.$('.scopes')?.addEventListener('quick-filter-click', this.#onValueClick);
    this.$('.scopes')?.addEventListener('menu-change', this.#onAddCommit);
    this.$('.scopes')?.addEventListener('menu-select', this.#onSavedAction);
    // Rows and bodies change their answer without a chip click.
    for (const type of ['condition-change', 'input', 'change', 'menu-change']) {
      this.$('.scopes')?.addEventListener(type, this.#onEdited);
    }
    // A SHUT scope's Filters menu leads with what it hides. TRAP T-a-shut-scope-folds-like-a-bar
    for (const type of ['accordion-open', 'accordion-close']) {
      this.$('.scopes')?.addEventListener(type, this.#onScopeToggle);
    }
    // CLICK, not hover: a passing pointer would drill the list out from under it.
    this.$('.scopes')?.addEventListener('menu-drill', this.#onMenuDrill);
    this.$('.scopes')?.addEventListener('menu-back', this.#onDrillBack);
    this.$('.scopes')?.addEventListener('menu-close', this.#onDrillBack);
    /* THE CHIP says WHAT changed; only this panel knows WHICH SCOPE it belongs
       to, so it annotates and passes it on rather than working the
       arrangement out again. TRAP T-a-chip-knows-what-kind-it-is */
    for (const type of ['group-change', 'sort-change']) {
      this.$('.scopes')?.addEventListener(type, this.#onArrange);
    }
    this.#syncHeading();
    if (this.#scopes.length) this.#draw();
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncHeading();
    else if (name === 'open') this.#enforceWidth();
    else if (name === 'data-saveable') this.#syncSaveable();
    else if (name === 'data-pending' || name === 'data-remote') this.#syncPending();
  }

  override onConnect(): void {
    this.#media()?.addEventListener('change', this.#enforceWidth);
    this.#enforceWidth();
  }

  /* ── The public API ───────────────────────────────────────────────── */

  /** populate([{ scope, label, filters, available }]). */
  protected override renderData(data: unknown): void {
    this.#scopes = Array.isArray(data) ? (data as PanelScope[]) : [];
    this.#draw();
  }

  /** What every field holds now, by scope then field id. */
  get values(): Record<string, Record<string, string[]>> {
    const out: Record<string, Record<string, string[]>> = {};
    for (const [, held] of this.#held) {
      // GROUP and SORT arrange rows; they are not part of WHICH rows.
      if (held.def.id === 'group' || held.def.id === 'sort') continue;
      (out[held.scope] ??= {})[held.def.id] = this.#picked(held);
    }
    return out;
  }

  /**
   * WHAT THE READER DID, per scope and field — picked values AND conditions.
   *
   * `values` is ticked chips only, so a field answered by a CONDITION reported
   * nothing and Apply committed nothing. The panel used to fix that by ticking
   * the BAR's chips and asking it to re-report, which is a panel that knows a
   * toolbar exists. It reports its own whole answer instead, and the data
   * layer decides what it means.
   * TRAP T-the-panel-reports-its-own-reading
   */
  get readings(): Record<string, Record<string, FieldReading>> {
    const out: Record<string, Record<string, FieldReading>> = {};
    for (const [, held] of this.#held) {
      // GROUP and SORT arrange rows; they are not part of WHICH rows.
      if (arranges(kindOf(held.def))) continue;
      (out[held.scope] ??= {})[held.def.id] = this.#readingOf(held);
    }
    return out;
  }

  /** One field's whole answer: its picks, its condition rows, its typed text. */
  #readingOf(held: Held): FieldReading {
    const menu = held.menu as (HTMLElement & {
      conditions?: FieldCondition[]; conditionValue?: string }) | undefined;
    const conditions = menu?.conditions ?? [];
    const reading: FieldReading = { picked: this.#picked(held) };
    if (conditions.length) reading.conditions = conditions;
    const typed = (menu?.conditionValue ?? '').trim();
    if (typed) {
      reading.text = typed;
      // …with its OPERATOR, or "contains an" reads as "is an".
      if (menu?.dataset['op']) reading.op = menu.dataset['op'] as NonNullable<FieldReading['op']>;
    }
    return reading;
  }

  /**
   * setFieldReading(id, reading) — steer ONE field with a whole reading: what
   * another control set while the panel shows. SILENT, like every steer, and
   * it is that field's last Apply now, so Discard keeps it. A field drawn as
   * one chip — Group, Sort, a date — is left alone.
   * TRAP T-an-open-panel-follows-the-data-layer
   */
  setFieldReading(id: string, reading: FieldReading): void {
    for (const [key, held] of this.#held) {
      if (held.def.id !== id || this.#oneChip(held)) continue;
      const rows = reading.conditions ?? [];
      if (rows.length) {
        this.#setCustom(held, true);
        const menu = held.menu as (HTMLElement & { conditions?: readonly FieldCondition[] }) | undefined;
        if (menu) menu.conditions = rows;
      } else {
        // NO ROWS: the picks, and the mode left as the reader set it.
        const want = new Set((reading.picked ?? []).map(String));
        for (const one of held.values.querySelectorAll<HTMLElement>('.value')) {
          if (this.#heldOfChip(one) === held) {
            one.toggleAttribute('data-current', want.has(one.dataset['value'] ?? ''));
          }
        }
      }
      this.#said.set(key, JSON.stringify(this.#readingOf(held)));
      this.#syncAnswered(held);
      return;
    }
  }

  /**
   * drawReading(field, reading, scope) — a bound source tells the OPEN panel one
   * field's answer, in the scope that holds it. Shut, it draws nothing: it is
   * refilled when it opens. TRAP T-an-open-panel-follows-the-data-layer
   */
  drawReading(field: string, reading: FieldReading, scope: string): void {
    if (!this.hasAttribute('open')) return;
    if (this.#held.has(`${scope}:${field}`)) this.setFieldReading(field, reading);
  }

  /** Is it showing? The `open` attribute, as on every surface that opens. */
  get open(): boolean {
    return this.hasAttribute('open');
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  /** Show the panel, unless the window is too narrow.
   *  TRAP T-the-panel-is-desktop-only */
  show(): void {
    if (!this.#wideEnough()) return;
    this.toggleAttribute('open', true);
  }

  /** EVERY close reports, and says why. The width path called this directly
   *  while only the header button emitted, so a narrow window left the panel
   *  gone and the host still in panel mode — no toolbars, no panel.
   *  TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
  hide(reason: 'reader' | 'width' | 'page' = 'reader'): void {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.#lastClose = reason;
    this.emit('filter-panel-close', { reason });
  }

  override onDisconnect(): void {
    this.#media()?.removeEventListener('change', this.#enforceWidth);
  }

  /** `hide()`, in the spelling every surface keeps. */
  close(reason: 'reader' | 'width' | 'page' = 'reader'): void {
    this.hide(reason);
  }

  toggle(): void {
    if (this.hasAttribute('open')) this.hide();
    else this.show();
  }

  /* ── Drawing ──────────────────────────────────────────────────────── */

  /** Pass the heading to the panel's header component. */
  #syncHeading(): void {
    this.$('.head')?.setAttribute('data-heading', this.dataset['heading'] ?? 'Filters');
  }

  /** Redraw every scope from `#scopes`. */
  #draw(): void {
    const region = this.$('.scopes');
    if (!region) return;
    this.#held.clear();
    region.replaceChildren();

    /* ONE FIELD, ONE SCOPE. A field in two scopes would draw twice, and a
       reader cannot tell which of the two is in force. The FIRST scope wins:
       a view filter sets the population the ones below narrow within.
       TRAP T-a-panel-adds-through-the-bar-that-owns-the-list */
    const taken = new Set<string>();

    for (const scope of this.#scopes) {
      const box = this.clone('template.scope-tpl');
      if (!box) continue;
      box.setAttribute('data-heading', scope.label);
      box.setAttribute('data-scope', scope.scope);
      if (this.#shut.has(scope.scope)) box.removeAttribute('open');

      const mine = (scope.filters ?? []).filter((f) => {
        // One HELD ABOVE keeps its place here, and says so. TRAP T-a-panel-asks-for-its-scopes
        if (f.appliedAt) return true;
        if (taken.has(f.id)) return false;
        taken.add(f.id);
        return true;
      });

      // PRESETS lead: one tap each, and the fields below them are the work.
      const presets = mine.filter((f) => f.preset);
      const fields = mine.filter((f) => !f.preset);

      /* ORGANISE leads everything: Group and Sort in ONE section, because
         they answer the same question — how the rows are arranged — and two
         headers for two chips is a header per control.
         TRAP T-organise-chips-lead-the-bar */
      const organised = ([['group', scope.group], ['sort', scope.sort]] as const)
        .filter(([, cols]) => cols?.length);
      if (organised.length) {
        const section = this.#drawSection('organise', 'Organise');
        for (const [kind, cols] of organised) {
          const on = kind === 'group' ? scope.groupField : scope.sortField;
          const chip = this.#fieldChip({
            id: kind, label: kind === 'group' ? 'Group by' : 'Sort by',
            select: 'single',
            /* The SAME glyphs the toolbar draws — one constant, so the two
               views of one control cannot drift. A Sort opens on `sort-none`
               and its icon follows the direction from there. */
            icon: kind === 'group' ? ORGANISE_ICONS.group : ORGANISE_ICONS.sortNone,
            options: (cols ?? []).map((c) => ({
              value: c.field, label: c.label, selected: c.field === on,
            })),
          }, scope.scope, section.box, section.values);
          if (chip) {
            /* SEED THE CYCLE and let the chip draw itself: `data-direction`
               remembers the way, `data-current` (from `selected`, above) says
               whether it runs. Only a real direction is written — the chip
               answers `asc` for a chip that is on with none set, and writing
               one here would be a second owner.
               TRAP T-a-chip-knows-what-kind-it-is */
            if (kind === 'sort' && scope.sortDirection) {
              chip.dataset['direction'] = scope.sortDirection;
            }
            section.values.append(chip);
          }
        }
        box.append(section.box);
      }

      if (presets.length) {
        box.append(this.#drawField({
          id: 'presets', label: 'Presets', options: presets.map((p) => ({
            value: p.id, label: p.label, selected: !!p.active,
            // A preset that carries its answer wears fx. TRAP T-a-saved-filter-is-its-readings
            ...(kindOf(p) === 'custom' ? { kind: 'custom' as const } : {}),
            ...(p.editable ? { editable: true } : {}),
          })),
          select: 'multiple',
        }, scope.scope, true)!);
      }
      for (const def of fields) {
        const drawn = def.appliedAt ? this.#drawApplied(def) : this.#drawField(def, scope.scope, false);
        if (drawn) box.append(drawn);
      }

      /* THE ADD MENU IS THE LIST. Ticked means held, unticked means gone — so
         a reader adds and removes in one place instead of hunting a per-field
         bin. Only a REMOVABLE field is listed: the rest are the scope's own
         and a tick that cannot be cleared is a lie.
         TRAP T-the-add-menu-is-the-whole-list */
      const offers = scope.available ?? [];
      /* PRESETS TOO, each as its own row. A preset is a filter a reader turns
         on; that it answers yes/no rather than with values changes nothing
         about whether the scope holds it. */
      const removable = [...presets, ...fields].filter((f) => f.removable);
      /* WHAT THE MENU WAS TOLD, kept. `#held` knows a preset only as the
         `presets` SECTION it was drawn in, so it cannot say which ones are
         held. TRAP T-the-add-menu-is-the-whole-list */
      this.#lists.set(scope.scope, { held: removable, offers });
      this.#fillFilters(box);

      /* An empty scope SAYS SO. Absent, it reads as a bug rather than as an
         answer — and a scope can legitimately be empty. */
      if (!presets.length && !fields.length) {
        const empty = this.clone('template.empty-tpl');
        if (empty) box.append(empty);
      }

      region.append(box);
    }
    /* THE MENUS ARE IN THE PAGE NOW. A detached `<sherpa-menu>` has not
       upgraded, so rows stamped before this are lost.
       TRAP T-custom-element-upgrade */
    this.#syncAllAnswered();
    this.#syncPending();
  }

  /** A field a HIGHER scope holds: its heading, and the line a chip's tooltip
   *  says — no values, nothing to answer here. TRAP T-an-inactive-chip-says-where-its-filter-went */
  #drawApplied(def: PanelFilter): HTMLElement {
    const { box } = this.#drawSection(def.id, def.label);
    box.setAttribute('data-applied-at', def.appliedAt ?? '');
    const note = this.clone('template.applied-tpl');
    if (note) {
      note.textContent = APPLIED_ABOVE;
      box.querySelector('.field-head')?.append(note);
    }
    return box;
  }

  /**
   * The source draws each scope WHOLE — what it holds and answers, what it may
   * add, how its rows are arranged. A saved filter is one question answered
   * yes or no; a date is one chip, its menu a calendar.
   * TRAP T-a-panel-asks-for-its-scopes · TRAP T-a-chip-with-no-field-is-a-preset
   */
  drawScopes(scopes: readonly ScopeDescription[]): Promise<void> {
    const asFilter = (f: FieldFilter | HeldFilter): PanelFilter => {
      const picked = new Set(('state' in f ? f.state?.picked ?? [] : []).map(String));
      return {
        ...f,
        ...(f.readings ? { preset: true } : {}),
        ...(f.kind === 'date' ? { asChip: true } : {}),
        ...(f.options ? { options: f.options.map((o) => ({ ...o, selected: picked.has(o.value) })) } : {}),
      };
    };
    return this.populate(scopes.map((s) => ({
      ...s, filters: s.filters.map(asFilter), available: s.available.map(asFilter),
    })));
  }

  /**
   * An empty SECTION — a header and a run — for things that are not one field.
   * `Organise` holds Group and Sort; `Presets` holds the toggles.
   */
  #drawSection(id: string, label: string): { box: HTMLElement; values: HTMLElement } {
    const box = this.clone('template.field-tpl')!;
    box.setAttribute('data-field', id);
    const title = box.querySelector('.field-title');
    if (title) title.textContent = label;
    /* A section is not a field: nothing here to clear, remove or condition.
       Group and Sort ARRANGE rows; they never filter. Will, 2026-09-26. */
    box.querySelector('.field-acts')?.remove();
    box.querySelector('.field-custom')?.remove();
    return { box, values: box.querySelector('.field-values') as HTMLElement };
  }

  /** ONE value chip. The only place this panel makes a `<sherpa-quick-filter>`. */
  #valueChip(value: string, label: string, opts: {
    icon?: string; current?: boolean; kind?: FilterKind; column?: string;
  } = {}): HTMLElement | null {
    const proto = this.$<HTMLTemplateElement>('template.value-tpl');
    const one = proto?.content.firstElementChild?.cloneNode(true) as HTMLElement | null;
    if (!one) return null;
    one.dataset['value'] = value;
    one.setAttribute('data-label', label);
    /* The SEARCH reads this, not `data-label`: a chip rewrites its own label
       to "Field: Value" the moment one value is picked, so a picked chip
       stopped matching its own name. TRAP T-a-chip-rewrites-its-own-label */
    one.dataset['search'] = label.toLowerCase();
    if (opts.icon) one.setAttribute('data-icon-start', opts.icon);
    if (opts.kind) one.dataset['kind'] = opts.kind;
    if (opts.column) one.dataset['column'] = opts.column;
    one.toggleAttribute('data-current', !!opts.current);
    return one;
  }

  /**
   * ONE chip standing for a WHOLE FIELD, with that field's own menu — an
   * arrangement, or a date whose calendar cannot be a run.
   *
   * `box` and `values` are where the field was drawn: its own field box, or
   * the shared Organise section. TRAP T-a-chip-knows-what-kind-it-is
   */
  #fieldChip(def: PanelFilter, scope: string,
    box: HTMLElement, values: HTMLElement): HTMLElement | null {
    const kind = kindOf(def);
    const on = (def.options ?? []).find((o) => o.selected)?.value;
    const one = this.#valueChip(def.id, def.label, {
      ...(def.icon ? { icon: def.icon } : {}),
      current: !!on,
      ...(arranges(kind) ? { kind } : {}),
      /* NAME THE COLUMN. The chip's own menu stamps its rows a tick later, so
         this is what it reads until then. */
      ...(arranges(kind) && on ? { column: String(on) } : {}),
    });
    if (!one) return null;
    const held: Held = { def, scope, box, values };
    this.#giveMenu(held, one);
    this.#held.set(`${scope}:${def.id}`, held);
    return one;
  }

  /** One field: its header, its actions, and its run of value chips. */
  #drawField(def: PanelFilter, scope: string, isPresets: boolean): HTMLElement | null {
    const options = def.options ?? [];
    /* A field with NO VALUES and NO BODY has nothing to draw at all — so it
       SAYS SO rather than leaving a gap in the scope. A preset is the one
       legitimate case, and it never reaches here.
       TRAP T-the-panel-is-the-toolbar-in-a-column
       TRAP T-a-broken-assumption-reports */
    if (!options.length && !hasOwnBody(kindOf(def))) {
      report({
        code: 'undrawable-filter',
        message: 'This filter has no values and no body of its own, so it was skipped.',
        at: { scope, id: def.id, kind: kindOf(def) },
      });
      return null;
    }

    /* ONLY GROUP AND SORT stay as one chip with their own menu. They are not
       filters — they say HOW the rows are arranged — so they read as the two
       controls a toolbar already shows.
       Every other field, single-select included, EXPLODES into a run: the
       whole point of the panel is that a reader sees the values without
       opening anything. TRAP T-only-group-and-sort-stay-one-chip
       WHAT IT IS, asked once. TRAP T-a-chip-knows-what-kind-it-is */
    const kind = kindOf(def);
    const single = picksOne(kind);

    const box = this.clone('template.field-tpl');
    if (!box) return null;
    const key = `${scope}:${def.id}`;
    box.setAttribute('data-field', def.id);
    box.setAttribute('data-scope', scope);
    // A PRESETS section has no field to clear or remove.
    const organise = arranges(kind);
    // Set BEFORE the chip path returns, or it never lands.
    box.toggleAttribute('data-single', single && !isPresets);
    box.toggleAttribute('data-chip', organise || !!def.asChip);
    box.toggleAttribute('data-clearable', !isPresets && !organise);
    box.toggleAttribute('data-removable', !isPresets && !organise && !!def.removable);
    /* A switch only where there is somewhere to switch TO: a conditions-only
       field has no list behind it, as its menu says too. Will, 2026-09-26.
       TRAP T-a-filter-answers-by-values-conditions-or-both */
    box.toggleAttribute('data-custom-ok', !isPresets && !organise && customOf(def) === true);

    // What this field does not offer is not drawn.
    if (!box.hasAttribute('data-custom-ok')) box.querySelector('.field-custom')?.remove();
    if (!box.hasAttribute('data-clearable')) box.querySelector('.field-clear')?.remove();

    const head = box.querySelector('.field-head');
    const title = box.querySelector('.field-title');
    if (title) title.textContent = def.label;
    const name = def.label;
    head?.querySelector('.field-clear')?.setAttribute('aria-label', `Clear ${name}`);
    box.querySelector('.field-custom-switch')
      ?.setAttribute('aria-label', `Conditional ${name}`);

    const values = box.querySelector('.field-values') as HTMLElement | null;

    /* ONE CHIP, carrying its own menu — group, sort, and a date whose
       calendar cannot be a run. TRAP T-only-group-and-sort-stay-one-chip */
    if ((organise || def.asChip) && values) {
      const one = this.#fieldChip(def, scope, box, values);
      if (one) values.append(one);
      return box;
    }

    for (const option of values ? options : []) {
      const one = this.#valueChip(option.value, option.label ?? option.value,
        { current: !!option.selected, ...(option.kind ? { kind: option.kind } : {}) });
      if (one && option.editable) this.#addSavedMenu(one);
      if (one) values!.append(one);
    }

    const held: Held = { def, scope, box, values: values ?? box };

    /* A field ANSWERED BY ITS MENU — a number, a range, a condition-only field
       — draws that menu INLINE, in its own body. */
    const body = box.querySelector('.field-body');
    if (body && !options.length && hasOwnBody(kind)) {
      box.setAttribute('data-body', '');
      this.#giveMenu(held, body as HTMLElement, true);
    }

    this.#held.set(key, held);
    /* A field ALREADY answered by conditions opens ON them — custom mode, its
       rows. Drawn as plain chips, the refill after an Add hid Owner's rows,
       and the next Apply reported it unanswered: adding Email reset Owner.
       TRAP T-a-conditioned-field-opens-on-its-rows */
    if (box.hasAttribute('data-custom-ok') && (def.state?.conditions ?? []).length) {
      this.#setCustom(held, true);
    }
    return box;
  }

  /**
   * BUILD this field's menu and hang it on `host`.
   *
   * The panel used to BORROW the toolbar's, which broke every listener bound
   * on the original chip and left that chip with no menu at all while the
   * panel was open. It builds its own from the same `menuFor`, so the two are
   * the same control without being the same element.
   * TRAP T-a-panel-builds-its-own-menus
   */
  #giveMenu(held: Held, host: HTMLElement, inline = false, force = false): void {
    const def = held.def;
    const kind = kindOf(def);
    // A run of chips answers it already; only its OWN body needs a menu.
    if (!force) {
      if (!inline && !arranges(kind) && !def.asChip) return;
      if (inline && !hasOwnBody(kind)) return;
    }

    // TRAP T-an-inline-menu-is-the-same-menu — the same card, drawn in the flow.
    const { menu, items } = menuFor(def, { inline });
    if (inline) {
      menu.removeAttribute('slot');
    } else {
      /* A FILTER chip's menu in the panel COMMITS — everything else here waits
         for the panel's own Apply. An ARRANGEMENT does not: group and sort
         apply as they are picked, on a bar and in a panel alike.
         TRAP T-a-chip-menu-in-the-panel-commits */
      if (!arranges(kind)) menu.setAttribute('data-commit', '');
      host.setAttribute('data-menu', '');
    }
    held.menu = menu;
    host.append(menu);
    this.#fill(menu, items, def.state);
  }

  /**
   * A menu's rows NOW — `menuFor` made it, so it has upgraded, and it stamps
   * them when it renders — and, once it has DRAWN, the answer in force: rows
   * set into nothing were dropped, and Owner came back a blank `equals`.
   * TRAP T-custom-element-upgrade · TRAP T-a-conditioned-field-opens-on-its-rows
   */
  #fill(menu: HTMLElement, items: FilterMenuItem[], state: FieldReading | undefined): void {
    const api = menu as HTMLElement & {
      items?: (i: readonly FilterMenuItem[]) => void;
      conditions?: readonly FieldCondition[];
      conditionValue?: string;
      rendered?: Promise<void>;
    };
    if (items.length) api.items?.(items);
    if (!state?.conditions?.length && !state?.text) return;
    this.#answering.push(Promise.resolve(api.rendered).then(() => {
      if (state.conditions?.length) api.conditions = state.conditions;
      if (state.text) api.conditionValue = state.text;
    }));
    if (this.#answering.length === 1) queueMicrotask(() => this.#settleAnswers());
  }

  /** Answers being put back into menus that have not drawn yet. */
  #answering: Promise<void>[] = [];

  /** …then what "applied" means is read AGAIN, once they have all filled — a
   *  rebuilt row reads empty for a tick. TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
  #settleAnswers(): void {
    const answers = this.#answering;
    this.#answering = [];
    void Promise.all(answers)
      .then(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
      .then(() => {
        this.#syncAllAnswered();
        // What the fields now say is what the source drew: no echo to report.
        for (const [key, held] of this.#held) this.#said.set(key, JSON.stringify(this.#readingOf(held)));
      });
  }

  /**
   * The scope's Filters menu — the toolbar's, row for row. A SHUT scope leads
   * it with every filter it hides, as a narrow bar leads with its folded chips.
   * TRAP T-a-shut-scope-folds-like-a-bar
   */
  #fillFilters(box: HTMLElement): void {
    const btn = box.querySelector<HTMLElement>('.scope-add');
    const scope = box.dataset['scope'] ?? '';
    const list = this.#lists.get(scope);
    if (!btn || !list) return;
    if (this.#drill.menu && btn.contains(this.#drill.menu)) this.#drillOut();

    const hidden = box.hasAttribute('open') ? [] : this.#hiddenOf(scope);
    const any = list.held.length + list.offers.length + hidden.length > 0;
    /* ONE section for what the scope holds. SHUT, every filter it draws is
       hidden, and each row opens its child menu. TRAP T-a-shut-scope-folds-like-a-bar */
    const removable = new Set(list.held.map((f) => f.id));
    const listed = new Set(hidden.map((f) => f.id));
    const added: AddedFilter[] = [
      ...hidden.map((f) => ({
        id: f.id, label: f.label, removable: removable.has(f.id), hidden: true, count: this.#countOf(scope, f.id),
      })),
      ...list.held.filter((f) => !listed.has(f.id))
        .map((f) => ({ id: f.id, label: f.label, removable: true, hidden: false })),
    ];
    box.toggleAttribute('data-can-add', any);
    if (hidden.length) btn.dataset['badge'] = String(hidden.length);
    else btn.removeAttribute('data-badge');
    btn.querySelector('sherpa-menu')?.remove();
    if (!any) return;

    const { menu, items } = menuFor({
      id: 'add', label: FILTERS_LABEL, select: 'multiple', commit: true, selectAll: false,
      options: filtersMenuItems(added, list.offers),
    });
    btn.append(menu);
    (menu as MenuApi).items?.(items);
    this.#syncScopeFilters(scope);
  }

  /** What a SHUT scope hides, in the order it draws them. Each preset is its own. */
  #hiddenOf(scope: string): ScopeFilter[] {
    const out: ScopeFilter[] = [];
    for (const [, held] of this.#held) {
      if (held.scope !== scope) continue;
      if (held.def.id === 'presets') {
        for (const o of held.def.options ?? []) {
          out.push({
            id: o.value, label: o.label ?? o.value,
            on: !!this.#chipIn(held, o.value)?.hasAttribute('data-current'),
          });
        }
        continue;
      }
      out.push({ id: held.def.id, label: held.def.label, on: this.#isOn(held) });
    }
    return out;
  }

  /** How many picks a hidden filter holds, for its row's badge. A preset holds none. */
  #countOf(scope: string, id: string): number {
    const held = this.#held.get(`${scope}:${id}`);
    if (!held) return 0;
    return this.#oneChip(held) ? ((held.menu as MenuApi | undefined)?.values?.length ?? 0)
      : this.#picked(held).length;
  }

  /** A field is ON when it answers — for one drawn as a single chip, when that chip does. */
  #isOn(held: Held): boolean {
    const chip = this.#oneChip(held);
    return chip ? chip.hasAttribute('data-current') : held.box.hasAttribute('data-answered');
  }

  /** The ONE chip a whole field is drawn as — Group, Sort, a date — or null for a run. */
  #oneChip(held: Held): HTMLElement | null {
    if (!arranges(kindOf(held.def)) && !held.def.asChip) return null;
    return this.#chipIn(held, held.def.id);
  }

  /** The chip for one value in a field's run. */
  #chipIn(held: Held, value: string): HTMLElement | null {
    return held.values.querySelector<HTMLElement>(`.value[data-value="${CSS.escape(value)}"]`);
  }

  /**
   * The Filters button is ON only while a filter its SHUT scope hides is, and
   * each door counts its field's picks. An open scope speaks for itself.
   * TRAP T-the-filters-button-is-a-door-not-a-filter
   */
  #syncScopeFilters(scope: string): void {
    const box = this.$<HTMLElement>(`.scope[data-scope="${CSS.escape(scope)}"]`)
      ?? [...this.#held.values()].find((h) => h.scope === scope)?.box.closest<HTMLElement>('.scope');
    const btn = box?.querySelector<HTMLElement>('.scope-add');
    if (!box || !btn) return;
    const shut = !box.hasAttribute('open');
    if (shut && this.#hiddenOf(scope).some((f) => f.on)) btn.dataset['status'] = 'active';
    else btn.removeAttribute('data-status');
    const menu = btn.querySelector<HTMLElement & { setCount?(value: string, count: number): void }>('sherpa-menu');
    if (!menu || !shut) return;
    for (const f of this.#hiddenOf(scope)) menu.setCount?.(f.id, this.#countOf(scope, f.id));
  }

  /** A scope opened or shut: its Filters menu is rebuilt for what it now hides. */
  #onScopeToggle = (event: Event): void => {
    const box = event.target;
    if (!(box instanceof HTMLElement) || !box.classList.contains('scope')) return;
    const scope = box.dataset['scope'] ?? '';
    if (box.hasAttribute('open')) this.#shut.delete(scope);
    else this.#shut.add(scope);
    this.#fillFilters(box);
  };

  /** A hidden filter's row asked for its child menu. TRAP T-a-row-opens-its-child-menu */
  #onMenuDrill = (event: Event): void => {
    const box = this.pathFind(event, '.scope');
    const menu = this.pathFind(event, '.scope-add')?.querySelector<HTMLElement>('sherpa-menu');
    const id = String((event as CustomEvent).detail?.value ?? '');
    if (!box || !menu || !id) return;
    event.stopPropagation();
    const scope = box.dataset['scope'] ?? '';
    const held = this.#held.get(`${scope}:${id}`);
    if (held) {
      void this.#openDoor(held, box, menu, held.def.label);
      return;
    }
    // A PRESET is an on/off chip: its child menu is one row, "On".
    const presets = this.#held.get(`${scope}:presets`);
    const chip = presets ? this.#chipIn(presets, id) : null;
    if (presets && chip) void this.#openOnOff(presets, chip, menu);
  };

  /** Drill into an on/off chip's child menu: one row, "On", ticked as the chip is. */
  async #openOnOff(held: Held, chip: HTMLElement, menu: HTMLElement): Promise<void> {
    this.#drillOut();
    const value = chip.dataset['value'] ?? '';
    const label = (held.def.options ?? []).find((o) => o.value === value)?.label ?? value;
    const built = onOffMenu(label, chip.hasAttribute('data-current'));
    held.box.append(built.menu);
    this.#built = { menu: built.menu, held, chip };
    await (built.menu as MenuApi).rendered;
    (built.menu as MenuApi).items?.(built.items);
    // It may have shut, or another row taken the drill, while it drew.
    if (!(menu as MenuApi).open || this.#built?.menu !== built.menu) {
      if (this.#built?.menu === built.menu) this.#dropBuilt();
      return;
    }
    this.#drill.into(menu, built.menu, label);
  }

  /**
   * DRILL IN, as the toolbar does: into a single chip's own menu, or into one
   * built for a run of values. A field answered by a body of its own — a
   * number, a condition — is drawn in the scope, so the door opens the scope.
   */
  async #openDoor(held: Held, box: HTMLElement, menu: HTMLElement, label: string): Promise<void> {
    this.#drillOut();
    const chip = !!this.#oneChip(held);
    const run = !chip && !held.box.hasAttribute('data-custom') && !held.box.hasAttribute('data-body')
      && (held.def.options?.length ?? 0) > 0;
    const home = chip ? held.menu ?? null : run ? await this.#buildDrillMenu(held) : null;
    // A second door, opened while these rows were built, has the drill now.
    if (run && this.#built?.menu !== home) return;
    if (!home?.children.length) {
      this.#dropBuilt();
      (menu as MenuApi).hide?.();
      (box as HTMLElement & { open: boolean }).open = true;
      held.box.scrollIntoView({ block: 'nearest' });
      return;
    }
    // It may have shut while the rows were built.
    if (!(menu as MenuApi).open) {
      this.#dropBuilt();
      return;
    }
    this.#drill.into(menu, home, label);
  }

  /**
   * A run of values has no menu — its values ARE its chips — so the drill gets
   * one built from the same def, ticked as the chips are. TRAP T-one-field-one-filter-menu
   */
  async #buildDrillMenu(held: Held): Promise<HTMLElement> {
    const picked = new Set(this.#picked(held));
    const def: FilterMenuDef = {
      id: held.def.id,
      label: held.def.label,
      ...(held.def.select ? { select: held.def.select } : {}),
      options: (held.def.options ?? []).map((o) => ({
        value: o.value, label: o.label ?? o.value, selected: picked.has(o.value),
      })),
    };
    const { menu, items } = menuFor(def);
    // A filter's menu in the panel COMMITS. TRAP T-a-chip-menu-in-the-panel-commits
    menu.setAttribute('data-commit', '');
    held.box.append(menu);
    this.#built = { menu, held };
    await (menu as MenuApi).rendered;
    (menu as MenuApi).items?.(items);
    return menu;
  }

  /**
   * A DRILLED pick. The rows go HOME first, so the filter reads its own; a chip
   * then hears it as its own menu's, and a run is ticked from it.
   * TRAP T-a-drilled-pick-goes-home-first
   */
  #onDrilled(event: Event): void {
    const values = ((event as CustomEvent).detail?.values ?? []) as string[];
    const home = this.#drill.home;
    const menu = this.#drill.menu as MenuApi | null;
    const built = this.#built;
    /* AN ON/OFF chip's "On" row: it flips the chip, which waits for the
       panel's Apply as a press on it would, and the drill stays open. */
    if (built?.chip && home === built.menu) {
      built.chip.toggleAttribute('data-current', values.includes(ON));
      this.#syncAnswered(built.held);
      return;
    }
    this.#drill.out();
    if (built && home === built.menu) {
      const want = new Set(values);
      for (const one of built.held.values.querySelectorAll<HTMLElement>('.value')) {
        if (this.#heldOfChip(one) !== built.held) continue;
        one.toggleAttribute('data-current', want.has(one.dataset['value'] ?? ''));
      }
      this.#dropBuilt();
      this.#syncAnswered(built.held);
      // Its Apply is the field's change. TRAP T-a-chip-menu-apply-is-the-panels-apply
      this.#report(built.held);
    } else {
      home?.dispatchEvent(new CustomEvent('menu-change', {
        bubbles: true, composed: true, detail: { values },
      }));
    }
    menu?.hide?.();
  }

  /** Back, or the Filters menu shut: put the drilled rows home. */
  #onDrillBack = (event: Event): void => {
    if (event.target === this.#drill.menu) this.#drillOut();
  };

  /** Put a drilled filter's rows home, and drop a menu built for the drill. */
  #drillOut(): void {
    this.#drill.out();
    this.#dropBuilt();
  }

  /** Remove the menu built for a drill. */
  #dropBuilt(): void {
    this.#built?.menu.remove();
    this.#built = null;
  }

  /* ── Reading ──────────────────────────────────────────────────────── */

  /** The values ticked in one field's run. */
  #picked(held: Held): string[] {
    return [...held.values.querySelectorAll<HTMLElement>('.value[data-current]')]
      .map((c) => c.dataset['value'] ?? '')
      .filter(Boolean);
  }

  /**
   * REMOTE: each changed field shows its own Apply and Discard. The source
   * says which, by FIELD. TRAP T-apply-and-discard-wait-for-a-change
   */
  #syncPending(): void {
    const remote = this.hasAttribute('data-remote');
    const pending = new Set((this.dataset['pending'] ?? '').split(' ').filter(Boolean));
    for (const held of this.#held.values()) {
      held.box.toggleAttribute('data-pending', remote && pending.has(held.def.field ?? held.def.id));
    }
  }

  /** A body or a condition row changed: report its field, once its rows have settled. */
  #onEdited = (event: Event): void => {
    const held = event.target instanceof HTMLElement ? this.#fieldOf(event.target) : undefined;
    if (held) this.#edited.add(held);
    if (this.#editFrame != null) return;
    this.#editFrame = requestAnimationFrame(() => {
      this.#editFrame = null;
      const done = [...this.#edited];
      this.#edited.clear();
      for (const one of done) this.#report(one);
    });
  };

  /** The fields edited since the last frame. */
  #edited = new Set<Held>();

  /** The pending re-read after an edit. */
  #editFrame: number | null = null;

  /* ── Acting ───────────────────────────────────────────────────────── */

  /** A single-select field unticks its siblings. */
  #onValueClick = (event: Event): void => {
    const one = this.pathFind(event, '.value');
    if (!one) return;
    const held = this.#heldOfChip(one);
    if (!held) return;
    /* ONE OF THIS FIELD'S VALUES, not one of the run. A section can hold two
       SEPARATE controls — `Organise` is a heading over Group and Sort, and it
       is not their field — so they share a `.values` container while answering
       different questions. Sweeping the container unticked Group whenever Sort
       was clicked, and left the grid grouped by a chip that read OFF.
       TRAP T-a-section-heading-is-not-a-field */
    if (picksOne(kindOf(held.def))) {
      for (const other of held.values.querySelectorAll<HTMLElement>('.value')) {
        if (other !== one && this.#heldOfChip(other) === held) {
          other.removeAttribute('data-current');
        }
      }
    }
    /* GROUP and SORT handle their own click and report it themselves — a
       filter waits for Apply, an arrangement does not, and which it is depends
       on WHAT THE CHIP IS, not on which container drew it.
       TRAP T-a-chip-knows-what-kind-it-is */
    this.#syncAnswered(held);
    this.#report(held);
  };

  /** A Group or Sort chip reported. Add the scope, and pass it on. */
  #onArrange = (event: Event): void => {
    const chip = this.pathFind(event, '.value');
    const held = chip ? this.#heldOfChip(chip) : undefined;
    if (!held) return;
    event.stopImmediatePropagation();
    const detail = ((event as CustomEvent).detail ?? {}) as Record<string, unknown>;
    /* BY NAME, not `event.type`: the contract is read from literals at the
       emit, and a bare variable made both events vanish from the spec.
       TRAP T-an-event-name-is-not-always-a-literal */
    this.emit(event.type === 'sort-change' ? 'sort-change' : 'group-change',
      { ...detail, scope: held.scope });
    this.#syncAnswered(held);
  };

  /** A field's Conditional switch. */
  #onConditionalSwitch = (event: Event): void => {
    const sw = this.pathFind(event, '.field-custom-switch');
    const held = sw && this.#fieldOf(sw);
    if (!held) return;
    const on = !!(sw as HTMLElement & { checked?: boolean }).checked;
    if (on !== held.box.hasAttribute('data-custom')) this.#flipCondition(held);
  };

  /** A field's Save or Clear button. */
  #onAction = (event: Event): void => {
    const save = this.pathFind(event, '.scope-save');
    if (save) return this.#requestSave(save);
    const clear = this.pathFind(event, '.field-clear');
    if (clear) return this.#clearField(clear);
    // REMOTE: one field's own Apply or Discard. TRAP T-apply-and-discard-wait-for-a-change
    const apply = this.pathFind(event, '.field-apply');
    const discard = apply ? null : this.pathFind(event, '.field-discard');
    const held = (apply ?? discard) && this.#fieldOf((apply ?? discard)!);
    if (!held) return;
    const at = { scope: held.scope, id: held.def.id, field: held.def.field ?? held.def.id };
    this.emit(apply ? 'filter-apply' : 'filter-discard', at);
  };

  /** The `Held` a CHIP belongs to.
   *
   *  `values.contains(chip)` is not enough: Organise puts Group and Sort in
   *  ONE section, so both chips share one container and `find` always returned
   *  the first — the Sort chip applied GROUPING.
   *  The chip carries its own id, so ask it first.
   *  TRAP T-two-chips-in-one-section-need-their-own-id */
  #heldOfChip(chip: HTMLElement): Held | undefined {
    const id = chip.dataset['value'];
    const byId = id
      ? [...this.#held.values()].find((h) => h.def.id === id && h.values.contains(chip))
      : undefined;
    return byId ?? [...this.#held.values()].find((h) => h.values.contains(chip));
  }

  /** The field a node sits in. */
  #fieldOf(node: HTMLElement): Held | undefined {
    return [...this.#held.values()].find((h) => h.box.contains(node));
  }

  /** CUSTOM MODE replaces the value chips. The rows are the host's to draw:
   *  the panel reports the intent and flags the field.
   *  TRAP T-conditions-are-opt-in-per-field */
  #flipCondition(held: Held): void {
    const on = !held.box.hasAttribute('data-custom');
    this.#setCustom(held, on);
    this.#syncAnswered(held);
    // The menu's own words, so one reader hears both. TRAP T-one-condition-system
    this.emit('filter-condition-change', {
      scope: held.scope, id: held.def.id, mode: on ? 'custom' : 'default',
    });
    this.#report(held);
  }

  /** Put a field in custom mode, or take it out: its flag, its switch, its menu. */
  #setCustom(held: Held, on: boolean): void {
    held.box.toggleAttribute('data-custom', on);
    held.box.querySelector('.field-custom-switch')?.toggleAttribute('checked', on);

    /* THE ROWS ARE THE MENU'S, and this field may not have needed one until
       now — a run of chips answers it otherwise. CSS shows the body off
       `[data-custom]`, so OFF needs nothing but the mode back.
       TRAP T-a-panel-builds-its-own-menus */
    const body = held.box.querySelector('.field-body');
    if (on && !held.menu && body) {
      this.#giveMenu(held, body as HTMLElement, true, true);
    }
    if (held.menu) {
      /* The MENU refuses custom mode unless the field opted in, and a
         panel's own button IS that opt-in reaching it.
         TRAP T-conditions-are-opt-in-per-field */
      if (on) held.menu.setAttribute('data-custom', '');
      held.menu.dataset['mode'] = on ? 'custom' : 'default';
    }
  }

  /** Has this field been ANSWERED — any ticked chip, or a condition row?
   *  Clear only appears once there is something to clear. */
  #syncAnswered(held: Held): void {
    const ticked = held.values.querySelector('.value[data-current]') != null;
    const menu = held.menu as (HTMLElement & { conditions?: unknown[] }) | undefined;
    const custom = held.box.hasAttribute('data-custom')
      && (menu?.conditions?.length ?? 0) > 0;
    held.box.toggleAttribute('data-answered', ticked || custom);
    this.#syncSaveable();
    this.#syncScopeFilters(held.scope);
  }

  /** Every field, after anything that could have changed an answer. */
  #syncAllAnswered(): void {
    for (const [, held] of this.#held) this.#syncAnswered(held);
  }

  /** "Save filter" on a scope with something to save — and only if the host saves.
   *  TRAP T-the-panel-saves-a-whole-scope */
  #syncSaveable(): void {
    const saves = this.hasAttribute('data-saveable');
    for (const box of this.$$<HTMLElement>('.scope[data-scope]')) {
      const scope = box.dataset['scope'] ?? '';
      box.toggleAttribute('data-can-save', saves && Object.keys(this.#scopeReadings(scope)).length > 0);
    }
  }

  /** A scope's ANSWERED fields, each as it can be saved — never its presets or arrangements. */
  #scopeReadings(scope: string): Record<string, FieldReading> {
    const readings = this.readings[scope] ?? {};
    const out: Record<string, FieldReading> = {};
    for (const [, held] of this.#held) {
      if (held.scope !== scope || held.def.id === 'presets' || arranges(kindOf(held.def))) continue;
      const reading = readings[held.def.id];
      if (!reading) continue;
      const values = held.def.options?.map((o) => o.value);
      const saved = savedReading(fieldState({ field: held.def.id, ...(values ? { values } : {}) }, reading));
      if (saved) out[held.def.id] = saved;
    }
    return out;
  }

  /** A scope's "Save filter": ASK the host, with every answered field in it. */
  #requestSave(button: HTMLElement): void {
    const scope = button.closest<HTMLElement>('.scope')?.dataset['scope'];
    if (!scope) return;
    const readings = this.#scopeReadings(scope);
    if (Object.keys(readings).length) this.emit('filter-save', { scope, readings });
  }

  /** A reader's own saved preset: Edit filter and Delete filter. */
  #addSavedMenu(chip: HTMLElement): void {
    const menu = this.clone('template.saved-menu-tpl');
    if (!menu) return;
    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
  }

  /** A saved preset's Edit or Delete: ASK, as Add and Remove do. The bar owns the list. */
  #onSavedAction = (event: Event): void => {
    const value = (event as CustomEvent).detail?.value;
    if (value !== 'edit' && value !== 'delete') return;
    const chip = this.pathFind(event, '.value');
    const id = chip?.dataset['value'];
    const scope = chip?.closest<HTMLElement>('.field')?.dataset['scope'];
    if (!id || !scope) return;
    event.stopPropagation();
    this.emit(value === 'edit' ? 'filter-edit' : 'filter-delete', { scope, id });
  };

  /** Untick a field's values and clear its conditions. */
  #clearField(btn: HTMLElement): void {
    const held = this.#fieldOf(btn);
    if (!held) return;
    for (const one of held.values.querySelectorAll('.value')) {
      one.removeAttribute('data-current');
    }
    this.#syncAnswered(held);
    this.#report(held);
  }

  /** The Add menu committed. The HOST owns the list; this is a request. */
  #onAddCommit = (event: Event): void => {
    /* A CHIP's own menu applying is the panel applying. Group, Sort and Date
       are chips with popovers, so their Apply lands here rather than on the
       panel's footer — and a reader who pressed Apply expects the same thing
       to happen wherever they pressed it.
       TRAP T-a-chip-menu-apply-is-the-panels-apply */
    const chip = this.pathFind(event, '.value');
    if (chip) {
      const held = this.#heldOfChip(chip);
      if (held) {
        const picked = ((event as CustomEvent).detail?.values ?? []) as string[];
        chip.toggleAttribute('data-current', picked.length > 0);
        this.#syncAnswered(held);
        if (held.def.id === 'group' || held.def.id === 'sort') {
          this.emit(`${held.def.id}-change`, {
            scope: held.scope, field: picked[0] ?? null,
          });
        }
        this.#report(held);
      }
      return;
    }

    const btn = this.pathFind(event, '.scope-add');
    if (!btn) return;
    // A DRILLED filter's pick is that filter's — never an Add or a Remove.
    if (this.#drill.home) return this.#onDrilled(event);
    const scope = btn.closest('.scope')?.getAttribute('data-scope') ?? '';
    const want = new Set(((event as CustomEvent).detail?.values ?? []) as string[]);

    /* TICKED IS HELD. The menu lists the whole scope, so what changed is the
       difference between what it now says and what the panel is drawing — a
       row unticked is a REMOVE, and that is the only way to remove one.
       TRAP T-the-add-menu-is-the-whole-list */
    const held = new Set((this.#lists.get(scope)?.held ?? []).map((f) => f.id));
    const added = [...want].filter((id) => !held.has(id));
    const gone = [...held].filter((id) => !want.has(id));

    if (added.length) this.emit('filter-add-request', { scope, ids: added });
    for (const id of gone) this.emit('filter-remove', { scope, id });
  };

  /** ONE search, across every value in the panel. Field labels stay: a reader
   *  searching "gold" still needs to see that Gold is a Tier. */
  #onSearch = (): void => {
    const field = this.$<HTMLElement & { value?: string }>('.search');
    const q = (field?.value ?? '').trim().toLowerCase();
    for (const [, held] of this.#held) {
      let shown = 0;
      for (const one of held.values.querySelectorAll<HTMLElement>('.value')) {
        const hit = !q || (one.dataset['search'] ?? '').includes(q);
        one.toggleAttribute('data-filtered-out', !hit);
        if (hit) shown += 1;
      }
      held.box.toggleAttribute('data-no-matches', shown === 0);
    }
  };

  /**
   * REPORT a change as it is made — ONE field, or every field on Reset all.
   * No footer: locally it applies at once; over a remote source it is the
   * draft, and the field's own Apply sends it. Will, 2026-09-27 (TODO 62).
   * Only the CHANGED field: sending every field would switch one that is OFF
   * back on. An echo of what the source just drew is not reported.
   * TRAP T-the-panel-reports-its-own-reading
   */
  #report(held?: Held): void {
    let readings = this.readings;
    if (held) {
      if (arranges(kindOf(held.def))) return;
      const key = `${held.scope}:${held.def.id}`;
      const reading = this.#readingOf(held);
      const said = JSON.stringify(reading);
      if (this.#said.get(key) === said) return;
      this.#said.set(key, said);
      readings = { [held.scope]: { [held.def.id]: reading } };
    }
    /* `values` rides along for a host that only wants the ticks. */
    this.emit('quick-filter-change', {
      scope: 'panel',
      readings,
      values: this.values,
      picked: this.values,
    });
  }

  /** RESET ALL: every field in both scopes, Group and Sort too, then applied —
   *  as the toolbar's Reset is. Will, 2026-09-26. */
  #onResetAll = (): void => {
    for (const held of this.#held.values()) {
      for (const one of held.values.querySelectorAll<HTMLElement>('.value')) {
        if (this.#heldOfChip(one) !== held) continue;
        one.removeAttribute('data-current');
        delete one.dataset['direction'];
      }
      const menu = held.menu as (HTMLElement & {
        conditions?: readonly FieldCondition[]; conditionValue?: string }) | undefined;
      if (menu?.conditions?.length) menu.conditions = [];
      if (menu?.conditionValue) menu.conditionValue = '';
    }
    for (const scope of new Set([...this.#held.values()].map((h) => h.scope))) {
      if (this.#held.has(`${scope}:group`)) this.emit('group-change', { scope, field: null });
      if (this.#held.has(`${scope}:sort`)) {
        this.emit('sort-change', { scope, field: null, direction: 'asc' });
      }
    }
    this.#syncAllAnswered();
    this.#report();
  };

  /** The header's switch back to the toolbars. */
  #onClose = (): void => {
    this.hide('reader');
  };

  /* ── The breakpoint ───────────────────────────────────────────────── */

  /** The width query the panel needs, or null without matchMedia. */
  #media(): MediaQueryList | null {
    if (typeof matchMedia !== 'function') return null;
    return matchMedia(`(min-width: ${this.dataset['minWidth'] ?? '1280'}px)`);
  }

  /** Is the window wide enough for the panel. */
  #wideEnough(): boolean {
    return this.#media()?.matches ?? true;
  }

  /** Below its width the panel closes itself: filtering goes back to the
   *  toolbars, which is what they are for. TRAP T-the-panel-is-desktop-only */
  #enforceWidth = (): void => {
    if (!this.#wideEnough()) {
      this.hide('width');
      return;
    }
    /* WIDE AGAIN, and the window was what took it away. Nothing else tells the
       host the panel is back. TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
    if (this.#closedByWidth) this.emit('filter-panel-reopen');
  };

  /** Closed by the window, not by the reader — so a widen may give it back. */
  get #closedByWidth(): boolean {
    return this.#lastClose === 'width' && !this.hasAttribute('open');
  }
  /** Why it last closed: the reader, a narrow window, or a page with no filters. */
  #lastClose: 'reader' | 'width' | 'page' | null = null;
}

customElements.define('sherpa-filter-panel', SherpaFilterPanel);
