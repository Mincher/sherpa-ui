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
