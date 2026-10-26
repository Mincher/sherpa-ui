/**
 * toolbar-column.ts — a portrait toolbar over SEVERAL scopes: the panel area's
 * column. Under ONE header — Save <name>, ONE Filters menu for every scope, ⋮
 * and the search — the View Context, a rule, then the Local Context: a
 * portrait toolbar per component scope. TODO 425, 435 · TRAP T-the-panel-is-the-bar-in-portrait
 *
 * Map:
 * - ColumnEvent — What a column says: its toolbar's own events.
 * - ColumnHost — What the column asks of its toolbar.
 * - ToolbarColumn — A column's sections and its header.
 * - .wire — Hear the header's controls, once per stamp.
 * - .draw — One portrait toolbar per scope, in order, and the Filters menu for them all — once it is open.
 * - .opened — It opened: what it was told while shut is drawn now.
 * - .present — What the filters before a scope's fields leave: an offer with nothing left is spent.
 * - .drawReading — A chart's own answer, told the column as a panel: its section draws it.
 * - .saved — The reader's saved sets: the Filters menu's Saved section, and Save <name>.
 */
import { VIEW } from '../../core/data/query.js';
import type { ScopeDescription } from '../../core/data/data-source.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import { menuFor } from '../../core/ui/filter-menu.js';
import { MANAGE_SETS, SavedSets, drawFiltersButton, savedMenuDef, type AddedFilter, type ListedFilter, type SavedSet } from '../../core/ui/filters-button.js';
import { askSwitches, drawSaveActions, extraRows, hidesUnmatched, openMore, pickMore, resetRows, saveRows } from '../../core/ui/more-menu.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';

/** What a column says: its toolbar's own events. */
export type ColumnEvent = 'filters-save' | 'filters-save-as' | 'filters-delete' | 'filters-apply' | 'filters-dismiss' | 'filters-manage'
  | 'filter-add' | 'filter-remove' | 'quick-filter-change' | 'view-reset' | 'limit-options-change' | 'hide-unmatched-change';

/** What the column asks of its toolbar. */
export interface ColumnHost {
  /** The toolbar: it says the column's requests, and carries its attributes. */
  readonly el: HTMLElement;
  root(): ShadowRoot;
  clone(selector: string): HTMLElement | null;
  emit(name: ColumnEvent, detail?: unknown, options?: { cancelable?: boolean }): void;
  toggleState(name: string, on: boolean): void;
}

/** One scope's portrait toolbar. */
type Section = HTMLElement & { search?: (text: string) => void };

/** A column's sections and its header. */
export class ToolbarColumn {
  /** The toolbar it is. */
  readonly #host: ColumnHost;
  /** The reader's saved sets, and the one taken. */
  readonly #saved: SavedSets;
  /** Each scope, as last drawn. */
  #scopes: ScopeDescription[] = [];
  /** Each scope's values left, by field. */
  #present = new Map<string, Readonly<Record<string, readonly string[]>>>();
  /** The offers spent when the Filters menu was drawn. */
  #spentFor = '';
  /** The Filters menu's rows: each value, and the scope and filter it stands for. */
  #rows = new Map<string, { scope: string; id: string }>();

  constructor(host: ColumnHost) {
    this.#host = host;
    this.#saved = new SavedSets(host.el);
  }

