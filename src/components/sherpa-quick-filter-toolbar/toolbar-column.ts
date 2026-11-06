/**
 * toolbar-column.ts — a portrait toolbar over SEVERAL scopes: the panel area's
 * column. Under ONE header — ONE Filters menu for every scope, ⋮
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
 * - .saved — The reader's saved sets: the Filters menu's Saved section.
 * - .moreRows — What its ⋮ holds.
 */
import { VIEW } from '../../core/data/query.js';
import type { ScopeDescription } from '../../core/data/data-source.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import { SavedSets, drawFiltersButton, hangFiltersMenu, type AddedFilter, type ListedFilter, type SavedSet } from '../../core/ui/filters-button.js';
import { askSwitches, extraRows, hidesUnmatched, manageRows, openMore, pickMore, resetRows, saveRows, type MoreRow } from '../../core/ui/more-menu.js';
import { FilterHostController } from '../../core/ui/filter-host-controller.js';
import { ToolbarHeader } from './toolbar-header.js';

/** What a column says: its toolbar's own events. */
export type ColumnEvent = 'filters-save' | 'filters-save-as' | 'filters-apply' | 'filters-dismiss' | 'filters-manage' | 'ai-filter-request'
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
  /** What each scope is told, by field: its sections place the chips. Plan 695 P2 */
  #told = new Map<string, FilterHostController>();
  /** The offers spent when the Filters menu was drawn. */
  #spentFor = '';
  /** The Filters menu's rows: each value, and the scope and filter it stands for. */
  #rows = new Map<string, { scope: string; id: string }>();

  constructor(host: ColumnHost) {
    this.#host = host;
    this.#saved = new SavedSets(host.el);
    this.#header = new ToolbarHeader(host, this.#saved, { saved: '.column-saved', saveAs: '.column-save-as' });
  }
  /** Its header's Saved menu, Save and filter acts — the bar's too. TODO 415 */
  readonly #header: ToolbarHeader;

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
    // Its Reset rows say, as it opens, whether there is anything to reset. TODO 454
    const saved = this.#$('.column-saved');
    saved?.addEventListener('menu-change', this.#onSavedPick);
    saved?.addEventListener('menu-select', this.#onSavedAction);
    this.#$('.column-suggest')?.addEventListener('button-click', () => this.#host.emit('ai-filter-request'));
    this.#$('.column-save-as')?.addEventListener('button-click', () => this.#host.emit('filters-save-as'));
    this.#$('.column-more')?.addEventListener('button-click', this.#onMore);
    this.#$('.more-menu')?.addEventListener('menu-select', this.#onMoreRow);
    this.#$('.more-menu')?.addEventListener('menu-change', this.#onMoreSwitch);
    for (const type of ['input', 'change']) this.#$('.find')?.addEventListener(type, this.#onFind);
    this.draw(this.#scopes);
    this.#header.drawSave();
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
    let told = this.#told.get(scope);
    if (!told) this.#told.set(scope, told = new FilterHostController({ el: this.#host.el, places: () => [] }));
    told.drawPresent(present);
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

  /** The reader's saved sets: the Filters menu's Saved section. TRAP T-saved-filters-are-every-scope */
  saved(sets: readonly SavedSet[]): void {
    this.#saved.set(sets);
    this.#header.drawSave();
    this.#drawFilters();
  }

  /** Is an offer spent — no value left under the filters before it? (349) */
  #spent(scope: string, field: string): boolean {
    return this.#told.get(scope)?.spent(field) ?? false;
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
    const def = drawFiltersButton(btn, added, offer, split ? [] : this.#saved.listed);
    const menu = hangFiltersMenu(this.#host.root(), btn, def, hidesUnmatched(this.#host.el));
    menu.setAttribute('data-align', 'end');
    this.#header.drawSaved();
  }

  /** A saved set ticked in the Saved menu takes it; unticked, takes it off. TODO 436 */
  #onSavedPick = (event: Event): void => {
    this.#header.pick(new Set((event as CustomEvent).detail?.values ?? []));
  };

  /** A Saved menu row: a save row, or Manage. TODO 436 */
  #onSavedAction = (event: Event): void => {
    const act = String((event as CustomEvent).detail?.value ?? '');
    if (!act.startsWith('filters-')) return;
    event.stopPropagation();
    this.#act(act);
  };

  /** TICKED IS HELD: a row unticked is a remove, one ticked an add — each
   *  asked of the scope its row names. A saved set's row takes it. TODO 105, 366 */
  #onFiltersCommit = (event: Event): void => {
    const want = new Set(((event as CustomEvent).detail?.values ?? []) as string[]);
    /* WHAT IS HELD NOW, before a set is taken: a chip it adds is no row the reader
       unticked. TODO 597 */
    const removes: { scope: string; id: string }[] = [];
    const adds = new Map<string, string[]>();
    for (const [value, { scope, id }] of this.#rows) {
      const held = this.#scopes.find((s) => s.scope === scope)?.filters.some((f) => f.id === id && f.removable) ?? false;
      if (held && !want.has(value)) removes.push({ scope, id });
      if (!held && want.has(value)) adds.set(scope, [...adds.get(scope) ?? [], id]);
    }
    this.#header.pick(want);
    for (const remove of removes) this.#host.emit('filter-remove', remove);
    for (const [scope, ids] of adds) this.#host.emit('filter-add', { scope, ids });
  };

  /** A filter action: Reset and Reset to view defaults, from the ⋮; the save rows too (TODO 430). */
  #act(act: string): void {
    if (act === 'reset') {
      const request = this.#scopes.map((s) => ({ scope: s.scope, reset: { organise: true } }));
      this.#host.emit('quick-filter-change', { scope: 'column', request, active: [], values: {} });
    }
    // Reset to view defaults, and the save rows: the header's, as the bar's. TODO 415
    else this.#header.act(act);
  }

  /** ⋮ — Save filters (Will, TODO 430), and Reset and Manage Saved Filters, the page's buttons folded
   *  away, then Limit. No Suggest filters or Refresh: those are the App
   *  Header's. Will, TODO 425 G11 */
  #onMore = (event: Event): void => {
    openMore(this.#host.el, this.#host.root(), event.currentTarget as HTMLElement, this.moreRows());
  };

  /** What its ⋮ holds: Reset and Manage Saved Filters lead. Will, TODO 454, 11-06 */
  moreRows(): MoreRow[][] {
    const el = this.#host.el;
    return [[...resetRows(el), ...manageRows(el, this.#saved.listed)], el.hasAttribute('data-saved-menu') ? [] : saveRows(el), extraRows(el)];
  }

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
