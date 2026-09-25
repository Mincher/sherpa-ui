/**
 * Generate tools — thin wrappers over scripts/lib/generation/*.
 *
 *   scaffold_def  — a starter def with the right shape (schemas/component.v1.json)
 *   validate_def  — run every design-system rule; returns errors + warnings
 *   compile_def   — def → { ts, html, css }
 *   token_for     — which Core token to bind for a hardcoded property=value (the meticulous rule)
 *
 * Map:
 * - register — register scaffold_def, validate_def, compile_def and token_for
 */
import { z } from "zod/v3";
import { validateDef } from "../../scripts/lib/generation/validate-def.mjs";
import { compileDef } from "../../scripts/lib/generation/compile-def.mjs";
import { tokenForValue } from "../../scripts/lib/generation/resolve.mjs";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

const CATEGORIES = ["control", "container", "content", "data", "nav", "chart"];

function parseDef(input) {
  if (input && typeof input === "object") return input;
  if (typeof input === "string") return JSON.parse(input);
  throw new Error("def must be a JSON object or a JSON string");
}

function classFor(name) {
  return "Sherpa" + name.replace(/^sherpa-/, "").split("-")
    .map((s) => (s[0] ?? "").toUpperCase() + s.slice(1)).join("");
}

/** A starter def matching schemas/component.v1.json; shape varies by category. */
function scaffold(name, category) {
  const cat = CATEGORIES.includes(category) ? category : "content";
  const isControl = cat === "control";
  const isContainer = cat === "container";

  const rootEl = isControl ? "span" : "div";
  const rootClass = isControl ? "control" : isContainer ? "surface" : "root";

  // Aliases are written WITHOUT the --sherpa- prefix.
  const tokens = isControl
    ? {
        [`${rootClass}.gap`]: "control-space-gap-sm",
        [`${rootClass}.paddingBlock`]: "control-space-padding-xs",
        [`${rootClass}.paddingInline`]: "control-space-padding-sm",
        [`${rootClass}.borderWidth`]: "control-border-width",
        [`${rootClass}.borderColor`]: { override: "status-border", fallback: "control-border-default" },
        [`${rootClass}.borderRadius`]: "core-border-rounding-base",
        [`${rootClass}.background`]: { override: "status-surface", fallback: "control-surface-default" },
        [`${rootClass}.color`]: "control-content-default",
      }
    : isContainer
    ? {
        [`${rootClass}.padding`]: "container-space-padding",
        [`${rootClass}.gap`]: "container-space-gap",
        [`${rootClass}.borderWidth`]: "container-border-width",
        [`${rootClass}.borderColor`]: "container-border-default",
        [`${rootClass}.borderRadius`]: "container-border-rounding",
        [`${rootClass}.background`]: "container-surface-default",
        [`${rootClass}.color`]: "content-primary-base",
      }
    : {
        [`${rootClass}.color`]: "content-primary-base",
      };

  const def = {
    $schema: "https://sherpa-ui.dev/schema/component-definition/v2.json",
    generated: false,
    name,
    figmaName: null,
    category: cat,
    description: `TODO: one line — what ${name} is and when to use it.`,

    anatomy: {
      root: {
        el: rootEl,
        class: rootClass,
        part: rootClass,
        figma: { node: "FRAME", layout: "HORIZONTAL", hugHeight: true },
        children: [
          {
            el: "span",
            class: "label",
            slot: "",
            figma: { node: "TEXT", prop: "label", role: "content" },
          },
        ],
      },
    },

    props: [
      ...(isControl || isContainer
        ? [{
            name: "data-status",
            type: "enum",
            values: ["info", "success", "warning", "critical", "urgent"],
            default: null,
            kind: "content",
            description: "Status colour, applied via the ancestor [data-status] cascade.",
            figma: { extends: "Status" },
          }]
        : []),
      {
        name: "data-icon-start",
        type: "boolean",
        default: false,
        kind: "visibility",
        description: "Show a leading icon.",
        figma: { boolean: "hasIcon" },
      },
    ],

    templates: ["default"],

    slots: [
      { name: "", accepts: ["content"], description: "The main content." },
    ],

    parts: [rootClass, "label"],

    nested: [],

    events: [
      {
        name: `${name.replace(/^sherpa-/, "")}-click`.replace(/--+/g, "-"),
        description: "TODO: when this fires.",
        bubbles: true,
        composed: true,
        cancelable: false,
        detail: {},
        trigger: { on: "click", node: rootClass },
      },
    ],

    overrides: {
      note: "Consumers do not edit library source. They override from outside.",
      listen: "Add an event listener; act in app code (most common).",
      cancel: "For cancelable events, call preventDefault() in the listener.",
      subclass: "Extend the class, override a handler, then define a new tag name.",
      attributes: "Set data-* / native attributes directly — the public API.",
      styling: "Restyle exposed part names via ::part(), or set public --sherpa-* tokens.",
    },

    tokens,

    figma: {
      _status: "no-figma",
      figmaName: null,
      nodeType: "COMPONENT_SET",
      built: false,
      variantAxes: [],
      booleanProps: isControl || isContainer ? ["hasIcon"] : ["hasIcon"],
      textProps: ["label"],
      instanceProps: [],
      modePins: {},
      figmaEvents: [],
      note: "TODO: set $extensions.sherpa.figmaName + category once the Figma component exists. The spec generator PRESERVES them — it cannot derive a Figma binding from code.",
    },

    _todo: [
      "Replace every TODO above.",
      "Add this row to scripts/figma-data/name-map.json (status: no-figma or figma-only).",
      `Class name will be ${classFor(name)}.`,
      "Reuse existing components for leaf roles (count → Badge, dismiss → Button) — never invent a primitive (Rule 1).",
      "Run validate_def until clean, then compile_def to scaffold the three files.",
    ],
  };

  return def;
}

