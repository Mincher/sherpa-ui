/**
 * harness.ts — the shared setup every e2e spec was writing out by hand.
 *
 * `const HARNESS = '/test/reforged/harness.html'` was declared in 70 separate
 * files, and 74 of the 75 specs then repeated the same two-line `beforeEach` in
 * two different formattings. That is 70 copies of one string and 74 of one
 * block: nothing was wrong with any of them, but a change to how the harness
 * signals readiness would have to be made 74 times, and the six specs that
 * spelled the path literally instead of using the constant show what happens
 * when it is not one thing.
 *
 * NOT a `*.spec.ts` file, so Playwright's `testMatch: '**''/*.spec.ts'` ignores
 * it — it is imported, never collected.
 */
import { test as base, type Page } from '@playwright/test';

/** The page every component spec loads. */
export const HARNESS = '/test/reforged/harness.html';

/**
 * Load the harness and wait for it to be ready.
 *
 * `__reforgedReady` is set by the harness AFTER the Font Awesome webfont has
 * actually loaded — not when the stylesheet link is added. A spec that measures
 * a glyph before that reads the fallback font's metrics and fails intermittently
 * under load, which is why this is a `waitForFunction` and not a timeout.
 */
export async function gotoHarness(page: Page): Promise<void> {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  // TRAP T-chromium-pointer-starts-on-the-page — park it off the page.
  await page.mouse.move(-1, -1);
}

/**
 * `test` with the harness already loaded.
 *
 *   import { test, expect } from './harness';
 *
 * Replaces the per-file `beforeEach`. A spec that needs something else before
 * its first assertion still adds its own `beforeEach` — this fixture runs
 * first, so the two compose.
 */
export const test = base.extend<Record<string, never>>({
  page: async ({ page }, use) => {
    await gotoHarness(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * The cast every spec writes to reach a Sherpa element's `rendered` promise.
 *
 * Appeared 153 times across 39 files as an inline
 * `HTMLElement & { rendered?: Promise<void> }`. It is not a Playwright type —
 * it describes the element inside `page.evaluate`, so it is exported for specs
 * that want to name it rather than re-spell it.
 */
export type SherpaEl = HTMLElement & {
  rendered?: Promise<void>;
  populate?: (data: unknown) => void;
  __settled?: () => Promise<void>;
};

/**
 * The elements a spec mounts, and the members it reaches for.
 *
 * Each was written as an inline `as HTMLElement & { … }` at the mount site —
 * 153 of them for `rendered` alone. Named once here, so a spec says what it
 * mounts rather than re-describing it.
 */
declare global {
  interface Window {
    /** `__mount(tag, data?, attrs?)` — see `test/reforged/harness.html`. */
    __mount<T = SherpaEl>(
      tag: string,
      data?: unknown,
      attrs?: Record<string, string | boolean>,
    ): Promise<T>;
    __settled(): Promise<void>;
    /** A bar's answers as clauses, built by the data layer. */
    __clauses(bar: Element): Promise<Record<string, unknown>>;
  }
}

/** `sherpa-quick-filter-toolbar`, with the surface its specs read. */
export type Bar = SherpaEl & {
  populate(d: unknown): void;
  available(d: unknown): void;
  organise(d: unknown): void;
  addFilters(ids: readonly string[]): void;
  removeFilter(id: string): void;
  supersede(ids: readonly string[]): void;
  allowFields(list: readonly string[] | null): void;
  active: string[];
  values: Record<string, string[]>;
  /** Each field's answer, ON or off — `picked` survives a chip switched off. */
  readings: Record<string, { picked?: string[] } & Record<string, unknown>>;
  presets: Record<string, { on: boolean; readings: Record<string, unknown> }>;
  heldFields: string[];
  superseded: string[];
  sortField: string | null;
  sortDirection: string;
  sortSuspended: boolean;
  groupField: string | null;
};
