/**
 * refreshDataset — Re-dispatches the datasetfiltered event to refresh all
 * viz children within a content area.
 *
 * @module grid-refresh
 *
 * @example
 * import { refreshDataset } from 'sherpa-ui/components/utilities/grid-refresh.js';
 *
 * // After mutating dataset records:
 * await refreshDataset(contentArea, () => loadDataset('devices'));
 */

/**
 * Reload a dataset and dispatch a `datasetfiltered` event on the content area
 * so all viz children (grids, charts, metrics) re-render.
 *
 * @param {HTMLElement} contentArea — The <sherpa-layout-grid> element
 * @param {function(): Promise<{records: Array, fields: Array}>} loader — Async function that returns { records, fields }
 */
export async function refreshDataset(contentArea, loader) {
  if (!contentArea || !loader) return;
  const ds = await loader();
  if (!ds) return;
  contentArea.dispatchEvent(
    new CustomEvent('datasetfiltered', {
      bubbles: false,
      detail: { records: ds.records, fields: ds.fields },
    })
  );
}
