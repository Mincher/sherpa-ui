/**
 * sherpa-stack — a run of items in one direction, with a token gap.
 *
 * Direction, gap, alignment and wrapping are all [data-*] selectors in the CSS. The one JS is
 * `data-follow`: CSS cannot scroll a box when its content changes.
 */
import { SherpaElement, define, SHARED_PROPS } from '../../core/ui/sherpa-element.js';

export class SherpaStack extends SherpaElement {
  static override css = new URL('./sherpa-stack.css', import.meta.url);
  static override html = new URL('./sherpa-stack.html', import.meta.url);

  /* DECLARED, so the base class writes nothing; all CSS but data-follow. A `:host([data-x])` rule is a public API and
     belongs in one place. */
  static override props = {
    'data-scroll-shadow': SHARED_PROPS['data-scroll-shadow'],
    'data-align': { type: 'enum', kind: 'style', values: ['between', 'center', 'end', 'start', 'stretch'] },
    'data-direction': { type: 'enum', kind: 'style', values: ['block', 'inline'] },
    'data-fill': { type: 'boolean', kind: 'style' },
    'data-follow': { type: 'boolean', kind: 'behaviour' },
    'data-gap': { type: 'enum', kind: 'style', values: ['2xl', 'lg', 'md', 'none', 'sm', 'xl'] },
    'data-measure': { type: 'boolean', kind: 'style' },
    'data-min-item': { type: 'enum', kind: 'style', values: ['hug', 'sm', 'md', 'lg', 'xl'] },
    'data-scroll': { type: 'boolean', kind: 'style' },
    'data-wrap': { type: 'boolean', kind: 'style' },
  } as const;

  /** With data-follow, what watches the run and each item for a change of size. */
  #follow: ResizeObserver | undefined;

  protected override onRender(): void {
    this.#watch();
  }

  protected override onConnect(): void {
    this.on(this.root, 'slotchange', () => this.#watch());
    this.#watch();
  }

  protected override onDisconnect(): void {
    this.#follow?.disconnect();
    this.#follow = undefined;
  }

  protected override onChange(name: string): void {
    if (name === 'data-follow') this.#watch();
  }

  /** With data-follow, the run goes to its end each time an item is added or changes size, and when the run does. A
   *  ResizeObserver answers after layout and before paint, so the new end is drawn in view, and it answers once for
   *  each box it starts to watch: an item added is one. */
  #watch(): void {
    this.#follow?.disconnect();
    this.#follow = undefined;
    const run = this.$('.run');
    if (!run || !this.hasAttribute('data-follow') || !this.isConnected) return;
    this.#follow = new ResizeObserver(() => { run.scrollTop = run.scrollHeight; });
    this.#follow.observe(run);
    for (const item of this.$<HTMLSlotElement>('slot')!.assignedElements()) this.#follow.observe(item);
  }
}

define('sherpa-stack', SherpaStack);
