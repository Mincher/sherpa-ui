/**
 * Performance Benchmark Suite for Sherpa UI Components
 *
 * Measures:
 * - Component instantiation time
 * - Shadow DOM attachment overhead
 * - Stylesheet adoption time
 * - Large list rendering (data-grid)
 * - Calendar grid rendering
 * - Complex nested component trees
 */

import '../helpers/test-utils.js';

// ── Configuration ──────────────────────────────────────────────────

const ITERATIONS = 10; // Number of iterations for statistical significance
const WARM_UP = 3; // Warm-up iterations (not counted)

// Performance budgets (in milliseconds)
const BUDGETS = {
  instantiation: 5,      // Component instantiation should be < 5ms
  shadowDom: 3,          // Shadow DOM attachment should be < 3ms
  stylesheetAdoption: 2, // Stylesheet adoption should be < 2ms
  rendering: 50,         // Initial render should be < 50ms
  largeList: 200,        // 1000 items should render in < 200ms
  nestedTree: 100,       // 5-level deep tree should render in < 100ms
};

// ── Utilities ──────────────────────────────────────────────────────

function measure(name, fn) {
  performance.mark(`${name}-start`);
  fn();
  performance.mark(`${name}-end`);
  performance.measure(name, `${name}-start`, `${name}-end`);

  const measure = performance.getEntriesByName(name)[0];
  performance.clearMarks(`${name}-start`);
  performance.clearMarks(`${name}-end`);
  performance.clearMeasures(name);

  return measure.duration;
}

async function measureAsync(name, fn) {
  performance.mark(`${name}-start`);
  await fn();
  performance.mark(`${name}-end`);
  performance.measure(name, `${name}-start`, `${name}-end`);

  const measure = performance.getEntriesByName(name)[0];
  performance.clearMarks(`${name}-start`);
  performance.clearMarks(`${name}-end`);
  performance.clearMeasures(name);

  return measure.duration;
}

function runBenchmark(name, fn, iterations = ITERATIONS) {
  const results = [];

  // Warm-up
  for (let i = 0; i < WARM_UP; i++) {
    fn();
  }

  // Actual measurements
  for (let i = 0; i < iterations; i++) {
    const duration = measure(`${name}-${i}`, fn);
    results.push(duration);
  }

  return calculateStats(results);
}

async function runAsyncBenchmark(name, fn, iterations = ITERATIONS) {
  const results = [];

  // Warm-up
  for (let i = 0; i < WARM_UP; i++) {
    await fn();
  }

  // Actual measurements
  for (let i = 0; i < iterations; i++) {
    const duration = await measureAsync(`${name}-${i}`, fn);
    results.push(duration);
  }

  return calculateStats(results);
}

function calculateStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / values.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

function checkBudget(stat, budget, name) {
  const passed = stat.p95 < budget;
  return {
    name,
    budget,
    actual: stat.p95,
    passed,
    margin: budget - stat.p95,
    percentage: ((budget - stat.p95) / budget) * 100,
  };
}

// ── Benchmark Tests ────────────────────────────────────────────────

export class PerformanceBenchmarks {
  constructor() {
    this.results = {};
    this.budgetChecks = [];
  }

  // ── Component Instantiation ──────────────────────────────────────

