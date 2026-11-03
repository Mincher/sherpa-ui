/**
 * A SETTING IS DECLARED ONCE — 695 U2. Each is one schema entry: its type,
 * default, scope and session pointer. `Settings` reads the app's kept value over
 * the default, a page's own over both, and says each value that moves.
 *
 *   node --test test/unit/a-setting-is-declared-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SETTINGS, Settings, fitsSetting } from '../../dist/core/data/settings.js';
import { persistSettings } from '../../dist/core/ui/bind-settings.js';
import { SessionStore } from '../../dist/core/browser/session.js';
import { onReport } from '../../dist/core/data/report.js';

/** The reports said while `run` runs. */
const said = (run) => {
  const codes = [];
  const stop = onReport((issue) => codes.push(issue.code));
  try { run(); } finally { stop(); }
  return codes;
};

test('every setting fits its own default, and each is kept at a pointer of its own', () => {
  for (const [key, def] of Object.entries(SETTINGS)) assert.ok(fitsSetting(def, def.default), key);
  const pointers = Object.values(SETTINGS).map((def) => def.at);
  assert.equal(new Set(pointers).size, pointers.length);
});

test('a setting reads the app\'s kept value, else its default; a value it cannot take is the default', () => {
  const session = new SessionStore({ filters: { limit: true, mode: 'sideways' } });
  const settings = new Settings(SETTINGS, session);
  assert.equal(settings.get('limitOptions'), true);
  assert.equal(settings.get('results'), true, 'nothing kept: the default');
  assert.equal(settings.get('filterMode'), 'toolbars', 'a stale shape: the default');
  assert.equal(settings.get('switchable'), null, 'none: each bar keeps its own');
});

test('a set is kept in the session, and said once; a value it cannot take is refused', () => {
  const session = new SessionStore({});
  const settings = new Settings(SETTINGS, session);
  const heard = [];
  settings.addEventListener('change', (e) => heard.push([e.detail.key, e.detail.value]));
  settings.set('limitOptions', true);
  settings.set('limitOptions', true);
  assert.equal(session.get('/filters/limit'), true);
  assert.deepEqual(said(() => settings.set('filterMode', 'sideways')), ['setting-refused']);
  assert.deepEqual(said(() => settings.set('noSuchSetting', true)), ['setting-unknown']);
  // A write to the session from anywhere — a Settings page — is heard too.
  session.set('/filters/mode', 'panel');
  assert.deepEqual(heard, [['limitOptions', true], ['filterMode', 'panel']]);
});

test('a page lays its own over the app\'s: a write stays the page\'s, nothing is kept, and laid off the app\'s is back', () => {
  const session = new SessionStore({ filters: { limit: false } });
  const settings = new Settings(SETTINGS, session);
  const heard = [];
  settings.addEventListener('change', (e) => heard.push(e.detail.value));
  settings.lay({ limitOptions: true });
  assert.equal(settings.get('limitOptions'), true);
  settings.set('limitOptions', false);
  settings.set('limitOptions', true);
  assert.equal(session.get('/filters/limit'), false, 'the session never hears the page');
  settings.lay({ filterMode: 'panel' });
  assert.equal(settings.get('limitOptions'), false, 'the next page\'s replace the last\'s');
  settings.lay(null);
  assert.equal(settings.get('filterMode'), 'toolbars');
  assert.deepEqual(heard, [true, false, true, false, 'panel', 'toolbars']);
});

test('an app setting is not a page\'s to lay', () => {
  const settings = new Settings();
  assert.deepEqual(said(() => settings.lay({ appContext: true, sections: false })), ['setting-not-page']);
  assert.deepEqual([settings.get('appContext'), settings.get('sections')], [false, false]);
});

test('each setting persists guarded by what it can take, and a page\'s is never written to storage', () => {
  const stored = new Map([['sherpa:session:/filters/mode', '"sideways"'], ['sherpa:session:/filters/limit', 'true']]);
  const writes = [];
  globalThis.localStorage = {
    getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => { writes.push(k); stored.set(k, v); }, removeItem: (k) => stored.delete(k),
  };
  try {
    const session = new SessionStore({});
    persistSettings(session, SETTINGS);
    const settings = new Settings(SETTINGS, session);
    assert.equal(settings.get('limitOptions'), true);
    assert.equal(settings.get('filterMode'), 'toolbars', 'a stale shape is dropped');
    writes.length = 0;
    settings.lay({ limitOptions: false });
    settings.set('limitOptions', true);
    assert.deepEqual(writes, []);
  } finally {
    delete globalThis.localStorage;
  }
});
