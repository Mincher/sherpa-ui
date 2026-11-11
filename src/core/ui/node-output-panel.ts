/**
 * node-output-panel.ts — the parts of an Output's inspector: a message field, its Insert value menu, Send a test, and the
 * Output tab — the Preview, with the last simulation's values, and where each property is routed. Each is composed of
 * Sherpa's own components and only ASKS: the editor, or the host, acts. Will, plans 891 and 892
 *
 * Map:
 * - OutputFacts — What an Output's inspector reads: the values its messages can name, each one's sample, a test to ask for.
 * - messageField — A message row's field: the Markdown editor, its values purple chips.
 * - valueMenu — A message field's Insert value: a menu of the values, a section per node, each with its sample.
 * - testButton — Send a test: it asks the host, which sends it; Sherpa sends nothing.
 * - outputPane — The Output tab: the Preview of each message as it reads, and where each property is routed.
 */
import { filled, type MessageSource } from '../data/node-messages.js';
import type { GraphNode } from '../data/node-kinds.js';
import '../../components/sherpa-accordion/sherpa-accordion.js';
import '../../components/sherpa-key-value-list/sherpa-key-value-list.js';
import '../../components/sherpa-markdown-editor/sherpa-markdown-editor.js';
import '../../components/sherpa-menu/sherpa-menu.js';
import type { SherpaMarkdownEditor } from '../../components/sherpa-markdown-editor/sherpa-markdown-editor.js';

/** What an Output's inspector reads: the values its messages can name, each one's sample from the last simulation (none,
 *  not simulated), and the test it asks for. */
export interface OutputFacts {
  sources: readonly MessageSource[];
  sample(key: string): unknown;
  simulated: boolean;
  onTest?(): void;
}

/** A control made of a Sherpa component, its attributes set. */
function make(tag: string, attrs: Readonly<Record<string, string>>): HTMLElement {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

/** A sample in words, short. */
const words = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  const said = typeof value === 'string' ? value : JSON.stringify(value);
  return said.length > 24 ? `${said.slice(0, 23)}…` : said;
};

/** Each value's words, by its key: its node's heading and its own label. */
const labelsOf = (facts: OutputFacts): Record<string, string> =>
  Object.fromEntries(facts.sources.flatMap((s) => s.values.map((v) => [v.key, `${s.heading} › ${v.label}`])));

/** A message row's field: the Markdown editor (plan 892), named for its row. The node shows its first lines. */
export function messageField(name: string): SherpaMarkdownEditor {
  return make('sherpa-markdown-editor', { name }) as SherpaMarkdownEditor;
}

/** A message field's Insert value: a button after it, opening a menu of the values its routes give, a section per node,
 *  each with its sample. A pick puts the value at the caret, as the field's change; each value in the field reads by its
 *  node and label. None to give: the button is off. */
export function valueMenu(message: HTMLElement, label: string, facts: OutputFacts): HTMLElement {
  // A message row's field is the editor: `messageField`.
  const field = message as SherpaMarkdownEditor;
  field.valueLabels = labelsOf(facts);
  const items = facts.sources.flatMap((s) => s.values.map((v) => ({ value: v.key, label: v.label, section: s.heading, action: true, ...(words(facts.sample(v.key)) ? { note: words(facts.sample(v.key))! } : {}) })));
  const button = make('sherpa-button', { 'data-size': 'sm', 'data-label': 'Insert value', 'aria-label': `Insert value in ${label}`, 'data-icon-start': 'plus', class: 'insert-value' });
  if (!items.length) {
    button.setAttribute('disabled', '');
    button.setAttribute('data-description', 'No node before it sends a value: route one in');
    return button;
  }
  const menu = make('sherpa-menu', { slot: 'menu', 'data-search': '' }) as HTMLElement & { populate(items: unknown): void };
  menu.addEventListener('menu-select', (event) => {
    event.stopPropagation();
    field.insertValue((event as CustomEvent<{ value: string }>).detail.value);
    field.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { value: field.value } }));
  });
  button.append(menu);
  menu.populate(items);
  return button;
}

/** Send a test: it asks the host, which sends it to the reader. Sherpa sends nothing (plan 891; running for real is N4). */
export function testButton(facts: OutputFacts): HTMLElement | undefined {
  if (!facts.onTest) return undefined;
  const button = make('sherpa-button', { 'data-size': 'sm', 'data-label': 'Send a test', 'data-icon-start': 'play', class: 'send-test' });
  button.addEventListener('button-click', () => facts.onTest!());
  return button;
}

/** The Output tab: the Preview — each message as it reads, the last simulation's values put in — and each property with
 *  where it is routed, by `routedTo`. */
export function outputPane(node: GraphNode, facts: OutputFacts, routedTo: (row: string) => readonly string[]): HTMLElement {
  const pane = make('sherpa-stack', { 'data-gap': 'sm', class: 'output-pane' });
  const section = (heading: string, parts: readonly HTMLElement[], note?: string): HTMLElement => {
    const acc = make('sherpa-accordion', { 'data-heading': heading, open: '' });
    const body = make('sherpa-stack', { 'data-gap': 'sm' });
    if (note) {
      const line = make('p', { class: 'output-note' });
      line.style.margin = '0';
      line.textContent = note;
      body.append(line);
    }
    body.append(...parts);
    acc.append(body);
    return acc;
  };
  // A message reads as its reader sees it: the editor, read only; a value not simulated, by its node and label.
  const labels = labelsOf(facts);
  const messages = node.rows.filter((r) => r.control === 'message').map((r) => {
    const view = make('sherpa-markdown-editor', { readonly: '', 'data-label': r.label, placeholder: '—', class: 'output-message' }) as SherpaMarkdownEditor;
    view.value = filled(r.value, (k) => facts.sample(k));
    view.valueLabels = labels;
    return view;
  });
  const list = make('sherpa-key-value-list', { 'data-orientation': 'vertical' }) as HTMLElement & { populate(items: unknown): void };
  list.populate(node.rows.filter((r) => r.property).map((r) => {
    const to = routedTo(r.name);
    return { key: r.label, value: to.length ? `To ${to.join(', ')}` : 'Not used' };
  }));
  pane.append(section('Preview', messages, facts.simulated ? 'With the values of the last simulation.' : 'Press Simulate to see the values put in.'));
  if (node.rows.some((r) => r.property)) pane.append(section('Properties', [list]));
  return pane;
}
