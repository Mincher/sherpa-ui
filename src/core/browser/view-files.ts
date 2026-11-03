/**
 * view-files.ts — a page's saved views from files: JSON (schemas/views.v1.json),
 * and each view's markup by template id.
 * TRAP T-a-view-is-json · TRAP T-a-views-markup-lives-in-a-template
 *
 * Map:
 * - loadViewLibrary — a page's views from a JSON file; a view's `template` fills its content
 */
import { report } from '../data/report.js';
import { loadTemplates } from '../ui/templater.js';
import type { ViewLibrary } from './persist-view.js';
import { isPlainObject } from './web-storage.js';

/**
 * A page's saved views from a JSON file. A view that names a `template` —
 * `"capacity.html#capacity"`, a file beside the JSON and a `<template id>` in
 * it — gets that template's markup as its `content`. A template that is not
 * there is reported, and the view draws the page's own content. One with no
 * label is reported and left out.
 */
export async function loadViewLibrary(url: string | URL): Promise<ViewLibrary> {
  const base = new URL(url, document.baseURI);
  const read: unknown = await (await fetch(base)).json();
  const views: ViewLibrary = {};
  for (const [id, view] of Object.entries(isPlainObject(read) ? read : {})) {
    // The file's own schema, for an editor: no View.
    if (id === '$schema') continue;
    if (isPlainObject(view) && typeof view['label'] === 'string' && view['label']) views[id] = view as unknown as ViewLibrary[string];
    else report({ code: 'view-invalid', message: 'A view is not { label, … }, so it is left out.', at: { view: id } });
  }
  await Promise.all(Object.entries(views).map(async ([id, view]) => {
    if (!view.template) return;
    const [file = '', name = ''] = view.template.split('#');
    const { map } = await loadTemplates(new URL(file, base).href);
    const markup = map?.get(name);
    if (markup == null) {
      // TRAP T-a-broken-assumption-reports
      report({ code: 'unknown-template', message: 'A view names a template its file does not hold.', at: { view: id, template: view.template } });
      return;
    }
    view.content = markup;
  }));
  return views;
}
