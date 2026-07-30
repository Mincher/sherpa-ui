import { test, expect } from '@playwright/test';
import { openHarness } from './support';

/**
 * Token mode-axis guards.
 *
 * Figma variable collections use MODES to swap the assigned value — analogous
 * to CSS classes. Each mode axis maps to a CSS mechanism:
 *   Apex 2.0 (Light/Dark)          → [data-mode]
 *   Density (Base/Compact/Comfort) → [data-density]
 *   Status (critical/warning/…)    → [data-status] → --_status-* private props
 *
 * These tests assert the swap actually happens on :root, so a regression in the
 * token generator (e.g. the density collection extracting as null, or a name
 * mismatch between space/default and space/base) can't silently return.
 */

/** Read CSS custom properties off :root after setting mode attributes. */
async function readRootVars(
  page: import('@playwright/test').Page,
  vars: string[],
  attrs: Record<string, string> = {},
): Promise<Record<string, string>> {
  return page.evaluate(
    ({ vars, attrs }) => {
      const root = document.documentElement;
      const managed = ['data-theme', 'data-mode', 'data-density', 'data-status'];
      const saved: Record<string, string | null> = {};
      for (const k of managed) saved[k] = root.getAttribute(k);
      for (const k of managed) root.removeAttribute(k);
      for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v);
      const cs = getComputedStyle(root);
      const out: Record<string, string> = {};
      for (const v of vars) out[v] = cs.getPropertyValue(v).trim();
      // Restore the harness defaults.
      for (const k of managed) if (saved[k] != null) root.setAttribute(k, saved[k] as string);
      return out;
    },
    { vars, attrs },
  );
}

test.describe('token mode axes', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test('Density axis rescales spacing tokens (base / compact / comfortable)', async ({ page }) => {
    const base = await readRootVars(page, ['--sherpa-space-base', '--sherpa-space-default', '--sherpa-space-xs']);
    const compact = await readRootVars(
      page,
      ['--sherpa-space-base', '--sherpa-space-default', '--sherpa-space-xs'],
      { 'data-density': 'compact' },
    );
    const comfortable = await readRootVars(
      page,
      ['--sherpa-space-base', '--sherpa-space-default', '--sherpa-space-xs'],
      { 'data-density': 'comfortable' },
    );

    // Base density (Figma Density → Base mode): space/base = scale/200 = 16px.
    expect(base['--sherpa-space-base']).toBe('16px');
    // space/base and space/default are synonyms — must always track together.
    expect(base['--sherpa-space-default']).toBe(base['--sherpa-space-base']);

    // Compact shrinks, comfortable grows — the swap actually happens.
    expect(compact['--sherpa-space-base']).toBe('12px');
    expect(comfortable['--sherpa-space-base']).toBe('20px');
    expect(compact['--sherpa-space-default']).toBe(compact['--sherpa-space-base']);
    expect(comfortable['--sherpa-space-default']).toBe(comfortable['--sherpa-space-base']);

    // Sanity: xs also rescales.
    expect(compact['--sherpa-space-xs']).not.toBe(base['--sherpa-space-xs']);
    expect(comfortable['--sherpa-space-xs']).not.toBe(base['--sherpa-space-xs']);
  });

  test('Status axis swaps --_status-* private props per mode', async ({ page }) => {
    const none = await readRootVars(page, ['--_status-surface-strong']);
    const critical = await readRootVars(page, ['--_status-surface-strong'], { 'data-status': 'critical' });
    const warning = await readRootVars(page, ['--_status-surface-strong'], { 'data-status': 'warning' });
    const success = await readRootVars(page, ['--_status-surface-strong'], { 'data-status': 'success' });

    // No status attribute → private prop is unset (components use their fallback).
    expect(none['--_status-surface-strong']).toBe('');
    // Each status mode assigns a distinct colour.
    expect(critical['--_status-surface-strong']).not.toBe('');
    expect(warning['--_status-surface-strong']).not.toBe('');
    expect(success['--_status-surface-strong']).not.toBe('');
    expect(critical['--_status-surface-strong']).not.toBe(warning['--_status-surface-strong']);
    expect(warning['--_status-surface-strong']).not.toBe(success['--_status-surface-strong']);
  });

  test('Theme/mode axis swaps the app background (light / dark)', async ({ page }) => {
    const light = await readRootVars(page, ['--sherpa-surface-app-background-default']);
    const dark = await readRootVars(page, ['--sherpa-surface-app-background-default'], { 'data-mode': 'dark' });
    expect(light['--sherpa-surface-app-background-default']).not.toBe('');
    expect(dark['--sherpa-surface-app-background-default']).not.toBe(
      light['--sherpa-surface-app-background-default'],
    );
  });

  test('Accent (blue) and Brand (purple) are distinct ramps', async ({ page }) => {
    // Figma: color/accent/base -> neon-blue/550 (#3c5edd) drives primary actions;
    // color/brand/base -> phlox/500 (#c046ff) drives AI / quick-filter accents.
    // Regression guard: accent must NOT collapse onto brand (was aliased purple).
    const v = await page.evaluate(() => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const accent = cs.getPropertyValue('--sherpa-color-accent-base').trim();
      const brand = cs.getPropertyValue('--sherpa-color-brand-base').trim();
      const primary = cs.getPropertyValue('--sherpa-surface-control-primary-default').trim();
      el.remove();
      return { accent, brand, primary };
    });
    expect(v.accent).not.toBe('');
    expect(v.brand).not.toBe('');
    // Accent is blue, brand is purple — they must differ.
    expect(v.accent).not.toBe(v.brand);
    // Primary control surface resolves through accent (blue), not brand.
    expect(v.primary).toBe(v.accent);
  });
});
