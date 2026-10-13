/**
 * AN APP IS ITS DEFINITION: one JSON names its Contexts, the default, the nav
 * sections and the Settings pages, and checkApp() says what is broken.
 * TODO 190 · TRAP T-an-app-is-its-definition
 *
 *   node --test test/unit/an-app-is-its-definition.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { checkApp, onReport } from '../../dist/data.js';

const APP = {
  v: 1,
  default: 'home',
  contexts: {
    home: { label: 'Home', icon: 'home', template: 'templates/home.html', module: 'contexts/home.js' },
    records: {
      label: 'Records', template: 'templates/records.html', definition: 'view-schemas/records.json',
      views: 'views/records-views.json', chrome: { resizable: true },
    },
  },
  sections: [{ label: 'Customers', contexts: ['records'] }],
  settings: { module: 'contexts/settings.js', pages: { profile: { label: 'Profile', template: 'templates/profile.html' } } },
};

const heard = (fn) => {
  const seen = [];
  const undo = onReport((r) => seen.push(r.message));
  try {
    return { ok: fn(), seen };
  } finally {
    undo();
  }
};

test('a sound app definition passes its schema and checkApp, and says nothing', async () => {
  const Ajv = Ajv2020.default ?? Ajv2020;
  const schema = JSON.parse(await readFile(new URL('../../schemas/app.v1.json', import.meta.url), 'utf8'));
  const check = new Ajv({ allErrors: true }).compile(schema);
  assert.ok(check(APP), JSON.stringify(check.errors));
  assert.deepEqual(heard(() => checkApp(APP)), { ok: true, seen: [] });
});

test('every broken name reports, and none is followed', () => {
  const broken = structuredClone(APP);
  broken.default = 'dashboard';
  broken.sections[0].contexts.push('chat');
  broken.settings.pages.records = { label: 'Records', template: 'templates/r.html' };
  const { ok, seen } = heard(() => checkApp(broken));
  assert.equal(ok, false);
  assert.deepEqual(seen, [
    'checkApp: its default, "dashboard", is not one of its contexts.',
    'checkApp: the section "Customers" lists "chat", which is not a context.',
    'checkApp: "records" is a context and a settings page.',
  ]);
  assert.deepEqual(heard(() => checkApp({ v: 2 })), { ok: false, seen: ['checkApp: it is not a v1 app definition.'] });
});
