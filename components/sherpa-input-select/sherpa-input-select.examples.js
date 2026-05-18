const SAMPLE_SELECT_OPTIONS = [
  { value: 'apple',  label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date',   label: 'Date' },
];

export default {
  'input-select-3': (root) => {
    root.querySelector('sherpa-input-select')?.setOptions?.(SAMPLE_SELECT_OPTIONS);
  },
};
