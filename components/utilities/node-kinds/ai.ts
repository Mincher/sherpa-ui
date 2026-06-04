import { registerNodeKind, type NodeOutputValue } from '../node-compute.js';

/** Shared AI output logic — used by both kind='ai' (with subtype) and standalone kinds. */
function aiOutput(portName: string, subtype: string, controls: Record<string, string>): NodeOutputValue {
  if (subtype === 'model')    return controls['model']    || null;
  if (subtype === 'delegate') return controls['agent']    || null;
  if (subtype === 'chat') {
    if (portName === 'response')        return controls['response']        || null;
    if (portName === 'recommendations') return controls['recommendations'] || null;
    return controls['response'] || controls['preset'] || controls['type'] || null;
  }
  return null;
}

// kind="ai" with subtype dispatch (legacy grouping)
registerNodeKind('ai', (portName, subtype, controls) => aiOutput(portName, subtype, controls));

// Standalone kinds (promoted out of kind="ai" in later templates)
registerNodeKind('model',    (_port, _sub, controls) => controls['model'] || null);
registerNodeKind('delegate', (_port, _sub, controls) => controls['agent'] || null);
registerNodeKind('chat',     (portName, _sub, controls) => {
  if (portName === 'response')        return controls['response']        || null;
  if (portName === 'recommendations') return controls['recommendations'] || null;
  return controls['response'] || controls['preset'] || controls['type'] || null;
});
