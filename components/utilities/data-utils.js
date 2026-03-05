/**
 * Data Utilities
 * Pure data-transformation helpers used by data-viz components.
 * No external dependencies — operates solely on the data objects
 * that components already hold in memory.
 */

/**
 * Extract a transferable (serialisable) config from a data object.
 * Used by components when converting between presentation types
 * (e.g. table → chart) or exporting configuration.
 *
 * @param {Object} data - Standardised data object from a data provider
 * @param {string} presentationType - Target presentation type
 * @returns {Object} Plain config object suitable for JSON serialisation
 */
export function getTransferableConfig(data, presentationType) {
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
