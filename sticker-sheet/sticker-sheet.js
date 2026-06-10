// Theme switcher
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const map = {
      'theme-purple':  'apex-2-purple',
      'theme-teal':    'apex-2-teal',
      'theme-blue':    'apex-2-blue',
      'theme-classic': 'apex-2-classic',
    };
    document.documentElement.dataset.theme = map[btn.id];
    document.querySelectorAll('.theme-btn').forEach(b => {
      b.dataset.variant = b === btn ? 'primary' : 'tertiary';
    });
  });
});

// Dark mode toggle
const modeToggle = document.getElementById('mode-toggle');
modeToggle?.addEventListener('click', () => {
  const isDark = document.documentElement.dataset.mode === 'dark';
  document.documentElement.dataset.mode = isDark ? 'light' : 'dark';
  modeToggle.dataset.iconStart = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
});

// Density toggle
const densityToggle = document.getElementById('density-toggle');
let dense = false;
densityToggle?.addEventListener('click', () => {
  dense = !dense;
  document.documentElement.dataset.density = dense ? 'compact' : 'base';
  densityToggle.dataset.iconStart = dense ? 'fa-solid fa-expand' : 'fa-solid fa-compress';
});

// Nav scroll links
document.querySelector('sherpa-nav')?.addEventListener('navitemclick', e => {
  const route = e.detail?.route;
  if (route?.startsWith('#')) {
    document.querySelector(route)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// Toast triggers
const toastMessages = {
  info:     { title: 'Information',   value: 'This is an informational notification.' },
  success:  { title: 'Saved',         value: 'Your changes have been saved successfully.' },
  warning:  { title: 'Review needed', value: 'Some fields require your attention.' },
  critical: { title: 'Error',         value: 'An error occurred. Please try again.' },
};
['info', 'success', 'warning', 'critical'].forEach(s => {
  document.getElementById(`toast-${s}`)?.addEventListener('click', () => {
    const SherpaToast = customElements.get('sherpa-toast');
    SherpaToast?.show({ status: s, ...toastMessages[s] });
  });
});

// Metric sparklines — inject directly via open shadow root to avoid setData overwriting attributes
customElements.whenDefined('sherpa-metric').then(() => {
  const sparkSets = {
    users:  [10200, 10800, 11300, 11900, 12100, 12300, 12480],
    uptime: [98.2, 99.1, 98.8, 99.5, 99.9, 99.7, 99.9],
    errors: [1.2, 2.3, 3.1, 4.8, 5.4, 4.9, 5.4],
    queue:  [900, 980, 1050, 1100, 1180, 1204, 1204],
  };
  document.querySelectorAll('sherpa-metric[data-metric-id]').forEach(m => {
    const values = sparkSets[m.dataset.metricId];
    if (!values) return;
    Promise.resolve(m.rendered).then(() => {
      const sparkline = m.shadowRoot?.querySelector('sherpa-sparkline');
      if (sparkline) {
        sparkline.setValues?.(values);
        m.setAttribute('data-sparkline', '');
      }
    });
  });
});

// Dialogs
document.getElementById('open-dialog-medium')?.addEventListener('click',  () => document.getElementById('dialog-medium')?.setAttribute('data-open', ''));
document.getElementById('close-dialog-medium')?.addEventListener('click', () => document.getElementById('dialog-medium')?.removeAttribute('data-open'));
document.getElementById('open-dialog-critical')?.addEventListener('click',  () => document.getElementById('dialog-critical')?.setAttribute('data-open', ''));
document.getElementById('close-dialog-critical')?.addEventListener('click', () => document.getElementById('dialog-critical')?.removeAttribute('data-open'));
document.addEventListener('dialog-cancel', e => e.target.removeAttribute('data-open'));
