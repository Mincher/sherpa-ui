/**
 * filter-utils.ts
 *
 * Shared row-filtering helpers used by data components (sherpa-data-grid,
 * sherpa-barchart, etc.).
 */

/** A filter that restricts a row field to an allowed value set. */
export interface FieldValueFilter {
  field: string;
  values: string[];
}

/**
 * Filter an array of rows so that every provided filter matches.
 * Returns the original array reference when the filters list is empty.
 */
export function applyFieldValueFilters<T extends Record<string, unknown>>(
  rows: T[],
  filters: FieldValueFilter[],
): T[] {
  if (!filters.length) return rows;
  return rows.filter((row) =>
    filters.every(({ field, values }) => {
      const val = row[field];
      if (val == null) return false;
      return values.includes(String(val));
    }),
  );
}
