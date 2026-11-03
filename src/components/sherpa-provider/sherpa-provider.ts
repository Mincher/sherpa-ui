/**
 * sherpa-provider — the data layer, over a SUBTREE of the page: a component
 * inside it ASKS, and this ANSWERS.
 *
 * It holds the sources it is given and joins each component that asks to the
 * one its subtree provides — by `bindSource()`, delivering through the callback
 * the component asked with — and opens and closes pages. A request that arrives
 * before any source waits, and `provide()` answers it. What it draws beside —
 * reach, notices, cards, the highlight, legend picks, Show as — is each a module
 * beside it.
 * docs/PROVIDER-DESIGN.md. TRAP T-a-component-asks-its-provider
 *
 * Map:
 * - ProvideOptions — What a provider is given: its sources by name, and its Views.
 * - OpenOptions — What `open()` is given beside a page's definition: the app's stores, and the page's Views.
 * - ProviderState — A subtree's whole state as JSON: each source's question, and the View on screen.
 */
import { SUMMARY_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import {
  DATA_CONTEXT, SOURCE_CONTEXT, type ContextRequestEvent, type DataAsk,
} from '../../core/ui/context.js';
import { report } from '../../core/data/report.js';
import { chartAxes, summariseMarked, type SummarySpec } from '../../core/data/aggregate.js';
import type { Row, Store } from '../../core/data/store.js';
import { viewLibrary, type ViewLibrary } from '../../core/browser/persist-view.js';
import type { DraftMode } from '../../core/browser/view-drafts.js';
import { Updates } from '../../core/data/updates.js';
import { openSource, savedFiltersOf, type PageDefinition } from '../../core/data/page-definition.js';
import { QueryContext } from '../../core/data/query-context.js';
import { VIEW } from '../../core/data/query.js';
import type { Failure } from '../../core/data/failure.js';
import type { DataSource, QueryState } from '../../core/data/data-source.js';
import type { Where } from '../../core/data/where.js';
import { applyState, type Populatable } from '../../core/ui/apply-state.js';
import { bindSource } from '../../core/ui/bind-source.js';
import { ProviderMode, isColumn } from './provider-mode.js';
import { ProviderPage, type Bar, type SharedStore } from './provider-page.js';
import { ProviderReach } from './provider-reach.js';
import { ProviderNews } from './provider-news.js';
import { ProviderCards } from './provider-cards.js';
import { declared, up } from './provider-declared.js';
import { ProviderHighlight } from './provider-highlight.js';
import { ProviderLegends, type Picker } from './provider-legends.js';
import { ProviderShowAs, shownAs } from './provider-show-as.js';
import type { SharedView } from '../../core/data/query-edits.js';

/** What a provider is given: its sources, by name — and, for a page with
 *  Views, the Views over them, the one on screen, and where its Query is kept. */
export interface ProvideOptions {
  sources: Record<string, DataSource>;
  /** The Views, as JSON — or a function, for a library a reader adds to. */
  views?: ViewLibrary | (() => ViewLibrary);
  /** The View on screen at the start (the URL's). The FIRST View is the page as it loads. */
  view?: string;
  /** Where the Query outlives a reload — for this View only — under `key`. */
  session?: { get(key: string): unknown; set(key: string, value: unknown): void };
  key?: string;
  /** A DRAFT per View, kept by this page's id: what a reader left on a View
   *  comes back when they return to it. `mode` is asked at each write, so a
   *  setting applies at once. None: no drafts. TRAP T-a-view-keeps-a-draft */
  drafts?: { page: string; mode: () => DraftMode };
}

/** What `open()` is given beside a page's definition: the app's stores, by the
 *  name a definition gives — and the Views the page ships, the one on screen,
 *  and where its Query is kept. */
export interface OpenOptions {
  stores: Record<string, Store>;
  /** What the page's saved Views, filters and drafts are kept under: an outlet
   *  gives its Context's name. Default: the definition's id. TODO 321 */
  key?: string;
  /** The page's own Views; a reader's saved ones join them by its key. */
  views?: ViewLibrary;
  view?: string;
  session?: ProvideOptions['session'];
  /** Keep a draft per View, for the tab: on or off, asked at each write. None:
   *  no drafts. TRAP T-a-view-keeps-a-draft */
  drafts?: () => DraftMode;
}

/** A subtree's whole state, as JSON — each source's question and the View on
 *  screen — to send out and take back in. v2: `queries`, by source name.
 *  366 step 24 · TRAP T-a-page-goes-out-as-json */
export interface ProviderState {
  v: 2;
  view?: string;
  queries: Record<string, QueryState>;
}

/** The attribute a summary needs before it asks; without it a page populates it.
 *  TRAP T-a-component-declares-its-summary */
const DECLARED_BY: Partial<Record<DataAsk['shape'], string>> = {
  aggregate: 'data-aggregate', segments: 'data-segment-field', series: 'data-over-field',
  scope: 'data-scope',
};

/** The shapes a summary is answered in. */
const SUMMARIES = new Set<DataAsk['shape']>(['aggregate', 'segments', 'series']);

/** Each summary attribute, and the key it fills in a `SummarySpec`. */
const SPEC_KEYS = [
  ['aggregate', 'data-aggregate'], ['field', 'data-field'], ['segment', 'data-segment-field'],
  ['over', 'data-over-field'], ['bucket', 'data-bucket'], ['bands', 'data-bands'],
] as const;

/** One component that asked, and how to stop answering it. */
interface Asked {
  request: ContextRequestEvent<unknown>;
  unbind?: () => void;
}

/** Where the App Context's answer is kept, in the session a page keeps in. TODO 453 */
const APP_CONTEXT_KEY = '/filters/_app';

/** What a component asks for that declares nothing: its rows, a page at a time. */
const ROWS: DataAsk = { shape: 'rows' };

/** A component that takes the `highlight`: it draws a hover's matches. */
type Highlights = Element & { drawHighlight(test: ((row: Row) => boolean) | null): void };

export class SherpaProvider extends SherpaElement {
  static override css = new URL('./sherpa-provider.css', import.meta.url);
  static override html = new URL('./sherpa-provider.html', import.meta.url);
  // How every card it draws a state on shows it. Will, TODO 59.
  static override props = {
    'data-keep-content': { type: 'boolean', kind: 'style' },
  } as const;

  /** What is new for this page — heard, and shown by every element under it that
   *  listens for its kind. Plan 687 U1 · TRAP T-a-notice-is-heard-never-ordered */
  readonly updates = new Updates();
  /** …and the elements that show it. */
  readonly #news = new ProviderNews(this, this.updates);

  /** The sources this subtree provides, by name. */
  #sources: Record<string, DataSource> = {};
  /** Every component that asked, by the element that asked. */
  #asked = new Map<Element, Asked>();

  /** Can the page's data be reached: the worst of its sources'. */
  readonly #reach = new ProviderReach({
    sources: () => Object.values(this.#sources),
    changed: (reach) => {
      this.emit('reach-change', reach);
    },
  });

  /** The card each component sits in: its data's state, its Retry, its toolbar's toggle. */
  readonly #cards = new ProviderCards({
    el: this,
    asked: () => this.#asked.keys(),
    resolve: (el) => this.#resolve(el),
    inherited: (el, name) => this.#inherited(el, name),
    bars: (slot) => this.#slotBars(slot),
    session: () => this.#session,
    pageId: () => this.#pageId,
  });

  /** What the pointer rests on, and what draws its matches. */
  readonly #highlight = new ProviderHighlight(() => this.#across);

  /** Each legend that picks its chart's values. */
  readonly #legends = new ProviderLegends({
    inherited: (el, name) => this.#inherited(el, name),
    bars: (slot) => this.#slotBars(slot),
    drawToolbars: (slot) => this.#cards.drawToolbars(slot),
    hover: (scope, field, on, value) => this.hover(scope, field, on, value),
    chips: () => this.#legendChips,
    highlightHover: () => this.#highlightHover,
  });

  /** Show as: each slot's chart, or grid, as its presentation says. */
  readonly #show = new ProviderShowAs({
    el: this,
    inherited: (el, name) => this.#inherited(el, name),
    resolve: (el) => this.#resolve(el),
    clone: (selector) => this.clone<Element>(selector),
    word: (key) => this.word(key),
    forget: (el) => {
      this.#asked.delete(el);
    },
    drawToolbars: (slot) => this.#cards.drawToolbars(slot),
    showAs: () => this.#showAs,
    pageFields: () => this.#pageFields,
  });

  constructor() {
    super();
    // From the START: a child can ask before this has rendered.
    this.addEventListener('context-request', this.#onRequest);
    // The panel's own close, and the shell's room for it.
    this.addEventListener('filter-panel-close', this.#modes.closed);
    // A bar's or the panel's ⋮ switch: this provider owns the setting. TODO 178.
    this.addEventListener('limit-options-change', (event) => {
      this.limitOptions = !!(event as CustomEvent<{ on?: boolean }>).detail?.on;
    });
    // …and its Hide invalid filters. Will, TODOs 205 and 376.
    this.addEventListener('hide-unmatched-change', (event) => {
      this.hideUnmatched = !!(event as CustomEvent<{ on?: boolean }>).detail?.on;
    });
    this.addEventListener('panel-room-change', this.#modes.room);
    // A card's Show as: its slot's presentation, kept in the Query. Will, TODO 548
    this.addEventListener('presentation-change', this.#show.picked);
    // A card's filter toolbar, shown or shut. Will, TODO 629
    this.addEventListener('filter-toolbar-change', this.#cards.toggled);
    this.addEventListener('callout-dismiss', this.#news.dismissed);
    /* A container's Retry, and a bar's Refresh: load again. Its Clear filters:
       every bar resets. TRAP T-a-container-shows-its-datas-state */
    this.addEventListener('data-refresh', (event) => {
      const from = event.target as Element;
      this.#cards.retry(from);
      this.#news.refreshed(from);
    });
  }

  /**
   * TOOLBARS or PANEL, for every page in this subtree — the filter panel open
   * and each filter bar stepped back, or the bars. The app sets it (from its
   * session); a reader's change is reported as `filter-mode-change`.
   * TRAP T-the-provider-owns-the-panel-mode
   */
  get filterMode(): 'toolbars' | 'panel' {
    return this.#modes.mode;
  }
  set filterMode(mode: 'toolbars' | 'panel') {
    this.#modes.want(mode);
  }

  /** The panel or the bars, and the buttons that switch them. A column in
   *  `[data-filter-mode="none"]` is the page's content, not the panel area:
   *  the mode never opens or shuts it. TODO 425 */
  readonly #modes = new ProviderMode({
    bars: () => this.#bars(),
    panels: () => this.#panels().filter((el) => !el.closest('[data-filter-mode="none"]')),
    found: () => [...this.querySelectorAll(':defined')]
      .filter((el) => isColumn(el) && el.closest(this.localName) === this && !el.closest('[data-filter-mode="none"]')) as never,
    button: (kind) => this.clone(`template.mode-${kind}-tpl`) as HTMLElement | null,
    rendered: () => this.rendered,
    changed: (mode) => {
      this.emit('filter-mode-change', { mode });
    },
    stepped: (bar) => {
      const slot = this.#inherited(bar, 'data-scope');
      if (slot) this.#cards.drawToolbars(slot);
    },
  });

  /** Each list filter offers only what the others leave — on every source it
   *  gives. The app sets it, from its session. TRAP T-a-ruled-out-value-is-greyed */
  get limitOptions(): boolean {
    return this.#limit;
  }
  set limitOptions(on: boolean) {
    this.#limit = on;
    for (const source of Object.values(this.#sources)) source.limitOptions = on;
    // Every bar and panel offers the switch in its ⋮, showing where it stands. TODO 178.
    this.#offerAll();
  }

  /** While Limit is on, a value it rules out is HIDDEN, not greyed — on every
   *  bar and panel. The app sets it, from its session. TODO 205 */
  get hideUnmatched(): boolean {
    return this.#hide;
  }
  set hideUnmatched(on: boolean) {
    this.#hide = on;
    this.#offerAll();
  }
  /** The app's choice: hide what Limit rules out. */
  #hide = false;

  /** Each filter control says its match counts — or, off, none. The app sets
   *  it, from its session. Will, TODO 436 */
  get results(): boolean {
    return this.#results;
  }
  set results(on: boolean) {
    this.#results = on;
    this.#offerAll();
  }
  /** The app's choice: say the match counts. */
  #results = true;

  /** A column's title counts the filters APPLIED. The app sets it, from its
   *  session. Will, TODO 436 */
  get countApplied(): boolean {
    return this.#countApplied;
  }
  set countApplied(on: boolean) {
    this.#countApplied = on;
    this.#offerAll();
  }
  /** The app's choice: count the filters applied. */
  #countApplied = false;

  /** The saved sets, the save rows and Manage are a Saved menu of their own,
   *  beside Filters — not the Filters menu's and the ⋮'s. The app sets it,
   *  from its session. Will, TODO 436 */
  get savedMenu(): boolean {
    return this.#savedMenu;
  }
  set savedMenu(on: boolean) {
    this.#savedMenu = on;
    this.#offerAll();
  }
  /** The app's choice: a Saved menu of its own. */
  #savedMenu = false;

  /** A filter set may be saved and taken at ANY scope: the View's too, every
   *  scope in one set. Off, a set is ONE local scope's — saved from its bar,
   *  listed there and taken there alone — and the View's bar and the panel save
   *  nothing. Off unless the app says. Will, TODO 485 · TRAP T-saved-filters-are-every-scope */
  get saveAnyScope(): boolean {
    return this.#saveAny;
  }
  set saveAnyScope(on: boolean) {
    this.#saveAny = on;
    this.#offerAll();
    this.#pages.savesChanged();
  }
  /** The app's choice: saved filters at any scope. */
  #saveAny = false;

  /** Each bar shows its filter Switch. The app sets it, from its session;
   *  until then a bar keeps its own `data-switchable`. Will, TODO 436 */
  get switchable(): boolean {
    return this.#switchable === true;
  }
  set switchable(on: boolean) {
    this.#switchable = on;
    this.#offerAll();
  }
  /** The app's choice: the Switch — or null, each bar's own. */
  #switchable: boolean | null = null;

  /** Each section's name at its start, in toolbar mode. The app sets it, from
   *  its session. Will, TODOs 436, 610 */
  get sectionLabels(): boolean {
    return this.#sectionLabels;
  }
  set sectionLabels(on: boolean) {
    this.#sectionLabels = on;
    this.#offerAll();
  }
  /** The app's choice: the filter toolbars' section labels. */
  #sectionLabels = true;

  /** Organise chips show their icons, and no name. The app sets it, from its session. Will, TODO 634 */
  get hideOrganiseLabels(): boolean {
    return this.#hideOrganiseLabels;
  }
  set hideOrganiseLabels(on: boolean) {
    this.#hideOrganiseLabels = on;
    this.#offerAll();
  }
  /** The app's choice: the Organise chips' names. */
  #hideOrganiseLabels = false;

  /** Each section's name over its filters, in panel mode. The app sets it,
   *  from its session. Will, TODO 436 */
  get sections(): boolean {
    return this.#sections;
  }
  set sections(on: boolean) {
    this.#sections = on;
    this.#offerAll();
  }
  /** The app's choice: the section headings. */
  #sections = true;

  /** A chip hovered previews what it matches, where its matches are counted.
   *  The app sets it, from its session. Will, TODO 449 */
  get highlightOnHover(): boolean {
    return this.#highlightHover;
  }
  set highlightOnHover(on: boolean) {
    this.#highlightHover = on;
    this.#offerAll();
    // …and a legend that picks: a rest on a row previews it. Will, TODO 495
    this.#legends.hoverable(on);
  }

  /** A legend's rows are filter chips: in its card's filter toolbar, the legend
   *  gone, where the card has one; else in the legend. Off, key rows. Off unless the
   *  app says, from its session. Will, TODOs 586, 670 */
  get legendChips(): boolean {
    return this.#legendChips;
  }
  set legendChips(on: boolean) {
    this.#legendChips = on;
    this.#legends.lay();
  }
  /** The app's choice: a legend's rows as chips. */
  #legendChips = false;
  /** The app's choice: Highlight matches on hover. */
  #highlightHover = false;

  /** The highlight reaches every component on the page — or, off (the
   *  default), those in its filter's own scope alone. The app sets it, from its
   *  session. Will, TODOs 467, 520 */
  get highlightAcross(): boolean {
    return this.#across;
  }
  set highlightAcross(on: boolean) {
    this.#across = on;
    this.#highlight.light();
  }
  /** The app's choice: highlight across every scope. */
  #across = false;

  /** What the pointer rests on while it lights its matches — a chip, one value of
   *  it, or a legend row — or null. The page's, never the Query's: nothing loads,
   *  nothing is saved. Will, TODOs 449, 655 */
  get hovered(): { scope: string; field: string; value?: string } | null {
    return this.#highlight.hovered;
  }

  /** Light what a field of a scope matches — or one value of it — as a rest on its
   *  chip or legend row does; `on: false` stops. Will, TODO 655 */
  hover(scope: string, field: string, on = true, value?: string): void {
    this.#highlight.hover(scope, field, on, value);
  }

  /** ONE Apply and Discard for a scope that waits — or, off, each field's own,
   *  in its menu or its panel section. The app sets it, from its session. Will, TODO 451 */
  get singleApply(): boolean {
    return this.#singleApply;
  }
  set singleApply(on: boolean) {
    this.#singleApply = on;
    this.#offerAll();
  }
  /** The app's choice: Single Apply & Discard. */
  #singleApply = true;

  /** A reader drags a chip, or a panel section, into its place in the query.
   *  The app sets it, from its session. Will, TODO 452 */
  get reorderFilters(): boolean {
    return this.#reorder;
  }
  set reorderFilters(on: boolean) {
    this.#reorder = on;
    this.#offerAll();
  }
  /** The app's choice: drag filters into a new order. */
  #reorder = false;

  /** A filter's menu, and its section's ⋮, offer to move it between scopes. Off
   *  unless the app says, from its session: Edit filters still adds one at
   *  another scope. Will, TODO 587 */
  get moveFilters(): boolean {
    return this.#moveFilters;
  }
  set moveFilters(on: boolean) {
    this.#moveFilters = on;
    this.#offerAll();
  }
  /** The app's choice: Move between scopes. */
  #moveFilters = false;

  /** A filter's menu, and its section's ⋮, offer "Solo this filter": every other
   *  filter in its scope goes off while it is soloed. Off unless the app says, from
   *  its session. Will, TODO 690 · TRAP T-a-solo-is-a-draft-of-one-tab */
  get allowSolo(): boolean {
    return this.#allowSolo;
  }
  set allowSolo(on: boolean) {
    this.#allowSolo = on;
    this.#offerAll();
  }
  /** The app's choice: Solo a filter. */
  #allowSolo = false;

  /** A solo switches off every other filter in EVERY scope, not its own alone —
   *  for user tests to compare the two. Will, TODO 690 */
  get soloAcrossScopes(): boolean {
    return this.#soloAcross;
  }
  set soloAcrossScopes(on: boolean) {
    this.#soloAcross = on;
    this.#offerAll();
  }
  /** The app's choice: a solo reaches every scope. */
  #soloAcross = false;

  /** Solo is an icon-only toggle in a filter menu's header, before its Advanced
   *  button, not a row. Needs `allowSolo`. Will, TODO 690 */
  get soloInHeader(): boolean {
    return this.#soloHeader;
  }
  set soloInHeader(on: boolean) {
    this.#soloHeader = on;
    this.#offerAll();
  }
  /** The app's choice: Solo in the menu's header. */
  #soloHeader = false;

  /** In the panel, each filter's heading in a column at its start, its values
   *  beside it. The app sets it, from its session. Will, TODO 460 */
  get labelColumn(): boolean {
    return this.#labelColumn;
  }
  set labelColumn(on: boolean) {
    this.#labelColumn = on;
    this.#offerAll();
  }
  /** The app's choice: headings in a column. */
  #labelColumn = true;

  /** Every value of a list filter shows its match count, picked or not, its
   *  chip on or off — counted where the rows are held. The app sets it, from its
   *  session. Will, TODO 466 */
  get countEveryValue(): boolean {
    return this.#countEvery;
  }
  set countEveryValue(on: boolean) {
    this.#countEvery = on;
    for (const source of Object.values(this.#sources)) source.countEveryValue = on;
    this.#offerAll();
  }
  /** The app's choice: count every value. */
  #countEvery = false;


  /** A grid's column heading offers Group by its field; a group row, Ungroup.
   *  On unless the app says not, from its session. Will, TODO 500 */
  get headingGroup(): boolean {
    return this.#headingGroup;
  }
  set headingGroup(on: boolean) {
    this.#headingGroup = on;
    this.#offerAll();
  }
  /** The app's choice: Group in a heading. */
  #headingGroup = true;

  /** A grid's column heading shows its buttons only while hovered or focused.
   *  On unless the app says not, from its session. Will, TODO 501 */
  get headingHover(): boolean {
    return this.#headingHover;
  }
  set headingHover(on: boolean) {
    this.#headingHover = on;
    this.#offerAll();
  }
  /** The app's choice: heading buttons on hover. */
  #headingHover = true;

  /** A grid column's `tags` draw in its cells, and its heading menu joins their
   *  lists. On unless the app says not, from its session. Will, TODO 490 */
  get multiFieldColumns(): boolean {
    return this.#multiField;
  }
  set multiFieldColumns(on: boolean) {
    this.#multiField = on;
    this.#offerAll();
  }
  /** The app's choice: multi-field columns. */
  #multiField = true;

  /** A card offers Show as, and a reader's pick is shown — off, kept and not
   *  shown. On unless the app says not, from its session. Will, TODO 582 */
  get showAs(): boolean {
    return this.#showAs;
  }
  set showAs(on: boolean) {
    this.#showAs = on;
    for (const source of Object.values(this.#sources)) source.showAs = on;
    this.#show.menus();
  }
  /** The app's choice: Show as. */
  #showAs = true;

  /** The Primary and Secondary chips are offered, and a reader's picks in them
   *  shown — off, kept and not shown. On unless the app says not, from its
   *  session. Will, TODO 583 */
  get axisChips(): boolean {
    return this.#axisChips;
  }
  set axisChips(on: boolean) {
    this.#axisChips = on;
    for (const source of Object.values(this.#sources)) source.axisChips = on;
  }
  /** The app's choice: Primary and Secondary chips. */
  #axisChips = true;

  /** The View Context is the APP Context: one answer for every page, kept in
   *  the session; a page without a field it holds shows that filter inactive.
   *  Off, each page has its own again. The app sets it, from its session.
   *  Will, TODO 453 · TRAP T-the-app-context-is-one-answer */
  get appContext(): boolean {
    return this.#appContext;
  }
  set appContext(on: boolean) {
    if (on === this.#appContext) return;
    this.#appContext = on;
    const source = this.#pages.opened?.source;
    if (!source) return;
    // The name first, on every bar; then the answer, which the bars hear as any change.
    this.#relabel(source);
    void this.#pages.drawBars(this.#pages.view).then(() => this.#pages.share(this.#sharedStore()));
  }
  /** The app's choice: share the View Context. */
  #appContext = false;
  /** Where the open page keeps its Query — and the App Context its answer. */
  #session: OpenOptions['session'];
  /** The open page's own name for its View scope. */
  #viewLabel = '';

  /** The App Context's store, while the app shares it and the page keeps. */
  #sharedStore(): SharedStore | null {
    const session = this.#session;
    if (!this.#appContext || !session) return null;
    return {
      get: () => (session.get(APP_CONTEXT_KEY) as SharedView | null | undefined) ?? null,
      set: (value) => session.set(APP_CONTEXT_KEY, value),
    };
  }

  /** The View scope's name: "App Context" while it is shared, else its own. */
  #relabel(source: DataSource): void {
    source.query.declareScope(VIEW, { label: this.#appContext ? this.word('app-context') : this.#viewLabel });
  }

  /** Every scope the page declares waits for its bar's Apply — not only the
   *  View's. The app sets it, from its session. Will, TODO 436.
   *  TRAP T-apply-and-discard-wait-for-a-change */
  get applyEvery(): boolean {
    return this.#applyEvery;
  }
  set applyEvery(on: boolean) {
    this.#applyEvery = on;
    // Off sends what waits; the View always waits.
    const query = this.#pages.opened?.query;
    for (const scope of this.#scopes) if (scope !== VIEW) query?.wait(scope, on);
  }
  /** The app's choice: every scope waits for Apply. */
  #applyEvery = false;
  /** The scopes the open page declares. */
  #scopes: string[] = [];

  /** Every control with a filter menu: a bar, a panel, a grid's headings. TODO 305 */
  #limited(): Element[] {
    return [...this.#asked.keys()].filter((el) => declared(el).takes.includes('settings'));
  }

  /** Every such control, told the app's filter settings again: a setting changed. */
  #offerAll(): void {
    for (const el of this.#limited()) this.#offerLimit(el);
  }

  /** One control, told the app's filter settings: Limit, and the counts. */
  #offerLimit(el: Element): void {
    el.setAttribute('data-limit-options', this.#limit ? 'on' : 'off');
    el.setAttribute('data-hide-unmatched', this.#hide ? 'on' : 'off');
    el.toggleAttribute('data-no-results', !this.#results);
    el.toggleAttribute('data-count-applied', this.#countApplied);
    el.toggleAttribute('data-saved-menu', this.#savedMenu);
    // Off, the View's bar and the panel save nothing. TODO 485
    if (declared(el).asks?.shape === 'scope') el.toggleAttribute('data-no-saves', !this.#saveAny && (isColumn(el) || this.#inherited(el, 'data-scope') === VIEW));
    if (this.#switchable !== null) el.toggleAttribute('data-switchable', this.#switchable);
    el.toggleAttribute('data-no-section-labels', !this.#sectionLabels);
    el.toggleAttribute('data-no-organise-labels', this.#hideOrganiseLabels);
    el.toggleAttribute('data-no-sections', !this.#sections);
    el.toggleAttribute('data-highlight-hover', this.#highlightHover);
    el.toggleAttribute('data-field-apply', !this.#singleApply);
    el.toggleAttribute('data-reorder', this.#reorder);
    el.toggleAttribute('data-move-filters', this.#moveFilters);
    el.toggleAttribute('data-allow-solo', this.#allowSolo);
    el.toggleAttribute('data-solo-across', this.#soloAcross);
    el.toggleAttribute('data-solo-header', this.#soloHeader);
    el.toggleAttribute('data-label-column', this.#labelColumn);
    el.toggleAttribute('data-every-count', this.#countEvery);
    // A grid's headings and tags. TODOs 500, 501, 490
    if (declared(el).takes.includes('headings')) {
      el.toggleAttribute('data-heading-group', this.#headingGroup);
      el.toggleAttribute('data-heading-hover', this.#headingHover);
      el.toggleAttribute('data-multi-field', this.#multiField);
    }
  }
  /** The app's choice, for every source. */
  #limit = false;

  /** Every panel that asked — a control drawn over several scopes. */
  #panels(): Array<HTMLElement & { show(): void; hide(reason?: string): void }> {
    return [...this.#asked.keys()].filter(isColumn) as never;
  }

  /** Every filter bar that asked — a control drawn one scope at a time. */
  #bars(): Element[] {
    return [...this.#asked.keys()].filter((el) => declared(el).asks?.shape === 'scope' && !isColumn(el));
  }

  /** The filter bars in a slot, in this subtree's own tree — not a panel's sections. */
  #slotBars(slot: string): Element[] {
    return [...this.#asked.keys()]
      .filter((el) => this.contains(el) && declared(el).asks?.shape === 'scope' && this.#inherited(el, 'data-scope') === slot);
  }

  /**
   * Give this subtree its sources — and its Views. Every component already
   * asking is answered again: a Context that swaps its source swaps it for
   * everything in it. Settles once the kept Query, or the start View, is on.
   * TRAP T-a-provider-keeps-the-views
   */
  provide(options: ProvideOptions): Promise<void> {
    return this.#provide(options, true);
  }

  /** `provide()`; `shut`: a page with no data shuts the panel. */
  #provide(options: ProvideOptions, shut: boolean): Promise<void> {
    // The page `open()` set up has gone, with its source.
    if (this.#pages.opened && !Object.values(options.sources).includes(this.#pages.opened.source)) {
      this.#page?.abort();
      this.#page = null;
      this.#pages.end();
    }
    this.#sources = { ...options.sources };
    // A rest on the page that went goes with it.
    this.#highlight.forget();
    for (const source of Object.values(this.#sources)) {
      source.limitOptions = this.#limit;
      source.countEveryValue = this.#countEvery;
      source.showAs = this.#showAs;
      source.axisChips = this.#axisChips;
    }
    for (const made of this.#made) if (!this.#provides(made)) this.#closeMade(made);
    // BEFORE answering: an answer binds, and a bind starts the first load.
    this.#states?.abort();
    this.#states = new AbortController();
    this.#reach.watch(Object.values(this.#sources), this.#states.signal);
    this.#cards.watch(Object.values(this.#sources), this.#states.signal);
    // Leaving for the next page keeps the page's reach: the banner does not flicker between two.
    if (shut || Object.keys(this.#sources).length) this.#reach.sync();
    for (const asked of this.#asked.values()) this.#answer(asked);
    this.#pages.stopViews();
    /* A page with NO data has no filters: the panel shuts — not the reader's
       choice, so it opens again on the next page that has some. TRAP T-navigating-sets-up-the-page */
    if (shut && !Object.keys(this.#sources).length) {
      for (const panel of this.#panels()) panel.hide('page');
    }
    // The Views are over ONE Query: a subtree whose sources share none names none. 366 step 25
    const [source, ...more] = Object.values(this.#sources);
    // A page's listening elements show what still waits.
    this.#news.draw();
    if (!options.views || !source || more.some((other) => other.query !== source.query)) return Promise.resolve();
    return this.#pages.views(source, options);
  }

  /**
   * Set up a page from its DEFINITION: its source over the app's store, every
   * filter bar drawn from its scope — the View chip, the fields it holds, what
   * it may add — and all of it provided. The source, or undefined for a page
   * with no data. TRAP T-a-page-is-its-definition
   */
  async open(definition: PageDefinition, options: OpenOptions): Promise<DataSource | undefined> {
    this.#page?.abort();
    const page = (this.#page = new AbortController());
    const def = definition.source;
    const store = def ? options.stores[def.store] : undefined;
    if (def && !store) {
      report({
        code: 'provider-unknown-store',
        message: `sherpa-provider: page "${definition.id}" names a store the app has not given, "${def.store}".`,
        at: { store: def.store },
      });
    }
    const opening = def && store ? this.#cards.opening(page.signal) : null;
    let opened: DataSource | undefined;
    let made: DataSource | undefined;
    try {
      // The Context's ONE Query: its source joins it. TRAP T-a-context-holds-the-only-query
      const source = (made = def && store ? await openSource(def, store, { query: new QueryContext() }) : undefined);
      if (source) this.#made.add(source);
      // A VIEW pick waits for its bar's ONE Apply: nothing fetches until asked. Will, TODO 406
      source?.query.wait(VIEW);
      // …and, where the app asks, every scope the page declares. Will, TODO 436
      this.#scopes = Object.keys(def?.scopes ?? {});
      this.#pageId = definition.id;
      this.#pageFields = Object.keys(def?.fields ?? {});
      if (this.#applyEvery) for (const scope of this.#scopes) source?.query.wait(scope);
      // Shared, the View is the App Context, and keeps its answer there. TODO 453
      this.#session = options.session;
      if (source) {
        this.#viewLabel = source.query.scopeLabel(VIEW);
        this.#relabel(source);
      }
      opening?.stop();
      if (page.signal.aborted) return undefined;
      if (!source || !def) {
        await this.provide({ sources: {} });
        return undefined;
      }
      const shipped = options.views;
      const key = options.key ?? definition.id;
      const library = shipped ? (): ViewLibrary => viewLibrary(key, shipped) : null;
      // The page as DEFINED, before a kept Query: what Reset all on view starts from.
      this.#pages.begin({
        id: key, store: def.store, source, query: source.query, library, initial: source.query.applied,
        savedFilters: savedFiltersOf(definition),
      });
      this.#pages.sharing = this.#sharedStore();
      // A View this page does not have is the first.
      const view = options.view && library?.()[options.view] ? options.view : undefined;
      // BEFORE the Query: a kept one is drawn onto these chips.
      await Promise.all([this.#pages.drawBars(view), this.#configure(definition.ui ?? {})]);
      if (page.signal.aborted) return undefined;
      this.#pages.listen(page.signal);
      await this.provide({
        sources: { [definition.id]: source },
        ...(library ? {
          views: library, ...(view ? { view } : {}),
          ...(options.session ? { session: options.session } : {}), key: `/filters/${key}`,
          ...(options.drafts ? { drafts: { page: key, mode: options.drafts } } : {}),
        } : {}),
      });
      if (!page.signal.aborted) opened = source;
      return opened;
    } finally {
      opening?.end(opened);
      // Left before it was provided: nothing else will close it.
      if (made && !this.#provides(made)) this.#closeMade(made);
    }
  }

  /** The sources `open()` made. Each is closed when it is no longer provided. TRAP T-a-closed-source-hears-nothing */
  #made = new Set<DataSource>();

  /** Is this source one this subtree is given now? */
  #provides(source: DataSource): boolean {
    return Object.values(this.#sources).includes(source);
  }

  /** Close a source `open()` made, and forget it. */
  #closeMade(source: DataSource): void {
    source.close();
    this.#made.delete(source);
  }

  /**
   * A page is about to be drawn from this definition, or from none: take its
   * filter mode NOW — the panel open or shut — so its content is never drawn
   * twice. `open()` follows. TRAP T-the-filter-mode-is-set-before-the-page-paints
   */
  prepare(definition: PageDefinition | null): void {
    this.#modes.page(!!definition?.source);
    // A page with no data has nothing to reach.
    if (!definition?.source) this.#reach.set({ reach: 'ok' });
  }

  /**
   * Can the page's data be reached? The worst of its sources': `ok`;
   * `unreached` — the last rows are shown, unconfirmed; `down` — nothing to
   * show. With why, while it is not ok. `reach-change` says when it moves.
   * TRAP T-the-provider-says-the-pages-reach
   */
  get reach(): { reach: 'ok' | 'unreached' | 'down'; failure?: Failure } {
    return this.#reach.now;
  }

  /** Try every source that cannot reach its store again, and ask one that may
   *  miss a writer what moved — a page's Retry, its tab shown. TRAP T-a-remote-store-says-what-changed */
  recheck(): void {
    this.#reach.recheck();
  }

  /** Leave the page, or one still opening: its source goes, and nothing in the
   *  subtree reaches it. `next`: another page follows at once, and says
   *  whether the panel stays. TRAP T-the-filter-mode-is-set-before-the-page-paints */
  close(options: { next?: boolean } = {}): void {
    this.#page?.abort();
    this.#page = null;
    void this.#provide({ sources: {} }, !options.next);
  }

  /**
   * Save what is on screen as a View of the open page, and put it on the View
   * chip. With a name, a NEW View — a name any View has already gets ` -
   * Copy-001`. With none, over the reader's own View on screen; a preset is
   * never overwritten, so that answers undefined. The saved View's id, else
   * undefined. `stay`: keep it for later, and stay on the View on screen — the
   * save before a Reset all on view.
   * TRAP T-a-view-is-json · TRAP T-a-saved-view-is-the-readers-own
   */
  saveView(label?: string, options: { stay?: boolean } = {}): Promise<string | undefined> {
    return this.#pages.saveView(label, options);
  }

  /** Delete the reader's own View — the one on screen unless named — and go to
   *  the first. A preset is never deleted. TRAP T-a-saved-view-is-the-readers-own */
  deleteView(id?: string): Promise<boolean> {
    return this.#pages.deleteView(id);
  }

  /**
   * SAVE FILTERS — every scope's filters under a name, kept with the page beside
   * its Views. A set of the same name is saved over, so a host asks first; a
   * page's own name gets a copy's. With none, over the reader's set last taken
   * ("Save <name>"); none answers undefined. The set's id. Will, TODO 105, 366.
   * Without `saveAnyScope`, ONE local scope's — `scope`, or the bar that asked
   * to save — and nothing from the View's bar or the panel. TODO 485
   * TRAP T-saved-filters-are-every-scope
   */
  saveFilters(label: string, scope?: string): string | undefined {
    return this.#pages.saveFilters(label, scope);
  }

  /** ADD a saved set to a bar: a preset of the reader's, on. `from`, the local scope
   *  of the bar it goes on where the set names several. Will, TODO 605 · TRAP T-saved-filters-are-every-scope */
  applyFilters(id: string, from?: string): boolean {
    return this.#pages.applyFilters(id, from ?? null);
  }

  /** TAKE a saved set off its bar: its chip goes, and what it held. */
  dismissFilters(id: string): boolean {
    return this.#pages.dismissFilters(id);
  }

  /** DELETE a reader's saved set, never a page's own: its chip goes, and what it held. */
  deleteFilters(id: string): boolean {
    return this.#pages.deleteFilters(id);
  }

  /** RENAME a reader's saved set — never a page's own. Its id follows its name,
   *  and a name another set has gains a copy's. Its new id. Will, TODO 427 */
  renameFilters(id: string, label: string): string | undefined {
    return this.#pages.renameFilters(id, label);
  }

  /** The page's saved sets — its own, then the reader's (`own`) — and those on a bar
   *  (`added`): what a host asks before it saves over a name. */
  get savedFilterSets(): { id: string; label: string; added: boolean; own: boolean }[] {
    return this.#pages.savedFilterSets;
  }

  /** Is the View on screen the reader's own — saved, so it can be saved over or deleted? */
  get customView(): boolean {
    return this.#pages.customView;
  }

  /**
   * Put the filters back as the View on screen DEFINES them: the page's first
   * Query, then the View's, as a pick puts it on. A filter the reader added
   * since goes. What "Reset all on view" does. TRAP T-reset-to-default-is-the-views-own
   */
  resetView(): Promise<void> {
    return this.#pages.resetView();
  }

  /** The open page: its Views, saved sets, drafts, kept Query and Reset. */
  readonly #pages = new ProviderPage({
    el: this,
    bars: () => this.#bars() as Bar[],
    panels: () => this.#panels(),
    scopeOf: (el) => this.#inherited(el, 'data-scope'),
    saveAnyScope: () => this.#saveAny,
    viewChanged: (id, elements) => {
      this.emit('view-change', { id, ...(elements ? { elements } : {}) });
    },
    // Asked only for a View bar, which means this provider is connected and drawing.
    word: async (key) => {
      await this.rendered;
      return this.word(key);
    },
  });

  /** Stops the open page's listeners. */
  #page: AbortController | null = null;

  /** Configure each component by id, through its own API, once it is defined.
   *  TRAP T-configuration-is-not-data */
  async #configure(ui: NonNullable<PageDefinition['ui']>): Promise<void> {
    await Promise.all(Object.entries(ui).map(async ([id, state]) => {
      const el = this.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (!el) {
        report({ code: 'provider-unknown-element', message: `sherpa-provider: no #${id} to configure.`, at: { id } });
        return;
      }
      const apply = (): void => {
        // A key its API does not have is said, and a value it refused: a typo did nothing, silently.
        const refused: string[] = [];
        const missing = applyState(el, { ...state }, refused).filter((key) => !refused.includes(key));
        if (missing.length) {
          report({ code: 'provider-unknown-setting', message: `sherpa-provider: #${id} has no ${missing.join(', ')}.`, at: { id, keys: missing.join(',') } });
        }
        if (refused.length) {
          report({ code: 'provider-refused-setting', message: `sherpa-provider: #${id} refused ${refused.join(', ')}.`, at: { id, keys: refused.join(',') } });
        }
      };
      const tag = el.localName;
      // A plain element is configured now; whenDefined() rejects for it.
      if (!tag.includes('-') || customElements.get(tag)) return apply();
      /* A tag no one defined would hold open() for ever: it is said, and
         configured if it is defined later. */
      report({ code: 'provider-undefined-element', message: `sherpa-provider: #${id} is a <${tag}>, which is not defined yet — is it imported? It is configured once it is.`, at: { id, tag } });
      void customElements.whenDefined(tag).then(apply);
    }));
  }

  /** The View on screen. */
  get view(): string | undefined {
    return this.#pages.view;
  }

  override onConnect(): void {
    // The network back, or the tab shown again: what could not be reached is tried again.
    this.on(window, 'online', this.#reach.back);
    this.on(document, 'visibilitychange', this.#reach.back);
    this.#news.hear();
    this.on(this.updates, 'change', this.#news.draw);
  }

  override onDisconnect(): void {
    this.#news.stop();
    this.#page?.abort();
    this.#pages.stopViews();
    for (const asked of this.#asked.values()) asked.unbind?.();
    this.#asked.clear();
  }

  /** Stops watching the sources' loading, emptiness and failure. */
  #states: AbortController | null = null;

  override onChange(name: string): void {
    if (name === 'data-keep-content') this.#cards.keepAll();
  }

  /**
   * This subtree's whole state as JSON — each source's question, and the View
   * on screen — for a link, another service or an agent.
   * TRAP T-a-page-goes-out-as-json
   */
  export(): ProviderState {
    const queries: Record<string, QueryState> = {};
    for (const [name, source] of Object.entries(this.#sources)) queries[name] = source.query.export();
    const view = this.#pages.view;
    return { v: 2, ...(view ? { view } : {}), queries };
  }

  /**
   * Take a state back in, exactly: each named source's question, and its View
   * — shown on the View chip, and known to the pick listener, so the next pick
   * of the old View is heard. A source it does not name is left as it is.
   */
  async import(state: ProviderState): Promise<void> {
    if (state?.v !== 2) {
      report({ code: 'unknown-state', message: 'sherpa-provider: not a v2 state, so nothing was taken in.' });
      return;
    }
    for (const [name, given] of Object.entries(state.queries ?? {})) {
      const source = this.#sources[name];
      if (source) await source.query.import(given);
      else report({ code: 'provider-unknown-source', message: `sherpa-provider: no source "${name}" to take in.`, at: { source: name } });
    }
    if (state.view) this.#pages.takeView(state.view);
  }

  /** A request from inside: the NEAREST provider answers, so it stops here. */
  #onRequest = (event: Event): void => {
    const request = event as ContextRequestEvent<unknown>;
    if (request.context !== DATA_CONTEXT && request.context !== SOURCE_CONTEXT) return;
    const el = request.contextTarget;
    event.stopPropagation();
    if (request.context === SOURCE_CONTEXT) {
      const source = this.#resolve(el);
      if (source) request.callback(source);
      return;
    }
    this.#asked.get(el)?.unbind?.();
    const asked: Asked = { request };
    this.#asked.set(el, asked);
    // A bar or a panel takes the mode as it asks, before it paints — not when
    // its data comes. TRAP T-the-filter-mode-is-set-before-the-page-paints
    if (declared(el).asks?.shape === 'scope') this.#modes.join(el);
    this.#answer(asked);
  };

  /** Join one asking component to its source, in the shape it declared. */
  #answer(asked: Asked): void {
    asked.unbind?.();
    delete asked.unbind;
    const { contextTarget: el, callback } = asked.request;
    // Gone from the page while it waited: forget it, never bind it.
    if (!el.isConnected) {
      this.#asked.delete(el);
      return;
    }
    const source = this.#resolve(el);
    // No source yet: it waits, and `provide()` answers it.
    if (!source) return;
    // Bound by hand already — the page's own bind stands, and is not doubled.
    if (source.boundElements.includes(el as Populatable)) return;
    const { asks = ROWS, takes } = declared(el);
    // Nothing declared: it is the page's to populate.
    const needs = DECLARED_BY[asks.shape];
    if (needs && !this.#inherited(el, needs)) {
      /* …but a legend in a chart over a ZONED number — a gauge's — picks the status
         field its zones come from, as any legend picks its values; the chart draws
         its rows. Plan 683 · TRAP T-a-status-is-worked-out-by-the-data */
      const field = asks.picks && !el.hasAttribute('data-readonly') ? this.#inherited(el, 'data-field') : null;
      const picked = field ? source.zonesOf(field)?.from ?? null : null;
      if (picked) {
        const unpick = this.#legends.picks(el as Picker, source, picked, asks.picks!);
        if (unpick) asked.unbind = unpick;
      }
      return;
    }
    const spec = SUMMARIES.has(asks.shape) ? this.#spec(el, asks, source) : undefined;
    if (SUMMARIES.has(asks.shape) && !spec) return;
    const leave = (): void => {
      asked.unbind?.();
      this.#asked.delete(el);
    };
    // One scope, or several — the panel's `data-scope="view data"`; a column's
    // are a LIST, even of one (`data-column`). TRAP T-panel-mode-hides-what-the-panel-answers
    const scopes = (this.#inherited(el, 'data-scope') ?? '').split(/\s+/).filter(Boolean);
    const scope = scopes.length > 1 || isColumn(el) ? scopes : scopes[0];
    // Its slot shows another way: swapped for that one, which asks again. Will, TODO 548
    const slot = typeof scope === 'string' ? scope : undefined;
    const kind = slot ? shownAs(el) : undefined;
    if (slot && kind && this.#show.swapped(el, slot, source)) return;
    // A grid in a slot: a pivot, or a grid made from a chart, its Primary leading. TODOs 548, 624
    const table = slot && kind === 'grid' ? this.#show.table(el, slot, source, () => asks.filters?.(el) ?? []) : undefined;
    // The fields it reads from a row: a summary's, or what it says. TRAP T-a-held-set-reads-the-pages-fields
    const fields = table?.fields ?? (spec ? [spec.field, spec.segment, spec.over].filter((f): f is string => !!f) : asks.fields?.(el));
    /* A chart over its field's ZONES is free of that field: its filter lights the
       zones and never moves the value. Will, TODO 479. TRAP T-a-chart-is-free-of-its-own-field */
    const zoned = asks.zones && spec?.field ? source.zonesOf(spec.field)?.from ?? spec.field : undefined;
    /* What it drew last, so a hover draws it again with no load: a summary marks its
       own part of each segment; a grid marks its own rows. Will, TODO 655 */
    let last: Row[] | null = null;
    const summarised = spec ? (rows: Row[], src: DataSource): unknown => {
      last = rows;
      const test = this.#highlight.test(el, scope, src);
      // A number's zones, from a status field. Plan 683 S3
      const summary = summariseMarked(rows, spec, (f) => src.valuesFor(f), (f) => src.zonesOf(f)?.zones, test);
      return zoned && summary && typeof summary === 'object' && 'zones' in summary
        ? { ...summary, picked: src.pickedFor(el as Populatable, zoned) } : summary;
    } : undefined;
    // It draws a hover's matches on its own rows. TODO 655
    const highlights = takes.includes('highlight') ? el as Highlights : null;
    const unbind = bindSource(source, el as Populatable, {
      ...(zoned ? { free: [zoned] } : {}),
      ...(spec && slot ? { shows: this.#show.shows(el), ...(asks.stacks ? { stacks: true } : {}),
        // One number: its card offers no Primary, Group or Sort. Will, TODO 696
        ...(asks.shape === 'aggregate' ? { whole: true } : {}) } : {}),
      ...(fields ? { fields } : {}),
      rows: spec || table || asks.shape === 'all' ? 'all' : 'page',
      // A pager and a filter bar steer; the rows are not theirs to draw.
      steerOnly: asks.shape === 'state' || asks.shape === 'scope',
      ...(asks.own ? { ignore: asks.own } : {}),
      ...(scope ? { scope } : {}),
      /* A summary SHOWS the data and never steers it. TRAP T-aggregation-is-data */
      ...(summarised ? { readonly: true, as: summarised } : {}),
      ...table?.options,
      // A page of rows arrives WITH its groups: a group is the data layer's.
      // TRAP T-a-group-is-a-data-layer-concept
      ...(asks.shape === 'rows' && !table
        ? { as: (rows, src) => {
          const filtered = asks.filters?.(el);
          // Its columns' values are needed now. TRAP T-a-field-reads-its-values-when-needed
          if (filtered) src.readValues(filtered);
          // A heading's Group button offers what the app's `axes` leave. Will, TODO 662
          const groupOffer = typeof scope === 'string' ? src.query.axesOf(scope, 'grid').group : undefined;
          return {
            rows,
            groups: src.state.group && src.loaded ? src.groups() : null,
            ...(groupOffer ? { groupOffer } : {}),
            /* Each FILTER as the source defines it, as a chip's is — the whole
               column too, which one page cannot say. TRAP T-a-heading-opens-the-chips-menu */
            ...(filtered ? { filters: Object.fromEntries(filtered.map((f) => [f, src.filterDef(f)])) } : {}),
          };
        } }
        : {}),
      deliver: (payload) => {
        callback(payload, leave);
        if (highlights) highlights.drawHighlight(this.#highlight.test(el, scope, source));
        // A legend drawn in its card's bar: its numbers are its value chips' counts. TODO 670
        this.#legends.counted(el, payload);
      },
      hover: ({ scope: at, field, on, value }) => this.hover(at, field, on, value),
    });
    // A hover lights it again from what it has: nothing loads. TODO 655
    if (summarised || highlights) {
      this.#highlight.follow(el, scope, source, (test) => {
        if (summarised && last) callback(summarised(last, source), leave);
        else highlights?.drawHighlight(test);
      });
    }
    this.#fetchFields(el, source);
    const unpick = spec && asks.picks ? this.#legends.picks(el as Picker, source, spec.segment ?? '', asks.picks) : undefined;
    // Its card's toggle, now its slot says what its bars draw. Will, TODO 696
    if (slot && kind) this.#cards.drawToolbars(slot);
    const unown = this.#own(el, source);
    // A chart, a grid and a legend in a slot follow its presentation. TODO 548
    const unshow = slot && (spec || kind) ? this.#show.follow(source, slot, !spec && !table, () => this.#answer(asked)) : undefined;
    const untable = table?.bound?.();
    asked.unbind = () => {
      this.#highlight.leave(el);
      untable?.();
      unshow?.();
      unown?.();
      unpick?.();
      unbind();
    };
    // No rows ever come, so it is handed its way out now.
    if (asks.shape === 'state' || asks.shape === 'scope') callback(undefined, leave);
    // …and again when answered: the next page with data opens the panel again.
    if (asks.shape === 'scope') this.#modes.join(el);
    // A bar made after the page's were drawn — a filter stack's — is drawn as they were. TODO 425
    if (asks.shape === 'scope' && !isColumn(el)) this.#pages.joined(el as unknown as Bar);
    if (takes.includes('settings')) this.#offerLimit(el);
  }

  /** The fields a component says the STORE answers — `data-fetch-fields`, or a
   *  grid column's `fetch` — told to its source. Each only turns it ON.
   *  TRAP T-a-server-field-is-asked-once-per-answer */
  #fetchFields(el: Element, source: DataSource): void {
    const named = (el.getAttribute('data-fetch-fields') ?? '').split(/\s+/).filter(Boolean);
    const columns = ((el as { columns?: Array<{ field: string; fetch?: string }> }).columns ?? [])
      .filter((c) => c.fetch === 'server').map((c) => c.field);
    for (const field of new Set([...named, ...columns])) {
      const facts = source.fieldFacts(field);
      if (facts.fetch !== 'server') source.declareField(field, { ...facts, fetch: 'server' });
    }
  }

  /**
   * A component's OWN default filter — `data-where`, a condition by field as
   * JSON — narrowing it alone, and outliving a View pick.
   * TRAP T-a-component-default-outlives-a-view · TRAP T-one-way-to-write-a-condition
   */
  #own(el: Element, source: DataSource): (() => void) | undefined {
    const raw = el.getAttribute('data-where');
    if (!raw) return undefined;
    let where: Where;
    try {
      where = JSON.parse(raw) as Where;
    } catch {
      report({
        code: 'provider-bad-where',
        message: 'sherpa-provider: data-where is not a condition by field as JSON, so this component filters nothing of its own.',
        at: { tag: el.localName, where: raw },
      });
      return undefined;
    }
    const scope = `own:${el.id || this.#ownId(el)}`;
    source.query.declareDefault(scope, source.readingsOf(where), { only: el as Populatable });
    return () => source.query.declareDefault(scope, undefined);
  }

  /** A name for a component with no id, kept while it lives. */
  #ownId(el: Element): string {
    let id = this.#ownIds.get(el);
    if (!id) this.#ownIds.set(el, (id = `${el.localName}-${++this.#owned}`));
    return id;
  }

  /** Each unnamed component's name. */
  #ownIds = new WeakMap<Element, string>();
  /** How many unnamed components have declared a filter of their own. */
  #owned = 0;

  /** An attribute from the asking element, or the nearest one above it — a
   *  legend reads its chart's, a nested pager its grid's. Stops here. */
  #inherited(el: Element, name: string): string | null {
    for (let n: Element | null = el; n && n !== this; n = up(n)) {
      const value = n.getAttribute(name);
      if (value !== null) return value;
    }
    return null;
  }

  /** The summary a component declared, as JSON — or none, and it waits. */
  #spec(el: Element, asks: DataAsk, source: DataSource): SummarySpec | undefined {
    const spec: Record<string, unknown> = { shape: asks.shape };
    for (const [key, attr] of SPEC_KEYS) {
      const value = this.#inherited(el, attr);
      if (value) spec[key] = value;
    }
    const kinds: readonly string[] = SUMMARY_PROPS['data-aggregate'].values;
    if (spec['aggregate'] && !kinds.includes(spec['aggregate'] as string)) {
      report({
        code: 'provider-unknown-aggregate',
        message: 'sherpa-provider: data-aggregate names no aggregate, so nothing is summarised.',
        at: { tag: el.localName, aggregate: String(spec['aggregate']), offers: kinds.join(',') },
      });
      return undefined;
    }
    // "0,20,40" — a histogram's edges, as numbers.
    if (typeof spec['bands'] === 'string') spec['bands'] = spec['bands'].split(',').map(Number);
    if (asks.keepEmpty) spec['keepEmpty'] = true;
    // Its field's zones come with its value. TRAP T-a-status-is-worked-out-by-the-data
    if (asks.zones) spec['zones'] = true;
    /* Its SLOT's presentation, as the Query keeps it, over its own attributes: the
       primary its first split (a bar or slice a value), the secondary a bar
       chart's stack, the group the sections in each, and its order. An axis shown
       as counts splits nothing. A legend lists what splits the chart last: the
       secondary; with none, the primary. Will, TODOs 548, 633, 653 */
    const slot = this.#inherited(el, 'data-scope');
    const shown = slot && !/\s/.test(slot) ? source.query.presented(slot, 'chart') : {};
    const host = asks.picks ? up(el) : null;
    const stacks = asks.stacks || (!!host && !!declared(host).asks?.stacks);
    const stack = stacks ? shown.secondary ?? this.#inherited(el, 'data-stack-field') : null;
    const axes = chartAxes(shown.primary ?? spec['segment'] as string | undefined, stack ?? undefined,
      stacks ? this.#inherited(el, 'data-count-axis') : null, spec['aggregate'] as string | undefined);
    if (asks.picks) Object.assign(spec, { ...axes, segment: axes.stack ?? axes.segment, stack: undefined });
    else Object.assign(spec, axes);
    if (shown.group) spec['group'] = shown.group;
    if (shown.sort) spec['sort'] = shown.sort;
    return spec as unknown as SummarySpec;
  }

  /** The open page's id: a slot's name is its own. */
  #pageId = '';

  /** The fields the open page declares: a row opened in a grid made from a chart shows them. */
  #pageFields: string[] = [];

  /**
   * The source a component's subtree provides. Named only when the subtree
   * offers two; an unnamed ask of two, or a name not offered, is LOUD — never
   * a guess. FILTER-REVIEW §12, decided 2026-09-25.
   */
  #resolve(el: Element): DataSource | null {
    const names = Object.keys(this.#sources);
    const named = this.#inherited(el, 'data-source');
    if (named) {
      const source = this.#sources[named];
      if (!source && names.length) {
        report({
          code: 'provider-unknown-source',
          message: 'sherpa-provider: this subtree provides no source by that name.',
          at: { tag: el.localName, name: named, offers: names.join(',') },
        });
      }
      return source ?? null;
    }
    if (names.length > 1) {
      report({
        code: 'provider-ambiguous',
        message: 'sherpa-provider: this subtree provides several sources, so a component must name one.',
        at: { tag: el.localName, offers: names.join(',') },
      });
      return null;
    }
    return names.length ? this.#sources[names[0]!]! : null;
  }
}

define('sherpa-provider', SherpaProvider);
