import { test, expect } from './harness';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

/**
 * ONLY A COMPONENT'S OWN EVENTS LEAVE IT. Every component is mounted bare and
 * every button inside it pressed; each custom event heard on `document` from
 * that host must be one its spec lists. An inner part's event is its
 * composite's to hear. TODO 213 · TRAP T-an-inner-event-stops-at-its-host
 */
const C = 'src/components';
const SPECS = readdirSync(C).filter((c) => existsSync(`${C}/${c}/${c}.component.json`)).map((c) => {
  const spec = JSON.parse(readFileSync(`${C}/${c}/${c}.component.json`, 'utf8'));
  return { tag: spec.$name as string, events: (spec.events ?? []).map((e: { name: string }) => e.name) as string[] };
});

test('every custom event that leaves a host is one its spec lists', async ({ page }) => {
  test.setTimeout(120_000);
  const leaks = await page.evaluate(async (specs) => {
    const out: string[] = [];
    for (const { tag, events } of specs) {
      const root = document.getElementById('root')!;
      root.replaceChildren();
      const el = document.createElement(tag) as HTMLElement & { rendered?: Promise<void> };
      root.append(el);
      await el.rendered;
      // Its parts draw after it does.
      await (window as unknown as { __settled(): Promise<void> }).__settled();
      const heard = new Set<string>();
      const hear = (e: Event): void => { if (e.type.includes('-') && e.composedPath().includes(el)) heard.add(e.type); };
      const types = new Set(specs.flatMap((s) => s.events));
      for (const t of ['button-click', 'menu-change', 'menu-select', 'quick-filter-click', 'quick-filter-change']) types.add(t);
      for (const t of types) document.addEventListener(t, hear);
      const buttons = [...el.shadowRoot!.querySelectorAll('*')].flatMap((n) =>
        n.shadowRoot ? [...n.shadowRoot.querySelectorAll('button')] : n.localName === 'button' ? [n] : []);
      for (const b of buttons) {
        try { (b as HTMLElement).click(); } catch { /* a press may need state the bare host lacks */ }
      }
      await (window as unknown as { __settled(): Promise<void> }).__settled();
      for (const t of types) document.removeEventListener(t, hear);
      for (const t of heard) if (!events.includes(t)) out.push(`${tag}: ${t}`);
    }
    return out;
  }, SPECS);
  expect(leaks).toEqual([]);
});