  /** One element of the column's own tree. */
  #$<T extends Element = HTMLElement>(selector: string): T | null {
    return this.#host.root().querySelector<T>(selector);
  }

  /** Each scope's portrait toolbar, the View's first. */
  #bars(): Section[] {
    return [...this.#$('.view-scope')?.children ?? [], ...this.#$('.local-scopes')?.children ?? []] as Section[];
  }

  /** Hear the header's controls, once per stamp. */
  wire(): void {
    const filters = this.#$('.column-filters');
    filters?.addEventListener('menu-change', this.#onFiltersCommit);
    filters?.addEventListener('menu-select', this.#onFilterAction);
    const saved = this.#$('.column-saved');
    saved?.addEventListener('menu-change', this.#onSavedPick);
    saved?.addEventListener('menu-select', this.#onSavedAction);
    this.#$('.column-save')?.addEventListener('button-click', () => this.#host.emit('filters-save'));
    this.#$('.column-save-as')?.addEventListener('button-click', () => this.#host.emit('filters-save-as'));
    this.#$('.column-more')?.addEventListener('button-click', this.#onMore);
    this.#$('.more-menu')?.addEventListener('menu-select', this.#onMoreRow);
    this.#$('.more-menu')?.addEventListener('menu-change', this.#onMoreSwitch);
    for (const type of ['input', 'change']) this.#$('.find')?.addEventListener(type, this.#onFind);
    this.draw(this.#scopes);
    this.#drawSave();
  }

  /** One portrait toolbar per scope, in order; each asks for its own scope, as
   *  any toolbar does. One already here is not moved, so it keeps what the
   *  reader did. A chart's PART adds nothing: no actions. TRAP T-a-chart-scope-is-its-legend-field
   *  SHUT, it only keeps them: a section asks for data, and a page in toolbars
   *  mode should not wait on a column no one sees. TRAP T-a-shut-column-draws-nothing */
  draw(scopes: readonly ScopeDescription[]): void {
    this.#scopes = [...scopes];
    if (!this.#host.el.hasAttribute('open')) return;
    const view = this.#$('.view-scope');
    const list = this.#$('.local-scopes');
    if (!view || !list) return;
    const had = new Map(this.#bars().map((bar) => [bar.dataset['scope'] ?? '', bar]));
    let i = 0;
    for (const scope of scopes) {
      const bar = had.get(scope.scope) ?? this.#host.clone('template.section-tpl');
      if (!bar) return;
      had.delete(scope.scope);
      bar.dataset['scope'] = scope.scope;
      bar.toggleAttribute('data-no-actions', !!scope.part);
      // The View's is a heading, not an accordion; the rest are the Local Context. Will, TODO 435
      if (scope.scope === VIEW) {
        bar.toggleAttribute('data-flat', true);
        if (view.firstElementChild !== bar) view.prepend(bar);
        continue;
      }
      if (list.children[i] !== bar) list.insertBefore(bar, list.children[i] ?? null);
      i++;
    }
    for (const gone of had.values()) gone.remove();
    this.#drawFilters();
  }

  /** It opened: what it was told while shut is drawn now. */
  opened(): void {
    if (this.#scopes.length && !this.#bars().length) this.draw(this.#scopes);
  }

  /** What the filters before a scope's fields leave: the Filters menu is drawn
   *  again only when an offer's being spent moved. */
  present(present: Readonly<Record<string, readonly string[]>>, scope: string): void {
    this.#present.set(scope, present);
    if (this.#spentKey() !== this.#spentFor) this.#drawFilters();
  }

  /** A chart's own answer — a PART's — is told a panel, not a bar: the column
   *  hands it to that chart's section. A legend's press shows there. Will,
   *  TODO 426. TRAP T-a-chart-scope-is-its-legend-field */
  drawReading(field: string, reading: FieldReading, scope: string): void {
    if (!this.#scopes.find((s) => s.scope === scope)?.part) return;
    const bar = this.#bars().find((b) => b.dataset['scope'] === scope) as (Section & { drawReading?: (f: string, r: FieldReading) => void }) | undefined;
    bar?.drawReading?.(field, reading);
  }

  /** The reader's saved sets: the Filters menu's Saved section, and Save <name>. TRAP T-saved-filters-are-every-scope */
  saved(sets: readonly SavedSet[]): void {
    this.#saved.set(sets);
    this.#drawSave();
    this.#drawFilters();
  }

  /** Is an offer spent — no value left under the filters before it? (349) */
  #spent(scope: string, field: string): boolean {
    return this.#present.get(scope)?.[field]?.length === 0;
  }

  /** Each scope's offers spent now, as one string. */
  #spentKey(): string {
    return this.#scopes.flatMap((s) => s.available.filter((f) => this.#spent(s.scope, f.id)).map((f) => `${s.scope}:${f.id}`)).join();
  }

  /**
   * THE ONE Filters menu, for every scope: what each holds, then what may be
   * added — each offered once, to the first component scope that offers it,
   * else the View — every row saying its scope. Then the saved sets and the
   * filter actions. TRAP T-the-add-menu-is-the-whole-list
   */
  #drawFilters(): void {
    const btn = this.#$('.column-filters');
    if (!btn) return;
    this.#rows.clear();
    const row = (scope: string, id: string): string => {
      this.#rows.set(`${scope}:${id}`, { scope, id });
      return `${scope}:${id}`;
    };
    const added: AddedFilter[] = this.#scopes.flatMap((s) => s.filters.filter((f) => f.removable)
      .map((f) => ({ id: row(s.scope, f.id), label: f.label, note: s.label, removable: true, hidden: false })));
    // A chart's own field is that chart's: it stops no scope offering it.
    const taken = new Set(this.#scopes.filter((s) => !s.part).flatMap((s) => s.filters.map((f) => f.id)));
    const offer: ListedFilter[] = [];
    for (const s of [...this.#scopes.filter((x) => x.scope !== VIEW), ...this.#scopes.filter((x) => x.scope === VIEW)]) {
      for (const f of s.available) {
        if (taken.has(f.id)) continue;
        taken.add(f.id);
        offer.push({ id: row(s.scope, f.id), label: f.label, note: s.label, ...(this.#spent(s.scope, f.id) ? { spent: true } : {}) });
      }
    }
    this.#spentFor = this.#spentKey();
    // Split, the sets are the Saved menu's. TODO 436
    const split = this.#host.el.hasAttribute('data-saved-menu');
    const saveable = this.#host.el.hasAttribute('data-saveable');
    const { menu, items } = menuFor(this.#host.root(), drawFiltersButton(btn, added, offer, split ? [] : this.#saved.listed, !split && saveable));
    menu.setAttribute('data-align', 'end');
    menu.toggleAttribute('data-hide-unavailable', hidesUnmatched(this.#host.el));
    btn.append(menu);
    menu.items?.(items);
    this.#drawSaved();
  }

  /** THE SAVED MENU, where the app splits it from Filters: the sets — a tick
   *  takes one — then the save rows, then Manage. Will, TODO 436 */
  #drawSaved(): void {
    this.#host.toggleState('has-sets', this.#saved.listed.length > 0);
    const btn = this.#$('.column-saved');
    btn?.querySelector('sherpa-menu')?.remove();
    if (!btn || !this.#host.el.hasAttribute('data-saved-menu')) return;
    const { menu, items } = menuFor(this.#host.root(), savedMenuDef(this.#saved.listed));
    menu.setAttribute('data-align', 'end');
    btn.append(menu);
    menu.items?.(items);
    const manage = this.#host.el.hasAttribute('data-saveable') && this.#saved.listed.some((s) => s.own);
    drawSaveActions(this.#host.el, this.#host.root(), menu, this.#saved.applied, manage);
  }

  /** A saved set ticked in the Saved menu takes it; unticked, takes it off. TODO 436 */
  #onSavedPick = (event: Event): void => {
    const set = this.#saved.pick(new Set(((event as CustomEvent).detail?.values ?? []) as string[]));
    if (set.apply) this.#host.emit('filters-apply', { id: set.apply });
    else if (set.dismiss) this.#host.emit('filters-dismiss', { id: set.dismiss });
  };

  /** A Saved menu row: a save row, or Manage. TODO 436 */
  #onSavedAction = (event: Event): void => {
    const act = String((event as CustomEvent).detail?.value ?? '');
    if (!act.startsWith('filters-')) return;
    event.stopPropagation();
    if (act === MANAGE_SETS) this.#host.emit(MANAGE_SETS);
    else this.#act(act);
  };

  /** "Save <name>" while a saved set is taken. Will, 366 */
  #drawSave(): void {
    const applied = this.#saved.applied;
    this.#host.toggleState('set-taken', !!applied);
    const name = this.#$('.column-save .save-name');
    if (name) name.textContent = applied?.label ?? '';
    this.#$('.column-save')?.toggleAttribute('data-status', false);
    if (applied) this.#$('.column-save')?.setAttribute('data-status', 'active');
  }

  /** TICKED IS HELD: a row unticked is a remove, one ticked an add — each
   *  asked of the scope its row names. A saved set's row takes it. TODO 105, 366 */
  #onFiltersCommit = (event: Event): void => {
    const want = new Set(((event as CustomEvent).detail?.values ?? []) as string[]);
    const set = this.#saved.pick(want);
    if (set.apply) this.#host.emit('filters-apply', { id: set.apply });
    else if (set.dismiss) this.#host.emit('filters-dismiss', { id: set.dismiss });
    const adds = new Map<string, string[]>();
    for (const [value, { scope, id }] of this.#rows) {
      const held = this.#scopes.find((s) => s.scope === scope)?.filters.some((f) => f.id === id && f.removable) ?? false;
      if (held && !want.has(value)) this.#host.emit('filter-remove', { scope, id });
      if (!held && want.has(value)) adds.set(scope, [...adds.get(scope) ?? [], id]);
    }
    for (const [scope, ids] of adds) this.#host.emit('filter-add', { scope, ids });
  };

  /** Manage Saved Filters, the Filters menu's one action. TODO 427 */
  #onFilterAction = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== MANAGE_SETS) return;
    event.stopPropagation();
    this.#$<SherpaMenu>('.column-filters sherpa-menu')?.hide?.();
    this.#host.emit(MANAGE_SETS);
  };

  /** A filter action from the ⋮: Reset, Reset all on view, and the save rows. Will, TODO 430 */
  #act(act: string): void {
    if (act === 'reset') {
      const request = this.#scopes.map((s) => ({ scope: s.scope, reset: { organise: true } }));
      this.#host.emit('quick-filter-change', { scope: 'column', request, active: [], values: {} });
    }
    // Only the provider knows the View's own filters; CANCELABLE. TRAP T-reset-to-default-is-the-views-own
    else if (act === 'reset-default') this.#host.emit('view-reset', {}, { cancelable: true });
    else if (act === 'filters-delete') this.#host.emit('filters-delete', { id: this.#saved.applied?.id });
    else if (act === 'filters-save-as') this.#host.emit('filters-save-as');
    else if (act === 'filters-save') this.#host.emit('filters-save');
  }

  /** ⋮ — Reset and Save filters (Will, TODO 430), the page's buttons folded
   *  away, then Limit. No Suggest filters or Refresh: those are the App
   *  Header's. Will, TODO 425 G11 */
  #onMore = (event: Event): void => {
    const el = this.#host.el;
    const saves = el.hasAttribute('data-saved-menu') ? [] : saveRows(el, this.#saved.applied);
    openMore(el, this.#host.root(), event.currentTarget as HTMLElement, [resetRows(el), saves, extraRows(el)]);
  };

  /** A ⋮ row: a filter action, or a page button folded away. */
  #onMoreRow = (event: Event): void => {
    const act = pickMore(this.#host.el, this.#host.root(), event);
    if (act) this.#act(act);
  };

  /** The ⋮ menu's switch: a REQUEST — the host owns whether filters limit each other. */
  #onMoreSwitch = (event: Event): void => askSwitches(this.#host.el, event, (name, on) => this.#host.emit(name, { on }));

  /** ONE search, above every scope: each section finds in its own fields. */
  #onFind = (): void => {
    const text = this.#$<HTMLInputElement>('.find')?.value ?? '';
    for (const bar of this.#bars()) bar.search?.(text);
  };
}
