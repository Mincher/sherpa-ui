#!/usr/bin/env python3
"""
Applies surgical type fixes to the 5 hot-spot TS files.
Strategy: for each @ts-expect-error comment, look at the next non-blank line
and apply the minimum change that eliminates the TS error, then remove the
comment. Conservative by design — only replaces patterns it can identify
with high confidence.
"""

import re
import sys
import subprocess
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
COMPONENTS = ROOT / "components"

# ─────────────────────────────────────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────────────────────────────────────

def read(path):
    return Path(path).read_text(encoding="utf-8")

def write(path, content):
    Path(path).write_text(content, encoding="utf-8")

def apply_replacements(src, replacements):
    """Apply list of (pattern, replacement) pairs. pattern may be str or re.Pattern."""
    for pat, rep in replacements:
        if isinstance(pat, str):
            src = src.replace(pat, rep)
        else:
            src = pat.sub(rep, src)
    return src

# ─────────────────────────────────────────────────────────────────────────────
# sherpa-barchart.ts
# ─────────────────────────────────────────────────────────────────────────────

def fix_barchart():
    path = COMPONENTS / "sherpa-barchart/sherpa-barchart.ts"
    src = read(path)

    # Insert BarRow type alias after the last existing interface block
    if "type BarRow" not in src:
        src = src.replace(
            "export class SherpaBarChart",
            "type BarRow = Record<string, unknown>;\n\nexport class SherpaBarChart"
        )

    replacements = [
        # Function param types — exact string matches
        ("async setData(data) {",
         "async setData(data: BarContentData | null): Promise<void> {"),

        ("#applyOrderByFromConfig(data) {",
         "#applyOrderByFromConfig(data: BarData): BarData {"),

        ("#buildSeriesFromSegmentField(field, categoryField, measureField) {",
         "#buildSeriesFromSegmentField(field: string, categoryField: string | null, measureField: string | null): BarData {"),

        ("#formatLabel(value) {",
         "#formatLabel(value: unknown): string {"),

        ("#resolveCategoryField(columns, segmentField) {",
         "#resolveCategoryField(columns: ChartColumn[], segmentField: string | null): string | null {"),

        ("#resolveMeasureField(columns, categoryField, segmentField) {",
         "#resolveMeasureField(columns: ChartColumn[], categoryField: string | null, segmentField: string | null): string | null {"),

        ("#onResize({ contentRect: { width, height } }) {",
         "#onResize({ contentRect: { width, height } }: ResizeObserverEntry): void {"),

        ("#applyLocalSort(data) {",
         "#applyLocalSort(data: BarData): BarData {"),

        ("#capSeries(series) {",
         "#capSeries(series: BarSeries[]): BarSeries[] {"),

        ("#getCategoryTotal(series, index) {",
         "#getCategoryTotal(series: BarSeries[], index: number): number {"),

        ("#getMaxValue(series, isStacked) {",
         "#getMaxValue(series: BarSeries[], isStacked: boolean): number {"),

        ("#niceNumber(value) {",
         "#niceNumber(value: number): number {"),

        ("#renderAxis(el, niceMax) {",
         "#renderAxis(el: HTMLElement | null, niceMax: number): void {"),

        ("#calculateSegmentSizes(series, catIdx, niceMax, isStacked) {",
         "#calculateSegmentSizes(series: BarSeries[], catIdx: number, niceMax: number, isStacked: boolean): { segments: Array<{pct: number; name: string; seriesIdx: number}> } {"),

        ("#createSegmentNodes(series, catIdx, niceMax, isStacked) {",
         "#createSegmentNodes(series: BarSeries[], catIdx: number, niceMax: number, isStacked: boolean): HTMLElement[] {"),

        ("#resolveFieldAlias(field) {",
         "#resolveFieldAlias(field: string | null | undefined): string | null {"),

        ("setExternalFilters(externalFilters) {",
         "setExternalFilters(externalFilters: Array<{ field: string; values: string[] }>): void {"),

        ("#applyExternalFilters(rows) {",
         "#applyExternalFilters(rows: BarRow[]): BarRow[] {"),

        # Typed local variables
        ("    const categories = [];",
         "    const categories: string[] = [];"),

        ("      const ensureCategory = (raw) => {",
         "      const ensureCategory = (raw: unknown): void => {"),

        ("      const nodes = [];",
         "      const nodes: HTMLElement[] = [];"),

        ("    const segments = [];",
         "    const segments: Array<{pct: number; name: string; seriesIdx: number}> = [];"),

        # config property assignments — cast config to allow extra fields
        ("config.segmentField = isSegmentEnabled(this) ? localSeriesField : null;",
         "(config as Record<string, unknown>).segmentField = isSegmentEnabled(this) ? localSeriesField : null;"),

        ("config.seriesField = config.segmentField;",
         "(config as Record<string, unknown>).seriesField = (config as Record<string, unknown>).segmentField;"),

        ("config.originalOrderBy = this.#originalOrderBy;",
         "(config as Record<string, unknown>).originalOrderBy = this.#originalOrderBy;"),

        ("config.originalSegmentBy = this.#originalSegmentBy;",
         "(config as Record<string, unknown>).originalSegmentBy = this.#originalSegmentBy;"),

        # Null guard on contentData.categories
        ("if (Array.isArray(this.#contentData.categories)) {",
         "if (Array.isArray(this.#contentData?.categories)) {"),

        ("this.#contentData.categories.forEach((cat) => ensureCategory(cat));",
         "this.#contentData!.categories!.forEach((cat: unknown) => ensureCategory(cat));"),

        # Template clone
        ("this.#axisValueTpl.content.firstElementChild.cloneNode(true)",
         "(this.#axisValueTpl!.content.firstElementChild!.cloneNode(true) as HTMLElement)"),

        # metadata orderBy access
        ("const orderBy = this.#contentData?.metadata?.orderBy;",
         "const orderBy = (this.#contentData?.metadata as Record<string, unknown> | undefined)?.['orderBy'];"),

        # series/data map callbacks
        ("data.series.map((s) => ({",
         "data.series.map((s: BarSeries) => ({"),

        # Only the stacked series map (preceded by series.map in capSeries context)
        # Don't use global replace for series.map — too broad

        # column callbacks
        ("columns.some((col) => col.field === meta.primaryField",
         "columns.some((col: ChartColumn) => col.field === meta.primaryField"),

        ("if (categoryField && columns.some((col) => col.field === categoryField)) {",
         "if (categoryField && columns.some((col: ChartColumn) => col.field === categoryField)) {"),

        ("const fallback = columns.find((col) => {",
         "const fallback = columns.find((col: ChartColumn) => {"),

        ("const numericCols = columns.filter((col) => {",
         "const numericCols = columns.filter((col: ChartColumn) => {"),

        ("      (col) => col.field !== categoryField && col.field !== segmentField,",
         "      (col: ChartColumn) => col.field !== categoryField && col.field !== segmentField,"),

        ("numericCols.find((col) => col.field !== segmentField) || numericCols[0];",
         "numericCols.find((col: ChartColumn) => col.field !== segmentField) || numericCols[0]!;"),

        # indices.map callback
        ("categories: indices.map((i) => categories[i]),",
         "categories: indices.map((i: number) => categories[i]!),"),

        ("values: indices.map((i) => s.values[i]),",
         "values: indices.map((i: number) => s.values[i]!),"),

        # capSeries internals
        ("const otherValues = kept[0].values.map((_, i) =>",
         "const otherValues = kept[0]!.values.map((_: number, i: number) =>"),

        ("rest.reduce((s: any, r: any) => s + (r.values[i] || 0), 0)",
         "rest.reduce((s: number, r: BarSeries) => s + (r.values[i] ?? 0), 0)"),

        ("return kept.map(({ _total, ...s }) => s);",
         "return kept.map(({ _total: _t, ...s }: BarSeries & { _total?: number }) => s);"),

        # #applyLocalSort series map (different context from setData)
        ("? data.series.map((s) => ({\n          ...s,",
         "? data.series.map((s: BarSeries) => ({\n          ...s,"),

        # series.map inside sort/cap methods
        ("      series: series.map((s) => ({",
         "      series: series.map((s: BarSeries) => ({"),

        # #getCategoryTotal / #getMaxValue callbacks
        ("series.reduce((sum: any, s: any) => {",
         "series.reduce((sum: number, s: BarSeries) => {"),

        ("return Math.max(...series.flatMap((s) => s.values), 1);",
         "return Math.max(...series.flatMap((s: BarSeries) => s.values), 1);"),

        # applyExternalFilters row callback
        ("    return rows.filter((row) =>",
         "    return rows.filter((row: BarRow) =>"),

        # categories.map
        ("      values: categories.map((catLabel) => {",
         "      values: categories.map((catLabel: string) => {"),

        # forEach in createSegmentNodes / calculateSegmentSizes
        ("series.forEach((s, i) => {",
         "series.forEach((s: BarSeries, i: number) => {"),
    ]

    src = apply_replacements(src, replacements)
    write(path, src)
    print("✓ barchart")

