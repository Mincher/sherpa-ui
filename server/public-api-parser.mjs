/**
 * public-api-parser.mjs — the shared, dependency-free parser for a component's
 * leading `Public API:` HTML comment.
 *
 * This is the single source of truth for turning a component template's comment
 * block into a structured spec (props + fired events + description). It is a
 * faithful port of parsePublicApi / parseFires / parseEnumValues / commentDescription
 * from scripts/generate-component-spec.mjs.
 *
 * Pure ES module — no Node and no browser APIs — so it is imported by BOTH:
 *   - the browser sandbox (sandbox/sandbox.js), and
 *   - the example template server (server/component-usage.mjs).
 * Neither can drift from the other, and neither can drift from the real component
 * template (the comment is read from dist/components/<name>/<name>.html at runtime).
 */

export const NATIVE_ATTRS = new Set([
  'disabled', 'name', 'value', 'required', 'readonly', 'placeholder',
  'checked', 'min', 'max', 'step', 'minlength', 'maxlength', 'pattern',
  'multiple', 'href', 'target', 'type', 'rows', 'cols', 'autocomplete',
]);

/** Extract the first HTML comment body from a template file. */
export function htmlComment(html) {
  const m = /<!--([\s\S]*?)-->/.exec(html);
  return m ? m[1] : '';
}

/** The component's one-line description: `sherpa-foo — does the thing`. */
export function commentDescription(comment, name) {
  const lines = comment.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of lines) {
    const m = new RegExp(`^${name}\\s*[—-]\\s*(.+)$`).exec(l);
    if (m) return m[1].trim();
  }
  return '';
}

/** `a | b | c` → ['a','b','c'] (parenthetical asides stripped first). */
export function parseEnumValues(rest) {
  if (!rest.includes('|')) return null;
  const noParens = rest.replace(/\([^)]*\)/g, ' ');
  const m = /^([\w-]+(?:\s*\|\s*[\w-]+)+)/.exec(noParens.trim());
  if (!m) return null;
  return m[1].split('|').map((s) => s.trim()).filter(Boolean);
}

/** Parse the `Public API:` block into a { attr → prop-spec } map. */
export function parsePublicApi(comment) {
  const props = {};
  const lines = comment.split('\n');
  let start = -1, indent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)Public API[^:]*:/i.exec(lines[i]);
    if (m) { start = i + 1; indent = m[1].length; break; }
  }
  if (start === -1) return props;

  const entries = [];
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) {
      let j = i + 1; while (j < lines.length && !lines[j].trim()) j++;
      if (j >= lines.length) break;
      if (/^\s*(Slots|Fires|Events|Templates)\s*:/i.test(lines[j])) break;
      continue;
    }
    const lead = (/^(\s*)/.exec(raw) || [])[1].length;
    if (lead <= indent) {
      if (/^\s*[A-Z][\w ]*:/.test(raw) && !/^\s*(data-|[a-z][\w-]*\s)/.test(raw)) break;
    }
    const trimmed = raw.trim();
    const nameHead = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)(\s{2,}|\s*[—-]\s|\s*$)/;
    const looksEntry = nameHead.test(trimmed);
    if (!looksEntry && entries.length) { entries[entries.length - 1] += ' ' + trimmed; continue; }
    entries.push(trimmed);
  }

  for (const entry of entries) {
    let mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)\s{2,}(.*)$/.exec(entry);
    if (!mm) mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)\s*[—-]\s*(.*)$/.exec(entry);
    if (!mm) mm = /^([a-z][\w-]*)\s*$/.exec(entry) ? [entry, entry.trim(), ''] : null;
    if (!mm) continue;
    const names = mm[1].split('/').map((s) => s.trim()).filter(Boolean);
    const rest = (mm[2] ?? '').trim();

    for (const nm of names) {
      const p = { name: nm };
      const isNative = !nm.startsWith('data-') && NATIVE_ATTRS.has(nm);
      if (isNative) p.native = true;

      const NATIVE_BOOL = new Set(['disabled', 'readonly', 'required', 'checked', 'multiple']);
      if (/\(boolean\)/i.test(rest) || (isNative && NATIVE_BOOL.has(nm)) || (isNative && /\bboolean\b/i.test(rest))) {
        p.type = 'boolean';
      } else {
        const values = parseEnumValues(rest);
        if (values && values.length > 1) { p.type = 'enum'; p.values = values; }
      }
      const defM = /\(default\s+([^)]+)\)/i.exec(rest);
      if (defM) {
        const d = defM[1].trim();
        if (d !== 'omitted' && d !== 'none' && d !== 'unset') p.default = d;
        // An explicit "omitted/none/unset" default means the attribute is
        // optional — its baseline is "attribute absent". Record it so consumers
        // (e.g. the derived default usage tag) don't force a value on it.
        else p.optional = true;
      }
      if (p.type === 'boolean' && p.default === undefined) p.default = false;
      if (!p.type) p.type = 'string';

      const desc = rest.replace(/\((?:boolean|default[^)]*)\)/gi, '').trim();
      if (desc) p.description = desc;
      props[nm] = p;
    }
  }
  return props;
}

function collectEventNames(text, set) {
  const cleaned = text.replace(/\(detail[^)]*\)/gi, '').replace(/\(re-dispatched[^)]*\)/gi, '');
  for (const frag of cleaned.split(/[,\n]/)) {
    const mm = /^\s*([a-z][\w-]*)/.exec(frag.replace(/^[—-]\s*/, '').trim());
    if (mm && mm[1] && mm[1] !== 'detail') set.add(mm[1]);
  }
}

/** Parse the `Fires:` block into an array of event names. */
export function parseFires(comment) {
  const out = new Set();
  const lines = comment.split('\n');
  let inFires = false, indent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)Fires\s*:(.*)$/i.exec(lines[i]);
    if (m) { inFires = true; indent = m[1].length; collectEventNames(m[2], out); continue; }
    if (inFires) {
      if (!lines[i].trim()) { inFires = false; continue; }
      const lead = (/^(\s*)/.exec(lines[i]) || [])[1].length;
      if (lead <= indent) { inFires = false; continue; }
      collectEventNames(lines[i], out);
    }
  }
  return [...out];
}

/** Parse a whole template's comment into a { name, props, events, description } spec. */
export function parseComponentSpec(name, templateHtml) {
  const comment = htmlComment(templateHtml);
  const props = parsePublicApi(comment);
  const events = parseFires(comment);
  const description = commentDescription(comment, name);
  const error = (Object.keys(props).length === 0 && events.length === 0)
    ? 'no Public API / Fires block parsed'
    : null;
  return { name, props, events, description, error };
}
