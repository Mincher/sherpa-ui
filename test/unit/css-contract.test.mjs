/**
 * Unit tests for scripts/lib/css-contract.js — the CSS-primary contract extractor.
 * Pure Node (the module takes a CSS string, returns a plain object), so it runs
 * under `node --test` with no browser harness.
 *
 *   node --test test/unit/css-contract.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCssContract } from '../../scripts/lib/css-contract.js';

test('data-* enum values are parsed from :host([data-*="…"]) selectors', () => {
  const css = `
    :host([data-variant="secondary"]) { color: red; }
    :host([data-variant="tertiary"])  { color: blue; }
    :host([data-variant="ai"])        { color: purple; }
  `;
  const c = extractCssContract(css, 'x');
  const variant = c.attributes.find((a) => a.name === 'data-variant');
  assert.ok(variant, 'data-variant present');
  assert.deepEqual(variant.values, ['ai', 'secondary', 'tertiary']);
});

test('a bare presence attr (no ="value") is boolean; a content hook is instance', () => {
  const css = `
    :host([data-active]) { font-weight: 700; }
    :host([data-icon-start]) .icon { display: inline-flex; }
  `;
  const c = extractCssContract(css, 'x');
  const active = c.attributes.find((a) => a.name === 'data-active');
  const icon = c.attributes.find((a) => a.name === 'data-icon-start');
  assert.equal(active.values.length, 0);
  assert.equal(active.figma, 'boolean');
  assert.equal(icon.figma, 'instance'); // content presence-hook, not an axis
});

test('data-status infers mode:Status, never variant', () => {
  const css = `:host([data-status="warning"]) .badge { background: gold; }`;
  const c = extractCssContract(css, 'x');
  const status = c.attributes.find((a) => a.name === 'data-status');
  assert.equal(status.figma, 'mode:Status');
});

test('an authored /* @figma:… */ comment overrides inference and marks source=css', () => {
  const css = `
    /* @figma:mode:Data Viz Sets */
    :host([data-color-index="1"]) { color: var(--sherpa-data-viz-categorical-color-1); }
    :host([data-color-index="2"]) { color: var(--sherpa-data-viz-categorical-color-2); }
  `;
  const c = extractCssContract(css, 'x');
  const idx = c.attributes.find((a) => a.name === 'data-color-index');
  assert.deepEqual(idx.values, ['1', '2']);
  assert.equal(idx.figma, 'mode:Data Viz Sets');
  assert.equal(idx.figmaSource, 'css'); // authored in CSS, not inferred
});

test('custom-property surfaces: declarations classified; var() uses indexed', () => {
  const css = `
    :host {
      --_surface: var(--sherpa-surface-control-primary-default, #fff);
      --_text: var(--sherpa-content-default-heading, #111);
    }
    :host([data-status]) {
      background: var(--_status-surface-strong);
      color: var(--_status-text-on-color);
    }
    .grouped { border-width: var(--_cg-border-width); }
  `;
  const c = extractCssContract(css, 'x');
  // declarations
  assert.deepEqual(c.customProps.declares.private.sort(), ['--_surface', '--_text']);
  // uses, classified by surface
  assert.ok(c.customProps.uses.token.includes('--sherpa-surface-control-primary-default'));
  assert.ok(c.customProps.uses['cross-status'].includes('--_status-surface-strong'));
  assert.ok(c.customProps.uses['cross-group'].includes('--_cg-border-width'));
});

test('interaction pseudo-classes are detected even without custom-prop declarations', () => {
  // parseCSS drops blocks with no custom-prop decls; the raw pass must still see these.
  const css = `
    :host(:hover) .trigger { opacity: .9; }
    :host(:focus-visible) { outline: 2px solid blue; }
    :host(:not([disabled])):active { transform: scale(.98); }
    input:user-invalid { border-color: red; }
  `;
  const c = extractCssContract(css, 'x');
  for (const tok of [':hover', ':focus-visible', ':active', ':not', ':user-invalid']) {
    assert.ok(c.interaction.includes(tok), `interaction includes ${tok}`);
  }
});

test('real component: sherpa-tag exposes all 10 data-color values (CSS-only enum)', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = fileURLToPath(new URL('../../components/sherpa-tag/sherpa-tag.css', import.meta.url));
  const css = readFileSync(path, 'utf8');
  const c = extractCssContract(css, 'sherpa-tag');
  const color = c.attributes.find((a) => a.name === 'data-color');
  assert.ok(color, 'data-color present');
  assert.equal(color.values.length, 10, 'all 10 colors captured from CSS');
});
