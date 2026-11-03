/**
 * sherpa-provider — the data layer, over a SUBTREE of the page: a component
 * inside it ASKS, and this ANSWERS.
 *
 * A thin DOM door onto the DOM-free data layer. It holds the sources it is
 * given and joins each component that asks to the one its subtree provides —
 * by `bindSource()`, delivering through the callback the component asked with. A
 * request that arrives before any source waits, and `provide()` answers it.
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
import { chartAxes, summarise, summariseMarked, type SummarySpec } from '../../core/data/aggregate.js';
import type { ChartDatum } from '../../core/data/chart-datum.js';
import { bindSelection } from '../../core/data/bind-selection.js';
import { groupRows, groupSummaries, valueKey, type Row, type Store } from '../../core/data/store.js';
import { viewLibrary, type ViewLibrary } from '../../core/browser/persist-view.js';
import type { DraftMode } from '../../core/browser/view-drafts.js';
import { hearUpdates } from '../../core/browser/updates.js';
import { Updates, type NewsKind } from '../../core/data/updates.js';
import { openSource, savedFiltersOf, type PageDefinition } from '../../core/data/page-definition.js';
import { QueryContext, type QueryChangeDetail } from '../../core/data/query-context.js';
import { VIEW, type Presentation } from '../../core/data/query.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import type { Failure } from '../../core/data/failure.js';
import type { DataChangeDetail, DataSource, QueryState } from '../../core/data/data-source.js';
import type { Where } from '../../core/data/where.js';
import { applyState, type Populatable } from '../../core/ui/apply-state.js';
import { bindSource } from '../../core/ui/bind-source.js';
import { ProviderMode, isColumn } from './provider-mode.js';
import { ProviderPage, type Bar, type SharedStore } from './provider-page.js';
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

/** A component that picks values, through its `picked` door. */
type Picker = Element & { picked: string[] };

/** The element above this one, across a shadow root. */
const up = (el: Element): Element | null =>
  el.parentElement ?? ((el.getRootNode() as ShadowRoot).host ?? null);

/** A load quicker than this shows no spinner, so nothing flashes. */
const SLOW_LOAD = 300;

/** The card a component sits in, across shadow roots, or null. */
const containerOf = (el: Element): HTMLElement | null => {
  for (let at = up(el); at; at = up(at)) if (at.localName === 'sherpa-container') return at as HTMLElement;
  return null;
};

/** What a reader calls a component: its own `aria-label`, or the heading of
 *  the card it sits in. TRAP T-a-scope-is-named-for-its-content */
const nameOf = (el: Element): string =>
  el.getAttribute('aria-label')
  ?? containerOf(el)?.querySelector(':scope > [slot="header"]')?.getAttribute('data-heading')
  ?? '';

/** The component each chart presentation is drawn by, loaded when first shown;
 *  its prototype, legend and all, is the template's `shown-<kind>-tpl`. Will, TODO 548 */
const SHOWN_BY: Readonly<Record<string, { tag: string; load: () => Promise<unknown> }>> = {
  bar: { tag: 'sherpa-barchart', load: () => Promise.all([import('../sherpa-barchart/sherpa-barchart.js'), import('../sherpa-chart-legend/sherpa-chart-legend.js')]) },
  donut: { tag: 'sherpa-radial-chart', load: () => Promise.all([import('../sherpa-radial-chart/sherpa-radial-chart.js'), import('../sherpa-chart-legend/sherpa-chart-legend.js')]) },
  pie: { tag: 'sherpa-radial-chart', load: () => Promise.all([import('../sherpa-radial-chart/sherpa-radial-chart.js'), import('../sherpa-chart-legend/sherpa-chart-legend.js')]) },
  grid: { tag: 'sherpa-data-grid', load: () => import('../sherpa-data-grid/sherpa-data-grid.js') },
};

/** The presentation a component draws, where it is one. A gauge and a line chart
 *  are only ever the page's own, put back. */
function shownAs(el: Element): string | undefined {
  if (el.localName === 'sherpa-gauge-chart') return 'gauge';
  if (el.localName === 'sherpa-line-chart') return 'line';
  if (el.localName === 'sherpa-radial-chart') return el.getAttribute('data-type') ?? 'donut';
  return Object.keys(SHOWN_BY).find((kind) => SHOWN_BY[kind]?.tag === el.localName);
}

/** A grid's column, as a pivot hands it on to a row's sub-grid. */
type GridColumnLike = { field: string; header?: string; type?: string; tags?: string[] };

/** A row's own rows, by its first column's value, a group's together where it
 *  groups, and their groups: what each row's sub-grid draws. TODOs 574, 661 */
function opened(rows: readonly Row[], lead: string, group: string | null | undefined): { rows: Record<string, Row[]>; groups?: Record<string, ReturnType<typeof groupSummaries>> } {
  const opens = groupRows(rows, lead).map((g) => ({
    key: g.key, rows: group ? groupRows(g.rows, group).flatMap((part) => part.rows) : g.rows,
  }));
  return {
    rows: Object.fromEntries(opens.map((o) => [o.key, o.rows])),
    ...(group ? { groups: Object.fromEntries(opens.map((o) => [o.key, groupSummaries(o.rows, group)])) } : {}),
  };
}

/** What a pivot steers: a filter, from a heading or a cell — its own or a row's
 *  sub-grid's — and its sub-grids' sort and group. TODOs 571, 574 */
const PIVOT_STEERS = ['column-filter-change', 'filter-apply', 'filter-discard', 'sort-change', 'group-change'] as const;

/** What a chart made from a grid, or a grid from a chart, keeps of it: where it sits, and its slot. */
const KEPT_ACROSS = ['slot', 'data-grow', 'data-scope', 'style'] as const;

/** What a chart's axes read: a grid made from it carries them, to name its columns. TODO 622 */
const CHART_AXES = ['data-over-field', 'data-stack-field', 'data-count-axis', 'data-field', 'data-aggregate'] as const;

/** What only a line chart reads: another chart made from it drops them. */
const LINE_ONLY = ['data-type', 'data-over-field', 'data-bucket'] as const;

/** One component that asked, and how to stop answering it. */
interface Asked {
  request: ContextRequestEvent<unknown>;
  unbind?: () => void;
}

/** Where the App Context's answer is kept, in the session a page keeps in. TODO 453 */
const APP_CONTEXT_KEY = '/filters/_app';

