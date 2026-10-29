/**
 * node-sockets.ts — where a node's or a row's socket is drawn, for a connector to join.
 *
 * Map:
 * - SocketSide — which socket: the input, on the start edge, or the output, on the end edge
 * - SOCKETS — the class each side's socket wears in its host's template
 * - socketRect — a socket's box on the screen, or null when its host shows none
 */

export type SocketSide = 'input' | 'output';

export const SOCKETS: Record<SocketSide, string> = { input: '.socket-in', output: '.socket-out' };

export function socketRect(socket: HTMLElement | null): DOMRect | null {
  return socket?.checkVisibility() ? socket.getBoundingClientRect() : null;
}
