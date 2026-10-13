/**
 * app-definition.ts — an app, set up from ONE JSON document: its Contexts, the
 * one it opens on, its nav sections and its Settings pages. DOM-free, so a
 * server reads the same file. TRAP T-an-app-is-its-definition
 *
 * Map:
 * - AppDefinition — One app, as JSON: its Contexts, the one it opens on, its nav sections and its Settings pages.
 * - ContextDefinition — One Context: its row's name and icon, its files, and what it changes in the chrome.
 * - SettingsPage — One Settings page: its row's name and icon, and its markup.
 * - ContextInit — What every Context's init is handed: the session, the View, its source, its chrome and a signal.
 * - ContextModule — A Context's module: `init(root, ctx)`, which may hand back a teardown.
 * - checkApp — Check every name an app definition uses; each broken one reports.
 */
import type { SessionStore } from '../browser/session.js';
import type { DataSource } from './data-source.js';
import { report } from './report.js';

/** One app, as JSON: its Contexts, the one it opens on, its nav sections and
 *  its Settings pages. Each path is relative to the definition's own file. */
export interface AppDefinition {
  v: 1;
  /** The product the nav names. */
  product?: { name: string; icon?: string };
  /** The Context the app opens on — the nav's Home. */
  default: string;
  contexts: Record<string, ContextDefinition>;
  /** The nav's sections, in order: a label and the Contexts it lists. */
  sections?: readonly { label?: string; contexts: readonly string[] }[];
  /** The pages that open OVER a Context, and the one module that runs them. */
  settings?: { module: string; pages: Record<string, SettingsPage> };
}

/** One Context: its row's name and icon, its files, and what it changes in the chrome. */
export interface ContextDefinition {
  /** Its row's name, which the header shows too. */
  label: string;
  icon?: string;
  /** Its markup. */
  template: string;
  /** Its page definition: the source its components ask. Absent, it has no data. */
  definition?: string;
  /** Its Views, as JSON. */
  views?: string;
  /** Its module, which exports `init(root, ctx)`. */
  module?: string;
  /** `header: false` takes the app header away while it is open; `resizable`
   *  lets a reader resize its cards. */
  chrome?: { header?: boolean; resizable?: boolean };
}

/** One Settings page: its row's name and icon, and its markup. */
export interface SettingsPage {
  label: string;
  icon?: string;
  template: string;
}

/** What every Context's init is handed: the session, the View, its source,
 *  its chrome and a signal. */
export interface ContextInit {
  /** What outlives a Context: the reader's choices. */
  session: SessionStore;
  /** The View the URL names; null for the first. */
  view: string | null;
  /** Its page's source, when it has a definition. */
  source?: DataSource;
  /** Aborts when the Context goes. */
  signal: AbortSignal;
  /** The header this Context fills. */
  header?: HTMLElement;
  /** The app's panels by id — its filter panel, its details panel. */
  panels: Readonly<Record<string, HTMLElement | undefined>>;
  /** Its own row's name. */
  label: string;
}

/** A Context's module: `init(root, ctx)`, which may hand back a teardown. */
export interface ContextModule {
  init(root: HTMLElement, ctx: ContextInit): (() => void) | undefined | Promise<(() => void) | undefined>;
}

/** Check every name an app definition uses; each broken one reports. True when none is. */
export function checkApp(app: AppDefinition): boolean {
  const problems: string[] = [];
  if (app?.v !== 1 || typeof app.contexts !== 'object') {
    problems.push('it is not a v1 app definition');
  } else {
    const names = Object.keys(app.contexts);
    if (!names.includes(app.default)) problems.push(`its default, "${app.default}", is not one of its contexts`);
    for (const [name, context] of Object.entries(app.contexts)) {
      if (!context.label) problems.push(`the context "${name}" has no label`);
      if (!context.template) problems.push(`the context "${name}" has no template`);
    }
    for (const section of app.sections ?? []) {
      for (const name of section.contexts) {
        if (!names.includes(name)) problems.push(`the section "${section.label ?? ''}" lists "${name}", which is not a context`);
      }
    }
    for (const [name, page] of Object.entries(app.settings?.pages ?? {})) {
      if (name in app.contexts) problems.push(`"${name}" is a context and a settings page`);
      if (!page.template) problems.push(`the settings page "${name}" has no template`);
    }
  }
  for (const problem of problems) {
    report({ code: 'app-definition', message: `checkApp: ${problem}.` });
  }
  return !problems.length;
}
