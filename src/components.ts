/**
 * components.ts — `sherpa-ui/components`: every display component, and the base
 * they stand on. Importing it DEFINES each element, in a browser. NO app layer:
 * a provider, a router, the session and saved Views are `sherpa-ui/app`, which
 * no display component imports. TRAP T-the-app-layer-is-opt-in
 *
 * Map:
 * - installIcons — DEPRECATED — a no-op since the icons became SVGs, one module each in core/ui/icons/
 * - installTokens — add tokens.css to the page once, so a component has its variables
 */
// What every shadow root adopts is SherpaElement's own default, so a
// single-component import draws right too (TODO 189).

/**
 * @deprecated A NO-OP since the icons became Figma SVGs baked into
 * `core/ui/icons/`. It loaded a 103KB Font Awesome sheet whose 1,935 `.fa-*`
 * rules were adopted into every shadow root and matched nothing.
 * Kept so an existing call does not throw; delete the call.
 */
export function installIcons(): void {
  /* nothing to install */
}

/**
 * Inject the light-DOM token layer (primitives → aliases → themes) into the
 * document head, once. Apps that already `<link>` tokens.css can skip this.
 */
let tokensInstalled = false;
export function installTokens(): void {
  if (tokensInstalled || typeof document === 'undefined') return;
  tokensInstalled = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./styles/tokens/tokens.css', import.meta.url).href;
  document.head.appendChild(link);
}

export { SherpaElement, define } from './core/ui/sherpa-element.js';
// A component drawn from YOUR markup, with your sheets after its own. TODO 27.
export { useTemplate, type OwnFiles } from './core/ui/templater.js';
// CONFIGURE a live element through its own API — the parity door a saved view,
// a preset and an agent's MCP call all go through.
// TRAP T-state-is-the-saved-view-half.
export { applyState, type Populatable } from './core/ui/apply-state.js';
// A component ASKS; the nearest provider ANSWERS. TRAP T-a-component-asks-its-provider
export {
  ContextRequestEvent, createContext, DATA_CONTEXT, SOURCE_CONTEXT,
  type Context, type ContextCallback, type DataAsk,
} from './core/ui/context.js';
/* A `data-grouped` grid needs each child's position, which CSS cannot see.
   TRAP T-a-wrapping-span-hides-its-own-row */
export { bindGroupedGrid, measureGroupedGrid } from './components/sherpa-layout-grid/grouped-grid.js';
// Wait for a tree's components to draw — for an app that measures, or a test.
export { settled } from './core/ui/settled.js';
// ONE datum shape for every chart and the legend beside it — see chart-datum.ts.
export type { ChartDatum, LegendDatum } from './core/data/chart-datum.js';


