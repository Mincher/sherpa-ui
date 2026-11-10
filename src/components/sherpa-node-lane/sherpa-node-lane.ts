/**
 * sherpa-node-lane — one swimlane of a workflow: a row across a sherpa-layout-canvas, its name at the view's start.
 * It owns no place: its host writes its top and height. Will, 2026-11-10
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

export class SherpaNodeLane extends SherpaElement {
  static override css = new URL('./sherpa-node-lane.css', import.meta.url);
  static override html = new URL('./sherpa-node-lane.html', import.meta.url);

  static override props = {
    'data-heading': { type: 'string', kind: 'content' },
    'data-type': { type: 'enum', kind: 'style', values: ['lane', 'junction'] },
    'data-colour': { type: 'string', kind: 'behaviour' },
    'data-y': { type: 'number', kind: 'behaviour' },
    'data-h': { type: 'number', kind: 'behaviour' },
  } as const;
  static override observed = ['data-y', 'data-h', 'data-colour'];

  override onRender(): void {
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** Where the canvas draws it, and its colour. */
  #sync(): void {
    this.style.setProperty('--y', `${this.num('data-y', 0)}px`);
    this.style.setProperty('--height', `${this.num('data-h', 0)}px`);
    const colour = this.getAttribute('data-colour');
    if (colour) this.style.setProperty('--_colour', colour);
    else this.style.removeProperty('--_colour');
  }
}

define('sherpa-node-lane', SherpaNodeLane);
