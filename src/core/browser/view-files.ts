/**
 * view-files.ts — a page's saved views from files: JSON, and each view's markup by template id.
 * TRAP T-a-view-is-json · TRAP T-a-views-markup-lives-in-a-template
 *
 * Map:
 * - loadViewLibrary — a page's views from a JSON file; a view's `template` fills its content
 */
import { report } from '../data/report.js';
import { loadTemplates } from '../ui/templater.js';
import type { ViewLibrary } from './persist-view.js';

/**
 * A page's saved views from a JSON file. A view that names a `template` —
 * `"capacity.html#capacity"`, a file beside the JSON and a `<template id>` in
 * it — gets that template's markup as its `content`. A template that is not
 * there is reported, and the view draws the page's own content.
 */
export async function loadViewLibrary(url: string | URL): Promise<ViewLibrary> {
  const base = new URL(url, document.baseURI);
  const views = await (await fetch(base)).json() as ViewLibrary;
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
