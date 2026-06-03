#!/usr/bin/env node
/**
 * Adds explicit types to all untyped function params/privates in sherpa-barchart.ts
 * using the interfaces that already exist in the file (ChartColumn, BarSeries, BarData,
 * BarContentData, etc.). After running this, most @ts-expect-error directives become
 * TS2578 (unused) and can be bulk-removed by remove-ts2578.js.
 */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../components/sherpa-barchart/sherpa-barchart.ts');
let src = fs.readFileSync(file, 'utf8');

// ---------- function parameter signatures ----------
const paramFixes = [
  // setData
  [/async setData\(data\)\s*\{/, 'async setData(data: BarContentData | null): Promise<void> {'],
  // applyOrderByFromConfig
  [/#applyOrderByFromConfig\(data\)\s*\{/, '#applyOrderByFromConfig(data: BarData): BarData {'],
  // buildSeriesFromSegmentField
  [/#buildSeriesFromSegmentField\(field, categoryField, measureField\)/, '#buildSeriesFromSegmentField(field: string, categoryField: string | null, measureField: string | null)'],
  // formatLabel
  [/#formatLabel\(value\)\s*\{/, '#formatLabel(value: unknown): string {'],
  // resolveCategoryField
  [/#resolveCategoryField\(columns, segmentField\)/, '#resolveCategoryField(columns: ChartColumn[], segmentField: string | null): string | null'],
  // resolveMeasureField
  [/#resolveMeasureField\(columns, categoryField, segmentField\)/, '#resolveMeasureField(columns: ChartColumn[], categoryField: string | null, segmentField: string | null): string | null'],
  // onResize
  [/#onResize\(\{ contentRect: \{ width, height \} \}\)/, '#onResize({ contentRect: { width, height } }: ResizeObserverEntry)'],
  // applyLocalSort
  [/#applyLocalSort\(data\)\s*\{/, '#applyLocalSort(data: BarData): BarData {'],
  // capSeries
  [/#capSeries\(series\)\s*\{/, '#capSeries(series: BarSeries[]): BarSeries[] {'],
  // getCategoryTotal
  [/#getCategoryTotal\(series, index\)\s*\{/, '#getCategoryTotal(series: BarSeries[], index: number): number {'],
  // getMaxValue
  [/#getMaxValue\(series, isStacked\)\s*\{/, '#getMaxValue(series: BarSeries[], isStacked: boolean): number {'],
  // niceNumber
  [/#niceNumber\(value\)\s*\{/, '#niceNumber(value: number): number {'],
  // renderAxis
  [/#renderAxis\(el, niceMax\)\s*\{/, '#renderAxis(el: HTMLElement | null, niceMax: number): void {'],
  // calculateSegmentSizes
  [/#calculateSegmentSizes\(series, catIdx, niceMax, isStacked\)/, '#calculateSegmentSizes(series: BarSeries[], catIdx: number, niceMax: number, isStacked: boolean)'],
  // createSegmentNodes
  [/#createSegmentNodes\(series, catIdx, niceMax, isStacked\)/, '#createSegmentNodes(series: BarSeries[], catIdx: number, niceMax: number, isStacked: boolean)'],
  // resolveFieldAlias
  [/#resolveFieldAlias\(field\)\s*\{/, '#resolveFieldAlias(field: string | null | undefined): string | null {'],
  // setExternalFilters
  [/setExternalFilters\(externalFilters\)\s*\{/, 'setExternalFilters(externalFilters: Array<{ field: string; values: string[] }>): void {'],
  // applyExternalFilters
  [/#applyExternalFilters\(rows\)\s*\{/, '#applyExternalFilters(rows: GridRow[]): GridRow[] {'],
];

for (const [pattern, replacement] of paramFixes) {
  src = src.replace(pattern, replacement);
}

// ---------- local variable types ----------
// `const categories = []` → typed
src = src.replace(/(\s+)(const categories = \[\];)/, '$1const categories: string[] = [];');
// `const segments = []` → typed
src = src.replace(/(\s+)(const segments = \[\];)/, '$1const segments: Array<{ value: number; pct: number; seriesIdx: number; name: string }> = [];');
// `const nodes = []` (in #createSegmentNodes)
src = src.replace(/(const nodes = \[\];)/, 'const nodes: HTMLElement[] = [];');
// `const ensureCategory = (raw) =>` → typed
src = src.replace(/const ensureCategory = \(raw\) =>/, 'const ensureCategory = (raw: unknown): void =>');

// ---------- array/series callback params ----------
// `data.series.map((s) => ({` — s should be BarSeries
src = src.replace(/data\.series\.map\(\(s\) =>/g, 'data.series.map((s: BarSeries) =>');
// `series.map((s) => ({` — in kept/rest contexts
src = src.replace(/series\.map\(\(s\) =>/g, 'series.map((s: BarSeries) =>');
// `series.forEach((s, i) =>`
src = src.replace(/series\.forEach\(\(s, i\) =>/g, 'series.forEach((s: BarSeries, i: number) =>');
// `series.flatMap((s) =>`
src = src.replace(/series\.flatMap\(\(s\) =>/g, 'series.flatMap((s: BarSeries) =>');
// `indices.map((i) =>`
src = src.replace(/indices\.map\(\(i\) =>/g, 'indices.map((i: number) =>');
// `categories.map((catLabel) =>`
src = src.replace(/categories\.map\(\(catLabel\) =>/g, 'categories.map((catLabel: string) =>');
// `columns.some((col) =>` and `columns.find((col) =>` and `columns.filter((col) =>`
src = src.replace(/columns\.(some|find|filter)\(\(col\) =>/g, 'columns.$1((col: ChartColumn) =>');
// `numericCols.find((col) =>`
src = src.replace(/numericCols\.(find|filter)\(\(col\) =>/g, 'numericCols.$1((col: ChartColumn) =>');
// `kept[0].values.map`
src = src.replace(/kept\[0\]\.values\.map\(\(_, i\) =>/, 'kept[0]!.values.map((_: number, i: number) =>');
// `rest.reduce((s: any, r: any)` → remove the any casts
src = src.replace(/rest\.reduce\(\(s: any, r: any\) =>/, 'rest.reduce((s: number, r: BarSeries) =>');

// ---------- BarContentData.categories forEach callback ----------
src = src.replace(/this\.#contentData\.categories\.forEach\(\(cat\) =>/, 'this.#contentData!.categories!.forEach((cat: unknown) =>');
// guard for accessing #contentData when possibly null
src = src.replace(/Array\.isArray\(this\.#contentData\.categories\)/, 'Array.isArray(this.#contentData?.categories)');

// ---------- config property assignments (add fields to the query config type) ----------
// These happen in #buildQueryConfig - add a local cast
// config.segmentField = ... / config.seriesField = ... / config.originalOrderBy = ...
// The config is typed as BarQueryConfig (or similar) — we extend with a cast
src = src.replace(
  /(const config[^;]+;[\s\S]*?)config\.segmentField = /,
  (match, pre) => match.replace(
    /config\.segmentField = /,
    '(config as Record<string, unknown>).segmentField = '
  )
);
src = src.replace(/config\.seriesField = config\.segmentField;/, '(config as Record<string, unknown>).seriesField = (config as Record<string, unknown>).segmentField;');
src = src.replace(/config\.originalOrderBy = this\.#originalOrderBy;/, '(config as Record<string, unknown>).originalOrderBy = this.#originalOrderBy;');
src = src.replace(/config\.originalSegmentBy = this\.#originalSegmentBy;/, '(config as Record<string, unknown>).originalSegmentBy = this.#originalSegmentBy;');

// ---------- metadata access ----------
// `this.#contentData?.metadata?.orderBy` — BarContentData already has metadata typed
src = src.replace(/this\.#contentData\?\.metadata\?\.orderBy/, '(this.#contentData?.metadata as Record<string, unknown> | undefined)?.["orderBy"]');

// ---------- canvas firstElementChild clone ----------
// `this.#axisValueTpl.content.firstElementChild.cloneNode(true)`
src = src.replace(
  /this\.#axisValueTpl\.content\.firstElementChild\.cloneNode\(true\)/g,
  '(this.#axisValueTpl!.content.firstElementChild!.cloneNode(true) as HTMLElement)'
);

// ---------- `BarRow` alias for rows (data-grid import) ----------
// barchart uses GridRow in applyExternalFilters — add an alias at the top
if (!src.includes('type BarRow')) {
  src = src.replace(
    /^(import[^\n]+\n)+/m,
    (match) => match + '\ntype BarRow = Record<string, unknown>;\n'
  );
}

fs.writeFileSync(file, src);
console.log('barchart types applied');
