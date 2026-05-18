export default {
  'menu-0': (root) => {
    const menu = root.querySelector('sherpa-menu');
    const btn  = root.querySelector('sherpa-button');
    btn?.addEventListener('button-click', () => menu?.show?.(btn));
  },
};
