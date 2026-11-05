/**
 * app.ts — `sherpa-ui/app`: the app layer. The provider and the router, the
 * session and settings bound by pointer, a page's state and its one keeper,
 * Views from files, and the app definition. OPT-IN: no display component
 * imports any of it. TRAP T-the-app-layer-is-opt-in
 */
// A page's components ASK; the provider answers from its definition.
export { SherpaProvider, type ProvideOptions } from './components/sherpa-provider/sherpa-provider.js';
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
export { bindSettings, persistSettings } from './core/ui/bind-settings.js';
/* A graph of nodes on a canvas, and the two editors drawn there: a page's Query, a workflow. TODOs 555, 551 */
export {
  bindQueryEditor, bindWorkflow, drawGraph, inspectNode, markNode, watchSteps,
  type DrawOptions, type GraphEditor, type InspectOptions, type Inspector, type QueryEditorOptions, type WatchOptions, type WorkflowEditor, type WorkflowEditorOptions,
} from './core/ui/node-graph.js';
// A page's state as ONE document, and its one keeper: each part in its tier. TRAP T-one-page-one-document
export {
  PageKeeper, NODES_PAGE, sessionTier, localTier, memoryTier, viewSig,
  type PageState, type PageChange, type LeftView, type Named, type Tier, type PageRemote, type KeeperOptions,
} from './core/browser/page-state.js';
// A View applied and read back, the View chip's options, a pick applied.
export {
  applyView, captureView,
  viewOptions, uniqueViewLabel, onViewPicked,
  type ApplyReport,
  type SavedView, type ViewLibrary, type ViewOption, type ViewPick,
} from './core/browser/persist-view.js';
// A page's Views from JSON files, each View's markup in an HTML template.
export { loadViewLibrary } from './core/browser/view-files.js';
// An app's preset Custom Nodes, from a JSON file; the reader's own are in the keeper.
export { loadNodeLibrary, readLibrary } from './core/browser/node-files.js';
// An app's preset entities, from a JSON file; the reader's own are in the keeper.
export { loadEntityLibrary, readEntities } from './core/browser/entity-files.js';
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
// A store the app's Service Worker answers, else the page's own handler. Plan 652 S4
export { openWorkerStore, type WorkerStoreOptions } from './core/browser/worker-store.js';
// Hear what is new — a new version's files, a store's rows waiting. Plan 652 S6
export { hearUpdates, noticeSeen, onUpdate, watchForUpdates } from './core/browser/updates.js';
export { followUpdates, type FollowOptions } from './core/browser/follow-updates.js';
