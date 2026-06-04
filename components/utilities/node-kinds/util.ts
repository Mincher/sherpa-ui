import { registerNodeKind, resolveInput } from '../node-compute.js';

registerNodeKind('util', (_port, subtype, controls, incoming) => {
  if (subtype === 'concatenate') {
    const op = controls['operation'] || 'Append';
    const a = String(resolveInput('a', 'a', controls, incoming, ''));
    const b = String(resolveInput('b', 'b', controls, incoming, ''));
    if (!a && !b) return null;
    return op === 'Prepend' ? `${b}${a}` : `${a}${b}`;
  }
  const first = Object.values(controls).find((v) => v !== '' && v != null);
  return first ?? subtype ?? null;
});
