/**
 * sherpa-node-toolbar — a graph editor's tools: Save, Undo, Redo, the Zip tie tool, Save as Custom Node, Arrange nodes, Unfurl graph, Fetch, Play, Pause, Stop and Frame nodes, as icon buttons in three groups, a divider between each.
 *
 * It does nothing itself. A press is `toolbar-select`; the editor that owns the history hears Undo
 * and Redo and says, in `data-can-undo` and `data-can-redo`, when each can be pressed. Save is a
 * placeholder, off until a host sets `data-can-save`. `data-picked-routes` is the count the canvas has picked, said in the Tie tool's tip. Tie is a TOOL: a press is the same event, and the editor says
 * in `data-tie` whether it is on (the button reads `aria-pressed`). TODO 562. TRAP T-an-edit-is-a-step
 * Collapse all and Hide unconnected are the view's toggles: the editor says each one's state, `data-collapsed` and `data-hide-unconnected`.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { toolbarKeys } from '../../core/ui/roving-focus.js';
import { primaryLabel } from '../../core/ui/modifier-key.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-group/sherpa-group.js';

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
    'data-can-play': { type: 'boolean', kind: 'behaviour' },
    'data-path-why': { type: 'string', kind: 'behaviour' },
    'data-cached': { type: 'boolean', kind: 'behaviour' },
    'data-fetching': { type: 'boolean', kind: 'behaviour' },
    'data-simulating': { type: 'boolean', kind: 'behaviour' },
    'data-paused': { type: 'boolean', kind: 'behaviour' },
    'data-can-frame': { type: 'boolean', kind: 'behaviour' },
    'data-tie': { type: 'boolean', kind: 'behaviour' },
    'data-picked-routes': { type: 'number', kind: 'behaviour' },
    'data-can-collapse': { type: 'boolean', kind: 'behaviour' },
    'data-collapsed': { type: 'boolean', kind: 'behaviour' },
    'data-can-hide': { type: 'boolean', kind: 'behaviour' },
    'data-hide-unconnected': { type: 'boolean', kind: 'behaviour' },
    'data-can-lanes': { type: 'boolean', kind: 'behaviour' },
    'data-lanes': { type: 'boolean', kind: 'behaviour' },
  } as const;
  static override observed = ['data-picked-routes', 'data-path-why'];

  override onRender(): void {
    toolbarKeys(this.$('.tools')!);
    // The tips name the primary key: ⌘ on a Mac, Ctrl elsewhere.
    for (const tool of this.$$('[data-tip*="Ctrl"]')) tool.setAttribute('data-tip', tool.getAttribute('data-tip')!.replaceAll('Ctrl', primaryLabel));
    this.on(this.root, 'button-click', this.#onPress as EventListener);
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** Fetch's and Play's own tips, kept while a reason stands in their place. */
  #tips: Record<string, string> = {};

  /** Each tool can be pressed when its flag is set. */
  #sync(): void {
    for (const action of ['save', 'undo', 'redo', 'tie', 'group', 'arrange', 'unfurl', 'fetch', 'play', 'frame', 'collapse', 'hide', 'lanes']) {
      this.$(`.${action}`)?.toggleAttribute('disabled', !this.hasAttribute(`data-can-${action}`));
    }
    const running = this.hasAttribute('data-simulating');
    const paused = this.hasAttribute('data-paused');
    const waiting = this.hasAttribute('data-fetching') || running;
    // Fetch and Play say why they are off: the graph has no path from a Source to an Output. TODO 836
    const why = this.getAttribute('data-path-why');
    for (const name of ['fetch', 'play'] as const) {
      const tool = this.$(`.${name}`);
      const own = (this.#tips[name] ??= tool?.getAttribute('data-tip') ?? '');
      // A fetch that runs says how to stop it; rows cached say Refetch; a paused run says Play goes on; else the tool's own words.
      // One task at a time for the graph: Fetch waits while either runs, Play while a fetch does or a run is not paused.
      const busy = name === 'fetch' ? this.hasAttribute('data-fetching') : running && !paused;
      const off = name === 'fetch' ? waiting : this.hasAttribute('data-fetching') || (running && !paused);
      const now = busy ? `${name === 'fetch' ? 'Fetching' : 'Simulating'}: wait for it to end`
        : name === 'play' && paused ? 'Play: go on from this node'
          : name === 'fetch' && this.hasAttribute('data-cached') ? 'Refetch: read every Source on a path again' : own;
      tool?.setAttribute('data-tip', !this.hasAttribute('data-can-play') && why ? why : now);
      tool?.toggleAttribute('disabled', !this.hasAttribute(`data-can-${name}`) || off);
      tool?.setAttribute('aria-busy', String(busy));
    }
    // Pause while it runs; Stop while it runs or is paused.
    this.$('.pause')?.toggleAttribute('disabled', !running || paused);
    this.$('.stop')?.toggleAttribute('disabled', !running);
    const tie = this.$('.tie');
    tie?.setAttribute('aria-pressed', String(this.hasAttribute('data-tie')));
    // The count of connectors picked, where the Tie tool says what T will tie.
    const picked = this.num('data-picked-routes', 0);
    const words = picked ? `Zip tie: ${picked} ${picked === 1 ? 'connector' : 'connectors'} picked (T ties them)` : 'Zip tie: drag across connectors (T on picked nodes)';
    tie?.setAttribute('data-tip', words);
    tie?.setAttribute('aria-label', picked ? words : 'Zip tie');
    // The view's two toggles: Collapse all, pressed while every node is collapsed; Hide unconnected, while it hides. Off is kept.
    const all = this.hasAttribute('data-collapsed');
    const collapse = this.$('.collapse');
    collapse?.setAttribute('aria-pressed', String(all));
    collapse?.setAttribute('aria-label', all ? 'Expand all nodes' : 'Collapse all nodes');
    collapse?.setAttribute('data-tip', all ? 'Expand all nodes' : 'Collapse all nodes: only their sockets show (double click a header for one)');
    this.$('.hide')?.setAttribute('aria-pressed', String(this.hasAttribute('data-hide-unconnected')));
    this.$('.lanes')?.setAttribute('aria-pressed', String(this.hasAttribute('data-lanes')));
  }

  /** A tool was pressed: say which, if it can be. */
  #onPress = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('sherpa-button');
    const action = button?.dataset['action'];
    // Pause and Stop have no flag of their own: they can be pressed while their button is on.
    if (action && button && !button.hasAttribute('disabled')) this.emit('toolbar-select', { action });
  };
}

define('sherpa-node-toolbar', SherpaNodeToolbar);