export function register(server) {
  server.registerTool(
    "scaffold_def",
    {
      title: "Scaffold a Component Def",
      description:
        "Return a starter def matching schemas/component.v1.json — the right skeleton for the category (a control gets data-status + status token fallbacks; a container gets container-* tokens). Edit the TODOs, then validate_def → compile_def.",
      inputSchema: {
        name: z.string().describe("Component element name (sherpa-<kebab>, e.g. sherpa-badge)"),
        category: z.enum(["control", "container", "content", "data", "nav", "chart"])
          .describe("The component's role: control | container | content | data | nav | chart"),
      },
    },
    async ({ name, category }) => {
      try {
        if (!/^sherpa-[a-z][a-z-]*$/.test(name)) {
          return err(`name must be sherpa-<kebab> (lowercase, dashes), got "${name}"`);
        }
        const def = scaffold(name, category);
        return ok(
          `Starter def for **${name}** (category=${category}). Fill the TODOs, then run validate_def.\n\n` +
          "```json\n" + JSON.stringify(def, null, 2) + "\n```"
        );
      } catch (e) {
        return err(`scaffold_def: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "validate_def",
    {
      title: "Validate a Component Def",
      description:
        "Check a def against every design-system rule (docs/DEF-TO-FIGMA-BUILD-RULES.md): reuse existing components, tokens resolve to real ontology entries with the right role, control labels bind control-content not status-content (the Button bug), status containers alias through status, events well-formed. Returns errors (must fix) + warnings.",
      inputSchema: {
        def: z.string().describe("The component def as a JSON string (the shape loadDef returns from <name>.component.yaml)"),
      },
    },
    async ({ def: defInput }) => {
      try {
        const def = parseDef(defInput);
        const { ok: passed, errors, warnings } = validateDef(def);
        const fmt = (o) => `  [${o.code}] ${o.msg}${o.where ? `  (@ ${o.where})` : ""}`;
        let out = `## validate_def — ${def.name ?? "(unnamed)"}\n\n`;
        out += passed
          ? `✅ **PASS** — no errors.`
          : `❌ **FAIL** — ${errors.length} error(s) must be fixed.`;
        out += `\n\n`;
        if (errors.length) out += `### Errors (${errors.length})\n` + errors.map(fmt).join("\n") + "\n\n";
        if (warnings.length) out += `### Warnings (${warnings.length})\n` + warnings.map(fmt).join("\n") + "\n\n";
        if (!errors.length && !warnings.length) out += `No issues.\n`;
        return ok(out.trimEnd());
      } catch (e) {
        return err(`validate_def: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "compile_def",
    {
      title: "Compile a Def to Code",
      description:
        "Compile a def to its three component files (TS / HTML / CSS). Needs an `anatomy` block. The compiler is a scaffolder, not a replicator — hand-finish the CSS after (hex fallbacks, edge-case rules).",
      inputSchema: {
        def: z.string().describe("The component def as a JSON string (must carry an `anatomy` block)"),
      },
    },
    async ({ def: defInput }) => {
      try {
        const def = parseDef(defInput);
        if (!def.name) return err("def has no `name`");
        if (!def.anatomy?.root && !def.anatomy?.roots && !def.anatomy?.byTemplate) return err("def has no anatomy (`root`, `roots` or `byTemplate`) — compile_def needs one. Run scaffold_def for the shape.");
        const { ts, html, css } = compileDef(def);
        const name = def.name;
        const out =
          `## compile_def — ${name}\n\n` +
          `### ${name}.ts\n\`\`\`ts\n${ts}\`\`\`\n\n` +
          `### ${name}.html\n\`\`\`html\n${html}\`\`\`\n\n` +
          `### ${name}.css\n\`\`\`css\n${css}\`\`\`\n`;
        return ok(out);
      } catch (e) {
        return err(`compile_def: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "token_for",
    {
      title: "Which Token for This Value?",
      description:
        "The meticulous rule (Rule 9): given a hardcoded Figma/CSS property and its resolved pixel value, return the Core token that resolves to it — never leave a raw number where a token exists. Off-scale values (radius 1, radius 5) return no token (a scale gap, not a violation). Properties: itemSpacing, paddingLeft/Right/Top/Bottom, top/bottomLeft/RightRadius, stroke*Weight.",
      inputSchema: {
        property: z.string().describe("Figma property (e.g. paddingLeft, itemSpacing, topLeftRadius, strokeTopWeight)"),
        value: z.number().describe("The resolved pixel value (e.g. 12)"),
      },
    },
    async ({ property, value }) => {
      try {
        const token = tokenForValue(property, value);
        if (token) {
          return ok(`\`${property} = ${value}\` → bind **\`${token}\`** (the Core token that resolves to ${value}px).\nPrefer the component's own scoped token if one exists (e.g. Button::button-space/*, Container::container-space/*).`);
        }
        return ok(`\`${property} = ${value}\` → **no token**. Either the property isn't geometry-scoped, or ${value}px is off-scale (a scale gap or intentional — leave it raw; not a violation).`);
      } catch (e) {
        return err(`token_for: ${e.message}`);
      }
    }
  );
}