# ─────────────────────────────────────────────────────────────────────────────
# sherpa-data-grid.ts
# ─────────────────────────────────────────────────────────────────────────────

def fix_datagrid():
    path = COMPONENTS / "sherpa-data-grid/sherpa-data-grid.ts"
    src = read(path)

    replacements = [
        # Module-level function
        ("function columnWidth(type) {",
         "function columnWidth(type: string | undefined | null): string {"),

        # Method params
        ("  setColumnConfig(config) {",
         "  setColumnConfig(config: Record<string, ColumnConfigEntry>): void {"),

        ("  async setData(config) {",
         "  async setData(config: GridData | null): Promise<void> {"),

        ("  #initHeaders(columns) {",
         "  #initHeaders(columns: GridColumn[]): void {"),

        ("  #renderFlatRows(rows, columns) {",
         "  #renderFlatRows(rows: GridRow[], columns: GridColumn[]): void {"),

        ("  #renderGrouped(rows, columns, groupField) {",
         "  #renderGrouped(rows: GridRow[], columns: GridColumn[], groupField: string): void {"),

        ("  #groupRows(rows, groupField) {",
         "  #groupRows(rows: GridRow[], groupField: string): Map<string, GridRow[]> {"),

        ("  #onColumnSort(field) {",
         "  #onColumnSort(field: string): void {"),

        ("  #sortRows(rows, field, direction) {",
         "  #sortRows(rows: GridRow[], field: string, direction: string): GridRow[] {"),

        ("  #applyGlobalSearch(rows) {",
         "  #applyGlobalSearch(rows: GridRow[]): GridRow[] {"),

        ("  #applyColumnFilters(rows) {",
         "  #applyColumnFilters(rows: GridRow[]): GridRow[] {"),

        ("  #applyValueFilters(rows) {",
         "  #applyValueFilters(rows: GridRow[]): GridRow[] {"),

        ("  #applyExternalFilters(rows) {",
         "  #applyExternalFilters(rows: GridRow[]): GridRow[] {"),

        ("  #onSelectAll(checked) {",
         "  #onSelectAll(checked: boolean): void {"),

        ("  #onRowSelect(rowId, checked, event) {",
         "  #onRowSelect(rowId: string, checked: boolean, event: MouseEvent | null): void {"),

        ("  #paginate(rows) {",
         "  #paginate(rows: GridRow[]): GridRow[] {"),

        ("  #renderPagination(totalFiltered) {",
         "  #renderPagination(totalFiltered: number): void {"),

        ("  setActionMenuItems(sections) {",
         "  setActionMenuItems(sections: unknown[]): void {"),

        ("  async onJsonData(data: any) {",
         "  override async onJsonData(data: unknown): Promise<void> {"),

        ("  onJsonError(_url, _e) {",
         "  override onJsonError(_url: string, _e: Error): void {"),

        ("  setExternalFilters(externalFilters) {",
         "  setExternalFilters(externalFilters: ValueFilter[]): void {"),

        # Private getter return types
        ("  get #page() {",
         "  get #page(): number {"),

        ("  get #pageSize() {",
         "  get #pageSize(): number {"),

        ("  get #totalPages() {",
         "  get #totalPages(): number {"),

        # parseInt null-safety
        ('parseInt(this.getAttribute("data-page"), 10)',
         'parseInt(this.getAttribute("data-page") || "", 10)'),

        ('parseInt(this.getAttribute("data-page-size"), 10)',
         'parseInt(this.getAttribute("data-page-size") || "", 10)'),

        # row._rowId → bracket access (noPropertyAccessFromIndexSignature)
        ("this.#allRows[i]._rowId == null",
         '(this.#allRows[i]! as GridRow)["_rowId"] == null'),

        ("this.#allRows[i]._rowId = String(i);",
         '(this.#allRows[i]! as GridRow)["_rowId"] = String(i);'),

        ("row._rowId",
         'row["_rowId"]'),

        ("r._rowId",
         'r["_rowId"]'),

        # filter callbacks
        ("(f) => Array.isArray(f.values) && f.values.length > 0,",
         "(f: ValueFilter) => Array.isArray(f.values) && f.values.length > 0,"),

        ("(r) => r.dataset[\"rowId\"] === this.#lastClickedRowId,",
         "(r: HTMLElement) => r.dataset[\"rowId\"] === this.#lastClickedRowId,"),

        ("(r) => r.dataset[\"rowId\"] === rowId);",
         "(r: HTMLElement) => r.dataset[\"rowId\"] === rowId);"),

        # el.dataset["rowId"] on loop var
        ("const id = el.dataset[\"rowId\"];",
         "const id = (el as HTMLElement).dataset[\"rowId\"];"),

        # groupValue
        ("const groupValue = parentRow.dataset[\"groupValue\"];",
         "const groupValue = (parentRow as HTMLElement).dataset[\"groupValue\"];"),

        # field from cell.dataset
        ("const field = cell.dataset[\"field\"];",
         "const field = (cell as HTMLElement).dataset[\"field\"]!;"),

        ("const field = visibleCols[colIdx].field;",
         "const field = visibleCols[colIdx]!.field;"),

        # check/groupCheck/selectAll element casts
        ("      check.checked = checked;",
         "      (check as HTMLInputElement).checked = checked;"),

        ("      groupCheck.checked = allChecked;",
         "      (groupCheck as HTMLInputElement).checked = allChecked;"),

        ("      groupCheck.indeterminate = indeterminate;",
         "      (groupCheck as HTMLInputElement).indeterminate = indeterminate;"),

        ("      groupCheck.checked = false;",
         "      (groupCheck as HTMLInputElement).checked = false;"),

        ("      groupCheck.indeterminate = false;",
         "      (groupCheck as HTMLInputElement).indeterminate = false;"),

        ("    selectAll.checked = total > 0 && checked === total;",
         "    (selectAll as HTMLInputElement).checked = total > 0 && checked === total;"),

        ("    selectAll.indeterminate = checked > 0 && checked < total;",
         "    (selectAll as HTMLInputElement).indeterminate = checked > 0 && checked < total;"),

        ("      check.checked = false;",
         "      (check as HTMLInputElement).checked = false;"),

        ("        if (check) check.checked = true;",
         "        if (check) (check as HTMLInputElement).checked = true;"),

        # el.setAttribute("data-selected") on typed rows
        ("          ? rowEl.setAttribute(\"data-selected\", \"\")",
         "          ? (rowEl as HTMLElement).setAttribute(\"data-selected\", \"\")"),

        ("          : rowEl.removeAttribute(\"data-selected\");",
         "          : (rowEl as HTMLElement).removeAttribute(\"data-selected\");"),

        ("        el.setAttribute(\"data-selected\", \"\");",
         "        (el as HTMLElement).setAttribute(\"data-selected\", \"\");"),

        # rowEl?.dataset["rowId"]
        ("const rowId = rowEl?.dataset[\"rowId\"];",
         "const rowId = (rowEl as HTMLElement | null)?.dataset[\"rowId\"];"),

        # allRows.filter selectedRows
        ("return this.#allRows.filter((row) => this.#selectedRows.has(row._rowId));",
         "return this.#allRows.filter((row: GridRow) => this.#selectedRows.has(row[\"_rowId\"] as string));"),

        # selectedRows check
        ("        (r) => r._rowId != null && this.#selectedRows.has(r._rowId),",
         "        (r: GridRow) => r[\"_rowId\"] != null && this.#selectedRows.has(r[\"_rowId\"] as string),"),

        # pagination custom methods
        ("    pagination.setTotalRows(totalFiltered);",
         "    (pagination as unknown as { setTotalRows(n: number): void }).setTotalRows(totalFiltered);"),

        # bar?.setAvailableColumns
        ("    bar?.setAvailableColumns?.(this.#columns, this.#allRows);",
         "    (bar as unknown as { setAvailableColumns?(c: GridColumn[], r: GridRow[]): void })?.setAvailableColumns?.(this.#columns, this.#allRows);"),

        # this._syncFilterBarState
        ("    this._syncFilterBarState?.();",
         "    (this as unknown as { _syncFilterBarState?(): void })._syncFilterBarState?.();"),

        # btn.setMenuItems
        ("    btn.setMenuItems(this.#actionMenuSections);",
         "    (btn as unknown as { setMenuItems(s: unknown[]): void }).setMenuItems(this.#actionMenuSections);"),

        ("    btn.setMenuItems(sections);",
         "    (btn as unknown as { setMenuItems(s: unknown[]): void }).setMenuItems(sections);"),

        ("    btn.setMenuItems([{ heading: \"Columns\", items }]);",
         "    (btn as unknown as { setMenuItems(s: unknown[]): void }).setMenuItems([{ heading: \"Columns\", items }]);"),

        # emptyEl.heading
        ("    if (emptyEl) emptyEl.heading = message;",
         "    if (emptyEl) (emptyEl as HTMLElement & { heading: string }).heading = message;"),

        # event detail cast
        ("    const detail = e?.detail || {};",
         "    const detail = (e as CustomEvent)?.detail || {};"),

        ("      const rowEl = rowAction.closest(\".grid-row\");",
         "      const rowEl = (rowAction as HTMLElement | null)?.closest?.(\".grid-row\");"),

        ("        rowId != null ? this.#allRows.find((r) => r._rowId === rowId) : null;",
         "        rowId != null ? this.#allRows.find((r: GridRow) => r[\"_rowId\"] === rowId) : null;"),

        # catch block type
        ("    } catch (e: Event) {",
         "    } catch (e) {"),

        # config.segmentField in data-grid's own buildQueryConfig
        ("    config.segmentField = effectiveSegmentField;",
         "    (config as Record<string, unknown>).segmentField = effectiveSegmentField;"),

        ("    config.seriesField = null;",
         "    (config as Record<string, unknown>).seriesField = null;"),

        ("    if (this.#originalOrderBy) config.originalOrderBy = this.#originalOrderBy;",
         "    if (this.#originalOrderBy) (config as Record<string, unknown>).originalOrderBy = this.#originalOrderBy;"),

        ("      config.originalSegmentBy = this.#originalSegmentBy;",
         "      (config as Record<string, unknown>).originalSegmentBy = this.#originalSegmentBy;"),

        # event listener registrations — cast elements
        ("      pagination?.addEventListener(\"page-change\", (e: CustomEvent) => {",
         "      (pagination as HTMLElement | null)?.addEventListener(\"page-change\", (e) => {"),

        ("        globalSearch.addEventListener(\"input\", (e: CustomEvent) => {",
         "        (globalSearch as HTMLElement).addEventListener(\"input\", (e) => {"),

        ("        globalSearch.addEventListener(\"search\", (e: CustomEvent) => {",
         "        (globalSearch as HTMLElement).addEventListener(\"search\", (e) => {"),

        ("          clearTimeout(this.#searchDebounce);",
         "          clearTimeout(this.#searchDebounce ?? undefined);"),

        ("          const el = globalSearch.getInputElement?.();",
         "          const el = (globalSearch as unknown as { getInputElement?(): HTMLInputElement | null }).getInputElement?.();"),

        ("        overflowBtn.addEventListener(\"menu-select\", (e: CustomEvent) =>",
         "        (overflowBtn as HTMLElement).addEventListener(\"menu-select\", (e) =>"),

        ("        colSelectBtn.addEventListener(\"menu-select\", (e: CustomEvent) =>",
         "        (colSelectBtn as HTMLElement).addEventListener(\"menu-select\", (e) =>"),

        ("        actionsBtn.addEventListener(\"menu-select\", (e: CustomEvent) =>",
         "        (actionsBtn as HTMLElement).addEventListener(\"menu-select\", (e) =>"),

        ("        selectAll.addEventListener(\"change\", (e: CustomEvent) => {",
         "        (selectAll as HTMLInputElement).addEventListener(\"change\", (e) => {"),

        ("          this.#onSelectAll(e.target.checked);",
         "          this.#onSelectAll((e.target as HTMLInputElement).checked);"),

        ("          searchEl.addEventListener(\"input\", (e: CustomEvent) => {",
         "          (searchEl as HTMLElement).addEventListener(\"input\", (e) => {"),

        ("          searchEl.addEventListener(\"search\", (e: CustomEvent) => {",
         "          (searchEl as HTMLElement).addEventListener(\"search\", (e) => {"),

        ("            clearTimeout(this.#searchDebounce);",
         "            clearTimeout(this.#searchDebounce ?? undefined);"),

        ("            const inputEl = searchEl.getInputElement?.();",
         "            const inputEl = (searchEl as unknown as { getInputElement?(): HTMLInputElement | null }).getInputElement?.();"),

        # column filter updates
        ("              this.#columnFilters[field] = trimmed.toLowerCase();",
         "              if (field) this.#columnFilters[field] = trimmed.toLowerCase();"),

        ("              delete this.#columnFilters[field];",
         "              if (field) delete this.#columnFilters[field];"),

        # search event field
        ("          const field = searchEl.getAttribute(\"data-field\");",
         "          const field = (searchEl as HTMLElement).getAttribute(\"data-field\");"),

        # data density / column toggle menu items
        ("          data: { action: \"set-density\", densityValue: d.value },",
         "          data: { action: \"set-density\", densityValue: (d as HTMLElement).dataset[\"value\"] },"),

        ("          data: { action: \"toggle-column\", field: col.field },",
         "          data: { action: \"toggle-column\", field: (col as GridColumn).field },"),

        # row search filter callback
        ("    return rows.filter((row) =>\n      this.#columns.some((col) => {",
         "    return rows.filter((row: GridRow) =>\n      this.#columns.some((col: GridColumn) => {"),

        ("    return rows.filter((row) =>\n      filters.every(([field, term]) => {",
         "    return rows.filter((row: GridRow) =>\n      filters.every(([field, term]) => {"),

        ("    return rows.filter((row) =>\n      this.#valueFilters.every(({ field, values }) => {",
         "    return rows.filter((row: GridRow) =>\n      this.#valueFilters.every(({ field, values }) => {"),

        ("    return rows.filter((row) =>\n      this.#externalFilters.every(({ field, values }) => {",
         "    return rows.filter((row: GridRow) =>\n      this.#externalFilters.every(({ field, values }) => {"),
    ]

    src = apply_replacements(src, replacements)
    write(path, src)
    print("✓ data-grid")

