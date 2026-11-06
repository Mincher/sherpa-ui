/**
 * sherpa-node-toolbar — a graph editor's tools: Save, Undo, Redo, the Zip tie tool, Save as Custom Node, Arrange nodes, Unfurl graph, Fetch, Simulate and Frame nodes, as icon buttons in one group.
 *
 * It does nothing itself. A press is `toolbar-select`; the editor that owns the history hears Undo
 * and Redo and says, in `data-can-undo` and `data-can-redo`, when each can be pressed. Save is a
 * placeholder, off until a host sets `data-can-save`. `data-picked-routes` is the count the canvas has picked, said in the Tie tool's tip. Tie is a TOOL: a press is the same event, and the editor says
 * in `data-tie` whether it is on (the button reads `aria-pressed`). TODO 562. TRAP T-an-edit-is-a-step
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { toolbarKeys } from '../../core/ui/roving-focus.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaNodeToolbar extends SherpaElement {
  static override css = new URL('./sherpa-node-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-node-toolbar.html', import.meta.url);

  static override props = {
    'data-can-save': { type: 'boolean', kind: 'behaviour' },
    'data-can-undo': { type: 'boolean', kind: 'behaviour' },
    'data-can-redo': { type: 'boolean', kind: 'behaviour' },
    'data-can-tie': { type: 'boolean', kind: 'behaviour' },
    'data-can-group': { type: 'boolean', kind: 'behaviour' },
    'data-can-arrange': { type: 'boolean', kind: 'behaviour' },
    'data-can-unfurl': { type: 'boolean', kind: 'behaviour' },
    'data-can-fetch': { type: 'boolean', kind: 'behaviour' },
    'data-can-simulate': { type: 'boolean', kind: 'behaviour' },
    'data-path-why': { type: 'string', kind: 'behaviour' },
    'data-can-frame': { type: 'boolean', kind: 'behaviour' },
    'data-tie': { type: 'boolean', kind: 'behaviour' },
    'data-picked-routes': { type: 'number', kind: 'behaviour' },
  } as const;
  static override observed = ['data-picked-routes', 'data-path-why'];

  override onRender(): void {
    toolbarKeys(this.$('.tools')!);
    this.on(this.root, 'button-click', this.#onPress as EventListener);
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** Fetch's and Simulate's own tips, kept while a reason stands in their place. */
  #tips: Record<string, string> = {};

  /** Each tool can be pressed when its flag is set. */
  #sync(): void {
    for (const action of ['save', 'undo', 'redo', 'tie', 'group', 'arrange', 'unfurl', 'fetch', 'simulate', 'frame']) {
      this.$(`.${action}`)?.toggleAttribute('disabled', !this.hasAttribute(`data-can-${action}`));
    }
    // Fetch and Simulate say why they are off: the graph has no path from a Source to an Output. TODO 836
    const why = this.getAttribute('data-path-why');
    for (const name of ['fetch', 'simulate'] as const) {
      const tool = this.$(`.${name}`);
      const own = (this.#tips[name] ??= tool?.getAttribute('data-tip') ?? '');
      tool?.setAttribute('data-tip', !this.hasAttribute(`data-can-${name}`) && why ? why : own);
    }
    const tie = this.$('.tie');
    tie?.setAttribute('aria-pressed', String(this.hasAttribute('data-tie')));
    // The count of connectors picked, where the Tie tool says what T will tie.
    const picked = this.num('data-picked-routes', 0);
    const words = picked ? `Zip tie: ${picked} ${picked === 1 ? 'connector' : 'connectors'} picked (T ties them)` : 'Zip tie: drag across connectors (T on picked nodes)';
    tie?.setAttribute('data-tip', words);
    tie?.setAttribute('aria-label', picked ? words : 'Zip tie');
  }

  /** A tool was pressed: say which, if it can be. */
  #onPress = (event: Event): void => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('sherpa-button')?.dataset['action'];
    if (action && this.hasAttribute(`data-can-${action}`)) this.emit('toolbar-select', { action });
  };
}

define('sherpa-node-toolbar', SherpaNodeToolbar);
