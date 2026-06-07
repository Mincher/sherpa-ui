// @ts-nocheck
const TIME_SERIES = Array.from({ length: 12 }, (_, i) => ({
  date:  new Temporal.PlainDate(2026, 1, i + 1).toString(),
  value: Math.round(40 + Math.sin(i / 2) * 25 + i * 2),
}));

export default {
  'sparkline-0': (root) => {
    root.querySelector('sherpa-sparkline')?.setData?.({ rows: TIME_SERIES });
  },
};
