#!/usr/bin/env node
/**
 * code-map.mjs — the higher-plane map of the code: every file and its exports.
 *
 * Each file's header ends in a `Map:` block, one line per export. This prints
 * those blocks, drafts them, and gates them, so "does this already exist?" is
 * one command instead of opening every file. A component's own members are in
 * its `.component.json`, so a component file maps only what it exports.
 *
 *   npm run map [paths…]          print the map (the whole repo by default)
 *   npm run map:write <files…>    add missing names, drop stale ones
 *   npm run check:map [--staged]  the gate
 *   node scripts/code-map.mjs --privates [paths…]   the #private members still undocumented
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
import ts from 'typescript';

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
  'examples/experiments/*.js',
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
  // A section BANNER (`── Grouped ──`, `══ serialise ══`) heads a region, not one name.
  const banner = (t) => /^[─═]{2}/.test(t);
  if (lines[j].trim().startsWith('//')) {
    const line = lines[j].trim().replace(/^\/\/\s?/, '');
    return banner(line) ? '' : line;
  }
  if (!lines[j].trim().endsWith('*/')) return '';
  let k = j;
  while (k >= 0 && !lines[k].includes('/**') && !lines[k].includes('/*')) k--;
  // The FILE HEADER describes the file, not the first export under it.
  if (lines.slice(0, k).every((l) => !l.trim() || l.startsWith('#!'))) return '';
  const text = lines.slice(k, j + 1).join(' ')
    .replace(/\/\*\*?|\*\//g, '').replace(/\s*\*\s/g, ' ').replace(/\s+/g, ' ').trim();
  if (banner(text)) return '';
  const first = text.split(/(?<=[.!?])\s|TRAP /)[0].trim();
  return first.length > MAX_LINE ? first.slice(0, MAX_LINE - 1).trimEnd() + '…' : first;
}

/**
 * The names a file DECLARES and exports — re-exports belong to their own file.
 *
 * Parsed by the TypeScript compiler, not by pattern. A hand-rolled scan read a
 * generator's `export const` inside the template it WRITES as its own, because
 * a backtick inside a regex flipped the count for the rest of the file.
 */
export function exportsOf(text, file = 'x.ts') {
  const lines = text.split('\n');
  const kind = /\.(m?js)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
  const entry = (name, node) => ({ name, doc: docAbove(lines, lineOf(node)) });
  const exported = (node) => ts.canHaveModifiers(node)
    && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const declared = new Map();
  const out = [];

  for (const st of sf.statements) {
    const names = ts.isVariableStatement(st)
      ? st.declarationList.declarations.filter((d) => ts.isIdentifier(d.name)).map((d) => d.name.text)
      : st.name && ts.isIdentifier(st.name) ? [st.name.text] : [];
    for (const n of names) declared.set(n, st);
    if (!exported(st)) continue;
    const base = ts.isClassDeclaration(st)
      ? (st.heritageClauses ?? []).find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
        ?.types[0]?.expression.getText(sf) ?? ''
      : null;
    /* THE COMPONENT ITSELF is the header's first line, and its members are its
       `.component.json`. A Map line for it would say the title again. */
    if (base === 'SherpaElement') continue;
    for (const n of names) out.push(entry(n, st));
    if (base === null) continue;
    const implementsSomething = (st.heritageClauses ?? [])
      .some((h) => h.token === ts.SyntaxKind.ImplementsKeyword);
    if (implementsSomething || !OWN_SURFACE_BASES.has(base)) continue;
    out.push(...membersOf(st, sf, lines).map((mem) => ({ ...mem, name: `.${mem.name}` })));
  }

  /* A LOCAL LIST — `export { a, b as c }` with no `from` — exports what this
     file declares. A name it only IMPORTED is a re-export, mapped in its own
     file; a list was once read as "exports nothing", so it needed no Map. */
  for (const st of sf.statements) {
    if (!ts.isExportDeclaration(st) || st.moduleSpecifier || !st.exportClause
      || !ts.isNamedExports(st.exportClause)) continue;
    for (const el of st.exportClause.elements) {
      const local = (el.propertyName ?? el.name).text;
      const at = declared.get(local);
      if (at) out.push(entry(el.name.text, at));
    }
  }
  return out;
}

/** An exported class's own public members, one entry per name. */
function membersOf(cls, sf, lines) {
  const seen = new Map();
  const hidden = new Set([ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword]);
  for (const m of cls.members) {
    if (!m.name || ts.isPrivateIdentifier(m.name) || !ts.isIdentifier(m.name)) continue;
    if ((ts.getModifiers(m) ?? []).some((mod) => hidden.has(mod.kind))) continue;
    const name = m.name.text;
    if (LIFECYCLE.has(name) || seen.has(name)) continue;
    const line = sf.getLineAndCharacterOfPosition(m.getStart(sf)).line;
    seen.set(name, { name, doc: docAbove(lines, line) });
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
  const want = exportsOf(text, file);
  if (!want.length && map.at < 0) return null;
  const body = want.map(({ name, doc }) =>
    ` * - ${name} — ${have.get(name) || doc || PLACEHOLDER}`);
  const lines = text.split('\n');
  const head = map.at >= 0 ? lines.slice(0, map.at) : lines.slice(0, map.close);
  while (head.length && head.at(-1).trim() === '*') head.pop();
  // Nothing to list: no block at all, rather than an empty heading.
  const block = body.length ? [' *', ' * Map:', ...body] : [];
  const next = [...head, ...block, ...lines.slice(map.close)].join('\n');
  if (next !== text) writeFileSync(file, next);
  return null;
}

/** Undocumented `#private` members across `src/`, for the ratchet. */
/** Every undocumented `#private` member under `src/`, as `file:line  code`. */
function undocumentedPrivates(roots = []) {
  const out = [];
  for (const f of globSync('src/**/*.ts')) {
    if (roots.length && !roots.some((r) => f.startsWith(r))) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (/^ {2}(?:static )?(?:readonly )?(?:async )?#[A-Za-z_$][\w$]*\s*[(=:<]/.test(l)
        && !docAbove(lines, i)) out.push(`${f}:${i + 1}  ${l.trim()}`);
    });
  }
  return out;
}
const undocumentedPrivate = () => undocumentedPrivates().length;

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
    const want = exportsOf(text, f).map((e) => e.name);
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
  } else if (mode === '--privates') {
    // Which #private members still need their line — the ratchet's worklist.
    const list = undocumentedPrivates(args);
    for (const row of list) console.log(row);
    console.error(`${list.length} undocumented #private`);
  } else if (mode === '--baseline') {
    const unmapped = files().filter((f) => {
      const text = readFileSync(f, 'utf8');
      const map = readMap(text);
      return map && map.at < 0 && exportsOf(text, f).length;
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
