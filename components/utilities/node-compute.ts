/**
 * node-compute.ts — Registry engine for sherpa-node output computation.
 *
 * Provides a kind-handler registry so node logic is:
 *   - DOM-free and usable outside the UI (server-side, test harness, headless runner)
 *   - Extensible: consumers call registerNodeKind() to add their own kinds
 *   - Properly typed: handlers return real values (number, boolean, string, object)
 *
 * The DOM boundary (writing to an attribute) is handled separately by
 * nodeValueToString(), which is the only place string coercion occurs.
 *
 * @module node-compute
 *
 * @example Headless graph execution
 * ```ts
 * import { computeNodeOutput } from 'sherpa-ui/components/utilities/node-compute.js';
 * import 'sherpa-ui/components/utilities/node-kinds/index.js'; // register built-ins
 *
 * const result = computeNodeOutput('out', {
 *   kind: 'math', subtype: 'add',
 *   controls: {}, incoming: { a: 3, b: 4 },
 * });
 * // result === 7  (number, not "7")
 * ```
 *
 * @example Custom node kind
 * ```ts
 * import { registerNodeKind } from 'sherpa-ui/components/utilities/node-compute.js';
 *
 * registerNodeKind('geo', (portName, subtype, controls, incoming) => {
 *   if (subtype === 'distance') {
 *     const lat = Number(incoming['lat'] ?? controls['lat'] ?? 0);
 *     const lng = Number(incoming['lng'] ?? controls['lng'] ?? 0);
 *     return Math.sqrt(lat ** 2 + lng ** 2);
 *   }
 *   return null;
 * });
 * ```
 */

/** Value types a node output port can carry. */
export type NodeOutputValue = string | number | boolean | Record<string, unknown> | null;

/** Context passed to computeNodeOutput — all plain data, no DOM. */
export interface NodeComputeContext {
  /** Node kind: 'source' | 'math' | 'variable' | 'util' | 'ai' | 'model' | etc. */
  kind: string;
  /** Active subtype within the kind, e.g. 'add' for math. */
  subtype: string;
  /**
   * Output socket status attribute value — drives logic branch outputs.
   * 'true' returns boolean true, 'false' returns boolean false.
   */
  socketStatus?: string;
  /** Current control values keyed by control name attribute. */
  controls: Record<string, string>;
  /**
   * Upstream-driven values keyed by input port name.
   * Arrays indicate a multi-input (data-multi) aggregation port.
   */
  incoming?: Record<string, unknown>;
}

/**
 * A handler function for one node kind.
 * Return null when the given portName/subtype combination has no defined output.
 */
export type NodeKindHandler = (
  portName: string,
  subtype: string,
  controls: Record<string, string>,
  incoming: Record<string, unknown>,
) => NodeOutputValue;

const registry = new Map<string, NodeKindHandler>();

/**
 * Register a handler for a node kind.
 * Call this at module load time in your kind file.
 * If a kind is registered more than once the last registration wins.
 */
export function registerNodeKind(kind: string, handler: NodeKindHandler): void {
  registry.set(kind, handler);
}

/**
 * Compute the value emitted on a named output port.
 * Pure function — no DOM access, no side effects.
 */
export function computeNodeOutput(
  portName: string,
  ctx: NodeComputeContext,
): NodeOutputValue {
  if (!portName) return null;
  const { kind, subtype, socketStatus = '', controls, incoming = {} } = ctx;

  // Logic branch sockets carry 'true'/'false' status markers — return proper booleans.
  if (socketStatus === 'true')  return true;
  if (socketStatus === 'false') return false;

  return registry.get(kind)?.(portName, subtype, controls, incoming) ?? null;
}

/**
 * Coerce a NodeOutputValue to a string for writing to a DOM attribute.
 * This is the single place where typed values cross the DOM boundary.
 */
export function nodeValueToString(value: NodeOutputValue): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ── Shared helpers (exported for use in kind handlers) ─────────────

/**
 * Parse a value as a finite number, returning `def` if not parseable.
 */
export function toNumber(v: unknown, def = 0): number {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : def;
}

/**
 * Prefer an incoming port value, then a matching control, then a fallback.
 * Use this inside kind handlers to let upstream connections override local controls.
 */
export function resolveInput(
  port: string,
  ctrlName: string,
  controls: Record<string, string>,
  incoming: Record<string, unknown>,
  fallback: unknown = '',
): unknown {
  if (incoming[port] !== undefined) return incoming[port];
  if (controls[ctrlName] !== undefined) return controls[ctrlName];
  return fallback;
}
