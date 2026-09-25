/**
 * Data tools — "will my data work", answered by running `sherpa-ui/data` itself.
 *
 *   run_query       — drive a real headless DataSource and show what a component gets
 *   import_schema   — a backend's JSON Schema / OpenAPI → a Sherpa schema
 *   scaffold_schema — sample rows → a draft schema, every inference MARKED
 *   validate_schema — run a schema over sample rows: mapped / rejected / WHY
 *
 * Thin wrappers only — the same `validate()` a Store runs. Never re-implement a
 * check here; a second implementation eventually disagrees.
 *
 * Map:
 * - register — register run_query and the schema tools, over sherpa-ui/data
 */
import { z } from "zod/v3";
import { loadDataLayer, dataLayerError } from "../lib/data-layer.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

/**
 * `"required"` or `{ "min": 0 }` → rule functions. Rules cannot cross a tool
 * boundary, so they arrive named. Anything unrecognised is REPORTED, never
 * dropped — a dropped rule makes the tool claim a check it never ran.
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

/* ══ schema inference ════════════════════════════════════════════════════════
 * A draft schema goes onto a Store where it DROPS real rows, so every proposal
 * carries its evidence and nothing is inferred without it. Never inferred:
 * `email`/`url` from a field name, `min`/`max` from an observed range,
 * `required` from mere presence (except the key).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAbsent(v) { return v === undefined || v === null || v === ''; }

/** Infer one field's rules from every value the samples show for it. */
function inferField(field, values, rowCount, keyField) {
  const present = values.filter((v) => !isAbsent(v));
  const rules = [];
  const notes = [];

  if (!present.length) {
    return { rules: [], notes: [`every sample value is empty — nothing to infer`], confident: false };
  }

  // REQUIRED: key only. "Present in every sample row" is not "never absent".
  const alwaysPresent = present.length === rowCount;
  if (field === keyField) {
    rules.push('required');
    notes.push(alwaysPresent
      ? `the key — blank or duplicate keys are what byKey/update/remove disagree about`
      : `the key, but ${rowCount - present.length} sample row(s) are already missing it`);
  } else if (alwaysPresent) {
    notes.push(`present in all ${rowCount} sample rows — add "required" only if the backend guarantees it`);
  }

  // `"42"` counts — `number()` accepts a numeric string.
  const allNumeric = present.every((v) => typeof v === 'number'
    || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))));
  const anyString = present.some((v) => typeof v === 'string');
  if (allNumeric) {
    rules.push('number');
    notes.push(anyString
      ? `all ${present.length} values are numeric, some as strings — number() accepts both`
      : `all ${present.length} values are numbers`);
    const nums = present.map(Number);
    notes.push(`observed range ${Math.min(...nums)}..${Math.max(...nums)} — NOT proposed as min/max; a sample cannot bound a backend`);
  }

  // From the VALUES, never the field name, and only on unanimity.
  if (!allNumeric && present.every((v) => typeof v === 'string' && EMAIL_RE.test(v))) {
    rules.push('email');
    notes.push(`all ${present.length} values look like email addresses`);
  } else if (!allNumeric && present.every((v) => typeof v === 'string' && /^https?:\/\//i.test(v))) {
    rules.push('url');
    notes.push(`all ${present.length} values are http(s) URLs`);
  }

  // Needs repetition — N distinct values in N rows is just N values.
  const distinct = [...new Set(present.map((v) => String(v)))];
  if (!allNumeric && distinct.length > 1 && distinct.length <= 6 && present.length >= distinct.length * 2) {
    rules.push({ oneOf: distinct });
    notes.push(`only ${distinct.length} distinct values across ${present.length} — looks like an enum, CONFIRM it is closed`);
  }

  const types = [...new Set(present.map((v) => (Array.isArray(v) ? 'array' : typeof v)))];
  if (types.length > 1) notes.push(`⚠️ MIXED types in the sample: ${types.join(', ')}`);
  if (types.includes('object') || types.includes('array')) {
    notes.push(`nested — reach it with a dotted path (\`${field}.someKey\`) anywhere a field name goes`);
  }

  return { rules, notes, confident: rules.length > 0 };
}

/* ══ JSON Schema / OpenAPI import ════════════════════════════════════════════
 * Eight keywords map onto a Sherpa rule; ten do not. Every unsupported keyword
 * is reported by name and field — one quietly ignored (`$ref`, `allOf`) emits a
 * schema that looks faithful, passes every row, and enforces half the spec.
 */
