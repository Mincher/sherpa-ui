/**
 * read.js — the read tier's tools: what each component is, and the tokens.
 *
 *   list_components  every component: its slots, and what it asks for, takes and draws
 *   get_component    one component: its contract, its example and its import
 *   find_token       the token names tokens.css declares, by a fragment
 *
 * Map:
 * - register — register the read tools on an MCP server
 */
import { z } from 'zod/v3';
import { components, example, read, spec, tokens } from '../lib/sherpa.js';
import { answer, refuse } from '../lib/reply.js';

/** The spec keys a page uses. The rest (anatomy, templates, tokens) is how it draws. */
const CONTRACT = ['props', 'slots', 'populate', 'asks', 'takes', 'presents', 'settings', 'events'];
/** Of `$extensions.sherpa`, what a caller can call. Its Figma keys are Sherpa's own build data. */
const CALLABLE = ['jsProps', 'methods', 'commands'];

const category = (s) => s.$extensions?.sherpa?.category ?? 'other';
const slotName = (sl) => sl.name || '(default)';

/** One component, as a line of the list. */
function line(c, s) {
  const bits = [];
  if (s.slots?.length) bits.push(`slots ${s.slots.map((sl) => `${slotName(sl)} (${(sl.accepts ?? []).join(', ')})`).join(', ')}`);
  if (s.asks) bits.push(`asks ${JSON.stringify(s.asks)}`);
  if (s.takes?.length) bits.push(`takes ${s.takes.join(', ')}`);
  if (s.presents?.length) bits.push(`presents ${s.presents.map((p) => p.kind).join(', ')}`);
  return `- **${c.name}** — ${c.description}${bits.length ? `\n  ${bits.join(' · ')}` : ''}`;
}

