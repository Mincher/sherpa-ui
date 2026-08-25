/**
 * parse-behaviour.mjs — extract a ```behaviour fenced block from a Figma component
 * description into a normalised `behaviours` array for the def.
 *
 * Figma models structure + look; behaviour (column pinning, sticky headers,
 * dual-axis scroll) has no node/prop, so it's documented as a fenced YAML block
 * in the component description — the one behaviour-friendly, MCP-fetchable surface.
 *
 * Block shape (inside the fence):
 *   <id>:
 *     summary: <one or two sentences>
 *     api: <the public surface — a data-* attr, CSS mechanism, or event>
 *     scope: <which component owns it>      # optional
 *     figmaCant: true                       # optional — no Figma representation
 *
 * Returns [] when there's no block. Order-preserving; each entry gains `id`.
 */
import yaml from 'js-yaml';

const FENCE = /```behaviour\s*\n([\s\S]*?)\n```/;

export function parseBehaviours(description) {
  if (!description || typeof description !== 'string') return [];
  const m = FENCE.exec(description);
  if (!m) return [];
  let doc;
  try { doc = yaml.load(m[1]); } catch { return []; }
  if (!doc || typeof doc !== 'object') return [];
  return Object.entries(doc).map(([id, body]) => ({ id, ...(body && typeof body === 'object' ? body : { summary: String(body) }) }));
}

/** Strip the behaviour block from a description, returning just the human prose. */
export function stripBehaviours(description) {
  if (!description) return description;
  return description.replace(FENCE, '').trimEnd();
}