# ─────────────────────────────────────────────────────────────────────────────
# sherpa-filter-bar.ts
# ─────────────────────────────────────────────────────────────────────────────

def fix_filterbar():
    path = COMPONENTS / "sherpa-filter-bar/sherpa-filter-bar.ts"
    src = read(path)

    replacements = [
        # onAttributeChanged override
        ("  override onAttributeChanged(name: string, _old, newValue: string | null) {",
         "  override onAttributeChanged(name: string, _old: string | null, newValue: string | null): void {"),

        # Function params
        ("  #getChipMenuButton(chip) {",
         "  #getChipMenuButton(chip: HTMLElement): HTMLElement | null {"),

        ("  #createFilterChipGroup({ filterField, filterType, label, slot, dismissable = false }) {",
         "  #createFilterChipGroup({ filterField, filterType, label, slot, dismissable = false }: { filterField: string; filterType: string; label: string; slot?: string; dismissable?: boolean }): { container: HTMLElement; chip: HTMLElement } {"),

        ("  #initPresetChips(fields) {",
         "  #initPresetChips(fields: string): void {"),

        ("  setAvailableColumns(columns, rows) {",
         "  setAvailableColumns(columns: FieldDef[], rows: Record<string, unknown>[]): void {"),

        ("  removeFilterChip(field) {",
         "  removeFilterChip(field: string): void {"),

        ("  #dispatchContainerFilterChange(filters) {",
         "  #dispatchContainerFilterChange(filters: unknown[]): void {"),

        ("  #dispatchGlobalFilterChange(filters) {",
         "  #dispatchGlobalFilterChange(filters: unknown[]): void {"),

        ("  #extractUniqueValues(field, rows) {",
         "  #extractUniqueValues(field: string, rows: Record<string, unknown>[]): string[] {"),

        ("  #getValuesForField(field) {",
         "  #getValuesForField(field: string): string[] {"),

        ("  #getFilteredRowsExcluding(excludeField) {",
         "  #getFilteredRowsExcluding(excludeField: string): Record<string, unknown>[] {"),

        ("  #countValuesIn(field, scopeRows) {",
         "  #countValuesIn(field: string, scopeRows: Record<string, unknown>[]): Map<string, number> {"),

        ("  #populateFilterChip(chip) {",
         "  #populateFilterChip(chip: HTMLElement): void {"),

        ("  #syncFilterChipLabel(chip, count) {",
         "  #syncFilterChipLabel(chip: HTMLElement, count: number): void {"),

        ("  #populateColumnsMenu(chip) {",
         "  #populateColumnsMenu(chip: HTMLElement): void {"),

        ("  #inferFilterType(columnType) {",
         "  #inferFilterType(columnType: string | undefined | null): string {"),

        ("  #resolveOperator(chip) {",
         "  #resolveOperator(chip: HTMLElement): string {"),

        ("  #computeTimeRange(rangeKey) {",
         "  #computeTimeRange(rangeKey: string): { start?: string; end?: string } | null {"),

        ("  #cycleSortMode(chip) {",
         "  #cycleSortMode(chip: HTMLElement): void {"),

        ("  #cycleSegmentMode(chip) {",
         "  #cycleSegmentMode(chip: HTMLElement): void {"),

        ("  #populateTimeframeMenu(chip) {",
         "  #populateTimeframeMenu(chip: HTMLElement): void {"),

        # Event listener casts — composedPath returns EventTarget[]
        # Click handler: cast the path.find result
        ("    this.addEventListener(\"click\", (e: CustomEvent) => {",
         "    this.addEventListener(\"click\", (e) => {"),

        ("    this.addEventListener(\"button-click\", (e: CustomEvent) => {",
         "    this.addEventListener(\"button-click\", (e) => {"),

        ("    this.addEventListener(\"change\", (e: CustomEvent) => {",
         "    this.addEventListener(\"change\", (e) => {"),

        # btn/chip from composedPath — cast to HTMLElement
        ("      if (btn?.dataset?.action === \"dismiss\") {",
         "      if ((btn as HTMLElement | undefined)?.dataset?.['action'] === \"dismiss\") {"),

        ("        const container = btn.closest(\".grouped-component\") ?? btn;",
         "        const container = (btn as HTMLElement).closest(\".grouped-component\") ?? btn;"),

        ("        container.remove();",
         "        (container as HTMLElement).remove();"),

        ("      if (chip?.hasAttribute?.(\"data-filter-field\")) {",
         "      if ((chip as HTMLElement | undefined)?.hasAttribute?.(\"data-filter-field\")) {"),

        ("        chip.toggleAttribute(\"data-active\", !chip.hasAttribute(\"data-active\"));",
         "        (chip as HTMLElement).toggleAttribute(\"data-active\", !(chip as HTMLElement).hasAttribute(\"data-active\"));"),

        ("      if (!chip?.hasAttribute?.(\"data-behavior\")) return;",
         "      if (!(chip as HTMLElement | undefined)?.hasAttribute?.(\"data-behavior\")) return;"),

        ("      const behavior = chip.getAttribute(\"data-behavior\");",
         "      const behavior = (chip as HTMLElement).getAttribute(\"data-behavior\");"),

        # filterChip from chip
        ("      const filterChip = chip?.hasAttribute?.(\"data-filter-field\")",
         "      const filterChip = (chip as HTMLElement | undefined)?.hasAttribute?.(\"data-filter-field\")"),

        ("        : chip?.closest?.(\".grouped-component\")?.querySelector(\"sherpa-button[data-filter-field]\") ?? null;",
         "        : (chip as HTMLElement | undefined)?.closest?.(\".grouped-component\")?.querySelector(\"sherpa-button[data-filter-field]\") ?? null;"),

        # labelBtn
        ("      const labelBtn = (chip.closest?.(\".grouped-component\") ?? chip.closest?.(\".chip-group\"))",
         "      const labelBtn = ((chip as HTMLElement).closest?.(\".grouped-component\") ?? (chip as HTMLElement).closest?.(\".chip-group\"))"),

        ("        ?? (chip?.hasAttribute?.(\"data-behavior\") ? chip : null);",
         "        ?? ((chip as HTMLElement | undefined)?.hasAttribute?.(\"data-behavior\") ? chip : null);"),

        # sw from change event
        ("      const sw = e.target;",
         "      const sw = e.target as HTMLElement | null;"),

        ("      if (sw?.tagName === \"SHERPA-SWITCH\" && sw.slot === \"toggle\") {",
         "      if (sw?.tagName === \"SHERPA-SWITCH\" && (sw as HTMLElement & { slot?: string }).slot === \"toggle\") {"),

        ("        this.#applied = sw.dataset[\"state\"] === \"on\";",
         "        this.#applied = (sw as HTMLElement).dataset[\"state\"] === \"on\";"),

        # sortBtn.dataset
        ("      sortBtn.dataset[\"sortType\"] = type;",
         "      (sortBtn as HTMLElement).dataset[\"sortType\"] = type;"),

        ("      delete sortBtn.dataset[\"sortType\"];",
         "      delete (sortBtn as HTMLElement).dataset[\"sortType\"];"),

        # chip.dataset in various methods
        ("        chip.dataset[\"label\"] = col.name || formatFieldName(col.field);",
         "        (chip as HTMLElement).dataset[\"label\"] = col.name || formatFieldName(col.field);"),

        ("        chip.dataset[\"defaultLabel\"] = chip.dataset[\"label\"];",
         "        (chip as HTMLElement).dataset[\"defaultLabel\"] = (chip as HTMLElement).dataset[\"label\"];"),

        ("          delete chip.dataset[\"count\"];",
         "          delete (chip as HTMLElement).dataset[\"count\"];"),

        ("          chip.dataset[\"label\"] = chip.dataset[\"defaultLabel\"] || chip.dataset[\"label\"];",
         "          (chip as HTMLElement).dataset[\"label\"] = (chip as HTMLElement).dataset[\"defaultLabel\"] || (chip as HTMLElement).dataset[\"label\"];"),

        ("        chip.dataset[\"label\"] = behavior === \"sort\" ? \"Sort\" : \"Group\";",
         "        (chip as HTMLElement).dataset[\"label\"] = behavior === \"sort\" ? \"Sort\" : \"Group\";"),

        # setMenuItems on addButton
        ("    this.#addButton.setMenuItems(",
         "    this.#addButton?.setMenuItems("),

        # .map on fields with String type param
        ("      .map((f) => f.trim())",
         "      .map((f: string) => f.trim())"),
    ]

    src = apply_replacements(src, replacements)
    write(path, src)
    print("✓ filter-bar")

