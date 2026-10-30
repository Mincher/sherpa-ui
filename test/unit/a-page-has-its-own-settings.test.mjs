/**
 * A PAGE MAY HAVE ITS OWN SETTINGS — Will, TODO 591. A demo page lays its settings
 * over the session's: a reader and a switch see them, a change stays with the page,
 * nothing is stored, and laid off, every reader hears the app's value again.
 *
 *   node --test test/unit/a-page-has-its-own-settings.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { followSettings } from '../../dist/core/ui/bind-settings.js';
import { SessionStore } from '../../dist/core/browser/session.js';

test('laid on, a pointer reads the page\'s value; a write stays there; laid off, the store\'s is back', () => {
  const session = new SessionStore({ filters: { limit: false, drafts: true } });
  const heard = [];
  session.subscribe('/filters/limit', (value) => heard.push(value));

  session.overlay({ '/filters/limit': true });
  assert.equal(session.get('/filters/limit'), true);
  assert.deepEqual(heard, [true]);
  // A pointer it does not name is the store's, read and written.
  assert.equal(session.get('/filters/drafts'), true);
  session.set('/filters/drafts', false);
  assert.equal(session.snapshot().filters.drafts, false);

  // The page's switch: its change is the page's alone.
  session.set('/filters/limit', false);
  session.set('/filters/limit', true);
  assert.equal(session.snapshot().filters.limit, false);

  session.overlay(null);
  assert.equal(session.get('/filters/limit'), false);
  assert.deepEqual(heard, [true, false, true, false]);
});

test('the next page\'s settings replace the last page\'s: nothing carries over', () => {
  const session = new SessionStore({ filters: { limit: false, mode: 'toolbars' } });
  session.overlay({ '/filters/limit': true });
  session.set('/filters/limit', false);
  session.overlay({ '/filters/mode': 'panel' });
  assert.equal(session.get('/filters/limit'), false, 'the store\'s, not what the last page left');
  assert.equal(session.get('/filters/mode'), 'panel');
  session.overlay(null);
  assert.equal(session.get('/filters/mode'), 'toolbars');
});

test('a followed setting draws the page\'s value, and a target\'s report writes it there, never to the store', () => {
  const session = new SessionStore({ filters: { limit: false } });
  const target = Object.assign(new EventTarget(), { limitOptions: false });
  followSettings(target, session, { limitOptions: { at: '/filters/limit', heard: ['limit-options-change', 'on'] } });
  session.overlay({ '/filters/limit': true });
  assert.equal(target.limitOptions, true);
  target.dispatchEvent(new CustomEvent('limit-options-change', { detail: { on: false } }));
  assert.equal(session.get('/filters/limit'), false);
  assert.equal(session.snapshot().filters.limit, false);
  session.overlay({ '/filters/limit': true });
  assert.equal(target.limitOptions, true);
  session.overlay(null);
  assert.equal(target.limitOptions, false);
});

test('a page\'s setting is never written through to storage', () => {
  const writes = [];
  const stored = new Map();
  globalThis.localStorage = {
    getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => { writes.push(k); stored.set(k, v); }, removeItem: (k) => stored.delete(k),
  };
  try {
    const session = new SessionStore({ filters: { limit: false } });
    session.persist('/filters/limit', { guard: (v) => typeof v === 'boolean' });
    session.overlay({ '/filters/limit': true });
    session.set('/filters/limit', false);
    assert.deepEqual(writes, []);
  } finally {
    delete globalThis.localStorage;
  }
});
