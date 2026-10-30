/**
 * field-status.ts — one answer to "what state is this field in?", for every
 * control. DOM-free. TRAP T-one-field-one-status
 *
 * Map:
 * - FieldStatus — What one field is now, as seen from one scope.
 * - StatusFacts — What a status reads beyond the Query.
 * - fieldStatus — One field's status, as seen from one scope.
 */
import type { FieldReading, FilterState } from './filter-state.js';
import { VIEW, type Query } from './query.js';
import { holdsField, homeOf, readingOf } from './query-edits.js';

/** What one field is now, as seen from one scope. */
export interface FieldStatus {
  field: string;
  /** The scope its reading lives in. */
  home: string;
  /** The scope above this one that holds it, or null. Its answer is shown here and changed there. */
  above: { scope: string; label: string } | null;
  /** Its answer as it stands, Apply or not. */
  reading: FieldReading | null;
  /** Its answer in force, wherever it lives. */
  applied: FieldReading | null;
  /** Does an answer narrow by it now? */
  on: boolean;
  /** The presets on that hold it, by name. */
  presets: string[];
  /** Changed, and waiting for Apply. */
  pending: boolean;
  /** Its data could not be read. */
  failed: boolean;
}

/** What a status reads beyond the Query. */
export interface StatusFacts {
  draft: Query;
  applied: Query;
  state: (field: string, reading: FieldReading) => FilterState;
  pending: (field: string) => boolean;
  failed: (field: string) => boolean;
  label: (scope: string) => string;
}

/** One field's status, as seen from one scope. */
export function fieldStatus(facts: StatusFacts, field: string, scope: string): FieldStatus {
  const reading = readingOf(facts.draft, field) ?? null;
  const applied = readingOf(facts.applied, field) ?? null;
  const above = scope !== VIEW && holdsField(facts.draft, VIEW, field);
  return {
    field,
    home: homeOf(facts.draft, field),
    above: above ? { scope: VIEW, label: facts.label(VIEW) } : null,
    reading,
    applied,
    on: !!applied && facts.state(field, applied).fieldState === 'active',
    presets: Object.values(reading?.byPreset ?? {}).map((p) => p.label),
    pending: facts.pending(field),
    failed: facts.failed(field),
  };
}
