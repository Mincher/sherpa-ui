export default {
  'toast-0': async (root) => {
    const mod = await import('./sherpa-toast.js');
    const SherpaToast = mod.SherpaToast || mod.default;
    const variants = ['success', 'warning', 'critical', 'info'];
    root.querySelectorAll('sherpa-button').forEach((btn, i) => {
      btn.addEventListener('button-click', () => {
        SherpaToast?.[variants[i]]?.(`This is a ${variants[i]} toast.`);
      });
    });
  },
};
