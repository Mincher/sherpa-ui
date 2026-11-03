/**
 * provider-look.ts — the LOOK settings, on the page's root: inherited custom
 * properties every component's CSS reads, or the attribute the token layer
 * reads. It takes off only what it put on. TRAP T-a-setting-is-declared-once
 *
 * Map:
 * - RootLook — What the look settings have put on one root.
 * - .draw — Put each look setting on the root as its value says.
 */
import type { Settings } from '../../core/data/settings.js';

/** What the look settings have put on one root. */
export class RootLook {
  /** Each setting's custom properties, and its attribute, as put. */
  readonly #put = new Map<string, { props: string[]; attr?: string }>();

  /** Put each look setting on the root as its value says — those named, or every one. */
  draw(root: HTMLElement, settings: Settings, keys: readonly string[] = Object.keys(settings.schema)): void {
    const needed = new Set(keys);
    // A look that needs another follows it too.
    for (const [key, def] of Object.entries(settings.schema)) if (def.look?.needs && needed.has(def.look.needs)) needed.add(key);
    for (const key of needed) {
      const look = settings.schema[key]?.look;
      if (!look) continue;
      const on = !look.needs || settings.get(look.needs) === true;
      const value = on ? settings.get(key) : look.none ?? false;
      const was = this.#put.get(key) ?? { props: [] };
      const props = look.props?.[String(value)] ?? {};
      for (const prop of was.props) if (!(prop in props)) root.style.removeProperty(prop);
      for (const [prop, given] of Object.entries(props)) root.style.setProperty(prop, given);
      const put: { props: string[]; attr?: string } = { props: Object.keys(props) };
      if (look.attr) {
        const none = value === null || value === false || value === look.none;
        if (!none) {
          root.setAttribute(look.attr, value === true ? '' : String(value));
          put.attr = look.attr;
        } else if (was.attr) root.removeAttribute(look.attr);
      }
      this.#put.set(key, put);
    }
  }
}
