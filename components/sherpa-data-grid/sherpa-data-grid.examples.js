/**
 * sherpa-data-grid — example setup callbacks.
 * Keyed by the `data-setup` attribute on templates in sherpa-data-grid.examples.html.
 */
const SAMPLE_ROWS = [
  { id: 1, name: 'Acme device 01',   status: 'online',  cpu: 12, region: 'EU'   },
  { id: 2, name: 'Acme device 02',   status: 'offline', cpu: 0,  region: 'US'   },
  { id: 3, name: 'Beta probe 14',    status: 'online',  cpu: 47, region: 'EU'   },
  { id: 4, name: 'Gamma sensor 09',  status: 'warning', cpu: 81, region: 'APAC' },
  { id: 5, name: 'Delta gateway 03', status: 'online',  cpu: 23, region: 'US'   },
  { id: 6, name: 'Epsilon hub 21',   status: 'online',  cpu: 35, region: 'EU'   },
];
const SAMPLE_COLUMNS = [
  { field: 'name',   label: 'Name',   width: 'auto' },
  { field: 'status', label: 'Status' },
  { field: 'cpu',    label: 'CPU %', type: 'number' },
  { field: 'region', label: 'Region' },
];

export default {
  'data-grid-0': (root) => {
    root.querySelector('sherpa-data-grid')?.setData?.({ rows: SAMPLE_ROWS, columns: SAMPLE_COLUMNS });
  },
};
