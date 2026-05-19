/**
 * sherpa-ai-panel — example setup callbacks.
 * Keyed by the data-setup attribute on each <template> in
 * sherpa-ai-panel.examples.html.
 */
export default {
  'ask-ai-toggle': (root) => {
    const btn   = root.querySelector('sherpa-button[data-variant="ai"]');
    const panel = root.querySelector('sherpa-ai-panel');
    if (!btn || !panel) return;

    const sync = () => {
      btn.toggleAttribute('data-active', panel.hasAttribute('data-expanded'));
    };

    btn.addEventListener('click', () => {
      panel.toggleAttribute('data-expanded');
      sync();
    });

    // Reflect changes from inside the panel (e.g. its own close affordance).
    new MutationObserver(sync).observe(panel, {
      attributes: true,
      attributeFilter: ['data-expanded'],
    });

    sync();
  },
};
