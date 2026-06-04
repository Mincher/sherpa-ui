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
 * Property configuration options (now generic for better type safety)
 */
export interface PropertyOptions<T = unknown> {
  /** Attribute name (defaults to kebab-case of property name) */
  attribute?: string | false;

  /** Property type for conversion */
  type?: PropertyType;

  /** Reflect property changes back to attribute */
  reflect?: boolean;

  /** Default value (typed to property type) */
  default?: T;

  /** Custom converter (typed to property type) */
  converter?: PropertyConverter<T>;
}

export type PropertyType = StringConstructor | NumberConstructor | BooleanConstructor | ObjectConstructor | ArrayConstructor;

export interface PropertyConverter<T = unknown> {
  fromAttribute?(value: string | null): T | null;
  toAttribute?(value: T | null): string | null;
}

interface PropertyMeta {
  attribute: string | false;
  type: PropertyType;
  reflect: boolean;
  converter: PropertyConverter;
  privateKey: symbol;
}

/**
 * Default converters for each type (typed Record for indexing)
 */
const defaultConverters: Record<string, PropertyConverter> = {
  String: {
    fromAttribute: (v: string | null): string | null => v,
    toAttribute: (v: string | null): string | null => v == null ? null : String(v)
  },
  Number: {
    fromAttribute: (v: string | null): number | null => v === null ? null : Number(v),
    toAttribute: (v: number | null): string | null => v == null ? null : String(v)
  },
  Boolean: {
    fromAttribute: (v: string | null): boolean => v !== null,
    toAttribute: (v: boolean | null): string | null => v ? '' : null
  },
  Object: {
    fromAttribute: (v: string | null): unknown => v ? JSON.parse(v) : null,
    toAttribute: (v: unknown): string | null => v ? JSON.stringify(v) : null
  },
  Array: {
    fromAttribute: (v: string | null): unknown[] => v ? JSON.parse(v) : [],
    toAttribute: (v: unknown): string | null => Array.isArray(v) ? JSON.stringify(v) : null
  }
};

/**
 * @property decorator - Creates reactive properties with automatic attribute reflection
 *
 * Now generic for better type safety and inference.
 *
 * @example
 * ```typescript
 * class SherpaButton extends SherpaElement {
 *   @property<string>({ type: String, attribute: 'data-variant' })
 *   variant: string = 'primary';
 *
 *   @property<boolean>({ type: Boolean, reflect: true })
 *   disabled: boolean = false;
 *
 *   // With union types for compile-time validation
 *   @property<'sm' | 'base' | 'lg'>({ type: String })
 *   size: 'sm' | 'base' | 'lg' = 'base';
 * }
 * ```
 */
export function property<T = unknown>(options: PropertyOptions<T> = {}) {
  return (target: any, propertyKey: string) => {
    const {
      attribute = propertyKey.replace(/([A-Z])/g, '-$1').toLowerCase(),
      type = String,
      reflect = false,
      converter
    } = options;

    // Get or create property metadata map on the exact constructor (not inherited via chain)
    if (!Object.prototype.hasOwnProperty.call(target.constructor, '_propertyMetadata')) {
      target.constructor._propertyMetadata = new Map();
    }

    const metadata = target.constructor._propertyMetadata as Map<string, PropertyMeta>;
    const privateKey = Symbol(propertyKey);

    // Store metadata for this property
    const resolvedConverter = (converter || defaultConverters[type.name]) as PropertyConverter;
    metadata.set(propertyKey, {
      attribute,
      type,
      reflect,
      converter: resolvedConverter,
      privateKey
    });

    // Define getter/setter (typed with generic T)
    Object.defineProperty(target, propertyKey, {
      get(): T | undefined {
        return this[privateKey];
      },
      set(value: T) {
        const oldValue: T | undefined = this[privateKey];
        this[privateKey] = value;

        // Reflect to attribute if configured
        if (reflect && attribute !== false) {
          const meta = metadata.get(propertyKey);
          const attrValue = meta?.converter.toAttribute?.(value) ?? null;

          if (attrValue === null) {
            this.removeAttribute(attribute as string);
          } else {
            this.setAttribute(attribute as string, attrValue);
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
 * Helper to initialize reactive properties from attributes.
 * Walks the prototype chain so subclasses inherit parent @property initializations.
 * Call this in connectedCallback or constructor
 */
export function initializeProperties(instance: any): void {
  const seen = new Set<string>();
  let proto = instance.constructor;
  while (proto && proto !== Function.prototype) {
    if (Object.prototype.hasOwnProperty.call(proto, '_propertyMetadata')) {
      const metadata = proto._propertyMetadata as Map<string, PropertyMeta>;
      for (const [propKey, meta] of metadata.entries()) {
        if (!seen.has(propKey) && meta.attribute !== false && instance.hasAttribute(meta.attribute)) {
          seen.add(propKey);
          const attrValue = instance.getAttribute(meta.attribute as string);
          const propValue = meta.converter.fromAttribute?.(attrValue);
          instance[propKey] = propValue;
        }
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
}

/**
 * Helper to get observed attributes from property metadata.
 * Walks the prototype chain so subclasses inherit parent @property attributes.
 * Use in static get observedAttributes()
 */
export function getObservedAttributes(constructor: any): string[] {
  const attrs: string[] = [];
  const seen = new Set<string>();

  let proto = constructor;
  while (proto && proto !== Function.prototype) {
    if (Object.prototype.hasOwnProperty.call(proto, '_propertyMetadata')) {
      const metadata = proto._propertyMetadata as Map<string, PropertyMeta>;
      for (const [, meta] of metadata.entries()) {
        if (meta.attribute !== false && !seen.has(meta.attribute as string)) {
          seen.add(meta.attribute as string);
          attrs.push(meta.attribute as string);
        }
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  return attrs;
}