# ─────────────────────────────────────────────────────────────────────────────
# sherpa-node-canvas.ts
# ─────────────────────────────────────────────────────────────────────────────

def fix_nodecanvas():
    path = COMPONENTS / "sherpa-node-canvas/sherpa-node-canvas.ts"
    src = read(path)

    replacements = [
        # Method params
        ("  setSelectedNode(nodeId) {",
         "  setSelectedNode(nodeId: string | null): void {"),

        ("  removeNode(nodeId) {",
         "  removeNode(nodeId: string): void {"),

        ("  setSelectedEdge(idx) {",
         "  setSelectedEdge(idx: number): void {"),

        ("  #socketType(sock) {",
         "  #socketType(sock: HTMLElement): string {"),

        ("  #findEdgeEndingAt(nodeId, portName, clientX, clientY) {",
         "  #findEdgeEndingAt(nodeId: string, portName: string, clientX: number, clientY: number): number {"),

        ("  #findEdgeAt(clientX, clientY) {",
         "  #findEdgeAt(clientX: number, clientY: number): number {"),

        ("  #edgeScreenSamples(edgeIdx) {",
         "  #edgeScreenSamples(edgeIdx: number): Array<[number, number]> {"),

        ("  #subgraphHasSourceToOutput(snap) {",
         "  #subgraphHasSourceToOutput(snap: unknown): boolean {"),

        ("  #resolveColor(varName, fallback) {",
         "  #resolveColor(varName: string, fallback: string): string {"),

        ("  #edgeColor(edgeIdx, palette, state) {",
         "  #edgeColor(edgeIdx: number, palette: Record<string, string>, state: string): string {"),

        ("  #strokeEdge(ctx, edgeIdx, counts, color, width) {",
         "  #strokeEdge(ctx: CanvasRenderingContext2D, edgeIdx: number, counts: Map<string, number>, color: string, width: number): void {"),

        ("  pushSubgraph(parentId, label) {",
         "  pushSubgraph(parentId: string, label: string): void {"),

        ("  forgetSubgraph(parentId) {",
         "  forgetSubgraph(parentId: string): void {"),

        ("  getSubgraphCache(parentId) {",
         "  getSubgraphCache(parentId: string): unknown {"),

        ("  setSubgraphCache(parentId, snapshot) {",
         "  setSubgraphCache(parentId: string, snapshot: unknown): void {"),

        ("  #labelForNode(nodeId) {",
         "  #labelForNode(nodeId: string): string {"),

        ("  #restore(snap) {",
         "  #restore(snap: unknown): void {"),

        ("  setEdges(edges) {",
         "  setEdges(edges: Edge[]): void {"),

        # colorProbeEl typed field
        ("  #colorProbeEl;",
         "  #colorProbeEl: HTMLElement | null = null;"),

        # drivenInputs typed
        ("  #drivenInputs = new Set()",
         "  #drivenInputs = new Set<string>()"),

        # counts Map
        ("    const counts = new Map()",
         "    const counts = new Map<string, number>()"),

        # sock accesses
        ("sock.dataset[\"direction\"]",
         "(sock as HTMLElement).dataset[\"direction\"]"),

        ("sock.dataset[\"portName\"]",
         "(sock as HTMLElement).dataset[\"portName\"]"),

        # snap property accesses
        ("snap.nodes",
         "(snap as Record<string, unknown>)['nodes']"),

        ("snap.edges",
         "(snap as Record<string, unknown>)['edges']"),

        ("snap.viewport",
         "(snap as Record<string, unknown>)['viewport']"),

        # Module-level functions
        ("function cubic(t, x0, y0, cx1, cy1, cx2, cy2, x1, y1)",
         "function cubic(t: number, x0: number, y0: number, cx1: number, cy1: number, cx2: number, cy2: number, x1: number, y1: number): [number, number]"),

        ("function pointSegDist(px, py, x0, y0, x1, y1)",
         "function pointSegDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number"),

        ("function edgeColor(edge, base, control)",
         "function edgeColor(edge: Edge, base: string, control: string): string"),
    ]

    src = apply_replacements(src, replacements)
    write(path, src)
    print("✓ node-canvas")

