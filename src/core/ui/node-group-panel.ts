/**
 * node-group-panel.ts — the parts of a node's inspector that belong to a Custom Node: what to do
 * with an instance (Open, Ungroup), the update's diff and its split button, and a
 * node's incoming and outgoing JSON, and the rows it heard and said in a simulation. Each is composed of Sherpa's own components and
 * only ASKS: the editor acts. Will, TODO 719 · plan 713 §9.2, M10, M11, D9, D11
 *
 * Map:
 * - diffRows — A definition's change as rows of words: what each of its parts did.
 * - UpdateActions — What the update split button asks of its editor.
 * - updatePane — The diff of an instance's definition, and the split button whose primary is "Update instance".
 * - InstanceActions — What a Custom Node's instance may ask: open it, ungroup it, copy a preset.
 * - instancePane — The buttons for one instance: Open, Ungroup.
 * - flowPane — A node's Incoming and Outgoing JSON: two collapsible sections of code blocks.
 * - dataPane — What a node heard and said in a simulation: each socket's rows, in the data grid and as JSON.
 */
import type { DefinitionDiff } from '../data/node-library.js';
import type { NodeFlow } from '../data/node-flow.js';
import type { SimulatedNode, Slot } from '../data/node-simulate.js';
import '../../components/sherpa-data-grid/sherpa-data-grid.js';
import '../../components/sherpa-accordion/sherpa-accordion.js';

/** A control made of a Sherpa component, its attributes set. */
function make(tag: string, attrs: Readonly<Record<string, string>>): HTMLElement {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

/** A small button that asks. */
function button(label: string, act: () => void, extra: Readonly<Record<string, string>> = {}): HTMLElement {
  const el = make('sherpa-button', { 'data-label': label, 'data-size': 'sm', ...extra });
  el.addEventListener('button-click', act);
  return el;
}

const list = (names: readonly string[]): string => names.join(', ');

/** A definition's change as rows of words: what each of its parts did. None for a part that stood. */
export function diffRows(diff: DefinitionDiff): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [];
  if (!diff.known) return [{ key: 'Change', value: 'The definition changed. This node recorded no copy of it, so its parts are not listed.' }];
  if (diff.label) rows.push({ key: 'Name', value: `${diff.label.from} to ${diff.label.to}` });
  for (const [side, sockets] of [['Input', diff.inputs], ['Output', diff.outputs]] as const) {
    if (sockets.added.length) rows.push({ key: `${side}s added`, value: list(sockets.added) });
    if (sockets.removed.length) rows.push({ key: `${side}s removed`, value: list(sockets.removed) });
    for (const r of sockets.retyped) rows.push({ key: `${side} ${r.name}`, value: `${r.from} to ${r.to}` });
    if (sockets.changed.length) rows.push({ key: `${side}s changed`, value: list(sockets.changed) });
  }
  if (diff.nodes.added.length) rows.push({ key: 'Nodes added', value: list(diff.nodes.added) });
  if (diff.nodes.removed.length) rows.push({ key: 'Nodes removed', value: list(diff.nodes.removed) });
  if (diff.nodes.changed.length) rows.push({ key: 'Nodes changed', value: list(diff.nodes.changed) });
  const routes = diff.routes.added.length + diff.routes.removed.length;
  if (routes) rows.push({ key: 'Routes', value: `${diff.routes.added.length} added, ${diff.routes.removed.length} removed` });
  return rows.length ? rows : [{ key: 'Change', value: 'The definition was saved again.' }];
}

/** What the update split button asks of its editor. A bulk action not given is not offered. */
export interface UpdateActions {
  onUpdate(): void;
  /** Update all instances on graph. */
  onGraph?(): void;
  /** Update all instances. */
  onAll?(): void;
}

/** The diff of an instance's definition, and the split button whose primary is "Update instance";
 *  its menu holds the two bulk actions, which the editor confirms. */
export function updatePane(diff: DefinitionDiff, actions: UpdateActions): HTMLElement {
  const pane = make('sherpa-stack', { 'data-gap': 'md', class: 'update-pane' });
  const heading = make('p', { class: 'update-heading' });
  heading.style.margin = '0';
  heading.textContent = 'An update is available: this Custom Node was changed after it was placed.';
  const changes = make('sherpa-key-value-list', { 'data-orientation': 'vertical' });
  const split = make('sherpa-group', { class: 'update-split' });
  const caret = make('sherpa-button', { 'data-type': 'icon', 'data-size': 'sm', 'data-icon-start': 'chevron-down', 'aria-label': 'More ways to update' });
  const bulk: (readonly [string, string])[] = [
    ...(actions.onGraph ? [['graph', 'Update all instances on graph'] as const] : []),
    ...(actions.onAll ? [['all', 'Update all instances'] as const] : []),
  ];
  if (bulk.length) {
    const menu = make('sherpa-menu', { slot: 'menu', 'data-align': 'end' });
    for (const [value, label] of bulk) {
      const item = make('button', { type: 'button', value });
      item.textContent = label;
      menu.append(item);
    }
    menu.addEventListener('menu-select', (event) => {
      const value = (event as CustomEvent<{ value?: string }>).detail?.value;
      if (value === 'graph') actions.onGraph?.();
      else if (value === 'all') actions.onAll?.();
    });
    caret.append(menu);
  }
  split.append(button('Update instance', actions.onUpdate, { 'data-look': 'saturated' }), ...(bulk.length ? [caret] : []));
  pane.append(heading, changes, split);
  queueMicrotask(() => (changes as HTMLElement & { populate?(items: unknown): void }).populate?.(diffRows(diff)));
  return pane;
}

