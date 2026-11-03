/**
 * schema-check.mjs — the one Ajv door: a file in schemas/, compiled once, as a check.
 *
 * Map:
 * - schemaCheck — a schemas/ file as a check: a value → its errors, [] when it is valid
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const SCHEMAS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas');
const Ajv = Ajv2020.default ?? Ajv2020;
const compiled = new Map();

/** A schemas/ file as a check: a value → its errors, [] when it is valid. */
export function schemaCheck(file) {
  if (!compiled.has(file)) {
    const schema = JSON.parse(readFileSync(join(SCHEMAS, file), 'utf8'));
    compiled.set(file, new Ajv({ allErrors: true, strict: false }).compile(schema));
  }
  const validate = compiled.get(file);
  return (value) => (validate(value) ? [] : validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`));
}
