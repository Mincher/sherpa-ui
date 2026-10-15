/**
 * data.ts — `sherpa-ui/data`: the data layer, with no components and no DOM, for
 * a server, a test or an MCP tool. Every module here is one the lint holds DOM-free.
 * The app layer (saved Views, their sync, saved filters, the session) is `sherpa-ui/app`.
 * TRAP T-the-data-entry-loads-no-dom
 */

export {
  absoluteDates,
  applyOptions,
  compareValues,
  durationSpan,
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
  type Duration,
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
// A row's key, kept beside it: its own, or one the data layer made up.
// TRAP T-a-made-up-key-never-leaves-the-data-layer
export { carryKey, isMadeUpKey, isStaleKey, rowKey } from './core/data/row-key.js';
// How a day or a range of days reads, everywhere. TRAP T-a-date-reads-one-way
export { formatDate } from './core/data/format-date.js';
// The REAL local store — IndexedDB. Browser-only in behaviour, headless-SAFE to
// import: `IdbStore.available` is false in Node and every method rejects rather
// than throwing at module scope.
// TRAP T-idb-is-the-only-real-local-store.
export {
  IdbStore,
  type IdbStoreOptions,
  // IndexedDB, or memory where there is none, seeded once per seed version.
  localRecords,
  type LocalRecordsOptions,
} from './core/browser/idb-store.js';
export {
  DataSource,
  type BoundControl,
  type DataChangeDetail,
  type DataSourceOptions,
  type ViewState,
  type FieldDeclaration,
  type FieldFilter,
  type FilterSet,
  type SourceState,
} from './core/data/data-source.js';
/* A component joined to a source by hand — the provider does it for a page. TODO 196 */
export { bindSource, type BindOptions } from './core/ui/bind-source.js';
/* A PAGE, set up from one JSON document. TRAP T-a-page-is-its-definition */
export {
  openSource,
  type PageDefinition,
  type ScopeDefinition,
  type SourceDefinition,
} from './core/data/page-definition.js';
/* An APP, set up from one JSON document. TRAP T-an-app-is-its-definition */
export {
  checkApp,
  type AppDefinition,
  type ContextDefinition,
  type SettingsPage,
  type ContextInit,
  type ContextModule,
} from './core/data/app-definition.js';
// The id a saved view or filter takes from its name.
export { labelId } from './core/browser/web-storage.js';
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
  domainsOf,
  email,
  issuesFor,
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
  type FieldDomain,
  type FieldRules,
  type Issue,
  type Result,
  type Rule,
  type RuleMap,
  type StandardSchema,
} from './core/data/validate.js';
// JSON pointers: one value in a document, by its path.
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
  type AllowEntry,
  type AllowList,
} from './core/data/allow.js';

/* ROWS → the shape a chart draws. Aggregation lives HERE and not in a view,
   so a server can pre-compute it, an MCP tool can answer "count by category",
   and two views cannot disagree about what a mean is. */
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
  // A chained clause back as its rows. TRAP T-a-heading-holds-a-whole-reading
  clauseConditions,
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

/* THE QUERY — the one state a page's data is under, in the reader's terms, and
   the one place it becomes a filter. docs/QUERY-DESIGN.md.
   TRAP T-one-query-one-owner */
export {
  compile,
  /* The scope above every component. TRAP T-up-is-open-down-is-closed */
  VIEW,
  type Query,
  type QueryDefaults,
  type ViewScope,
  type ScopeQuery,
  type CompileFacts,
  type Compiled,
} from './core/data/query.js';

/* ONE way to write a condition in a definition or a View: `{ gt: 0 }`.
   TRAP T-one-way-to-write-a-condition */
export { whereOf, readingsOf, type Condition, type Where } from './core/data/where.js';
export { bandCondition, bandEdges, type Threshold } from './core/data/threshold.js';

/* A store that ACTS remote — slow, and failing when told to — until there is a
   real one. TRAP T-apply-and-discard-wait-for-a-change */
export { spoofRemote, type SpoofOptions } from './core/data/spoof-remote.js';

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
  /* A saved filter in words, field by field — what its chip's menu lists.
     TRAP T-a-saved-chip-lists-its-conditions */
  conditionLines,
  sayReadings,
  type FilterFace,
  type SaidField,
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
