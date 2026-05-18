#!/usr/bin/env node
/**
 * Static audit of every component's examples.html.
 *
 * Flags common emptiness/configuration issues so we can do a focused
 * enrichment pass.  Heuristic — not exhaustive.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../components/', import.meta.url).pathname;

/* ─── helpers ──────────────────────────────────────────────────────── */

const tagDirs = readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.startsWith('sherpa-'))
  .map(d => d.name)
  .sort();

/** Crude tag-content scanner — returns array of { tag, inner, attrs } */
function findElements(html, tagName) {
  const out = [];
  const re = new RegExp(`<${tagName}\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${tagName}>)`, 'g');
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    const selfClosed = m[2] === '/>';
    const inner = selfClosed ? '' : (m[3] || '');
    out.push({ attrs, inner, selfClosed });
  }
  return out;
}

function hasAttr(attrs, name) {
  return new RegExp(`\\b${name}\\s*=`).test(attrs) || new RegExp(`\\b${name}\\b`).test(attrs);
}
function getAttr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : null;
}

/** Strip <template> wrappers but keep their content for child scanning */
function unwrapTemplates(html) {
  return html.replace(/<template\b[^>]*>/g, '').replace(/<\/template>/g, '');
}

/* ─── checks ───────────────────────────────────────────────────────── */

const issues = [];

for (const tag of tagDirs) {
  const file = join(ROOT, tag, `${tag}.examples.html`);
  if (!existsSync(file)) {
    issues.push({ tag, kind: 'missing-file', detail: `${tag}.examples.html` });
    continue;
  }
  const raw = readFileSync(file, 'utf8');
  const html = unwrapTemplates(raw);

  /* ── 1.  sherpa-button without label/type=icon/data-menu ── */
  for (const el of findElements(html, 'sherpa-button')) {
    const type = getAttr(el.attrs, 'data-type');
    const label = getAttr(el.attrs, 'data-label');
    const inner = el.inner.trim();
    const hasMenu = hasAttr(el.attrs, 'data-menu') || type === 'icon-menu' || type === 'button-menu';
    if (type === 'icon' || type === 'icon-menu') continue;       // icon-only is fine without label
    if (!label && !inner) {
      issues.push({ tag, kind: 'button-no-label', detail: el.attrs.trim().slice(0, 80) });
    }
  }

  /* ── 2.  inputs / labelled controls without data-label ── */
  const labelledTags = [
    'sherpa-input-text', 'sherpa-input-search', 'sherpa-input-number',
    'sherpa-input-password', 'sherpa-input-date', 'sherpa-input-date-range',
    'sherpa-input-time', 'sherpa-input-select', 'sherpa-input-tag',
    'sherpa-input-checkbox', 'sherpa-input-radio', 'sherpa-switch',
    'sherpa-input-checkbox-group', 'sherpa-input-radio-group',
    'sherpa-slider', 'sherpa-file-upload',
  ];
  for (const t of labelledTags) {
    for (const el of findElements(html, t)) {
      const label = getAttr(el.attrs, 'data-label');
      const inner = el.inner.trim();
      if (!label && !inner) {
        issues.push({ tag, kind: `${t}-no-label`, detail: el.attrs.trim().slice(0, 80) });
      }
    }
  }

  /* ── 3.  sherpa-tag without text/data-label ── */
  for (const el of findElements(html, 'sherpa-tag')) {
    const label = getAttr(el.attrs, 'data-label');
    if (!label && !el.inner.trim()) {
      issues.push({ tag, kind: 'tag-no-label', detail: el.attrs.trim().slice(0, 80) });
    }
  }

  /* ── 4.  empty containers / lists / menus / navs ── */
  const containerTags = [
    'sherpa-list', 'sherpa-menu', 'sherpa-nav', 'sherpa-nav-item',
    'sherpa-tabs', 'sherpa-accordion', 'sherpa-breadcrumbs',
    'sherpa-key-value-list', 'sherpa-toolbar',
  ];
  for (const t of containerTags) {
    for (const el of findElements(html, t)) {
      const inner = el.inner.trim();
      const hasData = ['data-items', 'data-tabs', 'data-sections', 'data-pairs', 'data-crumbs']
        .some(a => hasAttr(el.attrs, a));
      if (!inner && !hasData && !el.selfClosed) {
        issues.push({ tag, kind: `${t}-empty`, detail: el.attrs.trim().slice(0, 80) });
      }
    }
  }

  /* ── 5.  nav-item missing label ── */
  for (const el of findElements(html, 'sherpa-nav-item')) {
    const label = getAttr(el.attrs, 'data-label');
    if (!label && !el.inner.trim()) {
      issues.push({ tag, kind: 'nav-item-no-label', detail: el.attrs.trim().slice(0, 80) });
    }
  }

  /* ── 6.  icon component without class ── */
  for (const el of findElements(html, 'sherpa-icon')) {
    const cls = getAttr(el.attrs, 'data-icon-class') || getAttr(el.attrs, 'class');
    if (!cls) {
      issues.push({ tag, kind: 'icon-no-class', detail: el.attrs.trim().slice(0, 80) });
    }
  }

  /* ── 7.  callout/message without title or body ── */
  for (const t of ['sherpa-callout', 'sherpa-message']) {
    for (const el of findElements(html, t)) {
      const title = getAttr(el.attrs, 'data-title') || getAttr(el.attrs, 'data-heading');
      const body = getAttr(el.attrs, 'data-body') || getAttr(el.attrs, 'data-description');
      if (!title && !body && !el.inner.trim()) {
        issues.push({ tag, kind: `${t}-empty`, detail: el.attrs.trim().slice(0, 80) });
      }
    }
  }

  /* ── 8.  menu-item without label ── */
  for (const el of findElements(html, 'sherpa-menu-item')) {
    const label = getAttr(el.attrs, 'data-label');
    if (!label && !el.inner.trim()) {
      issues.push({ tag, kind: 'menu-item-no-label', detail: el.attrs.trim().slice(0, 80) });
    }
  }

  /* ── 9.  list-item with no body ── */
  for (const el of findElements(html, 'sherpa-list-item')) {
    const label = getAttr(el.attrs, 'data-label') || getAttr(el.attrs, 'data-title');
    if (!label && !el.inner.trim()) {
      issues.push({ tag, kind: 'list-item-empty', detail: el.attrs.trim().slice(0, 80) });
    }
  }
}

/* ─── report ───────────────────────────────────────────────────────── */

const byTag = new Map();
for (const i of issues) {
  if (!byTag.has(i.tag)) byTag.set(i.tag, []);
  byTag.get(i.tag).push(i);
}

console.log(`# Audit — ${issues.length} issues across ${byTag.size} components\n`);
for (const [tag, list] of [...byTag.entries()].sort()) {
  console.log(`## ${tag}  (${list.length})`);
  for (const i of list) console.log(`  • [${i.kind}] ${i.detail}`);
  console.log('');
}
