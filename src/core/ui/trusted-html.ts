/**
 * trusted-html.ts — Sherpa's Trusted Types policies, so it runs where a page enforces them.
 * TRAP T-sherpa-runs-under-a-strict-csp
 *
 * Map:
 * - ownHtml — HTML from Sherpa's OWN files — a template, an icon — under the `sherpa-ui` policy
 * - viewHtml — a View's markup, for its allow-list to read, under the `sherpa-ui-view` policy
 */
import { report } from '../data/report.js';

type Policy = { createHTML(input: string): unknown };
type Factory = { createPolicy(name: string, rules: { createHTML(input: string): string }): Policy };

/** One policy per name, made once. Null where the page has no Trusted Types. */
function policy(name: string): Policy | null {
  const factory = (globalThis as { trustedTypes?: Factory }).trustedTypes;
  if (!factory) return null;
  try {
    return factory.createPolicy(name, { createHTML: (input) => input });
  } catch (error) {
    // The page's `trusted-types` list does not name it, or a second copy made it first.
    report({ code: 'trusted-types-policy', message: `Trusted Types refused the "${name}" policy: add it to the page's trusted-types directive. ${String(error)}`, at: { name } });
    return null;
  }
}

const own = policy('sherpa-ui');
const view = policy('sherpa-ui-view');

/** HTML from Sherpa's OWN files — a template, an icon — under the `sherpa-ui` policy. */
export function ownHtml(markup: string): string {
  return (own?.createHTML(markup) ?? markup) as string;
}

/** A View's markup, for its allow-list to read, under the `sherpa-ui-view` policy. */
export function viewHtml(markup: string): string {
  return (view?.createHTML(markup) ?? markup) as string;
}
