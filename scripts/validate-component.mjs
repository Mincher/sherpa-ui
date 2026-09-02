#!/usr/bin/env node
/**
 * validate-component.mjs — validate a *.component.yaml against
 * schemas/component.v1.json (JSON Schema draft 2020-12).
 *
 *   node scripts/validate-component.mjs sherpa-switch
 *   node scripts/validate-component.mjs src/components/sherpa-switch/sherpa-switch.component.yaml
 *   node scripts/validate-component.mjs --all
 *
 * Uses ajv (already a dependency). Also runs a light {ref}-resolvability pass:
 * every {ref} in the spec is walked with scripts/lib/component-ref.mjs against
 * BOTH the spec and the token DTCG, and unresolved refs are reported as
 * warnings (non-fatal — the token file is a moving target during the reforge).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import { isRef, resolveRef } from './lib/component-ref.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');
const SCHEMA_PATH = join(ROOT, 'schemas', 'component.v1.json');
const TOKENS_PATH = join(ROOT, 'src', 'styles', 'tokens', 'figma.tokens.json');

const AjvCtor = Ajv2020.default ?? Ajv2020;

function loadSchema() {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
}
function loadTokens() {
  try { return JSON.parse(readFileSync(TOKENS_PATH, 'utf8')); }
  catch { return null; }
}

/** Resolve a name/path argument to a *.component.yaml file path. */
function specPathFor(arg) {
  if (arg.endsWith('.component.yaml')) return isAbsolute(arg) ? arg : join(ROOT, arg);
  const name = arg.startsWith('sherpa-') ? arg : `sherpa-${arg}`;
  return join(C, name, `${name}.component.yaml`);
}

/** Walk every string in the spec and collect {ref}s that don't resolve. */
function checkRefs(spec, tokens) {
  const unresolved = [];
  const walk = (node, path) => {
    if (typeof node === 'string') {
      if (isRef(node)) {
        const r = resolveRef(node, { spec, tokens });
        // 'alias' ({sherpa.*}) is always OK — it's a CSS seam, not a lookup.
        if (r.kind === 'unresolved') unresolved.push({ at: path, ref: node });
      }
      return;
    }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(spec, '');
  return unresolved;
}

function validateOne(arg, { ajv, validate, tokens }) {
  const path = specPathFor(arg);
  if (!existsSync(path)) return { arg, ok: false, fatal: `not found: ${path}` };
  let spec;
  try { spec = yaml.load(readFileSync(path, 'utf8')); }
  catch (e) { return { arg, ok: false, fatal: `YAML parse error: ${e.message}` }; }

  const ok = validate(spec);
  const errors = ok ? [] : (validate.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}` + (e.params && Object.keys(e.params).length ? ` (${JSON.stringify(e.params)})` : ''));
  const refWarnings = tokens ? checkRefs(spec, tokens) : [];
  return { arg, path, ok, errors, refWarnings };
}

function runCli() {
  const args = process.argv.slice(2);
  let names = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--all')) {
    names = readdirSync(C)
      .filter((n) => existsSync(join(C, n, `${n}.component.yaml`)));
  }
  if (!names.length) {
    console.error('usage: node scripts/validate-component.mjs <name|path>... | --all');
    process.exit(2);
  }

  const schema = loadSchema();
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const tokens = loadTokens();

  let failed = 0;
  for (const arg of names) {
    const r = validateOne(arg, { ajv, validate, tokens });
    if (r.fatal) { failed++; console.log(`❌ ${arg}: ${r.fatal}`); continue; }
    if (r.ok) {
      console.log(`✅ ${arg} — schema-valid`);
    } else {
      failed++;
      console.log(`❌ ${arg} — ${r.errors.length} schema error(s):`);
      r.errors.forEach((e) => console.log(`     • ${e}`));
    }
    if (r.refWarnings && r.refWarnings.length) {
      console.log(`   ⚠️  ${r.refWarnings.length} unresolved {ref}(s) (non-fatal):`);
      r.refWarnings.forEach((w) => console.log(`     • ${w.at}: ${w.ref}`));
    }
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
