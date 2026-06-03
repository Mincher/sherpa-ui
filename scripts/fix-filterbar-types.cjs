#!/usr/bin/env node
/**
 * Adds explicit types to sherpa-filter-bar.ts.
 * FieldDef and MenuButtonLike interfaces already exist.
 */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../components/sherpa-filter-bar/sherpa-filter-bar.ts');
let src = fs.readFileSync(file, 'utf8');

// ---------- onAttributeChanged override ----------
src = src.replace(
  /override onAttributeChanged\(name: string, _old\b[^)]*\)/,
  'override onAttributeChanged(name: string, _old: string | null, newValue: string | null): void'
);

// ---------- function params ----------
const paramFixes = [
  [/#getChipMenuButton\(chip\)\s*\{/, '#getChipMenuButton(chip: HTMLElement): HTMLElement | null {'],
  [/#createFilterChipGroup\(\{ filterField, filterType, label, slot, dismissable = false \}\)/,
   '#createFilterChipGroup({ filterField, filterType, label, slot, dismissable = false }: { filterField: string; filterType: string; label: string; slot?: string; dismissable?: boolean })'],
  [/#initPresetChips\(fields\)\s*\{/, '#initPresetChips(fields: string): void {'],
  [/setAvailableColumns\(columns, rows\)\s*\{/, 'setAvailableColumns(columns: FieldDef[], rows: Record<string, unknown>[]): void {'],
  [/removeFilterChip\(field\)\s*\{/, 'removeFilterChip(field: string): void {'],
  [/#dispatchContainerFilterChange\(filters\)\s*\{/, '#dispatchContainerFilterChange(filters: unknown[]): void {'],
  [/#dispatchGlobalFilterChange\(filters\)\s*\{/, '#dispatchGlobalFilterChange(filters: unknown[]): void {'],
  [/#extractUniqueValues\(field, rows\)\s*\{/, '#extractUniqueValues(field: string, rows: Record<string, unknown>[]): string[] {'],
  [/#getValuesForField\(field\)\s*\{/, '#getValuesForField(field: string): string[] {'],
  [/#getFilteredRowsExcluding\(excludeField\)\s*\{/, '#getFilteredRowsExcluding(excludeField: string): Record<string, unknown>[] {'],
  [/#countValuesIn\(field, scopeRows\)\s*\{/, '#countValuesIn(field: string, scopeRows: Record<string, unknown>[]): Map<string, number> {'],
  [/#populateFilterChip\(chip\)\s*\{/, '#populateFilterChip(chip: HTMLElement): void {'],
  [/#syncFilterChipLabel\(chip, count\)\s*\{/, '#syncFilterChipLabel(chip: HTMLElement, count: number): void {'],
  [/#populateColumnsMenu\(chip\)\s*\{/, '#populateColumnsMenu(chip: HTMLElement): void {'],
  [/#inferFilterType\(columnType\)\s*\{/, '#inferFilterType(columnType: string | undefined | null): string {'],
  [/#resolveOperator\(chip\)\s*\{/, '#resolveOperator(chip: HTMLElement): string {'],
  [/#computeTimeRange\(rangeKey\)\s*\{/, '#computeTimeRange(rangeKey: string): { start?: string; end?: string } | null {'],
  [/#cycleSortMode\(chip\)\s*\{/, '#cycleSortMode(chip: HTMLElement): void {'],
  [/#cycleSegmentMode\(chip\)\s*\{/, '#cycleSegmentMode(chip: HTMLElement): void {'],
  [/#populateTimeframeMenu\(chip\)\s*\{/, '#populateTimeframeMenu(chip: HTMLElement): void {'],
];

for (const [pattern, replacement] of paramFixes) {
  src = src.replace(pattern, replacement);
}

// ---------- composedPath() event target casts ----------
// `e.composedPath()` returns EventTarget[] — cast elements to HTMLElement
// Pattern: `const path = e.composedPath();` + subsequent `.find()` on path
// Most uses: `path.find(n => ...)` or `e.target`

// The click handler uses composedPath — add cast in the find()
src = src.replace(
  /e\.composedPath\(\)\.find\(([\s\S]*?)\)/g,
  (match, predicate) => `e.composedPath().find(${predicate}) as HTMLElement | undefined`
);

// `e.target` casts
src = src.replace(/\bconst sw = e\.target;/g, 'const sw = e.target as HTMLElement | null;');
src = src.replace(/\bsw\?\.tagName === "SHERPA-SWITCH" && sw\.slot/g, 'sw?.tagName === "SHERPA-SWITCH" && (sw as HTMLElement).slot');
src = src.replace(/\bthis\.#applied = sw\.dataset\["state"\]/g, 'this.#applied = (sw as HTMLElement).dataset["state"]');

// btn/chip from composedPath — they're returned as EventTarget
// Pattern: `const btn = path.find(...)` — already cast above
// Pattern: `btn?.dataset?.action`
src = src.replace(/\bbtn\?\.dataset\?\.action/g, '(btn as HTMLElement | undefined)?.dataset?.["action"]');
src = src.replace(/\bcontainer\.remove\(\)/g, '(container as HTMLElement).remove()');
src = src.replace(/\bchip\?\.hasAttribute\?\./g, '(chip as HTMLElement | undefined)?.hasAttribute.');
src = src.replace(/\bchip\?\.closest\?\./g, '(chip as HTMLElement | undefined)?.closest.');
src = src.replace(/\bchip\?\.closest\(/g, '(chip as HTMLElement | undefined)?.closest(');
src = src.replace(/\bchip\.getAttribute\(/g, '(chip as HTMLElement).getAttribute(');
src = src.replace(/\bchip\.toggleAttribute\(/g, '(chip as HTMLElement).toggleAttribute(');

// `const behavior = chip.getAttribute("data-behavior")` — chip is EventTarget
src = src.replace(/\bconst behavior = chip\.getAttribute\("data-behavior"\)/g,
  'const behavior = (chip as HTMLElement | undefined)?.getAttribute("data-behavior")');
src = src.replace(/\bconst filterChip = chip\?\.hasAttribute\?\./g,
  'const filterChip = (chip as HTMLElement | undefined)?.hasAttribute.');

// `const labelBtn = (chip.closest?....)...`
// Already handled by chip cast above

// ---------- chip.dataset accesses in loop contexts ----------
src = src.replace(/\bchip\.dataset\["label"\]/g, '(chip as HTMLElement).dataset["label"]');
src = src.replace(/\bchip\.dataset\["defaultLabel"\]/g, '(chip as HTMLElement).dataset["defaultLabel"]');
src = src.replace(/\bchip\.dataset\["count"\]/g, '(chip as HTMLElement).dataset["count"]');
src = src.replace(/\bdelete chip\.dataset\["count"\]/g, 'delete (chip as HTMLElement).dataset["count"]');
src = src.replace(/\bchip\.dataset\["sortType"\]/g, '(chip as HTMLElement).dataset["sortType"]');
src = src.replace(/\bdelete (?:sortBtn|chip)\.dataset\["sortType"\]/g, (m) => m.replace(/^delete (\w+)/, (_, name) => `delete (${name} as HTMLElement)`));

// `sortBtn.dataset["sortType"]`
src = src.replace(/\bsortBtn\.dataset\["sortType"\]/g, '(sortBtn as HTMLElement).dataset["sortType"]');
src = src.replace(/\bdelete sortBtn\.dataset\["sortType"\]/g, 'delete (sortBtn as HTMLElement).dataset["sortType"]');

// ---------- setMenuItems on MenuButtonLike ----------
// `this.#addButton.setMenuItems(...)` — #addButton is MenuButtonLike
src = src.replace(/this\.#addButton\.setMenuItems\(/g, 'this.#addButton?.setMenuItems(');

// ---------- field map callback types ----------
src = src.replace(/\.map\(\(f\) => f\.trim\(\)\)/g, '.map((f: string) => f.trim())');
src = src.replace(/\.filter\(Boolean\)/g, '.filter((x): x is string => Boolean(x))');

// ---------- { container, chip } destructure from createFilterChipGroup ----------
src = src.replace(
  /const \{ container, chip \} = this\.#createFilterChipGroup\(/g,
  'const { container, chip } = this.#createFilterChipGroup('
);

fs.writeFileSync(file, src);
console.log('filter-bar types applied');
