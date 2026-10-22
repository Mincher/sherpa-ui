/**
 * filter-host.ts — what a filter bar and the filter panel both read off their
 * own host: the arrangement its source writes, and the fields that wait.
 *
 * Map:
 * - organiseOptions — A Group or Sort chip's rows: each column, the one in force ticked.
 * - arrangeFrom — Follow the host's arrangement onto its Group or Sort chip; the chip knows how.
 * - pendingFields — The fields the host's source says wait for their Apply, or could not be fetched.
 * - markField — One field's chips and menus, told whether it waits for Apply and whether its read failed.
 * - limitField — One field's value chips and menus, told what the filters before it leave and what its chain offers.
 * - drawCount — A count on a badge that is not a chip's: its number, and its words for a reader.
 */
import type { OrganiseColumn } from '../data/data-source.js';
import { ruleOut } from '../data/filter-state.js';
import { countSaid } from '../data/filter-face.js';
import type { SherpaMenu } from '../../components/sherpa-menu/sherpa-menu.js';
import type { FilterOption } from './filter-def.js';
import type { SherpaQuickFilter } from '../../components/sherpa-quick-filter/sherpa-quick-filter.js';

/** A Group or Sort chip's rows: each column, the one in force ticked. */
export function organiseOptions(cols: readonly OrganiseColumn[] | undefined, on: string | undefined): FilterOption[] {
  return (cols ?? []).map((c) => ({ value: c.field, label: c.label, selected: c.field === on }));
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
 *  its read failed (`critical`). ONE door for both hosts. TODO 424 ·
 *  TRAP T-a-pending-chip-reads-as-a-warning */
export function markField(
  chips: Iterable<Element | null | undefined>, menus: Iterable<Element | null | undefined>,
  said: { pending: boolean; failed: boolean; drafting?: boolean },
): void {
  for (const chip of chips) {
    chip?.toggleAttribute('data-pending', said.pending || !!said.drafting);
    chip?.toggleAttribute('data-failed', said.failed);
  }
  for (const menu of menus) menu?.toggleAttribute('data-pending', said.pending);
}

/** One field's value chips — a panel run's — and its menus, told what the
 *  filters before it leave and what its chain offers. A value they rule out
 *  reads inactive and is refused, on or off; one the chain does not offer goes,
 *  unless ticked (Will, 2026-10-20). ONE door for both hosts. TODO 424 ·
 *  TRAP T-a-ruled-out-value-is-greyed */
export function limitField(
  values: Iterable<HTMLElement>, menus: Iterable<SherpaMenu | null | undefined>,
  limits: { present: readonly string[] | null; offered: readonly string[] | null; hide: boolean },
): void {
  const out = ruleOut(limits.present, limits.offered);
  for (const chip of values) {
    const why = out(chip.dataset['value'] ?? '');
    chip.toggleAttribute('data-removed', why === 'unoffered' && !chip.hasAttribute('data-current'));
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
 *  number, as a chip says it, and its words for a reader. `null` leaves it
 *  unsaid. Gives what it wrote. TODO 424 */
export function drawCount(
  badge: Element | null | undefined, n: number | null | undefined, noun?: readonly [one: string, many: string],
): string | null {
  if (n == null) {
    badge?.removeAttribute('aria-label');
    return null;
  }
  const { said, label } = countSaid(n, noun);
  if (badge) {
    badge.textContent = said;
    badge.setAttribute('aria-label', label);
  }
  return said;
}
