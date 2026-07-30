/**
 * @fileoverview Shared TypeScript types for Sherpa UI components
 *
 * This module provides common type definitions used across multiple components.
 * Centralizing types ensures consistency and makes system-wide updates easier.
 */

/* ── Component Size Scale ────────────────────────────────────────── */

/**
 * Standard component size scale used across buttons, inputs, and other components.
 * Not all components support all sizes.
 */
export type ComponentSize = '2x-small' | 'x-small' | 'small' | 'base' | 'large';

/* ── Color Variants ──────────────────────────────────────────────── */

/**
 * Standard color variant palette for buttons and interactive components
 */
export type ColorVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'tertiary-on-color';

/* ── Status Types ────────────────────────────────────────────────── */

/**
 * Status/severity levels for feedback components
 * Re-export from status-mixin for convenience
 */
export type { Status } from './status-mixin.js';

/* ── Layout & Orientation ────────────────────────────────────────── */

/**
 * Layout orientation for components that support horizontal/vertical layouts
 */
export type Orientation = 'horizontal' | 'vertical';

/**
 * Flex direction mapping (semantic aliases)
 */
export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';

/* ── Selection & Interaction Modes ───────────────────────────────── */

/**
 * Selection mode for menu items, list items, etc.
 */
export type SelectionMode = 'checkbox' | 'radio' | 'toggle';

/**
 * Menu/popover positioning
 */
export type PopoverPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/* ── Component Tiers ─────────────────────────────────────────────── */

/**
 * Component composition tiers (from component-categories.js)
 */
export type ComponentTier = 'atom' | 'molecule' | 'organism' | 'structure';

/**
 * Component roles within the design system
 */
export type ComponentRole =
  | 'control'      // Interactive controls (buttons, inputs)
  | 'display'      // Display-only components (badges, icons)
  | 'feedback'     // Feedback/notification (toast, callout)
  | 'navigation'   // Navigation elements (nav, tabs)
  | 'layout'       // Layout containers (grid, flex)
  | 'data'         // Data visualization (charts, tables)
  | 'utility';     // Utility components (modal, tooltip)

/* ── Event Detail Types ──────────────────────────────────────────── */

/**
 * Type-safe event handler for DOM events.
 * Use this to type event handler methods and callbacks.
 *
 * @example
 * ```typescript
 * #onClick: EventHandler<MouseEvent> = (e) => { ... };
 * #onKeyDown: EventHandler<KeyboardEvent> = (e) => { ... };
 * #onInput: EventHandler<InputEvent> = (e) => { ... };
 * ```
 */
export type EventHandler<E extends Event = Event> = (event: E) => void;

/**
 * Standard change event detail
 */
export interface ChangeEventDetail<T = unknown> {
  value: T;
  oldValue?: T;
}

/**
 * Selection event detail (for menus, lists, etc.)
 */
export interface SelectEventDetail {
  item: Element;
  value: string;
  index?: number;
}

/**
 * Click event detail (for buttons, clickable items)
 */
export interface ClickEventDetail {
  timestamp?: number;
  source?: string;
}

/**
 * Menu/popover event details
 */
export interface MenuOpenEventDetail {
  trigger?: Element;
}

export interface MenuCloseEventDetail {
  reason?: 'escape' | 'click-outside' | 'select' | 'manual';
}

export interface MenuSelectEventDetail extends SelectEventDetail {
  action?: string;
  keepOpen?: boolean;
}

/* ── Data Grid Event Details ─────────────────────────────────────── */

/**
 * Sort change event detail (for data grids, tables)
 */
export interface SortChangeEventDetail {
  field: string;
  direction: 'asc' | 'desc' | 'off';
}

/**
 * Selection change event detail (for multi-select grids, lists)
 */
export interface SelectionChangeEventDetail {
  selected: string[];
  count: number;
}

/**
 * Page change event detail (for paginated components)
 */
export interface PageChangeEventDetail {
  page: number;
  pageSize: number;
}

/**
 * Group toggle event detail (for expandable groups in grids)
 */
export interface GroupToggleEventDetail {
  groupValue: string;
  field: string;
  expanded: boolean;
}

/**
 * Row action event detail (for grid row interactions)
 */
export interface RowActionEventDetail {
  rowId: string;
  rowData: Record<string, unknown>;
}

/**
 * Grid action event detail (for grid-level actions like export)
 */
export interface GridActionEventDetail {
  action: string;
  data?: Record<string, unknown>;
  selectedRows: Array<Record<string, unknown>>;
}

/* ── Filter Event Details ────────────────────────────────────────── */

