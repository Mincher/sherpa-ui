/**
 * node-output-panel.ts — the parts of an Output's inspector: a message field's Insert value menu, Send a test, and the
 * Output tab — the Preview, with the last simulation's values, and where each property is routed. Each is composed of
 * Sherpa's own components and only ASKS: the editor, or the host, acts. Will, plan 891
 *
 * Map:
 * - OutputFacts — What an Output's inspector reads: the values its messages can name, each one's sample, a test to ask for.
 * - valueMenu — A message field's Insert value: a menu of the values, a section per node, each with its sample.
 * - testButton — Send a test: it asks the host, which sends it; Sherpa sends nothing.
 * - outputPane — The Output tab: the Preview of each message, and where each property is routed.
 */
import { filled, type MessageSource } from '../data/node-messages.js';
import type { GraphNode } from '../data/node-kinds.js';
import '../../components/sherpa-accordion/sherpa-accordion.js';
import '../../components/sherpa-key-value-list/sherpa-key-value-list.js';
import '../../components/sherpa-menu/sherpa-menu.js';

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

/** A message field's Insert value: a button in its actions, opening a menu of the values its routes give, a section per node,
 *  each with its sample. A pick puts the value at the field's end, as the field's change. None to give: the button is off. */
export function valueMenu(field: HTMLElement & { value?: unknown }, label: string, facts: OutputFacts): HTMLElement {
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
    const key = (event as CustomEvent<{ value: string }>).detail.value;
    const text = String(field.value ?? '');
    field.value = `${text}${text && !/\s$/.test(text) ? ' ' : ''}${key}`;
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

/** The Output tab: the Preview — each message with the last simulation's values put in — and each property with where it
 *  is routed, by `routedTo`. */
export function outputPane(node: GraphNode, facts: OutputFacts, routedTo: (row: string) => readonly string[]): HTMLElement {
  const pane = make('sherpa-stack', { 'data-gap': 'sm', class: 'output-pane' });
  const section = (heading: string, pairs: readonly { key: string; value: string }[], note?: string): HTMLElement => {
    const acc = make('sherpa-accordion', { 'data-heading': heading, open: '' });
    const body = make('sherpa-stack', { 'data-gap': 'sm' });
    if (note) {
      const line = make('p', { class: 'output-note' });
      line.style.margin = '0';
      line.textContent = note;
      body.append(line);
    }
    const list = make('sherpa-key-value-list', { 'data-orientation': 'vertical' }) as HTMLElement & { populate(items: unknown): void };
    body.append(list);
    list.populate(pairs);
    acc.append(body);
    return acc;
  };
  const messages = node.rows.filter((r) => r.control === 'message').map((r) => ({ key: r.label, value: filled(r.value, (k) => facts.sample(k)) || '—' }));
  const properties = node.rows.filter((r) => r.property).map((r) => {
    const to = routedTo(r.name);
    return { key: r.label, value: to.length ? `To ${to.join(', ')}` : 'Not used' };
  });
  pane.append(section('Preview', messages, facts.simulated ? 'With the values of the last simulation.' : 'Press Simulate to see the values put in.'));
  if (properties.length) pane.append(section('Properties', properties));
  return pane;
}
