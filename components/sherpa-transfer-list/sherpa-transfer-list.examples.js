const TRANSFER_OPTIONS = [
  { value: 'a', label: 'Alpha',   selected: true  },
  { value: 'b', label: 'Beta',    selected: false },
  { value: 'c', label: 'Gamma',   selected: true  },
  { value: 'd', label: 'Delta',   selected: false },
  { value: 'e', label: 'Epsilon', selected: false },
];

export default {
  'transfer-list-0': (root) => {
    root.querySelector('sherpa-transfer-list')?.setOptions?.(TRANSFER_OPTIONS);
  },
};