/**
 * Filter change event detail
 */
export interface FilterChangeEventDetail {
  filters: FilterDescriptor[];
}

/**
 * Filter descriptor for filter-bar and data components
 */
export interface FilterDescriptor {
  field: string;
  values?: string[];
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  label?: string;
  type?: 'value' | 'sort' | 'segment' | 'date';
}

/* ── Toggle & Interaction Event Details ──────────────────────────── */

/**
 * Toggle event detail (for collapsible panels, accordions, etc.)
 */
export interface ToggleEventDetail {
  open: boolean;
  reason?: 'user' | 'programmatic';
}

/**
 * Search event detail
 */
export interface SearchEventDetail {
  query: string;
  results?: number;
}

/* ── Configuration Object Types ──────────────────────────────────── */

/**
 * Menu item configuration
 */
export interface MenuItem {
  value: string;
  text?: string;
  selected?: boolean;
  checked?: boolean;
  disabled?: boolean;
  description?: string;
  keepOpen?: boolean;
  selection?: SelectionMode;
  group?: string;
  data?: Record<string, string>;
}

/**
 * Menu section configuration (grouped items with heading)
 */
export interface MenuSection {
  heading?: string;
  items: MenuItem[];
  group?: string;
  selection?: SelectionMode;
  style?: string;
}

/**
 * Menu items - either flat list or sections
 */
export type MenuItems = MenuItem[] | MenuSection[];

/**
 * Menu options for programmatic menu population
 */
export interface MenuOptions {
  selection?: SelectionMode;
  group?: string;
  append?: boolean;
  marker?: string;
}

/* ── Form & Validation ───────────────────────────────────────────── */

/**
 * Form field validation state
 */
export type ValidationState = 'valid' | 'invalid' | 'pending' | 'untouched';

/**
 * Input types supported across sherpa-input-* components
 */
export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'tel'
  | 'url'
  | 'search'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'textarea';

/* ── Data Attribute Maps ─────────────────────────────────────────── */

/**
 * Common data attributes used across components
 * Components can extend this with their specific attributes
 */
export interface CommonDataAttributes extends DOMStringMap {
  label?: string;
  description?: string;
  helper?: string;
  status?: string;
  variant?: string;
  size?: string;
  layout?: 'horizontal' | 'vertical';
}

/* ── Utility Types ───────────────────────────────────────────────── */

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make specific properties of T required
 */
export type RequireProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Extract property names that are of a specific type
 */
export type PropertiesOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Constructor type for mixins
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = object> = new (...args: any[]) => T;

/**
 * Abstract constructor type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AbstractConstructor<T = object> = abstract new (...args: any[]) => T;

/* ── Component Public API Interfaces ─────────────────────────────── */

/**
 * Base interface all Sherpa components should implement
 */
export interface ISherpaComponent extends HTMLElement {
  /** Component has completed initial render */
  readonly rendered: Promise<void>;
}

/**
 * Interface for components that support disabled state
 */
export interface IDisableable {
  disabled: boolean;
}

/**
 * Interface for components with label/description
 */
export interface ILabeled {
  label: string;
  description?: string;
}

/**
 * Interface for form-associated components
 */
export interface IFormField extends IDisableable, ILabeled {
  name: string;
  value: string;
  required: boolean;
  readonly: boolean;

  // Validation API
  readonly validity: ValidityState | undefined;
  readonly validationMessage: string;
  checkValidity(): boolean;
  reportValidity(): boolean;
}

/* ── Non-null helpers ─────────────────────────────────────────────── */

/**
 * Assert that a value is non-null/undefined. Returns the value typed
 * without the `null | undefined` part. Throws if the value is nullish.
 *
 * Useful when accessing required cached elements or values that the type
 * system cannot narrow (e.g. `noUncheckedIndexedAccess` array reads).
 *
 *   const ctx = nn(canvas.getContext('2d'), 'canvas context required');
 */
export function nn<T>(value: T | null | undefined, message = 'expected non-null value'): T {
  if (value == null) throw new Error(message);
  return value;
}

/**
 * Type guard: narrows `value` to `NonNullable<T>` without throwing.
 *
 *   const items = list.filter(isNonNullable);
 */
export function isNonNullable<T>(value: T | null | undefined): value is NonNullable<T> {
  return value != null;
}

/* ── Node-canvas shared types ─────────────────────────────────────── */

/** Reference to a specific port on a specific node. */
export interface EdgeEndpoint {
  nodeId: string;
  portName: string;
}

