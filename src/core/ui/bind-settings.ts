/**
 * bind-settings.ts — a control that says `data-setting="/pointer"` shows that
 * session value, and writes it back as the reader changes it; and a target's
 * properties, each kept on its pointer.
 * TRAP T-a-setting-is-a-pointer
 *
 * Map:
 * - bindSettings — Bind every `[data-setting]` control under `root` to the session, until `signal` aborts.
 * - Setting — One property `followSettings` keeps: its pointer, its default, and the event that reports it.
 * - followSettings — Keep each property of `target` on its session pointer, both ways, until `signal` aborts.
 */
import type { SessionStore } from '../browser/session.js';

type Control = HTMLElement & { checked?: boolean; value?: string };

/** Bind every `[data-setting]` control under `root` to the session, until `signal` aborts.
 *  A boolean is a switch's `checked`; anything else is its `value`, kept a number if it was one.
 *  `data-setting-needs="/pointer"`: disabled, keeping its value, until that setting is on. Will, TODO 606 */
export function bindSettings(root: ParentNode, session: SessionStore, options: { signal?: AbortSignal } = {}): void {
  const { signal } = options;
  for (const el of root.querySelectorAll<Control>('[data-setting]')) {
    const pointer = el.dataset['setting'] ?? '';
    const draw = (value: unknown): void => {
      if (typeof value === 'boolean') el.checked = value;
      else if (value != null) el.value = String(value);
    };
    draw(session.get(pointer));
    const stop = session.subscribe(pointer, draw);
    signal?.addEventListener('abort', stop, { once: true });
    const needs = el.dataset['settingNeeds'];
    if (needs) {
      const allow = (value: unknown): void => { el.toggleAttribute('disabled', value !== true); };
      allow(session.get(needs));
      const stopNeeds = session.subscribe(needs, allow);
      signal?.addEventListener('abort', stopNeeds, { once: true });
    }
    el.addEventListener('change', (event) => {
      const detail = (event as CustomEvent<{ checked?: boolean; value?: unknown } | null>).detail ?? {};
      const was = session.get(pointer);
      // A switch is a boolean even before its key holds one: else it stores its `value`, "on".
      const flag = typeof was === 'boolean' || el.localName === 'sherpa-switch';
      let next: unknown = flag ? (detail.checked ?? el.checked) : (detail.value ?? el.value);
      if (typeof was === 'number') next = Number(next);
      if (next === undefined || next === was || (typeof next === 'number' && !Number.isFinite(next))) return;
      session.set(pointer, next);
    }, signal ? { signal } : {});
  }
}

/** One property `followSettings` keeps: its pointer, its default, and the event that reports it. */
export interface Setting {
  at: string;
  /** While the session holds nothing there; else the target keeps its own. */
  default?: unknown;
  /** The target's event for a reader's change, and its detail key. */
  heard?: readonly [type: string, key: string];
}

/** Keep each property of `target` on its session pointer, both ways, until `signal` aborts:
 *  set now and at each change, and a change the target reports written back. ONE
 *  table for every app setting, so a ⋮ and the Settings page agree. Will, TODO 553 */
export function followSettings(
  target: EventTarget, session: SessionStore, settings: Readonly<Record<string, string | Setting>>,
  options: { signal?: AbortSignal } = {},
): void {
  const { signal } = options;
  const props = target as unknown as Record<string, unknown>;
  for (const [prop, given] of Object.entries(settings)) {
    const { at, default: fallback, heard }: Setting = typeof given === 'string' ? { at: given } : given;
    const draw = (value: unknown): void => {
      const next = value ?? fallback;
      if (next !== undefined && props[prop] !== next) props[prop] = next;
    };
    draw(session.get(at));
    const stop = session.subscribe(at, draw);
    signal?.addEventListener('abort', stop, { once: true });
    if (!heard) continue;
    const [type, key] = heard;
    target.addEventListener(type, (event) => {
      const value = ((event as CustomEvent<Record<string, unknown> | null>).detail ?? {})[key];
      if (value !== undefined) session.set(at, value);
    }, signal ? { signal } : {});
  }
}
