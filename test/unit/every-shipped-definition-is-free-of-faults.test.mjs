/**
 * EVERY SHIPPED DEFINITION IS FREE OF FAULTS — Will, 2026-11-06 (TODO 835): "A graph with issues must NOT save ... FIX every
 * legacy definition in the repo and in Demos so it has no errors: delete or correct them. No read-time conversion." This
 * walks every workflow and entity file sherpa-ui ships, as a fixture or a harness's: each passes its own check, so none holds
 * a kind that is gone (a `collection`, a `store`, a `pick`) or a connection from a socket that is not one. Demos walks its own.
 *
 *   node --test test/unit/every-shipped-definition-is-free-of-faults.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const core = new URL('dist/core/data/', root);
const { workflowFaults } = await import(new URL('workflow.js', core));
const { entityFaults } = await import(new URL('entity-check.js', core));

const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const walk = async (dir) => (await readdir(new URL(dir, root), { withFileTypes: true })).flatMap((e) => (e.isDirectory() ? [] : [`${dir}${e.name}`]));

test('every workflow file sherpa-ui ships has no fault', async () => {
  const files = (await walk('test/unit/fixtures/')).filter((f) => f.endsWith('.workflow.json'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const flow = await json(file);
    assert.deepEqual(workflowFaults(flow), [], file);
  }
});

test('every entity the harness ships has no fault', async () => {
  const { entities } = await json('test/reforged/graph-views/entities.json');
  const all = Object.values(entities);
  assert.ok(all.length > 0);
  for (const entity of all) assert.deepEqual(entityFaults(entity, { entities: all }), [], entity.id);
});
