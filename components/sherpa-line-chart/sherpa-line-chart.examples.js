// Realistic datasets for the live docs examples.

const DAU = Array.from({ length: 14 }, (_, i) => {
  const date = new Date(2026, 0, i + 1).toISOString();
  // Steady growth with weekend dip
  const day = (i % 7);
  const weekend = day === 5 || day === 6 ? 0.78 : 1;
  const value = Math.round((1200 + i * 35) * weekend + Math.sin(i / 2) * 60);
  return { date, value };
});

const REGIONS = ['NA', 'EU', 'APAC'];
const RESPONSE_TIME = [];
for (let i = 0; i < 12; i++) {
  const date = new Date(2026, 1, i + 1).toISOString();
  RESPONSE_TIME.push({ date, region: 'NA',   value: 120 + Math.round(Math.sin(i / 2) * 20) });
  RESPONSE_TIME.push({ date, region: 'EU',   value: 165 + Math.round(Math.cos(i / 2) * 25) });
  RESPONSE_TIME.push({ date, region: 'APAC', value: 220 + Math.round(Math.sin(i / 1.5) * 35) });
}

const STORAGE = Array.from({ length: 12 }, (_, i) => ({
  date:  new Date(2026, i, 1).toISOString(),
  value: Math.round(8.4 + i * 1.6 + Math.sin(i) * 0.5),
}));

const setRows = (root, rows) =>
  root.querySelector('sherpa-line-chart')?.setData?.({ rows });

export default {
  'daily-active-users':     (root) => setRows(root, DAU),
  'response-time-regions':  (root) => setRows(root, RESPONSE_TIME),
  'storage-growth':         (root) => setRows(root, STORAGE),
};
