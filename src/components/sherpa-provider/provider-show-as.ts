/**
 * provider-show-as.ts — Show as: a slot's element swapped for the one the registry
 * says draws the kind its kept presentation names, in a view transition where
 * there is one; a grid in a slot a pivot, or a table of its chart's own answer.
 * Its card's menu and title told. Will, TODO 548 · TRAP T-a-kind-is-registered-never-a-tag
 *
 * Map:
 * - ShowHost — What Show as asks of its provider.
 * - Table — A grid drawn as a table: what it binds with, and what keeps it to its card.
 * - ProviderShowAs — Show as, for one provider's subtree.
 * - .menus — Every card's Show as told what its slot shows — or off.
 * - .picked — A Show as pick: its card's slot keeps it; Default keeps none.
 * - .retitle — A chart card's title follows what the reader set; set nothing, its page's own.
 * - .swapped — Swap an element for the one its slot shows, where that differs; true when swapped.
 * - .table — A grid in a slot: a pivot, a table of its chart's answer, or none — its Primary leading.
 * - .shows — What a chart shows by its own attributes: its slot's default.
 * - .follow — A slot's kept presentation moved: what follows it is answered again.
 */
import { report } from '../../core/data/report.js';
import { crossSpec, crossTable, type SummarySpec, type TableColumn, type TableFacts } from '../../core/data/aggregate.js';
import type { QueryChangeDetail } from '../../core/data/query-context.js';
import type { Presentation } from '../../core/data/query.js';
import type { Row } from '../../core/data/store.js';
import type { DataSource } from '../../core/data/data-source.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import type { DataAsk } from '../../core/ui/context.js';
import { kept, presenter, presentsOf, type Presenter, type Shape } from '../../core/ui/show-as.js';
import { declared } from './provider-declared.js';
import { bindId, type BindOptions } from '../../core/ui/bind-source.js';

/** What a pivot steers: a filter, from a heading or a cell — its own or a row's
 *  sub-grid's — and its sub-grids' sort and group. TODOs 571, 574 */
const PIVOT_STEERS = ['column-filter-change', 'filter-apply', 'filter-discard', 'sort-change', 'group-change'] as const;

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
  /** The fields the open page declares, what names a row first. */
  pageFields(): string[];
  /** The summary an element declares, as its provider reads it, in a slot. */
  spec(el: Element, asks: DataAsk, source: DataSource, slot: string): SummarySpec | undefined;
  /** The attribute an answer of this shape needs before it is asked: a split chart's field. */
  declares(shape: Shape): string | undefined;
}

/** A grid drawn as a table: what it binds with, the fields it reads, and what keeps it to its card. */
export interface Table {
  options: Pick<BindOptions, 'readonly' | 'as' | 'arranges' | 'steers'>;
  fields?: string[];
  /** Once bound: what keeps it to its card, and its stop. */
  bound?(): () => void;
}

/** A swap, in a view transition where the engine has one and the reader has not
 *  asked for less motion; else at once. TRAP T-a-swap-is-a-view-transition */
function inTransition(swap: () => void): void {
  if (typeof document.startViewTransition !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    swap();
    return;
  }
  // Skipped — another began, or the tab is hidden: it is swapped all the same.
  document.startViewTransition(swap).ready.catch(() => undefined);
}

