/**
 * sandbox.js — wiring for the Sherpa UI sandbox demo app.
 *
 * - Theme / mode / density switcher (nav Settings panel) via ThemeManager.
 * - Header gear + nav Settings item toggle the nav's secondary Settings list.
 * - Nav item clicks scroll to the matching grid tile.
 * - Seeds the data grid, input-tag, quick filters, toasts, and dialog.
 */
import { ThemeManager } from '/dist/components/utilities/theme-manager.js';

// ── Appearance state (persisted by ThemeManager) ──────────────────────────
ThemeManager.init({ defaultTheme: 'apex-2-core', defaultMode: 'light', defaultDensity: 'base' });

/** Reflect the active option in a button group by toggling primary/tertiary. */
function syncGroup(selector, activeAttr, activeValue) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.dataset.variant = btn.getAttribute(activeAttr) === activeValue ? 'primary' : 'tertiary';
  });
}

function syncAllGroups() {
  syncGroup('.theme-btn', 'data-theme-value', ThemeManager.getTheme());
  syncGroup('.mode-btn', 'data-mode-value', ThemeManager.getMode());
  syncGroup('.density-btn', 'data-density-value', ThemeManager.getDensity());
}

// Theme / mode / density button groups (delegated; buttons live in nav light DOM).
document.addEventListener('button-click', (e) => {
  const btn = e.target.closest?.('sherpa-button');
  if (!btn) return;
  if (btn.classList.contains('theme-btn'))   { ThemeManager.setTheme(btn.dataset.themeValue); syncAllGroups(); }
  if (btn.classList.contains('mode-btn'))    { ThemeManager.setMode(btn.dataset.modeValue);   syncAllGroups(); }
  if (btn.classList.contains('density-btn')) { ThemeManager.setDensity(btn.dataset.densityValue); syncAllGroups(); }
});

customElements.whenDefined('sherpa-button').then(() => setTimeout(syncAllGroups, 0));

// ── Nav Settings mode ─────────────────────────────────────────────────────
const nav = document.querySelector('sherpa-nav');

// Header gear toggles the nav's secondary Settings list.
document.getElementById('header-settings')?.addEventListener('button-click', () => {
  nav?.toggleSettings?.();
});

// ── Nav item → scroll to tile ──────────────────────────────────────────────
nav?.addEventListener('navitemclick', (e) => {
  const route = e.detail?.route;
  if (route?.startsWith('#')) document.querySelector(route)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
nav?.addEventListener('navhome', () => document.querySelector('#tile-buttons')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

// ── Data grid ───────────────────────────────────────────────────────────────
customElements.whenDefined('sherpa-data-grid').then(async () => {
  const grid = document.getElementById('grid-demo');
  if (!grid) return;
  let config;
  try {
    config = await fetch('/sticker-sheet/data/data-grid.json').then((r) => r.json());
  } catch {
    config = {
      columns: [
        { field: 'name', name: 'Name', type: 'string' },
        { field: 'status', name: 'Status', type: 'string' },
        { field: 'role', name: 'Role', type: 'string' },
      ],
      rows: [
        { name: 'Alice Martin', status: 'Active', role: 'Admin' },
        { name: 'Bob Chen', status: 'Pending', role: 'Editor' },
        { name: 'Carla Diaz', status: 'Active', role: 'Viewer' },
      ],
    };
  }
  Promise.resolve(grid.rendered).then(() => grid.setData?.(config));
});

// ── Input tag seed ────────────────────────────────────────────────────────
customElements.whenDefined('sherpa-input-tag').then(() => {
  const el = document.getElementById('input-tag-demo');
  ['design', 'tokens', 'a11y'].forEach((t) => el?.add?.(t));
});

// ── Quick filter toolbar (app header) ──────────────────────────────────────
customElements.whenDefined('sherpa-quick-filter-toolbar').then(() => {
  const columns = [
    { field: 'status', name: 'Status', type: 'string', values: ['Active', 'Inactive', 'Pending'] },
    { field: 'region', name: 'Region', type: 'string', values: ['EMEA', 'APAC', 'Americas'] },
    { field: 'owner', name: 'Owner', type: 'string', values: ['Me', 'Team', 'Unassigned'] },
  ];
  const rows = [
    { status: 'Active', region: 'EMEA', owner: 'Me' },
    { status: 'Pending', region: 'APAC', owner: 'Team' },
  ];
  const bar = document.querySelector('.app-filters');
  if (bar) {
    bar.setAttribute('data-preset-filters', 'status,region,owner');
    Promise.resolve(bar.rendered).then(() => bar.setAvailableColumns?.(columns, rows));
  }
});

// ── Toasts ──────────────────────────────────────────────────────────────────
const toastMessages = {
  info: { title: 'Information', value: 'This is an informational notification.' },
  success: { title: 'Saved', value: 'Your changes have been saved.' },
  warning: { title: 'Review needed', value: 'Some fields require attention.' },
  critical: { title: 'Error', value: 'Something went wrong. Try again.' },
};
['info', 'success', 'warning', 'critical'].forEach((s) => {
  document.getElementById(`toast-${s}`)?.addEventListener('button-click', () => {
    customElements.get('sherpa-toast')?.show?.({ status: s, ...toastMessages[s] });
  });
});

// ── Dialog ────────────────────────────────────────────────────────────────
document.getElementById('dialog-cancel')?.addEventListener('button-click', () => {
  document.getElementById('dialog-demo')?.removeAttribute('data-open');
});
document.addEventListener('dialog-cancel', (e) => e.target.removeAttribute?.('data-open'));
