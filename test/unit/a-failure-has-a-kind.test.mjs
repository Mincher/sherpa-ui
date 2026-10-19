/**
 * A failed read has a KIND, read from the error's shape — never navigator.
 * TRAP T-a-failure-has-a-kind
 *
 *   node --test test/unit/a-failure-has-a-kind.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HttpError, ValidationError, failureOf, unreached } from '../../dist/data.js';

const http = (status) => new HttpError(status, 'x', '/api');

test('each shape has its kind', () => {
  const rows = [
    [http(401), 'refused'], [http(403), 'refused'], [http(407), 'refused'],
    [http(404), 'invalid'], [http(400), 'invalid'],
    [http(408), 'timeout'], [http(504), 'timeout'], [http(524), 'timeout'],
    [http(429), 'server'], [http(500), 'server'], [http(503), 'server'],
    [new DOMException('slow', 'TimeoutError'), 'timeout'],
    [new TypeError('Failed to fetch'), 'offline'],
    [new ValidationError([{ path: ['name'], message: 'required' }]), 'invalid'],
    [new SyntaxError('Unexpected token'), 'invalid'],
    [new DOMException('stopped', 'AbortError'), 'unknown'],
    [new Error('what'), 'unknown'],
    ['a string', 'unknown'],
    [undefined, 'unknown'],
  ];
  for (const [error, kind] of rows) assert.equal(failureOf(error).kind, kind, String(error?.name ?? error) + ' ' + (error?.status ?? ''));
});

test('a status and the message are kept', () => {
  assert.deepEqual(failureOf(http(503)), { kind: 'server', message: 'HTTP 503 x for /api', status: 503 });
  assert.equal(failureOf(new TypeError('Failed to fetch')).message, 'Failed to fetch');
});

test('only offline, timeout and server are "could not reach"', () => {
  const kinds = ['offline', 'timeout', 'server', 'refused', 'invalid', 'unknown'];
  assert.deepEqual(kinds.filter((kind) => unreached({ kind, message: '' })), ['offline', 'timeout', 'server']);
});
