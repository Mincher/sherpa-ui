/**
 * parity-sweep.test.mjs — every value a component REPORTS must also be SETTABLE.
 *
 * Sherpa's parity rule: anything a person can do by clicking, a caller must be
 * able to do by calling. Hosts need it for saved views and deep links, tests
 * need it, and an agent needs it most of all — an agent cannot click, and the
 * MCP instance tools are a thin wrapper over these methods.
 *
 * WHY THIS FILE EXISTS. The rule was swept by hand once (P3) and the sweep left
 * no test behind. It looked only for `get X` / `set X` pairs, so it missed
 * `values` on the quick-filter toolbar — a getter whose setter was never
 * written. A saved view could then narrow the DATA and leave the filter bar
 * blank, claiming nothing was filtered while the charts disagreed. A hand sweep
 * that runs once catches one bug; this runs every time.
 *
 * A SETTER IS NOT THE ONLY DOOR. `selectedKeys` is written by `select()`,
 * `hiddenSlices` by `setSliceHidden()`, `code` by its `data-code` attribute.
 * All are fine. Requiring a literal setter would cry wolf on every one, and a
 * check nobody believes is a check nobody keeps. So each getter is listed below
 * with HOW it is written, and the test fails on a getter that is listed nowhere
 * — a new one, or one whose door was removed.
 *
 * Runs in Node, no DOM: it reads the sources as text. `npm run test:node`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS = 'src/components';

/**
 * Every public getter with no matching setter, and the door that writes it.
 *
 * `ok` — there IS a write path; the string says which.
 * `GAP` — there is NO write path. A real parity hole, kept visible on purpose
 *   rather than deleted, because a hole nobody has written down is a hole
 *   nobody fixes.
 * `platform` — the platform forbids a write path. Not a gap.
 */
const KNOWN = {
  'sherpa-calendar-cell.value': 'ok: data-value attribute',
  'sherpa-code-block.code': 'ok: data-code attribute',
  'sherpa-data-grid.selectedKeys': 'ok: select(keys) / clearSelection()',
  'sherpa-data-grid.selectedRecords': 'ok: select(keys) — derived from the same set',
  'sherpa-donut-chart.slices': 'ok: populate()',
  'sherpa-donut-chart.hiddenSlices': 'ok: setSliceHidden(index, hidden)',
  'sherpa-file-upload.files':
    'platform: a File list can only come from a real picker or drop; ' +
    'script cannot forge one, so there is nothing to call',
  'sherpa-nav.activeEntry': 'ok: data-active-id attribute',
  'sherpa-notifications.unreadCount': 'ok: populate() — derived from the items',
  'sherpa-quick-filter.menu': 'ok: the slotted <… slot="menu"> element IS the write',
  'sherpa-quick-filter-toolbar.active': 'ok: populate() — a def carries `active: true`',
  'sherpa-quick-filter-toolbar.pickedValues': 'ok: the `values` setter',
  'sherpa-quick-filter-toolbar.customFilters': 'ok: addCustomFilter()',
  'sherpa-quick-filter-toolbar.sortField': 'ok: data-sort-field attribute',
  'sherpa-quick-filter-toolbar.sortDirection': 'ok: data-sort-direction attribute',
  'sherpa-quick-filter-toolbar.sortSuspended': 'ok: data-sort-field="" suspends it',
  'sherpa-quick-filter-toolbar.groupField': 'ok: data-group-field attribute',
};

/** Public getters (two-space indent = class body) and their setters. */
function accessors(src) {
  const gets = new Set();
  const sets = new Set();
  for (const m of src.matchAll(/^ {2}(?:override\s+)?get\s+([A-Za-z_$][\w$]*)\s*\(/gm)) gets.add(m[1]);
  for (const m of src.matchAll(/^ {2}(?:override\s+)?set\s+([A-Za-z_$][\w$]*)\s*\(/gm)) sets.add(m[1]);
  return { gets, sets };
}

/** Every `<name>/<name>.ts` under src/components. */
function readComponents() {
  const out = [];
  for (const name of readdirSync(COMPONENTS)) {
    try {
      out.push({ name, src: readFileSync(join(COMPONENTS, name, `${name}.ts`), 'utf8') });
    } catch {
      // Not a component directory, or no entry file. Nothing to check.
    }
  }
  return out;
}

test('every read-only getter has a recorded write path', () => {
  const unlisted = [];
  for (const { name, src } of readComponents()) {
    const { gets, sets } = accessors(src);
    for (const g of gets) {
      if (sets.has(g)) continue; // a setter IS the door
      const key = `${name}.${g}`;
      if (!(key in KNOWN)) unlisted.push(key);
    }
  }

  assert.deepEqual(
    unlisted,
    [],
    'These getters report a value a caller cannot set, and are not recorded in ' +
      'KNOWN.\n\nAdd each one with HOW it is written — a setter, a method, or an ' +
      'observed attribute. If there is no way at all, build one: a value a ' +
      'component will only ever report is a value no saved view, test or agent ' +
      'can restore.\n\n  ' + unlisted.join('\n  '),
  );
});

test('KNOWN lists no getter that has since gained a setter', () => {
  // Housekeeping, so the list stays true. A getter that grew a setter is FIXED;
  // leaving it here would have the file claim a hole that is filled.
  const stale = [];
  for (const { name, src } of readComponents()) {
    const { sets } = accessors(src);
    for (const s of sets) {
      const key = `${name}.${s}`;
      if (key in KNOWN) stale.push(key);
    }
  }
  assert.deepEqual(stale, [], `Now has a setter — drop it from KNOWN:\n  ${stale.join('\n  ')}`);
});

test('the open gaps are the ones we think they are', () => {
  // A GAP entry is a promise to fix something. Naming them in one assertion
  // means the list cannot quietly grow: closing one, or opening one, changes
  // this test and has to be said out loud in the commit.
  const gaps = Object.entries(KNOWN)
    .filter(([, why]) => why.startsWith('GAP:'))
    .map(([key]) => key);
  // NONE. Every getter above has a door. Keep it that way: a new GAP entry is a
  // promise to fix something, and it has to fail this test to get in.
  assert.deepEqual(gaps, []);
});