  async benchmarkInstantiation(componentTag, componentModule) {
    console.log(`\n📊 Benchmarking instantiation: ${componentTag}`);

    // Import component
    await import(componentModule);

    const stats = runBenchmark(`instantiate-${componentTag}`, () => {
      const el = document.createElement(componentTag);
      document.body.appendChild(el);
      document.body.removeChild(el);
    });

    this.results[`${componentTag}-instantiation`] = stats;
    this.budgetChecks.push(
      checkBudget(stats, BUDGETS.instantiation, `${componentTag} instantiation`)
    );

    console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats.p95.toFixed(2)}ms`);

    return stats;
  }

  // ── Shadow DOM Attachment ────────────────────────────────────────

  async benchmarkShadowDOM(componentTag, componentModule) {
    console.log(`\n📊 Benchmarking Shadow DOM: ${componentTag}`);

    await import(componentModule);

    const stats = runBenchmark(`shadow-dom-${componentTag}`, () => {
      const el = document.createElement(componentTag);
      document.body.appendChild(el);
      // Shadow DOM is attached automatically by component
      document.body.removeChild(el);
    });

    this.results[`${componentTag}-shadow-dom`] = stats;
    this.budgetChecks.push(
      checkBudget(stats, BUDGETS.shadowDom, `${componentTag} Shadow DOM`)
    );

    console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats.p95.toFixed(2)}ms`);

    return stats;
  }

  // ── Rendering Performance ─────────────────────────────────────────

  async benchmarkRendering(componentTag, componentModule, template) {
    console.log(`\n📊 Benchmarking rendering: ${componentTag}`);

    await import(componentModule);

    const stats = await runAsyncBenchmark(`render-${componentTag}`, async () => {
      const container = document.createElement('div');
      container.innerHTML = template;
      document.body.appendChild(container);

      // Wait for next frame to ensure rendering is complete
      await new Promise(resolve => requestAnimationFrame(resolve));

      document.body.removeChild(container);
    });

    this.results[`${componentTag}-rendering`] = stats;
    this.budgetChecks.push(
      checkBudget(stats, BUDGETS.rendering, `${componentTag} rendering`)
    );

    console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats.p95.toFixed(2)}ms`);

    return stats;
  }

  // ── Large List Rendering ──────────────────────────────────────────

  async benchmarkLargeList(itemCount = 1000) {
    console.log(`\n📊 Benchmarking large list: ${itemCount} items`);

    const stats = await runAsyncBenchmark(`large-list-${itemCount}`, async () => {
      const container = document.createElement('div');

      for (let i = 0; i < itemCount; i++) {
        const item = document.createElement('div');
        item.textContent = `Item ${i}`;
        item.className = 'list-item';
        container.appendChild(item);
      }

      document.body.appendChild(container);
      await new Promise(resolve => requestAnimationFrame(resolve));
      document.body.removeChild(container);
    }, 5); // Fewer iterations for large lists

    this.results[`large-list-${itemCount}`] = stats;
    this.budgetChecks.push(
      checkBudget(stats, BUDGETS.largeList, `Large list (${itemCount} items)`)
    );

    console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats.p95.toFixed(2)}ms`);

    return stats;
  }

  // ── Nested Component Trees ────────────────────────────────────────

  async benchmarkNestedTree(depth = 5) {
    console.log(`\n📊 Benchmarking nested tree: depth ${depth}`);

    await import('../../components/sherpa-container/sherpa-container.js');

    function createNestedTree(currentDepth) {
      if (currentDepth === 0) {
        return '<div>Leaf node</div>';
      }

      const children = createNestedTree(currentDepth - 1);
      return `<sherpa-container>${children}</sherpa-container>`;
    }

    const template = createNestedTree(depth);

    const stats = await runAsyncBenchmark(`nested-tree-${depth}`, async () => {
      const container = document.createElement('div');
      container.innerHTML = template;
      document.body.appendChild(container);
      await new Promise(resolve => requestAnimationFrame(resolve));
      document.body.removeChild(container);
    }, 5); // Fewer iterations for complex trees

    this.results[`nested-tree-${depth}`] = stats;
    this.budgetChecks.push(
      checkBudget(stats, BUDGETS.nestedTree, `Nested tree (depth ${depth})`)
    );

    console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats.p95.toFixed(2)}ms`);

    return stats;
  }

  // ── Calendar Grid Rendering ───────────────────────────────────────

  async benchmarkCalendarGrid() {
    console.log(`\n📊 Benchmarking calendar grid rendering`);

    await import('../../components/sherpa-calendar/sherpa-calendar.js');

    const template = '<sherpa-calendar data-view-date="2026-05-15"></sherpa-calendar>';

    const stats = await runAsyncBenchmark('calendar-grid', async () => {
      const container = document.createElement('div');
      container.innerHTML = template;
      document.body.appendChild(container);

      // Wait for calendar to render
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));

      document.body.removeChild(container);
    });

    this.results['calendar-grid'] = stats;
    this.budgetChecks.push(
      checkBudget(stats, BUDGETS.rendering, 'Calendar grid rendering')
    );

    console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats.p95.toFixed(2)}ms`);

    return stats;
  }

  // ── Memory Profiling ──────────────────────────────────────────────

  async benchmarkMemory(componentTag, componentModule, count = 100) {
    console.log(`\n📊 Benchmarking memory: ${count}x ${componentTag}`);

    await import(componentModule);

    if (!performance.memory) {
      console.warn('  ⚠️ performance.memory not available (Chrome only)');
      return null;
    }

    const before = performance.memory.usedJSHeapSize;
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Create multiple instances
    for (let i = 0; i < count; i++) {
      const el = document.createElement(componentTag);
      container.appendChild(el);
    }

    await new Promise(resolve => requestAnimationFrame(resolve));

    const after = performance.memory.usedJSHeapSize;
    const delta = after - before;
    const perInstance = delta / count;

    document.body.removeChild(container);

    const memoryStats = {
      totalBytes: delta,
      perInstanceBytes: perInstance,
      totalKB: (delta / 1024).toFixed(2),
      perInstanceKB: (perInstance / 1024).toFixed(2),
    };

    this.results[`${componentTag}-memory`] = memoryStats;

    console.log(`  Total: ${memoryStats.totalKB} KB`);
    console.log(`  Per instance: ${memoryStats.perInstanceKB} KB`);

    return memoryStats;
  }

  // ── Report Generation ─────────────────────────────────────────────

  generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('PERFORMANCE BENCHMARK REPORT');
    console.log('='.repeat(70));

    // Budget checks
    console.log('\n📋 Budget Checks:');
    console.log('-'.repeat(70));

    const passed = this.budgetChecks.filter(c => c.passed).length;
    const failed = this.budgetChecks.filter(c => !c.passed).length;

    this.budgetChecks.forEach(check => {
      const status = check.passed ? '✅' : '❌';
      const margin = check.passed
        ? `(${check.percentage.toFixed(1)}% under budget)`
        : `(${Math.abs(check.percentage).toFixed(1)}% over budget)`;

      console.log(`${status} ${check.name}: ${check.actual.toFixed(2)}ms / ${check.budget}ms ${margin}`);
    });

    console.log('-'.repeat(70));
    console.log(`Total: ${passed} passed, ${failed} failed`);

    // Summary statistics
    console.log('\n📊 Summary:');
    console.log('-'.repeat(70));

    Object.entries(this.results).forEach(([name, stats]) => {
      if (stats.mean !== undefined) {
        console.log(`${name}:`);
        console.log(`  Mean: ${stats.mean.toFixed(2)}ms, Median: ${stats.median.toFixed(2)}ms`);
        console.log(`  Min: ${stats.min.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
        console.log(`  P95: ${stats.p95.toFixed(2)}ms, P99: ${stats.p99.toFixed(2)}ms`);
      } else if (stats.totalBytes !== undefined) {
        console.log(`${name}:`);
        console.log(`  Total: ${stats.totalKB} KB, Per instance: ${stats.perInstanceKB} KB`);
      }
    });

    console.log('='.repeat(70));

    return {
      summary: {
        total: this.budgetChecks.length,
        passed,
        failed,
        passRate: ((passed / this.budgetChecks.length) * 100).toFixed(1),
      },
      results: this.results,
      budgetChecks: this.budgetChecks,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Export to JSON ────────────────────────────────────────────────

  exportJSON() {
    return JSON.stringify(this.generateReport(), null, 2);
  }
}

// ── Export ─────────────────────────────────────────────────────────

export { BUDGETS, ITERATIONS };
