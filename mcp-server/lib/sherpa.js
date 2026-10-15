/**
 * sherpa.js — the sherpa-ui this MCP describes: the installed package, or the
 * repo it sits in when run from a checkout. Every file it reads comes from here.
 * TRAP T-the-mcp-reads-sherpa-ui-through-one-door
 *
 * Map:
 * - SHERPA_ROOT — sherpa-ui's folder: its specs, docs, schemas, tokens and dist/
 * - at — a path inside sherpa-ui
 * - loadComponentNames — every component's name, from sherpa-ui's generation lib
 * - loadDef — a component's def, from its spec
 * - loadSpec — a component's spec, as it is on disk
 * - loadNameMap — the Figma name map
 * - loadCssTokenNames — every token name tokens.css defines
 * - compileDef — a def compiled to the component's source
 * - validateDef — a def checked against the rules
 * - tokenForValue — the token a raw value is
 * - loadExample — a component's shipped example, its markup joined; null if it has none
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const installed = () => {
  try {
    return path.dirname(createRequire(import.meta.url).resolve("sherpa-ui/package.json"));
  } catch {
    return null;
  }
};

/** sherpa-ui's folder: its specs, docs, schemas, tokens and dist/. */
export const SHERPA_ROOT = installed() ?? path.resolve(here, "..", "..");

/** A path inside sherpa-ui. */
export const at = (...parts) => path.join(SHERPA_ROOT, ...parts);

/* The generation code: this package's own copy once packed (`vendor/`), else
   the checkout's. It reads sherpa-ui's data from SHERPA_UI_ROOT. */
process.env.SHERPA_UI_ROOT ??= SHERPA_ROOT;
const VENDOR = path.resolve(here, "..", "vendor");
const CODE_ROOT = existsSync(VENDOR) ? VENDOR : SHERPA_ROOT;
const lib = (file) => import(pathToFileURL(path.join(CODE_ROOT, "scripts", "lib", "generation", file)).href);
const data = await lib("data.mjs");
export const loadComponentNames = data.loadComponentNames;
export const loadDef = data.loadDef;
export const loadSpec = data.loadSpec;
export const loadNameMap = data.loadNameMap;
export const loadCssTokenNames = data.loadCssTokenNames;
export const compileDef = (await lib("compile-def.mjs")).compileDef;
export const validateDef = (await lib("validate-def.mjs")).validateDef;
export const tokenForValue = (await lib("resolve.mjs")).tokenForValue;

/** A component's shipped example, its markup joined; null if it has none.
 *  TRAP T-a-component-ships-its-example */
export function loadExample(name) {
  const file = at("src", "components", name, `${name}.example.json`);
  if (!existsSync(file)) return null;
  const example = JSON.parse(readFileSync(file, "utf8"));
  return { ...example, html: [example.html].flat().join("") };
}
