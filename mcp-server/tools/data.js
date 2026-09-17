/**
 * Data tools — the data layer's surface, for an agent pointing Sherpa at a backend.
 *
 *   validate_schema — run a schema over sample rows: mapped / rejected / WHY
 *
 * The other tools in this server answer "what does this component look like".
 * These answer "will my data work", which nothing could answer before: an agent
 * wiring a backend had to guess at the row shape and find out at runtime.
 *
 * Thin wrappers over `sherpa-ui/data` — the same `validate()` a Store runs, so
 * the answer here is the answer the app will give. A second implementation
 * would be a second thing to keep in step, and would eventually disagree.
 */
import { z } from "zod/v3";
import { loadDataLayer, dataLayerError } from "../lib/data-layer.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

/**
 * The rule vocabulary an agent can name in JSON.
 *
 * A schema is FUNCTIONS, which cannot cross a tool boundary — so a rule is named
 * as a string (`"required"`) or as a one-key object carrying its argument
 * (`{ "min": 0 }`). That is the whole grammar; anything else is reported rather
 * than guessed at, because a silently-dropped rule would make the tool say a row
 * passed a check it never ran.
 */
function buildRuleList(dl, spec, field, problems) {
  const list = Array.isArray(spec) ? spec : [spec];
  const out = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      const fn = dl[entry];
      if (typeof fn !== "function") { problems.push(`${field}: unknown rule "${entry}"`); continue; }
      out.push(fn());
      continue;
    }
    if (entry && typeof entry === "object") {
      const [name, arg] = Object.entries(entry)[0] ?? [];
      const fn = dl[name];
      if (typeof fn !== "function") { problems.push(`${field}: unknown rule "${name}"`); continue; }
      // `pattern` takes a RegExp; everything else takes its argument as written.
      out.push(name === "pattern" ? fn(new RegExp(String(arg))) : fn(arg));
      continue;
    }
    problems.push(`${field}: a rule must be a name or a { name: argument } object, got ${typeof entry}`);
  }
  return out;
}

/** The rule names this build actually exports, for the error message. */
function ruleNames(dl) {
  return ["required", "number", "min", "max", "pattern", "email", "url", "oneOf", "custom"]
    .filter((n) => typeof dl[n] === "function");
}

