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
 */
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

const lib = (file) => import(pathToFileURL(at("scripts", "lib", "generation", file)).href);
const data = await lib("data.mjs");
export const loadComponentNames = data.loadComponentNames;
export const loadDef = data.loadDef;
export const loadSpec = data.loadSpec;
export const loadNameMap = data.loadNameMap;
export const loadCssTokenNames = data.loadCssTokenNames;
export const compileDef = (await lib("compile-def.mjs")).compileDef;
export const validateDef = (await lib("validate-def.mjs")).validateDef;
export const tokenForValue = (await lib("resolve.mjs")).tokenForValue;
