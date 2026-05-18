const CATEGORICAL_DATA = [
  { category: 'Email',  value: 42 },
  { category: 'Direct', value: 28 },
  { category: 'Social', value: 19 },
  { category: 'Search', value: 11 },
];

export default {
  'barchart-0': (root) => {
    root.querySelector('sherpa-barchart')?.setData?.({ rows: CATEGORICAL_DATA });
  },
};
