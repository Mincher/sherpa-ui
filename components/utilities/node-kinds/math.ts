import { registerNodeKind, toNumber, resolveInput, type NodeOutputValue } from '../node-compute.js';

registerNodeKind('math', (_port, subtype, controls, incoming): NodeOutputValue => {
  const a = toNumber(resolveInput('a', 'a', controls, incoming));
  const b = toNumber(resolveInput('b', 'b', controls, incoming));
  const inV = incoming['in'];
  const inArr: number[] = Array.isArray(inV)
    ? inV.map((v) => toNumber(v))
    : (inV !== undefined ? [toNumber(inV)] : []);

  switch (subtype) {
    case 'add':       return a + b;
    case 'subtract':  return a - b;
    case 'multiply':  return a * b;
    case 'divide':    return b === 0 ? null : a / b;
    case 'ratio':     return b === 0 ? null : a / b;
    case 'floor':
    case 'min':       return inArr.length ? Math.min(...inArr) : null;
    case 'ceiling':
    case 'max':       return inArr.length ? Math.max(...inArr) : null;
    case 'average':
    case 'avg':       return inArr.length ? inArr.reduce((s, n) => s + n, 0) / inArr.length : null;
    case 'sum':       return inArr.length ? inArr.reduce((s, n) => s + n, 0) : null;
    case 'round': {
      const v = toNumber(inArr[0]);
      const places = toNumber(controls['places']);
      const m = Math.pow(10, places);
      return Math.round(v * m) / m;
    }
    case 'increment': {
      const v = toNumber(inArr[0]);
      const step = toNumber(controls['step'], 1);
      return v + step;
    }
    default: return null;
  }
});
