/**
 * realias-tokens.mjs — one-shot migration: rewrite reforged component CSS from the
 * hand-grown token names onto the consolidated Figma taxonomy (Style (Sherpa) + Core).
 *
 * Encodes the reviewed Token Realias Map. Colours → Style(Sherpa) semantic names;
 * geometry/type → Core; status → the [data-status] cascade (--_status-*, so these
 * old flat tokens map onto the private cascade var, NOT a global flat token).
 *
 * Also updates the hardcoded var() FALLBACKS to the Figma-resolved values where the
 * old fallback had drifted, so a component still renders correctly on a browser that
 * hasn't loaded tokens.css.
 *
 *   node scripts/realias-tokens.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

/**
 * old var name (without --) → new var name (without --).
 * Ordered longest-first at apply time so prefixes don't clobber (handled below).
 */
const RENAME = {
  // ── content (text ink) ─────────────────────────────────────────────
  'sherpa-content-default-heading': 'sherpa-content-title-base',
  'sherpa-content-default-body': 'sherpa-content-primary-base',
  'sherpa-content-default-secondary': 'sherpa-content-secondary-base',
  'sherpa-content-inactive-default': 'sherpa-content-inactive-base',
  'sherpa-content-default-on-color-body': 'sherpa-content-title-on-color',
  'sherpa-content-primary-default': 'sherpa-content-link-base', // decision: link
  'sherpa-content-brand-default': 'sherpa-content-active-base', // decision: #8500CC
  // ── surface (fill) ─────────────────────────────────────────────────
  'sherpa-surface-page-default': 'sherpa-app-primary',
  'sherpa-surface-container-default': 'sherpa-surface-primary-base',
  'sherpa-surface-container-inactive': 'sherpa-surface-primary-inactive',
  'sherpa-surface-control-primary-default': 'sherpa-surface-interactive-primary-base',
  'sherpa-surface-control-primary-hover': 'sherpa-surface-interactive-primary-hover',
  'sherpa-surface-control-primary-down': 'sherpa-surface-interactive-primary-down',
  'sherpa-surface-control-secondary-default': 'sherpa-surface-interactive-secondary-base',
  'sherpa-surface-control-secondary-hover': 'sherpa-surface-interactive-secondary-hover',
  'sherpa-surface-control-secondary-down': 'sherpa-surface-interactive-secondary-down',
  'sherpa-surface-control-tertiary-hover': 'sherpa-surface-interactive-tertiary-hover',
  'sherpa-surface-control-tertiary-down': 'sherpa-surface-interactive-tertiary-down',
  'sherpa-surface-control-inactive': 'sherpa-surface-interactive-inactive',
  // ── border ─────────────────────────────────────────────────────────
  'sherpa-border-container-default': 'sherpa-border-primary',
  'sherpa-border-control-primary-default': 'sherpa-border-interactive-primary',
  'sherpa-border-control-secondary-default': 'sherpa-border-interactive-secondary',
  'sherpa-border-control-inactive': 'sherpa-border-interactive-inactive',
  // ── geometry: space (scale shift md→base) ──────────────────────────
  'sherpa-space-3xs': 'sherpa-core-space-3xs',
  'sherpa-space-2xs': 'sherpa-core-space-2xs',
  'sherpa-space-xs': 'sherpa-core-space-xs',
  'sherpa-space-sm': 'sherpa-core-space-sm',
  'sherpa-space-md': 'sherpa-core-space-base',
  'sherpa-space-lg': 'sherpa-core-space-lg',
  'sherpa-space-xl': 'sherpa-core-space-xl',
  'sherpa-space-2xl': 'sherpa-core-space-2xl',
  'sherpa-space-none': 'sherpa-core-space-none',
  // ── geometry: size (1:1) ───────────────────────────────────────────
  'sherpa-size-xs': 'sherpa-core-size-xs',
  'sherpa-size-sm': 'sherpa-core-size-sm',
  'sherpa-size-md': 'sherpa-core-size-md',
  'sherpa-size-lg': 'sherpa-core-size-lg',
  'sherpa-size-xl': 'sherpa-core-size-xl',
  'sherpa-size-2xl': 'sherpa-core-size-2xl',
  'sherpa-size-3xl': 'sherpa-core-size-3xl',
  // ── geometry: radius + width ───────────────────────────────────────
  'sherpa-border-rounding-none': 'sherpa-core-border-rounding-none',
  'sherpa-border-rounding-sm': 'sherpa-core-border-rounding-sm',
  'sherpa-border-rounding-base': 'sherpa-core-border-rounding-base',
  'sherpa-border-rounding-lg': 'sherpa-core-border-rounding-lg',
  'sherpa-border-rounding-full': 'sherpa-core-border-rounding-full',
  'sherpa-border-width-hairline': 'sherpa-core-border-width-base',
  'sherpa-border-width-base': 'sherpa-core-border-width-base',
  'sherpa-border-width-thick': 'sherpa-core-border-width-lg',
  // ── type ───────────────────────────────────────────────────────────
  'sherpa-font-weight-regular': 'sherpa-core-fonts-weight-400',
  'sherpa-font-weight-medium': 'sherpa-core-fonts-weight-500',
  'sherpa-font-weight-semibold': 'sherpa-core-fonts-weight-600',
  'sherpa-font-weight-bold': 'sherpa-core-fonts-weight-700',
  'sherpa-font-size-body-xs': 'sherpa-core-fonts-scale-sm', // 12
  'sherpa-font-size-body-sm': 'sherpa-core-fonts-scale-base', // 14 (decision: base=14)
  'sherpa-font-size-body-base': 'sherpa-core-fonts-scale-lg', // 16
  'sherpa-font-size-heading-sm': 'sherpa-core-fonts-scale-xl', // 20
  'sherpa-font-size-heading-base': 'sherpa-core-fonts-scale-2xl', // 24
  // font-family stays as-is (Typography collection; keep hardcoded fallback) — not renamed.
  // NOTE: status flat tokens (sherpa-content-{critical,warning,success,info}-default,
  // sherpa-border-critical-default) are DELIBERATELY excluded from this automated
  // rename. Per the reviewed decision they consume the [data-status] cascade
  // (--_status-*), but those components carry bespoke default/re-pin logic that a
  // blanket substitution would corrupt — they're migrated by hand in a follow-up pass.
};

