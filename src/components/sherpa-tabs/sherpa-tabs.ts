/**
 * sherpa-tabs — a set of tabs that switch between panels.
 *
 * Give it tabs with populate([{ id, label }]). data-current-id says which tab is
 * open: CSS gives that tab the underline and shows its matching panel. Clicking a
 * tab switches to it and fires tab-change. The arrow keys move between tabs, and
 * Home/End jump to the first and last; Enter or Space opens a tab.
 *
 * @prop {string} currentId — currently active tab id (read/write)
 * @method select(id) — activate a tab by id
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface TabDef {
  id: string;
  label: string;
}

export class SherpaTabs extends SherpaElement {
  static override css = new URL('./sherpa-tabs.css', import.meta.url);
  static override html = new URL('./sherpa-tabs.html', import.meta.url);
  static override observed = ['data-current-id'];

  #tabs: TabDef[] = [];

  override onRender(): void {
    // One delegated listener for the whole strip — tabs come and go, this stays.
    this.$('.tabs')?.addEventListener('click', this.#onClick);
    this.$('.tabs')?.addEventListener('keydown', this.#onKeyDown);
    if (this.#tabs.length) this.#render();
    else this.#applyCurrent();
  }

  override onChange(name: string): void {
    if (name === 'data-current-id') this.#applyCurrent();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get currentId(): string {
    return this.dataset['currentId'] ?? '';
  }
  set currentId(value: string) {
    if (value) this.setAttribute('data-current-id', value);
    else this.removeAttribute('data-current-id');
  }

  /** Activate a tab by id (no-op if already active or unknown). */
  select(id: string): void {
    if (!id || id === this.currentId) return;
    if (this.#tabs.length && !this.#tabs.some((t) => t.id === id)) return;
    this.setAttribute('data-current-id', id);
    this.emit('tab-change', { id });
  }

  /* ── Data path: populate([{ id, label }]) ────────────────────────────── */

  protected override renderData(data: unknown): void {
    const list = Array.isArray(data) ? (data as TabDef[]) : [];
    this.#tabs = list
      .filter((t): t is TabDef => t != null && typeof t === 'object')
      .map((t) => ({ id: String(t.id ?? ''), label: String(t.label ?? '') }))
      .filter((t) => t.id);
    // Default the active tab to the first one when none is set.
    if (!this.dataset['currentId'] && this.#tabs[0]) {
      this.setAttribute('data-current-id', this.#tabs[0].id);
    }
    this.#render();
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #render(): void {
    // The id and the label are declared on the prototype. What is left is the
    // a11y wiring, which is derived rather than copied: two ids built AROUND the
    // tab's own, and a roving tabindex that depends on the position.
    this.renderRows('.tabs', 'template.tab-tpl', this.#tabs, {
      after: (btn, tab, i) => {
        btn.id = `tab-${tab.id}`;
        btn.setAttribute('aria-controls', `panel-${tab.id}`);
        // Roving tabindex — only the first tab is tab-reachable until active applies.
        btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
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
      btn.setAttribute('tabindex', on ? '0' : '-1');
    }
    // If nothing matched (e.g. before render), keep the first tab reachable.
    if (active === '' && this.#tabs[0]) {
      this.$(`.tab[data-id="${this.#tabs[0].id}"]`)?.setAttribute('tabindex', '0');
    }

    // Mark the matching slotted panel (consumer's light DOM); CSS reveals it.
    for (const panel of this.#panels()) {
      panel.toggleAttribute('data-tab-active', panel.dataset['tab'] === active);
      panel.setAttribute('role', 'tabpanel');
      panel.id = `panel-${panel.dataset['tab'] ?? ''}`;
      panel.setAttribute('aria-labelledby', `tab-${panel.dataset['tab'] ?? ''}`);
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

  #onClick = (event: Event): void => {
    // Tabs are our own shadow-DOM buttons — event.target is not retargeted, so a
    // plain closest() is correct here (no composedPath needed).
    const btn = (event.target as HTMLElement).closest<HTMLElement>('.tab');
    const id = btn?.dataset['id'];
    if (id) this.select(id);
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const tabs = this.$$('.tab');
    if (!tabs.length) return;

    const current = tabs.findIndex((t) => t.dataset['id'] === this.currentId);
    let next = current < 0 ? 0 : current;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (current + 1 + tabs.length) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (current - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
    }
    event.preventDefault();
    const target = tabs[next];
    const id = target?.dataset['id'];
    if (id) {
      this.select(id);
      target!.focus();
    }
  };
}

customElements.define('sherpa-tabs', SherpaTabs);
