/**
 * Data Utilities
 * Pure data-transformation helpers used by data-viz components.
 * No external dependencies — operates solely on the data objects
 * that components already hold in memory.
 */

/**
 * Parse a JSON string array attribute into `string[]`, coercing members to
 * strings and returning `[]` on missing/invalid/non-array input. Never throws.
 * Consolidates the identical `#readValue`/`#parseStoredValue`/… pattern that
 * lived in input-tag, select-group, and quick-filter-toolbar.
 */
export function parseStringArrayAttr(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Extract a transferable (serialisable) config from a data object.
 * Used by components when converting between presentation types
 * (e.g. table → chart) or exporting configuration.
 *
 * @param {Object} data - Standardised data object from a data provider
 * @param {string} presentationType - Target presentation type
 * @returns {Object} Plain config object suitable for JSON serialisation
 */
interface TransferableMetadata {
  dataset?: unknown;
  category?: unknown;
  series?: unknown;
  value?: unknown;
  agg?: unknown;
  measures?: unknown;
  orderBy?: unknown;
  segmentBy?: unknown;
  limit?: unknown;
  filters?: unknown;
  valueField?: unknown;
  categoryField?: unknown;
}

interface TransferableSource {
  name?: string;
  metadata?: TransferableMetadata;
  config?: { showStatus?: boolean; unit?: string };
}

export function getTransferableConfig(
  data: TransferableSource | null | undefined,
  presentationType: string,
): {
  name: string;
  dataset: unknown;
  category: unknown;
  series: unknown;
  value: unknown;
  agg: unknown;
  measures: unknown;
  orderBy: unknown;
  segmentBy: unknown;
  limit: unknown;
  filters: unknown;
  showStatus: boolean | undefined;
  unit: string | undefined;
  presentationType: string;
  valueField: unknown;
  categoryField: unknown;
} {
  const meta = data?.metadata || {};
  return {
    name: data?.name || '',
    dataset: meta.dataset,
    category: meta.category,
    series: meta.series,
    value: meta.value,
    agg: meta.agg,
    measures: meta.measures,
    orderBy: meta.orderBy,
    segmentBy: meta.segmentBy,
    limit: meta.limit,
    filters: meta.filters,
    showStatus: data?.config?.showStatus,
    unit: data?.config?.unit,
    presentationType,
    // Legacy fields for component compatibility
    valueField: meta.valueField,
    categoryField: meta.categoryField,
  };
}
