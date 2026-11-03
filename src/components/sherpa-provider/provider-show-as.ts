/**
 * provider-show-as.ts — Show as: a slot's chart swapped for the one its kept
 * presentation names, or for a grid — a pivot, or a grid made from the chart —
 * its card's menu and title told. Will, TODO 548
 *
 * Map:
 * - shownAs — The presentation a component draws, where it is one.
 * - ShowHost — What Show as asks of its provider.
 * - Table — A grid drawn as a table: what it binds with, and what keeps it to its card.
 * - ProviderShowAs — Show as, for one provider's subtree.
 * - .menus — Every card's Show as told what its slot shows — or off.
 * - .picked — A Show as pick: its card's slot keeps it; Default keeps none.
 * - .swapped — Swap a chart for the one its slot shows, where that differs; true when swapped.
 * - .table — A grid in a slot: a pivot, a grid made from a chart, or none — its Primary leading.
 * - .shows — What a chart shows by its own attributes: its slot's default.
 * - .follow — A slot's kept presentation moved: what follows it is answered again.
 */
import { report } from '../../core/data/report.js';
import { chartAxes, madeTable, pivotTable, type SummarySpec, type TableColumn, type TableFacts } from '../../core/data/aggregate.js';
import type { QueryChangeDetail } from '../../core/data/query-context.js';
import type { Presentation } from '../../core/data/query.js';
import type { Row } from '../../core/data/store.js';
import type { DataSource } from '../../core/data/data-source.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import type { Populatable } from '../../core/ui/apply-state.js';
import { declared } from './provider-declared.js';
import type { BindOptions } from '../../core/ui/bind-source.js';

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
export function shownAs(el: Element): string | undefined {
  if (el.localName === 'sherpa-gauge-chart') return 'gauge';
  if (el.localName === 'sherpa-line-chart') return 'line';
  if (el.localName === 'sherpa-radial-chart') return el.getAttribute('data-type') ?? 'donut';
  return Object.keys(SHOWN_BY).find((kind) => SHOWN_BY[kind]?.tag === el.localName);
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

/** A grid, as Show as reads and sets it. */
type Grid = Element & { columns?: TableColumn[]; key?: string | null };

/** What Show as asks of its provider. */
export interface ShowHost {
  /** The provider element: what its cards sit in. */
  readonly el: HTMLElement;
  /** An attribute from the element, or the nearest one above it. */
  inherited(el: Element, name: string): string | null;
  /** The source a component's subtree provides. */
  resolve(el: Element): DataSource | null;
  /** A fresh copy of one of the provider's templates. */
  clone(selector: string): Element | null;
  /** A word from the provider's markup. */
  word(key: string): string;
  /** Forget a component that asked: it is swapped, and what takes its place asks again. */
  forget(el: Element): void;
  /** A slot's toolbars and toggles drawn again. */
  drawToolbars(slot: string): void;
  /** The app's choice: Show as. */
  showAs(): boolean;
  /** The fields the open page declares. */
  pageFields(): string[];
}

/** A grid drawn as a table: what it binds with, the fields it reads, and what keeps it to its card. */
export interface Table {
  options: Pick<BindOptions, 'readonly' | 'as' | 'arranges' | 'steers'>;
  fields?: string[];
  /** Once bound: what keeps it to its card, and its stop. */
  bound?(): () => void;
}

/** Show as, for one provider's subtree. */
export class ProviderShowAs {
  /** The provider it serves. */
  readonly #host: ShowHost;
  /** The presentation a swapped component's page drew it as: what Default goes back to. */
  readonly #authored = new WeakMap<Element, string>();
  /** Each slot's own element, kept aside while another shows its data. */
  readonly #parked = new Map<string, Element>();
  /** Each chart card's title: its page's own, and what was last written. */
  readonly #titled = new WeakMap<Element, { page: string; wrote: string }>();

  constructor(host: ShowHost) {
    this.#host = host;
  }

  /** What a slot's Show as says: what it shows — or off. TODO 582 */
  #menuOf(source: DataSource, slot: string): string {
    return this.#host.showAs() ? source.query.presentation(slot).kind ?? 'default' : 'off';
  }

  /** Every card's Show as told what its slot shows — or, the app's choice off, off. TODO 582 */
  menus(): void {
    for (const host of this.#host.el.querySelectorAll('[data-presentation]')) {
      const slot = this.#host.inherited(host, 'data-scope');
      const source = this.#host.resolve(host);
      if (slot && source) host.setAttribute('data-presentation', this.#menuOf(source, slot));
    }
  }

  /** A Show as pick: its card's slot keeps it; Default keeps none. Will, TODO 548 */
  picked = (event: Event): void => {
    const from = event.target as Element;
    const slot = this.#host.inherited(from, 'data-scope');
    const source = this.#host.resolve(from);
    if (!slot || /\s/.test(slot) || !source) return;
    event.stopPropagation();
    const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
    source.query.present(slot, { kind: kind && kind !== 'default' ? kind : undefined });
  };

  /** A chart card's title follows what the reader set: "Primary by Secondary,
   *  grouped by Group", each part only where it is set. Set nothing, its page's
   *  own. Will, TODO 567 */
  #retitle(el: Element, slot: string, source: DataSource): void {
    if (shownAs(el) === 'grid') return;
    const shown = source.query.presented(slot, 'chart');
    const own = source.query.presented(slot, 'chart', false);
    const set = shown.primary !== own.primary || shown.secondary !== own.secondary || shown.group !== own.group;
    const name = (field: string | null | undefined): string => (field ? source.fieldFacts(field).label ?? field : '');
    const stacks = declared(el).asks?.stacks;
    const secondary = shown.secondary ?? el.getAttribute('data-stack-field');
    const by = stacks && secondary ? ` ${this.#host.word('by')} ${name(secondary)}` : '';
    const grouped = shown.group ? `, ${this.#host.word('grouped-by')} ${name(shown.group)}` : '';
    const title = `${name(shown.primary ?? el.getAttribute('data-segment-field'))}${by}${grouped}`;
    for (const host of this.#host.el.querySelectorAll(':is(sherpa-data-viz-header, sherpa-container-header)[slot="header"]')) {
      if (this.#host.inherited(host, 'data-scope') !== slot) continue;
      const now = host.getAttribute('data-heading') ?? '';
      const was = this.#titled.get(host);
      // A heading its page changed since is its page's own now.
      const page = was?.wrote === now ? was.page : now;
      const next = set ? title : page;
      this.#titled.set(host, { page, wrote: next });
      if (next !== now) host.setAttribute('data-heading', next);
    }
  }

  /** Swap a chart for the one its slot shows, where that differs; its card's Show
   *  as is told either way. True when swapped. Will, TODO 548 */
  swapped(el: Element, slot: string, source: DataSource): boolean {
    const shown = source.query.presented(slot);
    const authored = this.#authored.get(el) ?? shownAs(el);
    const own = source.query.presented(slot, undefined, false).kind ?? authored;
    for (const host of this.#host.el.querySelectorAll('[data-presentation]')) {
      if (this.#host.inherited(host, 'data-scope') !== slot) continue;
      if (own) host.setAttribute('data-presentation-default', own);
      host.setAttribute('data-presentation', this.#menuOf(source, slot));
    }
    this.#host.drawToolbars(slot);
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
      ?? (el as Grid).columns?.[0]?.field
      ?? (kind === 'grid' ? el.getAttribute('data-field') : null);
    if (want && !segment) {
      report({
        code: 'presentation-without-primary',
        message: `sherpa-provider: slot "${slot}" cannot be shown as a ${kind} chart: it names no primary field for its X axis.`,
        at: { scope: slot, kind },
      });
      return false;
    }
    this.#host.forget(el);
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
        for (const c of (el as Grid).columns ?? []) source.query.setReading(slot, c.field, null, { only: el as Populatable });
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
    const next = this.#host.clone(`template.shown-${kind}-tpl`);
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
    const next = this.#host.clone('template.shown-grid-tpl');
    if (!next) return null;
    for (const name of [...KEPT_ACROSS, ...CHART_AXES, 'id']) {
      const value = el.getAttribute(name);
      if (value !== null) next.setAttribute(name, value);
    }
    next.setAttribute('data-segment-field', segment);
    return next;
  }

  /**
   * A grid in a slot. Made from a chart: every row its chart counts, with no pager,
   * so its scope stays a slot and its Group and Sort its presentation's (D4 B,
   * TODO 624). Its slot naming a Secondary: a PIVOT, a row a Primary value, a column
   * a Secondary value, row counts in the cells (TODO 548). Else none: its own rows.
   * Either way its Primary leads its columns; a made grid's, its first axis.
   */
  table(el: Element, slot: string, source: DataSource, filters: () => readonly string[]): Table | undefined {
    const made = (this.#authored.get(el) ?? 'grid') !== 'grid';
    if (made) (el as Grid).columns = this.#madeColumns(el, source);
    const lead = made ? this.#madeLead(el, slot, source) : source.query.presented(slot, 'grid').primary;
    if (lead) el.setAttribute('data-primary-field', lead);
    else el.removeAttribute('data-primary-field');
    if (made) {
      return {
        options: { readonly: true, as: (rows) => this.#madeTable(el, rows, slot, source) },
        bound: () => this.#keepsToCard(el, slot, source),
      };
    }
    const pivot = this.#pivotSpec(el, slot, source);
    if (!pivot) return undefined;
    return {
      fields: [pivot.segment, pivot.stack],
      // A pivot is its scope's grid still: its Group and Sort arrange its rows' sub-grids,
      // and its headings and cells filter its rows, its rows' sub-grids too. TODOs 571, 574
      options: { arranges: true, readonly: true, steers: PIVOT_STEERS, as: (rows, src) => this.#pivotOf(el, rows, pivot, src, filters()) },
    };
  }

  /** A filter in a grid made from a chart is its slot's, in the Query, and narrows
   *  it alone: asked plainly, a field that Customer Records holds would be answered
   *  there. Its rows and its cells' state come back from the source. Will, TODO 621
   *  TRAP T-a-grid-from-a-chart-keeps-to-its-card */
  #keepsToCard(el: Element, slot: string, source: DataSource): () => void {
    const stop = new AbortController();
    el.addEventListener('column-filter-change', (e) => {
      e.stopPropagation();
      const { field, reading } = (e as CustomEvent<{ field: string; reading: FieldReading | null }>).detail;
      source.query.setReading(slot, field, reading, { only: el as Populatable });
      source.query.commit({ field });
      // A field's home draws its controls: this scope is not its home, so it is told here.
      (el as Element & { drawReading(f: string, r: FieldReading): void }).drawReading(field, source.query.reading(slot, field) ?? {});
    }, { signal: stop.signal });
    return () => stop.abort();
  }

  /** What a grid made from a chart can show: every field of the page, as a row opened
   *  on its own rows shows them. A gauge splits nothing, so it shows its rows: what
   *  names a row, from the page's own grid, and the number it reads. Will, TODO 625 */
  #madeColumns(el: Element, source: DataSource): TableColumn[] {
    const page = this.#host.el.querySelector<Grid>('sherpa-data-grid:not([data-segment-field])');
    const fields = this.#authored.get(el) === 'gauge'
      ? [page?.columns?.[0]?.field, el.getAttribute('data-field')].filter((field): field is string => !!field)
      : this.#host.pageFields();
    return fields.map((field) => {
      const facts = source.fieldFacts(field);
      return { field, header: facts.label ?? field, sortable: true, ...(facts.type ? { type: facts.type } : {}) };
    });
  }

  /** A grid made from a chart: its first axis, which leads its columns. */
  #madeLead(el: Element, slot: string, source: DataSource): string | null {
    if (this.#authored.get(el) === 'gauge') return (el as Grid).columns?.[0]?.field ?? null;
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

  /** What a grid made from a chart draws: the table its chart counts, its columns'
   *  filters with it — a gauge's, its rows, as they are. TRAP T-a-grid-from-a-chart-keeps-to-its-card */
  #madeTable(el: Element, rows: readonly Row[], slot: string, source: DataSource): unknown {
    const columns = (el as Grid).columns ?? [];
    const fields = columns.map((c) => c.field);
    source.readValues(fields);
    const filters = Object.fromEntries(fields.map((f) => [f, source.filterDef(f)]));
    // A gauge's number is one mean: no count to total, so its rows, as they are.
    if (this.#authored.get(el) === 'gauge') return { rows, groups: null, filters };
    const { group, sort } = source.query.presented(slot, 'chart');
    return { pivot: madeTable(rows, this.#madeAxes(el, slot, source), { columns, group, sort }, this.#facts(source, filters)) };
  }

  /** A grid's pivot, where its slot names a Secondary: its Primary — else its first
   *  column — a row a value, the Secondary's values its columns. Will, TODO 548 */
  #pivotSpec(el: Element, slot: string, source: DataSource): (SummarySpec & { segment: string; stack: string }) | undefined {
    const shown = source.query.presented(slot, 'grid');
    const lead = shown.primary ?? (el as Grid).columns?.[0]?.field;
    if (!shown.secondary || !lead) return undefined;
    return { shape: 'segments', segment: lead, stack: shown.secondary, ...(shown.sort ? { sort: shown.sort } : {}) };
  }

  /** A pivot for its grid, its headings' filters with it. Will, TODOs 548, 570, 574 */
  #pivotOf(el: Element, rows: readonly Row[], spec: SummarySpec & { segment: string; stack: string }, src: DataSource, filtered: readonly string[]): unknown {
    const fields = [...new Set([...filtered, spec.segment])];
    src.readValues(fields);
    const filters = Object.fromEntries(fields.map((f) => [f, src.filterDef(f)]));
    const grid = el as Grid;
    return { pivot: pivotTable(rows, spec, { columns: grid.columns ?? [], key: grid.key ?? null, group: src.state.group }, this.#facts(src, filters)) };
  }

  /** What a table reads of its source: each field's values and name, and its words. */
  #facts(source: DataSource, filters: Record<string, unknown>): TableFacts {
    return { domain: (f) => source.valuesFor(f), label: (f) => source.fieldFacts(f).label ?? f, filters, total: this.#host.word('total') };
  }

  /** What a chart shows by its own attributes: its slot's default. Will, TODO 548 */
  shows(el: Element): Presentation {
    const segment = this.#host.inherited(el, 'data-segment-field');
    const stack = this.#host.inherited(el, 'data-stack-field');
    return { ...(segment ? { primary: segment } : {}), ...(stack ? { secondary: stack } : {}) };
  }

  /** A slot's kept presentation moved: `answer` again, with it. A grid draws rows,
   *  not a summary: only its kind, its Primary and its Secondary move it. Will, TODO 548 */
  follow(source: DataSource, slot: string, kindOnly: boolean, answer: () => void): () => void {
    const read = (): string => {
      const shown = source.query.presented(slot);
      return JSON.stringify(kindOnly ? [shown.kind, shown.primary, shown.secondary] : shown);
    };
    const was = read();
    const stop = new AbortController();
    source.query.addEventListener('query-change', (e) => {
      const moved = (e as CustomEvent<QueryChangeDetail>).detail.scopes.includes(slot);
      if (moved && read() !== was) answer();
    }, { signal: stop.signal });
    return () => stop.abort();
  }
}
