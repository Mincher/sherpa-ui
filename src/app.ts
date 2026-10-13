/**
 * app.ts — `sherpa-ui/app`: the app layer. The provider and the router, the
 * session and settings bound by pointer, saved Views, their drafts and the
 * reader's saved filters, Views from files, and the app definition. OPT-IN: no
 * display component imports any of it. TRAP T-the-app-layer-is-opt-in
 */
// A page's components ASK; the provider answers from its definition.
export { SherpaProvider, type ProvideOptions, type ProviderState } from './components/sherpa-provider/sherpa-provider.js';
// The URL has ONE owner. TRAP T-the-router-owns-the-url
export { SherpaRouter, type RouteChange } from './components/sherpa-router/sherpa-router.js';
export type { Route } from './core/browser/route.js';
// Where the route's Context is drawn, from app.json. TRAP T-an-outlet-loads-the-context
export { SherpaOutlet, type OutletOptions } from './components/sherpa-outlet/sherpa-outlet.js';
// What an app knows about itself, by pointer — and a control bound to one.
export {
  SessionStore,
  SessionList,
  type ListOptions as SessionListOptions,
  type PersistOptions as SessionPersistOptions,
} from './core/browser/session.js';
export { bindSettings } from './core/ui/bind-settings.js';
// Saved Views: the reader's own, the View chip's options, a pick applied.
export {
  persistView, persistViewState, clearViewState, applyViewSnapshot, captureView,
  viewOptions, uniqueViewLabel, onViewPicked,
  loadSavedViews, saveViewAs, deleteSavedView,
  type PersistOptions, type ViewSnapshot, type ApplyReport,
  type SavedView, type ViewLibrary, type ViewOption, type ViewPick,
  type SavedViewStore,
} from './core/browser/persist-view.js';
export {
  syncViews,
  restViewRemote,
  type RestViewRemoteOptions,
  type SyncOptions,
  type ViewRemote,
  type ViewSync,
} from './core/browser/view-sync.js';
export {
  loadSavedFilters, saveFilterAs, deleteSavedFilter,
  type SavedFilter, type SavedFilterSet, type SavedFilterOptions,
} from './core/browser/saved-filters.js';
// A page's Views from JSON files, each View's markup in an HTML template.
export { loadViewLibrary } from './core/browser/view-files.js';
// A saved View's content is MARKUP, parsed through an allow-list on the way in.
// TRAP T-saved-markup-is-untrusted-input
export {
  parseViewMarkup,
  checkViewMarkup,
  type MarkupReport,
  type ParseResult,
} from './core/browser/view-markup.js';
// The app, as one JSON. TRAP T-an-app-is-its-definition
export {
  checkApp,
  type AppDefinition,
  type ContextDefinition,
  type SettingsPage,
  type ContextInit,
  type ContextModule,
} from './core/data/app-definition.js';
