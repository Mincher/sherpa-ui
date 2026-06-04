/**
 * filter-menu-utils.js
 * Shared helpers for the filter-menu pattern used by viz components.
 *
 * All five viz components (barchart, donut-chart, line-chart, data-grid,
 * data-viz-container) share the same pattern: clone an internal
 * `<template id="filter-menu">` from shadow DOM into a light-DOM
 * `<template data-menu>` so that the host's overflow menu can discover it.
 *
 * This module centralises that logic so each component can delegate
 * with a one-liner instead of duplicating ~8 identical lines.
 */

/**
 * Clone the shadow-DOM `#filter-menu` template into a light-DOM
 * `<template data-menu>` on the host element.
 *
 * @param {HTMLElement & { $: Function }} host - SherpaElement instance
 * @returns {HTMLTemplateElement|null} The injected template, or null if already injected or source missing
 */
interface FilterMenuHost {
  $<E extends Element = HTMLElement>(selector: string): E | null;
  append(...nodes: (Node | string)[]): void;
}

export function injectFilterMenu(host: FilterMenuHost): HTMLTemplateElement | null {
  const src = host.$<HTMLTemplateElement>('#filter-menu');
  if (!src) return null;
  const tpl = document.createElement('template');
  tpl.setAttribute('data-menu', '');
  tpl.content.appendChild(src.content.cloneNode(true));
  host.append(tpl);
  return tpl;
}

/**
 * Remove a previously injected filter-menu template from the DOM.
 *
 * @param {HTMLTemplateElement|null} tpl - The template ref returned by injectFilterMenu
 */
export function removeFilterMenu(tpl: HTMLTemplateElement | null) {
  tpl?.remove();
}

/** Toggle the `data-filters` attribute on the host element. */
export function toggleFilters(host: Element): void {
  host.toggleAttribute('data-filters');
}

/** Toggle the `data-hide-legend` attribute on the host element. */
export function toggleLegend(host: Element): void {
  host.toggleAttribute('data-hide-legend');
}

/** Sync checked state of filter/legend menu items when the overflow menu opens. */
export function syncFilterMenuItems(e: CustomEvent, host: Element): void {
  const menu = e.detail?.menu;
  if (!menu) return;
  const filterItem = menu.querySelector('sherpa-menu-item[data-event="toggle-filters"]');
  if (filterItem) filterItem.toggleAttribute('checked', host.hasAttribute('data-filters'));
  const legendItem = menu.querySelector('sherpa-menu-item[data-event="toggle-legend"]');
  if (legendItem) legendItem.toggleAttribute('checked', !host.hasAttribute('data-hide-legend'));
}
