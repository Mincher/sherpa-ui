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
 * persist-view, pointer, session, idb-store, view-sync, chart-datum and
 * format-tick all import cleanly in Node today. `npm run lint` keeps them that way — see the
 * no-restricted-globals override in .eslintrc.json.
 *
 * WHAT IS HERE: everything that answers "what are the records, and which of
 * them am I looking at" — stores, the query, validation, live connections, and
 * saved views.
 *
 * WHAT IS NOT: every component, `SherpaElement`, `installIcons`,
 * `installTokens` and `renderElement`. Those need a DOM by definition;
 * `sherpa-ui` is their door — and so is a view's CONTENT, which is markup
 * (`parseViewMarkup`) and therefore needs a parser.
 *
 * FOUR THINGS HERE TOUCH STORAGE — `persistView`, `SessionStore`, `IdbStore`
 * and `syncViews` — and that is deliberate. Both wrap every access in `try/catch → null`, so in Node
 * they degrade to "nothing was kept" rather than throwing. A server restoring a
 * saved view from a database needs the SHAPE (`ViewSnapshot`, `applyViewSnapshot`)
 * far more than it needs the browser's storage.
 */

export {
  applyOptions,
  compareValues,
  filterRows,
  groupRows,
  groupSummaries,
  matchesFilter,
  andFilter,
  picksClause,
  readField,
  searchRows,
  sortRows,
  /* A value can be a string, a number or an object. `valueKey` is the one
     string form a control can put in an attribute, and `valueSet` is the
     query's own comparison as a set.
     TRAP T-a-value-can-be-an-object */
  valueKey,
  valueSet,
  type Filter,
  type FilterClause,
  type FilterGroup,
  type FilterOp,
  type LoadOptions,
  type LoadResult,
  type Row,
  type GroupSummary,
  type RowGroup,
  type SortDirection,
  type SortSpec,
  type Store,
  type StoreChangeDetail,
} from './core/data/store.js';
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
} from './core/data/stores.js';
// The REAL local store — IndexedDB. Browser-only in behaviour, headless-SAFE to
// import: `IdbStore.available` is false in Node and every method rejects rather
// than throwing at module scope.
// TRAP T-idb-is-the-only-real-local-store.
export {
  IdbStore,
  IdbValidationError,
  type IdbStoreOptions,
} from './core/browser/idb-store.js';
// A view's state kept locally for speed and pushed onward on a schedule.
// TRAP T-local-first-then-onward.
export {
  syncViews,
  restViewRemote,
  type RestViewRemoteOptions,
  type SyncOptions,
  type ViewRemote,
  type ViewSync,
} from './core/browser/view-sync.js';
export {
  DataSource,
  /* The scope above every component. TRAP T-up-is-open-down-is-closed */
  VIEW_SCOPE,
  type BindOptions,
  type DataChangeDetail,
  type DataSourceOptions,
  type ViewState,
} from './core/data/data-source.js';
// Keeping a view state across a reload — a HELPER, not part of DataSource, so
// a host chooses whether and where its view state persists.
export {
  persistView, persistViewState, clearViewState, applyViewSnapshot, captureView,
  viewOptions, onViewPicked,
  loadSavedViews, saveViewAs, deleteSavedView,
  type PersistOptions, type ViewSnapshot, type ApplyReport,
  type SavedView, type ViewLibrary, type ViewOption, type ViewPick,
  type SavedViewStore,
} from './core/browser/persist-view.js';
export {
  EventStore,
  SocketStore,
  type EventStoreOptions,
  type LiveStoreOptions,
  type PushMessage,
  type SocketStoreOptions,
} from './core/data/live-stores.js';
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
} from './core/data/validate.js';
// The session store and JSON pointers: app-level state, addressed by pointer.
// Headless — `persist()` degrades to "nothing kept" with no storage.
export {
  SessionStore,
  SessionList,
  type ListOptions as SessionListOptions,
  type PersistOptions as SessionPersistOptions,
} from './core/browser/session.js';
export { getPointer, setPointer, pointersOverlap } from './core/data/pointer.js';
/* The one datum shape every chart and legend shares — and the two rules for
   reading it. A legend widens `value` to `string | number`, so a caller adding
   up data for itself needs the same coercion and the same clamp the ring uses,
   or its total disagrees with the chart's.
   TRAP T-one-total-for-the-ring-and-the-label */
export {
  datumValue,
  datumTotal,
  type ChartDatum,
  type LegendDatum,
} from './core/data/chart-datum.js';

/* ROWS → the shape a chart draws. Aggregation lives HERE and not in a view,
   so a server can pre-compute it, an MCP tool can answer "count by category",
   and two views cannot disagree about what a mean is. */
/* The enumerated states a control steps through — stated once, so two views of
   one value cannot disagree about what their shared third state keeps. */
export {
  nextSort,
  sortDirectionAttr,
  sortDirectionFrom,
  type SortState,
} from './core/data/cycle.js';

/* An optional allow-list on any axis a component offers. No list means
   everything is allowed, so nothing that ignores this changes. */
export {
  allow,
  isAllowed,
  allowKey,
  unknownEntries,
  nextState,
  type AllowEntry,
  type AllowList,
} from './core/data/allow.js';

export {
  aggregateBy,
  countBy,
  bandBy,
  seriesBy,
  reduceRows,
  deltaPercent,
  type Aggregate,
  type AggregateOptions,
  type Series,
} from './core/data/aggregate.js';

/* ONE state per filtered field — what a chip, its menu, a column heading and
   that heading's menu all read, so none of them derives its own answer.
   TRAP T-one-state-per-filtered-field */
export {
  fieldState,
  stateClause,
  /* A reading as a clause, for a control that holds its own field facts.
     TRAP T-the-field-type-decides-the-clause */
  readingClause,
  /* A field whose picks are ENDS, not a list to tick.
     TRAP T-the-field-type-decides-the-clause */
  isRanged,
  type FieldState,
  type ValueState,
  type ValueEntry,
  type FilterState,
  type FieldFacts,
  type FieldType,
  type FieldReading,
  type FieldCondition,
  /* Default or Custom — the one type every control reads.
     TRAP T-one-condition-system */
  type ConditionType,
} from './core/data/filter-state.js';

/* ONE CHANNEL for "your assumption was wrong" — a host routes it, silences it
   or lets it warn. TRAP T-a-broken-assumption-reports */
export { report, onReport, type Report, type Reporter } from './core/data/report.js';

/* WHAT A CONTROL SHOWS for that state — the badge, the value, the tooltip.
   TRAP T-a-condition-badge-says-that-not-which */
export {
  filterFace,
  /* The ONE mark a control wears when conditions apply, and the words behind
     it. */
  CONDITION_BADGE,
  spellConditions,
  type FilterFace,
} from './core/data/filter-face.js';

/* The read/draw/write loop ANY control over a field needs — a chip, a column
   heading, a chart legend, a tab strip. None of them hears about another:
   they read the same answer. TRAP T-one-field-one-filter-menu */
export {
  bindSelection,
  type Selector,
  type SelectionBinding,
  type BoundSelection,
} from './core/data/bind-selection.js';
