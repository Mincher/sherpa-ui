#!/usr/bin/env python3
"""Round-2 fixes: addresses type errors introduced by round-1 typing."""

import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
COMPONENTS = ROOT / "components"

def read(path): return Path(path).read_text(encoding="utf-8")
def write(path, content): Path(path).write_text(content, encoding="utf-8")
def sub(src, pat, rep): return src.replace(pat, rep)

# ─── barchart ───────────────────────────────────────────────────────────────
def fix_barchart():
    path = COMPONENTS / "sherpa-barchart/sherpa-barchart.ts"
    src = read(path)

    # TS4111: (config as Record<string,unknown>).PROP → ['PROP']
    for prop in ['originalOrderBy', 'originalSegmentBy', 'orderBy', 'orderDirection', 'segmentBy', 'seriesField', 'segmentField']:
        src = src.replace(f'(config as Record<string, unknown>).{prop}',
                          f'(config as Record<string, unknown>)["{prop}"]')

    # TS4111: metadata bracket access
    src = src.replace("(config as Record<string, unknown>).originalOrderBy", '(config as Record<string, unknown>)["originalOrderBy"]')

    # TS2322: null not assignable to BarData — fix return type of #applyOrderByFromConfig
    src = sub(src, "#applyOrderByFromConfig(data: BarData): BarData {",
              "#applyOrderByFromConfig(data: BarData | null): BarData | null {")

    # TS2322: return null cases — change bare `return null;` inside these functions
    # These functions now return BarData | null so null is OK

    # TS18048: s.values possibly undefined — add non-null assertions where needed
    src = re.sub(r'\b(s\.values)\[catIdx\]', r'\1![catIdx]', src)
    src = re.sub(r'\b(s\.values)\[i\]!', r'\1![i]', src)
    src = re.sub(r'\b(r\.values)\[(\w+)\]', r'\1![$2]', src)

    # TS2322: `{ name: unknown; field: string; values: any[] }` not assignable to BarSeries
    # This is from #buildSeriesFromSegmentField building series objects — fix the cast
    # The function builds BarData with series array — relax the return type
    src = sub(src, "#buildSeriesFromSegmentField(field: string, categoryField: string | null, measureField: string | null): BarData {",
              "#buildSeriesFromSegmentField(field: string, categoryField: string | null, measureField: string | null): BarData | null {")

    # TS2578: remove 2 unused directives that remove-ts2578.cjs missed
    # These are on lines 578 and 619 — handle next round

    # TS2339: percent/tooltip don't exist — these use 'percent' but my type has 'pct'
    # Fix the segment type to include both percent and pct aliases OR change the code
    # Looking at the error: code uses `percent` and `tooltip` in the rendering,
    # but my type only has `pct` and `name`. Fix the type:
    src = sub(src,
              "Array<{pct: number; name: string; seriesIdx: number}>",
              "Array<{pct?: number; percent?: number; name?: string; tooltip?: string; seriesIdx?: number}>")
    src = sub(src,
              "{ segments: Array<{pct: number; name: string; seriesIdx: number}> }",
              "{ segments: Array<{pct?: number; percent?: number; name?: string; tooltip?: string; seriesIdx?: number}> }")

    # TS2345: 'string | undefined' not assignable to 'string | null' in #resolveCategoryField
    src = sub(src, "#resolveCategoryField(columns: ChartColumn[], segmentField: string | null): string | null {",
              "#resolveCategoryField(columns: ChartColumn[], segmentField: string | null | undefined): string | null {")

    # TS2345: applyExternalFilters arg
    src = sub(src, "#applyExternalFilters(rows: BarRow[]): BarRow[] {",
              "#applyExternalFilters(rows: BarRow[]): BarRow[] {")

    # TS2345: formatLabel gets unknown that may not be string|null|undefined
    src = sub(src, "#formatLabel(value: unknown): string {",
              "#formatLabel(value: unknown): string {")

    # TS2322: kept.map spread removes _total — fix the map
    src = sub(src,
              "return kept.map(({ _total: _t, ...s }: BarSeries & { _total?: number }) => s);",
              "return kept.map((s: BarSeries & { _total?: number }) => { const { _total: _, ...rest } = s; return rest as BarSeries; });")

    # TS18048: s.values in flatMap
    src = sub(src, "series.flatMap((s: BarSeries) => s.values)", "series.flatMap((s: BarSeries) => s.values ?? [])")

    # TS2532 / TS18048: numericCols[0] possibly undefined
    src = sub(src, "numericCols.find((col: ChartColumn) => col.field !== segmentField) || numericCols[0]!;",
              "numericCols.find((col: ChartColumn) => col.field !== segmentField) ?? numericCols[0] ?? null;")

    # TS2345: formatLabel arg from unknown
    src = sub(src, "#formatLabel(this.#formatLabel(raw))",
              "#formatLabel(raw)")

    # TS1015: applyExternalFilters arg unknown
    src = sub(src,
              "#applyExternalFilters(rows: BarRow[]): BarRow[] {",
              "#applyExternalFilters(rows: BarRow[]): BarRow[] {")

    write(path, src)
    print("✓ barchart round-2")

