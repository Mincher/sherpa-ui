/**
 * THE STARTER IS ONE FOLDER: `npx sherpa-ui init <folder>` copies it, named
 * for the folder, and what it makes passes the app schema, the page schema,
 * checkApp and the usage gate. reforged-starter.spec.ts boots it. TODO 222.
 * TRAP T-a-starter-is-one-folder
 *
 *   npm run build && node --test test/unit/the-starter.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { init } from '../../bin/sherpa-ui.mjs';
import { usageProblems } from '../../scripts/check-usage.mjs';
import { checkApp, onReport } from '../../dist/data.js';

const ROOT = new URL('../../', import.meta.url);
const schema = (name) => {
  const Ajv = Ajv2020.default ?? Ajv2020;
  return new Ajv({ allErrors: true, strict: false }).compile(JSON.parse(readFileSync(new URL(`schemas/${name}`, ROOT), 'utf8')));
};
const json = (dir, path) => JSON.parse(readFileSync(join(dir, path), 'utf8'));

test('init makes the app: its files, its dot files, and its name', () => {
  const work = mkdtempSync(join(tmpdir(), 'sherpa-starter-'));
  try {
    const app = init(join(work, 'My App'));
    for (const file of ['index.html', 'app.json', 'AGENTS.md', 'package.json', '.gitignore', '.mcp.json',
      'templates/records.html', 'view-schemas/records.json', 'views/records-views.json', 'stores/records.js', 'contexts/records.js']) {
      assert.ok(existsSync(join(app, file)), `no ${file}`);
    }
    assert.equal(json(app, 'package.json').name, 'my-app');
    assert.throws(() => init(join(work, 'My App')), /is not empty/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('the app it makes passes the app and page schemas, checkApp and the usage gate', () => {
  const work = mkdtempSync(join(tmpdir(), 'sherpa-starter-'));
  try {
    const dir = init(join(work, 'app'));
    const app = json(dir, 'app.json');
    const isApp = schema('app.v1.json');
    assert.ok(isApp(app), JSON.stringify(isApp.errors));
    const seen = [];
    const undo = onReport((r) => seen.push(r.message));
    try {
      assert.ok(checkApp(app), seen.join(' '));
    } finally {
      undo();
    }
    const isPage = schema('page.v1.json');
    for (const context of Object.values(app.contexts)) {
      for (const path of [context.template, context.definition, context.views, context.module].filter(Boolean)) {
        assert.ok(existsSync(join(dir, path)), `app.json names ${path}, which is not there`);
      }
      if (context.definition) assert.ok(isPage(json(dir, context.definition)), JSON.stringify(isPage.errors));
    }
    writeFileSync(join(dir, 'sherpa-usage.json'), JSON.stringify({ markup: ['.'] }));
    const { problems, tags } = usageProblems(dir);
    assert.deepEqual(problems, []);
    assert.ok(tags > 5);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
