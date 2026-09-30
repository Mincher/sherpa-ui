/**
 * route.ts — a URL's search parameters as a ROUTE, and back. Pure: no DOM.
 *
 * `sherpa-router` is the door; this is the arithmetic. TRAP T-the-router-owns-the-url
 *
 * Map:
 * - Route — each owned parameter's value, or null where it has none
 * - RouteShape — the parameters a router owns: their names, their defaults, and which are OVERLAYS
 * - routeShape — read a shape from `data-params` and `data-overlay`
 * - readRoute — a URL's route: each owned parameter, its default where the URL leaves it out
 * - routeHref — the URL for a route: owned parameters written, every other one kept
 * - settleRoute — the route a destination MEANS: an overlay link keeps the base it left out
 * - changedParams — the parameters that differ between two routes
 */

/** Each owned parameter's value, or null where it has none. */
export type Route = Record<string, string | null>;

/** The parameters a router owns: their names, their defaults, and which are OVERLAYS. */
export interface RouteShape {
  names: string[];
  defaults: Record<string, string>;
  overlay: ReadonlySet<string>;
}

/** Read a shape from `data-params` (`name` or `name=default`, space separated)
 *  and `data-overlay` (names, space separated). An overlay is owned too. */
export function routeShape(params: string, overlay = ''): RouteShape {
  const defaults: Record<string, string> = {};
  const names: string[] = [];
  for (const entry of `${params} ${overlay}`.split(/\s+/).filter(Boolean)) {
    const [name, fallback] = entry.split('=') as [string, string | undefined];
    if (!names.includes(name)) names.push(name);
    if (fallback) defaults[name] = fallback;
  }
  return { names, defaults, overlay: new Set(overlay.split(/\s+/).filter(Boolean).map((o) => o.split('=')[0]!)) };
}

/** A URL's route: each owned parameter, its default where the URL leaves it out. */
export function readRoute(url: URL | string, shape: RouteShape): Route {
  const search = new URL(url).searchParams;
  return Object.fromEntries(shape.names.map((name) => [name, search.get(name) || shape.defaults[name] || null]));
}

/** The URL for a route: owned parameters written, every other one kept. */
export function routeHref(url: URL | string, route: Route, shape: RouteShape): string {
  const next = new URL(url);
  for (const name of shape.names) {
    const value = route[name];
    if (value == null || value === '') next.searchParams.delete(name);
    else next.searchParams.set(name, value);
  }
  return next.href;
}

/** The route a destination MEANS. A link that names only OVERLAY parameters
 *  opens over the page it was pressed on, so the base it left out is kept. */
export function settleRoute(to: URL | string, from: Route, shape: RouteShape): Route {
  const route = readRoute(to, shape);
  const named = shape.names.filter((name) => new URL(to).searchParams.has(name));
  if (!named.length || !named.every((name) => shape.overlay.has(name))) return route;
  for (const name of shape.names) {
    if (!shape.overlay.has(name)) route[name] = from[name] ?? null;
  }
  return route;
}

/** The parameters that differ between two routes. */
export function changedParams(a: Route, b: Route): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((name) => (a[name] ?? null) !== (b[name] ?? null));
}
