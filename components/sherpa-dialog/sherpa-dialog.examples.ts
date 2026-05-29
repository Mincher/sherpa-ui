// @ts-nocheck
export default {
  'dialog-0': (root) => {
    const dialog = root.querySelector('sherpa-dialog');
    const btn    = root.querySelector('sherpa-button');
    btn?.addEventListener('button-click', () => dialog?.show?.());
  },
};
