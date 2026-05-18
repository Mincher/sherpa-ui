export default {
  'tooltip-0': async (root) => {
    const mod = await import('./sherpa-tooltip.js');
    const SherpaTooltip = mod.SherpaTooltip || mod.default;
    const btn = root.querySelector('sherpa-button');
    btn?.addEventListener('mouseenter', () => {
      SherpaTooltip?.show?.(btn, 'Hello from sherpa-tooltip.', { position: 'top' });
    });
    btn?.addEventListener('mouseleave', () => SherpaTooltip?.hide?.());
  },
};
