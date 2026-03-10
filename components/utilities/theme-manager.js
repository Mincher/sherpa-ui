/**
 * ThemeManager — Standalone utility for managing theme, mode, and density.
 *
 * Handles:
 *   • Theme stylesheet loading (swaps/creates <link id="sherpa-theme"> in <head>)
 *   • Color mode switching via color-scheme CSS property (light / dark / auto)
 *   • Density attribute on <html> element
 *   • Optional localStorage persistence
 *
 * Usage:
 *   import { ThemeManager } from '../utilities/theme-manager.js';
 *
 *   // Initialise with a CSS base URL for theme files
 *   ThemeManager.init({ cssBaseUrl: '/css/styles/' });
 *
 *   // Apply preferences (reads from localStorage if available)
 *   ThemeManager.restore();
 *
 *   // Set values programmatically
 *   ThemeManager.setTheme('apex-2-core');
 *   ThemeManager.setMode('dark');
 *   ThemeManager.setDensity('compact');
 *
 * Configuration (passed to init()):
 *   cssBaseUrl       — Base URL for theme CSS files (default: '/css/styles/')
 *   themePrefix      — Filename prefix for theme files (default: 'sherpa-theme-')
 *   storageKeyTheme  — localStorage key for theme (default: 'sherpa-theme')
 *   storageKeyMode   — localStorage key for mode (default: 'sherpa-mode')
 *   storageKeyDensity— localStorage key for density (default: 'sherpa-density')
 *   defaultTheme     — Fallback theme name (default: 'apex-2-core')
 *   defaultMode      — Fallback mode (default: 'auto')
 *   defaultDensity   — Fallback density (default: 'base')
 *   persist          — Whether to save to localStorage (default: true)
 */

const _config = {
  cssBaseUrl: '/css/styles/',
  themePrefix: 'sherpa-theme-',
  storageKeyTheme: 'sherpa-theme',
  storageKeyMode: 'sherpa-mode',
  storageKeyDensity: 'sherpa-density',
  defaultTheme: 'apex-2-core',
  defaultMode: 'auto',
  defaultDensity: 'base',
  persist: true,
};

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
  },

  // ─── Theme ──────────────────────────────────────────────────

  /** @returns {string} Current theme name (from localStorage or default). */
  getTheme() {
    return (_config.persist && localStorage.getItem(_config.storageKeyTheme))
      || _config.defaultTheme;
  },

  /**
   * Apply a theme by swapping the <link id="sherpa-theme"> stylesheet.
   * @param {string} theme — Theme identifier, e.g. 'apex-2-core'
   */
  setTheme(theme) {
    let link = document.getElementById('sherpa-theme');
    if (!link) {
      link = document.createElement('link');
      link.id = 'sherpa-theme';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `${_config.cssBaseUrl}${_config.themePrefix}${theme}.css`;
    if (_config.persist) localStorage.setItem(_config.storageKeyTheme, theme);
  },

  // ─── Mode (light / dark / auto) ─────────────────────────────

  /** @returns {string} Current mode (from localStorage or default). */
  getMode() {
    return (_config.persist && localStorage.getItem(_config.storageKeyMode))
      || _config.defaultMode;
  },

  /**
   * Apply color mode.
   * @param {'light'|'dark'|'auto'} mode
   */
  setMode(mode) {
    document.documentElement.style.colorScheme =
      mode === 'auto' ? 'light dark' : mode;
    if (_config.persist) localStorage.setItem(_config.storageKeyMode, mode);
  },

  // ─── Density ────────────────────────────────────────────────

  /** @returns {string} Current density (from localStorage or default). */
  getDensity() {
    return (_config.persist && localStorage.getItem(_config.storageKeyDensity))
      || _config.defaultDensity;
  },

  /**
   * Apply density.
   * @param {string} density — e.g. 'compact', 'base', 'comfortable'
   */
  setDensity(density) {
    document.documentElement.setAttribute('data-density', density);
    if (_config.persist) localStorage.setItem(_config.storageKeyDensity, density);
  },
};
