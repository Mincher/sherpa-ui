// @ts-nocheck
/**
 * Sherpa UI Playground
 * Interactive component explorer with live preview
 */

// ── State ──────────────────────────────────────────────────────────

let schemas = {};
let currentComponent = null;
let currentAttributes = {};

// ── DOM Elements ───────────────────────────────────────────────────

const componentSelector = document.getElementById('component-selector');
const codeEditor = document.getElementById('code-editor');
const previewContainer = document.getElementById('preview-container');
const apiDocs = document.getElementById('api-docs');
const attributeControls = document.getElementById('attribute-controls');
const slotControls = document.getElementById('slot-controls');
const controlsContainer = document.getElementById('controls-container');
const slotsContainer = document.getElementById('slots-container');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const copyCodeBtn = document.getElementById('copy-code-btn');
const shareBtn = document.getElementById('share-btn');
const resetBtn = document.getElementById('reset-btn');

// ── Initialization ─────────────────────────────────────────────────

async function init() {
  await loadSchemas();
  populateComponentSelector();
  setupEventListeners();
  loadFromURL();
}

// ── Schema Loading ─────────────────────────────────────────────────

async function loadSchemas() {
  try {
    // Load the index to get list of all components
    const indexResponse = await fetch('../schemas/components/index.json');

    if (!indexResponse.ok) {
      throw new Error(`Failed to load index: ${indexResponse.status}`);
    }

    const componentNames = await indexResponse.json();

    // index.json is just an array of component names
    if (!Array.isArray(componentNames)) {
      throw new Error('Invalid index format');
    }

    console.log(`Found ${componentNames.length} components in index`);

    // Load individual component schemas
    const loadPromises = componentNames.map(async (componentName) => {
      try {
        const schemaResponse = await fetch(`../schemas/components/${componentName}.json`);
        if (schemaResponse.ok) {
          const schema = await schemaResponse.json();
          schemas[componentName] = schema;
        } else {
          console.warn(`Schema not found for ${componentName}`);
        }
      } catch (err) {
        console.warn(`Failed to load schema for ${componentName}:`, err);
      }
    });

    await Promise.all(loadPromises);

    console.log(`Loaded ${Object.keys(schemas).length} component schemas`);

    if (Object.keys(schemas).length === 0) {
      throw new Error('No schemas were loaded');
    }
  } catch (err) {
    console.error('Failed to load schemas:', err);
    showError('Failed to load component schemas. Please check the console for details.');
  }
}

function populateComponentSelector() {
  const sortedComponents = Object.keys(schemas).sort();

  sortedComponents.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    componentSelector.appendChild(option);
  });
}

// ── Event Listeners ────────────────────────────────────────────────

function setupEventListeners() {
  componentSelector.addEventListener('change', handleComponentSelect);
  codeEditor.addEventListener('input', debounce(handleCodeChange, 300));
  darkModeToggle.addEventListener('change', toggleDarkMode);
  copyCodeBtn.addEventListener('click', copyCode);
  shareBtn.addEventListener('click', shareLink);
  resetBtn.addEventListener('click', resetComponent);
}

function handleComponentSelect(e) {
  const componentName = e.target.value;
  if (!componentName) return;

  loadComponent(componentName);
}

function handleCodeChange() {
  updatePreview(codeEditor.value);
}

