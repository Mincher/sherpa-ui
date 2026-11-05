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
  filterTest,
  setCollation,
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
  /* ONE condition tree: what a reader or a definition says; a Filter is what it
     compiles to. TRAP T-one-condition-tree */
  conditionLeaves,
  filterCondition,
  groupOf,
  joinConditions,
  type Condition,
  type ConditionGroup,
  type ConditionLeaf,
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
  type StoreCapabilities,
  type StoreChangeDetail,
} from './core/data/store.js';
// One store over another: what it does not say is the inner store's. TRAP T-a-store-says-what-it-can-do-once
export { wrapStore, type StoreWrap } from './core/data/wrap-store.js';
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
  type QueryState,
} from './core/data/data-source.js';
// The Query of one app Context: every source over the page joins it. 366
export { QueryContext } from './core/data/query-context.js';
// The app's settings, each declared once: one schema, and its live values.
export {
  SETTINGS, Settings, fitsSetting,
  type SettingDef, type SettingKey, type SettingLook, type SettingScope, type SettingValue, type SettingsSchema, type SettingsStore,
} from './core/data/settings.js';
export type { FieldStatus } from './core/data/field-status.js';
/* A component joined to a source by hand — the provider does it for a page. TODO 196 */
export { bindId, bindSource, type BindOptions } from './core/ui/bind-source.js';
/* A PAGE, set up from one JSON document. TRAP T-a-page-is-its-definition */
export {
  checkPage,
  checkTiers,
  savedFiltersOf,
  openSource,
  pageWithQuery,
  presetReadings,
  SAVED_PRESET,
  type PageDefinition,
  type ScopeDefinition,
  type SourceDefinition,
} from './core/data/page-definition.js';
/* The ONE registry of node kinds, for a page's Query and a workflow alike. TRAP T-one-node-registry */
export {
  FALSE_SOCKET,
  NODE_CATEGORIES,
  NODE_KINDS,
  ROWS,
  SOCKET_WORDS,
  accepts,
  fitOf,
  paletteFor,
  kindIn,
  kindOfNode,
  paletteMatch,
  paletteOf,
  placed,
  resolveKind,
  rowChoices,
  socketOf,
  socketType,
  takesMany,
  truthy,
  typeChoices,
  type DrawnGraph,
  type GraphEdit,
  type GraphNode,
  type GraphRow,
  type NodeGraph,
  type NodeKind,
  type NodePlaces,
  type NodeRoute,
  type NodeTie,
  type NodeType,
  type PaletteGroup,
  type PaletteItem,
  type RowChoice,
  type RowControl,
  type RowFacts,
  type RowKind,
  type Socket,
  type SocketType,
} from './core/data/node-kinds.js';
/* A WORKFLOW, set up from one JSON document. TRAP T-a-workflow-is-its-definition */
export {
  NODE_WIDTH,
  TIE_GAP,
  checkWorkflow,
  editWorkflow,
  finalGraph,
  keptRoutes,
  readWorkflow,
  tieLimit,
  tiesAmong,
  workflowFaults,
  workflowGraph,
  type WorkflowDefinition,
  type WorkflowDefinitionV1,
  type WorkflowEdit,
  type WorkflowFacts,
  type WorkflowNode,
  type WorkflowRead,
} from './core/data/workflow.js';
/* A CUSTOM NODE: a workflow body saved under one name, used as an instance. TRAP T-a-custom-node-is-an-instance */
export {
  GROUP_INPUT,
  GROUP_OUTPUT,
  checkNodeLibrary,
  copyToMine,
  definitionDiff,
  editDefinition,
  innerOf,
  kindsOf,
  nodeKindOf,
  nodeLibraryFaults,
  staleUses,
  updateAll,
  updateInstance,
  useOf,
  versionOf,
  workflowFaultsDeep,
  type CustomKind,
  type DefinitionDiff,
  type Inner,
  type NodeDefinition,
  type NodeLibrary,
  type NodeOutput,
  type NodeSnapshot,
  type NodeSocket,
} from './core/data/node-library.js';
/* Where an app's Custom Nodes come together: its presets and the reader's. Plan 713 M12 */
export { isNodeEntry, joinLibrary, type NodeShelf } from './core/data/node-shelf.js';
/* An ENTITY: a graph saved under a type, an id and a name; a Custom Node is the type `node`. Plan 746 E1 · TRAP T-an-entity-is-an-envelope-and-a-type */
export {
  ENTITY_SCHEMA, definitionOf, entityKind, entityRefOf, isEntity, nodeEntityOf, usesOf,
  type Entity, type EntityGraph, type EntityLibrary, type EntityRef,
} from './core/data/entity.js';
/* Any entity is a node in any graph: the panel offers it, a use is an instance of it. Plan 746 E5 · TRAP T-an-entity-is-used-as-a-node */
export {
  ENTITY_TYPES, asNode, entityOf, entityTypes, libraryOf, offeredKinds, registerEntityType, socketsOf, takes, type EntityType,
} from './core/data/entity-types.js';
export { checkEntity, entityFaults, graphWorkflow, type EntityFacts } from './core/data/entity-check.js';
/* Where an app's entities come together: its presets and the reader's, one door; the Custom Node shelf is a view of it. */
export { joinEntities, makeShelf, nodesView, type EntityPort, type EntityShelf, type EntitySummary } from './core/data/entity-shelf.js';
/* A GRAPH View: a View whose canvas shows one entity of its type, picked in the graph chip. Plan 746 E3 · TRAP T-a-graph-is-a-view-of-a-type */
export {
  NEW_GRAPH, graphOfWorkflow, graphRows, newGraph, openOf, saveGraph, saveGraphAs,
  type GraphChoice, type GraphOf, type GraphWords, type OpenGraph,
} from './core/data/graph-views.js';
export { groupNodes, ungroupUse, type GroupAsk, type Grouped } from './core/data/node-group.js';
export { nodeFlow, type NodeFlow } from './core/data/node-flow.js';
/* What a node reads of what reaches it: null where it cannot use it, and why. TODO 764 · TRAP T-a-node-reads-null-from-what-it-cannot-use */
export { COERCIONS, INPUT_WORDS, coerce, givenAt, needOf, readInput, truthOf, type Coercion, type Given, type InputNeeds, type Need, type Reached } from './core/data/node-input.js';
/* The data layer over HTTP: one handle() for the page, a Service Worker or a server. Plan 652 */
export {
  DATA_BASE,
  DATA_QUERY_TYPE,
  DATA_VERSION,
  PROBLEM_TYPE,
  createDataHandler,
  decodeQuery,
  encodeQuery,
  keySegment,
  type CorsPolicy,
  type DataHandler,
  type DataHandlerOptions,
  type DataQuery,
  type Problem,
  type StoreFacts,
} from './core/data/data-handler.js';
// An app's stores, said once for every host; a request may pick among several of one name, or have its own made. TRAP T-a-request-picks-its-stores
export { defineStores, type DefinedStore, type StoreChoice, type StoreDefinition, type StoreFactory, type StoreSet } from './core/data/define-stores.js';
// A store reached by that protocol: a handler in the page, then a Service Worker. Plan 652 S2
export { RequestStore, openRequestStore, type RequestStoreOptions } from './core/data/request-store.js';
// A remote store's ONE held set: a Service Worker's for every tab, or a page's own. Plan 652 S5b
export { HeldStore, heldOf, type HeldStoreOptions, type LostWrite } from './core/data/held-store.js';
// A status field: each value named by conditions on a row's other fields. Plan 683
export { statusFields, type StatusField, type StatusValue } from './core/data/status-field.js';
// A write made offline waits, and is sent once. Plan 652 S7a
export { memoryOutbox, outboxEntry, type OutboxEntry, type OutboxPort } from './core/data/outbox.js';
// What is new, said to every tab: a fact, never a request to show it. Plan 652 S6
export { NOTICE_CHANNEL, sayNotice, type UpdateNotice, type WorkerAsk } from './core/data/notices.js';
export { Updates, type NewsKind, type UpdatesDetail } from './core/data/updates.js';
export { UPDATES_PATH, updatesFeed, type FeedNotice, type UpdatesFeed } from './core/data/updates-feed.js';
// ONE trace stream: the page's, its worker's and a server's steps, joined by one id. TRAP T-one-trace-stream
export {
  TRACE_CHANNEL, onTrace, traceStep, tracing, type OpenStep, type Span, type StepOptions, type StepState, type TraceHost,
} from './core/data/trace.js';
/* A page's QUERY, drawn as nodes for the Node Editor. TODO 555 · TRAP T-the-node-editor-asks-the-query */
export {
  QUERY_NODE, graphRequest, queryGraph, queryGraphFaults, queryStepNode, routeRequest, statusTallies, traceQuerySteps,
  type GraphComponent, type LoadSteps, type QueryGraphFacts, type RouteAnswer, type ScopePreset,
} from './core/data/query-graph.js';
/* A pure edit: the Query after a Sort, Group, Search, presentation, order or move. TRAP T-one-command-one-door */
export { editQuery, type EditFacts, type PureEdit } from './core/data/query-edits.js';
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
  summariseMarked,
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
  // The ONE place a tree becomes a filter.
  conditionClause,
  // A flat menu's rows as one tree, and back. TRAP T-many-conditions-are-one-reading
  answerTree,
  // A value typed by its field, once, where it comes in. TRAP T-a-value-is-typed-once
  typedValue,
  type FieldState,
  type ValueState,
  type ValueEntry,
  type FilterState,
  type FieldFacts,
  type FieldType,
  type FieldReading,
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
  type QueryRequest,
  type SavedFilter,
  type ViewScope,
  type ScopeQuery,
  type CompileFacts,
  type Compiled,
} from './core/data/query.js';

/* ONE way to write a condition in a definition or a View: `{ gt: 0 }`.
   TRAP T-one-way-to-write-a-condition */
export {
  parseWhere,
  readingsOf,
  treeReading,
  whereOf,
  type Where,
  type WhereCondition,
} from './core/data/where.js';
export { type Threshold } from './core/data/threshold.js';

/* A store that ACTS remote — slow, and failing when told to — until there is a
   real one. TRAP T-apply-and-discard-wait-for-a-change */
export { fakeRemote, type FakeRemoteOptions } from './core/data/fake-remote.js';
/* What a store changed this session, by field. TRAP T-a-store-keeps-its-history */
export { StoreHistory, changedFields } from './core/data/store-history.js';
/* The last changes, each before and after, to step back and forward. */
export { Journal, type Change } from './core/data/journal.js';
export { failureOf, unreached, type Failure, type FailureKind } from './core/data/failure.js';
export { keepCache, clearKept, type KeepOptions } from './core/browser/cache-keep.js';
export { keepData } from './core/browser/database.js';
export { keepOutbox } from './core/browser/outbox-keep.js';
// One live feed for every tab. Plan 652 S8
export { shareFeed } from './core/browser/share-feed.js';

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
