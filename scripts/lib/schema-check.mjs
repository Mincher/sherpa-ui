/**
 * schema-check.mjs — the one Ajv door: a file in schemas/, compiled once, as a check.
 * Every file in schemas/ is loaded first, so one's `$ref` into another resolves.
 *
 * Map:
 * - schemaCheck — a schemas/ file, or a shape in it, as a check: a value → its errors, [] when valid
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const SCHEMAS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas');
const Ajv = Ajv2020.default ?? Ajv2020;
let ajv;

/** A schemas/ file, or a shape in it (`defs.v1.json#/$defs/view`), as a check: a value → its errors, [] when it is valid. */
export function schemaCheck(file) {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: false });
    for (const name of readdirSync(SCHEMAS).filter((f) => f.endsWith('.json'))) {
      ajv.addSchema(JSON.parse(readFileSync(join(SCHEMAS, name), 'utf8')));
    }
  }
  const validate = ajv.getSchema(new URL(file, 'https://sherpa-ui.dev/schemas/').href);
  if (!validate) throw new Error(`schemaCheck: no schema ${file} in schemas/`);
  return (value) => (validate(value) ? [] : validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`));
}
