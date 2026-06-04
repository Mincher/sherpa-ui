/**
 * Utility functions for parsing and formatting
 */

function jsdocLines(block) {
  return block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, ""))
    .filter((l) => l !== undefined);
}

function prettyLabel(tag) {
  return tag
    .replace(/^sherpa-/, "")
    .split("-")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

export { jsdocLines, prettyLabel };
