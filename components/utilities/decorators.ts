/**
 * @fileoverview Reactive property decorators for Sherpa UI components
 *
 * This module provides TypeScript decorators for creating reactive properties
 * that automatically sync with HTML attributes and trigger re-renders.
 *
 * Eliminates verbose getter/setter boilerplate while maintaining full
 * attribute/property synchronization.
 */

/**
 * Property configuration options
 */
export interface PropertyOptions {
  /** Attribute name (defaults to kebab-case of property name) */
  attribute?: string | false;

  /** Property type for conversion */
  type?: PropertyType;

  /** Reflect property changes back to attribute */
  reflect?: boolean;

  /** Default value */
  default?: unknown;

  /** Custom converter */
  converter?: PropertyConverter;
}

export type PropertyType = StringConstructor | NumberConstructor | BooleanConstructor | ObjectConstructor | ArrayConstructor;

export interface PropertyConverter {
  fromAttribute?(value: string | null): unknown;
  toAttribute?(value: unknown): string | null;
}

/**
 * Default converters for each type
 */
const defaultConverters: Record<string, PropertyConverter> = {
  String: {
    fromAttribute: (v) => v,
    toAttribute: (v) => v == null ? null : String(v)
  },
  Number: {
    fromAttribute: (v) => v === null ? null : Number(v),
    toAttribute: (v) => v == null ? null : String(v)
  },
  Boolean: {
    fromAttribute: (v) => v !== null,
    toAttribute: (v) => v ? '' : null
  },
  Object: {
    fromAttribute: (v) => v ? JSON.parse(v) : null,
    toAttribute: (v) => v ? JSON.stringify(v) : null
  },
  Array: {
    fromAttribute: (v) => v ? JSON.parse(v) : [],
    toAttribute: (v) => Array.isArray(v) ? JSON.stringify(v) : null
  }
};

/**
 * @property decorator - Creates reactive properties with automatic attribute reflection
 *
 * @example
 * ```typescript
 * class SherpaButton extends SherpaElement {
 *   @property({ type: String, attribute: 'data-variant' })
 *   variant: string = 'primary';
 *
 *   @property({ type: Boolean, reflect: true })
 *   disabled: boolean = false;
 * }
 * ```
 */
export function property(options: PropertyOptions = {}) {
  return (target: any, propertyKey: string) => {
    const {
      attribute = propertyKey.replace(/([A-Z])/g, '-$1').toLowerCase(),
      type = String,
      reflect = false,
      converter
    } = options;

    // Get or create property metadata map on the class
    if (!target.constructor._propertyMetadata) {
      target.constructor._propertyMetadata = new Map();
    }

    const metadata = target.constructor._propertyMetadata;
    const privateKey = Symbol(propertyKey);

    // Store metadata for this property
    metadata.set(propertyKey, {
      attribute,
      type,
      reflect,
      converter: converter || defaultConverters[type.name],
      privateKey
    });

    // Define getter/setter
    Object.defineProperty(target, propertyKey, {
      get() {
        return this[privateKey];
      },
      set(value: unknown) {
        const oldValue = this[privateKey];
        this[privateKey] = value;

        // Reflect to attribute if configured
        if (reflect && attribute !== false) {
          const conv = metadata.get(propertyKey).converter;
          const attrValue = conv.toAttribute(value);

          if (attrValue === null) {
            this.removeAttribute(attribute);
          } else {
            this.setAttribute(attribute, attrValue);
          }
        }

        // Call property changed hook if it exists
        const changedHook = `${propertyKey}Changed`;
        if (typeof this[changedHook] === 'function') {
          this[changedHook](oldValue, value);
        }

        // Request update if the element has an update method
        if (typeof this.requestUpdate === 'function') {
          this.requestUpdate(propertyKey, oldValue);
        }
      },
      enumerable: true,
      configurable: true
    });
  };
}

/**
 * Helper to initialize reactive properties from attributes
 * Call this in connectedCallback or constructor
 */
export function initializeProperties(instance: any): void {
  const metadata = instance.constructor._propertyMetadata;
  if (!metadata) return;

  for (const [propKey, meta] of metadata.entries()) {
    if (meta.attribute !== false && instance.hasAttribute(meta.attribute)) {
      const attrValue = instance.getAttribute(meta.attribute);
      const propValue = meta.converter.fromAttribute(attrValue);
      instance[propKey] = propValue;
    }
  }
}

/**
 * Helper to get observed attributes from property metadata
 * Use in static get observedAttributes()
 */
export function getObservedAttributes(constructor: any): string[] {
  const metadata = constructor._propertyMetadata;
  if (!metadata) return [];

  const attrs: string[] = [];
  for (const [, meta] of metadata.entries()) {
    if (meta.attribute !== false) {
      attrs.push(meta.attribute);
    }
  }
  return attrs;
}
