/**
 * ThemeManager — Standalone utility for managing theme, mode, density, status.
 *
 * Single source of truth: every axis is a `data-*` attribute on `<html>`.
 * CSS owns the visual consequences (including `color-scheme`) — this utility
 * only writes attributes and (for Theme) loads the matching stylesheet.
 *
 *   axis      attribute         CSS handles
 *   ────────  ────────────────  ──────────────────────────────────────
 *   Theme     data-theme        Token bindings via :root[data-theme="..."]
 *                               (all themes bundled in index.css — no link swap)
 *   Mode      data-mode         color-scheme + light/dark/HC token blocks
 *   Density   data-density      Spacing scale via [data-density] subtree
 *   Status    data-status       --_status-* private vars on subtree
 *
 * Usage:
 *   import { ThemeManager } from '../utilities/theme-manager.js';
 *
 *   Init with a CSS base URL for theme files
 *   ThemeManager.init({ cssBaseUrl: '/css/styles/' });
 *
 *   // Apply preferences (reads from localStorage if available)
 *   ThemeManager.restore();
 *
 *   // Set values programmatically
 *   ThemeManager.setTheme('apex-2-purple');
 *   ThemeManager.setMode('dark');     // 'auto' | 'light' | 'dark' | 'hc'
 *   ThemeManager.setDensity('compact');
 *   ThemeManager.setStatus('warning'); // 'critical'|'info'|'success'|'warning'|'urgent'|null
 *
 * Configuration (passed to init()):
 *   storageKeyTheme  — localStorage key for theme    (default: 'sherpa-theme')
 *   storageKeyMode   — localStorage key for mode     (default: 'sherpa-mode')
 *   storageKeyDensity— localStorage key for density  (default: 'sherpa-density')
 *   storageKeyStatus — localStorage key for status   (default: 'sherpa-status')
 *   defaultTheme     — Fallback theme slug   (default: 'apex-2-purple')
 *   defaultMode      — Fallback mode         (default: 'auto')
 *   defaultDensity   — Fallback density      (default: 'base')
 *   defaultStatus    — Fallback status       (default: null)
 *   persist          — Save to localStorage  (default: true)
 */

const _config = {
  storageKeyTheme: 'sherpa-theme',
  storageKeyMode: 'sherpa-mode',
  storageKeyDensity: 'sherpa-density',
  storageKeyStatus: 'sherpa-status',
  defaultTheme: 'apex-2-purple',
  defaultMode: 'auto',
  defaultDensity: 'base',
  defaultStatus: null,
  persist: true,
};

const _root = () => document.documentElement;

function _read<T extends string | null>(key: string, fallback: T): string | T {
  if (!_config.persist) return fallback;
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}
function _write(key: string, value: string | null) {
  if (!_config.persist) return;
  try {
    if (value == null) localStorage.removeItem(key);
    else               localStorage.setItem(key, value);
  } catch { /* storage unavailable — silent */ }
}

export const ThemeManager = {
  /**
   * Initialise ThemeManager with configuration overrides.
   * @param {Partial<typeof _config>} options
   */
  init(options = {}) {
    Object.assign(_config, options);
  },

  /**
   * Restore saved preferences from localStorage and apply them.
   * Falls back to configured defaults if nothing is saved.
   */
  restore() {
    this.setTheme(this.getTheme());
    this.setMode(this.getMode());
    this.setDensity(this.getDensity());
    this.setStatus(this.getStatus());
  },

  // ─── Theme ──────────────────────────────────────────────────

  /** @returns {string} Current theme slug. */
  getTheme() { return _read(_config.storageKeyTheme, _config.defaultTheme); },

  /**
   * Apply a theme by setting <html data-theme="...">.
   * All extended themes are bundled in sherpa-themes.css (loaded by
   * index.css) — no dynamic stylesheet swap is needed. The [data-theme="..."]
   * selectors in that file activate only the matching theme at zero cost.
   * @param {string} theme — Theme slug, e.g. 'apex-2-purple', 'classic'
   */
  setTheme(theme: string) {
    _root().dataset["theme"] = theme;
    _write(_config.storageKeyTheme, theme);
  },

  // ─── Mode (auto / light / dark / hc) ────────────────────────

  /** @returns {string} Current mode. */
  getMode() { return _read(_config.storageKeyMode, _config.defaultMode); },

  /**
   * Apply color mode by writing a single attribute. CSS in
   * `tokens/platform.css` and each theme file handles the visual cascade
   * (including `color-scheme`). Modes:
   *   'auto'  → no override; tracks prefers-color-scheme and prefers-contrast
   *   'light' → forces light tokens regardless of OS preference
   *   'dark'  → forces dark tokens regardless of OS preference
   *   'hc'    → forces High Contrast tokens (overrides both light + dark)
   * @param {'auto'|'light'|'dark'|'hc'} mode
   */
  setMode(mode: string) {
    _root().dataset["mode"] = mode;
    _write(_config.storageKeyMode, mode);
  },

  // ─── Density ────────────────────────────────────────────────

  /** @returns {string} Current density. */
  getDensity() { return _read(_config.storageKeyDensity, _config.defaultDensity); },

  /**
   * Apply density on the document root. Components inside any subtree
   * with `[data-density]` rescale automatically.
   * @param {'compact'|'base'|'comfortable'} density
   */
  setDensity(density: string) {
    _root().dataset["density"] = density;
    _write(_config.storageKeyDensity, density);
  },

  // ─── Status ─────────────────────────────────────────────────

  /** @returns {string|null} Current status (null = no status applied). */
  getStatus() {
    const stored = _read(_config.storageKeyStatus, _config.defaultStatus);
    return stored || null;
  },

  /**
   * Apply a status mode globally. Components inside the subtree consume
   * the resulting `--_status-*` private variables via their var() fallbacks.
   * Pass `null` to clear.
   * @param {'critical'|'info'|'success'|'warning'|'urgent'|null} status
   */
  setStatus(status: string | null) {
    if (status) _root().dataset["status"] = status;
    else        delete _root().dataset["status"];
    _write(_config.storageKeyStatus, status);
  },
};
