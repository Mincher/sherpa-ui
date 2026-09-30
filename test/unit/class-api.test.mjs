/**
 * A spec lists the class's OWN public members — read by TypeScript's parser, so
 * a member of a type or an object literal in the same file is never one of
 * them, and a summary is its whole first paragraph.
 * TRAP T-a-spec-reads-the-class-by-its-parser
 *
 *   node --test test/unit/class-api.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClassApi } from '../../scripts/lib/ts-facts.mjs';

const SRC = `
type Bar = HTMLElement & {
  populate(defs: unknown[]): void;
};
export class SherpaThing extends SherpaElement {
  static override config = { columns: [], key: 'id' };
  /** Open it. The whole sentence
   *  runs on. TRAP T-${'cited'}
   *
   *  A second paragraph is not the summary. */
  open(definition: string, options = {}) {
    const byId = { get elements() { return 1; } };
    return byId;
  }
  get view(): string { return ''; }
  protected override get templateId(): string { return 'default'; }
  #hidden(): void {}
  override onRender(): void {}
  static make(): void {}
}
customElements.define('sherpa-thing', SherpaThing);
`;

test('only the class own public members, with whole summaries', () => {
  const { methods, props } = parseClassApi(SRC);
  assert.deepEqual(methods, [{
    $type: 'method', name: 'open', args: 'definition: string, options = {}',
    description: 'Open it. The whole sentence runs on.',
  }]);
  assert.deepEqual(props.map((p) => `${p.name}:${p.access}`).sort(), ['columns:read-write', 'key:read-write', 'view:read']);
});

/* TODO 111: every property read `string`. A type as written, or `unknown`. */
test('a property is typed as its accessor says, and unknown where nothing does', () => {
  const { props } = parseClassApi(`
export class SherpaTyped extends SherpaElement {
  static override config = { key: 'id', size: 25, dense: false, columns: [] };
  get reading(): FieldReading { return {}; }
  set reading(next: FieldReading) {}
  get mode(): 'simple' | 'advanced' { return 'simple'; }
  set mode(next: 'simple' | 'advanced' | 'custom') {}
  set only(next: number) {}
  get open() { return false; }
}
customElements.define('sherpa-typed', SherpaTyped);
`);
  assert.deepEqual(Object.fromEntries(props.map((p) => [p.name, p.type])), {
    key: 'string', size: 'number', dense: 'boolean', columns: 'unknown',
    reading: 'FieldReading', mode: "'simple' | 'advanced'", only: 'number', open: 'unknown',
  });
});
