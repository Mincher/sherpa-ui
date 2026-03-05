/**
 * Format Utilities
 * Number/value formatting, string helpers, and ID generation
 */

// ── String Helpers ─────────────────────────────────────────────────────────────

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Convert field name to display label
 * Handles camelCase, snake_case → Title Case
 * @param {string} field - Field name (e.g., "firstName", "last_name")
 * @returns {string} Formatted label (e.g., "First Name", "Last Name")
 */
export function formatFieldName(field) {
  if (!field) return '';
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── ID Generation ──────────────────────────────────────────────────────────────

const counters = new Map();

/**
 * Generate a unique ID with a given prefix
 * @param {string} prefix - ID prefix (e.g., "menu", "table", "chart")
 * @returns {string} Unique ID (e.g., "menu-1", "table-2")
 */
export function generateUniqueId(prefix = 'id') {
  const current = counters.get(prefix) || 0;
  const next = current + 1;
  counters.set(prefix, next);
  return `${prefix}-${next}`;
}

// ── Number / Value Formatting ──────────────────────────────────────────────────

/**
 * Format a number with K/M suffixes for compact display
 * @param {number} value - Number to format
 * @returns {string} Formatted string (e.g., "1.2M", "450K", "123")
 */
export function formatCompact(value) {
  if (value == null || isNaN(value)) return '';
  const v = Number(value);
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return v.toString();
}

/**
 * Format a value based on its type
 * @param {*} value - Value to format
 * @param {string} type - Column type (currency, percent, date, datetime, number, etc.)
 * @returns {string} Formatted value
 */
export function formatValue(value, type) {
  if (value == null) return '';
  
  switch (type) {
    case 'datetime':
    case 'date': {
      const d = new Date(value);
      if (isNaN(d.getTime())) return escapeHtml(String(value));
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${days[d.getDay()]} ${dd} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}:${ss}`;
    }
    case 'currency':
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        maximumFractionDigits: 0 
      }).format(value);
    case 'percent':
      return `${value}%`;
    case 'number':
    case 'numeric':
      return new Intl.NumberFormat('en-US').format(value);
    default:
      return escapeHtml(String(value));
  }
}

/**
 * Generate a concise content title: "$categoryName by $groupName".
 * Group portion is omitted when there is no secondary dimension.
 *
 * @param {object|string} details - Metadata object (or plain dataset name)
 * @returns {string} Formatted title
 */
export function generateContentTitle(details) {
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
