/**
 * modifier-key.ts — the PRIMARY modifier: Cmd on Apple platforms, Ctrl elsewhere. Pure; Node-safe.
 * On a Mac a plain Ctrl does not count (Ctrl+click is a context click). Will, 2026-11-05.
 *
 * Map:
 * - isApple — Whether the platform is Apple's, read once.
 * - primaryKey — Whether an event holds the primary modifier.
 * - primaryLabel — The primary modifier's name for a tooltip: ⌘ or Ctrl.
 */

const platform = (globalThis as { navigator?: { userAgentData?: { platform?: string }; platform?: string } }).navigator;
/** Whether the platform is Apple's, read once. */
// `navigator.platform` first: it says MacIntel on every Mac; a test browser's `userAgentData` may claim another system.
export const isApple = /mac|iphone|ipad|ipod/i.test(platform?.platform || platform?.userAgentData?.platform || '');

/** Whether an event holds the primary modifier: Cmd on Apple platforms, Ctrl elsewhere. */
export function primaryKey(event: { ctrlKey: boolean; metaKey: boolean }, apple: boolean = isApple): boolean {
  return apple ? event.metaKey : event.ctrlKey;
}

/** The primary modifier's name for a tooltip or label. */
export const primaryLabel = isApple ? '⌘' : 'Ctrl';
