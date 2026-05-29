// @ts-nocheck
// Realistic datasets for the live docs examples.

const TRAFFIC_BY_SOURCE = [
  { category: 'Mon', value: 1240 },
  { category: 'Tue', value: 1380 },
  { category: 'Wed', value: 1510 },
  { category: 'Thu', value: 1420 },
  { category: 'Fri', value: 1680 },
  { category: 'Sat', value: 980 },
  { category: 'Sun', value: 820 },
];

const DEVICES_BY_REGION = [
  { category: 'North America', value: 482 },
  { category: 'Europe',        value: 364 },
  { category: 'Asia-Pacific',  value: 251 },
  { category: 'Latin America', value: 138 },
  { category: 'Middle East',   value:  79 },
];

const REVENUE_BY_REGION = [
  { category: 'Jan', region: 'NA',  value: 42 },
  { category: 'Jan', region: 'EU',  value: 28 },
  { category: 'Jan', region: 'APAC', value: 19 },
  { category: 'Feb', region: 'NA',  value: 48 },
  { category: 'Feb', region: 'EU',  value: 31 },
  { category: 'Feb', region: 'APAC', value: 22 },
  { category: 'Mar', region: 'NA',  value: 55 },
  { category: 'Mar', region: 'EU',  value: 36 },
  { category: 'Mar', region: 'APAC', value: 26 },
  { category: 'Apr', region: 'NA',  value: 51 },
  { category: 'Apr', region: 'EU',  value: 40 },
  { category: 'Apr', region: 'APAC', value: 31 },
  { category: 'May', region: 'NA',  value: 60 },
  { category: 'May', region: 'EU',  value: 44 },
  { category: 'May', region: 'APAC', value: 35 },
  { category: 'Jun', region: 'NA',  value: 67 },
  { category: 'Jun', region: 'EU',  value: 49 },
  { category: 'Jun', region: 'APAC', value: 42 },
];

const CAMPAIGNS = [
  { category: 'Spring launch',    value: 1842 },
  { category: 'Referral push',    value: 1264 },
  { category: 'Webinar series',   value:  982 },
  { category: 'Product Hunt',     value:  643 },
  { category: 'Partner program',  value:  521 },
  { category: 'Newsletter relaunch', value: 318 },
];

const CAT_VALUE_COLS = [
  { field: 'category', name: 'Category', type: 'string' },
  { field: 'value',    name: 'Value',    type: 'number' },
];

const CAT_REGION_VALUE_COLS = [
  { field: 'category', name: 'Month',   type: 'string' },
  { field: 'region',   name: 'Region',  type: 'string' },
  { field: 'value',    name: 'Revenue', type: 'number' },
];

const setData = (root, columns, rows) => root.querySelector('sherpa-barchart')?.setData?.({ columns, rows });

export default {
  'vertical-traffic':   (root) => setData(root, CAT_VALUE_COLS,        TRAFFIC_BY_SOURCE),
  'horizontal-devices': (root) => setData(root, CAT_VALUE_COLS,        DEVICES_BY_REGION),
  'stacked-revenue':    (root) => setData(root, CAT_REGION_VALUE_COLS, REVENUE_BY_REGION),
  'sorted-campaigns':   (root) => setData(root, CAT_VALUE_COLS,        CAMPAIGNS),
};
