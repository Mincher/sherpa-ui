/**
 * ts-facts.mjs — read the facts a spec DETERMINES out of a component's TypeScript.
 *
 * Today that is the `observed` list and each declared prop. It lives here rather than in the spec
 * generator because two things need it and only one had the fixes: the generator
 * and `roundtrip-component.mjs` each had their own reader, and the fork's was the
 * naive `/static override observed = \[([^\]]*)\]/` regex. Both of the bugs
 * below had been found and fixed in the generator; neither reached the copy, so
 * the two disagreed on 5 of 58 components — one reporting all green while the
 * other failed five.
 *
 * Map:
 * - parseObserved — The `static override observed` list, as names.
 * - expandArrayConst — Read a module-level `const NAME = ['a', 'b'] as const;` back into its strings.
 * - parsePropDecls — Each prop `static override props` declares: its kind, type, values and default.
 * - parseClassApi — The component class's public methods and properties, read by TypeScript's own parser.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * The `static override observed` list, as names.
 *
 * COMMENTS ARE STRIPPED FIRST. This used to be a bare `split(',')`, so a
 * component that explained an entry inline —
 *
 *   static override observed = [
 *     'data-select',
 *     // SINGLE vs multiple changes the CONTROL each row draws.
 *     'data-filter-fields',
 *   ];
 *
 * — produced observed names like "// SINGLE vs multiple changes the CONTROL
 * each row draws" and failed its own round-trip. The spec then looked "flaky"
 * when the only thing that had changed was a comment.
 *
 * Comments in this array are not unusual: `observed` is where a component says
 * WHY an attribute is reactive, which is exactly the kind of thing worth
 * writing down next to it.
 */
