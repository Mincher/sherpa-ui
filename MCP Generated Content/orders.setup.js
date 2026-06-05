// @ts-nocheck
// orders.setup.js — feeds the Order Management page.

const DATE_VALUE_COLS = [
  { field: 'date',  name: 'Date',  type: 'string' },
  { field: 'value', name: 'Value', type: 'number' },
];
const CAT_VALUE_COLS = [
  { field: 'category', name: 'Category', type: 'string' },
  { field: 'value',    name: 'Value',    type: 'number' },
];

// 30-day revenue trend with weekly cycle + slow growth.
const REVENUE = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 4, i + 1);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dow = d.getDay();
  const weekend = (dow === 0 || dow === 6) ? 0.78 : 1;
  const base = 220 + i * 3.2 + Math.sin(i / 3) * 18;
  return { date, value: Math.round(base * weekend) };
});

const SOURCES = [
  { category: 'Web storefront', value: 642 },
  { category: 'Mobile app',     value: 318 },
  { category: 'Marketplace',    value: 212 },
  { category: 'Phone / email',  value:  98 },
  { category: 'Trade show',     value:  14 },
];

const STATUS = [
  { category: 'New',         value: 142 },
  { category: 'Processing',  value: 268 },
  { category: 'Shipped',     value: 384 },
  { category: 'Delivered',   value: 412 },
  { category: 'Cancelled',   value:  48 },
  { category: 'Refunded',    value:  30 },
];

const ORDER_COLS = [
  { field: 'id',        name: 'Order',      type: 'string' },
  { field: 'customer',  name: 'Customer',   type: 'string' },
  { field: 'channel',   name: 'Channel',    type: 'string' },
  { field: 'status',    name: 'Status',     type: 'string' },
  { field: 'items',     name: 'Items',      type: 'number' },
  { field: 'total',     name: 'Total',      type: 'number' },
  { field: 'placed',    name: 'Placed',     type: 'string' },
];

const ORDERS = [
  { id: '#A-49821', customer: 'R. Tanaka',     channel: 'web',         status: 'processing', items:  3, total:  284.50, placed: '09:14' },
  { id: '#A-49822', customer: 'L. Mwangi',     channel: 'mobile',      status: 'shipped',    items:  1, total:   42.00, placed: '09:21' },
  { id: '#A-49823', customer: 'F. Rossi',      channel: 'marketplace', status: 'new',        items:  5, total:  611.20, placed: '09:22' },
  { id: '#A-49824', customer: 'P. Nguyen',     channel: 'web',         status: 'delivered',  items:  2, total:  198.75, placed: '09:28' },
  { id: '#A-49825', customer: 'J. Almeida',    channel: 'phone',       status: 'cancelled',  items:  1, total:   18.40, placed: '09:33' },
  { id: '#A-49826', customer: 'B. Schmidt',    channel: 'web',         status: 'shipped',    items:  4, total:  402.10, placed: '09:37' },
  { id: '#A-49827', customer: 'K. Adebayo',    channel: 'mobile',      status: 'new',        items:  2, total:  146.99, placed: '09:42' },
  { id: '#A-49828', customer: 'A. Khoury',     channel: 'marketplace', status: 'processing', items:  6, total:  724.00, placed: '09:48' },
  { id: '#A-49829', customer: 'S. O\'Brien',   channel: 'web',         status: 'refunded',   items:  1, total:   59.00, placed: '09:52' },
  { id: '#A-49830', customer: 'Y. Park',       channel: 'mobile',      status: 'shipped',    items:  3, total:  220.40, placed: '10:01' },
  { id: '#A-49831', customer: 'C. Diaz',       channel: 'web',         status: 'new',        items:  2, total:  128.30, placed: '10:07' },
  { id: '#A-49832', customer: 'D. Wallace',    channel: 'marketplace', status: 'processing', items:  1, total:  899.00, placed: '10:13' },
];

const q = (root, sel) => root.querySelector(sel);

export default {
  'orders-page': async (root) => {
    const all = root.querySelectorAll('*');
    await Promise.all(
      [...all]
        .filter(el => el.tagName?.startsWith('SHERPA-') && el.rendered)
        .map(el => el.rendered)
    );

    q(root, 'sherpa-line-chart')?.setData?.({ columns: DATE_VALUE_COLS, rows: REVENUE });
    q(root, 'sherpa-donut-chart')?.setData?.({ columns: CAT_VALUE_COLS, rows: SOURCES });
    q(root, 'sherpa-barchart')?.setData?.({ columns: CAT_VALUE_COLS, rows: STATUS });
    q(root, 'sherpa-data-grid')?.setData?.({ columns: ORDER_COLS, rows: ORDERS });
  },
};
