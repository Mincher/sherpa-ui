import fs from "fs";
import path from "path";
import { log } from "./logger.js";

/** Load all component schemas from schemas/components/. Returns Map<tagName, schema>. */
export function loadSchemas(schemasDir) {
  const indexPath = path.join(schemasDir, "index.json");
  if (!fs.existsSync(indexPath)) {
    log.warn(`Schema index not found at ${indexPath} — run npm run schemas`);
    return new Map();
  }
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const schemas = new Map();
  for (const tag of index) {
    const filePath = path.join(schemasDir, `${tag}.json`);
    if (fs.existsSync(filePath)) {
      try {
        schemas.set(tag, JSON.parse(fs.readFileSync(filePath, "utf8")));
      } catch (e) {
        log.warn(`Failed to parse schema for ${tag}: ${e.message}`);
      }
    }
  }
  log.info(`Loaded ${schemas.size} component schemas`);
  return schemas;
}

/**
 * Load design tokens from css/styles/ tree.
 * Returns { name, value, file }[] — first declaration per name (light/default values).
 * The `value` is the raw CSS value so agents can understand what a token resolves to.
 */
export function loadTokens(cssStylesDir, rootDir) {
  const tokens = [];
  const seen = new Set();

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    // Process subdirectories first (tokens/ dir contains alias/platform values we
    // want as the canonical first-seen entry before theme overrides in sherpa-themes.css)
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith(".css")) {
        const relPath = path.relative(rootDir, fullPath);
        const content = fs.readFileSync(fullPath, "utf8");
        // Capture complete declarations; handles values with nested parens (e.g. var(...))
        const re = /^\s*(--sherpa-[a-zA-Z0-9-]+)\s*:\s*([^;]+);/gm;
        let m;
        while ((m = re.exec(content)) !== null) {
          const name = m[1];
          const value = m[2].trim().replace(/\s+/g, " ");
          if (!seen.has(name)) {
            seen.add(name);
            tokens.push({ name, value, file: relPath });
          }
        }
      }
    }
  }

  scanDir(cssStylesDir);
  log.info(`Loaded ${tokens.length} design tokens`);
  return tokens;
}

/** Build a Map<tokenName, {value, file}> for fast alias resolution. */
export function buildTokenMap(tokens) {
  const map = new Map();
  for (const t of tokens) {
    if (!map.has(t.name)) map.set(t.name, { value: t.value, file: t.file });
  }
  return map;
}

/**
 * Walk a token's alias chain.
 * Returns { resolved, chain } where chain is [{name, value, file}] and
 * resolved is the final concrete value (or the last var() if unresolvable).
 */
export function resolveTokenChain(name, tokenMap, depth = 0) {
  if (depth > 10) return { resolved: "(max depth)", chain: [] };
  const entry = tokenMap.get(name);
  if (!entry) return { resolved: null, chain: [] };
  const step = { name, value: entry.value, file: entry.file };
  // Resolve single var(--sherpa-...) references
  const varMatch = entry.value.match(/^var\((--sherpa-[a-zA-Z0-9-]+)(?:,[^)]+)?\)/);
  if (varMatch && varMatch[1] !== name) {
    const { resolved, chain: sub } = resolveTokenChain(varMatch[1], tokenMap, depth + 1);
    return { resolved: resolved ?? entry.value, chain: [step, ...sub] };
  }
  return { resolved: entry.value, chain: [step] };
}

/** Load pattern index from patterns/index.json. Returns Map<id, entry>. */
export function loadPatterns(patternsDir) {
  const indexPath = path.join(patternsDir, "index.json");
  if (!fs.existsSync(indexPath)) {
    log.warn(`Pattern index not found at ${indexPath} — run npm run patterns`);
    return new Map();
  }
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const patterns = new Map();
  for (const entry of index) patterns.set(entry.id, entry);
  log.info(`Loaded ${patterns.size} patterns`);
  return patterns;
}

/** Load CSS utility class schemas from schemas/css-utilities/. */
export function loadCssUtilities(cssUtilDir) {
  const indexPath = path.join(cssUtilDir, "index.json");
  if (!fs.existsSync(indexPath)) return new Map();
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const utilities = new Map();
  for (const className of index) {
    const filePath = path.join(cssUtilDir, `${className}.json`);
    if (fs.existsSync(filePath)) {
      try {
        utilities.set(className, JSON.parse(fs.readFileSync(filePath, "utf8")));
      } catch (e) {
        log.warn(`Failed to parse CSS utility schema for ${className}: ${e.message}`);
      }
    }
  }
  return utilities;
}

