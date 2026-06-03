#!/usr/bin/env python3
"""
Targeted round-3 fixes for barchart's remaining type errors.
"""
import re
from pathlib import Path

path = Path(__file__).parent.parent / "components/sherpa-barchart/sherpa-barchart.ts"
src = path.read_text()

# ─── TS4111: dot access on index-signature type — switch to bracket access ───
# In setData body, data.originalOrderBy / data.orderBy / data.orderDirection / data.originalSegmentBy / data.segmentBy
for prop in ['originalOrderBy', 'originalSegmentBy', 'orderBy', 'orderDirection', 'segmentBy']:
    # data?.PROP  → data?.['PROP']
    src = src.replace(f'data?.{prop})', f"data?.['{prop}')")
    src = src.replace(f'data?.{prop} ', f"data?.['{prop}'] ")
    src = src.replace(f'data?.{prop},', f"data?.['{prop}'],")
    src = src.replace(f'data.{prop})', f"data['{prop}')")
    src = src.replace(f'data.{prop} ', f"data['{prop}'] ")
    src = src.replace(f'data.{prop},', f"data['{prop}'],")
    src = src.replace(f'data.{prop};', f"data['{prop}'];")

# ─── TS2345 at line 436: argument to #applyOrderByFromConfig is not BarData ──
# The call passes {categories, series, stacked: false} but param is BarData
# Fix: change param type to accept partial or change function
src = src.replace(
    "#applyOrderByFromConfig(data: BarData | null): BarData | null {",
    "#applyOrderByFromConfig(data: Partial<BarData> | null): Partial<BarData> | null {"
)

# ─── TS18047: data possibly null inside #applyOrderByFromConfig ───────────────
# Add null guard at start of function — already returns early if activeSort
# but data.categories and data.series are accessed. Add `if (!data) return data;`
src = src.replace(
    "#applyOrderByFromConfig(data: Partial<BarData> | null): Partial<BarData> | null {\n    // If user has set a sort, skip config orderBy\n    const activeSort = getActiveSort(this);\n    if (activeSort) return data;",
    "#applyOrderByFromConfig(data: Partial<BarData> | null): Partial<BarData> | null {\n    if (!data) return null;\n    // If user has set a sort, skip config orderBy\n    const activeSort = getActiveSort(this);\n    if (activeSort) return data;"
)

# ─── TS2322: #applyLocalSort needs non-null data ─────────────────────────────
src = src.replace(
    "return this.#applyLocalSort(ordered);",
    "return ordered ? this.#applyLocalSort(ordered as BarData) : null;"
)

# ─── TS2322 line 572: series name type — String() the label ─────────────────
src = src.replace(
    "    const series = orderedSegments.map((segLabel) => ({\n      name: segLabel,",
    "    const series = orderedSegments.map((segLabel) => ({\n      name: String(segLabel),",
)

# ─── TS2322 line 615: string | undefined not assignable to string | null ─────
# preferred.field returns string | undefined; the return type says string | null
src = src.replace(
    "    if (preferred) return preferred.field;",
    "    if (preferred) return preferred.field ?? null;"
)

# ─── TS2578: remove the 3 remaining stale @ts-expect-error directives ────────
# These are on lines that no longer have errors. Find by the specific next-line pattern.
lines = src.split('\n')
cleaned = []
i = 0
while i < len(lines):
    line = lines[i]
    if '// @ts-expect-error - TODO: Fix type' in line and i + 1 < len(lines):
        next_line = lines[i + 1] if i + 1 < len(lines) else ''
        # Line 439 pattern: #applyOrderByFromConfig with typed params
        if '#applyOrderByFromConfig(data:' in next_line:
            i += 1  # skip the @ts-expect-error
            continue
        # Line 577 pattern: #formatLabel with typed params
        if '#formatLabel(value: unknown)' in next_line:
            i += 1
            continue
        # Line 618 pattern: numericCols.find with typed callback
        if 'numericCols.find((col: ChartColumn)' in next_line:
            i += 1
            continue
    cleaned.append(line)
    i += 1
src = '\n'.join(cleaned)

# ─── Fix callers of #applyLocalSort with null ────────────────────────────────
# #applyLocalSort(data: BarData) but we now pass null — guard it
src = src.replace(
    "#applyLocalSort(data: BarData): BarData {",
    "#applyLocalSort(data: BarData | null): BarData | null {"
)
# Guard at the top
src = src.replace(
    "#applyLocalSort(data: BarData | null): BarData | null {\n    const activeSort = getActiveSort(this);",
    "#applyLocalSort(data: BarData | null): BarData | null {\n    if (!data) return null;\n    const activeSort = getActiveSort(this);"
)

# Fix callers of #applyLocalSort that need non-null
src = src.replace(
    "return this.#applyLocalSort(data);",
    "return data ? this.#applyLocalSort(data) : null;"
)

path.write_text(src)
print("✓ barchart round-3")

# Now verify
import subprocess
result = subprocess.run(
    ['npx', 'tsc', '--noEmit', '-p', 'tsconfig.json'],
    capture_output=True, text=True,
    cwd=path.parent.parent
)
barchart_errors = [l for l in (result.stdout + result.stderr).split('\n')
                   if 'sherpa-barchart' in l and 'error TS' in l]
print(f"barchart errors remaining: {len(barchart_errors)}")
for e in barchart_errors[:10]:
    print(' ', e)
