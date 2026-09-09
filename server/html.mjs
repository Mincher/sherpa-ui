/**
 * html.mjs — the one tiny primitive the framework needs.
 *
 * `html` is a tagged-template that auto-escapes interpolated values (so app data
 * can't inject markup), while letting you opt OUT with `raw()` for nested fragment
 * HTML you've already built. Everything the server sends is sherpa-* markup built
 * with this — no template engine, no build step.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** Marks a string as already-safe HTML so `html` won't escape it. */
export class Raw {
  constructor(value) {
    this.value = value;
  }
}
export const raw = (value) => new Raw(value);

/** Tagged template: interpolations are escaped unless wrapped in raw()/an array of Raw. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out += renderValue(v) + strings[i + 1];
  }
  return new Raw(out); // fragments compose: html`` inside html`` stays raw
}

function renderValue(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(renderValue).join('');
  return escape(v);
}

/** Unwrap a Raw (or plain string) to the final HTML string for res.send(). */
export const render = (v) => (v instanceof Raw ? v.value : escape(v));
