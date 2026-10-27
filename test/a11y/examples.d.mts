/** The types of `examples.mjs`, for the specs' type check. TODO 492 */
export interface Example {
  /** Its markup, joined into one string. */
  html: string;
  /** What `populate()` is given. */
  fill?: unknown;
  /** A selector to open, or how to show it. */
  show?: string;
  /** A selector the example anchors to. */
  anchor?: string;
  [key: string]: unknown;
}

/** Component → its example. */
export const EXAMPLES: Record<string, Example>;