/** Discover utility modules under components/utilities and components/app-utils. */
export function loadUtilities(componentsDir) {
  const utilities = new Map();
  for (const subdir of ["utilities", "app-utils"]) {
    const dir = path.join(componentsDir, subdir);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".js")) {
        const id = entry.name.replace(/\.js$/, "");
        if (!utilities.has(id)) {
          utilities.set(id, { id, kind: "module", files: { js: path.join(dir, entry.name) } });
        }
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        const id = entry.name.replace(/\.ts$/, "");
        if (!utilities.has(id)) {
          utilities.set(id, { id, kind: "module", files: { ts: path.join(dir, entry.name) } });
        }
      } else if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name);
        const files = {};
        for (const ext of ["js", "ts", "css", "html"]) {
          for (const name of [`${entry.name}.${ext}`, `index.${ext}`]) {
            const f = path.join(sub, name);
            if (fs.existsSync(f)) { files[ext] = f; break; }
          }
        }
        if (Object.keys(files).length && !utilities.has(entry.name)) {
          utilities.set(entry.name, { id: entry.name, kind: "folder", files });
        }
      }
    }
  }
  log.info(`Loaded ${utilities.size} utility modules`);
  return utilities;
}

/** Read a guideline document by filename, checking docs/ then css/ then .github/. */
export function readDoc(filename, docsDir, cssDir, copilotPath) {
  const docsFile = path.join(docsDir, filename);
  if (fs.existsSync(docsFile)) return fs.readFileSync(docsFile, "utf8");
  const cssFile = path.join(cssDir, filename);
  if (fs.existsSync(cssFile)) return fs.readFileSync(cssFile, "utf8");
  if (filename === "copilot-instructions.md" && fs.existsSync(copilotPath)) {
    return fs.readFileSync(copilotPath, "utf8");
  }
  return null;
}

/** Read one source file (html/css/js/examples/readme) for a component. */
export function readComponentSource(tagName, kind, componentsDir) {
  const dir = path.join(componentsDir, tagName);
  if (!fs.existsSync(dir)) return null;
  const map = {
    css:      `${tagName}.css`,
    js:       `${tagName}.js`,
    html:     `${tagName}.html`,
    examples: `${tagName}.examples.html`,
    readme:   "README.md",
  };
  const filename = map[kind];
  if (!filename) return null;
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

/** Read the raw HTML file for a component. */
export function readComponentHTML(tagName, componentsDir) {
  const htmlPath = path.join(componentsDir, tagName, `${tagName}.html`);
  if (!fs.existsSync(htmlPath)) return null;
  return fs.readFileSync(htmlPath, "utf8");
}

/** Read a pattern HTML file using the path from its index entry. */
export function readPatternHTML(patternEntry, rootDir) {
  const filePath = path.join(rootDir, patternEntry.file);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

/** Read a utility source file (js/ts/css/html). Falls back ts→js. */
export function readUtilitySource(id, kind = "js", utilities) {
  const util = utilities.get(id);
  if (!util) return null;
  // Allow ts as a fallback for js
  const resolvedKind = kind === "js" && !util.files.js && util.files.ts ? "ts" : kind;
  const filePath = util.files[resolvedKind];
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

/** Parse `<template id="...">` blocks from a component HTML file. */
export function parseTemplateIds(tagName, componentsDir) {
  const htmlPath = path.join(componentsDir, tagName, `${tagName}.html`);
  if (!fs.existsSync(htmlPath)) return [];
  const raw = fs.readFileSync(htmlPath, "utf8");
  const html = raw.replace(/<!--[\s\S]*?-->/g, "");
  const ids = [];
  const re = /<template\s+id=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) ids.push(m[1]);
  return ids;
}

/**
 * Parse `<template data-label ...>` blocks from a .examples.html file.
 * Matches the contract used by docs/router.js.
 */
export function parseExampleTemplates(html) {
  const examples = [];
  const re = /<template\b([^>]*)>([\s\S]*?)<\/template>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrStr = m[1] || "";
    const body = m[2];
    const get = (name) => {
      const r = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`);
      const mm = attrStr.match(r);
      return mm ? mm[1] : undefined;
    };
    const id = get("id");
    const label = get("data-label");
    if (!label && !id) continue;
    examples.push({
      id,
      label: label || id,
      description: get("data-description") || "",
      layout: get("data-layout") || "default",
      preview: body.trim(),
      setup: get("data-setup") || null,
    });
  }
  return examples;
}

/** Extract the first JSDoc summary block (up to 3 lines, ≤240 chars) from JS source. */
export function extractJsdocSummary(src) {
  if (!src) return "";
  const m = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (!m) return "";
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l && !l.startsWith("@"))
    .slice(0, 3)
    .join(" ")
    .slice(0, 240);
}