function toggleDarkMode(e) {
  // sherpa-switch emits 'change' event with detail.checked
  const isChecked = e.detail?.checked ?? e.target.checked ?? false;

  if (isChecked) {
    previewContainer.dataset.darkMode = 'true';
  } else {
    delete previewContainer.dataset.darkMode;
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(codeEditor.value);
    showNotification('Code copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function shareLink() {
  const url = new URL(window.location.href);
  url.searchParams.set('component', currentComponent);
  url.searchParams.set('code', btoa(codeEditor.value));

  navigator.clipboard.writeText(url.toString()).then(() => {
    showNotification('Link copied to clipboard!');
  });
}

function resetComponent() {
  if (currentComponent) {
    loadComponent(currentComponent);
  }
}

// ── Component Loading ──────────────────────────────────────────────

function loadComponent(componentName) {
  currentComponent = componentName;
  const schema = schemas[componentName];

  if (!schema) {
    showError(`Schema not found for ${componentName}`);
    return;
  }

  // Import component module
  import(`../components/${componentName}/${componentName}.js`).catch(err => {
    console.warn(`Failed to load component module:`, err);
  });

  // Generate initial HTML
  const initialHTML = generateInitialHTML(schema);
  codeEditor.value = initialHTML;

  // Update UI
  updateControls(schema);
  updateAPIDocumentation(schema);
  updatePreview(initialHTML);
  updateURL();
}

function generateInitialHTML(schema) {
  const tagName = schema.tagName || schema.name;
  const attributes = [];

  // Add some default attributes with sample values
  if (schema.attributes) {
    schema.attributes.slice(0, 3).forEach(attr => {
      if (attr.default && attr.default !== '—') {
        attributes.push(`${attr.name}="${attr.default}"`);
      }
    });
  }

  const attrsString = attributes.length > 0 ? ' ' + attributes.join(' ') : '';

  // Check if component has slots
  if (schema.slots && schema.slots.length > 0) {
    let content = '';
    schema.slots.forEach(slot => {
      const slotName = slot.name === '(default)' ? '' : slot.name;
      const slotAttr = slotName ? ` slot="${slotName}"` : '';
      content += `  <div${slotAttr}>${slot.description || 'Content'}</div>\n`;
    });
    return `<${tagName}${attrsString}>\n${content}</${tagName}>`;
  }

  return `<${tagName}${attrsString}>Content</${tagName}>`;
}

// ── Controls ───────────────────────────────────────────────────────

function updateControls(schema) {
  attributeControls.innerHTML = '';
  slotControls.innerHTML = '';

  // Generate attribute controls
  if (schema.attributes && schema.attributes.length > 0) {
    schema.attributes.forEach(attr => {
      const control = createAttributeControl(attr);
      attributeControls.appendChild(control);
    });
    controlsContainer.style.display = 'block';
  } else {
    controlsContainer.style.display = 'none';
  }

  // Generate slot controls
  if (schema.slots && schema.slots.length > 0) {
    schema.slots.forEach(slot => {
      const control = createSlotControl(slot);
      slotControls.appendChild(control);
    });
    slotsContainer.style.display = 'block';
  } else {
    slotsContainer.style.display = 'none';
  }
}

function createAttributeControl(attr) {
  const group = document.createElement('div');
  group.className = 'control-group';

  const label = document.createElement('label');
  label.className = 'control-label';
  label.textContent = attr.name;

  let input;

  // Boolean attributes (checkbox)
  if (attr.type === 'boolean' || attr.values?.includes('true')) {
    const checkbox = document.createElement('label');
    checkbox.className = 'control-checkbox';

    input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.attribute = attr.name;
    input.addEventListener('change', handleAttributeChange);

    checkbox.appendChild(input);
    checkbox.appendChild(document.createTextNode(attr.name));

    group.appendChild(checkbox);
    return group;
  }

  // Enum attributes (select)
  if (attr.values && attr.values.length > 0) {
    input = document.createElement('select');
    input.className = 'control-input';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '(none)';
    input.appendChild(emptyOption);

    attr.values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      input.appendChild(option);
    });
  } else {
    // Text input
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'control-input';
    input.placeholder = attr.default || '';
  }

  input.dataset.attribute = attr.name;
  input.addEventListener('change', handleAttributeChange);
  input.addEventListener('input', debounce(handleAttributeChange, 300));

  group.appendChild(label);
  group.appendChild(input);

  return group;
}

function createSlotControl(slot) {
  const group = document.createElement('div');
  group.className = 'control-group';

  const label = document.createElement('label');
  label.className = 'control-label';
  label.textContent = slot.name === '(default)' ? 'Default Slot' : slot.name;

  const input = document.createElement('textarea');
  input.className = 'control-input';
  input.rows = 2;
  input.placeholder = slot.description || 'Slot content';
  input.dataset.slot = slot.name;
  input.addEventListener('input', debounce(handleSlotChange, 300));

  group.appendChild(label);
  group.appendChild(input);

  return group;
}

function handleAttributeChange(e) {
  const attrName = e.target.dataset.attribute;
  let value = e.target.value;

  if (e.target.type === 'checkbox') {
    value = e.target.checked ? 'true' : '';
  }

  currentAttributes[attrName] = value;
  updateCodeFromControls();
}

function handleSlotChange(e) {
  // Update slot content in the code editor
  updateCodeFromControls();
}

