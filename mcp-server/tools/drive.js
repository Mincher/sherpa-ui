/**
 * Drive tools — the instance tier.
 *
 *   component_api  — what a caller can DO to a component (no browser needed)
 *   call_component — call a method on a LIVE element, and read the state back
 *   read_component — read a live element's properties and attributes
 *   browser_close  — end the session
 *
 * The two live tools are deliberately narrow: a named element, a named method,
 * JSON arguments. No arbitrary script crosses the boundary.
 */
import { z } from "zod/v3";
import { loadDef, loadSpec, loadComponentNames } from "../../scripts/lib/generation/data.mjs";
import { getPage, closeBrowser, browserState } from "../lib/browser.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

const DEFAULT_URL = "http://localhost:4000/test/reforged/harness.html";

/** A component's callable surface, from its spec. */
function apiOf(name) {
  // The SPEC, not the def: `specToDef` drops `$extensions`, where the methods live.
  const spec = loadSpec(name);
  if (!spec) return null;
  const ext = spec.$extensions?.sherpa ?? {};
  return {
    def: spec,
    methods: ext.methods ?? [],
    jsProps: ext.jsProps ?? [],
    events: spec.events ?? [],
    props: spec.props ?? [],
  };
}

export function register(server) {
  server.registerTool(
    "component_api",
    {
      title: "A Component's Callable Surface",
      description:
        "Everything a caller can DO to a component without a pointer: its METHODS (with signatures), its JS PROPERTIES (and whether each is readable, writable or both), the EVENTS it fires back, and its `data-*` attribute surface. Read from the component's spec, so it needs no browser and cannot drift from the code. Ask this BEFORE call_component — it is how an agent finds out what is callable at all.",
      inputSchema: {
        name: z.string().describe("Component element name, e.g. sherpa-data-grid"),
      },
    },
    async ({ name }) => {
      const api = apiOf(name);
      if (!api) {
        const avail = loadComponentNames().filter((n) => n.startsWith("sherpa-")).sort();
        return ok(`No component "${name}".\n\nAvailable: ${avail.join(", ")}`);
      }
      const { def, methods, jsProps, events, props } = api;

      const lines = [];
      lines.push(`## ${name} — what a caller can do\n`);
      if (def.description) lines.push(`${def.description}\n`);

      lines.push(`### Methods (${methods.length})\n`);
      if (methods.length) {
        for (const m of methods) {
          lines.push(`- \`${m.name}(${m.args ?? ""})\`${m.description ? ` — ${m.description}` : ""}`);
        }
      } else {
        lines.push("_None recorded._ The component is driven by its attributes and events alone.");
      }
      lines.push("");

      const readable = jsProps.filter((p) => (p.access ?? "").includes("read"));
      const writable = jsProps.filter((p) => (p.access ?? "").includes("write"));
      lines.push(`### JS properties (${jsProps.length})\n`);
      if (jsProps.length) {
        for (const p of jsProps) lines.push(`- \`${p.name}\` — ${p.access ?? "?"}`);
        if (readable.length && !writable.length) {
          lines.push("");
          lines.push("All read-only. A value with no setter is one a caller can see but not restore — fine when it is DERIVED (a count, a live File list), a parity gap when it is a CHOICE a reader made.");
        }
      } else {
        lines.push("_None recorded._");
      }
      lines.push("");

      lines.push(`### Events it fires back (${events.length})\n`);
      if (events.length) {
        for (const e of events) {
          const detail = e.detail && Object.keys(e.detail).length
            ? ` — detail: { ${Object.keys(e.detail).join(", ")} }` : "";
          lines.push(`- \`${e.name}\`${detail}`);
        }
      } else {
        lines.push("_None._");
      }
      lines.push("");

      const byKind = {};
      for (const p of props) (byKind[p.kind ?? "style"] ??= []).push(p.name);
      lines.push(`### Attribute surface (${props.length})\n`);
      for (const [kind, names] of Object.entries(byKind)) {
        lines.push(`- **${kind}** — ${names.map((n) => `\`${n}\``).join(", ")}`);
      }
      lines.push("");

      lines.push("### The rule this serves\n");
      lines.push("Anything a person can do by clicking, a caller must be able to do by calling — through the same code, not a second path. Use `call_component` to actually do it against a live page.");
      return ok(lines.join("\n"));
    }
  );

  server.registerTool(
    "call_component",
    {
      title: "Call a Method on a Live Component",
      description:
        "Call a method on a real element in a running page, then read the state back so you can see what changed. This is the parity rule made reachable: an agent is a caller with no pointer. Localhost pages only, and the arguments are JSON — no script crosses the boundary. Ask `component_api` first to learn what is callable.",
      inputSchema: {
        selector: z.string().describe('A CSS selector for the element, e.g. "sherpa-data-grid" or "#customers".'),
        method: z.string().describe("The method to call, e.g. setColumnFilter."),
        args: z.string().optional().describe('Arguments as a JSON array, e.g. `["status", ["status","eq","active"]]`. Omit for none.'),
        url: z.string().optional().describe(`The page (default ${DEFAULT_URL}). Localhost only.`),
        readBack: z.string().optional().describe('Properties to read afterwards, as a JSON array of names, e.g. `["selectedKeys"]`.'),
      },
    },
    async ({ selector, method, args, url, readBack }) => {
      let argList = [];
      let reads = [];
      if (args) {
        try { argList = JSON.parse(args); } catch (e) { return err(`args is not valid JSON: ${e.message}`); }
        if (!Array.isArray(argList)) return err("args must be a JSON ARRAY of the method's arguments.");
      }
      if (readBack) {
        try { reads = JSON.parse(readBack); } catch (e) { return err(`readBack is not valid JSON: ${e.message}`); }
        if (!Array.isArray(reads)) return err("readBack must be a JSON array of property names.");
      }

      const target = url ?? DEFAULT_URL;
      const { page, error } = await getPage(target);
      if (error) return err(error);

      let out;
      try {
        out = await page.evaluate(
          async ({ selector, method, argList, reads }) => {
            const el = document.querySelector(selector);
            if (!el) return { found: false };
            // Renders async — calling before the shadow DOM exists is a silent no-op.
            if (el.rendered) { try { await el.rendered; } catch { /* not a promise */ } }
            if (typeof el[method] !== "function") {
              const callable = [];
              for (let p = Object.getPrototypeOf(el); p && p !== HTMLElement.prototype; p = Object.getPrototypeOf(p)) {
                for (const k of Object.getOwnPropertyNames(p)) {
                  const d = Object.getOwnPropertyDescriptor(p, k);
                  if (d && typeof d.value === "function" && k !== "constructor") callable.push(k);
                }
              }
              return { found: true, noMethod: true, callable: [...new Set(callable)].sort() };
            }
            let returned, threw = null;
            try { returned = await el[method](...argList); }
            catch (e) { threw = String(e && e.message ? e.message : e); }
            // A method usually schedules a render; wait for it.
            if (el.__settled) { try { await el.__settled(); } catch { /* none */ } }
            else await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

            const state = {};
            for (const p of reads) {
              try { state[p] = JSON.parse(JSON.stringify(el[p] ?? null)); }
              catch { state[p] = String(el[p]); }
            }
            const attrs = {};
            for (const a of el.attributes) if (a.name.startsWith("data-")) attrs[a.name] = a.value;
            let ret;
            try { ret = JSON.parse(JSON.stringify(returned ?? null)); } catch { ret = String(returned); }
            return { found: true, returned: ret, threw, state, attrs, tag: el.tagName.toLowerCase() };
          },
          { selector, method, argList, reads }
        );
      } catch (e) {
        return err(`the call failed in the page: ${e.message}`);
      }

      if (!out.found) return err(`no element matches "${selector}" on ${target}.`);
      if (out.noMethod) {
        return err(`\`${selector}\` has no method "${method}".\n\nIt does have: ${out.callable.join(", ")}\n\nAsk \`component_api\` for the recorded surface with signatures.`);
      }

      const lines = [];
      lines.push(`## call_component — \`${out.tag}.${method}()\`\n`);
      lines.push(`Page: ${target}\n`);
      if (out.threw) {
        lines.push(`❌ **It threw:** ${out.threw}\n`);
      } else {
        lines.push(`✅ called with ${argList.length} argument(s)`);
        if (out.returned !== null && out.returned !== undefined) {
          lines.push("\n**Returned**\n```json");
          lines.push(JSON.stringify(out.returned, null, 2));
          lines.push("```");
        }
        lines.push("");
      }
      if (reads.length) {
        lines.push("### Read back\n```json");
        lines.push(JSON.stringify(out.state, null, 2));
        lines.push("```\n");
      }
      if (Object.keys(out.attrs).length) {
        lines.push("### Its `data-*` attributes now\n");
        for (const [k, v] of Object.entries(out.attrs)) lines.push(`- \`${k}="${v}"\``);
        lines.push("");
      }
      if (!reads.length && !out.threw) {
        lines.push("_Pass `readBack` to see a property afterwards — a host that SET something usually needs to ask what the component now holds._");
      }
      return ok(lines.join("\n"));
    }
  );

  server.registerTool(
    "read_component",
    {
      title: "Read a Live Component's State",
      description:
        "Read properties and `data-*` attributes off a real element in a running page, without calling anything. Use it to see where a screen actually is — the read-back half of the parity rule, which is the half that gets forgotten.",
      inputSchema: {
        selector: z.string().describe('A CSS selector, e.g. "sherpa-data-grid".'),
        props: z.string().optional().describe('Properties to read, as a JSON array. Omit to list what is readable.'),
        url: z.string().optional().describe(`The page (default ${DEFAULT_URL}). Localhost only.`),
      },
    },
    async ({ selector, props, url }) => {
      let wanted = null;
      if (props) {
        try { wanted = JSON.parse(props); } catch (e) { return err(`props is not valid JSON: ${e.message}`); }
        if (!Array.isArray(wanted)) return err("props must be a JSON array of property names.");
      }
      const target = url ?? DEFAULT_URL;
      const { page, error } = await getPage(target);
      if (error) return err(error);

      let out;
      try {
        out = await page.evaluate(async ({ selector, wanted }) => {
          const el = document.querySelector(selector);
          if (!el) return { found: false };
          if (el.rendered) { try { await el.rendered; } catch { /* not a promise */ } }
          const names = [];
          for (let p = Object.getPrototypeOf(el); p && p !== HTMLElement.prototype; p = Object.getPrototypeOf(p)) {
            for (const k of Object.getOwnPropertyNames(p)) {
              const d = Object.getOwnPropertyDescriptor(p, k);
              if (d && (d.get || d.set) && k !== "constructor") {
                names.push({ name: k, read: Boolean(d.get), write: Boolean(d.set) });
              }
            }
          }
          const state = {};
          for (const p of (wanted ?? [])) {
            try { state[p] = JSON.parse(JSON.stringify(el[p] ?? null)); } catch { state[p] = String(el[p]); }
          }
          const attrs = {};
          for (const a of el.attributes) attrs[a.name] = a.value;
          return { found: true, tag: el.tagName.toLowerCase(), accessors: names, state, attrs };
        }, { selector, wanted });
      } catch (e) {
        return err(`the read failed in the page: ${e.message}`);
      }
      if (!out.found) return err(`no element matches "${selector}" on ${target}.`);

      const lines = [];
      lines.push(`## read_component — \`${out.tag}\`\n`);
      lines.push(`Page: ${target}\n`);
      if (wanted?.length) {
        lines.push("### Values\n```json");
        lines.push(JSON.stringify(out.state, null, 2));
        lines.push("```\n");
      }
      const seen = new Map();
      for (const a of out.accessors) {
        const prev = seen.get(a.name) ?? { read: false, write: false };
        seen.set(a.name, { read: prev.read || a.read, write: prev.write || a.write });
      }
      lines.push(`### Accessors on the live element (${seen.size})\n`);
      for (const [n, a] of [...seen].sort()) {
        lines.push(`- \`${n}\` — ${a.read && a.write ? "read/write" : a.read ? "read-only" : "write-only"}`);
      }
      lines.push("");
      lines.push("### Attributes\n");
      for (const [k, v] of Object.entries(out.attrs)) lines.push(`- \`${k}="${v}"\``);
      if (!Object.keys(out.attrs).length) lines.push("_None._");
      return ok(lines.join("\n"));
    }
  );

  server.registerTool(
    "browser_close",
    {
      title: "Close the Driven Browser",
      description:
        "Shut the Chromium session that call_component / read_component opened. The page is kept between calls on purpose — doing something and then looking at what happened needs the same page — so close it when you are finished.",
      inputSchema: {},
    },
    async () => {
      const before = browserState();
      const wasOpen = await closeBrowser();
      return ok(wasOpen
        ? `Closed${before.url ? ` (was on ${before.url})` : ""}.`
        : "Nothing was open.");
    }
  );
}
