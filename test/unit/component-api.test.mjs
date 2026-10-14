/**
 * The MCP's component_api says what a caller can DO — and that includes what
 * populate() takes and which slots there are, read from the spec (TODO 195).
 *
 *   node --test test/unit/component-api.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../../mcp-server/tools/drive.js';

/** The tool's handler, caught from a server that only records registrations. */
const handler = (name) => {
  const tools = new Map();
  register({ registerTool: (id, _meta, fn) => tools.set(id, fn) });
  return tools.get(name);
};

test('component_api names the data populate() takes and every slot', async () => {
  const api = handler('component_api');
  const button = (await api({ name: 'sherpa-button' })).content[0].text;
  assert.match(button, /populate\(\{ [^}]*label\?[^}]*\}\)/);
  const dialog = (await api({ name: 'sherpa-dialog' })).content[0].text;
  assert.match(dialog, /### Slots \(3\)/);
  // Each slot says what it takes. TRAP T-a-slot-says-what-it-accepts
  assert.match(dialog, /- `\(default\)` — accepts content — the dialog body/);
  const chart = (await api({ name: 'sherpa-barchart' })).content[0].text;
  assert.match(chart, /populate\(\[\{ label, value, colorIndex\? \}\]\)` — the bars/);
});
