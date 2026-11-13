/**
 * app-definition.ts — an app, set up from ONE JSON document: its Contexts, the
 * one it opens on, its nav sections and its Settings pages. DOM-free, so a
 * server reads the same file. TRAP T-an-app-is-its-definition
 *
 * Map:
 * - AppDefinition — One app, as JSON: its Contexts, the one it opens on, its nav sections and its Settings pages.
 * - ContextDefinition — One Context: its row's name and icon, its files, and what it changes in the chrome.
 * - SettingsPage — One Settings page: its row's name and icon, and its markup.
 * - OpenPage — On a `query` graph View, the page whose Query the canvas shows, opened for its Query alone.
 * - ContextInit — What every Context's init is handed: the session, the View, its source, its chrome and a signal.
 * - ContextModule — A Context's module: `init(root, ctx)`, which may hand back a teardown.
 * - checkApp — Check every name an app definition uses; each broken one reports.
 */
import type { SessionStore } from '../browser/session.js';
import type { DataSource } from './data-source.js';
import type { QueryContext } from './query-context.js';
import type { EntityShelf } from './entity-shelf.js';
import type { OpenGraph } from './graph-views.js';
import type { PageDefinition } from './page-definition.js';
import type { GraphComponent } from './query-graph.js';
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
  /** The app's types, by id: each a path to its type.v1 file, registered before a Context opens (plan 960 U2). */
  types?: Readonly<Record<string, string>>;
  /** The app's preset entities and their types, as JSON (entities.v3): read only, listed with the reader's own. */
  entities?: string;
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
  /** `header: false` takes the app header away while it is open; `filters: false`
   *  its filter row, and `"views"` leaves the View chip alone there (a Context with
   *  no definition); `resizable` lets a reader resize its cards. */
  chrome?: { header?: boolean; filters?: boolean | 'views'; resizable?: boolean };
}

/** One Settings page: its row's name and icon, and its markup. */
export interface SettingsPage {
  label: string;
  icon?: string;
  template: string;
}

/** On a `query` graph View, the page whose Query the canvas shows, opened for its Query alone.
 *  TRAP T-a-graph-is-a-view-of-a-type */
export interface OpenPage {
  /** Its Context's name. */
  id: string;
  label: string;
  /** The URL back to it, on its View. */
  href: string;
  definition: PageDefinition;
  source: DataSource;
  /** Its grids and charts, read from its markup. */
  components: readonly GraphComponent[];
  /** Its markup, off screen: where a component's live copy is copied from. */
  markup: DocumentFragment;
  /** The app's stores, by name: what a Source row offers. */
  stores: readonly string[];
}

/** What every Context's init is handed: the session, the View, its source and
 *  Query, its chrome and a signal. */
export interface ContextInit {
  /** What outlives a Context: the reader's choices. */
  session: SessionStore;
  /** The app's entities of every type: its presets and the reader's, to list, save, remove, copy, export and import; its
   *  `library()` every one as the Custom Node it offers. A Custom Node is kept through the doors (`keepNode`, plan 942). */
  entities?: EntityShelf;
  /** The View the URL names; null for the first. */
  view: string | null;
  /** On a graph View, the entity its canvas shows; the outlet's `graph-change` says when it moves. TRAP T-a-graph-is-a-view-of-a-type */
  graph?: OpenGraph;
  /** On a `query` graph View, the page it shows: `source` and `query` are that page's. */
  page?: OpenPage;
  /** Its page's source, when it has a definition. */
  source?: DataSource;
  /** The Context's ONE Query, which its source and controls share. 366 step 24 */
  query?: QueryContext;
  /** Aborts when the Context goes. */
  signal: AbortSignal;
  /** The header this Context fills. */
  header?: HTMLElement;
  /** The app's panels by id — its filter panel, its details panel. */
  panels: Readonly<Record<string, HTMLElement | undefined>>;
  /** Its own row's name. */
  label: string;
  /** Its id in `app.json`, so one module can serve many Contexts. */
  id: string;
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
      if (context.chrome?.filters === 'views' && context.definition) problems.push(`the context "${name}" has a definition, so its filter row is its page's: "views" is for a Context with none`);
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
