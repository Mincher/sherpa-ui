/**
 * sherpa-node-row — one row of a sherpa-node: an input socket, a field and an output socket.
 * Any of the three may be absent: a row may only pick a key of its input. Will, TODO 78.
 */
import { SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { SOCKETS, socketRect, type SocketSide } from '../sherpa-node/node-sockets.js';

export class SherpaNodeRow extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-node-sockets.css', import.meta.url),
    new URL('./sherpa-node-row.css', import.meta.url),
  ];
  static override html = new URL('./sherpa-node-row.html', import.meta.url);

  static override props = {
    'data-label': { type: 'string', kind: 'content' },
    'data-input-socket': SHARED_PROPS['data-input-socket'],
    'data-output-socket': SHARED_PROPS['data-output-socket'],
  } as const;

  /** A socket's box on the screen, for a connector to join; null when the row has none. */
  socketRect(side: SocketSide): DOMRect | null {
    return socketRect(this.$<HTMLElement>(SOCKETS[side]));
  }
}

define('sherpa-node-row', SherpaNodeRow);
