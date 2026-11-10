/**
 * read.js — the read tier's resources: sherpa-ui's own files, as they ship.
 *
 *   sherpa://schemas/{name}           a contract in schemas/, newest version: `page` is page.v1.json
 *   sherpa://spec/{name}              a component's spec, as on disk
 *   sherpa://example/{name}           a component's example, as on disk
 *   sherpa://component/{name}/{kind}  a component's source: ts, html or css
 *   sherpa://app-guide                how to build an app on Sherpa, step by step
 *   sherpa://data-rules               what Sherpa expects of your data
 *   sherpa://tokens                   the token sheet, as the package ships it
 *
 * Map:
 * - register — register the read resources on an MCP server
 */
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { components, has, read, schemaVersion, schemas } from '../lib/sherpa.js';

const KINDS = { ts: 'text/typescript', html: 'text/html', css: 'text/css' };
const JSON_TYPE = 'application/json';
const SCHEMA_TYPE = 'application/schema+json';

/** The caller's error, as MCP says it: McpError would say its code twice. */
const notFound = (message) => Object.assign(new Error(message), { code: ErrorCode.InvalidParams });

/** A file as a resource's contents. A name that is no file is the caller's error. */
function contents(uri, key, vars, mimeType) {
  const text = read(key, vars);
  if (text == null) throw notFound(`No such resource: ${uri.href}`);
  return { contents: [{ uri: uri.href, mimeType, text }] };
}

/** A template variable's completions: the names that start with what is typed. */
const completes = (names) => (typed) => names().filter((n) => n.startsWith(typed ?? ''));
const names = () => components().map((c) => c.name);

/** One resource per component that has the file. */
const perComponent = (key, uri, label, mimeType) => async () => ({
  resources: components().filter((c) => has(key, { name: c.name }))
    .map((c) => ({ uri: uri(c.name), name: `${c.name} ${label}`, description: c.description, mimeType })),
});

export function register(server) {
  server.registerResource('schema', new ResourceTemplate('sherpa://schemas/{name}', {
    list: async () => ({
      resources: schemas().map((s) => ({ uri: `sherpa://schemas/${s.name}`, name: `${s.name} schema`, description: s.title, mimeType: SCHEMA_TYPE })),
    }),
    complete: { name: completes(() => schemas().map((s) => s.name)) },
  }), {
    title: 'A contract',
    description: 'A JSON Schema in sherpa-ui\'s schemas/, by name, at its newest version: `page` is page.v1.json, `workflow` workflow.v2.json. The contracts of an app\'s files, the shapes they share (`defs`), a component\'s spec and example, and a pattern',
    mimeType: SCHEMA_TYPE,
  }, async (uri, { name }) => contents(uri, 'schema', { name, v: String(schemaVersion(String(name)) ?? '') }, SCHEMA_TYPE));

  server.registerResource('spec', new ResourceTemplate('sherpa://spec/{name}', {
    list: perComponent('spec', (n) => `sherpa://spec/${n}`, 'spec', JSON_TYPE),
    complete: { name: completes(names) },
  }), {
    title: 'A component\'s spec',
    description: 'A component\'s `<name>.component.json`, as on disk: generated from its source and checked against the component schema',
    mimeType: JSON_TYPE,
  }, async (uri, { name }) => contents(uri, 'spec', { name }, JSON_TYPE));

  server.registerResource('example', new ResourceTemplate('sherpa://example/{name}', {
    list: perComponent('example', (n) => `sherpa://example/${n}`, 'example', JSON_TYPE),
    complete: { name: completes(names) },
  }), {
    title: 'A component\'s example',
    description: 'A component\'s `<name>.example.json`, as on disk: its markup as a page writes it, the data it is given, and when to use it',
    mimeType: JSON_TYPE,
  }, async (uri, { name }) => contents(uri, 'example', { name }, JSON_TYPE));

  server.registerResource('component source', new ResourceTemplate('sherpa://component/{name}/{kind}', {
    list: async () => ({
      resources: components().flatMap((c) => Object.entries(KINDS).filter(([kind]) => has('source', { name: c.name, kind }))
        .map(([kind, mimeType]) => ({ uri: `sherpa://component/${c.name}/${kind}`, name: `${c.name}.${kind}`, mimeType }))),
    }),
    complete: { name: completes(names), kind: completes(() => Object.keys(KINDS)) },
  }), {
    title: 'A component\'s source',
    description: 'A component\'s shipped .ts, .html or .css: its class, its template, its sheet',
  }, async (uri, { name, kind }) => {
    if (!KINDS[kind]) throw notFound(`No such resource: ${uri.href}. A source is ts, html or css`);
    return contents(uri, 'source', { name, kind }, KINDS[kind]);
  });

  server.registerResource('app guide', 'sherpa://app-guide', {
    title: 'Building an app on Sherpa',
    description: 'How to build an app on Sherpa, step by step: the page, the shell, app.json, stores, a page definition, a template that asks, a Context module, Views, the session and starting the outlet (docs/APP-GUIDE.md)',
    mimeType: 'text/markdown',
  }, async (uri) => contents(uri, 'appGuide', {}, 'text/markdown'));

  server.registerResource('data rules', 'sherpa://data-rules', {
    title: 'What Sherpa expects of your data',
    description: 'The row shape, the conditions a query is made of, the Store contract, where validation belongs, and the data layer with no browser (docs/DATA-SOURCE-RULES.md)',
    mimeType: 'text/markdown',
  }, async (uri) => contents(uri, 'dataRules', {}, 'text/markdown'));

  server.registerResource('tokens', 'sherpa://tokens', {
    title: 'The token sheet',
    description: 'Every --sherpa-* token, by layer and mode, as the package ships it: src/styles/tokens/tokens.css, the source of `sherpa-ui/css`',
    mimeType: 'text/css',
  }, async (uri) => contents(uri, 'tokens', {}, 'text/css'));
}