export function parseObserved(ts) {
  const src = ts ?? '';
  const m = /static override observed\s*=\s*\[([\s\S]*?)\]/.exec(src);
  if (!m) return [];
  const out = [];
  for (const raw of m[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/[^\n]*/g, '')           // line comments
    .split(',')) {
    const tok = raw.trim().replace(/^['"]|['"]$/g, '');
    if (!tok) continue;
    /* `...MIRRORED` spreads a const array declared above — the select controls
       share one list of native attributes they copy onto the inner <input>.
       Read as a literal it became an attribute called `...MIRRORED`, so both
       components failed the round-trip for ever. Expand it from the file. */
    const spread = /^\.\.\.\s*([A-Za-z_$][\w$]*)$/.exec(tok);
    if (spread) {
      out.push(...expandArrayConst(src, spread[1]));
      continue;
    }
    out.push(tok);
  }
  return out;
}

/**
 * Read a module-level `const NAME = ['a', 'b'] as const;` back into its strings.
 *
 * Returns `[]` when the name is not a plain array of literals here — an import,
 * a computed value, a call. An honest gap beats a guessed one, the same ruling
 * that leaves an un-inferable event detail as `unknown`.
 */
export function expandArrayConst(src, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`);
  const m = re.exec(src);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^(['"]).*\1$/.test(x))
    .map((x) => x.slice(1, -1));
}


/**
 * Each prop `static override props` declares: its kind, type, values and default.
 *
 * The only honest source for `kind` — inferred from the observed list, a
 * CSS-only attribute was written into 39 specs as `content`. TRAP T-kind-says-how-not-whether
 * Read by TypeScript's parser, so a spread (`...SUMMARY_PROPS`) and a lookup
 * (`SHARED_PROPS['data-size']`) resolve into `sherpa-element.ts`. An entry
 * with a `to:` selector and no kind IS content: that is what `to` means.
 *
 * @returns {Record<string, { kind?: string, type?: string, values?: string[], default?: unknown }>}
 */
export function parsePropDecls(src, path) {
  const sf = ts.createSourceFile('c.ts', src ?? '', ts.ScriptTarget.Latest, true);
  const cls = registeredClass(sf, src);
  const member = cls?.members.find((m) => ts.isPropertyDeclaration(m) && m.name?.getText(sf) === 'props'
    && (ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Static));
  const init = unwrap(member?.initializer);
  return init && ts.isObjectLiteralExpression(init) ? entriesOf(init, { sf, src, path }) : {};
}

/** A value list by name: in this file, else in the file a relative import names. */
function valuesNamed(name, file) {
  const here = expandArrayConst(file.src, name);
  if (here.length || !file.path) return here;
  const from = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"](\\.{1,2}/[^'"]+)['"]`).exec(file.src)?.[1];
  const target = from && join(dirname(file.path), from.replace(/\.js$/, '.ts'));
  return target && existsSync(target) ? expandArrayConst(readFileSync(target, 'utf8'), name) : [];
}

/** The shared prop lists, read once from the base class's file. */
const SHARED_FILE = fileURLToPath(new URL('../../src/core/ui/sherpa-element.ts', import.meta.url));
let shared;
function sharedFile() {
  if (!shared) {
    const src = readFileSync(SHARED_FILE, 'utf8');
    shared = { sf: ts.createSourceFile('s.ts', src, ts.ScriptTarget.Latest, true), src };
  }
  return shared;
}

/** A module-level object const, in this file or the base class's. */
function listNamed(name, file) {
  for (const at of [file, sharedFile()]) {
    for (const st of at.sf.statements) {
      if (!ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) {
        const init = unwrap(d.initializer);
        if (ts.isIdentifier(d.name) && d.name.text === name && init && ts.isObjectLiteralExpression(init)) {
          return { node: init, file: at };
        }
      }
    }
  }
  return null;
}

function unwrap(node) {
  let n = node;
  while (n && (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || ts.isSatisfiesExpression(n))) n = n.expression;
  return n;
}

function entriesOf(obj, file) {
  const out = {};
  for (const p of obj.properties) {
    if (ts.isSpreadAssignment(p) && ts.isIdentifier(p.expression)) {
      const list = listNamed(p.expression.text, file);
      if (list) Object.assign(out, entriesOf(list.node, list.file));
    } else if (ts.isPropertyAssignment(p) && (ts.isStringLiteralLike(p.name) || ts.isIdentifier(p.name))) {
      const decl = declOf(p.initializer, file);
      if (decl) out[p.name.text] = decl;
    }
  }
  return out;
}

function declOf(node, file) {
  const n = unwrap(node);
  if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression) && ts.isStringLiteralLike(n.argumentExpression)) {
    const list = listNamed(n.expression.text, file);
    return list ? entriesOf(list.node, list.file)[n.argumentExpression.text] : undefined;
  }
  if (!ts.isObjectLiteralExpression(n)) return undefined;
  const out = {};
  let to = false;
  for (const p of n.properties) {
    if (!ts.isPropertyAssignment(p) || !p.name) continue;
    const key = p.name.getText(file.sf);
    const v = unwrap(p.initializer);
    if ((key === 'kind' || key === 'type') && ts.isStringLiteralLike(v)) out[key] = v.text;
    else if (key === 'to') to = true;
    else if (key === 'values' && ts.isArrayLiteralExpression(v)) {
      out.values = v.elements.flatMap((e) => (ts.isStringLiteralLike(e) ? [e.text]
        : ts.isSpreadElement(e) && ts.isIdentifier(e.expression) ? valuesNamed(e.expression.text, file) : []));
    } else if (key === 'default') {
      if (ts.isStringLiteralLike(v)) out.default = v.text;
      else if (ts.isNumericLiteral(v)) out.default = Number(v.text);
      else if (v.kind === ts.SyntaxKind.TrueKeyword || v.kind === ts.SyntaxKind.FalseKeyword) out.default = v.kind === ts.SyntaxKind.TrueKeyword;
    }
  }
  if (!out.kind && to) out.kind = 'content';
  return out;
}