export function register(server) {
  // ── validate_schema — the ORACLE: does this data fit this schema? ──
  server.registerTool(
    "validate_schema",
    {
      title: "Validate Sample Rows Against a Schema",
      description:
        "Run a Sherpa schema over sample rows and report which map, which are REJECTED, and exactly why — the same `validate()` a Store runs on every read and write, so this is the answer your app will give. Use it before wiring a backend: a row a schema refuses is dropped and reported through `dropped`/`issues` rather than reaching a grid. The schema is a field→rules map, e.g. {\"email\": [\"required\", \"email\"], \"age\": [\"number\", {\"min\": 0}]}. Rules: required, number, min(n), max(n), pattern(regex), email, url, oneOf([...]).",
      inputSchema: {
        schema: z
          .string()
          .describe('The schema as a JSON object: field name → a rule or an array of rules. A rule is a name ("required") or a one-key object carrying its argument ({"min": 0}).'),
        rows: z
          .string()
          .describe("Sample rows as a JSON array of plain objects — a page of a real response is ideal."),
        key: z
          .string()
          .optional()
          .describe("The identity field (default \"id\"). Reported separately because a duplicate or blank key is a record two operations can disagree about."),
      },
    },
    async ({ schema, rows, key }) => {
      const dl = await loadDataLayer();
      if (!dl) return err(dataLayerError());

      let schemaObj, rowList;
      try { schemaObj = JSON.parse(schema); } catch (e) { return err(`schema is not valid JSON: ${e.message}`); }
      try { rowList = JSON.parse(rows); } catch (e) { return err(`rows is not valid JSON: ${e.message}`); }
      if (!schemaObj || typeof schemaObj !== "object" || Array.isArray(schemaObj)) {
        return err("schema must be a JSON object mapping a field name to its rules.");
      }
      if (!Array.isArray(rowList)) return err("rows must be a JSON array of objects.");
      if (!rowList.length) return err("rows is empty — pass at least one sample row.");

      const problems = [];
      const map = {};
      for (const [field, spec] of Object.entries(schemaObj)) {
        map[field] = buildRuleList(dl, spec, field, problems);
      }
      if (problems.length) {
        return err(`${problems.join("\n")}\n\nAvailable rules: ${ruleNames(dl).join(", ")}.`);
      }

      const built = dl.rules(map);
      const keyField = key ?? "id";

      const passed = [];
      const rejected = [];
      const byMessage = new Map();
      for (let i = 0; i < rowList.length; i++) {
        const row = rowList[i];
        const result = await dl.validate(built, row);
        if (dl.isValid(result)) { passed.push(i); continue; }
        rejected.push({ i, issues: result.issues ?? [] });
        for (const issue of result.issues ?? []) {
          const label = `${(issue.path ?? []).join(".") || "(row)"} — ${issue.message}`;
          byMessage.set(label, (byMessage.get(label) ?? 0) + 1);
        }
      }

      // The KEY check is separate from the schema: a schema validates a field's
      // VALUE, it cannot see the other rows. A duplicate or blank key is only
      // visible across the set, and it is what breaks `byKey`, `update`, `remove`
      // and a grid's selection across a re-query.
      const seen = new Map();
      const blankKeys = [];
      const dupeKeys = [];
      const missingKeyField = rowList.filter((r) => !(keyField in (r ?? {}))).length;
      for (let i = 0; i < rowList.length; i++) {
        const v = rowList[i]?.[keyField];
        if (v === undefined || v === null || v === "") { blankKeys.push(i); continue; }
        const at = seen.get(v);
        if (at !== undefined) dupeKeys.push({ value: v, rows: [at, i] });
        else seen.set(v, i);
      }

      // Fields present in the data but named by no rule — not an error (a row may
      // carry more than a schema checks) but worth saying, because a field the
      // schema forgot is the usual cause of "the grid shows blanks".
      const schemaFields = new Set(Object.keys(map));
      const dataFields = new Set();
      for (const r of rowList) for (const f of Object.keys(r ?? {})) dataFields.add(f);
      const unchecked = [...dataFields].filter((f) => !schemaFields.has(f));
      const absent = [...schemaFields].filter((f) => !dataFields.has(f));

      const lines = [];
      lines.push(`## validate_schema — ${rowList.length} row(s)\n`);
      lines.push(rejected.length
        ? `❌ **${passed.length} mapped · ${rejected.length} rejected**`
        : `✅ **all ${passed.length} rows map**`);
      lines.push("");

      if (byMessage.size) {
        lines.push(`### Why rows were rejected`);
        for (const [label, n] of [...byMessage].sort((a, b) => b[1] - a[1])) {
          lines.push(`- ${label}  — ${n} row(s)`);
        }
        lines.push("");
        lines.push(`### The first few rejected rows`);
        for (const r of rejected.slice(0, 5)) {
          const why = r.issues.map((i) => `${(i.path ?? []).join(".") || "(row)"}: ${i.message}`).join("; ");
          lines.push(`- row ${r.i} — ${why}`);
          lines.push(`  \`${JSON.stringify(rowList[r.i]).slice(0, 160)}\``);
        }
        if (rejected.length > 5) lines.push(`- …${rejected.length - 5} more`);
        lines.push("");
      }

      lines.push(`### The key (\`${keyField}\`)`);
      if (missingKeyField === rowList.length) {
        lines.push(`❌ NO row has a \`${keyField}\` field. Name the real identity field with \`key\`, or the store cannot find a record.`);
      } else {
        if (missingKeyField) lines.push(`⚠️ ${missingKeyField} row(s) have no \`${keyField}\` field.`);
        if (blankKeys.length) lines.push(`⚠️ ${blankKeys.length} row(s) have a blank key — rows ${blankKeys.slice(0, 8).join(", ")}.`);
        if (dupeKeys.length) {
          lines.push(`❌ ${dupeKeys.length} DUPLICATE key(s) — two records \`byKey\`/\`update\`/\`remove\` would disagree about:`);
          for (const d of dupeKeys.slice(0, 5)) lines.push(`  - \`${String(d.value)}\` at rows ${d.rows.join(" and ")}`);
        }
        if (!missingKeyField && !blankKeys.length && !dupeKeys.length) {
          lines.push(`✅ present, unique and non-blank on all ${rowList.length} rows.`);
        }
      }
      lines.push("");

      if (unchecked.length || absent.length) {
        lines.push(`### Fields`);
        if (unchecked.length) lines.push(`- in the data, checked by NO rule: ${unchecked.map((f) => `\`${f}\``).join(", ")}`);
        if (absent.length) lines.push(`- named by the schema, in NO row: ${absent.map((f) => `\`${f}\``).join(", ")}`);
        lines.push("");
      }

      lines.push(`### Next`);
      lines.push(rejected.length
        ? "A rejected row is DROPPED by the store and reported through `dropped`/`issues` — it never reaches a component. Fix the schema or the backend, not the screen."
        : "Put this schema on the STORE, not a form: `new ArrayStore(rows, { key: '" + keyField + "', schema })`. A rule enforced in one screen is not a rule — the same records arrive from a dialog, a paste and a REST response.");
      if (rowList.length >= 50) {
        lines.push("On a big response add `sample: 50` to check the first 50 rows instead of all of them — but never when the schema RENAMES or COERCES, since the unchecked tail would keep the old shape.");
      }
      lines.push("\nSee `sherpa://data-rules` for the whole contract.");

      return ok(lines.join("\n"));
    }
  );
}
