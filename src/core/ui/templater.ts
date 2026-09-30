/**
 * templater.ts — where a component's markup and styles come from: fetched once,
 * cached by URL, a consumer's own when given, and reloaded live. Will, TODO 68
 * and 27. TRAP T-a-templater-owns-the-files
 *
 * Map:
 * - TemplateMap — `<template id>` → its markup; null for one flat template.
 * - OwnFiles — the files a consumer gives a component.
 * - useTemplate — draw a component from your own markup, and add your sheets after its own.
 * - filesFor — the markup and sheets a component is drawn from now.
 * - loadTemplates — a markup file, fetched once and split by `<template id>`.
 * - cachedTemplates — the split markup already fetched, for a re-stamp that costs no fetch.
 * - templateBody — one template's markup: the one wanted, else the first, else the whole file.
 * - loadSheets — adoptable sheets, each fetched once; one that fails is left out.
 * - reloadFiles — fetch files again; a sheet changes in place, and each listener hears what else changed.
 * - onReload — hear which files a reload changed, so their elements draw again.
 * - checkOwnTemplate — report what a consumer's markup lacks that the component reaches for.
 */
import { report } from '../data/report.js';

/** `<template id>` → its markup; null for one flat template. */
export type TemplateMap = Map<string, string> | null;

/** The files a consumer gives a component. */
export interface OwnFiles {
  /** Markup that REPLACES the component's own. */
  html?: URL | string;
  /** Sheets that come AFTER the component's own, so they win. */
  css?: URL | string | readonly (URL | string)[];
}

const htmlCache = new Map<string, Promise<string>>();
const templateCache = new Map<string, { html: string; map: TemplateMap }>();
const sheetCache = new Map<string, Promise<CSSStyleSheet>>();
const own = new Map<string, { html?: string; css: string[] }>();
const listeners = new Set<(changed: ReadonlySet<string>) => void>();

const href = (u: URL | string): string => new URL(String(u), document.baseURI).href;

/**
 * Draw every `tag` from your own markup, and add your sheets after its own.
 * A template that lacks a part, slot, class or template id the component's
 * own has is REPORTED: its code reaches for them. An element already drawn
 * takes it on the next `reloadFiles(tag)`.
 */
export function useTemplate(tag: string, files: OwnFiles): void {
  const css = files.css == null ? [] : [files.css].flat().map(href);
  own.set(tag, { ...(files.html ? { html: href(files.html) } : {}), css });
}

/** The markup and sheets `tag` is drawn from now: its own, then a consumer's. */
export function filesFor(
  tag: string,
  html: URL | undefined,
  css: URL | readonly URL[] | undefined,
): { html?: string; css: string[]; ownHtml?: string } {
  const given = own.get(tag);
  const mine = [css ?? []].flat().map((u) => u.href);
  const markup = given?.html ?? html?.href;
  return {
    ...(markup ? { html: markup } : {}),
    ...(given?.html && html ? { ownHtml: html.href } : {}),
    css: [...mine, ...(given?.css ?? [])],
  };
}

/** Fetch a file's text. A 404 RESOLVES, so without the check the body is the server's error page. */
function fetchText(url: string, fresh = false): Promise<string> {
  return fetch(url, fresh ? { cache: 'reload' } : {}).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
    return r.text();
  });
}

/**
 * A markup file, fetched once and split by `<template id>`.
 * TRAP T-cloning-prototypes-have-no-id — an item prototype must carry no `id`.
 */
export async function loadTemplates(url: string): Promise<{ html: string; map: TemplateMap }> {
  let pending = htmlCache.get(url);
  if (!pending) {
    pending = fetchText(url);
    htmlCache.set(url, pending);
  }
  const html = await pending;
  if (!templateCache.has(url)) templateCache.set(url, { html, map: parseTemplates(html) });
  return templateCache.get(url)!;
}

/** The split markup already fetched — undefined until it has been. */
export function cachedTemplates(url: string): { html: string; map: TemplateMap } | undefined {
  return templateCache.get(url);
}

/** Split markup by `<template id>`. Null when there is none. */
function parseTemplates(html: string): TemplateMap {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const templates = doc.querySelectorAll('template[id]');
  if (templates.length === 0) return null;
  const map = new Map<string, string>();
  for (const t of templates) map.set(t.id, (t as HTMLTemplateElement).innerHTML);
  return map;
}