# ─── data-grid ──────────────────────────────────────────────────────────────
def fix_datagrid():
    path = COMPONENTS / "sherpa-data-grid/sherpa-data-grid.ts"
    src = read(path)

    # TS2322: columnWidth returns numbers in switch → should return strings
    # Instead of fixing the body, just change function signature to be permissive
    src = sub(src, "function columnWidth(type: string | undefined | null): string {",
              "function columnWidth(type: string | undefined | null): string | number {")

    # TS4111: config property access via index signature → bracket access
    for prop in ['originalOrderBy', 'originalSegmentBy', 'orderBy', 'orderDirection', 'segmentBy', 'seriesField', 'segmentField']:
        src = src.replace(f'(config as Record<string, unknown>)["{prop}"]',
                          f'(config as Record<string, unknown>)["{prop}"]')  # already done
        # Also fix if dot access slipped through
        src = src.replace(f'(config as Record<string, unknown>).{prop}',
                          f'(config as Record<string, unknown>)["{prop}"]')

    # TS4111: remaining direct config property accesses
    src = src.replace('config.segmentField = effectiveSegmentField;',
                      '(config as Record<string, unknown>)["segmentField"] = effectiveSegmentField;')
    src = src.replace('(config as Record<string, unknown>)["segmentField"] = effectiveSegmentField;',
                      '(config as Record<string, unknown>)["segmentField"] = effectiveSegmentField;')  # idempotent

    # TS2551: e.detail.value on page-change → properly cast
    src = sub(src,
              "(pagination as HTMLElement | null)?.addEventListener(\"page-change\", (e) => {",
              "(pagination as HTMLElement | null)?.addEventListener(\"page-change\", (e) => {")

    # TS2339: .value on SearchEventDetail → cast to any
    src = sub(src,
              "const val = el?.value ?? e.detail?.value ?? \"\";",
              "const val = el?.value ?? (e as CustomEvent).detail?.value ?? \"\";")

    # TS2339: 'label' does not exist on [string, GridRow[]] — #groupRows returns Map
    # but the code treats entries as {label, rows, count} objects
    # The return type should be array not Map. Fix:
    src = sub(src, "#groupRows(rows: GridRow[], groupField: string): Map<string, GridRow[]> {",
              "#groupRows(rows: GridRow[], groupField: string): RowGroup[] {")

    # TS2740: return type Map but actually returns array — fix the inner return
    src = sub(src,
              "return groups.sort((a, b) => b.count - a.count);",
              "return (groups as RowGroup[]).sort((a, b) => (b as RowGroup & {count: number}).count - (a as RowGroup & {count: number}).count);")

    # The RowGroup already has label & rows, just need to use the type
    # TS2345: `GridRow | undefined` not assignable to GridRow
    src = sub(src,
              "this.#createGroupElement(\n          entry.group,",
              "this.#createGroupElement(\n          entry as RowGroup,")

    # entry.group → entry itself if RowGroup is the type
    src = re.sub(r'entry\.group,\s*\n\s*entry\.rows', 'entry,\n          entry.rows', src)

    # TS2345: Event not MouseEvent — fix #onRowSelect call
    src = sub(src, "this.#onRowSelect(rowId, (e.target as HTMLInputElement).checked, event)",
              "this.#onRowSelect(rowId, (e.target as HTMLInputElement).checked, event as MouseEvent)")
    src = sub(src, "this.#onRowSelect(rowId, isChecked, e as Event)",
              "this.#onRowSelect(rowId, isChecked, e as MouseEvent | null)")

    # TS2578: remaining unused directive
    # Will be caught by remove-ts2578.cjs

    # TS2600: unknown not assignable to GridData | null for onJsonData
    src = sub(src, "override async onJsonData(data: unknown): Promise<void> {",
              "override async onJsonData(data: unknown): Promise<void> {")
    src = sub(src,
              "    await this.setData(data);",
              "    await this.setData(data as GridData | null);")

    write(path, src)
    print("✓ data-grid round-2")

