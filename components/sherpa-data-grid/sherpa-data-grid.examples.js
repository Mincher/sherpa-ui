/**
 * sherpa-data-grid — example setup callbacks.
 * Keyed by the `data-setup` attribute on templates in sherpa-data-grid.examples.html.
 */

const REGIONS = ['NA', 'EU', 'APAC'];
const STATUSES = ['online', 'offline', 'warning', 'online', 'online'];
const DEVICE_PREFIX = ['Acme', 'Nimbus', 'Helios', 'Atlas', 'Orion', 'Vega', 'Kepler', 'Sirius'];

function generateDevices(count) {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    return {
      id,
      name:     `${DEVICE_PREFIX[i % DEVICE_PREFIX.length]} gateway ${String(id).padStart(3, '0')}`,
      status:   STATUSES[i % STATUSES.length],
      cpu:      Math.round(8 + (Math.sin(i) + 1) * 40),
      memory:   Math.round(20 + (Math.cos(i / 2) + 1) * 30),
      region:   REGIONS[i % REGIONS.length],
      lastSeen: new Date(Date.now() - i * 1000 * 60 * 17).toLocaleString(),
    };
  });
}

const DEVICE_COLUMNS = [
  { field: 'name',     label: 'Device' },
  { field: 'status',   label: 'Status' },
  { field: 'cpu',      label: 'CPU %',    type: 'number' },
  { field: 'memory',   label: 'Memory %', type: 'number' },
  { field: 'region',   label: 'Region' },
  { field: 'lastSeen', label: 'Last seen' },
];

const ALERT_SEVERITIES = ['critical', 'warning', 'info', 'warning', 'info', 'info'];
const ALERT_SOURCES = ['api-gateway', 'auth-service', 'billing-job', 'web-app', 'cdn-edge', 'database'];
const ALERT_MESSAGES = [
  'P95 latency exceeded 500ms',
  'Disk usage above 85%',
  'Deploy completed',
  'Memory pressure rising',
  'TLS cert expires in 14 days',
  'New build promoted to production',
];

function generateAlerts(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: 1000 + i,
    severity: ALERT_SEVERITIES[i % ALERT_SEVERITIES.length],
    source:   ALERT_SOURCES[i % ALERT_SOURCES.length],
    message:  ALERT_MESSAGES[i % ALERT_MESSAGES.length],
    time:     new Date(Date.now() - i * 1000 * 60 * 4).toLocaleTimeString(),
  }));
}

const ALERT_COLUMNS = [
  { field: 'severity', label: 'Severity' },
  { field: 'source',   label: 'Source' },
  { field: 'message',  label: 'Message' },
  { field: 'time',     label: 'Time' },
];

const load = (root, rows, columns) =>
  root.querySelector('sherpa-data-grid')?.setData?.({ rows, columns });

export default {
  'devices-base':    (root) => load(root, generateDevices(24), DEVICE_COLUMNS),
  'devices-grouped': (root) => load(root, generateDevices(18), DEVICE_COLUMNS),
  'devices-sorted':  (root) => load(root, generateDevices(24), DEVICE_COLUMNS),
  'alerts-compact':  (root) => load(root, generateAlerts(40), ALERT_COLUMNS),
};
