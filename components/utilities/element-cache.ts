/**
 * @fileoverview Type-safe lazy element caching for Sherpa UI components
 *
 * Eliminates boilerplate element caching by providing decorators and helpers
 * for lazy-queried, memoized element references with full TypeScript typing.
 *
 * Three usage patterns (all compatible):
 *
 * 1. @cached decorator (advanced):
 *    @cached('.label') get labelEl() { return null; }
 *
 * 2. defineCachedElements helper (bulk definitions):
 *    const { labelEl, triggerEl } = defineCachedElements(this, {
 *      labelEl: '.label',
 *      triggerEl: '.trigger'
 *    });
 *
 * 3. SherpaElement.cacheElements (convenience):
 *    els = this.cacheElements({ label: '.label' });
 *    // Access: this.els.label
 */

/* ── Types ─────────────────────────────────────────────────────────── */

/** Element cache configuration for a single element */
export interface ElementCacheConfig<T extends Element = Element> {
  /** CSS selector to query */
  selector: string;

  /** Expected element type (for type safety) */
  type?: { new (): T };

  /** Query all matching elements (returns NodeListOf<T> instead of T | null) */
  all?: boolean;

  /** Whether element must exist (throws if not found, default: false) */
  required?: boolean;
}

/** Shorthand: string selector becomes config with defaults */
export type ElementCacheEntry<T extends Element = Element> =
  | string
  | ElementCacheConfig<T>;

/** Map of element names to their cache configurations */
export type ElementCacheMap = Record<string, ElementCacheEntry<any>>;

/** Inferred return type for cached element getters */
export type CachedElementType<T> =
  T extends { all: true; type: { new (): infer E } }
    // @ts-expect-error - TODO: Fix type
    ? NodeListOf<E>
    : T extends { all: true }
    ? NodeListOf<Element>
    : T extends { type: { new (): infer E } }
    ? E | null
    : T extends string
    ? Element | null
    : Element | null;

/** Result type mapping cache config to typed getters */
export type CachedElements<M extends ElementCacheMap> = {
  readonly [K in keyof M]: CachedElementType<M[K]>;
};

/* ── Private Cache Storage ─────────────────────────────────────────── */

const CACHE_KEY = Symbol('sherpa-element-cache');

interface CacheStorage {
  [selector: string]: Element | NodeListOf<Element> | null;
}

function getCache(target: any): CacheStorage {
  if (!target[CACHE_KEY]) {
    target[CACHE_KEY] = Object.create(null);
  }
  return target[CACHE_KEY];
}

/* ── Decorator ─────────────────────────────────────────────────────── */

/**
 * @cached decorator — Converts a getter into a lazy, memoized element query.
 *
 * The getter body is ignored (return value unused). The decorator replaces
 * the getter with one that queries the shadow DOM on first access, caches
 * the result, and returns the cached value on subsequent calls.
 *
 * @example
 * ```typescript
 * class SherpaButton extends SherpaElement {
 *   @cached('.label')
 *   get labelEl(): HTMLElement | null { return null; }
 *
 *   @cached('.icon', HTMLSpanElement)
 *   get iconEl(): HTMLSpanElement | null { return null; }
 *
 *   @cached('.item', Element, true)  // all=true
 *   get items(): NodeListOf<Element> { return null as any; }
 *
 *   onRender() {
 *     this.labelEl.textContent = 'Click me';  // Queried on first access
 *     this.labelEl.classList.add('active');   // Cached, no re-query
 *   }
 * }
 * ```
 *
 * @param selector - CSS selector (resolved via this.$() or this.$$())
 * @param type - Element constructor for type hints (optional, TypeScript-only)
 * @param all - If true, queries all matching elements (this.$$())
 */
export function cached<T extends Element = Element>(
  selector: string,
  // @ts-expect-error - TODO: Fix type
  type?: { new (): T },
  all: boolean = false
) {
  // @ts-expect-error - TODO: Fix type
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const cacheKey = `${propertyKey}:${selector}`;

    descriptor.get = function (this: any) {
      const cache = getCache(this);

      // Return cached value if exists
      if (cacheKey in cache) {
        return cache[cacheKey];
      }

      // Query and cache
      const result = all ? this.$$(selector) : this.$(selector);

      cache[cacheKey] = result;
      return result;
    };

    return descriptor;
  };
}

/* ── Helper Functions ──────────────────────────────────────────────── */

/**
 * Define multiple cached element getters at once.
 *
 * Creates lazy, memoized getters for each entry in the map. Queries are
 * executed via the target's $() / $$() methods (requires SherpaElement).
 *
 * @example
 * ```typescript
 * class SherpaPanel extends SherpaElement {
 *   #els = defineCachedElements(this, {
 *     headingEl: '.header-title',
 *     closeBtnEl: { selector: '.close-btn', type: HTMLButtonElement },
 *     itemEls: { selector: '.item', all: true }
 *   });
 *
 *   onRender() {
 *     this.#els.headingEl?.textContent = 'Panel Title';
 *     this.#els.closeBtnEl?.addEventListener('click', () => {});
 *   }
 * }
 * ```
 *
 * @param target - Component instance (must have $() and $$() methods)
 * @param map - Element cache configuration map
 * @returns Frozen object with typed getters for each element
 */
export function defineCachedElements<M extends ElementCacheMap>(
  target: any,
  map: M
): CachedElements<M> {
  const cache = getCache(target);
  const result: any = {};

  for (const [key, entry] of Object.entries(map)) {
    const config: ElementCacheConfig =
      typeof entry === 'string' ? { selector: entry } : entry;

    const { selector, all = false, required = false } = config;
    const cacheKey = `${key}:${selector}`;

    Object.defineProperty(result, key, {
      get() {
        // Return cached value if exists
        if (cacheKey in cache) {
          return cache[cacheKey];
        }

        // Query and cache
        const el = all ? target.$$(selector) : target.$(selector);

        cache[cacheKey] = el;

        // Enforce required constraint
        if (required && !el) {
          throw new Error(
            `Required element not found: ${selector} (${target.constructor.name}.${key})`
          );
        }

        return el;
      },
      enumerable: true,
      configurable: false,
    });
  }

  return Object.freeze(result) as CachedElements<M>;
}

/**
 * Clear all cached elements for a component instance.
 *
 * Useful when re-rendering or swapping templates. SherpaElement calls
 * this automatically in renderTemplate() when templates change.
 *
 * @param target - Component instance
 */
export function clearElementCache(target: any): void {
  if (target[CACHE_KEY]) {
    target[CACHE_KEY] = Object.create(null);
  }
}
