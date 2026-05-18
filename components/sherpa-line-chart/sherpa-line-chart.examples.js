const TIME_SERIES = Array.from({ length: 12 }, (_, i) => ({
  date:  new Date(2026, 0, i + 1).toISOString(),
  value: Math.round(40 + Math.sin(i / 2) * 25 + i * 2),
}));

export default {
  'line-chart-0': (root) => {
    root.querySelector('sherpa-line-chart')?.setData?.({ rows: TIME_SERIES });
  },
};
