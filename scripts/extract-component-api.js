#!/usr/bin/env node

/*
 * Extracts detailed public API from all sherpa-* components
 * and generates COMPONENT-API.md reference document
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workspaceRoot = path.resolve(__dirname, "..");
const componentsRoot = path.join(workspaceRoot, "components");
const categories = ["core", "data-viz", "layout", "toolbars"];

const LIFECYCLE_METHODS = new Set([
  "constructor",
  "connectedCallback",
  "disconnectedCallback",
  "attributeChangedCallback",
  "adoptedCallback",
  "observedAttributes"
]);

const FALSE_POSITIVES = new Set([
  "if", "for", "while", "switch", "catch", "return", "throw", "case", "default"
]);

const CATEGORY_LABELS = {
  "core": "Core UI",
  "data-viz": "Data Visualization",
  "layout": "Layout & View",
  "toolbars": "Toolbars"
};

function listComponentDirs(categoryPath) {
  if (!fs.existsSync(categoryPath)) return [];
  return fs
    .readdirSync(categoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("sherpa-"))
    .map((entry) => path.join(categoryPath, entry.name));
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function parseObservedAttributes(jsText) {
  const match = jsText.match(/static\s+get\s+observedAttributes\s*\(\s*\)\s*\{\s*return\s*\[([\s\S]*?)\]\s*\}/);
  if (!match) return [];
  
  const attrs = match[1]
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^["']|["']$/g, ""))
    .filter(s => s && s.length < 50); // Filter out likely false positives (SVG attrs with long strings)
  
  return attrs;
}

function parsePublicMethods(jsText) {
  const methods = new Map();
  
  // Find all public methods (not starting with # and not lifecycle)
  const methodRegex = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm;
  
  let match;
  while ((match = methodRegex.exec(jsText)) !== null) {
    const methodName = match[1];
    
    // Skip private methods, lifecycle, keywords, and underscore-prefixed
    if (methodName.startsWith("#") || 
        methodName.startsWith("_") ||
        LIFECYCLE_METHODS.has(methodName) ||
        FALSE_POSITIVES.has(methodName)) {
      continue;
    }
    
    // Try to find JSDoc above method
    const methodPos = match.index;
    const beforeMethod = jsText.substring(Math.max(0, methodPos - 500), methodPos);
    const jsdocMatch = beforeMethod.match(/\/\*\*([\s\S]*?)\*\//);
    
    let description = "TODO";
    if (jsdocMatch) {
      const docText = jsdocMatch[1];
      const descMatch = docText.match(/\*\s+([^@\n][^\n]*)/);
      if (descMatch) {
        description = descMatch[1].trim();
      }
    }
    
    methods.set(methodName, { name: methodName, description });
  }
  
  return Array.from(methods.values());
}

function parsePublicProperties(jsText) {
  const props = new Map();
  
  // Find getter/setter pairs
  const getterRegex = /get\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(\s*\)\s*\{/g;
  const setterRegex = /set\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/g;
  
  let match;
  while ((match = getterRegex.exec(jsText)) !== null) {
    const propName = match[1];
    // Skip private, lifecycle, and keywords
    if (!propName.startsWith("#") && 
        !LIFECYCLE_METHODS.has(propName) &&
        !propName.startsWith("_") &&
        !FALSE_POSITIVES.has(propName)) {
      props.set(propName, { name: propName, getter: true, setter: false, description: "TODO" });
    }
  }
  
  while ((match = setterRegex.exec(jsText)) !== null) {
    const propName = match[1];
    // Skip private, lifecycle, and keywords
    if (!propName.startsWith("#") && 
        !LIFECYCLE_METHODS.has(propName) &&
        !propName.startsWith("_") &&
        !FALSE_POSITIVES.has(propName)) {
      if (props.has(propName)) {
        props.get(propName).setter = true;
      } else {
        props.set(propName, { name: propName, getter: false, setter: true, description: "TODO" });
      }
    }
  }
  
  return Array.from(props.values());
}

function parseDispatchedEvents(jsText) {
  const events = new Map();
  
  // Find CustomEvent dispatches
  const eventRegex = /dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*["']([^"']+)["']/g;
  
  let match;
  while ((match = eventRegex.exec(jsText)) !== null) {
    const eventName = match[1];
    if (!events.has(eventName)) {
      events.set(eventName, { name: eventName, detail: "TODO" });
    }
  }
  
  return Array.from(events.values());
}

function parseSlotsFromHtml(htmlText) {
  if (!htmlText) return [];
  
  const slotRegex = /<slot\s+(?:name=["']([^"']+)["'])?\s*>/g;
  const slots = new Set();
  
  let match;
  while ((match = slotRegex.exec(htmlText)) !== null) {
    const slotName = match[1] || "(default)";
    slots.add(slotName);
  }
  
  return Array.from(slots).sort();
}

function extractComponentAPI(componentDir, componentName) {
  const jsFile = path.join(componentDir, `${componentName}.js`);
  const htmlFile = path.join(componentDir, `${componentName}.html`);
  
  const jsText = safeRead(jsFile);
  const htmlText = safeRead(htmlFile);
  
  return {
    name: componentName,
    attributes: parseObservedAttributes(jsText),
    properties: parsePublicProperties(jsText),
    methods: parsePublicMethods(jsText),
    events: parseDispatchedEvents(jsText),
    slots: parseSlotsFromHtml(htmlText)
  };
}

function buildComponentAPIDoc() {
  const components = [];
  
  for (const category of categories) {
    const categoryPath = path.join(componentsRoot, category);
    const componentDirs = listComponentDirs(categoryPath);
    
    for (const componentDir of componentDirs) {
      const componentName = path.basename(componentDir);
      const api = extractComponentAPI(componentDir, componentName);
      components.push({ category, ...api });
    }
  }
  
  // Sort by category then name
  components.sort((a, b) => {
    const catOrder = { "core": 0, "data-viz": 1, "layout": 2, "toolbars": 3 };
    const catDiff = catOrder[a.category] - catOrder[b.category];
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });
  
  // Build the document
  const lines = [
    "# Component Public API Reference",
    "",
    "Complete API surface for all 22 sherpa-* web components.",
    "",
    "## Quick Index",
    ""
  ];
  
  // Add category tables
  for (const category of categories) {
    const catComponents = components.filter(c => c.category === category);
    if (catComponents.length === 0) continue;
    
    lines.push(`### ${CATEGORY_LABELS[category]}`);
    lines.push("");
    lines.push("| Component | Attributes | Properties | Methods | Events | Slots |");
    lines.push("|-----------|-----------|-----------|---------|--------|-------|");
    
    for (const comp of catComponents) {
      const attrs = comp.attributes.length || "—";
      const props = comp.properties.length || "—";
      const methods = comp.methods.length || "—";
      const events = comp.events.length || "—";
      const slots = comp.slots.length || "—";
      lines.push(`| [\`${comp.name}\`](#${comp.name}) | ${attrs} | ${props} | ${methods} | ${events} | ${slots} |`);
    }
    lines.push("");
  }
  
  // Add detailed component sections
  lines.push("---");
  lines.push("");
  lines.push("## Component Details");
  lines.push("");
  
  for (const comp of components) {
    const categoryLabel = CATEGORY_LABELS[comp.category];
    
    lines.push(`### ${comp.name}`);
    lines.push("");
    lines.push(`**Category:** ${categoryLabel}  `);
    lines.push(`**Full tag:** \`<${comp.name}></${comp.name}>\`  `);
    lines.push("");
    
    // Attributes
    if (comp.attributes.length > 0) {
      lines.push("**Attributes:**");
      lines.push("");
      for (const attr of comp.attributes) {
        lines.push(`- \`${attr}\` — TODO (type, default, description)`);
      }
      lines.push("");
    }
    
    // Properties / Methods
    if (comp.properties.length > 0) {
      lines.push("**Properties:**");
      lines.push("");
      for (const prop of comp.properties) {
        const accessors = [];
        if (prop.getter) accessors.push("get");
        if (prop.setter) accessors.push("set");
        lines.push(`- \`${prop.name}\` (${accessors.join("/")})`);
      }
      lines.push("");
    }
    
    if (comp.methods.length > 0) {
      lines.push("**Methods:**");
      lines.push("");
      for (const method of comp.methods) {
        lines.push(`- \`${method.name}()\` — ${method.description}`);
      }
      lines.push("");
    }
    
    // Events
    if (comp.events.length > 0) {
      lines.push("**Events:**");
      lines.push("");
      for (const event of comp.events) {
        lines.push(`- \`${event.name}\` — ${event.detail}`);
      }
      lines.push("");
    }
    
    // Slots
    if (comp.slots.length > 0) {
      lines.push("**Slots:**");
      lines.push("");
      for (const slot of comp.slots) {
        lines.push(`- \`${slot}\` — TODO`);
      }
      lines.push("");
    }
    
    if (comp.attributes.length === 0 && comp.properties.length === 0 && 
        comp.methods.length === 0 && comp.events.length === 0 && comp.slots.length === 0) {
      lines.push("*(No public API detected — may be a container component)*");
      lines.push("");
    }
  }
  
  // Add notes and recommendations
  lines.push("---");
  lines.push("");
  lines.push("## API Completion Notes");
  lines.push("");
  lines.push("- `TODO` items indicate where JSDoc, manual documentation, or further inspection is needed");
  lines.push("- Run `npm run docs` to regenerate component READMEs from this reference");
  lines.push("- All public methods should include JSDoc `@param` and `@returns` annotations");
  lines.push("- All observed attributes should document their type (boolean, string, enum) and default");
  lines.push("- All dispatched events should document their detail object structure");
  lines.push("");
  lines.push("## Next Steps");
  lines.push("");
  lines.push("1. **Fill JSDoc:** Add `@param`, `@returns`, and `@description` tags to all public methods");
  lines.push("2. **Document attributes:** Update JSDoc header comments to describe each observedAttribute");
  lines.push("3. **Validate events:** Ensure all CustomEvent dispatches include detail structure");
  lines.push("4. **Define types:** Create TypeScript definitions (`.d.ts`) for all components");
  lines.push("5. **Test coverage:** Add unit tests for all public methods and properties");
  
  return lines.join("\n");
}

function run() {
  const outputPath = path.join(componentsRoot, "COMPONENT-API.md");
  const content = buildComponentAPIDoc();
  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`Generated ${outputPath}`);
}

run();
