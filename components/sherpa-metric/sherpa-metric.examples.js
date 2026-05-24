/**
 * sherpa-metric.examples.js — Setup callbacks for the live docs examples.
 *
 * Keys here match `data-setup="…"` on <template> elements in
 * sherpa-metric.examples.html. The docs router calls each fn with the
 * preview wrapper after components have rendered.
 */

// Simple helper: linear ramp with a small random walk for realism
function ramp(start, end, n = 20) {
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const noise = (Math.random() - 0.5) * Math.abs(step) * 0.6;
    return Math.max(0, start + step * i + noise);
  });
}

export default {
  async "with-sparklines"(root) {
    const configs = [
      { name: 'Devices online', summary: { total: 1284, delta:  136, deltaPercent:  11.8, values: ramp(1148, 1284) }, config: {} },
      { name: 'Open alerts',    summary: { total:    7, delta:   -7, deltaPercent: -50.0, values: ramp(14, 7) },    config: {} },
    ];
    const metrics = root.querySelectorAll('sherpa-metric[data-sparkline]');
    metrics.forEach((m, i) => {
      const cfg = configs[i];
      if (cfg) m.setData(cfg);
    });
  },

  async "with-data"(root) {
    const src = root.querySelector('[data-dataset="metrics"]');
    if (!src) return;

    const res = await fetch('/demo/fixtures/metrics.json');
    if (!res.ok) return;
    const { columns, rows } = await res.json();

    src._fields   = columns.map(c => ({ name: c.field, label: c.label, type: c.type }));
    src._filtered = rows;

    src.dispatchEvent(new CustomEvent('dataset-filtered', {
      bubbles:  false,
      composed: false,
      detail: { records: rows, fields: src._fields },
    }));
  },
};
