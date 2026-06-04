/**
 * StatusMixin — Adds status attribute support to a SherpaElement subclass.
 *
 * Provides:
 *   • `data-status` in observedAttributes
 *   • `status` getter/setter (reactive property via decorator)
 *   • `statusIcon` getter (resolves via `statusIcons` map)
 *   • `static statusIcons` — default status → FA icon class map
 *   • `statusChanged(old, new)` hook (automatically called by decorator)
 *
 * Usage:
 *   import { SherpaElement } from './sherpa-element/sherpa-element.js';
 *   import { StatusMixin } from './status-mixin.js';
 *
 *   class SherpaCallout extends StatusMixin(SherpaElement) { ... }
 *
 * Subclasses can override `static get statusIcons()` to add or replace
 * icons (e.g. toast overrides `critical` to use `fa-circle-xmark`).
 */

export type Status =
  | 'success'
  | 'error'
  | 'critical'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'urgent'
  | 'default'
  | 'none';

type Constructor<T = {}> = new (...args: any[]) => T;

export interface StatusMixinInterface {
  status: Status | null;
  statusIcon: string | null;
  statusChanged?(oldValue: Status | null, newValue: Status | null): void;
}

/** Static members the mixin adds to the class (surfaced for subclass `super` access). */
export interface StatusMixinStatics {
  readonly statusIcons: Record<Status, string | null>;
}

export function StatusMixin<T extends Constructor<HTMLElement>>(
  Base: T,
): T & Constructor<StatusMixinInterface> & StatusMixinStatics {
  class StatusMixinClass extends Base implements StatusMixinInterface {
    static get observedAttributes(): string[] {
      const baseAttrs = (Base as any).observedAttributes || [];
      return [...baseAttrs, 'data-status'];
    }

    /**
     * Default status → Font Awesome icon class map.
     * Override in subclass to customise icons.
     */
    static get statusIcons(): Record<Status, string | null> {
      return {
        success: 'fa-solid fa-circle-check',
        error: 'fa-solid fa-circle-exclamation',
        critical: 'fa-solid fa-circle-exclamation',
        warning: 'fa-solid fa-triangle-exclamation',
        info: 'fa-solid fa-circle-info',
        neutral: 'fa-regular fa-circle',
        urgent: 'fa-solid fa-bolt',
        default: null,
        none: null,
      };
    }

    /** Current status value. */
    get status(): Status | null {
      return (this.getAttribute('data-status') as Status) || null;
    }
    set status(v: Status | null) {
      v ? this.setAttribute('data-status', v) : this.removeAttribute('data-status');
    }

    /** Font Awesome class for the current status icon, or null. */
    get statusIcon(): string | null {
      const icons = (this.constructor as typeof StatusMixinClass).statusIcons;
      const status = this.status;
      return status ? icons[status] ?? null : null;
    }

    /**
     * Called automatically when status changes (decorator hook).
     * Override in subclasses to respond to status changes.
     */
    statusChanged?(_oldValue: Status | null, _newValue: Status | null): void;
  }

  return StatusMixinClass as unknown as T & Constructor<StatusMixinInterface> & StatusMixinStatics;
}