/** The class `define()` registers, else the first. */
function registeredClass(sf, src) {
  const registered = /(?:customElements\.)?\bdefine\(\s*['"][^'"]+['"]\s*,\s*([A-Za-z_$][\w$]*)/.exec(src ?? '')?.[1];
  const classes = sf.statements.filter(ts.isClassDeclaration);
  return classes.find((c) => c.name?.text === registered) ?? classes[0];
}


/** The base class's contract with a subclass — never a component's own API. */
const LIFECYCLE = new Set([
  'onRender', 'onConnect', 'onDisconnect', 'onChange', 'renderData', 'constructor',
  'connectedCallback', 'disconnectedCallback', 'attributeChangedCallback', 'adoptedCallback',
]);

/** A JSDoc's first paragraph, on one line, without its TRAP citations. */
function summaryOf(node, sf) {
  const doc = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc).at(-1);
  const text = doc ? ts.getTextOfJSDocComment(doc.comment) ?? '' : '';
  return text.split(/\n\s*\n/)[0]
    .replace(/TRAP\s+T-[\w-]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s·—-]+$/, '')
    .trim();
}

/** A config default's type, where its literal says it; otherwise undefined. */
function literalType(node) {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node)) return 'string';
  if (ts.isNumericLiteral(node)) return 'number';
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return 'boolean';
  return undefined;
}

/** Is this member the class's own, and public? */
function isPublic(member) {
  if (!member.name || ts.isPrivateIdentifier(member.name)) return false;
  const mods = ts.getCombinedModifierFlags(member);
  return !(mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected | ts.ModifierFlags.Static));
}

/**
 * The component class's public methods and properties, read by TypeScript's
 * own parser — so a member of a TYPE or an object literal in the same file is
 * never mistaken for one of the class's, and a summary is its whole first
 * paragraph. The class is the one `define()` registers.
 * TRAP T-a-spec-reads-the-class-by-its-parser
 *
 * @returns {{ methods: object[], props: object[] }}
 */
export function parseClassApi(src) {
  const sf = ts.createSourceFile('c.ts', src ?? '', ts.ScriptTarget.Latest, true);
  const cls = registeredClass(sf, src);
  const methods = [];
  const props = new Map();
  /* A TYPE as written, or `unknown`: a wrong type in a contract is worse than
     an honest gap. Every property read `string` before. */
  const prop = (name) => props.get(name) ?? props.set(name, { name, type: 'unknown', get: false, set: false }).get(name);
  const written = (node) => node?.getText(sf).replace(/\s+/g, ' ').trim();
  for (const member of cls?.members ?? []) {
    const name = member.name && !ts.isPrivateIdentifier(member.name) ? member.name.getText(sf) : '';
    // `static config` names are read-write properties the BASE class defines. TRAP T-configuration-is-not-data
    if (ts.isPropertyDeclaration(member) && name === 'config' && member.initializer
      && ts.isObjectLiteralExpression(member.initializer)) {
      for (const p of member.initializer.properties) {
        if (!p.name) continue;
        const entry = prop(p.name.getText(sf));
        entry.get = entry.set = true;
        entry.type = literalType(ts.isPropertyAssignment(p) ? p.initializer : undefined) ?? entry.type;
      }
      continue;
    }
    if (!isPublic(member)) continue;
    if (ts.isMethodDeclaration(member) && !LIFECYCLE.has(name) && !methods.some((m) => m.name === name)) {
      const description = summaryOf(member, sf);
      methods.push({
        $type: 'method',
        name,
        // as written, so a caller knows the argument ORDER
        args: member.parameters.map((p) => p.getText(sf)).join(', ').replace(/\s+/g, ' ').trim(),
        ...(description ? { description } : {}),
      });
    } else if (ts.isGetAccessorDeclaration(member)) {
      // What a reader GETS names it; a setter may take more.
      const entry = prop(name);
      entry.get = true;
      entry.type = written(member.type) ?? entry.type;
    } else if (ts.isSetAccessorDeclaration(member)) {
      const entry = prop(name);
      entry.set = true;
      if (entry.type === 'unknown') entry.type = written(member.parameters[0]?.type) ?? entry.type;
    }
  }
  return {
    methods,
    props: [...props.values()].map(({ get, set, ...p }) => ({
      ...p, access: get && set ? 'read-write' : get ? 'read' : 'write',
    })),
  };
}
