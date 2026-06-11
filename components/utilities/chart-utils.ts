/**
 * chart-utils.js — Shared helpers for chart components.
 *
 * Pure accessor functions extracted from sherpa-barchart, sherpa-donut-chart,
 * and sherpa-line-chart to eliminate duplicated segment/sort attribute reading.
 *
 * Exports:
 *   getSegmentField(host)         — read data-segment-field from host
 *   isSegmentEnabled(host)        — check if segment is active
 *   getActiveSort(host)           — read data-sort-direction if active
 *   applySegmentBy(host, data)    — set/clear segment attrs from content config
 *   syncChartTitle(titleEl, host) — update title element from segment state
 */

import { formatFieldName, cleanTitleBase } from './format-utils.js';

/**
 * Read the segment field name from the host element.
 * @param {HTMLElement} host
 * @returns {string|null}
 */
export function getSegmentField(host: HTMLElement): string | null {
  return host.getAttribute("data-segment-field") || null;
}

/**
 * Check whether segmentation is enabled on the host.
 * @param {HTMLElement} host
 * @returns {boolean}
 */
export function isSegmentEnabled(host: HTMLElement): boolean {
  const mode = host.getAttribute("data-segment-mode");
  const field = getSegmentField(host);
  return mode !== "off" && !!field;
}

/**
 * Read the active sort spec from the host element.
 * @param {HTMLElement} host
 * @returns {{ dir: string }|null}
 */
export function getActiveSort(host: HTMLElement): { dir: string } | null {
  const dir = host.getAttribute("data-sort-direction") || null;
  if (!dir || dir === "off") return null;
  return { dir };
}

/**
 * Apply segmentBy config from incoming data to the host's segment attributes.
 * Only acts when the incoming data object explicitly has a `segmentBy` key.
 */
export function applySegmentBy(host: HTMLElement, data: object): void {
  if (!Object.prototype.hasOwnProperty.call(data, 'segmentBy')) return;
  const seg = (data as { segmentBy?: string }).segmentBy;
  if (seg) {
    host.setAttribute('data-segment-field', seg);
    host.setAttribute('data-segment-mode', 'on');
  } else {
    host.removeAttribute('data-segment-field');
    host.removeAttribute('data-segment-mode');
  }
}

/**
 * Update a chart title element based on current segment state.
 * Produces "<Entity> by <field>" when a segment is active, "All <entity>" otherwise.
 */
export function syncChartTitle(titleEl: Element | null, host: HTMLElement): void {
  if (!titleEl) return;
  const entity = cleanTitleBase((host as HTMLElement & { dataset: DOMStringMap }).dataset['title'] || '');
  const segMode    = host.getAttribute('data-segment-mode');
  const groupField = host.getAttribute('data-segment-field') || host.getAttribute('data-category');
  const hasActiveGroup = segMode !== 'off' && !!groupField;
  titleEl.textContent = hasActiveGroup && groupField
    ? `${entity} by ${formatFieldName(groupField)}`
    : `All ${entity}`;
}
