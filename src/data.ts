/**
 * data.ts — the data layer, with NO components and NO DOM.
 *
 *   import { ArrayStore, DataSource } from 'sherpa-ui/data';
 *
 * WHY A SECOND ENTRY POINT. `index.ts` exports all 58 components, and importing
 * a component DEFINES a custom element — so `import 'sherpa-ui'` throws
 * "HTMLElement is not defined" the moment a server, a test or an MCP tool tries
 * it. The data layer was always headless; there was simply no door into it.
 *
 * Verified module by module: store, stores, validate, data-source, live-stores,
 * persist-view, pointer, session, chart-datum and format-tick all import
 * cleanly in Node today. `npm run lint` keeps them that way — see the
 * no-restricted-globals override in .eslintrc.json.
 *
 * WHAT IS HERE: everything that answers "what are the records, and which of
 * them am I looking at" — stores, the query, validation, live connections, and
 * saved views.
 *
 * WHAT IS NOT: every component, `SherpaElement`, `installIcons`,
 * `installTokens`, `renderElement` and `renderView`. Those need a DOM by
 * definition; `sherpa-ui` is their door.
 *
 * TWO THINGS HERE STILL TOUCH STORAGE — `persistView` and `SessionStore` — and
 * that is deliberate. Both wrap every access in `try/catch → null`, so in Node
 * they degrade to "nothing was kept" rather than throwing. A server restoring a
 * saved view from a database needs the SHAPE (`ViewSnapshot`, `applyViewSnapshot`)
 * far more than it needs the browser's storage.
 */

export {
  applyOptions,
  compareValues,
  filterRows,
  groupRows,
  matchesFilter,
  readField,
  searchRows,
  sortRows,
  type Filter,
  type FilterClause,
  type FilterGroup,
  type FilterOp,
  type LoadOptions,
  type LoadResult,
  type Row,
  type RowGroup,
  type SortDirection,
  type SortSpec,
  type Store,
  type StoreChangeDetail,
} from './core/store.js';
export {
  ArrayStore,
  HttpError,
  JsonStore,
  LocalStore,
  RestStore,
  ValidationError,
  type JsonStoreOptions,
  type LocalStoreOptions,
  type RestStoreOptions,
  type StoreOptions,
} from './core/stores.js';
export {
  DataSource,
  type BindOptions,
  type DataChangeDetail,
  type DataSourceOptions,
  type ViewState,
} from './core/data-source.js';
// Keeping a view state across a reload — a HELPER, not part of DataSource, so
// a host chooses whether and where its view state persists.
export {
  persistView, persistViewState, clearViewState, applyViewSnapshot, captureView,
  viewOptions, onViewPicked,
  loadSavedViews, saveViewAs, deleteSavedView,
  type PersistOptions, type ViewSnapshot, type ApplyReport,
  type SavedView, type ViewLibrary, type ViewOption, type ViewPick,
  type SavedViewStore,
} from './core/persist-view.js';
export {
  EventStore,
  SocketStore,
  type EventStoreOptions,
  type LiveStoreOptions,
  type PushMessage,
  type SocketStoreOptions,
} from './core/live-stores.js';
export {
  custom,
  email,
  issuesFor,
  isSchema,
  isValid,
  max,
  min,
  number,
  oneOf,
  pattern,
  required,
  rules,
  url,
  validate,
  validateField,
  type FieldRules,
  type Issue,
  type Result,
  type Rule,
  type RuleMap,
  type StandardSchema,
} from './core/validate.js';
// The session store and JSON pointers: app-level state, addressed by pointer.
// Headless — `persist()` degrades to "nothing kept" with no storage.
export {
  SessionStore,
  type PersistOptions as SessionPersistOptions,
} from './core/session.js';
export { getPointer, setPointer, pointersOverlap } from './core/pointer.js';
// The one datum shape every chart and legend shares.
export type { ChartDatum, LegendDatum } from './core/chart-datum.js';
