/**
 * reply.js — a tool's answer, as MCP carries it.
 *
 * Map:
 * - answer — a tool's answer: text
 * - refuse — a tool's answer that it could not do it, and why, for an agent to act on
 */

/** A tool's answer: text. */
export const answer = (text) => ({ content: [{ type: 'text', text }] });

/** A tool's answer that it could not do it, and why, for an agent to act on. */
export const refuse = (text) => ({ content: [{ type: 'text', text }], isError: true });
