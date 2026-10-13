/**
 * The Records Context's own behaviour. It gets one ctx — the session, its
 * source, the header, a signal that aborts when it goes. A Context with
 * nothing of its own needs no module.
 */
import { SherpaToast } from 'sherpa-ui';

export function init(root, { signal }) {
  root.querySelector('#grid')?.addEventListener('row-select', (e) => {
    SherpaToast.info(`${e.detail.row?.name ?? 'A record'} selected`, { duration: 2000 });
  }, { signal });
}