/** What an instance may ask: open it, ungroup it. */
export interface InstanceActions {
  onOpen(): void;
  onUngroup(): void;
}

/** The buttons for one instance of a Custom Node: Open (its inside, under breadcrumbs) and Ungroup (its nodes, back in this graph). */
export function instancePane(actions: InstanceActions): HTMLElement {
  const pane = make('sherpa-stack', { 'data-gap': 'sm', 'data-direction': 'inline' });
  pane.append(button('Open', actions.onOpen, { 'data-icon-start': 'fullscreen' }), button('Ungroup', actions.onUngroup));
  return pane;
}

/** A node's definition view as JSON: Incoming and Outgoing, each a collapsible section holding a code block, shut when long. */
export function flowPane(flow: NodeFlow): HTMLElement {
  const pane = make('sherpa-stack', { 'data-gap': 'sm', class: 'flow-pane' });
  const section = (heading: string, json: unknown): HTMLElement => {
    const code = JSON.stringify(json, null, 2);
    const acc = make('sherpa-accordion', { 'data-heading': heading, class: 'flow-section', ...(code.split('\n').length <= 12 ? { open: '' } : {}) });
    const caption = make('p', { class: 'flow-caption' });
    caption.style.margin = '0';
    caption.textContent = 'The node\'s definition, not a run: live values come with the runner.';
    acc.append(caption, make('sherpa-code-block', { 'data-language': 'json', 'data-code': code }));
    return acc;
  };
  pane.append(section('Incoming JSON', flow.incoming), section('Outgoing JSON', { outgoing: flow.outgoing, ...(flow.definition ? { definition: flow.definition } : {}) }));
  return pane;
}

/** The most rows of a socket the pane writes out. */
const DATA_ROWS = 50;

/** One socket in words: how many rows, its field or value, or why it holds none. */
function slotWords(slot: Slot): string {
  const rows = slot.rows ? `${slot.rows.length.toLocaleString('en')} ${slot.rows.length === 1 ? 'row' : 'rows'}` : '';
  const value = slot.kind === 'field' ? `field "${String(slot.value ?? '')}"` : slot.value !== undefined && !slot.rows ? JSON.stringify(slot.value) : '';
  return [rows, value, slot.note].filter(Boolean).join(' · ') || 'nothing';
}

/** What a node heard and said in the last simulation: each socket in words, its rows as JSON, the first 50. A graph edited
 *  since says so. The same rows a grid will show; the JSON is the rows. Will, TODO 836 */
export function dataPane(data: { node: SimulatedNode; stale: boolean }, shown = DATA_ROWS): HTMLElement {
  const pane = make('sherpa-stack', { 'data-gap': 'sm', class: 'data-pane' });
  const section = (heading: string, slots: readonly Slot[]): HTMLElement => {
    const acc = make('sherpa-accordion', { 'data-heading': heading, class: 'data-section', open: '' });
    const body = make('sherpa-stack', { 'data-gap': 'sm' });
    for (const slot of slots) {
      const line = make('p', { class: 'data-line' });
      line.style.margin = '0';
      line.textContent = `${slot.label}: ${slotWords(slot)}`;
      body.append(line);
      if (slot.rows?.length) {
        // The rows as they are, in the grid the pages use: a column for each field the first rows hold.
        const first = slot.rows.slice(0, shown);
        const grid = make('sherpa-data-grid', { class: 'data-grid' }) as HTMLElement & { populate(data: unknown): Promise<void> };
        const frame = make('div', {});
        frame.style.blockSize = `${Math.min(280, 56 + 32 * first.length)}px`;
        grid.style.blockSize = '100%';
        frame.append(grid);
        body.append(frame);
        void grid.populate({ columns: [...new Set(first.flatMap((r) => Object.keys(r)))].slice(0, 12).map((field) => ({ field, header: field })), rows: first });
        // The same rows as JSON, shut.
        const json = make('sherpa-accordion', { 'data-heading': 'JSON', class: 'data-json' });
        json.append(make('sherpa-code-block', { 'data-language': 'json', 'data-code': JSON.stringify(first, null, 2) }));
        body.append(json);
        if (slot.rows.length > shown) {
          const more = make('p', { class: 'data-more' });
          more.style.margin = '0';
          more.textContent = `The first ${shown} of ${slot.rows.length.toLocaleString('en')} rows.`;
          body.append(more);
        }
      }
    }
    if (!slots.length) body.append(make('p', { class: 'data-line' }));
    acc.append(body);
    return acc;
  };
  if (data.stale) {
    const stale = make('p', { class: 'data-stale' });
    stale.style.margin = '0';
    stale.textContent = 'Stale: the graph changed since this ran. Press Simulate.';
    pane.append(stale);
  }
  pane.append(section('Incoming data', data.node.incoming), section('Outgoing data', data.node.outgoing));
  return pane;
}
