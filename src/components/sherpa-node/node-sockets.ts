/**
 * node-sockets.ts — where a node's or a row's socket is drawn, for a connector to join.
 *
 * Map:
 * - SocketSide — which socket: the input, on the start edge, the output, on the end edge, or a fork's False, in its footer
 * - SOCKETS — the class each side's socket wears in its host's template
 * - socketRect — a socket's DRAWN box on the screen (its hit area is wider), or null when its host shows none
 */

export type SocketSide = 'input' | 'output' | 'false';

export const SOCKETS: Record<SocketSide, string> = { input: '.socket-in', output: '.socket-out', false: '.socket-false' };

export function socketRect(socket: HTMLElement | null): DOMRect | null {
  if (!socket?.checkVisibility()) return null;
  // The DRAWN box: the transparent border around it is only the hit area. The scale is the canvas's zoom.
  const r = socket.getBoundingClientRect();
  const k = socket.offsetWidth ? r.width / socket.offsetWidth : 1;
  return new DOMRect(r.left + socket.clientLeft * k, r.top + socket.clientTop * k, socket.clientWidth * k, socket.clientHeight * k);
}
