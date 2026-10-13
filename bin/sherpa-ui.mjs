#!/usr/bin/env node
/**
 * sherpa-ui — `sherpa-ui init <folder>`: a new app from the starter, one
 * folder with no build. No dependencies. TRAP T-a-starter-is-one-folder
 *
 * Map:
 * - init — Copy the starter into a new folder, named for it.
 */
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STARTER = join(dirname(fileURLToPath(import.meta.url)), '..', 'starter');
/* npm drops a package's `.gitignore`, and this repo ignores `.mcp.json`: the
   starter keeps both without their dot. */
const DOTTED = ['gitignore', 'mcp.json'];

/** Copy the starter into a new folder, named for it. Throws when the folder holds anything. */
export function init(folder) {
  const target = resolve(folder);
  if (existsSync(target) && readdirSync(target).length) throw new Error(`${folder} is not empty`);
  cpSync(STARTER, target, { recursive: true });
  for (const file of DOTTED) renameSync(join(target, file), join(target, `.${file}`));
  const pkgPath = join(target, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = basename(target).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'sherpa-app';
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return target;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, folder] = process.argv.slice(2);
  if (command !== 'init' || !folder) {
    console.log('Usage: npx sherpa-ui init <folder>\n\nA new Sherpa UI app: one folder, no build.');
    process.exit(command ? 1 : 0);
  }
  try {
    init(folder);
  } catch (error) {
    console.error(`sherpa-ui init: ${error.message}`);
    process.exit(1);
  }
  console.log(`A Sherpa UI app is in ${folder}. Next:\n\n  cd ${folder}\n  npm install\n  npm start\n\nAGENTS.md says where each kind of file goes.`);
}
