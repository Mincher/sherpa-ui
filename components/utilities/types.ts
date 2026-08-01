/**
 * @fileoverview Shared TypeScript types for Sherpa UI components
 *
 * This module provides common type definitions used across multiple components.
 * Centralizing types ensures consistency and makes system-wide updates easier.
 */

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
 * Selection mode for menu items, list items, etc. (used by MenuItem/MenuSection)
 */
export type SelectionMode = 'checkbox' | 'radio' | 'toggle';

/* ── Component Tiers ─────────────────────────────────────────────── */

/**
 * Component composition tiers (from component-categories.js)
 */
export type ComponentTier = 'atom' | 'molecule' | 'organism' | 'structure';

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

/**
 * Constructor type for mixins
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = object> = new (...args: any[]) => T;

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
