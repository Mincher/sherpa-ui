/**
 * report.ts — ONE channel for "your assumption was wrong".
 *
 * A guard that expresses a DECISION stays silent; a guard that expresses a
 * BROKEN ASSUMPTION reports. Before this the second kind returned early like
 * the first, so a host that named a field nothing offered, or a chip whose
 * state had been dropped, produced an empty screen and no explanation.
 *
 * DOM-free, like everything in this folder.
 *
 * TRAP T-a-broken-assumption-reports
 *
 * Map:
 * - Report — One thing that went wrong, NAMED.
 * - Reporter — where a report goes — a toast, a log, a test array
 * - onReport — Route every issue somewhere of your own — a toast, a log, a test's array.
 * - report — Say that an assumption broke.
 */

/**
 * One thing that went wrong, NAMED.
 *
 * NOT `Issue` — that word is taken by `validate.ts`, where it means a value a
 * schema refused. This is a runtime assumption that broke.
 */
export interface Report {
  /** A short slug, so a host can route or silence one kind: `unknown-field`. */
  code: string;
  /** A sentence someone can act on. It names the thing. */
  message: string;
  /** Which field, scope, component or id — whatever identifies it. */
  at?: Readonly<Record<string, string | number | undefined>>;
}

export type Reporter = (report: Report) => void;

let sink: Reporter | null = null;

/**
 * Route every issue somewhere of your own — a toast, a log, a test's array.
 * Returns the undo, so a test restores the default.
 *
 * `console.warn` is the DEFAULT, not the mechanism: an app that cannot
 * intercept a warning cannot silence or forward one either.
 */
export function onReport(next: Reporter | null): () => void {
  const previous = sink;
  sink = next;
  return () => { sink = previous; };
}

/** Say that an assumption broke. Never throws — a report is not a fault. */
export function report(issue: Report): void {
  if (sink) {
    /* A BROKEN SINK MUST NOT BREAK THE PAGE. The app asked to hear about a
       problem; its handler failing is a second problem, not this one's. */
    try {
      sink(issue);
      return;
    } catch {
      // …and fall through to the default, so the issue is still said.
    }
  }
  const where = issue.at
    ? ' ' + Object.entries(issue.at)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${String(v)}`).join(' ')
    : '';
  console.warn(`sherpa [${issue.code}] ${issue.message}${where}`);
}
