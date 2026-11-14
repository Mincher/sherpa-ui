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
    'data-caption': { type: 'string', kind: 'content' },
    'data-input-socket': SHARED_PROPS['data-input-socket'],
    'data-output-socket': SHARED_PROPS['data-output-socket'],
    'data-input-connected': SHARED_PROPS['data-input-connected'],
    'data-output-connected': SHARED_PROPS['data-output-connected'],
    'data-input-many': SHARED_PROPS['data-input-many'],
    'data-property': { type: 'boolean', kind: 'style' },
    'data-idle': { type: 'boolean', kind: 'style' },
    'data-socket-name': { type: 'string', kind: 'content' },
    'data-socket-value': { type: 'string', kind: 'content' },
    'data-collapsed': { type: 'boolean', kind: 'style' },
    'data-input-at': { type: 'number', kind: 'behaviour' },
    'data-output-at': { type: 'number', kind: 'behaviour' },
    'data-input-at-connected': { type: 'number', kind: 'behaviour' },
    'data-output-at-connected': { type: 'number', kind: 'behaviour' },
  } as const;
  static override observed = ['data-input-at', 'data-output-at', 'data-input-at-connected', 'data-output-at-connected'];

  override onRender(): void {
    this.#places();
  }

  override onChange(): void {
    this.#places();
  }

  /** Its sockets' places in a collapsed node's stacks, where the CSS reads them. */
  #places(): void {
    for (const [attr, prop] of [['data-input-at', '--_in-at'], ['data-output-at', '--_out-at'], ['data-input-at-connected', '--_in-at-connected'], ['data-output-at-connected', '--_out-at-connected']] as const) {
      if (this.hasAttribute(attr)) this.style.setProperty(prop, String(this.num(attr, 0)));
      else this.style.removeProperty(prop);
    }
  }

  /** A socket's box on the screen, for a connector to join; null when the row has none. */
  socketRect(side: SocketSide): DOMRect | null {
    return socketRect(this.$<HTMLElement>(SOCKETS[side]));
  }
}

define('sherpa-node-row', SherpaNodeRow);