const JSON_SCHEMA_MAPPED = {
  'type: number/integer': 'number',
  'required': 'required',
  'minimum': 'min',
  'maximum': 'max',
  'pattern': 'pattern',
  'enum': 'oneOf',
  'format: email': 'email',
  'format: uri/url': 'url',
};

/** `#/components/schemas/Customer` → the node it points at, or null. */
function resolveRef(doc, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  let node = doc;
  for (const raw of ref.slice(2).split('/')) {
    const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!node || typeof node !== 'object') return null;
    node = node[seg];
  }
  return node ?? null;
}

/**
 * Find the ROW schema: a bare object, an array's `items`, or an OpenAPI path's
 * 200 response. `via` says where it looked, so a wrong pick is never silent.
 */
function findRowSchema(doc, pathHint) {
  const unwrapArray = (s, via) =>
    s && s.type === 'array' && s.items ? { schema: s.items, via: `${via} → items` } : { schema: s, via };

  // A whole OpenAPI document?
  if (doc && doc.paths && typeof doc.paths === 'object') {
    const paths = Object.keys(doc.paths);
    const chosen = pathHint && paths.includes(pathHint) ? pathHint : paths[0];
    if (!chosen) return { schema: null, via: 'openapi document has no paths', options: [] };
    const get = doc.paths[chosen]?.get;
    const content = get?.responses?.['200']?.content ?? get?.responses?.default?.content;
    const media = content && (content['application/json'] ?? Object.values(content)[0]);
    let s = media?.schema;
    if (s?.$ref) s = resolveRef(doc, s.$ref);
    if (!s) return { schema: null, via: `no 200 JSON response schema on GET ${chosen}`, options: paths };
    const out = unwrapArray(s, `GET ${chosen} → 200 → application/json`);
    if (out.schema?.$ref) return { schema: resolveRef(doc, out.schema.$ref), via: `${out.via} → ${out.schema.$ref}`, options: paths };
    return { ...out, options: paths };
  }

  // A bare schema, possibly an array of rows.
  if (doc && doc.$ref) {
    const r = resolveRef(doc, doc.$ref);
    if (r) return unwrapArray(r, `$ref ${doc.$ref}`);
  }
  return unwrapArray(doc, 'the document itself');
}

/** One property's JSON Schema node → Sherpa rules + what could not be carried. */
function rulesFromProperty(doc, name, node, isRequired, unsupported) {
  const rules = [];
  const notes = [];
  if (!node || typeof node !== 'object') {
    unsupported.push(`\`${name}\`: not an object schema`);
    return { rules, notes };
  }

  let s = node;
  if (s.$ref) {
    const target = resolveRef(doc, s.$ref);
    // `rules()` maps one field to rules — it cannot validate a sub-object too.
    unsupported.push(`\`${name}\`: \`$ref\` → \`${s.$ref}\`${target?.type === 'object' ? ' (a nested object — reach its values with a dotted path, e.g. `' + name + '.city`)' : ''}`);
    return { rules, notes };
  }
  for (const kw of ['allOf', 'anyOf', 'oneOf', 'not']) {
    if (s[kw]) { unsupported.push(`\`${name}\`: \`${kw}\` composition has no Sherpa equivalent`); return { rules, notes }; }
  }

  if (isRequired) { rules.push('required'); notes.push('listed in the schema\'s `required`'); }

  const type = Array.isArray(s.type) ? s.type.find((t) => t !== 'null') : s.type;
  if (Array.isArray(s.type) && s.type.includes('null')) notes.push('nullable in the spec — Sherpa rules skip an absent value, so this needs no rule');

  if (type === 'number' || type === 'integer') {
    rules.push('number');
    notes.push(`\`type: ${type}\``);
  }
  if (type === 'object') {
    unsupported.push(`\`${name}\`: a nested object — reach its values with a dotted path (\`${name}.someKey\`)`);
  }
  if (type === 'array') {
    unsupported.push(`\`${name}\`: an array — Sherpa rules validate one value, not each item`);
  }

  if (s.format === 'email') { rules.push('email'); notes.push('`format: email`'); }
  else if (s.format === 'uri' || s.format === 'url') { rules.push('url'); notes.push(`\`format: ${s.format}\``); }
  else if (s.format) unsupported.push(`\`${name}\`: \`format: ${s.format}\` has no Sherpa rule`);

  if (Array.isArray(s.enum) && s.enum.length) { rules.push({ oneOf: s.enum }); notes.push(`\`enum\` of ${s.enum.length}`); }
  if (typeof s.minimum === 'number') { rules.push({ min: s.minimum }); notes.push(`\`minimum: ${s.minimum}\` — from the SPEC, not a sample`); }
  if (typeof s.maximum === 'number') { rules.push({ max: s.maximum }); notes.push(`\`maximum: ${s.maximum}\` — from the SPEC, not a sample`); }
  if (typeof s.pattern === 'string') { rules.push({ pattern: s.pattern }); notes.push('`pattern`'); }

  if (typeof s.minLength === 'number') unsupported.push(`\`${name}\`: \`minLength: ${s.minLength}\` — no length rule; express it as a \`pattern\``);
  if (typeof s.maxLength === 'number') unsupported.push(`\`${name}\`: \`maxLength: ${s.maxLength}\` — no length rule; express it as a \`pattern\``);
  if (s.default !== undefined) unsupported.push(`\`${name}\`: \`default\` — a schema can default on the way in, but \`rules()\` does not`);
  if (typeof s.exclusiveMinimum === 'number') unsupported.push(`\`${name}\`: \`exclusiveMinimum\` — \`min\` is inclusive`);
  if (typeof s.exclusiveMaximum === 'number') unsupported.push(`\`${name}\`: \`exclusiveMaximum\` — \`max\` is inclusive`);

  return { rules, notes };
}

