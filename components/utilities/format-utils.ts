/**
 * Format Utilities
 * Number/value formatting, string helpers, and ID generation
 */

// ── String Helpers ─────────────────────────────────────────────────────────────

const _escapeDiv = document.createElement('div');

/**
 * Escape HTML entities to prevent XSS.
 */
export function escapeHtml(str: unknown): string {
  if (str == null) return '';
  _escapeDiv.textContent = String(str);
  return _escapeDiv.innerHTML;
}

/**
 * Convert field name to display label.
 * Handles camelCase, snake_case → Title Case.
 * Example: "firstName" → "First Name", "last_name" → "Last Name".
 */
export function formatFieldName(field: string | null | undefined): string {
  if (!field) return '';
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract the core entity name from a title by stripping a leading "All "
 * prefix and/or a trailing " by <Field>" suffix.
 */
export function cleanTitleBase(title: string | null | undefined): string {
  if (!title) return '';
  return title
    .replace(/^All\s+/i, '')
    .replace(/\s+by\s+.+$/i, '');
}

// ── ID Generation ──────────────────────────────────────────────────────────────

const counters = new Map<string, number>();

/**
 * Generate a unique ID with a given prefix (e.g., "menu-1", "table-2").
 */
export function generateUniqueId(prefix = 'id'): string {
  const current = counters.get(prefix) || 0;
  const next = current + 1;
  counters.set(prefix, next);
  return `${prefix}-${next}`;
}

// ── Currency Configuration ─────────────────────────────────────────────────────

export interface CurrencyConfig {
  locale?: string;
  currency?: string;
}

const _currencyConfig: { locale: string; currency: string } = {
  locale: 'en-US',
  currency: 'USD',
};

/**
 * Override the default currency/locale used by formatValue() and chart components.
 */
export function setCurrencyConfig(config: CurrencyConfig): void {
  if (config.locale)   _currencyConfig.locale   = config.locale;
  if (config.currency) _currencyConfig.currency = config.currency;
}

/** Return the current currency code (e.g. 'USD'). */
export function getCurrencyCode(): string {
  return _currencyConfig.currency;
}

/** Return the currency symbol for the current config (e.g. '$'). */
export function getCurrencySymbol(): string {
  return new Intl.NumberFormat(_currencyConfig.locale, {
    style: 'currency', currency: _currencyConfig.currency,
    maximumFractionDigits: 0,
  }).formatToParts(0).find((p) => p.type === 'currency')?.value || _currencyConfig.currency;
}

// ── Number / Value Formatting ──────────────────────────────────────────────────

/**
 * Format a number with K/M suffixes for compact display
 * (e.g., "1.2M", "450K", "123").
 */
export function formatCompact(value: unknown): string {
  if (value == null || isNaN(Number(value))) return '';
  const v = Number(value);
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return v.toString();
}

/**
 * Format a value based on its type
 * (currency, percent, date, datetime, number, etc.).
 */
export function formatValue(value: unknown, type: string | null | undefined): string {
  if (value == null) return '';

  switch (type) {
    case 'datetime':
    case 'date': {
      let d: Temporal.PlainDate | Temporal.PlainDateTime | null = null;
      try {
        const s = String(value);
        d = s.includes('T') ? Temporal.PlainDateTime.from(s) : Temporal.PlainDate.from(s);
      } catch { return escapeHtml(String(value)); }
      const fmt: Intl.DateTimeFormatOptions = {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      };
      const parts = d.toLocaleString(_currencyConfig.locale, fmt);
      return parts;
    }
    case 'currency':
      return new Intl.NumberFormat(_currencyConfig.locale, {
        style: 'currency',
        currency: _currencyConfig.currency,
        maximumFractionDigits: 0,
      }).format(Number(value));
    case 'percent':
      return `${value}%`;
    case 'number':
    case 'numeric':
      return new Intl.NumberFormat(_currencyConfig.locale).format(Number(value));
    default:
      return escapeHtml(String(value));
  }
}

export interface ContentTitleDetails {
  dataset?: string;
  name?: string;
  groupField?: string;
  segmentField?: string;
}

/**
 * Generate a concise content title: "$categoryName by $groupName".
 * Group portion is omitted when there is no secondary dimension.
 */
export function generateContentTitle(details: ContentTitleDetails | string | null | undefined): string {
  if (!details || typeof details !== 'object') {
    return details ? formatFieldName(String(details)) : '';
  }

  // Primary label: dataset name (the JSON slug e.g. "detections" → "Detections")
  const dataset = details.dataset ?? details.name ?? '';
  const baseLabel = dataset ? formatFieldName(dataset) : '';

  // Secondary dimension: group / segment field
  const groupField = details.groupField ?? details.segmentField ?? null;
  const groupLabel = groupField ? formatFieldName(groupField) : '';

  if (baseLabel && groupLabel) return `${baseLabel} by ${groupLabel}`;
  if (baseLabel) return baseLabel;

  return '';
}