/** A directed connection between two ports. */
export interface Edge {
  from: EdgeEndpoint;
  to: EdgeEndpoint;
  control: boolean;
}

/** Canvas pan/zoom viewport state. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/* ── Sherpa custom event map ───────────────────────────────────────── */

/**
 * Map of Sherpa custom event names → CustomEvent detail types.
 *
 * Augmenting `HTMLElement.addEventListener` with this map lets call sites
 * write `el.addEventListener('filter-change', e => e.detail.filters)`
 * and get correctly typed `e.detail` without casts.
 *
 * Add entries as more event detail interfaces are defined. Events not in
 * this map still work via the standard string overload (untyped detail).
 */
export interface SherpaEventMap {
  'filter-change': CustomEvent<FilterChangeEventDetail>;
  'filter-clear': CustomEvent<void>;
  'menu-open': CustomEvent<MenuOpenEventDetail>;
  'menu-close': CustomEvent<MenuCloseEventDetail>;
  'menu-select': CustomEvent<MenuSelectEventDetail>;
  'menu-populate': CustomEvent<{ trigger: Element }>;
  'page-change': CustomEvent<PageChangeEventDetail>;
  'sort-change': CustomEvent<SortChangeEventDetail>;
  'selection-change': CustomEvent<SelectionChangeEventDetail>;
  'search': CustomEvent<SearchEventDetail>;
  'group-toggle': CustomEvent<GroupToggleEventDetail>;
  'row-action': CustomEvent<RowActionEventDetail>;
  'grid-action': CustomEvent<GridActionEventDetail>;
  'grid-export': CustomEvent<void>;
  'toggle-filters': CustomEvent<ToggleEventDetail>;
  'toggle-legend': CustomEvent<ToggleEventDetail>;
  'view-header-back': CustomEvent<void>;
  'global-filter-change': CustomEvent<FilterChangeEventDetail>;
  'container-filter-change': CustomEvent<FilterChangeEventDetail>;
  'presentation-change': CustomEvent<{ type: string; data: unknown }>;
  // Panel
  'panel-toggle': CustomEvent<{ expanded: boolean }>;
  'panel-search': CustomEvent<{ value: string; matchCount: number }>;
  'panel-close': CustomEvent<void>;
  'ai-panel-new-chat': CustomEvent<void>;
  'ai-panel-archive': CustomEvent<void>;
  // Stepper
  'step-change': CustomEvent<{ currentStep: number; previousStep: number; label?: string }>;
  'step-click': CustomEvent<{ step: number; label?: string }>;
  // Prompt composer
  'prompt-submit': CustomEvent<{ value: string }>;
  // Node-canvas: edge lifecycle
  'edge-create': CustomEvent<Edge>;
  'edge-update': CustomEvent<{ edgeIdx: number; edge: Edge }>;
  'edge-delete': CustomEvent<{ edgeIdx: number }>;
  'edge-select': CustomEvent<{ edgeIdx: number | null }>;
  // Node-canvas: node lifecycle
  'node-select': CustomEvent<{ nodeId: string | null }>;
  'node-delete': CustomEvent<{ nodeId: string }>;
  'node-value-change': CustomEvent<{ nodeId: string }>;
  'node-subtype-change': CustomEvent<{ nodeId: string; subtype: string }>;
  // Node-canvas: canvas state
  'viewport-change': CustomEvent<Viewport>;
  'canvas-subgraph-enter': CustomEvent<{ parentId: string; label: string; depth: number; cached: boolean }>;
  'canvas-subgraph-exit': CustomEvent<{ parentId: string; label: string; depth: number }>;
  // Node-graph socket/node pointer events
  'socket-pointerdown': CustomEvent<{
    nodeId?: string;
    portName?: string;
    direction?: string;
    originalEvent: PointerEvent;
  }>;
  'node-pointerdown': CustomEvent<{ nodeId: string; originalEvent: Event }>;
  'node-drilldown': CustomEvent<{ nodeId: string; label?: string }>;
}

declare global {
  interface HTMLElement {
    addEventListener<K extends keyof SherpaEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: SherpaEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof SherpaEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: SherpaEventMap[K]) => void,
      options?: boolean | EventListenerOptions,
    ): void;
  }

  interface ShadowRoot {
    addEventListener<K extends keyof SherpaEventMap>(
      type: K,
      listener: (this: ShadowRoot, ev: SherpaEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof SherpaEventMap>(
      type: K,
      listener: (this: ShadowRoot, ev: SherpaEventMap[K]) => void,
      options?: boolean | EventListenerOptions,
    ): void;
  }
}
