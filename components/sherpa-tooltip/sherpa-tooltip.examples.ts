// @ts-nocheck
async function attach(root, text, position = 'top') {
  const mod = await import('./sherpa-tooltip.js');
  const SherpaTooltip = mod.SherpaTooltip || mod.default;
  const btn = root.querySelector('sherpa-button');
  btn?.addEventListener('mouseenter', () => SherpaTooltip?.show?.(btn, text, { position }));
  btn?.addEventListener('mouseleave', () => SherpaTooltip?.hide?.());
  btn?.addEventListener('focus',      () => SherpaTooltip?.show?.(btn, text, { position }));
  btn?.addEventListener('blur',       () => SherpaTooltip?.hide?.());
}

export default {
  'tooltip-icon-btn': (root) => attach(root, 'View more information', 'top'),
  'tooltip-text-btn': (root) => attach(root, 'Pulls the latest state from all devices in this group.', 'bottom'),
};
