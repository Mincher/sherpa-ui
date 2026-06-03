#!/usr/bin/env node
/**
 * Adds explicit types to all untyped params in sherpa-data-grid.ts.
 * Interfaces GridRow, GridColumn, ValueFilter, GridData, ColumnConfigEntry already exist.
 */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../components/sherpa-data-grid/sherpa-data-grid.ts');
let src = fs.readFileSync(file, 'utf8');

// ---------- function params ----------
const paramFixes = [
  [/^function columnWidth\(type\)/m, 'function columnWidth(type: string | undefined | null): string'],
  [/setColumnConfig\(config\)\s*\{/, 'setColumnConfig(config: Record<string, ColumnConfigEntry>): void {'],
  [/async setData\(config\)\s*\{/, 'async setData(config: GridData | null): Promise<void> {'],
  [/#initHeaders\(columns\)\s*\{/, '#initHeaders(columns: GridColumn[]): void {'],
  [/#renderFlatRows\(rows, columns\)\s*\{/, '#renderFlatRows(rows: GridRow[], columns: GridColumn[]): void {'],
  [/#renderGrouped\(rows, columns, groupField\)\s*\{/, '#renderGrouped(rows: GridRow[], columns: GridColumn[], groupField: string): void {'],
  [/#groupRows\(rows, groupField\)\s*\{/, '#groupRows(rows: GridRow[], groupField: string): Map<string, GridRow[]> {'],
  [/#onColumnSort\(field\)\s*\{/, '#onColumnSort(field: string): void {'],
  [/#sortRows\(rows, field, direction\)\s*\{/, '#sortRows(rows: GridRow[], field: string, direction: string): GridRow[] {'],
  [/#applyGlobalSearch\(rows\)\s*\{/, '#applyGlobalSearch(rows: GridRow[]): GridRow[] {'],
  [/#applyColumnFilters\(rows\)\s*\{/, '#applyColumnFilters(rows: GridRow[]): GridRow[] {'],
  [/#applyValueFilters\(rows\)\s*\{/, '#applyValueFilters(rows: GridRow[]): GridRow[] {'],
  [/#applyExternalFilters\(rows\)\s*\{/, '#applyExternalFilters(rows: GridRow[]): GridRow[] {'],
  [/#onSelectAll\(checked\)\s*\{/, '#onSelectAll(checked: boolean): void {'],
  [/#onRowSelect\(rowId, checked, event\)\s*\{/, '#onRowSelect(rowId: string, checked: boolean, event: MouseEvent | null): void {'],
  [/#paginate\(rows\)\s*\{/, '#paginate(rows: GridRow[]): GridRow[] {'],
  [/#renderPagination\(totalFiltered\)\s*\{/, '#renderPagination(totalFiltered: number): void {'],
  [/setActionMenuItems\(sections\)\s*\{/, 'setActionMenuItems(sections: unknown[]): void {'],
  [/async onJsonData\(data: any\)\s*\{/, 'override async onJsonData(data: unknown): Promise<void> {'],
  [/onJsonError\(_url, _e\)\s*\{/, 'override onJsonError(_url: string, _e: Error): void {'],
  [/setExternalFilters\(externalFilters\)\s*\{/, 'setExternalFilters(externalFilters: ValueFilter[]): void {'],
];

for (const [pattern, replacement] of paramFixes) {
  src = src.replace(pattern, replacement);
}

// ---------- override onAttributeChanged (remove untyped params suppression) ----------
src = src.replace(
  /override onAttributeChanged\(name: string, _old\b([^)]*)\)/,
  'override onAttributeChanged(name: string, _old: string | null, newValue: string | null): void'
);

// ---------- dot access to row._rowId → bracket access ----------
// GridRow = Record<string, unknown> — noPropertyAccessFromIndexSignature requires brackets
src = src.replace(/\brow\._rowId\b/g, 'row["_rowId"]');
src = src.replace(/\br\._rowId\b/g, 'r["_rowId"]');
src = src.replace(/this\.#allRows\[i\]\._rowId/g, 'this.#allRows[i]!["_rowId"]');
src = src.replace(/\(r\) => r\._rowId/g, '(r: GridRow) => r["_rowId"]');
src = src.replace(/this\.#allRows\.filter\(\(row\) => this\.#selectedRows\.has\(row\._rowId\)\)/,
  'this.#allRows.filter((row: GridRow) => this.#selectedRows.has(row["_rowId"] as string))');

// ---------- config.segmentField / config.originalOrderBy / config.seriesField ----------
src = src.replace(/config\.segmentField = /g, '(config as Record<string, unknown>).segmentField = ');
src = src.replace(/config\.seriesField = /g, '(config as Record<string, unknown>).seriesField = ');
src = src.replace(/config\.originalOrderBy = this\.#originalOrderBy;/g, '(config as Record<string, unknown>).originalOrderBy = this.#originalOrderBy;');
src = src.replace(/config\.originalSegmentBy = this\.#originalSegmentBy;/g, '(config as Record<string, unknown>).originalSegmentBy = this.#originalSegmentBy;');

// ---------- element property accesses ----------
// `check.checked = checked` → HTMLInputElement cast
src = src.replace(/(check\.checked = (?:checked|true|false))/g, '(check as HTMLInputElement).checked = $1'.replace('$1', '').trim() + '');

// More targeted fix for check.checked
src = src.replace(/\bcheck\.checked = checked;/g, '(check as HTMLInputElement).checked = checked;');
src = src.replace(/\bcheck\.checked = true;/g, '(check as HTMLInputElement).checked = true;');
src = src.replace(/\bcheck\.checked = false;/g, '(check as HTMLInputElement).checked = false;');
src = src.replace(/\bgroupCheck\.checked = (?:allChecked|checked|true|false);/g, (m) => '(groupCheck as HTMLInputElement).' + m.substring(m.indexOf('.') + 1));
src = src.replace(/\bgroupCheck\.indeterminate = (?:indeterminate|false|true);/g, (m) => '(groupCheck as HTMLInputElement).' + m.substring(m.indexOf('.') + 1));
src = src.replace(/\bselectAll\.checked = /g, '(selectAll as HTMLInputElement).checked = ');
src = src.replace(/\bselectAll\.indeterminate = /g, '(selectAll as HTMLInputElement).indeterminate = ');

// ---------- custom method calls on Element ----------
// `bar?.setAvailableColumns?.(...)` — bar is from this.$() → HTMLElement | null
src = src.replace(
  /bar\?\.setAvailableColumns\?\.\(/,
  '(bar as unknown as { setAvailableColumns?(cols: GridColumn[], rows: GridRow[]): void })?.setAvailableColumns?.('
);
// `pagination.setTotalRows(...)`
src = src.replace(
  /pagination\.setTotalRows\(/,
  '(pagination as unknown as { setTotalRows(n: number): void }).setTotalRows('
);
// `btn.setMenuItems(...)`
src = src.replace(/\bbtn\.setMenuItems\(/g, '(btn as unknown as { setMenuItems(s: unknown[]): void }).setMenuItems(');
// `emptyEl.heading = message`
src = src.replace(/\bemptyEl\.heading = message;/, '(emptyEl as HTMLElement & { heading: string }).heading = message;');
// `this._syncFilterBarState?.()`
src = src.replace(/this\._syncFilterBarState\?\.\(\)/, '(this as unknown as { _syncFilterBarState?(): void })._syncFilterBarState?.()');

// ---------- rowEl dataset access ----------
src = src.replace(/\browEl\?\.dataset\["rowId"\]/g, '(rowEl as HTMLElement | null)?.dataset["rowId"]');
src = src.replace(/\browEl\.setAttribute\("data-selected"/g, '(rowEl as HTMLElement).setAttribute("data-selected"');
src = src.replace(/\browEl\.removeAttribute\("data-selected"\)/g, '(rowEl as HTMLElement).removeAttribute("data-selected")');

// ---------- el.dataset["rowId"] on HTMLElement[] items ----------
src = src.replace(/\bel\.dataset\["rowId"\]/g, '(el as HTMLElement).dataset["rowId"]');
src = src.replace(/\bel\.setAttribute\("data-selected"/g, '(el as HTMLElement).setAttribute("data-selected"');
src = src.replace(
  /const check = el\.querySelector\("\.row-check"\);/g,
  'const check = (el as HTMLElement).querySelector<HTMLInputElement>(".row-check");'
);
src = src.replace(/\bif \(check\) check\.checked = true;/g, 'if (check) check.checked = true;');

// ---------- groupValue dataset ----------
src = src.replace(/\bparentRow\.dataset\["groupValue"\]/g, '(parentRow as HTMLElement).dataset["groupValue"]');

// ---------- column filter field access ----------
src = src.replace(/const field = cell\.dataset\["field"\]/g, 'const field = (cell as HTMLElement).dataset["field"]');

// ---------- column-level search element custom method ----------
src = src.replace(
  /const inputEl = searchEl\.getInputElement\?\.\(\);/g,
  'const inputEl = (searchEl as unknown as { getInputElement?(): HTMLInputElement | null }).getInputElement?.();'
);
src = src.replace(
  /const el = globalSearch\.getInputElement\?\.\(\);/g,
  'const el = (globalSearch as unknown as { getInputElement?(): HTMLInputElement | null }).getInputElement?.();'
);

// ---------- filter callback param types ----------
src = src.replace(/\(f\) => Array\.isArray\(f\.values\)/g, '(f: ValueFilter) => Array.isArray(f.values)');
src = src.replace(/rows\.filter\(\(row\) =>\s*\n\s*this\.#columns\.some\(\(col\) =>/g,
  'rows.filter((row: GridRow) =>\n      this.#columns.some((col: GridColumn) =>');
src = src.replace(/\.filter\(\(row\) =>\s*\n?\s*filters\.every\(\(\[field, term\]\)/,
  '.filter((row: GridRow) =>\n      filters.every(([field, term])');
src = src.replace(/\.filter\(\(row\) =>\s*\n?\s*this\.#valueFilters\.every\(\(\{ field, values \}\)/,
  '.filter((row: GridRow) =>\n      this.#valueFilters.every(({ field, values })');
src = src.replace(/\.filter\(\(row\) =>\s*\n?\s*this\.#externalFilters\.every\(\(\{ field, values \}\)/,
  '.filter((row: GridRow) =>\n      this.#externalFilters.every(({ field, values })');

// ---------- private getters ----------
src = src.replace(/get #page\(\)\s*\{/, 'get #page(): number {');
src = src.replace(/get #pageSize\(\)\s*\{/, 'get #pageSize(): number {');
src = src.replace(/get #totalPages\(\)\s*\{/, 'get #totalPages(): number {');

// ---------- parseInt without fallback string ----------
src = src.replace(/parseInt\(this\.getAttribute\("data-page"\), 10\)/, 'parseInt(this.getAttribute("data-page") || "", 10)');
src = src.replace(/parseInt\(this\.getAttribute\("data-page-size"\), 10\)/, 'parseInt(this.getAttribute("data-page-size") || "", 10)');
src = src.replace(/parseInt\(sec\.dataset\["maxItems"\], 10\)/, 'parseInt(sec?.dataset["maxItems"] || "", 10)');

// ---------- error catch variable type ----------
src = src.replace(/\} catch \(e: Event\) \{/, '} catch (e) {');

// ---------- detail access in event handlers ----------
src = src.replace(/const detail = e\?\.detail \|\| \{\};/, 'const detail = (e as CustomEvent)?.detail || {};');
src = src.replace(/\bconst rowAction = e\.detail\?\.data;/, 'const rowAction = (e as CustomEvent)?.detail?.data;');

// ---------- data: { action: ... } in menu select dispatch ----------
src = src.replace(/data: \{ action: "set-density", densityValue: d\.value \}/,
  'data: { action: "set-density", densityValue: (d as HTMLElement).dataset["value"] }');
src = src.replace(/data: \{ action: "toggle-column", field: col\.field \}/,
  'data: { action: "toggle-column", field: (col as GridColumn).field }');

// ---------- pagination custom methods ----------
src = src.replace(/\bpagination\?\.addEventListener\("page-change"/g,
  '(pagination as HTMLElement | null)?.addEventListener("page-change"');

// ---------- overflowBtn / colSelectBtn / actionsBtn custom event ----------
const customBtnFix = (name) => {
  src = src.replace(
    new RegExp(`${name}\\.addEventListener\\("menu-select"`, 'g'),
    `(${name} as HTMLElement).addEventListener("menu-select"`
  );
};
customBtnFix('overflowBtn');
customBtnFix('colSelectBtn');
customBtnFix('actionsBtn');

// globalSearch .addEventListener
src = src.replace(
  /globalSearch\.addEventListener\("input"/g,
  '(globalSearch as HTMLElement).addEventListener("input"'
);
src = src.replace(
  /globalSearch\.addEventListener\("search"/g,
  '(globalSearch as HTMLElement).addEventListener("search"'
);

// selectAll.addEventListener
src = src.replace(
  /selectAll\.addEventListener\("change"/g,
  '(selectAll as HTMLInputElement).addEventListener("change"'
);
// e.target.checked in selectAll handler
src = src.replace(/this\.#onSelectAll\(e\.target\.checked\)/, 'this.#onSelectAll((e.target as HTMLInputElement).checked)');

// searchEl custom method
src = src.replace(
  /searchEl\.addEventListener\("input"/g,
  '(searchEl as HTMLElement).addEventListener("input"'
);
src = src.replace(
  /searchEl\.addEventListener\("search"/g,
  '(searchEl as HTMLElement).addEventListener("search"'
);
src = src.replace(/searchEl\.getAttribute\(/g, '(searchEl as HTMLElement).getAttribute(');

// visibleCols colIdx field
src = src.replace(
  /const field = visibleCols\[colIdx\]\.field;/g,
  'const field = visibleCols[colIdx]!.field;'
);

// this.#allRows[i]._rowId
src = src.replace(/this\.#allRows\[i\]\._rowId == null/g, 'this.#allRows[i]!["_rowId"] == null');
src = src.replace(/this\.#allRows\[i\]\._rowId = String\(i\)/g, 'this.#allRows[i]!["_rowId"] = String(i)');

fs.writeFileSync(file, src);
console.log('data-grid types applied');
