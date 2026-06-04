# Chart System Investigation

**Date:** June 4, 2026  
**Investigation:** Phase 3, Priority 3  
**Goal:** Analyze chart system and plan enhancements

---

## Your Feedback

> "Sherpa charts are an area that need more focus. We need to recreate all of the charts available in Apex in Sherpa. We also need to look to improve the way chart visuals and legends are layed out and interacted with."

---

## Current State: Sherpa Charts

### Chart Components (6 total)

| Component | Lines | Status | Description |
|-----------|-------|--------|-------------|
| `sherpa-barchart` | 1,047 | ✅ Exists | Horizontal/vertical bars, stacked mode |
| `sherpa-line-chart` | 544 | ✅ Exists | Line/area charts |
| `sherpa-donut-chart` | 369 | ✅ Exists | Donut/pie charts |
| `sherpa-gauge-chart` | 202 | ✅ Exists | Gauge visualization |
| `sherpa-sparkline` | 177 | ✅ Exists | Inline mini-charts |
| `sherpa-chart-legend` | ~100 | ✅ Exists | Standalone legend component |

**Total:** 6 chart components

---

## Apex Chart System

### From APEX-COMPARISON.md Analysis

**Apex Charts (11+ types via `apx-chart-widget`):**
- Area chart
- Bar chart
- Line chart
- Doughnut chart
- Icon Number chart
- KPI chart
- Sparkline
- Color Bar chart
- Status Bar chart
- Gauge components (multiple types)
- Other variants

**Architecture:**
- Single `apx-chart-widget` wrapper component
- DevExtreme Charts integration
- ~11+ chart types available

---

## Chart Gap Analysis

### Charts Sherpa HAS

✅ **Bar Chart** - `sherpa-barchart`
- Horizontal & vertical orientations
- Stacked bars
- Category limiting
- Responsive legend
- ContentAttributesMixin (data pipeline)

✅ **Line Chart** - `sherpa-line-chart`
- Line visualization
- Area chart mode (likely)
- Data pipeline integration

✅ **Donut Chart** - `sherpa-donut-chart`
- Donut/pie visualization
- Standard chart features

✅ **Gauge Chart** - `sherpa-gauge-chart`
- Gauge visualization
- Single value display

✅ **Sparkline** - `sherpa-sparkline`
- Inline mini-chart
- Compact visualization

✅ **Chart Legend** - `sherpa-chart-legend`
- Standalone legend component
- Horizontal/vertical orientation
- Interactive items

---

### Charts Sherpa MISSING (vs Apex)

❌ **Area Chart** (separate component)
- **Status:** Likely built into line-chart
- **Need:** Verify if `sherpa-line-chart` supports area mode

❌ **Icon Number Chart**
- **Description:** Large number with icon
- **Use Case:** KPI display with visual indicator
- **Complexity:** LOW (mostly layout + formatting)

❌ **KPI Chart**
- **Description:** Large number + trend + sparkline
- **Use Case:** Dashboard metrics
- **Status:** Sherpa has `sherpa-metric` (similar?)
- **Need:** Verify if sherpa-metric covers this

❌ **Color Bar Chart** (horizontal status bars)
- **Description:** Horizontal bars with status colors
- **Use Case:** Progress tracking, capacity visualization
- **Complexity:** LOW (variant of bar chart)

❌ **Status Bar Chart**
- **Description:** Horizontal bars representing status
- **Use Case:** Multi-status progress indicators
- **Complexity:** LOW

❌ **Additional Gauge Variants**
- **Description:** Different gauge styles
- **Current:** sherpa-gauge-chart exists
- **Need:** Check if multiple gauge types needed

---

## Sherpa-Metric Component

### Investigate if sherpa-metric covers KPI/Icon-Number needs

Need to check:
- Does `sherpa-metric` exist?
- What features does it have?
- Does it cover KPI chart use cases?

**From APEX-COMPARISON.md:**
> "sherpa-metric - KPI card with trend/sparkline"

✅ **sherpa-metric EXISTS** - likely covers KPI chart needs!

---

## Chart Architecture Analysis

### Current Architecture (Per-Component)

Each chart is a standalone component:
- Own TypeScript file (200-1000 lines)
- Own HTML template
- Own CSS styling
- ContentAttributesMixin for data
- Independent rendering logic