function updateCodeFromControls() {
  const schema = schemas[currentComponent];
  if (!schema) return;

  const tagName = schema.tagName || schema.name;
  const attributes = Object.entries(currentAttributes)
    .filter(([_, value]) => value)
    .map(([name, value]) => `${name}="${value}"`)
    .join(' ');

  const attrsString = attributes ? ' ' + attributes : '';

  // Get slot content
  const slotInputs = slotControls.querySelectorAll('textarea');
  let content = '';

  slotInputs.forEach(input => {
    const slotName = input.dataset.slot;
    const slotContent = input.value || 'Content';
    const slotAttr = slotName === '(default)' ? '' : ` slot="${slotName}"`;
    content += `  <div${slotAttr}>${slotContent}</div>\n`;
  });

  if (!content) {
    content = 'Content';
  }

  codeEditor.value = `<${tagName}${attrsString}>\n${content}</${tagName}>`;
  updatePreview(codeEditor.value);
}

// ── Preview ────────────────────────────────────────────────────────

function updatePreview(html) {
  previewContainer.innerHTML = html;
}

// ── API Documentation ──────────────────────────────────────────────

function updateAPIDocumentation(schema) {
  apiDocs.innerHTML = '';

  // Attributes
  if (schema.attributes && schema.attributes.length > 0) {
    const section = createAPISection('Attributes', schema.attributes, (attr) => {
      return {
        name: attr.name,
        type: attr.type,
        description: attr.description,
        values: attr.values,
        default: attr.default,
      };
    });
    apiDocs.appendChild(section);
  }

  // Properties
  if (schema.properties && schema.properties.length > 0) {
    const section = createAPISection('Properties', schema.properties, (prop) => {
      return {
        name: prop.name,
        type: prop.type,
        description: prop.description,
      };
    });
    apiDocs.appendChild(section);
  }

  // Events
  if (schema.events && schema.events.length > 0) {
    const section = createAPISection('Events', schema.events, (event) => {
      return {
        name: event.name,
        type: 'event',
        description: event.description,
      };
    });
    apiDocs.appendChild(section);
  }

  // Slots
  if (schema.slots && schema.slots.length > 0) {
    const section = createAPISection('Slots', schema.slots, (slot) => {
      return {
        name: slot.name,
        type: 'slot',
        description: slot.description,
      };
    });
    apiDocs.appendChild(section);
  }
}

function createAPISection(title, items, mapper) {
  const section = document.createElement('div');

  const heading = document.createElement('div');
  heading.className = 'api-section-title';
  heading.textContent = title;
  section.appendChild(heading);

  items.forEach(item => {
    const mapped = mapper(item);
    const itemEl = createAPIItem(mapped);
    section.appendChild(itemEl);
  });

  return section;
}

function createAPIItem(item) {
  const div = document.createElement('div');
  div.className = 'api-item';

  const name = document.createElement('div');
  name.className = 'api-item-name';
  name.textContent = item.name;

  if (item.type) {
    const type = document.createElement('span');
    type.className = 'api-item-type';
    type.textContent = item.type;
    name.appendChild(type);
  }

  div.appendChild(name);

  if (item.description) {
    const desc = document.createElement('div');
    desc.className = 'api-item-description';
    desc.textContent = item.description;
    div.appendChild(desc);
  }

  if (item.values && item.values.length > 0) {
    const values = document.createElement('div');
    values.className = 'api-item-values';
    values.textContent = `Values: ${item.values.join(', ')}`;
    div.appendChild(values);
  }

  if (item.default && item.default !== '—') {
    const defaultVal = document.createElement('div');
    defaultVal.className = 'api-item-values';
    defaultVal.textContent = `Default: ${item.default}`;
    div.appendChild(defaultVal);
  }

  return div;
}

// ── URL State ──────────────────────────────────────────────────────

function updateURL() {
  const url = new URL(window.location.href);
  url.searchParams.set('component', currentComponent);
  window.history.replaceState({}, '', url);
}

function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  const component = params.get('component');
  const code = params.get('code');

  if (component && schemas[component]) {
    componentSelector.value = component;
    loadComponent(component);

    if (code) {
      try {
        codeEditor.value = atob(code);
        updatePreview(codeEditor.value);
      } catch (err) {
        console.error('Failed to decode code from URL:', err);
      }
    }
  }
}

// ── Utilities ──────────────────────────────────────────────────────

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showError(message) {
  previewContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

function showNotification(message, icon = 'fa-check-circle') {
  const notification = document.createElement('div');
  notification.className = 'playground-notification';
  notification.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// ── Start ──────────────────────────────────────────────────────────

init();
