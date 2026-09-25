/**
 * validate-def.mjs — check a component def against every design-system rule.
 * Returns { ok, errors[], warnings[] }. The single validator the MCP + skills use.
 *
 * Encodes the rules from docs/DEF-TO-FIGMA-BUILD-RULES.md so an AI can't ship a
 * def that repeats a known defect.
 *
 * Map:
 * - validateDef — check a def against its schema; the errors, or none
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadNameMap, loadComponentNames, loadCssTokenNames, PATHS } from './data.mjs';

const err = (code, msg, where) => ({ level: 'error', code, msg, where });
const warn = (code, msg, where) => ({ level: 'warning', code, msg, where });

/** Walk anatomy nodes depth-first. */
function* walk(node, path = 'root') {
  if (!node) return;
  yield [node, path];
  for (const c of node.children ?? []) yield* walk(c, `${path} > ${c.class ?? c.component ?? c.el ?? '?'}`);
}

/**
 * Every anatomy root, whichever of the three forms the def uses — `root`,
 * `roots`, or `byTemplate`. These rules are about the NODES (an owned button
 * needs a size, a text node needs a role), and a node is no less real for living
 * in a second template, so all three forms must be walked.
 */
function allRoots(def) {
  const a = def?.anatomy;
  if (!a) return [];
  if (a.byTemplate) return Object.values(a.byTemplate).flat();
  if (Array.isArray(a.roots)) return a.roots;
  return a.root ? [a.root] : [];
}

/**
 * A component's own stylesheet, or `null`. Cached — the token loop asks per
 * alias and a component has many. Returns null rather than throwing, so a def
 * for a component that does not exist yet still validates.
 */
const _cssCache = new Map();
function componentCss(name) {
  if (!name) return null;
  if (_cssCache.has(name)) return _cssCache.get(name);
  const p = join(PATHS.components, name, `${name}.css`);
  let css = null;
  try { css = existsSync(p) ? readFileSync(p, 'utf8') : null; } catch { css = null; }
  _cssCache.set(name, css);
  return css;
}