/**
 * One template's markup: the one wanted, else the FIRST (with its real id),
 * else the whole file. TRAP T-template-id-read-once-was-permanent
 */
export function templateBody(map: TemplateMap, html: string, wanted: string | null): [string, string | null] {
  if (!map) return [html, null];
  if (wanted && map.has(wanted)) return [map.get(wanted)!, wanted];
  const [id, body] = map.entries().next().value ?? [null, html];
  return [body, id];
}

/** Fetch a sheet once; every element adopting it shares one object. */
function loadSheet(url: string): Promise<CSSStyleSheet> {
  let pending = sheetCache.get(url);
  if (!pending) {
    pending = fetchText(url).then((css) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      return sheet;
    });
    sheetCache.set(url, pending);
  }
  return pending;
}

/** Adoptable sheets, in order. Each settles on its own; one that fails is
 *  left out. TRAP T-shared-sheets-settle-independently */
export async function loadSheets(urls: readonly string[]): Promise<CSSStyleSheet[]> {
  const results = await Promise.allSettled(urls.map(loadSheet));
  return results
    .filter((r): r is PromiseFulfilledResult<CSSStyleSheet> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Fetch files again, as they are on disk now. A SHEET already adopted changes
 * IN PLACE — every element that adopted it restyles at once, and nothing is
 * drawn again. New sheets and all MARKUP are what each `onReload` listener
 * hears, so the elements drawn from them draw again. Will, TODO 68.
 */
export async function reloadFiles(files: { html?: readonly string[]; css?: readonly string[] }): Promise<void> {
  const changed = new Set<string>();
  await Promise.all([
    ...(files.css ?? []).map(async (url) => {
      const was = sheetCache.get(url);
      if (!was) {
        await loadSheet(url).then(() => changed.add(url), () => sheetCache.delete(url));
        return;
      }
      const [sheet, css] = await Promise.all([was, fetchText(url, true)]);
      sheet.replaceSync(css);
    }),
    ...(files.html ?? []).map(async (url) => {
      const pending = fetchText(url, true);
      htmlCache.set(url, pending);
      const html = await pending;
      templateCache.set(url, { html, map: parseTemplates(html) });
      changed.add(url);
    }),
  ]);
  if (changed.size) for (const listener of listeners) listener(changed);
}

/** Hear which files a reload changed. Returns how to stop. */
export function onReload(listener: (changed: ReadonlySet<string>) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * A consumer's markup must keep what the component's code reaches for: each
 * template id, part, slot name and class of its own. What it lacks is
 * REPORTED, once per file. TRAP T-a-broken-assumption-reports
 */
export async function checkOwnTemplate(tag: string, given: string, ownUrl: string): Promise<void> {
  if (checked.has(given)) return;
  checked.add(given);
  const [mine, theirs] = await Promise.all([loadTemplates(ownUrl), loadTemplates(given)]);
  const missing: string[] = [];
  const wanted = mine.map ?? new Map([['', mine.html]]);
  for (const [id, body] of wanted) {
    const other = id ? theirs.map?.get(id) : theirs.html;
    if (other == null) {
      missing.push(`template#${id}`);
      continue;
    }
    const need = anatomy(body);
    const have = anatomy(other);
    for (const key of need) if (!have.has(key)) missing.push(id ? `${id}: ${key}` : key);
  }
  if (missing.length) {
    report({
      code: 'template-missing',
      message: `${tag}: your template lacks what the component reaches for.`,
      at: { tag, template: given, missing: missing.join(', ') },
    });
  }
}

const checked = new Set<string>();

/** Every part, slot name and class in a template. */
function anatomy(markup: string): Set<string> {
  const doc = new DOMParser().parseFromString(`<template>${markup}</template>`, 'text/html');
  const root = doc.querySelector('template')!.content;
  const out = new Set<string>();
  for (const el of root.querySelectorAll('*')) {
    for (const part of (el.getAttribute('part') ?? '').split(/\s+/).filter(Boolean)) out.add(`part=${part}`);
    if (el.localName === 'slot') out.add(`slot=${el.getAttribute('name') ?? ''}`);
    for (const cls of el.classList) out.add(`.${cls}`);
  }
  return out;
}