/** The kinds of news an element listens for. */
const kindsOf = (el: HTMLElement): NewsKind[] => (el.dataset['listens'] ?? '').split(/\s+/).filter(Boolean) as NewsKind[];

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

  /** The sources this subtree provides, by name. */
  #sources: Record<string, DataSource> = {};
  /** Every component that asked, by the element that asked. */
  #asked = new Map<Element, Asked>();
  /** The presentation a swapped component's page drew it as: what Default goes back to. */
  #authored = new WeakMap<Element, string>();
  /** Each slot's own element, kept aside while another shows its data. */
  #parked = new Map<string, Element>();

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
    this.addEventListener('presentation-change', this.#onShowAs);
    // A card's filter toolbar, shown or shut. Will, TODO 629
    this.addEventListener('filter-toolbar-change', this.#onToolbarToggle);
    this.addEventListener('callout-dismiss', this.#onNoticeDismiss);
    /* A container's Retry, and a bar's Refresh: load again. Its Clear filters:
       every bar resets. TRAP T-a-container-shows-its-datas-state */
    this.addEventListener('data-refresh', (event) => {
      // A card reloads the sources of what it holds, as its state is theirs;
      // an unclear ask loads nothing — #resolve says so.
      const from = event.target as Element;
      const held = [...this.#asked.keys()].filter((el) => containerOf(el) === from).map((el) => this.#resolve(el));
      for (const source of new Set(held.length ? held : [this.#resolve(from)])) void source?.load({ force: true });
      // A listening element's own Refresh takes the waiting rows in.
      if (from.hasAttribute?.('data-listens')) this.updates.take('data');
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
      if (slot) this.#drawToolbars(slot);
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
    for (const el of this.#pickers.keys()) el.toggleAttribute('data-highlight-hover', on);
  }
  /** Each legend that picks — a field's values, as a chip's — and how it lays out its chips. */
  #pickers = new Map<Element, () => void>();
  /** Each legend drawn in its card's bar, telling the bar its numbers. TODO 670 */
  #legendCounts = new Map<Element, (payload: unknown) => void>();

  /** A legend's rows are filter chips: in its card's filter toolbar, the legend
   *  gone, where the card has one; else in the legend. Off, key rows. Off unless the
   *  app says, from its session. Will, TODOs 586, 670 */
  get legendChips(): boolean {
    return this.#legendChips;
  }
  set legendChips(on: boolean) {
    this.#legendChips = on;
    for (const lay of this.#pickers.values()) lay();
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
    this.#light();
  }
  /** The app's choice: highlight across every scope. */
  #across = false;

  /** What the pointer rests on while it lights its matches: a chip, one value of
   *  it, or a legend row. The page's, never the Query's: nothing loads, nothing is
   *  saved. Will, TODOs 449, 655 · TRAP T-a-hovered-chip-previews-the-highlight */
  #hovered: { scope: string; field: string; value?: string } | null = null;
  /** This hover's test, asked once of each source. */
  #tests = new Map<DataSource, ((row: Row) => boolean) | null>();
  /** Each component that draws a hover's matches, and how it draws them again. */
  #lights = new Map<Element, () => void>();
  /** The test each of them was last drawn with. */
  #shown = new WeakMap<Element, ((row: Row) => boolean) | null>();

  /** What the pointer rests on while it lights its matches, or null. */
  get hovered(): { scope: string; field: string; value?: string } | null {
    return this.#hovered ? { ...this.#hovered } : null;
  }

  /** Light what a field of a scope matches — or one value of it — as a rest on its
   *  chip or legend row does; `on: false` stops. Will, TODO 655 */
  hover(scope: string, field: string, on = true, value?: string): void {
    const was = this.#hovered;
    if (on ? was?.scope === scope && was.field === field && was.value === value : !was || was.scope !== scope || was.field !== field) return;
    this.#hovered = on ? { scope, field, ...(value != null ? { value } : {}) } : null;
    this.#tests.clear();
    this.#light();
  }

  /** Every component that draws the hover, drawn again where its test changed. */
  #light(): void {
    for (const relight of this.#lights.values()) relight();
  }

  /** The hover's test for one component, where it reaches it: across every scope,
   *  from the View, in its own scope, or a chart's own part. TODOs 467, 520, 529.
   *  TRAP T-the-highlight-reaches-the-whole-page */
  #lit(el: Element, scope: string | readonly string[] | undefined, source: DataSource): ((row: Row) => boolean) | null {
    const hovered = this.#hovered;
    if (!hovered) return null;
    const reaches = this.#across || hovered.scope === VIEW || source.query.partFacts(hovered.scope)?.only === el
      || (typeof scope === 'string' ? scope === hovered.scope : !!scope?.includes(hovered.scope));
    if (!reaches) return null;
    if (!this.#tests.has(source)) this.#tests.set(source, source.highlightTest(hovered));
    return this.#tests.get(source) ?? null;
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
    for (const host of this.querySelectorAll('[data-presentation]')) {
      const slot = this.#inherited(host, 'data-scope');
      const source = this.#resolve(host);
      if (slot && source) host.setAttribute('data-presentation', this.#showAsOf(source, slot));
    }
  }
  /** The app's choice: Show as. */
  #showAs = true;

  /** What a slot's Show as says: what it shows — or off. TODO 582 */
  #showAsOf(source: DataSource, slot: string): string {
    return this.#showAs ? source.query.presentation(slot).kind ?? 'default' : 'off';
  }

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
    return [...this.#asked.keys()].filter((el) => 'drawScope' in el || 'drawPresent' in el);
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
    if ('drawScope' in el) el.toggleAttribute('data-no-saves', !this.#saveAny && (isColumn(el) || this.#inherited(el, 'data-scope') === VIEW));
    if (this.#switchable !== null) el.toggleAttribute('data-switchable', this.#switchable);
    el.toggleAttribute('data-no-section-labels', !this.#sectionLabels);
    el.toggleAttribute('data-no-organise-labels', this.#hideOrganiseLabels);
    el.toggleAttribute('data-no-sections', !this.#sections);
    el.toggleAttribute('data-highlight-hover', this.#highlightHover);
    el.toggleAttribute('data-field-apply', !this.#singleApply);
    el.toggleAttribute('data-reorder', this.#reorder);
    el.toggleAttribute('data-move-filters', this.#moveFilters);
    el.toggleAttribute('data-label-column', this.#labelColumn);
    el.toggleAttribute('data-every-count', this.#countEvery);
    // A grid's headings and tags. TODOs 500, 501, 490
    if ('columnClause' in el) {
      el.toggleAttribute('data-heading-group', this.#headingGroup);
      el.toggleAttribute('data-heading-hover', this.#headingHover);
      el.toggleAttribute('data-multi-field', this.#multiField);
    }
  }
  /** The app's choice, for every source. */
  #limit = false;

  /** Every panel that asked — a control drawn over several scopes. */
  #panels(): Array<HTMLElement & { show?: () => void; hide?: (reason?: string) => void }> {
    return [...this.#asked.keys()].filter(isColumn) as never;
  }

  /** Every filter bar that asked — a control drawn one scope at a time. */
  #bars(): Element[] {
    return [...this.#asked.keys()].filter((el) => 'drawScope' in el && !isColumn(el));
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
    this.#hovered = null;
    this.#tests.clear();
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
    this.#watchStates(this.#states.signal);
    // Leaving for the next page keeps the page's reach: the banner does not flicker between two.
    if (shut || Object.keys(this.#sources).length) this.#syncReach();
    for (const asked of this.#asked.values()) this.#answer(asked);
    this.#pages.stopViews();
    /* A page with NO data has no filters: the panel shuts — not the reader's
       choice, so it opens again on the next page that has some. TRAP T-navigating-sets-up-the-page */
    if (shut && !Object.keys(this.#sources).length) {
      for (const panel of this.#panels()) panel.hide?.('page');
    }
    // The Views are over ONE Query: a subtree whose sources share none names none. 366 step 25
    const [source, ...more] = Object.values(this.#sources);
    // A page's listening elements show what still waits.
    this.#drawNews();
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
    const opening = def && store ? this.#opening(page.signal) : null;
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
    if (!definition?.source) this.#setReach({ reach: 'ok' });
  }

  /**
   * Can the page's data be reached? The worst of its sources': `ok`;
   * `unreached` — the last rows are shown, unconfirmed; `down` — nothing to
   * show. With why, while it is not ok. `reach-change` says when it moves.
   * TRAP T-the-provider-says-the-pages-reach
   */
  get reach(): { reach: 'ok' | 'unreached' | 'down'; failure?: Failure } {
    return { ...this.#reach };
  }

  /** Try every source that cannot reach its store again, and ask one that may
   *  miss a writer what moved — a page's Retry, its tab shown. TRAP T-a-remote-store-says-what-changed */
  recheck(): void {
    for (const source of Object.values(this.#sources)) source.recheck();
  }

  /** The page's reach, as last said. */
  #reach: { reach: 'ok' | 'unreached' | 'down'; failure?: Failure } = { reach: 'ok' };

  /** Read each source's reach — from state, never from the last event — and say a change. */
  #syncReach(): void {
    const rank = { ok: 0, unreached: 1, down: 2 } as const;
    let worst: { reach: 'ok' | 'unreached' | 'down'; failure?: Failure } = { reach: 'ok' };
    const sources = Object.values(this.#sources);
    // A source that has not answered yet says nothing: the page's reach stands until one does.
    const known = sources.filter((source) => source.loaded || source.reach !== 'ok');
    if (sources.length && !known.length) return;
    for (const source of known) {
      const reach = source.reach;
      if (rank[reach] <= rank[worst.reach]) continue;
      const failure = source.failure;
      worst = { reach, ...(failure ? { failure } : {}) };
    }
    this.#setReach(worst);
  }

  /** Keep the page's reach, and say it when it moved. */
  #setReach(next: { reach: 'ok' | 'unreached' | 'down'; failure?: Failure }): void {
    if (next.reach === this.#reach.reach && next.failure?.kind === this.#reach.failure?.kind) return;
    this.#reach = next;
    this.emit('reach-change', { ...next });
  }

  /** The network back, or the tab shown again: a store that could not be
   *  reached is tried again, and one that may miss a writer is asked what moved. */
  #onBack = (): void => {
    if (document.visibilityState === 'visible') this.recheck();
  };

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
    this.on(window, 'online', this.#onBack);
    this.on(document, 'visibilitychange', this.#onBack);
    this.#stopHearing = hearUpdates(this.updates);
    this.on(this.updates, 'change', this.#drawNews);
  }

  override onDisconnect(): void {
    this.#stopHearing?.();
    this.#stopHearing = null;
    this.#page?.abort();
    this.#pages.stopViews();
    for (const asked of this.#asked.values()) asked.unbind?.();
    this.#asked.clear();
  }

  /** Stops watching the sources' loading, emptiness and failure. */
  #states: AbortController | null = null;

  /** Stops hearing what is new. */
  #stopHearing: (() => void) | null = null;

  /** Each element under it that LISTENS shows while news of its kind waits. The
   *  data layer said a fact; this element asked to hear it.
   *  Will, plan 652 S6 · TRAP T-a-notice-is-heard-never-ordered */
  #drawNews = (): void => {
    for (const el of this.querySelectorAll<HTMLElement>('[data-listens]')) {
      el.toggleAttribute('hidden', !kindsOf(el).some((kind) => this.updates.shows(kind)));
    }
  };

  /** A listening element dismissed — a locked callout reports and stays: its kinds
   *  hide until the next notice. */
  #onNoticeDismiss = (event: Event): void => {
    const el = event.target as HTMLElement;
    if (el.hasAttribute?.('data-listens')) for (const kind of kindsOf(el)) this.updates.dismiss(kind);
  };

  /**
   * Each source's loading, emptiness and failure, drawn on the card of every
   * component it answers — so no page writes `data-loading` by hand. Loading
   * and a failure reach every data component's card; empty and NO MATCHES a
   * ROWS one's only, as a chart under the View alone still has its rows.
   * Will, TODO 58. TRAP T-a-container-shows-its-datas-state
   */
  #watchStates(signal: AbortSignal): void {
    for (const source of Object.values(this.#sources)) {
      const cards = (rowsOnly: boolean): HTMLElement[] => this.#cardsOf((el) => this.#resolve(el) === source, rowsOnly);
      let slow: ReturnType<typeof setTimeout> | undefined;
      source.addEventListener('loading', (event) => {
        clearTimeout(slow);
        const loading = !!(event as CustomEvent).detail?.loading;
        if (loading) slow = setTimeout(() => { for (const c of cards(false)) c.toggleAttribute('data-loading', true); }, SLOW_LOAD);
        else for (const c of cards(false)) c.removeAttribute('data-loading');
      }, { signal });
      source.addEventListener('change', (event) => {
        this.#syncReach();
        const state = (event as CustomEvent<DataChangeDetail>).detail.emptiness ?? null;
        for (const c of cards(false)) if (c.dataset['state'] === 'error') delete c.dataset['state'];
        for (const c of cards(true)) {
          if (state) c.dataset['state'] = state;
          else delete c.dataset['state'];
        }
      }, { signal });
      source.addEventListener('error', (event) => {
        this.#syncReach();
        const { error } = (event as CustomEvent).detail as { error: unknown };
        for (const c of cards(false)) {
          c.dataset['state'] = 'error';
          c.dataset['error'] = error instanceof Error ? error.message : String(error);
        }
      }, { signal });
    }
  }
  /** The cards of the components that asked for data and pass `which` — ROWS ones only, or any. */
  #cardsOf(which: (el: Element) => boolean, rowsOnly = false): HTMLElement[] {
    return [...new Set([...this.#asked.keys()]
      .filter((el) => {
        if (!which(el)) return false;
        const shape = ((el.constructor as { asks?: DataAsk }).asks ?? { shape: 'rows' }).shape;
        return rowsOnly ? shape === 'rows' : shape !== 'scope' && shape !== 'state';
      })
      .map(containerOf).filter((c): c is HTMLElement => !!c))].map((c) => this.#keep(c));
  }

  /**
   * A page OPENING is a load: its source reads the store before anyone can hear
   * it, so every data card says so after SLOW_LOAD. `stop` when the source is
   * open; `end` hands the cards it draws to its own loading and clears the rest.
   * A page left while it opens ends at once, so it never marks the next page.
   * TRAP T-a-container-shows-its-datas-state
   */
  #opening(signal: AbortSignal): { stop(): void; end(source?: DataSource): void } {
    const marked: HTMLElement[] = [];
    const slow = setTimeout(() => {
      for (const c of this.#cardsOf(() => true)) {
        c.toggleAttribute('data-loading', true);
        marked.push(c);
      }
    }, SLOW_LOAD);
    const end = (source?: DataSource): void => {
      clearTimeout(slow);
      signal.removeEventListener('abort', left);
      const handed = new Set(source ? this.#cardsOf((el) => this.#resolve(el) === source) : []);
      for (const c of marked.splice(0)) if (!handed.has(c)) c.removeAttribute('data-loading');
    };
    const left = (): void => end();
    signal.addEventListener('abort', left);
    return { stop: () => clearTimeout(slow), end };
  }

  /** A card shows its state as this provider says: kept content, or an overlay. */
  #keep(card: HTMLElement): HTMLElement {
    card.toggleAttribute('data-keep-content', this.hasAttribute('data-keep-content'));
    return card;
  }

  override onChange(name: string): void {
    if (name !== 'data-keep-content') return;
    for (const el of this.#asked.keys()) {
      const card = containerOf(el);
      if (card) this.#keep(card);
    }
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
    event.stopPropagation();
    if (request.context === SOURCE_CONTEXT) {
      const source = this.#resolve(request.contextTarget);
      if (source) request.callback(source);
      return;
    }
    this.#asked.get(request.contextTarget)?.unbind?.();
    const asked: Asked = { request };
    this.#asked.set(request.contextTarget, asked);
    // A bar or a panel takes the mode as it asks, before it paints — not when
    // its data comes. TRAP T-the-filter-mode-is-set-before-the-page-paints
    const el = request.contextTarget;
    if ((el.constructor as { asks?: DataAsk }).asks?.shape === 'scope') this.#modes.join(el);
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
    const asks = (el.constructor as { asks?: DataAsk }).asks ?? { shape: 'rows' };
    // Nothing declared: it is the page's to populate.
    const needs = DECLARED_BY[asks.shape];
    if (needs && !this.#inherited(el, needs)) {
      /* …but a legend in a chart over a ZONED number — a gauge's — picks the status
         field its zones come from, as any legend picks its values; the chart draws
         its rows. Plan 683 · TRAP T-a-status-is-worked-out-by-the-data */
      const field = asks.picks && !el.hasAttribute('data-readonly') ? this.#inherited(el, 'data-field') : null;
      const picked = field ? source.zonesOf(field)?.from ?? null : null;
      if (picked) {
        const unpick = this.#picks(el as Picker, source, picked, asks.picks!);
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
    if (typeof scope === 'string' && shownAs(el) && this.#swapped(el, scope, source)) return;
    /* A grid made from a chart: every row its chart counts, with no pager, so its
       scope stays a slot and its Group and Sort its presentation's. D4 B, TODO 624 */
    const made = typeof scope === 'string' && shownAs(el) === 'grid' && (this.#authored.get(el) ?? 'grid') !== 'grid' ? scope : undefined;
    if (made) (el as Element & { columns?: GridColumnLike[] }).columns = this.#madeColumns(el, source);
    // A grid's Primary leads its columns; a grid made from a chart, its first axis. Will, TODO 548
    if (typeof scope === 'string' && shownAs(el) === 'grid') {
      const lead = made ? this.#madeLead(el, made, source) : source.query.presented(scope, 'grid').primary;
      if (lead) el.setAttribute('data-primary-field', lead);
      else el.removeAttribute('data-primary-field');
    }
    /* Its Secondary set, a grid is a PIVOT: a row a Primary value, a column a
       Secondary value, row counts in the cells. Will, TODO 548 */
    const pivot = typeof scope === 'string' && shownAs(el) === 'grid' && !made ? this.#pivotSpec(el, scope, source) : undefined;
    // The fields it reads from a row: a summary's, or what it says. TRAP T-a-held-set-reads-the-pages-fields
    const fields = pivot ? [pivot.segment, pivot.stack] : spec ? [spec.field, spec.segment, spec.over].filter((f): f is string => !!f) : asks.fields?.(el);
    /* A chart over its field's ZONES is free of that field: its filter lights the
       zones and never moves the value. Will, TODO 479. TRAP T-a-chart-is-free-of-its-own-field */
    const zoned = asks.zones && spec?.field ? source.zonesOf(spec.field)?.from ?? spec.field : undefined;
    /* What it drew last, so a hover draws it again with no load: a summary marks its
       own part of each segment; a grid marks its own rows. Will, TODO 655 */
    let last: Row[] | null = null;
    const summarised = spec ? (rows: Row[], src: DataSource): unknown => {
      last = rows;
      const test = this.#lit(el, scope, src);
      this.#shown.set(el, test);
      // A number's zones, from a status field. Plan 683 S3
      const summary = summariseMarked(rows, spec, (f) => src.valuesFor(f), (f) => src.zonesOf(f)?.zones, test);
      return zoned && summary && typeof summary === 'object' && 'zones' in summary
        ? { ...summary, picked: src.pickedFor(el as Populatable, zoned) } : summary;
    } : undefined;
    const drawsHighlight = 'drawHighlight' in el;
    const draw = (test: ((row: Row) => boolean) | null): void => {
      this.#shown.set(el, test);
      (el as { drawHighlight?: (test: ((row: Row) => boolean) | null) => void }).drawHighlight?.(test);
    };
    const unbind = bindSource(source, el as Populatable, {
      ...(zoned ? { free: [zoned] } : {}),
      ...(spec && typeof scope === 'string' ? { shows: this.#shows(el), ...(asks.stacks ? { stacks: true } : {}) } : {}),
      // A pivot is its scope's grid still: its Group and Sort arrange its rows' sub-grids. TODO 574
      ...(pivot ? { arranges: true } : {}),
      ...(fields ? { fields } : {}),
      rows: spec || pivot || made || asks.shape === 'all' ? 'all' : 'page',
      // A pager and a filter bar steer; the rows are not theirs to draw.
      steerOnly: asks.shape === 'state' || asks.shape === 'scope',
      ...(asks.own ? { ignore: asks.own } : {}),
      ...(scope ? { scope } : {}),
      /* A summary SHOWS the data and never steers it. TRAP T-aggregation-is-data */
      ...(summarised ? { readonly: true, as: summarised } : {}),
      // …and its headings and cells filter its rows, its rows' sub-grids too. TODO 571
      ...(pivot ? { readonly: true, steers: PIVOT_STEERS, as: (rows, src) => this.#pivotOf(el, rows, pivot, src, asks.filters?.(el) ?? []) } : {}),
      ...(made ? { readonly: true, as: (rows) => this.#madeTable(el, rows, made, source) } : {}),
      // A page of rows arrives WITH its groups: a group is the data layer's.
      // TRAP T-a-group-is-a-data-layer-concept
      ...(asks.shape === 'rows' && !pivot && !made
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
        if (drawsHighlight) draw(this.#lit(el, scope, source));
        // A legend drawn in its card's bar: its numbers are its value chips' counts. TODO 670
        this.#legendCounts.get(el)?.(payload);
      },
      hover: ({ scope: at, field, on, value }) => this.hover(at, field, on, value),
    });
    // A hover lights it again from what it has: nothing loads. TODO 655
    if (summarised || drawsHighlight) {
      this.#lights.set(el, () => {
        const test = this.#lit(el, scope, source);
        if (test === (this.#shown.get(el) ?? null)) return;
        if (summarised && last) callback(summarised(last, source), leave);
        else draw(test);
      });
    }
    this.#fetchFields(el, source);
    const unpick = spec && asks.picks ? this.#picks(el as Picker, source, spec.segment ?? '', asks.picks) : undefined;
    const unown = this.#own(el, source);
    // A chart, a grid and a legend in a slot follow its presentation. TODO 548
    const unshow = typeof scope === 'string' && (spec || shownAs(el)) ? this.#followPresentation(asked, source, scope, !spec && !pivot && !made) : undefined;
    const refilter = made ? new AbortController() : undefined;
    /* A filter in it is its slot's, in the Query, and narrows it alone: asked plainly,
       a field that Customer Records holds would be answered there. Its rows and its
       cells' state come back from the source. Will, TODO 621
       TRAP T-a-grid-from-a-chart-keeps-to-its-card */
    if (refilter) el.addEventListener('column-filter-change', (e) => {
      e.stopPropagation();
      const { field, reading } = (e as CustomEvent<{ field: string; reading: FieldReading | null }>).detail;
      source.query.setReading(made as string, field, reading, { only: el as Populatable });
      source.query.commit({ field });
      // A field's home draws its controls: this scope is not its home, so it is told here.
      (el as Element & { drawReading(f: string, r: FieldReading): void }).drawReading(field, source.query.reading(made as string, field) ?? {});
    }, { signal: refilter.signal });
    asked.unbind = () => {
      this.#lights.delete(el);
      refilter?.abort();
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
    if ('drawScope' in el && !isColumn(el)) this.#pages.joined(el as unknown as Bar);
    if ('drawScope' in el || 'drawPresent' in el) this.#offerLimit(el);
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
    const stacks = asks.stacks || !!(host?.constructor as { asks?: DataAsk } | undefined)?.asks?.stacks;
    const stack = stacks ? shown.secondary ?? this.#inherited(el, 'data-stack-field') : null;
    const axes = chartAxes(shown.primary ?? spec['segment'] as string | undefined, stack ?? undefined,
      stacks ? this.#inherited(el, 'data-count-axis') : null, spec['aggregate'] as string | undefined);
    if (asks.picks) Object.assign(spec, { ...axes, segment: axes.stack ?? axes.segment, stack: undefined });
    else Object.assign(spec, axes);
    if (shown.group) spec['group'] = shown.group;
    if (shown.sort) spec['sort'] = shown.sort;
    return spec as unknown as SummarySpec;
  }

  /** A Show as pick: its card's slot keeps it; Default keeps none. Will, TODO 548 */
  #onShowAs = (event: Event): void => {
    const from = event.target as Element;
    const slot = this.#inherited(from, 'data-scope');
    const source = this.#resolve(from);
    if (!slot || /\s/.test(slot) || !source) return;
    event.stopPropagation();
    const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
    source.query.present(slot, { kind: kind && kind !== 'default' ? kind : undefined });
  };

  /** A card's toggle: its filter toolbar shown or shut, kept in the session. Will, TODO 629 */
  #onToolbarToggle = (event: Event): void => {
    const slot = this.#inherited(event.target as Element, 'data-scope');
    if (!slot || /\s/.test(slot)) return;
    event.stopPropagation();
    const { shown } = (event as CustomEvent<{ shown: boolean }>).detail;
    this.#session?.set(this.#toolbarKey(slot), shown);
    this.#drawToolbars(slot, shown);
  };

  /** Where the session keeps a card's toolbar, as a slot's name is its page's. */
  #toolbarKey(slot: string): string {
    return `/cards/toolbars/${this.#pageId}/${slot}`;
  }

  /** A slot's filter toolbars and its toggles: as asked, else as the reader left them,
   *  else as its page's markup does. A bar stepped back for the panel leaves its toggle
   *  inactive: a press would hide the panel. Will, TODO 672 · TRAP T-a-card-toggles-its-own-toolbar */
  #drawToolbars(slot: string, asked?: boolean): void {
    const inSlot = (selector: string): Element[] => [...this.querySelectorAll(selector)].filter((el) => this.#inherited(el, 'data-scope') === slot);
    const toggles = inSlot('[data-filter-toolbar]');
    if (!toggles.length) return;
    const bars = inSlot('sherpa-quick-filter-toolbar');
    const kept = this.#session?.get(this.#toolbarKey(slot));
    const shown = asked ?? (typeof kept === 'boolean' ? kept : bars.some((bar) => !bar.hasAttribute('hidden')));
    for (const bar of bars) bar.toggleAttribute('hidden', !shown);
    const panel = bars.length > 0 && bars.every((bar) => bar.hasAttribute('data-panel-mode'));
    const state = !bars.length ? 'off' : panel ? 'panel' : shown ? 'shown' : 'shut';
    for (const toggle of toggles) toggle.setAttribute('data-filter-toolbar', state);
  }

  /** A chart card's title follows what the reader set: "Primary by Secondary,
   *  grouped by Group", each part only where it is set. Set nothing, its page's
   *  own. Will, TODO 567 */
  #retitle(el: Element, slot: string, source: DataSource): void {
    if (shownAs(el) === 'grid') return;
    const shown = source.query.presented(slot, 'chart');
    const own = source.query.presented(slot, 'chart', false);
    const set = shown.primary !== own.primary || shown.secondary !== own.secondary || shown.group !== own.group;
    const name = (field: string | null | undefined): string => (field ? source.fieldFacts(field).label ?? field : '');
    const stacks = (el.constructor as { asks?: DataAsk }).asks?.stacks;
    const secondary = shown.secondary ?? el.getAttribute('data-stack-field');
    const by = stacks && secondary ? ` ${this.word('by')} ${name(secondary)}` : '';
    const grouped = shown.group ? `, ${this.word('grouped-by')} ${name(shown.group)}` : '';
    const title = `${name(shown.primary ?? el.getAttribute('data-segment-field'))}${by}${grouped}`;
    for (const host of this.querySelectorAll(':is(sherpa-data-viz-header, sherpa-container-header)[slot="header"]')) {
      if (this.#inherited(host, 'data-scope') !== slot) continue;
      const now = host.getAttribute('data-heading') ?? '';
      const was = this.#titled.get(host);
      // A heading its page changed since is its page's own now.
      const page = was?.wrote === now ? was.page : now;
      const next = set ? title : page;
      this.#titled.set(host, { page, wrote: next });
      if (next !== now) host.setAttribute('data-heading', next);
    }
  }

  /** The open page's id: a slot's name is its own. */
  #pageId = '';

  /** The fields the open page declares: a row opened in a grid made from a chart shows them. */
  #pageFields: string[] = [];

  /** Each chart card's title: its page's own, and what was last written. */
  readonly #titled = new WeakMap<Element, { page: string; wrote: string }>();

  /** Swap a chart for the one its slot shows, where that differs; its card's Show
   *  as is told either way. True when swapped. Will, TODO 548 */
  #swapped(el: Element, slot: string, source: DataSource): boolean {
    const shown = source.query.presented(slot);
    const authored = this.#authored.get(el) ?? shownAs(el);
    const own = source.query.presented(slot, undefined, false).kind ?? authored;
    for (const host of this.querySelectorAll('[data-presentation]')) {
      if (this.#inherited(host, 'data-scope') !== slot) continue;
      if (own) host.setAttribute('data-presentation-default', own);
      host.setAttribute('data-presentation', this.#showAsOf(source, slot));
    }
    this.#drawToolbars(slot);
    this.#retitle(el, slot, source);
    const kind = shown.kind ?? authored;
    if (!authored || !kind || kind === shownAs(el)) return false;
    const parked = this.#parked.get(slot);
    const want = parked && shownAs(parked) === kind ? undefined : SHOWN_BY[kind];
    if (!parked && !want) return false;
    // A chart's first split is its segment field: one made from a grid takes the
    // slot's Primary, else the grid's first column — its Primary too. A gauge splits
    // nothing, so only a grid is made from it, led by its field. Will, TODO 548
    const segment = source.query.presented(slot, 'chart').primary ?? el.getAttribute('data-segment-field')
      ?? (el as Element & { columns?: { field: string }[] }).columns?.[0]?.field
      ?? (kind === 'grid' ? el.getAttribute('data-field') : null);
    if (want && !segment) {
      report({
        code: 'presentation-without-primary',
        message: `sherpa-provider: slot "${slot}" cannot be shown as a ${kind} chart: it names no primary field for its X axis.`,
        at: { scope: slot, kind },
      });
      return false;
    }
    this.#asked.delete(el);
    void (want?.load() ?? Promise.resolve()).then(() => {
      if (!el.isConnected) return;
      // Back to the page's own: the very element, a grid with its columns.
      // A grid made from a chart holds nothing of it: another chart comes from the page's own.
      const from = shownAs(el) === 'grid' && parked && shownAs(parked) !== 'grid' ? parked : el;
      const next = !want ? parked : kind === 'grid' ? this.#gridFor(el, segment ?? '') : this.#chartFor(from, kind, segment ?? '');
      if (!next) return;
      if (!want) this.#parked.delete(slot);
      // Back to the page's own chart: its legend goes home.
      if (!want && shownAs(next) !== 'grid' && shownAs(el) !== 'grid') next.append(...el.childNodes);
      // A grid has no legend: it waits with the page's own chart.
      if (want && kind === 'grid' && parked && shownAs(el) !== 'grid') parked.append(...el.childNodes);
      // A grid made from a chart takes its filters with it: they narrow it alone.
      if (shownAs(el) === 'grid' && this.#authored.has(el)) {
        for (const c of (el as Element & { columns?: GridColumnLike[] }).columns ?? []) source.query.setReading(slot, c.field, null, { only: el as Populatable });
      }
      if (!this.#authored.has(el) && shownAs(el) === authored) this.#parked.set(slot, el);
      if (next !== parked) this.#authored.set(next, authored);
      el.replaceWith(next);
    });
    return true;
  }

  /** A chart for a slot, from its prototype, its legend with it: a chart's own
   *  attributes and legend, or a grid's place and its split. Will, TODO 548 */
  #chartFor(el: Element, kind: string, segment: string): Element | null {
    const next = this.clone(`template.shown-${kind}-tpl`);
    if (!next) return null;
    const fromGrid = shownAs(el) === 'grid';
    for (const { name, value } of [...el.attributes]) {
      if (!(LINE_ONLY as readonly string[]).includes(name) && (!fromGrid || (KEPT_ACROSS as readonly string[]).includes(name))) next.setAttribute(name, value);
    }
    if (fromGrid) next.setAttribute('data-segment-field', segment);
    else if (el.querySelector(':scope > [slot="legend"]')) next.replaceChildren(...el.childNodes);
    return next;
  }

  /** A grid for a chart's slot: where it sits, its id, and its axes, which name its
   *  columns as it binds. Its legend stays with the chart. D4 B, TODO 624 */
  #gridFor(el: Element, segment: string): Element | null {
    const next = this.clone('template.shown-grid-tpl');
    if (!next) return null;
    for (const name of [...KEPT_ACROSS, ...CHART_AXES, 'id']) {
      const value = el.getAttribute(name);
      if (value !== null) next.setAttribute(name, value);
    }
    next.setAttribute('data-segment-field', segment);
    return next;
  }

  /** What a grid made from a chart can show: every field of the page, as a row opened
   *  on its own rows shows them. A gauge splits nothing, so it shows its rows: what
   *  names a row, from the page's own grid, and the number it reads. Will, TODO 625 */
  #madeColumns(el: Element, source: DataSource): GridColumnLike[] {
    const page = this.querySelector<Element & { columns?: GridColumnLike[] }>('sherpa-data-grid:not([data-segment-field])');
    const fields = this.#authored.get(el) === 'gauge'
      ? [page?.columns?.[0]?.field, el.getAttribute('data-field')].filter((field): field is string => !!field)
      : this.#pageFields;
    return fields.map((field) => {
      const facts = source.fieldFacts(field);
      return { field, header: facts.label ?? field, sortable: true, ...(facts.type ? { type: facts.type } : {}) };
    });
  }

  /** A grid made from a chart: its first axis, which leads its columns. */
  #madeLead(el: Element, slot: string, source: DataSource): string | null {
    if (this.#authored.get(el) === 'gauge') return (el as Element & { columns?: GridColumnLike[] }).columns?.[0]?.field ?? null;
    return this.#madeAxes(el, slot, source).segment ?? null;
  }

  /** A grid made from a chart: its axes, as its chart reads them. A line's first is
   *  what it runs over; an axis shown as counts splits nothing. TODOs 622, 653 */
  #madeAxes(el: Element, slot: string, source: DataSource): Pick<SummarySpec, 'segment' | 'stack' | 'aggregate' | 'field'> {
    const { primary, secondary } = source.query.presented(slot, 'chart');
    const over = el.getAttribute('data-over-field');
    const first = over ?? primary ?? el.getAttribute('data-segment-field') ?? undefined;
    const second = (over ? primary ?? el.getAttribute('data-segment-field') : secondary ?? el.getAttribute('data-stack-field')) || undefined;
    const aggregate = el.getAttribute('data-aggregate') as SummarySpec['aggregate'] | null;
    const field = el.getAttribute('data-field');
    return {
      ...(aggregate ? { aggregate } : {}), ...(field ? { field } : {}),
      ...chartAxes(first, second, over ? null : el.getAttribute('data-count-axis'), aggregate),
    };
  }

  /** What a grid made from a chart draws: its axes, no more, and a Total. A row a
   *  value of its first axis, its cells the count the chart draws, and each row opens
   *  on its own rows, its Group grouping them. A line's first axis is what it runs
   *  over. Will, TODOs 622, 625, 661. TRAP T-a-grid-from-a-chart-keeps-to-its-card */
  #madeTable(el: Element, rows: readonly Row[], slot: string, source: DataSource): unknown {
    const own = el as Element & { columns?: GridColumnLike[] };
    const label = (f: string): string => source.fieldFacts(f).label ?? f;
    const fields = (own.columns ?? []).map((c) => c.field);
    source.readValues(fields);
    const filters = Object.fromEntries(fields.map((f) => [f, source.filterDef(f)]));
    // A gauge's number is one mean: no count to total, so its rows, as they are.
    if (this.#authored.get(el) === 'gauge') return { rows, groups: null, filters };

    const { group, sort } = source.query.presented(slot, 'chart');
    const axes = this.#madeAxes(el, slot, source);
    const lead = axes.segment ?? '';
    const stack = axes.stack;
    const spec: SummarySpec = { shape: 'segments', ...axes, segment: lead, ...(sort ? { sort } : {}) };
    const made = summarise(rows, spec, (f) => source.valuesFor(f)) as ChartDatum[];
    const seen = made.flatMap((datum) => (datum.stack ?? []).map((p) => p.label));
    const declared = stack ? source.valuesFor(stack).map(valueKey) : [];
    const values = declared.length ? declared.filter((v) => seen.includes(v)) : [...new Set(seen)];
    return { pivot: {
      key: 'made:key',
      columns: [
        { field: lead, header: label(lead), sortable: false },
        ...values.map((v) => ({ field: `made:${v}`, header: v, type: 'number', sortable: false, filterable: false })),
        { field: 'made:total', header: this.word('total'), type: 'number', sortable: false, filterable: false },
      ],
      filters,
      rows: made.map((datum) => ({
        'made:key': datum.label,
        [lead]: datum.label,
        ...Object.fromEntries(values.map((v) => [`made:${v}`, datum.stack?.find((p) => p.label === v)?.value ?? 0])),
        'made:total': datum.value,
      })),
      detail: {
        // Not what its row says: every row under it holds that; its Group groups them. Will, TODOs 578, 661
        columns: (own.columns ?? []).filter((c) => c.field !== lead),
        ...opened(rows, lead, group),
      },
    } };
  }

  /** A grid's pivot, where its slot names a Secondary: its Primary — else its first
   *  column — a row a value, the Secondary's values its columns. Will, TODO 548 */
  #pivotSpec(el: Element, slot: string, source: DataSource): (SummarySpec & { segment: string; stack: string }) | undefined {
    const shown = source.query.presented(slot, 'grid');
    const lead = shown.primary ?? (el as Element & { columns?: { field: string }[] }).columns?.[0]?.field;
    if (!shown.secondary || !lead) return undefined;
    return { shape: 'segments', segment: lead, stack: shown.secondary, ...(shown.sort ? { sort: shown.sort } : {}) };
  }

  /** A pivot for its grid: a row a Primary value, a column a Secondary value, and
   *  the total, every cell a row count. Each row OPENS on its own rows, under the
   *  grid's own columns, its Group grouping them: Primary, Secondary, Group are a
   *  chain. Will, TODOs 548, 570, 574 */
  #pivotOf(el: Element, rows: readonly Row[], spec: SummarySpec & { segment: string; stack: string }, src: DataSource, filtered: readonly string[]): unknown {
    const segments = summarise(rows, spec, (f) => src.valuesFor(f)) as ChartDatum[];
    const declared = src.valuesFor(spec.stack).map(valueKey);
    const seen = segments.flatMap((s) => (s.stack ?? []).map((p) => p.label));
    const values = declared.length ? declared.filter((v) => seen.includes(v)) : [...new Set(seen)];
    const cell = (v: string): string => `pivot:${v}`;
    const total = 'pivot:total';
    const label = (f: string): string => src.fieldFacts(f).label ?? f;
    const own = el as Element & { columns?: GridColumnLike[]; key?: string | null };
    // Its Primary filters as the grid's own column does; a count filters nothing. TODO 571
    const { tags: moved, ...primary } = own.columns?.find((c) => c.field === spec.segment) ?? { field: spec.segment };
    /* Its rows' TAGS go where their columns are: down to the sub-grid, the
       Primary's on its first column — and never the Primary's own, which every
       row there holds. Will, TODO 580 */
    const details = (own.columns ?? []).filter((c) => c.field !== spec.segment).map((c, i) => {
      const tags = [...new Set([...c.tags ?? [], ...(i === 0 ? moved ?? [] : [])])].filter((f) => f !== spec.segment);
      const { tags: _tags, ...rest } = c;
      return tags.length ? { ...rest, tags } : rest;
    });
    const fields = [...new Set([...filtered, spec.segment])];
    src.readValues(fields);
    return { pivot: {
      key: spec.segment,
      columns: [
        { ...primary, field: spec.segment, header: primary.header ?? label(spec.segment), sortable: false },
        ...values.map((v) => ({ field: cell(v), header: v, type: 'number', sortable: false, filterable: false })),
        { field: total, header: this.word('total'), type: 'number', sortable: false, filterable: false },
      ],
      filters: Object.fromEntries(fields.map((f) => [f, src.filterDef(f)])),
      rows: segments.map((s) => ({
        [spec.segment]: s.label,
        ...Object.fromEntries(values.map((v) => [cell(v), s.stack?.find((p) => p.label === v)?.value ?? 0])),
        [total]: s.value,
      })),
      detail: {
        // Not its Primary: every row under a row holds that row's. Will, TODO 578
        columns: details,
        ...(own.key ? { key: own.key } : {}),
        ...opened(rows, spec.segment, src.state.group),
      },
    } };
  }

  /** What a chart shows by its own attributes: its slot's default. Will, TODO 548 */
  #shows(el: Element): Presentation {
    const segment = this.#inherited(el, 'data-segment-field');
    const stack = this.#inherited(el, 'data-stack-field');
    return { ...(segment ? { primary: segment } : {}), ...(stack ? { secondary: stack } : {}) };
  }

  /** A slot's kept presentation moved: its chart is answered again, with it. Will, TODO 548 */
  #followPresentation(asked: Asked, source: DataSource, slot: string, kindOnly: boolean): () => void {
    // A grid draws rows, not a summary: only its kind, its Primary and its Secondary move it.
    const read = (): string => {
      const shown = source.query.presented(slot);
      return JSON.stringify(kindOnly ? [shown.kind, shown.primary, shown.secondary] : shown);
    };
    const was = read();
    const stop = new AbortController();
    source.query.addEventListener('query-change', (e) => {
      const moved = (e as CustomEvent<QueryChangeDetail>).detail.scopes.includes(slot);
      if (moved && read() !== was) this.#answer(asked);
    }, { signal: stop.signal });
    return () => stop.abort();
  }

  /**
   * A component that PICKS values of its segment field — a legend. Its pick
   * narrows its host (its chart) and nothing else: component reach.
   * TRAP T-a-legend-toggle-is-a-filter
   * TRAP T-a-component-part-narrows-one-component
   */
  #picks(el: Picker, source: DataSource, field: string, picks: NonNullable<DataAsk['picks']>): (() => void) | undefined {
    const values = source.valuesFor(field).map(valueKey);
    if (!values.length) {
      report({
        code: 'provider-picks-undeclared',
        message: "sherpa-provider: a component that picks needs its field's values declared, so this one only shows.",
        at: { tag: el.localName, field },
      });
      return undefined;
    }
    const only = picks.narrows === 'host' ? up(el) : el;
    // One part per component, or the second would replace the first.
    const key = `picks:${el.id || field}`;
    /* A chart in a slot that HOLDS its field — a grid's, shown as a chart — picks
       in that scope: its filters are there already, so no part, no new panel
       section. Will, TODO 548 */
    const slot = this.#inherited(el, 'data-scope');
    const home = slot && !/\s/.test(slot) && slot !== VIEW && source.query.holds(slot, field) ? slot : undefined;
    const unbind = bindSelection(el, source, {
      field,
      values,
      read: (c) => c.picked,
      draw: (c, picked) => { c.picked = [...picked]; },
      event: picks.event,
      reach: 'component',
      ...(only ? { only } : {}),
      ...(home ? { home } : {}),
      key,
    }).destroy;
    // No host to narrow: bindSelection said so, and bound nothing.
    if (!only) return unbind;
    /* The chart's OWN scope, so a filter panel draws it — named as the chart
       is. TRAP T-a-chart-scope-is-its-legend-field */
    const label = nameOf(only);
    /* Chips, in its card's filter toolbar where it has one: the part is drawn there,
       answered in its own scope still, and the chart keeps no room for its legend.
       Will, TODO 670 */
    const bar = !home && slot && !/\s/.test(slot) && slot !== VIEW
      && [...this.querySelectorAll('sherpa-quick-filter-toolbar')].some((b) => this.#inherited(b, 'data-scope') === slot);
    const bars = (): (Element & { drawCounts?(field: string, counts: Record<string, number> | null): void })[] =>
      [...this.querySelectorAll('sherpa-quick-filter-toolbar')].filter((b) => this.#inherited(b, 'data-scope') === slot);
    const lay = (): void => {
      const inBar = this.#legendChips && !!bar;
      if (!home) source.query.declarePart(key, { field, only: only as Populatable, ...(label ? { label } : {}), ...(inBar ? { shownIn: slot! } : {}) });
      el.toggleAttribute('data-chips', this.#legendChips && !inBar);
      only.toggleAttribute('data-no-legend', inBar);
      // Its value chips count what its chart counts, each its legend row's number. Will, TODO 670
      if (inBar) {
        this.#legendCounts.set(el, (payload) => {
          const items = Array.isArray(payload) ? (payload as { label: string; value: number }[]) : [];
          for (const b of bars()) b.drawCounts?.(field, Object.fromEntries(items.map((i) => [i.label, i.value])));
        });
      } else if (this.#legendCounts.delete(el)) for (const b of bars()) b.drawCounts?.(field, null);
    };
    lay();
    // What the filters before it leave, so the legend greys the rest. TRAP T-a-ruled-out-value-is-greyed
    const hear = (event: Event): void => {
      const left = (event as CustomEvent<{ byScope: Record<string, Record<string, string[]>> }>).detail.byScope[home ?? key];
      (el as Picker & { present?: readonly string[] | null }).present = left?.[field] ?? null;
    };
    source.addEventListener('present', hear);
    /* A rest on a row previews its value's matches, as a chip's value does — in
       the View where the View holds the field. Will, TODO 495
       TRAP T-a-hovered-chip-previews-the-highlight */
    const scope = (): string => (source.query.scope(VIEW).includes(field) ? VIEW : home ?? key);
    const rest = (event: Event): void => {
      const { label, on } = (event as CustomEvent<{ label: string; on: boolean }>).detail;
      this.hover(scope(), field, on, label);
    };
    el.addEventListener('legend-hover', rest);
    this.#pickers.set(el, lay);
    el.toggleAttribute('data-highlight-hover', this.#highlightHover);
    return () => {
      el.removeEventListener('legend-hover', rest);
      this.#pickers.delete(el);
      el.removeAttribute('data-highlight-hover');
      el.removeAttribute('data-chips');
      only.removeAttribute('data-no-legend');
      if (this.#legendCounts.delete(el)) for (const b of bars()) b.drawCounts?.(field, null);
      source.removeEventListener('present', hear);
      if (!home) source.query.declarePart(key, undefined);
      unbind();
    };
  }

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
