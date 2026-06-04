import { registerNodeKind } from '../node-compute.js';

/** source — emits a trigger signal (always "1"). */
registerNodeKind('source', () => '1');

/** collection — surfaces the active subtype as the output value. */
registerNodeKind('collection', (_port, subtype) => subtype || null);
