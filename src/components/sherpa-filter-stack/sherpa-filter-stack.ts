/**
 * sherpa-filter-stack — the panel area's filters: one filter toolbar per scope,
 * each in PORTRAIT. It asks for its scopes and opens and shuts as the panel
 * does; the filters are the toolbars' own. TODO 425 · TRAP T-the-panel-is-the-bar-in-portrait
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { VIEW } from '../../core/data/query.js';
import type { ScopeDescription } from '../../core/data/data-source.js';
import type { DataAsk } from '../../core/ui/context.js';
import '../sherpa-container/sherpa-container.js';
import '../sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.js';

export class SherpaFilterStack extends SherpaElement {
  static override css = new URL('./sherpa-filter-stack.css', import.meta.url);
  static override html = new URL('./sherpa-filter-stack.html', import.meta.url);

  // It ASKS for its scopes (`data-scope="view data"`), as a panel does. TRAP T-a-panel-asks-for-its-scopes
  static override asks: DataAsk = { shape: 'scope' };

  static override props = {
    'data-saveable': { type: 'boolean', kind: 'behaviour' },
  } as const;

  static override observed = ['open'];

  /**
   * drawScopes(scopes) — one portrait toolbar per scope, in order; each asks
   * for its own scope, as any toolbar does. A scope gone takes its toolbar; one
   * already here is not moved, so it keeps what the reader did. The FIRST takes
   * the page's mode button. TRAP T-the-mode-switch-is-the-pages-own
   */
  drawScopes(scopes: readonly ScopeDescription[]): void {
    const list = this.$('.bars');
    if (!list) return;
    const had = new Map([...list.querySelectorAll<HTMLElement>(':scope > sherpa-quick-filter-toolbar')]
      .map((bar) => [bar.dataset['scope'] ?? '', bar] as const));
    for (const [i, scope] of scopes.entries()) {
      const bar = had.get(scope.scope) ?? this.clone('template.bar-tpl');
      if (!bar) return;
      had.delete(scope.scope);
      bar.dataset['scope'] = scope.scope;
      // A component scope's toolbar has its Switch, and saves where the page saves.
      const component = scope.scope !== VIEW && !scope.part;
      bar.toggleAttribute('data-switchable', component);
      bar.toggleAttribute('data-saveable', component && this.hasAttribute('data-saveable'));
      // A chart's PART adds nothing and saves nothing: no actions. TRAP T-a-chart-scope-is-its-legend-field
      bar.toggleAttribute('data-no-actions', !!scope.part);
      const slot = bar.querySelector(':scope > slot[name="actions"]');
      if (i === 0 && !slot) {
        const lead = this.clone('template.actions-tpl');
        if (lead) bar.append(lead);
      } else if (i > 0) slot?.remove();
      if (list.children[i] !== bar) list.insertBefore(bar, list.children[i] ?? null);
    }
    for (const gone of had.values()) gone.remove();
  }

  get open(): boolean {
    return this.hasAttribute('open');
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  show(): void {
    this.toggleAttribute('open', true);
  }

  /** EVERY close reports, and says why. TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
  hide(reason: 'reader' | 'width' | 'page' = 'reader'): void {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.emit('filter-panel-close', { reason });
  }

  close(reason: 'reader' | 'width' | 'page' = 'reader'): void {
    this.hide(reason);
  }

  toggle(): void {
    if (this.hasAttribute('open')) this.hide();
    else this.show();
  }
}

define('sherpa-filter-stack', SherpaFilterStack);
