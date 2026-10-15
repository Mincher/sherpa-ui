/**
 * sherpa-tabs — tabs that switch between slotted panels.
 *
 * Tabs come from populate([{ id, label }]); data-current-id says which is open.
 *
 * @prop {string} currentId — currently active tab id (read/write)
 * @method select(id) — activate a tab by id, SILENTLY (a reader's pick fires tab-select)
 *
 * Map:
 * - TabDef — one tab: its id and label
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { rovingFocus, type Roving } from '../../core/ui/roving-focus.js';

export interface TabDef {
  id: string;
  label: string;
}

export class SherpaTabs extends SherpaElement {
  static override css = new URL('./sherpa-tabs.css', import.meta.url);
  static override html = new URL('./sherpa-tabs.html', import.meta.url);
  static override props = {
    'data-current-id': { type: 'string', kind: 'behaviour' },
  } as const;

  /** The tabs, as populated. */
  #tabs: TabDef[] = [];
  /** One tab stop for the strip; an arrow picks, as a tablist does. TRAP T-one-tab-stop-per-set */
  #roving: Roving | null = null;

  override onRender(): void {
    // Delegated — tabs come and go, the strip stays.
    const strip = this.$('.tabs');
    strip?.addEventListener('click', this.#onClick);
    if (strip) {
      this.#roving = rovingFocus(strip, {
        items: '.tab',
        key: (tab) => tab.dataset['id'],
        onMove: (tab) => {
          const id = tab.dataset['id'];
          if (id) this.#pick(id);
        },
      });
    }
    if (this.#tabs.length) this.#render();
    else this.#applyCurrent();
  }

  override onChange(name: string): void {
    if (name === 'data-current-id') this.#applyCurrent();
  }

  get currentId(): string {
    return this.dataset['currentId'] ?? '';
  }
  set currentId(value: string) {
    if (value) this.set('data-current-id', value);
    else this.set('data-current-id', null);
  }

  /** Activate a tab by id, silently — a host that sets it needs no echo.
   *  False when it is already active or unknown. */
  select(id: string): boolean {
    if (!id || id === this.currentId) return false;
    if (this.#tabs.length && !this.#tabs.some((t) => t.id === id)) return false;
    this.set('data-current-id', id);
    return true;
  }

  /** A READER picked a tab: activate it and say so. */
  #pick(id: string): void {
    if (!this.select(id)) return;
    const index = this.#tabs.findIndex((t) => t.id === id);
    this.emit('tab-select', { id, index, label: this.#tabs[index]?.label ?? '' });
  }

  /** Its panels, as tabs: each `data-tab`, named by its `data-label`. */
  protected override childData(): TabDef[] | undefined {
    const panels = [...this.querySelectorAll<HTMLElement>(':scope > [data-tab]')];
    return panels.length
      ? panels.map((p) => ({ id: p.dataset['tab'] ?? '', label: p.dataset['label'] ?? p.dataset['tab'] ?? '' }))
      : undefined;
  }

  /** populate([{ id, label }]) — the tabs; the first is current unless data-current-id names one. Or its panels' data-tab and data-label */
  protected override renderData(data: unknown): void {
    const list = Array.isArray(data) ? (data as TabDef[]) : [];
    this.#tabs = list
      .filter((t): t is TabDef => t != null && typeof t === 'object')
      .map((t) => ({ id: String(t.id ?? ''), label: String(t.label ?? '') }))
      .filter((t) => t.id);
    if (!this.dataset['currentId'] && this.#tabs[0]) {
      this.set('data-current-id', this.#tabs[0].id);
    }
    this.#render();
  }

  /** The prototype declares id and label; only the a11y wiring is derived. */
  #render(): void {
    this.renderItems('.tabs', 'template.tab-tpl', this.#tabs, {
      after: (btn, tab) => {
        btn.id = `tab-${tab.id}`;
      },
    });
    this.#applyCurrent();
  }

  /** Reflect data-current-id onto the matching tab button and slotted panel. */
  #applyCurrent(): void {
    const active = this.dataset['currentId'] ?? '';

    for (const btn of this.$$('.tab')) {
      const on = btn.dataset['id'] === active;
      btn.toggleAttribute('data-current', on);
      btn.setAttribute('aria-selected', String(on));
    }
    // The open tab is the stop; with none, the first stays reachable.
    this.#roving?.refresh(active);

    // Panels are the consumer's light DOM; CSS reveals the marked one.
    for (const panel of this.#panels()) {
      panel.toggleAttribute('data-current', panel.dataset['tab'] === active);
      panel.setAttribute('role', 'tabpanel');
      // Named by TEXT: an id reference cannot cross the shadow boundary to its tab.
      const tab = this.#tabs.find((t) => t.id === panel.dataset['tab']);
      if (tab) panel.setAttribute('aria-label', tab.label);
    }
  }

  /** Slotted panel children carrying data-tab. */
  #panels(): HTMLElement[] {
    const slot = this.$<HTMLSlotElement>('.panels slot');
    if (!slot) return [];
    return slot
      .assignedElements()
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('data-tab'));
  }

  /** A tab was clicked: select it. */
  #onClick = (event: Event): void => {
    // Our own shadow buttons — target is not retargeted, so closest() suffices.
    const btn = (event.target as HTMLElement).closest<HTMLElement>('.tab');
    const id = btn?.dataset['id'];
    if (id) this.#pick(id);
  };
}

define('sherpa-tabs', SherpaTabs);
