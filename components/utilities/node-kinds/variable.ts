import { registerNodeKind } from '../node-compute.js';

registerNodeKind('variable', (_port, subtype, controls) => {
  if (subtype === 'property') {
    const cat = controls['category'] || '';
    const fld = controls['field'] || '';
    return cat && fld ? `${cat}.${fld}` : (cat || fld || null);
  }
  return controls['value'] ?? null;
});
