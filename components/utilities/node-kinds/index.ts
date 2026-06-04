/**
 * node-kinds/index.ts — Imports all built-in node kind handlers as side effects,
 * registering them with the computeNodeOutput registry.
 *
 * Import this once at the top of any entry point that needs to evaluate nodes:
 *
 *   import 'sherpa-ui/components/utilities/node-kinds/index.js';
 *
 * The sherpa-node web component does this automatically. For headless use
 * (server-side, tests, pipeline runners), import this file manually before
 * calling computeNodeOutput().
 */
import './source.js';
import './variable.js';
import './math.js';
import './util.js';
import './ai.js';
import './action.js';
