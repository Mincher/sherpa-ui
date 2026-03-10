/**
 * view-templates.js — Utility for stamping view layout templates.
 *
 * View templates live in `html/templates/views/` as plain HTML files.
 * Each file contains one or more `<template id="...">` blocks.
 * This helper fetches the file, clones the requested template, and
 * appends it to a target element.
 *
 * Usage:
 *   import { stampViewTemplate } from "sherpa-ui";
 *   await stampViewTemplate("app-shell", document.body);
 *
 * The template ID doubles as the filename:
 *   "app-shell" → html/templates/views/app-shell.html → <template id="app-shell">
 *
 * Override the base URL by passing a custom `baseUrl` option:
 *   await stampViewTemplate("app-shell", el, { baseUrl: "/my/templates/" });
 */

/** Module-level cache: filename → parsed Document. */
const cache = new Map();

/** Default base path resolved relative to this module. */
const DEFAULT_BASE = new URL(
  "../../html/templates/views/",
  import.meta.url,
).href;

/**
 * Fetch a view template file, clone the matching `<template>`, and
 * append its content to `target`.
 *
 * @param {string} templateId  Template id (also the filename without extension).
 * @param {Element} target     DOM element to append the cloned content into.
 * @param {object}  [opts]
 * @param {string}  [opts.baseUrl]  Override the base URL for template files.
 * @returns {Promise<DocumentFragment>} The cloned fragment (already in DOM).
 */
export async function stampViewTemplate(templateId, target, opts = {}) {
  const base = opts.baseUrl || DEFAULT_BASE;
  const file = `${templateId}.html`;
  const url = new URL(file, base).href;

  let doc = cache.get(url);
  if (!doc) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`View template not found: ${url}`);
    const html = await res.text();
    doc = new DOMParser().parseFromString(html, "text/html");
    cache.set(url, doc);
  }

  const tpl = doc.getElementById(templateId);
  if (!tpl) {
    throw new Error(
      `<template id="${templateId}"> not found in ${file}`,
    );
  }

  const fragment = tpl.content.cloneNode(true);
  target.appendChild(fragment);
  return fragment;
}
