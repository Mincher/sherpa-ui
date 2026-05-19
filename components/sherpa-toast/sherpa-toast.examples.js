async function loadToast() {
  const mod = await import('./sherpa-toast.js');
  return mod.SherpaToast || mod.default;
}

const MESSAGES = {
  success:  'Device added to the EU pool.',
  warning:  'Disk usage on api-gateway is at 85%.',
  critical: 'Two devices failed to respond — escalating to on-call.',
  info:     'Maintenance window starts in 30 minutes.',
};

export default {
  'toast-statuses': async (root) => {
    const SherpaToast = await loadToast();
    const variants = ['success', 'warning', 'critical', 'info'];
    root.querySelectorAll('sherpa-button').forEach((btn, i) => {
      const variant = variants[i];
      btn.addEventListener('button-click', () => SherpaToast?.[variant]?.(MESSAGES[variant]));
    });
  },
  'toast-action': async (root) => {
    const SherpaToast = await loadToast();
    const btn = root.querySelector('sherpa-button');
    btn?.addEventListener('button-click', () => {
      SherpaToast?.success?.('Device orion-007 deleted.', {
        action: { label: 'Undo', onClick: () => SherpaToast?.info?.('Restored orion-007.') },
        duration: 6000,
      });
    });
  },
  'toast-burst': async (root) => {
    const SherpaToast = await loadToast();
    const btn = root.querySelector('sherpa-button');
    btn?.addEventListener('button-click', () => {
      SherpaToast?.info?.('Sync started…');
      setTimeout(() => SherpaToast?.success?.('128 devices synced.'), 400);
      setTimeout(() => SherpaToast?.warning?.('3 devices skipped.'), 800);
    });
  },
};
