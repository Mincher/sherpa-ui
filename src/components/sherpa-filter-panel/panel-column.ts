/**
 * panel-column.ts — what the filter panel does: one portrait toolbar per scope, the View a heading, a rule, then the
 * Local Context; the header's Save, Saved and ⋮, and the panel's search. TODO 425, 435, 847 · TRAP T-the-panel-is-the-bar-in-portrait
 *
 * Map:
 * - ColumnEvent — What the filter panel says.
 * - ColumnHost — What the column asks of its filter panel.
 * - ToolbarColumn — A column's sections and its header.
 * - .wire — Hear the header's controls, once per stamp.
 * - .draw — One portrait toolbar per scope, in order — once it is open.
 * - .opened — It opened: what it was told while shut is drawn now.
 * - .sets — The sets it was last told.
 * - .drawSave — Save: off while the filters are the View's own.
 * - .drawReading — A chart's own answer, told the column as a panel: its section draws it.
 * - .saved — The reader's saved sets: the Saved menu's.
 * - .moreRows — What its ⋮ holds.
 * - .find — Find text in every section.
 */
import { VIEW } from '../../core/data/query.js';
import type { ScopeDescription } from '../../core/data/data-source.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import { SavedSets, type SavedSet } from '../../core/ui/filters-button.js';
import { extraRows, manageRows, openMore, pickMore, resetRows, type MoreRow } from '../../core/ui/more-menu.js';
import { ToolbarHeader } from '../sherpa-quick-filter-toolbar/toolbar-header.js';

/** What the filter panel says. */
export type ColumnEvent = 'filters-save' | 'filters-save-as' | 'filters-apply' | 'filters-dismiss' | 'filters-manage' | 'ai-filter-request'
  | 'quick-filter-change' | 'view-reset';

/** What the column asks of its filter panel. */
export interface ColumnHost {
  /** The toolbar: it says the column's requests, and carries its attributes. */
  readonly el: HTMLElement;
  root(): ShadowRoot;
  /** Its header's controls, where they are not in its own root: a panel's header. */
  header?(): ParentNode;
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

  constructor(host: ColumnHost) {
    this.#host = host;
    this.#saved = new SavedSets(host.el);
    this.#header = new ToolbarHeader(host, this.#saved, { saved: '.column-saved', saveAs: '.column-save-as' });
  }
  /** Its header's Saved menu, Save and filter acts — the bar's too. TODO 415 */
  readonly #header: ToolbarHeader;

  /** One element of the column's own tree. */
  #$<T extends Element = HTMLElement>(selector: string): T | null {
    return this.#host.root().querySelector<T>(selector) ?? this.#host.header?.().querySelector<T>(selector) ?? null;
  }

  /** Each scope's portrait toolbar, the View's first. */
  #bars(): Section[] {
    return [...this.#$('.view-scope')?.children ?? [], ...this.#$('.local-scopes')?.children ?? []] as Section[];
  }

  /** Hear the header's controls, once per stamp. */
  wire(): void {
    const saved = this.#$('.column-saved');
    saved?.addEventListener('menu-change', this.#onSavedPick);
    saved?.addEventListener('menu-select', this.#onSavedAction);
    this.#$('.column-suggest')?.addEventListener('button-click', () => this.#host.emit('ai-filter-request'));
    this.#$('.column-save-as')?.addEventListener('button-click', () => this.#host.emit('filters-save-as'));
    this.#$('.column-more')?.addEventListener('button-click', this.#onMore);
    this.#$('.more-menu')?.addEventListener('menu-select', this.#onMoreRow);
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
    this.#header.drawSaved();
  }

  /** It opened: what it was told while shut is drawn now. */
  opened(): void {
    if (this.#scopes.length && !this.#bars().length) this.draw(this.#scopes);
  }

  /** The sets it was last told. */
  get sets(): SavedSet[] {
    return this.#saved.all;
  }

  /** Save: off while the filters are the View's own. */
  drawSave(): void {
    this.#header.drawSave();
  }

  /** A chart's own answer — a PART's — is told a panel, not a bar: the column
   *  hands it to that chart's section. A legend's press shows there. Will,
   *  TODO 426. TRAP T-a-chart-scope-is-its-legend-field */
  drawReading(field: string, reading: FieldReading, scope: string): void {
    if (!this.#scopes.find((s) => s.scope === scope)?.part) return;
    const bar = this.#bars().find((b) => b.dataset['scope'] === scope) as (Section & { drawReading?: (f: string, r: FieldReading) => void }) | undefined;
    bar?.drawReading?.(field, reading);
  }

  /** The reader's saved sets: the Saved menu's. TRAP T-saved-filters-are-every-scope */
  saved(sets: readonly SavedSet[]): void {
    this.#saved.set(sets);
    this.#header.drawSave();
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
    return [[...resetRows(el), ...manageRows(el, this.#saved.listed)], extraRows(el)];
  }

  /** A ⋮ row: a filter action, or a page button folded away. */
  #onMoreRow = (event: Event): void => {
    const act = pickMore(this.#host.el, this.#host.root(), event);
    if (act) this.#act(act);
  };

  /** ONE search, above every scope: each section finds in its own fields. */
  #onFind = (): void => this.find(this.#$<HTMLInputElement>('.find')?.value ?? '');

  /** Find `text` in every section. */
  find(text: string): void {
    for (const bar of this.#bars()) bar.search?.(text);
  }
}
