/**
 * filter-host.ts — what a filter bar, in a row or a column, reads off its own
 * host: the arrangement its source writes, and the fields that wait.
 *
 * Map:
 * - organiseOptions — A Group or Sort chip's rows: each column, the one in force ticked.
 * - organiseOf — A scope's leading chips, as its description says: Group and Sort, and a chart's Primary, Secondary and order.
 * - arrangeFrom — Follow the host's arrangement onto its Group or Sort chip; the chip knows how.
 * - pendingFields — The fields the host's source says wait for their Apply, or could not be fetched.
 * - markField — One field's chips and menus, told whether it waits for Apply and whether its read failed.
 * - markHeld — One chip told whether a scope above holds its field, and that scope's name.
 * - limitField — One field's value chips and menus, told what the filters before it leave and what its chain offers.
 * - drawCount — A count on a badge that is not a chip's: its number, and its words for a reader.
 * - NextFrame — What changed this frame, handed over ONCE, the frame after.
 * - .add — Hand this over next frame; with nothing, only make sure the frame comes.
 * - .cancel — Drop what waits — the host left the page.
 * - answerWhenDrawn — Give a menu an answer once it has drawn, and redraw its chip.
 */
import type { OrganiseColumn, ScopeDescription } from '../data/data-source.js';
import { goesFromList, ruleOut, type FieldReading } from '../data/filter-state.js';
import { countSaid } from '../data/filter-face.js';
import type { SherpaMenu } from '../../components/sherpa-menu/sherpa-menu.js';
import type { FilterOption } from './filter-def.js';
import type { SherpaQuickFilter } from '../../components/sherpa-quick-filter/sherpa-quick-filter.js';

/** A Group or Sort chip's rows: each column, the one in force ticked. */
export function organiseOptions(cols: readonly OrganiseColumn[] | undefined, on: string | undefined): FilterOption[] {
  return (cols ?? []).map((c) => ({ value: c.field, label: c.label, selected: c.field === on }));
}

/** A scope's leading chips, as its description says: Group and Sort, and — a
 *  chart's slot — its Primary, Secondary and a Sort with no column. Every host draws it from
 *  here, so none leaves one out. Will, TODO 548 */
export function organiseOf(scope: ScopeDescription): {
  group: OrganiseColumn[]; sort: OrganiseColumn[]; order?: true;
  chart?: { fields: OrganiseColumn[]; secondaryFields?: OrganiseColumn[]; primary?: string; primaryDefault?: string; secondary?: string; stacks?: true };
} {
  return {
    group: scope.group ?? [], sort: scope.sort ?? [],
    // A chart's Sort orders its segments, and has no column to pick.
    ...(scope.presents ? { order: true as const } : {}),
    ...(scope.chartFields ? {
      chart: {
        fields: scope.chartFields,
        ...(scope.secondaryFields ? { secondaryFields: scope.secondaryFields } : {}),
        ...(scope.primaryField ? { primary: scope.primaryField } : {}),
        ...(scope.primaryDefault ? { primaryDefault: scope.primaryDefault } : {}),
        ...(scope.secondaryField ? { secondary: scope.secondaryField } : {}),
        ...(scope.stacks ? { stacks: true as const } : {}),
      },
    } : {}),
  };
}

/** Follow `data-group-field` or `data-sort-field`, and `data-sort-direction`, onto
 *  the host's Group or Sort chip — silently. A GROUP IS A SORT WITH NO DIRECTION:
 *  one door, so the two cannot drift. TRAP T-a-chip-body-cycles-its-states */
export function arrangeFrom(host: HTMLElement, chip: SherpaQuickFilter | null | undefined, kind: 'group' | 'sort'): void {
  chip?.arrangeBy?.(host.dataset[kind === 'sort' ? 'sortField' : 'groupField'] ?? '', host.dataset['sortDirection']);
}

/** The fields the host's source says wait for their Apply — `data-pending`,
 *  space-separated — or, with `failed`, could not be fetched (TODO 411). */
export function pendingFields(host: HTMLElement, list: 'pending' | 'failed' = 'pending'): Set<string> {
  return new Set((host.dataset[list] ?? '').split(' ').filter(Boolean));
}

/** One field's chips and menus — a bar's one chip, or a panel's every chip of
 *  the field — told it waits for Apply (`warning`, and Discard on) and whether
 *  its read failed (`critical`). Where it says which chips its draft `changed`,
 *  only those read as pending. TODO 424 ·
 *  TRAP T-a-pending-chip-reads-as-a-warning */
