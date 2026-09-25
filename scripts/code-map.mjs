#!/usr/bin/env node
/**
 * code-map.mjs — the higher-plane map of the code: every file and its exports.
 *
 * Each file's header ends in a `Map:` block, one line per export. This prints
 * those blocks, drafts them, and gates them, so "does this already exist?" is
 * one command instead of opening every file. A component's own members are in
 * its `.component.yaml`, so a component file maps only what it exports.
 *
 *   npm run map [paths…]          print the map (the whole repo by default)
 *   npm run map:write <files…>    add missing names, drop stale ones
 *   npm run check:map [--staged]  the gate
 *
 * TRAP T-a-file-says-what-it-holds
 *
 * Map:
 * - SOURCES — the files the map covers; one not listed is not mapped
 * - exportsOf — the names a file declares and exports, with their JSDoc line
 * - readMap — the `Map:` block of a file's header, parsed
 * - writeMap — rewrite that block: keep what is written, add what is missing
 * - check — the gate: names both ways, the baseline, the private-doc ratchet
 */
import { readFileSync, writeFileSync, globSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCES = [
  'src/*.ts',
  'src/core/*/*.ts',
  'src/components/*/*.ts',
  'scripts/*.mjs',
  'scripts/lib/*.mjs',
  'scripts/lib/*/*.mjs',
  'mcp-server/*.js',
  'mcp-server/*/*.js',
  'examples/contexts/*.js',
];

const BASELINE = 'scripts/code-map-baseline.json';
/** A description longer than this is a paragraph, not a map line. */
const MAX_LINE = 110;
const PLACEHOLDER = '(describe)';
/** Classes whose members are someone else's surface: a spec, or an interface. */
const OWN_SURFACE_BASES = new Set(['EventTarget', '']);
const LIFECYCLE = new Set([
  'constructor', 'onRender', 'onConnect', 'onDisconnect', 'onChange', 'renderData',
  'connectedCallback', 'disconnectedCallback', 'attributeChangedCallback',
]);

/** A GENERATED file's generator owns it, header and all. */
const generated = (f) => /GENERATED/.test(readFileSync(f, 'utf8').slice(0, 200));

const files = () => [...new Set(SOURCES.flatMap((g) => globSync(g)))]
  .filter((f) => !f.endsWith('.d.ts') && !generated(f)).sort();

/** The JSDoc or line comment directly above line `i`, as one short line. */
function docAbove(lines, i) {
  let j = i - 1;
  while (j >= 0 && lines[j].trim() === '') j--;
  if (j < 0) return '';
  if (lines[j].trim().startsWith('//')) return lines[j].trim().replace(/^\/\/\s?/, '');
  if (!lines[j].trim().endsWith('*/')) return '';
  let k = j;
  while (k >= 0 && !lines[k].includes('/**') && !lines[k].includes('/*')) k--;
  // The FILE HEADER describes the file, not the first export under it.
  if (lines.slice(0, k).every((l) => !l.trim() || l.startsWith('#!'))) return '';
  const text = lines.slice(k, j + 1).join(' ')
    .replace(/\/\*\*?|\*\//g, '').replace(/\s*\*\s/g, ' ').replace(/\s+/g, ' ').trim();
  // A section BANNER (`── Grouped ──`) heads a region, not this one name.
  if (text.startsWith('──')) return '';
  const first = text.split(/(?<=[.!?])\s|TRAP /)[0].trim();
  return first.length > MAX_LINE ? first.slice(0, MAX_LINE - 1).trimEnd() + '…' : first;
}

/** The names a file DECLARES and exports — re-exports belong to their own file. */
export function exportsOf(text) {
  const lines = text.split('\n');
  const out = [];
  const component = /extends SherpaElement\b/.test(text);
  lines.forEach((line, i) => {
    const m = line.match(
      /^export (?:default )?(?:declare )?(?:abstract )?(?:async )?(function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/,
    );
    if (!m) return;
    out.push({ name: m[2], doc: docAbove(lines, i) });
    if (m[1] !== 'class' || component) return;
    const base = (line.match(/\bextends\s+([\w.]+)/) ?? [])[1] ?? '';
    if (/\bimplements\b/.test(line) || !OWN_SURFACE_BASES.has(base)) return;
    out.push(...membersOf(lines, i).map((mem) => ({ ...mem, name: `.${mem.name}` })));
  });
  return out;
}

/** An exported class's own public members, one entry per name. */
function membersOf(lines, start) {
  const seen = new Map();
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (depth === 1) {
      const m = line.match(
        /^ {2}(?:static )?(?:readonly )?(?:override )?(?:async )?(?:get |set )?([A-Za-z_$][\w$]*)\s*[(<:=?]/,
      );
      if (m && !LIFECYCLE.has(m[1]) && !/^ {2}(?:private|protected)\b/.test(line)
        && !seen.has(m[1])) seen.set(m[1], { name: m[1], doc: docAbove(lines, i) });
    }
    for (const ch of line.replace(/(['"`]).*?\1/g, '').replace(/\/\/.*$/, '')) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth === 0 && i > start) break;
  }
  return [...seen.values()];
}

/** The header comment's `Map:` block. `null` when the file has none. */
export function readMap(text) {
  const lines = text.split('\n');
  const open = lines.findIndex((l) => l.trim().startsWith('/*'));
  if (open < 0 || lines.slice(0, open).some((l) => l.trim() && !l.startsWith('#!'))) return null;
  const close = lines.findIndex((l, i) => i >= open && l.includes('*/'));
  const at = lines.findIndex((l, i) => i > open && i < close && /^ \* Map:\s*$/.test(l));
  const title = (lines[open + 1] ?? '').replace(/^\s*\*\s?/, '').trim();
  if (at < 0) return { title, open, close, at: -1, entries: [] };
  const entries = [];
  for (let i = at + 1; i < close; i++) {
    const m = lines[i].match(/^ \* - (\S+) — (.*)$/);
    if (m) entries.push({ name: m[1], text: m[2].trim() });
  }
  return { title, open, close, at, entries };
}

/** Rewrite a file's `Map:` block: keep written lines, add missing, drop stale. */
export function writeMap(file) {
  const text = readFileSync(file, 'utf8');
  const map = readMap(text);
  if (!map) return `${file}: no header comment — write one first`;
  const have = new Map(map.entries.map((e) => [e.name, e.text]));
  const want = exportsOf(text);
  if (!want.length && map.at < 0) return null;
  const body = want.map(({ name, doc }) =>
    ` * - ${name} — ${have.get(name) || doc || PLACEHOLDER}`);
  const lines = text.split('\n');
  const head = map.at >= 0 ? lines.slice(0, map.at) : lines.slice(0, map.close);
  while (head.length && head.at(-1).trim() === '*') head.pop();
  const next = [...head, ' *', ' * Map:', ...body, ...lines.slice(map.close)].join('\n');
  if (next !== text) writeFileSync(file, next);
  return null;
}

/** Undocumented `#private` members across `src/`, for the ratchet. */
function undocumentedPrivate() {
  let n = 0;
  for (const f of globSync('src/**/*.ts')) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (/^ {2}(?:static )?(?:readonly )?(?:async )?#[A-Za-z_$][\w$]*\s*[(=:<]/.test(l)
        && !docAbove(lines, i)) n++;
    });
  }
  return n;
}

export function check({ staged = false } = {}) {
  const base = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { unmapped: [], undocumentedPrivate: Infinity };
  const unmapped = new Set(base.unmapped);
  const errors = [];
  const stagedFiles = staged
    ? new Set(execSync('git diff --cached --name-only', { encoding: 'utf8' }).split('\n'))
    : new Set();

  for (const f of files()) {
    const text = readFileSync(f, 'utf8');
    const map = readMap(text);
    if (!map) { errors.push(`${f}: no header comment. A file says what it holds.`); continue; }
    const want = exportsOf(text).map((e) => e.name);
    if (map.at < 0) {
      if (!want.length) continue;
      if (stagedFiles.has(f)) errors.push(`${f}: changed, so it needs its Map — npm run map:write ${f}`);
      else if (!unmapped.has(f)) errors.push(`${f}: exports ${want.length} names and has no Map`);
      continue;
    }
    if (unmapped.has(f)) errors.push(`${f}: has a Map now — remove it from ${BASELINE}`);
    const got = map.entries.map((e) => e.name);
    for (const n of want) if (!got.includes(n)) errors.push(`${f}: ${n} is exported but not in the Map`);
    for (const n of got) if (!want.includes(n)) errors.push(`${f}: ${n} is in the Map but not exported`);
    for (const e of map.entries) {
      if (!e.text || e.text === PLACEHOLDER) errors.push(`${f}: ${e.name} has no description`);
      else if (e.text.length > MAX_LINE) errors.push(`${f}: ${e.name} — over ${MAX_LINE} chars; one line`);
    }
  }
  for (const f of unmapped) if (!existsSync(f)) errors.push(`${BASELINE}: ${f} no longer exists`);

  const priv = undocumentedPrivate();
  if (priv > base.undocumentedPrivate) {
    errors.push(`${priv} undocumented #private members, baseline ${base.undocumentedPrivate}. `
      + 'Give each new one a line above it saying what it holds or does.');
  }
  return { errors, priv, base };
}

/* ── CLI ─────────────────────────────────────────────────────────────── */

/* A RELATIVE argv[1] never equals an absolute URL, and this repo's path has
   spaces — so the CLI ran nothing and exited clean. Resolve, then encode. */
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, ...args] = process.argv.slice(2);

  if (mode === '--check') {
    const { errors, priv, base } = check({ staged: args.includes('--staged') });
    if (errors.length) {
      console.error(`check-map: ${errors.length} problem(s)\n`);
      for (const e of errors) console.error(`  ✗ ${e}`);
      process.exit(1);
    }
    const drop = priv < base.undocumentedPrivate ? ` (baseline ${base.undocumentedPrivate} — lower it)` : '';
    console.log(`check-map: every mapped file matches its exports; ${priv} undocumented #private${drop}`);
  } else if (mode === '--write') {
    const problems = args.map(writeMap).filter(Boolean);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(problems.length ? 1 : 0);
  } else if (mode === '--baseline') {
    const unmapped = files().filter((f) => {
      const text = readFileSync(f, 'utf8');
      const map = readMap(text);
      return map && map.at < 0 && exportsOf(text).length;
    });
    writeFileSync(BASELINE, JSON.stringify({ unmapped, undocumentedPrivate: undocumentedPrivate() }, null, 2) + '\n');
    console.log(`baseline: ${unmapped.length} unmapped files, ${undocumentedPrivate()} undocumented #private`);
  } else {
    const roots = [mode, ...args].filter(Boolean);
    const pick = roots.length ? files().filter((f) => roots.some((r) => f.startsWith(r))) : files();
    for (const f of pick) {
      const map = readMap(readFileSync(f, 'utf8'));
      if (!map) continue;
      console.log(`${f} — ${map.title.replace(/^[\w.-]+\s—\s/, '')}`);
      for (const e of map.entries) console.log(`  ${e.name} — ${e.text}`);
    }
  }
}
