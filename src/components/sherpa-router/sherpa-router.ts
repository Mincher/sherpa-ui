/**
 * sherpa-router — the ONE owner of the URL, on the Navigation API.
 *
 * A thin DOM door onto `route.ts`. It intercepts every same-page navigation —
 * a link, `go()`, the browser's Back — so the page never reloads, and reports
 * the route that changed. TRAP T-the-router-owns-the-url
 *
 * Map:
 * - RouteChange — what `route-change` carries: the route now, the one before, what differs, and `waitUntil`
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import {
  changedParams, readRoute, routeHref, routeShape, settleRoute, type Route, type RouteShape,
} from '../../core/browser/route.js';

/** What `route-change` carries: the route now, the one before, what differs, and `waitUntil`. */
export interface RouteChange {
  route: Route;
  previous: Route;
  changed: string[];
  type: 'push' | 'replace' | 'traverse';
  /** The navigation is not finished until this settles — a page still loading. */
  waitUntil(work: Promise<unknown>): void;
}

export class SherpaRouter extends SherpaElement {
  static override css = new URL('./sherpa-router.css', import.meta.url);
  static override html = new URL('./sherpa-router.html', import.meta.url);
  /* DECLARED, and read fresh on every navigation: nothing is drawn from them. */
  static override props = {
    'data-params': { type: 'string', kind: 'style' },
    'data-overlay': { type: 'string', kind: 'style' },
  } as const;

  /** Listening starts on CONNECT, not on first render: a press before the
   *  template arrives would reload the page. */
  override connectedCallback(): void {
    super.connectedCallback();
    this.on(navigation, 'navigate', this.#onNavigate as EventListener);
  }

  /** The parameters it owns, read fresh: the attributes are the state. */
  #shape(): RouteShape {
    return routeShape(this.dataset['params'] ?? '', this.dataset['overlay'] ?? '');
  }

  /** What the URL says now: each owned parameter, or null. */
  get route(): Route {
    return readRoute(location.href, this.#shape());
  }

  /** The URL for a route — for a real `<a href>`. Unowned parameters are kept. */
  href(route: Route): string {
    return routeHref(location.href, route, this.#shape());
  }

  /** Navigate: the changes over the route now. Settles when the page has. */
  async go(changes: Route, options: { replace?: boolean } = {}): Promise<void> {
    const href = this.href({ ...this.route, ...changes });
    if (href === location.href) return;
    try {
      await navigation.navigate(href, { history: options.replace ? 'replace' : 'push' }).finished;
    } catch (error) {
      // A newer navigation took over: not a failure.
      if ((error as { name?: string } | null)?.name !== 'AbortError') throw error;
    }
  }

  /** Every navigation comes through here. */
  #onNavigate = (event: NavigateEvent): void => {
    if (!event.canIntercept || event.hashChange || event.downloadRequest !== null || event.formData) return;
    // A reload is a reload; and another path is another page.
    const type = event.navigationType;
    if (type === 'reload') return;
    const to = new URL(event.destination.url);
    if (to.pathname !== location.pathname) return;

    const shape = this.#shape();
    const previous = this.route;
    // Back and forward go to a URL that was settled when it was made.
    const route = type === 'traverse' ? readRoute(to, shape) : settleRoute(to, previous, shape);

    /* AN OVERLAY LINK names less than it means: go to the whole URL instead,
       so the address bar, a reload and Back all say the same thing. */
    if (event.cancelable && changedParams(route, readRoute(to, shape)).length) {
      event.preventDefault();
      void this.go(route, { replace: type === 'replace' });
      return;
    }

    const changed = changedParams(previous, route);
    const waits: Promise<unknown>[] = [];
    event.intercept({
      // The page owns focus and scroll: a View pick must not move either.
      focusReset: 'manual',
      scroll: 'manual',
      handler: async () => {
        if (!changed.length) return;
        this.emit('route-change', {
          route, previous, changed, type,
          waitUntil: (work: Promise<unknown>) => void waits.push(work),
        } satisfies RouteChange);
        await Promise.all(waits);
      },
    });
  };
}

customElements.define('sherpa-router', SherpaRouter);