# ─────────────────────────────────────────────────────────────────────────────
# sherpa-nav.ts
# ─────────────────────────────────────────────────────────────────────────────

def fix_nav():
    path = COMPONENTS / "sherpa-nav/sherpa-nav.ts"
    src = read(path)

    replacements = [
        # onAttributeChanged
        ("  override onAttributeChanged(name: string, _oldValue, newValue: string | null) {",
         "  override onAttributeChanged(name: string, _oldValue: string | null, newValue: string | null): void {"),

        # Function params
        ("  setActiveLink(target) {",
         "  setActiveLink(target: string): void {"),

        ("  #applyActiveLink(target) {",
         "  #applyActiveLink(target: string): void {"),

        ("  setActiveItem(itemId, sectionId = null) {",
         "  setActiveItem(itemId: string, sectionId: string | null = null): void {"),

        ("  #applyActiveItem(itemId, sectionId = null) {",
         "  #applyActiveItem(itemId: string, sectionId: string | null = null): void {"),

        ("  isFavorite(itemId) {",
         "  isFavorite(itemId: string): boolean {"),

        ("  setFavorite(itemId, label, route, on) {",
         "  setFavorite(itemId: string, label: string, route: string, on: boolean): void {"),

        ("  async addToRecent(itemId, label, route) {",
         "  async addToRecent(itemId: string, label: string, route: string): Promise<void> {"),

        ("  setPromoConfig(config) {",
         "  setPromoConfig(config: PromoConfig | null): void {"),

        ("  #readStored(key) {",
         "  #readStored(key: string): unknown[] {"),

        ("  #writeStored(key, items) {",
         "  #writeStored(key: string, items: unknown[]): void {"),

        ("  #emit(name, detail = {}) {",
         "  #emit(name: string, detail: Record<string, unknown> = {}): void {"),

        ("  #applyOrderToContainer(container, order) {",
         "  #applyOrderToContainer(container: HTMLElement, order: (string | undefined)[]): void {"),

        ("  #persistGroupOrder(groupIndex, order) {",
         "  #persistGroupOrder(groupIndex: number, order: (string | undefined)[]): void {"),

        ("  #getItemLabel(item) {",
         "  #getItemLabel(item: HTMLElement): string {"),

        ("  #createMatchRange(item, filterLower) {",
         "  #createMatchRange(item: HTMLElement, filterLower: string): Range | null {"),

        ("  #revealAncestors(node) {",
         "  #revealAncestors(node: HTMLElement): void {"),

        ("  #applySearchFilter(value) {",
         "  #applySearchFilter(value: string): void {"),

        ("  #onPinnedChange(pinned) {",
         "  #onPinnedChange(pinned: string | null): void {"),

        ("  #onModeChange(newMode, oldMode) {",
         "  #onModeChange(newMode: string | null, oldMode: string | null): void {"),

        ("  #snapshotSection(sec) {",
         "  #snapshotSection(sec: HTMLElement): NavItemData[] {"),

        ("  #persistQuickAccess(which) {",
         "  #persistQuickAccess(which: 'recent' | 'favorites'): void {"),

        # Nested function params
        ("      const hydrate = (secId, key, max) => {",
         "      const hydrate = (secId: string, key: string, max: number): void => {"),

        ("      const rank = (s) => {",
         "      const rank = (s: HTMLElement): number => {"),

        # dataset accesses on typed elements
        ("      if (item) item.dataset[\"state\"] = \"selected\";",
         "      if (item) (item as HTMLElement).dataset[\"state\"] = \"selected\";"),

        ("      if (primary) primary.dataset[\"state\"] = \"selected\";",
         "      if (primary) (primary as HTMLElement).dataset[\"state\"] = \"selected\";"),

        # el.dataset in querySelectorAll forEach
        ("      el.dataset[\"state\"] = \"selected\";",
         "      (el as HTMLElement).dataset[\"state\"] = \"selected\";"),

        # sec.dataset
        ("      sec.dataset[\"editable\"] === \"true\",",
         "      (sec as HTMLElement).dataset[\"editable\"] === \"true\","),

        ("    const max = parseInt(sec.dataset[\"maxItems\"], 10) || 5;",
         "    const max = parseInt((sec as HTMLElement)?.dataset[\"maxItems\"] || \"\", 10) || 5;"),

        # existing.dataset
        ("      if (route) existing.dataset[\"route\"] = route;",
         "      if (route) (existing as HTMLElement).dataset[\"route\"] = route;"),

        ("        existing.dataset[\"state\"] = 'selected';",
         "        (existing as HTMLElement).dataset[\"state\"] = 'selected';"),

        # close/promo dataset
        ("    if (!close || close.dataset[\"wired\"] === \"true\") return;",
         "    if (!close || (close as HTMLElement).dataset[\"wired\"] === \"true\") return;"),

        ("    close.dataset[\"wired\"] = \"true\";",
         "    (close as HTMLElement).dataset[\"wired\"] = \"true\";"),

        ("      if (promo) promo.dataset[\"dismissed\"] = \"\";",
         "      if (promo) (promo as HTMLElement).dataset[\"dismissed\"] = \"\";"),

        # linkEl
        ("      if (cfg?.link?.url) linkEl.dataset[\"url\"] = cfg.link.url;",
         "      if ((cfg as PromoConfig)?.link?.url) (linkEl as HTMLElement).dataset[\"url\"] = (cfg as PromoConfig).link!.url!;"),

        ("      else delete linkEl.dataset[\"url\"];",
         "      else delete (linkEl as HTMLElement).dataset[\"url\"];"),

        # searchField clear
        ("        this.#searchField.clear();",
         "        (this.#searchField as unknown as { clear?(): void })?.clear?.();"),

        # items[i].remove() in addToRecent
        ("    for (let i = max; i < items.length; i++) items[i].remove();",
         "    for (let i = max; i < items.length; i++) (items[i] as HTMLElement)?.remove();"),

        # applyActiveItem call from onAttributeChanged with sel props
        ("        this.#applyActiveItem(sel.itemId, sel.sectionId);",
         "        this.#applyActiveItem((sel as { itemId: string; sectionId: string | null }).itemId, (sel as { itemId: string; sectionId: string | null }).sectionId);"),
    ]

    src = apply_replacements(src, replacements)
    write(path, src)
    print("✓ nav")

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Applying type fixes...")
    fix_barchart()
    fix_datagrid()
    fix_filterbar()
    fix_nodecanvas()
    fix_nav()
    print("\nAll fixes applied.")