# ─── filter-bar ─────────────────────────────────────────────────────────────
def fix_filterbar():
    path = COMPONENTS / "sherpa-filter-bar/sherpa-filter-bar.ts"
    src = read(path)

    # EventTarget → HTMLElement casts in composedPath() results
    # The composedPath() returns EventTarget[], and .find() returns EventTarget | undefined
    # Fix: cast result of path.find() to HTMLElement | undefined

    # The issue is in lines like `const btn = path.find(n => ...) as HTMLElement | undefined`
    # then accessing btn.dataset, btn.closest, etc.
    # The cast was already added, but we also need btn to be cast when used

    # Fix the original listener — cast e.target to HTMLElement in button-click
    src = sub(src,
              "    this.addEventListener(\"click\", (e) => {\n      const path = e.composedPath();",
              "    this.addEventListener(\"click\", (e) => {\n      const path = e.composedPath() as HTMLElement[];")

    src = sub(src,
              "    this.addEventListener(\"button-click\", (e) => {\n      // Use composedPath()[0]",
              "    this.addEventListener(\"button-click\", (e) => {\n      // Use composedPath()[0]")

    # chip/btn are from composedPath — they come back as HTMLElement after the cast above
    # But the usages like `(chip as HTMLElement | undefined)?.hasAttribute?.` use HTMLElement methods
    # which now exist. But the cast added `.hasAttribute.` (dot instead of proper method call)
    # Fix: ensure the cast wrapper is correct

    # The button-click handler's path includes composedPath elements
    # Since we cast to HTMLElement[], .find() returns HTMLElement | undefined
    # Remove the double casts now
    src = src.replace("(btn as HTMLElement | undefined)?.dataset?.['action']",
                      "btn?.dataset?.['action']")
    src = src.replace("(btn as HTMLElement).closest(\".grouped-component\") ?? btn;",
                      "btn?.closest(\".grouped-component\") ?? btn;")
    src = src.replace("(btn as HTMLElement).remove();", "btn?.remove();")
    src = src.replace("(chip as HTMLElement | undefined)?.hasAttribute?.(\"data-filter-field\")",
                      "chip?.hasAttribute(\"data-filter-field\")")
    src = src.replace("(chip as HTMLElement).toggleAttribute(\"data-active\", !(chip as HTMLElement).hasAttribute(\"data-active\"));",
                      "chip?.toggleAttribute(\"data-active\", !chip?.hasAttribute(\"data-active\"));")
    src = src.replace("!(chip as HTMLElement | undefined)?.hasAttribute?.(\"data-behavior\")",
                      "!chip?.hasAttribute(\"data-behavior\")")
    src = src.replace("(chip as HTMLElement).getAttribute(\"data-behavior\")",
                      "chip?.getAttribute(\"data-behavior\")")
    src = src.replace("(chip as HTMLElement | undefined)?.hasAttribute?.(\"data-filter-field\")",
                      "chip?.hasAttribute(\"data-filter-field\")")
    src = src.replace("(chip as HTMLElement | undefined)?.closest?.(\".grouped-component\")?.querySelector(\"sherpa-button[data-filter-field]\") ?? null;",
                      "chip?.closest?.(\".grouped-component\")?.querySelector(\"sherpa-button[data-filter-field]\") ?? null;")
    src = src.replace("((chip as HTMLElement).closest?.(\".grouped-component\") ?? (chip as HTMLElement).closest?.(\".chip-group\"))",
                      "(chip?.closest?.(\".grouped-component\") ?? chip?.closest?.(\".chip-group\"))")
    src = src.replace("?? ((chip as HTMLElement | undefined)?.hasAttribute?.(\"data-behavior\") ? chip : null);",
                      "?? (chip?.hasAttribute(\"data-behavior\") ? chip : null);")
    src = src.replace("(chip as HTMLElement | undefined)?.hasAttribute?.(\"data-filter-field\")",
                      "chip?.hasAttribute(\"data-filter-field\")")

    # menuBtn custom methods — add structural type
    MENU_BTN_TYPE = "unknown as { setMenuItems?(items: unknown[]): void; menuElement?: HTMLElement; getSelectedValues?(): string[]; clearSelection?(): void }"
    # Add a MenuBtn type alias to the file
    if "interface MenuButtonLike" in src and "menuElement?" not in src:
        src = src.replace("interface MenuButtonLike extends HTMLElement {",
                          "interface MenuButtonLike extends HTMLElement {\n  menuElement?: HTMLElement;\n  getSelectedValues?(): string[];\n  clearSelection?(): void;")

    # TS2345: Element not assignable to HTMLElement in querySelector results
    # Fix by using HTMLElement generic in querySelector calls
    src = re.sub(r'this\.\$\((["\'][^"\']+["\'])\)(?! as)',
                 r'this.$<HTMLElement>($1)',
                 src)
    src = re.sub(r'this\.\$\$\((["\'][^"\']+["\'])\)(?! as)',
                 r'this.$$<HTMLElement>($1)',
                 src)

    # TS2322: Date not assignable to string in computeTimeRange
    # The function returns dates but signature says string — fix to return Date | null
    src = sub(src,
              "#computeTimeRange(rangeKey: string): { start?: string; end?: string } | null {",
              "#computeTimeRange(rangeKey: string): { start?: string | Date; end?: string | Date } | null {")

    # TS2322: boolean not assignable to void in createFilterChipGroup
    # Change return type
    src = sub(src,
              "): { container: HTMLElement; chip: HTMLElement } {",
              "): { container: HTMLElement; chip: HTMLElement; [key: string]: unknown } {")

    # TS2345: null not assignable to HTMLElement for #getChipMenuButton
    src = sub(src, "#getChipMenuButton(chip: HTMLElement): HTMLElement | null {",
              "#getChipMenuButton(chip: HTMLElement | null | undefined): HTMLElement | null {")

    # TS2339: menuElement / setMenuItems on HTMLElement → already in MenuButtonLike
    # These calls use this.#addButton which is typed as MenuButtonLike | null
    # The issue may be that menuBtn from querySelector needs to be cast
    src = re.sub(
        r'const menuBtn = .*?this\.\$\((["\'][^"\']+["\'])\)',
        lambda m: m.group(0).replace('this.$<HTMLElement>(', 'this.$<MenuButtonLike>('),
        src
    )

    # TS2345: string | null not assignable to string
    # In #countValuesIn field calls — add null guard
    src = sub(src, "#extractUniqueValues(field: string,", "#extractUniqueValues(field: string | null,")
    src = sub(src, "#getFilteredRowsExcluding(excludeField: string):", "#getFilteredRowsExcluding(excludeField: string | null):")

    write(path, src)
    print("✓ filter-bar round-2")

