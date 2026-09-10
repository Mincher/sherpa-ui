/**
 * sherpa-quick-filter-toolbar — a row of filter chips above a grid or list.
 *
 * Give it chips with populate([{ id, label, type?, active?, count? }]). When you
 * click a chip it toggles on or off, and the toolbar fires quick-filter-change
 * with the ids of every chip that's currently on. There's a slot for your own
 * extra buttons — the old add/edit/save-view features are left out on purpose.
 *
 * FIGMA DIVERGENCE (intentional): Figma "Filter Toolbar" (node 150:3688) is a
 * fuller toolbar — it bakes in a leading view chip / Switch, divider-separated
 * preset chips, and a trailing action cluster (Add, AI filter, undo, refresh,
 * favourite/star, Save-view split menu, overflow ⋮), plus view-scope events
 * (view-menu-open / view-change / view-save / view-favorite / data-refresh /
 * ai-filter-request). This component is a deliberately SIMPLER 3-zone slot bar:
 * the action cluster and save-view controls are DELEGATED to slotted content
 * (the `actions` and `view` slots), not built in, and those extra events are
 * the host's responsibility, not fired here. Do not expand to match Figma
 * without a deliberate decision. Recorded in the component's .thin.yaml
 * `_divergence` block; the .component.yaml is generated so the prose lives here.
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
 * @fires quick-filter-change — the active filter set changes. bubbles + composed. detail: { active: string[], values: Record<string, string[]> }
 * @fires group-change — the group column changed. bubbles + composed. detail: { field: string | null }
 * @fires sort-change — the sort column or direction changed. bubbles + composed. detail: { field: string | null, direction: 'asc' | 'desc' }
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';
// Chips with `options` stamp a <sherpa-menu>, so it must be defined.
import '../sherpa-menu/sherpa-menu.js';

/** One value a filter chip's menu can offer. */
export interface QuickFilterOption {
  value: string;
  label: string;
  selected?: boolean;
}

export interface QuickFilterDef {
  id: string;
  label: string;
  type?: string;
  active?: boolean;
  count?: number;
  /** A leading Font Awesome icon class list. */
  icon?: string;
  /**
   * Values this chip filters by. Given options, the chip gets a caret and a
   * <sherpa-menu> of rows: checkboxes when `select` is 'multiple' (the default),
   * radios when it is 'single'.
   */
  options?: QuickFilterOption[];
  select?: 'single' | 'multiple';
}

interface ChipEl extends HTMLElement {
  current: boolean;
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

  #filters: QuickFilterDef[] = [];
  #organise: OrganiseDef = {};

  override onRender(): void {
    this.addEventListener('quick-filter-click', this.#onChipClick);
    // The organise chips carry MENUS, so their selection arrives as the chip's
    // own quick-filter-change (relayed from <sherpa-menu>), not as a body click.
    this.addEventListener('quick-filter-change', this.#onOrganiseChange);
    if (this.#filters.length) this.#render();
    if (this.#organise.group?.length || this.#organise.sort?.length) this.#renderOrganise();
  }

  /** populate([{ id, label, type?, active?, count? }]) — the filter chips. */
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
   * What each value-MENU chip has selected, keyed by chip id.
   *
   * Only chips that are ON and hold at least one pick appear, so a host can
   * iterate the object and know every entry is a live constraint. A single-select
   * chip still reports an array — one shape for both, so a caller does not have to
   * branch on the chip's select mode.
   */
  get values(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const chip of this.#chips()) {
      if (!chip.hasAttribute('data-menu')) continue;
      const id = chip.dataset['id'];
      if (!id) continue;
      const picked = Array.from(
        chip.querySelectorAll<HTMLInputElement>('input:checked'),
      ).map((i) => i.value);
      if (picked.length) out[id] = picked;
    }
    return out;
  }

  #chips(): ChipEl[] {
    return this.$$<ChipEl>('.chips > .chip');
  }

  #render(): void {
    const list = this.$('.chips');
    const tpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!list || !tpl) return;

    list.replaceChildren();
    for (const f of this.#filters) {
      const chip = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      chip.dataset['id'] = f.id;
      chip.setAttribute('data-label', f.label);
      if (f.type) chip.setAttribute('data-type', f.type);
      if (f.active) chip.setAttribute('data-current', '');
      if (f.count != null) chip.setAttribute('data-count', String(f.count));
      if (f.icon) chip.setAttribute('data-icon-start', f.icon);
      if (f.options?.length) this.#addMenu(chip, f);
      list.appendChild(chip);
    }
  }

