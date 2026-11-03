/**
 * bind-settings.ts — a control that says `data-setting="/pointer"` shows that
 * value, and writes it back as the reader changes it: a declared setting's
 * through the provider's settings, a page's own over the app's; any other
 * pointer straight from the session. And every setting kept across reloads.
 * TRAP T-a-setting-is-a-pointer
 *
 * Map:
 * - bindSettings — Bind every `[data-setting]` control under `root`, until `signal` aborts.
 * - persistSettings — Keep every setting of a schema across reloads, each guarded by what it can take.
 */
import type { SessionStore } from '../browser/session.js';
import { ContextRequestEvent, SETTINGS_CONTEXT } from './context.js';
import { fitsSetting, type Settings, type SettingsSchema, type SettingValue } from '../data/settings.js';

type Control = HTMLElement & { checked?: boolean; value?: string };

/** One value a control reads and writes, and how to hear it move. */
interface Port {
  get(): unknown;
  set(value: unknown): void;
  watch(draw: (value: unknown) => void): () => void;
}

/** The settings the provider over `root` holds, if one answers. */
function settingsOver(root: ParentNode): Settings | undefined {
  let found: Settings | undefined;
  if (root instanceof Element) root.dispatchEvent(new ContextRequestEvent(SETTINGS_CONTEXT, root, (settings) => { found = settings; }));
  return found;
}

/** A pointer's port: the declared setting kept there, else the session's value. */
function portOf(pointer: string, session: SessionStore, settings: Settings | undefined): Port {
  const key = settings?.keyAt(pointer);
  if (!settings || !key) {
    return { get: () => session.get(pointer), set: (value) => session.set(pointer, value), watch: (draw) => session.subscribe(pointer, draw) };
  }
  return {
    get: () => settings.get(key),
    set: (value) => settings.set(key, value as SettingValue),
    watch: (draw) => {
      const heard = (event: Event): void => {
        const { key: moved, value } = (event as CustomEvent<{ key: string; value: unknown }>).detail;
        if (moved === key) draw(value);
      };
      settings.addEventListener('change', heard);
      return () => settings.removeEventListener('change', heard);
    },
  };
}

/** Bind every `[data-setting]` control under `root`, until `signal` aborts.
 *  A boolean is a switch's `checked`; anything else is its `value`, kept a number if it was one.
 *  `data-setting-needs="/pointer"`: disabled, keeping its value, until that setting is on. Will, TODO 606 */
export function bindSettings(root: ParentNode, session: SessionStore, options: { signal?: AbortSignal } = {}): void {
  const { signal } = options;
  const settings = settingsOver(root);
  for (const el of root.querySelectorAll<Control>('[data-setting]')) {
    const port = portOf(el.dataset['setting'] ?? '', session, settings);
    const draw = (value: unknown): void => {
      if (typeof value === 'boolean') el.checked = value;
      else if (value != null) el.value = String(value);
    };
    draw(port.get());
    const stop = port.watch(draw);
    signal?.addEventListener('abort', stop, { once: true });
    const needs = el.dataset['settingNeeds'];
    if (needs) {
      const needed = portOf(needs, session, settings);
      const allow = (value: unknown): void => { el.toggleAttribute('disabled', value !== true); };
      allow(needed.get());
      const stopNeeds = needed.watch(allow);
      signal?.addEventListener('abort', stopNeeds, { once: true });
    }
    el.addEventListener('change', (event) => {
      const detail = (event as CustomEvent<{ checked?: boolean; value?: unknown } | null>).detail ?? {};
      const was = port.get();
      // A switch is a boolean even before its key holds one: else it stores its `value`, "on".
      const flag = typeof was === 'boolean' || el.localName === 'sherpa-switch';
      let next: unknown = flag ? (detail.checked ?? el.checked) : (detail.value ?? el.value);
      if (typeof was === 'number') next = Number(next);
      if (next === undefined || next === was || (typeof next === 'number' && !Number.isFinite(next))) return;
      port.set(next);
    }, signal ? { signal } : {});
  }
}

/** Keep every setting of a schema across reloads, each guarded by what it can
 *  take, so a stale shape is dropped. */
export function persistSettings(session: SessionStore, schema: SettingsSchema): void {
  for (const def of Object.values(schema)) {
    session.persist(def.at, { guard: (value): value is SettingValue => fitsSetting(def, value) });
  }
}
