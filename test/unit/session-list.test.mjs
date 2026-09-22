/**
 * THE SESSION LIST, AND THE SHAPE GUARD ON persist().
 *
 * Favourites and Recents are the same stored array with different options, so
 * the identity, the cap and the two ends are worth proving once here rather
 * than in a browser per app.
 *
 * The guard half exists because `persist()` only ever caught a JSON PARSE
 * error, while its own TRAP said a shape this version cannot read is DROPPED.
 * A boolean survives that gap; a list of objects re-shaped between releases
 * does not.
 *
 *   node --test test/unit/session-list.test.mjs
 *
 * TRAP T-session-list-is-a-view-not-a-copy
 * TRAP T-session-persist-defaults-shared
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Node has no Web Storage, and session.ts degrades to "nothing kept" without
 *  one. A Map-backed shim lets the persist half be tested at all. */
class MemoryStorage {
  #map = new Map();
  getItem(k) { return this.#map.has(k) ? this.#map.get(k) : null; }
  setItem(k, v) { this.#map.set(k, String(v)); }
  removeItem(k) { this.#map.delete(k); }
  clear() { this.#map.clear(); }
}
globalThis.localStorage ??= new MemoryStorage();
globalThis.sessionStorage ??= new MemoryStorage();

const core = new URL('../../dist/core/browser/', import.meta.url);
const { SessionStore } = await import(new URL('session.js', core));

/* ── The list ──────────────────────────────────────────────────────── */

test('list: add, has, remove and toggle over one pointer', () => {
  const session = new SessionStore({ nav: { favorites: [] } });
  const favs = session.list('/nav/favorites', { by: 'view' });

  assert.equal(favs.length, 0);
  assert.equal(favs.has({ view: 'records' }), false);

  favs.add({ view: 'records', label: 'Records' });
  assert.equal(favs.length, 1);
  assert.equal(favs.has({ view: 'records' }), true);

  // `by` decides identity, so a DIFFERENT label is still the same entry.
  favs.add({ view: 'records', label: 'Renamed' });
  assert.equal(favs.length, 1, 're-adding by identity must not double');
  assert.equal(favs.all[0].label, 'Renamed', 'the newer entry wins');

  assert.equal(favs.toggle({ view: 'records' }), false, 'toggle off returns not-present');
  assert.equal(favs.length, 0);
  assert.equal(favs.toggle({ view: 'records', label: 'Records' }), true);
  assert.equal(favs.length, 1);

  favs.remove({ view: 'records' });
  assert.equal(favs.length, 0);
  favs.remove({ view: 'records' }, 'removing what is absent is silent');
});

test('list: `all` is a COPY — mutating it changes nothing', () => {
  const session = new SessionStore({ nav: { favorites: [] } });
  const favs = session.list('/nav/favorites', { by: 'view' });
  favs.add({ view: 'records' });

  const snapshot = favs.all;
  snapshot.push({ view: 'smuggled' });
  assert.equal(favs.length, 1, 'the store is not reachable through `all`');
});

test('list: a missing or non-array pointer reads as EMPTY, never throws', () => {
  const session = new SessionStore({});
  const favs = session.list('/nowhere/at/all', { by: 'view' });
  assert.deepEqual(favs.all, []);

  session.set('/junk', 'not a list');
  assert.deepEqual(session.list('/junk').all, []);
});

test('list: max + front is a RECENTS rail — newest first, oldest trimmed', () => {
  const session = new SessionStore({ nav: { recent: [] } });
  const recent = session.list('/nav/recent', { by: 'view', max: 5, front: true });

  for (const v of ['a', 'b', 'c', 'd', 'e', 'f']) recent.add({ view: v });

  assert.equal(recent.length, 5, 'capped at max');
  assert.deepEqual(recent.all.map((e) => e.view), ['f', 'e', 'd', 'c', 'b'],
    'newest first, and the OLDEST (a) fell off');

  // Re-visiting moves it to the front rather than adding a second copy.
  recent.add({ view: 'c' });
  assert.deepEqual(recent.all.map((e) => e.view), ['c', 'f', 'e', 'd', 'b']);
  assert.equal(recent.length, 5);
});

test('list: max WITHOUT front trims the other end', () => {
  const session = new SessionStore({ q: [] });
  const queue = session.list('/q', { by: 'id', max: 3 });
  for (const id of [1, 2, 3, 4]) queue.add({ id });
  assert.deepEqual(queue.all.map((e) => e.id), [2, 3, 4], 'newest LAST, oldest trimmed');
});

test('list: without `by`, identity is deep equality', () => {
  const session = new SessionStore({ tags: [] });
  const tags = session.list('/tags');
  tags.add({ a: 1 });
  tags.add({ a: 1 });
  assert.equal(tags.length, 1);
  tags.add({ a: 2 });
  assert.equal(tags.length, 2);
});

test('list: every write reaches a SUBSCRIBER', () => {
  const session = new SessionStore({ nav: { favorites: [] } });
  const favs = session.list('/nav/favorites', { by: 'view' });

  const seen = [];
  const off = favs.subscribe((entries) => seen.push(entries.length));

  favs.add({ view: 'a' });
  favs.add({ view: 'b' });
  favs.remove({ view: 'a' });
  favs.clear();

  assert.deepEqual(seen, [1, 2, 1, 0]);
  off();
  favs.add({ view: 'c' });
  assert.equal(seen.length, 4, 'unsubscribed means unsubscribed');
});

/* ── persist(), and the shape guard ────────────────────────────────── */

const isViewList = (value) =>
  Array.isArray(value) && value.every((e) =>
    e && typeof e === 'object' && typeof e.view === 'string');

test('persist: a list survives a NEW store — the whole point', () => {
  localStorage.clear();
  const first = new SessionStore({ nav: { favorites: [] } });
  first.persist('/nav/favorites', { guard: isViewList });
  first.list('/nav/favorites', { by: 'view' }).add({ view: 'records', label: 'Records' });

  // A second store is what a reload builds.
  const second = new SessionStore({ nav: { favorites: [] } });
  const restored = second.persist('/nav/favorites', { guard: isViewList });

  assert.equal(restored, true, 'persist reports that it restored');
  assert.deepEqual(second.list('/nav/favorites').all, [{ view: 'records', label: 'Records' }]);
});

test('persist: a WRONG-SHAPED stored value is dropped, and the key forgotten', () => {
  localStorage.clear();
  // What a previous release wrote: bare strings, not {view,label} objects.
  localStorage.setItem('sherpa:session:/nav/favorites', JSON.stringify(['records']));

  const session = new SessionStore({ nav: { favorites: [] } });
  const restored = session.persist('/nav/favorites', { guard: isViewList });

  assert.equal(restored, false, 'a shape this version cannot read does not restore');
  assert.deepEqual(session.get('/nav/favorites'), [], 'the initial value stands');
  assert.equal(localStorage.getItem('sherpa:session:/nav/favorites'), null,
    'and the unreadable key is gone, so the next write starts clean');
});

test('persist: WITHOUT a guard any parsed value is restored — the old behaviour', () => {
  localStorage.clear();
  localStorage.setItem('sherpa:session:/anything', JSON.stringify(['records']));
  const session = new SessionStore({});
  assert.equal(session.persist('/anything'), true);
  assert.deepEqual(session.get('/anything'), ['records']);
});

test('persist: a stored value that is not JSON at all is dropped', () => {
  localStorage.clear();
  localStorage.setItem('sherpa:session:/nav/favorites', 'not json {');
  const session = new SessionStore({ nav: { favorites: [] } });
  assert.equal(session.persist('/nav/favorites', { guard: isViewList }), false);
  assert.deepEqual(session.get('/nav/favorites'), []);
});

test('persist: a stored `null` is a REAL value, not a miss', () => {
  localStorage.clear();
  localStorage.setItem('sherpa:session:/picked', 'null');
  const session = new SessionStore({ picked: 'something' });
  assert.equal(session.persist('/picked'), true, 'null restored, not treated as absent');
  assert.equal(session.get('/picked'), null);
});

test('persist: nothing stored means nothing restored', () => {
  localStorage.clear();
  const session = new SessionStore({ nav: { favorites: [] } });
  assert.equal(session.persist('/nav/favorites', { guard: isViewList }), false);
  assert.deepEqual(session.get('/nav/favorites'), [], 'the initial value is untouched');
});

test('persist: forget() stops the writing AND clears the key', () => {
  localStorage.clear();
  const session = new SessionStore({ nav: { favorites: [] } });
  session.persist('/nav/favorites', { guard: isViewList });
  session.list('/nav/favorites', { by: 'view' }).add({ view: 'a' });
  assert.notEqual(localStorage.getItem('sherpa:session:/nav/favorites'), null);

  session.forget('/nav/favorites');
  assert.equal(localStorage.getItem('sherpa:session:/nav/favorites'), null);

  session.list('/nav/favorites', { by: 'view' }).add({ view: 'b' });
  assert.equal(localStorage.getItem('sherpa:session:/nav/favorites'), null,
    'a forgotten pointer stops writing through');
});