export function register(server) {
  // ── run_query — actually RUN it, headless (N4) ──
  server.registerTool(
    "run_query",
    {
      title: "Run a Query Against Sample Rows",
      description:
        "Build a real ArrayStore + DataSource over sample rows, apply a query, and show exactly what a bound component would receive — rows, `total` before paging, and the groups if grouped. This is the real data layer running in Node, not a simulation, so `[field, op, value]` filters, dotted paths, sorting, search and paging behave here precisely as they will in the browser. Use it to check a filter grammar before wiring it, or to see why a grid is empty.",
      inputSchema: {
        rows: z.string().describe("The records, as a JSON array of plain objects."),
        filter: z
          .string()
          .optional()
          .describe('A filter as JSON: `["status","eq","active"]`, or `["and",["health","lt",60],["tickets","gt",2]]`. Operators: eq ne lt lte gt gte contains notcontains startswith endswith in notin between.'),
        sort: z
          .string()
          .optional()
          .describe('Sort as JSON: `[{"field":"spend","direction":"desc"}]`.'),
        search: z.string().optional().describe("Free-text search term."),
        searchFields: z.string().optional().describe('Which fields the search looks in, as a JSON array: `["name","email"]`.'),
        group: z.string().optional().describe("Group by this field."),
        pageSize: z.number().optional().describe("Rows per page (default 25)."),
        page: z.number().optional().describe("1-based page number (default 1)."),
        key: z.string().optional().describe('The identity field (default "id").'),
        aggregateBy: z
          .string()
          .optional()
          .describe(
            'Also show what a CHART would draw: group the matching rows by this field and reduce each group to a number. Returns the `ChartDatum[]` a bar chart, a donut or a legend takes — `{label, value, colorIndex}`. Runs over every matching row, NOT just the current page, because a chart summarises the whole result.',
          ),
        aggregate: z
          .enum(["count", "sum", "mean", "min", "max"])
          .optional()
          .describe('How each group becomes a number (default "count"). Anything but `count` needs `aggregateField`.'),
        aggregateField: z
          .string()
          .optional()
          .describe('The numeric field to sum/average/etc. Required unless the aggregate is `count`.'),
      },
    },
    async (args) => {
      const dl = await loadDataLayer();
      if (!dl) return err(dataLayerError());

      let rowList;
      try { rowList = JSON.parse(args.rows); } catch (e) { return err(`rows is not valid JSON: ${e.message}`); }
      if (!Array.isArray(rowList)) return err("rows must be a JSON array of objects.");
      if (!rowList.length) return err("rows is empty — pass at least one record.");

      /* CHECK THE OPERATORS FIRST. `matchesFilter`'s switch has no `default`,
         so an unknown op rejects EVERY row — a silent empty grid that reads as
         missing data. Catch it here until the layer throws. */
      const OPS = new Set(['eq','ne','lt','lte','gt','gte','contains','notcontains',
        'startswith','endswith','in','notin','between']);
      const badOps = [];
      const walkOps = (node) => {
        if (!Array.isArray(node)) return;
        if (typeof node[0] === 'string' && ['and','or','not'].includes(node[0].toLowerCase())) {
          node.slice(1).forEach(walkOps);
          return;
        }
        if (node.length === 3 && typeof node[1] === 'string' && !OPS.has(node[1])) badOps.push(node[1]);
        else node.forEach(walkOps);
      };

      const parsed = {};
      for (const f of ["filter", "sort", "searchFields"]) {
        if (args[f] === undefined || args[f] === "") continue;
        try { parsed[f] = JSON.parse(args[f]); }
        catch (e) { return err(`${f} is not valid JSON: ${e.message}`); }
      }

      if (parsed.filter) {
        walkOps(parsed.filter);
        if (badOps.length) {
          return err(`unknown filter operator(s): ${[...new Set(badOps)].map((o) => `"${o}"`).join(", ")}.\n\n`
            + `An unknown operator matches NOTHING — every row is rejected and the grid looks empty, which reads as missing data.\n\n`
            + `The operators, in full: ${[...OPS].join(" ")}. They are DevExtreme's names deliberately — a vocabulary a backend author has probably met.`);
        }
      }

      const keyField = args.key ?? "id";
      const pageSize = args.pageSize ?? 25;
      const page = Math.max(1, args.page ?? 1);
      let sortNote = null;
      let actualPage = page;

      let source, result, totalPages;
      try {
        const store = new dl.ArrayStore(rowList, { key: keyField });
        // `searchFields` is a CONSTRUCTOR option, not a setter.
        source = new dl.DataSource({ store, pageSize, searchFields: parsed.searchFields });
        // Set the query the way a host does, then load ONCE — the real path.
        if (parsed.filter) source.setFilter(parsed.filter);
        if (parsed.sort) {
          // setSort takes (field, direction), NOT a SortSpec array.
          const first = Array.isArray(parsed.sort) ? parsed.sort[0] : parsed.sort;
          if (first) source.setSort(first.field ?? null, first.direction ?? 'asc');
          if (Array.isArray(parsed.sort) && parsed.sort.length > 1) {
            sortNote = `only the FIRST sort was applied — \`setSort\` takes one field`;
          }
        }
        if (args.search) source.setSearch(args.search);
        if (args.group) source.setGroup(args.group);
        await source.load();
        /* PAGE COMES AFTER THE LOAD. `setPage` before the first `load()` is
           silently discarded — the page is a position in a result that does not
           exist yet. `setPage` runs its own load, so await the settle. */
        if (page > 1) {
          source.setPage(page);
          await new Promise((r) => setTimeout(r, 0));
        }
        result = source.result;
        totalPages = source.totalPages;
        // READ THE PAGE BACK. Page 9 of 2 does not fail — the source resets to
        // page 1, so the REQUESTED page would print over the wrong rows.
        actualPage = source.state?.page ?? page;
      } catch (e) {
        return err(`the query failed: ${e.message}\n\nThe grammar is \`[field, op, value]\` — a filter is DATA, not a predicate, so it can be sent to a backend. See \`sherpa://data-rules\`.`);
      }

      const rows = result.rows ?? [];
      const total = result.total ?? 0;
      const pages = totalPages ?? 1;   // the source's own count, never recomputed

      const lines = [];
      lines.push(`## run_query — ${rows.length} row(s) of ${total}\n`);
      lines.push(`- **total** ${total} — the count BEFORE paging, which is the number a pager needs to say "page ${actualPage} of ${pages || 1}"`);
      lines.push(`- **page** ${actualPage} of ${pages || 1}, ${pageSize} per page`);
      if (actualPage !== page) lines.push(`- ⚠️ page ${page} was asked for; there ${pages === 1 ? "is only 1 page" : `are only ${pages}`}, so the source reset to page ${actualPage}`);
      if (total !== rowList.length) lines.push(`- narrowed from ${rowList.length} input row(s) by the query`);
      if (sortNote) lines.push(`- ⚠️ ${sortNote}`);
      if (result.dropped) lines.push(`- ⚠️ **${result.dropped} row(s) DROPPED** by a schema — see \`issues\``);
      lines.push("");

      if (!rows.length) {
        lines.push("### No rows came back\n");
        lines.push(total
          ? `${total} row(s) MATCH but none are on page ${actualPage} — there ${pages === 1 ? "is 1 page" : `are ${pages} pages`}.`
          : "Nothing matched. Check the filter's VALUE type: `['health','lt','60']` compares a string, `['health','lt',60]` a number.");
        lines.push("");
      } else {
        lines.push("### What a bound component receives\n");
        lines.push("```json");
        lines.push(JSON.stringify(rows.slice(0, 10), null, 2));
        lines.push("```");
        if (rows.length > 10) lines.push(`_…${rows.length - 10} more on this page_`);
        lines.push("");
      }

      /* Over every MATCHING row, not the page: a chart summarises the whole
         result. `source.rows` is the page, so re-run the query unpaged. */
      if (args.aggregateBy) {
        const kind = args.aggregate ?? "count";
        if (kind !== "count" && !args.aggregateField) {
          return err(`aggregate "${kind}" needs \`aggregateField\` — the numeric field to ${kind}. Only \`count\` works without one.`);
        }
        let data;
        try {
          const all = await new dl.ArrayStore(rowList, { key: keyField }).load({
            ...(parsed.filter ? { filter: parsed.filter } : {}),
            ...(args.search ? { search: args.search } : {}),
            ...(parsed.searchFields ? { searchFields: parsed.searchFields } : {}),
          });
          data = dl.aggregateBy(all.rows ?? [], args.aggregateBy, kind, args.aggregateField);
        } catch (e) {
          return err(`the aggregation failed: ${e.message}`);
        }

        lines.push(`### What a chart would draw — \`${kind}\` by \`${args.aggregateBy}\`\n`);
        lines.push("```json");
        lines.push(JSON.stringify(data, null, 2));
        lines.push("```");
        lines.push("");
        lines.push(`This is \`ChartDatum[]\` — the one shape a bar, a donut slice and a legend row all take. Hand it straight to \`populate()\`.`);
        lines.push("");
        lines.push(`\`colorIndex\` is 1-based and follows the order above. Pass an \`order\` to \`aggregateBy\` in code to pin it, or a category changes colour when only its RANK moves.`);
        if (kind === "mean") {
          lines.push("");
          lines.push(`The mean is NOT rounded. Rounding is a presentation decision — doing it in the aggregation is what made a gauge's tooltip disagree with its own label.`);
        }
        lines.push("");
      }

      if (args.group && result.groups) {
        const g = result.groups;
        lines.push(`### Grouped by \`${args.group}\`\n`);
        const entries = Array.isArray(g) ? g : Object.entries(g).map(([k, v]) => ({ key: k, items: v }));
        for (const e of entries.slice(0, 12)) {
          const k = e.key ?? e[0];
          const n = (e.items ?? e.rows ?? e[1] ?? []).length;
          lines.push(`- \`${String(k)}\` — ${n} row(s)`);
        }
        if (entries.length > 12) lines.push(`- …${entries.length - 12} more groups`);
        lines.push("");
      }

      lines.push("### The query that ran\n");
      lines.push("```js");
      lines.push(`const store  = new ArrayStore(rows, { key: '${keyField}' });`);
      lines.push(`const source = new DataSource({ store, pageSize: ${pageSize} });`);
      if (parsed.filter) lines.push(`source.setFilter(${JSON.stringify(parsed.filter)});`);
      if (parsed.sort) {
        // Echo the call that ACTUALLY ran, not the argument as it arrived.
        const f = Array.isArray(parsed.sort) ? parsed.sort[0] : parsed.sort;
        lines.push(`source.setSort(${JSON.stringify(f?.field ?? null)}, ${JSON.stringify(f?.direction ?? 'asc')});`);
      }
      if (args.search) lines.push(`source.setSearch(${JSON.stringify(args.search)}${parsed.searchFields ? `, ${JSON.stringify(parsed.searchFields)}` : ""});`);
      if (args.group) lines.push(`source.setGroup(${JSON.stringify(args.group)});`);
      if (actualPage > 1) lines.push(`source.setPage(${actualPage});`);
      lines.push(`await source.load();   // source.rows, source.total`);
      lines.push("```\n");
      lines.push("This is the REAL data layer running in Node — the same code the browser runs, so what you see here is what a bound component gets.");
      lines.push("\nSee `sherpa://data-rules` for the filter grammar and the Store contract.");

      return ok(lines.join("\n"));
    }
  );

  // ── import_schema — read the backend's OWN description (M4) ──
  server.registerTool(
    "import_schema",
    {
      title: "Import a JSON Schema or OpenAPI Document",
      description:
        "Turn a backend's OWN description of its rows into a Sherpa schema — strictly better than inferring from a sample, because a spec says what the backend PROMISES rather than what it happened to send. Accepts a bare JSON Schema, an array schema, or a whole OpenAPI document (it finds the row under a path's 200 JSON response and follows $ref). Eight keywords map onto a rule: type:number/integer, required, minimum, maximum, pattern, enum, format:email, format:uri. Everything else — $ref, allOf/anyOf/oneOf, nested objects, arrays, minLength/maxLength, default, exclusive bounds — is reported BY NAME AND FIELD rather than dropped, because a converter that quietly ignores half a spec emits a schema that looks faithful and is not.",
      inputSchema: {
        document: z
          .string()
          .describe("The JSON Schema or OpenAPI document, as JSON."),
        path: z
          .string()
          .optional()
          .describe("For an OpenAPI document with several paths: which one holds the rows (e.g. \"/customers\"). Defaults to the first path."),
        key: z
          .string()
          .optional()
          .describe("The identity field (default \"id\")."),
      },
    },
    async ({ document, path, key }) => {
      const dl = await loadDataLayer();
      if (!dl) return err(dataLayerError());

      let doc;
      try { doc = JSON.parse(document); } catch (e) { return err(`document is not valid JSON: ${e.message}`); }
      if (!doc || typeof doc !== "object") return err("document must be a JSON object.");

      const { schema: row, via, options } = findRowSchema(doc, path);
      if (!row || typeof row !== "object") {
        const where = options?.length ? `\n\nPaths in this document: ${options.map((p) => `\`${p}\``).join(", ")} — name one with \`path\`.` : "";
        return err(`Could not find a row schema (${via}).${where}`);
      }
      const props = row.properties;
      if (!props || typeof props !== "object") {
        return err(`The row schema at "${via}" has no \`properties\` — it describes ${row.type ? `a \`${row.type}\`` : "something"}, not a record. A Sherpa row is a plain object.`);
      }

      const required = new Set(Array.isArray(row.required) ? row.required : []);
      const keyField = key ?? "id";
      const unsupported = [];
      const schema = {};
      const evidence = [];
      for (const [name, node] of Object.entries(props)) {
        const { rules, notes } = rulesFromProperty(doc, name, node, required.has(name), unsupported);
        if (rules.length) schema[name] = rules;
        evidence.push({ name, rules, notes });
      }

      const lines = [];
      lines.push(`## import_schema — ${Object.keys(props).length} field(s)\n`);
      lines.push(`Read from: ${via}\n`);
      lines.push("### The schema\n");
      lines.push("```json");
      lines.push(JSON.stringify(schema, null, 2));
      lines.push("```\n");

      lines.push("### Where each rule came from\n");
      for (const e of evidence) {
        lines.push(e.rules.length
          ? `**\`${e.name}\`** → ${e.rules.map((r) => (typeof r === "string" ? r : Object.keys(r)[0])).join(", ")}`
          : `**\`${e.name}\`** → no rule`);
        for (const n of e.notes) lines.push(`  - ${n}`);
      }
      lines.push("");

      if (unsupported.length) {
        lines.push(`### ⚠️ ${unsupported.length} thing(s) the spec says that this schema does NOT enforce\n`);
        for (const u of unsupported) lines.push(`- ${u}`);
        lines.push("");
        lines.push("These are listed so you can decide, not so you can ignore them. A `custom(fn)` rule covers anything here that matters; leaving one out means the backend promises something your schema will not catch.");
        lines.push("");
      } else {
        lines.push("### ✅ Everything the spec says is enforced\n");
        lines.push("No keyword in this document lacks a Sherpa rule.\n");
      }

      if (!required.has(keyField)) {
        lines.push(`### The key (\`${keyField}\`)\n`);
        lines.push(props[keyField]
          ? `⚠️ \`${keyField}\` is a property but is NOT in the spec's \`required\` list. Sherpa needs one identity field per record — add \`"required"\` to it, or name the real key with \`key\`.`
          : `❌ the spec has no \`${keyField}\` property. Name the real identity field with \`key\`, or the store cannot find a record.`);
        lines.push("");
      }

      lines.push("### Next\n");
      lines.push("1. Run it against a real page of rows with `validate_schema` — a spec describes the intent, and backends drift from their own specs.");
      lines.push(`2. Put it on the STORE: \`new ArrayStore(rows, { key: '${keyField}', schema })\`.`);
      lines.push("\nSee `sherpa://data-rules` for the whole contract.");

      return ok(lines.join("\n"));
    }
  );

  // ── scaffold_schema — sample rows → a DRAFT, every inference marked ──
  server.registerTool(
    "scaffold_schema",
    {
      title: "Draft a Schema From Sample Rows",
      description:
        "Read sample rows and propose a Sherpa schema, with the EVIDENCE for every rule and an explicit list of what was NOT inferred. A draft, not an answer: it goes on a Store where it will drop real rows, so each proposal says what it saw. Deliberately conservative — `email`/`url` come from the VALUES and never from a field name, `min`/`max` are never invented from an observed range, and `required` is proposed only for the key. Feed the result to `validate_schema` against a different page of rows to check it.",
      inputSchema: {
        rows: z
          .string()
          .describe("Sample rows as a JSON array of plain objects — a real page of a real response. More rows means better evidence."),
        key: z
          .string()
          .optional()
          .describe("The identity field (default \"id\")."),
      },
    },
    async ({ rows, key }) => {
      const dl = await loadDataLayer();
      if (!dl) return err(dataLayerError());

      let rowList;
      try { rowList = JSON.parse(rows); } catch (e) { return err(`rows is not valid JSON: ${e.message}`); }
      if (!Array.isArray(rowList)) return err("rows must be a JSON array of objects.");
      if (!rowList.length) return err("rows is empty — pass at least one sample row.");
      if (rowList.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
        return err("every row must be a plain object — that is what a Sherpa record is.");
      }

      const keyField = key ?? "id";
      const fields = [];
      for (const r of rowList) for (const f of Object.keys(r)) if (!fields.includes(f)) fields.push(f);
      if (!fields.length) return err("the sample rows have no fields.");

      const schema = {};
      const evidence = [];
      for (const f of fields) {
        const values = rowList.map((r) => r[f]);
        const { rules, notes } = inferField(f, values, rowList.length, keyField);
        if (rules.length) schema[f] = rules;
        const missing = values.filter(isAbsent).length;
        evidence.push({ field: f, rules, notes, missing });
      }

      const lines = [];
      lines.push(`## scaffold_schema — ${fields.length} field(s) from ${rowList.length} row(s)\n`);
      lines.push("### The draft\n");
      lines.push("```json");
      lines.push(JSON.stringify(schema, null, 2));
      lines.push("```\n");

      lines.push("### Why each rule\n");
      for (const e of evidence) {
        const head = e.rules.length
          ? `**\`${e.field}\`** → ${e.rules.map((r) => (typeof r === "string" ? r : Object.keys(r)[0])).join(", ")}`
          : `**\`${e.field}\`** → no rule proposed`;
        lines.push(head + (e.missing ? `  _(${e.missing} of ${rowList.length} rows empty)_` : ""));
        for (const n of e.notes) lines.push(`  - ${n}`);
      }
      lines.push("");

      lines.push("### What was NOT inferred, deliberately\n");
      lines.push("- **`min`/`max` from an observed range.** Ten rows between 0 and 100 say nothing about the eleventh. A bound invented from a sample is a rule your backend never agreed to.");
      lines.push("- **`email`/`url` from a field NAME.** A field called `email` holding `\"n/a\"` would start dropping rows the backend considers fine. Only unanimous VALUES argue for a format rule.");
      lines.push("- **`required` from a field being present.** Present in every sample row is not the same as never absent — except for the key, where blank is a defect by definition.");
      lines.push("- **Renames, coercions and defaults.** A schema can do all three on the way in, but only you know the target shape.");
      lines.push("");

      lines.push("### Next\n");
      lines.push(`1. Check the draft against a DIFFERENT page of rows: \`validate_schema\` with this schema. A draft that only fits the rows it was drawn from has proved nothing.`);
      lines.push(`2. Put it on the STORE, not a form: \`new ArrayStore(rows, { key: '${keyField}', schema })\`. The same records arrive from a dialog, a paste and a REST response.`);
      lines.push("\nSee `sherpa://data-rules` for the whole contract.");

      return ok(lines.join("\n"));
    }
  );

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

      // Separate from the schema: a rule sees one VALUE, never the other rows.
      // Duplicate and blank keys are only visible across the set.
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

      // Not an error — but a field the schema forgot is the usual cause of
      // "the grid shows blanks".
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
