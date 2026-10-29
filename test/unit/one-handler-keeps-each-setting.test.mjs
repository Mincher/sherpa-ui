/**
 * ONE HANDLER KEEPS EACH SETTING — Will, TODO 553. Each app setting is one
 * line in one table: its session pointer drives a property of its target, and
 * the event the target reports a reader's change by writes it back, so the
 * Settings page and a bar's ⋮ can never disagree.
 *
 *   node --test test/unit/one-handler-keeps-each-setting.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { followSettings } from '../../dist/core/ui/bind-settings.js';
import { SessionStore } from '../../dist/core/browser/session.js';

class Target extends EventTarget {
  limitOptions = false;
  filterMode = 'toolbars';
  sections = true;
}

test('the session drives each property now and on every change', () => {
  const session = new SessionStore({ filters: { limit: true, mode: 'panel' } });
  const target = new Target();
  followSettings(target, session, { limitOptions: '/filters/limit', filterMode: '/filters/mode' });
  assert.deepEqual([target.limitOptions, target.filterMode], [true, 'panel']);
  session.set('/filters/limit', false);
  assert.equal(target.limitOptions, false);
});

test('a change the target reports is written back to the session', () => {
  const session = new SessionStore({ filters: { limit: false } });
  const target = new Target();
  followSettings(target, session, { limitOptions: { at: '/filters/limit', heard: ['limit-options-change', 'on'] } });
  target.dispatchEvent(new CustomEvent('limit-options-change', { detail: { on: true } }));
  assert.equal(session.get('/filters/limit'), true);
  assert.equal(target.limitOptions, true);
});

test('a pointer the session holds nothing at keeps the default, else the target\'s own', () => {
  const session = new SessionStore({});
  const target = new Target();
  followSettings(target, session, { sections: '/filters/sections', limitOptions: { at: '/filters/limit', default: true } });
  assert.deepEqual([target.sections, target.limitOptions], [true, true]);
});

test('once its signal aborts, neither way is followed', () => {
  const session = new SessionStore({ filters: { limit: false } });
  const target = new Target();
  const stop = new AbortController();
  followSettings(target, session, { limitOptions: { at: '/filters/limit', heard: ['limit-options-change', 'on'] } }, { signal: stop.signal });
  stop.abort();
  session.set('/filters/limit', true);
  target.dispatchEvent(new CustomEvent('limit-options-change', { detail: { on: false } }));
  assert.deepEqual([target.limitOptions, session.get('/filters/limit')], [false, true]);
});
