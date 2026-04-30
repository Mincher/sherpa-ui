/**
 * Components Index
 *
 * Central export point for all custom web components.
 * Import this file to register all components with the browser.
 */

// Base class
export { SherpaElement } from "./utilities/sherpa-element/sherpa-element.js";

// View layout template helper
export { stampViewTemplate } from "./utilities/view-templates.js";

// Core layout components
export * from "./sherpa-nav/sherpa-nav.js";
export * from "./sherpa-nav-item/sherpa-nav-item.js";
export * from "./sherpa-nav-promo/sherpa-nav-promo.js";
export * from "./sherpa-view-header/sherpa-view-header.js";
export * from "./sherpa-data-viz-container/sherpa-data-viz-container.js";

// UI components
export * from "./sherpa-button/sherpa-button.js";
export * from "./sherpa-footer/sherpa-footer.js";
export * from "./sherpa-menu/sherpa-menu.js";
export * from "./sherpa-menu-item/sherpa-menu-item.js";

export * from "./sherpa-switch/sherpa-switch.js";
export * from "./sherpa-tag/sherpa-tag.js";
export * from "./sherpa-tooltip/sherpa-tooltip.js";

// Data visualization components
// export * from "./sherpa-data-viz/sherpa-data-viz.js"; // archived — consumer handles presentation switching
export * from "./sherpa-metric/sherpa-metric.js";
export * from "./sherpa-barchart/sherpa-barchart.js";
export * from "./sherpa-sparkline/sherpa-sparkline.js";
export * from "./sherpa-data-grid/sherpa-data-grid.js";
export * from "./sherpa-pagination/sherpa-pagination.js";
export * from "./sherpa-donut-chart/sherpa-donut-chart.js";
export * from "./sherpa-gauge-chart/sherpa-gauge-chart.js";
export * from "./sherpa-line-chart/sherpa-line-chart.js";
export * from "./sherpa-chart-legend/sherpa-chart-legend.js";

// Composition components
export * from "./sherpa-toolbar/sherpa-toolbar.js";
export * from "./sherpa-filter-bar/sherpa-filter-bar.js";

// Export components
export * from "./sherpa-container-pdf/sherpa-container-pdf.js";

// New components
export * from "./sherpa-accordion/sherpa-accordion.js";
export * from "./sherpa-breadcrumbs/sherpa-breadcrumbs.js";
export * from "./sherpa-list-item/sherpa-list-item.js";
export * from "./sherpa-loader/sherpa-loader.js";
export * from "./sherpa-panel/sherpa-panel.js";
export * from "./sherpa-popover/sherpa-popover.js";
export * from "./sherpa-product-bar/sherpa-product-bar.js";
export * from "./sherpa-product-bar-v2/sherpa-product-bar-v2.js";
export * from "./sherpa-progress-bar/sherpa-progress-bar.js";
export * from "./sherpa-progress-tracker/sherpa-progress-tracker.js";
export * from "./sherpa-slider/sherpa-slider.js";
export * from "./sherpa-tabs/sherpa-tabs.js";
export * from "./sherpa-callout/sherpa-callout.js";
export * from "./sherpa-card/sherpa-card.js";
export * from "./sherpa-dialog/sherpa-dialog.js";
export * from "./sherpa-empty-state/sherpa-empty-state.js";
export * from "./sherpa-file-upload/sherpa-file-upload.js";
export * from "./sherpa-key-value-list/sherpa-key-value-list.js";
export * from "./sherpa-message/sherpa-message.js";
export * from "./sherpa-section-header/sherpa-section-header.js";
export * from "./sherpa-section-nav/sherpa-section-nav.js";
export * from "./sherpa-stepper/sherpa-stepper.js";
export * from "./sherpa-toast/sherpa-toast.js";

// Form input components
export * from "./sherpa-input-text/sherpa-input-text.js";
export * from "./sherpa-input-number/sherpa-input-number.js";
export * from "./sherpa-input-select/sherpa-input-select.js";
export * from "./sherpa-input-search/sherpa-input-search.js";
export * from "./sherpa-input-date/sherpa-input-date.js";
export * from "./sherpa-input-date-range/sherpa-input-date-range.js";
export * from "./sherpa-input-time/sherpa-input-time.js";
export * from "./sherpa-input-password/sherpa-input-password.js";

// Node-graph components (sherpa-node family)
export * from "./sherpa-node-socket/sherpa-node-socket.js";
export * from "./sherpa-node-row/sherpa-node-row.js";
export * from "./sherpa-node-header/sherpa-node-header.js";
export * from "./sherpa-node/sherpa-node.js";
export * from "./sherpa-node-canvas/sherpa-node-canvas.js";