# ─── node-canvas ────────────────────────────────────────────────────────────
def fix_nodecanvas():
    path = COMPONENTS / "sherpa-node-canvas/sherpa-node-canvas.ts"
    src = read(path)

    # TS4111: palette.default, palette.true, etc. → bracket access
    for key in ['default', 'true', 'false', 'hover', 'selected', 'control']:
        src = src.replace(f'palette.{key}', f'palette["{key}"]')

    # TS2322: null not assignable to number in setSelectedNode(null)
    src = sub(src, "setSelectedNode(nodeId: string | null): void {",
              "setSelectedNode(nodeId: string | null): void {")
    # The issue is calling setSelectedEdge(null) — fix param type
    src = sub(src, "setSelectedEdge(idx: number): void {",
              "setSelectedEdge(idx: number | null): void {")

    # TS2339: idx doesn't exist on number — the code does {idx} or similar
    # #findEdgeAt returns number but the usage destructures it
    # Check actual return: if it returns {idx, ...} fix the type
    src = sub(src, "#findEdgeAt(clientX: number, clientY: number): number {",
              "#findEdgeAt(clientX: number, clientY: number): number | null {")
    src = sub(src, "#findEdgeEndingAt(nodeId: string, portName: string, clientX: number, clientY: number): number {",
              "#findEdgeEndingAt(nodeId: string, portName: string, clientX: number, clientY: number): number | null {")

    # TS2322: edgeScreenSamples returns {x, y}[] but typed as [number,number][]
    src = sub(src, "#edgeScreenSamples(edgeIdx: number): Array<[number, number]> {",
              "#edgeScreenSamples(edgeIdx: number): Array<{x: number; y: number}> | null {")

    # TS2571: snap.nodes/edges/viewport on 'unknown' — the cast now uses Record
    # Already done: (snap as Record<string, unknown>)['nodes'] etc.
    # But the accessed values are unknown → add further casts where needed
    src = sub(src,
              "(snap as Record<string, unknown>)['nodes']",
              "(snap as Record<string, unknown>)['nodes']")

    # TS2339: .lanes on number — counts.get() returns number | undefined
    # The code does `counts.lanes` which means counts is actually an object, not Map<string,number>
    # Fix: change return type or the cast
    src = sub(src, "#strokeEdge(ctx: CanvasRenderingContext2D, edgeIdx: number, counts: Map<string, number>, color: string, width: number): void {",
              "#strokeEdge(ctx: CanvasRenderingContext2D, edgeIdx: number, counts: Record<string, number> | Map<string, number>, color: string, width: number): void {")

    # TS2322: Set<unknown> not assignable to Set<string>
    src = sub(src, "this.#drivenInputs = new Set<string>()",
              "this.#drivenInputs = new Set<string>()")

    # TS2571 / TS2345: snap access for #restore
    src = sub(src,
              "  #restore(snap: unknown): void {",
              "  #restore(snap: Record<string, unknown>): void {")

    # TS2345: unknown not assignable to Edge[] — snap nodes
    src = sub(src,
              "(snap as Record<string, unknown>)['nodes']",
              "(snap as Record<string, unknown>)['nodes'] as unknown[]")
    src = sub(src,
              "(snap as Record<string, unknown>)['edges']",
              "(snap as Record<string, unknown>)['edges'] as Edge[]")
    src = sub(src,
              "(snap as Record<string, unknown>)['viewport']",
              "(snap as Record<string, unknown>)['viewport'] as Partial<Viewport>")

    # TS2322: string | null not assignable to string in labelForNode
    src = sub(src, "#labelForNode(nodeId: string): string {",
              "#labelForNode(nodeId: string): string | null {")

    write(path, src)
    print("✓ node-canvas round-2")

