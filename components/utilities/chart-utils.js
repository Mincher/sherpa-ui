/**
 * chart-utils.js — Shared helpers for chart components.
 *
 * Pure accessor functions extracted from sherpa-barchart, sherpa-donut-chart,
 * and sherpa-line-chart to eliminate duplicated segment/sort attribute reading.
 *
 * Exports:
 *   getSegmentField(host)   — read data-segment-field from host
 *   isSegmentEnabled(host)  — check if segment is active
 *   getActiveSort(host)     — read data-sort-direction if active
 */

/**
 * Read the segment field name from the host element.
 * @param {HTMLElement} host
 * @returns {string|null}
 */
export function getSegmentField(host) {
  return host.getAttribute("data-segment-field") || null;
}

/**
 * Check whether segmentation is enabled on the host.
 * @param {HTMLElement} host
 * @returns {boolean}
 */
export function isSegmentEnabled(host) {
  const mode = host.getAttribute("data-segment-mode");
  const field = getSegmentField(host);
  return mode !== "off" && !!field;
}

/**
 * Read the active sort spec from the host element.
 * @param {HTMLElement} host
 * @returns {{ dir: string }|null}
 */
export function getActiveSort(host) {
  const dir = host.getAttribute("data-sort-direction") || null;
  if (!dir || dir === "off") return null;
  return { dir };
}
