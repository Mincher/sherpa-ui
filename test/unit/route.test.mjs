/**
 * A URL's search parameters as a ROUTE, and back — the arithmetic under
 * `sherpa-router`. Pure, so it is proved here with no browser.
 *
 *   node --test test/unit/route.test.mjs
 *
 * TRAP T-the-router-owns-the-url
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  changedParams, readRoute, routeHref, routeShape, settleRoute,
} from '../../dist/core/browser/route.js';

const SHAPE = routeShape('context=dashboard view', 'settings');
const AT = 'http://localhost:4200/?context=records&view=risk';

test('a shape names every owned parameter, its defaults and its overlays', () => {
  assert.deepEqual(SHAPE.names, ['context', 'view', 'settings']);
  assert.deepEqual(SHAPE.defaults, { context: 'dashboard' });
  assert.deepEqual([...SHAPE.overlay], ['settings']);
});

test('a route reads each owned parameter, and a default where the URL leaves one out', () => {
  assert.deepEqual(readRoute(AT, SHAPE), { context: 'records', view: 'risk', settings: null });
  assert.deepEqual(readRoute('http://localhost:4200/', SHAPE), { context: 'dashboard', view: null, settings: null });
  // An empty value is no value.
  assert.deepEqual(readRoute('http://localhost:4200/?context=', SHAPE).context, 'dashboard');
});

test('an href writes the owned parameters and keeps every other one', () => {
  const href = routeHref('http://localhost:4200/?live=1&context=records&view=risk', { context: 'records', view: null, settings: 'profile' }, SHAPE);
  assert.equal(href, 'http://localhost:4200/?live=1&context=records&settings=profile');
});

test('an OVERLAY link keeps the base it left out; a base link does not keep the overlay', () => {
  const from = readRoute(AT, SHAPE);
  assert.deepEqual(settleRoute('http://localhost:4200/?settings=profile', from, SHAPE),
    { context: 'records', view: 'risk', settings: 'profile' });
  // A Context link is the whole base: its View is its first, and Settings shuts.
  assert.deepEqual(settleRoute('http://localhost:4200/?context=records', { ...from, settings: 'profile' }, SHAPE),
    { context: 'records', view: null, settings: null });
  // A link that names nothing is the page's own start.
  assert.deepEqual(settleRoute('http://localhost:4200/', from, SHAPE),
    { context: 'dashboard', view: null, settings: null });
});

test('changed parameters are the ones that differ', () => {
  assert.deepEqual(changedParams({ context: 'a', view: null }, { context: 'a', view: 'x' }), ['view']);
  assert.deepEqual(changedParams({ context: 'a' }, { context: 'a', view: null }), []);
});