export function validateDef(def, opts = {}) {
  const nameMap = opts.nameMap ?? loadNameMap();
  const components = new Set(opts.components ?? loadComponentNames());
  const cssTokens = opts.cssTokens ?? loadCssTokenNames();
  const out = [];

  // ── shape basics ──
  if (!def || typeof def !== 'object') return { ok: false, errors: [err('shape', 'def is not an object')], warnings: [] };
  if (!def.name || !/^sherpa-[a-z-]+$/.test(def.name)) out.push(err('name', `name must be sherpa-<kebab>, got "${def.name}"`));
  if (!def.category) out.push(warn('category', 'no category set'));
  if (!allRoots(def).length) out.push(warn('anatomy', 'no anatomy roots — def→code/Figma compile needs them'));

  // ── Rule 1: reuse existing components (nested must be real) ──
  for (const n of def.nested ?? []) {
    if (n.component && !components.has(n.component)) {
      out.push(err('reuse', `nested "${n.component}" is not a real component — reuse an existing one (Rule 1)`, 'nested'));
    }
    if (!['owned', 'slotted'].includes(n.relationship)) {
      out.push(warn('nesting', `nested "${n.component}" missing relationship (owned|slotted)`, 'nested'));
    }
  }

  // ── Rule 9 / tokens: every token a def binds must be a REAL token name ──
  for (const [key, tok] of Object.entries(def.tokens ?? {})) {
    const prop = key.split('.').pop();
    // token can be a string alias or {override, fallback}
    const names = typeof tok === 'string' ? [tok] : [tok.override, tok.fallback].filter(Boolean);
    for (const nm of names) {
      // A def spells a token dash-joined and unprefixed; tokens.css spells it
      // `--sherpa-a-b-c`. Normalise both before comparing.
      const norm = (s) => s.toLowerCase().replace(/^.*::/, '').replace(/[/-]/g, '');
      const target = norm(nm);

      /* DOES THIS TOKEN EXIST? Ask the generated sheet, not the ontology.
         `docs/ontology/tokens` was deleted 2026-09-16 (it described collections
         that no longer existed), so `loadOntology()` returns `{}` — and this
         check read "no entry" as "wrong name" and warned about EVERY token in
         EVERY component: 1173 warnings, 99% of them false, burying 14 real ones.
         A validator that is wrong 99% of the time is worse than no validator.

         `tokens.css` is re-projected from Figma, so it cannot rot by hand. An
         EMPTY set means the sheet is missing and the question is unanswerable —
         stay quiet, rather than condemning everything. */
      if (cssTokens.size) {
        const known = [...cssTokens].some((t) => {
          const k = norm(t.replace('--sherpa-', ''));
          return k === target || k.endsWith(target);
        });
        if (!known) {
          /* Not in the shared sheet — but that is not the whole question.
             A COMPONENT-SCOPED collection (Figma's `structure`, `switch`,
             `navigation`, `input`) is projected by `project-tokens.mjs` into the
             component's OWN `sherpa:tokens` region rather than into tokens.css,
             so `--sherpa-button-space-gap` is a real projected token that simply
             lives somewhere else. It is NOT a misnamed private value, and
             renaming it to `--_*` is undone by the next projection — I tried,
             and the next `--all` run put every name straight back.

             So: defined in the component's own CSS ⇒ scoped, say where it comes
             from and move on. Defined nowhere ⇒ genuinely dead. */
          const ownCss = componentCss(def.name);
          const scoped = ownCss
            && /sherpa:tokens \(generated/.test(ownCss)
            && new RegExp(`--sherpa-${nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(ownCss);
          // A scoped token is CORRECT, so it is not a finding. Five components
          // carry a projected region today: button (structure), input-text
          // (input), nav + nav-item (navigation), switch (switch).
          if (scoped) continue;
          out.push(warn('token', `token "${nm}" (${key}) is not declared in tokens.css, and ${def.name}.css has no projected region defining it — the name is dead`, key));
          continue;
        }
      }

      /* Rule 4 used to live here: a control LABEL must not bind
         `status-content` directly, because a status surface plus status ink is
         the light-on-light bug. It is GONE, and so is the thing it guarded —
         `grep status-content src/styles/tokens/tokens.css` returns 0, and no
         def binds such a name. The rule now guards a vocabulary that was
         retired with the Status collection.

         Kept as a note rather than a check, because the LESSON is still true:
         text that must stay legible on a status fill binds `control-content`,
         which is the axis that re-points with the surface. The check itself
         could only ever match a name that cannot occur. */
    }
  }

  // ── Rule 3: status container should bind container-* not status-* for surface/border ──
  if (def.category === 'container') {
    for (const [key, tok] of Object.entries(def.tokens ?? {})) {
      const nm = typeof tok === 'string' ? tok : tok.override;
      if (nm && /^status-(surface|border)/.test(nm) && /(background|surface|border)/.test(key)) {
        out.push(warn('container-alias', `container "${key}" binds status-* directly — prefer container-* which aliases through status (Rule 3)`, key));
      }
    }
  }

  // ── anatomy: owned nested buttons must carry size, text nodes need a role ──
  for (const [node] of allRoots(def).flatMap((r) => [...walk(r)])) {
    if (node.component === 'sherpa-button' && node.relationship === 'owned') {
      if (!node.attrs || !('data-size' in node.attrs)) {
        out.push(warn('button-size', `owned sherpa-button "${node.class ?? ''}" has no data-size — buttons must set a size so the size mode works (Rule 6)`, node.class));
      }
    }
    if (node.figma?.node === 'TEXT' && !node.figma?.role && !node.slot === undefined) {
      out.push(warn('text-role', `text node "${node.class ?? node.slot ?? ''}" has no content role — bind a content colour + Typography vars (Rule 2)`, node.class));
    }
  }

  /* ── events well-formed ──
     A NATIVE event name is a single word by definition, and re-dispatching one
     is the convention, not a breach of it: CLAUDE.md's naming contract lists
     `change`/`input` as standard shared events in the same sentence that sets
     the `noun-verb` rule. The rule demanded a hyphen from all of them and
     produced 12 warnings across 10 components, every one false. A component
     that re-dispatches `change` is doing exactly what the contract asks. */
  const NATIVE_EVENTS = new Set([
    'change', 'input', 'close', 'open', 'toggle', 'submit', 'reset', 'select',
    'focus', 'blur', 'invalid', 'cancel', 'search',
  ]);
  for (const e of def.events ?? []) {
    if (!NATIVE_EVENTS.has(e.name) && !/^[a-z]+(-[a-z]+)+$/.test(e.name)) {
      out.push(warn('event-name', `event "${e.name}" should be unprefixed noun-verb (or a re-dispatched native event)`, e.name));
    }
    if (e.cancelable && !e.default) out.push(warn('event-default', `cancelable event "${e.name}" should document its default action`, e.name));
  }

  const errors = out.filter((o) => o.level === 'error');
  const warnings = out.filter((o) => o.level === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}
