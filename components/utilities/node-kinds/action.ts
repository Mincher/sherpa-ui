import { registerNodeKind } from '../node-compute.js';

registerNodeKind('action', (_port, subtype, controls) => {
  if (subtype === 'ticket') return controls['ticketNumber'] || controls['action'] || null;
  return null;
});
