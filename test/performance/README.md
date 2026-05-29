# Performance Benchmarks

> **Measure and monitor component performance**

---

## Overview

Performance benchmarking suite for Sherpa UI components. Measures instantiation time, rendering performance, memory usage, and validates against performance budgets.

---

## Quick Start

### Browser UI (Recommended)

```bash
# Open in browser
open test/performance/run-benchmarks.html
```

Click "Run All Benchmarks" or "Quick Test" to start.

### Command Line (CI/CD)

```bash
# Run all benchmarks (headless)
npm run benchmark

# Save current results as baseline
npm run benchmark:baseline

# Compare with baseline
npm run benchmark:compare
```

---

## Performance Budgets

Default budgets (95th percentile):

| Metric | Budget | Description |
|--------|--------|-------------|
| **Instantiation** | < 5ms | Component creation time |
| **Shadow DOM** | < 3ms | Shadow root attachment |
| **Stylesheet Adoption** | < 2ms | CSS loading time |
| **Rendering** | < 50ms | Initial render complete |
| **Large List (1000)** | < 200ms | 1000 item rendering |
| **Nested Tree (depth 5)** | < 100ms | 5-level deep tree |

---

## What Gets Measured

### Component Lifecycle
- **Instantiation** — `document.createElement()` time
- **Shadow DOM** — Shadow root attachment overhead
- **Rendering** — First paint to interactive

### Rendering Performance
- **Simple Components** — Button, input, tag
- **Complex Components** — Calendar, data-grid, container
- **Large Lists** — 1000+ items
- **Nested Trees** — Deep component hierarchies

### Memory Usage (Chrome only)
- **Heap allocation** — Memory per component instance
- **Total footprint** — 100 instances memory usage

---

## Benchmark Suite

### Core Component Benchmarks

```javascript
// Instantiation
benchmarks.benchmarkInstantiation('sherpa-button', './sherpa-button.js');

// Shadow DOM
benchmarks.benchmarkShadowDOM('sherpa-button', './sherpa-button.js');

// Rendering
benchmarks.benchmarkRendering(
  'sherpa-button',
  './sherpa-button.js',
  '<sherpa-button>Click</sherpa-button>'
);

// Memory
benchmarks.benchmarkMemory('sherpa-button', './sherpa-button.js', 100);
```

### Large List Benchmark

```javascript
benchmarks.benchmarkLargeList(1000); // 1000 items
```

### Nested Tree Benchmark

```javascript
benchmarks.benchmarkNestedTree(5); // 5 levels deep
```

### Calendar Grid Benchmark

```javascript
benchmarks.benchmarkCalendarGrid(); // Full month grid
```

---

## Results Format

### Statistics

Each benchmark reports:
- **Mean** — Average duration
- **Median** — Middle value (50th percentile)
- **Min** — Fastest run
- **Max** — Slowest run
- **P95** — 95th percentile (budget threshold)
- **P99** — 99th percentile

### Budget Check

```javascript
{
  name: "sherpa-button instantiation",
  budget: 5,           // ms
  actual: 2.3,         // ms (P95)
  passed: true,
  margin: 2.7,         // ms under budget
  percentage: 54       // % under budget
}
```

### JSON Export

```json
{
  "summary": {
    "total": 12,
    "passed": 11,
    "failed": 1,
    "passRate": "91.7"
  },
  "results": {
    "sherpa-button-instantiation": {
      "min": 1.2,
      "max": 3.5,
      "mean": 2.1,
      "median": 2.0,
      "p95": 2.8,
      "p99": 3.2
    }
  },
  "budgetChecks": [...],
  "timestamp": "2026-05-28T..."
}
```

---

## Performance Budgets

Edit `test/performance/benchmark-suite.js`:

```javascript
const BUDGETS = {
  instantiation: 5,      // Increase if needed
  shadowDom: 3,
  stylesheetAdoption: 2,
  rendering: 50,
  largeList: 200,
  nestedTree: 100,
};
```

---

## Baseline Comparison

### Save Baseline

```bash
npm run benchmark:baseline
```

Creates `test/performance/baseline.json`

### Compare with Baseline

```bash
npm run benchmark:compare
```

Output:
```
📊 Performance Comparison:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 sherpa-button instantiation: 0.5ms faster (20.0%)
🔴 sherpa-calendar rendering: 2.3ms slower (15.3%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Performance regressions detected: 1
```

### CI Integration

```yaml
- name: Run performance benchmarks
  run: npm run benchmark

- name: Compare with baseline
  run: npm run benchmark:compare
  if: github.event_name == 'pull_request'
```

---

## Interpreting Results

### Good Performance

```
✅ sherpa-button instantiation: 2.30ms / 5ms (54.0% under budget)
```
- P95 well under budget
- Consistent across runs (low variance)

### Performance Warning

```
⚠️ sherpa-calendar rendering: 48.50ms / 50ms (3.0% under budget)
```
- Near budget threshold
- May fail with slight variance
- Consider optimization

### Budget Failure

```
❌ sherpa-data-grid rendering: 65.20ms / 50ms (30.4% over budget)
```
- Exceeds budget
- Needs optimization
- May block CI

---

## Optimization Tips

### Slow Instantiation
- Reduce constructor work
- Defer non-critical initialization
- Use lazy loading

### Slow Shadow DOM
- Minimize initial DOM nodes
- Simplify template structure
- Use template caching

### Slow Rendering
- Optimize CSS selectors
- Reduce layout thrashing
- Use `requestAnimationFrame`
- Batch DOM updates

### High Memory Usage
- Reduce event listeners
- Clean up references
- Use WeakMap for caches
- Lazy-load non-critical features

---

## Adding Custom Benchmarks

### 1. Add to `benchmark-suite.js`

```javascript
async benchmarkCustomComponent() {
  await import('../../components/my-component/my-component.js');

  const stats = await runAsyncBenchmark('custom', async () => {
    // Your benchmark code
  });

  this.results['custom'] = stats;
  this.budgetChecks.push(
    checkBudget(stats, BUDGETS.rendering, 'Custom component')
  );

  return stats;
}
```

### 2. Call from runner

```javascript
await benchmarks.benchmarkCustomComponent();
```

---

## Troubleshooting

### Benchmarks not running?
- Check browser console for errors
- Verify component paths are correct
- Ensure all dependencies loaded

### Inconsistent results?
- Close other browser tabs
- Disable browser extensions
- Run multiple times (variance is normal)
- Check for background processes

### Memory benchmarks not working?
- Chrome/Edge only feature (`performance.memory`)
- Enable via flag: `--enable-precise-memory-info`
- Firefox/Safari don't support this API

---

## Best Practices

1. **Run on clean system** — Close unnecessary apps
2. **Multiple runs** — Results vary, look at P95/P99
3. **Baseline early** — Save before making changes
4. **Track over time** — Monitor for regressions
5. **Budget realistically** — Too tight = false failures
6. **Optimize smartly** — Profile before optimizing

---

## Resources

- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [Performance Budgets](https://web.dev/performance-budgets-101/)
- [User Timing API](https://developer.mozilla.org/en-US/docs/Web/API/User_Timing_API)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

---

**Last Updated:** 2026-05-28  
**Benchmark Framework:** Custom (Performance API)  
**Browser Support:** Chrome, Firefox, Safari, Edge
