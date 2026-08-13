/**
 * sherpa-tabs — a tabbed content switcher.
 *
 * Renders a tab strip from populate([{ id, label }]) by cloning a
 * <template class="tab-tpl"> prototype (the only structural DOM it creates —
 * data-driven rows, which the golden rules allow). The active tab is
 * data-active-id on the host: CSS gives it the accent underline, and the JS
 * reflects data-tab-active onto the matching slotted panel so CSS can reveal it
 * (::slotted([data-tab-active])). Clicking a tab sets data-active-id and emits
 * tab-change. Roving arrow-key focus rides on the native <button> tabs (Enter /
 * Space activate for free); Arrow / Home / End move the roving tabindex.
 *
 * @element sherpa-tabs
 * @attr {string} data-active-id — id of the currently active tab / panel
 *
 * @slot (default) — the tab panels; each child should carry data-tab="<id>"
 * @slot detail    — trailing content beside the tab strip
 *
 * @fires tab-change — bubbles + composed. detail: { id }
 *
 * @prop {string} activeId — currently active tab id (read/write)
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
  static override observed = ['data-active-id'];

  #tabs: TabDef[] = [];

  override onRender(): void {
    // One delegated listener for the whole strip — tabs come and go, this stays.
    this.$('.tabs')?.addEventListener('click', this.#onClick);
    this.$('.tabs')?.addEventListener('keydown', this.#onKeyDown);
    if (this.#tabs.length) this.#render();
    else this.#applyActive();
  }

  override onChange(name: string): void {
    if (name === 'data-active-id') this.#applyActive();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get activeId(): string {
    return this.dataset['activeId'] ?? '';
  }
  set activeId(value: string) {
    if (value) this.setAttribute('data-active-id', value);
    else this.removeAttribute('data-active-id');
  }

  /** Activate a tab by id (no-op if already active or unknown). */
  select(id: string): void {
    if (!id || id === this.activeId) return;
    if (this.#tabs.length && !this.#tabs.some((t) => t.id === id)) return;
    this.setAttribute('data-active-id', id);
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
    if (!this.dataset['activeId'] && this.#tabs[0]) {
      this.setAttribute('data-active-id', this.#tabs[0].id);
    }
    this.#render();
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #render(): void {
    const strip = this.$('.tabs');
    const tpl = this.$<HTMLTemplateElement>('template.tab-tpl');
    if (!strip || !tpl) return;

    strip.replaceChildren();
    this.#tabs.forEach((tab, i) => {
      const btn = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      btn.dataset['id'] = tab.id;
      btn.id = `tab-${tab.id}`;
      btn.setAttribute('aria-controls', `panel-${tab.id}`);
      btn.querySelector('.label')!.textContent = tab.label;
      // Roving tabindex — only the first tab is tab-reachable until active applies.
      btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
      strip.appendChild(btn);
    });
    this.#applyActive();
  }

  /** Reflect data-active-id onto the matching tab button and slotted panel. */
  #applyActive(): void {
    const active = this.dataset['activeId'] ?? '';

    for (const btn of this.$$('.tab')) {
      const on = btn.dataset['id'] === active;
      btn.toggleAttribute('data-active', on);
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

    const current = tabs.findIndex((t) => t.dataset['id'] === this.activeId);
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
