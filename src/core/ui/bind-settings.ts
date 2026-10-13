/**
 * bind-settings.ts — a control that says `data-setting="/pointer"` shows that
 * session value, and writes it back as the reader changes it.
 * TRAP T-a-setting-is-a-pointer
 *
 * Map:
 * - bindSettings — Bind every `[data-setting]` control under `root` to the session, until `signal` aborts.
 */
import type { SessionStore } from '../browser/session.js';

type Control = HTMLElement & { checked?: boolean; value?: string };

/** Bind every `[data-setting]` control under `root` to the session, until `signal` aborts.
 *  A boolean is a switch's `checked`; anything else is its `value`, kept a number if it was one. */
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
    el.addEventListener('change', (event) => {
      const detail = (event as CustomEvent<{ checked?: boolean; value?: unknown } | null>).detail ?? {};
      const was = session.get(pointer);
      let next: unknown = typeof was === 'boolean' ? (detail.checked ?? el.checked) : (detail.value ?? el.value);
      if (typeof was === 'number') next = Number(next);
      if (next === undefined || next === was || (typeof next === 'number' && !Number.isFinite(next))) return;
      session.set(pointer, next);
    }, signal ? { signal } : {});
  }
}