/** Show as, for one provider's subtree. */
export class ProviderShowAs {
  /** The provider it serves. */
  readonly #host: ShowHost;
  /** The kind a made element's page drew its slot as: what Default goes back to. */
  readonly #authored = new WeakMap<Element, string>();
  /** Each slot's own element, kept aside while another shows its data. */
  readonly #parked = new Map<string, Element>();
  /** An element whose swap waits for its transition: asked again, it is not swapped twice. */
  readonly #swapping = new WeakSet<Element>();
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
    source.query.ask({ scope: slot, presentation: { kind: kind && kind !== 'default' ? kind : undefined } });
  };

  /** A chart card's title follows what the reader set: "Primary by Secondary,
   *  grouped by Group", each part only where it is set. Set nothing, its page's
   *  own. Will, TODO 567 */
  retitle(el: Element, slot: string, source: DataSource): void {
    const shown = source.query.presented(slot, 'chart');
    const own = source.query.presented(slot, 'chart', false);
    const set = shown.primary !== own.primary || shown.secondary !== own.secondary || shown.group !== own.group;
    const name = (field: string | null | undefined): string => (field ? source.fieldFacts(field).label ?? field : '');
    const stacks = declared(el).asks?.stacks;
    const secondary = shown.secondary ?? el.getAttribute('data-stack-field');
    const by = stacks && secondary ? ` ${this.#host.word('by')} ${name(secondary)}` : '';
    const grouped = shown.group ? `, ${this.#host.word('grouped-by')} ${name(shown.group)}` : '';
    const title = `${name(shown.primary ?? el.getAttribute('data-segment-field'))}${by}${grouped}`;
    // Its card's header: what sits in a header slot and declares a heading.
    for (const host of this.#host.el.querySelectorAll('[slot="header"]')) {
      if (!('data-heading' in ((host.constructor as { props?: object }).props ?? {}))) continue;
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

  /** Swap an element for the one its slot shows, where that differs; its card's
   *  Show as is told either way. True when swapped. Will, TODO 548 */
  swapped(el: Element, slot: string, source: DataSource): boolean {
    const shown = source.query.presented(slot);
    const authored = this.#authored.get(el) ?? presentsOf(el)?.kind;
    const own = source.query.presented(slot, undefined, false).kind ?? authored;
    for (const host of this.#host.el.querySelectorAll('[data-presentation]')) {
      if (this.#host.inherited(host, 'data-scope') !== slot) continue;
      if (own) host.setAttribute('data-presentation-default', own);
      host.setAttribute('data-presentation', this.#menuOf(source, slot));
    }
    this.#host.drawToolbars(slot);
    if (this.#swapping.has(el)) return true;
    const kind = shown.kind ?? authored;
    if (!authored || !kind || kind === presentsOf(el)?.kind) return false;
    const parked = this.#parked.get(slot);
    // Back to the page's own: the very element, a grid with its columns.
    const back = parked && presentsOf(parked)?.kind === kind ? parked : undefined;
    const made = back ? undefined : presenter(kind);
    if (!back && !made) return false;
    // The page's own is what a made one takes its attributes, its split and its parts from.
    const page = parked ?? el;
    // A split chart's first split is its slot's Primary, else the page's own's, else its
    // grid's first column. Will, TODO 548
    const needs = made?.shape ? this.#host.declares(made.shape) : undefined;
    const split = needs
      ? source.query.presented(slot, 'chart').primary ?? page.getAttribute(needs) ?? (page as Grid).columns?.[0]?.field
      : undefined;
    if (needs && !split) {
      report({
        code: 'presentation-without-primary',
        message: `sherpa-provider: slot "${slot}" cannot be shown as a ${kind} chart: it names no primary field for its X axis.`,
        at: { scope: slot, kind },
      });
      return false;
    }
    this.#host.forget(el);
    this.#swapping.add(el);
    const swap = (): void => {
      this.#swapping.delete(el);
      if (!el.isConnected) return;
      const next = back ?? this.#make(made!, page, needs, split);
      this.#hand(el, next, page, !back);
      // A grid made from a chart takes its filters with it: they narrow it alone.
      if (this.#authored.has(el)) {
        for (const c of (el as Grid).columns ?? []) source.query.ask({ scope: slot, field: c.field, reading: null, only: bindId(el) });
      } else this.#parked.set(slot, el);
      if (back) this.#parked.delete(slot);
      else this.#authored.set(next, authored);
      el.replaceWith(next);
    };
    // A task on, never inside its own ask; gone by then, nothing transitions.
    void Promise.resolve().then(() => (el.isConnected ? inTransition(swap) : swap()));
    return true;
  }

  /** An element for a kind: what it keeps of the page's own, its kind's own
   *  attributes, and its split where it has none. */
  #make(made: Presenter, page: Element, needs: string | undefined, split: string | undefined): Element {
    const next = new made.ctor();
    for (const name of kept(page, made)) next.setAttribute(name, page.getAttribute(name) ?? '');
    for (const [name, value] of Object.entries(made.is ?? {})) next.setAttribute(name, value);
    if (needs && split && !next.hasAttribute(needs)) next.setAttribute(needs, split);
    return next;
  }

  /** Each slotted child goes where its slot is taken: the next, else the page's own,
   *  aside — a grid fills no legend. A slot a made one fills that came empty takes
   *  the page's own's, or the provider's `made-<slot>-tpl`. */
  #hand(el: Element, next: Element, page: Element, made: boolean): void {
    const fills = presentsOf(next)?.slots ?? [];
    const home = page !== el && page !== next ? page : undefined;
    const homes = home ? presentsOf(home)?.slots ?? [] : [];
    for (const child of [...el.children]) {
      const slot = child.getAttribute('slot');
      if (slot && fills.includes(slot)) next.append(child);
      else if (slot && homes.includes(slot)) home!.append(child);
    }
    if (!made) return;
    for (const slot of fills) {
      if (next.querySelector(`:scope > [slot="${slot}"]`)) continue;
      const part = home?.querySelector(`:scope > [slot="${slot}"]`) ?? this.#host.clone(`template.made-${slot}-tpl`);
      if (part) next.append(part);
    }
  }

  /**
   * A grid in a slot. Made from a chart: its chart's own answer as a table, every row
   * it counts, with no pager, so its scope stays a slot and its Group and Sort its
   * presentation's (D4 B, TODO 624). Its slot naming a Secondary: a PIVOT, a row a
   * Primary value, a column a Secondary value, row counts in the cells (TODO 548).
   * Else none: its own rows. Either way its Primary leads its columns.
   */
  table(el: Element, slot: string, source: DataSource, filters: () => readonly string[]): Table | undefined {
    if (this.#authored.has(el)) return this.#made(el, slot, source);
    const lead = source.query.presented(slot, 'grid').primary;
    if (lead) el.setAttribute('data-primary-field', lead);
    else el.removeAttribute('data-primary-field');
    const pivot = this.#pivotSpec(el, slot, source);
    if (!pivot) return undefined;
    return {
      fields: [pivot.segment, pivot.stack],
      // A pivot is its scope's grid still: its Group and Sort arrange its rows' sub-grids,
      // and its headings and cells filter its rows, its rows' sub-grids too. TODOs 571, 574
      options: { arranges: true, readonly: true, steers: PIVOT_STEERS, as: (rows, src) => this.#pivotOf(el, rows, pivot, src, filters()) },
    };
  }

  /** A grid made from a chart reads the answer its page's own chart is asked —
   *  the same summary, so the same numbers — laid out as a table. One number
   *  totals nothing: its rows, named by what names a row, and the field it reads.
   *  Will, TODOs 622, 625 · TRAP T-a-grid-from-a-chart-keeps-to-its-card */
  #made(el: Element, slot: string, source: DataSource): Table | undefined {
    const page = this.#parked.get(slot);
    const asks = page ? declared(page).asks : undefined;
    const spec = page && asks ? this.#host.spec(page, asks, source, slot) : undefined;
    if (!spec) return undefined;
    const one = spec.shape === 'aggregate';
    const lead = one ? this.#host.pageFields()[0] : crossSpec(spec).segment;
    const fields = one ? [lead, spec.field] : this.#host.pageFields();
    (el as Grid).columns = this.#columns(fields.filter((f): f is string => !!f), source);
    if (lead) el.setAttribute('data-primary-field', lead);
    else el.removeAttribute('data-primary-field');
    return {
      options: { readonly: true, as: (rows) => this.#laid(el, rows, one ? undefined : spec, source) },
      bound: () => this.#keepsToCard(el, slot, source),
    };
  }

  /** What a grid made from a chart draws: its chart's answer as a table, its columns'
   *  filters with it — one number's, its rows, as they are. TRAP T-a-grid-from-a-chart-keeps-to-its-card */
  #laid(el: Element, rows: readonly Row[], spec: SummarySpec | undefined, source: DataSource): unknown {
    const columns = (el as Grid).columns ?? [];
    const fields = columns.map((c) => c.field);
    source.readValues(fields);
    const filters = Object.fromEntries(fields.map((f) => [f, source.filterDef(f)]));
    if (!spec) return { rows, groups: null, filters };
    // Its parts group each row's own rows, and add no column. Will, TODO 661
    return { pivot: crossTable(rows, spec, { columns, group: spec.group }, this.#facts(source, filters)) };
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
      source.query.ask({ scope: slot, field, reading, only: bindId(el), commit: true });
      // A field's home draws its controls: this scope is not its home, so it is told here.
      (el as Element & { drawReading(f: string, r: FieldReading): void }).drawReading(field, source.query.reading(slot, field) ?? {});
    }, { signal: stop.signal });
    return () => stop.abort();
  }

  /** A grid's columns for these fields, each named as its source names it. */
  #columns(fields: readonly string[], source: DataSource): TableColumn[] {
    return fields.map((field) => {
      const facts = source.fieldFacts(field);
      return { field, header: facts.label ?? field, sortable: true, ...(facts.type ? { type: facts.type } : {}) };
    });
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
    return { pivot: crossTable(rows, spec, { columns: grid.columns ?? [], key: grid.key ?? null, group: src.state.group }, this.#facts(src, filters)) };
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