export function markField(
  chips: Iterable<Element | null | undefined>, menus: Iterable<Element | null | undefined>,
  said: { pending: boolean; failed: boolean; changed?: ReadonlySet<Element> },
): void {
  for (const chip of chips) {
    if (!chip) continue;
    chip.toggleAttribute('data-pending', said.pending && (said.changed?.has(chip) ?? true));
    chip.toggleAttribute('data-failed', said.failed);
  }
  for (const menu of menus) menu?.toggleAttribute('data-pending', said.pending);
}

/** One chip told whether a scope above holds its field, and that scope's name: it
 *  reads inactive and says where it went. The one writer of these. TRAP T-one-field-one-status */
export function markHeld(chip: Element, held: boolean, at?: string): void {
  chip.toggleAttribute('data-superseded', held);
  if (held && at) chip.setAttribute('data-applied-at', at);
  else chip.removeAttribute('data-applied-at');
}

/** One field's value chips — a panel run's — and its menus, told what the
 *  filters before it leave and what its chain offers. A value they rule out
 *  reads inactive and is refused, on or off; one the chain does not offer goes,
 *  unless ticked (Will, 2026-10-20). TODO 424 ·
 *  TRAP T-a-ruled-out-value-is-greyed */
export function limitField(
  values: Iterable<HTMLElement>, menus: Iterable<SherpaMenu | null | undefined>,
  limits: { present: readonly string[] | null; offered: readonly string[] | null; hide: boolean },
): void {
  const out = ruleOut(limits.present, limits.offered);
  for (const chip of values) {
    const why = out(chip.dataset['value'] ?? '');
    // Hiding unmatched, one it rules out goes too, as a menu row does. TODO 448
    chip.toggleAttribute('data-removed', goesFromList(why, limits.hide, chip.hasAttribute('data-current')));
    chip.toggleAttribute('data-unavailable', why !== null);
  }
  for (const menu of menus) {
    if (!menu) continue;
    // Hiding unmatched, a row Limit rules out goes. Will, TODO 205.
    menu.toggleAttribute('data-hide-unavailable', limits.hide);
    Object.assign(menu, { present: limits.present, offered: limits.offered });
  }
}

/** A count on a badge that is not a chip's — a panel field's or scope's: its
 *  number, as a chip says it, and its words for a reader. `null` empties it, and
 *  an empty badge hides itself. TODOs 424, 523 P4 */
export function drawCount(
  badge: Element | null | undefined, n: number | null | undefined, noun?: readonly [one: string, many: string],
): void {
  if (!badge) return;
  if (n == null) {
    badge.replaceChildren();
    badge.removeAttribute('aria-label');
    return;
  }
  const { said, label } = countSaid(n, noun);
  badge.textContent = said;
  badge.setAttribute('aria-label', label);
}

/** What changed this frame — a field, a chip — handed over ONCE, the frame
 *  after: a rebuilt row reads empty for a tick, and one edit is one request.
 *  TODO 424 · TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
export class NextFrame<T> {
  /** What changed since the frame was asked for. */
  #items = new Set<T>();
  /** The frame asked for, or null. */
  #frame: number | null = null;

  constructor(private readonly run: (items: T[]) => void) {}

  /** Hand this over next frame; with nothing, only make sure the frame comes. */
  add(item?: T): void {
    if (item !== undefined) this.#items.add(item);
    if (this.#frame != null) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      const items = [...this.#items];
      this.#items.clear();
      this.run(items);
    });
  }

  /** Drop what waits — the host left the page. */
  cancel(): void {
    if (this.#frame != null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.#items.clear();
  }
}

/** Give a menu an answer once it has DRAWN — rows set into nothing are dropped —
 *  and redraw its chip from it. `still` says it is still wanted when the time
 *  comes. TODO 424 · TRAP T-a-rebuild-keeps-every-answer · TRAP T-a-silent-steer-still-redraws-its-chip */
export function answerWhenDrawn(
  menu: SherpaMenu, reading: FieldReading, still: () => boolean = () => true, onDrawn?: (chip: SherpaQuickFilter | null) => void,
): Promise<void> {
  return Promise.resolve(menu.rendered).then(() => {
    if (!still()) return;
    menu.reading = reading;
    const chip = menu.closest<SherpaQuickFilter>('sherpa-quick-filter');
    onDrawn?.(chip);
    chip?.refresh?.();
  });
}
