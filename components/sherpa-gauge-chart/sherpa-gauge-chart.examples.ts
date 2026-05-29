// @ts-nocheck
// Realistic datasets for the live docs examples.

export default {
  'quota-series': (root) => {
    root.querySelector('sherpa-gauge-chart')?.setSegments?.([
      { value: 38, color: 'var(--sherpa-surface-context-success-strong-default)' },
      { value: 28, color: 'var(--sherpa-surface-context-info-strong-default)' },
      { value: 16, color: 'var(--sherpa-surface-context-warning-strong-default)' },
    ]);
  },
};
