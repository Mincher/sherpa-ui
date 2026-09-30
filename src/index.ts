/**
 * index.ts — the reforged Sherpa entry point.
 *
 * Import this once to register components and establish the shared shadow-root
 * styles. The design-token layer (light DOM) is loaded separately via a
 * `<link>`/`@import` of tokens.css, or programmatically with `installTokens()`.
 *
 * Map:
 * - installIcons — DEPRECATED — a no-op since the icons became SVGs in icon-paths.ts
 * - installTokens — add tokens.css to the page once, so a component has its variables
 */
import { SherpaElement } from './core/ui/sherpa-element.js';

/**
 * What every shadow root adopts, in cascade order. Tokens themselves inherit
 * from the light DOM.
 *
 * One entry per file, because `@import` is DROPPED from an adopted stylesheet
 * without an error — TRAP T-import-dies-in-an-adopted-sheet.
 * `sherpa-typography.css` is GENERATED — TRAP T-a-document-class-cannot-reach-a-shadow-root.
 * `sherpa-style-modes.css` is GENERATED — TRAP T-tokens-css-never-reaches-shadow.
 */
SherpaElement.sharedStyles = [
  new URL('./core/sherpa-base.css', import.meta.url),
  new URL('./core/sherpa-typography.css', import.meta.url),
  new URL('./core/sherpa-grouping.css', import.meta.url),
  new URL('./core/sherpa-icon.css', import.meta.url),
  new URL('./core/sherpa-group-positions.css', import.meta.url),
  new URL('./core/sherpa-style-modes.css', import.meta.url),
  new URL('./core/sherpa-anchor.css', import.meta.url),
  new URL('./core/sherpa-motion.css', import.meta.url),
];

/**
 * @deprecated A NO-OP since the icons became Figma SVGs baked into
 * `icon-paths.ts`. It loaded a 103KB Font Awesome sheet whose 1,935 `.fa-*`
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

export { SherpaElement } from './core/ui/sherpa-element.js';
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
// A saved view's content is MARKUP, parsed through an allow-list on the way in.
// TRAP T-saved-markup-is-untrusted-input.
export {
  parseViewMarkup,
  checkViewMarkup,
  type MarkupReport,
  type ParseResult,
} from './core/browser/view-markup.js';
// ONE datum shape for every chart and the legend beside it — see chart-datum.ts.
export type { ChartDatum, LegendDatum } from './core/data/chart-datum.js';

/* …and the functions that PRODUCE one. Re-exported here so a browser app that
   already imports components does not need the second entry point as well;
   `sherpa-ui/data` is the same code without the DOM. */
export {
  aggregateBy,
  countBy,
  bandBy,
  seriesBy,
  reduceRows,
  deltaPercent,
  summarise,
  type Aggregate,
  type AggregateOptions,
  type Bucket,
  type Series,
  type Summary,
  type SummarySpec,
} from './core/data/aggregate.js';
// The app-level state store: what an app knows about ITSELF — theme, selected
// customer, open panel — addressed by JSON pointer so one value can have many
// readers.
export {
  SessionStore,
  SessionList,
  type ListOptions as SessionListOptions,
  type PersistOptions as SessionPersistOptions,
} from './core/browser/session.js';
export {
  getPointer, setPointer, pointersOverlap,
} from './core/data/pointer.js';
/* ── Data layer ──────────────────────────────────────────────────────── */
/* ── Data layer ────────────────────────────────────────────────────────
   Re-exported WHOLESALE from the headless entry point rather than listed
   again. These 82 lines were a byte-for-byte copy of `src/data.ts`, so every
   new store, rule or query helper had to be added to two lists — and the one
   that got forgotten would be missing from `sherpa-ui` while present in
   `sherpa-ui/data`, which is the harder half to notice.

   `sherpa-ui/data` stays the DOM-free door (a node test proves it imports no
   component); this line simply means the component entry point offers the
   same data layer without restating it. */
export * from './data.js';

export { SherpaButton } from './components/sherpa-button/sherpa-button.js';
export { SherpaBadge } from './components/sherpa-badge/sherpa-badge.js';
export { SherpaTag } from './components/sherpa-tag/sherpa-tag.js';
export { SherpaChip } from './components/sherpa-chip/sherpa-chip.js';
export { SherpaGridCell } from './components/sherpa-grid-cell/sherpa-grid-cell.js';
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
export { SherpaGaugeChart } from './components/sherpa-gauge-chart/sherpa-gauge-chart.js';
export { SherpaRadialChart, type RadialSlice } from './components/sherpa-radial-chart/sherpa-radial-chart.js';
export { SherpaBarchart, type BarDatum } from './components/sherpa-barchart/sherpa-barchart.js';
export { SherpaLineChart } from './components/sherpa-line-chart/sherpa-line-chart.js';
export { SherpaDataGrid, type GridColumn } from './components/sherpa-data-grid/sherpa-data-grid.js';
export { SherpaQuickFilterToolbar, type QuickFilterDef } from './components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.js';
export { SherpaAppShell } from './components/sherpa-app-shell/sherpa-app-shell.js';
export { SherpaLayoutGrid } from './components/sherpa-layout-grid/sherpa-layout-grid.js';
export { SherpaLayoutCanvas } from './components/sherpa-layout-canvas/sherpa-layout-canvas.js';
export { SherpaGroup } from './components/sherpa-group/sherpa-group.js';
export { SherpaProvider, type ProvideOptions, type ProviderState } from './components/sherpa-provider/sherpa-provider.js';
export { SherpaRouter, type RouteChange } from './components/sherpa-router/sherpa-router.js';
export type { Route } from './core/browser/route.js';
