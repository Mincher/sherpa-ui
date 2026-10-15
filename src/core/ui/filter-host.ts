/**
 * filter-host.ts — what a filter bar and the filter panel both read off their
 * own host: the arrangement its source writes, and the fields that wait.
 *
 * Map:
 * - organiseOptions — A Group or Sort chip's rows: each column, the one in force ticked.
 * - arrangeFrom — Follow the host's arrangement onto its Group or Sort chip; the chip knows how.
 * - pendingFields — The fields the host's source says wait for their Apply.
 */
import type { OrganiseColumn } from '../data/data-source.js';
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

/** The fields the host's source says wait for their Apply: `data-pending`, space-separated. */
export function pendingFields(host: HTMLElement): Set<string> {
  return new Set((host.dataset['pending'] ?? '').split(' ').filter(Boolean));
}
