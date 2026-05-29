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
export type ComponentTier = 'atom' | 'molecule' | 'organism' | 'container';

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
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Abstract constructor type
 */
export type AbstractConstructor<T = {}> = abstract new (...args: any[]) => T;

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
