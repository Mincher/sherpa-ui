/**
 * A project's markup is checked against the component specs: a typo, a value
 * an enum does not take, and a tag that is no component are each said; a hook
 * the project names as its own is not (TODO 195).
 * TRAP T-markup-is-checked-against-the-spec
 *
 *   node --test test/unit/check-usage.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { usageProblems } from '../../scripts/check-usage.mjs';

test('a typo, a wrong value and an unknown tag are said; the project\'s own hook and a placement are not', () => {
  const project = mkdtempSync(join(tmpdir(), 'sherpa-usage-'));
  try {
    mkdirSync(join(project, 'app'));
    writeFileSync(join(project, 'sherpa-usage.json'), JSON.stringify({ own: { 'sherpa-button': ['data-by'] } }));
    writeFileSync(join(project, 'app', 'page.html'), [
      '<!-- <sherpa-nothing data-x> in a comment is not markup -->',
      '<sherpa-button data-lable="Save" data-by="1" data-col-span="2"></sherpa-button>',
      '<sherpa-slider data-type="ranged"></sherpa-slider>',
      '<sherpa-buton></sherpa-buton>',
      '<sherpa-stack data-status="critical"><sherpa-metric data-grow></sherpa-metric></sherpa-stack>',
    ].join('\n'));
    const { problems, tags } = usageProblems(project);
    assert.equal(tags, 5);
    assert.deepEqual(problems, [
      'app/page.html:2  <sherpa-button data-lable> — sherpa-button has no such attribute',
      'app/page.html:3  <sherpa-slider data-type="ranged"> — it takes "single", "range"',
      'app/page.html:4  <sherpa-buton> is no Sherpa component',
    ]);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test('an app runs it on itself: `npx sherpa-ui check-usage <folder>` fails on a typo, passes on clean markup', () => {
  const project = mkdtempSync(join(tmpdir(), 'sherpa-usage-cli-'));
  const run = () => spawnSync(process.execPath, [fileURLToPath(new URL('../../bin/sherpa-ui.mjs', import.meta.url)), 'check-usage', project], { encoding: 'utf8' });
  try {
    mkdirSync(join(project, 'app'));
    writeFileSync(join(project, 'app', 'page.html'), '<sherpa-button data-lable="Save"></sherpa-button>');
    const bad = run();
    writeFileSync(join(project, 'app', 'page.html'), '<sherpa-button data-label="Save"></sherpa-button>');
    const good = run();
    assert.deepEqual([bad.status, /data-lable/.test(bad.stderr)], [1, true]);
    assert.deepEqual([good.status, /1 tags .* match their specs/.test(good.stdout)], [0, true]);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
