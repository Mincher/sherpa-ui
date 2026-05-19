// Realistic datasets for the live docs examples.

const TRAFFIC = [
  { category: 'Organic search', value: 482 },
  { category: 'Direct',         value: 314 },
  { category: 'Email',          value: 196 },
  { category: 'Social',         value: 142 },
  { category: 'Referral',       value:  88 },
];

const ALERTS = [
  { category: 'Critical', value:  4 },
  { category: 'Warning',  value: 12 },
  { category: 'Info',     value: 22 },
];

const PLANS = [
  { category: 'Free',       value: 1240 },
  { category: 'Pro',        value:  482 },
  { category: 'Team',       value:  186 },
  { category: 'Enterprise', value:   42 },
];

const setRows = (root, rows) =>
  root.querySelector('sherpa-donut-chart')?.setData?.({ rows });

export default {
  'traffic-sources':     (root) => setRows(root, TRAFFIC),
  'alerts-by-severity':  (root) => setRows(root, ALERTS),
  'plan-distribution':   (root) => setRows(root, PLANS),
};