export { SherpaButton } from './components/sherpa-button/sherpa-button.js';
export { SherpaBadge } from './components/sherpa-badge/sherpa-badge.js';
export { SherpaTag } from './components/sherpa-tag/sherpa-tag.js';
export { SherpaChip } from './components/sherpa-chip/sherpa-chip.js';
export { SherpaContainer } from './components/sherpa-container/sherpa-container.js';
export { SherpaStack } from './components/sherpa-stack/sherpa-stack.js';
export { SherpaInputText } from './components/sherpa-input-text/sherpa-input-text.js';
export {
  SherpaNav,
  type NavEntry,
  type NavItem,
  type NavSection,
  type NavConfig,
} from './components/sherpa-nav/sherpa-nav.js';
export { SherpaLoader } from './components/sherpa-loader/sherpa-loader.js';
export { SherpaSwitch } from './components/sherpa-switch/sherpa-switch.js';
export { SherpaSelectCheckbox } from './components/sherpa-select-checkbox/sherpa-select-checkbox.js';
export { SherpaSelectRadio } from './components/sherpa-select-radio/sherpa-select-radio.js';
export { SherpaSelectCard } from './components/sherpa-select-card/sherpa-select-card.js';
export { SherpaCallout } from './components/sherpa-callout/sherpa-callout.js';
export { SherpaBreadcrumbs, type Crumb } from './components/sherpa-breadcrumbs/sherpa-breadcrumbs.js';
export { SherpaSectionHeader } from './components/sherpa-section-header/sherpa-section-header.js';
export { SherpaEmptyState } from './components/sherpa-empty-state/sherpa-empty-state.js';
export { SherpaProgressBar } from './components/sherpa-progress-bar/sherpa-progress-bar.js';
export { SherpaTooltip } from './components/sherpa-tooltip/sherpa-tooltip.js';
export { SherpaMenu } from './components/sherpa-menu/sherpa-menu.js';
export {
  SherpaNotifications,
  type Notification,
} from './components/sherpa-notifications/sherpa-notifications.js';
export { SherpaKeyValueList, type KeyValuePair } from './components/sherpa-key-value-list/sherpa-key-value-list.js';
export { SherpaList } from './components/sherpa-list/sherpa-list.js';
export { SherpaListItem } from './components/sherpa-list-item/sherpa-list-item.js';
export { SherpaTabs, type TabDef } from './components/sherpa-tabs/sherpa-tabs.js';
export { SherpaPagination } from './components/sherpa-pagination/sherpa-pagination.js';
export { SherpaMetric } from './components/sherpa-metric/sherpa-metric.js';
export { SherpaSparkline } from './components/sherpa-sparkline/sherpa-sparkline.js';
export { SherpaSlider } from './components/sherpa-slider/sherpa-slider.js';
export { SherpaToast, type ToastOptions } from './components/sherpa-toast/sherpa-toast.js';
export { SherpaContainerHeader } from './components/sherpa-container-header/sherpa-container-header.js';
export { SherpaDataVizHeader } from './components/sherpa-data-viz-header/sherpa-data-viz-header.js';
export { SherpaContainerFooter } from './components/sherpa-container-footer/sherpa-container-footer.js';
export { SherpaNavItem } from './components/sherpa-nav-item/sherpa-nav-item.js';
export { SherpaNavSection } from './components/sherpa-nav-section/sherpa-nav-section.js';
export { SherpaChatMessage } from './components/sherpa-chat-message/sherpa-chat-message.js';
export { SherpaCalendar } from './components/sherpa-calendar/sherpa-calendar.js';
export { SherpaCalendarCell } from './components/sherpa-calendar-cell/sherpa-calendar-cell.js';
export { SherpaSelectGroup } from './components/sherpa-select-group/sherpa-select-group.js';
export { SherpaTransferList } from './components/sherpa-transfer-list/sherpa-transfer-list.js';
export { SherpaCodeBlock } from './components/sherpa-code-block/sherpa-code-block.js';
export { SherpaAppHeader } from './components/sherpa-app-header/sherpa-app-header.js';
export { SherpaPromptComposer } from './components/sherpa-prompt-composer/sherpa-prompt-composer.js';
export { SherpaToolbar } from './components/sherpa-toolbar/sherpa-toolbar.js';
export { SherpaChartLegend, type LegendItem } from './components/sherpa-chart-legend/sherpa-chart-legend.js';
export { SherpaFileUpload } from './components/sherpa-file-upload/sherpa-file-upload.js';
export { SherpaAccordion } from './components/sherpa-accordion/sherpa-accordion.js';
export { SherpaDialog } from './components/sherpa-dialog/sherpa-dialog.js';
export { SherpaOverlayPanel } from './components/sherpa-overlay-panel/sherpa-overlay-panel.js';
export { SherpaPanel } from './components/sherpa-panel/sherpa-panel.js';
export { SherpaProgressStepTracker } from './components/sherpa-progress-step-tracker/sherpa-progress-step-tracker.js';
export { SherpaQuickFilter } from './components/sherpa-quick-filter/sherpa-quick-filter.js';
export { SherpaFilterPanel } from './components/sherpa-filter-panel/sherpa-filter-panel.js';
export { SherpaFilterset } from './components/sherpa-filterset/sherpa-filterset.js';
export { SherpaGaugeChart } from './components/sherpa-gauge-chart/sherpa-gauge-chart.js';
export { SherpaRadialChart, type RadialSlice } from './components/sherpa-radial-chart/sherpa-radial-chart.js';
export { SherpaBarchart, type BarDatum } from './components/sherpa-barchart/sherpa-barchart.js';
export { SherpaLineChart } from './components/sherpa-line-chart/sherpa-line-chart.js';
export { SherpaDataGrid, type GridColumn } from './components/sherpa-data-grid/sherpa-data-grid.js';
export { SherpaQuickFilterToolbar } from './components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.js';
/* ONE filter, as a bar or the panel draws it. */
export type { FilterDef, FilterOption } from './core/ui/filter-def.js';
export { SherpaAppShell } from './components/sherpa-app-shell/sherpa-app-shell.js';
export { SherpaLayoutGrid } from './components/sherpa-layout-grid/sherpa-layout-grid.js';
export type { GridLayout } from './components/sherpa-layout-grid/grid-resize.js';
export { SherpaLayoutCanvas } from './components/sherpa-layout-canvas/sherpa-layout-canvas.js';
export { SherpaGroup } from './components/sherpa-group/sherpa-group.js';