/** The part of a spec a page uses, with the spec's own keys and paths. */
function contractOf(s) {
  const out = Object.fromEntries(CONTRACT.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
  const ext = s.$extensions?.sherpa ?? {};
  const callable = Object.fromEntries(CALLABLE.filter((k) => ext[k]?.length).map((k) => [k, ext[k]]));
  if (Object.keys(callable).length) out.$extensions = { sherpa: callable };
  return out;
}

/** What each key of a contract is, in the component schema's own words. */
function legend(contract) {
  const schema = JSON.parse(read('schema', { name: 'component' }));
  const ext = schema.$defs?.sherpaExtension?.properties ?? {};
  const rows = Object.keys(contract).filter((k) => k !== '$extensions').map((k) => [k, schema.properties[k]?.description]);
  for (const k of Object.keys(contract.$extensions?.sherpa ?? {})) rows.push([`$extensions.sherpa.${k}`, ext[k]?.description]);
  return rows.filter(([, d]) => d).map(([k, d]) => `- \`${k}\` — ${d}`);
}

/** A component's example, as a page writes it. TRAP T-a-component-ships-its-example */
function exampleOf(name, asks) {
  const ex = example(name);
  if (!ex) return [`_${name} ships no example._`];
  const out = [`When to use it: ${ex.use}`, '', '```html', ex.html, '```'];
  if (asks && ex.fill?.length) out.push('', 'The example has no provider, so it is given its data. On a page it asks for it (`asks`).');
  for (const f of ex.fill ?? []) out.push('', `\`populate()\` is given, on \`${f.at}\`:`, '```json', JSON.stringify(f.data, null, 2), '```');
  if (ex.show) out.push('', `\`${ex.show}\` is opened with \`show()\`${ex.anchor ? `, against \`${ex.anchor}\`` : ''}.`);
  return out;
}

/** Words people reach for that are not the token's: `bg` finds `surface`. */
const SYNONYMS = {
  text: 'content', ink: 'content', muted: 'secondary', subtle: 'tertiary', disabled: 'inactive',
  bg: 'surface', background: 'surface', fill: 'surface',
  stroke: 'border', outline: 'border', divider: 'border',
  radius: 'rounding', corner: 'rounding', gap: 'space', padding: 'space', margin: 'space',
};
/** A name or a fragment, without its prefix and its separators. */
const bare = (s) => s.toLowerCase().replace(/^--sherpa-/, '').replace(/[-/_\s]/g, '');
const PER_LAYER = 40;

export function register(server) {
  server.registerTool('list_components', {
    title: 'List the components',
    description: 'Every sherpa-* component, by category: what it is, its slots and what each accepts, what it asks its provider for (`asks`), what it takes beside its data (`takes`) and the kinds it draws (`presents`). Start here; get_component gives one in full.',
    inputSchema: {
      category: z.string().optional().describe('Only this category, e.g. control, container, chart or data; `other` for a component with none'),
    },
  }, async ({ category: only }) => {
    const groups = new Map();
    for (const c of components()) {
      const s = spec(c.name);
      if (!s || (only && category(s) !== only.toLowerCase())) continue;
      if (!groups.has(category(s))) groups.set(category(s), []);
      groups.get(category(s)).push(line(c, s));
    }
    const count = [...groups.values()].reduce((n, g) => n + g.length, 0);
    if (!count) return refuse(`No component is in category "${only}".`);
    const out = [`${count} component(s)${only ? ` in ${only}` : ''}. get_component says what each key means.`];
    for (const [name, rows] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) out.push('', `## ${name} (${rows.length})`, ...rows);
    return answer(out.join('\n'));
  });

  server.registerTool('get_component', {
    title: 'Get one component',
    description: 'One component in full: what it is, how to import it, its example as a page writes it, and its contract from its spec — its attributes, slots and what each accepts, what it asks its provider for, takes and presents, the settings it reads, its events, methods and properties. `include: "spec"` gives the whole spec as on disk.',
    inputSchema: {
      name: z.string().describe('The element name, e.g. sherpa-data-grid'),
      include: z.enum(['contract', 'spec']).optional().describe('contract (the default): what a page uses, with its example; spec: the whole spec as on disk'),
    },
  }, async ({ name, include = 'contract' }) => {
    const c = components().find((x) => x.name === name);
    const s = c && spec(name);
    if (!s) return refuse(`No component "${name}". The components: ${components().map((x) => x.name).join(', ')}.`);
    if (include === 'spec') return answer(read('spec', { name }));
    const contract = contractOf(s);
    return answer([
      `# ${name}`, '', c.description, '',
      `- Category: ${category(s)}`,
      ...(c.import ? [`- Import: \`import '${c.import}';\``] : []),
      `- The whole spec: \`sherpa://spec/${name}\`. Its source: \`sherpa://component/${name}/ts\`, \`/html\` and \`/css\`.`,
      '', '## Example', '', ...exampleOf(name, s.asks),
      '', '## Its contract', '', 'The spec\'s own keys. `schemas/component.v1.json` says:', '', ...legend(contract),
      '', '```json', JSON.stringify(contract, null, 2), '```',
    ].join('\n'));
  });

  server.registerTool('find_token', {
    title: 'Find a token',
    description: 'The design tokens tokens.css declares whose names hold every word of the query: `surface`, `border accent`, `content/body`. A common word finds its token\'s word too: `bg` finds `surface`, `disabled` finds `inactive`. Each with its layer and its first value. An empty query lists the families.',
    inputSchema: {
      query: z.string().describe('Words of a token name, e.g. surface, border accent or space; empty for the families'),
    },
  }, async ({ query }) => {
    const all = tokens();
    const words = String(query ?? '').split(/[\s,]+/).map(bare).filter(Boolean);
    if (!words.length) {
      const families = Object.groupBy(all, (t) => t.name.slice('--sherpa-'.length).split('-')[0]);
      return answer([`tokens.css declares ${all.length} tokens. By the first word of the name:`, '',
        ...Object.entries(families).sort(([a], [b]) => (a < b ? -1 : 1)).map(([f, ts]) => `- ${f} (${ts.length})`)].join('\n'));
    }
    const hits = all.filter((t) => words.every((w) => [w, SYNONYMS[w]].filter(Boolean).some((alt) => bare(t.name).includes(alt))));
    if (!hits.length) return answer(`No token name holds "${query}". tokens.css declares ${all.length}; try one word: surface, border, content, space, size, rounding.`);
    const out = [`${hits.length} token(s) match "${query}":`];
    for (const [layer, ts] of Object.entries(Object.groupBy(hits, (t) => t.layer || 'none'))) {
      out.push('', `### ${layer} (${ts.length})`);
      for (const t of ts.slice(0, PER_LAYER)) out.push(`- \`${t.name}\`: \`${t.value.length > 80 ? `${t.value.slice(0, 79)}…` : t.value}\`${t.count > 1 ? ` (declared ${t.count} times)` : ''}`);
      if (ts.length > PER_LAYER) out.push(`- …${ts.length - PER_LAYER} more: add a word`);
    }
    out.push('', 'Read one as `var(--sherpa-x, <its value>)`. The whole sheet: `sherpa://tokens`.');
    return answer(out.join('\n'));
  });
}