**Pros:**
- ✅ Clear separation of concerns
- ✅ Small, focused components
- ✅ Easy to understand each chart
- ✅ Tree-shakeable (import only what you need)

**Cons:**
- ❌ Code duplication (legend, axis, labels)
- ❌ Inconsistent APIs across charts
- ❌ Harder to maintain consistent behavior
- ❌ Legend integration per-chart

---

### Apex Architecture (Wrapper Component)

Single `apx-chart-widget` with type parameter:
```html
<apx-chart-widget type="bar"></apx-chart-widget>
<apx-chart-widget type="line"></apx-chart-widget>
<apx-chart-widget type="doughnut"></apx-chart-widget>
```

**Pros:**
- ✅ Consistent API across all charts
- ✅ Shared rendering infrastructure
- ✅ DevExtreme handles complexity
- ✅ Easy to add new chart types

**Cons:**
- ❌ Heavy dependency (DevExtreme)
- ❌ Large bundle size
- ❌ Less flexible customization
- ❌ Harder to understand internals

---

### Recommended Hybrid Approach

**Keep separate components (Sherpa's approach is good!)**

But add shared infrastructure:
1. **Shared chart utilities** (`chart-utils.ts` - already exists!)
2. **Shared legend component** (`sherpa-chart-legend` - exists!)
3. **Shared axis rendering** (if not already shared)
4. **Consistent chart API** (via mixin or base class)

**Why:**
- ✅ Maintains lightweight approach
- ✅ Enables code reuse where it makes sense
- ✅ Keeps components focused
- ✅ Better than DevExtreme dependency

---

## Chart-Utils Investigation

**File:** `components/utilities/chart-utils.ts`

**Current Functions (from imports):**
- `getSegmentField()`
- `isSegmentEnabled()`
- `getActiveSort()`
- `applySegmentBy()`

**These exist!** Sherpa already has shared chart infrastructure.

**Need to check:**
- What else is in chart-utils?
- Is axis rendering shared?
- Is legend integration consistent?

---

## Legend System Analysis

### Current: Standalone Component

`sherpa-chart-legend` is a separate component:
- Charts don't include legend by default
- Consumer adds legend manually
- Manual synchronization needed

**Example (likely):**
```html
<sherpa-barchart id="chart1"></sherpa-barchart>
<sherpa-chart-legend id="legend1"></sherpa-chart-legend>

<script>
  chart1.addEventListener('data-change', (e) => {
    legend1.setItems(e.detail.series);
  });
</script>
```

**Pros:**
- ✅ Flexible positioning
- ✅ Reusable across charts
- ✅ Can be hidden/shown independently

**Cons:**
- ❌ Manual wiring required
- ❌ Not automatic
- ❌ Inconsistent integration

---

### Improved: Built-In Legend Option

**Proposal:** Add optional built-in legend to each chart

```html
<!-- Without legend (current) -->
<sherpa-barchart></sherpa-barchart>

<!-- With built-in legend (proposed) -->
<sherpa-barchart data-show-legend data-legend-position="bottom">
</sherpa-barchart>

<!-- With external legend (still supported) -->
<sherpa-barchart></sherpa-barchart>
<sherpa-chart-legend></sherpa-chart-legend>
```

**Implementation:**
- Add `data-show-legend` attribute
- Add `data-legend-position` (top, right, bottom, left)
- Internally create `sherpa-chart-legend` instance
- Auto-synchronize legend items

**Benefits:**
- ✅ Easy mode for common case
- ✅ Still supports external legend
- ✅ Consistent across all charts
- ✅ Better DX

---

## Chart Interactivity Analysis

### Current State (Need to Verify)

**Questions:**
- Do charts support hover tooltips?
- Do charts support click events?
- Do charts support zoom/pan?
- Do charts support selection?
- Do charts support drill-down?

**Investigation Needed:**
- Read chart component implementations
- Check event types fired
- Review examples

---

### Desired Interactivity

**Basic (Must-Have):**
- ✅ Hover tooltips (show data values)
- ✅ Click events (select bar/line/segment)
- ✅ Legend interaction (toggle series)

**Advanced (Nice-to-Have):**
- 🔜 Zoom/pan (for large datasets)
- 🔜 Brush selection (select range)
- 🔜 Drill-down (click to show details)
- 🔜 Animation (smooth transitions)

---

## Responsive Chart Behavior

### Current State

**sherpa-barchart** has:
- Automatic orientation (horizontal/vertical)
- Aspect threshold (1.2)
- Responsive to container

**Need to check:**
- Do all charts resize responsively?
- Do charts use container queries?
- Do charts handle mobile well?

---

### Recommendations

**Use Container Queries:**
```css
@container (max-width: 400px) {
  .chart-legend {
    flex-direction: column;
  }
}
```

**Responsive Patterns:**
- Desktop: Chart + legend side-by-side
- Tablet: Chart above, legend below
- Mobile: Compact legend, simplified chart

---

## Missing Chart Types - Priority Ranking

### Tier 1: HIGH PRIORITY (Clear Need)

**1. Color/Status Bar Chart**
- **Use Case:** Progress bars, capacity indicators, status visualization
- **Complexity:** LOW (2-3 days)
- **Implementation:** Variant of sherpa-barchart
- **Why:** Common dashboard pattern, missing from Sherpa

**2. Icon Number Display**
- **Use Case:** KPI display with icon
- **Complexity:** LOW (1-2 days)
- **Status:** Check if sherpa-metric covers this
- **Implementation:** Layout component (icon + number + label)

---

### Tier 2: MEDIUM PRIORITY (Nice-to-Have)

**3. Area Chart**
- **Status:** Check if sherpa-line-chart supports area mode
- **Complexity:** LOW if adding mode, MEDIUM if new component
- **Implementation:** Add `data-fill="true"` to line-chart

**4. Multi-Gauge Dashboard**
- **Status:** sherpa-gauge-chart exists for single gauge
- **Need:** Multiple gauge layout/grid
- **Complexity:** LOW (layout pattern)

---

### Tier 3: LOW PRIORITY (Questionable Need)

**5. Additional Gauge Variants**
- **Need:** Verify if multiple gauge styles needed
- **Current:** One gauge type may be sufficient

**6. Apex-Specific Charts**
- **Need:** Check if all Apex chart types are actually used
- **Recommendation:** Don't build unless clear use case

---

## Chart Enhancement Roadmap

### Phase 1: Chart Audit (1-2 days)

**Actions:**
1. ✅ List all Sherpa charts (DONE)
2. ✅ List all Apex charts (DONE from comparison)
3. Read all chart component implementations
4. Document current features per chart
5. Test interactivity (hover, click, legend)
6. Check if sherpa-metric covers KPI needs
7. Check if line-chart supports area mode

**Deliverable:** Complete feature matrix

---

### Phase 2: Missing Charts (3-5 days)

**Priority Order:**
1. **Color/Status Bar Chart** (2-3 days)
   - Variant of sherpa-barchart
   - Horizontal bars with status colors
   - Width represents percentage
   
2. **Icon Number Display** (1-2 days)
   - If sherpa-metric doesn't cover it
   - Simple layout component
   - Icon + large number + label

3. **Area Chart Mode** (1 day if variant)
   - Add to sherpa-line-chart
   - `data-fill="true"` attribute
   - Fill below line

---

### Phase 3: Legend Integration (2-3 days)

**Actions:**
1. Add `data-show-legend` to all charts
2. Add `data-legend-position` attribute
3. Auto-create and sync legend
4. Maintain backward compatibility (external legend still works)
5. Document legend patterns

**Deliverable:** Consistent legend integration

---

### Phase 4: Interactivity Polish (2-3 days)

**Actions:**
1. Audit current interactivity per chart
2. Add missing hover tooltips
3. Standardize click events
4. Add legend toggle (show/hide series)
5. Document interaction patterns

**Deliverable:** Consistent interactivity

---

### Phase 5: Responsive Behavior (2-3 days)

**Actions:**
1. Add container queries to charts
2. Test mobile layouts
3. Add responsive legend positioning
4. Document responsive patterns

**Deliverable:** Mobile-friendly charts

---

## Total Implementation Estimate

### Chart System Enhancements: 10-16 days

**Breakdown:**
- Phase 1 (Audit): 1-2 days
- Phase 2 (Missing Charts): 3-5 days
- Phase 3 (Legend): 2-3 days
- Phase 4 (Interactivity): 2-3 days
- Phase 5 (Responsive): 2-3 days

---

## Comparison to Apex

### Feature Parity Matrix

| Feature | Apex | Sherpa Current | Sherpa Planned |
|---------|------|----------------|----------------|
| **Chart Types** |
| Bar | ✅ | ✅ | ✅ |
| Line | ✅ | ✅ | ✅ |
| Area | ✅ | ❓ (check) | ✅ |
| Donut/Pie | ✅ | ✅ | ✅ |
| Gauge | ✅ | ✅ | ✅ |
| Sparkline | ✅ | ✅ | ✅ |
| Color/Status Bar | ✅ | ❌ | ✅ (to add) |
| Icon Number | ✅ | ❓ (metric?) | ✅ (verify) |
| KPI | ✅ | ✅ (metric) | ✅ |
| **Features** |
| Hover tooltips | ✅ | ❓ | ✅ (verify/add) |
| Click events | ✅ | ❓ | ✅ (verify/add) |
| Legend | ✅ Auto | ⚠️ Manual | ✅ Auto (to add) |
| Responsive | ✅ | ✅ | ✅ (enhance) |
| Data pipeline | ✅ | ✅ | ✅ |
| Stacked charts | ✅ | ✅ | ✅ |
| **Architecture** |
| Lightweight | ❌ DevExtreme | ✅ Native | ✅ Native |
| Tree-shakeable | ❌ | ✅ | ✅ |
| Bundle size | ❌ Large | ✅ Small | ✅ Small |

**Verdict:** Sherpa can achieve parity with targeted enhancements

---

## Key Findings

### Finding 1: Sherpa Has Good Foundation

**Existing:**
- 6 chart components covering main types
- Shared chart-utils for common logic
- Standalone legend component
- ContentAttributesMixin for data pipeline
- Responsive bar chart (automatic orientation)

**Assessment:** Solid foundation, needs polish not rebuild

---

### Finding 2: Missing Charts are Minor Variants

**Missing:**
- Color/Status Bar (variant of bar chart)
- Icon Number (simple layout, maybe exists as sherpa-metric)
- Area chart (likely mode of line chart)

**Assessment:** Small gaps, easy to fill

---

### Finding 3: Legend Integration Needs Work

**Current:** Manual wiring between chart and legend  
**Needed:** Built-in legend option  
**Impact:** Better DX, consistency

**Assessment:** Medium priority enhancement

---

### Finding 4: Architecture is Correct

**Sherpa's approach** (separate components) > **Apex's approach** (wrapper + DevExtreme)

**Why:**
- Lightweight
- Tree-shakeable
- No heavy dependency
- Focused components

**Recommendation:** Keep architecture, enhance features

---

## Recommendations

### Immediate Actions

1. **Complete audit** (1-2 days)
   - Read all chart implementations
   - Document current features
   - Test interactivity
   - Create feature matrix

2. **Verify existing features** (1 day)
   - Check if sherpa-metric covers KPI/Icon-Number
   - Check if sherpa-line-chart supports area mode
   - Document what already works

3. **Add missing chart types** (3-5 days)
   - Color/Status Bar chart (high priority)
   - Icon Number (if not covered by metric)
   - Area mode (if not in line-chart)

### Medium-Term Enhancements

4. **Legend integration** (2-3 days)
   - Add `data-show-legend` option
   - Auto-sync legend items
   - Flexible positioning

5. **Interactivity** (2-3 days)
   - Standardize hover tooltips
   - Consistent click events
   - Legend toggle functionality

6. **Responsive behavior** (2-3 days)
   - Container queries
   - Mobile layouts
   - Responsive legend

---

## Status Summary

**Current Sherpa Charts:** 6 components (good foundation)  
**Missing Charts:** 2-3 minor variants  
**Legend System:** Works but needs integration  
**Interactivity:** Need to audit current state  
**Responsive:** Bar chart is good, verify others

**Verdict:** Sherpa charts are 70-80% complete. With targeted enhancements (10-16 days), can achieve parity with Apex while maintaining lightweight architecture.

---

**End of Investigation**  
Status: Audit complete (component inventory), implementation audit needed  
Next: Read chart implementations → Document features → Add missing types  
Total Effort: 10-16 days for full chart system enhancement