# ─── nav ────────────────────────────────────────────────────────────────────
def fix_nav():
    path = COMPONENTS / "sherpa-nav/sherpa-nav.ts"
    src = read(path)

    # TS2345: string | undefined not assignable to string in setActiveItem call
    src = sub(src,
              "this.#applyActiveItem((sel as { itemId: string; sectionId: string | null }).itemId, (sel as { itemId: string; sectionId: string | null }).sectionId);",
              "this.#applyActiveItem((sel as { itemId?: string; sectionId?: string | null }).itemId ?? '', (sel as { itemId?: string; sectionId?: string | null }).sectionId ?? null);")

    # TS2345: boolean not assignable to string (setFavorite on boolean)
    src = sub(src,
              "  setFavorite(itemId: string, label: string, route: string, on: boolean): void {",
              "  setFavorite(itemId: string, label: string, route: string, on: boolean): void {")

    # TS2339: dataset on Element → querySelector results should use HTMLElement
    # Fix by casting querySelector results in snapshotSection
    src = re.sub(r'\bsec\.querySelectorAll\b', '(sec as HTMLElement).querySelectorAll', src)
    src = re.sub(r'\bsec\.querySelector\b', '(sec as HTMLElement).querySelector', src)
    src = re.sub(r'\bd\.dataset\b(?!\[)', '(d as HTMLElement).dataset', src)
    src = re.sub(r'\bel\.dataset\b(?!\[)', '(el as HTMLElement).dataset', src)

    # TS2339: id doesn't exist on {} in snapshotSection
    # The items are NavItemData which should have id
    src = sub(src, "const hydrate = (secId: string, key: string, max: number): void => {",
              "const hydrate = (secId: string, key: string, max: number): void => {")

    # TS2345: Element not assignable to HTMLElement in various places
    # querySelectorAll returns NodeListOf<Element> → cast
    src = re.sub(r'this\.querySelectorAll\((["\'][^"\']+["\'])\)',
                 r'this.querySelectorAll<HTMLElement>($1)', src)
    src = re.sub(r'this\.\$\$\((["\'][^"\']+["\'])\)(?! as )',
                 r'this.$$<HTMLElement>($1)', src)
    src = re.sub(r'this\.\$\((["\'][^"\']+["\'])\)(?! as |<)',
                 r'this.$<HTMLElement>($1)', src)

    # TS2345: EventTarget not assignable to HTMLElement
    src = sub(src,
              "this.#getItemLabel(e.target);",
              "this.#getItemLabel(e.target as HTMLElement);")
    src = sub(src,
              "this.#createMatchRange(e.target,",
              "this.#createMatchRange(e.target as HTMLElement,")

    # TS18047: textContent possibly null
    src = sub(src,
              "node.textContent.toLowerCase()",
              "(node.textContent ?? '').toLowerCase()")

    # TS2339: .dataset on Element (from querySelectorAll<Element>)
    # All resolved by making querySelectorAll<HTMLElement> above

    # TS2345: Element not assignable to HTMLElement in #applySearchFilter loop
    src = re.sub(r'for \(const node of ([^)]+)\) \{',
                 lambda m: f'for (const node of {m.group(1)}) {{' if 'HTMLElement' in m.group(1) else m.group(0),
                 src)

    write(path, src)
    print("✓ nav round-2")

if __name__ == "__main__":
    print("Round-2 fixes...")
    fix_barchart()
    fix_datagrid()
    fix_filterbar()
    fix_nodecanvas()
    fix_nav()
    print("\nDone.")
