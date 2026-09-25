/**
 * sherpa-filter-panel — the filter toolbars, as a column.
 *
 * A SIBLING of sherpa-quick-filter-toolbar over the same DataSource: it takes
 * the same filter definitions and emits the same `quick-filter-change`.
 * TRAP T-the-panel-is-the-toolbar-in-a-column
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { nextSort, sortDirectionFrom } from '../../core/data/cycle.js';
import { ORGANISE_ICONS } from '../../core/ui/shared-constants.js';
// TRAP T-menu-composes-real-components — the page may not have imported these.
import '../sherpa-container/sherpa-container.js';
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
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
}

/** One field the panel draws. The shape a quick-filter toolbar takes. */
export interface PanelFilter {
  id: string;
  label: string;
  options?: PanelValue[];
  select?: 'single' | 'multiple';
  /** The chip's leading glyph. Group and Sort carry the toolbar's own. */
  icon?: string;
  /** Offer Remove in this field's header. */
  removable?: boolean;
  /** Offer the CONDITION switch. TRAP T-conditions-are-opt-in-per-field */
  conditions?: boolean;
  /** A chip with no field behind it — one question, answered yes or no.
   *  TRAP T-a-chip-with-no-field-is-a-preset */
  preset?: boolean;
  /** Draw as ONE chip with its menu, not a run. A date is the case: its menu
   *  IS a calendar, and a calendar in a 360px column is the whole panel.
   *  TRAP T-only-group-and-sort-stay-one-chip */
  asChip?: boolean;
  /** ON, with nothing picked — a preset's whole state. */
  active?: boolean;
  /**
   * The field's OWN `<sherpa-menu>`, for a field the panel cannot draw as a
   * run of chips — a condition, a number, a range.
   *
   * The panel draws it INLINE and gives it back untouched, so the condition
   * rows, the number input and the range switch are the same controls a chip
   * menu shows rather than a second copy of each.
   * TRAP T-an-inline-menu-is-the-same-menu
   */
  menu?: HTMLElement;
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
  /** Each one's OWN menu, where its chip has one. */
  groupMenu?: HTMLElement;
  sortMenu?: HTMLElement;
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
  /** A borrowed menu, and where it came from, so it can go home. */
  menu?: HTMLElement;
  menuHome?: { parent: Node; slot: string | null };
}

export class SherpaFilterPanel extends SherpaElement {
  static override css = new URL('./sherpa-filter-panel.css', import.meta.url);
  static override html = new URL('./sherpa-filter-panel.html', import.meta.url);

  static override props = {
    /* NOT `kind: content`. The header is a COMPOSED component with its own
       children — a slotted search among them — and writing text into it
       replaces every one. `#syncHeading` passes the attribute along instead.
       TRAP T-a-composed-child-takes-an-attribute-not-text */
    'data-heading': { type: 'string', kind: 'style' },
    'data-open': { type: 'boolean', kind: 'style' },
    'data-locked': { type: 'boolean', kind: 'style' },
    'data-min-width': { type: 'string', kind: 'style' },
  } as const;

  static override observed = ['data-heading', 'data-open'];

  /** Every drawn field, by `${scope}:${id}`. */
  #held = new Map<string, Held>();
  /** What Apply last committed, so Discard can restore it. */
  #baseline = new Map<string, string[]>();
  /** The scopes as last given. */
  #scopes: PanelScope[] = [];
  /** Which removable ids each scope's Add menu was told about. */
  #addable = new Map<string, string[]>();

