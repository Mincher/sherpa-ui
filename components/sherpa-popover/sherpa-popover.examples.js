export default {
  'popover-0': (root) => {
    const pop = root.querySelector('sherpa-popover');
    const btn = root.querySelector('sherpa-button');
    btn?.addEventListener('button-click', () => pop?.toggleAttribute('data-open'));
  },
};