/** Fallback value corrections keyed by NEW var name (Figma-resolved light value). */
const FALLBACK = {
  'sherpa-content-title-base': '#18191a',
  'sherpa-content-primary-base': '#2e2e33',
  'sherpa-content-secondary-base': '#404047',
  'sherpa-content-tertiary-base': '#5c5c66',
  'sherpa-content-inactive-base': '#5c5c66',
  'sherpa-content-title-on-color': '#ffffff',
  'sherpa-content-link-base': '#3c5edd',
  'sherpa-content-active-base': '#8500cc',
  'sherpa-app-primary': '#ffffff',
  'sherpa-surface-primary-base': '#ffffff',
  'sherpa-surface-primary-inactive': '#f2f2f2',
  'sherpa-surface-interactive-primary-base': '#3c5edd',
  'sherpa-surface-interactive-primary-hover': '#173382',
  'sherpa-surface-interactive-primary-down': '#0f0f57',
  'sherpa-surface-interactive-secondary-base': '#ffffff',
  'sherpa-surface-interactive-secondary-hover': '#fafafa',
  'sherpa-surface-interactive-secondary-down': '#f2f2f2',
  'sherpa-surface-interactive-inactive': '#d5d5d5',
  'sherpa-border-primary': '#d5d5d5',
  'sherpa-border-interactive-primary': '#3c5edd',
  'sherpa-border-interactive-secondary': '#d5d5d5',
  'sherpa-core-space-3xs': '2px',
  'sherpa-core-space-2xs': '4px',
  'sherpa-core-space-xs': '8px',
  'sherpa-core-space-sm': '12px',
  'sherpa-core-space-base': '16px',
  'sherpa-core-space-lg': '20px',
  'sherpa-core-space-xl': '24px',
  'sherpa-core-space-2xl': '32px',
  'sherpa-core-size-xs': '12px',
  'sherpa-core-size-sm': '16px',
  'sherpa-core-size-md': '20px',
  'sherpa-core-size-lg': '24px',
  'sherpa-core-size-xl': '28px',
  'sherpa-core-size-2xl': '32px',
  'sherpa-core-size-3xl': '40px',
  'sherpa-core-border-rounding-sm': '2px',
  'sherpa-core-border-rounding-base': '4px',
  'sherpa-core-border-rounding-lg': '8px',
  'sherpa-core-border-rounding-full': '999px',
  'sherpa-core-border-width-base': '1px',
  'sherpa-core-border-width-lg': '2px',
  'sherpa-core-fonts-weight-400': '400',
  'sherpa-core-fonts-weight-500': '500',
  'sherpa-core-fonts-weight-600': '600',
  'sherpa-core-fonts-weight-700': '700',
  'sherpa-core-fonts-scale-sm': '12px',
  'sherpa-core-fonts-scale-base': '14px',
  'sherpa-core-fonts-scale-lg': '16px',
  'sherpa-core-fonts-scale-xl': '20px',
  'sherpa-core-fonts-scale-2xl': '24px',
};

const cssFiles = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.css')) cssFiles.push(p);
  }
})(join(ROOT, 'src'));

// Apply longest keys first so "sherpa-space-2xs" isn't hit by "sherpa-space-2xl" etc.
const keys = Object.keys(RENAME).sort((a, b) => b.length - a.length);
let filesChanged = 0;
let subs = 0;

for (const file of cssFiles) {
  let css = readFileSync(file, 'utf8');
  const before = css;
  for (const oldName of keys) {
    const newName = RENAME[oldName];
    // Match `var(--old, fallback)` and `var(--old)`; rewrite name + (if known) fallback.
    const re = new RegExp(`var\\(\\s*--${oldName}\\s*(?:,\\s*([^)]*))?\\)`, 'g');
    css = css.replace(re, (_m, fb) => {
      subs++;
      const fixedFb = FALLBACK[newName] ?? (fb != null ? fb.trim() : null);
      return fixedFb != null ? `var(--${newName}, ${fixedFb})` : `var(--${newName})`;
    });
  }
  if (css !== before) {
    filesChanged++;
    if (!DRY) writeFileSync(file, css);
  }
}

console.log(
  `${DRY ? '[dry] ' : ''}realias: ${subs} substitutions across ${filesChanged} files (of ${cssFiles.length} css)`,
);