  override onRender(): void {
    this.$('.to-toolbars')?.addEventListener('button-click', this.#onClose);
    this.$('.search')?.addEventListener('input', this.#onSearch);
    this.$('.apply')?.addEventListener('button-click', this.#onApply);
    this.$('.discard')?.addEventListener('button-click', this.#onDiscard);
    // ONE listener for every drawn control — a field added later needs no wiring.
    this.$('.scopes')?.addEventListener('button-click', this.#onAction);
    this.$('.scopes')?.addEventListener('quick-filter-click', this.#onValueClick);
    this.$('.scopes')?.addEventListener('menu-change', this.#onAddCommit);
    this.#syncHeading();
    if (this.#scopes.length) this.#draw();
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncHeading();
    else if (name === 'data-open') this.#enforceWidth();
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
   * Give every borrowed menu back to its chip, NOW.
   *
   * A host builds its `populate()` payload by reading the bars — and a menu
   * the panel is holding is not on its chip, so the field arrives with no
   * value rows and draws the menu instead of chips. `#draw` releases them too,
   * but that is after the payload was built. Call this first.
   * TRAP T-a-borrowed-menu-is-not-on-its-chip
   */
  release(): void {
    this.#giveBack();
  }

  /** Show the panel, unless the window is too narrow.
   *  TRAP T-the-panel-is-desktop-only */
  open(): void {
    if (!this.#wideEnough()) return;
    this.toggleAttribute('data-open', true);
  }

  /** EVERY close reports, and says why. The width path called this directly
   *  while only the header button emitted, so a narrow window left the panel
   *  gone and the host still in panel mode — no toolbars, no panel.
   *  TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
  close(reason: 'reader' | 'width' = 'reader'): void {
    if (!this.hasAttribute('data-open')) return;
    this.removeAttribute('data-open');
    this.#lastClose = reason;
    this.emit('filter-panel-close', { reason });
  }

  override onDisconnect(): void {
    this.#media()?.removeEventListener('change', this.#enforceWidth);
    this.#giveBack();
  }

  toggle(): void {
    if (this.hasAttribute('data-open')) this.close();
    else this.open();
  }

  /* ── Drawing ──────────────────────────────────────────────────────── */

  #syncHeading(): void {
    this.$('.head')?.setAttribute('data-heading', this.dataset['heading'] ?? 'Filters');
  }

  /** Redraw every scope from `#scopes`. */
  #draw(): void {
    const region = this.$('.scopes');
    if (!region) return;
    // Every borrowed menu goes home BEFORE the boxes holding them are dropped.
    this.#giveBack();
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

      const mine = (scope.filters ?? []).filter((f) => {
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
          const menu = kind === 'group' ? scope.groupMenu : scope.sortMenu;
          const chip = this.#drawChip({
            id: kind, label: kind === 'group' ? 'Group by' : 'Sort by',
            select: 'single',
            /* The SAME glyphs the toolbar draws — one constant, so the two
               views of one control cannot drift. A Sort opens on `sort-none`
               and its icon follows the direction from there. */
            icon: kind === 'group' ? ORGANISE_ICONS.group : ORGANISE_ICONS.sortNone,
            ...(menu ? { menu } : {}),
            options: (cols ?? []).map((c) => ({
              value: c.field, label: c.label, selected: c.field === on,
            })),
          }, scope.scope, section);
          if (chip) {
            if (kind === 'sort') {
              chip.dataset['direction'] = scope.sortDirection ?? 'asc';
              /* SEED THE CYCLE from what the scope said. Without this the first
                 body click on a chip that arrived ON reported `asc` again
                 instead of stepping to `desc`. */
              this.#sortField = on ?? null;
              this.#sortLive = !!on;
              if (on) {
                chip.setAttribute('data-icon-start', scope.sortDirection === 'desc'
                  ? ORGANISE_ICONS.sortDesc : ORGANISE_ICONS.sortAsc);
              }
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
          })),
          select: 'multiple',
        }, scope.scope, true)!);
      }
      for (const def of fields) {
        const drawn = this.#drawField(def, scope.scope, false);
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
      this.#addable.set(scope.scope, removable.map((f) => f.id));
      const add = box.querySelector('.scope-add');
      box.toggleAttribute('data-can-add', offers.length + removable.length > 0);
      if (add && (offers.length || removable.length)) {
        this.#fillAdd(add as HTMLElement, removable, offers);
      }

      /* An empty scope SAYS SO. Absent, it reads as a bug rather than as an
         answer — and a scope can legitimately be empty. */
      if (!presets.length && !fields.length) {
        const empty = this.clone('template.empty-tpl');
        if (empty) box.append(empty);
      }

      region.append(box);
    }
    this.#snapshot();
    this.#syncAllAnswered();
  }

  /**
   * An empty SECTION — a header and a run — for things that are not one field.
   * `Organise` holds Group and Sort; `Presets` holds the toggles.
   */
  #drawSection(id: string, label: string): { box: HTMLElement; values: HTMLElement } {
    const box = this.clone('template.field-tpl')!;
    box.setAttribute('data-field', id);
    box.querySelector('.field-head')?.setAttribute('data-heading', label);
    // A section is not a field: nothing here to clear, remove or condition.
    box.querySelector('.field-acts')?.remove();
    return { box, values: box.querySelector('.field-values') as HTMLElement };
  }

  /** ONE chip carrying a field's own menu, for a section that holds several. */
  #drawChip(def: PanelFilter, scope: string,
    section: { box: HTMLElement; values: HTMLElement }): HTMLElement | null {
    const proto = this.$<HTMLTemplateElement>('template.value-tpl');
    const one = proto?.content.firstElementChild?.cloneNode(true) as HTMLElement | null;
    if (!one) return null;
    one.setAttribute('data-label', def.label);
    if (def.icon) one.setAttribute('data-icon-start', def.icon);
    one.dataset['value'] = def.id;
    one.dataset['search'] = def.label.toLowerCase();
    /* ARRANGES rows, never chooses them. Its menu holds COLUMNS, so those rows
       are not the chip's values and this panel owns its state.
       TRAP T-an-organise-chip-has-no-values */
    const organise = def.id === 'group' || def.id === 'sort';
    one.toggleAttribute('data-organise', organise);
    one.toggleAttribute('data-locked', organise);
    one.toggleAttribute('data-current', (def.options ?? []).some((o) => o.selected));

    const held: Held = { def, scope, box: section.box, values: section.values };
    if (def.menu) {
      one.setAttribute('data-menu', '');
      /* A chip menu in the panel COMMITS, like everything else here.
         TRAP T-a-chip-menu-in-the-panel-commits */
      def.menu.setAttribute('data-commit', '');
      held.menu = def.menu;
      held.menuHome = { parent: def.menu.parentNode!, slot: def.menu.getAttribute('slot') };
      def.menu.setAttribute('slot', 'menu');
      one.append(def.menu);
    }
    this.#held.set(`${scope}:${def.id}`, held);
    return one;
  }

  /** One field: its header, its actions, and its run of value chips. */
  #drawField(def: PanelFilter, scope: string, isPresets: boolean): HTMLElement | null {
    const options = def.options ?? [];
    /* A field with NO VALUES and NO MENU has nothing to draw at all.
       TRAP T-the-panel-is-the-toolbar-in-a-column */
    if (!options.length && !def.menu) return null;

    /* ONLY GROUP AND SORT stay as one chip with their own menu. They are not
       filters — they say HOW the rows are arranged — so they read as the two
       controls a toolbar already shows.
       Every other field, single-select included, EXPLODES into a run: the
       whole point of the panel is that a reader sees the values without
       opening anything. TRAP T-only-group-and-sort-stay-one-chip */
    const single = def.select === 'single';

    const box = this.clone('template.field-tpl');
    if (!box) return null;
    const key = `${scope}:${def.id}`;
    box.setAttribute('data-field', def.id);
    box.setAttribute('data-scope', scope);
    // A PRESETS section has no field to clear or remove.
    const organise = def.id === 'group' || def.id === 'sort';
    // Set BEFORE the chip path returns, or it never lands.
    box.toggleAttribute('data-single', single && !isPresets);
    box.toggleAttribute('data-chip', organise || !!def.asChip);
    box.toggleAttribute('data-clearable', !isPresets && !organise);
    box.toggleAttribute('data-removable', !isPresets && !organise && !!def.removable);
    box.toggleAttribute('data-conditional-ok', !isPresets && !organise && !!def.conditions);

    /* REMOVE what this field does not offer, never hide it: `.sherpa-group`
       squares corners by POSITION, and a `display: none` first child still
       counts as `:first-child` — so a field with no condition button had a
       Clear that kept the middle's square edges.
       TRAP T-a-hidden-sibling-still-counts-as-first-child */
    if (!box.hasAttribute('data-conditional-ok')) box.querySelector('.field-conditional')?.remove();
    if (!box.hasAttribute('data-clearable')) box.querySelector('.field-clear')?.remove();

    const head = box.querySelector('.field-head');
    head?.setAttribute('data-heading', def.label);
    const name = def.label;
    head?.querySelector('.field-clear')?.setAttribute('aria-label', `Clear ${name}`);
    head?.querySelector('.field-conditional')
      ?.setAttribute('aria-label', `Use a condition for ${name}`);

    const values = box.querySelector('.field-values') as HTMLElement | null;
    const proto = this.$<HTMLTemplateElement>('template.value-tpl');

    /* ONE CHIP, carrying its own menu — group and sort only.
       TRAP T-only-group-and-sort-stay-one-chip */
    if ((organise || def.asChip) && values && proto?.content.firstElementChild) {
      const one = proto.content.firstElementChild.cloneNode(true) as HTMLElement;
      one.setAttribute('data-label', def.label);
      one.dataset['value'] = def.id;
      one.dataset['search'] = def.label.toLowerCase();
      one.toggleAttribute('data-organise', organise);
      one.toggleAttribute('data-locked', organise);
      one.toggleAttribute('data-current', options.some((o) => o.selected));
      values.append(one);

      const held: Held = { def, scope, box, values };
      /* The MENU is the field's own, moved onto this chip — the same control
         in a second place, never a copy. TRAP T-an-inline-menu-is-the-same-menu */
      if (def.menu) {
        one.setAttribute('data-menu', '');
        /* A CHIP MENU in the panel COMMITS. Everything else here waits for the
           panel's own Apply, so a date or a sort that landed on every click
           would be the one control that did not.
           TRAP T-a-chip-menu-in-the-panel-commits */
        def.menu.setAttribute('data-commit', '');
        held.menu = def.menu;
        held.menuHome = { parent: def.menu.parentNode!, slot: def.menu.getAttribute('slot') };
        def.menu.setAttribute('slot', 'menu');
        one.append(def.menu);
      }
      this.#held.set(key, held);
      return box;
    }

    if (values && proto?.content.firstElementChild) {
      for (const option of options) {
        const one = proto.content.firstElementChild.cloneNode(true) as HTMLElement;
        one.dataset['value'] = option.value;
        const text = option.label ?? option.value;
        one.setAttribute('data-label', text);
        /* The SEARCH reads this, not `data-label`: a chip rewrites its own
           label to "Field: Value" the moment one value is picked, so a picked
           chip stopped matching its own name.
           TRAP T-a-chip-rewrites-its-own-label */
        one.dataset['search'] = text.toLowerCase();
        one.toggleAttribute('data-current', !!option.selected);
        values.append(one);
      }
    }

    const held: Held = { def, scope, box, values: values ?? box };

    /* A field ANSWERED BY ITS MENU — a number, a range, a condition-only field
       — borrows that menu and draws it inline. The panel gives it back
       untouched. TRAP T-an-inline-menu-is-the-same-menu */
    if (def.menu && !options.length) {
      box.setAttribute('data-body', '');
      this.#borrow(held, def.menu, box);
    }

    this.#held.set(key, held);
    return box;
  }