  /**
   * Give a chip its value menu: a <sherpa-menu> of real checkbox/radio rows in the
   * chip's light DOM. Cloned from the menu prototypes in the template, so no
   * structural innerHTML is written.
   */
  #addMenu(chip: HTMLElement, def: QuickFilterDef): void {
    const menuTpl = this.$<HTMLTemplateElement>('template.qf-menu-tpl');
    const rowTpl = this.$<HTMLTemplateElement>('template.qf-row-tpl');
    if (!menuTpl || !rowTpl) return;

    const single = def.select === 'single';
    const menu = menuTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    menu.setAttribute('data-heading', def.label);
    menu.setAttribute('data-select', single ? 'single' : 'multiple');
    // A filter menu COMMITS on Apply. Filtering a table or chart is expensive and
    // a partly-built selection is rarely a query anyone wants run, so the rows are
    // a draft until Apply and Cancel discards them. The menu shows the footer and
    // withholds menu-change until then; nothing else here has to change.
    menu.setAttribute('data-commit', '');

    for (const option of def.options ?? []) {
      const row = rowTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const input = row.querySelector('input')!;
      input.type = single ? 'radio' : 'checkbox';
      input.value = option.value;
      if (single) input.name = `qf-${def.id}`;
      input.checked = !!option.selected;
      row.querySelector('.qf-row-label')!.textContent = option.label;
      menu.appendChild(row);
    }

    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
  }

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
    this.#emitChange();
  };

  /**
   * Report the whole filter state: the active toggle chips AND every menu chip's
   * picks.
   *
   * `active` alone could not describe a menu chip — its id names a column, so a
   * host matching row values against that list found nothing and a Plan pick
   * emptied the grid.
   */
  #emitChange(): void {
    this.emit('quick-filter-change', { active: this.active, values: this.values });
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
      // Descending → suspended. The column and the direction both stay put.
      chip.removeAttribute('data-current');
    }

    this.#syncSortLabel(chip);
    this.emit('sort-change', { field: this.sortField, direction: this.sortDirection });
  }

  /**
   * Show the sort chip's state in its own label and icon.
   *
   * A tri-state control has to say which state it is in — the chip's on/off tint
   * alone cannot tell ascending from descending.
   */
  #syncSortLabel(chip: HTMLElement): void {
    const live = chip.hasAttribute('data-current');
    const desc = chip.dataset['direction'] === 'desc';
    const column = this.#organise.sort?.find((c) => c.field === this.#menuValue('sort'));
    chip.setAttribute('data-label', column ? `Sort: ${column.label}` : 'Sort');
    chip.setAttribute(
      'data-icon-start',
      !live
        ? 'fa-solid fa-arrow-down-a-z'
        : desc
          ? 'fa-solid fa-arrow-down-z-a'
          : 'fa-solid fa-arrow-down-a-z',
    );
  }

  /* ── Organise: the leading Group / Sort chips ───────────────────────── */

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

  /** The column the grid is grouped by, or null. */
  get groupField(): string | null {
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
        this.#organiseChip('group', 'Group', 'fa-solid fa-layer-group',
          group.map((c) => ({ value: c.field, label: c.label }))),
      );
    }
    if (sort.length) {
      // The MENU picks the column; the chip BODY cycles the direction. Listing
      // each column twice (A-Z and Z-A) doubled a long menu and made "turn the
      // sort off but keep the column" impossible to express.
      const chip = this.#organiseChip('sort', 'Sort', 'fa-solid fa-arrow-down-a-z',
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
    const tpl = this.$<HTMLTemplateElement>('template.qf-tpl')!;
    const chip = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
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
        const id = filterChip.dataset['id'] ?? '';
        filterChip.toggleAttribute('data-current', (this.values[id]?.length ?? 0) > 0);
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