  /** Move a menu into this field's body, remembering where it came from. */
  #borrow(held: Held, menu: HTMLElement, box: HTMLElement): void {
    const body = box.querySelector('.field-body');
    if (!body) return;
    held.menu = menu;
    held.menuHome = { parent: menu.parentNode!, slot: menu.getAttribute('slot') };
    menu.removeAttribute('slot');
    menu.setAttribute('data-inline', '');
    body.append(menu);
  }

  /** Put every borrowed menu back exactly as it was. */
  #giveBack(): void {
    for (const [, held] of this.#held) {
      if (!held.menu || !held.menuHome) continue;
      held.menu.removeAttribute('data-inline');
      if (held.menuHome.slot) held.menu.setAttribute('slot', held.menuHome.slot);
      held.menuHome.parent.appendChild(held.menu);
      delete held.menu;
      delete held.menuHome;
    }
  }

  /** Hand the Add button the WHOLE list: what is held, ticked, and what is not.
   *  TRAP T-the-add-menu-is-the-whole-list */
  #fillAdd(btn: HTMLElement, held: PanelFilter[], offers: PanelFilter[]): void {
    const menu = document.createElement('sherpa-menu');
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-heading', 'Add filter');
    menu.setAttribute('data-select', 'multiple');
    menu.setAttribute('data-search', '');
    menu.setAttribute('data-commit', '');
    btn.append(menu);
    // `items()`, not populate(): a cloned menu has not upgraded.
    // TRAP T-custom-element-upgrade
    void Promise.resolve((menu as HTMLElement & { rendered?: Promise<void> }).rendered)
      .then(() => {
        (menu as HTMLElement & { items?: (i: unknown[]) => void }).items?.([
          ...held.map((f) => ({ value: f.id, label: f.label, selected: true })),
          ...offers.map((f) => ({ value: f.id, label: f.label, selected: false })),
        ]);
      });
  }

  /* ── Reading ──────────────────────────────────────────────────────── */

  #picked(held: Held): string[] {
    return [...held.values.querySelectorAll<HTMLElement>('.value[data-current]')]
      .map((c) => c.dataset['value'] ?? '')
      .filter(Boolean);
  }

  #snapshot(): void {
    this.#baseline = new Map([...this.#held].map(([key, held]) => [key, this.#picked(held)]));
  }

  /* ── Acting ───────────────────────────────────────────────────────── */

  /** A single-select field unticks its siblings. */
  #onValueClick = (event: Event): void => {
    const one = this.#pathFind(event, '.value');
    if (!one) return;
    const held = this.#heldOfChip(one);
    if (!held) return;
    /* ONE OF THIS FIELD'S VALUES, not one of the run. A section can hold two
       SEPARATE controls — `Organise` is a heading over Group and Sort, and it
       is not their field — so they share a `.values` container while answering
       different questions. Sweeping the container unticked Group whenever Sort
       was clicked, and left the grid grouped by a chip that read OFF.
       TRAP T-a-section-heading-is-not-a-field */
    if (held.def.select === 'single') {
      for (const other of held.values.querySelectorAll<HTMLElement>('.value')) {
        if (other !== one && this.#heldOfChip(other) === held) {
          other.removeAttribute('data-current');
        }
      }
    }
    /* GROUP and SORT are not filters, so they report at once and by their own
       names — a filter waits for Apply, an arrangement does not.
       TRAP T-group-and-sort-are-component-scope */
    if (held.def.id === 'group' || held.def.id === 'sort') {
      this.#organiseClick(held, one);
    }
    this.#syncAnswered(held);
  };

  /**
   * An Organise chip's BODY was clicked. The MENU picks the column; the body
   * toggles Group, and CYCLES Sort — asc → desc → suspended → asc, the same
   * three states the toolbar's chip steps through.
   *
   * The field comes from the MENU. `#picked` reads the chip's own `data-value`,
   * which for these is the literal `group` / `sort` — so a body click reported
   * `sort-change { field: 'sort' }` and the grid tried to sort by a column
   * called "sort". TRAP T-an-organise-chip-is-named-for-its-job-not-its-field
   */
  #organiseClick(held: Held, chip: HTMLElement): void {
    const field = this.#organiseField(held);
    if (held.def.id === 'group') {
      this.emit('group-change', {
        scope: held.scope,
        field: chip.hasAttribute('data-current') ? field : null,
      });
      return;
    }
    /* NO COLUMN, NOTHING TO CYCLE. Turning the chip on with an empty menu is
       the on-but-filtering-nothing contradiction that paints AMBER, and a
       reader who has not chosen a column has done nothing wrong.
       TRAP T-an-organise-chip-is-named-for-its-job-not-its-field */
    if (!field) {
      chip.removeAttribute('data-current');
      return;
    }
    /* THE CYCLE, from the data layer — one definition for every control that
       steps it. TRAP T-a-chip-body-cycles-its-states */
    const held_dir = sortDirectionFrom(chip.dataset['direction']);
    const wasOn = this.#sortLive;
    const next = nextSort(field ?? '', wasOn ? this.#sortField : null, wasOn ? held_dir : null);
    this.#sortField = next.field;
    this.#sortLive = next.direction !== null;
    // A suspended chip rewinds to `asc` — that is where a resume starts.
    chip.dataset['direction'] = next.direction ?? 'asc';
    chip.toggleAttribute('data-current', next.direction !== null);
    // The glyph says which way, or that it is off — the toolbar's three icons.
    chip.setAttribute('data-icon-start', next.direction === null
      ? ORGANISE_ICONS.sortNone
      : next.direction === 'desc' ? ORGANISE_ICONS.sortDesc : ORGANISE_ICONS.sortAsc);
    this.emit('sort-change', {
      scope: held.scope,
      field: next.direction === null ? null : next.field,
      direction: next.direction ?? 'asc',
    });
  }

  /** Which COLUMN an Organise chip's menu has picked. */
  #organiseField(held: Held): string | null {
    const menu = held.menu as (HTMLElement & { values?: string[] }) | undefined;
    return menu?.values?.[0] ?? held.def.options?.find((o) => o.selected)?.value ?? null;
  }

  #sortField: string | null = null;
  #sortLive = false;

  #onAction = (event: Event): void => {
    const cond = this.#pathFind(event, '.field-conditional');
    if (cond) return this.#flipCondition(cond);
    const clear = this.#pathFind(event, '.field-clear');
    if (clear) return this.#clearField(clear);
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

  #fieldOf(node: HTMLElement): Held | undefined {
    return [...this.#held.values()].find((h) => h.box.contains(node));
  }

  /** CONDITION MODE replaces the value chips. The rows are the host's to draw:
   *  the panel reports the intent and flags the field.
   *  TRAP T-conditions-are-opt-in-per-field */
  #flipCondition(btn: HTMLElement): void {
    const held = this.#fieldOf(btn);
    if (!held) return;
    const on = !held.box.hasAttribute('data-conditional');
    held.box.toggleAttribute('data-conditional', on);
    btn.setAttribute('aria-pressed', String(on));

    /* The ROWS are the MENU's. The panel borrows the whole body and puts the
       menu into condition mode — one control, drawn in a second place.
       TRAP T-an-inline-menu-is-the-same-menu */
    const menu = held.def.menu;
    if (menu) {
      const body = held.box.querySelector('.field-body');
      if (on) {
        /* The MENU refuses condition mode unless the field opted in, and a
           panel's own button IS that opt-in reaching it.
           TRAP T-conditions-are-opt-in-per-field */
        menu.setAttribute('data-conditional', '');
        menu.dataset['mode'] = 'condition';
        /* MOVE IT, wherever it is now. A SINGLE-SELECT field's menu is already
           borrowed — onto its one chip — so a `!held.menu` guard skipped the
           move and the rows never appeared: the chips hid and nothing replaced
           them. TRAP T-an-inline-menu-is-the-same-menu */
        if (!held.menu) {
          held.menu = menu;
          held.menuHome = { parent: menu.parentNode!, slot: menu.getAttribute('slot') };
        }
        menu.removeAttribute('slot');
        menu.setAttribute('data-inline', '');
        body?.append(menu);
      } else {
        menu.dataset['mode'] = 'select';
        /* BACK to the chip for a single-select field, or home for any other.
           The chip is still in this box; the home may not be. */
        const chip = held.values.querySelector('.value');
        if (held.box.hasAttribute('data-single') && chip) {
          menu.removeAttribute('data-inline');
          menu.setAttribute('slot', 'menu');
          chip.append(menu);
        } else if (held.menu && held.menuHome) {
          menu.removeAttribute('data-inline');
          if (held.menuHome.slot) menu.setAttribute('slot', held.menuHome.slot);
          held.menuHome.parent.appendChild(menu);
          delete held.menu;
          delete held.menuHome;
        }
      }
    }

    this.#syncAnswered(held);
    this.emit('filter-condition-change', {
      scope: held.scope, id: held.def.id, conditional: on,
    });
  }

  /** Has this field been ANSWERED — any ticked chip, or a condition row?
   *  Clear only appears once there is something to clear. */
  #syncAnswered(held: Held): void {
    const ticked = held.values.querySelector('.value[data-current]') != null;
    const menu = held.menu as (HTMLElement & { conditions?: unknown[] }) | undefined;
    const conditioned = held.box.hasAttribute('data-conditional')
      && (menu?.conditions?.length ?? 0) > 0;
    held.box.toggleAttribute('data-answered', ticked || conditioned);
  }

  /** Every field, after anything that could have changed an answer. */
  #syncAllAnswered(): void {
    for (const [, held] of this.#held) this.#syncAnswered(held);
  }

  #clearField(btn: HTMLElement): void {
    const held = this.#fieldOf(btn);
    if (!held) return;
    for (const one of held.values.querySelectorAll('.value')) {
      one.removeAttribute('data-current');
    }
    this.#syncAnswered(held);
  }

  /** The Add menu committed. The HOST owns the list; this is a request. */
  #onAddCommit = (event: Event): void => {
    /* A CHIP's own menu applying is the panel applying. Group, Sort and Date
       are chips with popovers, so their Apply lands here rather than on the
       panel's footer — and a reader who pressed Apply expects the same thing
       to happen wherever they pressed it.
       TRAP T-a-chip-menu-apply-is-the-panels-apply */
    const chip = this.#pathFind(event, '.value');
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
        this.#onApply();
      }
      return;
    }

    const btn = this.#pathFind(event, '.scope-add');
    if (!btn) return;
    const scope = btn.closest('.scope')?.getAttribute('data-scope') ?? '';
    const want = new Set(((event as CustomEvent).detail?.values ?? []) as string[]);

    /* TICKED IS HELD. The menu lists the whole scope, so what changed is the
       difference between what it now says and what the panel is drawing — a
       row unticked is a REMOVE, and that is the only way to remove one.
       TRAP T-the-add-menu-is-the-whole-list */
    const held = new Set(this.#addable.get(scope) ?? []);
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

  /** APPLY commits every field at once — one event, not one per field. */
  #onApply = (): void => {
    this.#snapshot();
    this.emit('quick-filter-change', {
      scope: 'panel',
      values: this.values,
      picked: this.values,
    });
    /* AND THEN ASK THE BARS. `values` is ticked chips only — a field in
       CONDITION mode has no ticked chips, so its rows said nothing and Apply
       committed nothing. The bar already reads its own chips AND their menus'
       conditions, so it re-reports rather than the panel deriving a second
       answer. TRAP T-the-panel-asks-the-bar-it-does-not-answer-for-it */
    this.#markConditioned();
    for (const bar of this.#bars()) bar.report?.();
  };

  /** A field answered by CONDITIONS is on, and its chip has to say so.
   *
   *  The bar reads `data-current` to decide whether a field is suspended, and
   *  a chip in the hidden toolbar was never ticked — the reader answered in
   *  the panel. So the field read as suspended and gave no clause, with the
   *  right conditions sitting in its own state.
   *  TRAP T-a-conditioned-chip-answers-with-its-clause */
  #markConditioned(): void {
    for (const [, held] of this.#held) {
      if (!held.box.hasAttribute('data-conditional')) continue;
      const menu = held.menu as (HTMLElement & { conditions?: unknown[] }) | undefined;
      const chip = this.#chipOf(held);
      if (!chip) continue;
      chip.toggleAttribute('data-current', (menu?.conditions?.length ?? 0) > 0);
    }
  }

  /** Every toolbar a borrowed menu came from, each named once. */
  #bars(): Array<HTMLElement & { report?: () => void }> {
    const out = new Set<HTMLElement>();
    for (const [, held] of this.#held) {
      const bar = this.#barOf(held);
      if (bar) out.add(bar);
    }
    return [...out] as Array<HTMLElement & { report?: () => void }>;
  }

  /** The toolbar a borrowed menu came from.
   *
   *  `closest()` STOPS at a shadow boundary, and a chip lives inside the
   *  toolbar's shadow root — so it walked up to the chip and found no bar at
   *  all. A root walk crosses the boundary.
   *  TRAP T-closest-stops-at-the-shadow-boundary */
  #barOf(held: Held): (HTMLElement & { report?: () => void }) | null {
    const root = this.getRootNode() as Document | ShadowRoot;
    const host = (root as ShadowRoot).host ?? root;
    const bars = (host.ownerDocument ?? document)
      .querySelectorAll<HTMLElement & { heldIds?: readonly string[];
        report?: () => void; shadowRoot: ShadowRoot }>('sherpa-quick-filter-toolbar');
    for (const bar of bars) {
      if (bar.heldIds?.includes(held.def.id)) return bar;
    }
    return null;
  }

  /** The BAR's own chip for this field.
   *
   *  Not `menuHome.parent`: the flip path records the parent as it is AT THAT
   *  MOMENT, and for a menu the panel already holds that is the PANEL's chip.
   *  Ticking it told the bar nothing. The bar's chip is found by field id.
   *  TRAP T-the-panel-asks-the-bar-it-does-not-answer-for-it */
  #chipOf(held: Held): HTMLElement | null {
    const bar = this.#barOf(held) as (HTMLElement & { shadowRoot: ShadowRoot }) | null;
    return bar?.shadowRoot?.querySelector<HTMLElement>(
      `.chip[data-id="${CSS.escape(held.def.id)}"]`) ?? null;
  }

  /** DISCARD reverts to the last Apply, which is why it is not Cancel. */
  #onDiscard = (): void => {
    for (const [key, held] of this.#held) {
      const want = new Set(this.#baseline.get(key) ?? []);
      for (const one of held.values.querySelectorAll<HTMLElement>('.value')) {
        one.toggleAttribute('data-current', want.has(one.dataset['value'] ?? ''));
      }
    }
    this.#syncAllAnswered();
  };

  #onClose = (): void => {
    this.close('reader');
  };

  /* ── The breakpoint ───────────────────────────────────────────────── */

  #media(): MediaQueryList | null {
    if (typeof matchMedia !== 'function') return null;
    return matchMedia(`(min-width: ${this.dataset['minWidth'] ?? '1280'}px)`);
  }

  #wideEnough(): boolean {
    return this.#media()?.matches ?? true;
  }

  /** Below its width the panel closes itself: filtering goes back to the
   *  toolbars, which is what they are for. TRAP T-the-panel-is-desktop-only */
  #enforceWidth = (): void => {
    if (!this.#wideEnough()) {
      this.close('width');
      return;
    }
    /* WIDE AGAIN, and the window was what took it away. Nothing else tells the
       host the panel is back. TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
    if (this.#closedByWidth) this.emit('filter-panel-reopen', {});
  };

  /** Closed by the window, not by the reader — so a widen may give it back. */
  get #closedByWidth(): boolean {
    return this.#lastClose === 'width' && !this.hasAttribute('data-open');
  }
  #lastClose: 'reader' | 'width' | null = null;

  /** The first match on an event's composed path. */
  #pathFind(event: Event, selector: string): HTMLElement | null {
    for (const node of event.composedPath()) {
      if (node instanceof HTMLElement && node.matches(selector)) return node;
    }
    return null;
  }
}

customElements.define('sherpa-filter-panel', SherpaFilterPanel);
